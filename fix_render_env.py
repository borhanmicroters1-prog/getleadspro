"""
Fix Render environment variables via Chrome DevTools Protocol (CDP).
Uses the open Render dashboard page to interact with env vars.
"""
import json
import asyncio
import sys
import io
import websockets

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "8B62998266C87942D488ABFC47F3167E"
WS_URL = f"ws://127.0.0.1:9222/devtools/page/{PAGE_ID}"

# Correct env var values
ENV_VARS = {
    "DATABASE_URL": "postgresql+asyncpg://postgres.grdqjnazfdznbviopmxf:Borhan282065@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    "SUPABASE_JWT_SECRET": "svgk6ce4zc9vc3XdKHh7b0APVFd/K3NDT6b6TAdnXOaA/GozjiGV/ccE8aHg29p3RlHfXQTUNzjB+cgIVmqZrg==",
    "SUPABASE_PROJECT_ID": "grdqjnazfdznbviopmxf",
    "SUPER_ADMIN_EMAIL": "borhan.seoexpert@gmail.com",
    "ENVIRONMENT": "production",
    "PORT": "8000",
    "FRONTEND_URL": "https://getleadspro.vercel.app",
    "BACKEND_URL": "https://getclient-backend.onrender.com",
}

msg_id = 0

async def send_cdp(ws, method, params=None):
    global msg_id
    msg_id += 1
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    await ws.send(json.dumps(msg))
    # Wait for matching response
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == msg_id:
            return data
        # Skip events

