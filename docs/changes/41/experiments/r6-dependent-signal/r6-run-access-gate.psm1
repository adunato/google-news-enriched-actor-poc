# Pure R6 run-access payload/readback validation. This module performs no network or Actor API calls.
Set-StrictMode -Version Latest

function New-R6RestrictedRunAccessPayload {
  [CmdletBinding()]
  param()

  # Apify run update API field. Do not use the Actor-definition `isPublic` field here.
  return '{"generalAccess":"RESTRICTED"}'
}

function Test-R6RestrictedRunAccessReadback {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$ExpectedRunId,
    [Parameter(Mandatory)][string]$ResponseJson
  )

  try {
    $document = [System.Text.Json.JsonDocument]::Parse($ResponseJson)
  }
  catch {
    return [pscustomobject]@{ Passed = $false; Decision = 'Hold'; Reason = 'malformed JSON readback'; RunId = $null; GeneralAccess = $null }
  }

  try {
    $root = $document.RootElement
    $data = [System.Text.Json.JsonElement]::new()
    $dataProperty = [System.Text.Json.JsonElement]::new()
    if ($root.ValueKind -eq [System.Text.Json.JsonValueKind]::Object -and
      $root.TryGetProperty('data', [ref]$dataProperty) -and
      $dataProperty.ValueKind -eq [System.Text.Json.JsonValueKind]::Object) {
      $data = $dataProperty
    } else {
      return [pscustomobject]@{ Passed = $false; Decision = 'Hold'; Reason = 'missing data object'; RunId = $null; GeneralAccess = $null }
    }

    $idElement = [System.Text.Json.JsonElement]::new()
    if (-not $data.TryGetProperty('id', [ref]$idElement) -or
      $idElement.ValueKind -ne [System.Text.Json.JsonValueKind]::String) {
      return [pscustomobject]@{ Passed = $false; Decision = 'Hold'; Reason = 'missing string run id'; RunId = $null; GeneralAccess = $null }
    }
    $actualId = $idElement.GetString()
    if ($actualId -cne $ExpectedRunId) {
      return [pscustomobject]@{ Passed = $false; Decision = 'Hold'; Reason = 'readback run id does not match the aborted run'; RunId = $actualId; GeneralAccess = $null }
    }

    $accessElement = [System.Text.Json.JsonElement]::new()
    if (-not $data.TryGetProperty('generalAccess', [ref]$accessElement) -or
      $accessElement.ValueKind -ne [System.Text.Json.JsonValueKind]::String) {
      return [pscustomobject]@{ Passed = $false; Decision = 'Hold'; Reason = 'missing string generalAccess; isPublic is not a substitute'; RunId = $actualId; GeneralAccess = $null }
    }
    $actualAccess = $accessElement.GetString()
    if ($actualAccess -cne 'RESTRICTED') {
      return [pscustomobject]@{ Passed = $false; Decision = 'Hold'; Reason = 'generalAccess is not exactly RESTRICTED'; RunId = $actualId; GeneralAccess = $actualAccess }
    }

    return [pscustomobject]@{ Passed = $true; Decision = 'Continue'; Reason = 'same run id read back with generalAccess=RESTRICTED'; RunId = $actualId; GeneralAccess = $actualAccess }
  }
  finally {
    $document.Dispose()
  }
}

Export-ModuleMember -Function New-R6RestrictedRunAccessPayload, Test-R6RestrictedRunAccessReadback
