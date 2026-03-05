#!/usr/bin/env python3
"""
Fallback script tạo Mailbox — dùng pypsrp kết nối trực tiếp /PowerShell/ endpoint.
"""
import sys
import json
from pypsrp.powershell import PowerShell, RunspacePool
from pypsrp.wsman import WSMan

def main():
    input_data = sys.stdin.read()
    if not input_data:
        print("No input provided", file=sys.stderr)
        sys.exit(1)

    data = json.loads(input_data)
    email = data.get("email", "").replace("'", "''")
    name = data.get("name", "").replace("'", "''")
    password = data.get("password", "").replace("'", "''")

    if not email or not name or not password:
        print("Missing email, name, or password", file=sys.stderr)
        sys.exit(1)

    exchange_server = data.get("ExchangeServer", "mail-ex.mailex.local")
    user_admin = data.get("UserAdmin", "mailex\\Administrator")
    admin_password = data.get("AdminPassword", "123456a@")

    wsman = WSMan(
        server=exchange_server, port=443, path="/PowerShell/",
        auth="negotiate", username=user_admin, password=admin_password,
        ssl=True, cert_validation=False,
        resource_uri="http://schemas.microsoft.com/powershell/Microsoft.Exchange"
    )
    with RunspacePool(wsman, configuration_name="Microsoft.Exchange") as pool:
        ps = PowerShell(pool)
        ps.add_script(f"""
            $secure = ConvertTo-SecureString '{password}' -AsPlainText -Force
            New-Mailbox -UserPrincipalName '{email}' -Name '{name}' -Password $secure
        """)
        ps.invoke()

        if ps.had_errors:
            errors = "\n".join(str(e) for e in ps.streams.error)
            print(f"Lỗi: {errors}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"created:{data['email']}")

if __name__ == "__main__":
    main()
