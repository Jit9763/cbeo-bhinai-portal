"""
CBEO Bhinai - Saman Pariksha Master Excel Generator
All 57 Schools (49 Govt + 8 Private) & All Subjects
District: AJMER (अजमेर) | Block: Bhinai (भिनाय)
"""

import json
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

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

def generate_excel():
    with open('schools_56_master.json', 'r', encoding='utf-8') as f:
        all_schools = json.load(f)

    with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
        submissions = json.load(f)

    # Filter out test school 999999 if present in list
    real_schools = [s for s in all_schools if str(s.get('shala_darpan_code')) != '999999']

    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Define Styles
    thin_border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB')
    )
    double_bottom_border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='1E3A8A'),
        bottom=Side(style='double', color='1E3A8A')
    )

    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    title_font = Font(name='Calibri', size=16, bold=True, color='1E3A8A')
    subtitle_font = Font(name='Calibri', size=11, bold=True, color='475569')
    bold_font = Font(name='Calibri', size=10, bold=True)
    normal_font = Font(name='Calibri', size=10)

    fill_title_banner = PatternFill(start_color='EFF6FF', end_color='EFF6FF', fill_type='solid')
    fill_school_meta = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Navy
    fill_c9 = PatternFill(start_color='0284C7', end_color='0284C7', fill_type='solid') # Sky Blue
    fill_c10 = PatternFill(start_color='0D9488', end_color='0D9488', fill_type='solid') # Teal
    fill_c11 = PatternFill(start_color='D97706', end_color='D97706', fill_type='solid') # Amber
    fill_c12 = PatternFill(start_color='7C3AED', end_color='7C3AED', fill_type='solid') # Purple
    fill_total = PatternFill(start_color='059669', end_color='059669', fill_type='solid') # Green
    fill_status = PatternFill(start_color='334155', end_color='334155', fill_type='solid') # Slate

    fill_zebra = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    fill_white = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')
    fill_summary_row = PatternFill(start_color='FEF3C7', end_color='FEF3C7', fill_type='solid')

    align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
    align_left = Alignment(horizontal='left', vertical='center')
    align_right = Alignment(horizontal='right', vertical='center')

    # =========================================================================
    # SHEET 1: विद्यालयवार सम्पूर्ण मांग (Master School-wise Demand Matrix)
    # =========================================================================
    ws1 = wb.create_sheet(title="विद्यालयवार सम्पूर्ण मांग")
    ws1.views.sheetView[0].showGridLines = True

    # Title Banner Rows (Row 1-3)
    ws1.merge_cells('A1:BK1')
    ws1['A1'] = "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय - जिला: अजमेर (AJMER)"
    ws1['A1'].font = title_font
    ws1['A1'].alignment = align_center
    ws1['A1'].fill = fill_title_banner
    ws1.row_dimensions[1].height = 32

    ws1.merge_cells('A2:BK2')
    ws1['A2'] = "समान परीक्षा (कक्षा 9वीं से 12वीं) सत्र 2026-27 | समस्त 57 विद्यालयों (49 राजकीय + 8 निजी) की विषयवार मांग पत्रक"
    ws1['A2'].font = subtitle_font
    ws1['A2'].alignment = align_center
    ws1['A2'].fill = fill_title_banner
    ws1.row_dimensions[2].height = 22

    # Column Headers (Row 4)
    headers = [
        ("क्र.सं.", fill_school_meta),
        ("विद्यालय का नाम", fill_school_meta),
        ("प्रकार", fill_school_meta),
        ("श्रेणी", fill_school_meta),
        ("शाला दर्पण / PSP कोड", fill_school_meta),
        ("संबंधित PEEO", fill_school_meta),
        ("परीक्षा कोड", fill_school_meta),
        ("माध्यम", fill_school_meta),
        ("संस्था प्रधान का नाम", fill_school_meta),
        ("संस्था प्रधान मोबाइल", fill_school_meta),
        ("परीक्षा प्रभारी का नाम", fill_school_meta),
        ("परीक्षा प्रभारी मोबाइल", fill_school_meta),

        # Class 9 (5 cols)
        ("9वीं हिंदी माध्यम", fill_c9),
        ("9वीं अंग्रेजी माध्यम", fill_c9),
        ("9वीं कुल नामांकन", fill_c9),
        ("9वीं संस्कृत (तृतीय भाषा)", fill_c9),
        ("9वीं उर्दू (तृतीय भाषा)", fill_c9),

        # Class 10 (5 cols)
        ("10वीं हिंदी माध्यम", fill_c10),
        ("10वीं अंग्रेजी माध्यम", fill_c10),
        ("10वीं कुल नामांकन", fill_c10),
        ("10वीं संस्कृत (तृतीय भाषा)", fill_c10),
        ("10वीं उर्दू (तृतीय भाषा)", fill_c10),

        # Class 11 (25 cols)
        ("11वीं संकाय", fill_c11),
        ("11वीं अनिवार्य हिंदी", fill_c11),
        ("11वीं अनिवार्य अंग्रेजी", fill_c11)
    ]

    for k, label in OPTIONAL_KEYS:
        headers.append((f"11वीं {label}", fill_c11))
    headers.append(("11वीं कुल मांग", fill_c11))

    # Class 12 (25 cols)
    headers.extend([
        ("12वीं संकाय", fill_c12),
        ("12वीं अनिवार्य हिंदी", fill_c12),
        ("12वीं अनिवार्य अंग्रेजी", fill_c12)
    ])
    for k, label in OPTIONAL_KEYS:
        headers.append((f"12वीं {label}", fill_c12))
    headers.append(("12वीं कुल मांग", fill_c12))

    # Summary Totals & Meta (4 cols)
    headers.extend([
        ("कुल मांग प्रश्न-पत्र (9-12)", fill_total),
        ("प्रपत्र स्थिति", fill_status),
        ("सबमिटकर्ता", fill_status),
        ("सबमिशन दिनांक", fill_status)
    ])

    ws1.row_dimensions[4].height = 42

    for col_idx, (h_text, fill_color) in enumerate(headers, 1):
        cell = ws1.cell(row=4, column=col_idx, value=h_text)
        cell.font = header_font
        cell.fill = fill_color
        cell.alignment = align_center
        cell.border = thin_border

    # Freeze header
    ws1.freeze_panes = 'C5'

    # Fill Data
    data_start_row = 5
    for s_idx, s in enumerate(real_schools):
        row_num = data_start_row + s_idx
        ws1.row_dimensions[row_num].height = 20
        code = str(s['shala_darpan_code']).strip()
        sub = submissions.get(code, {})

        is_mggs = code in ['221770', '221778', '221753'] or 'MGGS' in str(s.get('category', '')).upper() or 'गांधी' in str(s.get('school_name', '')) or 'GANDHI' in str(s.get('school_name', '')).upper()
        med = 'english' if is_mggs else sub.get('school_medium', 'hindi')
        med_label = 'अंग्रेजी' if med == 'english' else ('द्विभाषी' if med == 'both' else 'हिंदी')

        c9_tot = int(sub.get('c9_total') or 0)
        c9_h = 0 if (is_mggs or med == 'english') else (int(sub.get('c9_hindi')) if sub.get('c9_hindi') is not None else c9_tot)
        c9_e = (int(sub.get('c9_english')) if sub.get('c9_english') is not None else c9_tot) if (is_mggs or med == 'english') else int(sub.get('c9_english') or 0)
        c9_sans = int(sub.get('c9_sanskrit') or 0)
        c9_urdu = int(sub.get('c9_urdu') or 0)

        c10_tot = int(sub.get('c10_total') or 0)
        c10_h = 0 if (is_mggs or med == 'english') else (int(sub.get('c10_hindi')) if sub.get('c10_hindi') is not None else c10_tot)
        c10_e = (int(sub.get('c10_english')) if sub.get('c10_english') is not None else c10_tot) if (is_mggs or med == 'english') else int(sub.get('c10_english') or 0)
        c10_sans = int(sub.get('c10_sanskrit') or 0)
        c10_urdu = int(sub.get('c10_urdu') or 0)

        c11_fac = ", ".join(sub.get('c11_faculties') or [])
        c11_h = int(sub.get('c11_comp_hindi') or 0)
        c11_e = int(sub.get('c11_comp_english') or 0)
        c11_opt = sub.get('c11_optional') or {}
        c11_tot = int(sub.get('c11_total') or 0)

        c12_fac = ", ".join(sub.get('c12_faculties') or [])
        c12_h = int(sub.get('c12_comp_hindi') or 0)
        c12_e = int(sub.get('c12_comp_english') or 0)
        c12_opt = sub.get('c12_optional') or {}
        c12_tot = int(sub.get('c12_total') or 0)

        grand_tot = int(sub.get('grand_total') or (c9_tot + c10_tot + c11_tot + c12_tot))
        status_label = "पूर्ण (Submitted)" if sub else "लम्बित (Pending)"
        submitted_by = sub.get('submitted_by', '') or sub.get('principal_name', '')
        ts = sub.get('timestamp', '')

        row_values = [
            s_idx + 1,
            s.get('school_name', ''),
            "राजकीय" if s.get('type') == 'Government' else "निजी",
            s.get('category', ''),
            code,
            s.get('peeo_name', ''),
            s.get('exam_code', ''),
            med_label,
            sub.get('principal_name', s.get('principal_name', '')),
            sub.get('principal_mobile', s.get('principal_mobile', '')),
            sub.get('incharge_name', s.get('incharge_name', '')),
            sub.get('incharge_mobile', s.get('incharge_mobile', '')),

            # Class 9
            c9_h,
            c9_e,
            c9_tot,
            c9_sans,
            c9_urdu,

            # Class 10
            c10_h,
            c10_e,
            c10_tot,
            c10_sans,
            c10_urdu,

            # Class 11 Compulsory & Faculties
            c11_fac,
            c11_h,
            c11_e
        ]

        # Class 11 Optionals
        for k, _ in OPTIONAL_KEYS:
            row_values.append(int(c11_opt.get(k, 0)))
        row_values.append(c11_tot)

        # Class 12 Compulsory & Faculties
        row_values.extend([
            c12_fac,
            c12_h,
            c12_e
        ])

        # Class 12 Optionals
        for k, _ in OPTIONAL_KEYS:
            row_values.append(int(c12_opt.get(k, 0)))
        row_values.append(c12_tot)

        # Totals & Meta
        row_values.extend([
            grand_tot,
            status_label,
            submitted_by,
            ts
        ])

        fill_r = fill_zebra if s_idx % 2 == 1 else fill_white
        for c_idx, val in enumerate(row_values, 1):
            cell = ws1.cell(row=row_num, column=c_idx, value=val)
            cell.font = normal_font
            cell.fill = fill_r
            cell.border = thin_border
            if c_idx == 2:
                cell.alignment = align_left
            elif c_idx in [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 23, 49, 74, 75, 76]:
                cell.alignment = align_center
            else:
                cell.alignment = align_right

    # Summary Row at the Bottom
    sum_row_idx = data_start_row + len(real_schools)
    ws1.row_dimensions[sum_row_idx].height = 24
    ws1.merge_cells(start_row=sum_row_idx, start_column=1, end_row=sum_row_idx, end_column=12)
    sum_lbl = ws1.cell(row=sum_row_idx, column=1, value="कुल योग (BLOCK BHINAI TOTAL - 57 SCHOOLS)")
    sum_lbl.font = bold_font
    sum_lbl.alignment = align_center
    sum_lbl.fill = fill_summary_row

    for c in range(1, 13):
        ws1.cell(row=sum_row_idx, column=c).fill = fill_summary_row
        ws1.cell(row=sum_row_idx, column=c).border = double_bottom_border

    # Numerical columns for SUM: from col 13 to col 73
    for col_idx in range(13, len(headers) - 3 + 1):
        # Skip faculty text columns (col 23 and col 48)
        col_letter = get_column_letter(col_idx)
        cell = ws1.cell(row=sum_row_idx, column=col_idx)
        cell.border = double_bottom_border
        cell.fill = fill_summary_row
        cell.font = bold_font
        cell.alignment = align_right

        if col_idx in [23, 48]: # Faculty strings
            cell.value = "-"
            cell.alignment = align_center
        else:
            cell.value = f"=SUM({col_letter}5:{col_letter}{sum_row_idx-1})"

    # Fill remaining meta cells in summary row
    for col_idx in range(len(headers) - 2, len(headers) + 1):
        cell = ws1.cell(row=sum_row_idx, column=col_idx, value="-")
        cell.border = double_bottom_border
        cell.fill = fill_summary_row
        cell.font = bold_font
        cell.alignment = align_center

    # =========================================================================
    # SHEET 2: विषयवार समेकित मांग (Consolidated Subject-wise Abstract)
    # =========================================================================
    ws2 = wb.create_sheet(title="विषयवार समेकित मांग")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells('A1:F1')
    ws2['A1'] = "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय - जिला: अजमेर"
    ws2['A1'].font = title_font
    ws2['A1'].alignment = align_center
    ws2['A1'].fill = fill_title_banner
    ws2.row_dimensions[1].height = 30

    ws2.merge_cells('A2:F2')
    ws2['A2'] = "समान परीक्षा 2026-27 | कक्षावार एवं विषयवार प्रश्न-पत्र मांग का समेकित सार (Abstract)"
    ws2['A2'].font = subtitle_font
    ws2['A2'].alignment = align_center
    ws2['A2'].fill = fill_title_banner
    ws2.row_dimensions[2].height = 20

    s2_headers = ["क्र.सं.", "कक्षा (Class)", "विषय का नाम (Subject Name)", "माध्यम / श्रेणी (Medium/Type)", "मांग वाले विद्यालयों की संख्या", "कुल प्रश्न-पत्र मांग (Total Papers)"]
    ws2.row_dimensions[4].height = 28
    for c_idx, h_text in enumerate(s2_headers, 1):
        cell = ws2.cell(row=4, column=c_idx, value=h_text)
        cell.font = header_font
        cell.fill = fill_school_meta
        cell.alignment = align_center
        cell.border = thin_border

    # Calculate actual block-wide sums for subjects
    subject_demand_list = []

    # Class 9
    tot_9_h = sum(0 if (s['shala_darpan_code'] in ['221770', '221778', '221753'] or 'MGGS' in str(s.get('category','')).upper() or submissions.get(s['shala_darpan_code'],{}).get('school_medium') == 'english') else (int(submissions.get(s['shala_darpan_code'],{}).get('c9_hindi')) if submissions.get(s['shala_darpan_code'],{}).get('c9_hindi') is not None else int(submissions.get(s['shala_darpan_code'],{}).get('c9_total',0))) for s in real_schools)
    tot_9_e = sum((int(submissions.get(s['shala_darpan_code'],{}).get('c9_english')) if submissions.get(s['shala_darpan_code'],{}).get('c9_english') is not None else int(submissions.get(s['shala_darpan_code'],{}).get('c9_total',0))) if (s['shala_darpan_code'] in ['221770', '221778', '221753'] or 'MGGS' in str(s.get('category','')).upper() or submissions.get(s['shala_darpan_code'],{}).get('school_medium') == 'english') else int(submissions.get(s['shala_darpan_code'],{}).get('c9_english',0)) for s in real_schools)
    tot_9_sans = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c9_sanskrit',0)) for s in real_schools)
    tot_9_urdu = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c9_urdu',0)) for s in real_schools)
    tot_9 = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c9_total',0)) for s in real_schools)

    # Class 10
    tot_10_h = sum(0 if (s['shala_darpan_code'] in ['221770', '221778', '221753'] or 'MGGS' in str(s.get('category','')).upper() or submissions.get(s['shala_darpan_code'],{}).get('school_medium') == 'english') else (int(submissions.get(s['shala_darpan_code'],{}).get('c10_hindi')) if submissions.get(s['shala_darpan_code'],{}).get('c10_hindi') is not None else int(submissions.get(s['shala_darpan_code'],{}).get('c10_total',0))) for s in real_schools)
    tot_10_e = sum((int(submissions.get(s['shala_darpan_code'],{}).get('c10_english')) if submissions.get(s['shala_darpan_code'],{}).get('c10_english') is not None else int(submissions.get(s['shala_darpan_code'],{}).get('c10_total',0))) if (s['shala_darpan_code'] in ['221770', '221778', '221753'] or 'MGGS' in str(s.get('category','')).upper() or submissions.get(s['shala_darpan_code'],{}).get('school_medium') == 'english') else int(submissions.get(s['shala_darpan_code'],{}).get('c10_english',0)) for s in real_schools)
    tot_10_sans = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c10_sanskrit',0)) for s in real_schools)
    tot_10_urdu = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c10_urdu',0)) for s in real_schools)
    tot_10 = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c10_total',0)) for s in real_schools)

    # Build Class 9 Items
    subject_demand_list.append(("कक्षा 9वीं", "अनिवार्य विषय (हिंदी, अंग्रेजी, गणित, विज्ञान, सामाजिक)", "हिंदी माध्यम", sum(1 for s in real_schools if tot_9_h > 0), tot_9_h))
    subject_demand_list.append(("कक्षा 9वीं", "अनिवार्य विषय (हिंदी, अंग्रेजी, गणित, विज्ञान, सामाजिक)", "अंग्रेजी माध्यम", sum(1 for s in real_schools if tot_9_e > 0), tot_9_e))
    subject_demand_list.append(("कक्षा 9वीं", "तृतीय भाषा - संस्कृत", "तृतीय भाषा", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c9_sanskrit',0)) > 0), tot_9_sans))
    subject_demand_list.append(("कक्षा 9वीं", "तृतीय भाषा - उर्दू", "तृतीय भाषा", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c9_urdu',0)) > 0), tot_9_urdu))

    # Build Class 10 Items
    subject_demand_list.append(("कक्षा 10वीं", "अनिवार्य विषय (हिंदी, अंग्रेजी, गणित, विज्ञान, सामाजिक)", "हिंदी माध्यम", sum(1 for s in real_schools if tot_10_h > 0), tot_10_h))
    subject_demand_list.append(("कक्षा 10वीं", "अनिवार्य विषय (हिंदी, अंग्रेजी, गणित, विज्ञान, सामाजिक)", "अंग्रेजी माध्यम", sum(1 for s in real_schools if tot_10_e > 0), tot_10_e))
    subject_demand_list.append(("कक्षा 10वीं", "तृतीय भाषा - संस्कृत", "तृतीय भाषा", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c10_sanskrit',0)) > 0), tot_10_sans))
    subject_demand_list.append(("कक्षा 10वीं", "तृतीय भाषा - उर्दू", "तृतीय भाषा", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c10_urdu',0)) > 0), tot_10_urdu))

    # Class 11 Compulsory
    tot_11_h = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c11_comp_hindi',0)) for s in real_schools)
    tot_11_e = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c11_comp_english',0)) for s in real_schools)
    subject_demand_list.append(("कक्षा 11वीं", "अनिवार्य हिंदी (Compulsory Hindi)", "अनिवार्य", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c11_comp_hindi',0)) > 0), tot_11_h))
    subject_demand_list.append(("कक्षा 11वीं", "अनिवार्य अंग्रेजी (Compulsory English)", "अनिवार्य", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c11_comp_english',0)) > 0), tot_11_e))

    # Class 11 Optionals
    for k, label in OPTIONAL_KEYS:
        tot_opt = sum(int((submissions.get(s['shala_darpan_code'],{}).get('c11_optional') or {}).get(k, 0)) for s in real_schools)
        cnt_sch = sum(1 for s in real_schools if int((submissions.get(s['shala_darpan_code'],{}).get('c11_optional') or {}).get(k, 0)) > 0)
        subject_demand_list.append(("कक्षा 11वीं", label, "ऐच्छिक विषय (Elective)", cnt_sch, tot_opt))

    # Class 12 Compulsory
    tot_12_h = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c12_comp_hindi',0)) for s in real_schools)
    tot_12_e = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c12_comp_english',0)) for s in real_schools)
    subject_demand_list.append(("कक्षा 12वीं", "अनिवार्य हिंदी (Compulsory Hindi)", "अनिवार्य", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c12_comp_hindi',0)) > 0), tot_12_h))
    subject_demand_list.append(("कक्षा 12वीं", "अनिवार्य अंग्रेजी (Compulsory English)", "अनिवार्य", sum(1 for s in real_schools if int(submissions.get(s['shala_darpan_code'],{}).get('c12_comp_english',0)) > 0), tot_12_e))

    # Class 12 Optionals
    for k, label in OPTIONAL_KEYS:
        tot_opt = sum(int((submissions.get(s['shala_darpan_code'],{}).get('c12_optional') or {}).get(k, 0)) for s in real_schools)
        cnt_sch = sum(1 for s in real_schools if int((submissions.get(s['shala_darpan_code'],{}).get('c12_optional') or {}).get(k, 0)) > 0)
        subject_demand_list.append(("कक्षा 12वीं", label, "ऐच्छिक विषय (Elective)", cnt_sch, tot_opt))

    # Write Sheet 2 rows
    for idx, (cls, sub_name, cat, sch_count, demand) in enumerate(subject_demand_list, 1):
        r_num = 4 + idx
        ws2.row_dimensions[r_num].height = 20
        fill_r = fill_zebra if idx % 2 == 1 else fill_white

        row_vals = [idx, cls, sub_name, cat, sch_count, demand]
        for c_idx, v in enumerate(row_vals, 1):
            cell = ws2.cell(row=r_num, column=c_idx, value=v)
            cell.font = normal_font
            cell.fill = fill_r
            cell.border = thin_border
            if c_idx == 3:
                cell.alignment = align_left
            elif c_idx in [1, 2, 4]:
                cell.alignment = align_center
            else:
                cell.alignment = align_right

    # Sheet 2 Total Row
    tot_row2 = 5 + len(subject_demand_list)
    ws2.row_dimensions[tot_row2].height = 24
    ws2.merge_cells(start_row=tot_row2, start_column=1, end_row=tot_row2, end_column=4)
    cell_tot_lbl = ws2.cell(row=tot_row2, column=1, value="समस्त विषयों का महायोग (BLOCK BHINAI TOTAL PAPERS)")
    cell_tot_lbl.font = bold_font
    cell_tot_lbl.alignment = align_center
    cell_tot_lbl.fill = fill_summary_row

    for c in range(1, 5):
        ws2.cell(row=tot_row2, column=c).fill = fill_summary_row
        ws2.cell(row=tot_row2, column=c).border = double_bottom_border

    c5 = ws2.cell(row=tot_row2, column=5, value="-")
    c5.fill = fill_summary_row
    c5.alignment = align_center
    c5.font = bold_font
    c5.border = double_bottom_border

    c6 = ws2.cell(row=tot_row2, column=6, value=f"=SUM(F5:F{tot_row2-1})")
    c6.fill = fill_summary_row
    c6.alignment = align_right
    c6.font = bold_font
    c6.border = double_bottom_border

    # =========================================================================
    # SHEET 3: PEEO वार सारांश (PEEO-wise Summary)
    # =========================================================================
    ws3 = wb.create_sheet(title="PEEO वार सारांश")
    ws3.views.sheetView[0].showGridLines = True

    ws3.merge_cells('A1:H1')
    ws3['A1'] = "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय - जिला: अजमेर"
    ws3['A1'].font = title_font
    ws3['A1'].alignment = align_center
    ws3['A1'].fill = fill_title_banner
    ws3.row_dimensions[1].height = 30

    ws3.merge_cells('A2:H2')
    ws3['A2'] = "समान परीक्षा 2026-27 | 25 PEEO क्षेत्रवार विद्यालय व कक्षावार कुल नामांकन सारांश"
    ws3['A2'].font = subtitle_font
    ws3['A2'].alignment = align_center
    ws3['A2'].fill = fill_title_banner
    ws3.row_dimensions[2].height = 20

    s3_headers = ["क्र.सं.", "PEEO नोडल पंचायत का नाम", "कुल विद्यालय", "9वीं कुल", "10वीं कुल", "11वीं कुल", "12वीं कुल", "महायोग (Grand Total)"]
    ws3.row_dimensions[4].height = 28
    for c_idx, h_text in enumerate(s3_headers, 1):
        cell = ws3.cell(row=4, column=c_idx, value=h_text)
        cell.font = header_font
        cell.fill = fill_school_meta
        cell.alignment = align_center
        cell.border = thin_border

    # Group by PEEO
    peeo_groups = {}
    for s in real_schools:
        p_name = s.get('peeo_name', 'OTHER').strip()
        if p_name not in peeo_groups:
            peeo_groups[p_name] = []
        peeo_groups[p_name].append(s)

    sorted_peeos = sorted(peeo_groups.keys())
    for idx, p_name in enumerate(sorted_peeos, 1):
        r_num = 4 + idx
        ws3.row_dimensions[r_num].height = 20
        fill_r = fill_zebra if idx % 2 == 1 else fill_white
        p_schools = peeo_groups[p_name]

        p_c9 = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c9_total',0)) for s in p_schools)
        p_c10 = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c10_total',0)) for s in p_schools)
        p_c11 = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c11_total',0)) for s in p_schools)
        p_c12 = sum(int(submissions.get(s['shala_darpan_code'],{}).get('c12_total',0)) for s in p_schools)
        p_tot = sum(int(submissions.get(s['shala_darpan_code'],{}).get('grand_total', (submissions.get(s['shala_darpan_code'],{}).get('c9_total',0) + submissions.get(s['shala_darpan_code'],{}).get('c10_total',0) + submissions.get(s['shala_darpan_code'],{}).get('c11_total',0) + submissions.get(s['shala_darpan_code'],{}).get('c12_total',0)))) for s in p_schools)

        row_vals = [idx, p_name, len(p_schools), p_c9, p_c10, p_c11, p_c12, p_tot]
        for c_idx, v in enumerate(row_vals, 1):
            cell = ws3.cell(row=r_num, column=c_idx, value=v)
            cell.font = normal_font
            cell.fill = fill_r
            cell.border = thin_border
            if c_idx == 2:
                cell.alignment = align_left
            elif c_idx == 1:
                cell.alignment = align_center
            else:
                cell.alignment = align_right

    # Sheet 3 Total Row
    tot_row3 = 5 + len(sorted_peeos)
    ws3.row_dimensions[tot_row3].height = 24
    ws3.merge_cells(start_row=tot_row3, start_column=1, end_row=tot_row3, end_column=2)
    c3_lbl = ws3.cell(row=tot_row3, column=1, value="कुल योग (BLOCK TOTAL)")
    c3_lbl.font = bold_font
    c3_lbl.alignment = align_center
    c3_lbl.fill = fill_summary_row

    for c in range(1, 3):
        ws3.cell(row=tot_row3, column=c).fill = fill_summary_row
        ws3.cell(row=tot_row3, column=c).border = double_bottom_border

    for c in range(3, 9):
        col_letter = get_column_letter(c)
        cell = ws3.cell(row=tot_row3, column=c, value=f"=SUM({col_letter}5:{col_letter}{tot_row3-1})")
        cell.font = bold_font
        cell.fill = fill_summary_row
        cell.border = double_bottom_border
        cell.alignment = align_right

    # Auto-adjust column widths for all sheets
    for ws in [ws1, ws2, ws3]:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            # Sample first 20 rows to avoid header banner width blowout
            for cell in col[3:25]:
                val_str = str(cell.value or '')
                if len(val_str) > max_len:
                    max_len = len(val_str)
            # Give a sensible width
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # Specific overrides for readability
    ws1.column_dimensions['A'].width = 8
    ws1.column_dimensions['B'].width = 38
    ws1.column_dimensions['D'].width = 18
    ws1.column_dimensions['F'].width = 24
    ws1.column_dimensions['H'].width = 14
    ws1.column_dimensions['I'].width = 24
    ws1.column_dimensions['K'].width = 24

    ws2.column_dimensions['A'].width = 8
    ws2.column_dimensions['B'].width = 16
    ws2.column_dimensions['C'].width = 45
    ws2.column_dimensions['D'].width = 24
    ws2.column_dimensions['E'].width = 26
    ws2.column_dimensions['F'].width = 28

    ws3.column_dimensions['A'].width = 8
    ws3.column_dimensions['B'].width = 32
    ws3.column_dimensions['C'].width = 16
    ws3.column_dimensions['D'].width = 16
    ws3.column_dimensions['E'].width = 16
    ws3.column_dimensions['F'].width = 16
    ws3.column_dimensions['G'].width = 16
    ws3.column_dimensions['H'].width = 22

    output_path = "CBEO_Bhinai_Saman_Pariksha_All_Schools_All_Subjects_Master.xlsx"
    wb.save(output_path)
    print(f"Master Excel file saved successfully: {output_path}")

if __name__ == '__main__':
    generate_excel()
