# =============================================================================
# Cloudflare Workers Secrets Setup (PowerShell)
# =============================================================================
# Sets required secrets for the yourdailydrip-storefront Worker on Cloudflare.
#
# Usage:
#   $env:MEDUSA_BACKEND_URL = "https://api.yourdailydrip.com"
#   $env:MEDUSA_PUBLISHABLE_KEY = "pk_..."
#   $env:RAZORPAY_KEY_ID = "rzp_live_..."
#   .\scripts\setup-secrets.ps1
#
# Or load from a .env file:
#   Get-Content .env | ForEach-Object {
#     if ($_ -match '^([^#=]+)=(.+)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2]) }
#   }
#   .\scripts\setup-secrets.ps1
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

$ErrorActionPreference = "Stop"
$WorkerName = "yourdailydrip-storefront"
$Secrets = @(
  "MEDUSA_BACKEND_URL"
  "MEDUSA_PUBLISHABLE_KEY"
  "RAZORPAY_KEY_ID"
)

Write-Host "==> Setting secrets for Worker: $WorkerName" -ForegroundColor Cyan
Write-Host ""

$missing = 0
foreach ($secret in $Secrets) {
  $value = [Environment]::GetEnvironmentVariable($secret)
  if ([string]::IsNullOrEmpty($value)) {
    Write-Host "  [SKIP] $secret — env var not set" -ForegroundColor Yellow
    $missing++
    continue
  }
  Write-Host "  [SET]  $secret" -ForegroundColor Green
  $value | npx wrangler secret put $secret --name $WorkerName 2>&1 | ForEach-Object { "         $_" }
}

Write-Host ""
if ($missing -gt 0) {
  Write-Host "==> Done ($missing secrets skipped — set the missing env vars and re-run)" -ForegroundColor Yellow
} else {
  Write-Host "==> All secrets set successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "To verify: npx wrangler secret list --name $WorkerName" -ForegroundColor Gray
