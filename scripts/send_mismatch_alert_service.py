# -*- coding: utf-8 -*-
"""
CBEO Bhinai Portal - Universal Mismatch & Medium Notice Notification Service
Dispatches:
1. School Email (via Gmail SMTP) sent directly to School Official Mail + Principal Mail + SD Incharge + Censusbhinai.
2. Telegram Consolidated & Single Alert to Jitendra (579780800) formatted specifically to copy-paste directly to WhatsApp!

MANDATORY RULES:
- जिला सदैव अजमेर (AJMER) रहेगा। केकड़ी (KEKRI) कदापि प्रयोग न करें।
- ब्लॉक: भिनाय (BHINAI)
- कार्यालय: कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
"""

import os
import sys
import json
import smtplib
import datetime
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import requests
except ImportError:
    requests = None

try:
    import openpyxl
except ImportError:
    openpyxl = None


def get_notification_config():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg_file = os.path.join(root_dir, 'cbeo_notification_config.json')
    cfg = {}
    if os.path.exists(cfg_file):
        try:
            with open(cfg_file, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
        except Exception as e:
            print("Error loading config:", e)
    return cfg


def load_school_email_directory():
    """
    Extracts complete official school emails, principal emails, and SD incharge emails
    from 'school principal bhinai.xlsx'.
    """
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    xlsx_file = os.path.join(root_dir, 'school principal bhinai.xlsx')

    # Hardcoded fallback mappings for known senior sec and MGGS schools
    directory = {
        '221778': {
            'official': 'ggirlshrsecbhinai@gmail.com',
            'principal': 'hmggsskhataoli@gmail.com',
            'sd_incharge': 'manisha.akodiya95@gmail.com',
            'name': 'MAHATMA GANDHI GOVT. SCHOOL BHINAI'
        },
        '221770': {
            'official': 'ggssbandanwara@gmail.com',
            'principal': 'jaysinghkhatik56@gmail.com',
            'sd_incharge': 'monikaoberai82@gmail.com',
            'name': 'MAHATMA GANDHI GOVT. SCHOOL BANDANWARA'
        },
        '221753': {
            'official': 'deoliakalan105@gmail.com',
            'principal': 'rakeshbirawat1973@gmail.com',
            'sd_incharge': 'kanwadiaanil091@gmail.com',
            'name': 'MAHATMA GANDHI GOVT. SCHOOL DEOLIYA KALAN'
        },
        '221780': {
            'official': 'principalbhinai123@gmail.com',
            'principal': 'dhabaiajay79ka@gmail.com',
            'sd_incharge': 'vinodvansica8887@gmail.com',
            'name': 'GOVT. SENIOR SECONDARY SCHOOL BHINAI'
        },
        '221758': {
            'official': 'gssschampaneri@gmail.com',
            'principal': 'sharmalr1968@gmail.com',
            'sd_incharge': 'rajkumarbairwa261096@gmail.com',
            'name': 'GOVT. SENIOR SECONDARY SCHOOL CHAPANERI'
        },
        '221761': {
            'official': 'gssnimeda15815@gmail.com',
            'principal': 'ss3510069@gmail.com',
            'sd_incharge': 'nakwalsdeepal@gmail.com',
            'name': 'GOVT. SENIOR SECONDARY SCHOOL NIMEDA'
        },
        '221772': {
            'official': 'gsssnagola79@gmail.com',
            'principal': 'raovinod.22@gmail.com',
            'sd_incharge': 'sumanmeena8153@gmail.com',
            'name': 'GOVT. SENIOR SECONDARY SCHOOL NAGOLA'
        },
        '221756': {
            'official': 'pgsssnandsi@gmail.com',
            'principal': 'manojaadhi1981@gmail.com',
            'sd_incharge': 'sura.panwar@gmail.com',
            'name': 'GOVT. SENIOR SECONDARY SCHOOL NANDSI'
        }
    }

    if openpyxl and os.path.exists(xlsx_file):
        try:
            wb = openpyxl.load_workbook(xlsx_file, data_only=True)
            if 'Sheet1' in wb.sheetnames:
                ws1 = wb['Sheet1']
                for r in range(60, ws1.max_row + 1):
                    sch_name = str(ws1.cell(r, 6).value or '')
                    m = re.search(r'\((\d{6})\)', sch_name)
                    if m:
                        c = m.group(1)
                        p_em = str(ws1.cell(r, 12).value or '').strip()
                        sd_em = str(ws1.cell(r, 15).value or '').strip()
                        if c not in directory:
                            directory[c] = {'official': '', 'principal': '', 'sd_incharge': '', 'name': sch_name}
                        if p_em and '@' in p_em:
                            directory[c]['principal'] = p_em
                        if sd_em and '@' in sd_em:
                            directory[c]['sd_incharge'] = sd_em
        except Exception as e:
            print("Error parsing Excel directory:", e)

    return directory


def resolve_school_emails(school_code):
    dir_map = load_school_email_directory()
    rec = dir_map.get(str(school_code), {})
    
    official = rec.get('official') or ''
    principal = rec.get('principal') or ''
    sd_inc = rec.get('sd_incharge') or ''
    
    # Priority for primary To:
    primary = official if (official and '@' in official) else principal
    
    # Cc list
    cc_list = []
    for em in [principal, sd_inc, 'censusbhinai@gmail.com']:
        em_clean = em.strip()
        if em_clean and '@' in em_clean and em_clean.lower() != primary.lower() and em_clean.lower() not in [x.lower() for x in cc_list]:
            cc_list.append(em_clean)
            
    return primary, cc_list


def send_telegram_msg(msg_text):
    cfg = get_notification_config()
    tokens = [
        cfg.get('TELEGRAM_BOT_TOKEN'),
        '8815110844:AAFsMJHFepKpk83Wtm-JGqn8REV8XUQLgGY',
        '8890371766:AAHEtqYA0sPHbCAb3_tFaZxcxOlKaxmEJaY'
    ]
    chat_id = cfg.get('TELEGRAM_CHAT_ID') or '579780800'

    if not requests or not chat_id:
        return False, "Requests library or chat_id missing"

    last_err = ""
    for token in filter(None, tokens):
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': msg_text,
            'parse_mode': 'HTML'
        }
        for attempt in range(2):
            try:
                r = requests.post(url, json=payload, timeout=12)
                if r.status_code == 200 and r.json().get('ok'):
                    return True, "Telegram sent successfully"
                else:
                    last_err = f"{r.status_code}: {r.text}"
            except Exception as e:
                last_err = str(e)
    return False, last_err


