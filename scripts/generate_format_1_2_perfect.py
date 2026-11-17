import openpyxl
import json
import shutil
import os
from copy import copy

# Paths
ORIG_TEMPLATE = r'saman priksha/Format 1 and 2 blank.xlsx'
OUTPUT_FILLED = r'saman priksha/Format 1 and 2 filled.xlsx'
OUTPUT_BLANK = r'saman priksha/Format 1 and 2 blank.xlsx'
WHATSAPP_COPY = r'C:\Users\jiten\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm\LocalState\sessions\BECD56A9B3B44B0563204B742262D9BFAB08FCDD\transfers\2026-46\Format 1 and 2 filled.xlsx'

# Optional subjects configuration with exact image names & codes
OPT_CONFIG = [
    ('pol_sci', 'Political Science', 1114, 1215),
    ('history', 'History', 1115, 1216),
    ('geography', 'Geography', 1111, 1212),
    ('hindi_lit', 'Hindi Literature', 1117, 1218),
    ('eng_lit', 'English Literature', 1113, 1214),
    ('sanskrit_lit', 'Sanskrit Literature', 1110, 1211),
    ('urdu_lit', 'Urdu Literature', 1118, 1219),
    ('drawing', 'Drawing', 1112, 1213),
    ('economics', 'Economics', 1122, 1223),
    ('sociology', 'Sociology', 1120, 1221),
    ('home_sci', 'Home Science', 1116, 1217),
    ('physics', 'Physics', 1125, 1226),
    ('chemistry', 'Chemistry', 1126, 1227),
    ('biology', 'Biology', 1127, 1228),
    ('maths', 'Mathematics', 1104, 1204),
    ('comp_sci', 'Computer Science', 1121, 1222),
    ('accountancy', 'Accountancy (Commerce)', 1123, 1224),
    ('business_studies', 'Business Studies (Commerce)', 1124, 1225),
    ('agri_sci', 'Agriculture Science (Agriculture Stream)', 1128, 1205),
    ('agri_bio', 'Biology (Agriculture Stream)', 1106, 1207),
    ('agri_chem', 'Chemistry (Agriculture Stream)', 1105, 1206)
]

