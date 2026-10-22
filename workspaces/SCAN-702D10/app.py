from template_helpers import build_xml_attributes, compute_safe_status

# SCENARIO 1 — REACHABLE (HTTP Entrypoint -> Helper -> Vulnerable xmlattr)
@app.get("/export-profile")
def export_user_profile(user_payload: dict):
    """
    Candidate route:
    app.py:export_user_profile -> template_helpers.py:build_xml_attributes -> ext:jinja2::xmlattr
    """
    return build_xml_attributes(user_payload)

# SCENARIO 2 — NOT REACHABLE (Isolated Route -> Local Safe Logic Only)
@app.get("/system-status")
def system_status():
    """
    Safe entrypoint with zero route to vulnerable package function.
    """
    status_str = compute_safe_status()
    return {"status": status_str}

# SCENARIO 3 — UNCERTAIN (Dynamic Dispatch / Reflection)
@app.post("/plugins/dispatch")
def execute_dynamic_plugin(plugin_module, method_name: str):
    """
    Dynamic reflection using getattr: cannot be statically resolved by call-graph analysis.
    Produces verdict 'uncertain' with an explicit caveat.
    """
    handler = getattr(plugin_module, method_name)
    return handler()

if __name__ == "__main__":
    print("Demo application ready.")
