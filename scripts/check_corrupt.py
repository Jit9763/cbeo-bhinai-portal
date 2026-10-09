import json
import re

with open('matdan_kendra_116_booths.json', 'r', encoding='utf-8') as f:
    booths = json.load(f)

corrupt = []
for i, b in enumerate(booths):
    room = b.get('room_hi', '')
    if re.search(r'[a-zA-Z%&]', room):
        corrupt.append((b.get('booth_number'), b.get('ps_name_hi'), room))

print(f"Total booths with artifacts in room_hi: {len(corrupt)}")
for item in corrupt:
    print(item)
