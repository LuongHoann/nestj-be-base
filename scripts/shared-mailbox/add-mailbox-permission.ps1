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

    # 3. Add Permissions
    $mailboxIdentity = $data.mailboxEmail
    $userIdentity = $data.userEmail
    $role = $data.role # "OWNER" or "MEMBER"
    
    # Always grant FullAccess
    Add-MailboxPermission -Identity $mailboxIdentity -User $userIdentity -AccessRights FullAccess -InheritanceType All -AutoMapping $true -Confirm:$false
    
    # If Owner, grant SendAs
    if ($role -eq "OWNER") {
        Add-RecipientPermission -Identity $mailboxIdentity -Trustee $userIdentity -AccessRights SendAs -Confirm:$false
    }
    
    $result = @{
        Success = $true
        Action = "AddMailboxPermission"
        Message = "Permissions granted successfully for $userIdentity on $mailboxIdentity"
    }
    
    $result | ConvertTo-Json -Depth 5 -Compress
    exit 0
} catch {
    $errorResult = @{
        Success = $false
        Action = "AddMailboxPermission"
        Error = $_.Exception.Message
    }
    $errorResult | ConvertTo-Json -Depth 5 -Compress
    
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
