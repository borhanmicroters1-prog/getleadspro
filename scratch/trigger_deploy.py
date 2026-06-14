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
        # 1. Click Manual Deploy button
        print("Clicking Manual Deploy button...")
        click_res = await evaluate(ws, """
        (function() {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(x => x.textContent.trim().includes('Manual Deploy'));
            if (b) {
                b.click();
                return 'Clicked!';
            }
            return 'Not found';
        })()
        """)
        print("Click result:", click_res)
        await asyncio.sleep(2)
        
        # 2. Print options in the dropdown and click the deploy one
        print("Clicking deployment option in dropdown...")
        menu_click_res = await evaluate(ws, """
        (function() {
            const items = Array.from(document.querySelectorAll('button, a, [role="menuitem"]'));
            // Look for exact matches to deploy
            const target = items.find(x => {
                const text = x.textContent.trim().toLowerCase();
                return text === 'deploy latest commit' || text === 'clear build cache & deploy';
            });
            if (target) {
                target.click();
                return 'Clicked: ' + target.textContent.trim();
            }
            // Fallback list of options
            return 'Target not found. Interactive items: ' + JSON.stringify(items.map(x => x.textContent.trim()).filter(x => x.length > 0));
        })()
        """)
        print("Menu click result:", menu_click_res)

if __name__ == "__main__":
    asyncio.run(main())
