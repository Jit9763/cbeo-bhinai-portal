import json
from create_cbeo_drive_backend import get_services

OPTIONAL_KEYS = [
    ("pol_sci", "राजनीति विज्ञान (Pol Sci)"),
    ("history", "इतिहास (History)"),
    ("geography", "भूगोल (Geography)"),
    ("hindi_lit", "हिंदी साहित्य (Hindi Lit)"),
    ("eng_lit", "अंग्रेजी साहित्य (Eng Lit)"),
    ("sanskrit_lit", "संस्कृत साहित्य (Sanskrit Lit)"),
    ("urdu_lit", "उर्दू साहित्य (Urdu Lit)"),
    ("economics", "अर्थशास्त्र कला (Economics Arts)"),
    ("sociology", "समाजशास्त्र (Sociology)"),
    ("home_sci", "गृह विज्ञान (Home Science)"),
    ("drawing", "चित्रकला (Drawing)"),
    ("physics", "भौतिक विज्ञान (Physics)"),
    ("chemistry", "रसायन विज्ञान (Chemistry)"),
    ("biology", "जीव विज्ञान (Biology)"),
    ("maths", "गणित (Mathematics)"),
    ("comp_sci", "कम्प्यूटर विज्ञान (Computer Science)"),
    ("accountancy", "लेखाशास्त्र (Accountancy)"),
    ("business_studies", "व्यवसाय अध्ययन (Business Studies)"),
    ("economics_comm", "अर्थशास्त्र वाणिज्य (Economics Comm)"),
    ("agri_sci", "कृषि विज्ञान (Agri Science)"),
    ("agri_bio", "कृषि जीव विज्ञान (Agri Biology)"),
    ("agri_chem", "कृषि रसायन (Agri Chemistry)")
]

def sync_submissions():
    with open('schools_56_master.json', 'r', encoding='utf-8') as f:
        schools_56 = json.load(f)

    with open('drive_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    sheet_id = cfg['sheets']['saman_pariksha']['id']

    # Load submissions
    submissions = {}
    try:
        with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
            submissions = json.load(f)
    except:
        pass

    drive, sheets = get_services()

    # Build Header with an individual column for EVERY subject
    header = [
        "क्र.सं. (S.No)",
        "विद्यालय का नाम (School Name)",
        "श्रेणी (Category)",
        "शाला दर्पण / PSP कोड",
        "संबंधित PEEO नोडल पंचायत",
        "स्कूल परीक्षा कोड (Exam Code)",
        "संस्था प्रधान (Principal Name)",
        "संस्था प्रधान मोबाइल",
        "परीक्षा प्रभारी (In-charge Name)",
        "परीक्षा प्रभारी मोबाइल",
        
        # Class 9
        "9वीं कुल नामांकन (Class 9 Total)",
        "9वीं संस्कृत (Sanskrit 3rd Lang)",
        "9वीं उर्दू (Urdu 3rd Lang)",
        
        # Class 10
        "10वीं कुल नामांकन (Class 10 Total)",
        "10वीं संस्कृत (Sanskrit 3rd Lang)",
        "10वीं उर्दू (Urdu 3rd Lang)",
        
        # Class 11 Compulsory & Faculties
        "11वीं संकाय (Faculties)",
        "11वीं अनिवार्य हिंदी (Comp Hindi)",
        "11वीं अनिवार्य अंग्रेजी (Comp English)"
    ]

    # Class 11 Individual Optionals
    for k, label in OPTIONAL_KEYS:
        header.append(f"11वीं {label}")
    header.append("11वीं कुल मांग (Class 11 Total)")

    # Class 12 Compulsory & Faculties
    header.extend([
        "12वीं संकाय (Faculties)",
        "12वीं अनिवार्य हिंदी (Comp Hindi)",
        "12वीं अनिवार्य अंग्रेजी (Comp English)"
    ])

    # Class 12 Individual Optionals
    for k, label in OPTIONAL_KEYS:
        header.append(f"12वीं {label}")
    header.append("12वीं कुल मांग (Class 12 Total)")

    # Totals & Meta
    header.extend([
        "कुल मांग प्रश्न-पत्र (Grand Total Papers 9-12)",
        "प्रपत्र स्थिति (Submission Status)",
        "हस्ताक्षरकर्ता / प्रस्तुतकर्ता (Submitted By)",
        "अंतिम अपडेट दिनांक (Timestamp)"
    ])

    rows = [header]
    for s in schools_56:
        code = s['shala_darpan_code']
        sub = submissions.get(code, {})
        status = "पूर्ण (Submitted)" if sub else "लम्बित (Pending)"
        
        c11_fac_str = ", ".join(sub.get('c11_faculties', []))
        c12_fac_str = ", ".join(sub.get('c12_faculties', []))

        c11_opt = sub.get('c11_optional', {})
        c12_opt = sub.get('c12_optional', {})

        row = [
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
            
            # Class 9
            sub.get('c9_total', 0),
            sub.get('c9_sanskrit', 0),
            sub.get('c9_urdu', 0),
            
            # Class 10
            sub.get('c10_total', 0),
            sub.get('c10_sanskrit', 0),
            sub.get('c10_urdu', 0),
            
            # Class 11 Compulsory & Faculties
            c11_fac_str,
            sub.get('c11_comp_hindi', 0),
            sub.get('c11_comp_english', 0)
        ]

        # 11th individual optional subjects
        for k, label in OPTIONAL_KEYS:
            row.append(c11_opt.get(k, 0))
        row.append(sub.get('c11_total', 0))

        # Class 12 Compulsory & Faculties
        row.extend([
            c12_fac_str,
            sub.get('c12_comp_hindi', 0),
            sub.get('c12_comp_english', 0)
        ])

        # 12th individual optional subjects
        for k, label in OPTIONAL_KEYS:
            row.append(c12_opt.get(k, 0))
        row.append(sub.get('c12_total', 0))

        # Totals & Meta
        row.extend([
            sub.get('grand_total', 0),
            status,
            sub.get('submitted_by', ''),
            sub.get('timestamp', '')
        ])

        rows.append(row)

    # Clear previous contents and write all columns
    sheets.spreadsheets().values().clear(spreadsheetId=sheet_id, range="Sheet1!A1:CZ200").execute()
    sheets.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": rows}
    ).execute()

    print(f"Synced {len(schools_56)} schools with {len(header)} distinct subject columns to Google Drive Sheet: {sheet_id}")

if __name__ == '__main__':
    sync_submissions()
