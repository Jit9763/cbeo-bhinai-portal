# -*- coding: utf-8 -*-
"""
Fallback / High-Quota (500/day) Gmail SMTP Dispatcher for Exam Attendance PDFs.
Reads Compiled_Attendance in Google Sheet 1djC6g2-HatNECtDz_xVfCB5KSWUrO89PR_tzQTIPrrc,
finds any rows where Email_Status failed with Apps Script quota limit or 'Pending SMTP',
downloads the PDF from Google Drive (PDF_Link), emails it via Gmail SMTP (censusbhinai@gmail.com),
and updates Email_Status in Compiled_Attendance.
"""
import io
import os
import re
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

TOKEN_FILE = r'c:\Users\jiten\Desktop\03_शिक्षा_एवं_स्कूल\cbeo\token_census_forms.json'
SHEET_ID = '1djC6g2-HatNECtDz_xVfCB5KSWUrO89PR_tzQTIPrrc'

def get_smtp_creds():
    cfg_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cbeo_notification_config.json')
    user = os.environ.get('EMAIL_USER') or 'censusbhinai@gmail.com'
    pwd = os.environ.get('EMAIL_PASS') or ''
    if not pwd and os.path.exists(cfg_path):
        try:
            cfg = json.load(open(cfg_path, 'r', encoding='utf-8'))
            user = cfg.get('EMAIL_USER') or user
            pwd = cfg.get('EMAIL_PASS') or pwd
        except Exception:
            pass
    return user, pwd.replace(' ', '')

def get_google_creds():
    env_tok = os.environ.get('TOKEN_CENSUS_JSON')
    if env_tok:
        creds = Credentials.from_authorized_user_info(json.loads(env_tok))
    else:
        creds = Credentials.from_authorized_user_file(TOKEN_FILE)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return creds

def extract_drive_id(url):
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', str(url or ''))
    return m.group(1) if m else ''

def main():
    creds = get_google_creds()
    sheets = build('sheets', 'v4', credentials=creds)
    drive = build('drive', 'v3', credentials=creds)

    comp = sheets.spreadsheets().values().get(spreadsheetId=SHEET_ID, range="Compiled_Attendance!A1:P300").execute().get('values', [])
    if len(comp) < 2:
        print("No rows in Compiled_Attendance.")
        return

    smtp_user, smtp_pass = get_smtp_creds()
    pending_indices = []
    for i, r in enumerate(comp[1:], 2):
        status = str(r[14]).strip() if len(r) > 14 else ""
        target = str(r[13]).strip() if len(r) > 13 else ""
        pdf_url = str(r[15]).strip() if len(r) > 15 else ""
        if target and pdf_url and ("too many times" in status or "Pending SMTP" in status or "Queued" in status):
            pending_indices.append((i, r))

    print(f"Found {len(pending_indices)} rows needing SMTP PDF email dispatch.")
    if not pending_indices:
        return

    server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=30)
    server.login(smtp_user, smtp_pass)

    sent_count = 0
    for row_num, r in pending_indices:
        school_lbl = r[3]
        exam_date = r[6]
        shift = r[7]
        g_reg, g_pres, g_abs = r[8], r[9], r[10]
        target = r[13]
        pdf_url = r[15]
        file_id = extract_drive_id(pdf_url)
        if not file_id:
            continue

        try:
            fh = io.BytesIO()
            request = drive.files().get_media(fileId=file_id)
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            pdf_bytes = fh.getvalue()

            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = target
            msg['Subject'] = f"उपस्थिति पत्रक PDF: {school_lbl} ({exam_date} - {shift})"
            body_text = (
                f"महोदय,\n\nराज्य स्तरीय समान परीक्षा (अर्द्धवार्षिक 2026-27) के अंतर्गत विद्यालय ({school_lbl}) "
                f"का उपस्थिति पत्रक संलग्न PDF में प्रेषित है।\n\n"
                f"कुल पंजीकृत: {g_reg}\nकुल उपस्थित: {g_pres}\nकुल अनुपस्थित: {g_abs}\n\n"
                f"कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)"
            )
            msg.attach(MIMEText(body_text, 'plain', 'utf-8'))

            att = MIMEApplication(pdf_bytes, _subtype="pdf")
            att.add_header('Content-Disposition', 'attachment', filename=f"{r[4] or 'school'}_{exam_date}_Attendance.pdf")
            msg.attach(att)

            recips = [x.strip() for x in target.split(',') if x.strip()]
            server.sendmail(smtp_user, recips, msg.as_string())

            sheets.spreadsheets().values().update(
                spreadsheetId=SHEET_ID,
                range=f"Compiled_Attendance!O{row_num}",
                valueInputOption="RAW",
                body={"values": [[f"Sent via SMTP to {target}"]]}
            ).execute()
            sent_count += 1
            print(f"  [SENT] Row {row_num}: {school_lbl} -> {target}")
        except Exception as e:
            print(f"  [ERR] Row {row_num}: {e}")

    server.quit()
    print(f"Total pending PDFs sent via Gmail SMTP: {sent_count}")

if __name__ == '__main__':
    main()
