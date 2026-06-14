import json, asyncio, sys, io, websockets, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "2C0387C17989A4E086EE91F4C8C2159E"  
WS_URL = f"ws://127.0.0.1:9222/devtools/page/{PAGE_ID}"
msg_id = 0

async def send_cdp(ws, method, params=None):
    global msg_id; msg_id += 1
    msg = {"id": msg_id, "method": method}
    if params: msg["params"] = params
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == msg_id: return data

async def evaluate(ws, expression):
    result = await send_cdp(ws, "Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    if "result" in result and "result" in result["result"]:
        return result["result"]["result"].get("value")
    return result

async def main():
    async with websockets.connect(WS_URL, max_size=10*1024*1024) as ws:
        token = await evaluate(ws, "localStorage.getItem('getleads_token')")
        print(f"Retrieved token: {str(token)[:40]}...")
        
        payload = {
            "app_password": "test-password-123",
            "from_email": "borhanmicroters1@gmail.com",
            "from_name": "borhanmicroters1",
            "daily_limit": 50
        }
        data_bytes = json.dumps(payload).encode('utf-8')
        
        # Test 1: Direct POST to Render backend
        print("\n--- Testing Direct POST to Render Backend ---")
        req_direct = urllib.request.Request(
            "https://getclient-backend.onrender.com/api/email-accounts/gmail/connect",
            data=data_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req_direct) as response:
                print(f"Direct Response Status: {response.status}")
                print(f"Direct Response Headers: {dict(response.headers)}")
                print(f"Direct Response Body: {response.read().decode('utf-8')}")
        except urllib.error.HTTPError as e:
            print(f"Direct HTTPError: {e.code} - {e.reason}")
            try:
                print(f"Direct HTTPError Body: {e.read().decode('utf-8')}")
            except Exception:
                pass
        except Exception as e:
            print(f"Direct Exception: {e}")

        # Test 2: Proxy POST to Vercel
        print("\n--- Testing Proxy POST to Vercel ---")
        req_proxy = urllib.request.Request(
            "https://getleadspro.vercel.app/api/proxy/api/email-accounts/gmail/connect",
            data=data_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req_proxy) as response:
                print(f"Proxy Response Status: {response.status}")
                print(f"Proxy Response Headers: {dict(response.headers)}")
                print(f"Proxy Response Body: {response.read().decode('utf-8')}")
        except urllib.error.HTTPError as e:
            print(f"Proxy HTTPError: {e.code} - {e.reason}")
            try:
                print(f"Proxy HTTPError Body: {e.read().decode('utf-8')}")
            except Exception:
                pass
        except Exception as e:
            print(f"Proxy Exception: {e}")

if __name__ == "__main__":
    asyncio.run(main())
