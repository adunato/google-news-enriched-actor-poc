# One-build R6 operator. Dot-sourcing this file performs no requests.
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'r6-build-monitor.psm1') -Force

function Invoke-R6BuildGuarded {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][scriptblock]$PostBuild,
    [Parameter(Mandatory)][scriptblock]$GetBuild,
    [Parameter(Mandatory)][scriptblock]$AbortBuild,
    [Parameter(Mandatory)][string]$EvidenceLogPath,
    [scriptblock]$Sleep = { param($Seconds) Start-Sleep -Seconds $Seconds },
    [scriptblock]$UtcNow = { [DateTimeOffset]::UtcNow },
    [scriptblock]$MonotonicNow = { [System.Diagnostics.Stopwatch]::GetTimestamp() },
    [int]$PollSeconds = 10
  )
  if ($PollSeconds -lt 1 -or $PollSeconds -gt 30) { throw 'PollSeconds must be between 1 and 30.' }
  try {
    $evidenceFullPath = [IO.Path]::GetFullPath($EvidenceLogPath)
    $evidenceDirectory = [IO.Path]::GetDirectoryName($evidenceFullPath)
    if (-not [IO.Directory]::Exists($evidenceDirectory)) { throw 'Evidence directory does not exist' }
    $stream = [IO.File]::Open($evidenceFullPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    $stream.Dispose()
  } catch {
    return [pscustomobject]@{ Outcome='Hold'; Reason='Private evidence path is not writable or already exists; no POST sent'; BuildId=$null; AbortCount=0 }
  }

  # Exactly one POST; preserve the raw JSON string so PowerShell cannot coerce ISO dates.
  try { $post = & $PostBuild } catch {
    $received = & $UtcNow
    try { Add-R6OperatorEvidence -Path $evidenceFullPath -Event 'build-post-transport-error' -ReceivedUtc $received -StatusCode $null -RawBody $null -ErrorType $_.Exception.GetType().FullName } catch { }
    return [pscustomobject]@{ Outcome='Hold'; Reason='Build POST transport failed; no retry'; BuildId=$null; AbortCount=0 }
  }
  $receiptUtc = & $UtcNow
  $startTick = [long](& $MonotonicNow)
  if ($null -eq $post) {
    return [pscustomobject]@{ Outcome='Hold'; Reason='Build POST did not return a successful raw-JSON response'; BuildId=$null; AbortCount=0 }
  }
  try { Add-R6OperatorEvidence -Path $evidenceFullPath -Event 'build-post' -ReceivedUtc $receiptUtc -StatusCode $post.StatusCode -RawBody $post.Body -ErrorType $null }
  catch { return [pscustomobject]@{ Outcome='Hold'; Reason='Build POST response could not be retained; no parsing, abort, or retry'; BuildId=$null; AbortCount=0 } }
  if ($post.StatusCode -lt 200 -or $post.StatusCode -ge 300 -or $post.Body -isnot [string]) {
    return [pscustomobject]@{ Outcome='Hold'; Reason='Build POST did not return a successful raw-JSON response'; BuildId=$null; AbortCount=0 }
  }

  # Bind UTC receipt and monotonic start immediately after successful POST receipt.
  try {
    $state = New-R6BuildMonitorState -PostResponseJson $post.Body -PostResponseReceivedUtc $receiptUtc -LocalUtcNow (& $UtcNow) -MonotonicStartTimestamp $startTick
  } catch {
    return [pscustomobject]@{ Outcome='Hold'; Reason='Build POST receipt could not initialize the monitor'; BuildId=$null; AbortCount=0 }
  }
  if (-not $state.Valid) { return [pscustomobject]@{ Outcome='Hold'; Reason=$state.InvalidReason; BuildId=$state.BuildId; AbortCount=0 } }

  $abortCount = 0
  $lastValidStatus = $state.PostStatus
  while ($true) {
    $timeoutSeconds = 30
    if ($state.AbortLatched) {
      $elapsedNow = ([long](& $MonotonicNow) - [long]$state.Clock.StartTimestamp) / [double][System.Diagnostics.Stopwatch]::Frequency
      $postAbortRemaining = [double]$state.AbortElapsedSeconds + 120.0 - $elapsedNow
      if ($postAbortRemaining -lt 1) { return [pscustomobject]@{ Outcome='Hold'; Reason='Post-abort observation deadline is less than one second away; no further GET'; BuildId=$state.BuildId; AbortCount=$abortCount; LastValidStatus=$lastValidStatus } }
      $timeoutSeconds = [Math]::Max(1, [Math]::Min(30, [int][Math]::Floor($postAbortRemaining)))
    }
    try { $fresh = & $GetBuild $state.BuildId $timeoutSeconds } catch {
      $received = & $UtcNow
      try { Add-R6OperatorEvidence -Path $evidenceFullPath -Event 'build-status-transport-error' -ReceivedUtc $received -StatusCode $null -RawBody $null -ErrorType $_.Exception.GetType().FullName } catch { }
      return [pscustomobject]@{ Outcome='Hold'; Reason='Build status transport failed; no abort or retry'; BuildId=$state.BuildId; AbortCount=$abortCount; LastValidStatus=$lastValidStatus }
    }
    $receivedUtc = & $UtcNow
    $localUtc = & $UtcNow
    $tick = [long](& $MonotonicNow)
    if ($null -eq $fresh -or $fresh.StatusCode -lt 200 -or $fresh.StatusCode -ge 300 -or $fresh.Body -isnot [string]) {
      try { Add-R6OperatorEvidence -Path $evidenceFullPath -Event 'build-status-invalid-response' -ReceivedUtc $receivedUtc -StatusCode $(if ($null -ne $fresh) { $fresh.StatusCode } else { $null }) -RawBody $(if ($null -ne $fresh -and $fresh.Body -is [string]) { $fresh.Body } else { $null }) -ErrorType $null } catch { }
      return [pscustomobject]@{ Outcome='Hold'; Reason='Fresh build status response unavailable'; BuildId=$state.BuildId; AbortCount=$abortCount; LastValidStatus=$lastValidStatus }
    }
    try { Add-R6OperatorEvidence -Path $evidenceFullPath -Event 'build-status' -ReceivedUtc $receivedUtc -StatusCode $fresh.StatusCode -RawBody $fresh.Body -ErrorType $null }
    catch { return [pscustomobject]@{ Outcome='Hold'; Reason='Fresh build status could not be retained; no abort or retry'; BuildId=$state.BuildId; AbortCount=$abortCount; LastValidStatus=$lastValidStatus } }
    try { $decision = Get-R6BuildMonitorAction -State $state -FreshStatusJson $fresh.Body -FreshStatusReceivedUtc $receivedUtc -LocalUtcNow $localUtc -MonotonicTimestamp $tick }
    catch { return [pscustomobject]@{ Outcome='Hold'; Reason='Fresh build JSON or monitor validation failed; no abort or retry'; BuildId=$state.BuildId; AbortCount=$abortCount; LastValidStatus=$lastValidStatus } }
    if ($decision.Status) { $lastValidStatus = $decision.Status }
    switch ($decision.Action) {
      'Terminal' { return [pscustomobject]@{ Outcome=$decision.Status; Reason=$decision.Reason; BuildId=$state.BuildId; AbortCount=$abortCount } }
      'TerminalAfterAbort' { return [pscustomobject]@{ Outcome=$decision.Status; Reason=$decision.Reason; BuildId=$state.BuildId; AbortCount=$abortCount } }
      'Hold' { return [pscustomobject]@{ Outcome='Hold'; Reason=$decision.Reason; BuildId=$state.BuildId; AbortCount=$abortCount } }
      'HoldAfterAbortObservationLimit' { return [pscustomobject]@{ Outcome='Hold'; Reason=$decision.Reason; BuildId=$state.BuildId; AbortCount=$abortCount } }
      'AbortOnce' {
        if ($abortCount -ne 0) { return [pscustomobject]@{ Outcome='Hold'; Reason='Abort latch rejected a duplicate abort'; BuildId=$state.BuildId; AbortCount=$abortCount } }
        # The guard module latches before this sole abort request.
        $abortCount = 1
        try { $abort = & $AbortBuild $state.BuildId } catch { return [pscustomobject]@{ Outcome='Hold'; Reason='Abort request transport failed; no retry'; BuildId=$state.BuildId; AbortCount=$abortCount } }
        $abortReceivedUtc = & $UtcNow
        try { Add-R6OperatorEvidence -Path $evidenceFullPath -Event 'build-abort' -ReceivedUtc $abortReceivedUtc -StatusCode $(if ($null -ne $abort) { $abort.StatusCode } else { $null }) -RawBody $(if ($null -ne $abort -and $abort.Body -is [string]) { $abort.Body } else { $null }) -ErrorType $null }
        catch { return [pscustomobject]@{ Outcome='Hold'; Reason='Abort response could not be retained; no retry'; BuildId=$state.BuildId; AbortCount=$abortCount } }
        if ($null -eq $abort -or $abort.StatusCode -lt 200 -or $abort.StatusCode -ge 300) {
          return [pscustomobject]@{ Outcome='Hold'; Reason='Abort request was not confirmed; no retry'; BuildId=$state.BuildId; AbortCount=$abortCount }
        }
        continue
      }
      'Wait' { & $Sleep $PollSeconds; continue }
      'ObserveAfterAbort' {
        $elapsedNow = ([long](& $MonotonicNow) - [long]$state.Clock.StartTimestamp) / [double][System.Diagnostics.Stopwatch]::Frequency
        $remaining = [double]$state.AbortElapsedSeconds + 120.0 - $elapsedNow
        if ($remaining -le 0) { return [pscustomobject]@{ Outcome='Hold'; Reason='Post-abort observation deadline reached'; BuildId=$state.BuildId; AbortCount=$abortCount; LastValidStatus=$lastValidStatus } }
        & $Sleep ([Math]::Min([double]$PollSeconds, $remaining))
        continue
      }
      default { return [pscustomobject]@{ Outcome='Hold'; Reason='Unknown monitor decision'; BuildId=$state.BuildId; AbortCount=$abortCount } }
    }
  }
}

