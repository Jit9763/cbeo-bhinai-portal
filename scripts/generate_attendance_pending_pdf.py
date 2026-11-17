import openpyxl
import os
import subprocess
import datetime
import shutil

EXCEL_PATH = r"C:\Users\jiten\Desktop\during census\14 june\School_Daily_Attendance_Excel_17_11_2026_04_48_09.xlsx"
OUTPUT_DIR_1 = r"C:\Users\jiten\Desktop\during census\14 june"
OUTPUT_DIR_2 = r"c:\Users\jiten\Desktop\03_शिक्षा_एवं_स्कूल\cbeo"

PDF_FILENAME = "CBEO_Bhinai_Daily_Attendance_Pending_Report_17_11_2026.pdf"
HTML_FILENAME = "CBEO_Bhinai_Daily_Attendance_Pending_Report_17_11_2026.html"

def main():
    print(f"Reading Excel: {EXCEL_PATH}")
    wb = openpyxl.load_workbook(EXCEL_PATH)
    ws = wb.active

    schools = []
    not_marked = []
    partial_marked = []
    fully_marked = []

    for r in range(2, ws.max_row + 1):
        nic = ws.cell(row=r, column=1).value
        school = str(ws.cell(row=r, column=2).value or '').strip()
        dist = str(ws.cell(row=r, column=3).value or 'AJMER').strip()
        # MANDATORY RULE: District is ALWAYS AJMER
        dist = 'AJMER'
        mobile = str(ws.cell(row=r, column=4).value or '').strip()
        marked = str(ws.cell(row=r, column=5).value or '').strip()
        tot_stud = int(ws.cell(row=r, column=6).value or 0)
        tot_sec = int(ws.cell(row=r, column=7).value or 0)
        sec_entry = int(ws.cell(row=r, column=8).value or 0)
        app_p = int(ws.cell(row=r, column=9).value or 0)
        web_p = int(ws.cell(row=r, column=10).value or 0)

        # clean school name
        clean_name = school
        if f"({nic})" in clean_name:
            clean_name = clean_name.replace(f"({nic})", "").strip()

        item = {
            'nic': nic,
            'school': clean_name,
            'raw_school': school,
            'dist': dist,
            'mobile': mobile,
            'marked': marked,
            'tot_stud': tot_stud,
            'tot_sec': tot_sec,
            'sec_entry': sec_entry,
            'pending_sec': tot_sec - sec_entry,
            'app_p': app_p,
            'web_p': web_p
        }
        schools.append(item)

        if marked.lower() == 'no' or sec_entry == 0:
            not_marked.append(item)
        elif sec_entry < tot_sec:
            partial_marked.append(item)
        else:
            fully_marked.append(item)

    total_count = len(schools)
    not_marked_count = len(not_marked)
    partial_count = len(partial_marked)
    full_count = len(fully_marked)
    total_defaulters = not_marked_count + partial_count

    print(f"Total: {total_count}, Not Marked: {not_marked_count}, Partial: {partial_count}, Full: {full_count}")

    # Build HTML
    html_content = f"""<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<title>दैनिक शाला दर्पण विद्यार्थी उपस्थिति पेंडिंग रिपोर्ट - CBEO भिनाय (अजमेर)</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 10mm 10mm 10mm 10mm;
  }}
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Nirmala UI', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }}
  body {{
    background: #ffffff;
    color: #1e293b;
    font-size: 11px;
    line-height: 1.35;
    padding: 10px;
  }}
  .header {{
    text-align: center;
    border-bottom: 2.5px solid #1e3a8a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }}
  .govt-title {{
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    letter-spacing: 0.5px;
  }}
  .office-title {{
    font-size: 17px;
    font-weight: 900;
    color: #1e3a8a;
    margin: 2px 0;
  }}
  .district-title {{
    font-size: 12px;
    font-weight: 800;
    color: #0f766e;
    margin-bottom: 4px;
  }}
  .report-subject {{
    font-size: 13px;
    font-weight: 800;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px dashed #f87171;
    display: inline-block;
    padding: 4px 14px;
    border-radius: 4px;
    margin-top: 3px;
  }}
  .meta-bar {{
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 600;
    color: #475569;
    margin-top: 5px;
    padding: 0 4px;
  }}
  
  /* Dashboard Summary Cards */
  .stats-grid {{
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin: 10px 0;
  }}
  .stat-card {{
    border-radius: 6px;
    padding: 8px 6px;
    text-align: center;
    border: 1px solid #e2e8f0;
  }}
  .stat-num {{
    font-size: 18px;
    font-weight: 900;
    line-height: 1.1;
  }}
  .stat-lbl {{
    font-size: 9.5px;
    font-weight: 700;
    margin-top: 2px;
  }}
  .card-total {{ background: #f8fafc; border-color: #cbd5e1; color: #1e293b; }}
  .card-full {{ background: #f0fdf4; border-color: #86efac; color: #166534; }}
  .card-partial {{ background: #fffbeb; border-color: #fde68a; color: #b45309; }}
  .card-zero {{ background: #fef2f2; border-color: #fca5a5; color: #991b1b; }}
  .card-defaulter {{ background: #fdf2f8; border-color: #fbcfe8; color: #9d174d; }}

  .notice-box {{
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    padding: 6px 10px;
    font-size: 10px;
    font-weight: 600;
    color: #78350f;
    margin-bottom: 12px;
    border-radius: 0 4px 4px 0;
  }}

  .section-heading {{
    font-size: 12px;
    font-weight: 800;
    padding: 5px 10px;
    border-radius: 4px;
    margin: 12px 0 6px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .sec-red {{
    background: #fef2f2;
    color: #991b1b;
    border-left: 5px solid #dc2626;
    border-top: 1px solid #fecaca;
    border-right: 1px solid #fecaca;
    border-bottom: 1px solid #fecaca;
  }}
  .sec-amber {{
    background: #fffbeb;
    color: #92400e;
    border-left: 5px solid #f59e0b;
    border-top: 1px solid #fef3c7;
    border-right: 1px solid #fef3c7;
    border-bottom: 1px solid #fef3c7;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 9.8px;
    margin-bottom: 10px;
    page-break-inside: auto;
  }}
  tr {{
    page-break-inside: avoid;
    page-break-after: auto;
  }}
  th, td {{
    border: 1px solid #cbd5e1;
    padding: 4.5px 6px;
    vertical-align: middle;
  }}
  th {{
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 800;
    text-align: center;
  }}
  .th-red {{
    background: #fee2e2;
    color: #991b1b;
  }}
  .th-amber {{
    background: #fef3c7;
    color: #78350f;
  }}
  .text-center {{ text-align: center; }}
  .text-right {{ text-align: right; }}
  .text-left {{ text-align: left; }}
  .font-bold {{ font-weight: 800; }}
  .text-danger {{ color: #dc2626; font-weight: 800; }}
  .text-warning {{ color: #d97706; font-weight: 800; }}
  .text-success {{ color: #16a34a; font-weight: 800; }}
  
  .badge-zero {{
    background: #fee2e2;
    color: #991b1b;
    padding: 2px 5px;
    border-radius: 3px;
    font-weight: 800;
    font-size: 9px;
    display: inline-block;
  }}
  .badge-part {{
    background: #fef3c7;
    color: #92400e;
    padding: 2px 5px;
    border-radius: 3px;
    font-weight: 800;
    font-size: 9px;
    display: inline-block;
  }}

  .sign-area {{
    margin-top: 25px;
    display: flex;
    justify-content: flex-end;
    text-align: center;
    page-break-inside: avoid;
  }}
  .sign-box {{
    width: 250px;
    font-size: 11px;
    font-weight: 700;
    color: #1e3a8a;
  }}
  .page-footer {{
    margin-top: 15px;
    border-top: 1px solid #cbd5e1;
    padding-top: 5px;
    font-size: 8.5px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }}
</style>
</head>
<body>

  <!-- Official Header -->
  <div class="header">
    <div class="govt-title">राजस्थान सरकार | शिक्षा विभाग</div>
    <div class="office-title">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</div>
    <div class="district-title">जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (BHINAI)</div>
    <div class="report-subject">🚨 दैनिक विद्यार्थी उपस्थिति डिफ़ॉल्टर / पेंडिंग रिपोर्ट</div>
    <div class="meta-bar">
      <span><strong>तिथि:</strong> 17 नवम्बर 2026</span>
      <span><strong>समय:</strong> अपराह्न 04:48 PM</span>
      <span><strong>स्रोत:</strong> शाला दर्पण पोर्टल (School Daily Attendance)</span>
    </div>
  </div>

  <!-- Summary Dashboard Cards -->
  <div class="stats-grid">
    <div class="stat-card card-total">
      <div class="stat-num">{total_count}</div>
      <div class="stat-lbl">कुल विद्यालय (Total)</div>
    </div>
    <div class="stat-card card-full">
      <div class="stat-num">{full_count}</div>
      <div class="stat-lbl">पूर्ण उपस्थित (100%)</div>
    </div>
    <div class="stat-card card-partial">
      <div class="stat-num">{partial_count}</div>
      <div class="stat-lbl">आंशिक शेष (Partial)</div>
    </div>
    <div class="stat-card card-zero">
      <div class="stat-num">{not_marked_count}</div>
      <div class="stat-lbl">शून्य प्रविष्टि (Zero)</div>
    </div>
    <div class="stat-card card-defaulter">
      <div class="stat-num">{total_defaulters}</div>
      <div class="stat-lbl">कुल लंबित (Defaulters)</div>
    </div>
  </div>

  <div class="notice-box">
    ⚠️ <strong>कार्यालय निर्देश:</strong> शाला दर्पण पोर्टल दैनिक समीक्षा अनुसार ब्लॉक भिनाय के कुल {total_count} विद्यालयों में से {full_count} विद्यालयों द्वारा शत-प्रतिशत सेक्शनों की उपस्थिति दर्ज की गई है। निम्न {total_defaulters} विद्यालयों ({not_marked_count} पूर्णतः शून्य + {partial_count} आंशिक शेष) के संस्था प्रधानों को निर्देशित किया जाता है कि आज ही तत्काल शेष सेक्शनों की विद्यार्थी उपस्थिति शाला दर्पण ऐप/वेब पोर्टल पर दर्ज करना सुनिश्चित करें।
  </div>

  <!-- TABLE 1: ZERO ATTENDANCE -->
  <div class="section-heading sec-red">
    <span>भाग 1: उपस्थिति बिल्कुल नहीं भरने वाले विद्यालय (शून्य प्रविष्टि - School Entry Marked: NO)</span>
    <span>कुल विद्यालय: {not_marked_count}</span>
  </div>

  <table>
    <thead>
      <tr class="th-red">
        <th style="width: 30px;">क्र.</th>
        <th style="width: 60px;">NIC कोड</th>
        <th>विद्यालय का नाम (School Name)</th>
        <th style="width: 85px;">संस्था प्रधान मोबाइल</th>
        <th style="width: 55px;">कुल छात्र</th>
        <th style="width: 50px;">कुल सेक्शन</th>
        <th style="width: 55px;">प्रविष्ट सेक्शन</th>
        <th style="width: 75px;">स्थिति</th>
      </tr>
    </thead>
    <tbody>
"""

    for i, s in enumerate(not_marked, 1):
        bg = "#fff" if i % 2 != 0 else "#fff5f5"
        html_content += f"""
      <tr style="background: {bg};">
        <td class="text-center font-bold">{i}</td>
        <td class="text-center font-bold">{s['nic']}</td>
        <td class="text-left font-bold" style="color: #0f172a;">{s['school']}</td>
        <td class="text-center font-bold" style="color: #1e3a8a;"><a href="tel:{s['mobile']}" style="text-decoration:none; color:#1e3a8a;">{s['mobile']}</a></td>
        <td class="text-center font-bold">{s['tot_stud']}</td>
        <td class="text-center font-bold">{s['tot_sec']}</td>
        <td class="text-center text-danger font-bold">0</td>
        <td class="text-center"><span class="badge-zero">शून्य (Pending)</span></td>
      </tr>"""

    html_content += f"""
    </tbody>
  </table>

  <!-- TABLE 2: PARTIAL ATTENDANCE -->
  <div class="section-heading sec-amber" style="page-break-before: auto; margin-top: 16px;">
    <span>भाग 2: आंशिक उपस्थिति दर्ज विद्यालय (Pending Sections - कुछ कक्षाएं शेष)</span>
    <span>कुल विद्यालय: {partial_count}</span>
  </div>

  <table>
    <thead>
      <tr class="th-amber">
        <th style="width: 28px;">क्र.</th>
        <th style="width: 55px;">NIC कोड</th>
        <th>विद्यालय का नाम (School Name)</th>
        <th style="width: 80px;">संस्था प्रधान मोबाइल</th>
        <th style="width: 45px;">कुल छात्र</th>
        <th style="width: 45px;">कुल सेक्शन</th>
        <th style="width: 45px;">प्रविष्ट</th>
        <th style="width: 45px;">शेष सेक्शन</th>
        <th style="width: 50px;">App प्रविष्टि</th>
        <th style="width: 50px;">Web प्रविष्टि</th>
        <th style="width: 60px;">स्थिति</th>
      </tr>
    </thead>
    <tbody>
"""

    for i, s in enumerate(partial_marked, 1):
        bg = "#fff" if i % 2 != 0 else "#fffdf5"
        html_content += f"""
      <tr style="background: {bg};">
        <td class="text-center font-bold">{i}</td>
        <td class="text-center font-bold">{s['nic']}</td>
        <td class="text-left font-bold" style="color: #0f172a;">{s['school']}</td>
        <td class="text-center font-bold" style="color: #1e3a8a;"><a href="tel:{s['mobile']}" style="text-decoration:none; color:#1e3a8a;">{s['mobile']}</a></td>
        <td class="text-center">{s['tot_stud']}</td>
        <td class="text-center">{s['tot_sec']}</td>
        <td class="text-center font-bold" style="color: #15803d;">{s['sec_entry']}</td>
        <td class="text-center text-danger font-bold">{s['pending_sec']}</td>
        <td class="text-center">{s['app_p']}</td>
        <td class="text-center">{s['web_p']}</td>
        <td class="text-center"><span class="badge-part">शेष {s['pending_sec']}</span></td>
      </tr>"""

    html_content += f"""
    </tbody>
  </table>

  <!-- Official Sign-off Block -->
  <div class="sign-area">
    <div class="sign-box">
      <br><br>
      <div>(हस्ताक्षर एवं मोहर)</div>
      <div style="font-size: 13px; font-weight: 900; margin-top: 3px;">मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</div>
      <div>ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)</div>
    </div>
  </div>

  <div class="page-footer">
    <span>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</span>
    <span>दैनिक शाला दर्पण विद्यार्थी उपस्थिति मॉनिटरिंग | 17-11-2026</span>
    <span>पृष्ठ रिपोर्ट</span>
  </div>

</body>
</html>
"""

    html_out_path = os.path.join(OUTPUT_DIR_2, HTML_FILENAME)
    pdf_out_path_1 = os.path.join(OUTPUT_DIR_1, PDF_FILENAME)
    pdf_out_path_2 = os.path.join(OUTPUT_DIR_2, PDF_FILENAME)

    with open(html_out_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"HTML generated at: {html_out_path}")

    # Generate PDF using Edge headless
    edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = f'"{edge}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="{pdf_out_path_2}" "{html_out_path}"'
    print(f"Running command: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if os.path.exists(pdf_out_path_2) and os.path.getsize(pdf_out_path_2) > 0:
        print(f"PDF generated successfully at {pdf_out_path_2} (Size: {os.path.getsize(pdf_out_path_2)} bytes)")
        shutil.copyfile(pdf_out_path_2, pdf_out_path_1)
        print(f"Copied PDF to census folder: {pdf_out_path_1}")
    else:
        print("PDF generation failed:", res.stderr)

if __name__ == '__main__':
    main()
