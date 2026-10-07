import os

syllbus_dir = r"C:\Users\jiten\Desktop\cbeo\syllbus"
files = sorted([f for f in os.listdir(syllbus_dir) if os.path.isfile(os.path.join(syllbus_dir, f))])

file_mapping = {
    "04 kaykari prati.pdf": {"type": "Non-Syllabus", "desc": "मतदाता सूची कार्यकारी प्रति (Voter List), not syllabus"},
    "CamScanner 10-07-2026 09.42.04.pdf": {"code": "221778", "name": "MGGS भिनाय", "status": "On Portal (85.7%)"},
    "CamScanner 10-07-2026 09.421.04.pdf": {"code": "221778", "name": "MGGS भिनाय (Duplicate)", "status": "On Portal"},
    "DOC-20261007-WA0006.pdf": {"code": "488941", "name": "रा.उ.मा.वि. देवलिया (Devriya)", "status": "On Portal (82.2%)"},
    "DocScanner Oct 7, 2026 8-30 AM.pdf": {"code": "221759", "name": "रा.उ.मा.वि. लामगरा", "status": "On Portal (82.5% in doc / 78% on portal)"},
    "Document Wed_Oct_07_11_11_19.pdf": {"code": "221756", "name": "रा.उ.मा.वि. नांदसी", "status": "On Portal (83.6%)"},
    "Document Wed_Oct_07_11_111_19.pdf": {"code": "221756", "name": "रा.उ.मा.वि. नांदसी (Duplicate)", "status": "On Portal"},
    "exam 26.pdf": {"code": "221780", "name": "रा.उ.मा.वि. भिनाय", "status": "On Portal (90.6%)"},
    "GGSSS khedi पाठयक्रम पूर्णता सूचना.pdf": {"code": "488791", "name": "रा.बा.उ.मा.वि. खेड़ी", "status": "PENDING ON PORTAL"},
    "gsss nimeda lamgara.pdf": {"code": "221761", "name": "रा.उ.मा.वि. निमेड़ा (लामगरा)", "status": "On Portal (86.4%)"},
    "New Doc 10-06-2026 11.46.pdf": {"type": "Non-Syllabus", "desc": "रा.उ.मा.वि. भिनाय - प्रश्न-पत्र मांग अधिकृत विवरण प्रपत्र (Enrolment Demand), not syllabus"},
    "New Doc 10-06-2026 12.49.pdf": {"code": "488897", "name": "रा.उ.मा.वि. घाणा (घणा)", "status": "PENDING ON PORTAL"},
    "Saman_Pariksha_2026_488946_GOVT__SENIOR_SECONDARY_SCHOOL_.pdf": {"code": "488946", "name": "रा.उ.मा.वि. सेदरिया", "status": "On Portal (88%)"},
    "Syllabus_Completion_Report_GSSS CHAPANERI .pdf": {"code": "221758", "name": "रा.उ.मा.वि. चापानेरी", "status": "On Portal (94.3%)"},
    "WhatsApp Image 2026-10-07 at 1.07.47 PM.jpeg": {"code": "221780", "name": "रा.उ.मा.वि. भिनाय", "status": "On Portal (90.6%)"},
    "WhatsApp Image 2026-10-07 at 10.09.48 AM.jpeg": {"code": "494626", "name": "रा.बा.उ.मा.वि. चापानेरी", "status": "On Portal (91.5%)"},
    "WhatsApp Image 2026-10-07 at 10.10.11 AM.jpeg": {"code": "221777", "name": "रा.उ.मा.वि. कुम्हारिया", "status": "On Portal (81.7%)"},
    "WhatsApp Image 2026-10-07 at 10.19.28 AM.jpeg": {"code": "485030", "name": "पीएम श्री रा.उ.मा.वि. बगराई", "status": "On Portal (76.9%)"},
    "WhatsApp Image 2026-10-07 at 11.23.12 AM.jpeg": {"code": "221762", "name": "रा.उ.मा.वि. गुढ़ाखुर्द", "status": "On Portal (84.3%)"},
    "WhatsApp Image 2026-10-07 at 11.30.19 AM.jpeg": {"code": "401778", "name": "रा.उ.मा.वि. नेमेड़ा", "status": "On Portal (71.2%)"},
    "WhatsApp Image 2026-10-07 at 12.22.54 PM.jpeg": {"code": "221766", "name": "रा.उ.मा.वि. पाडलिया", "status": "On Portal (85.6%)"},
    "WhatsApp Image 2026-10-07 at 12.50.02 PM.jpeg": {"code": "221774", "name": "रा.उ.मा.वि. खेड़ी", "status": "On Portal (85.2%)"},
    "WhatsApp Image 2026-10-07 at 12.51.53 PM.jpeg": {"code": "221766", "name": "रा.उ.मा.वि. पाडलिया (Duplicate)", "status": "On Portal"},
    "WhatsApp Image 2026-10-07 at 8.13.58 AM.jpeg": {"code": "221764", "name": "रा.उ.मा.वि. बड़गांव (सूरखण्ड)", "status": "PENDING ON PORTAL"},
    "WhatsApp Image 2026-10-07 at 8.13.59 AM.jpeg": {"code": "488791", "name": "रा.बा.उ.मा.वि. खेड़ी", "status": "PENDING ON PORTAL"},
    "WhatsApp Image 2026-10-07 at 8.14.01 AM.jpeg": {"code": "221765", "name": "रा.उ.मा.वि. कनाई कलां", "status": "PENDING ON PORTAL"},
    "WhatsApp Image 2026-10-07 at 8.14.02 AM.jpeg": {"code": "221781", "name": "रा.उ.मा.वि. सिंगावल", "status": "On Portal (91%)"},
    "WhatsApp Image 2026-10-07 at 8.14.04 AM.jpeg": {"code": "221764", "name": "रा.उ.मा.वि. बड़गांव (सूरखण्ड) (2nd page/copy)", "status": "PENDING ON PORTAL"},
    "WhatsApp Image 2026-10-07 at 8.14.05 AM.jpeg": {"code": "488947", "name": "रा.उ.मा.वि. हियालिया", "status": "PENDING ON PORTAL"},
    "WhatsApp Image 2026-10-07 at 8.35.56 AM.jpeg": {"code": "221757", "name": "रा.उ.मा.वि. कुरथल", "status": "On Portal (77.2%)"},
    "कोर्स GGSSS NANDSI.pdf": {"code": "410632", "name": "रा.बा.उ.मा.वि. नांदसी", "status": "PENDING ON PORTAL"},
    "पाठ्यक्रम पूर्णता प्रतिशत रिपोर्ट (Black & Wahite).pdf": {"code": "221770", "name": "MGGS बांदनवाड़ा (Duplicate typo)", "status": "PENDING ON PORTAL"},
    "पाठ्यक्रम पूर्णता प्रतिशत रिपोर्ट (Black & White).pdf": {"code": "221770", "name": "MGGS बांदनवाड़ा", "status": "PENDING ON PORTAL"}
}

print(f"Total files accounted for: {len(file_mapping)} / {len(files)}")
unaccounted = [f for f in files if f not in file_mapping]
print(f"Unaccounted files: {unaccounted}")
