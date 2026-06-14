import json
import asyncio
import urllib.request
import websockets
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

async def send_cdp(ws, msg_id, method, params=None):
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    await ws.send(json.dumps(msg))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == msg_id:
            return data

async def evaluate(ws, msg_id, expression):
    result = await send_cdp(ws, msg_id, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True
    })
    if "result" in result and "result" in result["result"]:
        return result["result"]["result"].get("value")
    return result

async def main():
    print("Fetching active Chrome tabs...")
    response = urllib.request.urlopen("http://localhost:9222/json")
    tabs = json.loads(response.read().decode())
    
    # Find Render dashboard tab
    render_tab = None
    for tab in tabs:
        url = tab.get("url", "")
        if "dashboard.render.com" in url and "srv-d8mig86rnols73cm2e2g" in url:
            render_tab = tab
            break
            
    if not render_tab:
        print("No active Render dashboard tab found in Chrome.")
        return
        
    ws_url = render_tab["webSocketDebuggerUrl"]
    print(f"Connecting to Render tab: {render_tab['title']} ({tab['id']})")
    
    async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
        url = await evaluate(ws, 1, "window.location.href")
        print(f"Current tab URL: {url}")
        
        # Navigate to events page if not there
        if "events" not in url:
            print("Navigating to events page...")
            await evaluate(ws, 2, "window.location.href = 'https://dashboard.render.com/web/srv-d8mig86rnols73cm2e2g/events'")
            await asyncio.sleep(4)
            
        # Check status
        content = await evaluate(ws, 3, """
        (function() {
            const text = document.body.innerText;
            return text.substring(0, 1500);
        })()
        """)
        print(f"\nRender Events Content:\n{content}")

if __name__ == "__main__":
    asyncio.run(main())
