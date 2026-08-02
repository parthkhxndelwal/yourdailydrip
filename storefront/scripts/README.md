# Storefront Scripts

| Script | Purpose | Prerequisites |
|--------|---------|---------------|
| `setup-r2.sh` / `setup-r2.ps1` | Create `yourdailydrip-static` bucket + apply CORS | wrangler CLI, Cloudflare auth |
| `upload-test.sh` / `upload-test.ps1` | Test upload/download/cleanup cycle | wrangler CLI, Cloudflare auth, bucket exists |
| `setup-secrets.sh` / `setup-secrets.ps1` | Set Workers secrets (MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY, RAZORPAY_KEY_ID) | wrangler CLI, Cloudflare auth, worker deployed, env vars set |

## Setup order

```bash
# 0. Build and deploy the Worker first (required before secrets can be set)
bun run build
npx wrangler deploy

# 1. Set required secrets (after export or .env load)
./scripts/setup-secrets.sh

# 2. Set up R2 bucket (one-time)
./scripts/setup-r2.sh

# 3. Verify with a test upload
./scripts/upload-test.sh
```

## Local development

Secrets for local dev go in `.dev.vars` at the project root (excluded from git):

```env
# storefront/.dev.vars (public runtime config only — backend-only secrets
# such as RAZORPAY_SECRET / DATABASE_URL / JWT_SECRET never belong here)
MEDUSA_BACKEND_URL=http://localhost:9000
MEDUSA_PUBLISHABLE_KEY=pk_xxx
RAZORPAY_KEY_ID=rzp_test_xxx
```

Wrangler reads `.dev.vars` automatically when running `wrangler dev` or `wrangler deploy --dry-run`.

For the production client build, set the VITE_* equivalents
(`VITE_MEDUSA_BACKEND_URL`, `VITE_MEDUSA_PUBLISHABLE_KEY`, `VITE_RAZORPAY_KEY_ID`)
in the build environment — see `.env.example` and `wrangler.toml`.
```
