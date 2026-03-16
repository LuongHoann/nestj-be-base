param (
    [string]$InputJson
)

$ErrorActionPreference = "Stop"

try {
    $params = $InputJson | ConvertFrom-Json
    $identity = $params.exchangeGuid
    if (-not $identity) { $identity = $params.email }

    if (-not (Get-PSSnapin -Name Microsoft.Exchange.Management.PowerShell.E2010 -ErrorAction SilentlyContinue)) {
        Add-PSSnapin Microsoft.Exchange.Management.PowerShell.E2010
    }

    # Remove-Mailbox
    Remove-Mailbox -Identity $identity -Confirm:$false

    $result = @{
        Success = $true
        Message = "Shared mailbox deleted successfully"
    }
} catch {
    $result = @{
        Success = $false
        Error = $_.Exception.Message
    }
}

$result | ConvertTo-Json
