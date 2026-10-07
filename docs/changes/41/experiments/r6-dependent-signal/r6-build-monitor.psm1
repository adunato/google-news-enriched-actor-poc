# Pure build-guard state only: this module performs no HTTP, Actor, build, or abort operation.
# Start its monotonic clock immediately after a successful build POST response. Feed each
# just-received status GET to Get-R6BuildMonitorAction; act only on its returned decision.
# Hold means no automatic abort. AbortOnce is latched before the caller may issue one abort.
Set-StrictMode -Version Latest

$script:R6InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture
$script:R6ClockSkewToleranceSeconds = 5.0
$script:R6MaximumInitialAnchorAgeSeconds = 120.0
$script:R6TimestampAgreementToleranceSeconds = 1.0
$script:R6FreshStatusMaximumAgeSeconds = 5.0
$script:R6BuildGuardSeconds = 120.0
$script:R6PostAbortObservationSeconds = 120.0

function Get-R6BuildFields {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Json)

  $document = [System.Text.Json.JsonDocument]::Parse($Json)
  try {
    $root = $document.RootElement
    $data = $root
    if ($root.ValueKind -eq [System.Text.Json.JsonValueKind]::Object) {
      $candidate = [System.Text.Json.JsonElement]::new()
      if ($root.TryGetProperty('data', [ref]$candidate) -and
        $candidate.ValueKind -eq [System.Text.Json.JsonValueKind]::Object) {
        $data = $candidate
      }
    }

    $fields = [ordered]@{ id = $null; status = $null; startedAt = $null }
    foreach ($name in @('id', 'status', 'startedAt')) {
      $value = [System.Text.Json.JsonElement]::new()
      if ($data.ValueKind -eq [System.Text.Json.JsonValueKind]::Object -and
        $data.TryGetProperty($name, [ref]$value) -and
        $value.ValueKind -eq [System.Text.Json.JsonValueKind]::String) {
        $fields[$name] = $value.GetString()
      }
    }
    return [pscustomobject]$fields
  }
  finally {
    $document.Dispose()
  }
}

function ConvertFrom-R6StrictTimestamp {
  [CmdletBinding()]
  param([AllowNull()][object]$Value)

  if ($Value -isnot [string] -or
    $Value -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$') {
    return [pscustomobject]@{ Valid = $false; Raw = $Value; Utc = $null; Reason = 'startedAt must remain an ISO-8601 string with an explicit UTC offset' }
  }

  $parsed = [DateTimeOffset]::MinValue
  $valid = [DateTimeOffset]::TryParse(
    $Value,
    $script:R6InvariantCulture,
    [System.Globalization.DateTimeStyles]::None,
    [ref]$parsed
  )
  if (-not $valid) {
    return [pscustomobject]@{ Valid = $false; Raw = $Value; Utc = $null; Reason = 'startedAt is not a valid invariant ISO-8601 timestamp' }
  }
  return [pscustomobject]@{
    Valid = $true
    Raw = $Value
    Utc = $parsed.ToUniversalTime()
    Reason = $null
  }
}

