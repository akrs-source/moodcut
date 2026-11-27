const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(keyBytes: Uint8Array, value: string) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyTelegram(initData: string, botToken: string) {
  if (!initData || initData.length > 12000) throw new Error("telegram_auth_required");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date") || 0);
  const userRaw = params.get("user");
  if (!receivedHash || !userRaw || !Number.isFinite(authDate)) {
    throw new Error("telegram_auth_invalid");
  }
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) {
    throw new Error("telegram_auth_expired");
  }
  const check = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const expected = hex(await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    enc.encode(check),
  ));
  if (!safeEqual(expected, receivedHash.toLowerCase())) throw new Error("telegram_auth_invalid");
  const user = JSON.parse(userRaw);
  if (!user?.id || !Number.isSafeInteger(Number(user.id))) throw new Error("telegram_user_invalid");
  return {
    id: String(user.id),
    username: typeof user.username === "string" ? user.username.slice(0, 64) : null,
    first_name: typeof user.first_name === "string" ? user.first_name.slice(0, 128) : null,
    last_name: typeof user.last_name === "string" ? user.last_name.slice(0, 128) : null,
  };
}

function getAdminHeaders() {
  const url = Deno.env.get("SUPABASE_URL");
  let key = "";
  let modern = false;
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      key = JSON.parse(secretKeys).default || "";
      modern = !!key;
    } catch { /* fall back to legacy key */ }
  }
  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("supabase_admin_key_missing");
  const headers: Record<string, string> = {
    "apikey": key,
    "Content-Type": "application/json",
  };
  if (!modern) headers.Authorization = "Bearer " + key;
  return { url, headers };
}

