import os
import sys
import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
TOKEN_FILE = r"C:\Users\jiten\Desktop\panchayat chunav\scratch\token_panchayat.json"
CONFIG_FILE = "drive_config.json"

def get_services():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    drive = build('drive', 'v3', credentials=creds)
    sheets = build('sheets', 'v4', credentials=creds)
    return drive, sheets

def update_single_password(user_id, new_password):
    """
    Finds a user by user_id (Shala Darpan code, PEEO ID, or username)
    in 1_CBEO_Admin_Access_Control and updates Column I (पासवर्ड) and Column K (अंतिम अपडेट).
    Returns dict with status and details.
    """
    drive, sheets = get_services()
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    sheet_id = cfg['sheets']['admin_access']['id']

    # Read existing rows
    res = sheets.spreadsheets().values().get(spreadsheetId=sheet_id, range='Sheet1!A1:K100').execute()
    rows = res.get('values', [])
    if not rows:
        return {'success': False, 'message': 'शीट में डेटा नहीं मिला'}

    target_row_idx = None
    user_str = str(user_id).strip().lower()

    for idx, r in enumerate(rows):
        if idx == 0:
            continue
        # Check ID/Code (Col B), Shala Darpan (Col H), or Name (Col C)
        col_b = str(r[1]).strip().lower() if len(r) > 1 else ''
        col_h = str(r[7]).strip().lower() if len(r) > 7 else ''
        if user_str in [col_b, col_h] or (user_str == 'admin_jitendra' and 'admin02' in col_b) or (user_str == '8140' and 'admin01' in col_b):
            target_row_idx = idx + 1
            break

    now_str = datetime.now().strftime('%d-%m-%Y %H:%M:%S')

    if target_row_idx:
        # Update Column I (पासवर्ड) and Column K (अंतिम अपडेट)
        update_range = f"Sheet1!I{target_row_idx}:K{target_row_idx}"
        sheets.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=update_range,
            valueInputOption="RAW",
            body={"values": [[new_password, rows[target_row_idx-1][9] if len(rows[target_row_idx-1]) > 9 else '', f"अपडेटेड: {now_str}"]]}
        ).execute()
        print(f"Updated password for {user_id} at row {target_row_idx} to '{new_password}'")
        return {'success': True, 'row': target_row_idx, 'user_id': user_id, 'timestamp': now_str}
    else:
        # If user not found, append a new row
        new_row = [
            len(rows),
            user_id,
            f"User {user_id}",
            "User",
            "-",
            "-",
            "-",
            user_id,
            new_password,
            "-",
            f"नया जोड़ा गया: {now_str}"
        ]
        sheets.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range="Sheet1!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [new_row]}
        ).execute()
        print(f"Appended new user {user_id} with password '{new_password}'")
        return {'success': True, 'row': len(rows) + 1, 'user_id': user_id, 'timestamp': now_str}

