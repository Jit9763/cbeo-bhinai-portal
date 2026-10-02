import json
import os
from create_cbeo_drive_backend import get_services

def create_mdm_spreadsheet():
    drive, sheets = get_services()
    
    with open('drive_config.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    folder_id = cfg['folder_id']
    
    with open('scratch/peeos_list.json', 'r', encoding='utf-8') as f:
        peeos = json.load(f)

    # Sort PEEOs by name
    sorted_peeos = sorted(peeos.values(), key=lambda x: x['name'])
    
    sheet_title = "6_CBEO_MDM_Nirikshan_Prapatra_2"
    
    # Check if already exists in folder
    q = f"'{folder_id}' in parents and name = '{sheet_title}' and trashed = false"
    res = drive.files().list(q=q, fields='files(id, name, webViewLink)').execute()
    files = res.get('files', [])
    
    if files:
        spreadsheet_id = files[0]['id']
        web_link = files[0]['webViewLink']
        print(f"Found existing spreadsheet: {spreadsheet_id}")
    else:
        file_metadata = {
            'name': sheet_title,
            'parents': [folder_id],
            'mimeType': 'application/vnd.google-apps.spreadsheet'
        }
        f_obj = drive.files().create(body=file_metadata, fields='id, webViewLink').execute()
        spreadsheet_id = f_obj['id']
        web_link = f_obj['webViewLink']
        print(f"Created new spreadsheet: {spreadsheet_id}")

    # Update drive_config.json
    cfg['sheets']['mdm_prapatra2'] = {
        'id': spreadsheet_id,
        'name': sheet_title,
        'url': web_link
    }
    with open('drive_config.json', 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2)

    # Get current sheets in the spreadsheet
    ss_meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existing_sheets = {s['properties']['title']: s['properties']['sheetId'] for s in ss_meta.get('sheets', [])}
    print("Existing tabs:", existing_sheets)

    # Required tabs:
    # 1. PEEO_प्राप्त_सूचना
    # 2. समेकित_प्रपत्र-2
    # 3. लम्बित_पीईईओ_सूची
    
    tab_names = ["PEEO_प्राप्त_सूचना", "समेकित_प्रपत्र-2", "लम्बित_पीईईओ_सूची"]
    requests = []
    
    for t_name in tab_names:
        if t_name not in existing_sheets:
            requests.append({
                'addSheet': {
                    'properties': {
                        'title': t_name,
                        'gridProperties': {
                            'rowCount': 100,
                            'columnCount': 20
                        }
                    }
                }
            })

    if requests:
        res = sheets.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': requests}
        ).execute()
        for reply in res.get('replies', []):
            if 'addSheet' in reply:
                s_props = reply['addSheet']['properties']
                existing_sheets[s_props['title']] = s_props['sheetId']

    # Remove default "Sheet1" if it exists and we have our 3 tabs
    if "Sheet1" in existing_sheets and len(existing_sheets) > 3:
        try:
            sheets.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={'requests': [{'deleteSheet': {'sheetId': existing_sheets['Sheet1']}}]}
            ).execute()
            del existing_sheets["Sheet1"]
            print("Removed default Sheet1")
        except Exception as e:
            print("Could not remove Sheet1:", e)

    # Now populate Tab 1: PEEO_प्राप्त_सूचना
    # Headers for Google Form responses
    tab1_headers = [
        "Timestamp",
        "शाला दर्पण कोड (PEEO SD Code)",
        "पीईईओ का नाम (PEEO Name)",
        "निरीक्षण दिनांक",
        "निरीक्षण दलों की संख्या",
        "निरीक्षण करने वाले अधिकारियों की संख्या",
        "निरीक्षण दल द्वारा निरीक्षण किये गये विद्यालयों की कुल संख्या",
        "कार्यक्रम क्रियान्वयन स्थिति - सन्तोषप्रद विद्यालयों की संख्या",
        "कार्यक्रम क्रियान्वयन स्थिति - असन्तोषप्रद विद्यालयों की संख्या",
        "असन्तोषप्रद होने के कारणों का स्पष्ट उल्लेख",
        "विशेष विवरण / की गई कार्यवाही",
        "सूचना भरने वाले अधिकारी / प्रभारी का नाम व पद",
        "सम्पर्क मोबाइल नंबर"
    ]
    
    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range="PEEO_प्राप्त_सूचना!A1:M1",
        valueInputOption="USER_ENTERED",
        body={'values': [tab1_headers]}
    ).execute()
    print("Tab 1 headers populated.")

    # Now populate Tab 2: समेकित_प्रपत्र-2
    # Rows 1 to 5: Headers
    tab2_values = [
        ["राजस्थान सरकार", "", "", "", "", "", "", "", "", "", ""],
        ["मिड डे मील योजनान्तर्गत, क्रियान्वयन के सम्बन्ध में निरीक्षण का विवरण", "", "", "", "", "", "", "", "", "", ""],
        ["जिले का नाम: अजमेर", "", "खण्ड: भिनाय", "", "", "", "", "प्रपत्र-2 (CBEO समेकित)", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", ""],
        [
            "क. सं. (1)",
            "जिला / खण्ड (पीईईओ परिक्षेत्र) (2)",
            "निरीक्षण दिनांक (3)",
            "निरीक्षण दलों की संख्या (4)",
            "निरीक्षण करने वाले अधिकारियों की संख्या (5)",
            "निरीक्षण दल द्वारा निरीक्षण किये गये विद्यालयों की कुल संख्या (6)",
            "निरीक्षण किए गये विद्यालयों में कार्यक्रम क्रियान्वयन की स्थिति (सन्तोषप्रद) (7)",
            "निरीक्षण किए गये विद्यालयों में कार्यक्रम क्रियान्वयन की स्थिति (असन्तोषप्रद) (8)",
            "निरीक्षण किये गये विद्यालयों में कार्यक्रम क्रियान्वयन की स्थिति असन्तोषप्रद होने के कारणों का स्पष्ट उल्लेख (9)",
            "विशेष विवरण (10)",
            "सूचना स्थिति (Status)",
            "SD_CODE" # Col L (Hidden helper)
        ]
    ]

    # Rows 6 to 30: 25 PEEOs with formulas
    start_row = 6
    for idx, p in enumerate(sorted_peeos, 1):
        r_num = start_row + idx - 1
        code = p['code']
        name = p['name']
        
        # Formulas referencing PEEO_प्राप्त_सूचना by Shala Darpan code in Col L
        # Note: In PEEO_प्राप्त_सूचना:
        # Col B is SD Code, Col D is Date, Col E is Teams, Col F is Officials, Col G is Inspected Schools, Col H is Sat, Col I is Unsat, Col J is Reason, Col K is Remarks
        f_date = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$D$2:$D$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), "-")'
        f_teams = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$E$2:$E$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), 0)'
        f_officials = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$F$2:$F$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), 0)'
        f_total_sch = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$G$2:$G$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), 0)'
        f_sat = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$H$2:$H$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), 0)'
        f_unsat = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$I$2:$I$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), 0)'
        f_reason = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$J$2:$J$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), "-")'
        f_remarks = f'=IFERROR(INDEX(PEEO_प्राप्त_सूचना!$K$2:$K$1000, MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), "-")'
        f_status = f'=IF(ISNUMBER(MATCH(L{r_num}, PEEO_प्राप्त_सूचना!$B$2:$B$1000, 0)), "✅ प्राप्त (Submitted)", "⏳ लम्बित (Pending)")'
        
        row_cells = [
            idx,
            f"{name} ({code})",
            f_date,
            f_teams,
            f_officials,
            f_total_sch,
            f_sat,
            f_unsat,
            f_reason,
            f_remarks,
            f_status,
            code
        ]
        tab2_values.append(row_cells)

    total_row = start_row + len(sorted_peeos) # Row 31
    tab2_values.append([
        "योग",
        "कुल ब्लॉक योग (भिनाय)",
        "-",
        f"=SUM(D6:D{total_row-1})",
        f"=SUM(E6:E{total_row-1})",
        f"=SUM(F6:F{total_row-1})",
        f"=SUM(G6:G{total_row-1})",
        f"=SUM(H6:H{total_row-1})",
        "-",
        "-",
        f'=COUNTIF(K6:K{total_row-1}, "*प्राप्त*") & " / 25 प्राप्त"',
        ""
    ])

    # Note rows
    tab2_values.append(["", "", "", "", "", "", "", "", "", "", "", ""])
    tab2_values.append([
        "नोट: कृपया कॉलम संख्या (9) एवं (10) की पूर्ति असंतोषप्रद पाये जाने की स्थिति में कारण एवं की गई कार्यवाही के स्पष्ट विवरण के साथ आवश्यक रूप किया जाना सुनिश्चित करें।",
        "", "", "", "", "", "", "", "", "", "", ""
    ])
    tab2_values.append(["", "", "", "", "", "", "", "", "", "", "", ""])
    tab2_values.append([
        "", "", "", "", "", "", "", "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय", "", "", "", ""
    ])

    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"समेकित_प्रपत्र-2!A1:L{len(tab2_values)}",
        valueInputOption="USER_ENTERED",
        body={'values': tab2_values}
    ).execute()
    print("Tab 2 populated.")

    # Now populate Tab 3: लम्बित_पीईईओ_सूची
    tab3_values = [
        ["मिड डे मील सघन निरीक्षण (प्रपत्र-2) - लम्बित पीईईओ फॉलो-अप ट्रैकर (ब्लॉक भिनाय)", "", "", "", "", "", ""],
        [
            '= "कुल पीईईओ: 25  |  प्राप्त: " & COUNTIF(\'समेकित_प्रपत्र-2\'!K6:K30, "*प्राप्त*") & "  |  लम्बित (Pending): " & COUNTIF(\'समेकित_प्रपत्र-2\'!K6:K30, "*लम्बित*")',
            "", "", "", "", "", ""
        ],
        ["", "", "", "", "", "", ""],
        [
            "क. सं.",
            "पीईईओ शाला दर्पण कोड",
            "पीईईओ का नाम",
            "संस्था प्रधान / पीईईओ का नाम",
            "सम्पर्क मोबाइल नंबर",
            "वर्तमान स्थिति (Status)",
            "कार्यालय रिमार्क / फॉलो-अप विवरण"
        ]
    ]

    for idx, p in enumerate(sorted_peeos, 1):
        r_prapatra = 5 + idx
        c_code = p['code']
        c_name = p['name']
        c_principal = p['principal']
        c_mobile = p['mobile']
        f_live_status = f"=IF('समेकित_प्रपत्र-2'!K{r_prapatra}=\"⏳ लम्बित (Pending)\", \"🔴 सूचना अप्राप्त (Pending)\", \"🟢 सूचना प्राप्त (Received)\")"
        tab3_values.append([
            idx,
            c_code,
            c_name,
            c_principal,
            c_mobile,
            f_live_status,
            ""
        ])

    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"लम्बित_पीईईओ_सूची!A1:G{len(tab3_values)}",
        valueInputOption="USER_ENTERED",
        body={'values': tab3_values}
    ).execute()
    print("Tab 3 populated.")

    # Apply Styling, Formatting, Merges, Column Widths via batchUpdate
    format_requests = []
    
    # 1. Sheet IDs
    id_tab1 = existing_sheets["PEEO_प्राप्त_सूचना"]
    id_tab2 = existing_sheets["समेकित_प्रपत्र-2"]
    id_tab3 = existing_sheets["लम्बित_पीईईओ_सूची"]

    # Formatting Tab 1 Header
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab1, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 13},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.11, 'green': 0.27, 'blue': 0.53}, # Navy Blue
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}, 'fontSize': 11},
                    'horizontalAlignment': 'CENTER',
                    'wrapStrategy': 'WRAP'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,wrapStrategy)'
        }
    })

    # Formatting Tab 2
    # Row 1 Title Merge & Style
    format_requests.append({
        'mergeCells': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'mergeType': 'MERGE_ALL'
        }
    })
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.08, 'green': 0.21, 'blue': 0.40},
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}, 'fontSize': 14},
                    'horizontalAlignment': 'CENTER'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    })

    # Row 2 Subtitle Merge & Style
    format_requests.append({
        'mergeCells': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 1, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'mergeType': 'MERGE_ALL'
        }
    })
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 1, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.16, 'green': 0.32, 'blue': 0.58},
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}, 'fontSize': 12},
                    'horizontalAlignment': 'CENTER'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    })

    # Row 3 District / Block Info
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 2, 'endRowIndex': 3, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'cell': {
                'userEnteredFormat': {
                    'textFormat': {'bold': True, 'fontSize': 11, 'foregroundColor': {'red': 0.1, 'green': 0.1, 'blue': 0.1}}
                }
            },
            'fields': 'userEnteredFormat(textFormat)'
        }
    })

    # Row 5 (Index 4) Table Headers
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 4, 'endRowIndex': 5, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.20, 'green': 0.35, 'blue': 0.60},
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}, 'fontSize': 10},
                    'horizontalAlignment': 'CENTER',
                    'verticalAlignment': 'MIDDLE',
                    'wrapStrategy': 'WRAP'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
        }
    })

    # Total Row (Row 31, index 30) Styling
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 30, 'endRowIndex': 31, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.90, 'green': 0.94, 'blue': 0.98},
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 0.08, 'green': 0.21, 'blue': 0.40}, 'fontSize': 11},
                    'horizontalAlignment': 'CENTER'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    })

    # Note row (Row 33, index 32)
    format_requests.append({
        'mergeCells': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 32, 'endRowIndex': 33, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'mergeType': 'MERGE_ALL'
        }
    })
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 32, 'endRowIndex': 33, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'cell': {
                'userEnteredFormat': {
                    'textFormat': {'bold': True, 'italic': True, 'foregroundColor': {'red': 0.7, 'green': 0.1, 'blue': 0.1}, 'fontSize': 10},
                    'horizontalAlignment': 'LEFT'
                }
            },
            'fields': 'userEnteredFormat(textFormat,horizontalAlignment)'
        }
    })

    # Tab 3 Styling
    # Row 1 Title
    format_requests.append({
        'mergeCells': {
            'range': {'sheetId': id_tab3, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'mergeType': 'MERGE_ALL'
        }
    })
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab3, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.70, 'green': 0.15, 'blue': 0.15}, # Red banner for pending
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}, 'fontSize': 13},
                    'horizontalAlignment': 'CENTER'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    })

    # Row 2 Stat summary
    format_requests.append({
        'mergeCells': {
            'range': {'sheetId': id_tab3, 'startRowIndex': 1, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'mergeType': 'MERGE_ALL'
        }
    })
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab3, 'startRowIndex': 1, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.95, 'green': 0.95, 'blue': 0.95},
                    'textFormat': {'bold': True, 'fontSize': 11, 'foregroundColor': {'red': 0.1, 'green': 0.1, 'blue': 0.1}},
                    'horizontalAlignment': 'CENTER'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    })

    # Row 4 (index 3) Headers
    format_requests.append({
        'repeatCell': {
            'range': {'sheetId': id_tab3, 'startRowIndex': 3, 'endRowIndex': 4, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.25, 'green': 0.35, 'blue': 0.45},
                    'textFormat': {'bold': True, 'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0}, 'fontSize': 10},
                    'horizontalAlignment': 'CENTER',
                    'wrapStrategy': 'WRAP'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,wrapStrategy)'
        }
    })

    # Column Widths adjustments
    col_widths = [
        # Tab 2 widths
        {'sheetId': id_tab2, 'col': 0, 'width': 60},   # S.No
        {'sheetId': id_tab2, 'col': 1, 'width': 220},  # Block/PEEO
        {'sheetId': id_tab2, 'col': 2, 'width': 110},  # Date
        {'sheetId': id_tab2, 'col': 3, 'width': 90},   # Teams
        {'sheetId': id_tab2, 'col': 4, 'width': 100},  # Officials
        {'sheetId': id_tab2, 'col': 5, 'width': 110},  # Schools Inspected
        {'sheetId': id_tab2, 'col': 6, 'width': 100},  # Sat
        {'sheetId': id_tab2, 'col': 7, 'width': 100},  # Unsat
        {'sheetId': id_tab2, 'col': 8, 'width': 250},  # Reasons
        {'sheetId': id_tab2, 'col': 9, 'width': 200},  # Remarks
        {'sheetId': id_tab2, 'col': 10, 'width': 150}, # Status
        
        # Tab 3 widths
        {'sheetId': id_tab3, 'col': 0, 'width': 60},
        {'sheetId': id_tab3, 'col': 1, 'width': 130},
        {'sheetId': id_tab3, 'col': 2, 'width': 220},
        {'sheetId': id_tab3, 'col': 3, 'width': 200},
        {'sheetId': id_tab3, 'col': 4, 'width': 130},
        {'sheetId': id_tab3, 'col': 5, 'width': 170},
        {'sheetId': id_tab3, 'col': 6, 'width': 220}
    ]

    for cw in col_widths:
        format_requests.append({
            'updateDimensionProperties': {
                'range': {
                    'sheetId': cw['sheetId'],
                    'dimension': 'COLUMNS',
                    'startIndex': cw['col'],
                    'endIndex': cw['col'] + 1
                },
                'properties': {'pixelSize': cw['width']},
                'fields': 'pixelSize'
            }
        })

    # Borders on Tab 2 Table (Row 5 to 31, Col 0 to 11)
    format_requests.append({
        'updateBorders': {
            'range': {'sheetId': id_tab2, 'startRowIndex': 4, 'endRowIndex': 31, 'startColumnIndex': 0, 'endColumnIndex': 11},
            'top': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'bottom': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'left': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'right': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'innerHorizontal': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.85, 'green': 0.85, 'blue': 0.85}},
            'innerVertical': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.85, 'green': 0.85, 'blue': 0.85}}
        }
    })

    # Borders on Tab 3 Table
    format_requests.append({
        'updateBorders': {
            'range': {'sheetId': id_tab3, 'startRowIndex': 3, 'endRowIndex': 29, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'top': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'bottom': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'left': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'right': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.7, 'green': 0.7, 'blue': 0.7}},
            'innerHorizontal': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.85, 'green': 0.85, 'blue': 0.85}},
            'innerVertical': {'style': 'SOLID', 'width': 1, 'color': {'red': 0.85, 'green': 0.85, 'blue': 0.85}}
        }
    })

    # Execute all format requests
    sheets.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={'requests': format_requests}
    ).execute()
    print("Formatting and styling successfully applied!")

    print(f"\n=======================================================")
    print(f"SUCCESS: MDM Prapatra-2 Google Sheet is READY!")
    print(f"URL: {web_link}")
    print(f"=======================================================\n")
    return spreadsheet_id, web_link

if __name__ == '__main__':
    create_mdm_spreadsheet()
