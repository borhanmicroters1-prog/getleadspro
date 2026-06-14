"""Test CORS preflight OPTIONS request"""
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
        # Test CORS preflight manually
        test = await evaluate(ws, """
        (async function() {
            try {
                // Test OPTIONS preflight
                const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts/gmail/connect', {
                    method: 'OPTIONS',
                    headers: {
                        'Origin': 'https://getleadspro.vercel.app',
                        'Access-Control-Request-Method': 'POST',
                        'Access-Control-Request-Headers': 'authorization,content-type'
                    }
                });
                const headers = {};
                resp.headers.forEach((v, k) => { headers[k] = v; });
                return JSON.stringify({
                    status: resp.status,
                    headers: headers
                });
            } catch(e) {
                return JSON.stringify({error: e.message, type: e.name});
            }
        })()
        """)
        print(f"CORS preflight test: {test}")
        
        # Test POST with mode: cors explicitly
        test2 = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts/gmail/connect', {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        app_password: 'test-password-123',
                        from_email: 'borhanmicroters1@gmail.com',
                        from_name: 'borhanmicroters1',
                        daily_limit: 50
                    })
                });
                const text = await resp.text();
                const headers = {};
                resp.headers.forEach((v, k) => { headers[k] = v; });
                return JSON.stringify({
                    status: resp.status,
                    body: text.substring(0, 300),
                    headers: headers
                });
            } catch(e) {
                return JSON.stringify({error: e.message, type: e.name});
            }
        })()
        """)
        print(f"\nPOST with cors mode: {test2}")

if __name__ == "__main__":
    asyncio.run(main())
