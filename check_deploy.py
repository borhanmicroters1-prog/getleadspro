"""Check Render deployment status via CDP"""
import json, asyncio, sys, io, websockets
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "8B62998266C87942D488ABFC47F3167E"
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
        # Navigate to events/logs page
        await evaluate(ws, "window.location.href = 'https://dashboard.render.com/web/srv-d8mig86rnols73cm2e2g/events'")
        await asyncio.sleep(4)
        
        title = await evaluate(ws, "document.title")
        print(f"Page: {title}")
        
        # Get deployment status from the page
        status = await evaluate(ws, """
        (function() {
            const text = document.body.innerText;
            // Find deploy-related lines
            const lines = text.split('\\n').filter(l => 
                l.toLowerCase().includes('deploy') || 
                l.toLowerCase().includes('live') ||
                l.toLowerCase().includes('build') ||
                l.toLowerCase().includes('failed') ||
                l.toLowerCase().includes('started') ||
                l.toLowerCase().includes('in progress')
            ).slice(0, 15);
            return lines.join('\\n');
        })()
        """)
        print(f"\\nDeploy status:\\n{status}")
        
        # Also check for any error indicators
        errors = await evaluate(ws, """
        (function() {
            const badges = document.querySelectorAll('[class*="badge"], [class*="status"], [class*="chip"], [role="status"]');
            const result = [];
            badges.forEach(b => result.push(b.textContent.trim()));
            return result.join(' | ');
        })()
        """)
        print(f"\\nStatus badges: {errors}")

if __name__ == "__main__":
    asyncio.run(main())