def send_school_email(to_email, cc_emails, school_name, school_code, demand_title, flagged_fields, remarks, diff_text=""):
    cfg = get_notification_config()
    user = os.environ.get('EMAIL_USER') or cfg.get('EMAIL_USER') or 'censusbhinai@gmail.com'
    pwd = (os.environ.get('EMAIL_PASS') or cfg.get('EMAIL_PASS') or 'xesu vgxh qftc yewm').replace(' ', '')

    if not to_email or '@' not in to_email:
        return False, "Invalid school email address"

    subject = f"🚨 अति-आवश्यक: समान परीक्षा मांग संशोधन नोटिस - {school_name} ({school_code}) | CBEO भिनाय (अजमेर)"

    fields_html = "".join([f"<li style='color:#b91c1c; font-weight:700; margin-bottom:5px'>{f}</li>" for f in flagged_fields]) if flagged_fields else "<li>मांग प्रपत्र के समस्त आंकड़े पुनः जांचें</li>"

    diff_banner_html = f"""
    <div style="background:#fee2e2; border:2px dashed #dc2626; border-radius:8px; padding:12px 16px; margin:14px 0; color:#991b1b; font-size:15px; font-weight:bold;">
      ⚠️ मुख्य विसंगति: {diff_text}
    </div>
    """ if diff_text else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f1f5f9; padding:20px; margin:0;">
      <div style="max-width:650px; margin:0 auto; background:#ffffff; border-radius:12px; border:2px solid #ef4444; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color:#ffffff; padding:20px 24px; text-align:center;">
          <h2 style="margin:0; font-size:20px; letter-spacing:0.5px;">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</h2>
          <div style="font-size:14px; opacity:0.95; margin-top:4px;">पंचायत समिति परिसर, भिनाय, <b>जिला: अजमेर (राजस्थान)</b></div>
          <div style="display:inline-block; margin-top:12px; background:rgba(255,255,255,0.25); padding:4px 14px; border-radius:20px; font-size:12px; font-weight:bold; letter-spacing:0.3px;">
            🚨 प्रपत्र संशोधन एवं मिलान सुधार नोटिस (पोर्टल खुला)
          </div>
        </div>

        <!-- Body -->
        <div style="padding:24px 28px;">
          <p style="font-size:15px; color:#1e293b; margin-top:0;">
            मान्यवर संस्था प्रधान / प्रभारी महोदय,<br>
            <b>{school_name} (शा.दा. कोड: {school_code})</b>
          </p>
          
          <div style="background:#fef2f2; border-left:4px solid #ef4444; border-radius:6px; padding:12px 16px; margin:16px 0; color:#991b1b; font-size:14px; line-height:1.6;">
            <b>सूचना मांग:</b> {demand_title}<br>
            आपके द्वारा प्रेषित प्रपत्र का कार्यालय स्तर पर परीक्षण किए जाने पर शाला दर्पण नामांकन से भिन्नता पाई गई है।
          </div>

          {diff_banner_html}

          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px 18px; margin:16px 0;">
            <div style="font-weight:bold; color:#92400e; font-size:14px; margin-bottom:8px;">
              ⚠️ चिह्नित त्रुटिपूर्ण / संशोधन योग्य फील्ड्स:
            </div>
            <ul style="margin:0; padding-left:20px; color:#78350f; font-size:13.5px;">
              {fields_html}
            </ul>
          </div>

          {f'''<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin:16px 0; font-size:13.5px; color:#334155; line-height:1.6;">
            <b>कार्यालय निर्देश / स्पष्टीकरण:</b><br>{remarks}
          </div>''' if remarks else ''}

          <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:14px 18px; margin:20px 0; color:#065f46; font-size:14px; line-height:1.6;">
            <b>🔓 विशेष संपादन सुविधा:</b> आपके विद्यालय के लिए पोर्टल पर इस प्रपत्र में संपादन (Custom Edit) की सुविधा खोल दी गई है। कृपया तुरंत पोर्टल पर लॉगिन कर आंकड़े सही करें और प्रपत्र पुनः सबमिट करें।
          </div>

          <div style="text-align:center; margin-top:25px; margin-bottom:10px;">
            <a href="https://jit9763.github.io/cbeo-bhinai-portal/" style="background:#dc2626; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px; display:inline-block; box-shadow:0 4px 12px rgba(220,38,38,0.3);">
              📝 पोर्टल पर तुरंत सुधार करें &rarr;
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 24px; text-align:center; font-size:12px; color:#64748b;">
          यह संदेश CBEO भिनाय (अजमेर) आधिकारिक पोर्टल से अधिकृत रूप से भेजा गया है।<br>
          तकनीकी सहायता: 9928254317 | कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"CBEO Bhinai (Ajmer) <{user}>"
    msg['To'] = to_email
    if cc_emails:
        msg['Cc'] = ", ".join(cc_emails)
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))

    all_recipients = [to_email] + cc_emails

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=15)
        server.starttls()
        server.login(user, pwd)
        server.sendmail(user, all_recipients, msg.as_string())
        server.quit()
        return True, f"Email sent to {to_email} (Cc: {len(cc_emails)})"
    except Exception as e:
        return False, str(e)


