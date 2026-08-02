#!/usr/bin/env bash
# =============================================================================
# upload-test.sh — Test upload to yourdailydrip-static R2 bucket + verify
#
# Creates a timestamped test file, uploads it, verifies it can be downloaded
# back, attempts public URL access, then cleans up.
#
# Usage:
#   ./scripts/upload-test.sh [--profile <profile-name>]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUCKET_NAME="yourdailydrip-static"
TEST_FILE="r2-upload-test-$$.txt"
TEST_CONTENT="YourDailyDrip R2 upload test — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# ── Color helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
pass()  { echo -e "${GREEN}[PASS]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

WRANGLER="npx wrangler"
[ $# -ge 2 ] && [ "$1" = "--profile" ] && WRANGLER="npx wrangler --profile $2"

cleanup() {
    info "Cleaning up..."
    $WRANGLER r2 object delete "$BUCKET_NAME/$TEST_FILE" 2>/dev/null || true
    rm -f "/tmp/$TEST_FILE" "/tmp/$TEST_FILE.downloaded"
    info "Test file '$TEST_FILE' deleted from bucket."
    info "Local temp files cleaned."
}
trap cleanup EXIT

# ── Create test file ─────────────────────────────────────────────────────────
echo "$TEST_CONTENT" > "/tmp/$TEST_FILE"
info "Created test file: /tmp/$TEST_FILE"
info "  Content: $TEST_CONTENT"

# ── Pre-flight: auth check ───────────────────────────────────────────────────
if ! $WRANGLER whoami &>/dev/null; then
    fail "Not authenticated. Set CLOUDFLARE_API_TOKEN or run 'wrangler login'."
    exit 1
fi

# ── Upload ───────────────────────────────────────────────────────────────────
info "Uploading to r2://$BUCKET_NAME/$TEST_FILE ..."
if $WRANGLER r2 object put "$BUCKET_NAME/$TEST_FILE" --file "/tmp/$TEST_FILE" 2>&1; then
    pass "Upload succeeded."
else
    fail "Upload failed."
    exit 1
fi

# ── Verify object exists via download ────────────────────────────────────────
info "Verifying object in bucket..."
if $WRANGLER r2 object get "$BUCKET_NAME/$TEST_FILE" --file "/tmp/$TEST_FILE.downloaded" 2>&1; then
    DOWNLOADED=$(cat "/tmp/$TEST_FILE.downloaded")
    if [ "$DOWNLOADED" = "$TEST_CONTENT" ]; then
        pass "Download verified — content matches."
    else
        fail "Content mismatch!"
        echo "  Expected: $TEST_CONTENT"
        echo "  Got:      $DOWNLOADED"
    fi
else
    fail "Download failed."
    exit 1
fi

# ── Try public URL ───────────────────────────────────────────────────────────
info "Checking public URL..."
DEV_URL=$($WRANGLER r2 bucket dev-url list "$BUCKET_NAME" 2>/dev/null || true)
if [ -n "$DEV_URL" ]; then
    BASE_URL=$(echo "$DEV_URL" | grep -oE 'https?://[^ ]+' | head -1)
    if [ -n "$BASE_URL" ]; then
        PUBLIC_URL="$BASE_URL/$TEST_FILE"
        if HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PUBLIC_URL" 2>/dev/null); then
            if [ "$HTTP_STATUS" = "200" ]; then
                pass "Public URL accessible: $PUBLIC_URL"
            else
                warn "Public URL returned HTTP $HTTP_STATUS: $PUBLIC_URL"
            fi
        else
            warn "Public URL not reachable: $PUBLIC_URL"
        fi
    fi
else
    warn "No r2.dev URL found. Enable: wrangler r2 bucket dev-url enable $BUCKET_NAME"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
pass "Upload test complete."
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
