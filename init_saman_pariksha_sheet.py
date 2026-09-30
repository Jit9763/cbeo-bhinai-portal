import json
from create_cbeo_drive_backend import get_services

def setup_saman_pariksha_sheet():
    drive, sheets = get_services()
    with open('drive_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    folder_id = cfg['folder_id']
    print('Drive Folder ID:', folder_id)

    q = f"'{folder_id}' in parents and name = '5_CBEO_Saman_Pariksha_56_Schools_Data' and trashed = false"
    results = drive.files().list(q=q, fields='files(id, name, webViewLink)').execute()
    files = results.get('files', [])

    if files:
        sheet_id = files[0]['id']
        sheet_url = files[0]['webViewLink']
        print('Found existing sheet:', sheet_id)
    else:
        meta = {
            'name': '5_CBEO_Saman_Pariksha_56_Schools_Data',
            'parents': [folder_id],
            'mimeType': 'application/vnd.google-apps.spreadsheet'
        }
        f_obj = drive.files().create(body=meta, fields='id, webViewLink').execute()
        sheet_id = f_obj['id']
        sheet_url = f_obj['webViewLink']
        print('Created new sheet on Drive:', sheet_id)

    cfg['sheets']['saman_pariksha'] = {
        'id': sheet_id,
        'name': '5_CBEO_Saman_Pariksha_56_Schools_Data',
        'url': sheet_url
    }
    with open('drive_config.json', 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2)

    # Initialize headers and 56 schools
    with open('schools_56_master.json', 'r', encoding='utf-8') as f:
        schools_56 = json.load(f)

    header = [
        "S.No",
        "School Name",
        "Category",
        "Shala Darpan / PSP Code",
        "PEEO Nodal Panchayat",
        "School Examination Code",
        "Head of School (Sanstha Pradhan)",
        "Head Mobile",
        "Exam In-charge (Pariksha Prabhari)",
        "In-charge Mobile",
        "Class 9 Total",
        "Class 10 Total",
        "Class 11 Hindi Compulsory",
        "Class 11 English Compulsory",
        "Class 11 Optional Subjects Detail",
        "Class 11 Total",
        "Class 12 Hindi Compulsory",
        "Class 12 English Compulsory",
        "Class 12 Optional Subjects Detail",
        "Class 12 Total",
        "Grand Total (9 to 12)",
        "Submission Status",
        "Submitted By",
        "Submission Timestamp"
    ]

    rows = [header]
    for s in schools_56:
        rows.append([
            s['s_no'],
            s['school_name'],
            s['category'],
            s['shala_darpan_code'],
            s['peeo_name'],
            s.get('exam_code', ''),
            s.get('principal_name', ''),
            s.get('principal_mobile', ''),
            s.get('incharge_name', ''),
            s.get('incharge_mobile', ''),
            0, # Class 9
            0, # Class 10
            0, # Class 11 Comp Hindi
            0, # Class 11 Comp English
            "", # Class 11 Optional
            0, # Class 11 Total
            0, # Class 12 Comp Hindi
            0, # Class 12 Comp English
            "", # Class 12 Optional
            0, # Class 12 Total
            0, # Grand Total
            "Pending",
            "",
            ""
        ])

    sheets.spreadsheets().values().clear(spreadsheetId=sheet_id, range="Sheet1!A1:Z200").execute()
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": rows}
    ).execute()

    print(f"Successfully populated all {len(schools_56)} schools into Google Sheet!")
    print("Google Sheet URL:", sheet_url)

if __name__ == '__main__':
    setup_saman_pariksha_sheet()
