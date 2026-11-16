# Projects — SQL Specification

**Version:** 2.0.0  
**Status:** Architecture specification — review required before migration  
**Created:** 2026-11-16  
**Updated:** 2026-11-16  
**Target repository:** `raymondovich-cloud/r.ru-Development`  
**Supabase project:** `yajybgdorhxebbigwjgi`  
**Database schema:** `projects`

---

## 1. Purpose and implementation boundary

This document defines the target PostgreSQL data model, constraints, authorization model, server-side operations, migration order and security tests for the Raymondovich Projects subsystem.

It is a specification, not an executable migration. No database changes are authorized by this document alone.

### 1.1 In scope

- Independent projects and arbitrarily nested project hierarchy.
- Ownership, membership, project-scoped roles and permissions.
- Invitations and acceptance.
- Confidentiality, public publication and profile listings.
- Future-facing links to Tools and project-owned resources, without implementing the Tools subsystem.
- Archiving, restoration, controlled physical deletion and ownership transfer.
- Immutable audit trail.
- RLS, RPC contracts and transaction boundaries.

### 1.2 Out of scope for this release

- Tasks and task management tables.
- Tools catalog, tool connections storage, credentials and subscription billing.
- Showcase categories, paid placements, advertising inventory and promotion orders.
- Public project pages frontend.
- Cross-hierarchy resource sharing.
- Account deletion implementation itself; only the Projects-side blockers and required integration contract are defined here.

Old Projects/Tools implementations and their historical table designs are not to be reused automatically. The current database audit found no Projects or Tools tables in the inspected application schemas. The new implementation is designed independently.

---

## 2. Existing Supabase environment and integration constraints

The specification targets the existing Supabase project in region `eu-central-1`.

### 2.1 Existing identity source

Authentication identity remains Supabase Auth:

- User primary identity: `auth.users.id` (UUID).
- Profile data source: `private.user_profiles`.
- Existing profile fields include `user_id`, `full_name`, `birth_date`, `username`, `created_at`, `updated_at`.
- Username is immutable in the existing profile workflow and has a case-insensitive unique index based on `lower(username)`.
- Membership and ownership rows store UUIDs, never usernames or email addresses.

Do not create a second users table for Projects.

### 2.2 Existing authentication functions and triggers

The current database contains registration-related functions/triggers, including:

- `private.assign_default_user_role`
- `private.create_user_profile_after_signup`
- `private.enforce_registration_gate`

Projects migrations must not replace, rename or silently alter these objects. Before implementation, migration SQL must be checked against the live definitions and trigger ordering.

The existing function `public.lookup_auth_user_for_username` is not a public search API for Projects. A dedicated, privacy-filtered lookup contract is required.

### 2.3 Schema exposure

Create a dedicated PostgreSQL schema named `projects`.

Target security posture:

- Do not add `projects` to Supabase Data API exposed schemas unless a later reviewed design explicitly requires it.
- Do not grant `anon` direct access to Projects tables.
- Prefer authenticated client calls to narrowly scoped RPC functions.
- Revoke default execution privileges from `PUBLIC`; grant only to the intended database roles.
- Keep privileged helper functions in a non-exposed schema where practical.
- Never put service-role credentials or tool secrets in browser code.

The exact Supabase API exposure configuration and schema-usage grants must be checked immediately before deployment. A PostgreSQL schema being created does not by itself make it safe or accessible through the Data API.

---

## 3. Product invariants

These invariants are mandatory and must be enforced server-side, not only in the interface.

### 3.1 Project and hierarchy

1. Any registered user may create a project without a paid subscription.
2. The creator becomes the initial owner.
3. A project is an independent product or business unit.
4. A project may have zero or one direct parent; nesting depth is not artificially limited.
5. A child is a full project with its own workspace, settings, members, permissions, history and future tool assignments.
6. A child project owner must always equal the owner of its direct parent. This equality therefore applies throughout the complete descendant tree.
7. A child may have a leader who is not the owner.
8. A project cannot be its own parent and hierarchy cycles are prohibited.
9. Parent membership does not grant access to children. Child membership does not grant access to the parent.
10. The parent owner has full administrative authority over all descendants without separate memberships.
11. An archived parent blocks public availability of every descendant, even if a descendant is internally active.
12. Archiving a project does not automatically archive its descendants.

### 3.2 Ownership and membership

- Ownership is determined only by `projects.projects.owner_user_id`, not by a membership row.
- A user has at most one current membership/role per project.
- A user may hold different roles in different projects.
- A project owner is not required to have a membership row.
- Parent owner is the hierarchy super-administrator.
- Other users receive access only through an active membership and permissions.
- Removing or suspending membership blocks ordinary access immediately.
- An owner transfer applies atomically to the root project and all descendants after explicit acceptance by the new owner.

### 3.3 Privacy and publication

