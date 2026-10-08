Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'r6-run-access-gate.psm1') -Force

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw "$Message (actual='$Actual', expected='$Expected')" }
}

$expectedRunId = 'b66C26fuXBDubmxM2'
$payload = New-R6RestrictedRunAccessPayload
$payloadDocument = [System.Text.Json.JsonDocument]::Parse($payload)
try {
  $payloadRoot = $payloadDocument.RootElement
  Assert-Equal $payloadRoot.ValueKind ([System.Text.Json.JsonValueKind]::Object) 'Payload is a JSON object'
  $payloadFieldNames = @($payloadRoot.EnumerateObject() | ForEach-Object { $_.Name })
  Assert-Equal $payloadFieldNames.Count 1 'Payload has one field only'
  $payloadAccess = [System.Text.Json.JsonElement]::new()
  Assert-Equal ($payloadRoot.TryGetProperty('generalAccess', [ref]$payloadAccess)) $true 'Payload uses the documented generalAccess field'
  Assert-Equal $payloadAccess.GetString() 'RESTRICTED' 'Payload requests restricted run access'
  $isPublicProperty = [System.Text.Json.JsonElement]::new()
  Assert-Equal ($payloadRoot.TryGetProperty('isPublic', [ref]$isPublicProperty)) $false 'Payload does not use Actor-definition isPublic'
}
finally {
  $payloadDocument.Dispose()
}

$good = Test-R6RestrictedRunAccessReadback -ExpectedRunId $expectedRunId -ResponseJson '{"data":{"id":"b66C26fuXBDubmxM2","generalAccess":"RESTRICTED"}}'
Assert-Equal $good.Passed $true 'Exact same-run RESTRICTED readback passes'
Assert-Equal $good.Decision 'Continue' 'Only exact same-run RESTRICTED readback permits continuation'

$cases = @(
  @{ Name = 'FOLLOW_USER_SETTING'; Json = '{"data":{"id":"b66C26fuXBDubmxM2","generalAccess":"FOLLOW_USER_SETTING"}}' },
  @{ Name = 'missing generalAccess'; Json = '{"data":{"id":"b66C26fuXBDubmxM2"}}' },
  @{ Name = 'isPublic is not the run access field'; Json = '{"data":{"id":"b66C26fuXBDubmxM2","isPublic":false}}' },
  @{ Name = 'wrong run id'; Json = '{"data":{"id":"another-run","generalAccess":"RESTRICTED"}}' },
  @{ Name = 'malformed JSON'; Json = '{"data":' },
  @{ Name = 'non-string generalAccess'; Json = '{"data":{"id":"b66C26fuXBDubmxM2","generalAccess":true}}' }
)
foreach ($case in $cases) {
  $result = Test-R6RestrictedRunAccessReadback -ExpectedRunId $expectedRunId -ResponseJson $case.Json
  Assert-Equal $result.Passed $false "Reject $($case.Name)"
  Assert-Equal $result.Decision 'Hold' "Route $($case.Name) to Hold"
}

Write-Output 'R6_RUN_ACCESS_GATE_CHECK_RESULT {"payload":"{\"generalAccess\":\"RESTRICTED\"}","cases":["same run id plus exact RESTRICTED passes","FOLLOW_USER_SETTING fails","missing generalAccess fails","isPublic-only response fails","wrong run id fails","malformed JSON fails","non-string generalAccess fails"],"networkRequests":0,"actorApiRequests":0,"runs":0,"result":"PASS"}'
