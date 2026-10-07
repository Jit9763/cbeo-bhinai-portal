/**
 * CBEO Bhinai Portal - Official Census 2026 Village & School Mapping Engine
 * Block: Bhinai | District: AJMER (अजमेर)
 */

const OFFICIAL_CENSUS_VILLAGES = [
  {
    "sr": 1,
    "name_hi": "अमरगढ",
    "name_en": "AMARGARH",
    "lgd_code": 92182,
    "gram_panchayat": "देवपुरा"
  },
  {
    "sr": 2,
    "name_hi": "मोतीपुरा",
    "name_en": "MOTIPURA",
    "lgd_code": 92183,
    "gram_panchayat": "देवपुरा"
  },
  {
    "sr": 3,
    "name_hi": "रूपपुरा",
    "name_en": "ROOPPURA",
    "lgd_code": 92184,
    "gram_panchayat": "देवपुरा"
  },
  {
    "sr": 4,
    "name_hi": "रामपुरा",
    "name_en": "RAMPURA",
    "lgd_code": 92185,
    "gram_panchayat": "देवपुरा"
  },
  {
    "sr": 5,
    "name_hi": "देवपुरा",
    "name_en": "DEVPURA",
    "lgd_code": 92186,
    "gram_panchayat": "देवपुरा"
  },
  {
    "sr": 6,
    "name_hi": "गज्जनाड़ी",
    "name_en": "GAJJANAADI",
    "lgd_code": 92187,
    "gram_panchayat": "देवपुरा"
  },
  {
    "sr": 7,
    "name_hi": "बान्दनवाडा",
    "name_en": "BANDANWARA",
    "lgd_code": 92188,
    "gram_panchayat": "बान्दनवाडा"
  },
  {
    "sr": 8,
    "name_hi": "सूरजपुरा",
    "name_en": "SOORAJPURA",
    "lgd_code": 92189,
    "gram_panchayat": "कुम्हारिया"
  },
  {
    "sr": 9,
    "name_hi": "बगराई",
    "name_en": "BAGARI",
    "lgd_code": 92190,
    "gram_panchayat": "कुम्हारिया"
  },
  {
    "sr": 10,
    "name_hi": "कुम्हारिया",
    "name_en": "KUMHARIYA",
    "lgd_code": 92191,
    "gram_panchayat": "कुम्हारिया"
  },
  {
    "sr": 11,
    "name_hi": "कीटाप",
    "name_en": "KITAP",
    "lgd_code": 92192,
    "gram_panchayat": "कुम्हारिया"
  },
  {
    "sr": 12,
    "name_hi": "सेदरिया",
    "name_en": "SEDRIYA",
    "lgd_code": 92193,
    "gram_panchayat": "छछून्दरा"
  },
  {
    "sr": 13,
    "name_hi": "छछून्दरा",
    "name_en": "CHHACHHUNDRA",
    "lgd_code": 92194,
    "gram_panchayat": "छछून्दरा"
  },
  {
    "sr": 14,
    "name_hi": "दौलतपुरा",
    "name_en": "DAULATPURA",
    "lgd_code": 92195,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 15,
    "name_hi": "प्रतापपुरा",
    "name_en": "PRATAPPURA",
    "lgd_code": 92196,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 16,
    "name_hi": "करांटी",
    "name_en": "KARANTI",
    "lgd_code": 92197,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 17,
    "name_hi": "गोवलिया",
    "name_en": "GOVLIYA",
    "lgd_code": 92198,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 18,
    "name_hi": "खेडी",
    "name_en": "KHEDI",
    "lgd_code": 92199,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 19,
    "name_hi": "पड़ागा",
    "name_en": "PADANGA",
    "lgd_code": 92200,
    "gram_panchayat": "पड़ागा"
  },
  {
    "sr": 20,
    "name_hi": "सवाईपुरा",
    "name_en": "SAWAIPURA",
    "lgd_code": 92201,
    "gram_panchayat": "पड़ागा"
  },
  {
    "sr": 21,
    "name_hi": "अर्जुनपुरा 92202",
    "name_en": "ARJUNPURA",
    "lgd_code": 92202,
    "gram_panchayat": "पड़ागा"
  },
  {
    "sr": 22,
    "name_hi": "झीपिया",
    "name_en": "JHEEPIYA",
    "lgd_code": 92203,
    "gram_panchayat": "राताकोट"
  },
  {
    "sr": 23,
    "name_hi": "राताकोट",
    "name_en": "RATAKOT",
    "lgd_code": 92204,
    "gram_panchayat": "राताकोट"
  },
  {
    "sr": 24,
    "name_hi": "मथानिया 92205",
    "name_en": "MATHANIYA",
    "lgd_code": 92205,
    "gram_panchayat": "सिगावल"
  },
  {
    "sr": 25,
    "name_hi": "खटानो का खेडा",
    "name_en": "KHATANO KA KHEDA",
    "lgd_code": 92206,
    "gram_panchayat": "सिगावल"
  },
  {
    "sr": 26,
    "name_hi": "हियालिया",
    "name_en": "HIYALIYA",
    "lgd_code": 92207,
    "gram_panchayat": "एकलसिंगा"
  },
  {
    "sr": 27,
    "name_hi": "बनेडिया",
    "name_en": "BANEDIYA",
    "lgd_code": 92208,
    "gram_panchayat": "एकलसिंगा"
  },
  {
    "sr": 28,
    "name_hi": "बालापुरा",
    "name_en": "BALAPURA",
    "lgd_code": 92209,
    "gram_panchayat": "एकलसिंगा"
  },
  {
    "sr": 29,
    "name_hi": "सिगावल",
    "name_en": "SINGAWAL",
    "lgd_code": 92210,
    "gram_panchayat": "सिगावल"
  },
  {
    "sr": 30,
    "name_hi": "गोपालपुरा",
    "name_en": "GOPALPURA",
    "lgd_code": 92211,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 31,
    "name_hi": "सरगांव",
    "name_en": "SARGAON",
    "lgd_code": 92212,
    "gram_panchayat": "छछून्दरा"
  },
  {
    "sr": 32,
    "name_hi": "गोरधनपुरा",
    "name_en": "GORDHANPURA",
    "lgd_code": 92213,
    "gram_panchayat": "करांटी"
  },
  {
    "sr": 33,
    "name_hi": "जोरावरपुरा",
    "name_en": "JORAVARPURA",
    "lgd_code": 92214,
    "gram_panchayat": "छछून्दरा"
  },
  {
    "sr": 34,
    "name_hi": "रतनपुरा",
    "name_en": "RATANPURA",
    "lgd_code": 92215,
    "gram_panchayat": "छछून्दरा"
  },
  {
    "sr": 35,
    "name_hi": "भिनाय",
    "name_en": "BHINAI",
    "lgd_code": 92216,
    "gram_panchayat": "भिनाय"
  },
  {
    "sr": 36,
    "name_hi": "उदयगढ़खेडा",
    "name_en": "UDAIGARH KHEDA",
    "lgd_code": 92217,
    "gram_panchayat": "धांतोल"
  },
  {
    "sr": 37,
    "name_hi": "गुजरवाडा",
    "name_en": "GUJARWADA",
    "lgd_code": 92218,
    "gram_panchayat": "धांतोल"
  },
  {
    "sr": 38,
    "name_hi": "धांतोल",
    "name_en": "DHANTOL",
    "lgd_code": 92219,
    "gram_panchayat": "धांतोल"
  },
  {
    "sr": 39,
    "name_hi": "हीरापुरा",
    "name_en": "HEERAPURA",
    "lgd_code": 92220,
    "gram_panchayat": "राममालिया"
  },
  {
    "sr": 40,
    "name_hi": "राममालिया",
    "name_en": "RAMMALIYA",
    "lgd_code": 92221,
    "gram_panchayat": "राममालिया"
  },
  {
    "sr": 41,
    "name_hi": "रघुनाथगढ़",
    "name_en": "RAGHUNATHGARH",
    "lgd_code": 92222,
    "gram_panchayat": "राममालिया"
  },
  {
    "sr": 42,
    "name_hi": "पीलोदा",
    "name_en": "PEELODA",
    "lgd_code": 92223,
    "gram_panchayat": "राममालिया"
  },
  {
    "sr": 43,
    "name_hi": "बूबकिया",
    "name_en": "BOOBKIYA",
    "lgd_code": 92224,
    "gram_panchayat": "बूबकिया"
  },
  {
    "sr": 44,
    "name_hi": "रेण",
    "name_en": "REN",
    "lgd_code": 92225,
    "gram_panchayat": "बूबकिया"
  },
  {
    "sr": 45,
    "name_hi": "सोबडी",
    "name_en": "SOBARI",
    "lgd_code": 92226,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 46,
    "name_hi": "कुम्हारियाखेडा",
    "name_en": "KUMHARIYAKHEDA",
    "lgd_code": 92227,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 47,
    "name_hi": "तेलाडा",
    "name_en": "TELADA",
    "lgd_code": 92228,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 48,
    "name_hi": "प्रतापपुरा",
    "name_en": "PRATAPPURA",
    "lgd_code": 92229,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 49,
    "name_hi": "रूपपुरा",
    "name_en": "RUPPURA",
    "lgd_code": 92230,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 50,
    "name_hi": "चावण्डिया",
    "name_en": "CHAWANDIYA",
    "lgd_code": 92231,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 51,
    "name_hi": "एकलसिंगा",
    "name_en": "EKALSINGHA",
    "lgd_code": 92232,
    "gram_panchayat": "एकलसिंगा"
  },
  {
    "sr": 52,
    "name_hi": "ढाणी",
    "name_en": "DHANI",
    "lgd_code": 92233,
    "gram_panchayat": "एकलसिंगा"
  },
  {
    "sr": 53,
    "name_hi": "झबरकिया",
    "name_en": "JHABARKIYA",
    "lgd_code": 92234,
    "gram_panchayat": "एकलसिंगा"
  },
  {
    "sr": 54,
    "name_hi": "घणा",
    "name_en": "GHANA",
    "lgd_code": 92235,
    "gram_panchayat": "सोबडी"
  },
  {
    "sr": 55,
    "name_hi": "खायडा",
    "name_en": "KHAYDA",
    "lgd_code": 92236,
    "gram_panchayat": "बूबकिया"
  },
  {
    "sr": 56,
    "name_hi": "सोलखुर्द",
    "name_en": "SOLKHURD",
    "lgd_code": 92237,
    "gram_panchayat": "बूबकिया"
  },
  {
    "sr": 57,
    "name_hi": "सोलकला",
    "name_en": "SOLKALAN",
    "lgd_code": 92238,
    "gram_panchayat": "बूबकिया"
  },
  {
    "sr": 58,
    "name_hi": "पीपलिया",
    "name_en": "PEEPLIYA",
    "lgd_code": 92239,
    "gram_panchayat": "बूबकिया"
  },
  {
    "sr": 59,
    "name_hi": "बडला उर्फ़ काला तालाब",
    "name_en": "BARLA URF KALA TALAB",
    "lgd_code": 92240,
    "gram_panchayat": "नागोला"
  },
  {
    "sr": 60,
    "name_hi": "सपनीखेडा",
    "name_en": "SAPNIKHERA",
    "lgd_code": 92241,
    "gram_panchayat": "नागोला"
  },
  {
    "sr": 61,
    "name_hi": "केरियाखुर्द",
    "name_en": "KERIYAKHURD",
    "lgd_code": 92242,
    "gram_panchayat": "बडगांव"
  },
  {
    "sr": 62,
    "name_hi": "बालापुरा",
    "name_en": "BALAPURA",
    "lgd_code": 92243,
    "gram_panchayat": "नागोला"
  },
  {
    "sr": 63,
    "name_hi": "बडगांव",
    "name_en": "BARGAON",
    "lgd_code": 92244,
    "gram_panchayat": "बडगांव"
  },
  {
    "sr": 64,
    "name_hi": "रघुनाथपुरा",
    "name_en": "RAGHUNATHPURA",
    "lgd_code": 92245,
    "gram_panchayat": "बडगांव"
  },
  {
    "sr": 65,
    "name_hi": "कनईकला",
    "name_en": "KANAI KALAN",
    "lgd_code": 92246,
    "gram_panchayat": "कनईकला"
  },
  {
    "sr": 66,
    "name_hi": "कनईखुर्द",
    "name_en": "KANAI KHURD",
    "lgd_code": 92247,
    "gram_panchayat": "कनईकला"
  },
  {
    "sr": 67,
    "name_hi": "धान्धो का खेडा",
    "name_en": "DHANDHO KA KHEDA",
    "lgd_code": 92248,
    "gram_panchayat": "कनईकला"
  },
  {
    "sr": 68,
    "name_hi": "निमेडा",
    "name_en": "NIMEDA",
    "lgd_code": 92249,
    "gram_panchayat": "कनईकला"
  },
  {
    "sr": 69,
    "name_hi": "काचरिया",
    "name_en": "KACHRIYA",
    "lgd_code": 92250,
    "gram_panchayat": "नान्दसी"
  },
  {
    "sr": 70,
    "name_hi": "लक्ष्मीपुरा",
    "name_en": "LAXMIPURA",
    "lgd_code": 92251,
    "gram_panchayat": "कनईकला"
  },
  {
    "sr": 71,
    "name_hi": "चावण्डिया",
    "name_en": "CHAVANDIYA",
    "lgd_code": 92252,
    "gram_panchayat": "पाडलिया"
  },
  {
    "sr": 72,
    "name_hi": "पाडलिया",
    "name_en": "PADALIYA",
    "lgd_code": 92253,
    "gram_panchayat": "पाडलिया"
  },
  {
    "sr": 73,
    "name_hi": "बीलिया",
    "name_en": "BILIYA",
    "lgd_code": 92254,
    "gram_panchayat": "पाडलिया"
  },
  {
    "sr": 74,
    "name_hi": "नागोला",
    "name_en": "NAGOLA",
    "lgd_code": 92255,
    "gram_panchayat": "नागोला"
  },
  {
    "sr": 75,
    "name_hi": "चापानेरी",
    "name_en": "CHAPANERI",
    "lgd_code": 92256,
    "gram_panchayat": "चापानेरी"
  },
  {
    "sr": 76,
    "name_hi": "मूण्डिया खेडा",
    "name_en": "MOONDIYA KHEDA",
    "lgd_code": 92257,
    "gram_panchayat": "पाडलिया"
  },
  {
    "sr": 77,
    "name_hi": "बडलाखेडा",
    "name_en": "BARLAKHEDA",
    "lgd_code": 92258,
    "gram_panchayat": "लामगरा"
  },
  {
    "sr": 78,
    "name_hi": "उदयपुरखेडा",
    "name_en": "UDAIPURKHEDA",
    "lgd_code": 92259,
    "gram_panchayat": "लामगरा"
  },
  {
    "sr": 79,
    "name_hi": "भेरुखेड़ा",
    "name_en": "BHERUKHEDA",
    "lgd_code": 92260,
    "gram_panchayat": "लामगरा"
  },
  {
    "sr": 80,
    "name_hi": "नीमेडा",
    "name_en": "NIMEDA",
    "lgd_code": 92261,
    "gram_panchayat": "लामगरा"
  },
  {
    "sr": 81,
    "name_hi": "गनाहेड़ा",
    "name_en": "GANAHEDA",
    "lgd_code": 92262,
    "gram_panchayat": "लामगरा"
  },
  {
    "sr": 82,
    "name_hi": "बडली",
    "name_en": "BADALI",
    "lgd_code": 92263,
    "gram_panchayat": "बडली"
  },
  {
    "sr": 83,
    "name_hi": "माताजी का खेडा",
    "name_en": "MATJI KA KHEDA",
    "lgd_code": 92264,
    "gram_panchayat": "देवलियाकला"
  },
  {
    "sr": 84,
    "name_hi": "देवलियाकला",
    "name_en": "DEVLIYAKALAN",
    "lgd_code": 92265,
    "gram_panchayat": "देवलियाकला"
  },
  {
    "sr": 85,
    "name_hi": "लामगरा",
    "name_en": "LAMGARA",
    "lgd_code": 92266,
    "gram_panchayat": "लामगरा"
  },
  {
    "sr": 86,
    "name_hi": "बगराई",
    "name_en": "BAGRAI",
    "lgd_code": 92267,
    "gram_panchayat": "गुढाखुर्द"
  },
  {
    "sr": 87,
    "name_hi": "खेडी",
    "name_en": "KHEDI",
    "lgd_code": 92268,
    "gram_panchayat": "गुढाखुर्द"
  },
  {
    "sr": 88,
    "name_hi": "गुढाखुर्द",
    "name_en": "GUDHA KHURD",
    "lgd_code": 92269,
    "gram_panchayat": "गुढाखुर्द"
  },
  {
    "sr": 89,
    "name_hi": "गुढाकला",
    "name_en": "GUDHA KALAN",
    "lgd_code": 92270,
    "gram_panchayat": "गुढाखुर्द"
  },
  {
    "sr": 90,
    "name_hi": "पाण्डोलाई",
    "name_en": "PANDOLAI",
    "lgd_code": 92271,
    "gram_panchayat": "गुढाखुर्द"
  },
  {
    "sr": 91,
    "name_hi": "नान्दसी",
    "name_en": "NANDSI",
    "lgd_code": 92272,
    "gram_panchayat": "नान्दसी"
  },
  {
    "sr": 92,
    "name_hi": "कुरथल",
    "name_en": "KURTHAL",
    "lgd_code": 92273,
    "gram_panchayat": "नान्दसी"
  },
  {
    "sr": 93,
    "name_hi": "जैतपुरा",
    "name_en": "JAITPURA",
    "lgd_code": 92274,
    "gram_panchayat": "कैरोट"
  },
  {
    "sr": 94,
    "name_hi": "कैरोट",
    "name_en": "KAIROT",
    "lgd_code": 92275,
    "gram_panchayat": "कैरोट"
  },
  {
    "sr": 95,
    "name_hi": "कादोलाई",
    "name_en": "KADOLAI",
    "lgd_code": 92276,
    "gram_panchayat": "कैरोट"
  },
  {
    "sr": 96,
    "name_hi": "इन्द्रपुरा",
    "name_en": "INDRAPURA",
    "lgd_code": 946416,
    "gram_panchayat": "गुढाखुर्द"
  },
  {
    "sr": 97,
    "name_hi": "गोरधनपुरा",
    "name_en": "GORDHANPURA",
    "lgd_code": 946417,
    "gram_panchayat": "पाडलिया"
  }
];

