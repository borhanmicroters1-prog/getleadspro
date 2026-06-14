"""Click Manual Deploy button on Render"""
import json, asyncio, sys, io, websockets
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "8B62998266C87942D488ABFC47F3167E"
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
        # Click "Manual Deploy" button
        click = await evaluate(ws, """
        (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.trim().includes('Manual Deploy')) {
                    btn.click();
                    return 'Clicked Manual Deploy';
                }
            }
            return 'No Manual Deploy button found. Buttons: ' + 
                Array.from(buttons).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 30).join(', ');
        })()
        """)
        print(f"Step 1: {click}")
        
        await asyncio.sleep(2)
        
        # Look for "Deploy latest commit" option in dropdown
        click2 = await evaluate(ws, """
        (function() {
            // Look for dropdown menu items
            const items = document.querySelectorAll('button, a, [role="menuitem"], [role="option"]');
            for (const item of items) {
                const text = item.textContent.trim().toLowerCase();
                if (text.includes('deploy latest') || text.includes('latest commit') || text.includes('deploy now')) {
                    item.click();
                    return 'Clicked: ' + item.textContent.trim();
                }
            }
            // Check all clickable elements
            const allClickable = Array.from(items).map(i => i.textContent.trim()).filter(t => t.length > 0 && t.length < 50);
            return 'Options: ' + allClickable.join(' | ');
        })()
        """)
        print(f"Step 2: {click2}")
        
        await asyncio.sleep(2)
        
        # Check if deploy started
        status = await evaluate(ws, "document.body.innerText.substring(0, 800)")
        print(f"\nPage after deploy: {status}")

if __name__ == "__main__":
    asyncio.run(main())
