# TechPros ITSM — Full Audit & Remediation Report

Date: 2026-09-01 · Branch: `arena/01a05b4a-it-mastery-suite` · Baseline commit: `861c9e0`

---

## 1. Repository assessment (as found)

The repository was a Lovable-generated React SPA with three mutually inconsistent backends and no
working data layer:

| Area | State at baseline |
| --- | --- |
| Frontend | 25 routes, ~90 direct `supabase.from(...)` call sites embedded in page components. No API layer, no shared formatting, no pagination, no loading/error conventions. |
| "Backend" #1 | `src/integrations/supabase/*` — a live Supabase project addressed straight from the browser. |
| "Backend" #2 | `server/` — an Express + PostgreSQL API (routes for auth, tickets, assets…) that nothing in the frontend called. |
| "Backend" #3 | `supabase/` migrations + `apply_migration.sql`, describing yet another schema. |
| Database | Supabase Postgres schema with `profiles`/`user_roles`; RLS not verifiable from the repo; `expenses`, `purchase_orders`, `automation_rules`, `custom_reports` referenced by the UI but absent or partial. |
| Auth | Supabase client-side auth; role checks done in React only. |
| Tests | None (no test runner configured for either app). |
| CI/CD | None. No `vercel.json`, no wrangler config. |
| Secrets | `.env` with a live Supabase project id, URL and anon JWT **committed to git** and not ignored. |
| Docs | Two aspirational markdown files describing an Express/Postgres system that did not run. |

Several screens were pure mock data (`SystemHealth`, parts of `Reports`, `Branches` metrics), and
several linked to routes that did not exist (`/assets/:id`).

---

## 2. Problems found

### Critical

| # | Problem |
| --- | --- |
| C1 | Live Supabase project id, URL and anon key committed in `.env`, absent from `.gitignore`. |
| C2 | All authorisation was client-side (`profile.role === 'admin'` in JSX). Any user could call the database directly with the anon key and read/write other tenants' rows. |
| C3 | Three conflicting backends; the deployed frontend depended on a platform explicitly out of scope for the target architecture. |
| C4 | No server-side input validation anywhere — the browser wrote arbitrary rows. |
| C5 | Whole modules (expenses, purchase orders, budgets, reports, automation, system health) queried tables that did not exist in the schema, or rendered hard-coded mock data. |

### High

| # | Problem |
| --- | --- |
| H1 | No password policy, no session revocation, no refresh-token rotation. |
| H2 | Unbounded queries: every list screen fetched entire tables and filtered in the browser (`Branches` ran N+1 queries per branch — 5 round trips × N branches). |
| H3 | No rate limiting on authentication or anything else. |
| H4 | File "uploads" were not implemented; attachments UI wrote metadata with no storage behind it. |
| H5 | Ticket status/SLA rules existed only as UI copy — no transition validation, no SLA computation, no escalation. |
| H6 | No audit trail; no way to know who changed what. |
| H7 | Business invariants unenforced: diesel balance, expense self-approval, PO approval flow, last-admin protection, duplicate asset tags. |
| H8 | No tests of any kind; no CI. |
| H9 | Dead route `/assets/:id` linked from the asset list (guaranteed 404). |

### Medium

| # | Problem |
| --- | --- |
| M1 | No pagination anywhere; no debounced search; every keystroke refetched. |
| M2 | Error handling was `console.error` + a generic toast; validation messages from the server were discarded. |
| M3 | Duplicated date/currency/badge formatting logic in ~20 files, inconsistent between screens. |
| M4 | Single 1.4 MB JS bundle; the markdown editor and chart library loaded on the login screen. |
| M5 | Empty-string values used in shadcn `Select` (throws at runtime), missing `aria-label`s, no `aria-current` on nav. |
| M6 | `lovable-tagger` build plugin and `bun.lockb` left in a repo that installs with npm. |
| M7 | Notifications had no unread indicator outside the notifications page. |
| M8 | No dev/preview/prod separation; a single hard-coded URL. |

