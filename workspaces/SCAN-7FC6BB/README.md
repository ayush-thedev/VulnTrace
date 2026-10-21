# Dependency Scanning Demo

This is a demo project showing how to detect vulnerable dependencies in a Python/Flask application using various dependency scanning tools. The app uses intentionally outdated and vulnerable Python packages to demonstrate how dependency scanners work.

## What is Dependency Scanning?

Dependency scanning (also called Software Composition Analysis - SCA) analyzes your project's dependencies (third-party libraries) to identify:
- **Known vulnerabilities (CVEs)** - Security flaws with public disclosures
- **Outdated packages** - Libraries that have newer, more secure versions
- **License compliance issues** - Incompatible or risky licenses
- **Malicious packages** - Compromised or typo-squatted packages

## Why It Matters

Modern applications rely heavily on third-party dependencies:
- Over 80% of code in applications comes from dependencies
- Vulnerable dependencies are a leading cause of security breaches
- The Log4Shell vulnerability (2021) affected millions of applications
- Supply chain attacks are increasing (SolarWinds, event-stream npm package)

## How it works

- The Flask app (`app.py`) uses intentionally vulnerable dependencies specified in `requirements.txt`.
- Multiple scanning tools check these dependencies against vulnerability databases (National Vulnerability Database, GitHub Security Advisories, etc.).
- Each tool reports vulnerabilities with CVE identifiers, severity levels, and remediation advice.
- The GitHub Actions workflow fails when high or critical vulnerabilities are detected.

## Vulnerable Dependencies Included

This demo includes the following intentionally vulnerable packages:

| Package | Vulnerable Version | Known CVEs | Impact |
|---------|-------------------|------------|---------|
| **Flask** | 2.0.1 | CVE-2023-30861 | Path traversal vulnerability |
| **Jinja2** | 2.11.3 | CVE-2024-22195 | Server-Side Template Injection (SSTI) |
| **Werkzeug** | 2.0.0 | CVE-2023-25577 | High CPU consumption (DoS) |
| **PyYAML** | 5.3.1 | CVE-2020-14343 | Arbitrary code execution via unsafe load |
| **Pillow** | 8.1.2 | CVE-2021-25287, CVE-2021-25288 | Buffer overflow, OOB read |
| **cryptography** | 3.3.2 | CVE-2023-38325 | Null pointer dereference |
| **Django** | 2.2.0 | CVE-2023-43665, CVE-2023-41164 | SQL injection, DoS |
| **requests** | 2.25.1 | CVE-2023-32681 | Proxy credentials leakage |
| **urllib3** | 1.26.4 | CVE-2021-33503 | Request smuggling |
| **SQLAlchemy** | 1.3.23 | CVE-2024-5629 | SQL injection via order_by |

## Files

- `app.py`: Flask application using vulnerable dependencies.
- `requirements.txt`: Intentionally outdated Python dependencies with known CVEs.
- `.github/workflows/dependency-scan.yml`: GitHub Actions workflow with multiple scanning tools.

## Scanning Tools Comparison

This demo includes 5 different dependency scanning tools:

### 1. **pip-audit** (Recommended for Python)
- ✅ Python-specific, fast and accurate
- ✅ Uses PyPI Advisory Database
- ✅ No account required, completely free
- ✅ Easy to use locally and in CI/CD

### 2. **Safety**
- ✅ Python-specific with detailed reports
- ✅ Large vulnerability database
- ⚠️ Free tier has limitations
- ✅ JSON output for automation

### 3. **Trivy** (Recommended for Multi-language)
- ✅ Multi-language support (Python, Node.js, Java, Go, etc.)
- ✅ Also scans OS packages and container images
- ✅ Completely free and open source
- ✅ Fast and comprehensive

### 4. **Snyk**
- ✅ Developer-friendly with fix suggestions
- ✅ IDE integration available
- ⚠️ Requires free account and API token
- ✅ Excellent reporting and dashboards

### 5. **GitHub Dependency Review**
- ✅ Built into GitHub (for PRs)
- ✅ No setup required
- ✅ Shows dependency changes in PRs
- ⚠️ Only works for pull requests

## Local Testing

### Using pip-audit (Simplest)

```bash
# Install pip-audit
pip install pip-audit

# Scan your dependencies
pip-audit -r requirements.txt

# Show descriptions of vulnerabilities
pip-audit -r requirements.txt --desc

# Output as JSON
pip-audit -r requirements.txt --format json
```

**Example Output:**
```
Found 15 known vulnerabilities in 10 packages

Name      Version   ID              Fix Versions
--------- --------- --------------- ----------------
Flask     2.0.1     GHSA-m2qf-hxjv  2.2.5, 2.3.2, 3.0.0
                    -74w6
Jinja2    2.11.3    CVE-2024-22195  3.1.3
Pillow    8.1.2     CVE-2021-25287  8.2.0
PyYAML    5.3.1     CVE-2020-14343  5.4
...
```

