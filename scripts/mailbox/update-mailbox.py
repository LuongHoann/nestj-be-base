#!/usr/bin/env python3
"""Fallback script cập nhật Mailbox — dùng pypsrp."""
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
    cmds = []
    old_email = data.get("oldEmail", "")
    name = data.get("name", "")
    is_active = data.get("isActive")
    if old_email and old_email != email:
        cmds.append(f"Set-Mailbox -Identity '{old_email.replace(chr(39), chr(39)*2)}' -PrimarySmtpAddress '{email}'")
    if name:
        cmds.append(f"Set-Mailbox -Identity '{email}' -DisplayName '{name.replace(chr(39), chr(39)*2)}'")
    if is_active is not None and not is_active:
        cmds.append(f"Disable-Mailbox -Identity '{email}' -Confirm:$false")
    if not cmds: print(f"updated:{data['email']}"); return

    with RunspacePool(wsman, configuration_name="Microsoft.Exchange") as pool:
        ps = PowerShell(pool)
        ps.add_script("; ".join(cmds))
        ps.invoke()
        if ps.had_errors:
            print(f"Lỗi: {'; '.join(str(e) for e in ps.streams.error)}", file=sys.stderr); sys.exit(1)
        else:
            print(f"updated:{data['email']}")

if __name__ == "__main__": main()
