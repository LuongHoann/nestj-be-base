param (
    [Parameter(Mandatory=$true)]
    [string]$InputJson
)

$ErrorActionPreference = "Stop"
$progressPreference = 'silentlyContinue'

try {
    # 1. Parse Input
    $data = $InputJson | ConvertFrom-Json

    # 2. Add Exchange Snapin if needed
    if (-not (Get-PSSnapin -Name Microsoft.Exchange.Management.PowerShell.SnapIn -ErrorAction SilentlyContinue)) {
        Add-PSSnapin Microsoft.Exchange.Management.PowerShell.SnapIn
    }

    # 3. Disable Shared Mailbox
    $identity = $data.exchangeGuid
    if (-not $identity) {
        $identity = $data.email
    }

    Disable-Mailbox -Identity $identity -Confirm:$false
    
    $result = @{
        Success = $true
        Action = "DisableSharedMailbox"
        Message = "Shared Mailbox disabled successfully"
    }
    
    $result | ConvertTo-Json -Depth 5 -Compress
    exit 0
} catch {
    $errorResult = @{
        Success = $false
        Action = "DisableSharedMailbox"
        Error = $_.Exception.Message
    }
    $errorResult | ConvertTo-Json -Depth 5 -Compress
    
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