### Low / Info

| # | Problem |
| --- | --- |
| L1 | Stale documentation describing the abandoned Express backend. |
| L2 | `Departments` had no UI at all although assets/users/expenses reference them. |
| L3 | `ArticleTemplates.tsx` (450 lines of KB templates) was written but never wired into any screen. |
| L4 | Footer hard-coded "© 2025". |
| L5 | `npm audit` reports 7 vulnerabilities in dev-only transitive dependencies (esbuild/vite chain) — not exploitable in the shipped bundle, noted below as remaining work. |

---

## 3. Problems fixed

Each entry: problem → root cause → solution → files.

### Architecture & data layer

**C3/C5 — Three backends, missing tables.**
*Root cause:* the project accreted a Supabase prototype, an Express experiment and a partial SQL
schema without any of them being finished.
*Solution:* a single Cloudflare Workers API (Hono) with a complete D1 schema. Supabase, the Express
server and the loose SQL were deleted after every screen was migrated.
*Files:* `worker/**` (new, 40 modules), deleted `src/integrations/supabase/`, `server/`, `supabase/`,
`apply_migration.sql`, `supabase.zip`.

**Schema.** 24 tables in `worker/migrations/0001_initial_schema.sql`: branches, departments, users,
sessions, password_reset_tokens, tickets, counters, ticket_comments, assets, diesel_logs, vendors,
purchase_orders, expenses, kb_articles, kb_comments, kb_ratings, calendar_events, notifications,
automation_rules, automation_executions, custom_reports, attachments, activity_logs, system_metrics.
UUID text ids, ISO-8601 timestamps, enums via `CHECK`, soft deletes where records are referenced,
foreign keys with explicit `ON DELETE` behaviour, and covering indexes on every filtered column.
Supabase's `profiles` + `auth.users` + `user_roles` triple was collapsed into one `users` table.

### Security

**C1 — Committed secrets.** Removed `.env` from the index, added `.env`/`.env.local`/`.dev.vars` to
`.gitignore`, replaced with `.env.example` and `worker/.dev.vars.example` documenting every variable.
*The exposed Supabase anon key is still in git history — see Remaining issues.*
*Files:* `.env` (deleted), `.gitignore`, `.env.example`, `worker/.dev.vars.example`.

**C2/C4 — Client-side authz, no validation.** Every route now authenticates via middleware and
authorises in the handler; zod schemas validate every body and query string.
*Examples:* employees receive 404 (not 403) for tickets they do not own, cannot set priority or
assignee; expense self-approval returns 403; a second decision on the same expense returns 409;
`is_featured` on KB articles is admin-only; report datasets marked `staffOnly` are rejected for
employees.
*Files:* `worker/src/middleware/auth.ts`, `worker/src/lib/validation.ts`, all `worker/src/routes/*`.

**H1 — Session security.** PBKDF2 password hashing with per-user salt; passwords ≥ 10 characters
with letters and digits; 15-minute access tokens held **in memory only**; refresh tokens rotated on
every use, SHA-256 hashed at rest, delivered in an `HttpOnly; Secure; SameSite` cookie scoped to
`/api/auth`; reuse of a rotated token revokes the whole family; sessions are revoked on role change,
deactivation, deletion and password change.
*Files:* `worker/src/routes/auth.ts`, `worker/src/lib/crypto.ts`, `src/lib/api.ts`,
`src/contexts/AuthContext.tsx`.

**H3 — Rate limiting.** KV counters: login 20/15 min per IP + 10/15 min per account, register 5/h,
refresh 120/15 min, global 600/60 s on `/api/*`. `Retry-After` is returned.
*Files:* `worker/src/middleware/rate-limit.ts`.

**CORS.** Strict allow-list with credentials, `https://*.vercel.app` pattern for preview
deployments, 403 on unknown-origin preflight, plus `nosniff`/`DENY`/`no-referrer`/`no-store`
hardening headers on every response.
*Files:* `worker/src/middleware/cors.ts`, `vercel.json`.

