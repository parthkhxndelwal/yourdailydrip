#!/usr/bin/env bash
# =============================================================================
# setup-r2.sh — Create and configure the yourdailydrip-static R2 bucket
#
# Prerequisites:
#   1. wrangler CLI installed (npm i -g wrangler or via package.json)
#   2. CLOUDFLARE_API_TOKEN set (or wrangler login run)
#   3. jq installed for JSON manipulation (optional, fallback to wrangler)
#
# Usage:
#   ./scripts/setup-r2.sh [--profile <profile-name>]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUCKET_NAME="yourdailydrip-static"

# ── Color helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
if ! command -v wrangler &>/dev/null && ! npx wrangler --version &>/dev/null; then
    error "wrangler CLI not found. Install: npm install -g wrangler"
    exit 1
fi

WRANGLER="npx wrangler"
[ $# -ge 2 ] && [ "$1" = "--profile" ] && WRANGLER="npx wrangler --profile $2"

# ── Step 1: Check auth ───────────────────────────────────────────────────────
info "Checking Cloudflare auth..."
if ! $WRANGLER whoami &>/dev/null; then
    error "Not authenticated. Set CLOUDFLARE_API_TOKEN or run 'wrangler login'."
    exit 1
fi
info "Authenticated."

# ── Step 2: Create bucket (idempotent) ──────────────────────────────────────
info "Creating bucket '$BUCKET_NAME' (no-op if exists)..."
if $WRANGLER r2 bucket create "$BUCKET_NAME" 2>&1; then
    info "Bucket '$BUCKET_NAME' created or already exists."
else
    warn "Bucket creation may have failed (may already exist). Continuing..."
fi

# ── Step 3: Apply CORS policy ───────────────────────────────────────────────
CORS_FILE="$PROJECT_DIR/r2-cors.json"
if [ -f "$CORS_FILE" ]; then
    info "Applying CORS policy from $CORS_FILE..."
    $WRANGLER r2 bucket cors set "$BUCKET_NAME" --file "$CORS_FILE" --force
    info "CORS policy applied."
else
    warn "CORS file not found at $CORS_FILE — skipping CORS configuration."
fi

# ── Step 4: Verify ───────────────────────────────────────────────────────────
info "Verifying bucket exists..."
$WRANGLER r2 bucket list 2>&1 | grep -q "$BUCKET_NAME" && \
    info "✓ Bucket '$BUCKET_NAME' confirmed in bucket list." || \
    warn "Bucket not found in list — check permissions."

info "Verifying CORS policy..."
$WRANGLER r2 bucket cors list "$BUCKET_NAME" 2>&1 && \
    info "✓ CORS policy confirmed." || \
    warn "Could not list CORS policy (bucket may not have one set yet)."

info ""
info "══════════════════════════════════════════════════════════════════"
info "  R2 bucket setup complete for: $BUCKET_NAME"
info "  Next step: ./scripts/upload-assets.sh to upload product images"
info "══════════════════════════════════════════════════════════════════"
