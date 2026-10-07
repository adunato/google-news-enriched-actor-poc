$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'r6-build-operator.ps1')
$freq = [double][System.Diagnostics.Stopwatch]::Frequency
function Assert([bool]$ok,[string]$message) { if (-not $ok) { throw $message } }
function New-EvidencePath { Join-Path $env:TEMP ('r6-operator-check-' + [guid]::NewGuid().ToString('N') + '.jsonl') }
function Read-Evidence([string]$path) { Get-Content -LiteralPath $path | ForEach-Object { ConvertFrom-Json -InputObject $_ } }
$anchor = [DateTimeOffset]::Parse('2026-10-07T12:00:00Z')
$started = '2026-10-07T12:00:00Z'
$bodyPost = (@{ id='build-a'; status='READY'; startedAt=$started } | ConvertTo-Json -Compress)
$bodyDone = (@{ id='build-a'; status='SUCCEEDED'; startedAt=$started } | ConvertTo-Json -Compress)

# Terminal-first path: one build POST and no abort.
$counts = @{ post=0; get=0; abort=0 }
$evidence = New-EvidencePath
$t = @{
  PostBuild = { $counts.post++; [pscustomobject]@{StatusCode=201;Body=$bodyPost} }
  GetBuild = { param($id,$timeout) $counts.get++; [pscustomobject]@{StatusCode=200;Body=$bodyDone} }
  AbortBuild = { param($id) $counts.abort++; [pscustomobject]@{StatusCode=200;Body='{}'} }
}
$done = Invoke-R6BuildGuarded -PostBuild $t.PostBuild -GetBuild $t.GetBuild -AbortBuild $t.AbortBuild -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 1000 }
Assert ($done.Outcome -eq 'SUCCEEDED' -and $counts.post -eq 1 -and $counts.get -eq 1 -and $counts.abort -eq 0) 'Terminal-first case failed'
$records = @(Read-Evidence $evidence)
Assert ($records.Count -eq 2 -and $records[0].rawBody -ceq $bodyPost -and $records[1].event -eq 'build-status') 'Raw POST/status evidence was not preserved'
Remove-Item -LiteralPath $evidence -Force

# Evidence path failure must prevent POST.
$badCounts = @{ post=0 }
$missingDirPath = Join-Path $env:TEMP ('missing-r6-dir-' + [guid]::NewGuid().ToString('N') + '\evidence.jsonl')
$noWrite = Invoke-R6BuildGuarded -PostBuild { $badCounts.post++; [pscustomobject]@{StatusCode=201;Body=$bodyPost} } -GetBuild { param($id,$timeout) } -AbortBuild { param($id) } -EvidenceLogPath $missingDirPath -UtcNow { $anchor } -MonotonicNow { 2000 }
Assert ($noWrite.Outcome -eq 'Hold' -and $badCounts.post -eq 0) 'Evidence preflight failure did not prevent POST'

# Ambiguous localized timestamp fails closed.
$evidence = New-EvidencePath
$bad = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body='{"id":"build-b","status":"READY","startedAt":"10/07/2026 12:00:00"}'} } -GetBuild { param($id,$timeout) throw 'must not GET' } -AbortBuild { param($id) throw 'must not abort' } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 2000 }
Assert ($bad.Outcome -eq 'Hold' -and (@(Read-Evidence $evidence)[0].rawBody -match '10/07/2026') ) 'Ambiguous timestamp did not Hold with raw POST'
Remove-Item -LiteralPath $evidence -Force

# Malformed successful POST is persisted before parse and fails closed.
$evidence = New-EvidencePath
$malformedPostRaw = '{"id":'
$malformedPost = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body=$malformedPostRaw} } -GetBuild { param($id,$timeout) throw 'must not GET' } -AbortBuild { param($id) throw 'must not abort' } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 3000 }
Assert ($malformedPost.Outcome -eq 'Hold' -and (@(Read-Evidence $evidence)[0].rawBody -ceq $malformedPostRaw)) 'Malformed POST was not retained before Hold'
Remove-Item -LiteralPath $evidence -Force

