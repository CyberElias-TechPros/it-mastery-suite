# TechPros ITSM

IT Service Management for TechPros: ticketing with SLAs, asset and diesel tracking, procurement,
expenses and budgets, a knowledge base, a shared calendar, reporting, automation rules and system
health monitoring.

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript + Tailwind/shadcn, deployed on **Vercel** |
| API | Hono on **Cloudflare Workers** (edge) |
| Relational data | **Cloudflare D1** (SQLite) |
| Files | **Cloudflare R2** (private bucket, streamed through the API) |
| Cache, rate limits, throttles | **Cloudflare KV** |
| Scheduled work | **Cloudflare Cron Triggers** (SLA sweep, reminders, metrics, retention) |

There is no other backend: no Supabase, no Express server, no external database.

---

## Repository layout

```
.
├── src/                  # React application (Vite)
│   ├── lib/api.ts        # typed API client: envelopes, auth, refresh-retry
│   ├── contexts/         # AuthContext (access token in memory, refresh in cookie)
│   ├── components/       # Layout, shared widgets, shadcn/ui primitives
│   ├── pages/            # one screen per route
│   └── test/             # vitest + testing-library suites
├── worker/               # Cloudflare Workers API
│   ├── src/routes/       # auth, tickets, assets, org, diesel, procurement, finance,
│   │                     # kb, calendar, notifications, reports, automation, system,
│   │                     # attachments, dashboard
│   ├── src/middleware/   # request-id, cors, error, auth, rate-limit
│   ├── src/lib/          # crypto, jwt, validation, db, audit, notifications, email
│   ├── migrations/       # D1 schema migrations (applied with wrangler)
│   ├── seeds/demo.sql    # optional local reference data (no accounts)
│   └── test/             # vitest-pool-workers integration tests (real D1)
├── vercel.json           # Vercel build, SPA rewrites, security headers
└── ci/                   # CI pipeline (move to .github/workflows/ to enable)
```

---

## Local development

Prerequisites: Node 20+, a Cloudflare account (only needed for deployment).

```bash
# 1. install
npm install
npm --prefix worker install

# 2. worker secrets for local dev
cp worker/.dev.vars.example worker/.dev.vars      # then edit JWT_SECRET (>= 32 chars)

# 3. create the local D1 database
npm --prefix worker run db:migrate:local
npm --prefix worker run db:seed:local             # optional reference data

# 4. run both processes (two terminals)
npm --prefix worker run dev                       # http://127.0.0.1:8787
npm run dev                                       # http://localhost:8080
```

The Vite dev server proxies `/api/*` to `127.0.0.1:8787`, so the browser only makes same-origin
requests — cookies and CORS behave exactly as they do in production.

**First account:** with `BOOTSTRAP_ADMIN = "true"` (default in the dev environment only), the first
account registered becomes the administrator. Set it to `"false"` immediately after bootstrapping a
deployed environment.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :8080 with the `/api` proxy |
| `npm run typecheck` / `npm test` / `npm run build` | Frontend checks |
| `npm --prefix worker run dev` | `wrangler dev` with local D1/KV/R2 simulation |
| `npm --prefix worker run typecheck` / `test` | Worker checks (tests run against a real D1) |
| `npm --prefix worker run db:migrate:local\|db:migrate:remote` | Apply migrations |

---

## Environment variables

### Frontend (Vercel project settings → Environment Variables)

| Name | Required | Example | Notes |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | production/preview | `https://api.techpros.example/api` | Absolute URL of the Workers API. Leave empty locally so the Vite proxy is used. |

`VITE_*` variables are compiled into the browser bundle — never put secrets there.

### Worker vars (`worker/wrangler.toml`, per environment — not secret)

