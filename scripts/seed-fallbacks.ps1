param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$GenerationSecret,

  [ValidateRange(2, 30)]
  [int]$PerDifficulty = 14,

  [ValidateRange(1, 100)]
  [int]$MaxRequests = 100
)

$ErrorActionPreference = "Stop"
$headers = @{
  "x-generation-secret" = $GenerationSecret
  "Content-Type" = "application/json"
}
$url = "https://$ProjectRef.supabase.co/functions/v1/generate-daily-puzzle"
Write-Host "Checking the certified mechanics registry and reserve counts..."
$preflight = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
if (-not $preflight.ready) {
  throw "Daily mechanics registry is not ready. Run pnpm daily:certify and deploy the matching Edge Function."
}
if (-not $preflight.reserveCounts) { throw "Preflight did not return reserveCounts." }

$storyStatus = if ($preflight.storyAvailable) { "configured (provider not checked)" } else { "unavailable; template stories will be used" }
Write-Host "AI story service: $storyStatus"
Write-Host "Certified mechanics registry is ready. Reserve target: $PerDifficulty per difficulty."

for ($requestNumber = 1; $requestNumber -le $MaxRequests; $requestNumber += 1) {
  $counts = $preflight.reserveCounts
  $complete = @("easy", "medium", "hard") | Where-Object { [int]$counts.$_ -lt $PerDifficulty } | Measure-Object | Select-Object -ExpandProperty Count
  if ($complete -eq 0) { break }

  Write-Host "Preparing certified reserve request $requestNumber of $MaxRequests..."
  $body = @{ mode = "prepare-reserve"; perDifficulty = $PerDifficulty } | ConvertTo-Json -Compress
  $result = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
  if ($result.error) { throw "Reserve preparation failed: $($result.error)" }

  $before = $preflight.reserveCounts
  if ($result.counts) {
    $preflight.reserveCounts = $result.counts
  } elseif ($result.reserveCounts) {
    $preflight.reserveCounts = $result.reserveCounts
  } else {
    $preflight = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
    if (-not $preflight.ready) { throw "Daily mechanics registry became unavailable during reserve preparation." }
  }
  $after = $preflight.reserveCounts
  Write-Host "Reserve counts: easy=$($after.easy), medium=$($after.medium), hard=$($after.hard)"
  $madeProgress = @("easy", "medium", "hard") | Where-Object { [int]$after.$_ -gt [int]$before.$_ } | Measure-Object | Select-Object -ExpandProperty Count
  if ($madeProgress -eq 0) {
    throw "Reserve preparation made no progress. Inspect the Edge Function response and try again."
  }
  Start-Sleep -Milliseconds 300
}

$final = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body '{"mode":"preflight"}'
$final | Format-List
if (-not $final.ready) {
  throw "Certified mechanics registry is not ready. Run pnpm daily:certify and deploy the matching Edge Function."
}
foreach ($difficulty in @("easy", "medium", "hard")) {
  if ([int]$final.reserveCounts.$difficulty -lt $PerDifficulty) {
    throw "Reserve is incomplete for $difficulty. Successful reservations are preserved; rerun the helper."
  }
}

Write-Host "Certified daily mechanics reserve is ready."