# Non-2xx response is captured; no GET or retry.
$evidence = New-EvidencePath
$non2xxCount = @{ post=0 }
$non2xx = Invoke-R6BuildGuarded -PostBuild {  $non2xxCount.post++; [pscustomobject]@{StatusCode=503;Body='service unavailable'} } -GetBuild { param($id,$timeout) throw 'must not GET' } -AbortBuild { param($id) throw 'must not abort' } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 4000 }
Assert ($non2xx.Outcome -eq 'Hold' -and $non2xxCount.post -eq 1 -and (@(Read-Evidence $evidence)[0].statusCode -eq 503)) 'Non-2xx POST handling failed'
Remove-Item -LiteralPath $evidence -Force

# A malformed successful GET is logged and becomes Hold, never abort.
$evidence = New-EvidencePath
$malGetCounts = @{ get=0; abort=0 }
$malformedGet = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body=$bodyPost} } -GetBuild { param($id,$timeout) $malGetCounts.get++; [pscustomobject]@{StatusCode=200;Body='{' } } -AbortBuild { param($id) $malGetCounts.abort++; [pscustomobject]@{StatusCode=200;Body='{}'} } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 5000 }
Assert ($malformedGet.Outcome -eq 'Hold' -and $malGetCounts.get -eq 1 -and $malGetCounts.abort -eq 0 -and (@(Read-Evidence $evidence)[-1].rawBody -ceq '{') ) 'Malformed GET did not Hold safely'
Remove-Item -LiteralPath $evidence -Force

# Transport failure returns Hold without a retry or abort.
$evidence = New-EvidencePath
$postCalls = @{ post=0 }
$transportFailure = Invoke-R6BuildGuarded -PostBuild {  $postCalls.post++; throw 'synthetic transport failure' } -GetBuild { param($id,$timeout) throw 'must not GET' } -AbortBuild { param($id) throw 'must not abort' } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 6000 }
Assert ($transportFailure.Outcome -eq 'Hold' -and $postCalls.post -eq 1 -and (@(Read-Evidence $evidence)[0].event -eq 'build-post-transport-error')) 'POST transport failure did not Hold once'
Remove-Item -LiteralPath $evidence -Force

# Reach 120 seconds, request one abort, then simulate a failed abort response.
$evidence = New-EvidencePath
$fakeNow = $anchor; $ticks = 7000L; $guardCounts = @{ abort=0; get=0; sleep=0 }
$pending = (@{id='build-c';status='BUILDING';startedAt=$started} | ConvertTo-Json -Compress)
$timed = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body=(@{id='build-c';status='READY';startedAt=$started}|ConvertTo-Json -Compress)} } -GetBuild { param($id,$timeout) $guardCounts.get++; [pscustomobject]@{StatusCode=200;Body=$pending} } -AbortBuild { param($id) $guardCounts.abort++; [pscustomobject]@{StatusCode=503;Body='abort unavailable'} } -EvidenceLogPath $evidence -UtcNow { $fakeNow } -MonotonicNow { $ticks } -Sleep { param($s) $guardCounts.sleep++; $script:ticks += [long]($s*$freq); $script:fakeNow=$script:fakeNow.AddSeconds($s) }
Assert ($timed.Outcome -eq 'Hold' -and $guardCounts.abort -eq 1 -and $timed.AbortCount -eq 1 -and $guardCounts.sleep -eq 12) 'Abort failure caused retry or incorrect guard count'
Remove-Item -LiteralPath $evidence -Force

# Near the post-abort deadline: GET timeout and sleep are clamped; no GET starts at 120s.
$evidence = New-EvidencePath
$fakeNow = $anchor; $ticks = 9000L; $getTimeouts = [System.Collections.Generic.List[int]]::new(); $sleepDurations = [System.Collections.Generic.List[int]]::new(); $nearCounts = @{ abort=0; get=0 }
$pendingD = (@{id='build-d';status='BUILDING';startedAt=$started} | ConvertTo-Json -Compress)
$bounded = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body=(@{id='build-d';status='READY';startedAt=$started}|ConvertTo-Json -Compress)} } -GetBuild {
  param($id,$timeout) $nearCounts.get++; $getTimeouts.Add([int]$timeout)
  [pscustomobject]@{StatusCode=200;Body=$pendingD}
} -AbortBuild {
  param($id) $nearCounts.abort++; $script:ticks += [long](119*$freq); $script:fakeNow=$script:fakeNow.AddSeconds(119)
  [pscustomobject]@{StatusCode=200;Body='{}'}
} -EvidenceLogPath $evidence -UtcNow { $fakeNow } -MonotonicNow { $ticks } -Sleep {
  param($s) $sleepDurations.Add([int]$s); $script:ticks += [long]($s*$freq); $script:fakeNow=$script:fakeNow.AddSeconds($s)
}
Assert ($bounded.Outcome -eq 'Hold' -and $nearCounts.abort -eq 1 -and $nearCounts.get -eq 14 -and $getTimeouts[13] -eq 1 -and $sleepDurations[-1] -eq 1) 'Post-abort deadline was not bounded'
Remove-Item -LiteralPath $evidence -Force

