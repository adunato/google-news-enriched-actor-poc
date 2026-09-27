[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^/]+/[^/]+$')]
    [string] $Repository,
    [string] $CredentialPath
)

$ErrorActionPreference = 'Stop'

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    throw 'Automatic SideGig dispatch-secret provisioning currently requires Windows because the local bootstrap credential uses DPAPI user-scoped encryption.'
}

if (-not $CredentialPath) {
    if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not available.' }
    $CredentialPath = Join-Path $env:LOCALAPPDATA 'SideGig\bootstrap\collector-dispatch-token.dpapi'
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) is required for automatic repository-secret provisioning.'
}

if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) {
    throw "SideGig local bootstrap credential is not initialized: $CredentialPath. Run implementation/bootstrap/initialize-dispatch-credential.ps1 once before bootstrapping product repositories."
}

$encrypted = Get-Content -LiteralPath $CredentialPath -Raw
$secureToken = ConvertTo-SecureString $encrypted
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($plainToken)) {
        throw 'Decrypted SideGig dispatch credential is empty.'
    }

    $plainToken | gh secret set SIDEGIG_COLLECTOR_DISPATCH_TOKEN --repo $Repository
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI failed to create SIDEGIG_COLLECTOR_DISPATCH_TOKEN in $Repository."
    }
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    Remove-Variable plainToken -ErrorAction SilentlyContinue
}

$secretList = gh secret list --repo $Repository --json name | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    throw "Unable to verify repository secrets for $Repository."
}

if (-not ($secretList | Where-Object { $_.name -eq 'SIDEGIG_COLLECTOR_DISPATCH_TOKEN' })) {
    throw "SIDEGIG_COLLECTOR_DISPATCH_TOKEN was not found after provisioning $Repository."
}

Write-Output "[bootstrap-secret] SIDEGIG_COLLECTOR_DISPATCH_TOKEN provisioned and verified for $Repository."
