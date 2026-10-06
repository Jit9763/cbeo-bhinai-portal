# -*- coding: utf-8 -*-
"""
CBEO Bhinai Portal - VM Notification & Automated Reminder Engine
Executes on GitHub Actions VM at 12:07 PM, 2:07 PM, 4:07 PM, 8:07 PM IST
or on manual workflow dispatch.
MANDATORY RULE: जिला सदैव अजमेर (AJMER) रहेगा। केकड़ी (KEKRI) कदापि प्रयोग न करें।
"""

import os
import sys
import re
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
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    return utc_now.astimezone(ist_tz)


def calculate_school_syllabus_avg(sub):
    if not sub:
        return 0
    if sub.get('average_pct') is not None:
        try:
            return round(float(sub['average_pct']))
        except (ValueError, TypeError):
            pass

    total_pct = 0.0
    count = 0
    # Class 9 & 10
    for c_key in ['c9', 'c10']:
        c_obj = sub.get(c_key)
        if isinstance(c_obj, dict) and not c_obj.get('zero_enrolment'):
            for sub_name in ['hindi', 'english', 'maths', 'science', 'sst', 'sanskrit', 'urdu']:
                try:
                    val = float(c_obj.get(sub_name, 0))
                    if val > 0:
                        total_pct += val
                        count += 1
                except (ValueError, TypeError):
                    pass

    # Class 11 & 12
    for c_key in ['c11', 'c12']:
        c_obj = sub.get(c_key)
        if isinstance(c_obj, dict) and not c_obj.get('zero_enrolment'):
            for comp in ['comp_hindi', 'comp_english']:
                try:
                    val = float(c_obj.get(comp, 0))
                    if val > 0:
                        total_pct += val
                        count += 1
                except (ValueError, TypeError):
                    pass
            electives = c_obj.get('electives', [])
            if isinstance(electives, list):
                for el in electives:
                    if isinstance(el, dict):
                        try:
                            val = float(el.get('pct', 0))
                            if val > 0:
                                total_pct += val
                                count += 1
                        except (ValueError, TypeError):
                            pass

    return round(total_pct / count) if count > 0 else 0


