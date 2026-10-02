import re
import os

def audit_codebase():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    with open('app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    with open('server.py', 'r', encoding='utf-8') as f:
        server = f.read()

    print("==================================================")
    print("🤖 CBEO Bhinai AI Quality & Integrity Tester")
    print("==================================================")

    # 1. HTML Event Handler Validation
    event_calls = re.findall(r'on(?:click|change|submit)="([a-zA-Z0-9_]+)\(', html)
    missing_fns = []
    for fn in sorted(set(event_calls)):
        if not re.search(r'function\s+' + fn + r'\b', js) and not re.search(r'\b' + fn + r'\s*=', js):
            missing_fns.append(fn)

    print(f"\n[TEST 1] HTML Event Handlers ({len(set(event_calls))} total events):")
    if missing_fns:
        print(f"  ❌ Missing event functions: {missing_fns}")
    else:
        print("  ✓ 100% PASS - Every HTML onclick/onchange function exists in app.js!")

    # 2. Fetch Endpoints in app.js vs server.py
    fetch_endpoints = re.findall(r"fetch\(['\"](/api/[a-zA-Z0-9_]+)['\"]", js)
    missing_endpoints = []
    for ep in sorted(set(fetch_endpoints)):
        if ep not in server:
            missing_endpoints.append(ep)

    print(f"\n[TEST 2] API Endpoints ({len(set(fetch_endpoints))} total endpoints):")
    if missing_endpoints:
        print(f"  ❌ Missing backend endpoints in server.py: {missing_endpoints}")
    else:
        print("  ✓ 100% PASS - Every API endpoint called by app.js is handled in server.py!")

    # 3. Check for Empty or Broken Links in HTML
    broken_hrefs = re.findall(r'href="([^"]*)"', html)
    empty_hashes = [h for h in broken_hrefs if h == '#' or h == '']
    print(f"\n[TEST 3] Navigation Links ({len(broken_hrefs)} total links):")
    print(f"  Found {len(empty_hashes)} placeholder hashes 'href=\"#\"' (acceptable if handled by JS).")

    # 4. District Rule Strict Compliance
    print(f"\n[TEST 4] Mandatory District Rule Check (अजमेर / AJMER ONLY):")
    bad_district_count = 0
    for fname in ['index.html', 'app.js', 'server.py', 'styles.css', 'scripts/cbeo_vm_notifier.py']:
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
            for line_no, line in enumerate(content.splitlines(), 1):
                if re.search(r'\bजिला\s*:\s*केकड़ी\b', line, re.I) or re.search(r'\bDistrict\s*:\s*Kekri\b', line, re.I):
                    print(f"  ❌ VIOLATION in {fname}:{line_no}: {line.strip()}")
                    bad_district_count += 1
    if bad_district_count == 0:
        print("  ✓ 100% PASS - Zero violations! District is strictly AJMER (अजमेर) across all files.")

if __name__ == '__main__':
    audit_codebase()
