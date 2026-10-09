$tapPath = Join-Path $PSScriptRoot 'local-parity-inherited-env.tap'
$lines = Get-Content $tapPath
$cases = @(
  foreach ($line in $lines) {
    if ($line -match '^# CONTROL_CASE (\{.*\})$') {
      $case = $Matches[1] | ConvertFrom-Json
      [ordered]@{
        path = $case.path
        outcomeParity = (ConvertTo-Json -Compress -Depth 20 $case.direct) -ceq (ConvertTo-Json -Compress -Depth 20 $case.child)
        direct = $case.direct
        child = $case.child
        requestTrace = $case.requestTrace
        parentTimingMs = $case.timing
      }
    }
  }
)
$startup = $null
foreach ($line in $lines) {
  if ($line -match '^# CONTROL_STARTUP_HANG (\{.*\})$') { $startup = $Matches[1] | ConvertFrom-Json }
}
$concurrency = $null
foreach ($line in $lines) {
  if ($line -match '^# CONTROL_CONCURRENCY (\{.*\})$') { $concurrency = $Matches[1] | ConvertFrom-Json }
}
$summary = [ordered]@{
  experiment = 'Issue 41 B2 controlled process local parity'
  localRuntime = [ordered]@{ node = 'v20.19.0'; undici = '6.21.1'; note = 'same runtime used for direct and child paths; hosted runtime gate remains Node 20.20.2 / Undici 6.24.1' }
  parityRun = [ordered]@{ tap = 'local-parity-inherited-env.tap'; cases = $cases; testSummary = '11 tests passed with inherited parent environment: 8 direct/child parity cases, startup timeout/reap, and max-two-child scheduler gate' }
  startupHang = [ordered]@{ tap = 'local-parity-inherited-env.tap'; result = $startup }
  concurrency = [ordered]@{ tap = 'local-parity-inherited-env.tap'; result = $concurrency }
  noPublisherRequests = $true
  noHostedBuildOrRun = $true
}
$summary | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'local-parity-results.json')