def generate():
    # 1. Load Master Data
    with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
        master = json.load(f)

    schools = master.get('schools_56', [])
    subs = master.get('saman_pariksha_submissions', {})

    print(f"Loaded {len(schools)} schools and {len(subs)} submissions.")

    # 2. Load fresh original template
    wb = openpyxl.load_workbook(ORIG_TEMPLATE)
    ws1 = wb['class 9 and 10']
    ws2 = wb['class 11 and 12']

    # Capture template row 4 styles for both sheets
    proto_s1 = [copy_cell_style(ws1.cell(row=4, column=c)) for c in range(1, 15)]
    proto_s2 = [copy_cell_style(ws2.cell(row=4, column=c)) for c in range(1, 15)]

    # --- POPULATE SHEET 1 (class 9 and 10) ---
    current_row = 4
    sr_no = 1

    for s in schools:
        code = str(s.get('shala_darpan_code', '')).strip()
        school_name = s.get('school_name_en') or s.get('school_name') or ''
        stype = s.get('type', 'Government')
        cat = s.get('category', 'Govt. Sr. Sec.')
        ref_id = (('AJM04P' if stype == 'Private' else 'AJM04G') + code)
        psp_code = code if stype == 'Private' else ''
        mobile = str(s.get('principal_mobile') or '')
        remarks = f"{cat} - {stype}"

        sub = subs.get(code, {})
        c9_tot = int(sub.get('c9_total', 0))
        c9_san = int(sub.get('c9_sanskrit', 0))
        c9_urd = int(sub.get('c9_urdu', 0))

        c10_tot = int(sub.get('c10_total', 0))
        c10_san = int(sub.get('c10_sanskrit', 0))
        c10_urd = int(sub.get('c10_urdu', 0))

        # Class 9 rows
        if c9_san > 0 and c9_urd > 0:
            # Sanskrit row
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '9th', c9_tot, 'Sanskrit', '906', c9_san, remarks, proto_s1)
            current_row += 1
            sr_no += 1
            # Urdu row
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '9th', c9_tot, 'Urdu', '907', c9_urd, remarks, proto_s1)
            current_row += 1
            sr_no += 1
        elif c9_urd > 0:
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '9th', c9_tot, 'Urdu', '907', c9_urd, remarks, proto_s1)
            current_row += 1
            sr_no += 1
        else:
            # Default Sanskrit
            san_count = c9_san if c9_san > 0 else c9_tot
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '9th', c9_tot, 'Sanskrit', '906', san_count, remarks, proto_s1)
            current_row += 1
            sr_no += 1

        # Class 10 rows
        if c10_san > 0 and c10_urd > 0:
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '10th', c10_tot, 'Sanskrit', '1006', c10_san, remarks, proto_s1)
            current_row += 1
            sr_no += 1
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '10th', c10_tot, 'Urdu', '1007', c10_urd, remarks, proto_s1)
            current_row += 1
            sr_no += 1
        elif c10_urd > 0:
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '10th', c10_tot, 'Urdu', '1007', c10_urd, remarks, proto_s1)
            current_row += 1
            sr_no += 1
        else:
            san_count = c10_san if c10_san > 0 else c10_tot
            write_s1_row(ws1, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '10th', c10_tot, 'Sanskrit', '1006', san_count, remarks, proto_s1)
            current_row += 1
            sr_no += 1

    last_row_s1 = current_row - 1
    print(f"Sheet 1 populated up to row {last_row_s1} (Total data rows: {last_row_s1 - 3}).")

    # Shift Sheet 1 Image to below data rows
    if getattr(ws1, '_images', []):
        img1 = ws1._images[0]
        # Image span: 9 rows (e.g. 11 to 20 was 9 rows)
        spacer_row = last_row_s1 + 1 # blank spacer
        img_from_row = spacer_row # 0-indexed row = Excel row spacer_row + 1
        img1.anchor._from.col = 1
        img1.anchor._from.row = img_from_row
        img1.anchor.to.col = 12
        img1.anchor.to.row = img_from_row + 9
        # Set row heights for image rows
        for r in range(img_from_row + 1, img_from_row + 11):
            ws1.row_dimensions[r].height = 18.0
        print(f"Sheet 1 image repositioned to rows {img_from_row + 1} - {img_from_row + 10}.")

    # --- POPULATE SHEET 2 (class 11 and 12) ---
    current_row = 4
    sr_no = 1

    for s in schools:
        code = str(s.get('shala_darpan_code', '')).strip()
        school_name = s.get('school_name_en') or s.get('school_name') or ''
        stype = s.get('type', 'Government')
        cat = s.get('category', 'Govt. Sr. Sec.')
        ref_id = (('AJM04P' if stype == 'Private' else 'AJM04G') + code)
        psp_code = code if stype == 'Private' else ''
        mobile = str(s.get('principal_mobile') or '')
        remarks = f"{cat} - {stype}"

        sub = subs.get(code, {})
        c11_tot = int(sub.get('c11_total', 0))
        c12_tot = int(sub.get('c12_total', 0))

        # Check if Sr. Sec. or has 11/12 enrollment
        is_sr_sec = ('Sr.' in cat or 'Senior' in cat or 'Senior' in school_name or c11_tot > 0 or c12_tot > 0)
        if not is_sr_sec:
            continue

        c11_opt = sub.get('c11_optional', {})
        c12_opt = sub.get('c12_optional', {})

        # 11th optionals
        c11_matched = 0
        for opt_key, opt_name, c11_code, c12_code in OPT_CONFIG:
            count = int(c11_opt.get(opt_key, 0))
            if count > 0:
                write_s2_row(ws2, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '11th', c11_tot, opt_name, str(c11_code), count, remarks, proto_s2)
                current_row += 1
                sr_no += 1
                c11_matched += 1

        if c11_matched == 0 and c11_tot > 0:
            # Fallback if faculties chosen but optionals 0
            fac = (sub.get('c11_faculties') or ['arts'])[0]
            subj_name = 'Hindi Literature' if fac == 'arts' else ('Physics' if fac == 'science' else 'Accountancy (Commerce)')
            subj_code = '1117' if fac == 'arts' else ('1125' if fac == 'science' else '1123')
            write_s2_row(ws2, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '11th', c11_tot, subj_name, subj_code, c11_tot, remarks, proto_s2)
            current_row += 1
            sr_no += 1
        elif c11_matched == 0 and c11_tot == 0 and is_sr_sec:
            write_s2_row(ws2, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '11th', 0, '-', '-', 0, remarks, proto_s2)
            current_row += 1
            sr_no += 1

        # 12th optionals
        c12_matched = 0
        for opt_key, opt_name, c11_code, c12_code in OPT_CONFIG:
            count = int(c12_opt.get(opt_key, 0))
            if count > 0:
                write_s2_row(ws2, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '12th', c12_tot, opt_name, str(c12_code), count, remarks, proto_s2)
                current_row += 1
                sr_no += 1
                c12_matched += 1

        if c12_matched == 0 and c12_tot > 0:
            fac = (sub.get('c12_faculties') or ['arts'])[0]
            subj_name = 'Hindi Literature' if fac == 'arts' else ('Physics' if fac == 'science' else 'Accountancy (Commerce)')
            subj_code = '1218' if fac == 'arts' else ('1226' if fac == 'science' else '1224')
            write_s2_row(ws2, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '12th', c12_tot, subj_name, subj_code, c12_tot, remarks, proto_s2)
            current_row += 1
            sr_no += 1
        elif c12_matched == 0 and c12_tot == 0 and is_sr_sec:
            write_s2_row(ws2, current_row, sr_no, 'AJMER', 'Bhinai', school_name, ref_id, psp_code, code, mobile, '12th', 0, '-', '-', 0, remarks, proto_s2)
            current_row += 1
            sr_no += 1

    last_row_s2 = current_row - 1
    print(f"Sheet 2 populated up to row {last_row_s2} (Total data rows: {last_row_s2 - 3}).")

    # Shift Sheet 2 Image to below data rows
    if getattr(ws2, '_images', []):
        img2 = ws2._images[0]
        spacer_row2 = last_row_s2 + 1
        img2_from_row = spacer_row2
        img2.anchor._from.col = 0
        img2.anchor._from.row = img2_from_row
        img2.anchor.to.col = 14
        img2.anchor.to.row = img2_from_row + 28
        for r in range(img2_from_row + 1, img2_from_row + 30):
            ws2.row_dimensions[r].height = 16.0
        print(f"Sheet 2 image repositioned to rows {img2_from_row + 1} - {img2_from_row + 29}.")

    # 3. Save workbook once
    wb.save(OUTPUT_FILLED)
    print(f"Saved populated workbook to: {OUTPUT_FILLED}")

    # Copy to blank and WhatsApp transfer destination
    shutil.copyfile(OUTPUT_FILLED, OUTPUT_BLANK)
    print(f"Copied to: {OUTPUT_BLANK}")

    try:
        shutil.copyfile(OUTPUT_FILLED, WHATSAPP_COPY)
        print(f"Copied to WhatsApp transfer path: {WHATSAPP_COPY}")
    except Exception as e:
        print(f"WhatsApp copy note: {e}")