def main():
    ist_time = get_current_ist_time()
    time_str = ist_time.strftime('%d-%m-%Y %I:%M %p')
    print(f"=== CBEO Bhinai VM Engine Started at {time_str} IST ===")

    # 1. Load Master Data & VM Settings
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data_path = os.path.join(root_dir, 'master_cbeo_data.json')
    saman_subs_path = os.path.join(root_dir, 'saman_pariksha_submissions.json')
    saman_syllabus_subs_path = os.path.join(root_dir, 'saman_syllabus_submissions.json')
    settings_file = os.path.join(root_dir, 'cbeo_vm_settings.json')

    vm_settings = {
        'vm_enabled': True,
        'telegram_alerts': True,
        'email_alerts': True,
        'overdue_escalation': True,
        'mdm_anomaly_scanner': False,
        'active_focus_report': '49_syllabus',
        'slots': ['12:07 PM', '02:07 PM', '04:07 PM', '08:07 PM']
    }
    if os.path.exists(settings_file):
        try:
            with open(settings_file, 'r', encoding='utf-8') as sf:
                vm_settings.update(json.load(sf))
        except Exception as e:
            print("Note reading cbeo_vm_settings.json:", e)

    local_custom_message = vm_settings.get('dispatch_config', {}).get('custom_message', '').strip()

    # 1B. DIRECT REAL-TIME LIVE SYNC FROM GOOGLE DRIVE (GOOGLE APPS SCRIPT WEB APP)
    gas_backend_url = "https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec"
    if requests:
        try:
            print("[CBEO-VM] 🔄 Fetching live settings from Google Drive Sheet...")
            auth_resp = requests.get(f"{gas_backend_url}?action=getAuth&_nocache={int(datetime.datetime.now().timestamp())}", timeout=15)
            if auth_resp.status_code == 200:
                auth_json = auth_resp.json()
                users = auth_json.get('users', {})
                if '__PORTAL_SETTINGS__' in users:
                    raw_ps = users['__PORTAL_SETTINGS__']
                    pwd = raw_ps.get('password') if isinstance(raw_ps, dict) else raw_ps
                    ps = json.loads(pwd) if isinstance(pwd, str) else pwd
                    if isinstance(ps, dict):
                        if 'vm_settings' in ps and isinstance(ps['vm_settings'], dict):
                            vm_settings.update(ps['vm_settings'])
                            print("[CBEO-VM] ✓ Live VM Settings synced from Jitendra Admin Portal:", ps['vm_settings'])
                        if 'vm_dispatch_config' in ps and isinstance(ps['vm_dispatch_config'], dict):
                            cloud_disp = ps['vm_dispatch_config']
                            if not (cloud_disp.get('custom_message') or '').strip() and local_custom_message:
                                cloud_disp['custom_message'] = local_custom_message
                            if 'dispatch_config' not in vm_settings:
                                vm_settings['dispatch_config'] = {}
                            vm_settings['dispatch_config'].update(cloud_disp)
                            print("[CBEO-VM] ✓ Live VM Dispatch Config merged:", vm_settings['dispatch_config'].get('custom_message'))
                        elif local_custom_message:
                            if 'dispatch_config' not in vm_settings:
                                vm_settings['dispatch_config'] = {}
                            vm_settings['dispatch_config']['custom_message'] = local_custom_message
                        if 'gemini_api_key' in ps and ps['gemini_api_key']:
                            vm_settings['gemini_api_key'] = ps['gemini_api_key']
        except Exception as ge:
            print(f"[CBEO-VM] Note on Live Settings Sync: {ge}")

    # Check if VM is disabled by Jitendra Admin
    action_type = os.environ.get('ACTION_TYPE', 'all').lower()
    is_manual = action_type in ['manual', 'force'] or (len(sys.argv) > 1 and sys.argv[1] == '--force')

    if not vm_settings.get('vm_enabled', True) and not is_manual:
        print("[CBEO-VM] 🛑 VM Automation is currently turned OFF by Jitendra Admin. Exiting safely.")
        return

    if not os.path.exists(data_path):
        print(f"ERROR: master_cbeo_data.json not found at {data_path}")
        return

    with open(data_path, 'r', encoding='utf-8') as f:
        master_data = json.load(f)

    schools_57 = master_data.get('schools_56', []) or master_data.get('schools', [])
    demands = master_data.get('demands', [])
    peeos = master_data.get('peeos', [])

    # Filter 49 Govt Schools strictly
    govt_schools_49 = [s for s in schools_57 if s.get('type') == 'Government']
    if not govt_schools_49:
        govt_schools_49 = schools_57[:49]

    # Load 1: Saman Pariksha Indent submissions
    saman_subs = dict(master_data.get('saman_pariksha_submissions', {}))
    if os.path.exists(saman_subs_path):
        try:
            with open(saman_subs_path, 'r', encoding='utf-8') as sf:
                saman_subs.update(json.load(sf))
        except Exception as e:
            print("Note reading saman_pariksha_submissions.json:", e)

    # Load 2: Saman Syllabus 2026 submissions (49 Govt Schools)
    syllabus_subs = dict(master_data.get('saman_syllabus_submissions', {}))
    if os.path.exists(saman_syllabus_subs_path):
        try:
            with open(saman_syllabus_subs_path, 'r', encoding='utf-8') as sf:
                syllabus_subs.update(json.load(sf))
        except Exception as e:
            print("Note reading saman_syllabus_submissions.json:", e)

    # Fetch live submissions from Google Apps Script if reachable
    if requests:
        try:
            live_resp = requests.get(f"{gas_backend_url}?action=getAll", timeout=20)
            if live_resp.status_code == 200:
                live_json = live_resp.json()
                if live_json.get('success') and live_json.get('submissions'):
                    live_subs = live_json['submissions']
                    saman_subs.update(live_subs)
                    print(f"[CBEO-VM] ✓ Live Google Drive Sync SUCCESS: Fetched {len(live_subs)} indent submissions directly from Sheet!")
                    try:
                        with open(saman_subs_path, 'w', encoding='utf-8') as sf:
                            json.dump(saman_subs, sf, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
        except Exception as e:
            print(f"[CBEO-VM] Note on Indent Submissions sync: {e}")

        # Fetch syllabus submissions from GAS
        try:
            syl_url = f"{gas_backend_url}?action=getDemandSubmissions&demand_id=DEMAND_SAMAN_SYLLABUS_2026&_t={int(datetime.datetime.now().timestamp())}"
            syl_resp = requests.get(syl_url, timeout=20)
            if syl_resp.status_code == 200:
                syl_json = syl_resp.json()
                if syl_json.get('success') and syl_json.get('submissions'):
                    raw_syl = syl_json['submissions']
                    for code, sub_data in raw_syl.items():
                        if isinstance(sub_data, str):
                            try:
                                sub_data = json.loads(sub_data)
                            except Exception:
                                pass
                        if isinstance(sub_data, dict):
                            if 'data_json' in sub_data:
                                try:
                                    parsed = json.loads(sub_data['data_json']) if isinstance(sub_data['data_json'], str) else sub_data['data_json']
                                    sub_data.update(parsed)
                                except Exception:
                                    pass
                            sub_data['is_submitted'] = True
                            syllabus_subs[code] = sub_data
                    print(f"[CBEO-VM] ✓ Live Syllabus Sync SUCCESS: Fetched {len(raw_syl)} syllabus submissions directly from Sheet!")
                    try:
                        with open(saman_syllabus_subs_path, 'w', encoding='utf-8') as sf:
                            json.dump(syllabus_subs, sf, ensure_ascii=False, indent=2)
                        master_data['saman_syllabus_submissions'] = syllabus_subs
                        with open(data_path, 'w', encoding='utf-8') as mf:
                            json.dump(master_data, mf, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
        except Exception as e:
            print(f"[CBEO-VM] Note on Syllabus Submissions sync: {e}")

    dispatch_cfg = vm_settings.get('dispatch_config', {})
    active_focus_report = dispatch_cfg.get('active_focus_report') or vm_settings.get('active_focus_report', '49_syllabus')
    show_mdm = bool(vm_settings.get('mdm_anomaly_scanner', False) and dispatch_cfg.get('report_mdm', False))
    custom_message = (dispatch_cfg.get('custom_message') or local_custom_message or '').strip()
    include_completed = dispatch_cfg.get('include_completed_tasks', False)
    gemini_tone = dispatch_cfg.get('gemini_tone', 'warning')

    print(f"[CBEO-VM] Active Focus Report Mode: '{active_focus_report}' | Show MDM: {show_mdm}")

    # -------------------------------------------------------------
    # 2A. PROCESS 49 GOVT SCHOOLS SYLLABUS DATA
    # -------------------------------------------------------------
    total_syl_schools = len(govt_schools_49)
    syl_submitted_schools = []
    syl_pending_schools = []
    syl_peeo_pending_map = {}
    syl_total_pct_sum = 0.0

    for s in govt_schools_49:
        code = str(s.get('shala_darpan_code', '')).strip()
        peeo_name = s.get('peeo_name', 'PEEO अज्ञात')
        sub = syllabus_subs.get(code)
        
        is_sub = False
        avg_pct = 0
        if sub and (sub.get('is_submitted') is True or calculate_school_syllabus_avg(sub) > 0 or sub.get('average_pct')):
            is_sub = True
            avg_pct = calculate_school_syllabus_avg(sub)
            syl_total_pct_sum += avg_pct

        if is_sub:
            syl_submitted_schools.append({
                'code': code,
                'name': s.get('school_name', ''),
                'peeo': peeo_name,
                'avg_pct': avg_pct,
                'principal': s.get('principal_name', 'संस्था प्रधान'),
                'mobile': s.get('principal_mobile') or s.get('mobile') or ''
            })
        else:
            p_school = {
                'code': code,
                'name': s.get('school_name', ''),
                'peeo': peeo_name,
                'principal': s.get('principal_name', 'संस्था प्रधान'),
                'mobile': s.get('principal_mobile') or s.get('mobile') or ''
            }
            syl_pending_schools.append(p_school)
            syl_peeo_pending_map[peeo_name] = syl_peeo_pending_map.get(peeo_name, 0) + 1

    syl_sub_count = len(syl_submitted_schools)
    syl_pend_count = len(syl_pending_schools)
    syl_percent = round((syl_sub_count / total_syl_schools * 100), 1) if total_syl_schools > 0 else 0.0
    syl_block_avg = round(syl_total_pct_sum / syl_sub_count) if syl_sub_count > 0 else 0

    print(f"49 Govt Syllabus: Total={total_syl_schools}, Submitted={syl_sub_count} ({syl_percent}%), Pending={syl_pend_count}, Block Avg={syl_block_avg}%")

    # -------------------------------------------------------------
    # 2B. PROCESS 57 SCHOOLS INDENT DATA (FOR COMPATIBILITY)
    # -------------------------------------------------------------
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
                'grand_total': sub.get('grand_total', 0)
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

    # -------------------------------------------------------------
    # 3. COMPILE MASTER REPORT MARKDOWN
    # -------------------------------------------------------------
    report_lines = []
    report_lines.append(f"# 🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)")
    report_lines.append(f"### 🤖 GitHub Cloud VM स्वचालित अनुपालन, विसंगति मॉनिटर व रेड-अलर्ट बुलेटिन")
    report_lines.append(f"**सत्यापन दिनांक व समय:** {time_str} IST | **जिला:** अजमेर (AJMER) | **ब्लॉक:** भिनाय (BHINAI)\n")
    report_lines.append(f"---\n")

    if custom_message:
        report_lines.append(f"> 📢 **विशेष प्रशासनिक निर्देश (जितेन्द्र व्यवस्थापक - अजमेर):**\n> {custom_message}\n")

    if active_focus_report == '49_syllabus':
        # FOCUS: 49 GOVT SCHOOLS SYLLABUS COMPLETION %
        report_lines.append(f"## 🎯 1. समान परीक्षा (सत्र 2026-27): पाठ्यक्रम पूर्णता % प्रगति सारांश (49 राजकीय विद्यालय)")
        report_lines.append(f"| कुल लक्षित राजकीय विद्यालय | प्रपत्र प्राप्त संख्या | कुल लंबित विद्यालय | संकलन प्रगति | ब्लॉक औसत पाठ्यक्रम पूर्णता |")
        report_lines.append(f"| :---: | :---: | :---: | :---: | :---: |")
        report_lines.append(f"| **{total_syl_schools}** | **{syl_sub_count}** | <span style='color:red'>**{syl_pend_count}**</span> | **{syl_percent}%** | **{syl_block_avg}%** |\n")

        if syl_peeo_pending_map:
            report_lines.append(f"### 📍 PEEO परिक्षेत्रवार लंबित विद्यालय संख्या:")
            report_lines.append(f"| क्र.सं. | PEEO परिक्षेत्र | लंबित विद्यालय संख्या |")
            report_lines.append(f"| :---: | :--- | :---: |")
            for p_idx, (p_name, count) in enumerate(sorted(syl_peeo_pending_map.items(), key=lambda x: x[1], reverse=True)):
                report_lines.append(f"| {p_idx + 1} | **{p_name}** | **{count} स्कूल लंबित** |")
            report_lines.append("")

        report_lines.append(f"## 🚨 2. सख्त समय-सीमा अनुपालन व रेड-अलर्ट सिस्टम (Overdue Escalation Engine)")
        if syl_pend_count > 0:
            report_lines.append(f"> ⚠️ **अति-आवश्यक चेतावनी (Final Escalation Warning):** भिनाय ब्लॉक के निम्नलिखित **{syl_pend_count} राजकीय विद्यालयों** द्वारा कक्षा 9 से 12 तक का पाठ्यक्रम पूर्णता प्रतिशत प्रपत्र निर्धारित समय-सीमा पूर्ण होने के उपरांत भी अप्राप्त है। संबंधित संस्था प्रधान एवं PEEOs आज ही प्रविष्टि पूर्ण कराना सुनिश्चित करें।\n")
            report_lines.append(f"| क्र. | शा.दा. कोड | विद्यालय का नाम | संबंधित PEEO | संस्था प्रधान | मोबाइल नंबर | स्थिति |")
            report_lines.append(f"| :---: | :---: | :--- | :--- | :--- | :---: | :---: |")
            for s_idx, ps in enumerate(syl_pending_schools):
                report_lines.append(f"| {s_idx + 1} | `{ps['code']}` | **{ps['name']}** | {ps['peeo']} | {ps['principal']} | `{ps['mobile']}` | <span style='color:red; font-weight:bold;'>🚨 अति-लंबित</span> |")
            report_lines.append("")
        else:
            report_lines.append("✓ समान परीक्षा 2026-27 के सभी 49 राजकीय विद्यालयों का पाठ्यक्रम पूर्णता प्रपत्र शत-प्रतिशत संकलित हो चुका है। कोई डिफ़ॉल्टर शेष नहीं है।\n")

        # Pillar 3: PEEO Cluster Status (MDM is completely omitted)
        report_lines.append(f"## 🏢 3. PEEO क्लस्टर अनुपालन स्थिति (PEEO Cluster Status)")
        report_lines.append(f"- **कुल PEEO परिक्षेत्र:** {len(peeos)} | **ब्लॉक:** भिनाय (अजमेर)")
        report_lines.append(f"- **निगरानी स्थिति:** ब्लॉक भिनाय (अजमेर) के समस्त 25 PEEO क्लस्टर में 49 राजकीय विद्यालयों की पाठ्यक्रम पूर्णता मॉनिटरिंग सक्रिय है।\n")

    elif active_focus_report == 'dual_all':
        # DUAL REPORT: Syllabus + Indent
        report_lines.append(f"## 🎯 1A. समान परीक्षा: पाठ्यक्रम पूर्णता % प्रगति (49 राजकीय विद्यालय)")
        report_lines.append(f"- कुल: **{total_syl_schools}** | प्राप्त: **{syl_sub_count} ({syl_percent}%)** | लंबित: **{syl_pend_count}** | ब्लॉक औसत: **{syl_block_avg}%**\n")

        report_lines.append(f"## 📋 1B. समान परीक्षा: प्रश्न-पत्र मांग प्रगति (57 विद्यालय)")
        report_lines.append(f"- कुल: **{total_sp_schools}** | प्राप्त: **{sp_sub_count} ({sp_percent}%)** | लंबित: **{sp_pend_count}**\n")

        report_lines.append(f"## 🚨 2. रेड-अलर्ट डिफ़ॉल्टर सूची:")
        if syl_pend_count > 0:
            report_lines.append(f"### पाठ्यक्रम प्रपत्र लंबित ({syl_pend_count} स्कूल):")
            for s_idx, ps in enumerate(syl_pending_schools[:15]):
                report_lines.append(f"- {s_idx+1}. **{ps['name']}** (`{ps['code']}`) - {ps['principal']} ({ps['mobile']})")
        report_lines.append("")

    else:
        # 57 INDENT REPORT
        report_lines.append(f"## 📋 1. जिला समान परीक्षा योजना (सत्र 2026-27) - प्रगति सारांश")
        report_lines.append(f"| कुल लक्षित विद्यालय | प्रपत्र प्राप्त संख्या | कुल लंबित विद्यालय | संकलन प्रगति |")
        report_lines.append(f"| :---: | :---: | :---: | :---: |")
        report_lines.append(f"| **{total_sp_schools}** | **{sp_sub_count}** | <span style='color:red'>**{sp_pend_count}**</span> | **{sp_percent}%** |\n")

        report_lines.append(f"## 🚨 2. सख्त समय-सीमा अनुपालन व रेड-अलर्ट सिस्टम (Overdue Escalation Engine)")
        if sp_pend_count > 0:
            report_lines.append(f"| क्र. | शा.दा. कोड | विद्यालय का नाम | संबंधित PEEO | संस्था प्रधान | मोबाइल नंबर | स्थिति |")
            report_lines.append(f"| :---: | :---: | :--- | :--- | :--- | :---: | :---: |")
            for s_idx, ps in enumerate(sp_pending_schools):
                report_lines.append(f"| {s_idx + 1} | `{ps['code']}` | **{ps['name']}** | {ps['peeo']} | {ps['principal']} | `{ps['mobile']}` | <span style='color:red; font-weight:bold;'>🚨 अति-लंबित</span> |")
            report_lines.append("")

    # Conditionally include MDM ONLY IF explicitly enabled by admin
    if show_mdm:
        report_lines.append(f"## 🍲 3. ब्लॉक MDM निरीक्षण प्रपत्र-2 एवं दैनिक विसंगति मॉनिटर")
        report_lines.append(f"- ब्लॉक भिनाय (अजमेर) के 25 PEEO परिक्षेत्र में MDM मॉनिटरिंग सक्रिय।\n")

    # Universal Demands
    active_demands = [d for d in demands if not d.get('archived') and d.get('id') != 'DEMAND_SAMAN_SYLLABUS_2026']
    if active_demands:
        report_lines.append(f"## 📊 4. सक्रिय अन्य सूचना मांगें (Universal Demands)")
        for d in active_demands:
            report_lines.append(f"- **{d.get('title', 'मांग')}** (अंतिम तिथि: {d.get('dueDate', 'यथाशीघ्र')})")
        report_lines.append("")

    report_lines.append(f"🌐 **आधिकारिक सत्यापन पोर्टल:** [https://jit9763.github.io/cbeo-bhinai-portal/](https://jit9763.github.io/cbeo-bhinai-portal/)\n")
    report_lines.append(f"*(नोट: यह रिपोर्ट GitHub Actions Ubuntu Linux Virtual Machine द्वारा पूर्णतः स्वचालित रूप से संकलित एवं प्रकाशित की गई है)*\n")

    report_content = "\n".join(report_lines)

    # 4. Save latest report markdown
    report_file = os.path.join(root_dir, 'scripts', 'latest_report.md')
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_content)
    print(f"Saved latest report to {report_file}")

    # 5. Generate Live JSON Status
    active_pend_count = syl_pend_count if active_focus_report == '49_syllabus' else sp_pend_count
    live_status = {
        "generated_at": time_str,
        "vm_status": "ONLINE_ACTIVE",
        "district": "AJMER (अजमेर)",
        "block": "BHINAI (भिनाय)",
        "active_focus_report": active_focus_report,
        "saman_syllabus_49": {
            "total_govt_schools": total_syl_schools,
            "submitted_count": syl_sub_count,
            "pending_count": syl_pend_count,
            "completion_percentage": syl_percent,
            "block_average_syllabus_pct": syl_block_avg,
            "peeo_pending_map": syl_peeo_pending_map,
            "pending_schools": syl_pending_schools[:15]
        },
        "saman_pariksha_57": {
            "total_schools": total_sp_schools,
            "submitted_count": sp_sub_count,
            "pending_count": sp_pend_count,
            "completion_percentage": sp_percent
        },
        "overdue_escalation": {
            "is_active": active_pend_count > 0,
            "defaulter_count": active_pend_count,
            "urgency": "HIGH" if active_pend_count > 0 else "NORMAL",
            "message": f"🚨 {active_pend_count} विद्यालय समय-सीमा पश्चात भी लंबित हैं।" if active_pend_count > 0 else "✓ शत-प्रतिशत अनुपालन पूर्ण।"
        },
        "mdm_anomaly_scanner": {
            "enabled": show_mdm,
            "status": "MONITORING_ACTIVE" if show_mdm else "DISABLED_BY_ADMIN",
            "district": "AJMER"
        },
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

    # Backup GAS Endpoint
    backup_gas_url = "https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec"

    # Credentials
    cfg_file = os.path.join(root_dir, 'cbeo_notification_config.json')
    local_cfg = {}
    if os.path.exists(cfg_file):
        try:
            with open(cfg_file, 'r', encoding='utf-8') as cf:
                local_cfg = json.load(cf)
        except Exception as e:
            print("Note reading cbeo_notification_config.json:", e)

    # AI Tone Directives
    tone_directives = {
        'formal': "विभागीय औपचारिक भाषा: मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय के औपचारिक परिपत्र शैली में प्रशासनिक भाषा का प्रयोग करें।",
        'warning': "सख्त समय-सीमा चेतावनी: लंबित विद्यालयों के संस्था प्रधानों को अंतिम चेतावनी देते हुए स्पष्ट व कड़े शब्दों में अनुशासनात्मक कार्रवाई का उल्लेख करें।",
        'brief': "संक्षिप्त बुलेटिन: केवल 2 अत्यंत संक्षिप्त व सटीक बुलेट वाक्यों में स्थिति व स्पष्ट निर्देश लिखें।",
        'motivational': "प्रोत्साहन व समीक्षात्मक: अब तक की सराहनीय प्रगति का उल्लेख करते हुए शत-प्रतिशत लक्ष्य शीघ्र पूरा करने का संदेश दें।"
    }
    tone_str = tone_directives.get(gemini_tone, tone_directives['warning'])

    # Gemini AI Analysis
    raw_gemini_keys = (os.environ.get('GEMINI_API_KEY') or local_cfg.get('GEMINI_API_KEY') or vm_settings.get('gemini_api_key') or '').strip()
    gemini_ai_brief = ""
    if raw_gemini_keys and requests:
        gemini_pool = [k.strip() for k in re.split(r'[,;\n]+', raw_gemini_keys) if k.strip()]
        for g_idx, gemini_key in enumerate(gemini_pool):
            try:
                print(f"[CBEO-VM] Generating AI Analysis via Gemini Key #{g_idx+1} [Tone: {gemini_tone}]...")
                g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={gemini_key}"
                g_prompt = (
                    f"You are Chief AI Officer for CBEO Bhinai, District AJMER (अजमेर), Rajasthan. "
                    f"MANDATORY PERMANENT RULE: District is strictly AJMER (अजमेर); never use Kekri. "
                    f"Tone Directive: {tone_str}. "
                    f"Data: 49 Govt Schools Syllabus Completion %: {syl_sub_count}/49 submitted, {syl_pend_count} pending, block average {syl_block_avg}%. "
                    f"Write a 2-3 line Hindi directive for official bulletin/Telegram focusing on 49 Govt schools syllabus completion."
                )
                g_payload = {"contents": [{"parts": [{"text": g_prompt}]}]}
                g_resp = requests.post(g_url, json=g_payload, timeout=8)
                if g_resp.status_code == 200:
                    gemini_ai_brief = g_resp.json()['candidates'][0]['content']['parts'][0]['text'].strip()
                    print(f"[CBEO-VM] ✓ Gemini AI Analysis generated successfully via Key #{g_idx+1}!")
                    break
            except Exception as ge:
                print(f"[CBEO-VM] Note on Gemini Key #{g_idx+1}:", ge)

    # -------------------------------------------------------------
    # 6. TELEGRAM NOTIFICATION (NO MDM)
    # -------------------------------------------------------------
    tg_token = (os.environ.get('TELEGRAM_BOT_TOKEN') or local_cfg.get('TELEGRAM_BOT_TOKEN') or '').strip()
    tg_chat_id = (os.environ.get('TELEGRAM_CHAT_ID') or local_cfg.get('TELEGRAM_CHAT_ID') or '').strip()

    if tg_token and tg_chat_id and requests and vm_settings.get('telegram_alerts', True):
        try:
            print("Sending Telegram compliance notification...")
            tg_html_lines = [
                "🏛️ <b>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</b>",
                "🤖 <b>स्वचालित अनुपालन व रेड-अलर्ट बुलेटिन</b>",
                f"⏰ <b>दिनांक:</b> {time_str} IST",
                "📍 <b>जिला:</b> अजमेर (AJMER) | <b>ब्लॉक:</b> भिनाय (BHINAI)",
                "━━━━━━━━━━━━━━━━━━━━━━"
            ]

            if custom_message:
                tg_html_lines.append(f"📢 <b>विशेष प्रशासनिक निर्देश (जितेन्द्र व्यवस्थापक):</b>\n<blockquote>{custom_message}</blockquote>\n")

            if active_focus_report == '49_syllabus':
                tg_html_lines.extend([
                    "🎯 <b>1. समान परीक्षा पाठ्यक्रम पूर्णता % (49 राजकीय विद्यालय):</b>",
                    f"• कुल लक्षित राजकीय स्कूल: <b>{total_syl_schools}</b>",
                    f"• प्रपत्र प्राप्त: <b>{syl_sub_count} ({syl_percent}%)</b>",
                    f"• कुल लंबित: <b>{syl_pend_count} विद्यालय ({round(100 - syl_percent, 1)}%)</b>",
                    f"• ब्लॉक औसत पाठ्यक्रम पूर्णता: <b>{syl_block_avg}%</b>",
                    ""
                ])

                if gemini_ai_brief:
                    tg_html_lines.append(f"🤖 <b>AI कार्यकारी विश्लेषण (Google Gemini):</b>\n<i>{gemini_ai_brief}</i>\n")

                if syl_pend_count > 0:
                    tg_html_lines.append("🚨 <b>2. रेड-अलर्ट डिफ़ॉल्टर सूची (Overdue Escalation):</b>")
                    tg_html_lines.append("<i>(अंतिम स्मरण: 49 राजकीय विद्यालयों में से शेष स्कूल आज ही प्रविष्टि करें)</i>")
                    for s_i, ps in enumerate(syl_pending_schools[:15]):
                        mob_str = f' | 📞 <a href="tel:{ps["mobile"]}">{ps["mobile"]}</a>' if ps["mobile"] else ''
                        tg_html_lines.append(
                            f"<b>{s_i + 1}. {ps['name']}</b>\n"
                            f"   ├ कोड: <code>{ps['code']}</code> | {ps['peeo']}\n"
                            f"   └ {ps['principal']}{mob_str}"
                        )
                    if syl_pend_count > 15:
                        tg_html_lines.append(f"<i>... तथा अन्य {syl_pend_count - 15} विद्यालय और लंबित हैं।</i>")
                    tg_html_lines.append("")
                elif include_completed:
                    tg_html_lines.append("✅ <b>सभी 49 राजकीय विद्यालयों के पाठ्यक्रम पूर्णता प्रपत्र शत-प्रतिशत प्राप्त हो चुके हैं।</b>\n")

                tg_html_lines.append("🏢 <b>3. PEEO क्लस्टर अनुपालन स्थिति:</b>")
                tg_html_lines.append("• ब्लॉक भिनाय (अजमेर) के 25 PEEO परिक्षेत्रों में पाठ्यक्रम संकलन मॉनिटरिंग सक्रिय।\n")

            else:
                tg_html_lines.extend([
                    "📋 <b>1. जिला समान परीक्षा (सत्र 2026-27):</b>",
                    f"• कुल लक्षित विद्यालय: <b>{total_sp_schools}</b>",
                    f"• प्रपत्र प्राप्त: <b>{sp_sub_count} ({sp_percent}%)</b>",
                    f"• कुल लंबित: <b>{sp_pend_count} विद्यालय ({round(100 - sp_percent, 1)}%)</b>",
                    ""
                ])
                if sp_pend_count > 0:
                    tg_html_lines.append("🚨 <b>2. रेड-अलर्ट डिफ़ॉल्टर सूची:</b>")
                    for s_i, ps in enumerate(sp_pending_schools[:15]):
                        mob_str = f' | 📞 <a href="tel:{ps["mobile"]}">{ps["mobile"]}</a>' if ps["mobile"] else ''
                        tg_html_lines.append(f"<b>{s_i + 1}. {ps['name']}</b>\n   ├ कोड: <code>{ps['code']}</code> | {ps['peeo']}\n   └ {ps['principal']}{mob_str}")
                    tg_html_lines.append("")

            # Only show MDM if explicitly configured
            if show_mdm:
                tg_html_lines.append("🍲 <b>4. MDM प्रपत्र-2 एवं विसंगति स्थिति:</b>\n• कुल 25 PEEO निरीक्षण प्रपत्र मॉनिटरिंग सक्रिय।\n")

            tg_html_lines.append("🌐 <b>आधिकारिक पोर्टल:</b> https://jit9763.github.io/cbeo-bhinai-portal/")
            tg_html_lines.append("<i>(सूचना GitHub Actions Cloud VM द्वारा स्वचालित रूप से प्रेषित)</i>")

            tg_text = "\n".join(tg_html_lines)
            tg_url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
            tg_payload = {
                "chat_id": tg_chat_id,
                "text": tg_text,
                "parse_mode": "HTML",
                "disable_web_page_preview": False
            }
            tg_res = requests.post(tg_url, json=tg_payload, timeout=12)
            if tg_res.status_code == 200:
                print("✓ Telegram notification sent successfully!")
            else:
                print(f"Telegram notification status {tg_res.status_code}: {tg_res.text}")
        except Exception as e:
            print("Telegram alert error:", e)

    # -------------------------------------------------------------
    # 7. EMAIL NOTIFICATION ENGINE (NO MDM)
    # -------------------------------------------------------------
    email_user = (os.environ.get('GMAIL_USER') or local_cfg.get('GMAIL_USER') or '').strip()
    email_pass = (os.environ.get('GMAIL_APP_PASSWORD') or local_cfg.get('GMAIL_APP_PASSWORD') or '').strip()
    email_to = (os.environ.get('REPORT_EMAIL_TO') or local_cfg.get('REPORT_EMAIL_TO') or dispatch_cfg.get('target_email') or "censusbhinai@gmail.com").strip()

    # Custom directive HTML
    custom_message_html = ""
    if custom_message:
        formatted_msg = custom_message.replace('\n', '<br>')
        custom_message_html = f"""
        <div style="background:#fffbeb; border:2px solid #f59e0b; border-left:6px solid #d97706; padding:16px 20px; border-radius:10px; margin-bottom:20px; box-shadow:0 4px 6px -1px rgba(245,158,11,0.1);">
            <div style="font-size:15px; font-weight:800; color:#b45309; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                📢 विशेष प्रशासनिक निर्देश (जितेन्द्र व्यवस्थापक - अजमेर)
            </div>
            <div style="font-size:14px; font-weight:600; color:#1e293b; line-height:1.6;">
                {formatted_msg}
            </div>
        </div>
        """

    gemini_ai_brief_html = ""
    if gemini_ai_brief:
        gemini_ai_brief_html = f"""
        <div style="background:#f5f3ff; border:1.5px solid #ddd6fe; border-left:5px solid #7c3aed; border-radius:8px; padding:12px 16px; margin-bottom:18px;">
            <div style="font-size:13px; font-weight:700; color:#6b21a8; margin-bottom:4px;">🤖 AI कार्यकारी विश्लेषण (Google Gemini):</div>
            <div style="font-size:13px; color:#374151; line-height:1.5; font-style:italic;">{gemini_ai_brief}</div>
        </div>
        """

    # Section 1 HTML (49 Govt Syllabus)
    if active_focus_report == '49_syllabus':
        saman_section_html = f"""
        <h3 style="margin:0 0 14px 0; color:#0f172a; border-left:4px solid #2563eb; padding-left:10px; font-size:16px;">
            🎯 1. समान परीक्षा 2026-27: पाठ्यक्रम पूर्णता % प्रगति सारांश (49 राजकीय विद्यालय)
        </h3>
        <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
            <div style="flex:1; min-width:130px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#1d4ed8; font-weight:700; text-transform:uppercase;">कुल राजकीय स्कूल</div>
                <div style="font-size:24px; font-weight:800; color:#1e3a8a; margin-top:4px;">{total_syl_schools}</div>
            </div>
            <div style="flex:1; min-width:130px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#047857; font-weight:700; text-transform:uppercase;">प्रपत्र प्राप्त</div>
                <div style="font-size:24px; font-weight:800; color:#065f46; margin-top:4px;">{syl_sub_count} <span style="font-size:14px; font-weight:600">({syl_percent}%)</span></div>
            </div>
            <div style="flex:1; min-width:130px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#b91c1c; font-weight:700; text-transform:uppercase;">कुल लंबित</div>
                <div style="font-size:24px; font-weight:800; color:#991b1b; margin-top:4px;">{syl_pend_count}</div>
            </div>
            <div style="flex:1; min-width:130px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#15803d; font-weight:700; text-transform:uppercase;">ब्लॉक औसत पाठ्यक्रम</div>
                <div style="font-size:24px; font-weight:800; color:#166534; margin-top:4px;">{syl_block_avg}%</div>
            </div>
        </div>
        """

        escalation_section_html = ""
        if syl_pend_count > 0:
            esc_rows = ""
            for idx, ps in enumerate(syl_pending_schools[:15]):
                mob_cell = f'<a href="tel:{ps["mobile"]}" style="color:#2563eb; text-decoration:none; font-weight:600;">{ps["mobile"]}</a>' if ps["mobile"] else '---'
                esc_rows += f"""
                <tr style="border-bottom:1px solid #e2e8f0; background:{'#ffffff' if idx%2==0 else '#f8fafc'};">
                    <td style="padding:8px 10px; font-size:12px; text-align:center; font-weight:bold;">{idx+1}</td>
                    <td style="padding:8px 10px; font-size:12px; font-family:monospace; font-weight:bold; color:#1e293b;">{ps['code']}</td>
                    <td style="padding:8px 10px; font-size:12px; font-weight:600; color:#0f172a;">{ps['name']}</td>
                    <td style="padding:8px 10px; font-size:12px; color:#475569;">{ps['peeo']}</td>
                    <td style="padding:8px 10px; font-size:12px; color:#1e293b;">{ps['principal']}</td>
                    <td style="padding:8px 10px; font-size:12px; text-align:center;">{mob_cell}</td>
                    <td style="padding:8px 10px; font-size:11px; text-align:center;"><span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:4px; font-weight:bold;">लंबित</span></td>
                </tr>
                """
            more_note = f"<div style='margin-top:6px; font-size:11px; color:#b91c1c; text-align:right;'>... तथा अन्य {syl_pend_count-15} विद्यालय और लंबित हैं।</div>" if syl_pend_count > 15 else ""

            escalation_section_html = f"""
            <div style="margin-top:20px;">
                <h3 style="margin:0 0 8px 0; color:#b91c1c; border-left:4px solid #ef4444; padding-left:10px; font-size:15px;">
                    🚨 2. रेड-अलर्ट डिफ़ॉल्टर सूची (Overdue Escalation - 49 राजकीय विद्यालय)
                </h3>
                <div style="font-size:12px; color:#dc2626; margin-bottom:10px; font-weight:600;">
                    ⚠️ निम्नलिखित {syl_pend_count} राजकीय विद्यालयों द्वारा कक्षा 9 से 12 पाठ्यक्रम पूर्णता प्रपत्र अभी तक सबमिट नहीं किया गया है:
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; font-size:12px;">
                        <thead>
                            <tr style="background:#f1f5f9; color:#475569; border-bottom:2px solid #cbd5e1; text-align:left;">
                                <th style="padding:8px 10px; text-align:center;">क्र.</th>
                                <th style="padding:8px 10px;">कोड</th>
                                <th style="padding:8px 10px;">विद्यालय का नाम</th>
                                <th style="padding:8px 10px;">PEEO</th>
                                <th style="padding:8px 10px;">संस्था प्रधान</th>
                                <th style="padding:8px 10px; text-align:center;">मोबाइल</th>
                                <th style="padding:8px 10px; text-align:center;">स्थिति</th>
                            </tr>
                        </thead>
                        <tbody>{esc_rows}</tbody>
                    </table>
                </div>
                {more_note}
            </div>
            """
    else:
        # 57 Indent HTML
        saman_section_html = f"""
        <h3 style="margin:0 0 14px 0; color:#0f172a; border-left:4px solid #2563eb; padding-left:10px; font-size:16px;">
            📋 1. जिला समान परीक्षा (सत्र 2026-27): प्रगति सारांश
        </h3>
        <div style="display:flex; gap:12px; margin-bottom:20px;">
            <div style="flex:1; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#1d4ed8; font-weight:700;">कुल विद्यालय</div>
                <div style="font-size:24px; font-weight:800; color:#1e3a8a;">{total_sp_schools}</div>
            </div>
            <div style="flex:1; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#047857; font-weight:700;">प्रपत्र प्राप्त</div>
                <div style="font-size:24px; font-weight:800; color:#065f46;">{sp_sub_count}</div>
            </div>
            <div style="flex:1; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:#b91c1c; font-weight:700;">लंबित</div>
                <div style="font-size:24px; font-weight:800; color:#991b1b;">{sp_pend_count}</div>
            </div>
        </div>
        """
        escalation_section_html = ""

    # PEEO Cluster Summary HTML
    peeo_section_html = """
    <div style="background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:8px; padding:12px 16px; margin-top:16px;">
        <h4 style="margin:0 0 4px 0; color:#166534; font-size:13px;">🏢 PEEO क्लस्टर अनुपालन सारांश:</h4>
        <p style="margin:0; font-size:12px; color:#15803d;">ब्लॉक भिनाय (अजमेर) के समस्त 25 PEEO परिक्षेत्रों में क्लस्टर-स्तरीय मॉनिटरिंग व संकलन निरंतर जारी है।</p>
    </div>
    """

    # Optional MDM section HTML
    mdm_section_html = ""
    if show_mdm:
        mdm_section_html = """
        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-top:16px;">
            <h4 style="margin:0 0 6px 0; color:#0f172a; font-size:14px;">🍲 3. ब्लॉक MDM निरीक्षण प्रपत्र-2 एवं दैनिक विसंगति मॉनिटर:</h4>
            <p style="margin:0; font-size:12px; color:#475569;">ब्लॉक भिनाय (अजमेर) के समस्त 25 PEEO परिक्षेत्रों में मिड-डे-मील निरीक्षण सत्यापन सक्रिय है।</p>
        </div>
        """

    html_email = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f1f5f9; margin:0; padding:20px; color:#1e293b;">
        <div style="max-width:750px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
            <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#ffffff; padding:24px 28px; text-align:center; border-bottom:4px solid #f59e0b;">
                <h2 style="margin:0 0 6px 0; font-size:20px; font-weight:bold; letter-spacing:0.5px;">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
                <div style="font-size:13px; color:#93c5fd; font-weight:600;">जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (BHINAI)</div>
                <div style="margin-top:10px; display:inline-block; background:rgba(255,255,255,0.15); padding:4px 14px; border-radius:20px; font-size:12px; color:#fde047;">
                    🤖 GitHub Cloud VM स्वचालित अनुपालन रिपोर्ट • {time_str} IST
                </div>
            </div>

            <div style="padding:24px 28px;">
                {custom_message_html}
                {gemini_ai_brief_html}
                {saman_section_html}
                {escalation_section_html}
                {mdm_section_html}
                {peeo_section_html}

                <div style="margin-top:28px; text-align:center;">
                    <a href="https://jit9763.github.io/cbeo-bhinai-portal/" style="display:inline-block; background:#1e3a8a; color:#ffffff; font-weight:bold; font-size:14px; padding:12px 28px; border-radius:8px; text-decoration:none; box-shadow:0 4px 12px rgba(30,58,138,0.25);">
                        🌐 CBEO भिनाय आधिकारिक पोर्टल खोलें
                    </a>
                </div>
            </div>

            <div style="background:#f8fafc; padding:16px 28px; border-top:1px solid #e2e8f0; font-size:11px; color:#64748b; text-align:center;">
                कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), ब्लॉक भिनाय, जिला अजमेर (राजस्थान)<br>
                यह एक स्वचालित प्रणाली द्वारा प्रेषित आधिकारिक संदेश है। कृपया इस पर सीधे रिप्लाई न करें।
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text email
    plain_lines = [
        "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)",
        f"दैनिक अनुपालन रिपोर्ट • {time_str} IST",
        "जिला: अजमेर (AJMER) | ब्लॉक: भिनाय",
        "------------------------------------------------"
    ]
    if custom_message:
        plain_lines.extend(["", "📢 विशेष प्रशासनिक निर्देश (जितेन्द्र व्यवस्थापक):", custom_message, "------------------------------------------------"])

    if active_focus_report == '49_syllabus':
        plain_lines.append(f"1. समान परीक्षा पाठ्यक्रम पूर्णता (49 राजकीय स्कूल): कुल {total_syl_schools} | प्राप्त: {syl_sub_count} ({syl_percent}%) | लंबित: {syl_pend_count} | औसत: {syl_block_avg}%")
        if syl_pend_count > 0:
            plain_lines.append("\n2. लंबित डिफ़ॉल्टर राजकीय विद्यालय:")
            for idx, ps in enumerate(syl_pending_schools[:15]):
                plain_lines.append(f"  {idx+1}. {ps['name']} ({ps['code']}) - {ps['principal']} ({ps['mobile']})")
    else:
        plain_lines.append(f"1. समान परीक्षा 2026-27: कुल {total_sp_schools} | प्राप्त: {sp_sub_count} ({sp_percent}%) | लंबित: {sp_pend_count}")
        if sp_pend_count > 0:
            plain_lines.append("\n2. लंबित डिफ़ॉल्टर विद्यालय:")
            for idx, ps in enumerate(sp_pending_schools[:15]):
                plain_lines.append(f"  {idx+1}. {ps['name']} ({ps['code']}) - {ps['principal']} ({ps['mobile']})")

    if gemini_ai_brief:
        plain_lines.extend(["", f"AI विश्लेषण: {gemini_ai_brief}"])

    plain_lines.extend(["", "आधिकारिक पोर्टल: https://jit9763.github.io/cbeo-bhinai-portal/"])
    plain_content = "\n".join(plain_lines)

    # Subject line
    pending_metric = syl_pend_count if active_focus_report == '49_syllabus' else sp_pend_count
    if custom_message:
        short_cust = custom_message.replace('\n', ' ').strip()
        if len(short_cust) > 40:
            short_cust = short_cust[:37] + '...'
        email_subject = f"📢 [निर्देश: {short_cust}] | CBEO भिनाय दैनिक अनुपालन रिपोर्ट ({time_str} IST)"
    else:
        email_subject = f"🏛️ CBEO भिनाय दैनिक अनुपालन रिपोर्ट ({time_str} IST) - समान परीक्षा {pending_metric} लंबित"

    email_sent_successfully = False

    # Attempt 1: Direct SMTP via Gmail
    if email_user and email_pass and email_to and vm_settings.get('email_alerts', True):
        try:
            print(f"Sending direct SMTP Email to {email_to}...")
            recipients = [r.strip() for r in email_to.split(',') if r.strip()]
            msg = MIMEMultipart('alternative')
            msg['From'] = f"CBEO भिनाय (अजमेर) <{email_user}>"
            msg['To'] = ", ".join(recipients)
            msg['Subject'] = email_subject
            msg.attach(MIMEText(plain_content, 'plain', 'utf-8'))
            msg.attach(MIMEText(html_email, 'html', 'utf-8'))

            server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15)
            server.login(email_user, email_pass)
            server.sendmail(email_user, recipients, msg.as_string())
            server.quit()
            print("✓ SMTP Email sent successfully to", recipients)
            email_sent_successfully = True
        except Exception as e:
            print("Direct SMTP failed, will attempt Google Apps Script fallback:", e)

    # Attempt 2: GAS MailApp
    if not email_sent_successfully and email_to and requests:
        try:
            print(f"Dispatching Email via Google Apps Script MailApp to {email_to}...")
            payload = {
                "action": "send_email",
                "email_to": email_to,
                "subject": email_subject,
                "html_body": html_email,
                "body": plain_content
            }
            res = requests.post(backup_gas_url, data=json.dumps(payload), headers={'Content-Type': 'text/plain;charset=utf-8'}, timeout=12)
            try:
                res_data = res.json()
            except Exception:
                res_data = {}
            if res.status_code == 200 and res_data.get('success'):
                print("✓ Email dispatched successfully via Google Apps Script MailApp!")
                email_sent_successfully = True
            else:
                err_msg = res_data.get('message') or res_data.get('error') or f"Status {res.status_code}"
                print(f"GAS Email dispatch note: {err_msg}")
        except Exception as e:
            print("Google Apps Script email dispatch note:", e)

    # Audit Log
    if requests:
        try:
            target_metric = f"समान परीक्षा (49 स्कूल पाठ्यक्रम): {syl_pend_count} लंबित, {syl_sub_count} पूर्ण" if active_focus_report == '49_syllabus' else f"समान परीक्षा: {sp_pend_count} लंबित, {sp_sub_count} पूर्ण"
            payload = {
                "action": "log_audit",
                "user": "GitHub Actions Ubuntu VM",
                "action_name": "स्वचालित रिपोर्टिंग (VM Scheduled)",
                "target": target_metric,
                "details": f"दैनिक चक्र: {time_str} IST | जिला: अजमेर | MDM: {'OFF' if not show_mdm else 'ON'}"
            }
            requests.post(backup_gas_url, data=json.dumps(payload), headers={'Content-Type': 'text/plain;charset=utf-8'}, timeout=10)
        except Exception as e:
            print("Note on GAS audit log:", e)

    print("=== CBEO Bhinai VM Engine Execution Completed Successfully ===")


if __name__ == '__main__':
    main()