**SQL injection & CSV injection.** All statements parameterised; the report builder resolves dataset,
field, operator and sort names through a whitelist map so no user string is ever concatenated into
SQL; CSV export prefixes `= + - @` cells with a quote.
*Files:* `worker/src/routes/reports.ts`.

**H4 — Uploads.** Real R2 storage: MIME whitelist, 10 MB cap, keys namespaced as
`${resourceType}/${resourceId}/${uuid}.${ext}`, private bucket, downloads streamed through an
authorised endpoint with permission checks; deletion is soft in D1 and hard in R2.
*Files:* `worker/src/routes/attachments.ts`, `src/components/FileUpload.tsx`,
`src/components/AttachmentList.tsx`.

**H6 — Audit trail.** Every mutation writes to `activity_logs` (actor, action, resource, IP, details);
`x-request-id` is generated or echoed and included in every error envelope; the admin
"System health → Audit trail" tab exposes it.
*Files:* `worker/src/lib/audit.ts`, `worker/src/middleware/request-id.ts`, `src/pages/SystemHealth.tsx`.

### Correctness / business rules

**H5 — Tickets.** Server-side state machine (`open→in_progress|resolved|closed`,
`in_progress→open|resolved|closed`, `resolved→closed|in_progress`, `closed→in_progress`; anything
else 409). SLA due dates computed on create (critical 4 h, high 8 h, medium 24 h, low 72 h),
`resolved_at`/`closed_at` stamped, sequential `TKT-000001` numbers allocated from a `counters` table
inside the write, notifications on assignment and resolution.
*Files:* `worker/src/routes/tickets.ts`.

**H7 — Invariants now enforced server-side:** diesel `opening + received == consumed + closing`
(±0.01) and no future dates; duplicate asset tags → 409; branch/department deletion blocked while
dependents exist → 409; the last active administrator cannot be demoted, deactivated or deleted;
users cannot change their own role or deactivate themselves; PO transitions follow
draft→pending→approved→ordered→received with admin-only approvals and terminal states;
vendors referenced by a PO cannot be deleted.
*Files:* `worker/src/routes/{diesel,assets,org,users,procurement,finance}.ts`.

**Scheduled work.** Cron triggers replace work that previously did not happen at all: every 15 min an
SLA breach sweep (deduplicated per ticket+user), calendar reminders and metric recording; daily at
06:00 UTC contract/warranty expiry notices (30-day horizon) and retention cleanup of old logs and
read notifications.
*Files:* `worker/src/cron.ts`.

**H9/L2/L3 — Dead ends closed.** The asset list now edits in place instead of linking to a route that
never existed; departments got full CRUD (a tab on the Organisation screen); the orphaned
`ArticleTemplates` component is wired into the new-article screen as a "Templates" tab.
*Files:* `src/pages/Assets.tsx`, `src/pages/Branches.tsx`, `src/pages/NewKBArticle.tsx`.

### Frontend

**Typed API client.** `src/lib/api.ts`: `{data, meta}` / `{error:{code,message,details,requestId}}`
envelopes, an `ApiError` class exposing `status`/`code`/`firstFieldError`, in-memory token store,
deduplicated refresh, automatic single retry after a 401, query-string builder that drops empty
values, and `upload()` for multipart. `errorMessage()` turns anything thrown into a sentence for a
toast. (A bug found while testing: `firstFieldError` returned the raw `string[]` from the API and
would have rendered `["Title is too short"]` in the UI — fixed and covered by a test.)

