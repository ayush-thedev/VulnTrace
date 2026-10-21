import aiohttp
from helpers import format_attributes, safe_calculator

# Route 1: Candidate route reaches jinja2.xmlattr (Reachable)
@app.get("/render")
def render_profile(user_input: dict):
    return format_attributes(user_input)

# Route 2: Isolated route calling only local safe functions (Not Reachable to vuln)
@app.get("/health")
def health_check():
    status = safe_calculator(1, 1)
    return {"status": "ok", "code": status}

# Route 3: Dynamic reflection dispatch (Uncertain)
@app.post("/dynamic")
def dispatch_handler(handler_name: str):
    # Dynamic dispatch using getattr cannot be statically verified
    plugin = getattr(aiohttp, handler_name)
    return plugin()
