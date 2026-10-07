import sqlite3
import json
import re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

excel_path = r"C:\Users\jiten\Desktop\cbeo\school enrolment.xlsx"
wb = openpyxl.load_workbook(excel_path)

# Load master school info for Hindi names and details
with open('schools_56_master.json', encoding='utf-8') as f:
    master_schools = {str(s.get('shala_darpan_code')): s for s in json.load(f)}

with open('saman_pariksha_submissions.json', encoding='utf-8') as f:
    saman_submissions = json.load(f)

# Read Sheet1 (Enrolment)
sheet1 = wb["Sheet1"]
excel_data = {}
for r in range(2, sheet1.max_row + 1):
    sr = sheet1.cell(row=r, column=1).value
    school_raw = str(sheet1.cell(row=r, column=2).value or "").strip()
    sch_type = sheet1.cell(row=r, column=3).value
    hm_sheet1 = sheet1.cell(row=r, column=4).value
    c1_5 = sheet1.cell(row=r, column=5).value or 0
    c6_8 = sheet1.cell(row=r, column=6).value or 0
    c9_10 = sheet1.cell(row=r, column=7).value or 0
    c11_12 = sheet1.cell(row=r, column=8).value or 0
    
    if not school_raw or "TOTAL" in school_raw.upper():
        continue
        
    code = ""
    m = re.search(r'\((\w+)\)', school_raw)
    if m:
        code = m.group(1).strip()
    clean_name = re.sub(r'\s*\(\w+\)\s*$', '', school_raw).strip()
    
    excel_data[code] = {
        "sr": sr,
        "school_raw": school_raw,
        "clean_name": clean_name,
        "school_type": sch_type,
        "hm": hm_sheet1,
        "c9_10": int(c9_10) if str(c9_10).isdigit() else 0,
        "c11_12": int(c11_12) if str(c11_12).isdigit() else 0,
        "tot_9_12": (int(c9_10) if str(c9_10).isdigit() else 0) + (int(c11_12) if str(c11_12).isdigit() else 0)
    }

# Remove existing comparison sheet if present
target_sheet_name = "समान परीक्षा मिलान व अंतर"
if target_sheet_name in wb.sheetnames:
    del wb[target_sheet_name]

ws = wb.create_sheet(title=target_sheet_name)
ws.views.sheetView[0].showGridLines = True

# STYLES
font_title = Font(name="Calibri", size=15, bold=True, color="1F497D")
font_subtitle = Font(name="Calibri", size=11, bold=True, color="1B365D")
font_meta = Font(name="Calibri", size=10, italic=True, color="333333")

font_sec_hdr = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
fill_sec_hdr = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")

font_col_hdr = Font(name="Calibri", size=10, bold=True, color="000000")
fill_col_hdr_main = PatternFill(start_color="DCE6F1", end_color="DCE6F1", fill_type="solid")
fill_col_hdr_contact = PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid")
fill_col_hdr_enr = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
fill_col_hdr_smn = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
fill_col_hdr_diff = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")

font_data = Font(name="Calibri", size=10, color="000000")
font_bold = Font(name="Calibri", size=10, bold=True, color="000000")
font_diff = Font(name="Calibri", size=10, bold=True, color="C00000")
font_match = Font(name="Calibri", size=10, color="274E13")

fill_diff = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
fill_pvt_hdr = PatternFill(start_color="4A235A", end_color="4A235A", fill_type="solid")
fill_pvt_col = PatternFill(start_color="E8DAEF", end_color="E8DAEF", fill_type="solid")

thin_border = Border(
    left=Side(style='thin', color='D9D9D9'),
    right=Side(style='thin', color='D9D9D9'),
    top=Side(style='thin', color='D9D9D9'),
    bottom=Side(style='thin', color='D9D9D9')
)
total_row_border = Border(
    left=Side(style='thin', color='000000'),
    right=Side(style='thin', color='000000'),
    top=Side(style='thin', color='000000'),
    bottom=Side(style='double', color='000000')
)

align_center = Alignment(horizontal="center", vertical="center")
align_left = Alignment(horizontal="left", vertical="center")
align_right = Alignment(horizontal="right", vertical="center")
align_wrap_center = Alignment(horizontal="center", vertical="center", wrap_text=True)

# HEADER ROWS
ws.merge_cells("A1:Q1")
ws["A1"] = "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)"
ws["A1"].font = font_title
ws["A1"].alignment = align_center

