#!/usr/bin/env bash
# =============================================================================
# Cloudflare Workers Secrets Setup
# =============================================================================
# Sets required secrets for the yourdailydrip-storefront Worker on Cloudflare.
#
# Usage:
#   chmod +x scripts/setup-secrets.sh
#   export MEDUSA_BACKEND_URL="https://api.yourdailydrip.com"
#   export MEDUSA_PUBLISHABLE_KEY="pk_..."
#   export RAZORPAY_KEY_ID="rzp_live_..."
#   ./scripts/setup-secrets.sh
#
# Or load from a .env file (not tracked in git):
#   set -a; source .env; set +a
#   ./scripts/setup-secrets.sh
#
# Prerequisites:
#   - wrangler CLI (installed via npm/bun)
#   - Logged in to Cloudflare via `wrangler login`
#   - Worker already deployed once (wrangler deploy)
#
# NOTE: For local development use .dev.vars instead (excluded from git).
# Only PUBLIC config belongs here (see wrangler.toml). Backend-only secrets —
# RAZORPAY_SECRET, RAZORPAY_WEBHOOK_SECRET, DATABASE_URL, JWT_SECRET,
# COOKIE_SECRET, ITHINK_* — stay on the Medusa VPS, never on the Worker.
# =============================================================================

set -euo pipefail

WORKER_NAME="yourdailydrip-storefront"
SECRETS=(
  "MEDUSA_BACKEND_URL"
  "MEDUSA_PUBLISHABLE_KEY"
  "RAZORPAY_KEY_ID"
)

echo "==> Setting secrets for Worker: $WORKER_NAME"
echo ""

MISSING=0
for secret in "${SECRETS[@]}"; do
  if [ -z "${!secret:-}" ]; then
    echo "  [SKIP] $secret — env var not set"
    MISSING=$((MISSING + 1))
    continue
  fi
  echo "  [SET]  $secret"
  echo "${!secret}" | npx wrangler secret put "$secret" --name "$WORKER_NAME" 2>&1 | sed 's/^/         /'
done

echo ""
if [ "$MISSING" -gt 0 ]; then
  echo "==> Done ($MISSING secrets skipped — set the missing env vars and re-run)"
else
  echo "==> All secrets set successfully"
fi

echo ""
echo "To verify: npx wrangler secret list --name $WORKER_NAME"
