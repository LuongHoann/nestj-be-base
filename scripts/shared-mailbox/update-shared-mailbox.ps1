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

    # 3. Update Shared Mailbox
    # Note: ExchangeGuid is the most reliable identifier, fallback to oldEmail
    $identity = $data.exchangeGuid
    if (-not $identity) {
        $identity = $data.oldEmail
    }

    $mailbox = Set-Mailbox -Identity $identity -PrimarySmtpAddress $data.email -DisplayName $data.displayName
    
    $result = @{
        Success = $true
        Action = "UpdateSharedMailbox"
        Message = "Shared Mailbox updated successfully"
    }
    
    $result | ConvertTo-Json -Depth 5 -Compress
    exit 0
} catch {
    $errorResult = @{
        Success = $false
        Action = "UpdateSharedMailbox"
        Error = $_.Exception.Message
    }
    $errorResult | ConvertTo-Json -Depth 5 -Compress
    
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
