/* Version: 1.1.0 */
/* Updated: 2026-11-24 */
import { authClient } from "../../../infrastructure/supabase/auth-client.js";

export function installControlCenterNotifications(container) {
  if (container.dataset.controlCenterNotificationsBound === "true") return;
  container.dataset.controlCenterNotificationsBound = "true";
  container.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-admin-broadcast-form]");
    if (!form || form.dataset.submitting === "true") return;
    event.preventDefault();
    const formData = new FormData(form);
    const body = String(formData.get("body") || "").trim();
    const audience = String(formData.get("audience") || "all");
    const audienceLabel = audience === "without_telegram" ? "пользователям без интеграции сайта и Telegram" : "всем пользователям";
    const feedback = form.querySelector("[data-admin-broadcast-feedback]");
    const button = form.querySelector('button[type="submit"]');
    if (!body) {
      if (feedback) { feedback.textContent = "Введите текст уведомления."; feedback.dataset.state = "error"; }
      return;
    }
    if (!window.confirm("Отправить это сообщение " + audienceLabel + "?")) return;
    form.dataset.submitting = "true";
    if (button) { button.disabled = true; button.textContent = "Отправляем…"; }
    if (feedback) { feedback.textContent = "Создаём уведомления и отправляем сообщения в Telegram…"; feedback.dataset.state = ""; }
    try {
      const result = await authClient.broadcastNotification(body, audience);
      const telegram = result?.telegram || {};
      const sent = Number(telegram.sent || 0);
      const failed = Number(telegram.failed || 0);
      const skipped = Number(telegram.skipped || 0);
      if (feedback) {
        feedback.textContent = "Уведомления добавлены в центр для " + Number(result?.notification_count || 0) +
          " пользователей. Telegram: отправлено " + sent +
          (failed ? ", ошибок " + failed : "") + (skipped ? ", пропущено " + skipped : "") + ".";
        feedback.dataset.state = "success";
      }
      form.reset();
    } catch (error) {
      if (feedback) { feedback.textContent = error?.message || "Не удалось отправить уведомление. Проверьте подключение и повторите попытку."; feedback.dataset.state = "error"; }
    } finally {
      form.dataset.submitting = "false";
      if (button) { button.disabled = false; button.textContent = audience === "without_telegram" ? "Отправить выбранной группе" : "Отправить всем пользователям"; }
    }
  });
}