- Confidentiality is independent of workspace permissions.
- Public visibility never grants internal workspace access.
- A public publication is a safe, explicit projection of approved public fields; it is never a raw Projects row.
- A private ancestor makes every descendant effectively private.
- A public parent may contain a private child.
- A project may be published without being listed in a user profile or showcase.
- Membership alone does not authorize a project to appear in a member's profile.
- Paid promotion, when implemented, must never grant access or override privacy.

### 3.4 Lifecycle

- Archive is the normal reversible lifecycle operation.
- Physical deletion is exceptional and requires an explicit protected server-side operation.
- Parent physical deletion is blocked while child projects exist.
- No automatic cascade deletion of child projects, histories, connections or shares.
- Account deletion is blocked while the user owns any project or is the sole administrator of a project.

---

## 4. PostgreSQL schema and conventions

Create schema:

```sql
create schema if not exists projects;
```

The statement above is illustrative only; it must not be executed until the complete migration is approved.

Conventions:

- UUID primary keys generated with `gen_random_uuid()`.
- Timestamps use `timestamptz` and UTC storage.
- Foreign keys to identities reference `auth.users(id)`.
- Use explicit named constraints and indexes.
- Use CHECK constraints for finite state values.
- Use normalized relation tables for permissions; do not encode permission matrices in JSONB.
- JSONB is allowed only for audit snapshots/metadata, never as the authoritative permission model.
- Every mutable business table has `created_at` and `updated_at` where appropriate.
- Use `ON DELETE RESTRICT` for critical relationships unless a specific lifecycle rule explicitly states otherwise.
- No client-side direct writes to critical tables.

---

## 5. Entity relationship overview

Core entities:

- `projects.projects` — project records and hierarchy.
- `projects.project_component_types` — supported technical component types.
- `projects.project_memberships` — active/suspended/removed membership records.
- `projects.project_roles` — system and project-local roles.
- `projects.project_permissions` — permission catalogue.
- `projects.project_role_permissions` — role-to-permission assignments.
- `projects.project_access_grants` — individual allow/deny overrides.
- `projects.project_invitations` — invitation lifecycle.
- `projects.project_visibility` — confidentiality and listing preferences.
- `projects.project_publications` — public-facing project projection.
- `projects.project_profile_listings` — owner-authorized project listing in user profiles.
- `projects.project_tool_connections` — future Tools integration reference.
- `projects.project_resource_shares` — resource sharing inside one hierarchy.
- `projects.project_resource_permissions` — normalized permissions for each share.
- `projects.project_ownership_transfers` — ownership transfer workflow.
- `projects.project_audit_logs` — immutable audit history.

Future monetization entities such as showcase placements and promotion orders are intentionally deferred.

---

## 6. Table specifications

### 6.1 `projects.projects`

One row represents one independent project.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | Primary key |
| `parent_project_id` | UUID | No | Self-reference to parent |
| `owner_user_id` | UUID | Yes | FK to `auth.users.id` |
| `created_by` | UUID | Yes | FK to `auth.users.id`; immutable creator |
| `name` | VARCHAR(120) | Yes | Trimmed; non-empty |
| `description` | TEXT | No | Internal description only |
| `project_type` | TEXT | Yes | `online` or `offline` |
| `component_type_id` | UUID | No | FK to component type catalogue |
| `status` | TEXT | Yes | `active` or `archived` |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |
| `archived_at` | TIMESTAMPTZ | No | Required when archived |
| `archived_by` | UUID | No | FK to `auth.users.id` |

Constraints and indexes:

- PK on `id`.
- `CHECK (project_type IN ('online','offline'))`.
- `CHECK (status IN ('active','archived'))`.
- `CHECK (parent_project_id IS NULL OR parent_project_id <> id)`.
- Archive consistency: active means `archived_at IS NULL`; archived means `archived_at IS NOT NULL`.
- `UNIQUE (id, owner_user_id)` to support the composite parent/owner relationship.
- Composite self-FK `(parent_project_id, owner_user_id)` references `(id, owner_user_id)`, enforcing equal owner between parent and child. Evaluate `ON UPDATE CASCADE` in a staging migration test; the transfer transaction must still explicitly lock and validate the complete tree.
- Parent deletion is restricted while children exist.
- Index `parent_project_id`, `owner_user_id`, `created_by`, `status`; add partial indexes for common active-project queries.
- Name validation and trimming occur in the server operation; do not rely only on a client form.
- No internal slug. Public slug belongs to the publication entity.

Hierarchy cycle prevention cannot be guaranteed by a simple CHECK constraint. The server operation must use a recursive traversal, transaction-level locking and a cycle check.

### 6.2 `projects.project_component_types`

Catalogue of technical component subtypes. The catalogue is independent of `project_type`.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `code` | VARCHAR(60) | Yes | Unique stable code |
| `name` | VARCHAR(100) | Yes | Display name |
| `description` | TEXT | No | Optional |
| `is_active` | BOOLEAN | Yes | Default true |
| `sort_order` | INTEGER | Yes | Default 0 |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Initial codes:

- `website`
- `telegram_mini_app`
- `telegram_bot`
- `ios_app`

The catalogue may be extended later. A project can have a null component type when it represents an organizational or functional direction rather than a specific technical component. Online/offline remains a separate project classification.

### 6.3 `projects.project_memberships`

One current membership record per project and user. Removed membership rows are retained for history; rejoining reactivates the existing row or follows a documented re-invitation transition.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | Yes | FK projects |
| `user_id` | UUID | Yes | FK auth.users |
| `role_id` | UUID | Yes | FK project_roles |
| `status` | TEXT | Yes | active/suspended/removed |
| `joined_at` | TIMESTAMPTZ | No | Set on acceptance |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Constraints:

- Unique `(project_id, user_id)`.
- Status CHECK: `active`, `suspended`, `removed`.
- Role scope must match the target project scope (parent or child); enforce in RPC/trigger because it depends on another row.
- The project owner is not represented as a membership.
- Active membership is created only after an invitation is explicitly accepted, except the creator/owner flow.
- Membership role changes must be audited.

### 6.4 `projects.project_roles`

System roles have `project_id IS NULL`; custom roles are bound to one project.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | No | FK projects; null for system role |
| `scope` | TEXT | Yes | parent/child |
| `code` | VARCHAR(60) | Yes | Stable code |
| `name` | VARCHAR(100) | Yes | Display name |
| `description` | TEXT | No | Optional |
| `is_system` | BOOLEAN | Yes | Default false |
| `created_by` | UUID | No | FK auth.users |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Rules:

- System roles are centrally managed and cannot be edited/deleted by project users.
- Custom roles require the relevant role-management permission and are scoped to one project only.
- Custom roles never propagate to descendants.
- Do not delete a role while any membership references it.
- Enforce consistency: system role has null project_id; custom role has non-null project_id.
- Unique system role code per scope; unique custom role code per project.

Initial system roles:

| Scope | Code | Name |
|---|---|---|
| parent | administrator | Administrator |
| parent | manager | Manager |
| parent | member | Member |
| child | leader | Leader |
| child | developer | Developer |
| child | observer | Observer |

Owner is not a role. Ownership remains a separate property.

### 6.5 `projects.project_permissions`

Global permission catalogue.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `code` | VARCHAR(100) | Yes | Unique |
| `name` | VARCHAR(120) | Yes | Required |
| `description` | TEXT | No | Optional |
| `created_at` | TIMESTAMPTZ | Yes | Server default |

Initial permission codes:

- `project.view`
- `project.update`
- `project.archive`
- `members.view`
- `members.invite`
- `members.remove`
- `members.manage`
- `members.roles.manage`
- `roles.create`
- `roles.update`
- `roles.delete`
- `tools.view`
- `tools.connect`
- `tools.manage`
- `visibility.view`
- `visibility.manage`
- `publication.manage`
- `resources.view`
- `resources.manage`

Task permissions may be added when the Tasks subsystem is specified; task tables are not part of this release.

### 6.6 `projects.project_role_permissions`

Many-to-many mapping between roles and permissions.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `role_id` | UUID | Yes | FK project_roles |
| `permission_id` | UUID | Yes | FK project_permissions |
| `created_at` | TIMESTAMPTZ | Yes | Server default |

- Composite PK `(role_id, permission_id)`.
- System role mappings are seeded by migration.
- Custom role mappings are changed only through authorized RPC.
- Role permission scope must be validated against project scope.

Initial system-role permission matrices must be explicitly seeded and reviewed before release. Do not infer them from role names in application code.

### 6.7 `projects.project_access_grants`

Individual permission overrides for a user in one project.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | Yes | FK projects |
| `user_id` | UUID | Yes | FK auth.users |
| `permission_id` | UUID | Yes | FK project_permissions |
| `effect` | TEXT | Yes | allow/deny |
| `granted_by` | UUID | Yes | FK auth.users |
| `expires_at` | TIMESTAMPTZ | No | Optional expiry |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Constraints and semantics:

- Unique `(project_id, user_id, permission_id)`: one current override.
- CHECK effect in `allow`, `deny`.
- An explicit deny overrides role-based allow.
- Expired grants are ignored.
- Active membership is required for ordinary grants to take effect.
- Owner and ancestor-owner super-administrator authority cannot be denied by a normal project grant.
- Grant changes are audited; do not rely on overwriting old values as the only history.

### 6.8 `projects.project_invitations`

Invitation workflow for registered and unregistered invitees.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | Yes | FK projects |
| `invitee_user_id` | UUID | No | FK auth.users for known account |
| `invitee_email` | TEXT | No | Normalized email for unregistered invitee |
| `role_id` | UUID | Yes | FK project_roles |
| `invited_by` | UUID | Yes | FK auth.users |
| `token_hash` | TEXT | Yes | Store hash only |
| `status` | TEXT | Yes | pending/accepted/declined/expired/revoked |
| `expires_at` | TIMESTAMPTZ | Yes | Default policy: 7 days |
| `accepted_at` | TIMESTAMPTZ | No | Set on acceptance |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Rules:

- Exactly one invitee target: user ID or email.
- Email is normalized before storing; do not expose it in member search results.
- Token must be generated with a cryptographically secure random generator; only a one-way hash is stored.
- Tokens are single-use and expire.
- A registered user is invited by immutable username lookup; the stored target is UUID.
- An unregistered person is invited by email, must register, verify the same email and explicitly accept.
- Registration alone does not accept an invitation.
- Acceptance must verify that the authenticated user matches the invitation target.
- Prevent duplicate pending invitations and invitations to existing active members.
- Rate-limit lookup, invitation creation and resend.
- Email delivery uses the configured email provider; delivery failure must not create membership.
- Revocation and expiration must prevent subsequent acceptance.

### 6.9 `projects.project_visibility`

Exactly one row per project.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `project_id` | UUID | Yes | PK and FK projects |
| `confidentiality` | TEXT | Yes | private/public |
| `showcase_visibility` | BOOLEAN | Yes | Default false |
| `profile_visibility` | BOOLEAN | Yes | Default false |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

- CHECK confidentiality in `private`, `public`.
- New projects default to private.
- Publication status does not belong in this table.
- Effective public availability must be computed across the full ancestor chain.
- A child cannot be effectively public if any ancestor is private or archived.
- This table does not grant internal workspace access.

### 6.10 `projects.project_publications`

Explicit safe public projection. One current publication record per project for the first release.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | Yes | FK projects; unique for current publication |
| `public_slug` | VARCHAR(160) | Yes | Globally unique |
| `title` | VARCHAR(160) | Yes | Public title |
| `public_description` | TEXT | No | Public description only |
| `cover_image` | TEXT | No | Validated public asset reference |
| `status` | TEXT | Yes | draft/published/suspended |
| `published_at` | TIMESTAMPTZ | No | Set when published |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Rules:

- Unique `project_id` for current publication.
- Unique normalized `public_slug`.
- CHECK status in `draft`, `published`, `suspended`.
- Publishing requires project owner authorization (or a narrowly delegated publication permission, if explicitly allowed by policy).
- Public endpoint returns only explicitly selected publication fields and safe computed data.
- Never expose internal description, internal UUIDs, member email, invitations, audit data, tool connections or credentials.
- Effective public access requires publication status published, project active, project confidentiality public and every ancestor active/public.
- Publication history/versioning is deferred; if editorial history becomes necessary, add a separate revision table rather than overloading the current row.

### 6.11 `projects.project_profile_listings`

Explicit authorization for displaying a project in one or more user profiles.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | Yes | FK projects |
| `profile_user_id` | UUID | Yes | FK auth.users |
| `position` | INTEGER | Yes | Default 0 |
| `status` | TEXT | Yes | active/hidden |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

- Unique `(project_id, profile_user_id)`.
- CHECK status in `active`, `hidden`.
- Owner explicitly authorizes each profile listing.
- Membership alone does not authorize a listing.
- A listing cannot make a private or unpublished project public.
- The owner may revoke listing authorization.
- Whether the profile user must be a project member is intentionally not required by the approved product rule; do not add that restriction without a separate product decision.

### 6.12 `projects.project_tool_connections`

Reference from Projects to the future Tools subsystem. This table does not implement Tools.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | Yes | FK projects |
| `tool_code` | VARCHAR(60) | Yes | Neutral integration code |
| `connection_id` | UUID | Yes | Future Tools connection identifier; deliberately no FK yet |
| `connected_by` | UUID | Yes | FK auth.users |
| `status` | TEXT | Yes | active/suspended/disconnected/error |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

Rules:

- No FK to legacy or nonexistent Tools tables.
- No secrets, access tokens or credentials in this table.
- Entitlement/subscription checks belong to the future Tools subsystem.
- Project ownership does not grant paid tool entitlements.
- Tool permission and project permission are both checked before use.
- Connection access is mediated server-side.

### 6.13 `projects.project_resource_shares`

A resource owned by one project may be shared with a consumer project inside the same hierarchy.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `resource_owner_project_id` | UUID | Yes | FK projects |
| `consumer_project_id` | UUID | Yes | FK projects |
| `resource_type` | VARCHAR(60) | Yes | Resource category |
| `resource_id` | UUID | Yes | Identifier in owning subsystem |
| `status` | TEXT | Yes | active/suspended/revoked |
| `shared_by` | UUID | Yes | FK auth.users |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |
| `revoked_at` | TIMESTAMPTZ | No | Set on revocation |

Rules:

- CHECK status in `active`, `suspended`, `revoked`.
- Owner and consumer must be distinct projects.
- First release allows sharing only within one project hierarchy (ancestor/descendant relationship).
- Cross-hierarchy sharing is deferred.
- Consumer project cannot re-share a resource it only consumes.
- Resource owner controls sharing and revocation.
- Revoking one share does not affect other consumers.
- Suspension of the underlying connection/resource blocks usage even if the share remains active.
- Do not copy resource secrets into the consumer project.

