import json

with open('matdan_kendra_116_booths.json', 'r', encoding='utf-8') as f:
    booths = json.load(f)

with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

schools_map = {}
for s in d.get('schools_56', []):
    schools_map[str(s['shala_darpan_code'])] = s

for p in d.get('peeos', []):
    for s in p.get('schools', []):
        code = str(s.get('shala_darpan_code') or '')
        if code and code not in schools_map:
            schools_map[code] = {
                "shala_darpan_code": code,
                "school_name": s.get('school_name'),
                "school_name_hi": s.get('school_name'),
                "school_name_en": s.get('school_name'),
                "peeo_name": p.get('peeo_name'),
                "peeo_code": p.get('shala_darpan_code'),
                "principal_name": s.get('principal_name') or "संस्था प्रधान",
                "principal_mobile": s.get('mobile') or "---"
            }

for st in d.get('staff', []):
    code = str(st.get('shala_darpan_code') or '')
    if code and code not in schools_map:
        schools_map[code] = {
            "shala_darpan_code": code,
            "school_name": st.get('school_name'),
            "school_name_hi": st.get('school_name'),
            "school_name_en": st.get('school_name_en') or st.get('school_name'),
            "peeo_name": st.get('peeo_name'),
            "principal_name": st.get('name') or "संस्था प्रधान",
            "principal_mobile": st.get('mobile', '---')
        }

# Special principal info for 410859
if "410859" in schools_map:
    schools_map["410859"]["principal_name"] = "शांति लाल जाट"
    schools_map["410859"]["principal_mobile"] = "8003697585"

# Ordered unique codes based on booth appearance
school_codes_33 = []
for b in booths:
    code = str(b['school_code'])
    if code not in school_codes_33:
        school_codes_33.append(code)

peeo_code_map = {
    "PEEO BANDANWARA": "221769",
    "PEEO BARGAON": "221764",
    "PEEO BARLI": "221755",
    "PEEO BHINAY": "221780",
    "PEEO BOOBKIYA": "221763",
    "PEEO CHAPANERI": "221758",
    "PEEO CHHACHHUNDRA": "221787",
    "PEEO DEOLIYA KALAN": "221754",
    "PEEO DEVPURA": "488941",
    "PEEO DHANTOL": "221783",
    "PEEO EKALSEENGA": "221786",
    "PEEO GURHA KHURD": "221762",
    "PEEO KANAI KALAN": "221765",
    "PEEO KARATI": "221773",
    "PEEO KEROT": "221767",
    "PEEO KUMHARIYA": "221777",
    "PEEO LAMGARA": "221759",
    "PEEO NAGOLA": "221772",
    "PEEO NANDSI": "221756",
    "PEEO PADALIYA": "221766",
    "PEEO PADANGA": "221788",
    "PEEO RAMMALIA": "221785",
    "PEEO RATAKOT": "221775",
    "PEEO SINGAWAL": "221781",
    "PEEO SOBRI": "221782"
}

schools_33_list = []
for code in school_codes_33:
    sch = schools_map.get(code, {})
    sch_booths = [b for b in booths if str(b['school_code']) == code]
    gp_name = sch_booths[0]['panchayat_hi'] if sch_booths else ""
    peeo_name = sch.get('peeo_name') or f"PEEO {gp_name}"
    peeo_code = sch.get('peeo_code') or peeo_code_map.get(peeo_name, "")
    name_hi = sch.get('school_name_hi') or sch.get('school_name') or f"राजकीय विद्यालय {gp_name}"
    name_en = sch.get('school_name_en') or sch.get('school_name') or f"Govt School {gp_name}"

    for b in sch_booths:
        b['building_hi'] = name_hi
        b['peeo_name'] = peeo_name

    schools_33_list.append({
        "shala_darpan_code": code,
        "school_name": name_hi,
        "school_name_en": name_en,
        "panchayat_name": gp_name,
        "peeo_name": peeo_name,
        "peeo_code": peeo_code,
        "principal_name": sch.get('principal_name') or "संस्था प्रधान",
        "principal_mobile": sch.get('principal_mobile') or sch.get('mobile') or "9414000000",
        "booth_count": len(sch_booths),
        "booths": sch_booths
    })

js_content = f"""/**
 * CBEO Bhinai Portal - Election 2026 Verification Master Data (Sheet P-3 Standards)
 * District: AJMER (अजमेर) | Block: Bhinai (भिनाय)
 * 33 Polling Station Schools & 116 Polling Booths (State Election Commission 2026)
 */

const ELECTION_2026_SCHOOLS = {json.dumps(schools_33_list, ensure_ascii=False, indent=2)};

const ELECTION_2026_BOOTHS = {json.dumps(booths, ensure_ascii=False, indent=2)};

if (typeof window !== 'undefined') {{
  window.ELECTION_2026_SCHOOLS = ELECTION_2026_SCHOOLS;
  window.ELECTION_2026_BOOTHS = ELECTION_2026_BOOTHS;
}}
"""

with open("js/election_data.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Generated js/election_data.js successfully with {len(schools_33_list)} schools and {len(booths)} booths!")
