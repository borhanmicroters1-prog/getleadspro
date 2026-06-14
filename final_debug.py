"""Final CORS debug - test without credentials"""
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
        print(f"Page: {url}")
        
        # Test 1: Simple GET - no auth
        t1 = await evaluate(ws, """
        (async function() {
            try {
                const r = await fetch('https://getclient-backend.onrender.com/health');
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) { return JSON.stringify({error: e.message}); }
        })()
        """)
        print(f"Test 1 (GET /health): {t1}")
        
        # Test 2: GET with auth
        t2 = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                const r = await fetch('https://getclient-backend.onrender.com/api/email-accounts', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) { return JSON.stringify({error: e.message}); }
        })()
        """)
        print(f"Test 2 (GET /api/email-accounts with auth): {t2}")
        
        # Test 3: POST with auth and JSON body
        t3 = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                const r = await fetch('https://getclient-backend.onrender.com/api/email-accounts/gmail/connect', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        app_password: 'test123',
                        from_email: 'borhanmicroters1@gmail.com',
                        from_name: 'borhanmicroters1',
                        daily_limit: 50
                    })
                });
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) { return JSON.stringify({error: e.message}); }
        })()
        """)
        print(f"Test 3 (POST gmail/connect): {t3}")
        
        # Test 4: Check console errors
        t4 = await evaluate(ws, """
        (function() {
            // Check if there's a service worker interfering
            if ('serviceWorker' in navigator) {
                return navigator.serviceWorker.controller ? 'Service worker active' : 'No active service worker';
            }
            return 'No service worker support';
        })()
        """)
        print(f"Service worker: {t4}")
        
        # Test 5: Check what the app's api.ts is resolving BASE_URL to
        # We need to intercept the actual fetch call
        t5 = await evaluate(ws, """
        (async function() {
            // Override fetch temporarily to capture URLs
            const origFetch = window.fetch;
            const captured = [];
            window.fetch = function(url, opts) {
                captured.push({url: typeof url === 'string' ? url : url.url, method: opts?.method || 'GET'});
                return origFetch.apply(this, arguments);
            };
            
            // Now try what the app would do
            try {
                const token = localStorage.getItem('getleads_token');
                // This mimics what api.ts does
                const BASE_URL = 'https://getclient-backend.onrender.com'; // this should be baked in
                const resp = await origFetch(BASE_URL + '/api/email-accounts/gmail/connect', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        app_password: 'test123',
                        from_email: 'borhanmicroters1@gmail.com',  
                        from_name: 'borhanmicroters1',
                        daily_limit: 50
                    })
                });
                const body = await resp.text();
                window.fetch = origFetch;
                return JSON.stringify({
                    status: resp.status, 
                    body: body.substring(0, 300),
                    captured: captured
                });
            } catch(e) {
                window.fetch = origFetch;
                return JSON.stringify({error: e.message, captured: captured});
            }
        })()
        """)
        print(f"Test 5 (Direct origFetch POST): {t5}")

if __name__ == "__main__":
    asyncio.run(main())
