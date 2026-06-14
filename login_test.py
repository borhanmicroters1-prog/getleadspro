"""Navigate to login and trigger Google OAuth"""
import json, asyncio, sys, io, websockets
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "2C0387C17989A4E086EE91F4C8C2159E"
WS_URL = f"ws://127.0.0.1:9222/devtools/page/{PAGE_ID}"
msg_id = 0

async def send_cdp(ws, method, params=None):
    global msg_id
    msg_id += 1
    msg = {"id": msg_id, "method": method}
    if params: msg["params"] = params
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == msg_id: return data

async def evaluate(ws, expression):
    result = await send_cdp(ws, "Runtime.evaluate", {
        "expression": expression, "returnByValue": True, "awaitPromise": True,
    })
    if "result" in result and "result" in result["result"]:
        return result["result"]["result"].get("value")
    return result

async def main():
    async with websockets.connect(WS_URL, max_size=10*1024*1024) as ws:
        url = await evaluate(ws, "window.location.href")
        print(f"URL: {url}")
        
        if "login" in str(url):
            # Click Google sign in button
            print("On login page, clicking Google sign in...")
            click_result = await evaluate(ws, """
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.toLowerCase().includes('google')) {
                        btn.click();
                        return 'Clicked Google button: ' + btn.textContent.trim();
                    }
                }
                return 'No Google button found';
            })()
            """)
            print(f"Result: {click_result}")
            
            await asyncio.sleep(8)
            
            url2 = await evaluate(ws, "window.location.href")
            print(f"After click URL: {url2}")
            
            # Check if we got redirected to dashboard
            if "dashboard" in str(url2) or "email" in str(url2):
                print("Login successful!")
                token = await evaluate(ws, "localStorage.getItem('getleads_token')")
                print(f"Token exists: {bool(token) and token != 'null'}")
            elif "google" in str(url2) or "supabase" in str(url2):
                print("Redirected to Google OAuth - waiting for user to complete login...")
                # Wait more
                await asyncio.sleep(10)
                url3 = await evaluate(ws, "window.location.href")
                print(f"After wait URL: {url3}")
        else:
            print("Not on login page")
            # Check if logged in
            token = await evaluate(ws, "localStorage.getItem('getleads_token')")
            print(f"Token: {bool(token)}")

if __name__ == "__main__":
    asyncio.run(main())
