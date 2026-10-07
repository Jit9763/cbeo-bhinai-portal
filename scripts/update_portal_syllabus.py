# -*- coding: utf-8 -*-
import json
import os
from datetime import datetime

# Load current submissions
sub_file = 'saman_syllabus_submissions.json'
with open(sub_file, 'r', encoding='utf-8') as f:
    subs = json.load(f)

print(f"Submissions before update: {len(subs)}")

ts = "2026-10-07T10:45:00.000Z"

# 1. 221764 - रा.उ.मा.वि. बड़गांव (सूरखण्ड)
subs["221764"] = {
    "school_code": "221764",
    "exam_code": "AJM04G221764",
    "school_name": "रा.उ.मा.वि. बड़गांव (सूरखण्ड)",
    "peeo_name": "PEEO BARGAON",
    "principal_name": "CHANDRA PRAKASH LADDHA",
    "principal_mobile": "9001450275",
    "incharge_name": "DR. VIJAY SHANKAR SHARMA",
    "incharge_mobile": "9928191102",
    "submitted_by": "CHANDRA PRAKASH LADDHA",
    "c9": {
        "zero_enrolment": False,
        "hindi": 90,
        "english": 65,
        "maths": 70,
        "science": 75,
        "sst": 90,
        "sanskrit": 90,
        "urdu": 0
    },
    "c10": {
        "zero_enrolment": False,
        "hindi": 90,
        "english": 75,
        "maths": 75,
        "science": 75,
        "sst": 80,
        "sanskrit": 90,
        "urdu": 0
    },
    "c11": {
        "zero_enrolment": False,
        "comp_hindi": 75,
        "comp_english": 70,
        "faculties": ["arts"],
        "electives": [
            {"key": "polsci", "name": "राजनीति विज्ञान (Political Science)", "pct": 75},
            {"key": "history", "name": "इतिहास (History)", "pct": 90},
            {"key": "geography", "name": "भूगोल (Geography)", "pct": 90}
        ]
    },
    "c12": {
        "zero_enrolment": False,
        "comp_hindi": 80,
        "comp_english": 75,
        "faculties": ["arts"],
        "electives": [
            {"key": "polsci", "name": "राजनीति विज्ञान (Political Science)", "pct": 90},
            {"key": "history", "name": "इतिहास (History)", "pct": 90},
            {"key": "geography", "name": "भूगोल (Geography)", "pct": 90}
        ]
    },
    "average_pct": 81.4,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# 2. 221765 - रा.उ.मा.वि. कनाई कलां
subs["221765"] = {
    "school_code": "221765",
    "exam_code": "AJM04G221765",
    "school_name": "रा.उ.मा.वि. कनाई कलां",
    "peeo_name": "PEEO KANAI KALAN",
    "principal_name": "NARESH KUMAR",
    "principal_mobile": "9166233899",
    "incharge_name": "Madhyama Vashishth",
    "incharge_mobile": "8432571486",
    "submitted_by": "NARESH KUMAR",
    "c9": {
        "zero_enrolment": False,
        "hindi": 90,
        "english": 80,
        "maths": 81,
        "science": 82,
        "sst": 85,
        "sanskrit": 90,
        "urdu": 0
    },
    "c10": {
        "zero_enrolment": False,
        "hindi": 100,
        "english": 100,
        "maths": 85,
        "science": 82,
        "sst": 90,
        "sanskrit": 100,
        "urdu": 0
    },
    "c11": {
        "zero_enrolment": False,
        "comp_hindi": 90,
        "comp_english": 80,
        "faculties": ["arts"],
        "electives": [
            {"key": "history", "name": "इतिहास (History)", "pct": 90},
            {"key": "hindilit", "name": "हिंदी साहित्य (Hindi Literature)", "pct": 85},
            {"key": "sociology", "name": "समाजशास्त्र (Sociology)", "pct": 80}
        ]
    },
    "c12": {
        "zero_enrolment": False,
        "comp_hindi": 100,
        "comp_english": 100,
        "faculties": ["arts"],
        "electives": [
            {"key": "history", "name": "इतिहास (History)", "pct": 90},
            {"key": "hindilit", "name": "हिंदी साहित्य (Hindi Literature)", "pct": 100},
            {"key": "sociology", "name": "समाजशास्त्र (Sociology)", "pct": 100}
        ]
    },
    "average_pct": 90.0,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# 3. 221770 - महात्मा गांधी राजकीय विद्यालय, बांदनवाड़ा
subs["221770"] = {
    "school_code": "221770",
    "exam_code": "AJM04G221770",
    "school_name": "महात्मा गांधी राजकीय विद्यालय, बांदनवाड़ा",
    "peeo_name": "PEEO BANDANWARA",
    "principal_name": "Afsar Ahmed",
    "principal_mobile": "9079000589",
    "incharge_name": "RAJESH KUMAR RAJPUT",
    "incharge_mobile": "789197521",
    "submitted_by": "Afsar Ahmed",
    "c9": {
        "zero_enrolment": False,
        "hindi": 75,
        "english": 70,
        "maths": 75,
        "science": 80,
        "sst": 65,
        "sanskrit": 90,
        "urdu": 0
    },
    "c10": {
        "zero_enrolment": False,
        "hindi": 95,
        "english": 94,
        "maths": 96,
        "science": 95,
        "sst": 97,
        "sanskrit": 95,
        "urdu": 0
    },
    "c11": {
        "zero_enrolment": True,
        "comp_hindi": 0,
        "comp_english": 0,
        "faculties": [],
        "electives": []
    },
    "c12": {
        "zero_enrolment": True,
        "comp_hindi": 0,
        "comp_english": 0,
        "faculties": [],
        "electives": []
    },
    "average_pct": 84.8,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# 4. 410632 - रा.बा.उ.मा.वि. नांदसी
subs["410632"] = {
    "school_code": "410632",
    "exam_code": "AJM04G410632",
    "school_name": "रा.बा.उ.मा.वि. नांदसी",
    "peeo_name": "PEEO NANDSI",
    "principal_name": "JITENDRA KUMAR SHARMA",
    "principal_mobile": "7073800244",
    "incharge_name": "BALKARAN SINGH",
    "incharge_mobile": "8875634183",
    "submitted_by": "JITENDRA KUMAR SHARMA",
    "c9": {
        "zero_enrolment": False,
        "hindi": 75,
        "english": 70,
        "maths": 75,
        "science": 80,
        "sst": 65,
        "sanskrit": 90,
        "urdu": 0
    },
    "c10": {
        "zero_enrolment": False,
        "hindi": 95,
        "english": 94,
        "maths": 96,
        "science": 95,
        "sst": 97,
        "sanskrit": 95,
        "urdu": 0
    },
    "c11": {
        "zero_enrolment": False,
        "comp_hindi": 84,
        "comp_english": 85,
        "faculties": ["arts"],
        "electives": [
            {"key": "history", "name": "इतिहास (History)", "pct": 75},
            {"key": "geography", "name": "भूगोल (Geography)", "pct": 78},
            {"key": "hindilit", "name": "हिंदी साहित्य (Hindi Literature)", "pct": 79}
        ]
    },
    "c12": {
        "zero_enrolment": True,
        "comp_hindi": 0,
        "comp_english": 0,
        "faculties": [],
        "electives": []
    },
    "average_pct": 84.0,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# 5. 488791 - रा.बा.उ.मा.वि. खेड़ी
subs["488791"] = {
    "school_code": "488791",
    "exam_code": "AJM04G488791",
    "school_name": "रा.बा.उ.मा.वि. खेड़ी",
    "peeo_name": "PEEO KARATI",
    "principal_name": "हंस राज गुर्जर",
    "principal_mobile": "8890478933",
    "incharge_name": "श्रीमती चंचल कच्छवाहा",
    "incharge_mobile": "8003070002",
    "submitted_by": "हंस राज गुर्जर",
    "c9": {
        "zero_enrolment": False,
        "hindi": 75,
        "english": 70,
        "maths": 70,
        "science": 75,
        "sst": 80,
        "sanskrit": 95,
        "urdu": 0
    },
    "c10": {
        "zero_enrolment": False,
        "hindi": 90,
        "english": 80,
        "maths": 80,
        "science": 90,
        "sst": 90,
        "sanskrit": 95,
        "urdu": 0
    },
    "c11": {
        "zero_enrolment": False,
        "comp_hindi": 85,
        "comp_english": 80,
        "faculties": ["arts"],
        "electives": [
            {"key": "history", "name": "इतिहास (History)", "pct": 75},
            {"key": "hindilit", "name": "हिंदी साहित्य (Hindi Literature)", "pct": 70},
            {"key": "homesci", "name": "गृह विज्ञान (Home Science)", "pct": 80}
        ]
    },
    "c12": {
        "zero_enrolment": True,
        "comp_hindi": 0,
        "comp_english": 0,
        "faculties": [],
        "electives": []
    },
    "average_pct": 81.2,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# 6. 488897 - रा.उ.मा.वि. घणा
subs["488897"] = {
    "school_code": "488897",
    "exam_code": "AJM04G488897",
    "school_name": "रा.उ.मा.वि. घणा",
    "peeo_name": "PEEO SOBRI",
    "principal_name": "SUMITRA KUMARI PHULWARI",
    "principal_mobile": "9928994663",
    "incharge_name": "Satyendra singh",
    "incharge_mobile": "9460660031",
    "submitted_by": "SUMITRA KUMARI PHULWARI",
    "c9": {
        "zero_enrolment": False,
        "hindi": 90,
        "english": 80,
        "maths": 88,
        "science": 90,
        "sst": 90,
        "sanskrit": 90,
        "urdu": 0
    },
    "c10": {
        "zero_enrolment": False,
        "hindi": 100,
        "english": 90,
        "maths": 90,
        "science": 90,
        "sst": 100,
        "sanskrit": 85,
        "urdu": 0
    },
    "c11": {
        "zero_enrolment": False,
        "comp_hindi": 85,
        "comp_english": 82,
        "faculties": ["arts"],
        "electives": [
            {"key": "polsci", "name": "राजनीति विज्ञान (Political Science)", "pct": 90},
            {"key": "geography", "name": "भूगोल (Geography)", "pct": 85},
            {"key": "hindilit", "name": "हिंदी साहित्य (Hindi Literature)", "pct": 90}
        ]
    },
    "c12": {
        "zero_enrolment": False,
        "comp_hindi": 90,
        "comp_english": 85,
        "faculties": ["arts"],
        "electives": [
            {"key": "polsci", "name": "राजनीति विज्ञान (Political Science)", "pct": 100},
            {"key": "geography", "name": "भूगोल (Geography)", "pct": 90},
            {"key": "hindilit", "name": "हिंदी साहित्य (Hindi Literature)", "pct": 95}
        ]
    },
    "average_pct": 89.8,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# 7. 488947 - रा.उ.मा.वि. हियालिया (Zero enrolment in 9-12)
subs["488947"] = {
    "school_code": "488947",
    "exam_code": "AJM04G488947",
    "school_name": "रा.उ.मा.वि. हियालिया",
    "peeo_name": "PEEO EKALSEENGA",
    "principal_name": "SURESH CHANDRA",
    "principal_mobile": "9636233704",
    "incharge_name": "RAJENDRA KUMAR SHARMA",
    "incharge_mobile": "9540386335",
    "submitted_by": "SURESH CHANDRA",
    "c9": {"zero_enrolment": True, "hindi": 0, "english": 0, "maths": 0, "science": 0, "sst": 0, "sanskrit": 0, "urdu": 0},
    "c10": {"zero_enrolment": True, "hindi": 0, "english": 0, "maths": 0, "science": 0, "sst": 0, "sanskrit": 0, "urdu": 0},
    "c11": {"zero_enrolment": True, "comp_hindi": 0, "comp_english": 0, "faculties": [], "electives": []},
    "c12": {"zero_enrolment": True, "comp_hindi": 0, "comp_english": 0, "faculties": [], "electives": []},
    "average_pct": 0,
    "updated_at": ts,
    "is_submitted": True,
    "submitted_at": ts
}

# Save to saman_syllabus_submissions.json
with open(sub_file, 'w', encoding='utf-8') as f:
    json.dump(subs, f, ensure_ascii=False, indent=2)

print(f"Submissions after update: {len(subs)}")

# Now sync with master_cbeo_data.json and master_cbeo_data.js
master_file = 'master_cbeo_data.json'
with open(master_file, 'r', encoding='utf-8') as f:
    master_data = json.load(f)

if 'saman_syllabus_submissions' not in master_data:
    master_data['saman_syllabus_submissions'] = {}

master_data['saman_syllabus_submissions'].update(subs)

with open(master_file, 'w', encoding='utf-8') as f:
    json.dump(master_data, f, ensure_ascii=False, indent=2)

with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
    f.write('const MASTER_CBEO_DATA = ' + json.dumps(master_data, ensure_ascii=False, indent=2) + ';\n')

print("Successfully synced to master_cbeo_data.json and master_cbeo_data.js!")
