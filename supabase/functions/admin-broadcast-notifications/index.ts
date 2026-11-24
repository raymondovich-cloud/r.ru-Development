/* Version: 1.0.0 */
/* Updated: 2026-11-24 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
async function sendTelegram(chatId: number, body: string) {
  const response = await fetch(`${API}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw new Error(payload.description || "Telegram delivery failed");
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Server configuration is incomplete" }, 500);
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "Authentication required" }, 401);
  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: authorization } });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !user?.id) return json({ error: "Authentication required" }, 401);
    if (user.app_metadata?.raymondovich_role !== "owner") return json({ error: "Owner access required" }, 403);
    const input = await request.json().catch(() => ({}));
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (body.length < 1 || body.length > 1000) return json({ error: "Текст уведомления должен содержать от 1 до 1000 символов." }, 400);
    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/notifications_broadcast_to_all`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_actor_user_id: user.id, p_body: body }),
    });
    const rpcResult = await rpcResponse.json().catch(() => ({}));
    if (!rpcResponse.ok) return json({ error: rpcResult.message || rpcResult.error || "Не удалось создать уведомления." }, rpcResponse.status >= 500 ? 500 : 400);
    const chatIds = Array.isArray(rpcResult.telegram_chat_ids)
      ? rpcResult.telegram_chat_ids.map(Number).filter((id: number) => Number.isSafeInteger(id) && id !== 0)
      : [];
    const telegram = { attempted: chatIds.length, sent: 0, failed: 0, skipped: 0 };
    if (!BOT_TOKEN) telegram.skipped = chatIds.length;
    else {
      for (let offset = 0; offset < chatIds.length; offset += 20) {
        const batch = chatIds.slice(offset, offset + 20);
        const results = await Promise.allSettled(batch.map((chatId: number) => sendTelegram(chatId, body)));
        for (const result of results) result.status === "fulfilled" ? telegram.sent++ : telegram.failed++;
        if (offset + 20 < chatIds.length) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    return json({ ok: true, notification_count: Number(rpcResult.notification_count || 0), telegram });
  } catch (error) {
    console.error("admin-broadcast-notifications failed", error);
    return json({ error: "Не удалось завершить отправку уведомлений." }, 500);
  }
});
