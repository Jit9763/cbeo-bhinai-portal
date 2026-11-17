import requests
import json

with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
    master = json.load(f)

# Fix Nandsi
nandsi = master['saman_pariksha_submissions']['221756']
nandsi['c12_optional']['hindi_lit'] = 20
print('Fixed Nandsi c12_optional.hindi_lit to 20.')

# Ensure Jetpura has 8
jet = master['saman_pariksha_submissions']['221768']
jet['c12_optional']['hindi_lit'] = 8
print('Confirmed Jetpura c12_optional.hindi_lit is 8.')

with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
    json.dump(master, f, ensure_ascii=False, indent=2)

with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
    f.write('const MASTER_CBEO_DATA = ' + json.dumps(master, ensure_ascii=False, indent=2) + ';\n')
    f.write('if (typeof window !== "undefined") window.MASTER_CBEO_DATA = MASTER_CBEO_DATA;\n')
    f.write('if (typeof module !== "undefined" && module.exports) module.exports = MASTER_CBEO_DATA;\n')

# Sync Nandsi to Google Apps Script
url = 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec'
try:
    res = requests.post(url, json=nandsi)
    print('GAS Nandsi response:', res.json())
except Exception as e:
    print('GAS error:', e)
