import json

with open('matdan_kendra_116_booths.json', 'r', encoding='utf-8') as f:
    booths = json.load(f)

with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

school_codes_30 = [
    "221764", "221755", "485030", "221769", "221780",
    "221763", "221758", "221787", "221754", "488941",
    "221783", "221786", "488897", "221762", "488947",
    "221765", "221773", "221767", "221774", "221777",
    "221759", "221772", "221756", "221788", "221766",
    "221785", "221775", "221781", "221782", "410859"
]

schools_map = {}
for s in d['schools_56']:
    schools_map[str(s['shala_darpan_code'])] = s

for code in school_codes_30:
    if code not in schools_map:
        staff_match = [st for st in d['staff'] if str(st.get('shala_darpan_code')) == code]
        if staff_match:
            st = staff_match[0]
            schools_map[code] = {
                "shala_darpan_code": code,
                "school_name": st['school_name'],
                "school_name_hi": st['school_name'],
                "peeo_name": st['peeo_name'],
                "principal_name": "संस्था प्रधान",
                "principal_mobile": st.get('mobile', '---'),
                "category": "Govt School",
                "type": "Government"
            }

schools_30_list = []
for code in school_codes_30:
    sch = schools_map.get(code, {})
    sch_booths = [b for b in booths if b['school_code'] == code]
    gp_name = sch_booths[0]['panchayat_hi'] if sch_booths else ""
    schools_30_list.append({
        "shala_darpan_code": code,
        "school_name": sch.get('school_name_hi') or sch.get('school_name') or f"राजकीय विद्यालय {gp_name}",
        "school_name_en": sch.get('school_name_en') or sch.get('school_name') or f"Govt School {gp_name}",
        "panchayat_name": gp_name,
        "peeo_name": sch.get('peeo_name') or gp_name,
        "principal_name": sch.get('principal_name') or "संस्था प्रधान",
        "principal_mobile": sch.get('principal_mobile') or "9414000000",
        "booth_count": len(sch_booths),
        "booths": sch_booths
    })

js_content = f"""/**
 * CBEO Bhinai Portal - Election 2026 Verification Master Data (Sheet P-3 Standards)
 * District: AJMER (अजमेर) | Block: Bhinai (भिनाय)
 * 30 Panchayat Schools & 116 Polling Booths (State Election Commission 2026)
 */

const ELECTION_2026_SCHOOLS = {json.dumps(schools_30_list, ensure_ascii=False, indent=2)};

const ELECTION_2026_BOOTHS = {json.dumps(booths, ensure_ascii=False, indent=2)};

if (typeof window !== 'undefined') {{
  window.ELECTION_2026_SCHOOLS = ELECTION_2026_SCHOOLS;
  window.ELECTION_2026_BOOTHS = ELECTION_2026_BOOTHS;
}}
"""

with open("js/election_data.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Generated js/election_data.js successfully!")