### 6.14 `projects.project_resource_permissions`

Normalized permissions for an individual resource share.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `resource_share_id` | UUID | Yes | FK project_resource_shares |
| `permission_code` | VARCHAR(100) | Yes | Resource action code |
| `effect` | TEXT | Yes | allow/deny |
| `granted_by` | UUID | Yes | FK auth.users |
| `expires_at` | TIMESTAMPTZ | No | Optional expiry |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `updated_at` | TIMESTAMPTZ | Yes | Server-maintained |

- Unique `(resource_share_id, permission_code)`.
- CHECK effect in `allow`, `deny`.
- Permissions are evaluated server-side on every resource operation.
- Consumer project never receives credential material.
- A consuming project cannot grant permissions beyond the resource owner's share policy.

### 6.15 `projects.project_ownership_transfers`

Explicit acceptance workflow for transfer of an entire hierarchy.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `root_project_id` | UUID | Yes | FK projects |
| `previous_owner_id` | UUID | Yes | FK auth.users |
| `new_owner_id` | UUID | Yes | FK auth.users |
| `initiated_by` | UUID | Yes | FK auth.users |
| `token_hash` | TEXT | Yes | Hashed confirmation token |
| `status` | TEXT | Yes | pending/accepted/expired/cancelled |
| `expires_at` | TIMESTAMPTZ | Yes | Explicit expiry |
| `created_at` | TIMESTAMPTZ | Yes | Server default |
| `completed_at` | TIMESTAMPTZ | No | Set on completion |

Rules:

- New owner must already have a registered account and verified email.
- New owner explicitly confirms the transfer.
- Transfer remains pending until confirmation.
- On confirmation, one transaction locks the hierarchy and updates owner for root and every descendant.
- Owner equality between parent and child must remain valid throughout the committed state.
- Resource/tool connections do not transfer automatically; they remain subject to their own ownership and provider rules.
- Previous owner does not retain administrative rights automatically. They may remain only through an explicit membership.
- Reject or cancel stale pending transfers when a conflicting transfer is initiated.
- Transfer initiation and completion are audited.

### 6.16 `projects.project_audit_logs`

Append-only audit history.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | Yes | PK |
| `project_id` | UUID | No | FK projects, nullable after deletion |
| `project_id_snapshot` | UUID | Yes | Original project UUID retained |
| `actor_user_id` | UUID | No | FK auth.users; nullable for system actor |
| `event_code` | VARCHAR(100) | Yes | Stable event identifier |
| `entity_type` | VARCHAR(60) | Yes | Affected entity type |
| `entity_id` | UUID | No | Affected entity identifier |
| `old_values` | JSONB | No | Redacted snapshot |
| `new_values` | JSONB | No | Redacted snapshot |
| `metadata` | JSONB | No | Safe event metadata |
| `request_id` | UUID | No | Correlation identifier |
| `created_at` | TIMESTAMPTZ | Yes | Server timestamp |

Rules:

- Client roles cannot insert, update or delete audit rows.
- Audit records are append-only.
- Do not store passwords, PINs, tokens, secrets, raw invitation tokens or tool credentials.
- Use `project_id_snapshot` to preserve historical association after project deletion.
- `project_id` may become null after a permitted deletion; audit history itself is retained.
- Read access is permission-controlled and must not expose sensitive snapshots to ordinary members.
- Index `project_id_snapshot, created_at`, `actor_user_id, created_at`, and `event_code, created_at`.

Initial event codes:

- `project.created`
- `project.updated`
- `project.archived`
- `project.restored`
- `project.deleted`
- `ownership_transfer.initiated`
- `ownership_transfer.completed`
- `member.invited`
- `member.joined`
- `member.removed`
- `member.suspended`
- `member.role_changed`
- `permission.granted`
- `permission.revoked`
- `visibility.changed`
- `publication.published`
- `publication.suspended`
- `resource.shared`
- `resource.access_revoked`
- `tool.connected`
- `tool.disconnected`

---

## 7. Authorization model

### 7.1 Evaluation order

A central server-side authorization function (logical name: `projects.project_has_permission`) must evaluate:

1. Resolve the authenticated identity from `auth.uid()`; do not trust a client-supplied actor ID.
2. Verify the target project exists and is in the relevant lifecycle state.
3. If the actor is the project owner, allow owner-level administrative operations.
4. If the actor owns the root ancestor of the target project, allow hierarchy super-administrator operations.
5. Otherwise require active membership in the exact target project.
6. Resolve the member's role and role-permission mapping.
7. Apply unexpired individual permission overrides.
8. Explicit deny overrides ordinary role allow.
9. Suspended or removed membership denies ordinary project access.
10. Return a boolean or structured denial code; never return sensitive membership data as a side effect.

Parent membership is not inherited by child projects. Only the parent owner receives hierarchy-wide super-administrator authority.

