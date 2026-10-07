import os
import json

with open('saman_syllabus_submissions.json', 'r', encoding='utf-8') as f:
    submissions_data = json.load(f)

submitted_codes = set(submissions_data.keys())
print(f"Total submitted on portal: {len(submitted_codes)}")

with open('schools_56_master.json', 'r', encoding='utf-8') as f:
    schools = json.load(f)

# The government schools expected for Saman Pariksha syllabus (type == 'Government')
saman_schools = [s for s in schools if s.get('type') == 'Government']
print(f"Total Government Schools: {len(saman_schools)}")

pending_schools = {str(s.get('shala_darpan_code')): s for s in saman_schools if str(s.get('shala_darpan_code')) not in submitted_codes}
print(f"Total Pending Schools on Portal: {len(pending_schools)}\n")

print("--- 21 PENDING GOVERNMENT SCHOOLS ---")
for idx, (code, s) in enumerate(pending_schools.items(), 1):
    print(f"{idx}. Code: {code} | Name: {s.get('school_name')} | PEEO: {s.get('peeo_name')}")
