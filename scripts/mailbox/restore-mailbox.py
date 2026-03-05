#!/usr/bin/env python3
"""Fallback script khôi phục Mailbox — dùng pypsrp."""
import sys, json
from pypsrp.powershell import PowerShell, RunspacePool
from pypsrp.wsman import WSMan

def main():
    data = json.loads(sys.stdin.read())
    email = data.get("email", "").replace("'", "''")
    if not email: print("Missing email", file=sys.stderr); sys.exit(1)

    wsman = WSMan(
        server=data.get("ExchangeServer", "mail-ex.mailex.local"), port=443, path="/PowerShell/",
        auth="negotiate", username=data.get("UserAdmin", "mailex\\Administrator"),
        password=data.get("AdminPassword", "123456a@"),
        ssl=True, cert_validation=False,
        resource_uri="http://schemas.microsoft.com/powershell/Microsoft.Exchange"
    )
    with RunspacePool(wsman, configuration_name="Microsoft.Exchange") as pool:
        ps = PowerShell(pool)
        ps.add_script(f"Enable-Mailbox -Identity '{email}' -Confirm:$false")
        ps.invoke()
        if ps.had_errors:
            print(f"Lỗi: {'; '.join(str(e) for e in ps.streams.error)}", file=sys.stderr); sys.exit(1)
        else:
            print(f"successfully_restored:{data['email']}")

if __name__ == "__main__": main()
