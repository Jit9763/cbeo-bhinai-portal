import os
import sys
import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
TOKEN_FILE = r"C:\Users\jiten\Desktop\panchayat chunav\scratch\token_panchayat.json"
CONFIG_FILE = "drive_config.json"

def get_services():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    drive = build('drive', 'v3', credentials=creds)
    sheets = build('sheets', 'v4', credentials=creds)
    return drive, sheets

def sync_data():
    if not os.path.exists(CONFIG_FILE):
        print("Config file not found. Run create_cbeo_drive_backend.py first.")
        return

    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = json.load(f)

    drive, sheets = get_services()
    print("Google Drive API Services connected successfully.")
    print("Drive Folder:", config['folder_url'])
    for name, item in config['sheets'].items():
        print(f" - {item['name']}: {item['url']}")

if __name__ == '__main__':
    sync_data()
