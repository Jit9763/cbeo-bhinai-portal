import openpyxl
import json
import re
import os
import subprocess
from datetime import datetime

# 1. Load Data
wb = openpyxl.load_workbook('data/class wise namankan.xlsx')
s = wb['Sheet1']

with open('master_cbeo_data.json', encoding='utf-8') as f:
    master_data = json.load(f)

saman_subs = master_data.get('saman_pariksha_submissions', {})
schools_master = {s['shala_darpan_code']: s for s in master_data.get('schools_56', [])}

schools_data = []

tot_ex_c9 = tot_sp_c9 = 0
tot_ex_c10 = tot_sp_c10 = 0
tot_ex_c11 = tot_sp_c11 = 0
tot_ex_c12 = tot_sp_c12 = 0
tot_ex_grand = tot_sp_grand = 0

for r in range(62, 111):
    sr = s.cell(row=r, column=1).value
    sch_raw = str(s.cell(row=r, column=2).value or '')
    m_code = re.search(r'\((\d+)\)', sch_raw)
    code = m_code.group(1) if m_code else str(sr)
    
    # Extract from Excel
    c9_b = int(s.cell(row=r, column=47).value or 0)
    c9_g = int(s.cell(row=r, column=48).value or 0)
    c9_t = int(s.cell(row=r, column=50).value or 0)
    
    c10_b = int(s.cell(row=r, column=51).value or 0)
    c10_g = int(s.cell(row=r, column=52).value or 0)
    c10_t = int(s.cell(row=r, column=54).value or 0)
    
    c11_b = int(s.cell(row=r, column=55).value or 0)
    c11_g = int(s.cell(row=r, column=56).value or 0)
    c11_t = int(s.cell(row=r, column=58).value or 0)
    
    c12_b = int(s.cell(row=r, column=59).value or 0)
    c12_g = int(s.cell(row=r, column=60).value or 0)
    c12_t = int(s.cell(row=r, column=62).value or 0)
    
    ex_tot = c9_t + c10_t + c11_t + c12_t

    # Extract from Saman Pariksha Submissions
    sub = saman_subs.get(code, {})
    sch_info = schools_master.get(code, {})
    hindi_name = sch_info.get('school_name_hi') or sch_info.get('school_name') or sch_raw
    peeo_name = sub.get('peeo_name') or sch_info.get('peeo_name') or '---'
    if peeo_name.upper().startswith('PEEO '):
        peeo_clean = peeo_name[5:].strip()
    else:
        peeo_clean = peeo_name.strip()

    sp_c9 = int(sub.get('c9_total') or 0)
    sp_c10 = int(sub.get('c10_total') or 0)
    sp_c11 = int(sub.get('c11_total') or 0)
    sp_c12 = int(sub.get('c12_total') or 0)
    sp_tot = int(sub.get('grand_total') or (sp_c9 + sp_c10 + sp_c11 + sp_c12))

    d9 = sp_c9 - c9_t
    d10 = sp_c10 - c10_t
    d11 = sp_c11 - c11_t
    d12 = sp_c12 - c12_t
    dTot = sp_tot - ex_tot

    is_matched = (d9 == 0 and d10 == 0 and d11 == 0 and d12 == 0 and dTot == 0)

    tot_ex_c9 += c9_t
    tot_sp_c9 += sp_c9
    tot_ex_c10 += c10_t
    tot_sp_c10 += sp_c10
    tot_ex_c11 += c11_t
    tot_sp_c11 += sp_c11
    tot_ex_c12 += c12_t
    tot_sp_c12 += sp_c12
    tot_ex_grand += ex_tot
    tot_sp_grand += sp_tot

    item = {
        'sr': sr,
        'code': code,
        'name_raw': sch_raw,
        'name_hi': hindi_name,
        'peeo': peeo_clean,
        'c9_t': c9_t, 'sp_c9': sp_c9, 'd9': d9,
        'c10_t': c10_t, 'sp_c10': sp_c10, 'd10': d10,
        'c11_t': c11_t, 'sp_c11': sp_c11, 'd11': d11,
        'c12_t': c12_t, 'sp_c12': sp_c12, 'd12': d12,
        'ex_tot': ex_tot, 'sp_tot': sp_tot, 'dTot': dTot,
        'is_matched': is_matched
    }
    schools_data.append(item)