async function db(table: string, query: string, method = "GET", body?: unknown, prefer?: string) {
  const { url, headers } = getAdminHeaders();
  const h = { ...headers, ...(prefer ? { Prefer: prefer } : {}) };
  const response = await fetch(`${url}/rest/v1/${table}${query ? "?" + query : ""}`, {
    method,
    headers: h,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error("database_error_" + response.status + ":" + raw.slice(0, 300));
  return raw ? JSON.parse(raw) : null;
}

const allowed = (value: unknown, list: string[]) =>
  typeof value === "string" && list.includes(value);

const ADMIN_TELEGRAM_IDS = new Set(["7738464404"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return json({ error: "telegram_bot_token_missing" }, 500);

    const body = await req.json();
    const user = await verifyTelegram(String(body.initData || ""), token);
    const telegram_id = user.id;
    const action = String(body.action || "");
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

    if (action === "bootstrap") {
      await db("forma_profiles", "on_conflict=telegram_id", "POST", {
        telegram_id, username: user.username, first_name: user.first_name, last_name: user.last_name,
        updated_at: new Date().toISOString(),
      }, "resolution=merge-duplicates,return=minimal");
      const isAdmin = ADMIN_TELEGRAM_IDS.has(telegram_id);
      const [profile, goals, preferences, entries, weights, measurements, plans, catalog, supportMessages] = await Promise.all([
        db("forma_profiles", `telegram_id=eq.${telegram_id}&select=telegram_id,username,first_name,last_name,created_at,updated_at`),
        db("forma_goals", `telegram_id=eq.${telegram_id}&select=*`),
        db("forma_preferences", `telegram_id=eq.${telegram_id}&select=*`),
        db("forma_food_entries", `telegram_id=eq.${telegram_id}&select=*&order=eaten_at.desc&limit=300`),
        db("forma_weight_logs", `telegram_id=eq.${telegram_id}&select=*&order=measured_at.desc&limit=180`),
        db("forma_body_measurements", `telegram_id=eq.${telegram_id}&select=*&order=measured_at.desc&limit=180`),
        db("forma_meal_plans", `telegram_id=eq.${telegram_id}&select=*&order=plan_date.asc&limit=100`),
        db("forma_recipe_catalog", `select=*&${isAdmin ? "" : "is_published=eq.true&"}order=created_at.desc&limit=300`),
        db("forma_support_messages", `telegram_id=eq.${telegram_id}&select=id,message,status,admin_reply,created_at,replied_at&order=created_at.asc&limit=100`),
      ]);
      return json({ ok: true, user, profile: profile?.[0] || null, goals: goals?.[0] || null,
        preferences: preferences?.[0] || null, entries: entries || [], weights: weights || [], measurements: measurements || [], plans: plans || [],
        is_admin: isAdmin, catalog: catalog || [], support_messages: supportMessages || [] });
    }

    if (action === "upload_catalog_image") {
      if (!ADMIN_TELEGRAM_IDS.has(telegram_id)) return json({ error: "admin_required" }, 403);
      const mime = String(payload.mime_type || "").toLowerCase();
      const extByMime: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };
      if (!extByMime[mime]) return json({ error: "unsupported_image_type" }, 400);
      const encoded = String(payload.base64 || "");
      if (!encoded || encoded.length > 5_600_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        return json({ error: "image_too_large_or_invalid" }, 400);
      }
      const binary = atob(encoded);
      if (binary.length > 4 * 1024 * 1024) return json({ error: "image_too_large" }, 413);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { url, headers } = getAdminHeaders();
      const bucket = "forma-recipe-images";
      const storageServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || headers.apikey;
      const authHeaders = { ...headers, Authorization: "Bearer " + storageServiceKey };
      const bucketResponse = await fetch(`${url}/storage/v1/bucket`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 4194304, allowed_mime_types: ["image/jpeg","image/png","image/webp"] }),
      });
      if (!bucketResponse.ok && bucketResponse.status !== 409) {
        const detail = await bucketResponse.text();
        if (bucketResponse.status !== 400 || !detail.toLowerCase().includes("already")) {
          throw new Error("storage_bucket_error_" + bucketResponse.status + ":" + detail.slice(0,200));
        }
      }
      const objectPath = "recipes/" + crypto.randomUUID() + "." + extByMime[mime];
      const uploadResponse = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": mime, "x-upsert": "false" },
        body: bytes,
      });
      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text();
        throw new Error("storage_upload_error_" + uploadResponse.status + ":" + detail.slice(0,250));
      }
      const imageUrl = `${url}/storage/v1/object/public/${bucket}/${objectPath}`;
      return json({ ok: true, image_url: imageUrl });
    }

    if (action === "save_catalog_recipe" || action === "delete_catalog_recipe") {
      if (!ADMIN_TELEGRAM_IDS.has(telegram_id)) return json({ error: "admin_required" }, 403);
      if (action === "delete_catalog_recipe") {
        const id = String(payload.id || "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
        await db("forma_recipe_catalog", `id=eq.${encodeURIComponent(id)}`, "DELETE");
        return json({ ok: true });
      }
      const title = String(payload.title || "").trim().slice(0,160);
      const category = allowed(payload.category, ["Завтраки","Обеды","Ужины","Перекусы","Низкокалорийные"]) ? payload.category : "Обеды";
      const numeric = (v: unknown) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0;
      const arr = (v: unknown, max: number) => Array.isArray(v) ? v.slice(0,max) : [];
      const ingredients = arr(payload.ingredients,40).map((x: any) => ({ name:String(x?.name || "").slice(0,120), amount:String(x?.amount || "").slice(0,60) })).filter((x: any) => x.name);
      const steps = arr(payload.steps,30).map((x: any) => String(x || "").trim().slice(0,700)).filter(Boolean);
      if (!title || !ingredients.length || !steps.length) return json({ error: "recipe_fields_required" }, 400);
      const imageUrl = String(payload.image_url || "").trim();
      if (imageUrl) { try { if (new URL(imageUrl).protocol !== "https:") return json({ error:"invalid_image_url" }, 400); } catch { return json({ error:"invalid_image_url" }, 400); } }
      const record = { title, category, prep_time:String(payload.prep_time || "20 минут").slice(0,40), image_url:imageUrl.slice(0,1000), servings:Math.min(50,Math.max(1,Math.round(numeric(payload.servings || 1)))), kcal:numeric(payload.kcal), protein_g:numeric(payload.protein_g), fat_g:numeric(payload.fat_g), carbs_g:numeric(payload.carbs_g), ingredients, steps, is_premium:payload.is_premium === true, is_published:payload.is_published !== false, updated_at:new Date().toISOString() };
      const id = String(payload.id || "");
      const rows = id && /^[0-9a-f-]{36}$/i.test(id) ? await db("forma_recipe_catalog", `id=eq.${encodeURIComponent(id)}`, "PATCH", record, "return=representation") : await db("forma_recipe_catalog", "", "POST", record, "return=representation");
      return json({ ok:true, recipe:rows?.[0] || null });
    }

    if (action === "save_goals") {
      const p = {
        telegram_id,
        goal_type: allowed(payload.goal_type, ["lose","gain","maintain","recomposition","healthier"]) ? payload.goal_type : "maintain",
        age: payload.age ?? null, height_cm: payload.height_cm ?? null,
        current_weight_kg: payload.current_weight_kg ?? null, target_weight_kg: payload.target_weight_kg ?? null,
        activity_level: payload.activity_level ?? null, sex: payload.sex ?? null,
        daily_kcal: payload.daily_kcal ?? null, protein_g: payload.protein_g ?? null,
        fat_g: payload.fat_g ?? null, carbs_g: payload.carbs_g ?? null,
        updated_at: new Date().toISOString(),
      };
      await db("forma_goals", "on_conflict=telegram_id", "POST", p, "resolution=merge-duplicates,return=minimal");
      return json({ ok: true });
    }

    if (action === "save_preferences") {
      const arr = (v: unknown) => Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, 100).map(x => x.slice(0, 100)) : [];
      const p = {
        telegram_id, dietary_preferences: arr(payload.dietary_preferences),
        excluded_foods: arr(payload.excluded_foods), allergies: arr(payload.allergies),
        meals_per_day: payload.meals_per_day ?? null, budget_level: payload.budget_level ?? null,
        cooking_time: payload.cooking_time ?? null, updated_at: new Date().toISOString(),
      };
      await db("forma_preferences", "on_conflict=telegram_id", "POST", p, "resolution=merge-duplicates,return=minimal");
      return json({ ok: true });
    }

    if (action === "save_plan") {
      const planDate = String(payload.plan_date || "");
      const title = String(payload.title || "").trim();
      const mealType = allowed(payload.meal_type, ["breakfast","lunch","snack","dinner"]) ? payload.meal_type : "";
      const numeric = (v: unknown) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate) || !title || title.length > 160 || !mealType) {
        return json({ error: "invalid_plan" }, 400);
      }
      const values = {
        telegram_id, plan_date: planDate, meal_type: mealType, title,
        description: String(payload.description || "").slice(0, 1000),
        kcal: numeric(payload.kcal), protein_g: numeric(payload.protein_g),
        fat_g: numeric(payload.fat_g), carbs_g: numeric(payload.carbs_g),
      };
      const id = String(payload.id || "");
      const rows = id && /^[0-9a-f-]{36}$/i.test(id)
        ? await db("forma_meal_plans", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "PATCH", values, "return=representation")
        : await db("forma_meal_plans", "", "POST", values, "return=representation");
      return json({ ok: true, plan: rows?.[0] || null });
    }

    if (action === "delete_plan") {
      const id = String(payload.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      await db("forma_meal_plans", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "DELETE");
      return json({ ok: true });
    }

    if (action === "search_food") {
      const query = String(payload.query || "").trim().replace(/\s+/g, " ");
      if (query.length < 2 || query.length > 80) return json({ error: "invalid_query" }, 400);
      const params = new URLSearchParams({
        search_terms: query, search_simple: "1", action: "process", json: "1",
        page_size: "12", fields: "product_name,brands,quantity,nutriments,code",
      });
      const response = await fetch("https://world.openfoodfacts.org/cgi/search.pl?" + params.toString(), {
        headers: { "User-Agent": "FORMA/1.0 (https://akrs-source.github.io/moodcut/)" },
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) return json({ error: "food_database_unavailable" }, 502);
      const result = await response.json();
      const products = (Array.isArray(result.products) ? result.products : []).map((p: any) => {
        const n = p?.nutriments || {};
        const numeric = (v: unknown) => v == null || v === "" ? NaN : Number(v);
        const kcalRaw = n["energy-kcal_100g"] ?? n["energy-kcal_value"];
        const energyKj = n["energy-kj_100g"] ?? n["energy-kj_value"] ?? n["energy_100g"];
        const kcal = kcalRaw != null && kcalRaw !== "" ? numeric(kcalRaw) : (energyKj != null && energyKj !== "" ? numeric(energyKj) / 4.184 : NaN);
        const protein = numeric(n.proteins_100g), fat = numeric(n.fat_100g), carbs = numeric(n.carbohydrates_100g);
        const name = String(p?.product_name || "").trim().slice(0, 160);
        if (!name || !Number.isFinite(kcal) || !Number.isFinite(protein) || !Number.isFinite(fat) || !Number.isFinite(carbs) || kcal < 0 || protein < 0 || fat < 0 || carbs < 0) return null;
        return { name, brand: String(p?.brands || "").slice(0, 100), quantity: String(p?.quantity || "").slice(0, 80), code: String(p?.code || "").slice(0, 32), kcal: Math.round(kcal * 10) / 10, p: Math.round(protein * 10) / 10, f: Math.round(fat * 10) / 10, c: Math.round(carbs * 10) / 10 };
      }).filter(Boolean).slice(0, 12);
      return json({ ok: true, products });
    }

    if (action === "save_entry") {
      const name = String(payload.food_name || "").trim();
      const grams = Number(payload.grams);
      const numeric = (v: unknown) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0;
      if (!name || name.length > 180 || !Number.isFinite(grams) || grams <= 0 || grams > 10000) {
        return json({ error: "invalid_entry" }, 400);
      }
      const meal_type = allowed(payload.meal_type, ["breakfast","lunch","snack","dinner","other"]) ? payload.meal_type : "other";
      const weight_state = allowed(payload.weight_state, ["raw","cooked","label"]) ? payload.weight_state : "label";
      const source = allowed(payload.source, ["manual","recipe","photo","barcode"]) ? payload.source : "manual";
      const rows = await db("forma_food_entries", "", "POST", {
        telegram_id, food_name: name, grams, meal_type,
        kcal: numeric(payload.kcal), protein_g: numeric(payload.protein_g),
        fat_g: numeric(payload.fat_g), carbs_g: numeric(payload.carbs_g),
        weight_state, source,
        ...(payload.image_url && /^https:\/\//i.test(String(payload.image_url)) ? { image_url: String(payload.image_url).slice(0,2048) } : {}),
        ...(payload.eaten_at ? { eaten_at: payload.eaten_at } : {}),
      }, "return=representation");
      return json({ ok: true, entry: rows?.[0] || null });
    }

    if (action === "delete_entry") {
      const id = String(payload.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      await db("forma_food_entries", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "DELETE");
      return json({ ok: true });
    }

    if (action === "save_body_measurement") {
      const date = typeof payload.measured_at === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(payload.measured_at)
        ? payload.measured_at : new Date().toISOString().slice(0, 10);
      const fields = ["waist_cm", "abdomen_cm", "hips_cm", "chest_cm", "under_bust_cm", "thigh_cm", "arm_cm"];
      const row: Record<string, unknown> = { telegram_id, measured_at: date, updated_at: new Date().toISOString() };
      let count = 0;
      for (const field of fields) {
        const raw = payload[field];
        if (raw === "" || raw === null || raw === undefined) { row[field] = null; continue; }
        const value = Number(raw);
        const min = field === "thigh_cm" || field === "arm_cm" ? 10 : 20;
        const max = field === "arm_cm" ? 100 : field === "thigh_cm" ? 150 : 250;
        if (!Number.isFinite(value) || value < min || value > max) return json({ error: "invalid_" + field }, 400);
        row[field] = value;
        count++;
      }
      if (!count) return json({ error: "empty_measurement" }, 400);
      const rows = await db("forma_body_measurements", "on_conflict=telegram_id,measured_at", "POST", row,
        "resolution=merge-duplicates,return=representation");
      return json({ ok: true, measurement: rows?.[0] || row });
    }

    if (action === "update_body_measurement") {
      const id = String(payload.id || "");
      const date = String(payload.measured_at || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return json({ error: "invalid_date" }, 400);
      const fields = ["waist_cm", "abdomen_cm", "hips_cm", "chest_cm", "under_bust_cm", "thigh_cm", "arm_cm"];
      const row: Record<string, unknown> = { measured_at: date, updated_at: new Date().toISOString() };
      let count = 0;
      for (const field of fields) {
        const raw = payload[field];
        if (raw === "" || raw === null || raw === undefined) { row[field] = null; continue; }
        const value = Number(raw);
        const min = field === "thigh_cm" || field === "arm_cm" ? 10 : 20;
        const max = field === "arm_cm" ? 100 : field === "thigh_cm" ? 150 : 250;
        if (!Number.isFinite(value) || value < min || value > max) return json({ error: "invalid_" + field }, 400);
        row[field] = value;
        count++;
      }
      if (!count) return json({ error: "empty_measurement" }, 400);
      const rows = await db("forma_body_measurements", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "PATCH", row, "return=representation");
      return json({ ok: true, measurement: rows?.[0] || null });
    }

    if (action === "delete_body_measurement") {
      const id = String(payload.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      await db("forma_body_measurements", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "DELETE");
      return json({ ok: true });
    }

    if (action === "update_weight") {
      const id = String(payload.id || "");
      const weight = Number(payload.weight_kg);
      const date = String(payload.measured_at || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      if (!Number.isFinite(weight) || weight < 20 || weight > 400) return json({ error: "invalid_weight" }, 400);
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return json({ error: "invalid_date" }, 400);
      await db("forma_weight_logs", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "PATCH", { weight_kg: weight, measured_at: date });
      return json({ ok: true, id, measured_at: date, weight_kg: weight });
    }

    if (action === "save_weight") {
      const weight = Number(payload.weight_kg);
      if (!Number.isFinite(weight) || weight < 20 || weight > 400) return json({ error: "invalid_weight" }, 400);
      const date = typeof payload.measured_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.measured_at)
        ? payload.measured_at : new Date().toISOString().slice(0, 10);
      const existing = await db("forma_weight_logs",
        `telegram_id=eq.${telegram_id}&measured_at=eq.${date}&select=id&limit=1`);
      if (existing?.[0]) {
        await db("forma_weight_logs", `id=eq.${existing[0].id}&telegram_id=eq.${telegram_id}`, "PATCH", { weight_kg: weight });
      } else {
        await db("forma_weight_logs", "", "POST", { telegram_id, measured_at: date, weight_kg: weight });
      }
      const savedRows = await db("forma_weight_logs", `telegram_id=eq.${telegram_id}&measured_at=eq.${date}&select=id,measured_at,weight_kg&limit=1`);
      return json({ ok: true, ...(savedRows?.[0] || { measured_at: date, weight_kg: weight }) });
    }

    if (action === "delete_weight") {
      const id = String(payload.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      await db("forma_weight_logs", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "DELETE");
      return json({ ok: true });
    }


    if (action === "get_support_messages") {
      const messages = await db("forma_support_messages",
        `telegram_id=eq.${telegram_id}&select=id,message,status,admin_reply,created_at,replied_at&order=created_at.asc&limit=100`);
      return json({ ok: true, messages: messages || [] });
    }

    if (action === "send_support_message") {
      const message = String(payload.message || "").trim();
      if (!message || message.length > 3500) return json({ error: "invalid_support_message" }, 400);
      const settings = await db("forma_support_settings", "id=eq.1&select=group_chat_id&limit=1");
      const groupChatId = String(settings?.[0]?.group_chat_id || "");
      if (!groupChatId) return json({ error: "support_not_configured" }, 503);
      const rows = await db("forma_support_messages", "", "POST", {
        telegram_id, username: user.username, first_name: user.first_name,
        message, status: "sent",
      }, "return=representation");
      const saved = rows?.[0];
      if (!saved?.id) throw new Error("support_message_save_failed");
      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: groupChatId,
            text: `Новый вопрос FORMA\\nОт: ${user.first_name || "Пользователь"}${user.username ? " (@" + user.username + ")" : ""}\\nTelegram ID: ${telegram_id}\\n\\n${message}`,
            disable_web_page_preview: true,
          }),
        });
        const telegramResult = await telegramResponse.json();
        if (!telegramResponse.ok || !telegramResult?.ok) throw new Error(telegramResult?.description || "telegram_send_failed");
        const groupMessageId = telegramResult.result?.message_id;
        const updated = await db("forma_support_messages", `id=eq.${encodeURIComponent(saved.id)}`, "PATCH",
          { status: "sent", group_message_id: groupMessageId }, "return=representation");
        return json({ ok: true, message: updated?.[0] || { ...saved, status: "sent", group_message_id: groupMessageId } });
      } catch (error) {
        await db("forma_support_messages", `id=eq.${encodeURIComponent(saved.id)}`, "PATCH", { status: "failed" });
        throw error;
      }
    }

    if (action === "admin_setup_support_webhook") {
      if (!ADMIN_TELEGRAM_IDS.has(telegram_id)) return json({ error: "admin_required" }, 403);
      const settings = await db("forma_support_settings", "id=eq.1&select=group_chat_id,webhook_secret&limit=1");
      const webhookSecret = String(settings?.[0]?.webhook_secret || "");
      if (!webhookSecret) return json({ error: "support_webhook_secret_missing" }, 500);
      const { url } = getAdminHeaders();
      const webhookUrl = `${url}/functions/v1/quick-worker`;
      const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret,
          allowed_updates: ["message", "pre_checkout_query"], drop_pending_updates: false }),
      });
      const telegramResult = await telegramResponse.json();
      if (!telegramResponse.ok || !telegramResult?.ok) throw new Error(telegramResult?.description || "telegram_webhook_setup_failed");
      return json({ ok: true, webhook_url: webhookUrl });
    }

    if (action === "admin_overview") {
      if (!ADMIN_TELEGRAM_IDS.has(telegram_id)) return json({ error: "admin_required" }, 403);
      const [users, goals, entries, weights, plans] = await Promise.all([
        db("forma_profiles", "select=telegram_id,username,first_name,last_name,updated_at&order=updated_at.desc&limit=1000"),
        db("forma_goals", "select=telegram_id&limit=5000"),
        db("forma_food_entries", "select=id&limit=10000"),
        db("forma_weight_logs", "select=id&limit=10000"),
        db("forma_meal_plans", "select=id&limit=10000"),
      ]);
      return json({
        ok: true,
        users: users || [],
        total_returned: (users || []).length,
        stats: {
          total_users: (users || []).length,
          users_with_goals: (goals || []).length,
          diary_entries: (entries || []).length,
          weight_logs: (weights || []).length,
          meal_plans: (plans || []).length,
        },
      });
    }

    if (action === "admin_subscriptions") {
      if (!ADMIN_TELEGRAM_IDS.has(telegram_id)) return json({ error: "admin_required" }, 403);
      const [users, subscriptions] = await Promise.all([
        db("forma_profiles", "select=telegram_id,username,first_name,last_name&order=created_at.desc&limit=1000"),
        db("forma_subscriptions", "select=telegram_id,plan_code,status,starts_at,expires_at,note,granted_by,created_at,updated_at&order=updated_at.desc&limit=2000"),
      ]);
      return json({ ok: true, users: users || [], subscriptions: subscriptions || [] });
    }

    if (action === "admin_set_subscription") {
      if (!ADMIN_TELEGRAM_IDS.has(telegram_id)) return json({ error: "admin_required" }, 403);
      const targetId = String(payload.telegram_id || "").trim();
      if (!/^\\d{1,24}$/.test(targetId)) return json({ error: "invalid_telegram_id" }, 400);
      const operation = String(payload.operation || "");
      const now = new Date();
      const existing = await db("forma_subscriptions",
        "telegram_id=eq." + encodeURIComponent(targetId) + "&select=telegram_id,expires_at,status&limit=1");
      if (operation === "revoke") {
        if (existing?.[0]) {
          await db("forma_subscriptions", "telegram_id=eq." + encodeURIComponent(targetId), "PATCH",
            { status: "cancelled", updated_at: now.toISOString() });
        }
        return json({ ok: true, operation, telegram_id: targetId });
      }
      if (operation !== "grant") return json({ error: "invalid_operation" }, 400);
      const days = Number(payload.days ?? 30);
      if (!Number.isInteger(days) || days < 1 || days > 3650) return json({ error: "invalid_days" }, 400);
      const currentExpiry = existing?.[0]?.status === "active" && existing?.[0]?.expires_at
        ? new Date(existing[0].expires_at) : now;
      const base = currentExpiry > now ? currentExpiry : now;
      const expires = new Date(base.getTime() + days * 86400000).toISOString();
      const row = {
        telegram_id: targetId, plan_code: "pro", status: "active",
        starts_at: existing?.[0]?.starts_at || now.toISOString(),
        expires_at: expires,
        note: String(payload.note || "").slice(0, 500),
        granted_by: telegram_id, updated_at: now.toISOString(),
      };
      await db("forma_subscriptions", "on_conflict=telegram_id", "POST", row,
        "resolution=merge-duplicates,return=minimal");
      return json({ ok: true, operation, telegram_id: targetId, expires_at: expires });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal_error";
    if (message.startsWith("telegram_auth")) return json({ error: message }, 401);
    if (message === "telegram_user_invalid") return json({ error: message }, 401);
    return json({ error: message.slice(0, 500) }, 500);
  }
});
