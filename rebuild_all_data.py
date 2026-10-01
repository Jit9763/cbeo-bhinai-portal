import openpyxl
import os
import sys
import json
import re

sys.path.append(r'C:\Users\jiten\Desktop\class11\hlb_detail\scratch')
from krutidev2unicode import kru2uni

CENSUS_FILE = r'C:\Users\jiten\Desktop\census2026\New folder\Bhinai Main Census 2026 Revised after clean.xlsx'
PRINCIPAL_FILE = 'school principal bhinai.xlsx'
PRIVATE_SCHOOLS_FILE = r'C:\Users\jiten\Desktop\gram ganna\scraped_data\scraped_private_schools.csv'
ELEMENTARY_SCHOOLS_FILE = r'C:\Users\jiten\Desktop\gram ganna\scraped_data\scraped_elementary_schools.xlsx'

def clean_key(s):
    if not s:
        return ''
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

# Known common replacements for KrutiDev government terms
KNOWN_REPLACEMENTS = {
    'miizkpk;Z': 'उपप्राचार्य',
    'miizkpk;Z ': 'उपप्राचार्य',
    'ofj"B v/;kid': 'वरिष्ठ अध्यापक',
    'ofjB v/;kid': 'वरिष्ठ अध्यापक',
    'ofj"B': 'वरिष्ठ',
    'ofjB': 'वरिष्ठ',
    'v/;kid': 'अध्यापक',
    "'kkjhfjd-f'k{kd": 'शारीरिक शिक्षक',
    'kkjhfjd-f\'k{kd': 'शारीरिक शिक्षक',
    'MkW-': 'डॉ.',
    'MkW': 'डॉ.',
    'Jh ': 'श्री ',
    'Jh': 'श्री',
    'Jherh ': 'श्रीमती ',
    'Jherh': 'श्रीमती',
    'jkmekfo': 'राउमावि',
    'jkmkfo': 'राउप्रावि',
    'jkizkfo': 'राप्रावि',
    'jkmizkfo': 'राउप्रावि',
    'jkmikfo': 'रामावि',
    'cMxkao': 'बडगांव',
    '¼lwj[k.M½': '(सूरखण्ड)',
    '¼': '(',
    '½': ')'
}

def clean_and_convert(text):
    if not text:
        return ''
    s = str(text).strip()
    if not s or s.lower() == 'none' or s == '-':
        return ''

    # Direct known replacement check
    for k, v in KNOWN_REPLACEMENTS.items():
        if k in s:
            s = s.replace(k, v)

    # If already pure devanagari without English ASCII letters
    has_ascii = bool(re.search(r'[a-zA-Z]', s))
    if not has_ascii:
        return s.replace('¼', '(').replace('½', ')').strip()

    # Don't convert if it's an SSO ID, code, or email
    if s.startswith(('RJ', 'STF', 'SBIN', 'BARB', 'IFSC', 'http')) or '@' in s:
        return s

    try:
        converted = kru2uni(s)
        # Apply any leftover cleanup
        for k, v in KNOWN_REPLACEMENTS.items():
            if k in converted:
                converted = converted.replace(k, v)
        converted = converted.replace('¼', '(').replace('½', ')').replace('  ', ' ').strip()
        return converted
    except Exception:
        return s