# Evidence append failure after a successful POST is Hold; raw body cannot be parsed and no GET/abort follows.
$evidence = New-EvidencePath
$failureCounts = @{ post=0; get=0; abort=0 }
$writeFailure = Invoke-R6BuildGuarded -PostBuild {
  $failureCounts.post++; Remove-Item -LiteralPath $evidence -Force; New-Item -ItemType Directory -LiteralPath $evidence | Out-Null
  [pscustomobject]@{StatusCode=201;Body=$bodyPost}
} -GetBuild { param($id,$timeout) $failureCounts.get++ } -AbortBuild { param($id) $failureCounts.abort++ } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 11000 }
Assert ($writeFailure.Outcome -eq 'Hold' -and $failureCounts.post -eq 1 -and $failureCounts.get -eq 0 -and $failureCounts.abort -eq 0) 'Evidence append failure did not Hold before monitoring'
Remove-Item -LiteralPath $evidence -Recurse -Force

# GET transport failure is recorded and fails closed without abort/retry.
$evidence = New-EvidencePath
$getFailureCounts = @{ get=0; abort=0 }
$getFailure = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body=$bodyPost} } -GetBuild { param($id,$timeout) $getFailureCounts.get++; throw 'synthetic GET transport failure' } -AbortBuild { param($id) $getFailureCounts.abort++ } -EvidenceLogPath $evidence -UtcNow { $anchor } -MonotonicNow { 12000 }
Assert ($getFailure.Outcome -eq 'Hold' -and $getFailureCounts.get -eq 1 -and $getFailureCounts.abort -eq 0 -and (@(Read-Evidence $evidence)[-1].event -eq 'build-status-transport-error')) 'GET transport failure did not Hold once'
Remove-Item -LiteralPath $evidence -Force

# A fresh terminal GET arriving exactly at the 120-second decision boundary wins over abort.
$evidence = New-EvidencePath
$fakeNow = $anchor; $ticks = 13000L; $boundaryCounts = @{ get=0; abort=0; sleep=0 }
$terminalB = (@{id='build-e';status='SUCCEEDED';startedAt=$started} | ConvertTo-Json -Compress)
$pendingE = (@{id='build-e';status='BUILDING';startedAt=$started} | ConvertTo-Json -Compress)
$boundary = Invoke-R6BuildGuarded -PostBuild { [pscustomobject]@{StatusCode=201;Body=(@{id='build-e';status='READY';startedAt=$started}|ConvertTo-Json -Compress)} } -GetBuild {
  param($id,$timeout) $boundaryCounts.get++; $body=if ($boundaryCounts.get -ge 13) {$terminalB} else {$pendingE}; [pscustomobject]@{StatusCode=200;Body=$body}
} -AbortBuild { param($id) $boundaryCounts.abort++; [pscustomobject]@{StatusCode=200;Body='{}'} } -EvidenceLogPath $evidence -UtcNow { $fakeNow } -MonotonicNow { $ticks } -Sleep {
  param($seconds) $boundaryCounts.sleep++; $script:ticks += [long]($seconds*$freq); $script:fakeNow=$script:fakeNow.AddSeconds($seconds)
}
Assert ($boundary.Outcome -eq 'SUCCEEDED' -and $boundaryCounts.get -eq 13 -and $boundaryCounts.abort -eq 0) 'Terminal-at-guard-boundary race caused abort'
Remove-Item -LiteralPath $evidence -Force
'R6_BUILD_OPERATOR_CHECK PASS: evidence preflight/preservation, terminal-first, ambiguous and malformed JSON Hold, non-2xx/transport Hold without retries, single abort failure, and post-abort GET/sleep deadline clamp. Injected transports only; no live API/build/run/abort.'