const VILLAGE_ALIASES = {
  "AMARGADH": "अमरगढ",
  "AMARGARH": "अमरगढ",
  "BADANVADA": "बान्दनवाडा",
  "BANDANWARA": "बान्दनवाडा",
  "BADGAON": "बड़गांव",
  "BARGAON": "बड़गांव",
  "BADLA KHEDA": "बडला",
  "BADLA URF KALA TALAB": "बडला",
  "BADLA": "बडला",
  "BADLI": "बड़ली",
  "BARLI": "बड़ली",
  "BAGRAI (GURHA KHURD)": "बगराई",
  "BAGRAI (KUMHARIYA)": "बगराई",
  "BAGRAI": "बगराई",
  "BAGARI": "बगराई",
  "BALAPURA (EKALSEENGA)": "बालापुरा",
  "BALAPURA (NAGOLA)": "बालापुरा",
  "BALAPURA": "बालापुरा",
  "BHINAY": "भिनाय",
  "BHINAI": "भिनाय",
  "BUVKIYA": "बूबकिया",
  "BOOBKIYA": "बूबकिया",
  "CHACHUNDRA": "छछून्दरा",
  "CHHACHHUNDRA": "छछून्दरा",
  "CHAMPANERI": "चापानेरी",
  "CHAPANERI": "चापानेरी",
  "DEOLIYA KALAN": "देवलिया कलां",
  "DEVLIYA KALAN": "देवलिया कलां",
  "DHANDHO KA KHERA": "धांधो का खेड़ा",
  "DOLATPURA": "दौलतपुरा",
  "EKALSEENGA": "एकलसिंघा",
  "EKALSINGHA": "एकलसिंघा",
  "GAJJA NADI": "गज्जनाड़ी",
  "GAJJANAADI": "गज्जनाड़ी",
  "GANAHERA": "गनाहेड़ा",
  "GHANA": "घणा",
  "GORDHANPURA": "गोरधनपुरा",
  "GUDHA KHURD": "गुढ़ा खुर्द",
  "GURHA KHURD": "गुढ़ा खुर्द",
  "HARPURA": "हरपुरा",
  "HEERAPURA": "हीरापुरा",
  "HIYALIYA": "हियालिया",
  "INDRAPURA": "इन्द्रपुरा",
  "JAITPURA": "जैतपुरा",
  "JETPURA": "जैतपुरा",
  "JHIPIYA": "झींपिया",
  "KADOLAI": "कादोलाई",
  "KAIROT": "कैरोट",
  "KEROT": "कैरोट",
  "KANAI KALA": "कनाई कलां",
  "KANAI KALAN": "कनाई कलां",
  "KARANTI": "करांटी",
  "KARATI": "करांटी",
  "KHEDI": "खेड़ी",
  "KUMHARIYA": "कुम्हारिया",
  "KURTHAL": "कूरथल",
  "LAMGARA": "लाम्गरा",
  "NAGOLA": "नागोला",
  "NANDSI": "नांदसी",
  "NEMEDA": "निमेड़ा",
  "NIMEDA": "निमेड़ा",
  "PADANGA": "पाडंगा",
  "PADLIYA": "पाडलिया",
  "PADALIYA": "पाडलिया",
  "PIPLIYA": "पीपलिया",
  "RAGHUNATHGADH": "रघुनाथगढ़",
  "RAMMALIYA": "राममालिया",
  "RAMMALIA": "राममालिया",
  "RATAKOT": "राताकोट",
  "ROOPPURA": "रूपपुरा",
  "SEDRIYA": "सेदरिया",
  "SINGAWAL": "सिंगावल",
  "SOBRI": "सोबड़ी",
  "SOORAJPURA": "सूरजपुरा",
  "SURKHAND": "सूरखण्ड",
  "TANTOTI": "टांटोटी",
  "KHERI": "खेड़ी",
  "MOTIPURA": "मोतीपुरा",
  "RAMPURA": "रामपुरा",
  "KITAP": "कीटाप",
  "BHAGWANPURA": "भगवानपुरा"
};


