$actorRoot = Resolve-Path (Join-Path $PSScriptRoot '..\actor')
$fixture = Resolve-Path (Join-Path $PSScriptRoot '..\..\b2-vanilla\input-acceptance.json')
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
$testEvidence = @(
  'local-parity-results.json', 'local-parity-inherited-env.tap'
)
$testFiles = @(
  foreach ($relative in $testEvidence) {
    $full = Join-Path $PSScriptRoot $relative
    if (Test-Path -LiteralPath $full) {
      [ordered]@{ path = $relative; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $full).Hash.ToLowerInvariant() }
    }
  }
)
$lock = Get-Content (Join-Path $actorRoot 'package-lock.json') -Raw | ConvertFrom-Json -AsHashtable
$manifest = [ordered]@{
  experiment = 'Issue 41 B2 controlled process'
  actorId = 'JIogcgdHyCqAMHQ1P'
  actorVersion = '0.10'
  buildTag = 'issue41-b2-controlled'
  hostedBuildOrRunPerformed = $false
  candidateFiles = $candidateFiles
  frozenAcceptanceInput = [ordered]@{ path = 'docs/changes/41/experiments/b2-vanilla/input-acceptance.json'; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $fixture).Hash.ToLowerInvariant(); rowCount = 100 }
  packages = [ordered]@{ apify = $lock.packages[''].dependencies.apify; readability = $lock.packages[''].dependencies['@mozilla/readability']; jsdom = $lock.packages[''].dependencies.jsdom }
  baselineSources = [ordered]@{
    main = [ordered]@{ path = 'docs/changes/41/experiments/b2-vanilla/actor/main.mjs'; sha256 = (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\main.mjs')).Hash.ToLowerInvariant() }
    bodyStreamExactMatch = ($candidateFiles | Where-Object path -eq 'body-stream.mjs').sha256 -eq (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\body-stream.mjs')).Hash.ToLowerInvariant()
    domContentTypeExactMatch = ($candidateFiles | Where-Object path -eq 'dom-content-type.mjs').sha256 -eq (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\dom-content-type.mjs')).Hash.ToLowerInvariant()
    dockerfileExactMatch = ($candidateFiles | Where-Object path -eq 'Dockerfile').sha256 -eq (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot '..\..\b2-vanilla\actor\Dockerfile')).Hash.ToLowerInvariant()
  }
  localTestFiles = $testFiles
  testSource = [ordered]@{ path = 'actor/baseline-parity.test.mjs'; sha256 = (Get-FileHash -Algorithm SHA256 (Join-Path $actorRoot 'baseline-parity.test.mjs')).Hash.ToLowerInvariant() }
  localRuntime = [ordered]@{ node = 'v20.19.0'; undici = '6.21.1' }
  hostedRuntimeGate = [ordered]@{ node = 'v20.20.2'; undici = '6.24.1'; requiredBeforePublisherRequests = $true }
  actorIgnoreExcludes = @('node_modules', '*.test.mjs', 'prepare-candidate.ps1')
}
$manifest | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'candidate-manifest.json')
