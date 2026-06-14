"""Quick test of the backend API endpoints"""
import json, asyncio, sys, io, websockets
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Use the Vercel page to test API calls with auth
VERCEL_PAGE = "2C0387C17989A4E086EE91F4C8C2159E"
WS_URL = f"ws://127.0.0.1:9222/devtools/page/{VERCEL_PAGE}"
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
        r = result["result"]["result"]
        if r.get("type") == "undefined":
            return "undefined"
        return r.get("value", r.get("description", str(r)))
    return result

async def main():
    async with websockets.connect(WS_URL, max_size=10*1024*1024) as ws:
        # First check what page we're on  
        url = await evaluate(ws, "window.location.href")
        print(f"Current page: {url}")
        
        # Check if there's a token stored
        token = await evaluate(ws, "localStorage.getItem('getleads_token')")
        print(f"Token exists: {bool(token) and token != 'null' and token != 'undefined'}")
        if token and token != 'null' and token != 'undefined':
            print(f"Token (first 50 chars): {str(token)[:50]}...")
        
        # Check env var
        api_url = await evaluate(ws, """
        (function() {
            // Check what the app thinks the API URL is
            // Since this is a Next.js app, env vars are baked at build time
            return typeof window !== 'undefined' ? 
                (window.__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_API_URL || 'not in runtimeConfig') : 'no window';
        })()
        """)
        print(f"API URL from Next.js: {api_url}")
        
        # Try a direct fetch to the backend
        test_result = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;
                
                const resp = await fetch('https://getclient-backend.onrender.com/api/email-accounts', {
                    headers: headers
                });
                const text = await resp.text();
                return JSON.stringify({
                    status: resp.status,
                    statusText: resp.statusText,
                    body: text.substring(0, 500),
                    headers: Object.fromEntries([...resp.headers.entries()])
                });
            } catch(e) {
                return JSON.stringify({error: e.message, type: e.name});
            }
        })()
        """)
        print(f"\nDirect API test: {test_result}")
        
        # Also check what URL the app is actually calling
        check_env = await evaluate(ws, """
        (function() {
            // In Next.js, NEXT_PUBLIC_ vars are replaced at build time
            // Let's check if the API URL env var was baked in
            try {
                // Try to find any reference to the API URL
                const scripts = document.querySelectorAll('script');
                for (const s of scripts) {
                    if (s.textContent && s.textContent.includes('localhost:8000')) {
                        return 'FOUND localhost:8000 in script!';
                    }
                }
                return 'No localhost:8000 found in scripts';
            } catch(e) {
                return e.message;
            }
        })()
        """)
        print(f"\nEnv baked check: {check_env}")

if __name__ == "__main__":
    asyncio.run(main())
