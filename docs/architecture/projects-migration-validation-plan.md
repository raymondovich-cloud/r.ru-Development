# Projects — migration validation plan

**Version:** 1.0.0  
**Status:** Review draft — no migrations applied  
**Created:** 2026-11-16  
**Updated:** 2026-11-16  
**Target Supabase project:** `yajybgdorhxebbigwjgi`  
**Target PostgreSQL:** 17.11

## 1. Purpose and execution boundary

This plan describes how the approved Projects model will be converted into Supabase migrations and validated. The accompanying SQL is a review draft, not a Supabase CLI migration and must not be applied to the connected project.

When SQL is ready to enter the migration workflow, generate the real migration file using `supabase migration new <descriptive_name>`; do not invent timestamps or migration filenames.

## 2. Read-only live preflight (2026-11-16)

| Check | Result |
|---|---|
| PostgreSQL | 17.11 |
| `projects` schema | Absent |
| Projects/Tools tables in inspected application schemas | None |
| Profile source | `private.user_profiles` |
| Username | Existing immutable profile username; normalized uniqueness previously audited |
| `pgcrypto` | Installed in `extensions`, version 1.3 |
| Existing auth/profile functions | `private.assign_default_user_role`, `private.create_user_profile_after_signup`, `public.lookup_auth_user_for_username`, `public.profile_settings_get`, `public.profile_settings_update` |
| API exposed-schema setting | Not returned by DB setting inspection; verify in Dashboard before deployment |

Existing authentication triggers/functions are outside this subsystem. Do not replace or silently alter them.

Supabase's 2026 Data API changes mean new tables/functions may require explicit grants. The design keeps base tables in an unexposed `projects` schema and exposes only individually reviewed wrappers in `public`.

