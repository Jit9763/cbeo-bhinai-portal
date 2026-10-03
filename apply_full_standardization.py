import json
import openpyxl
import re

CENSUS_FILE = r'C:\Users\jiten\Desktop\census2026\New folder\Bhinai Main Census 2026 Revised after clean.xlsx'

with open('master_cbeo_data.json', encoding='utf-8') as f:
    master = json.load(f)

peeos = master['peeos']
s56 = json.load(open('schools_56_master.json', encoding='utf-8'))
s56_by_code = {str(s['shala_darpan_code']).strip(): s for s in s56}

from scratch_elem_names import ELEMENTARY_HINDI_NAMES
from test_census_mapping_coverage import CENSUS_RAW_TO_CODE

# 1. Standardize all 178 schools in 25 PEEOs
official_schools_dict = {}

for p in peeos:
    p_name = p['peeo_name']
    p_code = str(p.get('shala_darpan_code', '')).strip()
    
    for s in p.get('schools', []):
        code = str(s.get('shala_darpan_code', '')).strip()
        raw_name = s.get('school_name', '')
        
        if code in s56_by_code:
            s['school_name_hi'] = s56_by_code[code]['school_name_hi']
            s['school_name_en'] = s56_by_code[code]['school_name_en']
        elif code in ELEMENTARY_HINDI_NAMES:
            s['school_name_hi'] = ELEMENTARY_HINDI_NAMES[code][0]
            s['school_name_en'] = ELEMENTARY_HINDI_NAMES[code][1]
        else:
            clean_en = re.sub(r'\([^\)]*\)', '', raw_name).strip()
            clean_en = re.sub(r'\s+', ' ', clean_en)
            s['school_name_en'] = clean_en
            s['school_name_hi'] = raw_name
            
        s['school_name'] = s['school_name_hi']
        s['peeo_name'] = p_name
        s['peeo_code'] = p_code
        official_schools_dict[code] = s

print(f"Standardized {len(official_schools_dict)} official schools across 25 PEEOs.")

# 2. Load Census file row-by-row
wb = openpyxl.load_workbook(CENSUS_FILE, data_only=True)
ws1 = wb['Sheet1']
census_row_map = {}
for r in range(4, ws1.max_row + 1):
    raw_sch = str(ws1.cell(r, 6).value or '').strip()
    census_row_map[r] = raw_sch

# 3. Update staff records in master
staff_list = master.get('staff', [])
mapped_staff_count = 0
unmapped_staff_count = 0

for s in staff_list:
    staff_id = s.get('staff_id', '')
    
    if staff_id.startswith('STF'):
        try:
            # e.g. STF1001 -> row 4 (1001 - 1000 + 3 = 4)
            idx_num = int(staff_id.replace('STF', ''))
            row_num = idx_num - 1000 + 3
        except:
            row_num = None
            
        raw_census_sch = census_row_map.get(row_num, '')
        sch_code = CENSUS_RAW_TO_CODE.get(raw_census_sch)
        
        if sch_code and sch_code in official_schools_dict:
            target_sch = official_schools_dict[sch_code]
            s['shala_darpan_code'] = sch_code
            s['school_code'] = sch_code
            s['school_name'] = target_sch['school_name_hi']
            s['school_name_hi'] = target_sch['school_name_hi']
            s['school_name_en'] = target_sch['school_name_en']
            s['peeo_name'] = target_sch['peeo_name']
            s['unmapped_school'] = False
            mapped_staff_count += 1
        else:
            # Check if current shala_darpan_code matches
            cur_code = str(s.get('shala_darpan_code', '')).strip()
            if cur_code in official_schools_dict:
                target_sch = official_schools_dict[cur_code]
                s['school_name'] = target_sch['school_name_hi']
                s['school_name_hi'] = target_sch['school_name_hi']
                s['school_name_en'] = target_sch['school_name_en']
                s['peeo_name'] = target_sch['peeo_name']
                s['unmapped_school'] = False
                mapped_staff_count += 1
            else:
                s['unmapped_school'] = True
                unmapped_staff_count += 1
                
    elif staff_id.startswith('PRIN_'):
        # Principal record
        code = str(s.get('shala_darpan_code', '')).strip()
        if code in official_schools_dict:
            target_sch = official_schools_dict[code]
            s['school_name'] = target_sch['school_name_hi']
            s['school_name_hi'] = target_sch['school_name_hi']
            s['school_name_en'] = target_sch['school_name_en']
            s['peeo_name'] = target_sch['peeo_name']
            s['unmapped_school'] = False
            mapped_staff_count += 1
        else:
            s['unmapped_school'] = False
            mapped_staff_count += 1

print(f"Staff update complete: {mapped_staff_count} mapped cleanly, {unmapped_staff_count} unmapped.")

# Also ensure district rule: strictly AJMER (अजमेर), never Kekri
def sanitize_district(obj):
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if isinstance(v, str):
                if 'केकड़ी' in v or 'KEKRI' in v.upper():
                    obj[k] = v.replace('केकड़ी', 'अजमेर').replace('केेकड़ी', 'अजमेर').replace('KEKRI', 'AJMER').replace('Kekri', 'Ajmer')
            elif isinstance(v, (dict, list)):
                sanitize_district(v)
    elif isinstance(obj, list):
        for item in obj:
            sanitize_district(item)

sanitize_district(master)
sanitize_district(s56)

# Save master_cbeo_data.json
with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
    json.dump(master, f, indent=2, ensure_ascii=False)

# Save master_cbeo_data.js
with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
    f.write("const MASTER_CBEO_DATA = " + json.dumps(master, indent=2, ensure_ascii=False) + ";\n")

# Save schools_56_master.json
with open('schools_56_master.json', 'w', encoding='utf-8') as f:
    json.dump(s56, f, indent=2, ensure_ascii=False)

print("SUCCESS: Updated master_cbeo_data.json, master_cbeo_data.js, and schools_56_master.json!")