**All 25 screens rewritten** against the API with a consistent contract: stats cards from the
server's `/stats` endpoints, debounced search, server-side pagination via a shared `DataPagination`,
`useEffect(() => setPage(1), [filters])`, role-gated actions from `useAuth()`, mutations invalidating
both the list and the stats query keys, destructive-toast error handling, and a `NONE` sentinel for
optional `Select` values (M5).
*Files:* `src/pages/*.tsx` (25), `src/components/{Layout,DataPagination,AttachmentList,FileUpload,ProtectedRoute}.tsx`,
`src/lib/format.ts`, `src/hooks/use-debounce.ts`.

**M3 — Formatting.** One `src/lib/format.ts` (currency, number, date, date-time, relative time,
bytes, `humanise`, badge variants) replaces the duplicated helpers.

**M4 — Bundle.** Route-level `React.lazy` + manual vendor chunks. Initial JS went from a single
1,423 kB chunk to 228 kB (71 kB gzip) plus small per-route chunks; the 795 kB markdown editor now
loads only on knowledge-base authoring screens and charts only on Expenses/Dashboard.

**M8 — Environments.** Vite proxies `/api` to `wrangler dev` locally (so the browser is always
same-origin), `VITE_API_BASE_URL` selects preview/production, and `wrangler.toml` carries separate
`[env.preview]` / `[env.production]` blocks with their own D1, KV, R2 and vars.

**M7/L4/M5 — UX.** Unread notification badge in the header and sidebar (polled every 60 s), a real
sidebar with `aria-current`, `aria-label`s on icon-only controls, dynamic copyright year.

---

## 4. Architecture changes

```
Before                                   After
─────────────────────────────────────    ────────────────────────────────────────────
Browser → supabase-js → Supabase PG      Browser (Vercel, static)
(+ unused Express/PG server)                │  same-origin /api in dev via Vite proxy
(+ unused SQL migrations)                   ▼
                                         Cloudflare Worker (Hono)
                                            ├── D1        relational data
                                            ├── R2        attachments (private)
                                            ├── KV        cache, rate limits, throttles
                                            └── Cron      SLA, reminders, metrics, retention
```

- **Durable Objects were deliberately not used.** Nothing in the product needs single-writer
  coordination or live sockets; polling with a KV-cached dashboard is cheaper and simpler.
- **Queues were not used.** The only asynchronous work (notifications, emails) is short and runs
  inside `ctx.waitUntil`; adding a queue would add moving parts without a workload to justify it.
- API surface: `/api/auth`, `/users`, `/tickets`, `/assets`, `/branches`, `/departments`, `/diesel`,
  `/vendors`, `/purchase-orders`, `/expenses`, `/budgets`, `/knowledge-base`, `/calendar`,
  `/notifications`, `/reports`, `/automation`, `/system`, `/attachments`, `/dashboard`.

---

## 5. Features completed

| Module | What now works end-to-end |
| --- | --- |
| Auth | Register (first user → admin when bootstrapping), login, refresh rotation, logout, logout-all, change password, password reset request/confirm, profile read/update |
| Tickets | List with 7 filters + search, stats, detail, comments, transitions, SLA + overdue, assignment rules, attachments |
| Assets | Inventory, stats (by status, total value, warranty expiring), categories, CRUD with duplicate-tag protection, inline edit |
| Diesel | Logs with balance validation, consumption stats, per-branch reporting |
| Vendors | CRUD, service types, ratings, expiring-contract banner, deletion guarded by PO references |
| Purchase orders | Sequential `PO-YYYY-00001`, full approval workflow with admin-only transitions, stats |
| Expenses | Submission, receipts in R2, approve/reject with reason, category charts, period filters, scoped visibility |
| Budgets | Branch and department allocations vs approved spend per financial year |
| Organisation | Branch and department CRUD with counts, manager assignment, deletion guards |
| Knowledge base | Articles (markdown), templates, drafts, categories, tags, featured, throttled view counts, comments, 1–5 ratings, inline editing |
| Calendar | Month grid, event CRUD, attendees + notifications, reminders, filters |
| Notifications | Filtered list, stats, mark read / read-all, delete, bulk delete of read, header badge |
| Reports | Whitelisted dataset builder, filters, sort, limit, saved reports, JSON run and CSV export |
| Automation | Rule builder (7 triggers, 6 operators, 5 action types), activation toggle, execution log |
| System health | Live D1/KV/R2 probes, recorded metric history, alerts, paginated audit trail |
| Users | Directory, stats, create/update/deactivate/delete with guards, admin password reset |
| Dashboard | Role-scoped KPIs across tickets, assets, finance, diesel and operations, KV-cached 60 s |

