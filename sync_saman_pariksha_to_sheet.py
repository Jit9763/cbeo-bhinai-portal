import json
from create_cbeo_drive_backend import get_services

def sync_submissions():
    with open('schools_56_master.json', 'r', encoding='utf-8') as f:
        schools_56 = json.load(f)

    with open('drive_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    sheet_id = cfg['sheets']['saman_pariksha']['id']

    # Load submissions if any
    submissions = {}
    try:
        with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
            submissions = json.load(f)
    except:
        pass

    drive, sheets = get_services()

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
        "Class 9 Sanskrit (3rd Lang)",
        "Class 9 Urdu (3rd Lang)",
        "Class 10 Total",
        "Class 10 Sanskrit (3rd Lang)",
        "Class 10 Urdu (3rd Lang)",
        "Class 11 Faculties (संकाय)",
        "Class 11 Hindi Compulsory",
        "Class 11 English Compulsory",
        "Class 11 Optional Subjects Detail",
        "Class 11 Total",
        "Class 12 Faculties (संकाय)",
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
        code = s['shala_darpan_code']
        sub = submissions.get(code, {})
        status = "Submitted" if sub else "Pending"
        
        c11_fac_str = ", ".join(sub.get('c11_faculties', []))
        c12_fac_str = ", ".join(sub.get('c12_faculties', []))

        c11_opt_str = ", ".join([f"{k}: {v}" for k, v in sub.get('c11_optional', {}).items() if v > 0])
        c12_opt_str = ", ".join([f"{k}: {v}" for k, v in sub.get('c12_optional', {}).items() if v > 0])

        rows.append([
            s['s_no'],
            s['school_name'],
            s['category'],
            code,
            s['peeo_name'],
            sub.get('exam_code', s.get('exam_code', '')),
            sub.get('principal_name', s.get('principal_name', '')),
            sub.get('principal_mobile', s.get('principal_mobile', '')),
            sub.get('incharge_name', s.get('incharge_name', '')),
            sub.get('incharge_mobile', s.get('incharge_mobile', '')),
            sub.get('c9_total', 0),
            sub.get('c9_sanskrit', 0),
            sub.get('c9_urdu', 0),
            sub.get('c10_total', 0),
            sub.get('c10_sanskrit', 0),
            sub.get('c10_urdu', 0),
            c11_fac_str,
            sub.get('c11_comp_hindi', 0),
            sub.get('c11_comp_english', 0),
            c11_opt_str,
            sub.get('c11_total', 0),
            c12_fac_str,
            sub.get('c12_comp_hindi', 0),
            sub.get('c12_comp_english', 0),
            c12_opt_str,
            sub.get('c12_total', 0),
            sub.get('grand_total', 0),
            status,
            sub.get('submitted_by', ''),
            sub.get('timestamp', '')
        ])

    sheets.spreadsheets().values().clear(spreadsheetId=sheet_id, range="Sheet1!A1:AD200").execute()
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": rows}
    ).execute()

    print(f"Synced {len(schools_56)} schools to Google Drive Sheet: {sheet_id}")

if __name__ == '__main__':
    sync_submissions()
