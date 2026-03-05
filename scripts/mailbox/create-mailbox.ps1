param()

# 1. Đọc dữ liệu từ NestJS
$inputJson = [Console]::In.ReadToEnd()
if (-not $inputJson) { Write-Error 'No input provided'; exit 1 }
$data = $inputJson | ConvertFrom-Json

if (-not $data.email -or -not $data.name -or -not $data.password) {
  Write-Error 'Missing email, name, or password'
  exit 1
}

# --- CẤU HÌNH KẾT NỐI EXCHANGE ON-PREM ---
$ExchangeServer = $data.ExchangeServer
# Giữ nguyên định dạng domain\user cho Negotiate/NTLM auth
$UserAdmin = $data.UserAdmin
$Password = $data.AdminPassword | ConvertTo-SecureString -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($UserAdmin, $Password)

try {
    # 2. Tạo Session tới thư mục ảo PowerShell của Exchange trên IIS
    # Sử dụng Negotiate (NTLM) qua HTTP — đây là cách Exchange mặc định chấp nhận
    $SessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck

    $Session = New-PSSession `
        -ConfigurationName Microsoft.Exchange `
        -ConnectionUri "http://$ExchangeServer/PowerShell/" `
        -Authentication Negotiate `
        -Credential $Credential `
        -SessionOption $SessionOption `
        -AllowRedirection `
        -ErrorAction Stop

    # 3. Chạy lệnh New-Mailbox trực tiếp trên Session đó bằng Invoke-Command
    Invoke-Command -Session $Session -ScriptBlock {
        param($email, $name, $password)
        $secure = ConvertTo-SecureString $password -AsPlainText -Force
        New-Mailbox -UserPrincipalName $email -Name $name -Password $secure
    } -ArgumentList $data.email, $data.name, $data.password

    Write-Output "created:$($data.email)"

    # 4. Dọn dẹp session
    Remove-PSSession $Session
    exit 0

} catch {
    Write-Error "Lỗi: $($_.Exception.Message)"
    if ($Session) { Remove-PSSession $Session }
    exit 1
}
