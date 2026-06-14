"""Navigate to app and test API from there"""
import json, asyncio, sys, io, websockets
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Use Vercel page tab - navigate it to the app
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
        # Navigate to the app
        print("Navigating to getleadspro.vercel.app...")
        await evaluate(ws, "window.location.href = 'https://getleadspro.vercel.app/email-accounts'")
        await asyncio.sleep(5)
        
        url = await evaluate(ws, "window.location.href")
        print(f"Current URL: {url}")
        
        # Check for errors in console
        # Enable console monitoring
        await send_cdp(ws, "Runtime.enable")
        await send_cdp(ws, "Console.enable")
        
        # Check token
        token = await evaluate(ws, "localStorage.getItem('getleads_token')")
        has_token = token and token != 'null' and token != 'undefined'
        print(f"Has auth token: {has_token}")
        
        if has_token:
            # Test direct API call with token
            test = await evaluate(ws, """
            (async function() {
                try {
                    const token = localStorage.getItem('getleads_token');
                    const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const text = await resp.text();
                    return JSON.stringify({
                        status: resp.status,
                        body: text.substring(0, 500),
                        ok: resp.ok
                    });
                } catch(e) {
                    return JSON.stringify({error: e.message, name: e.name});
                }
            })()
            """)
            print(f"\nAPI test with token: {test}")
            
            # Check what URL the app is using for API calls
            api_url_check = await evaluate(ws, """
            (async function() {
                try {
                    // Try calling the health endpoint
                    const resp = await fetch('https://getclient-backend.onrender.com/health');
                    const data = await resp.json();
                    return JSON.stringify({health: data, status: resp.status});
                } catch(e) {
                    return JSON.stringify({error: e.message});
                }
            })()
            """)
            print(f"\nHealth check from app: {api_url_check}")
        else:
            print("No auth token - user might need to login first on the app")
            # Check if we're on login page
            page_text = await evaluate(ws, "document.body.innerText.substring(0, 500)")
            print(f"\nPage content: {page_text}")
            
            # Try health check anyway
            health = await evaluate(ws, """
            (async function() {
                try {
                    const resp = await fetch('https://getclient-backend.onrender.com/health');
                    const data = await resp.json();
                    return JSON.stringify(data);
                } catch(e) {
                    return JSON.stringify({error: e.message});
                }
            })()
            """)
            print(f"\nHealth from app context: {health}")

if __name__ == "__main__":
    asyncio.run(main())