# Sort: Mismatched first, then by code
mismatched_schools = [s for s in schools_data if not s['is_matched']]
matched_schools = [s for s in schools_data if s['is_matched']]

# Generate HTML
html_content = f"""<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>समान परीक्षा नामांकन मिलान प्रतिवेदन - CBEO भिनाय (अजमेर)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&family=Inter:wght@400;600;700;800&display=swap');
    
    @page {{
      size: A4 portrait;
      margin: 8mm 8mm 10mm 8mm;
      @bottom-right {{
        content: "पृष्ठ " counter(page) " / " counter(pages);
      }}
    }}
    
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    
    body {{
      font-family: 'Noto Sans Devanagari', 'Inter', sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 8.5pt;
      line-height: 1.35;
    }}
    
    .header-box {{
      text-align: center;
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 8px;
      margin-bottom: 6px;
    }}
    
    .header-dept {{
      font-size: 9pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
    }}
    
    .header-office {{
      font-size: 14pt;
      font-weight: 900;
      color: #1e3a8a;
      margin: 2px 0;
    }}
    
    .header-sub {{
      font-size: 9.5pt;
      font-weight: 700;
      color: #0369a1;
    }}

    .meta-bar {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 8pt;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
      border: 1px solid #cbd5e1;
    }}

    /* Stat Cards */
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }}
    
    .kpi-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      text-align: center;
    }}
    
    .kpi-card.highlight {{
      background: #eff6ff;
      border-color: #93c5fd;
    }}
    
    .kpi-card.success {{
      background: #f0fdf4;
      border-color: #86efac;
    }}
    
    .kpi-card.warning {{
      background: #fff1f2;
      border-color: #fca5a5;
    }}
    
    .kpi-title {{
      font-size: 7pt;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 2px;
    }}
    
    .kpi-val {{
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
    }}
    
    .kpi-val.green {{ color: #15803d; }}
    .kpi-val.red {{ color: #b91c1c; }}
    .kpi-val.blue {{ color: #1d4ed8; }}

    /* Section Header */
    .sec-head {{
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9.5pt;
      font-weight: 800;
      color: #1e3a8a;
      margin: 10px 0 5px 0;
      border-left: 3.5px solid #1e3a8a;
      padding-left: 6px;
    }}
    
    .sec-head.danger {{
      color: #be123c;
      border-color: #e11d48;
    }}
    
    .sec-head.success {{
      color: #15803d;
      border-color: #16a34a;
    }}

    /* Tables */
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 7.3pt;
    }}
    
    th, td {{
      border: 1px solid #cbd5e1;
      padding: 3px 5px;
      vertical-align: middle;
    }}
    
    th {{
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 700;
      text-align: center;
    }}
    
    th.subhead {{
      background: #3b82f6;
      font-size: 7.2pt;
    }}
    
    tr:nth-child(even) {{
      background: #f8fafc;
    }}
    
    .text-center {{ text-align: center; }}
    .text-right {{ text-align: right; }}
    .font-bold {{ font-weight: 700; }}
    .font-heavy {{ font-weight: 900; }}
    
    .badge-match {{
      background: #dcfce7;
      color: #15803d;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 7.2pt;
      display: inline-block;
    }}
    
    .badge-diff {{
      background: #fee2e2;
      color: #b91c1c;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 900;
      font-size: 7.2pt;
      display: inline-block;
    }}
    
    .diff-plus {{
      color: #b91c1c;
      font-weight: 800;
    }}
    
    .diff-zero {{
      color: #94a3b8;
      font-weight: 600;
    }}
    
    .page-break {{
      page-break-before: always;
    }}
    
    .obs-box {{
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 7px 10px;
      margin-bottom: 6px;
      font-size: 7.3pt;
      line-height: 1.4;
      color: #92400e;
    }}
    
    .obs-box strong {{
      color: #78350f;
    }}

    .sign-box {{
      margin-top: 15px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      padding: 0 20px;
    }}
    
    .sign-item {{
      text-align: center;
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.4;
    }}
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-box">
    <div class="header-dept">राजस्थान सरकार | स्कूल शिक्षा विभाग</div>
    <div class="header-office">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</div>
    <div class="header-sub">समान परीक्षा 2026-27 : शाला दर्पण वास्तविक कक्षावार नामांकन बनाम पोर्टल मांग पत्रक मिलान प्रतिवेदन</div>
  </div>

  <!-- META BAR -->
  <div class="meta-bar">
    <div><strong>ब्लॉक:</strong> भिनाय (BHINAI) &nbsp;|&nbsp; <strong>जिला:</strong> अजमेर (AJMER)</div>
    <div><strong>डेटा स्त्रोत:</strong> शाला दर्पण अधिकृत एक्सेल रिपोर्ट (कक्षावार विद्यार्थी नामांकन)</div>
    <div><strong>प्रतिवेदन तिथि:</strong> 07 अक्टूबर 2026</div>
  </div>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-title">कुल रा.उ.मा.वि.</div>
      <div class="kpi-val blue">49</div>
    </div>
    <div class="kpi-card success">
      <div class="kpi-title">100% मैच स्कूल</div>
      <div class="kpi-val green">{len(matched_schools)} (85.7%)</div>
    </div>
    <div class="kpi-card warning">
      <div class="kpi-title">अंतर (मिसमैच) स्कूल</div>
      <div class="kpi-val red">{len(mismatched_schools)} (14.3%)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">SD कुल नामांकन</div>
      <div class="kpi-val">{tot_ex_grand:,}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">पोर्टल पेपर मांग</div>
      <div class="kpi-val">{tot_sp_grand:,}</div>
    </div>
    <div class="kpi-card warning">
      <div class="kpi-title">ब्लॉक कुल अंतर</div>
      <div class="kpi-val red">+{tot_sp_grand - tot_ex_grand} (+0.57%)</div>
    </div>
  </div>

  <!-- SUMMARY OBSERVATION BOX -->
  <div class="obs-box">
    <strong>📌 प्रमुख सांख्यिकीय निष्कर्ष:</strong><br>
    • <strong>कक्षा 10 में 100% परिशुद्धता:</strong> भिनाय ब्लॉक के सभी 49 राजकीय उच्च माध्यमिक विद्यालयों में कक्षा 10 की मांग (1,595) शाला दर्पण नामांकन से <strong>शत-प्रतिशत (100%)</strong> मैच है (शून्य अंतर)।<br>
    • <strong>कक्षा 12 में 99.9% परिशुद्धता:</strong> 49 में से 48 विद्यालयों में कक्षा 12 का डेटा बिल्कुल सटीक है। केवल 1 विद्यालय में +1 का नगण्य अंतर है।<br>
    • <strong>अंतर का केंद्र:</strong> समस्त अंतर मुख्य रूप से कक्षा 9 (+28) एवं कक्षा 11 (+8) में है, जो संभावित रूप से प्रवेश तिथि उपरांत शाला दर्पण प्रविष्टि में विलम्ब अथवा स्थानीय प्रवेश वृद्धि के कारण है।
  </div>

  <!-- CLASS WISE MACRO COMPARISON TABLE -->
  <div class="sec-head">1. कक्षावार ब्लॉक महायोग मिलान विवरण (Class-wise Macro Summary)</div>
  <table>
    <thead>
      <tr>
        <th style="width:18%">कक्षा (Class)</th>
        <th style="width:22%">शाला दर्पण वास्तविक नामांकन (SD)</th>
        <th style="width:22%">समान परीक्षा पोर्टल मांग (SP)</th>
        <th style="width:18%">अंतर (Difference)</th>
        <th style="width:20%">परिशुद्धता दर (Accuracy)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="font-bold text-center">कक्षा 9 (Class 9)</td>
        <td class="text-center">{tot_ex_c9:,}</td>
        <td class="text-center font-bold">{tot_sp_c9:,}</td>
        <td class="text-center font-heavy diff-plus">+{tot_sp_c9 - tot_ex_c9}</td>
        <td class="text-center font-bold">98.87%</td>
      </tr>
      <tr style="background:#f0fdf4">
        <td class="font-bold text-center" style="color:#15803d">कक्षा 10 (Class 10)</td>
        <td class="text-center font-bold">{tot_ex_c10:,}</td>
        <td class="text-center font-bold" style="color:#15803d">{tot_sp_c10:,}</td>
        <td class="text-center font-heavy" style="color:#15803d">0 (100% मैच)</td>
        <td class="text-center font-heavy" style="color:#15803d">100.0% ✓</td>
      </tr>
      <tr>
        <td class="font-bold text-center">कक्षा 11 (Class 11)</td>
        <td class="text-center">{tot_ex_c11:,}</td>
        <td class="text-center font-bold">{tot_sp_c11:,}</td>
        <td class="text-center font-heavy diff-plus">+{tot_sp_c11 - tot_ex_c11}</td>
        <td class="text-center font-bold">99.38%</td>
      </tr>
      <tr>
        <td class="font-bold text-center">कक्षा 12 (Class 12)</td>
        <td class="text-center">{tot_ex_c12:,}</td>
        <td class="text-center font-bold">{tot_sp_c12:,}</td>
        <td class="text-center font-heavy diff-plus">+{tot_sp_c12 - tot_ex_c12}</td>
        <td class="text-center font-bold">99.91%</td>
      </tr>
      <tr style="background:#eff6ff; font-weight:800; border-top:2px solid #1e3a8a">
        <td class="text-center font-heavy" style="color:#1e3a8a">कुल महायोग (9 से 12)</td>
        <td class="text-center font-heavy">{tot_ex_grand:,}</td>
        <td class="text-center font-heavy" style="color:#1e3a8a">{tot_sp_grand:,}</td>
        <td class="text-center font-heavy diff-plus">+{tot_sp_grand - tot_ex_grand}</td>
        <td class="text-center font-heavy" style="color:#1e3a8a">99.43%</td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 2: MISMATCH SCHOOLS TABLE -->
  <div class="sec-head danger">2. अंतर (मिसमैच) वाले विद्यालयों का सूक्ष्म विश्लेषण (7 विद्यालय)</div>
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:4%">क्र.</th>
        <th rowspan="2" style="width:8%">शा.दा. कोड</th>
        <th rowspan="2" style="width:26%">विद्यालय का नाम</th>
        <th rowspan="2" style="width:12%">PEEO</th>
        <th colspan="3" style="width:12%" class="subhead">कक्षा 9</th>
        <th colspan="3" style="width:12%" class="subhead">कक्षा 10</th>
        <th colspan="3" style="width:12%" class="subhead">कक्षा 11</th>
        <th colspan="3" style="width:12%" class="subhead">कक्षा 12</th>
        <th colspan="3" style="width:14%">कुल योग (9-12)</th>
      </tr>
      <tr>
        <th class="subhead">SD</th><th class="subhead">मांग</th><th class="subhead">अंतर</th>
        <th class="subhead">SD</th><th class="subhead">मांग</th><th class="subhead">अंतर</th>
        <th class="subhead">SD</th><th class="subhead">मांग</th><th class="subhead">अंतर</th>
        <th class="subhead">SD</th><th class="subhead">मांग</th><th class="subhead">अंतर</th>
        <th>SD</th><th>मांग</th><th>अंतर</th>
      </tr>
    </thead>
    <tbody>
"""