def process_mismatch_dispatch(data):
    mode = data.get('mode', 'batch') # 'single' or 'batch'
    demand_id = data.get('demand_id', 'saman_pariksha_2026')
    demand_title = data.get('demand_title', 'जिला समान परीक्षा 2026-27 प्रश्न पत्र मांग पत्रक')
    now_str = datetime.datetime.now().strftime('%d.%m.%Y, %I:%M %p')

    results = {
        'success': True,
        'emails_sent': 0,
        'emails_failed': 0,
        'telegram_sent': False,
        'telegram_msg': '',
        'errors': []
    }

    if mode == 'single':
        school_code = str(data.get('school_code', ''))
        school_name = data.get('school_name', '')
        peeo_name = data.get('peeo_name', '')
        diff_text = data.get('diff_text', '')
        flagged_fields = data.get('flagged_fields', [])
        remarks = data.get('remarks', '').strip()

        # Resolve emails
        to_email, cc_emails = resolve_school_emails(school_code)
        if data.get('school_email'):
            to_email = data['school_email']

        if to_email:
            ok, emsg = send_school_email(to_email, cc_emails, school_name, school_code, demand_title, flagged_fields, remarks, diff_text)
            if ok:
                results['emails_sent'] += 1
            else:
                results['emails_failed'] += 1
                results['errors'].append(f"Email {school_code} error: {emsg}")

        # Telegram message
        fields_text = "\n".join([f"  ❌ {f}" for f in flagged_fields]) if flagged_fields else "  ❌ प्रपत्र डेटा मिसमैच"
        diff_str = f"⚠️ <b>त्रुटि विवरण:</b> {diff_text}\n" if diff_text else ""

        tg_html = f"""🚨 <b>अति-आवश्यक सूचना: प्रपत्र डेटा संशोधन नोटिस</b>
🏛️ <b>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</b>

📋 <b>मांग प्रपत्र:</b> {demand_title}
🏫 <b>विद्यालय:</b> {school_name}
🔢 <b>शा.दा. कोड:</b> {school_code}
📌 <b>PEEO परिक्षेत्र:</b> {peeo_name}
🕒 <b>दिनांक/समय:</b> {now_str}

{diff_str}
⚠️ <b>चिह्नित मिसमैच / संशोधन फील्ड्स:</b>
{fields_text}

📝 <b>कार्यालय निर्देश:</b>
{remarks if remarks else 'कृपया शाला दर्पण के वास्तविक आंकड़ों अनुसार डेटा सत्यापित कर सुधारें।'}

🔓 <b>कार्रवाई:</b> इस विद्यालय के लिए पोर्टल पर संपादन (Custom Edit) खोल दिया गया है। तुरंत सुधार कर सबमिट करें।

🌐 <b>पोर्टल लिंक:</b> https://jit9763.github.io/cbeo-bhinai-portal/"""

        ok_tg, tg_err = send_telegram_msg(tg_html)
        results['telegram_sent'] = ok_tg
        results['telegram_msg'] = tg_html
        if not ok_tg:
            results['errors'].append(f"Telegram error: {tg_err}")

    elif mode == 'batch':
        schools = data.get('schools', [])
        common_remarks = data.get('common_remarks', '').strip()

        school_summary_lines = []
        for idx, s in enumerate(schools, 1):
            s_code = str(s.get('school_code', ''))
            s_name = s.get('school_name', '')
            s_peeo = s.get('peeo_name', '')
            s_diff_text = s.get('diff_text', '')
            s_fields = s.get('flagged_fields', [])
            s_rem = s.get('remarks', '') or common_remarks

            to_email, cc_emails = resolve_school_emails(s_code)
            if s.get('email'):
                to_email = s['email']

            # Send Email directly to School
            if to_email:
                ok, emsg = send_school_email(to_email, cc_emails, s_name, s_code, demand_title, s_fields, s_rem, s_diff_text)
                if ok:
                    results['emails_sent'] += 1
                else:
                    results['emails_failed'] += 1
                    results['errors'].append(f"Email {s_code} error: {emsg}")

            # Specific wording in Telegram per user rule
            # E.g. "पेपर मांग शाला दर्पण में नामांकन से एक ज्यादा है (मांग: 87, शाला दर्पण: 86)"
            item_text = f"{idx}. <b>{s_name}</b> ({s_code})\n"
            item_text += f"   📌 <i>PEEO: {s_peeo}</i>\n"
            if s_diff_text:
                item_text += f"   ⚠️ <b>विसंगति:</b> {s_diff_text}\n"
            if s_rem:
                item_text += f"   📝 <i>सुधार: {s_rem}</i>"

            school_summary_lines.append(item_text)

        schools_block = "\n\n".join(school_summary_lines)

        tg_html = f"""🚨 <b>समेकित मिसमैच एवं संशोधन सूचना: समान परीक्षा 2026-27</b>
🏛️ <b>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</b>

📋 <b>मांग प्रपत्र:</b> {demand_title}
📅 <b>दिनांक:</b> {now_str}
👥 <b>कुल चिह्नित विद्यालय:</b> {len(schools)} स्कूल (संशोधन खुला)

निम्न विद्यालयों के प्रपत्र में शाला दर्पण अनुसार डेटा अंतर / MGGS माध्यम संशोधन अपेक्षित है, जिसके लिए पोर्टल पर संपादन (Custom Edit) खोल दिया गया है:

{schools_block}

📢 <b>विशेष निर्देश (MGGS एवं सीनियर सेकेंडरी स्कूल):</b>
1. <b>महात्मा गांधी (MGGS) विद्यालय:</b> कक्षा 9 व 10 में हिंदी एवं अंग्रेजी माध्यमवार पृथक-पृथक मांग तथा कक्षा 11 व 12 में भी ऐच्छिक विषयों के प्रश्न पत्र माध्यम (हिंदी/अंग्रेजी) की स्थिति स्पष्ट करते हुए प्रपत्र सबमिट करें।
2. <b>नामांकन अंतर वाले विद्यालय:</b> शाला दर्पण पर वास्तविक नामांकन अनुसार पेपर मांग शुद्ध करें ताकि अनावश्यक पेपर छपाई या कमी की स्थिति न रहे।

🌐 <b>पोर्टल लिंक (संशोधन हेतु):</b> https://jit9763.github.io/cbeo-bhinai-portal/"""

        ok_tg, tg_err = send_telegram_msg(tg_html)
        results['telegram_sent'] = ok_tg
        results['telegram_msg'] = tg_html
        if not ok_tg:
            results['errors'].append(f"Telegram error: {tg_err}")

    return results


