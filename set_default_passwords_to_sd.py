import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
TOKEN_FILE = r'C:\Users\jiten\Desktop\panchayat chunav\scratch\token_panchayat.json'

def main():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    sheets = build('sheets', 'v4', credentials=creds)

    with open('drive_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    sheet_id = cfg['sheets']['admin_access']['id']

    res = sheets.spreadsheets().values().get(spreadsheetId=sheet_id, range='Sheet1!A1:K100').execute()
    rows = res.get('values', [])
    print(f'Total rows read from Google Sheet: {len(rows)}')

    now_str = datetime.now().strftime('%d-%m-%Y %H:%M')
    updated_rows = []

    for idx, r in enumerate(rows):
        if idx == 0:
            updated_rows.append(r)
            continue

        id_code = r[1] if len(r) > 1 else ''
        name = r[2] if len(r) > 2 else ''
        role = r[3] if len(r) > 3 else ''
        incharge = r[4] if len(r) > 4 else ''
        mob = r[5] if len(r) > 5 else ''
        email = r[6] if len(r) > 6 else ''
        sd_code = str(r[7]).strip() if len(r) > 7 else ''
        curr_pwd = r[8] if len(r) > 8 else ''
        extra = r[9] if len(r) > 9 else ''

        # Determine target password
        if 'ADMIN01' in id_code or '8140' in sd_code:
            target_pwd = 'cbeo@2026'
        elif 'ADMIN02' in id_code or 'admin_jitendra' in sd_code:
            target_pwd = 'jitendra#2026'
        else:
            # ALL schools and PEEOs default password = Shala Darpan / PSP Code
            target_pwd = sd_code

        status_text = f"डिफ़ॉल्ट सेट: {now_str}" if curr_pwd != target_pwd else (r[10] if len(r) > 10 else f"सिंक: {now_str}")

        updated_row = [
            r[0],
            id_code,
            name,
            role,
            incharge,
            mob,
            email,
            sd_code,
            target_pwd,
            extra,
            status_text
        ]
        updated_rows.append(updated_row)

    # Batch update the entire table
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": updated_rows}
    ).execute()

    print(f"Successfully updated all {len(updated_rows)-1} users in 1_CBEO_Admin_Access_Control!")
    print("All schools and PEEOs now have their Shala Darpan code as their default password.")

if __name__ == '__main__':
    main()