### 7.2 Owner precedence

- Owner is determined by `projects.owner_user_id`.
- The owner cannot be denied by `project_access_grants`.
- Parent owner authority extends to all descendants.
- A child leader can manage delegated child operations but cannot change the owner or bypass parent-owner control.
- Ownership and role are separate dimensions.

### 7.3 Public access

Public access uses a separate function (logical name: `projects.project_is_publicly_available`).

It must verify the target and every ancestor:

- publication exists and status is `published`;
- target project is active;
- target confidentiality is public;
- every ancestor is active;
- every ancestor confidentiality is public.

Public endpoint must select only safe publication columns. Internal workspace policies must never be reused as public publication policies.

### 7.4 RLS strategy

Enable RLS on every Projects table.

Baseline:

- `anon`: no direct table access.
- `authenticated`: no direct INSERT/UPDATE/DELETE on critical tables.
- Authenticated SELECT is granted only where a reviewed RLS policy and schema/API exposure model require it.
- Critical writes occur through narrowly scoped RPC functions.
- Audit table is append-only and not client-writable.
- Public publication reads use a safe server endpoint or a reviewed safe projection; do not expose base tables.
- Use `SECURITY INVOKER` for views that should obey caller RLS. Any `SECURITY DEFINER` view/function requires explicit security review.

RLS policies must be written per table and operation. A single broad policy across all tables is not acceptable.

### 7.5 SECURITY DEFINER requirements

Every privileged function must:

- use a fixed safe `search_path` (prefer `pg_catalog` and fully qualified object names);
- fully qualify table/function references;
- derive the caller from `auth.uid()` where called by a user session;
- reject unauthenticated calls unless explicitly designed otherwise;
- not trust caller-supplied actor IDs or owner IDs;
- avoid unsafe dynamic SQL;
- have least-privilege ownership;
- revoke execution from `PUBLIC` and grant only to intended roles;
- avoid returning rows/columns outside the function's purpose;
- be tested under authenticated, anonymous and service-role contexts.

Do not create a general-purpose privileged SQL execution function.

---

## 8. RPC contracts and transaction boundaries

RPCs are the only supported client write path for critical Projects operations. Exact SQL signatures and JSON response shapes are finalized in the executable migration design, but the operation contracts below are normative.

| RPC | Purpose | Transactional requirements |
|---|---|---|
| `project_create` | Create root or child project | Insert project, default visibility and audit atomically |
| `project_update` | Update permitted project fields | Validate permission and immutable fields |
| `project_archive` | Archive one project | Update status, stop publication availability, audit atomically |
| `project_restore` | Restore one archived project | Restore internal state; ancestors still govern public access |
| `project_delete` | Physical deletion after checks | Lock project; reject children/dependencies; preserve audit |
| `project_transfer_initiate` | Start ownership transfer | Verify owner, target account and hierarchy; create pending transfer |
| `project_transfer_confirm` | Confirm transfer | Lock and atomically update entire hierarchy; audit |
| `project_member_invite` | Invite registered/unregistered person | Validate inviter, role scope, duplicate membership/invite and rate limit |
| `project_invitation_accept` | Accept invitation | Verify identity/email/token; create or reactivate membership atomically |
| `project_invitation_decline` | Decline invitation | Validate invitee and pending state |
| `project_member_remove` | Remove member | Prevent invalid owner/admin removal; audit |
| `project_member_role_update` | Change member role | Validate role scope and authority; audit |
| `project_permission_update` | Add/update/remove individual override | Validate membership, permission and authority; audit |
| `project_visibility_update` | Update confidentiality/listing flags | Validate owner-level authority; audit |
| `project_publication_update` | Create/update/publish/suspend projection | Validate publication authority and effective ancestor visibility |
| `project_resource_share` | Share project resource | Validate same hierarchy, ownership and permission scope |
| `project_resource_revoke` | Revoke one resource share | Revoke only selected share; audit |
| `project_access_check` | Check permission | Read-only, caller identity derived server-side |

### 8.1 Atomic project creation

One transaction must:

1. Validate authenticated user.
2. Validate parent (if provided), active state and owner equality.
3. Validate project type and component type.
4. Create project with creator as owner for root project, or inherited parent owner for child.
5. Create default private visibility row.
6. Create required audit event.
7. Return the created project DTO.

Any failure rolls back all writes.

### 8.2 Hierarchy mutation and cycle protection

For create-child, reparent (if ever supported), transfer and delete:

- Acquire transaction-scoped advisory lock keyed to hierarchy/root, or another proven serialization lock.
- Lock relevant project rows in deterministic order.
- Use recursive CTE to enumerate ancestors/descendants.
- Reject self-parent and any cycle.
- Verify owner equality for every affected edge.
- Keep all hierarchy changes in one transaction.
- Test concurrent attempts to mutate the same hierarchy.

Reparenting is not part of the initial user-facing release. If introduced later, it requires a separate reviewed operation because it changes ownership and inherited visibility semantics.