ws.merge_cells("A2:Q2")
ws["A2"] = "समान परीक्षा (2026-27) मांग बनाम शाला दर्पण नामांकन मिलान एवं अंतर विश्लेषण रिपोर्ट (मय संस्था प्रधान संपर्क विवरण)"
ws["A2"].font = font_subtitle
ws["A2"].alignment = align_center

ws.merge_cells("A3:Q3")
ws["A3"] = "जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (BHINAI) | कुल राजकीय विद्यालय: 49 | कुल निजी विद्यालय: 8"
ws["A3"].font = font_meta
ws["A3"].alignment = align_center

ws.row_dimensions[1].height = 26
ws.row_dimensions[2].height = 20
ws.row_dimensions[3].height = 18

# SECTION 1
ws.merge_cells("A4:Q4")
ws["A4"] = "भाग - 1 : राजकीय माध्यमिक एवं उच्च माध्यमिक विद्यालय (49 विद्यालय) - नामांकन बनाम परीक्षा मांग मिलान एवं संस्था प्रधान विवरण"
ws["A4"].font = font_sec_hdr
ws["A4"].fill = fill_sec_hdr
ws["A4"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
ws.row_dimensions[4].height = 22

# Two-tier column header
# Tier 1
headers_tier1 = [
    ("A5:A6", "क्र.सं.", fill_col_hdr_main),
    ("B5:B6", "शाला दर्पण कोड", fill_col_hdr_main),
    ("C5:C6", "विद्यालय का सही नाम (School Official Hindi & English Name)", fill_col_hdr_main),
    ("D5:D6", "PEEO परिक्षेत्र", fill_col_hdr_main),
    ("E5:E6", "संस्था प्रधान का नाम\n(Principal / HM)", fill_col_hdr_contact),
    ("F5:F6", "संस्था प्रधान मोबाइल\n(Principal Mobile)", fill_col_hdr_contact),
    ("G5:G6", "परीक्षा प्रभारी मोबाइल\n(Exam Incharge Mobile)", fill_col_hdr_contact),
    ("H5:J5", "कक्षा 9 एवं 10 मिलान", fill_col_hdr_enr),
    ("K5:M5", "कक्षा 11 एवं 12 मिलान", fill_col_hdr_smn),
    ("N5:P5", "कुल विद्यार्थी संख्या (कक्षा 9 से 12)", fill_col_hdr_diff),
    ("Q5:Q6", "अंतर स्थिति व टिप्पणी\n(Remarks / Status)", fill_col_hdr_main)
]

for cell_range, text, fill_bg in headers_tier1:
    ws.merge_cells(cell_range)
    top_cell = ws[cell_range.split(":")[0]]
    top_cell.value = text
    top_cell.font = font_col_hdr
    top_cell.alignment = align_wrap_center
    top_cell.fill = fill_bg

# Tier 2
headers_tier2 = [
    ("H6", "नामांकन\n(9-10)", fill_col_hdr_enr),
    ("I6", "समान परीक्षा\n(9+10)", fill_col_hdr_enr),
    ("J6", "अंतर\n(Diff)", fill_col_hdr_enr),
    ("K6", "नामांकन\n(11-12)", fill_col_hdr_smn),
    ("L6", "समान परीक्षा\n(11+12)", fill_col_hdr_smn),
    ("M6", "अंतर\n(Diff)", fill_col_hdr_smn),
    ("N6", "कुल नामांकन\n(9-12)", fill_col_hdr_diff),
    ("O6", "समान परीक्षा\nकुल मांग", fill_col_hdr_diff),
    ("P6", "कुल अंतर\n(Net Diff)", fill_col_hdr_diff),
]

for cell_ref, text, fill_bg in headers_tier2:
    cell = ws[cell_ref]
    cell.value = text
    cell.font = font_col_hdr
    cell.alignment = align_wrap_center
    cell.fill = fill_bg

ws.row_dimensions[5].height = 22
ws.row_dimensions[6].height = 28

for r in range(5, 7):
    for col in range(1, 18):
        ws.cell(row=r, column=col).border = thin_border

# DATA ROWS - 49 Government Schools
cur_row = 7
sr_no = 1

tot_enr_9_10 = 0
tot_smn_9_10 = 0
tot_diff_9_10 = 0
tot_enr_11_12 = 0
tot_smn_11_12 = 0
tot_diff_11_12 = 0
tot_enr_all = 0
tot_smn_all = 0
tot_diff_all = 0

diff_count = 0
match_count = 0

for code, ex in excel_data.items():
    sm = saman_submissions.get(code, {})
    m_info = master_schools.get(code, {})
    
    # Official Name: prefer Hindi name + English name for 100% accuracy
    hindi_name = m_info.get("school_name", "")
    eng_name = sm.get("school_name") or ex["clean_name"]
    
    if hindi_name and hindi_name != eng_name:
        display_name = f"{hindi_name} ({eng_name})"
    else:
        display_name = eng_name
        
    peeo = sm.get("peeo_name") or m_info.get("peeo_name") or "-"
    principal_name = sm.get("principal_name") or m_info.get("principal_name") or ex.get("hm") or "-"
    principal_mob = sm.get("principal_mobile") or m_info.get("principal_mobile") or "-"
    incharge_mob = sm.get("incharge_mobile") or "-"
    if sm.get("incharge_name"):
        incharge_info = f"{sm.get('incharge_name')} ({incharge_mob})" if incharge_mob != "-" else sm.get('incharge_name')
    else:
        incharge_info = incharge_mob
        
    c9 = int(sm.get("c9_total") or 0)
    c10 = int(sm.get("c10_total") or 0)
    c11 = int(sm.get("c11_total") or 0)
    c12 = int(sm.get("c12_total") or 0)
    
    smn_9_10 = c9 + c10
    smn_11_12 = c11 + c12
    smn_tot = int(sm.get("grand_total") or (smn_9_10 + smn_11_12))
    
    enr_9_10 = ex["c9_10"]
    diff_9_10 = smn_9_10 - enr_9_10
    
    enr_11_12 = ex["c11_12"]
    diff_11_12 = smn_11_12 - enr_11_12
    
    enr_tot = ex["tot_9_12"]
    diff_tot = smn_tot - enr_tot
    
    if diff_tot == 0 and diff_9_10 == 0 and diff_11_12 == 0:
        status_text = "पूर्ण मिलान (Exact Match)"
        status_font = font_match
        row_status_fill = None
        match_count += 1
    else:
        diff_count += 1
        parts = []
        if diff_9_10 != 0:
            parts.append(f"9-10 में {diff_9_10:+d}")
        if diff_11_12 != 0:
            parts.append(f"11-12 में {diff_11_12:+d}")
        status_text = f"अंतर: {diff_tot:+d} ({', '.join(parts)})"
        status_font = font_diff
        row_status_fill = fill_diff

    # Add to totals
    tot_enr_9_10 += enr_9_10
    tot_smn_9_10 += smn_9_10
    tot_diff_9_10 += diff_9_10
    tot_enr_11_12 += enr_11_12
    tot_smn_11_12 += smn_11_12
    tot_diff_11_12 += diff_11_12
    tot_enr_all += enr_tot
    tot_smn_all += smn_tot
    tot_diff_all += diff_tot

    ws.cell(row=cur_row, column=1, value=sr_no).alignment = align_center
    ws.cell(row=cur_row, column=2, value=code).alignment = align_center
    ws.cell(row=cur_row, column=3, value=display_name).alignment = align_left
    ws.cell(row=cur_row, column=4, value=peeo).alignment = align_left
    ws.cell(row=cur_row, column=5, value=principal_name).alignment = align_left
    ws.cell(row=cur_row, column=6, value=principal_mob).alignment = align_center
    ws.cell(row=cur_row, column=7, value=incharge_info).alignment = align_left
    
    ws.cell(row=cur_row, column=8, value=enr_9_10).alignment = align_right
    ws.cell(row=cur_row, column=9, value=smn_9_10).alignment = align_right
    
    c_diff_910 = ws.cell(row=cur_row, column=10, value=diff_9_10)
    c_diff_910.alignment = align_right
    if diff_9_10 != 0:
        c_diff_910.font = font_diff
        c_diff_910.fill = fill_diff
    else:
        c_diff_910.font = font_data
        
    ws.cell(row=cur_row, column=11, value=enr_11_12).alignment = align_right
    ws.cell(row=cur_row, column=12, value=smn_11_12).alignment = align_right
    
    c_diff_1112 = ws.cell(row=cur_row, column=13, value=diff_11_12)
    c_diff_1112.alignment = align_right
    if diff_11_12 != 0:
        c_diff_1112.font = font_diff
        c_diff_1112.fill = fill_diff
    else:
        c_diff_1112.font = font_data

    ws.cell(row=cur_row, column=14, value=enr_tot).alignment = align_right
    ws.cell(row=cur_row, column=15, value=smn_tot).alignment = align_right
    
    c_diff_tot = ws.cell(row=cur_row, column=16, value=diff_tot)
    c_diff_tot.alignment = align_right
    if diff_tot != 0:
        c_diff_tot.font = font_diff
        c_diff_tot.fill = fill_diff
    else:
        c_diff_tot.font = font_data

    c_stat = ws.cell(row=cur_row, column=17, value=status_text)
    c_stat.alignment = align_left
    c_stat.font = status_font
    if row_status_fill:
        c_stat.fill = row_status_fill

    for col in range(1, 18):
        cell = ws.cell(row=cur_row, column=col)
        cell.border = thin_border
        if not cell.font:
            cell.font = font_data
            
    cur_row += 1
    sr_no += 1

# TOTAL ROW FOR GOVERNMENT SCHOOLS
ws.merge_cells(start_row=cur_row, start_column=1, end_row=cur_row, end_column=7)
total_lbl = ws.cell(row=cur_row, column=1, value="कुल राजकीय विद्यालय योग (49 Schools Total)")
total_lbl.font = font_bold
total_lbl.alignment = align_center
total_lbl.fill = fill_col_hdr_main

ws.cell(row=cur_row, column=8, value=tot_enr_9_10).alignment = align_right
ws.cell(row=cur_row, column=9, value=tot_smn_9_10).alignment = align_right
c_t910 = ws.cell(row=cur_row, column=10, value=tot_diff_9_10)
c_t910.alignment = align_right
c_t910.font = font_diff if tot_diff_9_10 != 0 else font_bold

ws.cell(row=cur_row, column=11, value=tot_enr_11_12).alignment = align_right
ws.cell(row=cur_row, column=12, value=tot_smn_11_12).alignment = align_right
c_t1112 = ws.cell(row=cur_row, column=13, value=tot_diff_11_12)
c_t1112.alignment = align_right
c_t1112.font = font_diff if tot_diff_11_12 != 0 else font_bold

ws.cell(row=cur_row, column=14, value=tot_enr_all).alignment = align_right
ws.cell(row=cur_row, column=15, value=tot_smn_all).alignment = align_right
c_tall = ws.cell(row=cur_row, column=16, value=tot_diff_all)
c_tall.alignment = align_right
c_tall.font = font_diff if tot_diff_all != 0 else font_bold

c_tstat = ws.cell(row=cur_row, column=17, value=f"कुल अंतर: {tot_diff_all:+d} ({diff_count} विद्यालयों में अंतर, {match_count} में पूर्ण मिलान)")
c_tstat.alignment = align_left
c_tstat.font = font_bold

for col in range(1, 18):
    cell = ws.cell(row=cur_row, column=col)
    cell.border = total_row_border
    if col in [8, 9, 11, 12, 14, 15]:
        cell.font = font_bold
        cell.fill = fill_col_hdr_main
    elif col in [10, 13, 16]:
        cell.fill = fill_diff if cell.value != 0 else fill_col_hdr_main
    elif col == 17:
        cell.fill = fill_col_hdr_main

ws.row_dimensions[cur_row].height = 24
cur_row += 2

# SECTION 2: PRIVATE SCHOOLS
ws.merge_cells(start_row=cur_row, start_column=1, end_row=cur_row, end_column=17)
pvt_sec = ws.cell(row=cur_row, column=1, value="भाग - 2 : गैर-सरकारी / निजी विद्यालय (8 विद्यालय) - केवल समान परीक्षा पोर्टल पर दर्ज मांग व संस्था प्रधान विवरण")
pvt_sec.font = font_sec_hdr
pvt_sec.fill = fill_pvt_hdr
pvt_sec.alignment = Alignment(horizontal="left", vertical="center", indent=1)
ws.row_dimensions[cur_row].height = 22
cur_row += 1

ws.merge_cells(start_row=cur_row, start_column=1, end_row=cur_row, end_column=17)
pvt_note = ws.cell(row=cur_row, column=1, value="* नोट: ये 8 निजी विद्यालय समान परीक्षा 2026-27 में शामिल हैं, किंतु 'school enrolment.xlsx' (राजकीय शाला दर्पण नामांकन) में नहीं हैं।")
pvt_note.font = font_meta
pvt_note.alignment = Alignment(horizontal="left", vertical="center", indent=1)
ws.row_dimensions[cur_row].height = 18
cur_row += 1

# Header for Private Schools
pvt_headers = [
    ("A", "क्र.सं."),
    ("B", "विद्यालय कोड"),
    ("C", "निजी विद्यालय का नाम (School Name)"),
    ("D", "संबद्ध PEEO"),
    ("E", "संस्था प्रधान (Principal)"),
    ("F", "संस्था प्रधान मोबाइल"),
    ("G", "परीक्षा प्रभारी संपर्क"),
    ("H", "नामांकन (9-10)"),
    ("I", "समान परीक्षा (9+10)"),
    ("J", "अंतर"),
    ("K", "नामांकन (11-12)"),
    ("L", "समान परीक्षा (11+12)"),
    ("M", "अंतर"),
    ("N", "कुल नामांकन"),
    ("O", "समान परीक्षा कुल मांग"),
    ("P", "अंतर"),
    ("Q", "स्थिति / टिप्पणी")
]

for col_letter, text in pvt_headers:
    cell = ws[f"{col_letter}{cur_row}"]
    cell.value = text
    cell.font = font_col_hdr
    cell.fill = fill_pvt_col
    cell.alignment = align_wrap_center
    cell.border = thin_border

ws.row_dimensions[cur_row].height = 24
cur_row += 1

pvt_codes = [c for c in saman_submissions.keys() if c.startswith("P")]
pvt_sr = 1
tot_pvt_9_10 = 0
tot_pvt_11_12 = 0
tot_pvt_all = 0

for p_code in sorted(pvt_codes):
    p_data = saman_submissions[p_code]
    p_c9 = int(p_data.get("c9_total") or 0)
    p_c10 = int(p_data.get("c10_total") or 0)
    p_c11 = int(p_data.get("c11_total") or 0)
    p_c12 = int(p_data.get("c12_total") or 0)
    
    p_910 = p_c9 + p_c10
    p_1112 = p_c11 + p_c12
    p_tot = int(p_data.get("grand_total") or (p_910 + p_1112))
    
    tot_pvt_9_10 += p_910
    tot_pvt_11_12 += p_1112
    tot_pvt_all += p_tot

    p_incharge = f"{p_data.get('incharge_name')} ({p_data.get('incharge_mobile')})" if p_data.get('incharge_name') else p_data.get('incharge_mobile', '-')

    ws.cell(row=cur_row, column=1, value=pvt_sr).alignment = align_center
    ws.cell(row=cur_row, column=2, value=p_code).alignment = align_center
    ws.cell(row=cur_row, column=3, value=p_data.get("school_name", "")).alignment = align_left
    ws.cell(row=cur_row, column=4, value=p_data.get("peeo_name", "-")).alignment = align_left
    ws.cell(row=cur_row, column=5, value=p_data.get("principal_name", "-")).alignment = align_left
    ws.cell(row=cur_row, column=6, value=p_data.get("principal_mobile", "-")).alignment = align_center
    ws.cell(row=cur_row, column=7, value=p_incharge).alignment = align_left
    ws.cell(row=cur_row, column=8, value="-").alignment = align_center
    ws.cell(row=cur_row, column=9, value=p_910).alignment = align_right
    ws.cell(row=cur_row, column=10, value="-").alignment = align_center
    ws.cell(row=cur_row, column=11, value="-").alignment = align_center
    ws.cell(row=cur_row, column=12, value=p_1112).alignment = align_right
    ws.cell(row=cur_row, column=13, value="-").alignment = align_center
    ws.cell(row=cur_row, column=14, value="-").alignment = align_center
    ws.cell(row=cur_row, column=15, value=p_tot).alignment = align_right
    ws.cell(row=cur_row, column=16, value="-").alignment = align_center
    ws.cell(row=cur_row, column=17, value="निजी विद्यालय (समान परीक्षा मांग दर्ज)").alignment = align_left

    for col in range(1, 18):
        cell = ws.cell(row=cur_row, column=col)
        cell.border = thin_border
        cell.font = font_data

    cur_row += 1
    pvt_sr += 1

# Private schools total
ws.merge_cells(start_row=cur_row, start_column=1, end_row=cur_row, end_column=7)
pvt_tot_cell = ws.cell(row=cur_row, column=1, value="कुल निजी विद्यालय योग (8 Private Schools Total)")
pvt_tot_cell.font = font_bold
pvt_tot_cell.alignment = align_center
pvt_tot_cell.fill = fill_pvt_col

ws.cell(row=cur_row, column=8, value="-").alignment = align_center
ws.cell(row=cur_row, column=9, value=tot_pvt_9_10).alignment = align_right
ws.cell(row=cur_row, column=10, value="-").alignment = align_center
ws.cell(row=cur_row, column=11, value="-").alignment = align_center
ws.cell(row=cur_row, column=12, value=tot_pvt_11_12).alignment = align_right
ws.cell(row=cur_row, column=13, value="-").alignment = align_center
ws.cell(row=cur_row, column=14, value="-").alignment = align_center
ws.cell(row=cur_row, column=15, value=tot_pvt_all).alignment = align_right
ws.cell(row=cur_row, column=16, value="-").alignment = align_center
ws.cell(row=cur_row, column=17, value=f"कुल निजी मांग: {tot_pvt_all}").alignment = align_left

for col in range(1, 18):
    cell = ws.cell(row=cur_row, column=col)
    cell.border = total_row_border
    cell.font = font_bold
    cell.fill = fill_pvt_col

ws.row_dimensions[cur_row].height = 24
cur_row += 2

# GRAND TOTAL BLOCK
ws.merge_cells(start_row=cur_row, start_column=1, end_row=cur_row, end_column=7)
grand_tot_cell = ws.cell(row=cur_row, column=1, value="महायोग (GRAND TOTAL: ब्लॉक भिनाय - कुल 57 विद्यालय)")
grand_tot_cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
grand_tot_cell.alignment = align_center
grand_tot_cell.fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")

ws.cell(row=cur_row, column=8, value=tot_enr_9_10).alignment = align_right
ws.cell(row=cur_row, column=9, value=tot_smn_9_10 + tot_pvt_9_10).alignment = align_right
ws.cell(row=cur_row, column=10, value=tot_diff_9_10).alignment = align_right
ws.cell(row=cur_row, column=11, value=tot_enr_11_12).alignment = align_right
ws.cell(row=cur_row, column=12, value=tot_smn_11_12 + tot_pvt_11_12).alignment = align_right
ws.cell(row=cur_row, column=13, value=tot_diff_11_12).alignment = align_right
ws.cell(row=cur_row, column=14, value=tot_enr_all).alignment = align_right
ws.cell(row=cur_row, column=15, value=tot_smn_all + tot_pvt_all).alignment = align_right
ws.cell(row=cur_row, column=16, value=tot_diff_all).alignment = align_right
ws.cell(row=cur_row, column=17, value="राजकीय नामांकन बनाम समान परीक्षा कुल 57 विद्यालयों की मांग").alignment = align_left

for col in range(1, 18):
    cell = ws.cell(row=cur_row, column=col)
    cell.border = Border(
        left=Side(style='medium', color='1F497D'),
        right=Side(style='medium', color='1F497D'),
        top=Side(style='medium', color='1F497D'),
        bottom=Side(style='double', color='1F497D')
    )
    cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    cell.fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")

ws.row_dimensions[cur_row].height = 24

# Set widths
col_widths = {
    "A": 7,    # Sr
    "B": 15,   # Code
    "C": 48,   # Official School Name
    "D": 22,   # PEEO
    "E": 26,   # Principal Name
    "F": 18,   # Principal Mobile
    "G": 30,   # Incharge Mobile
    "H": 13,   # Enr 9-10
    "I": 14,   # Smn 9-10
    "J": 11,   # Diff 9-10
    "H": 13,   # Enr 11-12
    "L": 14,   # Smn 11-12
    "M": 11,   # Diff 11-12
    "N": 15,   # Tot Enr
    "O": 15,   # Smn Tot
    "P": 12,   # Net Diff
    "Q": 36    # Status
}

for col_letter, width in col_widths.items():
    ws.column_dimensions[col_letter].width = width

wb.save(excel_path)
print("SUCCESSFULLY_UPDATED_EXCEL_WITH_PRINCIPAL_DETAILS")
