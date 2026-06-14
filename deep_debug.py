"""Deep debug - capture actual network error"""
import json, asyncio, sys, io, websockets
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
        # Enable network tracking to see what's actually happening
        await send_cdp(ws, "Network.enable")
        
        # Try the POST with XMLHttpRequest instead of fetch to get more details
        result = await evaluate(ws, """
        (function() {
            return new Promise((resolve) => {
                const xhr = new XMLHttpRequest();
                const token = localStorage.getItem('getleads_token');
                
                xhr.onload = function() {
                    resolve(JSON.stringify({
                        status: xhr.status,
                        statusText: xhr.statusText,
                        response: xhr.responseText.substring(0, 300),
                        headers: xhr.getAllResponseHeaders()
                    }));
                };
                xhr.onerror = function(e) {
                    resolve(JSON.stringify({
                        error: 'XMLHttpRequest error',
                        readyState: xhr.readyState,
                        status: xhr.status,
                        statusText: xhr.statusText
                    }));
                };
                xhr.ontimeout = function() {
                    resolve(JSON.stringify({error: 'timeout'}));
                };
                
                xhr.open('POST', 'https://getclient-backend.onrender.com/api/email-accounts/gmail/connect', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.timeout = 15000;
                
                xhr.send(JSON.stringify({
                    app_password: 'test123',
                    from_email: 'borhanmicroters1@gmail.com',
                    from_name: 'borhanmicroters1',
                    daily_limit: 50
                }));
            });
        })()
        """)
        print(f"XHR result: {result}")
        
        # Also try a simple POST to health (should work without auth)
        result2 = await evaluate(ws, """
        (async function() {
            try {
                const r = await fetch('https://getclient-backend.onrender.com/health', {
                    method: 'POST'
                });
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) {
                return JSON.stringify({error: e.message});
            }
        })()
        """)
        print(f"\nPOST to /health: {result2}")
        
        # Try POST without auth header (to isolate CORS vs auth issue)
        result3 = await evaluate(ws, """
        (async function() {
            try {
                const r = await fetch('https://getclient-backend.onrender.com/api/email-accounts/gmail/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ app_password: 'x', from_email: 'x@x.com', from_name: 'x', daily_limit: 50 })
                });
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) {
                return JSON.stringify({error: e.message});
            }
        })()
        """)
        print(f"\nPOST without auth: {result3}")
        
        # Try a simple POST with no body and no extra headers
        result4 = await evaluate(ws, """
        (async function() {
            try {
                const r = await fetch('https://getclient-backend.onrender.com/api/email-accounts', {
                    method: 'POST'
                });
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) {
                return JSON.stringify({error: e.message});
            }
        })()
        """)
        print(f"\nSimple POST: {result4}")

if __name__ == "__main__":
    asyncio.run(main())