### 8.3 Atomic ownership transfer

On confirmation:

1. Verify token hash, pending status, expiry and authenticated new owner.
2. Verify new owner's account and verified email.
3. Lock root and every descendant.
4. Verify every descendant still has the previous owner.
5. Update owner for the full descendant set in one transaction.
6. Ensure composite parent/owner constraints remain satisfied.
7. Mark transfer accepted/completed.
8. Write audit events for the hierarchy.
9. Commit.

No partial ownership transfer is allowed.

### 8.4 Archive and restore

- Archive affects only the selected project.
- It stops that project's public publication from being served.
- Descendants are not automatically marked archived.
- Descendants under an archived ancestor are effectively unavailable publicly.
- Restore changes only the selected project's internal status.
- A restored child remains publicly unavailable while any ancestor is archived or private.

### 8.5 Physical deletion

`project_delete` must reject deletion if any of the following remain:

- child projects;
- active or historical references that must be retained;
- tool connection records that cannot safely be detached;
- resource shares;
- active publication records or other external references;
- financial orders or billing references, when those modules exist;
- unresolved transfer/invitation operations where deletion would invalidate security history.

A parent cannot be physically deleted while children exist. No cascade deletion of descendants.

Before deleting a project row, write a final audit event and preserve its identifier in `project_id_snapshot`. The exact retention strategy for child records must be specified per FK; audit logs must survive.

---

## 9. Account deletion integration

Projects must expose a protected, server-side account-deletion preflight contract for the account lifecycle service.

Deletion is blocked when:

1. The user owns any project, including archived projects and any descendant.
2. The user is the sole active administrator of any project where administrator continuity is required.
3. A pending ownership transfer or other critical dependency makes deletion unsafe.

The user must transfer ownership before account deletion. If they are the sole administrator, another administrator must be appointed first.

Important implementation note: RLS alone does not protect deletion from `auth.users`. The actual Supabase Auth deletion path must be inspected and integrated with a controlled server-side account deletion flow. Do not assume a database policy or a profile FK cascade can prevent Auth user deletion.

The existing `private.user_profiles.user_id` cascade is not sufficient protection for Projects. Projects identity FKs must use restrictive deletion behavior, and the account deletion service must run the preflight before calling the Auth Admin deletion API. A privileged service key must never be exposed to the browser.

---

## 10. Username lookup and invitation privacy

A dedicated function (logical name: `projects.project_user_lookup`) is required.

Input:
- normalized username query;
- bounded result limit.

Output:
- user UUID;
- immutable username;
- explicitly approved public display name/avatar fields only, if available.

Never return:
- email;
- birth date;
- private profile fields;
- auth metadata;
- whether an arbitrary email exists.

Search rules:

- case-insensitive exact or controlled prefix search; do not allow unbounded wildcard scans;
- require authenticated caller;
- apply rate limiting;
- return minimal result fields;
- membership/invitation creation stores UUID, not username;
- invitation to unregistered person is email-based and handled separately.

The exact search mode (exact match only vs prefix suggestions) must be fixed in API contract before implementation. Default security recommendation: exact username lookup for the first release.

---

## 11. Indexing requirements

Minimum indexes:

### projects.projects
- `parent_project_id`
- `owner_user_id`
- `created_by`
- `status`
- partial index for active projects by owner, if query plans justify it.

### project_memberships
- unique `(project_id, user_id)`
- `user_id, status`
- `project_id, status`

### project_roles
- unique system role key by scope/code
- unique custom role key by project/code

### project_access_grants
- unique `(project_id, user_id, permission_id)`
- `user_id, expires_at`

### project_invitations
- unique token hash
- indexes for pending invitations by project and invitee
- partial unique index to prevent duplicate pending invitation per target/project/role policy.

### project_visibility
- PK on `project_id`.

### project_publications
- unique `project_id`
- unique normalized `public_slug`
- index `status`.

### project_profile_listings
- unique `(project_id, profile_user_id)`
- `profile_user_id, status, position`.

### project_resource_shares
- `resource_owner_project_id, status`
- `consumer_project_id, status`
- resource lookup key `(resource_type, resource_id)`.

### project_ownership_transfers
- `root_project_id, status`
- `new_owner_id, status`
- unique token hash.

### project_audit_logs
- `project_id_snapshot, created_at DESC`
- `actor_user_id, created_at DESC`
- `event_code, created_at DESC`.

Final indexes must be validated against representative query plans. Avoid speculative indexes that increase write cost without a real query.

---

## 12. Migration plan

Migrations are to be created only after the specification is approved and the live database is re-inspected.

Recommended sequence:

1. **Preflight snapshot** — capture current schemas, constraints, functions, triggers, grants, RLS policies and migration history.
2. **Schema and catalogues** — create `projects` schema, component types, permission catalogue and role catalogue.
3. **Core project model** — create `projects`, memberships and role-permission relations.
4. **Authorization layer** — create access grants, permission evaluation functions and RLS policies.
5. **Invitations** — create invitation table and invitation RPCs.
6. **Visibility/publication** — create visibility, publication and profile listing tables/functions.
7. **Resource integration references** — create tool connection references and resource sharing tables; no dependency on a Tools table.
8. **Lifecycle and transfer** — create ownership transfer, archive/restore/delete RPCs and account-deletion preflight.
9. **Audit hardening** — enforce append-only audit behavior and complete event coverage.
10. **Verification** — run migration checks, RLS tests, concurrency tests and end-to-end acceptance tests.

Every migration must be reversible where safe. Destructive rollback is not automatic; production rollback must preserve user-created data.

---

## 13. Required security and correctness tests

Before any production deployment, automated tests must cover at least:

### Identity and ownership
- A registered user can create a root project without subscription.
- Creator becomes owner.
- Child inherits exact parent owner.
- Client cannot submit another user's owner ID to create a project.
- Parent owner can administer descendants without descendant membership.
- Parent member cannot access a child by inheritance.
- Child member cannot access parent by inheritance.
- Child leader cannot override parent owner.

### Hierarchy
- Self-parent rejected.
- Direct and indirect cycles rejected.
- Concurrent hierarchy mutations cannot create cycles.
- Parent/child owner mismatch cannot commit.
- Ownership transfer changes every descendant atomically.
- Failed transfer leaves every owner unchanged.

### Membership and roles
- One membership per project/user.
- Role scope mismatch rejected.
- Suspended/removed member loses access.
- Custom roles are project-scoped and do not propagate.
- System roles cannot be modified by ordinary project admins.
- Explicit deny overrides role allow.
- Owner/ancestor owner cannot be denied by ordinary grants.

### Invitations
- Registered user invitation resolves to UUID.
- Unregistered invite requires registration, email verification and explicit acceptance.
- Wrong account cannot accept.
- Expired/revoked/used token cannot be accepted.
- Duplicate pending invitations are blocked.
- Email delivery failure does not create membership.
- Rate limits are enforced.

### Privacy and publication
- New project defaults private.
- Public project does not expose internal workspace.
- Private ancestor blocks descendant public endpoint.
- Archived ancestor blocks descendant public endpoint.
- Publication draft/suspended is not public.
- Profile listing requires owner authorization.
- Membership alone does not create profile listing.
- Public response contains no email, internal description, UUIDs, audit or credentials.

### Resource sharing
- Only same-hierarchy sharing is allowed in release one.
- Consumer cannot re-share.
- One share can be revoked without affecting another consumer.
- Revoked/suspended share blocks use.
- Credentials are never returned to consumer.
- Tool entitlement is checked independently.

### Lifecycle and account deletion
- Archive preserves membership and audit history.
- Archiving a child does not affect siblings.
- Restore of a child under archived parent does not make it public.
- Parent deletion with children is rejected.
- Project deletion with dependencies is rejected.
- Account deletion is blocked for any owned project.
- Account deletion is blocked when user is sole administrator.
- Audit survives project deletion.

### Database security
- Anonymous role has no direct access to private project data.
- Authenticated user cannot write critical tables directly.
- RPCs reject spoofed user IDs.
- Privileged functions have fixed search paths and restricted EXECUTE grants.
- RLS is enabled on all Projects tables.
- No secret or service-role key is present in frontend artifacts.

---

## 14. Decisions intentionally deferred

The following are not blockers for the core schema, but must be settled before their respective features are implemented:

1. Exact permission matrix for each initial system role.
2. Whether username lookup is exact-only or offers prefix suggestions; recommended initial choice is exact-only.
3. Public profile display fields and avatar source.
4. Publication slug normalization, reserved words and slug change/redirect policy.
5. Whether publication revisions are required in the first public release.
6. Resource type catalogue and exact resource permission codes when Tools is designed.
7. Account deletion service implementation and Supabase Auth Admin integration.
8. Data retention period and legal policy for audit records.
9. Whether the owner may delegate publication to a specific role; default recommendation is owner-only.
10. Whether hidden profile listings are retained as rows or physically removed; default recommendation is retained with status `hidden`.

Do not silently resolve these deferred decisions by inventing behavior in application code.

---

## 15. Acceptance criteria for approving executable SQL

The specification is ready to become migration SQL only when:

- all table definitions and FK actions are internally consistent;
- initial role-permission matrices are explicitly approved;
- RLS policy matrix is documented table-by-table;
- every RPC has an exact signature, input validation, output contract and privilege grant;
- ownership transfer and hierarchy locking strategy has been validated in PostgreSQL;
- account deletion integration is designed against the actual Supabase Auth flow;
- schema exposure and grants are confirmed for this Supabase project;
- security tests are mapped to automated test cases;
- no old Projects/Tools implementation is implicitly reused;
- user explicitly approves the final executable migration plan.

**Current state:** specification draft prepared. No database DDL, RLS, grants, functions, triggers, data or migrations have been changed.
