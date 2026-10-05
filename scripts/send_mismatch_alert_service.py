# -*- coding: utf-8 -*-
"""
CBEO Bhinai Portal - Universal Mismatch Notification Service
Dispatches:
1. School Email (via Gmail SMTP) detailing flagged mismatch fields and edit unlock notice.
2. Telegram Alert to Jitendra (579780800) formatted specifically to copy-paste directly to WhatsApp!

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
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import requests
except ImportError:
    requests = None


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
                r = requests.post(url, json=payload, timeout=10)
                if r.status_code == 200 and r.json().get('ok'):
                    return True, "Telegram sent successfully"
                else:
                    last_err = f"{r.status_code}: {r.text}"
            except Exception as e:
                last_err = str(e)
    return False, last_err


def send_school_email(to_email, school_name, school_code, demand_title, flagged_fields, remarks):
    cfg = get_notification_config()
    user = os.environ.get('EMAIL_USER') or cfg.get('EMAIL_USER') or 'censusbhinai@gmail.com'
    pwd = (os.environ.get('EMAIL_PASS') or cfg.get('EMAIL_PASS') or 'xesu vgxh qftc yewm').replace(' ', '')

    if not to_email or '@' not in to_email:
        return False, "Invalid school email address"

    subject = f"🚨 अति-आवश्यक: डेटा मिसमैच सुधार नोटिस - {school_name} ({school_code}) | CBEO भिनाय (अजमेर)"

    fields_html = "".join([f"<li style='color:#b91c1c; font-weight:700; margin-bottom:4px'>{f}</li>" for f in flagged_fields]) if flagged_fields else "<li>समस्त प्रपत्र आंकड़े पुनः जांचें</li>"

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
            🚨 प्रपत्र डेटा मिसमैच सुधार नोटिस (संशोधन खुला)
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
            आपके द्वारा प्रेषित प्रपत्र का कार्यालय स्तर पर परीक्षण किए जाने पर कतिपय फील्ड्स में <b>डेटा मिसमैच / विसंगति</b> पाई गई है।
          </div>

          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px 18px; margin:16px 0;">
            <div style="font-weight:bold; color:#92400e; font-size:14px; margin-bottom:8px;">
              ⚠️ चिह्नित त्रुटिपूर्ण / मिसमैच फील्ड्स:
            </div>
            <ul style="margin:0; padding-left:20px; color:#78350f; font-size:13.5px;">
              {fields_html}
            </ul>
          </div>

          {f'''<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin:16px 0; font-size:13.5px; color:#334155;">
            <b>कार्यालय टिप्पणी / निर्देश:</b><br>{remarks}
          </div>''' if remarks else ''}

          <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:14px 18px; margin:20px 0; color:#065f46; font-size:14px;">
            <b>🔓 विशेष संपादन सुविधा:</b> आपके विद्यालय के लिए पोर्टल पर इस प्रपत्र में संपादन (Edit) की सुविधा खोल दी गई है। कृपया तुरंत पोर्टल पर लॉगिन कर आंकड़े सही करें और प्रपत्र पुनः सबमिट करें।
          </div>

          <div style="text-align:center; margin-top:25px; margin-bottom:10px;">
            <a href="https://jit9763.github.io/cbeo-bhinai-portal/" style="background:#dc2626; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px; display:inline-block; box-shadow:0 4px 12px rgba(220,38,38,0.3);">
              📝 पोर्टल पर तुरंत सुधार करें &rarr;
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 24px; text-align:center; font-size:12px; color:#64748b;">
          यह संदेश CBEO भिनाय (अजमेर) आधिकारिक पोर्टल से स्वतः जनरेट किया गया है।<br>
          तकनीकी सहायता: 9928254317 | कार्यालय CBEO भिनाय (अजमेर)
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"CBEO Bhinai (Ajmer) <{user}>"
    msg['To'] = to_email
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=15)
        server.starttls()
        server.login(user, pwd)
        server.sendmail(user, [to_email], msg.as_string())
        server.quit()
        return True, "Email sent successfully"
    except Exception as e:
        return False, str(e)


def process_mismatch_dispatch(data):
    mode = data.get('mode', 'single') # 'single' or 'batch'
    demand_id = data.get('demand_id', '')
    demand_title = data.get('demand_title', 'सूचना मांग')
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
        school_code = data.get('school_code', '')
        school_name = data.get('school_name', '')
        peeo_name = data.get('peeo_name', '')
        school_email = data.get('school_email', '')
        flagged_fields = data.get('flagged_fields', [])
        remarks = data.get('remarks', '').strip()

        # 1. Send Email to school if email provided
        if school_email:
            ok, emsg = send_school_email(school_email, school_name, school_code, demand_title, flagged_fields, remarks)
            if ok:
                results['emails_sent'] += 1
            else:
                results['emails_failed'] += 1
                results['errors'].append(f"Email error: {emsg}")

        # 2. Build Telegram message (Copy-Paste ready for WhatsApp!)
        fields_text = "\n".join([f"  ❌ {f}" for f in flagged_fields]) if flagged_fields else "  ❌ प्रपत्र डेटा मिसमैच"
        
        tg_html = f"""🚨 <b>अति-आवश्यक सूचना: प्रपत्र डेटा मिसमैच सुधार नोटिस</b>
