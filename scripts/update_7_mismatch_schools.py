import json
import sqlite3
import urllib.request

settings = {
    'alert_active': True,
    'alert_title': '🚨 अति-आवश्यक: समान परीक्षा मांग - नामांकन मिसमैच एवं संशोधन सूचना',
    'alert_message': 'मान्यवर संस्था प्रधान, आपके विद्यालय द्वारा समान परीक्षा 2026-27 के मांग प्रपत्र में भरा गया कक्षावार नामांकन शाला दर्पण के वास्तविक नामांकन से भिन्न (मिसमैच) पाया गया है।\n\nकार्यालय CBEO भिनाय (अजमेर) द्वारा आपके विद्यालय के लिए मांग प्रपत्र में संशोधन (Custom Edit) की विशेष सुविधा खोल दी गई है। कृपया तुरंत मांग पत्रक में सुधार कर पुनः सबमिट करें।',
    'custom_edit_schools': ['221756', '221761', '221763', '221772', '221775', '221778', '221780'],
    'mismatch_details': {
        '221756': {
            'school_name': 'राजकीय उच्च माध्यमिक विद्यालय, नांदसी (221756)',
            'peeo_name': 'NANDSI',
            'portal_total': 98,
            'sd_total': 92,
            'diff': 6,
            'portal_c9_10': 59,
            'portal_c11_12': 39,
            'sd_c9_10': 55,
            'sd_c11_12': 37,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 6 अधिक है (कक्षा 9 में +4, कक्षा 11 में +2)',
            'reason': 'कक्षा 9 में मांग 28 दर्ज है (SD: 24), कक्षा 11 में 19 दर्ज है (SD: 17)।',
            'flagged_fields': ['कक्षा 9 मांग', 'कक्षा 11 मांग', 'कुल महायोग']
        },
        '221761': {
            'school_name': 'राजकीय उच्च माध्यमिक विद्यालय, निमेड़ा (221761)',
            'peeo_name': 'LAMGARA',
            'portal_total': 94,
            'sd_total': 87,
            'diff': 7,
            'portal_c9_10': 55,
            'portal_c11_12': 39,
            'sd_c9_10': 50,
            'sd_c11_12': 37,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 7 अधिक है (कक्षा 9 में +5, कक्षा 11 में +2)',
            'reason': 'कक्षा 9 में मांग 37 दर्ज है (SD: 32), कक्षा 11 में 18 दर्ज है (SD: 16)।',
            'flagged_fields': ['कक्षा 9 मांग', 'कक्षा 11 मांग', 'कुल महायोग']
        },
        '221763': {
            'school_name': 'राजकीय उच्च माध्यमिक विद्यालय, बूबकिया (221763)',
            'peeo_name': 'BOOBKIYA',
            'portal_total': 148,
            'sd_total': 142,
            'diff': 6,
            'portal_c9_10': 104,
            'portal_c11_12': 44,
            'sd_c9_10': 98,
            'sd_c11_12': 44,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 6 अधिक है (कक्षा 9 में +6)',
            'reason': 'कक्षा 9 में मांग 49 दर्ज है (SD: 43)।',
            'flagged_fields': ['कक्षा 9 मांग', 'कुल महायोग']
        },
        '221772': {
            'school_name': 'राजकीय उच्च माध्यमिक विद्यालय, नागोला (221772)',
            'peeo_name': 'NAGOLA',
            'portal_total': 223,
            'sd_total': 222,
            'diff': 1,
            'portal_c9_10': 133,
            'portal_c11_12': 90,
            'sd_c9_10': 132,
            'sd_c11_12': 90,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 1 अधिक है (कक्षा 9 में +1)',
            'reason': 'कक्षा 9 में मांग 80 दर्ज है (SD: 79)।',
            'flagged_fields': ['कक्षा 9 मांग', 'कुल महायोग']
        },
        '221775': {
            'school_name': 'राजकीय उच्च माध्यमिक विद्यालय, राताकोट (221775)',
            'peeo_name': 'RATAKOT',
            'portal_total': 122,
            'sd_total': 121,
            'diff': 1,
            'portal_c9_10': 70,
            'portal_c11_12': 52,
            'sd_c9_10': 70,
            'sd_c11_12': 51,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 1 अधिक है (कक्षा 11 में +1)',
            'reason': 'कक्षा 11 में मांग 29 दर्ज है (SD: 28)।',
            'flagged_fields': ['कक्षा 11 मांग', 'कुल महायोग']
        },
        '221778': {
            'school_name': 'महात्मा गांधी राजकीय विद्यालय, भिनाय (221778)',
            'peeo_name': 'BHINAY',
            'portal_total': 87,
            'sd_total': 86,
            'diff': 1,
            'portal_c9_10': 44,
            'portal_c11_12': 43,
            'sd_c9_10': 44,
            'sd_c11_12': 42,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 1 अधिक है (कक्षा 12 में +1)',
            'reason': 'कक्षा 12 में मांग 19 दर्ज है (SD: 18)।',
            'flagged_fields': ['कक्षा 12 मांग', 'कुल महायोग']
        },
        '221780': {
            'school_name': 'राजकीय उच्च माध्यमिक विद्यालय, भिनाय (221780)',
            'peeo_name': 'BHINAY',
            'portal_total': 411,
            'sd_total': 396,
            'diff': 15,
            'portal_c9_10': 232,
            'portal_c11_12': 179,
            'sd_c9_10': 220,
            'sd_c11_12': 176,
            'diff_text': 'पेपर मांग शाला दर्पण नामांकन से 15 अधिक है (कक्षा 9 में +12, कक्षा 11 में +3)',
            'reason': 'कक्षा 9 में मांग 144 दर्ज है (SD: 132) तथा कक्षा 11 में 90 दर्ज है (SD: 87)।',
            'flagged_fields': ['कक्षा 9 मांग', 'कक्षा 11 मांग', 'कुल महायोग']
        }
    }
}

