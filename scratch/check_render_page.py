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
        # Reload page first to ensure it's up to date
        print("Reloading Render Dashboard page...")
        await evaluate(ws, "window.location.reload()")
        await asyncio.sleep(5)
        
        # Extract all text on page
        text = await evaluate(ws, "document.body.innerText")
        print("\n--- Render Dashboard Page Text Content ---")
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        for idx, line in enumerate(lines[:60]): # Print first 60 lines of content
            print(line)

if __name__ == "__main__":
    asyncio.run(main())
