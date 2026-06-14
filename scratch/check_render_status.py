import json
import asyncio
import sys
import io
import websockets

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "8A3D75A7DFDD242E72AF36AC6F879A14"
WS_URL = f"ws://localhost:9222/devtools/page/{PAGE_ID}"
msg_id = 0

async def send_cdp(ws, method, params=None):
    global msg_id
    msg_id += 1
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == msg_id:
            return data

async def evaluate(ws, expression):
    result = await send_cdp(ws, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True
    })
    if "result" in result and "result" in result["result"]:
        return result["result"]["result"].get("value")
    return result

async def main():
    async with websockets.connect(WS_URL, max_size=10*1024*1024) as ws:
        url = await evaluate(ws, "window.location.href")
        print(f"Current URL: {url}")
        
        # Navigate to events page if not there
        if "events" not in url:
            print("Navigating to events log on Render...")
            await evaluate(ws, "window.location.href = 'https://dashboard.render.com/web/srv-d8mig86rnols73cm2e2g/events'")
            await asyncio.sleep(4)
        
        print("Checking Render deployment events...")
        content = await evaluate(ws, """
        (function() {
            const text = document.body.innerText;
            return text.substring(0, 2500);
        })()
        """)
        print(f"\nRender Events Page Content:\n{content}")

if __name__ == "__main__":
    asyncio.run(main())
