import os
import sys
import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

TOKEN_FILE = r"C:\Users\jiten\Desktop\panchayat chunav\scratch\token_panchayat.json"
FOLDER_ID = "1wxRe4NMIkKS8VDAAVzUB2KXJioEl4OFu"

def get_services():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    drive = build('drive', 'v3', credentials=creds)
    sheets = build('sheets', 'v4', credentials=creds)
    return drive, sheets

def create_master_backup_sheet():
    drive, sheets = get_services()

    sheet_title = "7_CBEO_Master_Backup_And_Dummy_Sandbox_Sheet"
    print(f"Creating new Google Spreadsheet: {sheet_title} in Google Drive...")

    # 1. Create Spreadsheet metadata in Drive folder
    file_metadata = {
        'name': sheet_title,
        'mimeType': 'application/vnd.google-apps.spreadsheet',
        'parents': [FOLDER_ID]
    }
    file = drive.files().create(body=file_metadata, fields='id, webViewLink').execute()
    sheet_id = file.get('id')
    web_link = file.get('webViewLink')

    print(f"Spreadsheet Created Successfully!")
    print(f"Sheet ID: {sheet_id}")
    print(f"Link: {web_link}")

    # 2. Configure Tabs and Headers via Sheets API
    # Create sheets: DUMMY_SANDBOX_STORAGE, मांग_आर्काइव_रजिस्ट्री, लाइव_मांग_सबमिशन_बैकअप, समान_परीक्षा_बैकअप
    batch_reqs = [
        # Rename initial sheet
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": 0,
                    "title": "DUMMY_SANDBOX_STORAGE",
                    "gridProperties": {"frozenRowCount": 1}
                },
                "fields": "title,gridProperties.frozenRowCount"
            }
        },
        # Add Sheet 2: मांग_आर्काइव_रजिस्ट्री
        {
            "addSheet": {
                "properties": {
                    "title": "मांग_आर्काइव_रजिस्ट्री",
                    "gridProperties": {"frozenRowCount": 1}
                }
            }
        },
        # Add Sheet 3: लाइव_मांग_सबमिशन_बैकअप
        {
            "addSheet": {
                "properties": {
                    "title": "लाइव_मांग_सबमिशन_बैकअप",
                    "gridProperties": {"frozenRowCount": 1}
                }
            }
        },
        # Add Sheet 4: समान_परीक्षा_बैकअप
        {
            "addSheet": {
                "properties": {
                    "title": "समान_परीक्षा_बैकअप",
                    "gridProperties": {"frozenRowCount": 1}
                }
            }
        }
    ]

    sheets.spreadsheets().batchUpdate(
        spreadsheetId=sheet_id,
        body={"requests": batch_reqs}
    ).execute()

    # 3. Populate Header Rows
    dummy_headers = [
        "क्र.सं.", "टेस्ट सबमिशन ID", "मांग ID", "मांग शीर्षक", "विद्यालय SD कोड",
        "विद्यालय का नाम", "संबंधित PEEO", "प्रस्तुतकर्ता अधिकारी", "मोबाइल नंबर",
        "टेस्ट सबमिशन दिनांक", "डेटा प्रविष्टियां (JSON)", "डिजिटल हस्ताक्षर (Base64)"
    ]

    archive_headers = [
        "क्र.सं.", "मांग ID", "मांग शीर्षक", "संग्रह स्तर", "कॉलम संख्या",
        "कुल सबमिशन संख्या", "आर्काइव दिनांक", "आर्काइवकर्ता", "मांग कॉन्फ़िगरेशन (JSON)"
    ]

    live_headers = [
        "क्र.सं.", "सबमिशन ID", "मांग ID", "मांग शीर्षक", "विद्यालय SD कोड",
        "विद्यालय का नाम", "संबंधित PEEO", "प्रस्तुतकर्ता", "मोबाइल नंबर",
        "सबमिशन दिनांक व समय", "डेटा प्रविष्टियां (JSON)", "सत्यापन स्थिति"
    ]

    saman_headers = [
        "क्र.सं.", "शाला दर्पण कोड", "विद्यालय का नाम", "PEEO नाम", "संस्था प्रधान",
        "मोबाइल", "परीक्षा प्रभारी", "प्रभारी मोबाइल", "कक्षा 9 कुल", "कक्षा 10 कुल",
        "कक्षा 11 कुल", "कक्षा 12 कुल", "महायोग (Grand Total)", "सबमिशन स्थिति", "सत्यापन दिनांक"
    ]

    values_data = [
        {"range": "DUMMY_SANDBOX_STORAGE!A1:L1", "values": [dummy_headers]},
        {"range": "मांग_आर्काइव_रजिस्ट्री!A1:I1", "values": [archive_headers]},
        {"range": "लाइव_मांग_सबमिशन_बैकअप!A1:L1", "values": [live_headers]},
        {"range": "समान_परीक्षा_बैकअप!A1:O1", "values": [saman_headers]}
    ]

    sheets.spreadsheets().values().batchUpdate(
        spreadsheetId=sheet_id,
        body={"valueInputOption": "USER_ENTERED", "data": values_data}
    ).execute()

    # 4. Populate current Saman Pariksha snapshot if available
    try:
        if os.path.exists("master_cbeo_data.json"):
            with open("master_cbeo_data.json", "r", encoding="utf-8") as f:
                cbeo_data = json.load(f)
            schools = cbeo_data.get("schools_56", [])
            subs = cbeo_data.get("saman_pariksha_submissions", {})

            saman_rows = []
            for idx, s in enumerate(schools):
                code = s.get("shala_darpan_code", "")
                sub = subs.get(code, {})
                saman_rows.append([
                    idx + 1,
                    code,
                    s.get("school_name", ""),
                    s.get("peeo_name", ""),
                    sub.get("principal_name", s.get("principal_name", "")),
                    sub.get("principal_mobile", s.get("mobile", "")),
                    sub.get("incharge_name", ""),
                    sub.get("incharge_mobile", ""),
                    sub.get("c9_total", 0),
                    sub.get("c10_total", 0),
                    sub.get("c11_total", 0),
                    sub.get("c12_total", 0),
                    sub.get("grand_total", 0),
                    "पूर्ण (Submitted)" if sub.get("is_submitted") else "लम्बित (Pending)",
                    sub.get("submitted_at", "")
                ])
            
            if saman_rows:
                sheets.spreadsheets().values().update(
                    spreadsheetId=sheet_id,
                    range=f"समान_परीक्षा_बैकअप!A2:O{len(saman_rows) + 1}",
                    valueInputOption="USER_ENTERED",
                    body={"values": saman_rows}
                ).execute()
                print(f"Populated {len(saman_rows)} schools in समान_परीक्षा_बैकअप!")
    except Exception as e:
        print("Note on initial saman pariksha population:", e)

    # 5. Set sharing permission to anyone with link can view/edit
    try:
        drive.permissions().create(
            fileId=sheet_id,
            body={'role': 'writer', 'type': 'anyone'},
            fields='id'
        ).execute()
        print("Sharing permission set to: Anyone with link can edit.")
    except Exception as e:
        print("Note on permission setting:", e)

    # 6. Update drive_config.json
    try:
        drive_config_path = "drive_config.json"
        if os.path.exists(drive_config_path):
            with open(drive_config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            if "sheets" not in cfg:
                cfg["sheets"] = {}
            cfg["sheets"]["master_backup_sandbox"] = {
                "id": sheet_id,
                "name": sheet_title,
                "url": web_link
            }
            with open(drive_config_path, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
            print(f"Updated {drive_config_path} successfully!")
    except Exception as e:
        print("Note on config update:", e)

    print("\n" + "="*70)
    print("ALL DONE! NEW MASTER BACKUP & DUMMY SANDBOX SHEET IS READY IN GOOGLE DRIVE:")
    print(f"Folder: https://drive.google.com/drive/folders/{FOLDER_ID}")
    print(f"Sheet Name: {sheet_title}")
    print(f"Sheet Link: {web_link}")
    print("="*70)

    return sheet_id, web_link

if __name__ == "__main__":
    create_master_backup_sheet()