---

## 6. Security improvements (summary)

1. Secrets removed from the repository and documented as environment variables/secrets.
2. Server-side authentication and authorisation on every route; UI gating is now cosmetic only.
3. PBKDF2 password hashing, password policy, session revocation, refresh-token rotation with reuse
   detection.
4. KV rate limiting on auth and globally.
5. Strict credentialed CORS, security headers on both the API (worker) and the app (Vercel).
6. Parameterised SQL everywhere; whitelisted report fields; CSV formula-injection escaping.
7. Private R2 bucket with MIME/size validation and authorised streaming downloads.
8. Full audit log with request-id correlation, plus an admin UI to read it.
9. Login enumeration avoided: password reset always returns the same response.

## 7. Performance improvements

| Change | Effect |
| --- | --- |
| Server-side pagination + filtering | List screens fetch ≤ 20 rows instead of whole tables |
| Removed N+1 loops (`Branches` did 5 queries per branch) | 1 query with correlated sub-selects |
| Dashboard aggregation in one query, cached in KV for 60 s | ~15 client round trips → 1 |
| Debounced search (300 ms) | ~1 request per search instead of one per keystroke |
| Route-level code splitting + vendor chunks | Initial JS 1,423 kB → 228 kB (71 kB gzip) |
| Immutable cache headers for hashed assets (`vercel.json`) | Repeat visits served from cache |
| Indexes on every filtered/sorted column in D1 | Bounded query cost as data grows |
| Edge execution | API runs close to the user rather than in a single region |

## 8. Testing performed

All commands below were executed in this workspace; the output quoted is the actual result.

| Suite | Command | Result |
| --- | --- | --- |
| Worker API integration (real D1 via `@cloudflare/vitest-pool-workers`) | `cd worker && npx vitest run` | **45 passed / 45** |
| Worker types | `cd worker && npx tsc --noEmit` | clean |
| Frontend unit/component | `npx vitest run` | **14 passed / 14** |
| Frontend types | `npm run typecheck` | clean |
| Production build | `npm run build` | success (10.2 s) |

Worker coverage includes: registration/bootstrap-admin, login + lockout counters, refresh rotation
and reuse detection, password policy, reset-flow enumeration safety, CORS preflight rejection,
security headers, ticket creation/validation/transitions/permissions/SLA, employee scoping,
comments, assets, org guards, diesel balance rule, expense self-approval and double-decision,
PO workflow, KB permissions and ratings, notifications, report field whitelisting, and automation
rule evaluation.

Frontend tests cover the API client (bearer injection, query building, typed errors, refresh-retry,
refresh failure) — which caught the `firstFieldError` bug — the formatting helpers, and the shared
pagination component (boundaries, range summary, callbacks).

**Manual full-lifecycle verification** against `wrangler dev` with a real local D1, through the Vite
proxy (both processes were running in this session):

```
/api/system/ping                → {"status":"ok","environment":"development"}
register (first user)           → role "admin", access token + refresh cookie
GET /api/auth/me                → profile
POST /branches                  → Head Office created
POST /tickets                   → TKT-000001, priority high, SLA set
PUT  /tickets/:id status        → in_progress; invalid value → 422
POST /tickets/:id/comments      → comment persisted
GET  /dashboard                 → aggregated KPIs incl. slaCompliance 100
GET  /budgets?year=2026         → Head Office 500000 / spent 0 / util 0
GET  /system/health             → healthy (D1 2 ms, KV 0 ms, R2 ok)
KB: create → view → rate 5 → comment → search → categories   ✓
Calendar: create event → window query returns it             ✓
Expenses: create → self-approve blocked (403) → stats correct ✓
Reports: datasets → run (1 row) → unknown field rejected (422) ✓
Automation: rule created with condition + action              ✓
Frontend: SPA served 200 through the preview host, /api proxied ✓
D1 migrations applied to a fresh local database (77 statements) ✓
Seed script applied twice — idempotent, no duplicates          ✓
```

