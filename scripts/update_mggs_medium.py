import json

def update_mggs():
    # 1. Update master_cbeo_data.json
    with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
        master = json.load(f)

    subs = master.get('saman_pariksha_submissions', {})
    mggs_configs = {
        '221770': {'c9': 25, 'c10': 16},
        '221778': {'c9': 26, 'c10': 18},
        '221753': {'c9': 36, 'c10': 34}
    }

    for code, cfg in mggs_configs.items():
        if code in subs:
            s = subs[code]
            s['school_medium'] = 'english'
            s['c9_hindi'] = 0
            s['c9_english'] = cfg['c9']
            s['c9_total'] = cfg['c9']
            s['c10_hindi'] = 0
            s['c10_english'] = cfg['c10']
            s['c10_total'] = cfg['c10']
            print(f"Updated {code} in master_cbeo_data.json: Class 9 English = {s['c9_english']}, Class 10 English = {s['c10_english']}")

    with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
        json.dump(master, f, ensure_ascii=False, indent=2)

    # 2. Update saman_pariksha_submissions.json
    try:
        with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
            s_subs = json.load(f)
        for code, cfg in mggs_configs.items():
            if code in s_subs:
                s = s_subs[code]
                s['school_medium'] = 'english'
                s['c9_hindi'] = 0
                s['c9_english'] = cfg['c9']
                s['c9_total'] = cfg['c9']
                s['c10_hindi'] = 0
                s['c10_english'] = cfg['c10']
                s['c10_total'] = cfg['c10']
        with open('saman_pariksha_submissions.json', 'w', encoding='utf-8') as f:
            json.dump(s_subs, f, ensure_ascii=False, indent=2)
        print("Updated saman_pariksha_submissions.json")
    except Exception as e:
        print("Error updating saman_pariksha_submissions.json:", e)

    # 3. Update master_cbeo_data.js
    with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
        f.write('window.CBEO_MASTER_DATA = ' + json.dumps(master, ensure_ascii=False, indent=2) + ';\n')
    print("Updated master_cbeo_data.js")

if __name__ == '__main__':
    update_mggs()
