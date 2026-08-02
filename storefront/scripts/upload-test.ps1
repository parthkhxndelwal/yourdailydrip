<#
.SYNOPSIS
    Test upload to yourdailydrip-static R2 bucket and verify public access
.DESCRIPTION
    Creates a small test file, uploads it to the R2 bucket, enables public
    access via r2.dev URL, then verifies the file is accessible.
    Cleans up the test file after verification.
.PARAMETER Profile
    Optional Cloudflare profile name for wrangler
#>
param([string]$Profile = "")

$ErrorActionPreference = "Stop"
$BucketName = "yourdailydrip-static"
$TestFile = "r2-upload-test-$(Get-Random -Maximum 99999).txt"
$TestContent = "YourDailyDrip R2 upload test — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"

$wrangler = "npx wrangler"
if ($Profile) { $wrangler = "$wrangler --profile $Profile" }

function Write-Info  { Write-Host "[INFO]  $args" -ForegroundColor Green }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Ok    { Write-Host "[PASS]  $args" -ForegroundColor Green }
function Write-Fail  { Write-Host "[FAIL]  $args" -ForegroundColor Red }

# ── Create test file ─────────────────────────────────────────────────────────
try {
    $tempPath = [System.IO.Path]::GetTempPath()
    $testFilePath = Join-Path $tempPath $TestFile
    Set-Content -Path $testFilePath -Value $TestContent -NoNewline
    Write-Info "Created test file: $testFilePath"
    Write-Info "  Content: $TestContent"
} catch {
    Write-Error "Failed to create test file: $_"
    exit 1
}

# ── Upload ───────────────────────────────────────────────────────────────────
Write-Info "Uploading to r2://$BucketName/$TestFile ..."
$uploadResult = & cmd /c "$wrangler r2 object put $BucketName/$TestFile --file `"$testFilePath`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Upload failed."
    Write-Error $uploadResult
    Remove-Item $testFilePath -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Ok "Upload succeeded."

# ── Verify object exists ─────────────────────────────────────────────────────
Write-Info "Verifying object in bucket..."
$getResult = & cmd /c "$wrangler r2 object get $BucketName/$TestFile --file `"$testFilePath.downloaded`" 2>&1"
if ($LASTEXITCODE -eq 0) {
    $downloadedContent = Get-Content "$testFilePath.downloaded" -Raw
    if ($downloadedContent.Trim() -eq $TestContent) {
        Write-Ok "Download verified — content matches."
    } else {
        Write-Fail "Content mismatch! Expected '$TestContent', got '$downloadedContent'"
    }
    Remove-Item "$testFilePath.downloaded" -Force -ErrorAction SilentlyContinue
} else {
    Write-Fail "Download failed: $getResult"
}

# ── Try public URL (r2.dev or custom domain) ─────────────────────────────────
Write-Info "Checking public URL..."
$devUrlResult = & cmd /c "$wrangler r2 bucket dev-url list $BucketName 2>&1"
if ($LASTEXITCODE -eq 0) {
    # Try fetching the test file via the dev URL
    $devUrlMatch = [regex]::Match($devUrlResult, '(https?://[^\s]+)')
    if ($devUrlMatch.Success) {
        $baseUrl = $devUrlMatch.Groups[1].Value.Trim()
        $publicUrl = "$baseUrl/$TestFile"
        try {
            $response = Invoke-WebRequest -Uri $publicUrl -Method Get -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Ok "Public URL accessible: $publicUrl"
            } else {
                Write-Warn "Public URL returned status $($response.StatusCode): $publicUrl"
            }
        } catch {
            Write-Warn "Public URL not accessible (may need r2.dev URL enabled): $publicUrl"
        }
    } else {
        Write-Warn "No r2.dev URL found for bucket. Enable via: wrangler r2 bucket dev-url enable $BucketName"
    }
} else {
    Write-Warn "Could not list dev URL. Enable via: wrangler r2 bucket dev-url enable $BucketName"
}

# ── Cleanup ──────────────────────────────────────────────────────────────────
Write-Info "Cleaning up..."
& cmd /c "$wrangler r2 object delete $BucketName/$TestFile 2>&1" | Out-Null
Remove-Item $testFilePath -Force -ErrorAction SilentlyContinue
Write-Info "Test file '$TestFile' deleted from bucket."
Write-Info "Local temp files cleaned."

Write-Info ""
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Ok "Upload test complete."
Write-Host ("═" * 60) -ForegroundColor Cyan
