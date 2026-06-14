"""
Fix Render environment variables by directly manipulating form fields via CDP.
"""
import json
import asyncio
import sys
import io
import websockets

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PAGE_ID = "8B62998266C87942D488ABFC47F3167E"
WS_URL = f"ws://127.0.0.1:9222/devtools/page/{PAGE_ID}"

# Map of env var names to their correct values
ENV_VARS = {
    "DATABASE_URL": "postgresql+asyncpg://postgres.grdqjnazfdznbviopmxf:Borhan282065@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    "SUPABASE_JWT_SECRET": "svgk6ce4zc9vc3XdKHh7b0APVFd/K3NDT6b6TAdnXOaA/GozjiGV/ccE8aHg29p3RlHfXQTUNzjB+cgIVmqZrg==",
    "SUPABASE_PROJECT_ID": "grdqjnazfdznbviopmxf",
    "SUPER_ADMIN_EMAIL": "borhan.seoexpert@gmail.com",
    "ENVIRONMENT": "production",
    "FRONTEND_URL": "https://getleadspro.vercel.app",
    "BACKEND_URL": "https://getclient-backend.onrender.com",
    "PORT": "8000",
}

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
            
            # The page is already in edit mode with form fields visible.
            # From previous analysis, the structure is:
            # envVars.0.envVarKey = DATABASE_URL, envVars.0.envVarValue = <value>
            # envVars.1.envVarKey = ENVIRONMENT, etc.
            
            # First, let's read the full DATABASE_URL value to see if it's corrupted
            check_db_url = """
            (function() {
                const textarea = document.querySelector('textarea[name="envVars.0.envVarValue"]');
                if (textarea) {
                    return JSON.stringify({
                        found: true,
                        value: textarea.value,
                        length: textarea.value.length
                    });
                }
                return JSON.stringify({found: false});
            })()
            """
            db_url_check = await evaluate(ws, check_db_url)
            print(f"Current DATABASE_URL: {db_url_check}")
            
            # Now set values for each env var field using React-compatible value setting
            # We need to use the nativeInputValueSetter to trigger React state updates
            
            for env_key, env_value in ENV_VARS.items():
                # Find the textarea for this env var key
                escaped_value = env_value.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n")
                
                set_value_js = f"""
                (function() {{
                    // Find which index has this key
                    const allKeyInputs = document.querySelectorAll('input[name^="envVars."][name$=".envVarKey"]');
                    let targetIndex = -1;
                    
                    for (let i = 0; i < allKeyInputs.length; i++) {{
                        if (allKeyInputs[i].value === '{env_key}') {{
                            targetIndex = i;
                            break;
                        }}
                    }}
                    
                    if (targetIndex === -1) {{
                        return JSON.stringify({{key: '{env_key}', status: 'NOT_FOUND'}});
                    }}
                    
                    // Find the corresponding value textarea
                    const valueTextarea = document.querySelector('textarea[name="envVars.' + targetIndex + '.envVarValue"]');
                    if (!valueTextarea) {{
                        // Try without name attribute - look at all textareas
                        const allTextareas = document.querySelectorAll('textarea');
                        // The value textarea should be right after the key input
                        // Index: key at allKeyInputs[targetIndex], value at allTextareas[targetIndex]
                        if (targetIndex < allTextareas.length) {{
                            const ta = allTextareas[targetIndex];
                            // Use React-compatible value setter
                            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                                window.HTMLTextAreaElement.prototype, 'value'
                            ).set;
                            nativeTextAreaValueSetter.call(ta, "{escaped_value}");
                            ta.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            ta.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            return JSON.stringify({{key: '{env_key}', status: 'SET_VIA_INDEX', index: targetIndex, newValue: ta.value.substring(0, 60)}});
                        }}
                        return JSON.stringify({{key: '{env_key}', status: 'NO_TEXTAREA', index: targetIndex}});
                    }}
                    
                    // Use React-compatible value setter
                    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLTextAreaElement.prototype, 'value'
                    ).set;
                    nativeTextAreaValueSetter.call(valueTextarea, "{escaped_value}");
                    valueTextarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    valueTextarea.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    
                    return JSON.stringify({{key: '{env_key}', status: 'SET', index: targetIndex, newValue: valueTextarea.value.substring(0, 60)}});
                }})()
                """
                
                result = await evaluate(ws, set_value_js)
                print(f"  {env_key}: {result}")
            
            # Also need to add PORT and BACKEND_URL if they don't exist
            # Check which vars are missing
            check_missing = """
            (function() {
                const allKeyInputs = document.querySelectorAll('input[name^="envVars."][name$=".envVarKey"]');
                const keys = [];
                allKeyInputs.forEach(input => keys.push(input.value));
                return JSON.stringify(keys);
            })()
            """
            existing_keys = await evaluate(ws, check_missing)
            print(f"\nExisting keys on page: {existing_keys}")
            
            existing_list = json.loads(existing_keys) if existing_keys else []
            missing_vars = {k: v for k, v in ENV_VARS.items() if k not in existing_list}
            
            if missing_vars:
                print(f"\nMissing vars that need to be added: {list(missing_vars.keys())}")
                
                for mk, mv in missing_vars.items():
                    escaped_mv = mv.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"')
                    # Click "Add Environment Variable" button to add a new row
                    add_row = """
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            const text = btn.textContent.trim().toLowerCase();
                            if (text.includes('add environment variable') || text.includes('add env') || text === 'add') {
                                btn.click();
                                return 'clicked: ' + btn.textContent.trim();
                            }
                        }
                        return 'no add button found';
                    })()
                    """
                    add_result = await evaluate(ws, add_row)
                    print(f"  Add row for {mk}: {add_result}")
                    
                    await asyncio.sleep(0.5)
                    
                    # Find the last empty key input and set it
                    set_new_var = f"""
                    (function() {{
                        const allKeyInputs = document.querySelectorAll('input[name^="envVars."][name$=".envVarKey"]');
                        const lastInput = allKeyInputs[allKeyInputs.length - 1];
                        
                        if (!lastInput || lastInput.value !== '') {{
                            return JSON.stringify({{status: 'ERROR', msg: 'No empty key input found'}});
                        }}
                        
                        // Set key
                        const nativeInputSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        nativeInputSetter.call(lastInput, "{mk}");
                        lastInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        lastInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        
                        // Set value - find the corresponding textarea
                        const allTextareas = document.querySelectorAll('textarea');
                        const lastTextarea = allTextareas[allTextareas.length - 1];
                        
                        if (lastTextarea) {{
                            const nativeTASetter = Object.getOwnPropertyDescriptor(
                                window.HTMLTextAreaElement.prototype, 'value'
                            ).set;
                            nativeTASetter.call(lastTextarea, "{escaped_mv}");
                            lastTextarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            lastTextarea.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                        
                        return JSON.stringify({{status: 'ADDED', key: "{mk}", keySet: lastInput.value, valueSet: lastTextarea ? lastTextarea.value.substring(0, 50) : 'N/A'}});
                    }})()
                    """
                    set_result = await evaluate(ws, set_new_var)
                    print(f"  Set new var {mk}: {set_result}")
            
            # Now verify all values are set correctly
            print("\n--- Verification ---")
            verify = """
            (function() {
                const allKeyInputs = document.querySelectorAll('input[name^="envVars."][name$=".envVarKey"]');
                const allTextareas = document.querySelectorAll('textarea');
                const result = [];
                for (let i = 0; i < allKeyInputs.length; i++) {
                    result.push({
                        key: allKeyInputs[i].value,
                        value: i < allTextareas.length ? allTextareas[i].value.substring(0, 80) : 'N/A',
                        valueLen: i < allTextareas.length ? allTextareas[i].value.length : 0
                    });
                }
                return JSON.stringify(result);
            })()
            """
            verify_result = await evaluate(ws, verify)
            print(f"All env vars: {verify_result}")
            
            # Click "Save, rebuild, and deploy" button
            print("\n--- Clicking Save button ---")
            save_click = """
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent.trim().toLowerCase();
                    if (text.includes('save') && (text.includes('rebuild') || text.includes('deploy'))) {
                        btn.click();
                        return 'Clicked: ' + btn.textContent.trim();
                    }
                }
                // Try just "Save Changes"
                for (const btn of buttons) {
                    const text = btn.textContent.trim().toLowerCase();
                    if (text.includes('save')) {
                        btn.click();
                        return 'Clicked: ' + btn.textContent.trim();
                    }
                }
                return 'No save button found';
            })()
            """
            save_result = await evaluate(ws, save_click)
            print(f"Save result: {save_result}")
            
            print("\nDone!")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
