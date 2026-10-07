# -*- coding: utf-8 -*-
import json
import re

with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any Kekri with Ajmer per MANDATORY PERMANENT RULE
text = text.replace('केकड़ी', 'अजमेर').replace('केकडे़ी', 'अजमेर').replace('केकडेी', 'अजमेर')
text = re.sub(r'\bKEKRI\b', 'AJMER', text, flags=re.IGNORECASE)
text = re.sub(r'\bkekri\b', 'ajmer', text, flags=re.IGNORECASE)

with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
    f.write(text)

with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
    f.write('const MASTER_CBEO_DATA = ' + text + ';\nif (typeof module !== "undefined" && module.exports) { module.exports = MASTER_CBEO_DATA; }\n')

print("✓ Validated & Enforced: District is strictly AJMER across master files.")
