from flask import Flask, request, render_template_string
import requests
from cryptography.fernet import Fernet
import yaml

app = Flask(__name__)

# This app uses multiple vulnerable dependencies
# The vulnerabilities are in the versions specified in requirements.txt

@app.route('/')
def home():
    return '''
    <h1>Dependency Scanning Demo</h1>
    <p>This app uses intentionally vulnerable dependencies.</p>
    <ul>
        <li>Flask 2.0.1 - Has known vulnerabilities</li>
        <li>Jinja2 2.11.3 - Template injection vulnerability</li>
        <li>Pillow 8.1.2 - Multiple CVEs</li>
        <li>PyYAML 5.3.1 - Arbitrary code execution</li>
        <li>cryptography 3.3.2 - Security vulnerabilities</li>
        <li>Django 2.2.0 - Multiple critical CVEs</li>
    </ul>
    <p><a href="/template">Test Template Rendering</a></p>
    <p><a href="/yaml">Test YAML Parsing</a></p>
    <p><a href="/fetch">Test HTTP Request</a></p>
    '''

@app.route('/template')
def template_test():
    # Vulnerable to Server-Side Template Injection (SSTI)
    # due to vulnerable Jinja2 version
    template = request.args.get('template', 'Hello, World!')
    return render_template_string(template)

@app.route('/yaml')
def yaml_test():
    # Vulnerable to arbitrary code execution
    # due to vulnerable PyYAML version using unsafe yaml.load()
    data = request.args.get('data', 'message: Hello')
    try:
        parsed = yaml.load(data, Loader=yaml.FullLoader)
        return f'Parsed YAML: {parsed}'
    except Exception as e:
        return f'Error: {e}'

@app.route('/fetch')
def fetch_url():
    # Uses vulnerable requests library
    url = request.args.get('url', 'https://httpbin.org/get')
    try:
        response = requests.get(url, timeout=5)
        return f'Status: {response.status_code}<br>Content: {response.text[:200]}'
    except Exception as e:
        return f'Error: {e}'

@app.route('/encrypt')
def encrypt_test():
    # Uses vulnerable cryptography library
    key = Fernet.generate_key()
    cipher = Fernet(key)
    message = request.args.get('message', 'Secret data')
    encrypted = cipher.encrypt(message.encode())
    return f'Encrypted: {encrypted.decode()}'

if __name__ == '__main__':
    # Run on all interfaces for demo purposes
    app.run(debug=True, host='0.0.0.0', port=9999)
