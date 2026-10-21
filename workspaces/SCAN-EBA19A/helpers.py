import jinja2

def format_attributes(raw_dict):
    # Reaches vulnerable function xmlattr in jinja2 2.11.3 (CVE-2024-34064)
    return jinja2.xmlattr(raw_dict)

def safe_calculator(x, y):
    return x + y