def main():
    print("1. Loading School Principal Excel for PEEO Master & Principals...")
    wb_p = openpyxl.load_workbook(PRINCIPAL_FILE, data_only=True)
    ws3 = wb_p['Sheet3']
    ws5 = wb_p['Sheet5']
    ws6 = wb_p['Sheet6']

    # Extract 25 PEEOs & Government Schools under them
    peeo_schools_map = {}
    for r in range(36, ws3.max_row + 1):
        peeo = ws3.cell(r, 2).value
        gp = ws3.cell(r, 4).value
        village = ws3.cell(r, 5).value
        school = ws3.cell(r, 6).value
        dise = ws3.cell(r, 7).value
        scode = ws3.cell(r, 8).value
        if peeo:
            p_clean = str(peeo).strip()
            if p_clean not in peeo_schools_map:
                peeo_schools_map[p_clean] = []
            peeo_schools_map[p_clean].append({
                'school_name': str(school).strip() if school else '',
                'category': 'Govt. Secondary / Sr. Sec',
                'panchayat': str(gp).strip() if gp else '',
                'village': str(village).strip() if village else '',
                'dise_code': str(dise).strip() if dise else '',
                'shala_darpan_code': str(scode).strip() if scode else '',
                'type': 'Government'
            })

    # Principals & Incharges
    principals = []
    for r in range(4, ws5.max_row + 1):
        sch = ws5.cell(r, 2).value
        pname = ws5.cell(r, 3).value
        mob = ws5.cell(r, 4).value
        if sch:
            # Extract code if present e.g. (221754)
            code_m = re.search(r'\((\d+)\)', str(sch))
            sd_code = code_m.group(1) if code_m else ''
            principals.append({
                'school': str(sch).strip(),
                'name': str(pname).strip(),
                'mob': str(mob).strip(),
                'sd_code': sd_code
            })

    # Emails
    emails = [str(ws6.cell(r, 1).value).strip() for r in range(1, ws6.max_row + 1) if ws6.cell(r, 1).value]

    # Map each PEEO to their main Shala Darpan code, Principal & Email
    peeo_accounts = []
    sorted_peeos = sorted(peeo_schools_map.keys())

    # Mapping of PEEO to their primary Shala Darpan Code
    peeo_sd_codes = {
        'PEEO BANDANWARA': '221769',
        'PEEO BARGAON': '221764',
        'PEEO BARLI': '221755',
        'PEEO BHINAY': '221780',
        'PEEO BOOBKIYA': '221763',
        'PEEO CHAPANERI': '221758',
        'PEEO CHHACHHUNDRA': '221787',
        'PEEO DEOLIYA KALAN': '221754',
        'PEEO DEVPURA': '488941',
        'PEEO DHANTOL': '221783',
        'PEEO EKALSEENGA': '221786',
        'PEEO GURHA KHURD': '221762',
        'PEEO KANAI KALAN': '221765',
        'PEEO KARATI': '221773',
        'PEEO KEROT': '221767',
        'PEEO KUMHARIYA': '221777',
        'PEEO LAMGARA': '221759',
        'PEEO NAGOLA': '221772',
        'PEEO NANDSI': '221756',
        'PEEO PADALIYA': '221766',
        'PEEO PADANGA': '221788',
        'PEEO RAMMALIA': '221785',
        'PEEO RATAKOT': '221775',
        'PEEO SINGAWAL': '221781',
        'PEEO SOBRI': '221782'
    }

    aliases = {
        'BARGAON': ['badgaon', 'bargaon'],
        'BARLI': ['badli', 'barli'],
        'BHINAY': ['bhinai', 'bhinay'],
        'DEVPURA': ['devriya', 'devpura'],
        'DEOLIYA KALAN': ['deoliya', 'deolia'],
        'EKALSEENGA': ['ekalsingha', 'ekalseenga'],
        'GURHA KHURD': ['gudha khurd', 'gurha khurd'],
        'KANAI KALAN': ['kanai kala', 'kanai kalan'],
        'KARATI': ['karanti', 'karati'],
        'KEROT': ['kairot', 'kerot'],
        'PADALIYA': ['padliya', 'padaliya'],
        'RAMMALIA': ['rammaliya', 'rammalia'],
        'CHAPANERI': ['champaneri', 'chapaneri']
    }

    for idx, p in enumerate(sorted_peeos, 1):
        raw_name = p.replace('PEEO', '').strip()
        match_keys = [raw_name]
        for k, v in aliases.items():
            if k in raw_name or raw_name in k:
                match_keys.extend(v)

        mp = None
        for k in match_keys:
            ck = clean_key(k)
            for item in principals:
                if ck in clean_key(item['school']):
                    mp = item
                    break
            if mp:
                break

        me = None
        for k in match_keys:
            ck = clean_key(k)
            for em in emails:
                if ck in clean_key(em):
                    me = em
                    break
            if me:
                break

        if 'BHINAY' in p:
            mp = {'name': 'AJAY KUMAR DHABAI', 'mob': '9549240545', 'sd_code': '221780'}
            me = 'principalbhinai123@gmail.com'
        elif 'DEOLIYA' in p:
            mp = {'name': 'PURNIMA', 'mob': '9414343109', 'sd_code': '221754'}
            me = 'deoliakalan105@gmail.com'

        sd_code = peeo_sd_codes.get(p, mp.get('sd_code', f"2217{idx:02d}"))
        username = sd_code # User ID is Shala Darpan Code!
        alias_username = f"peeo_{clean_key(raw_name)}"
        password = f"{clean_key(raw_name)}#2026"

        peeo_accounts.append({
            's_no': idx,
            'peeo_id': f"PEEO{idx:02d}",
            'peeo_name': p,
            'shala_darpan_code': sd_code,
            'panchayat_name': peeo_schools_map[p][0]['panchayat'] if peeo_schools_map[p] else raw_name,
            'principal_incharge': mp['name'] if mp else 'प्रभारी प्रधानाचार्य',
            'mobile': mp['mob'] if mp else '',
            'email': me if me else f"{clean_key(raw_name)}school@gmail.com",
            'username': username,
            'alias_username': alias_username,
            'password': password,
            'schools': peeo_schools_map[p]
        })

    # 2. Add Private Schools into PEEOs
    print("2. Loading Private Schools and mapping to PEEOs...")
    import csv
    if os.path.exists(PRIVATE_SCHOOLS_FILE):
        with open(PRIVATE_SCHOOLS_FILE, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.reader(fp)
            header = next(reader, None)
            for row in reader:
                if len(row) >= 4:
                    cat = row[0].strip()
                    sch_name = row[1].strip()
                    vil = row[2].strip()
                    panchayat = row[3].strip()

                    # Extract PSP Code e.g. P60694
                    psp_m = re.search(r'\(([A-Z0-9]+)\)', sch_name)
                    psp_code = psp_m.group(1) if psp_m else ''

                    # Match to PEEO by Panchayat / Village
                    matched_p = peeo_accounts[3] # default Bhinay
                    ck_panch = clean_key(panchayat)
                    ck_vil = clean_key(vil)

                    for pa in peeo_accounts:
                        ck_peeo = clean_key(pa['panchayat_name'])
                        if ck_panch in ck_peeo or ck_peeo in ck_panch or ck_vil in ck_peeo:
                            matched_p = pa
                            break

                    matched_p['schools'].append({
                        'school_name': sch_name,
                        'category': f"Private ({cat})",
                        'panchayat': panchayat,
                        'village': vil,
                        'dise_code': '',
                        'shala_darpan_code': psp_code,
                        'type': 'Private'
                    })

    # Update school counts
    for pa in peeo_accounts:
        pa['school_count'] = len(pa['schools'])

    print(f"Total PEEOs configured: {len(peeo_accounts)}")
    total_schools = sum(len(pa['schools']) for pa in peeo_accounts)
    print(f"Total Schools (Govt + Private) across all 25 PEEOs: {total_schools}")

    # 3. Load & Clean All 1048 Karmiks from Census Master
    print("3. Loading and cleaning Census Karmik database...")
    wb_cen = openpyxl.load_workbook(CENSUS_FILE, data_only=True)
    ws_sup = wb_cen['Superviser']
    ws_prag = wb_cen['Praganak']
    ws1 = wb_cen['Sheet1']

    # Preload Unicode Names from Superviser & Praganak
    sso_lookup = {}
    for r in range(1, ws_sup.max_row + 1):
        name = ws_sup.cell(r, 2).value
        post = ws_sup.cell(r, 5).value
        sso = ws_sup.cell(r, 7).value
        if sso and name:
            sso_lookup[str(sso).strip()] = {
                'name': str(name).strip(),
                'post': clean_and_convert(post)
            }
    for r in range(2, ws_prag.max_row + 1):
        name = ws_prag.cell(r, 4).value
        post = ws_prag.cell(r, 7).value
        sso = ws_prag.cell(r, 9).value
        if sso and name:
            sso_lookup[str(sso).strip()] = {
                'name': str(name).strip(),
                'post': clean_and_convert(post)
            }

    # Pre-build PEEO lookup index
    school_to_peeo = {}
    for p in peeo_accounts:
        p_name = p['peeo_name']
        school_to_peeo[clean_key(p['peeo_name'])] = p_name
        school_to_peeo[clean_key(p['panchayat_name'])] = p_name
        core = clean_key(p['peeo_name'].replace('PEEO', ''))
        if core:
            school_to_peeo[core] = p_name
        for sch in p['schools']:
            school_to_peeo[clean_key(sch['school_name'])] = p_name
            school_to_peeo[clean_key(sch['village'])] = p_name

    karmiks = []
    for r in range(4, ws1.max_row + 1):
        name_raw = ws1.cell(r, 2).value
        if not name_raw:
            continue

        sso = str(ws1.cell(r, 7).value or '').strip()
        if sso == 'None':
            sso = ''

        if sso and sso in sso_lookup:
            name = sso_lookup[sso]['name']
            post = sso_lookup[sso]['post'] or clean_and_convert(ws1.cell(r, 5).value)
        else:
            name = clean_and_convert(name_raw)
            post = clean_and_convert(ws1.cell(r, 5).value)

        gender = str(ws1.cell(r, 3).value or '').strip()
        dob = str(ws1.cell(r, 4).value or '').strip()
        school = clean_and_convert(ws1.cell(r, 6).value)
        mob = str(ws1.cell(r, 8).value or '').strip()
        email = str(ws1.cell(r, 9).value or '').strip()
        bank_name = str(ws1.cell(r, 10).value or '').strip()
        bank_acc = str(ws1.cell(r, 11).value or '').strip()
        ifsc = str(ws1.cell(r, 12).value or '').strip()
        pan = str(ws1.cell(r, 13).value or '').strip()

        if mob.endswith('.0'): mob = mob[:-2]
        if mob in ['0', 'None', '-']: mob = ''
        if email.lower() in ['none', '-']: email = ''

        # Map to PEEO
        ck_school = clean_key(school)
        matched_peeo = 'PEEO BHINAY'
        for key, p_assigned in school_to_peeo.items():
            if len(key) >= 4 and (key in ck_school or ck_school in key):
                matched_peeo = p_assigned
                break

        staff_id = f"STF{1000 + len(karmiks) + 1}"
        karmiks.append({
            'staff_id': staff_id,
            'name': name,
            'gender': gender,
            'dob': dob,
            'post': post if post else 'अध्यापक / शिक्षक',
            'school_name': school if school else matched_peeo,
            'peeo_name': matched_peeo,
            'sso_id': sso,
            'mobile': mob,
            'email': email,
            'bank_name': bank_name if bank_name != 'None' else '',
            'bank_acc': bank_acc if bank_acc != 'None' else '',
            'ifsc': ifsc if ifsc != 'None' else '',
            'pan': pan if pan != 'None' else '',
            'status': 'Active'
        })

    print(f"Total Karmiks loaded and converted: {len(karmiks)}")

    # 4. Configure Admins (including Jitendra Kumar)
    admins = [
        {
            'admin_id': 'ADMIN01',
            'name': 'प्रमिला रासलोत (CBEO)',
            'post': 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)',
            'office': 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय',
            'mobile': '9414000000',
            'email': 'cbeo.bhinai.ajmer@rajasthan.gov.in',
            'username': 'cbeo_admin',
            'shala_darpan_code': '8140',
            'password': 'cbeo@2026',
            'role': 'Super Admin'
        },
        {
            'admin_id': 'ADMIN02',
            'name': 'जितेन्द्र कुमार (Jitendra Kumar)',
            'post': 'तकनीकी नोडल प्रभारी एवं व्यवस्थापक (Admin)',
            'office': 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय',
            'mobile': '7073800244',
            'email': 'jitendrakumar.cbeo@gmail.com',
            'username': 'jitendra_admin',
            'shala_darpan_code': 'admin_jitendra',
            'password': 'jitendra#2026',
            'role': 'Super Admin'
        }
    ]

    master_data = {
        'cbeo_info': {
            'office_name': 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय',
            'block': 'भिनाय (BHINAI)',
            'district': 'अजमेर / केकड़ी (AJMER)',
            'nic_sd_id': '8140',
            'ifms_id': '1408',
            'cbeo_officer': 'प्रमिला रासलोत',
            'admins': admins
        },
        'admins': admins,
        'peeos': peeo_accounts,
        'staff': karmiks,
        'total_staff_count': len(karmiks),
        'total_schools_count': total_schools
    }

    # Save to JSON & JS
    with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2, ensure_ascii=False)

    with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
        f.write("const MASTER_CBEO_DATA = " + json.dumps(master_data, indent=2, ensure_ascii=False) + ";\n")

    print("SUCCESS: master_cbeo_data.json and master_cbeo_data.js updated!")

    # 5. Sync to Google Drive
    print("5. Syncing updated Admin Access & Staff to Google Drive...")
    try:
        from create_cbeo_drive_backend import get_services
        drive, sheets = get_services()
        with open('drive_config.json', 'r', encoding='utf-8') as f:
            cfg = json.load(f)

        # 1_CBEO_Admin_Access_Control
        sheet1_id = cfg['sheets']['admin_access']['id']
        s1_rows = [
            ['क्र.सं.', 'ID/Code', 'नाम / कार्यालय', 'भूमिका', 'प्रभारी', 'मोबाइल नंबर', 'ईमेल ID', 'Shala Darpan Code (User ID)', 'पासवर्ड', 'कुल स्कूल']
        ]
        for a in admins:
            s1_rows.append([len(s1_rows), a['admin_id'], a['office'], a['role'], a['name'], a['mobile'], a['email'], a['shala_darpan_code'], a['password'], total_schools])
        for p in peeo_accounts:
            s1_rows.append([len(s1_rows), p['peeo_id'], p['peeo_name'], 'PEEO Incharge', p['principal_incharge'], p['mobile'], p['email'], p['shala_darpan_code'], p['password'], p['school_count']])

        sheets.spreadsheets().values().clear(spreadsheetId=sheet1_id, range="Sheet1!A1:Z500").execute()
        sheets.spreadsheets().values().update(
            spreadsheetId=sheet1_id,
            range="Sheet1!A1",
            valueInputOption="RAW",
            body={"values": s1_rows}
        ).execute()
        print("Updated 1_CBEO_Admin_Access_Control in Google Drive!")

        # 2_CBEO_Staff_Directory
        sheet2_id = cfg['sheets']['staff_directory']['id']
        s2_rows = [
            ['क्र.सं.', 'Staff ID', 'कार्मिक का नाम', 'पद', 'विद्यालय का नाम', 'संबंधित PEEO', 'मोबाइल नं.', 'ईमेल ID', 'SSO ID', 'बैंक खाता संख्या', 'IFSC कोड', 'PAN नं.', 'स्थिति']
        ]
        for idx, s in enumerate(karmiks, 1):
            s2_rows.append([
                idx, s['staff_id'], s['name'], s['post'], s['school_name'], s['peeo_name'], s['mobile'], s['email'], s['sso_id'], s['bank_acc'], s['ifsc'], s['pan'], s['status']
            ])

        sheets.spreadsheets().values().clear(spreadsheetId=sheet2_id, range="Sheet1!A1:Z2000").execute()
        sheets.spreadsheets().values().update(
            spreadsheetId=sheet2_id,
            range="Sheet1!A1",
            valueInputOption="RAW",
            body={"values": s2_rows}
        ).execute()
        print(f"Updated 2_CBEO_Staff_Directory with {len(karmiks)} staff in Google Drive!")

    except Exception as e:
        print("Google Drive Sync note:", e)

if __name__ == '__main__':
    main()
