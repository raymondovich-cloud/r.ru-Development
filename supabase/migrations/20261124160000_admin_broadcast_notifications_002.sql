-- Version: 1.0.0
-- Updated: 2026-11-24
-- Audience-aware owner broadcast notifications.

begin;

create or replace function public.notifications_broadcast_to_audience(
  p_actor_user_id uuid,
  p_body text,
  p_audience text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_body text := btrim(coalesce(p_body, ''));
  v_notification_count integer := 0;
  v_telegram_chat_ids jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'Actor user id is required';
  end if;

  select u.raw_app_meta_data ->> 'raymondovich_role'
    into v_role
  from auth.users u
  where u.id = p_actor_user_id;

  if not found or v_role <> 'owner' then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;

  if char_length(v_body) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Notification text must contain between 1 and 1000 characters';
  end if;

  if p_audience is null or p_audience not in ('all', 'without_telegram') then
    raise exception using errcode = '22023', message = 'Unsupported notification audience';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_user_id::text, 0));

  if (
    select count(*)
    from notifications.notifications n
    where n.actor_user_id = p_actor_user_id
      and n.notification_type = 'ecosystem.broadcast'
      and n.created_at >= now() - interval '60 seconds'
  ) > 0 then
    raise exception using errcode = '54000', message = 'A broadcast was sent recently. Wait one minute before sending another';
  end if;

  if p_audience = 'all' then
    insert into notifications.notifications (
      recipient_user_id, actor_user_id, notification_type, title, body, payload
    )
    select u.id, p_actor_user_id, 'ecosystem.broadcast',
      'Сообщение от Raymondovich', v_body,
      jsonb_build_object('channel', 'workspace', 'audience', p_audience)
    from auth.users u;
    get diagnostics v_notification_count = row_count;

    select coalesce(jsonb_agg(recipients.chat_id), '[]'::jsonb)
      into v_telegram_chat_ids
    from (
      select distinct l.chat_id
      from private.telegram_account_links l
      left join public.telegram_bot_users b
        on b.telegram_user_id = l.telegram_user_id
      where l.chat_id is not null
        and b.is_subscribed is distinct from false
        and b.is_blocked is distinct from true
    ) recipients;
  else
    insert into notifications.notifications (
      recipient_user_id, actor_user_id, notification_type, title, body, payload
    )
    select u.id, p_actor_user_id, 'ecosystem.broadcast',
      'Сообщение от Raymondovich', v_body,
      jsonb_build_object('channel', 'workspace', 'audience', p_audience)
    from auth.users u
    where not exists (
      select 1
      from private.telegram_account_links l
      where l.user_id = u.id
    );
    get diagnostics v_notification_count = row_count;
  end if;

  return jsonb_build_object(
    'notification_count', v_notification_count,
    'telegram_chat_ids', v_telegram_chat_ids,
    'audience', p_audience
  );
end;
$function$;

revoke all on function public.notifications_broadcast_to_audience(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.notifications_broadcast_to_audience(uuid, text, text)
  to service_role;

commit;
