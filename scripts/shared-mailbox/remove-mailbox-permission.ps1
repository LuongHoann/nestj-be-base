param (
    [Parameter(Mandatory=$true)]
    [string]$InputJson
)

$ErrorActionPreference = "Stop"
# For Remove-RecipientPermission, errors can happen if the permission doesn't exist
# We capture them manually
$progressPreference = 'silentlyContinue'

try {
    # 1. Parse Input
    $data = $InputJson | ConvertFrom-Json

    # 2. Add Exchange Snapin if needed
    if (-not (Get-PSSnapin -Name Microsoft.Exchange.Management.PowerShell.SnapIn -ErrorAction SilentlyContinue)) {
        Add-PSSnapin Microsoft.Exchange.Management.PowerShell.SnapIn
    }

    # 3. Remove Permissions
    $mailboxIdentity = $data.mailboxEmail
    $userIdentity = $data.userEmail
    
    # Revoke FullAccess
    Remove-MailboxPermission -Identity $mailboxIdentity -User $userIdentity -AccessRights FullAccess -InheritanceType All -Confirm:$false -ErrorAction SilentlyContinue
    
    # Revoke SendAs
    Remove-RecipientPermission -Identity $mailboxIdentity -Trustee $userIdentity -AccessRights SendAs -Confirm:$false -ErrorAction SilentlyContinue
    
    $result = @{
        Success = $true
        Action = "RemoveMailboxPermission"
        Message = "Permissions revoked successfully for $userIdentity on $mailboxIdentity"
    }
    
    $result | ConvertTo-Json -Depth 5 -Compress
    exit 0
} catch {
    $errorResult = @{
        Success = $false
        Action = "RemoveMailboxPermission"
        Error = $_.Exception.Message
    }
    $errorResult | ConvertTo-Json -Depth 5 -Compress
    
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