### Using Safety

```bash
# Install Safety
pip install safety

# Scan dependencies
safety check -r requirements.txt

# Detailed output
safety check -r requirements.txt --detailed-output

# JSON format
safety check -r requirements.txt --json
```

### Using Trivy (Multi-language)

```bash
# Install Trivy (macOS)
brew install trivy

# Or use Docker
docker run --rm -v $(pwd):/workspace aquasec/trivy fs /workspace

# Scan for vulnerabilities in dependencies
trivy fs --scanners vuln .

# Only show CRITICAL and HIGH
trivy fs --scanners vuln --severity CRITICAL,HIGH .

# Scan specific file
trivy fs --scanners vuln requirements.txt
```

**Example Output:**
```
requirements.txt (pip)
======================
Total: 15 (CRITICAL: 5, HIGH: 7, MEDIUM: 3, LOW: 0, UNKNOWN: 0)

┌────────────┬──────────────┬──────────┬────────────┬───────────────────┐
│  Library   │ Vulnerability│ Severity │  Installed │  Fixed Version    │
├────────────┼──────────────┼──────────┼────────────┼───────────────────┤
│ Django     │ CVE-2023-43665│ CRITICAL │   2.2.0   │ 3.2.23, 4.1.13   │
│ Pillow     │ CVE-2021-25287│ CRITICAL │   8.1.2   │ 8.2.0            │
│ PyYAML     │ CVE-2020-14343│ CRITICAL │   5.3.1   │ 5.4              │
└────────────┴──────────────┴──────────┴────────────┴───────────────────┘
```

## GitHub Actions Setup

### Prerequisites

For most tools, no setup is needed! However, if you want to use Snyk:

