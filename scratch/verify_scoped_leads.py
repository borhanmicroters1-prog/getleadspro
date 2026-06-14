import json, asyncio, sys, io, websockets, uuid

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
        
        # 1. Fetch campaigns
        campaigns_data = await evaluate(ws, """
        (async function() {
            const r = await fetch('/api/proxy/api/campaigns', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('getleads_token') }
            });
            return await r.text();
        })()
        """)
        campaigns = json.loads(campaigns_data)
        print(f"Active campaigns count: {len(campaigns)}")
        
        while len(campaigns) < 2:
            num = len(campaigns) + 1
            print(f"Creating campaign {num} for testing...")
            new_camp = await evaluate(ws, f"""
            (async function() {{
                const r = await fetch('/api/proxy/api/campaigns', {{
                    method: 'POST',
                    headers: {{
                        'Authorization': 'Bearer ' + localStorage.getItem('getleads_token'),
                        'Content-Type': 'application/json'
                    }},
                    body: JSON.stringify({{ name: 'Campaign {num} Scoped Test' }})
                }});
                return await r.text();
            }})()
            """)
            print(f"Created campaign {num}: {new_camp}")
            
            # Refresh campaigns
            campaigns_data = await evaluate(ws, """
            (async function() {
                const r = await fetch('/api/proxy/api/campaigns', {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('getleads_token') }
                });
                return await r.text();
            })()
            """)
            campaigns = json.loads(campaigns_data)
        
        camp1 = campaigns[0]
        camp2 = campaigns[1]
        print(f"Campaign 1: {camp1['name']} (ID: {camp1['id']})")
        print(f"Campaign 2: {camp2['name']} (ID: {camp2['id']})")
        
        test_email = f"dup_scoped_test_{uuid.uuid4().hex[:6]}@gmail.com"
        print(f"Testing with unique email: {test_email}")
        
        # 2. Upload CSV to Campaign 1
        print(f"\n--- Uploading lead to Campaign 1 ({camp1['name']}) ---")
        res1 = await evaluate(ws, f"""
        (async function() {{
            const token = localStorage.getItem('getleads_token');
            const csvContent = "email,name,company\\n{test_email},Test Scoped Lead,Scope LLC";
            const blob = new Blob([csvContent], {{ type: 'text/csv' }});
            const formData = new FormData();
            formData.append('file', blob, 'scoped_leads.csv');
            
            const r = await fetch('/api/proxy/api/leads/upload?campaign_id={camp1['id']}', {{
                method: 'POST',
                headers: {{ 'Authorization': 'Bearer ' + token }},
                body: formData
            }});
            return JSON.stringify({{status: r.status, body: await r.text()}});
        }})()
        """)
        print(f"Campaign 1 upload result: {res1}")
        
        # 3. Upload CSV to Campaign 2 with same email
        print(f"\n--- Uploading SAME lead to Campaign 2 ({camp2['name']}) ---")
        res2 = await evaluate(ws, f"""
        (async function() {{
            const token = localStorage.getItem('getleads_token');
            const csvContent = "email,name,company\\n{test_email},Test Scoped Lead,Scope LLC";
            const blob = new Blob([csvContent], {{ type: 'text/csv' }});
            const formData = new FormData();
            formData.append('file', blob, 'scoped_leads.csv');
            
            const r = await fetch('/api/proxy/api/leads/upload?campaign_id={camp2['id']}', {{
                method: 'POST',
                headers: {{ 'Authorization': 'Bearer ' + token }},
                body: formData
            }});
            return JSON.stringify({{status: r.status, body: await r.text()}});
        }})()
        """)
        print(f"Campaign 2 upload result: {res2}")

if __name__ == "__main__":
    asyncio.run(main())
