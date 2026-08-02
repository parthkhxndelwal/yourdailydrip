# yourdailydrip

Monorepo for the Daily Drip storefront and commerce backend.

## Structure

```
.
├── backend/                  # Medusa v2 commerce backend (npm workspaces + Turborepo)
│   ├── apps/backend/         #   the Medusa app (@dtc/backend)
│   ├── Dockerfile            #   production image (multi-stage, turbo build)
│   ├── docker-compose.prod.yml  #   Caddy + Medusa + Postgres (VPS)
│   ├── Caddyfile             #   TLS reverse proxy for api.yourdailydrip.com
│   ├── .env.example          #   DEV/PROD env matrix (placeholders only)
│   └── DEPLOYMENT.md         #   full VPS deployment + operations guide
├── storefront/               # storefront (bun + Vite + TanStack, Cloudflare Workers)
│   ├── wrangler.toml         #   Workers config (yourdailydrip-storefront)
│   └── src/                  #   TanStack app + Medusa SDK data layer
├── qa/                       # captured QA artifacts (Playwright session files, screenshots)
└── .github/workflows/        # CI/CD (see below)
```

The two apps keep independent toolchains on purpose: `backend/` is an npm
workspace root (its Docker build context and lockfile must stay intact),
`storefront/` is a bun project with its own lockfile. The repo root is a git
container + CI only — it has no package.json.

## CI/CD — deploy on PR merge to `main`

Both workflows trigger on `push` to `main` (i.e. every merged PR), scoped by
path so backend-only and storefront-only changes deploy only what changed.

| Workflow | What it deploys | Where |
| --- | --- | --- |
| `deploy-backend.yml` | Medusa backend (`docker compose up -d --build`) | VPS via SSH (`~/yourdailydrip`) |
| `deploy-storefront.yml` | Storefront (`wrangler deploy`) | Cloudflare Workers |

`db:migrate` is intentionally **not** in CI — run it manually after a deploy:

```bash
ssh oci
cd ~/yourdailydrip/backend
docker compose -f docker-compose.prod.yml exec -T medusa npx medusa db:migrate
```

### Required GitHub secrets

| Secret | Used by | How to get it |
| --- | --- | --- |
| `VPS_HOST` | backend | VPS IP (`80.225.196.254`) |
| `VPS_USER` | backend | SSH user (`opc`) |
| `VPS_SSH_KEY` | backend | dedicated deploy key (private key; pubkey is in the VPS `authorized_keys`) |
| `CLOUDFLARE_API_TOKEN` | storefront | Cloudflare dashboard → My Profile → API Tokens (edit Workers + R2; until set, the storefront deploy step skips) |
| `CLOUDFLARE_ACCOUNT_ID` | storefront | Cloudflare dashboard → right sidebar (account ID) |

### First-run on the VPS (one-time, manual)

1. `git clone https://github.com/parthkhxndelwal/yourdailydrip.git ~/yourdailydrip`
2. `cp backend/.env.example backend/.env` and fill real values — see
   [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) sections 4-7. `RAZORPAY_*`
   are required or the medusa container crash-loops at boot.
3. Set the three storefront Worker secrets (public config only):
   ```bash
   cd storefront
   npx wrangler secret put MEDUSA_BACKEND_URL        # https://api.yourdailydrip.com
   npx wrangler secret put MEDUSA_PUBLISHABLE_KEY    # prod key from the Medusa admin
   npx wrangler secret put RAZORPAY_KEY_ID           # Razorpay key id (public)
   ```

## Local development

- Backend: `cd backend && npm run dev` (admin at http://localhost:9000/app)
- Storefront: `cd storefront && bun run dev` (http://localhost:5173)
- Backend needs its own Postgres; see `backend/.env.example` and DEPLOYMENT.md.
