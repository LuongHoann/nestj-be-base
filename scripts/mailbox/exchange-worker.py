#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Exchange Worker - Ket noi PSRP/WinRM toi Exchange Server.
Tuong thich hoan hao voi pypsrp 0.9.0 stable.

SU DUNG BÍ QUYẾT: TaggedValue("SS", password)
pypsrp 0.9.0 khong co PSSecureString ngoai mat, nhung thuc chat loi Serializer
cua no ho tro the <SS> (SecureString) bang cach dung TaggedValue(). 
Cach nay ma hoa mat khau truc tiep bang AES/PKCS7 qua SessionKey cua RunspacePool 
phia client (Python) roi gui thang vao Exchange ma khong can bat ky cmdlet nao
thuoc Microsoft.PowerShell.Security nhu ConvertTo-SecureString xep hang tren server.
"""
import sys
import json
import time
from pypsrp.powershell import PowerShell, RunspacePool
from pypsrp.wsman import WSMan
from pypsrp.serializer import TaggedValue

def create_pool(exchange_server, user_admin, admin_password):
    """Ket noi truc tiep vao Exchange endpoint (/PowerShell/)."""
    resource_uri = "http://schemas.microsoft.com/powershell/Microsoft.Exchange"
    wsman = WSMan(
        server=exchange_server,
        port=443,
        path="/PowerShell/",
        auth="negotiate",
        username=user_admin,
        password=admin_password,
        ssl=True,
        cert_validation=False,
        resource_uri=resource_uri,
    )
    pool = RunspacePool(wsman, configuration_name="Microsoft.Exchange")
    pool.open()
    # PSRP Protocol yeu cau exchange key de ma hoa SecureString phia client.
    # Phải gọi hàm này trước khi dùng TaggedValue("SS")
    pool.exchange_keys()
    return pool

def run_cmdlet(pool, cmdlet_name, params=None):
    """Chay Exchange cmdlet qua pypsrp trong ConstrainedLanguage mode."""
    ps = PowerShell(pool)
    cmd = ps.add_cmdlet(cmdlet_name)
    if params:
        for key, value in params.items():
            if value is not None:
                cmd.add_parameter(key, value)
    ps.invoke()
    return ps.output, ps.streams.error, ps.had_errors

def handle_create(pool, data):
    email = data.get("email", "")
    name = data.get("name", "")
    password = data.get("password", "")

    mb_output, _, _ = run_cmdlet(pool, "Get-Mailbox", {
        "Identity": email, "ErrorAction": "SilentlyContinue",
    })
    if mb_output:
        return {"success": True, "message": f"already_exists:{email}"}

    user_output, _, _ = run_cmdlet(pool, "Get-User", {
        "Identity": email, "ErrorAction": "SilentlyContinue",
    })
    if user_output:
        _, errors, had_errors = run_cmdlet(pool, "Enable-Mailbox", {"Identity": email})
        if had_errors:
            err_msg = str(errors[0]) if errors else "Unknown error"
            return {"success": False, "message": err_msg}
        return {"success": True, "message": f"created:{email}"}

    # "Bí mật" nằm ở đây: Gói chuỗi văn bản thành TaggedValue("SS", ...)
    # pypsrp sẽ tự biết đây là SecureString và mã hóa nó trước khi gửi qua mạng!
    secure_pwd = TaggedValue("SS", password)

    _, errors, had_errors = run_cmdlet(pool, "New-Mailbox", {
        "UserPrincipalName": email, 
        "Name": name, 
        "Password": secure_pwd,
    })
    
    if had_errors:
        err_msg = str(errors[0]) if errors else "Unknown error"
        if "already exists" in err_msg.lower():
            return {"success": True, "message": f"already_exists:{email}"}
        return {"success": False, "message": err_msg}

    for _ in range(3):
        time.sleep(2)
        verify_output, _, _ = run_cmdlet(pool, "Get-Mailbox", {
            "Identity": email, "ErrorAction": "SilentlyContinue",
        })
        if verify_output:
            return {"success": True, "message": f"created:{email}"}
            
    return {"success": True, "message": f"created_with_delay:{email}"}

def handle_update(pool, data):
    email = data.get("email", "")
    old_email = data.get("oldEmail", "")
    name = data.get("name", "")
    is_active = data.get("isActive")

    if old_email and old_email != email:
        _, errors, had_errors = run_cmdlet(pool, "Set-Mailbox", {
            "Identity": old_email, "PrimarySmtpAddress": email,
        })
        if had_errors:
            return {"success": False, "message": str(errors[0]) if errors else "Unknown"}
            
    if name:
        _, errors, had_errors = run_cmdlet(pool, "Set-Mailbox", {
            "Identity": email, "DisplayName": name,
        })
        if had_errors:
            return {"success": False, "message": str(errors[0]) if errors else "Unknown"}
            
    if is_active is not None:
        cmdlet = "Enable-Mailbox" if is_active else "Disable-Mailbox"
        params = {"Identity": email}
        if not is_active:
            params["Confirm"] = False
        _, errors, had_errors = run_cmdlet(pool, cmdlet, params)
        if had_errors:
            return {"success": False, "message": str(errors[0]) if errors else "Unknown"}
            
    return {"success": True, "message": f"updated:{email}"}

def handle_disable(pool, data):
    email = data.get("email", "")
    _, errors, had_errors = run_cmdlet(pool, "Disable-Mailbox", {
        "Identity": email, "Confirm": False,
    })
    if had_errors:
        return {"success": False, "message": str(errors[0]) if errors else "Unknown"}
    return {"success": True, "message": f"successfully_disabled:{email}"}

def handle_restore(pool, data):
    email = data.get("email", "")
    _, errors, had_errors = run_cmdlet(pool, "Enable-Mailbox", {
        "Identity": email, "Confirm": False,
    })
    if had_errors:
        return {"success": False, "message": str(errors[0]) if errors else "Unknown"}
    return {"success": True, "message": f"successfully_restored:{email}"}

def handle_delete(pool, data):
    email = data.get("email", "")
    # Remove-Mailbox -Identity ... -Confirm:$false se xoa ca Mailbox va User AD.
    # Tham so -Permanent chi dung cho Soft-Deleted mailbox, dung cho mailbox active se gay loi binding.
    _, errors, had_errors = run_cmdlet(pool, "Remove-Mailbox", {
        "Identity": email, "Confirm": False,
    })
    if had_errors:
        err_msg = str(errors[0]) if errors else "Unknown error"
        # Neu mailbox khong ton tai tren Exchange, chung ta van coi nhu thanh cong de xoa DB
        if "wasn't found" in err_msg.lower() or "không tìm thấy" in err_msg.lower():
             return {"success": True, "message": f"not_found_on_exchange_but_proceed:{email}"}
        return {"success": False, "message": err_msg}
    return {"success": True, "message": f"successfully_deleted:{email}"}

def main():
    pool = None
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except Exception:
            continue

        action = data.get("action", "")

        if pool is None:
            exchange_server = data.get("ExchangeServer", "mail-ex.mailex.local")
            user_admin = data.get("UserAdmin", "mailex\\Administrator")
            admin_password = data.get("AdminPassword", "123456a@")
            try:
                pool = create_pool(exchange_server, user_admin, admin_password)
            except Exception as e:
                print(json.dumps({"success": False, "message": f"PSRP connection failed: {str(e)}"}), flush=True)
                continue

        handlers = {
            "create": handle_create,
            "update": handle_update,
            "disable": handle_disable,
            "restore": handle_restore,
            "delete": handle_delete,
        }

        handler = handlers.get(action)
        if handler:
            try:
                response = handler(pool, data)
            except Exception as e:
                try:
                    pool.close()
                except Exception:
                    pass
                pool = None
                response = {"success": False, "message": f"Error: {str(e)}"}
        else:
            response = {"success": False, "message": f"Unknown action: {action}"}

        print(json.dumps(response), flush=True)

if __name__ == "__main__":
    main()
