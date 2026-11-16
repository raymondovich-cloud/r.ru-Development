-- Raymondovich Projects RPC phase-1 validation
-- Version: 1.0.3
-- Updated: 2026-11-16
\set ON_ERROR_STOP on

-- auth.uid() compatibility fixture for isolated PostgreSQL.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function pg_temp.run_projects_rpc_phase_1_tests()
returns void
language plpgsql
as $test$
declare
  v_owner uuid := '30000000-0000-4000-8000-000000000001';
  v_member uuid := '30000000-0000-4000-8000-000000000002';
  v_outsider uuid := '30000000-0000-4000-8000-000000000003';
  v_parent uuid;
  v_child uuid;
  v_result jsonb;
  v_allowed boolean;
  v_role_id uuid;
  v_permission_id uuid;
  v_child_status text;
begin
  insert into auth.users(id) values (v_owner), (v_member), (v_outsider);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.project_create(null, 'RPC root', 'Root description', 'online', 'website');
  v_parent := (v_result->>'id')::uuid;
  if v_result->>'status' <> 'active' or v_result->>'name' <> 'RPC root' then
    raise exception 'Root project DTO mismatch';
  end if;
  if not exists (
    select 1 from projects.project_visibility
    where project_id = v_parent and confidentiality = 'private'
      and not showcase_visibility and not profile_visibility
  ) then
    raise exception 'project_create did not create private visibility';
  end if;
  if not exists (
    select 1 from projects.project_audit_logs
    where project_id = v_parent and event_code = 'project.created'
  ) then
    raise exception 'project_create did not write audit event';
  end if;

  v_result := public.project_create(v_parent, 'RPC child', null, 'offline', null);
  v_child := (v_result->>'id')::uuid;
  if not exists (
    select 1 from projects.projects
    where id = v_child and parent_project_id = v_parent and owner_user_id = v_owner
  ) then
    raise exception 'Child project owner/parent invariant failed';
  end if;

  -- Owner authority bypasses role mappings and individual denies.
  insert into projects.project_access_grants(
    project_id, user_id, permission_id, effect, granted_by
  )
  select v_parent, v_owner, id, 'deny', v_owner
  from projects.project_permissions where code = 'project.update';
  if not public.project_access_check(v_parent, 'project.update') then
    raise exception 'Owner authority must supersede individual deny';
  end if;

  -- Create a manager membership and verify role-based permissions.
  select id into v_role_id from projects.project_roles
  where is_system and scope = 'parent' and code = 'manager';
  insert into projects.project_memberships(project_id, user_id, role_id)
  values (v_parent, v_member, v_role_id);

  perform set_config('request.jwt.claim.sub', v_member::text, true);
  if not public.project_access_check(v_parent, 'project.update')
     or not public.project_access_check(v_parent, 'members.invite')
     or public.project_access_check(v_parent, 'project.archive') then
    raise exception 'Manager permission matrix mismatch';
  end if;

  v_result := public.project_update(v_parent, 'Updated by manager', 'Updated description');
  if v_result->>'name' <> 'Updated by manager' then
    raise exception 'project_update failed for authorized manager';
  end if;

  begin
    perform public.project_archive(v_parent);
    raise exception 'Manager unexpectedly archived parent project';
  exception when insufficient_privilege then
    null;
  end;

  -- An explicit deny overrides a role permission.
  select id into v_permission_id from projects.project_permissions where code = 'project.update';
  insert into projects.project_access_grants(
    project_id, user_id, permission_id, effect, granted_by
  ) values (v_parent, v_member, v_permission_id, 'deny', v_owner);
  if public.project_access_check(v_parent, 'project.update') then
    raise exception 'Individual deny did not override role permission';
  end if;

  -- Suspended membership loses role-derived permissions.
  update projects.project_memberships set status = 'suspended'
  where project_id = v_parent and user_id = v_member;
  if public.project_access_check(v_parent, 'members.invite') then
    raise exception 'Suspended member retained permission';
  end if;

  -- Owner can archive and restore; archive is non-cascading.
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.project_archive(v_parent);
  if v_result->>'status' <> 'archived' then
    raise exception 'project_archive failed';
  end if;
  select status into v_child_status from projects.projects where id = v_child;
  if v_child_status <> 'active' then
    raise exception 'Parent archive cascaded to child';
  end if;
  v_result := public.project_restore(v_parent);
  if v_result->>'status' <> 'active' then
    raise exception 'project_restore failed';
  end if;

  -- Unauthorized outsider cannot update/archive/restore.
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  begin
    perform public.project_update(v_parent, 'Unauthorized', null);
    raise exception 'Outsider unexpectedly updated project';
  exception when insufficient_privilege then
    null;
  end;

  if public.project_access_check(v_parent, 'unknown.permission') then
    raise exception 'Unknown permission must return false';
  end if;
  if public.project_access_check(v_parent, 'project.view') then
    raise exception 'Outsider unexpectedly has project.view';
  end if;

  -- Audit log must reject UPDATE and DELETE even under table owner.
  begin
    update projects.project_audit_logs set metadata = '{}'::jsonb where project_id = v_parent;
    raise exception 'Audit UPDATE unexpectedly succeeded';
  exception when sqlstate '55000' then
    null;
  end;
  begin
    delete from projects.project_audit_logs where project_id = v_parent;
    raise exception 'Audit DELETE unexpectedly succeeded';
  exception when sqlstate '55000' then
    null;
  end;

  -- Anonymous execution is not granted; authenticated execution is explicit.
  if has_function_privilege('anon', 'public.project_create(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception 'anon unexpectedly has project_create EXECUTE';
  end if;
  if not has_function_privilege('authenticated', 'public.project_create(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception 'authenticated lacks project_create EXECUTE';
  end if;

  raise notice 'PASS: five Projects RPCs, ownership, permissions, deny precedence, suspension, private defaults, audit immutability, archive/restore and grants';
end;
$test$;

select pg_temp.run_projects_rpc_phase_1_tests();
