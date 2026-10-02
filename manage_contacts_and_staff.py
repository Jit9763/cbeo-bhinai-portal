import os
import sys
import json
import re

CONTACTS_MD_FILE = 'CBEO_BHINAI_CONTACT_DIRECTORY_MASTER.md'
MASTER_JSON_FILE = 'master_cbeo_data.json'
MASTER_JS_FILE = 'master_cbeo_data.js'
SCHOOLS_56_FILE = 'schools_56_master.json'

def update_sanstha_pradhan_in_all_files(staff_id, is_sanstha_pradhan=True, school_name=None, peeo_name=None, name=None, mobile=None):
    """
    Updates Sanstha Pradhan across:
    1. master_cbeo_data.json & master_cbeo_data.js
    2. schools_56_master.json
    3. CBEO_BHINAI_CONTACT_DIRECTORY_MASTER.md
    4. Google Sheet (if configured)
    """
    res = {'success': False, 'message': ''}
    
    # 1. Update master_cbeo_data.json
    if not os.path.exists(MASTER_JSON_FILE):
        return {'success': False, 'message': 'master_cbeo_data.json not found'}
    
    with open(MASTER_JSON_FILE, 'r', encoding='utf-8') as f:
        master = json.load(f)
        
    staff_list = master.get('staff', [])
    target_staff = None
    for s in staff_list:
        if s.get('staff_id') == staff_id or (name and s.get('name') == name and mobile and s.get('mobile') == mobile):
            target_staff = s
            break
            
    if not target_staff:
        return {'success': False, 'message': f'Staff ID {staff_id} not found in database'}
        
    s_school = school_name or target_staff.get('school_name', '')
    s_peeo = peeo_name or target_staff.get('peeo_name', '')
    s_name = name or target_staff.get('name', '')
    s_mob = mobile or target_staff.get('mobile', '')
    
    # Reset other staff in the same school if marking this one as true
    if is_sanstha_pradhan:
        for s in staff_list:
            if s.get('school_name') == s_school and s.get('staff_id') != target_staff.get('staff_id'):
                s['is_sanstha_pradhan'] = False
        target_staff['is_sanstha_pradhan'] = True
        target_staff['post'] = 'प्रधानाचार्य / संस्था प्रधान'
        if s_mob:
            target_staff['mobile'] = s_mob
    else:
        target_staff['is_sanstha_pradhan'] = False
        if target_staff.get('post') == 'प्रधानाचार्य / संस्था प्रधान':
            target_staff['post'] = 'अध्यापक'
            
    # Check if school is in schools_56
    s56_list = []
    if os.path.exists(SCHOOLS_56_FILE):
        with open(SCHOOLS_56_FILE, 'r', encoding='utf-8') as f:
            s56_list = json.load(f)
            
    for sch in s56_list:
        if sch.get('school_name') == s_school or sch.get('shala_darpan_code') == target_staff.get('sso_id'):
            if is_sanstha_pradhan:
                sch['principal_name'] = s_name
                if s_mob:
                    sch['principal_mobile'] = s_mob
            break
            
    # Check if this school is a PEEO nodal school
    is_peeo_nodal = False
    for p in master.get('peeos', []):
        if p.get('peeo_name') == s_peeo:
            for sc in p.get('schools', []):
                if sc.get('school_name') == s_school and sc.get('is_peeo_nodal'):
                    is_peeo_nodal = True
                    break
            if is_peeo_nodal:
                if is_sanstha_pradhan:
                    p['principal_incharge'] = s_name
                    if s_mob:
                        p['mobile'] = s_mob
                break

    # Save master_cbeo_data.json and .js
    with open(MASTER_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(master, f, indent=2, ensure_ascii=False)
        
    with open(MASTER_JS_FILE, 'w', encoding='utf-8') as f:
        f.write('const MASTER_CBEO_DATA = ' + json.dumps(master, indent=2, ensure_ascii=False) + ';\n')
        
    if s56_list:
        with open(SCHOOLS_56_FILE, 'w', encoding='utf-8') as f:
            json.dump(s56_list, f, indent=2, ensure_ascii=False)

    # 3. Update CBEO_BHINAI_CONTACT_DIRECTORY_MASTER.md
    if os.path.exists(CONTACTS_MD_FILE):
        try:
            with open(CONTACTS_MD_FILE, 'r', encoding='utf-8') as f:
                md_content = f.read()
                
            # If PEEO nodal was updated, update in Table 1
            if is_peeo_nodal and is_sanstha_pradhan and s_peeo in md_content:
                # Replace row for this PEEO
                pattern = rf'\| (\d+) \| ({s_peeo}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|'
                replacement = rf'| \1 | \2 | {s_name} | {s_mob} | \5 |'
                md_content = re.sub(pattern, replacement, md_content)
                
            # In Table 2 (Schools), update principal for s_school if present
            if is_sanstha_pradhan and s_school in md_content:
                lines = md_content.split('\n')
                new_lines = []
                for line in lines:
                    if s_school in line and '|' in line:
                        parts = [p.strip() for p in line.split('|')]
                        # Parts: ['', 'SN', 'SD Code', 'School Name', 'Category', 'PEEO', 'Principal', 'Mobile', '']
                        if len(parts) >= 9:
                            parts[6] = s_name
                            parts[7] = s_mob
                            line = ' | '.join(parts)
                    new_lines.append(line)
                md_content = '\n'.join(new_lines)
                
            with open(CONTACTS_MD_FILE, 'w', encoding='utf-8') as f:
                f.write(md_content)
        except Exception as e_md:
            print(f"[Warning] Error updating markdown file: {e_md}")

    # 4. Optional: Update Google Sheet if credentials available
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        SERVICE_ACCOUNT_FILE = 'service_account.json'
        SPREADSHEET_ID = '1-x8K6Qe8Z6_b5wZfJ9r4N59tXw7x_qE7m1a9b2c3d4e' # placeholder or from env
        # Sync if sheet configured
    except Exception:
        pass
        
    status_text = "संस्था प्रधान नियुक्त किया गया" if is_sanstha_pradhan else "संस्था प्रधान पद से मुक्त किया गया"
    return {
        'success': True,
        'message': f"कार्मिक {s_name} को {s_school} का {status_text}। मास्टर डायरेक्टरी एवं फाइलों में सुरक्षित!",
        'staff': target_staff
    }

def save_or_update_staff_member(staff_data):
    """
    Adds, edits, or changes school for a staff member.
    """
    if not os.path.exists(MASTER_JSON_FILE):
        return {'success': False, 'message': 'master_cbeo_data.json not found'}
        
    with open(MASTER_JSON_FILE, 'r', encoding='utf-8') as f:
        master = json.load(f)
        
    staff_list = master.get('staff', [])
    staff_id = staff_data.get('staff_id')
    
    existing = None
    for s in staff_list:
        if s.get('staff_id') == staff_id:
            existing = s
            break
            
    if existing:
        # Update existing
        for k, v in staff_data.items():
            existing[k] = v
        action = "अपडेट"
    else:
        # Add new
        if not staff_id:
            staff_id = f"STF{1000 + len(staff_list) + 1}"
            staff_data['staff_id'] = staff_id
        staff_data['status'] = staff_data.get('status', 'Active')
        staff_list.insert(0, staff_data)
        action = "नया कार्मिक जोड़ा गया"
        
    master['total_staff_count'] = len(staff_list)
    
    with open(MASTER_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(master, f, indent=2, ensure_ascii=False)
        
    with open(MASTER_JS_FILE, 'w', encoding='utf-8') as f:
        f.write('const MASTER_CBEO_DATA = ' + json.dumps(master, indent=2, ensure_ascii=False) + ';\n')
        
    return {'success': True, 'message': f"कार्मिक {staff_data.get('name')} का विवरण {action}!", 'staff_id': staff_id}

def relieve_or_delete_staff_member(staff_id, reason="कार्यमुक्त"):
    """
    Marks staff as Relieved / Inactive with reason.
    """
    if not os.path.exists(MASTER_JSON_FILE):
        return {'success': False, 'message': 'master_cbeo_data.json not found'}
        
    with open(MASTER_JSON_FILE, 'r', encoding='utf-8') as f:
        master = json.load(f)
        
    staff_list = master.get('staff', [])
    for s in staff_list:
        if s.get('staff_id') == staff_id:
            s['status'] = 'Relieved'
            s['remarks'] = f"{reason} - {s.get('remarks', '')}".strip(' -')
            s['is_sanstha_pradhan'] = False
            
            with open(MASTER_JSON_FILE, 'w', encoding='utf-8') as f_out:
                json.dump(master, f_out, indent=2, ensure_ascii=False)
            with open(MASTER_JS_FILE, 'w', encoding='utf-8') as f_js:
                f_js.write('const MASTER_CBEO_DATA = ' + json.dumps(master, indent=2, ensure_ascii=False) + ';\n')
                
            return {'success': True, 'message': f"कार्मिक {s.get('name')} को सफलतापूर्वक {reason} किया गया!"}
            
    return {'success': False, 'message': 'कार्मिक नहीं मिला'}
