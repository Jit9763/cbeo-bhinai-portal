# -*- coding: utf-8 -*-
"""
CBEO Bhinai Portal - Broadcast Demand Email Service
Dispatches official demand instructions and custom messages to target schools and PEEOs via Gmail SMTP.
MANDATORY RULE: जिला सदैव अजमेर (AJMER) रहेगा। केकड़ी (KEKRI) कदापि प्रयोग न करें।
"""

import os
import json
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import requests
except ImportError:
    requests = None


def get_smtp_credentials():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    cfg_file = os.path.join(root_dir, 'cbeo_notification_config.json')
    cfg = {}
    if os.path.exists(cfg_file):
        try:
            with open(cfg_file, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
        except Exception as e:
            print("Error reading notification config:", e)

    user = os.environ.get('EMAIL_USER') or cfg.get('EMAIL_USER') or 'censusbhinai@gmail.com'
    pwd = (os.environ.get('EMAIL_PASS') or cfg.get('EMAIL_PASS') or 'loer nsav kmis qzrc').replace(' ', '')
    return user, pwd


def broadcast_demand_emails(req_data):
    sender_email, sender_pass = get_smtp_credentials()
    if not sender_email or not sender_pass:
        return {'success': False, 'message': 'SMTP क्रेडेंशियल्स (EMAIL_USER / EMAIL_PASS) अनुपलब्ध हैं।'}

    demand_title = req_data.get('demand_title', 'मांग प्रपत्र')
    demand_id = req_data.get('demand_id', '')
    due_date = req_data.get('due_date', 'यथाशीघ्र')
    priority = req_data.get('priority', 'सामान्य')
    collection_level = req_data.get('collection_level', 'school')
    level_label = 'विद्यालय स्तर' if collection_level == 'school' else 'PEEO स्तर'

    subject = req_data.get('subject') or f"🏛️ CBEO भिनाय: नवीन मांग प्रपत्र आमंत्रण - {demand_title}"
    custom_msg = req_data.get('custom_message', '').strip()
    schools = req_data.get('schools', [])

    if not schools:
        return {'success': False, 'message': 'कोई लक्षित विद्यालय चयनित नहीं है।'}

    now_str = datetime.datetime.now().strftime('%d-%m-%Y %I:%M %p')

    # Convert custom message linebreaks to HTML
    custom_msg_html = "<br>".join([line.strip() for line in custom_msg.split("\n") if line.strip()]) if custom_msg else "कृपया निर्धारित प्रारूप में वांछित सूचना समय सीमा में पोर्टल पर ऑनलाइन प्रेषित करना सुनिश्चित करें।"

    sent_schools = []
    failed_schools = []
    skipped_no_email = []

    try:
        # Connect to Gmail SMTP
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20)
        server.login(sender_email, sender_pass)
    except Exception as conn_err:
        return {'success': False, 'message': f'Gmail SMTP लॉगिन विफल: {str(conn_err)}'}

    for sch in schools:
        code = str(sch.get('code') or sch.get('shala_darpan_code') or '').strip()
        name = sch.get('name') or sch.get('school_name') or 'विद्यालय'
        peeo = sch.get('peeo') or sch.get('peeo_name') or 'PEEO'
        email = (sch.get('email') or '').strip()
        principal = sch.get('principal') or sch.get('principal_name') or 'संस्था प्रधान'

        if not email or '@' not in email:
            skipped_no_email.append({'code': code, 'name': name, 'peeo': peeo, 'reason': 'ईमेल पता अनुपलब्ध'})
            continue

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f1f5f9; margin:0; padding:20px; color:#1e293b;">
            <div style="max-width:720px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
                
                <!-- Official Header -->
                <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#ffffff; padding:24px 28px; text-align:center; border-bottom:4px solid #f59e0b;">
                    <h2 style="margin:0 0 6px 0; font-size:20px; font-weight:bold; letter-spacing:0.5px;">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
                    <div style="font-size:13px; color:#93c5fd; font-weight:600;">जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (BHINAI)</div>
                    <div style="margin-top:10px; display:inline-block; background:rgba(255,255,255,0.15); padding:4px 14px; border-radius:20px; font-size:12px; color:#fde047; font-weight:600;">
                        📌 आधिकारिक सूचना मांग प्रपत्र आमंत्रण • {now_str}
                    </div>
                </div>

                <!-- Recipient School Box -->
                <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:16px 28px;">
                    <div style="font-size:12px; color:#64748b; text-transform:uppercase; font-weight:700;">प्राप्तकर्ता संस्था प्रधान / विद्यालय:</div>
                    <div style="font-size:16px; font-weight:bold; color:#0f172a; margin-top:2px;">{name}</div>
                    <div style="font-size:13px; color:#334155; margin-top:4px;">
                        शाला दर्पण कोड: <code style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:bold; color:#1d4ed8;">{code}</code> | 
                        संबंधित PEEO: <strong>{peeo}</strong> | 
                        संस्था प्रधान: <strong>{principal}</strong>
                    </div>
                </div>

                <div style="padding:24px 28px;">
                    
                    <!-- Demand Info Card -->
                    <div style="background:#eff6ff; border-left:4px solid #2563eb; border-radius:0 8px 8px 0; padding:16px 20px; margin-bottom:20px;">
                        <h3 style="margin:0 0 8px 0; color:#1e3a8a; font-size:17px; font-weight:bold;">
                            📋 विषय: {demand_title}
                        </h3>
                        <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:13px; color:#334155; margin-top:10px;">
                            <div>📅 <strong>अंतिम तिथि:</strong> <span style="color:#b91c1c; font-weight:bold;">{due_date}</span></div>
                            <div>⚡ <strong>प्राथमिकता:</strong> <span style="color:#d97706; font-weight:bold;">{priority}</span></div>
                            <div>🏛️ <strong>स्तर:</strong> <span style="color:#1d4ed8; font-weight:bold;">{level_label}</span></div>
                        </div>
                    </div>

                    <!-- Custom Message Box -->
                    <div style="margin-bottom:22px;">
                        <h4 style="margin:0 0 10px 0; color:#0f172a; font-size:14px; font-weight:700;">
                            📝 CBEO कार्यालय का आधिकारिक संदेश / निर्देश:
                        </h4>
                        <div style="background:#fafafa; border:1px solid #e2e8f0; border-radius:8px; padding:16px 18px; font-size:14px; line-height:1.6; color:#1e293b;">
                            {custom_msg_html}
                        </div>
                    </div>

                    <!-- Step-by-Step Instructions -->
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
                        <h4 style="margin:0 0 10px 0; color:#065f46; font-size:14px; font-weight:700;">
                            👉 पोर्टल पर सूचना प्रपत्र भरने की प्रक्रिया:
                        </h4>
                        <ol style="margin:0; padding-left:20px; font-size:13px; line-height:1.6; color:#064e3b;">
                            <li>नीचे दिए गए बटन पर क्लिक करके CBEO भिनाय आधिकारिक पोर्टल खोलें।</li>
                            <li>अपने विद्यालय के <strong>शाला दर्पण कोड</strong> एवं अधिकृत पासवर्ड से लॉगिन करें।</li>
                            <li><strong>'📋 {demand_title}'</strong> टैब पर जाएं और <strong>'सूचना प्रपत्र भरें'</strong> बटन दबाएं।</li>
                            <li>वांछित सूचना ध्यानपूर्वक भरें, संस्था प्रधान अधिकृत डिजिटल हस्ताक्षर करें एवं सबमिट करें।</li>
                            <li>सफलतापूर्वक सबमिट होने के पश्चात अधिकृत <strong>A4 PDF प्रपत्र</strong> डाउनलोड कर रिकॉर्ड में सुरक्षित रखें।</li>
                        </ol>
                    </div>

                    <!-- Action Button -->
                    <div style="text-align:center; margin:28px 0 10px 0;">
                        <a href="https://jit9763.github.io/cbeo-bhinai-portal/" style="display:inline-block; background:linear-gradient(135deg, #1e3a8a, #2563eb); color:#ffffff; font-weight:bold; font-size:15px; padding:14px 32px; border-radius:8px; text-decoration:none; box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                            🌐 पोर्टल खोलें एवं सूचना प्रपत्र भरें
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background:#f8fafc; padding:16px 28px; border-top:1px solid #e2e8f0; font-size:11px; color:#64748b; text-align:center; line-height:1.5;">
                    कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), ब्लॉक भिनाय, जिला अजमेर (राजस्थान)<br>
                    यह संदेश CBEO कार्यालय द्वारा अधिकृत व्यवस्थापक (जितेन्द्र कुमार) के माध्यम से प्रेषित किया गया है।
                </div>
            </div>
        </body>
        </html>
        """

        msg = MIMEMultipart('alternative')
        msg['From'] = f"CBEO भिनाय (अजमेर) <{sender_email}>"
        msg['To'] = email
        msg['Subject'] = subject
        msg.attach(MIMEText(f"CBEO भिनाय: {demand_title}\nकृपया पोर्टल पर जाकर समय सीमा {due_date} तक प्रपत्र भरें:\nhttps://jit9763.github.io/cbeo-bhinai-portal/", 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        try:
            server.sendmail(sender_email, [email], msg.as_string())
            sent_schools.append({'code': code, 'name': name, 'email': email, 'peeo': peeo})
        except Exception as send_err:
            failed_schools.append({'code': code, 'name': name, 'email': email, 'error': str(send_err)})

    # Also send a consolidated broadcast summary copy to sender (censusbhinai@gmail.com)
    try:
        summary_html = f"""
        <div style="font-family:sans-serif; padding:15px;">
            <h3>🏛️ CBEO भिनाय: मांग प्रपत्र ईमेल प्रसारण रिपोर्ट</h3>
            <p><strong>मांग शीर्षक:</strong> {demand_title}</p>
            <p><strong>प्रसारण समय:</strong> {now_str} IST</p>
            <p><strong>सफलतापूर्वक भेजे गए:</strong> <span style="color:green; font-weight:bold;">{len(sent_schools)}</span></p>
            <p><strong>ईमेल अनुपलब्ध (स्किप):</strong> <span style="color:orange; font-weight:bold;">{len(skipped_no_email)}</span></p>
            <p><strong>असफल:</strong> <span style="color:red; font-weight:bold;">{len(failed_schools)}</span></p>
            <hr>
            <h4>भेजे गए विद्यालयों की सूची:</h4>
            <ul>
                {"".join([f"<li>{s['name']} ({s['code']}) - {s['email']}</li>" for s in sent_schools])}
            </ul>
        </div>
        """
        sum_msg = MIMEMultipart('alternative')
        sum_msg['From'] = f"CBEO भिनाय सिस्टम <{sender_email}>"
        sum_msg['To'] = sender_email
        sum_msg['Subject'] = f"📊 प्रसारण रिपोर्ट: {demand_title} ({len(sent_schools)} सफल)"
        sum_msg.attach(MIMEText(summary_html, 'html', 'utf-8'))
        server.sendmail(sender_email, [sender_email], sum_msg.as_string())
    except Exception as e:
        print("Note on admin summary email:", e)

    try:
        server.quit()
    except Exception:
        pass

    # Log to Google Sheets Master Backup Audit
    backup_gas_url = "https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec"
    if requests:
        try:
            payload = {
                "action": "log_audit",
                "user": "जितेन्द्र कुमार (व्यवस्थापक)",
                "action_name": "मांग प्रपत्र विद्यालय ईमेल प्रसारण",
                "target": demand_title,
                "details": f"{len(sent_schools)} सफल, {len(skipped_no_email)} स्किप, {len(failed_schools)} असफल | {now_str} IST"
            }
            requests.post(backup_gas_url, data=json.dumps(payload), headers={'Content-Type': 'text/plain;charset=utf-8'}, timeout=8)
        except Exception as e:
            print("Audit log note:", e)

    return {
        'success': True,
        'sent_count': len(sent_schools),
        'failed_count': len(failed_schools),
        'skipped_count': len(skipped_no_email),
        'sent_schools': sent_schools,
        'skipped_schools': skipped_no_email,
        'message': f"सफलता! कुल {len(sent_schools)} विद्यालयों को ईमेल प्रेषित किया गया ({len(skipped_no_email)} के ईमेल पते अनुपलब्ध थे)।"
    }


if __name__ == '__main__':
    # Quick test
    res = broadcast_demand_emails({
        'demand_title': 'परीक्षण सूचना मांग (Test Demand)',
        'due_date': '10 अक्टूबर 2026',
        'priority': 'उच्च',
        'collection_level': 'school',
        'custom_message': 'यह एक परीक्षण प्रसारण संदेश है।',
        'schools': [
            {'code': '8140', 'name': 'कार्यालय CBEO भिनाय', 'peeo': 'CBEO', 'email': 'censusbhinai@gmail.com'}
        ]
    })
    print("Test broadcast result:", res)
