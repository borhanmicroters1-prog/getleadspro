"""Debug the actual API call from user's app page"""
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
        print(f"Current page: {url}")
        
        # Check what BASE_URL the app is actually using
        # Since NEXT_PUBLIC_ vars are replaced at build time, we need to check the bundled JS
        check_api = await evaluate(ws, """
        (async function() {
            // Try calling the API directly to see what happens
            const token = localStorage.getItem('getleads_token');
            const results = {};
            
            // Test 1: Direct call to Render backend
            try {
                const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts', {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {}
                });
                results.render_direct = { status: resp.status, body: (await resp.text()).substring(0, 200) };
            } catch(e) {
                results.render_direct = { error: e.message };
            }
            
            // Test 2: Call to localhost (what old cached code might be doing)
            try {
                const resp = await fetch('http://localhost:8000/api/email-accounts', {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
                    signal: AbortSignal.timeout(3000)
                });
                results.localhost = { status: resp.status, body: (await resp.text()).substring(0, 200) };
            } catch(e) {
                results.localhost = { error: e.message };
            }
            
            results.has_token = !!token;
            results.token_preview = token ? token.substring(0, 30) + '...' : null;
            
            return JSON.stringify(results);
        })()
        """)
        print(f"\nAPI test results: {check_api}")
        
        # Also check the page for error messages
        error_check = await evaluate(ws, """
        (function() {
            const body = document.body.innerText;
            if (body.includes('Failed to fetch')) return 'ERROR: Failed to fetch visible on page';
            if (body.includes('error')) return 'Some error on page';
            return 'No error visible';
        })()
        """)
        print(f"\nPage error: {error_check}")
        
        # Try submitting the Gmail connect form via the API directly
        print("\n--- Testing Gmail connect directly ---")
        gmail_test = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                if (!token) return JSON.stringify({error: 'No token'});
                
                const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts/gmail/connect', {
                    method: 'POST',
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
                return JSON.stringify({status: resp.status, body: text.substring(0, 300)});
            } catch(e) {
                return JSON.stringify({error: e.message, type: e.name});
            }
        })()
        """)
        print(f"Gmail connect test: {gmail_test}")

if __name__ == "__main__":
    asyncio.run(main())