function New-R6BuildMonitorState {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$PostResponseJson,
    [Parameter(Mandatory)][DateTimeOffset]$PostResponseReceivedUtc,
    [Parameter(Mandatory)][DateTimeOffset]$LocalUtcNow,
    [long]$MonotonicStartTimestamp = [System.Diagnostics.Stopwatch]::GetTimestamp()
  )

  $fields = Get-R6BuildFields -Json $PostResponseJson
  $timestamp = ConvertFrom-R6StrictTimestamp -Value $fields.startedAt
  $valid = $true
  $reason = $null
  $anchorAgeSeconds = $null
  if (-not $fields.id -or -not $fields.status) {
    $valid = $false
    $reason = 'build POST response is missing string id or status'
  } elseif (-not $timestamp.Valid) {
    $valid = $false
    $reason = $timestamp.Reason
  } else {
    $anchorAgeSeconds = ($PostResponseReceivedUtc.ToUniversalTime() - $timestamp.Utc).TotalSeconds
    $localReceiptDelaySeconds = ($LocalUtcNow.ToUniversalTime() - $PostResponseReceivedUtc.ToUniversalTime()).TotalSeconds
    if ($anchorAgeSeconds -lt (-1 * $script:R6ClockSkewToleranceSeconds)) {
      $valid = $false
      $reason = 'server startedAt is materially in the future relative to successful POST receipt'
    } elseif ($anchorAgeSeconds -gt $script:R6MaximumInitialAnchorAgeSeconds) {
      $valid = $false
      $reason = 'server startedAt is stale at successful POST receipt'
    } elseif ($localReceiptDelaySeconds -lt (-1 * $script:R6ClockSkewToleranceSeconds) -or
      $localReceiptDelaySeconds -gt $script:R6FreshStatusMaximumAgeSeconds) {
      $valid = $false
      $reason = 'local monitor initialization is future-dated or stale relative to successful POST receipt'
    } elseif (($LocalUtcNow.ToUniversalTime() - $timestamp.Utc).TotalSeconds -lt (-1 * $script:R6ClockSkewToleranceSeconds) -or
      ($LocalUtcNow.ToUniversalTime() - $timestamp.Utc).TotalSeconds -gt $script:R6MaximumInitialAnchorAgeSeconds) {
      $valid = $false
      $reason = 'server startedAt is future-dated or stale relative to local UTC at monitor initialization'
    }
  }

  $clock = New-R6MonotonicClock -PostResponseReceivedUtc $PostResponseReceivedUtc -LocalUtcNow $LocalUtcNow -StartTimestamp $MonotonicStartTimestamp
  if (-not $clock.Valid) {
    $valid = $false
    $reason = $clock.InvalidReason
  }

  return [pscustomobject]@{
    Valid = $valid
    InvalidReason = $reason
    BuildId = $fields.id
    PostStatus = $fields.status
    StartedAtRaw = $timestamp.Raw
    StartedAtUtc = $timestamp.Utc
    AnchorAgeAtReceiptSeconds = $anchorAgeSeconds
    PostResponseReceivedUtc = $PostResponseReceivedUtc.ToUniversalTime()
    Clock = $clock
    AbortLatched = $false
    AbortElapsedSeconds = $null
    LastElapsedSeconds = -1.0
  }
}

function New-R6MonotonicClock {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][DateTimeOffset]$PostResponseReceivedUtc,
    [Parameter(Mandatory)][DateTimeOffset]$LocalUtcNow,
    [long]$StartTimestamp = [System.Diagnostics.Stopwatch]::GetTimestamp()
  )
  $receiptDelaySeconds = ($LocalUtcNow.ToUniversalTime() - $PostResponseReceivedUtc.ToUniversalTime()).TotalSeconds
  if ($receiptDelaySeconds -lt (-1 * $script:R6ClockSkewToleranceSeconds) -or
    $receiptDelaySeconds -gt $script:R6FreshStatusMaximumAgeSeconds) {
    return [pscustomobject]@{
      Valid = $false
      InvalidReason = 'monotonic guard must be initialized immediately after successful POST receipt'
      PostResponseReceivedUtc = $PostResponseReceivedUtc.ToUniversalTime()
      StartTimestamp = $StartTimestamp
    }
  }
  return [pscustomobject]@{
    Valid = $true
    InvalidReason = $null
    PostResponseReceivedUtc = $PostResponseReceivedUtc.ToUniversalTime()
    StartTimestamp = $StartTimestamp
  }
}

function Get-R6MonotonicElapsedSeconds {
  [CmdletBinding()]
  param([Parameter(Mandatory)]$Clock)
  $ticks = [System.Diagnostics.Stopwatch]::GetTimestamp() - [long]$Clock.StartTimestamp
  if ($ticks -lt 0) { throw 'Monotonic stopwatch moved backwards' }
  return $ticks / [double][System.Diagnostics.Stopwatch]::Frequency
}