function resolveStandardVillage(rawName) {
  if (!rawName) return '';
  const s = String(rawName).trim();
  const cleanKey = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (VILLAGE_ALIASES[s]) return VILLAGE_ALIASES[s];
  if (VILLAGE_ALIASES[cleanKey]) return VILLAGE_ALIASES[cleanKey];
  if (VILLAGE_ALIASES[s.toUpperCase()]) return VILLAGE_ALIASES[s.toUpperCase()];

  const matchHi = OFFICIAL_CENSUS_VILLAGES.find(v => v.name_hi === s);
  if (matchHi) return matchHi.name_hi;

  const matchEn = OFFICIAL_CENSUS_VILLAGES.find(v => v.name_en.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanKey);
  if (matchEn) return matchEn.name_hi;

  return s;
}

function getVillageDetails(villageName) {
  const std = resolveStandardVillage(villageName);
  return OFFICIAL_CENSUS_VILLAGES.find(v => v.name_hi === std) || {
    name_hi: std || villageName,
    name_en: villageName,
    gram_panchayat: '',
    lgd_code: ''
  };
}

if (typeof window !== 'undefined') {
  window.OFFICIAL_CENSUS_VILLAGES = OFFICIAL_CENSUS_VILLAGES;
  window.VILLAGE_ALIASES = VILLAGE_ALIASES;
  window.resolveStandardVillage = resolveStandardVillage;
  window.getVillageDetails = getVillageDetails;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OFFICIAL_CENSUS_VILLAGES, VILLAGE_ALIASES, resolveStandardVillage, getVillageDetails };
}
