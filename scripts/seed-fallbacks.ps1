param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$GenerationSecret,

  [ValidateRange(2, 10)]
  [int]$PerDifficulty = 2,

  [ValidateRange(6, 100)]
  [int]$MaxRequests = 36
)

$ErrorActionPreference = "Stop"
$headers = @{
  "x-generation-secret" = $GenerationSecret
  "Content-Type" = "application/json"
}
$url = "https://$ProjectRef.supabase.co/functions/v1/generate-daily-puzzle"

Write-Host "Checking OpenAI configuration and current fallback counts..."
$preflight = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
if (-not $preflight.providerCompatible) {
  throw "OpenAI preflight failed: $($preflight.providerError)"
}

for ($requestNumber = 1; $requestNumber -le $MaxRequests; $requestNumber += 1) {
  if ($preflight.ready) { break }

  Write-Host "Fallback generation request $requestNumber of $MaxRequests..."
  $body = @{ mode = "seed-fallbacks"; perDifficulty = $PerDifficulty } | ConvertTo-Json
  $result = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body

  if ($result.generated) {
    Write-Host "Stored one $($result.difficulty) fallback. Counts: easy=$($result.counts.easy), medium=$($result.counts.medium), hard=$($result.counts.hard)"
  } elseif ($result.error) {
    Write-Warning "Generation did not complete: $($result.error)"
  } else {
    Write-Warning "Candidate was rejected by validation; retrying with a new brief."
    if ($result.issues) { $result.issues | Select-Object -First 3 | ForEach-Object { Write-Warning $_ } }
  }

  if ($result.ready) { break }
  Start-Sleep -Seconds 1
  $preflight = [pscustomobject]@{ ready = $false; providerCompatible = $true }
}

$final = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
$final | Format-List
if (-not $final.ready) {
  throw "Fallback pool is still incomplete. Run this script again; successful rows are preserved."
}

Write-Host "Fallback pool is ready."
