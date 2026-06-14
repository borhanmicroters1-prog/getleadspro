import asyncio
import subprocess
import time
import urllib.request
import json
import socket
import sys

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

async def main():
    # 1. Start local uvicorn server in backend folder
    import os
    env = os.environ.copy()
    env["PYTHONPATH"] = "app"
    env["DATABASE_URL"] = "postgresql+asyncpg://postgres.grdqjnazfdznbviopmxf:Borhan282065@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

    print(f"Starting local backend server using Python: {sys.executable}")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8005"],
        cwd="backend",
        env=env
    )
    
    # Wait for server to start
    for _ in range(10):
        if is_port_open(8005):
            print("Local backend server started on port 8005.")
            break
        time.sleep(1)
    else:
        print("Failed to start local server.")
        proc.terminate()
        return

    try:
        import websockets
        PAGE_ID = "2C0387C17989A4E086EE91F4C8C2159E"
        WS_URL = f"ws://127.0.0.1:9222/devtools/page/{PAGE_ID}"
        
        token = None
        async with websockets.connect(WS_URL) as ws:
            # Get token
            msg_id = 1
            msg = {"id": msg_id, "method": "Runtime.evaluate", "params": {"expression": "localStorage.getItem('getleads_token')", "returnByValue": True}}
            await ws.send(json.dumps(msg))
            resp = await ws.recv()
            data = json.loads(resp)
            token = data.get("result", {}).get("result", {}).get("value")
            
            # Fetch campaigns from local server
            req = urllib.request.Request(
                "http://127.0.0.1:8005/api/campaigns",
                headers={"Authorization": f"Bearer {token}"}
            )
            with urllib.request.urlopen(req) as r:
                campaigns = json.loads(r.read().decode('utf-8'))
                
            if len(campaigns) < 2:
                print("Creating test campaigns...")
                # Create Campaign A
                req_a = urllib.request.Request(
                    "http://127.0.0.1:8005/api/campaigns",
                    data=json.dumps({"name": "Local Campaign A"}).encode('utf-8'),
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req_a) as r:
                    json.loads(r.read().decode('utf-8'))
                # Create Campaign B
                req_b = urllib.request.Request(
                    "http://127.0.0.1:8005/api/campaigns",
                    data=json.dumps({"name": "Local Campaign B"}).encode('utf-8'),
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req_b) as r:
                    json.loads(r.read().decode('utf-8'))
                
                # Refresh campaigns
                req = urllib.request.Request(
                    "http://127.0.0.1:8005/api/campaigns",
                    headers={"Authorization": f"Bearer {token}"}
                )
                with urllib.request.urlopen(req) as r:
                    campaigns = json.loads(r.read().decode('utf-8'))
            
            camp_a = campaigns[0]
            camp_b = campaigns[1]
            print(f"Camp A: {camp_a['name']} ({camp_a['id']})")
            print(f"Camp B: {camp_b['name']} ({camp_b['id']})")
            
            # Form multipart form-data request for CSV upload
            import uuid
            test_email = f"local_scoped_test_{uuid.uuid4().hex[:6]}@gmail.com"
            print(f"Testing with email: {test_email}")
            
            boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="leads.csv"\r\n'
                f"Content-Type: text/csv\r\n\r\n"
                f"email,name,company\r\n{test_email},Local Lead,Local Inc\r\n"
                f"--{boundary}--\r\n"
            ).encode('utf-8')
            
            # Upload 1: to Camp A
            print("\nUploading to Camp A...")
            req_upload1 = urllib.request.Request(
                f"http://127.0.0.1:8005/api/leads/upload?campaign_id={camp_a['id']}",
                data=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": f"multipart/form-data; boundary={boundary}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req_upload1) as r:
                res1 = json.loads(r.read().decode('utf-8'))
                print("Upload 1 response:", res1)
                
            # Upload 2: to Camp B
            print("\nUploading to Camp B...")
            req_upload2 = urllib.request.Request(
                f"http://127.0.0.1:8005/api/leads/upload?campaign_id={camp_b['id']}",
                data=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": f"multipart/form-data; boundary={boundary}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req_upload2) as r:
                res2 = json.loads(r.read().decode('utf-8'))
                print("Upload 2 response:", res2)
                
    finally:
        print("Stopping local backend server...")
        proc.terminate()
        proc.wait()
        print("Server stopped.")

if __name__ == "__main__":
    asyncio.run(main())
