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
$retryDifficulty = $null
$retrySeed = $null
$retryIssues = @()

Write-Host "Checking OpenAI configuration and current fallback counts..."
$preflight = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
if (-not $preflight.providerCompatible) {
  throw "OpenAI preflight failed: $($preflight.providerError)"
}

for ($requestNumber = 1; $requestNumber -le $MaxRequests; $requestNumber += 1) {
  if ($preflight.ready) { break }

  Write-Host "Fallback generation request $requestNumber of $MaxRequests..."
  $requestBody = @{ mode = "seed-fallbacks"; perDifficulty = $PerDifficulty }
  if ($retrySeed) {
    $requestBody["difficulty"] = $retryDifficulty
    $requestBody["retrySeed"] = $retrySeed
    $requestBody["previousIssues"] = @($retryIssues)
  }
  $body = $requestBody | ConvertTo-Json -Depth 4
  $result = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body

  if ($result.generated) {
    Write-Host "Stored one $($result.difficulty) fallback. Counts: easy=$($result.counts.easy), medium=$($result.counts.medium), hard=$($result.counts.hard)"
    $retryDifficulty = $null
    $retrySeed = $null
    $retryIssues = @()
  } elseif ($result.error) {
    Write-Warning "Generation did not complete: $($result.error)"
    $retryDifficulty = $result.difficulty
    $retrySeed = $result.retrySeed
    $retryIssues = @()
  } else {
    Write-Warning "Candidate was rejected by validation; repairing the same brief on the next request."
    if ($result.issues) { $result.issues | Select-Object -First 3 | ForEach-Object { Write-Warning $_ } }
    $retryDifficulty = $result.difficulty
    $retrySeed = $result.retrySeed
    $retryIssues = @($result.issues)
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
