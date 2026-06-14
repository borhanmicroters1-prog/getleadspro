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
        print("No active Render dashboard tab found.")
        return
        
    ws_url = render_tab["webSocketDebuggerUrl"]
    print(f"Connecting to Render tab ID: {tab['id']}")
    
    async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
        url = await evaluate(ws, 1, "window.location.href")
        print(f"Current tab URL: {url}")
        
        # Navigate to logs page
        print("Navigating to Render logs page...")
        await evaluate(ws, 2, "window.location.href = 'https://dashboard.render.com/web/srv-d8mig86rnols73cm2e2g/logs'")
        
        # Wait for logs to load
        print("Waiting for logs to load...")
        await asyncio.sleep(8)
        
        # Read the logs container
        logs_text = await evaluate(ws, 3, """
        (function() {
            // Locate logs elements - often pre, code, or divs inside log container
            const pre = document.querySelector('pre');
            if (pre) return pre.innerText.substring(0, 3000);
            
            // Fallback - read body text
            return document.body.innerText.substring(0, 3000);
        })()
        """)
        print(f"\nRender Live Logs:\n{logs_text}")

if __name__ == "__main__":
    asyncio.run(main())
