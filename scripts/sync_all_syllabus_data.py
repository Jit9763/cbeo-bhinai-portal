# -*- coding: utf-8 -*-
"""
Sync all live syllabus submissions from Google Sheet to:
1. saman_syllabus_submissions.json
2. cbeo_data.sqlite
3. master_cbeo_data.json
4. master_cbeo_data.js
"""
import os
import json
import sqlite3
import requests

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
gas_url = 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec'

print("Fetching DEMAND_SAMAN_SYLLABUS_2026 from GAS...")
r = requests.get(f"{gas_url}?action=getDemandSubmissions&demand_id=DEMAND_SAMAN_SYLLABUS_2026", timeout=25)
if r.status_code != 200:
    print("Error fetching from GAS:", r.status_code)
    exit(1)

raw_subs = r.json().get('submissions', {})
print(f"Fetched {len(raw_subs)} raw submissions from GAS")

syl_subs = {}
for code, sub_data in raw_subs.items():
    if isinstance(sub_data, str):
        try:
            sub_data = json.loads(sub_data)
        except Exception:
            pass
    if isinstance(sub_data, dict):
        if 'data_json' in sub_data:
            try:
                parsed = json.loads(sub_data['data_json']) if isinstance(sub_data['data_json'], str) else sub_data['data_json']
                sub_data.update(parsed)
            except Exception:
                pass
        sub_data['is_submitted'] = True
        syl_subs[str(code).strip()] = sub_data

print("Processed school codes:", list(syl_subs.keys()))

# 1. Save to saman_syllabus_submissions.json
json_path = os.path.join(root_dir, 'saman_syllabus_submissions.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(syl_subs, f, ensure_ascii=False, indent=2)
print("✓ Saved to saman_syllabus_submissions.json")

# 2. Save to cbeo_data.sqlite
sqlite_path = os.path.join(root_dir, 'cbeo_data.sqlite')
if os.path.exists(sqlite_path):
    con = sqlite3.connect(sqlite_path)
    cur = con.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ('__SAMAN_SYLLABUS_SUBMISSIONS__', json.dumps(syl_subs, ensure_ascii=False))
    )
    con.commit()
    con.close()
    print("✓ Saved to cbeo_data.sqlite")

# 3. Save to master_cbeo_data.json & master_cbeo_data.js
master_json_path = os.path.join(root_dir, 'master_cbeo_data.json')
with open(master_json_path, 'r', encoding='utf-8') as f:
    master_data = json.load(f)

master_data['saman_syllabus_submissions'] = syl_subs

with open(master_json_path, 'w', encoding='utf-8') as f:
    json.dump(master_data, f, ensure_ascii=False, indent=2)
print("✓ Saved to master_cbeo_data.json")

master_js_path = os.path.join(root_dir, 'master_cbeo_data.js')
with open(master_js_path, 'w', encoding='utf-8') as f:
    f.write('const MASTER_CBEO_DATA = ' + json.dumps(master_data, ensure_ascii=False, indent=2) + ';\n')
print("✓ Saved to master_cbeo_data.js")

print("All sync operations completed successfully!")