| Name | Example | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `production` | Reported by `/api/system/ping`, used in logs |
| `ALLOWED_ORIGINS` | `https://app.techpros.example,https://*.vercel.app` | Comma separated. `https://*.vercel.app` permits preview deployments. Unknown origins get a 403 on preflight. |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_SECONDS` | `1209600` | Refresh-cookie lifetime |
| `MAX_UPLOAD_BYTES` | `10485760` | Hard upload cap (also enforced per request) |
| `BOOTSTRAP_ADMIN` | `false` | `true` only while creating the very first admin |

### Worker secrets (`wrangler secret put NAME --env <env>` — never committed)

| Name | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | yes | ≥ 32 characters. The worker refuses to start without it. |
| `RESEND_API_KEY` | no | Transactional email. If unset, emails are logged instead of sent. |
| `EMAIL_FROM` | no | e.g. `TechPros ITSM <itsm@example.com>` |
| `APP_BASE_URL` | recommended | Used to build password-reset links |

Locally these live in `worker/.dev.vars`, which is gitignored.

---

## Deployment

### 1. Cloudflare (API, database, storage)

```bash
cd worker
npx wrangler login

# Resources — run once per environment (production shown; repeat with -preview names)
npx wrangler d1 create itsm-db
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create RATE_LIMIT
npx wrangler r2 bucket create itsm-uploads
```

Copy each returned id into `worker/wrangler.toml` (`database_id`, KV `id`s) for the matching
environment block: the top-level block is development, `[env.preview]` and `[env.production]` hold
the deployed ones. Set `ALLOWED_ORIGINS` in each block to the exact frontend origin.

```bash
# Secrets
npx wrangler secret put JWT_SECRET --env production          # >= 32 random characters
npx wrangler secret put RESEND_API_KEY --env production      # optional
npx wrangler secret put EMAIL_FROM --env production          # optional
npx wrangler secret put APP_BASE_URL --env production

# Schema, then deploy
npx wrangler d1 migrations apply itsm-db --remote --env production
npx wrangler deploy --env production
```

Verify: `curl https://<worker-url>/api/system/ping` → `{"data":{"status":"ok",...}}`.

Cron triggers (`*/15 * * * *` and `0 6 * * *`) are created by `wrangler deploy`; they run the SLA
sweep, event reminders, metric recording, expiry notices and retention cleanup.

To serve the API from your own domain, add a route in the Cloudflare dashboard
(`api.techpros.example/*` → the worker) and use that host in `VITE_API_BASE_URL`.

### 2. Vercel (frontend)

1. Import the repository. Vercel reads `vercel.json`: framework `vite`, build `npm run build`,
   output `dist`, SPA rewrites and security headers are already configured.
2. Set `VITE_API_BASE_URL` for **Production** (production worker URL + `/api`) and for
   **Preview** (preview worker URL + `/api`).
3. Deploy, then add the resulting origin(s) to the worker's `ALLOWED_ORIGINS` and redeploy the
   worker so CORS accepts them.

### 3. Post-deploy checklist

- [ ] Register the first account, confirm it is `admin`, then set `BOOTSTRAP_ADMIN = "false"` and
      redeploy the worker.
- [ ] `GET /api/system/health` (as admin) reports `healthy` for D1, KV and R2.
- [ ] Sign-in, refresh and sign-out work from the deployed frontend (cookie + CORS).
- [ ] Upload and download an attachment (R2 wiring).
- [ ] Rotate `JWT_SECRET` on any suspicion of exposure — it invalidates all access tokens.

---

## Security model

- Argon2-style PBKDF2 password hashing with per-user salts; passwords ≥ 10 chars with letters+digits.
- Short-lived access tokens (JWT, in memory only) + rotating refresh tokens in an `HttpOnly`,
  `Secure`, `SameSite` cookie scoped to `/api/auth`. Reuse of a rotated token revokes the family.
- Every route authorises server-side: employees only see their own tickets/expenses, staff-only
  datasets are filtered in SQL, admin-only mutations are enforced in the handler (never in the UI).
- KV-backed rate limits: login 20/15 min per IP and 10/15 min per account, register 5/h, refresh
  120/15 min, plus a global 600/60 s ceiling on `/api/*`.
- Strict CORS allow-list with credentials; unknown-origin preflights are rejected with 403.
- All input validated with zod; SQL is fully parameterised and report fields resolve through a
  whitelist, so no user string ever reaches SQL. CSV exports escape formula-injection prefixes.
- Uploads: MIME whitelist, size cap, private R2 bucket, downloads streamed through an authorised
  endpoint (objects are never public).
- Audit trail in `activity_logs` for every mutation, with request ids echoed as `x-request-id`.

## Testing

```bash
npm test                    # frontend unit/component tests (vitest + testing-library)
npm --prefix worker test    # API integration tests against a real D1 instance
```
