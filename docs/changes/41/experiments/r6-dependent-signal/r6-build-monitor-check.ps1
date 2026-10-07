Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'r6-build-monitor.psm1') -Force

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw "$Message (actual='$Actual', expected='$Expected')" }
}

function New-BuildJson([string]$StartedAt, [string]$Status = 'RUNNING', [string]$Id = 'build-r6-test') {
  $escapedStartedAt = $StartedAt.Replace('\', '\\').Replace('"', '\"')
  return "{`"data`":{`"id`":`"$Id`",`"status`":`"$Status`",`"startedAt`":`"$escapedStartedAt`"}}"
}

function New-Utc([string]$Value) {
  return [DateTimeOffset]::Parse($Value, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-TestDecision($State, [string]$FreshStatusJson, [DateTimeOffset]$LocalUtcNow, [double]$MonotonicElapsedSeconds, $FreshStatusReceivedUtc = $null) {
  if ($null -eq $FreshStatusReceivedUtc) { $FreshStatusReceivedUtc = $LocalUtcNow }
  $elapsedTicks = [long][Math]::Round($MonotonicElapsedSeconds * [double][System.Diagnostics.Stopwatch]::Frequency)
  $monotonicTimestamp = [long]$State.Clock.StartTimestamp + $elapsedTicks
  return Get-R6BuildMonitorAction -State $State -FreshStatusJson $FreshStatusJson -FreshStatusReceivedUtc $FreshStatusReceivedUtc -LocalUtcNow $LocalUtcNow -MonotonicTimestamp $monotonicTimestamp
}

$originalCulture = [System.Threading.Thread]::CurrentThread.CurrentCulture
$originalUiCulture = [System.Threading.Thread]::CurrentThread.CurrentUICulture
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::GetCultureInfo('en-GB')
[System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::GetCultureInfo('en-GB')

$receipt = New-Utc '2026-10-07T20:04:21.500Z'
$start = '2026-10-07T20:04:21.456Z'
$postResponseJson = New-BuildJson $start 'READY'
$parsedFields = Get-R6BuildFields -Json $postResponseJson
Assert-Equal ($parsedFields.startedAt -is [string]) $true 'System.Text.Json keeps startedAt as a string under en-GB'
$state = New-R6BuildMonitorState -PostResponseJson $postResponseJson -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
Assert-Equal $state.Valid $true 'ISO timestamp stays a string and creates a valid anchor'
Assert-Equal $state.StartedAtUtc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [System.Globalization.CultureInfo]::InvariantCulture) '2026-10-07T20:04:21.456Z' 'Strict UTC parsing avoids locale reinterpretation'

$offset = ConvertFrom-R6StrictTimestamp '2026-10-07T21:04:21.456+01:00'
Assert-Equal $offset.Valid $true 'Explicit non-UTC offsets parse invariantly'
Assert-Equal $offset.Utc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [System.Globalization.CultureInfo]::InvariantCulture) '2026-10-07T20:04:21.456Z' 'Offset timestamp normalizes to the same UTC instant'

foreach ($invalid in @('10/07/2026 20:04:21', '2026-10-07T20:04:21', '2026-02-30T20:04:21Z', '')) {
  Assert-Equal (ConvertFrom-R6StrictTimestamp $invalid).Valid $false "Reject ambiguous, missing-offset, invalid-date, or empty timestamp '$invalid'"
}
Assert-Equal (ConvertFrom-R6StrictTimestamp $null).Valid $false 'Reject a non-string timestamp'

$ambiguousState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson '10/07/2026 20:04:21' 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
Assert-Equal $ambiguousState.Valid $false 'Ambiguous parsed text cannot arm an abort guard'
$futureState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson '2026-10-07T20:04:40Z' 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
Assert-Equal $futureState.Valid $false 'Future anchor cannot arm an abort guard'
$staleState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson '2026-10-07T20:00:00Z' 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
Assert-Equal $staleState.Valid $false 'Stale anchor cannot arm an abort guard'
$missingState = New-R6BuildMonitorState -PostResponseJson '{"data":{"id":"build-r6-test","status":"READY","startedAt":null}}' -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
Assert-Equal $missingState.Valid $false 'Missing start time cannot arm an abort guard'

Assert-Equal $state.Clock.Valid $true 'State binds its monotonic clock to a fresh successful POST receipt'
Assert-Equal $state.Clock.PostResponseReceivedUtc $receipt 'Monotonic clock preserves the receipt event it is guarding'
$delayedInitState = New-R6BuildMonitorState -PostResponseJson $postResponseJson -PostResponseReceivedUtc $receipt -LocalUtcNow ($receipt.AddSeconds(6))
Assert-Equal $delayedInitState.Valid $false 'A late monitor initialization cannot start a fresh 120-second guard'

$at119 = $receipt.AddSeconds(119.9)
$decision = Get-TestDecision -State $state -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow $at119 -MonotonicElapsedSeconds 119.9
Assert-Equal $decision.Action 'Wait' 'No abort occurs before 120 monotonic seconds'
$at120 = $receipt.AddSeconds(120)
$decision = Get-TestDecision -State $state -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120
Assert-Equal $decision.Action 'AbortOnce' 'A fresh nonterminal status at the guard returns exactly one abort action'
Assert-Equal $state.AbortLatched $true 'The abort action is latched before the caller can issue it'
$decision = Get-TestDecision -State $state -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow ($receipt.AddSeconds(121)) -MonotonicElapsedSeconds 120.5
Assert-Equal $decision.Action 'ObserveAfterAbort' 'A latched abort is never requested a second time'
$decision = Get-TestDecision -State $state -FreshStatusJson (New-BuildJson $start 'ABORTED') -LocalUtcNow ($receipt.AddSeconds(122)) -MonotonicElapsedSeconds 121
Assert-Equal $decision.Action 'TerminalAfterAbort' 'Terminal state is detected during post-abort observation'

$terminalState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
$decision = Get-TestDecision -State $terminalState -FreshStatusJson (New-BuildJson $start 'SUCCEEDED') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120
Assert-Equal $decision.Action 'Terminal' 'Terminal status at the guard is handled before abort'
Assert-Equal $terminalState.AbortLatched $false 'Terminal build never triggers an abort'

$mismatchState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
$decision = Get-TestDecision -State $mismatchState -FreshStatusJson (New-BuildJson $start 'RUNNING' 'different-build-id') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120
Assert-Equal $decision.Action 'Hold' 'Fresh status for a different build id fails closed'
Assert-Equal $mismatchState.AbortLatched $false 'Mismatched build id never triggers automatic abort'

$mismatchState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
$decision = Get-TestDecision -State $mismatchState -FreshStatusJson (New-BuildJson '2026-10-07T20:04:10Z' 'RUNNING') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120
Assert-Equal $decision.Action 'Hold' 'Conflicting fresh server anchor fails closed'
Assert-Equal $mismatchState.AbortLatched $false 'Conflicting anchor never triggers automatic abort'

$staleResponseState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
$decision = Get-TestDecision -State $staleResponseState -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120 -FreshStatusReceivedUtc ($receipt.AddSeconds(114))
Assert-Equal $decision.Action 'Hold' 'Stale status response fails closed at the abort boundary'
Assert-Equal $staleResponseState.AbortLatched $false 'Stale status response never triggers automatic abort'

$futureResponseState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
$decision = Get-TestDecision -State $futureResponseState -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120 -FreshStatusReceivedUtc ($receipt.AddSeconds(126))
Assert-Equal $decision.Action 'Hold' 'Future status-response receipt fails closed'
Assert-Equal $futureResponseState.AbortLatched $false 'Future status-response receipt never triggers automatic abort'

$clockRegressionState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
[void](Get-TestDecision -State $clockRegressionState -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow ($receipt.AddSeconds(30)) -MonotonicElapsedSeconds 30)
$decision = Get-TestDecision -State $clockRegressionState -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow ($receipt.AddSeconds(29)) -MonotonicElapsedSeconds 29
Assert-Equal $decision.Action 'Hold' 'Monotonic regression fails closed without abort'
Assert-Equal $clockRegressionState.AbortLatched $false 'Monotonic regression never triggers automatic abort'

$boundedState = New-R6BuildMonitorState -PostResponseJson (New-BuildJson $start 'READY') -PostResponseReceivedUtc $receipt -LocalUtcNow $receipt
[void](Get-TestDecision -State $boundedState -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow $at120 -MonotonicElapsedSeconds 120)
$decision = Get-TestDecision -State $boundedState -FreshStatusJson (New-BuildJson $start 'RUNNING') -LocalUtcNow ($receipt.AddSeconds(240)) -MonotonicElapsedSeconds 240
Assert-Equal $decision.Action 'HoldAfterAbortObservationLimit' 'One 120-second post-abort observation ends in Hold without another abort'

[System.Threading.Thread]::CurrentThread.CurrentCulture = $originalCulture
[System.Threading.Thread]::CurrentThread.CurrentUICulture = $originalUiCulture
Write-Output 'R6_BUILD_MONITOR_CHECK_RESULT {"caseGroups":"strict timestamp parsing, en-GB JSON string preservation, successful-POST-receipt-bound monotonic clock, stale guard initialization, anchor and build-ID validation, fresh-status validation, terminal-before-abort, one latched abort, bounded post-abort observation, monotonic regression","networkRequests":0,"actorApiRequests":0,"builds":0,"runs":0,"abortRequests":0,"testCulture":"en-GB","localeSensitiveDateConversion":false,"monotonicGuardSeconds":120,"postAbortObservationSeconds":120,"result":"PASS"}'