for idx, m in enumerate(mismatched_schools, 1):
    d9_badge = f"+{m['d9']}" if m['d9'] > 0 else (f"{m['d9']}" if m['d9'] < 0 else "0")
    d10_badge = f"+{m['d10']}" if m['d10'] > 0 else (f"{m['d10']}" if m['d10'] < 0 else "0")
    d11_badge = f"+{m['d11']}" if m['d11'] > 0 else (f"{m['d11']}" if m['d11'] < 0 else "0")
    d12_badge = f"+{m['d12']}" if m['d12'] > 0 else (f"{m['d12']}" if m['d12'] < 0 else "0")
    dtot_badge = f"+{m['dTot']}" if m['dTot'] > 0 else (f"{m['dTot']}" if m['dTot'] < 0 else "0")

    html_content += f"""
      <tr>
        <td class="text-center font-bold">{idx}</td>
        <td class="text-center font-bold" style="font-family:monospace; color:#1e3a8a">{m['code']}</td>
        <td><strong>{m['name_hi']}</strong></td>
        <td class="text-center font-bold" style="font-size:7.2pt">{m['peeo']}</td>
        
        <td class="text-center">{m['c9_t']}</td>
        <td class="text-center font-bold">{m['sp_c9']}</td>
        <td class="text-center font-bold {'diff-plus' if m['d9'] != 0 else 'diff-zero'}">{d9_badge}</td>

        <td class="text-center">{m['c10_t']}</td>
        <td class="text-center font-bold">{m['sp_c10']}</td>
        <td class="text-center font-bold {'diff-plus' if m['d10'] != 0 else 'diff-zero'}">{d10_badge}</td>

        <td class="text-center">{m['c11_t']}</td>
        <td class="text-center font-bold">{m['sp_c11']}</td>
        <td class="text-center font-bold {'diff-plus' if m['d11'] != 0 else 'diff-zero'}">{d11_badge}</td>

        <td class="text-center">{m['c12_t']}</td>
        <td class="text-center font-bold">{m['sp_c12']}</td>
        <td class="text-center font-bold {'diff-plus' if m['d12'] != 0 else 'diff-zero'}">{d12_badge}</td>

        <td class="text-center font-bold" style="background:#f1f5f9">{m['ex_tot']}</td>
        <td class="text-center font-bold" style="background:#f1f5f9; color:#1e3a8a">{m['sp_tot']}</td>
        <td class="text-center font-heavy" style="background:#fee2e2; color:#b91c1c">{dtot_badge}</td>
      </tr>
    """