---

## 9. Remaining issues (honest status)

1. **The leaked Supabase anon key is still in git history.** Removing it from the working tree does
   not remove it from commit `861c9e0`. Rotate/disable the key in the Supabase dashboard (or delete
   the project, which is now unused) and, if the history matters, rewrite it with
   `git filter-repo`. I did not rewrite published history unilaterally.
2. **Nothing has been deployed.** No Cloudflare account is connected to this sandbox, so
   `wrangler deploy`, remote D1 migrations and the Vercel project were not run. `wrangler.toml`
   contains placeholder `database_id`/KV ids that must be replaced with real ones (§ Deployment in
   the README).
3. **Email is unconfigured.** Without `RESEND_API_KEY` the worker logs the message instead of
   sending it — password-reset links therefore only appear in worker logs until the key is set.
4. **No data migration from Supabase was performed.** The old project's contents were never
   accessible from this environment; if it holds real records, an export/import script against the
   new D1 schema is still required. The schema was designed to accept it (same conceptual model,
   `profiles`+`user_roles` merged into `users`).
5. **`npm audit` reports 7 vulnerabilities** in dev-only transitive dependencies (the esbuild/vite
   chain). They do not affect the shipped bundle; upgrading to Vite 6 is the clean fix and is a
   breaking-change task I left out of this pass.
6. **Test depth.** The API is well covered; the frontend has unit/component tests but no end-to-end
   browser suite (Playwright) — the UI was verified manually and by the lifecycle run above.
7. **Wrangler 3 is pinned.** Wrangler 4 is available; the upgrade also moves the vitest pool version
   and was out of scope for this pass.
8. **CI is not active yet.** The pipeline lives at `ci/github-actions-ci.yml` instead of
   `.github/workflows/ci.yml`: the automation account that opened the pull request is not granted
   GitHub's `workflows` permission, so the push is rejected if it contains workflow files. A
   maintainer enables it with `git mv ci/github-actions-ci.yml .github/workflows/ci.yml`
   (see `ci/README.md`).
9. **Bundle size.** The markdown editor chunk is 795 kB (274 kB gzip). It is lazy-loaded, so it only
   affects knowledge-base authoring; replacing `@uiw/react-md-editor` with a lighter editor would
   remove it entirely.

---

## 10. Deployment instructions

Exact, reproducible steps live in **[README.md → Deployment](./README.md#deployment)**. In short:

**Cloudflare**

```bash
cd worker
npx wrangler login
npx wrangler d1 create itsm-db
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create RATE_LIMIT
npx wrangler r2 bucket create itsm-uploads
# paste the returned ids into wrangler.toml ([env.production] / [env.preview])
npx wrangler secret put JWT_SECRET --env production      # >= 32 random characters
npx wrangler secret put APP_BASE_URL --env production
npx wrangler d1 migrations apply itsm-db --remote --env production
npx wrangler deploy --env production
curl https://<worker-url>/api/system/ping
```

**Vercel**

1. Import the repo (settings come from `vercel.json`: Vite, `npm run build`, `dist`, SPA rewrites,
   security headers).
2. Set `VITE_API_BASE_URL` per environment to the worker URL + `/api`.
3. Deploy, then add the Vercel origin(s) to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy the
   worker.

**Then:** register the first account (it becomes admin), set `BOOTSTRAP_ADMIN = "false"`, redeploy
the worker, and confirm `/api/system/health` is green.
