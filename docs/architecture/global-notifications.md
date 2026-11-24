# Global notifications in Owner Control Center

**Version:** 1.1.0  
**Updated:** 2026-11-24  
**Status:** Development implementation

## User flow

1. The ecosystem owner opens `#control-center`.
2. The first Control Center item is `Уведомления`.
3. The owner opens `#control-center/notifications`.
4. The owner selects one of two audiences: `Всем пользователям` or `Пользователям без интеграции сайта и Telegram`.
5. The owner enters a message (1–1,000 characters) and confirms sending to the selected audience.
6. For `all`, a notification record is created for every account in `auth.users`. For `without_telegram`, only accounts without a row in `private.telegram_account_links` receive an in-app notification.
7. Telegram messages are sent only for the `all` audience, to linked Telegram chats that have not disabled bot messages and are not blocked. The `without_telegram` audience receives in-app notifications only.

## Security

- The browser calls the Edge Function with the current user JWT.
- The Edge Function resolves the JWT through Supabase Auth and checks current `app_metadata.raymondovich_role`.
- The database fan-out RPC `notifications_broadcast_to_audience` is executable only by `service_role`, validates the audience, and independently checks the actor against `auth.users.raw_app_meta_data`.
- The service key and Telegram bot token remain server-side.
- No direct client grants or notification-table RLS changes are introduced.
- The database prevents another broadcast by the same owner within 60 seconds.

## Delivery

- In-app notifications are persisted before Telegram delivery starts.
- Telegram delivery is best-effort; the response reports attempted, successful, failed, and skipped counts.
- For the `all` audience, unlinked users receive only the in-app notification. The `without_telegram` audience is selected using `NOT EXISTS` against `private.telegram_account_links`.
- Linked users who disabled bot messages or blocked the bot are not sent a Telegram message.
- Telegram delivery errors do not roll back in-app notifications.

## Deployment sequence

1. Apply the SQL migration.
2. Deploy `admin-broadcast-notifications` with JWT verification enabled.
3. Confirm the existing `TELEGRAM_BOT_TOKEN` Edge Function secret is configured.
4. Deploy the static development site.
5. Test with the owner and linked/unlinked test accounts.

The audience feature requires migration `20261124160000_admin_broadcast_notifications_002.sql`, an Edge Function redeployment, and a development-site deployment. Do not apply or deploy these changes until explicitly approved.
