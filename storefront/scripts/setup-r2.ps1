<#
.SYNOPSIS
    Create and configure the yourdailydrip-static R2 bucket
.DESCRIPTION
    Sets up the Cloudflare R2 bucket for static assets (product images, blog
    media, build outputs). Idempotent - safe to re-run.
.PARAMETER Profile
    Optional Cloudflare profile name for wrangler
.EXAMPLE
    .\scripts\setup-r2.ps1
    .\scripts\setup-r2.ps1 -Profile "production"
#>
param([string]$Profile = "")

$ErrorActionPreference = "Stop"
$BucketName = "yourdailydrip-static"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$CorsFile = Join-Path $ProjectDir "r2-cors.json"

function Write-Info  { Write-Host "[INFO]  $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "[WARN]  $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

# ── Pre-flight checks ────────────────────────────────────────────────────────
$wrangler = "npx wrangler"
if ($Profile) { $wrangler = "$wrangler --profile $Profile" }

try { Invoke-Expression "$wrangler --version" | Out-Null }
catch {
    Write-Error "wrangler CLI not found. Install: npm install -g wrangler"
    exit 1
}
Write-Info "wrangler CLI available."

# ── Step 1: Check auth ───────────────────────────────────────────────────────
Write-Info "Checking Cloudflare auth..."
$whoami = & cmd /c "$wrangler whoami 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not authenticated. Set CLOUDFLARE_API_TOKEN or run 'wrangler login'."
    Write-Error "Details: $whoami"
    exit 1
}
Write-Info "Authenticated."

# ── Step 2: Create bucket (idempotent) ──────────────────────────────────────
Write-Info "Creating bucket '$BucketName' (no-op if exists)..."
$createResult = & cmd /c "$wrangler r2 bucket create $BucketName 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Info "Bucket '$BucketName' created or already exists."
} else {
    Write-Warn "Bucket creation returned exit $LASTEXITCODE (may already exist). Continuing..."
    Write-Warn $createResult
}

# ── Step 3: Apply CORS policy ───────────────────────────────────────────────
if (Test-Path $CorsFile) {
    Write-Info "Applying CORS policy from $CorsFile..."
    & cmd /c "$wrangler r2 bucket cors set $BucketName --file `"$CorsFile`" --force 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Info "CORS policy applied."
    } else {
        Write-Error "CORS policy application failed."
        exit 1
    }
} else {
    Write-Warn "CORS file not found at $CorsFile — skipping CORS configuration."
}

# ── Step 4: Verify ───────────────────────────────────────────────────────────
Write-Info "Verifying bucket exists..."
$bucketList = & cmd /c "$wrangler r2 bucket list 2>&1"
if ($bucketList -match $BucketName) {
    Write-Info "✓ Bucket '$BucketName' confirmed in bucket list."
} else {
    Write-Warn "Bucket not found in list — check permissions."
}

Write-Info "Verifying CORS policy..."
& cmd /c "$wrangler r2 bucket cors list $BucketName 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Info "✓ CORS policy confirmed."
} else {
    Write-Warn "Could not list CORS policy."
}

Write-Info ""
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Info "  R2 bucket setup complete for: $BucketName"
Write-Info "  Next step: .\scripts\upload-assets.ps1 to upload product images"
Write-Host ("═" * 60) -ForegroundColor Cyan