function Get-R6BuildMonitorAction {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]$State,
    [Parameter(Mandatory)][string]$FreshStatusJson,
    [Parameter(Mandatory)][DateTimeOffset]$FreshStatusReceivedUtc,
    [Parameter(Mandatory)][DateTimeOffset]$LocalUtcNow,
    [long]$MonotonicTimestamp = [System.Diagnostics.Stopwatch]::GetTimestamp()
  )

  if (-not $State.Valid) {
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $null; AbortLatched = $State.AbortLatched }
  }
  if (-not $State.Clock.Valid -or
    $State.Clock.PostResponseReceivedUtc -ne $State.PostResponseReceivedUtc) {
    $State.Valid = $false
    $State.InvalidReason = 'monotonic clock is invalid or not bound to this successful POST receipt'
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $null; AbortLatched = $State.AbortLatched }
  }
  $elapsedTicks = $MonotonicTimestamp - [long]$State.Clock.StartTimestamp
  if ($elapsedTicks -lt 0) {
    $State.Valid = $false
    $State.InvalidReason = 'monotonic timestamp predates successful POST receipt clock start'
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $null; AbortLatched = $State.AbortLatched }
  }
  $MonotonicElapsedSeconds = $elapsedTicks / [double][System.Diagnostics.Stopwatch]::Frequency
  if ($MonotonicElapsedSeconds -lt $State.LastElapsedSeconds -or $MonotonicElapsedSeconds -lt 0) {
    $State.Valid = $false
    $State.InvalidReason = 'monotonic elapsed value regressed or was negative'
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $null; AbortLatched = $State.AbortLatched }
  }
  $statusResponseAgeSeconds = ($LocalUtcNow.ToUniversalTime() - $FreshStatusReceivedUtc.ToUniversalTime()).TotalSeconds
  if ($statusResponseAgeSeconds -lt (-1 * $script:R6ClockSkewToleranceSeconds) -or
    $statusResponseAgeSeconds -gt $script:R6FreshStatusMaximumAgeSeconds) {
    $State.Valid = $false
    $State.InvalidReason = 'fresh status response is missing, future-dated, or stale relative to local UTC'
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $null; AbortLatched = $State.AbortLatched }
  }

  $fields = Get-R6BuildFields -Json $FreshStatusJson
  $timestamp = ConvertFrom-R6StrictTimestamp -Value $fields.startedAt
  if (-not $fields.id -or $fields.id -cne $State.BuildId) {
    $State.Valid = $false
    $State.InvalidReason = 'fresh status response is missing the matching build id'
  } elseif (-not $fields.status) {
    $State.Valid = $false
    $State.InvalidReason = 'fresh status response is missing string status'
  } elseif (-not $timestamp.Valid) {
    $State.Valid = $false
    $State.InvalidReason = $timestamp.Reason
  } elseif ([Math]::Abs(($timestamp.Utc - $State.StartedAtUtc).TotalSeconds) -gt $script:R6TimestampAgreementToleranceSeconds) {
    $State.Valid = $false
    $State.InvalidReason = 'fresh status startedAt conflicts with the POST response anchor'
  }

  if (-not $State.Valid) {
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $fields.status; AbortLatched = $State.AbortLatched }
  }

  $status = $fields.status.ToUpperInvariant()
  $ageSeconds = ($LocalUtcNow.ToUniversalTime() - $timestamp.Utc).TotalSeconds
  $expectedAgeSeconds = [double]$State.AnchorAgeAtReceiptSeconds + $MonotonicElapsedSeconds
  if ($ageSeconds -lt (-1 * $script:R6ClockSkewToleranceSeconds) -or
    [Math]::Abs($ageSeconds - $expectedAgeSeconds) -gt $script:R6ClockSkewToleranceSeconds) {
    $State.Valid = $false
    $State.InvalidReason = 'fresh server timestamp conflicts with local UTC or monotonic elapsed time'
    return [pscustomobject]@{ Action = 'Hold'; Reason = $State.InvalidReason; Status = $status; AbortLatched = $State.AbortLatched }
  }

  $State.LastElapsedSeconds = $MonotonicElapsedSeconds
  $terminalStatuses = @('SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT', 'CANCELED', 'CANCELLED')
  if ($terminalStatuses -contains $status) {
    return [pscustomobject]@{
      Action = if ($State.AbortLatched) { 'TerminalAfterAbort' } else { 'Terminal' }
      Reason = 'terminal status observed before any further abort action'
      Status = $status
      AbortLatched = $State.AbortLatched
    }
  }

  if ($State.AbortLatched) {
    $postAbortElapsed = $MonotonicElapsedSeconds - [double]$State.AbortElapsedSeconds
    if ($postAbortElapsed -ge $script:R6PostAbortObservationSeconds) {
      return [pscustomobject]@{ Action = 'HoldAfterAbortObservationLimit'; Reason = 'build remained nonterminal through the bounded post-abort observation'; Status = $status; AbortLatched = $true }
    }
    return [pscustomobject]@{ Action = 'ObserveAfterAbort'; Reason = 'continue bounded observation without another abort'; Status = $status; AbortLatched = $true }
  }

  if ($MonotonicElapsedSeconds -lt $script:R6BuildGuardSeconds) {
    return [pscustomobject]@{ Action = 'Wait'; Reason = 'single 120-second build guard has not elapsed'; Status = $status; AbortLatched = $false }
  }

  $State.AbortLatched = $true
  $State.AbortElapsedSeconds = $MonotonicElapsedSeconds
  return [pscustomobject]@{ Action = 'AbortOnce'; Reason = 'one nonterminal build status was observed after the monotonic guard'; Status = $status; AbortLatched = $true }
}

Export-ModuleMember -Function Get-R6BuildFields, ConvertFrom-R6StrictTimestamp, New-R6BuildMonitorState, New-R6MonotonicClock, Get-R6MonotonicElapsedSeconds, Get-R6BuildMonitorAction
