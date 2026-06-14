"""Hard refresh the app page and clear cache"""
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
        # Clear cache
        await send_cdp(ws, "Network.enable")
        await send_cdp(ws, "Network.clearBrowserCache")
        print("Browser cache cleared!")
        
        # Navigate to app
        await evaluate(ws, "window.location.href = 'https://getleadspro.vercel.app/email-accounts'")
        await asyncio.sleep(5)
        
        url = await evaluate(ws, "window.location.href")
        print(f"URL: {url}")
        
        # Check token
        token = await evaluate(ws, "localStorage.getItem('getleads_token')")
        has_token = token and token != 'null' and token != 'undefined'
        print(f"Has token: {has_token}")
        
        if has_token:
            # Test API call
            result = await evaluate(ws, """
            (async function() {
                try {
                    const token = localStorage.getItem('getleads_token');
                    const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const text = await resp.text();
                    return JSON.stringify({status: resp.status, body: text.substring(0, 300)});
                } catch(e) {
                    return JSON.stringify({error: e.message});
                }
            })()
            """)
            print(f"API result: {result}")
        else:
            print("Redirected to login - need to login first")
            # Check page
            page = await evaluate(ws, "document.body.innerText.substring(0, 200)")
            print(f"Page: {page}")

if __name__ == "__main__":
    asyncio.run(main())