References:
- [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Data API auto-exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## 3. Draft artifacts

`docs/architecture/sql-drafts/projects-001-core-schema.sql` contains the first-phase schema, catalogues, project/membership/role/grant/visibility tables, approved role-permission seeds, restrictive identity FKs, hierarchy owner equality, a role-scope integrity trigger and RLS default-deny.

It does not yet contain invitations, publication, profile listings, resource shares, ownership transfer, audit log, RPCs or public wrappers. Those require separate drafts.

## 4. Migration decomposition

| Phase | Responsibility | Validation |
|---|---|---|
| 001 | Core schema, catalogues, projects, memberships, roles, grants, visibility | FK invariants, seeds, default-deny |
| 002 | Authorization helpers and table-by-table RLS | Isolation, owner precedence, deny overrides |
| 003 | Invitations and notification outbox | Token lifecycle, email binding, retries |
| 004 | Publication and profile listings | Ancestor visibility, safe public DTO |
| 005 | Resource shares and Tools references | Same-hierarchy boundary, revocation isolation |
| 006 | Ownership transfer, archive/restore/delete, account-deletion preflight | Atomic tree transfer, blockers, concurrency |
| 007 | Public RPC wrappers and explicit grants | API boundary, EXECUTE allowlist, spoofing |
| 008 | Audit hardening and final indexes | Append-only audit, event coverage, query plans |

Adjust phase boundaries only when dependencies require it. Each migration must have one coherent responsibility and independently testable postconditions.

## 5. Local validation environment

1. Use a local Supabase stack pinned to a CLI version compatible with the repository and PostgreSQL 17.
2. Inspect `supabase --version`, `supabase --help` and `supabase migration --help`; CLI v3 changes local/hosted defaults.
3. Use a schema snapshot for the relevant Auth/profile dependencies or a disposable Supabase branch only after checking cost and obtaining explicit approval.
4. Never copy production user data into test fixtures.
5. Apply SQL drafts only to a disposable local database.
6. Run syntax, FK, trigger, seed, grants and RLS tests after each phase.
7. Run Supabase advisors when supported by the installed CLI/tooling.
8. Verify clean application from an empty database and migration history consistency.

## 6. Core schema test matrix

### Structure
- All required tables exist in `projects`.
- RLS is enabled on every table.
- `anon` and `authenticated` have no direct DML grants.
- Owner, creator and member identity FKs use restrictive deletion behavior.
- Composite parent FK enforces identical owner IDs along every edge.
- Parent deletion is restricted while children exist.
- Invalid project type/status and inconsistent archive state are rejected.
- New visibility rows default to private.

### Roles and permissions
- Exactly six system roles exist.
- Permission catalogue includes all approved codes, including `audit.view`.
- Seeded mappings exactly match specification Section 16.
- Parent roles cannot be assigned to children and vice versa.
- Custom roles are scoped to one project.
- Owner cannot be represented as a membership.
- Browser roles cannot mutate system roles or role mappings directly.

### Hierarchy and ownership
- Root owner is the authenticated creator in the eventual create RPC.
- Child owner must match parent owner.
- Parent membership is not inherited by child; child membership is not inherited by parent.
- Root owner can administer descendants without descendant memberships.
- No reparenting operation exists in release one.
- Concurrent hierarchy mutations serialize using the agreed root lock.

### Security
- Anonymous callers have no base-table access.
- Authenticated callers have no direct DML.
- Guessing a UUID does not grant row access.
- Wrappers derive actor from `auth.uid()`.
- Privileged functions use fixed search paths and fully qualified references.
- PUBLIC/anon EXECUTE is revoked before explicit per-signature grants.
- Authorization never relies on user-editable JWT metadata.
- Service-role credentials never enter browser artifacts or logs.

## 7. RPC/RLS test harness

Use pgTAP or an equivalent repeatable PostgreSQL harness. Create isolated test identities and switch JWT claims/roles explicitly.

Required personas: anon, unrelated authenticated A/B, root owner, parent administrator, parent manager, parent member, child leader, child developer, child observer and service role.

Every RPC test must cover valid use, unauthorized actor, spoofed UUID, malformed input, duplicate/replayed request, expired/revoked state and concurrency where applicable.

## 8. Corrections carried into SQL

1. Add `audit.view` to the canonical permission catalogue; it was added to the approved matrix but absent from the earlier permission seed list.
2. Public wrappers that access the unexposed internal schema may require `SECURITY DEFINER`. Treat each as a privileged API endpoint: check `auth.uid()`, set `search_path = ''`, fully qualify references, revoke default EXECUTE from PUBLIC/anon/authenticated, then grant only exact signatures.
3. Invitation/transfer token issuance and delivery must be trusted-server operations. The client must not choose arbitrary token hashes for newly created invitations or transfers. Persist only a cryptographic hash; deliver the raw bearer token through a protected one-time workflow.
4. Email delivery is not transactional with PostgreSQL. Insert an outbox row in the same transaction and send/retry asynchronously with idempotency.
5. Core draft RLS is enabled without client policies or grants. This is intentional default-deny until authorization/RPC phases are complete.

## 9. Release gates

No deployment to the connected Supabase project until:
- SQL is reviewed against a fresh live schema snapshot;
- clean local application succeeds on PostgreSQL 17;
- pgTAP/security tests pass;
- every SECURITY DEFINER function is reviewed;
- per-table RLS and grants are reviewed;
- API exposed schemas/default privileges are checked in Dashboard;
- Auth deletion integration is inspected;
- backup and rollback plan exists;
- user explicitly approves the final deployment plan.

## 10. Current state

- Role matrix and specification Sections 16–19: approved.
- Live database: read-only inspected; unchanged.
- Core SQL: draft only; not executed.
- Real Supabase migrations: not generated.
- Supabase production schema: unchanged.


## 11. Additional ownership-transfer invariant

The target owner must not already have a membership row in any project in the transferred hierarchy. The transfer-confirm operation must either reject the transfer until the target leaves those memberships, or atomically remove those memberships with explicit audit events before changing ownership. Release-one recommendation: reject and require membership cleanup first; this avoids silently changing the target's role/history during transfer.

The implementation must also ensure the previous owner is not accidentally reinserted as a member and that every descendant remains owner-consistent after the atomic transfer.

## 12. Validation status

The draft was reviewed structurally and stored in GitHub. A PostgreSQL parser/CLI is not available in the current execution environment, so SQL syntax has **not** been executed or certified. The next validation must run this draft against a disposable local Supabase/PostgreSQL 17.11 instance. This is an explicit remaining gate, not a claim of successful SQL execution.
