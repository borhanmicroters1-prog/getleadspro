"""Test proxy solution from app page"""
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
        # Clear cache and hard reload
        await send_cdp(ws, "Network.enable")
        await send_cdp(ws, "Network.clearBrowserCache")
        
        # Navigate to app
        await evaluate(ws, "window.location.href = 'https://getleadspro.vercel.app/email-accounts'")
        await asyncio.sleep(5)
        
        url = await evaluate(ws, "window.location.href")
        print(f"URL: {url}")
        
        # Check if logged in
        token = await evaluate(ws, "localStorage.getItem('getleads_token')")
        has_token = token and token != 'null' and token != 'undefined'
        print(f"Has token: {has_token}")
        
        if not has_token:
            # Login first
            print("Logging in...")
            await evaluate(ws, "window.location.href = 'https://getleadspro.vercel.app/login'")
            await asyncio.sleep(3)
            click = await evaluate(ws, """
            (function() {
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    if (b.textContent.toLowerCase().includes('google')) { b.click(); return 'clicked'; }
                }
                return 'no google btn';
            })()
            """)
            print(f"Login: {click}")
            await asyncio.sleep(6)
            
            url2 = await evaluate(ws, "window.location.href")
            print(f"After login URL: {url2}")
            
            token = await evaluate(ws, "localStorage.getItem('getleads_token')")
            has_token = token and token != 'null' and token != 'undefined'
            print(f"Has token now: {has_token}")
            
            # Navigate to email-accounts
            await evaluate(ws, "window.location.href = 'https://getleadspro.vercel.app/email-accounts'")
            await asyncio.sleep(4)
        
        # Test 1: Proxy GET
        t1 = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                const r = await fetch('/api/proxy/api/email-accounts', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) { return JSON.stringify({error: e.message}); }
        })()
        """)
        print(f"\nProxy GET /api/email-accounts: {t1}")
        
        # Test 2: Proxy POST (this is the one that was failing!)
        t2 = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                const r = await fetch('/api/proxy/api/email-accounts/gmail/connect', {
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
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) { return JSON.stringify({error: e.message}); }
        })()
        """)
        print(f"\nProxy POST gmail/connect: {t2}")
        
        # Test 3: Check page for errors
        page = await evaluate(ws, """
        (function() {
            const body = document.body.innerText;
            if (body.includes('Failed to fetch')) return 'ERROR STILL VISIBLE';
            if (body.includes('Connected Mailboxes')) return 'Page loaded OK';
            return body.substring(0, 300);
        })()
        """)
        print(f"\nPage status: {page}")

if __name__ == "__main__":
    asyncio.run(main())