🏛️ <b>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</b>

📋 <b>मांग प्रपत्र:</b> {demand_title}
🏫 <b>विद्यालय:</b> {school_name}
🔢 <b>शा.दा. कोड:</b> {school_code}
📌 <b>PEEO परिक्षेत्र:</b> {peeo_name}
🕒 <b>दिनांक/समय:</b> {now_str}

⚠️ <b>चिह्नित मिसमैच / त्रुटि फील्ड्स:</b>
{fields_text}

📝 <b>कार्यालय टिप्पणी / निर्देश:</b>
{remarks if remarks else 'कृपया शाला दर्पण के वास्तविक आंकड़ों अनुसार डेटा सत्यापित कर सुधारें।'}

🔓 <b>कार्रवाई:</b> इस विद्यालय के लिए पोर्टल पर संपादन (Edit) सुविधा खोल दी गई है। तुरंत लॉगिन कर संशोधन करें।

🌐 <b>पोर्टल लिंक:</b> https://jit9763.github.io/cbeo-bhinai-portal/"""

        ok_tg, tg_err = send_telegram_msg(tg_html)
        results['telegram_sent'] = ok_tg
        results['telegram_msg'] = tg_html
        if not ok_tg:
            results['errors'].append(f"Telegram error: {tg_err}")

    elif mode == 'batch':
        schools = data.get('schools', []) # List of school objects
        common_remarks = data.get('common_remarks', '').strip()

        school_summary_lines = []
        for s in schools:
            s_code = s.get('school_code', '')
            s_name = s.get('school_name', '')
            s_email = s.get('email', '')
            s_fields = s.get('flagged_fields', [])
            s_rem = s.get('remarks', '') or common_remarks
            s_peeo = s.get('peeo_name', '')

            # Email dispatch
            if s_email:
                ok, emsg = send_school_email(s_email, s_name, s_code, demand_title, s_fields, s_rem)
                if ok:
                    results['emails_sent'] += 1
                else:
                    results['emails_failed'] += 1
                    results['errors'].append(f"Email {s_code}: {emsg}")

            f_str = ", ".join(s_fields) if s_fields else "डेटा मिसमैच"
            school_summary_lines.append(f"• <b>{s_name}</b> ({s_code}) - <i>PEEO {s_peeo}</i>\n  ⚠️ <i>त्रुटि: {f_str}</i>")

        # Consolidated Telegram Message (Ready to forward to PEEO WhatsApp groups!)
        schools_block = "\n\n".join(school_summary_lines)
        tg_html = f"""🚨 <b>समेकित मिसमैच सूचना: प्रपत्र डेटा सुधार नोटिस</b>
🏛️ <b>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</b>

📋 <b>मांग प्रपत्र:</b> {demand_title}
📅 <b>दिनांक:</b> {now_str}
👥 <b>कुल चिह्नित विद्यालय:</b> {len(schools)} स्कूल

निम्न विद्यालयों के प्रपत्र में शाला दर्पण अनुसार डेटा मिसमैच / विसंगति पाई गई है एवं उनके लिए पोर्टल पर संपादन (Edit) खोल दिया गया है:

{schools_block}

📝 <b>कार्यालय निर्देश:</b>
{common_remarks if common_remarks else 'संबंधित संस्था प्रधान / PEEO कृपया आज ही पोर्टल पर लॉगिन कर मांग पत्रक में सुधार कर पुनः सबमिट करें।'}

🌐 <b>पोर्टल लिंक:</b> https://jit9763.github.io/cbeo-bhinai-portal/"""

        ok_tg, tg_err = send_telegram_msg(tg_html)
        results['telegram_sent'] = ok_tg
        results['telegram_msg'] = tg_html
        if not ok_tg:
            results['errors'].append(f"Telegram error: {tg_err}")

    return results


if __name__ == '__main__':
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    # CLI / Pipe execution support
    if len(sys.argv) > 1:
        req_file = sys.argv[1]
        with open(req_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        res = process_mismatch_dispatch(data)
        print(json.dumps(res, ensure_ascii=False))
    else:
        # Read from stdin
        raw = sys.stdin.read()
        if raw.strip():
            data = json.loads(raw)
            res = process_mismatch_dispatch(data)
            print(json.dumps(res, ensure_ascii=False))
        else:
            print(json.dumps({'success': False, 'error': 'No input data'}))