def run_full_mismatch_dispatch():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    settings_file = os.path.join(root_dir, 'saman_mismatch_settings.json')
    
    with open(settings_file, 'r', encoding='utf-8') as f:
        settings = json.load(f)

    custom_schools = settings.get('custom_edit_schools', [])
    m_details = settings.get('mismatch_details', {})

    schools_payload = []
    for scode in custom_schools:
        d = m_details.get(scode, {})
        schools_payload.append({
            'school_code': scode,
            'school_name': d.get('school_name', f"School {scode}"),
            'peeo_name': d.get('peeo_name', 'BHINAI'),
            'diff_text': d.get('diff_text', ''),
            'flagged_fields': d.get('flagged_fields', []),
            'remarks': d.get('reason', '')
        })

    payload = {
        'mode': 'batch',
        'demand_id': 'saman_pariksha_2026',
        'demand_title': 'जिला समान परीक्षा 2026-27 प्रश्न पत्र मांग पत्रक',
        'common_remarks': 'कृपया शाला दर्पण के वास्तविक आंकड़ों एवं MGGS माध्यम अनुसार डेटा सत्यापित कर आज ही पोर्टल पर पुनः सबमिट करें।',
        'schools': schools_payload
    }

    res = process_mismatch_dispatch(payload)
    return res


if __name__ == '__main__':
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        res = run_full_mismatch_dispatch()
        print(json.dumps(res, ensure_ascii=False, indent=2))
    elif len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
        res = process_mismatch_dispatch(data)
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        # Default run full dispatch
        res = run_full_mismatch_dispatch()
        print(json.dumps(res, ensure_ascii=False, indent=2))