# 1. Save to saman_mismatch_settings.json
with open('saman_mismatch_settings.json', 'w', encoding='utf-8') as f:
    json.dump(settings, f, ensure_ascii=False, indent=2)
print("1. Saved to saman_mismatch_settings.json")

# 2. Save to SQLite database
conn = sqlite3.connect('cbeo_data.sqlite')
c = conn.cursor()
c.execute("""
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now')) 
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
""", ('__SAMAN_MISMATCH_SETTINGS__', json.dumps(settings, ensure_ascii=False)))
conn.commit()
conn.close()
print("2. Saved to SQLite database")

# 3. Post to local server endpoint
try:
    req = urllib.request.Request(
        'http://localhost:8089/api/save_saman_mismatch_settings',
        data=json.dumps(settings).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req, timeout=5)
    print("3. Server API response:", resp.status, resp.read().decode())
except Exception as e:
    print("3. Local server sync note:", e)

# 4. Also update DEFAULT_SAMAN_MISMATCH_SETTINGS in app.js
with open('app.js', encoding='utf-8') as f:
    app_text = f.read()

# find DEFAULT_SAMAN_MISMATCH_SETTINGS
idx_start = app_text.find('const DEFAULT_SAMAN_MISMATCH_SETTINGS =')
if idx_start != -1:
    idx_end = app_text.find('};', idx_start)
    if idx_end != -1:
        new_def = 'const DEFAULT_SAMAN_MISMATCH_SETTINGS = ' + json.dumps(settings, ensure_ascii=False, indent=2)
        app_text = app_text[:idx_start] + new_def + app_text[idx_end+1:]
        with open('app.js', 'w', encoding='utf-8') as f:
            f.write(app_text)
        print("4. Updated DEFAULT_SAMAN_MISMATCH_SETTINGS in app.js")

print("ALL 7 MISMATCH SCHOOLS ACTIVATED WITH ALERT ON AND CUSTOM EDIT OPEN!")
