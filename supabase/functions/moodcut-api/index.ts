import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyTelegram(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!receivedHash || !authDate) throw new Error("telegram_auth_missing");
  if (Math.abs(Date.now() / 1000 - authDate) > 86400) throw new Error("telegram_auth_expired");

  const entries = [...params.entries()].filter(([key]) => key !== "hash").sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const checkString = entries.map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = await hmac(new TextEncoder().encode("WebAppData"), botToken);
  const calculatedHash = hex(await hmac(secretKey, checkString));
  if (!safeEqual(calculatedHash, receivedHash)) throw new Error("telegram_auth_invalid");

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("telegram_user_missing");
  const user = JSON.parse(rawUser);
  if (!user.id) throw new Error("telegram_user_missing");
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const initData = String(body.initData || "");
    const action = String(body.action || "me");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const adminId = Deno.env.get("MOODCUT_ADMIN_ID") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!botToken || !adminId || !supabaseUrl || !serviceKey) {
      return json({ error: "server_not_configured" }, 500);
    }

    const tg = await verifyTelegram(initData, botToken);
    const telegramId = String(tg.id);
    const isAdmin = telegramId === adminId;
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const profile = {
      telegram_id: Number(telegramId),
      username: tg.username || null,
      first_name: tg.first_name || null,
      last_name: tg.last_name || null,
      role: isAdmin ? "admin" : "user",
      last_seen_at: new Date().toISOString(),
    };
    const { error: upsertError } = await db.from("moodcut_profiles").upsert(profile, { onConflict: "telegram_id" });
    if (upsertError) throw upsertError;

    if (action === "me") {
      const { data, error } = await db.from("moodcut_profiles").select("telegram_id,username,first_name,last_name,role,free_access,created_at,last_seen_at").eq("telegram_id", telegramId).single();
      if (error) throw error;
      return json({ profile: data, isAdmin });
    }

    if (!isAdmin) return json({ error: "admin_only" }, 403);

    if (action === "admin_list") {
      const [{ data: users, error: usersError }, { data: invites, error: invitesError }] = await Promise.all([
        db.from("moodcut_profiles").select("telegram_id,username,first_name,last_name,role,free_access,created_at,last_seen_at").order("created_at", { ascending: false }),
        db.from("moodcut_invites").select("id,max_uses,uses_count,expires_at,revoked_at,created_at").order("created_at", { ascending: false }),
      ]);
      if (usersError) throw usersError;
      if (invitesError) throw invitesError;
      return json({ users, invites });
    }

    if (action === "create_invite") {
      const maxUses = Math.max(1, Math.min(100, Number(body.maxUses || 1)));
      const rawToken = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256(rawToken);
      const expiresAt = body.expiresInDays ? new Date(Date.now() + Math.max(1, Number(body.expiresInDays)) * 86400000).toISOString() : null;
      const { error } = await db.from("moodcut_invites").insert({
        token_hash: tokenHash, created_by: Number(telegramId), max_uses: maxUses, expires_at: expiresAt,
      });
      if (error) throw error;
      return json({ inviteToken: rawToken, inviteUrl: `https://t.me/VAMOPAV_bot?startapp=${rawToken}`, maxUses, expiresAt });
    }

    if (action === "redeem_invite") {
      const token = String(body.inviteToken || "");
      if (!token) return json({ error: "invite_token_missing" }, 400);
      const result = await db.rpc("moodcut_redeem_invite", { p_token_hash: await sha256(token), p_telegram_id: Number(telegramId) });
      if (result.error) throw result.error;
      if (!result.data?.ok) return json({ error: result.data?.error || "invite_invalid" }, 400);
      const { data } = await db.from("moodcut_profiles").select("telegram_id,username,first_name,last_name,role,free_access").eq("telegram_id", telegramId).single();
      return json({ redeemed: true, profile: data });
    }

    if (action === "revoke_invite") {
      const id = String(body.inviteId || "");
      const { error } = await db.from("moodcut_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return json({ revoked: true });
    }

    if (action === "set_free_access") {
      const targetId = String(body.telegramId || "");
      if (!/^\d+$/.test(targetId)) return json({ error: "invalid_telegram_id" }, 400);
      const enabled = Boolean(body.enabled);
      const { error } = await db.from("moodcut_profiles").update({ free_access: enabled }).eq("telegram_id", targetId);
      if (error) throw error;
      return json({ updated: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unexpected_error" }, 400);
  }
});
