import os
import sys
import json
import re
from create_cbeo_drive_backend import get_services

SHEET_ID = "1tVP7gbIuUP576E2a1Qk6TadXUSP7a5c7ah8HzKeTk4k"

def sync_from_sheet5():
    print(f"Reading Saman Pariksha Data from Google Sheet #5 ({SHEET_ID}), Sheet1...")
    _, sheets = get_services()

    res = sheets.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range='Sheet1!A1:AZ65'
    ).execute()

    rows = res.get('values', [])
    if not rows:
        print("ERROR: No rows returned from Sheet1")
        return

    headers = [h.strip() for h in rows[0]]
    print(f"Headers found ({len(headers)}): {headers[:10]}")

    submissions = {}
    pending_list = []
    submitted_list = []

    for r_idx, row in enumerate(rows[1:]):
        # Pad row to length of headers
        row_padded = row + [''] * (len(headers) - len(row))
        data_map = {headers[i]: row_padded[i].strip() for i in range(len(headers))}

        s_no = data_map.get('क्र.सं. (S.No)', str(r_idx + 1))
        school_name = data_map.get('विद्यालय का नाम (School Name)', '')
        category = data_map.get('श्रेणी (Category)', 'Govt. Sr. Sec.')
        code = str(data_map.get('शाला दर्पण / PSP कोड', '')).strip()
        peeo = data_map.get('संबंधित PEEO नोडल पंचायत', '')
        exam_code = data_map.get('स्कूल परीक्षा कोड (Exam Code)', '')
        p_name = data_map.get('संस्था प्रधान (Principal Name)', '')
        p_mobile = data_map.get('संस्था प्रधान मोबाइल', '')
        incharge_name = data_map.get('परीक्षा प्रभारी (In-charge Name)', '')
        incharge_mobile = data_map.get('परीक्षा प्रभारी मोबाइल', '')

        # Student numbers
        def parse_num(val):
            try:
                clean = re.sub(r'[^0-9]', '', str(val))
                return int(clean) if clean else 0
            except:
                return 0

        c9_total = parse_num(data_map.get('9वीं कुल नामांकन (Class 9 Total)', 0))
        c9_sanskrit = parse_num(data_map.get('9वीं संस्कृत (Sanskrit 3rd Lang)', 0))
        c9_urdu = parse_num(data_map.get('9वीं उर्दू (Urdu 3rd Lang)', 0))

        c10_total = parse_num(data_map.get('10वीं कुल नामांकन (Class 10 Total)', 0))
        c10_sanskrit = parse_num(data_map.get('10वीं संस्कृत (Sanskrit 3rd Lang)', 0))
        c10_urdu = parse_num(data_map.get('10वीं उर्दू (Urdu 3rd Lang)', 0))

        faculties_str = data_map.get('11वीं संकाय (Faculties)', '')
        faculties = [f.strip().lower() for f in faculties_str.split(',') if f.strip()]

        c11_comp_hindi = parse_num(data_map.get('11वीं अनिवार्य हिंदी (Comp Hindi)', 0))
        c11_comp_english = parse_num(data_map.get('11वीं अनिवार्य अंग्रेजी (Comp English)', 0))
        c11_total = max(c11_comp_hindi, c11_comp_english)

        c12_comp_hindi = parse_num(data_map.get('12वीं अनिवार्य हिंदी (Comp Hindi)', 0))
        c12_comp_english = parse_num(data_map.get('12वीं अनिवार्य अंग्रेजी (Comp English)', 0))
        c12_total = max(c12_comp_hindi, c12_comp_english)

        # Optional subjects map for 11 & 12
        c11_optional = {
            "pol_sci": parse_num(data_map.get('11वीं राजनीति विज्ञान (Pol Sci)', 0)),
            "history": parse_num(data_map.get('11वीं इतिहास (History)', 0)),
            "geography": parse_num(data_map.get('11वीं भूगोल (Geography)', 0)),
            "hindi_lit": parse_num(data_map.get('11वीं हिंदी साहित्य (Hindi Lit)', 0)),
            "eng_lit": parse_num(data_map.get('11वीं अंग्रेजी साहित्य (Eng Lit)', 0)),
            "sanskrit_lit": parse_num(data_map.get('11वीं संस्कृत साहित्य (Sanskrit Lit)', 0)),
            "urdu_lit": parse_num(data_map.get('11वीं उर्दू साहित्य (Urdu Lit)', 0)),
            "economics": parse_num(data_map.get('11वीं अर्थशास्त्र (Economics)', 0)),
            "sociology": parse_num(data_map.get('11वीं समाजशास्त्र (Sociology)', 0)),
            "home_sci": parse_num(data_map.get('11वीं गृह विज्ञान (Home Science)', 0)),
            "drawing": parse_num(data_map.get('11वीं चित्रकला (Drawing)', 0)),
            "physics": parse_num(data_map.get('11वीं भौतिक विज्ञान (Physics)', 0)),
            "chemistry": parse_num(data_map.get('11वीं रसायन विज्ञान (Chemistry)', 0)),
            "biology": parse_num(data_map.get('11वीं जीव विज्ञान (Biology)', 0)),
            "maths": parse_num(data_map.get('11वीं गणित (Mathematics)', 0)),
            "comp_sci": parse_num(data_map.get('11वीं कम्प्यूटर विज्ञान (Comp Sci)', 0)),
            "accountancy": parse_num(data_map.get('11वीं लेखाशास्त्र (Accountancy)', 0)),
            "business_studies": parse_num(data_map.get('11वीं व्यवसाय अध्ययन (Business Studies)', 0)),
            "economics_comm": parse_num(data_map.get('11वीं अर्थशास्त्र कॉमर्स (Economics)', 0)),
            "agri_sci": parse_num(data_map.get('11वीं कृषि विज्ञान (Agri Science)', 0)),
            "agri_bio": parse_num(data_map.get('11वीं कृषि जीव विज्ञान (Agri Biology)', 0)),
            "agri_chem": parse_num(data_map.get('11वीं कृषि रसायन (Agri Chemistry)', 0))
        }

        c12_optional = {
            "pol_sci": parse_num(data_map.get('12वीं राजनीति विज्ञान (Pol Sci)', 0)),
            "history": parse_map_num(data_map, ['12वीं इतिहास (History)', '12वीं इतिहास']),
            "geography": parse_map_num(data_map, ['12वीं भूगोल (Geography)', '12वीं भूगोल']),
            "hindi_lit": parse_map_num(data_map, ['12वीं हिंदी साहित्य (Hindi Lit)', '12वीं हिंदी साहित्य']),
            "eng_lit": parse_map_num(data_map, ['12वीं अंग्रेजी साहित्य (Eng Lit)', '12वीं अंग्रेजी साहित्य']),
            "sanskrit_lit": parse_map_num(data_map, ['12वीं संस्कृत साहित्य (Sanskrit Lit)', '12वीं संस्कृत साहित्य']),
            "urdu_lit": parse_map_num(data_map, ['12वीं उर्दू साहित्य (Urdu Lit)', '12वीं उर्दू साहित्य']),
            "physics": parse_map_num(data_map, ['12वीं भौतिक विज्ञान (Physics)', '12वीं भौतिक विज्ञान']),
            "chemistry": parse_map_num(data_map, ['12वीं रसायन विज्ञान (Chemistry)', '12वीं रसायन विज्ञान']),
            "biology": parse_map_num(data_map, ['12वीं जीव विज्ञान (Biology)', '12वीं जीव विज्ञान']),
            "maths": parse_map_num(data_map, ['12वीं गणित (Mathematics)', '12वीं गणित']),
            "agri_sci": parse_map_num(data_map, ['12वीं कृषि विज्ञान (Agri Science)', '12वीं कृषि विज्ञान']),
            "agri_bio": parse_map_num(data_map, ['12वीं कृषि जीव विज्ञान (Agri Biology)', '12वीं कृषि जीव विज्ञान']),
            "agri_chem": parse_map_num(data_map, ['12वीं कृषि रसायन (Agri Chemistry)', '12वीं कृषि रसायन'])
        }

        grand_total = c9_total + c10_total + c11_total + c12_total

        # Submission check
        is_submitted = bool(exam_code or grand_total > 0 or incharge_name)

        sub_obj = {
            "school_code": code,
            "school_name": school_name,
            "category": category,
            "type": "Government" if "Govt" in category else "Private",
            "peeo_name": peeo,
            "exam_code": exam_code,
            "principal_name": p_name,
            "principal_mobile": p_mobile,
            "incharge_name": incharge_name,
            "incharge_mobile": incharge_mobile,
            "c9_total": c9_total,
            "c9_sanskrit": c9_sanskrit,
            "c9_urdu": c9_urdu,
            "c10_total": c10_total,
            "c10_sanskrit": c10_sanskrit,
            "c10_urdu": c10_urdu,
            "c11_faculties": faculties,
            "c11_comp_hindi": c11_comp_hindi,
            "c11_comp_english": c11_comp_english,
            "c11_optional": c11_optional,
            "c11_total": c11_total,
            "c12_faculties": faculties,
            "c12_comp_hindi": c12_comp_hindi,
            "c12_comp_english": c12_comp_english,
            "c12_optional": c12_optional,
            "c12_total": c12_total,
            "grand_total": grand_total,
            "is_submitted": is_submitted,
            "status": "पूर्ण (Submitted)" if is_submitted else "लम्बित (Pending)",
            "submitted_at": "01-10-2026, 05:00 PM" if is_submitted else ""
        }

        submissions[code] = sub_obj

        if is_submitted:
            submitted_list.append(sub_obj)
        else:
            pending_list.append(sub_obj)

    print(f"\nAudit Result from Sheet #5:")
    print(f"Total Schools: {len(submissions)}")
    print(f"Submitted Count: {len(submitted_list)}")
    print(f"Pending Count: {len(pending_list)}")

    print("\nPending Schools Details:")
    for p in pending_list:
        print(f" - [{p['school_code']}] {p['school_name']} | PEEO: {p['peeo_name']} | Principal: {p['principal_name']} ({p['principal_mobile']})")

    # 1. Save to saman_pariksha_submissions.json
    with open('saman_pariksha_submissions.json', 'w', encoding='utf-8') as f:
        json.dump(submissions, f, indent=2, ensure_ascii=False)
    print("\n✓ Saved to saman_pariksha_submissions.json")

    # 2. Update master_cbeo_data.json
    if os.path.exists('master_cbeo_data.json'):
        with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
            m_data = json.load(f)
        m_data['saman_pariksha_submissions'] = submissions
        with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
            json.dump(m_data, f, indent=2, ensure_ascii=False)
        print("✓ Updated master_cbeo_data.json")

    # 3. Update master_cbeo_data.js
    if os.path.exists('master_cbeo_data.js'):
        with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
            raw_json = f.read()
        with open('master_cbeo_data.js', 'w', encoding='utf-8') as jsf:
            jsf.write("const MASTER_CBEO_DATA = " + raw_json + ";\n")
        print("✓ Updated master_cbeo_data.js")

    return submissions, submitted_list, pending_list

def parse_map_num(d_map, keys):
    for k in keys:
        if k in d_map:
            try:
                clean = re.sub(r'[^0-9]', '', str(d_map[k]))
                if clean:
                    return int(clean)
            except:
                pass
    return 0

if __name__ == '__main__':
    sync_from_sheet5()
