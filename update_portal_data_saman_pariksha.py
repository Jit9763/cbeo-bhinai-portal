import json

def update():
    with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
        master = json.load(f)

    with open('schools_56_master.json', 'r', encoding='utf-8') as f:
        schools_56 = json.load(f)

    with open('drive_config.json', 'r', encoding='utf-8') as f:
        drive_cfg = json.load(f)

    # 1. Update PEEO passwords to their Shala Darpan code
    for p in master['peeos']:
        p['default_password'] = p['shala_darpan_code']
        p['password'] = p['shala_darpan_code']

    # 2. Attach schools_56 to master
    master['schools_56'] = schools_56

    # 3. Clean up demands: Keep ONLY Saman Pariksha 2026-27
    master['demands'] = [
        {
            "id": "DEMAND_SAMAN_PARIKSHA_2026",
            "title": "समान परीक्षा (सत्र 2026-27) - प्रश्न-पत्र मांग एवं कक्षा 9 से 12 नामांकन प्रपत्र",
            "title_en": "District Uniform Examination 2026-27: Question Paper Indent & Class 9-12 Enrollment",
            "description": "सत्र 2026-27 समान परीक्षा हेतु ब्लॉक के समस्त 56 माध्यमिक एवं उच्च माध्यमिक विद्यालयों (48 राजकीय + 8 निजी) के कक्षा 9, 10, 11 एवं 12 के विषयवार नामांकन एवं प्रश्न-पत्र मांग की प्रविष्टि।",
            "created_at": "2026-09-30",
            "deadline": "2026-10-05",
            "status": "active",
            "is_published": True,
            "school_scope": "56_schools",
            "scope_label": "समस्त 56 माध्यमिक एवं उच्च माध्यमिक विद्यालय (48 राजकीय + 8 निजी)",
            "school_count": 56
        }
    ]

    # 4. Admin tab access control settings for PEEO
    master['admin_config'] = {
        "peeo_tab_access": {
            "demand": False,
            "reports": False,
            "directory": False,
            "explorer": False
        },
        "saman_pariksha_active": True,
        "google_sheet_url": drive_cfg['sheets']['saman_pariksha']['url'],
        "google_sheet_id": drive_cfg['sheets']['saman_pariksha']['id'],
        "version": "v7_2026_10_01_peeo_deoliya_purnima_rakesh"
    }

    # Save to JSON
    with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
        json.dump(master, f, ensure_ascii=False, indent=2)

    # Save to JS
    js_content = f"// Master CBEO Bhinai Data - Saman Pariksha 2026-27 Active Version\nwindow.MASTER_CBEO_DATA = {json.dumps(master, ensure_ascii=False, indent=2)};\n"
    with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    print("Updated master_cbeo_data.json and master_cbeo_data.js successfully!")

if __name__ == '__main__':
    update()