function Invoke-R6BuildApi {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$ActorId,
    [Parameter(Mandatory)][string]$Version,
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$Token,
    [string]$EvidenceLogPath = (Join-Path $env:TEMP ('r6-build-' + [guid]::NewGuid().ToString('N') + '.jsonl'))
  )
  $headers = @{ Authorization = "Bearer $Token"; Accept = 'application/json' }
  $base = 'https://api.apify.com/v2'
  $buildUri = "$base/acts/$ActorId/builds?version=$([uri]::EscapeDataString($Version))&tag=$([uri]::EscapeDataString($Tag))"
  $transport = @{
    PostBuild = { Invoke-R6RawHttp -Method POST -Uri $buildUri -Headers $headers }
    GetBuild = { param($id,$timeout) Invoke-R6RawHttp -Method GET -Uri "$base/actor-builds/$([uri]::EscapeDataString($id))" -Headers $headers -TimeoutSec $timeout }
    AbortBuild = { param($id) Invoke-R6RawHttp -Method POST -Uri "$base/actor-builds/$([uri]::EscapeDataString($id))/abort" -Headers $headers }
  }
  Invoke-R6BuildGuarded -PostBuild $transport.PostBuild -GetBuild $transport.GetBuild -AbortBuild $transport.AbortBuild -EvidenceLogPath $EvidenceLogPath
}

function Invoke-R6RawHttp {
  param([string]$Method,[string]$Uri,[hashtable]$Headers,[int]$TimeoutSec = 30)
  $response = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers -SkipHttpErrorCheck -TimeoutSec $TimeoutSec
  return [pscustomobject]@{ StatusCode=[int]$response.StatusCode; Body=[string]$response.Content }
}

function Add-R6OperatorEvidence {
  param([string]$Path,[string]$Event,[DateTimeOffset]$ReceivedUtc,[AllowNull()][object]$StatusCode,[AllowNull()][string]$RawBody,[AllowNull()][string]$ErrorType)
  $entry = [ordered]@{ event=$Event; receivedAtUtc=$ReceivedUtc.ToUniversalTime().ToString('o'); statusCode=$StatusCode; rawBody=$RawBody; errorType=$ErrorType }
  $line = ($entry | ConvertTo-Json -Compress -Depth 5) + [Environment]::NewLine
  [IO.File]::AppendAllText($Path, $line, [Text.UTF8Encoding]::new($false))
}
