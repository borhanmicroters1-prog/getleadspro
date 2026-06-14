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
    response = urllib.request.urlopen("http://localhost:9222/json")
    tabs = json.loads(response.read().decode())
    
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
    
    async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
        # Check logs text
        logs_text = await evaluate(ws, 1, """
        (function() {
            // Let's try to extract all visible logs
            const allElements = document.querySelectorAll('*');
            const logLines = [];
            allElements.forEach(el => {
                // Render logs are often in elements with class names containing 'log' or 'line'
                // or pre, or pre-wrap. Let's look for matching logs lines.
                if (el.innerText && (el.innerText.includes('AI generation') || el.innerText.includes('failed') || el.innerText.includes('HTTP/1.1'))) {
                    // check if the tag is small/discrete
                    if (el.children.length === 0 || el.tagName === 'SPAN' || el.tagName === 'DIV') {
                        logLines.push(el.innerText);
                    }
                }
            });
            
            // Just return the body text as a backup
            return document.body.innerText;
        })()
        """)
        
        # Look for the failure message in the logs text
        failed_lines = [l for l in logs_text.split('\n') if "AI generation" in l or "failed" in l or "emails/generate" in l or "VoidAI" in l or "HTTP" in l]
        print("Matched log lines:")
        for line in failed_lines[-30:]:
            print(line)

if __name__ == "__main__":
    asyncio.run(main())
