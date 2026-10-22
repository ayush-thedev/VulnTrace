import jinja2

def build_xml_attributes(attribute_dict: dict) -> str:
    """
    Invokes jinja2.xmlattr filter on user-provided attribute dict.
    Vulnerable in jinja2 2.11.3 (CVE-2024-34064 / GHSA-h5c8-rqwp-cp95).
    """
    # Direct hop into vulnerable function in jinja2
    return jinja2.xmlattr(attribute_dict)

def compute_safe_status() -> str:
    return "All internal subsystems healthy"
