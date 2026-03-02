param()

# 1. Đọc dữ liệu từ NestJS
$inputJson = [Console]::In.ReadToEnd()
if (-not $inputJson) { Write-Error 'No input provided'; exit 1 }
$data = $inputJson | ConvertFrom-Json

if (-not $data.email) {
    Write-Error 'Missing email'
    exit 1
}

# --- CẤU HÌNH KẾT NỐI EXCHANGE ON-PREM ---
$ExchangeServer = $data.ExchangeServer
$UserAdmin = $data.UserAdmin
$Password = $data.Password | ConvertTo-SecureString -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($UserAdmin, $Password)

try {
    # 2. Tạo Session tới thư mục ảo PowerShell của Exchange trên IIS
    $SessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck -SkipRevocationCheck

    $Session = New-PSSession `
        -ConfigurationName Microsoft.Exchange `
        -ConnectionUri "http://$ExchangeServer/PowerShell/" `
        -Authentication Basic `
        -Credential $Credential `
        -SessionOption $SessionOption `
        -AllowRedirection `
        -ErrorAction Stop

    # 3. Chạy lệnh Remove-Mailbox vĩnh viễn
    Invoke-Command -Session $Session -ScriptBlock {
        param($email)
        Remove-Mailbox -Identity $email -Permanent $true -Confirm:$false
    } -ArgumentList $data.email

    Write-Output "successfully_deleted:$($data.email)"

    # 4. Dọn dẹp session
    Remove-PSSession $Session
    exit 0

} catch {
    Write-Error "Lỗi: $($_.Exception.Message)"
    if ($Session) { Remove-PSSession $Session }
    exit 1
}