async def evaluate(ws, expression):
    result = await send_cdp(ws, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    if "result" in result and "result" in result["result"]:
        return result["result"]["result"].get("value")
    return result

async def main():
    print("Connecting to Render dashboard page...")
    try:
        async with websockets.connect(WS_URL, max_size=10*1024*1024) as ws:
            print("Connected!")
            
            # First, let's check what page we're on
            title = await evaluate(ws, "document.title")
            print(f"Page title: {title}")
            
            url = await evaluate(ws, "window.location.href")
            print(f"Page URL: {url}")
            
            # Check if we're on the env vars page
            if "env" not in str(url):
                print("Not on env vars page, navigating...")
                await evaluate(ws, "window.location.href = 'https://dashboard.render.com/web/srv-d8mig86rnols73cm2e2g/env'")
                await asyncio.sleep(3)
            
            # Get the page HTML to understand the structure
            print("\nAnalyzing page structure...")
            
            # Check for existing env var inputs using a comprehensive approach
            # Render uses a specific UI - let's find all the env var rows
            js_code = """
            (function() {
                // Look for all input elements and textareas
                const inputs = document.querySelectorAll('input, textarea');
                const result = [];
                inputs.forEach((el, i) => {
                    result.push({
                        index: i,
                        tag: el.tagName,
                        type: el.type || '',
                        name: el.name || '',
                        placeholder: el.placeholder || '',
                        value: el.value ? el.value.substring(0, 50) + '...' : '',
                        id: el.id || '',
                        className: (el.className || '').substring(0, 80),
                        ariaLabel: el.getAttribute('aria-label') || '',
                    });
                });
                return JSON.stringify(result);
            })()
            """
            
            inputs_info = await evaluate(ws, js_code)
            print(f"Found inputs: {inputs_info}")
            
            # Let's also check for buttons
            buttons_code = """
            (function() {
                const buttons = document.querySelectorAll('button');
                const result = [];
                buttons.forEach((btn, i) => {
                    result.push({
                        index: i,
                        text: btn.textContent.trim().substring(0, 50),
                        className: (btn.className || '').substring(0, 50),
                        type: btn.type || '',
                        disabled: btn.disabled,
                    });
                });
                return JSON.stringify(result);
            })()
            """
            
            buttons_info = await evaluate(ws, buttons_code)
            print(f"\nFound buttons: {buttons_info}")
            
            # Check if there's an "Edit" button we need to click first
            edit_click = """
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent.trim();
                    if (text === 'Edit' || text === 'Edit Environment Variables') {
                        btn.click();
                        return 'Clicked Edit button: ' + text;
                    }
                }
                return 'No Edit button found - may already be in edit mode';
            })()
            """
            edit_result = await evaluate(ws, edit_click)
            print(f"\nEdit button: {edit_result}")
            
            await asyncio.sleep(2)
            
            # Now let's find the env var structure again after entering edit mode
            env_structure = """
            (function() {
                // Find all env var key-value pairs
                // Render typically uses rows with key and value fields
                const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
                const result = [];
                allInputs.forEach((el, i) => {
                    result.push({
                        index: i,
                        tag: el.tagName,
                        type: el.type || '',
                        name: el.name || '',
                        placeholder: el.placeholder || '',
                        value: el.value ? el.value.substring(0, 100) : '',
                        ariaLabel: el.getAttribute('aria-label') || '',
                        dataTestId: el.getAttribute('data-testid') || '',
                    });
                });
                return JSON.stringify(result);
            })()
            """
            
            env_info = await evaluate(ws, env_structure)
            print(f"\nEnv var inputs after edit: {env_info}")
            
            # Try to find env var rows by looking for key-value pair patterns
            find_env_vars = """
            (function() {
                // Strategy: Find elements containing env var names
                const body = document.body.innerText;
                const vars = ['DATABASE_URL', 'SUPABASE_JWT_SECRET', 'SUPABASE_PROJECT_ID', 
                              'SUPER_ADMIN_EMAIL', 'ENVIRONMENT', 'PORT', 'FRONTEND_URL', 'BACKEND_URL'];
                const found = {};
                vars.forEach(v => {
                    found[v] = body.includes(v);
                });
                return JSON.stringify(found);
            })()
            """
            
            found_vars = await evaluate(ws, find_env_vars)
            print(f"\nVars found on page: {found_vars}")
            
            # Use Render's internal API to update env vars directly
            # The service ID is srv-d8mig86rnols73cm2e2g
            # We can use the dashboard's own fetch with credentials
            
            print("\n--- Trying to update env vars via Render dashboard API ---")
            
            # First, get the current env vars via Render's internal API
            get_env = """
            (async function() {
                try {
                    const resp = await fetch('/api/v1/services/srv-d8mig86rnols73cm2e2g/env-vars', {
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!resp.ok) {
                        return JSON.stringify({error: resp.status, text: await resp.text()});
                    }
                    const data = await resp.json();
                    return JSON.stringify(data);
                } catch(e) {
                    return JSON.stringify({error: e.message});
                }
            })()
            """
            
            env_data = await evaluate(ws, get_env)
            print(f"\nCurrent env vars from API: {env_data}")
            
            if env_data and not isinstance(env_data, dict):
                try:
                    current_vars = json.loads(env_data)
                    if isinstance(current_vars, list):
                        print(f"\nFound {len(current_vars)} env vars")
                        for var in current_vars:
                            key = var.get('key', '')
                            val = var.get('value', '')
                            print(f"  {key} = {val[:50]}{'...' if len(val) > 50 else ''}")
                except:
                    pass
            
            # Try updating via PUT request
            env_vars_json = json.dumps([{"key": k, "value": v} for k, v in ENV_VARS.items()])
            
            update_env = f"""
            (async function() {{
                try {{
                    // First get existing env vars to preserve any we're not updating
                    const getResp = await fetch('/api/v1/services/srv-d8mig86rnols73cm2e2g/env-vars', {{
                        credentials: 'include',
                        headers: {{ 'Accept': 'application/json' }}
                    }});
                    
                    let existingVars = [];
                    if (getResp.ok) {{
                        existingVars = await getResp.json();
                    }}
                    
                    // Merge: update existing, add missing
                    const updates = {env_vars_json};
                    const updateKeys = updates.map(u => u.key);
                    
                    // Keep existing vars that we're not updating
                    const merged = existingVars.filter(v => !updateKeys.includes(v.key));
                    // Add our updates
                    merged.push(...updates);
                    
                    // Try PUT to update all env vars
                    const resp = await fetch('/api/v1/services/srv-d8mig86rnols73cm2e2g/env-vars', {{
                        method: 'PUT',
                        credentials: 'include',
                        headers: {{ 
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }},
                        body: JSON.stringify(merged)
                    }});
                    
                    if (!resp.ok) {{
                        const text = await resp.text();
                        return JSON.stringify({{error: resp.status, text: text}});
                    }}
                    
                    const data = await resp.json();
                    return JSON.stringify({{success: true, count: data.length}});
                }} catch(e) {{
                    return JSON.stringify({{error: e.message}});
                }}
            }})()
            """
            
            update_result = await evaluate(ws, update_env)
            print(f"\nUpdate result: {update_result}")
            
            # If the internal API didn't work, try Render's public API via the dashboard's auth
            if update_result and 'error' in str(update_result):
                print("\nInternal API didn't work. Trying alternative approach...")
                
                # Try to find and use Render's GraphQL API
                graphql_update = f"""
                (async function() {{
                    try {{
                        // Try the GraphQL endpoint that the dashboard uses
                        const resp = await fetch('/graphql', {{
                            method: 'POST',
                            credentials: 'include',
                            headers: {{
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                            }},
                            body: JSON.stringify({{
                                query: `mutation updateEnvVars($serviceId: String!, $envVars: [EnvVarInput!]!) {{
                                    updateEnvVarsForService(serviceId: $serviceId, envVars: $envVars) {{
                                        key
                                        value
                                    }}
                                }}`,
                                variables: {{
                                    serviceId: "srv-d8mig86rnols73cm2e2g",
                                    envVars: {env_vars_json}
                                }}
                            }})
                        }});
                        
                        const text = await resp.text();
                        return text.substring(0, 500);
                    }} catch(e) {{
                        return JSON.stringify({{error: e.message}});
                    }}
                }})()
                """
                
                graphql_result = await evaluate(ws, graphql_update)
                print(f"\nGraphQL result: {graphql_result}")
            
            print("\n--- Done ---")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
