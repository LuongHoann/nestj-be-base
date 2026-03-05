#!/usr/bin/env python3
"""
Worker duy trì kết nối PSRP persistent tới Exchange Server.
Sử dụng pypsrp kết nối trực tiếp vào /PowerShell/ endpoint của Exchange.
Tương thích Windows (auth negotiate) và Linux.
"""
import sys
import json
import time
from pypsrp.powershell import PowerShell, RunspacePool
from pypsrp.wsman import WSMan

def create_pool(exchange_server, user_admin, admin_password):
    """Tạo RunspacePool tới Exchange PowerShell endpoint"""
    # Exchange PowerShell endpoint URI chuẩn
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
        resource_uri=resource_uri
    )
    # Configuration name cũng phải là Microsoft.Exchange
    pool = RunspacePool(wsman, configuration_name="Microsoft.Exchange")
    pool.open()
    return pool

def run_exchange_script(pool, script):
    """Chạy script PowerShell trên Exchange và trả kết quả"""
    ps = PowerShell(pool)
    ps.add_script(script)
    ps.invoke()

    output = "\n".join(str(o) for o in ps.output) if ps.output else ""
    errors = "\n".join(str(e) for e in ps.streams.error) if ps.streams.error else ""

    return {
        "had_errors": ps.had_errors,
        "output": output,
        "errors": errors,
    }

def handle_create(pool, data):
    """
    Xử lý tạo mailbox với logic an toàn và cơ chế Retry.
    """
    email = data.get("email", "").replace("'", "''")
    name = data.get("name", "").replace("'", "''")
    password = data.get("password", "").replace("'", "''")

    # Kiểm tra trạng thái hiện tại
    check_ps = f"""
        $m = Get-Mailbox -Identity '{email}' -ErrorAction SilentlyContinue
        if ($m) {{ "EXISTS" }}
        else {{
            $u = Get-User -Identity '{email}' -ErrorAction SilentlyContinue
            if ($u) {{ "USER_ONLY" }} else {{ "NONE" }}
        }}
    """
    status_res = run_exchange_script(pool, check_ps)
    status = status_res["output"].strip()

    if status == "EXISTS":
        return {"success": True, "message": f"already_exists:{email}"}

    # Thực hiện lệnh tạo phù hợp
    if status == "USER_ONLY":
        action_ps = f"Enable-Mailbox -Identity '{email}'"
    else:
        action_ps = f"$pw = ConvertTo-SecureString '{password}' -AsPlainText -Force; New-Mailbox -UserPrincipalName '{email}' -Name '{name}' -Password $pw"

    res = run_exchange_script(pool, action_ps)
    if res["had_errors"] and "already exists" not in res["errors"].lower():
        return {"success": False, "message": res["errors"]}

    # Chờ hệ thống nhận diện (Retry 3 lần, mỗi lần 2s)
    verify_ps = f"Get-Mailbox -Identity '{email}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty UserPrincipalName"
    for i in range(3):
        time.sleep(2)
        v_res = run_exchange_script(pool, verify_ps)
        if not v_res["had_errors"] and email.lower() in v_res["output"].lower():
            return {"success": True, "message": f"created:{email}"}

    return {"success": True, "message": f"created_with_delay:{email}"}

def handle_update(pool, data):
    email = data.get("email", "").replace("'", "''")
    old_email = data.get("oldEmail", "")
    name = data.get("name", "")
    is_active = data.get("isActive")

    commands = []
    if old_email and old_email != email:
        safe_old = old_email.replace("'", "''")
        commands.append(f"Set-Mailbox -Identity '{safe_old}' -PrimarySmtpAddress '{email}'")
    if name:
        safe_name = name.replace("'", "''")
        commands.append(f"Set-Mailbox -Identity '{email}' -DisplayName '{safe_name}'")
    if is_active is not None:
        if not is_active:
            commands.append(f"Disable-Mailbox -Identity '{email}' -Confirm:$false")
        else:
            commands.append(f"Enable-Mailbox -Identity '{email}' -Confirm:$false")

    if not commands:
        return {"success": True, "message": f"updated:{email}"}

    result = run_exchange_script(pool, "; ".join(commands))
    if not result["had_errors"]:
        return {"success": True, "message": f"updated:{email}"}
    else:
        return {"success": False, "message": result["errors"]}

def handle_disable(pool, data):
    email = data.get("email", "").replace("'", "''")
    result = run_exchange_script(pool, f"Disable-Mailbox -Identity '{email}' -Confirm:$false")
    if not result["had_errors"]:
        return {"success": True, "message": f"successfully_disabled:{email}"}
    else:
        return {"success": False, "message": result["errors"]}

def handle_restore(pool, data):
    email = data.get("email", "").replace("'", "''")
    result = run_exchange_script(pool, f"Enable-Mailbox -Identity '{email}' -Confirm:$false")
    if not result["had_errors"]:
        return {"success": True, "message": f"successfully_restored:{email}"}
    else:
        return {"success": False, "message": result["errors"]}

def handle_delete(pool, data):
    email = data.get("email", "").replace("'", "''")
    result = run_exchange_script(pool, f"Remove-Mailbox -Identity '{email}' -Permanent $true -Confirm:$false")
    if not result["had_errors"]:
        return {"success": True, "message": f"successfully_deleted:{email}"}
    else:
        return {"success": False, "message": result["errors"]}

HANDLERS = {
    "create": handle_create,
    "update": handle_update,
    "disable": handle_disable,
    "restore": handle_restore,
    "delete": handle_delete,
}

def main():
    pool = None
    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        try:
            data = json.loads(line)
        except: continue

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

        handler = HANDLERS.get(action)
        if handler:
            try:
                response = handler(pool, data)
            except Exception as e:
                try: pool.close()
                except: pass
                pool = None
                response = {"success": False, "message": f"Error: {str(e)}"}
        else:
            response = {"success": False, "message": f"Unknown action: {action}"}
        print(json.dumps(response), flush=True)

if __name__ == "__main__":
    main()
