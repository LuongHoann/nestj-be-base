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

    # 3. Create Shared Mailbox
    # Note: Exchange on-premise requires Name and Alias
    $alias = $data.email.Split('@')[0]
    
    $mailbox = New-Mailbox -Shared -Name $data.name -Alias $alias -PrimarySmtpAddress $data.email -DisplayName $data.displayName
    
    # Wait for propagation just to be safe
    Start-Sleep -Seconds 2
    
    $result = @{
        Success = $true
        Action = "CreateSharedMailbox"
        Mailbox = @{
            Name = $mailbox.Name
            Alias = $mailbox.Alias
            PrimarySmtpAddress = $mailbox.PrimarySmtpAddress.ToString()
            ExchangeGuid = $mailbox.ExchangeGuid.ToString()
        }
    }
    
    $result | ConvertTo-Json -Depth 5 -Compress
    exit 0
} catch {
    $errorResult = @{
        Success = $false
        Action = "CreateSharedMailbox"
        Error = $_.Exception.Message
    }
    $errorResult | ConvertTo-Json -Depth 5 -Compress
    
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
