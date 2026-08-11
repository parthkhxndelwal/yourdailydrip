# AGENTS.md

## What This Is

Monorepo for Daily Drip, an Indian DTC skincare/hair-care brand. Two independent apps sharing one git repo:

- `backend/` - Medusa v2 commerce backend (npm workspaces + Turborepo, Docker on a VPS)
- `storefront/` - TanStack Start (React) storefront deployed to Cloudflare Workers

The repo root is a git container + CI only - it has no package.json.

## Read These First

Per-tree context is authoritative and lives in nested files; read the nearest one before working in that tree:

- `backend/AGENTS.md` - backend architecture, modules, workflows, tests, gotchas
- `storefront/AGENTS.md` - storefront stack, routes, data layer, design system, tests
- `backend/DEPLOYMENT.md` - ops guide: VPS, Caddy, docker-compose, backups, troubleshooting
- `backend/apps/backend/src/modules/ithink/README.md` - iThink logistics integration contract (modes, endpoints, polling)
- `README.md` - setup, GitHub secrets, first-run, local dev
- `.omo/plans/` - past planning docs; useful for understanding how decisions were made

## Layout

```
backend/                  Medusa v2 backend: npm workspaces + Turborepo
├── apps/backend/         the Medusa app (@dtc/backend) - all source under src/
│   ├── medusa-config.ts  module registrations (R2, Razorpay, iThink, preorder, notifications)
│   └── src/
│       ├── modules/      preorder (data), ithink (fulfillment provider), resend (notification)
│       ├── workflows/    preorder workflows + steps
│       ├── jobs/         preorder-fulfillment (6h), ithink-tracking (30min)
│       ├── subscribers/  preorder lifecycle + iThink auto-submit gating
│       ├── api/          file-based store/admin routes + middlewares
│       ├── links/        module links
│       └── migration-scripts/  storefront-bootstrap.ts (seed, runs during db:migrate)
├── Dockerfile            prod image (multi-stage, turbo build)
├── docker-compose.prod.yml  Caddy + Medusa + Postgres (VPS)
├── Caddyfile             TLS reverse proxy for api.yourdailydrip.com
├── .env.example          DEV/PROD env matrix (placeholders only)
└── DEPLOYMENT.md         full VPS deployment + operations guide

storefront/               TanStack Start app (bun + Vite + React), Cloudflare Workers
├── wrangler.toml         worker yourdailydrip-storefront, R2 binding
└── src/
    ├── routes/           file-based TanStack Router routes (routeTree.gen.ts is generated)
    ├── components/       chrome, landing/, product, checkout/, account/, ui/ (shadcn-style)
    └── lib/              medusa.ts SDK client + medusa-*.ts hook modules + store.tsx context

qa/                       captured QA artifacts (Playwright sessions, screenshots, DOM snapshots)
.github/workflows/        deploy-backend.yml + deploy-storefront.yml (deploy-only, no CI tests)
```

## Toolchains - Never Mix

| App | Manager | Lockfile | Key commands |
| --- | --- | --- | --- |
| backend | npm (npm@11.16.0) | `backend/package-lock.json` | `cd backend && npm run dev`, `npm test`, `npm run build` |
| storefront | bun | `storefront/bun.lock` | `cd storefront && bun run dev`, `bun run test:run`, `bun run build` |

Install dependencies inside the app that needs them; never at the repo root (root has no package.json).

## Runtime Topology

```
Browser ── yourdailydrip.com / workers.dev ──▶ Cloudflare Workers (storefront, Nitro cloudflare-module)
Worker SSR reads MEDUSA_BACKEND_URL / MEDUSA_PUBLISHABLE_KEY (Worker secrets, runtime)
Browser reads VITE_* trio (baked at build)
                       ▼
https://api.yourdailydrip.com  (A record → VPS 80.225.196.254)
                       ▼
Caddy :80/:443 (TLS) ──▶ medusa:9000 (internal only) ──▶ postgres:5432 (named volume)
                       ▼
R2 (cdn.yourdailydrip.com) product images · Razorpay webhook → /hooks/payment/razorpay_razorpay
```

Only Caddy publishes host ports. No redis in prod (in-memory cache). No storefront container (Workers).

## CI/CD

Both workflows deploy on push to `main`, path-scoped: `deploy-backend.yml` (SSH to VPS, `docker compose up -d --build`) and `deploy-storefront.yml` (bun build + `wrangler deploy`). Neither runs tests. `db:migrate` is deliberately manual after backend deploys:

```bash
ssh oci
cd ~/yourdailydrip/backend
docker compose -f docker-compose.prod.yml exec -T medusa npx medusa db:migrate
```

`db:migrate` also runs `src/migration-scripts/storefront-bootstrap.ts`, which seeds the India region, warehouse (pincode 400001), iThink shipping options, publishable keys, and the "Rooted Hair Growth Oil" product. Region id: `reg_01KZ1FDN3K5N681SNXFQNA5NM5` (hard-coded in the storefront as REGION_ID).

## Environment

- `backend/.env.example` is the authoritative env matrix. Required at boot or medusa crash-loops: `RAZORPAY_ID/SECRET/ACCOUNT/WEBHOOK_SECRET` and `S3_*` (R2). Prod values live only in `backend/.env` on the VPS.
- Storefront env is public only: `VITE_MEDUSA_BACKEND_URL`, `VITE_MEDUSA_PUBLISHABLE_KEY`, `VITE_RAZORPAY_KEY_ID`. Worker secrets (`MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`) are set via `wrangler secret put`.
- Never commit, print, or copy real secret values.

## Cross-Cutting Invariants

- Prices are INR integers end-to-end (749 = Rs 749). Never divide/multiply.
- Storefront talks to Medusa only through the Medusa JS SDK client in `storefront/src/lib/medusa.ts` - never raw `fetch` (one exception: the iThink rate/track helper calls the backend routes through `sdk.client.fetch`).
- The iThink tracking poll (`*/30 * * * *`) assumes a single Medusa replica - no distributed lock. Do not scale medusa without revisiting it (`ITHINK_POLL_ENABLED=false` on all but one replica).
- Razorpay requires two manual node_modules patches (`apps/backend/patches/*.md`); `patch-package` re-applies them via postinstall. Any `npm ci`/`npm install` reruns it.
- The worktree is intentionally dirty: a large preorder + iThink tracking feature set is uncommitted WIP. Never revert, reset, or checkout files you did not create.

## QA Artifacts

`qa/` holds evidence from manual verification: Playwright session `.yml` files, `.png` screenshots, and `.md` DOM snapshots (Playwright accessibility-tree dumps, not prose). Convention: `<area>-verify-<timestamp>[-<what>].png|md` (e.g. `checkout-verify-2026-08-02T23-28-auth-gate-signup.png`). Keep the convention for new snapshots.

## Off-Limits

- `.env*` (except `.env.example`/`.env.template`), `*.pem` - secrets, never committed
- Build output: `.medusa/`, `dist/`, `.output/`, `.nitro/`, `.wrangler/`, `.turbo/`, `**/public/admin/`
- The root `Caddyfile` entry is a stray empty directory - the real config is `backend/Caddyfile`
- Never rewrite published git history (the storefront is connected to Lovable; see `storefront/AGENTS.md` top block)
- Destructive git commands (`reset --hard`, `checkout --`) and destructive DB commands without explicit user approval
