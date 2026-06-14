import json
import asyncio
import urllib.request
import websockets

SERVICE_URL = "https://dashboard.render.com/web/srv-d8mig86rnols73cm2e2g"
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
    print("Opening a new tab in Chrome remote debugging...")
    # Request a new tab
    req = urllib.request.Request("http://localhost:9222/json/new", method="PUT")
    with urllib.request.urlopen(req) as response:
        info = json.loads(response.read().decode())
    
    page_id = info["id"]
    ws_url = info["webSocketDebuggerUrl"]
    print(f"Opened new tab with ID: {page_id}")
    
    async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
        print(f"Navigating to Render service: {SERVICE_URL}")
        # Enable page domain
        await send_cdp(ws, "Page.enable")
        # Navigate
        await send_cdp(ws, "Page.navigate", {"url": SERVICE_URL})
        
        # Wait for page to load (poll for manual deploy button)
        print("Waiting for dashboard page to load and authenticate...")
        for attempt in range(20):
            await asyncio.sleep(2)
            title = await evaluate(ws, "document.title")
            print(f"Current page title: {title}")
            
            # Check if button exists
            button_exists = await evaluate(ws, """
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.trim().includes('Manual Deploy')) {
                        return true;
                    }
                }
                return false;
            })()
            """)
            if button_exists:
                print("Found 'Manual Deploy' button!")
                break
        else:
            print("Timeout waiting for 'Manual Deploy' button to appear.")
            # Print body text for debugging
            text = await evaluate(ws, "document.body.innerText.substring(0, 1000)")
            print(f"Page text:\n{text}")
            return

        # Click Manual Deploy
        click_res = await evaluate(ws, """
        (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.trim().includes('Manual Deploy')) {
                    btn.click();
                    return 'Clicked Manual Deploy';
                }
            }
            return 'Button not found';
        })()
        """)
        print(f"Click response: {click_res}")
        
        await asyncio.sleep(2)
        
        # Click Deploy latest commit
        click2_res = await evaluate(ws, """
        (function() {
            const items = document.querySelectorAll('button, a, [role="menuitem"], [role="option"]');
            for (const item of items) {
                const text = item.textContent.trim().toLowerCase();
                if (text.includes('deploy latest') || text.includes('latest commit') || text.includes('deploy now')) {
                    item.click();
                    return 'Clicked: ' + item.textContent.trim();
                }
            }
            return 'Deploy option not found';
        })()
        """)
        print(f"Click Deploy option response: {click2_res}")
        
        await asyncio.sleep(5)
        
        # Verify status
        status = await evaluate(ws, """
        (function() {
            return document.body.innerText.substring(0, 1500);
        })()
        """)
        print(f"Page content after trigger:\n{status}")

if __name__ == "__main__":
    asyncio.run(main())
