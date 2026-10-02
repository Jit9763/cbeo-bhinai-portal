# -*- coding: utf-8 -*-
"""
CBEO Bhinai Portal - VM Notification & Automated Reminder Engine
Executes on GitHub Actions VM at 12:00 PM, 2:00 PM, 4:00 PM, 8:00 PM IST
or on manual workflow dispatch.
MANDATORY RULE: जिला सदैव अजमेर (AJMER) रहेगा। केकड़ी (KEKRI) कदापि प्रयोग न करें।
"""

import os
import sys
import json
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import requests
except ImportError:
    requests = None


def get_current_ist_time():
    # Calculate IST (+5:30)
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    return utc_now.astimezone(ist_tz)


def main():
    ist_time = get_current_ist_time()
    time_str = ist_time.strftime('%d-%m-%Y %I:%M %p')
    print(f"=== CBEO Bhinai VM Engine Started at {time_str} IST ===")

    # 1. Load Master Data & Submissions
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data_path = os.path.join(root_dir, 'master_cbeo_data.json')
    saman_subs_path = os.path.join(root_dir, 'saman_pariksha_submissions.json')

    if not os.path.exists(data_path):
        print(f"ERROR: master_cbeo_data.json not found at {data_path}")
        return

    with open(data_path, 'r', encoding='utf-8') as f:
        master_data = json.load(f)

    schools_57 = master_data.get('schools_56', []) or master_data.get('schools', [])
    demands = master_data.get('demands', [])
    peeos = master_data.get('peeos', [])
    
    # Load Saman Pariksha submissions (Merge from both files)
    saman_subs = dict(master_data.get('saman_pariksha_submissions', {}))
    if os.path.exists(saman_subs_path):
        try:
            with open(saman_subs_path, 'r', encoding='utf-8') as sf:
                saman_subs.update(json.load(sf))
        except Exception as e:
            print("Note reading saman_pariksha_submissions.json:", e)

    print(f"Loaded {len(schools_57)} Secondary/Sr. Secondary Schools, {len(peeos)} PEEOs, {len(saman_subs)} Saman Pariksha Submissions.")

    # 2. SAMAN PARIKSHA 2026-27 COMPLIANCE AUDIT
    total_sp_schools = len(schools_57)
    sp_submitted_schools = []
    sp_pending_schools = []
    sp_peeo_pending_map = {}

    for s in schools_57:
        code = str(s.get('shala_darpan_code', '')).strip()
        peeo_name = s.get('peeo_name', 'PEEO अज्ञात')
        sub = saman_subs.get(code)
        
        is_sub = False
        if sub and (sub.get('is_submitted') is True or bool(sub.get('exam_code')) or (sub.get('grand_total', 0) > 0)):
            is_sub = True

        if is_sub:
            sp_submitted_schools.append({
                'code': code,
                'name': s.get('school_name', ''),
                'peeo': peeo_name,
                'grand_total': sub.get('grand_total', 0),
                'submitted_at': sub.get('submitted_at', '')
            })
        else:
            p_school = {
                'code': code,
                'name': s.get('school_name', ''),
                'peeo': peeo_name,
                'principal': s.get('principal_name', 'संस्था प्रधान'),
                'mobile': s.get('principal_mobile') or s.get('mobile') or ''
            }
            sp_pending_schools.append(p_school)
            sp_peeo_pending_map[peeo_name] = sp_peeo_pending_map.get(peeo_name, 0) + 1

    sp_sub_count = len(sp_submitted_schools)
    sp_pend_count = len(sp_pending_schools)
    sp_percent = round((sp_sub_count / total_sp_schools * 100), 1) if total_sp_schools > 0 else 0.0

    print(f"Saman Pariksha: Total={total_sp_schools}, Submitted={sp_sub_count} ({sp_percent}%), Pending={sp_pend_count}")

    # 3. Compile Master Report in Markdown
    report_lines = []
    report_lines.append(f"# 🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)")
    report_lines.append(f"### 🤖 GitHub Cloud VM स्वचालित अनुपालन व लंबित रिपोर्ट (Automated Compliance Report)")
    report_lines.append(f"**सत्यापन दिनांक व समय:** {time_str} IST | **जिला:** अजमेर (AJMER) | **ब्लॉक:** भिनाय (BHINAI)\n")
    report_lines.append(f"---\n")

    # Section A: Saman Pariksha 2026-27
    report_lines.append(f"## 📋 1. जिला समान परीक्षा योजना (सत्र 2026-27) - लंबित स्थिति")
    report_lines.append(f"| कुल लक्षित विद्यालय | प्रपत्र प्राप्त संख्या | कुल लंबित विद्यालय | संकलन प्रगति |")
    report_lines.append(f"| :---: | :---: | :---: | :---: |")
    report_lines.append(f"| **{total_sp_schools}** | **{sp_sub_count}** | <span style='color:red'>**{sp_pend_count}**</span> | **{sp_percent}%** |\n")

    # PEEO-wise Pending Breakdown
    if sp_peeo_pending_map:
        report_lines.append(f"### 📍 PEEO परिक्षेत्रवार लंबित विद्यालय संख्या:")
        report_lines.append(f"| क्र.सं. | PEEO परिक्षेत्र | लंबित विद्यालय संख्या |")
        report_lines.append(f"| :---: | :--- | :---: |")
        for p_idx, (p_name, count) in enumerate(sorted(sp_peeo_pending_map.items(), key=lambda x: x[1], reverse=True)):
            report_lines.append(f"| {p_idx + 1} | **{p_name}** | **{count} स्कूल लंबित** |")
        report_lines.append("")

    # Full list of pending schools with contact mobile
    report_lines.append(f"### 🚨 समान परीक्षा 2026-27 के समस्त {sp_pend_count} लंबित विद्यालयों की सूची:")
    report_lines.append(f"| क्र. | शा.दा. कोड | विद्यालय का नाम | संबंधित PEEO | संस्था प्रधान | मोबाइल नंबर |")
    report_lines.append(f"| :---: | :---: | :--- | :--- | :--- | :---: |")
    for s_idx, ps in enumerate(sp_pending_schools):
        report_lines.append(f"| {s_idx + 1} | `{ps['code']}` | {ps['name']} | {ps['peeo']} | {ps['principal']} | {ps['mobile']} |")
    report_lines.append("\n---\n")

    # Section B: Active Universal Dynamic Demands
    active_demands = [d for d in demands if not d.get('archived')]
    report_lines.append(f"## 📊 2. सक्रिय सूचना मांगें (Universal Demands Compliance)")

    if not active_demands:
        report_lines.append("✓ वर्तमान में कोई अन्य सक्रिय मांग प्रपत्र लंबित नहीं है।\n")
    else:
        for d in active_demands:
            title = d.get('title', 'सूचना')
            due_date = d.get('dueDate', 'यथाशीघ्र')
            priority = d.get('priority', 'सामान्य')
            cols_count = len(d.get('columns', []))
            report_lines.append(f"### 📌 {title}")
            report_lines.append(f"- **प्राथमिकता:** {priority} | **अंतिम तिथि:** {due_date} | **कॉलम:** {cols_count} | **स्तर:** {d.get('collectionLevel', 'peeo').upper()}")
        report_lines.append("")

    report_lines.append(f"🌐 **आधिकारिक सत्यापन पोर्टल:** [https://jit9763.github.io/cbeo-bhinai-portal/](https://jit9763.github.io/cbeo-bhinai-portal/)\n")
    report_lines.append(f"*(नोट: यह रिपोर्ट GitHub Actions Ubuntu Linux Virtual Machine द्वारा पूर्णतः स्वचालित रूप से संकलित एवं प्रकाशित की गई है)*\n")

    report_content = "\n".join(report_lines)

    # 4. Save latest report markdown
    report_file = os.path.join(root_dir, 'scripts', 'latest_report.md')
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_content)
    print(f"Saved latest report to {report_file}")

    # 5. Generate Live JSON Status for Portal Website Integration
    live_status = {
        "generated_at": time_str,
        "vm_status": "ONLINE_ACTIVE",
        "district": "AJMER (अजमेर)",
        "block": "BHINAI (भिनाय)",
        "saman_pariksha": {
            "total_schools": total_sp_schools,
            "submitted_count": sp_sub_count,
            "pending_count": sp_pend_count,
            "completion_percentage": sp_percent,
            "peeo_pending_map": sp_peeo_pending_map,
            "pending_schools": sp_pending_schools[:15]  # first 15 for quick widget
        },
        "active_demands_count": len(active_demands),
        "portal_url": "https://jit9763.github.io/cbeo-bhinai-portal/"
    }

    json_file = os.path.join(root_dir, 'cbeo_vm_live_status.json')
    with open(json_file, 'w', encoding='utf-8') as jf:
        json.dump(live_status, jf, indent=2, ensure_ascii=False)
    print(f"Saved live JSON status to {json_file}")

    # GitHub Actions Step Summary
    summary_file = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_file:
        with open(summary_file, 'a', encoding='utf-8') as f:
            f.write(report_content)

    # 6. Optional: Ping Master Backup Apps Script to record audit log
    backup_gas_url = "https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec"
    if requests:
        try:
            print("Syncing VM run audit log to Google Drive Master Backup sheet...")
            payload = {
                "action": "log_audit",
                "user": "GitHub Actions Ubuntu VM",
                "action_name": "स्वचालित लंबित रिपोर्टिंग (VM Scheduled)",
                "target": f"समान परीक्षा: {sp_pend_count} लंबित, {sp_sub_count} पूर्ण",
                "details": f"दैनिक चक्र: {time_str} IST | जिला: अजमेर"
            }
            res = requests.post(backup_gas_url, data=json.dumps(payload), headers={'Content-Type': 'text/plain;charset=utf-8'}, timeout=10)
            print(f"GAS Audit Log Response: {res.status_code}")
        except Exception as e:
            print("Note on GAS audit log:", e)

    print("=== CBEO Bhinai VM Engine Execution Completed Successfully ===")


if __name__ == '__main__':
    main()
