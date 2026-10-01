import sys, os
sys.path.insert(0, os.path.abspath('.'))
import json
from datetime import datetime
from create_cbeo_drive_backend import get_services

def clean_tab_name(name):
    clean = name.replace(" ", "_").replace(".", "").replace("-", "_").strip()
    return clean[:100]

def main():
    drive, sheets = get_services()
    with open('drive_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    sheet_id = cfg['sheets']['saman_pariksha']['id']
    print(f"Target Sheet ID: {sheet_id}")

    with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
        master_data = json.load(f)
    with open('schools_56_master.json', 'r', encoding='utf-8') as f:
        schools_56 = json.load(f)
    with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
        submissions = json.load(f)

    # 1. Inspect existing sheet tabs
    meta = sheets.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing_sheets = {s['properties']['title']: s['properties']['sheetId'] for s in meta.get('sheets', [])}
    print(f"Existing tabs: {list(existing_sheets.keys())}")

    # Build list of 25 PEEO tabs
    peeo_tabs = []
    for peeo in master_data.get('peeos', []):
        peeo_tab_name = clean_tab_name(peeo['peeo_name'])
        peeo_tabs.append((peeo_tab_name, peeo))

    # Tabs to add: Auth_Passwords + 25 PEEO tabs
    needed_tabs = ['Auth_Passwords'] + [t[0] for t in peeo_tabs]
    add_sheet_requests = []
    for t in needed_tabs:
        if t not in existing_sheets:
            add_sheet_requests.append({
                'addSheet': {
                    'properties': {
                        'title': t,
                        'gridProperties': {
                            'frozenRowCount': 1
                        }
                    }
                }
            })

    if add_sheet_requests:
        print(f"Adding {len(add_sheet_requests)} new tabs...")
        batch_res = sheets.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body={'requests': add_sheet_requests}
        ).execute()
        for r in batch_res.get('replies', []):
            if 'addSheet' in r:
                p = r['addSheet']['properties']
                existing_sheets[p['title']] = p['sheetId']

    # 2. Populate Auth_Passwords tab
    auth_rows = [
        ["क्र.सं.", "भूमिका (Role)", "विद्यालय / कार्यालय का नाम", "लॉगिन कोड (Login_Code)", "पासवर्ड (Password)", "मोबाइल नंबर", "अंतिम अपडेट"]
    ]
    sno = 1
    # Admins
    for admin in master_data.get('admins', []):
        auth_rows.append([
            sno,
            "Admin",
            admin.get('office', 'कार्यालय CBEO भिनाय') + f" ({admin.get('name')})",
            admin.get('username') or admin.get('shala_darpan_code'),
            admin.get('password', 'cbeo@2026'),
            admin.get('mobile', ''),
            datetime.now().strftime('%d-%m-%Y %H:%M')
        ])
        sno += 1
    # 25 PEEOs
    for peeo in master_data.get('peeos', []):
        auth_rows.append([
            sno,
            "PEEO",
            peeo.get('peeo_name', ''),
            str(peeo.get('shala_darpan_code', '')),
            str(peeo.get('password') or peeo.get('shala_darpan_code', '')),
            peeo.get('mobile', ''),
            datetime.now().strftime('%d-%m-%Y %H:%M')
        ])
        sno += 1
    # 57 Schools
    for sch in schools_56:
        auth_rows.append([
            sno,
            "School",
            sch.get('school_name', ''),
            str(sch.get('shala_darpan_code', '')),
            str(sch.get('shala_darpan_code', '')),
            sch.get('principal_mobile') or sch.get('mobile', ''),
            datetime.now().strftime('%d-%m-%Y %H:%M')
        ])
        sno += 1

    print(f"Writing {len(auth_rows)} credentials to Auth_Passwords tab...")
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range='Auth_Passwords!A1:G' + str(len(auth_rows)),
        valueInputOption='RAW',
        body={'values': auth_rows}
    ).execute()

    # 3. Populate 25 PEEO Tabs
    peeo_header = [
        "क्र.सं. (S.No)",
        "शाला दर्पण कोड (School_Code)",
        "विद्यालय का नाम (School_Name)",
        "श्रेणी (Category)",
        "मांग आईडी (Demand_ID)",
        "स्थिति (Status)",
        "कुल योग (Grand_Total)",
        "प्रमाणित कर्ता (Submitted_By)",
        "समय मुहर (Timestamp)",
        "डेटा JSON (Data_JSON)"
    ]

    for peeo_tab_name, peeo in peeo_tabs:
        peeo_code = str(peeo.get('shala_darpan_code', '')).strip()
        peeo_name = str(peeo.get('peeo_name', '')).strip()
        # Find schools belonging to this PEEO
        matching_schools = [s for s in schools_56 if s.get('peeo_code') == peeo_code or s.get('peeo_name') == peeo_name]
        
        tab_rows = [peeo_header]
        p_sno = 1
        for sch in matching_schools:
            code = str(sch.get('shala_darpan_code', '')).strip()
            sub = submissions.get(code)
            if sub:
                status = sub.get('status', 'पूर्ण (Submitted)')
                gt = sub.get('grand_total', 0)
                sub_by = sub.get('submitted_by') or sub.get('principal_name') or ''
                ts = sub.get('timestamp') or ''
                json_str = json.dumps(sub, ensure_ascii=False)
            else:
                status = "प्रक्रियाधीन (Pending)"
                gt = 0
                sub_by = ""
                ts = ""
                json_str = ""

            tab_rows.append([
                p_sno,
                code,
                sch.get('school_name', ''),
                sch.get('category', ''),
                "saman_pariksha_2026_27",
                status,
                gt,
                sub_by,
                ts,
                json_str
            ])
            p_sno += 1

        print(f"Updating {peeo_tab_name} with {len(tab_rows)} rows...")
        sheets.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=f"'{peeo_tab_name}'!A1:J{len(tab_rows)}",
            valueInputOption='RAW',
            body={'values': tab_rows}
        ).execute()

    print("ALL 25 PEEO TABS AND AUTH_PASSWORDS TAB CREATED & SYNCED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
