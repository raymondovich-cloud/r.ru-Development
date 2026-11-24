# Global notifications in Owner Control Center

**Version:** 1.0.0  
**Updated:** 2026-11-24  
**Status:** Development implementation

## User flow

1. The ecosystem owner opens `#control-center`.
2. The first Control Center item is `Уведомления`.
3. The owner opens `#control-center/notifications`.
4. The only available audience is `Для всех пользователей`.
5. The owner enters a message (1–1,000 characters) and confirms sending.
6. A notification record is created for every account in `auth.users` and appears in the existing in-app notification center.
7. Telegram messages are sent to linked Telegram chats that have not disabled bot messages and are not blocked.

## Security

- The browser calls the Edge Function with the current user JWT.
- The Edge Function resolves the JWT through Supabase Auth and checks current `app_metadata.raymondovich_role`.
- The database fan-out RPC is executable only by `service_role` and independently checks the actor against `auth.users.raw_app_meta_data`.
- The service key and Telegram bot token remain server-side.
- No direct client grants or notification-table RLS changes are introduced.
- The database prevents another broadcast by the same owner within 60 seconds.

## Delivery

- In-app notifications are persisted before Telegram delivery starts.
- Telegram delivery is best-effort; the response reports attempted, successful, failed, and skipped counts.
- Unlinked users receive only the in-app notification.
- Linked users who disabled bot messages or blocked the bot are not sent a Telegram message.
- Telegram delivery errors do not roll back in-app notifications.

## Deployment sequence

1. Apply the SQL migration.
2. Deploy `admin-broadcast-notifications` with JWT verification enabled.
3. Confirm the existing `TELEGRAM_BOT_TOKEN` Edge Function secret is configured.
4. Deploy the static development site.
5. Test with the owner and linked/unlinked test accounts.

This commit changes source files only. It does not apply the migration, deploy the Edge Function, or deploy the website.
