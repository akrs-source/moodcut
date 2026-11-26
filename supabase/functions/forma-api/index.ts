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
      const [profile, goals, preferences, entries, weights, plans] = await Promise.all([
        db("forma_profiles", `telegram_id=eq.${telegram_id}&select=telegram_id,username,first_name,last_name,created_at,updated_at`),
        db("forma_goals", `telegram_id=eq.${telegram_id}&select=*`),
        db("forma_preferences", `telegram_id=eq.${telegram_id}&select=*`),
        db("forma_food_entries", `telegram_id=eq.${telegram_id}&select=*&order=eaten_at.desc&limit=300`),
        db("forma_weight_logs", `telegram_id=eq.${telegram_id}&select=*&order=measured_at.desc&limit=180`),
        db("forma_meal_plans", `telegram_id=eq.${telegram_id}&select=*&order=plan_date.asc&limit=100`),
      ]);
      return json({ ok: true, user, profile: profile?.[0] || null, goals: goals?.[0] || null,
        preferences: preferences?.[0] || null, entries: entries || [], weights: weights || [], plans: plans || [] });
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
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(planDate) || !title || title.length > 160 || !mealType) {
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
      return json({ ok: true, measured_at: date, weight_kg: weight });
    }

    if (action === "delete_weight") {
      const id = String(payload.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      await db("forma_weight_logs", `id=eq.${encodeURIComponent(id)}&telegram_id=eq.${telegram_id}`, "DELETE");
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal_error";
    if (message.startsWith("telegram_auth")) return json({ error: message }, 401);
    if (message === "telegram_user_invalid") return json({ error: message }, 401);
    return json({ error: message.slice(0, 500) }, 500);
  }
});