def copy_cell_style(src_cell):
    return {
        'font': copy(src_cell.font) if src_cell.font else None,
        'border': copy(src_cell.border) if src_cell.border else None,
        'alignment': copy(src_cell.alignment) if src_cell.alignment else None,
        'fill': copy(src_cell.fill) if src_cell.fill else None,
        'number_format': src_cell.number_format
    }

def apply_style(target_cell, style_dict):
    if style_dict['font']:
        target_cell.font = copy(style_dict['font'])
    if style_dict['border']:
        target_cell.border = copy(style_dict['border'])
    if style_dict['alignment']:
        target_cell.alignment = copy(style_dict['alignment'])
    if style_dict['fill']:
        target_cell.fill = copy(style_dict['fill'])
    if style_dict['number_format']:
        target_cell.number_format = style_dict['number_format']

def write_s1_row(ws, row, sr, dist, block, school, ref, psp, nic, mob, cls, tot, subj, code, count, remarks, proto):
    ws.row_dimensions[row].height = 28.0
    vals = [sr, dist, block, school, ref, psp, nic, mob, cls, tot, subj, code, count, remarks]
    for c, val in enumerate(vals, 1):
        cell = ws.cell(row=row, column=c, value=val)
        apply_style(cell, proto[c - 1])

def write_s2_row(ws, row, sr, dist, block, school, ref, psp, nic, mob, cls, tot, subj, code, count, remarks, proto):
    ws.row_dimensions[row].height = 20.0
    vals = [sr, dist, block, school, ref, psp, nic, mob, cls, tot, subj, code, count, remarks]
    for c, val in enumerate(vals, 1):
        cell = ws.cell(row=row, column=c, value=val)
        apply_style(cell, proto[c - 1])

if __name__ == '__main__':
    generate()
