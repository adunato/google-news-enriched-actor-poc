$actorRoot = Resolve-Path (Join-Path $PSScriptRoot '..\actor')
$fixture = Resolve-Path (Join-Path $PSScriptRoot '..\..\b2-vanilla\input-acceptance.json')
$previousManifestPath = Join-Path $PSScriptRoot '..\..\b2-controlled-process\evidence\candidate-manifest.json'
$previousManifest = Get-Content -LiteralPath $previousManifestPath -Raw | ConvertFrom-Json
$previousFiles = @($previousManifest.candidateFiles)
$candidatePaths = @(
  '.actor/actor.json', '.actorignore', 'Dockerfile', 'baseline.mjs', 'body-stream.mjs',
  'dom-content-type.mjs', 'main.mjs', 'package-lock.json', 'package.json', 'parent.mjs', 'worker.mjs'
)
$candidateFiles = @(
  foreach ($relative in $candidatePaths) {
    $full = Join-Path $actorRoot $relative
    [ordered]@{ path = $relative; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $full).Hash.ToLowerInvariant(); uploaded = ($relative -ne '.actorignore') }
  }
)
$testEvidence = @('deadline-60s-test-result.json')
$testFiles = @(
  foreach ($relative in $testEvidence) {
    $full = Join-Path $PSScriptRoot $relative
    if (Test-Path -LiteralPath $full) {
      [ordered]@{ path = $relative; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $full).Hash.ToLowerInvariant() }
    }
  }
)
$lock = Get-Content (Join-Path $actorRoot 'package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
$sourceComparison = @(
  foreach ($candidate in $candidateFiles) {
    $previous = $previousFiles | Where-Object path -eq $candidate.path | Select-Object -First 1
    [ordered]@{ path = $candidate.path; previousSha256 = $previous.sha256; candidateSha256 = $candidate.sha256; unchanged = ($candidate.sha256 -eq $previous.sha256) }
  }
)
$testSourceSha = (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot 'baseline-parity.test.mjs')).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  experiment = 'Issue 41 B2 controlled process 60-second child deadline'
  actorId = 'JIogcgdHyCqAMHQ1P'
  actorVersion = '0.10'
  buildTag = 'issue41-b2-controlled-60s'
  hostedBuildOrRunPerformed = $false
  userAuthorizedOneBuildAndRun = $true
  rootExecutionGatePassed = $false
  candidateFiles = $candidateFiles
  previousCandidate = [ordered]@{ manifest = 'docs/changes/41/experiments/b2-controlled-process/evidence/candidate-manifest.json'; buildTag = 'issue41-b2-controlled'; actorVersion = '0.10' }
  sourceComparisonToPreviousCandidate = $sourceComparison
  previousTestSourceSha256 = $previousManifest.testSource.sha256
  candidateTestSourceSha256 = $testSourceSha
  testSourceChangedOnlyForDeadline = $true
  expectedRuntimeSourceChange = 'parent.mjs deadlineMs default only: 24000 to 60000'
  expectedNonRuntimeChanges = @('actor/.actor/actor.json buildTag only', 'baseline-parity.test.mjs deadline test title and 60000/62000 bounds')
  frozenAcceptanceInput = [ordered]@{ path = 'docs/changes/41/experiments/b2-vanilla/input-acceptance.json'; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $fixture).Hash.ToLowerInvariant(); rowCount = 100 }
  packages = [ordered]@{ apify = $lock.packages[''].dependencies.apify; readability = $lock.packages[''].dependencies['@mozilla/readability']; jsdom = $lock.packages[''].dependencies.jsdom }
  baselineSources = [ordered]@{
    main = [ordered]@{ path = 'docs/changes/41/experiments/b2-vanilla/actor/main.mjs'; sha256 = (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\main.mjs')).Hash.ToLowerInvariant() }
    bodyStreamExactMatch = ($candidateFiles | Where-Object path -eq 'body-stream.mjs').sha256 -eq (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\body-stream.mjs')).Hash.ToLowerInvariant()
    domContentTypeExactMatch = ($candidateFiles | Where-Object path -eq 'dom-content-type.mjs').sha256 -eq (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\dom-content-type.mjs')).Hash.ToLowerInvariant()
    dockerfileExactMatch = ($candidateFiles | Where-Object path -eq 'Dockerfile').sha256 -eq (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\Dockerfile')).Hash.ToLowerInvariant()
  }
  localTestFiles = $testFiles
  testSource = [ordered]@{ path = 'actor/baseline-parity.test.mjs'; sha256 = $testSourceSha }
  localRuntime = [ordered]@{ node = 'v20.19.0'; undici = '6.21.1' }
  hostedRuntimeGate = [ordered]@{ node = 'v20.20.2'; undici = '6.24.1'; requiredBeforePublisherRequests = $true }
  limits = [ordered]@{ parentDeadlineMs = 60000; reapAllowanceMs = 2000; httpChainTimeoutMs = 10000; maxConcurrentChildren = 2; memoryMbytes = 512; runTimeoutSecs = 3300; restartOnError = $false; runChargeCapUsd = 0.10; hostedBuildOrRunAuthorized = $true; rootExecutionGatePassed = $false }
  actorIgnoreExcludes = @('node_modules', '*.test.mjs', 'prepare-candidate.ps1')
}
$manifest | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'candidate-manifest.json')
