# azd preprovision hook: make sure the values read by infra/main.bicepparam are set in the azd environment.
# The Jev API key is stored only in the local (git-ignored) .azure/<env>/.env file and in Key Vault.
$ErrorActionPreference = 'Stop'

function Set-AzdValue {
    param(
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [string] $Prompt,
        [switch] $Secret
    )
    $current = azd env get-value $Name 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($current)) {
        return
    }
    $value = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        azd env set $Name $value
        return
    }
    if ([Console]::IsInputRedirected) {
        throw "$Name is not set. Run: azd env set $Name <value>"
    }
    if ($Secret) {
        $value = Read-Host -Prompt $Prompt -MaskInput
    }
    else {
        $value = Read-Host -Prompt $Prompt
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Name cannot be empty."
    }
    azd env set $Name $value
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set $Name in the azd environment."
    }
}

Set-AzdValue -Name 'APIM_PUBLISHER_EMAIL' -Prompt 'APIM publisher e-mail'
Set-AzdValue -Name 'JEV_API_KEY' -Prompt 'Jev API key (input hidden)' -Secret