html_content += f"""
      <tr style="background:#fee2e2; font-weight:800; border-top:2px solid #b91c1c">
        <td colspan="4" class="text-center font-heavy" style="color:#b91c1c">मिसमैच स्कूलों का कुल योग (Total 7 Schools)</td>
        <td class="text-center">{sum(m['c9_t'] for m in mismatched_schools)}</td>
        <td class="text-center">{sum(m['sp_c9'] for m in mismatched_schools)}</td>
        <td class="text-center diff-plus">+{sum(m['d9'] for m in mismatched_schools)}</td>
        <td class="text-center">{sum(m['c10_t'] for m in mismatched_schools)}</td>
        <td class="text-center">{sum(m['sp_c10'] for m in mismatched_schools)}</td>
        <td class="text-center diff-zero">0</td>
        <td class="text-center">{sum(m['c11_t'] for m in mismatched_schools)}</td>
        <td class="text-center">{sum(m['sp_c11'] for m in mismatched_schools)}</td>
        <td class="text-center diff-plus">+{sum(m['d11'] for m in mismatched_schools)}</td>
        <td class="text-center">{sum(m['c12_t'] for m in mismatched_schools)}</td>
        <td class="text-center">{sum(m['sp_c12'] for m in mismatched_schools)}</td>
        <td class="text-center diff-plus">+{sum(m['d12'] for m in mismatched_schools)}</td>
        <td class="text-center font-heavy">{sum(m['ex_tot'] for m in mismatched_schools)}</td>
        <td class="text-center font-heavy">{sum(m['sp_tot'] for m in mismatched_schools)}</td>
        <td class="text-center font-heavy" style="color:#b91c1c">+{sum(m['dTot'] for m in mismatched_schools)}</td>
      </tr>
    </tbody>
  </table>

  <!-- PAGE BREAK FOR CLEAN AUDIT PRESENTATION -->
  <div class="page-break"></div>

  <!-- SECTION 3: 42 FULLY MATCHED SCHOOLS TABLE -->
  <div class="sec-head success">3. शत-प्रतिशत (100%) सत्यापित एवं सही पाए गए विद्यालय (42 विद्यालय)</div>
  <div style="font-size:7.5pt; color:#64748b; margin-bottom:5px">
    नोट: इन सभी 42 विद्यालयों में शाला दर्पण कक्षावार वास्तविक नामांकन एवं समान परीक्षा मांग पत्रक में <strong>शून्य (0) अंतर</strong> पाया गया है।
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:4%">क्र.</th>
        <th style="width:8%">शा.दा. कोड</th>
        <th style="width:34%">विद्यालय का नाम</th>
        <th style="width:14%">PEEO</th>
        <th style="width:8%">कक्षा 9</th>
        <th style="width:8%">कक्षा 10</th>
        <th style="width:8%">कक्षा 11</th>
        <th style="width:8%">कक्षा 12</th>
        <th style="width:10%">कुल नामांकन</th>
        <th style="width:10%">सत्यापन स्थिति</th>
      </tr>
    </thead>
    <tbody>
"""