def sync_full_admin_sheet():
    """
    Initializes/refreshes 1_CBEO_Admin_Access_Control with:
    - 2 Admins
    - 25 PEEOs
    - 56 Senior Secondary / Secondary Schools
    Preserves any existing custom passwords.
    """
    drive, sheets = get_services()
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    sheet_id = cfg['sheets']['admin_access']['id']

    # Load master data
    with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
        master = json.load(f)

    # Read existing passwords from sheet to preserve them
    existing_passwords = {}
    try:
        res = sheets.spreadsheets().values().get(spreadsheetId=sheet_id, range='Sheet1!A1:K100').execute()
        for r in res.get('values', [])[1:]:
            if len(r) > 8:
                b_code = str(r[1]).strip()
                h_code = str(r[7]).strip()
                pwd = str(r[8]).strip()
                if b_code and pwd:
                    existing_passwords[b_code] = pwd
                if h_code and pwd:
                    existing_passwords[h_code] = pwd
    except Exception as e:
        print("Note reading existing sheet:", e)

    header = [
        'क्र.सं.',
        'ID/Code',
        'नाम / कार्यालय',
        'भूमिका',
        'प्रभारी / संस्था प्रधान',
        'मोबाइल नंबर',
        'ईमेल ID',
        'Shala Darpan Code (User ID)',
        'पासवर्ड',
        'कुल स्कूल / संबंधित PEEO',
        'अंतिम अपडेट'
    ]

    all_rows = [header]
    row_count = 1
    now_str = datetime.now().strftime('%d-%m-%Y %H:%M')

    # 1. Admins (2)
    admins = master.get('admins', [
        {
            'admin_id': 'ADMIN01',
            'name': 'प्रमिला रासलोत (CBEO)',
            'post': 'मुख्य ब्लॉक शिक्षा अधिकारी',
            'mobile': '9414000000',
            'email': 'cbeo.bhinai.ajmer@rajasthan.gov.in',
            'username': 'cbeo_admin',
            'shala_darpan_code': '8140',
            'default_password': 'cbeo@2026',
            'role': 'Super Admin'
        },
        {
            'admin_id': 'ADMIN02',
            'name': 'जितेन्द्र कुमार (Jitendra Kumar)',
            'post': 'तकनीकी नोडल प्रभारी एवं व्यवस्थापक',
            'mobile': '7073800244',
            'email': 'jitendrakumar.cbeo@gmail.com',
            'username': 'jitendra_admin',
            'shala_darpan_code': 'admin_jitendra',
            'default_password': 'jitendra#2026',
            'role': 'Super Admin'
        }
    ])

    for adm in admins:
        pwd = existing_passwords.get(adm['shala_darpan_code']) or existing_passwords.get(adm['admin_id']) or adm.get('password') or adm.get('default_password')
        all_rows.append([
            row_count,
            adm['admin_id'],
            f"कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय ({adm['name']})",
            adm.get('role', 'Super Admin'),
            adm['name'],
            adm['mobile'],
            adm['email'],
            adm['shala_darpan_code'],
            pwd,
            'सम्पूर्ण ब्लॉक (178 स्कूल)',
            f"सिंक: {now_str}"
        ])
        row_count += 1

    # 2. PEEOs (25)
    peeos = master.get('peeos', [])
    for peeo in peeos:
        sd = str(peeo.get('shala_darpan_code', '')).strip()
        pid = peeo.get('peeo_id', '')
        default_pwd = sd
        pwd = existing_passwords.get(sd) or existing_passwords.get(pid) or default_pwd
        school_count = len(peeo.get('schools', []))
        all_rows.append([
            row_count,
            pid,
            peeo.get('peeo_name', ''),
            'PEEO Incharge (नोडल)',
            peeo.get('principal_incharge', ''),
            peeo.get('mobile', ''),
            peeo.get('email', ''),
            sd,
            pwd,
            f"{school_count} विद्यालय",
            f"सिंक: {now_str}"
        ])
        row_count += 1

    # 3. 56 Senior Secondary / Secondary Schools
    schools56 = master.get('schools_56', [])
    # Track SD codes already added under PEEO to avoid exact duplicates or label as School
    seen_sd = set()
    for s in schools56:
        sd = str(s.get('shala_darpan_code', '')).strip()
        if sd in seen_sd:
            continue
        seen_sd.add(sd)
        default_pwd = sd
        pwd = existing_passwords.get(sd) or default_pwd
        all_rows.append([
            row_count,
            f"SCH{row_count:02d}",
            s.get('school_name', ''),
            f"{s.get('category', 'School')} ({s.get('type', 'Govt')})",
            s.get('principal_name', '') or 'संस्था प्रधान',
            s.get('principal_mobile', ''),
            f"{sd}@rajeduboard.rajasthan.gov.in",
            sd,
            pwd,
            s.get('peeo_name', ''),
            f"सिंक: {now_str}"
        ])
        row_count += 1

    # Write all rows to Google Sheet
    sheets.spreadsheets().values().clear(
        spreadsheetId=sheet_id,
        range="Sheet1!A1:Z150"
    ).execute()

    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": all_rows}
    ).execute()

    print(f"Successfully populated {len(all_rows)} rows in 1_CBEO_Admin_Access_Control!")

    # Format header & password column styling
    try:
        format_requests = [
            # Freeze row 1
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": 0,
                        "gridProperties": {
                            "frozenRowCount": 1
                        }
                    },
                    "fields": "gridProperties.frozenRowCount"
                }
            },
            # Header style: Navy Blue #1b365d, white bold text
            {
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": 11
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": 0.106, "green": 0.212, "blue": 0.365},
                            "textFormat": {
                                "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0},
                                "bold": True,
                                "fontSize": 10
                            },
                            "horizontalAlignment": "CENTER",
                            "verticalAlignment": "MIDDLE"
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                }
            },
            # Highlight Column I (पासवर्ड - index 8) with light yellow/amber background
            {
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 1,
                        "endRowIndex": len(all_rows),
                        "startColumnIndex": 8,
                        "endColumnIndex": 9
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": 0.996, "green": 0.98, "blue": 0.88},
                            "textFormat": {
                                "foregroundColor": {"red": 0.08, "green": 0.34, "blue": 0.16},
                                "bold": True,
                                "fontSize": 10
                            },
                            "horizontalAlignment": "CENTER"
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                }
            }
        ]
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body={"requests": format_requests}
        ).execute()
        print("Applied professional styling and password column highlighting to Google Sheet!")
    except Exception as e:
        print("Styling batch update note:", e)

if __name__ == '__main__':
    if len(sys.argv) > 2:
        # Call update single password: python sync_admin_access_sheet.py <user_id> <new_password>
        uid = sys.argv[1]
        npw = sys.argv[2]
        res = update_single_password(uid, npw)
        print(json.dumps(res, ensure_ascii=False))
    else:
        sync_full_admin_sheet()
