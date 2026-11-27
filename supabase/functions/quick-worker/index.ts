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
    const adminId = (Deno.env.get("MOODCUT_ADMIN_ID") || "7738464404").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!botToken || !adminId || !supabaseUrl || !serviceKey) {
      return json({ error: "server_not_configured" }, 500);
    }
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const telegramApi = async (method: string, payload: Record<string, unknown>) => {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.description || `telegram_${method}_failed`);
      return result.result;
    };

    // Telegram webhook: payment updates and replies from the private FORMA support group.
    if (body.pre_checkout_query || body.message) {
      const { data: supportSettings } = await db.from("forma_support_settings")
        .select("group_chat_id,webhook_secret").eq("id", 1).maybeSingle();
      const webhookSecret = supportSettings?.webhook_secret || Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
      const suppliedSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
      if (!webhookSecret || !safeEqual(webhookSecret, suppliedSecret)) return json({ error: "webhook_unauthorized" }, 403);

      if (body.message && !body.message.successful_payment) {
        const message = body.message;
        const isSupportReply = String(message.chat?.id || "") === String(supportSettings?.group_chat_id || "")
          && !!message.reply_to_message?.message_id && !!message.text
          && String(message.from?.id || "") === String(adminId);
        if (!isSupportReply) return json({ ok: true, ignored: true });
        const { data: supportMessage, error: supportLookupError } = await db.from("forma_support_messages")
          .select("id,telegram_id,message")
          .eq("group_message_id", Number(message.reply_to_message.message_id)).maybeSingle();
        if (supportLookupError) throw supportLookupError;
        if (!supportMessage) return json({ ok: true, ignored: true });
        const replyText = String(message.text).trim().slice(0, 3500);
        if (!replyText) return json({ ok: true, ignored: true });
        await telegramApi("sendMessage", {
          chat_id: Number(supportMessage.telegram_id),
          text: `FORMA · ОТВЕТ ПОДДЕРЖКИ\n\n${replyText}`,
        });
        const { error: updateError } = await db.from("forma_support_messages")
          .update({ status: "replied", admin_reply: replyText, replied_at: new Date().toISOString() })
          .eq("id", supportMessage.id);
        if (updateError) throw updateError;
        return json({ ok: true, replied: true });
      }

      if (body.pre_checkout_query) {
        const query = body.pre_checkout_query;
        const { data: pending } = await db.from("moodcut_pending_payments")
          .select("telegram_id,expires_at").eq("invoice_payload", String(query.invoice_payload || "")).maybeSingle();
        const valid = !!pending && String(pending.telegram_id) === String(query.from?.id)
          && new Date(pending.expires_at).getTime() > Date.now();
        await telegramApi("answerPreCheckoutQuery", {
          pre_checkout_query_id: query.id, ok: valid,
          ...(valid ? {} : { error_message: "Счёт устарел. Откройте MOODCUT и создайте новый." }),
        });
        return json({ ok: true });
      }

      const message = body.message;
      const payment = message.successful_payment;
      const payerId = String(message.from?.id || "");
      const payload = String(payment.invoice_payload || "");
      const { data: pending } = await db.from("moodcut_pending_payments")
        .select("telegram_id,expires_at").eq("invoice_payload", payload).maybeSingle();
      const isRecurring = payment.is_recurring === true;
      const { data: existingSubscription } = await db.from("moodcut_subscriptions")
        .select("telegram_id").eq("telegram_id", payerId).maybeSingle();
      if ((!pending || String(pending.telegram_id) !== payerId) && !(isRecurring && existingSubscription)) return json({ ok: true, ignored: true });
      if (pending && new Date(pending.expires_at).getTime() <= Date.now() && !isRecurring) return json({ ok: true, ignored: true });
      if (String(payment.currency || "") !== "XTR" || Number(payment.total_amount || 0) !== 330) {
        return json({ error: "payment_amount_or_currency_invalid" }, 400);
      }

      const chargeId = String(payment.telegram_payment_charge_id || "");
      if (!chargeId) return json({ error: "payment_charge_missing" }, 400);
      const { error: eventError } = await db.from("moodcut_payment_events").insert({
        telegram_payment_charge_id: chargeId, telegram_id: Number(payerId),
        invoice_payload: payload, total_amount: Number(payment.total_amount || 10),
        currency: String(payment.currency || "XTR"), raw_payment: payment,
      });
      if (eventError) {
        if (eventError.code === "23505") return json({ ok: true, duplicate: true });
        throw eventError;
      }
      const expiresAt = payment.subscription_expiration_date
        ? new Date(Number(payment.subscription_expiration_date) * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: subError } = await db.from("moodcut_subscriptions").upsert({
        telegram_id: Number(payerId), plan_code: "pro", status: "active",
        current_period_end: expiresAt, last_charge_id: chargeId,
        is_recurring: isRecurring, updated_at: new Date().toISOString(),
      }, { onConflict: "telegram_id" });
      if (subError) throw subError;
      if (pending) await db.from("moodcut_pending_payments").delete().eq("invoice_payload", payload);
      return json({ ok: true, subscription_expires_at: expiresAt });
    }

    const tg = await verifyTelegram(initData, botToken);
    const telegramId = String(tg.id);
    const isAdmin = telegramId === adminId;

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
      const { data: subscription, error: subscriptionError } = await db.from("moodcut_subscriptions")
        .select("plan_code,status,current_period_end").eq("telegram_id", telegramId).maybeSingle();
      if (subscriptionError) throw subscriptionError;
      const proActive = !!subscription && subscription.status === "active" && new Date(subscription.current_period_end).getTime() > Date.now();
      return json({ profile: { ...data, pro_active: proActive, subscription_plan: proActive ? "MOODCUT PRO" : (data.free_access ? "Бесплатный доступ" : "Free"), subscription_expires_at: subscription?.current_period_end || null }, isAdmin });
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

    if (action === "create_pro_invoice") {
      const { data: current } = await db.from("moodcut_subscriptions")
        .select("status,current_period_end").eq("telegram_id", telegramId).maybeSingle();
      if (current?.status === "active" && new Date(current.current_period_end).getTime() > Date.now()) {
        return json({ error: "pro_already_active", subscription_expires_at: current.current_period_end }, 409);
      }
      const nonce = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const payload = `moodcut_pro_${telegramId}_${nonce}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error: pendingError } = await db.from("moodcut_pending_payments").insert({
        invoice_payload: payload, telegram_id: Number(telegramId), expires_at: expiresAt,
      });
      if (pendingError) throw pendingError;
      try {
        const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
        if (!webhookSecret) throw new Error("TELEGRAM_WEBHOOK_SECRET не задан в Supabase");
        const webhookUrl = `${supabaseUrl}/functions/v1/quick-worker`;
        await telegramApi("setWebhook", {
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "pre_checkout_query"],
          drop_pending_updates: false,
        });
        const invoiceUrl = await telegramApi("createInvoiceLink", {
          title: "MOODCUT PRO",
          description: "Доступ к MOODCUT PRO на 30 дней. Автоматическое продление каждый месяц.",
          payload, provider_token: "", currency: "XTR",
          prices: [{ label: "MOODCUT PRO · 30 дней", amount: 330 }],
          subscription_period: 2592000,
        });
        return json({ invoiceUrl, priceStars: 330, periodDays: 30 });
      } catch (error) {
        await db.from("moodcut_pending_payments").delete().eq("invoice_payload", payload);
        throw error;
      }
    }

    if (!isAdmin) return json({ error: "admin_only" }, 403);

    if (action === "configure_payment_webhook") {
      const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
      if (!webhookSecret) return json({ error: "telegram_webhook_secret_missing" }, 500);
      const webhookUrl = `${supabaseUrl}/functions/v1/quick-worker`;
      await telegramApi("setWebhook", {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "pre_checkout_query"],
        drop_pending_updates: false,
      });
      const info = await telegramApi("getWebhookInfo", {});
      return json({
        configured: info.url === webhookUrl,
        pending_update_count: info.pending_update_count || 0,
        last_error_message: info.last_error_message || null,
      });
    }

    if (action === "cancel_test_auto_renew") {
      const targetId = "548363238";
      const { data: subscription, error: subError } = await db.from("moodcut_subscriptions")
        .select("last_charge_id,current_period_end").eq("telegram_id", Number(targetId)).maybeSingle();
      if (subError) throw subError;
      if (!subscription?.last_charge_id) return json({ error: "subscription_charge_not_found" }, 404);
      const result = await telegramApi("editUserStarSubscription", {
        user_id: Number(targetId), telegram_payment_charge_id: subscription.last_charge_id, is_canceled: true,
      });
      if (result !== true) throw new Error("telegram_subscription_cancel_not_confirmed");
      const { error: updateError } = await db.from("moodcut_subscriptions").update({ is_recurring: false, updated_at: new Date().toISOString() }).eq("telegram_id", Number(targetId));
      if (updateError) throw updateError;
      return json({ canceled: true, subscription_expires_at: subscription.current_period_end });
    }

    if (action === "admin_list") {
      const [{ data: users, error: usersError }, { data: invites, error: invitesError }, { data: payments, error: paymentsError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
        db.from("moodcut_profiles").select("telegram_id,username,first_name,last_name,role,free_access,created_at,last_seen_at").order("created_at", { ascending: false }),
        db.from("moodcut_invites").select("id,max_uses,uses_count,expires_at,revoked_at,created_at").order("created_at", { ascending: false }),
        db.from("moodcut_payment_events").select("telegram_payment_charge_id,telegram_id,total_amount,currency,created_at").order("created_at", { ascending: false }).limit(100),
        db.from("moodcut_subscriptions").select("telegram_id,plan_code,status,current_period_end,is_recurring,updated_at"),
      ]);
      if (usersError) throw usersError;
      if (invitesError) throw invitesError;
      if (paymentsError) throw paymentsError;
      if (subscriptionsError) throw subscriptionsError;
      return json({ users, invites, payments, subscriptions });
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
