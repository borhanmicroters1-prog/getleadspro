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
        
        # We will make a multipart/form-data upload using standard python library or directly in the browser using JS fetch
        test_js = await evaluate(ws, """
        (async function() {
            try {
                const token = localStorage.getItem('getleads_token');
                
                // Create a mock CSV file
                const csvContent = "email,name,company\\ntest_lead_unassigned1@gmail.com,Test Unassigned 1,Acme Corp\\ntest_lead_unassigned2@gmail.com,Test Unassigned 2,Beta LLC";
                const blob = new Blob([csvContent], { type: 'text/csv' });
                
                const formData = new FormData();
                formData.append('file', blob, 'test_leads.csv');
                
                // Call the proxy endpoint WITHOUT campaign_id
                const r = await fetch('/api/proxy/api/leads/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    body: formData
                });
                
                return JSON.stringify({status: r.status, body: await r.text()});
            } catch(e) { return JSON.stringify({error: e.message}); }
        })()
        """)
        
        print(f"Upload without Campaign Result: {test_js}")

if __name__ == "__main__":
    asyncio.run(main())
