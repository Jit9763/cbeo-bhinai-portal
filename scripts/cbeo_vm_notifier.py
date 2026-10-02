# -*- coding: utf-8 -*-
"""
CBEO Bhinai Portal - VM Notification & Automated Reminder Engine
Executes on GitHub Actions VM at 12:00 PM, 2:00 PM, 4:00 PM, 8:00 PM IST
or on manual workflow dispatch.
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

    # 1. Load Master Data
    data_path = os.path.join(os.path.dirname(__file__), '..', 'master_cbeo_data.json')
    if not os.path.exists(data_path):
        print(f"ERROR: master_cbeo_data.json not found at {data_path}")
        return

    with open(data_path, 'r', encoding='utf-8') as f:
        master_data = json.load(f)

    schools = master_data.get('schools_56', []) or master_data.get('schools', [])
    demands = master_data.get('demands', [])
    peeos = master_data.get('peeos', [])

    print(f"Loaded {len(schools)} master schools, {len(peeos)} PEEOs, and {len(demands)} demands.")

    # 2. Compile Active Demands & Pending Report
    active_demands = [d for d in demands if not d.get('archived')]

    report_lines = []
    report_lines.append(f"# 🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)")
    report_lines.append(f"### ⏰ स्वचालित लंबित सूचना रिपोर्ट (VM Automated Compliance Report)")
    report_lines.append(f"**दिनांक व समय:** {time_str} IST | **जिला:** अजमेर (AJMER) | **ब्लॉक:** भिनाय (BHINAI)\n")

    telegram_summary = (
        f"🏛️ *कार्यालय CBEO भिनाय (अजमेर)*\n"
        f"⏰ *दैनिक लंबित प्रपत्र रिपोर्ट ({time_str} IST)*\n\n"
    )

    if not active_demands:
        report_lines.append("✓ वर्तमान में कोई सक्रिय मांग प्रपत्र लंबित नहीं है।")
        telegram_summary += "✓ वर्तमान में सभी सूचना प्रपत्र 100% पूर्ण हैं।"
    else:
        for d in active_demands:
            title = d.get('title', 'सूचना')
            due_date = d.get('dueDate', 'यथाशीघ्र')
            priority = d.get('priority', 'सामान्य')
            cols_count = len(d.get('columns', []))

            report_lines.append(f"## 📋 {title}")
            report_lines.append(f"- **प्राथमिकता:** {priority} | **अंतिम तिथि:** {due_date} | **कॉलम:** {cols_count}")
            report_lines.append(f"- **संकलन स्तर:** {d.get('collectionLevel', 'peeo').upper()} Level")

            telegram_summary += (
                f"📌 *मांग:* {title}\n"
                f"📅 *अंतिम तिथि:* {due_date} | ⚡ *प्राथमिकता:* {priority}\n"
                f"📊 *लंबित स्थिति:* कृपया संबंधित PEEO/स्कूल तुरंत पोर्टल पर सबमिट करें।\n\n"
            )

    telegram_summary += (
        f"🌐 *पोर्टल लिंक:* https://jit9763.github.io/cbeo-bhinai-portal/\n"
        f"*(नोट: यह रिपोर्ट GitHub Actions VM द्वारा स्वचालित रूप से प्रेषित की गई है)*"
    )

    report_content = "\n".join(report_lines)

    # 3. Save report artifact
    out_dir = os.path.dirname(__file__)
    report_file = os.path.join(out_dir, 'latest_report.md')
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_content)
    print(f"Saved latest report to {report_file}")

    # GitHub Actions Step Summary
    summary_file = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_file:
        with open(summary_file, 'a', encoding='utf-8') as f:
            f.write(report_content)

    # 4. Telegram Notification (if configured in secrets)
    tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')

    if tg_token and tg_chat_id and requests:
        try:
            print("Sending Telegram compliance notification...")
            tg_url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
            payload = {
                "chat_id": tg_chat_id,
                "text": telegram_summary,
                "parse_mode": "Markdown"
            }
            res = requests.post(tg_url, json=payload, timeout=10)
            if res.status_code == 200:
                print("✓ Telegram notification sent successfully!")
            else:
                print(f"Telegram notification returned status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"Telegram send error: {e}")
    else:
        print("Telegram secrets not configured, skipping Telegram alert.")

    # 5. Email Notification (if configured in secrets)
    email_user = os.environ.get('EMAIL_USER')
    email_pass = os.environ.get('EMAIL_PASS')
    email_to = os.environ.get('EMAIL_TO')

    if email_user and email_pass and email_to:
        try:
            print(f"Sending Email notification to {email_to}...")
            msg = MIMEMultipart()
            msg['From'] = email_user
            msg['To'] = email_to
            msg['Subject'] = f"CBEO भिनाय लंबित प्रपत्र रिपोर्ट - {time_str}"
            msg.attach(MIMEText(report_content, 'plain', 'utf-8'))

            server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
            server.login(email_user, email_pass)
            server.send_message(msg)
            server.quit()
            print("✓ Email notification sent successfully!")
        except Exception as e:
            print(f"Email send error: {e}")
    else:
        print("Email secrets not configured, skipping Email alert.")

    print("=== CBEO Bhinai VM Engine Execution Completed Successfully ===")


if __name__ == '__main__':
    main()