1. **Sign up for Snyk** (free tier available)
   - Go to [snyk.io](https://snyk.io)
   - Sign in with GitHub
   - Get your API token from Account Settings

2. **Add Snyk Token to GitHub Secrets**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SNYK_TOKEN`
   - Value: [your Snyk API token]
   - Click "Add secret"

### Workflow Configuration

The workflow file (`.github/workflows/dependency-scan.yml`) includes all 5 scanning methods. You can:

- **Use all of them** (recommended for comprehensive coverage)
- **Pick one or two** (comment out the others)
- **Start with pip-audit and Trivy** (best free options)

The workflow runs:
- On every push to `main` or `develop`
- On every pull request
- Weekly on Mondays (to catch newly disclosed vulnerabilities)

### Workflow Behavior

- **pip-audit**: Fails if any vulnerabilities found
- **Safety**: Shows results but doesn't fail the build (set to `continue-on-error`)
- **Trivy**: Fails if CRITICAL or HIGH vulnerabilities found
- **Snyk**: Shows results but doesn't fail (requires token)
- **GitHub Dependency Review**: Only runs on PRs, fails on moderate+ severity

## Expected Results

When the workflow runs on this vulnerable code, you'll see:

### pip-audit Output
```
Found 15 known vulnerabilities in 10 packages
Name      Version   ID              Fix Versions
Flask     2.0.1     GHSA-m2qf...    2.2.5, 2.3.2
Jinja2    2.11.3    CVE-2024-22195  3.1.3
Pillow    8.1.2     CVE-2021-25287  8.2.0
PyYAML    5.3.1     CVE-2020-14343  5.4
Django    2.2.0     CVE-2023-43665  3.2.23
```

### Trivy Output
```
requirements.txt (pip)
Total: 15 (CRITICAL: 5, HIGH: 7, MEDIUM: 3)

CRITICAL: Django 2.2.0
CVE-2023-43665: Potential denial of service via large Accept-Language headers
Fixed in: 3.2.23, 4.1.13, 4.2.7

CRITICAL: Pillow 8.1.2
CVE-2021-25287: Buffer overflow in BLP format
Fixed in: 8.2.0
```

### Safety Output
```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                               /$$$$$$            /$$                       ║
║                              /$$__  $$          | $$                       ║
║           /$$$$$$$  /$$$$$$ | $$  \__//$$$$$$  /$$$$$$   /$$   /$$        ║
║          /$$_____/ |____  $$| $$$$   /$$__  $$|_  $$_/  | $$  | $$        ║
║         |  $$$$$$   /$$$$$$$| $$_/  | $$$$$$$$  | $$    | $$  | $$        ║
║          \____  $$ /$$__  $$| $$    | $$_____/  | $$ /$$| $$  | $$        ║
║          /$$$$$$$/|  $$$$$$$| $$    |  $$$$$$$  |  $$$$/|  $$$$$$$        ║
║         |_______/  \_______/|__/     \_______/   \___/   \____  $$        ║
║                                                          /$$  | $$        ║
║                                                         |  $$$$$$/        ║
║  by pyup.io                                              \______/         ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

 REPORT 

  Safety is using PyUp's free open-source vulnerability database. 
  
-> Vulnerability found in django version 2.2.0
   Vulnerability ID: 51457
   Affected spec: <3.2.23
   ADVISORY: Django 2.2.0 is vulnerable to CVE-2023-43665...
```

## How to Fix Vulnerabilities

Once vulnerabilities are detected, here's how to fix them:

### Method 1: Update to Latest Stable Versions (Recommended)

```bash
# Update all packages to latest versions
pip install --upgrade -r requirements.txt

# Or update individually
pip install --upgrade Flask
pip install --upgrade Jinja2
pip install --upgrade Pillow

# Freeze new versions
pip freeze > requirements.txt
```

### Method 2: Use pip-audit's Auto-fix

```bash
# Let pip-audit suggest fixes
pip-audit -r requirements.txt --fix --dry-run

# Apply fixes automatically
pip-audit -r requirements.txt --fix
```

### Method 3: Manual Update (requirements.txt)

**Before (Vulnerable):**
```
Flask==2.0.1
Jinja2==2.11.3
Pillow==8.1.2
PyYAML==5.3.1
Django==2.2.0
```

**After (Secure):**
```
Flask==3.0.0
Jinja2==3.1.3
Pillow==10.2.0
PyYAML==6.0.1
Django==5.0.0
```

### Method 4: Use Version Ranges

Instead of pinning exact versions, use version ranges:

```
Flask>=3.0.0,<4.0.0
Jinja2>=3.1.3
Pillow>=10.2.0
PyYAML>=6.0
```

## Best Practices

### 1. Regular Scanning
- Run dependency scans on every commit/PR
- Schedule weekly scans to catch new vulnerabilities
- Enable GitHub Dependabot alerts

### 2. Keep Dependencies Updated
- Review and update dependencies monthly
- Subscribe to security advisories for critical packages
- Use automated dependency update tools (Dependabot, Renovate)

### 3. Minimize Dependencies
- Only include necessary packages
- Audit transitive dependencies
- Consider alternatives with better security track records

### 4. Use Lock Files
```bash
# Generate lock file with exact versions
pip freeze > requirements.txt

# Or use pip-tools for better management
pip install pip-tools
pip-compile requirements.in > requirements.txt
```

### 5. Monitor Continuously
- Enable GitHub Dependabot
- Set up alerts for new vulnerabilities
- Integrate scanning into CI/CD pipeline

## GitHub Dependabot Setup (Bonus)

GitHub provides free automated dependency updates:

1. Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "your-username"
    labels:
      - "dependencies"
      - "security"
```

2. Dependabot will:
   - Automatically create PRs to update vulnerable dependencies
   - Check for updates weekly
   - Include release notes and changelogs
   - Run your CI/CD tests on the updates

## Running the Demo App

⚠️ **Warning:** This app has vulnerable dependencies. Do NOT deploy to production!

```bash
# Clone the repository
git clone <your-repo-url>
cd <your-repo-name>

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install vulnerable dependencies (for demo only!)
pip install -r requirements.txt

# Run the app
python3 vulnerable_deps_app.py

# Visit http://localhost:9999
```

### Test Endpoints

- `http://localhost:9999/` - Home page with vulnerability list
- `http://localhost:9999/template?template=Hello` - Template rendering (SSTI vulnerable)
- `http://localhost:9999/yaml?data=message:%20test` - YAML parsing (code exec vulnerable)
- `http://localhost:9999/fetch?url=https://example.com` - HTTP requests
- `http://localhost:9999/encrypt?message=secret` - Encryption test

## Comparison: When to Use Each Tool

| Tool | Best For | Pros | Cons |
|------|----------|------|------|
| **pip-audit** | Python projects, CI/CD | Fast, accurate, free, no account | Python only |
| **Safety** | Python projects, detailed reports | Good UX, detailed info | Free tier limited |
| **Trivy** | Multi-language, containers | Comprehensive, free, fast | Can be verbose |
| **Snyk** | Enterprise, IDE integration | Great UX, fix suggestions | Requires account |
| **Dependabot** | Automated updates | Fully automated, built-in | GitHub only |

## Recommendation

**For this demo and most Python projects:**

1. **Start with pip-audit** - Simple, fast, free
2. **Add Trivy** - Comprehensive coverage
3. **Enable GitHub Dependabot** - Automated updates
4. **Optional: Add Snyk** - If you want better reporting

## Learning Resources

- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)
- [National Vulnerability Database (NVD)](https://nvd.nist.gov/)
- [GitHub Advisory Database](https://github.com/advisories)
- [PyPI Advisory Database](https://github.com/pypa/advisory-database)
- [Snyk Vulnerability Database](https://security.snyk.io/)