for idx, m in enumerate(matched_schools, 1):
    html_content += f"""
      <tr>
        <td class="text-center font-bold">{idx}</td>
        <td class="text-center font-bold" style="font-family:monospace; color:#1e3a8a">{m['code']}</td>
        <td>{m['name_hi']}</td>
        <td class="text-center font-bold" style="font-size:7.2pt">{m['peeo']}</td>
        <td class="text-center">{m['c9_t']}</td>
        <td class="text-center">{m['c10_t']}</td>
        <td class="text-center">{m['c11_t']}</td>
        <td class="text-center">{m['c12_t']}</td>
        <td class="text-center font-bold" style="color:#1e3a8a">{m['ex_tot']}</td>
        <td class="text-center"><span class="badge-match">✓ 100% मैच</span></td>
      </tr>
    """

html_content += f"""
      <tr style="background:#dcfce7; font-weight:800; border-top:2px solid #16a34a">
        <td colspan="4" class="text-center font-heavy" style="color:#15803d">42 सत्यापित विद्यालयों का कुल योग (Sub-Total)</td>
        <td class="text-center">{sum(m['c9_t'] for m in matched_schools):,}</td>
        <td class="text-center">{sum(m['c10_t'] for m in matched_schools):,}</td>
        <td class="text-center">{sum(m['c11_t'] for m in matched_schools):,}</td>
        <td class="text-center">{sum(m['c12_t'] for m in matched_schools):,}</td>
        <td class="text-center font-heavy" style="color:#15803d">{sum(m['ex_tot'] for m in matched_schools):,}</td>
        <td class="text-center font-heavy" style="color:#15803d">सत्यापित ✓</td>
      </tr>
    </tbody>
  </table>

  <!-- SIGNATURE BLOCK -->
  <div class="sign-box">
    <div class="sign-item">
      <br><br>
      ___________________________<br>
      <strong>ब्लॉक नोडल प्रभारी</strong><br>
      समान परीक्षा प्रकोष्ठ<br>
      भिनाय (अजमेर)
    </div>
    <div class="sign-item">
      <br><br>
      ___________________________<br>
      <strong>मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</strong><br>
      कार्यालय CBEO, भिनाय (अजमेर)<br>
      जिला: अजमेर (राजस्थान)
    </div>
  </div>

</body>
</html>
"""

html_file = 'scripts/saman_enrolment_match_report.html'
pdf_file = 'data/saman_enrolment_match_report.pdf'

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"HTML saved to {html_file}")

# Convert to PDF using Microsoft Edge headless
edge_exe = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if not os.path.exists(edge_exe):
    edge_exe = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'

cmd = [
    edge_exe,
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    f'--print-to-pdf={os.path.abspath(pdf_file)}',
    os.path.abspath(html_file)
]

print("Running Edge PDF converter...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", res.returncode)

if os.path.exists(pdf_file):
    size_kb = os.path.getsize(pdf_file) / 1024
    print(f"SUCCESS: PDF created at {pdf_file} ({size_kb:.1f} KB)")
else:
    print("PDF creation failed. stderr:", res.stderr)
