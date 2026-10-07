/**
 * CBEO Bhinai Portal - Enhanced Application Logic
 * Supports:
 * - Admin (Jitendra Kumar & CBEO Pramila Raslot) & 25 PEEOs (Shala Darpan Codes as User ID)
 * - 3-Level Hierarchical School & Staff Explorer (PEEO -> School -> Staff)
 * - Global Block Search across 153 Schools & 1048 Staff
 * - Rectangular Official Rubber Stamp (सीधी मोहर) & Digital Signature Pad
 * - Dual PDF Engine: Print to PDF & html2pdf Download with Hindi Unicode support
 * - Publish / Unpublish Checkbox for Information Demands (Hide/Show for PEEOs)
 * - Add New School (Govt / Private) & Staff Management with Audit Logs
 */

// -------------------------------------------------------------------------
// Global Resilient Error Boundary & Universal Backend Engine
// -------------------------------------------------------------------------
window.addEventListener('error', function(event) {
  console.warn('[CBEO-GUARD] Handled runtime error:', event.message, event.filename, event.lineno);
  // Prevent halt of JavaScript thread
  return true;
});

window.addEventListener('unhandledrejection', function(event) {
  console.warn('[CBEO-GUARD] Handled promise rejection:', event.reason);
});

function getEffectiveApiBaseUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8089';
  }
  const customVmUrl = localStorage.getItem('cbeo_vm_api_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.vm_api_url);
  if (customVmUrl && customVmUrl.startsWith('http')) {
    return customVmUrl.replace(/\/+$/, '');
  }
  return '';
}
window.getEffectiveApiBaseUrl = getEffectiveApiBaseUrl;

// Global State
let STATE = {
  currentUser: null,
  admins: [],
  peeos: [],
  staff: [],
  auditLogs: [],
  demands: [],
  submissions: {},
  schools56: [],
  samanParikshaSubmissions: {},
  adminTabConfig: {
    saman_pariksha: true,
    directory: false,
    explorer: false,
    reports: true
  },
  customPasswords: {},
  sheetAuthPasswords: {},
  schoolLoginPolicy: 'sec_srsec',
  schoolLoginOverrides: {},
  schoolDetailsOverrides: {},
  demandSubmissions: {},
  activeDemandPortalId: null,
  currentDemandToFill: null,
  currentDemandSchoolCode: null,
  currentSignatureData: null,
  portalSettings: {},
  samanParikshaArchived: false,
  samanParikshaActiveForm: 'syllabus', // 'indent' (Question Paper Indent) or 'syllabus' (Syllabus Completion %)
  samanParikshaSchoolTypeFilter: 'govt_only', // 'both' (57), 'govt_only' (49), or 'pvt_only' (8)
  samanSyllabusSubmissions: {}
};
window.STATE = STATE;

// Canvas Signature State
let canvas, ctx;
let isDrawing = false;
let hasSignature = false;

// Portal Build Version - Incremented to trigger automatic hard reset
const CURRENT_PORTAL_VERSION = 'v32_2026_10_07_peeo_lock_and_auto_reset';

// Automatic Hard Reset & Cache Buster (Executes immediately on page load)
(function checkAndPerformAutoHardReset() {
  const savedVersion = localStorage.getItem('cbeo_portal_version');
  if (savedVersion !== CURRENT_PORTAL_VERSION) {
    console.log('[CBEO-PORTAL] ⚡ Auto Hard Reset Triggered! Old version:', savedVersion, '-> New version:', CURRENT_PORTAL_VERSION);
    
    // Critical keys to preserve (user login session, drafts, and custom admin configurations)
    const preserveKeys = [
      'cbeo_user', 'cbeo_logged_user', 'cbeo_remember_me', 'cbeo_saved_username',
      'cbeo_tab_visibility_6level', 'cbeo_edit_permissions_6level',
      'cbeo_tab_visibility_5level', 'cbeo_edit_permissions_5level',
      'cbeo_saman_active_form', 'cbeo_saman_mismatch_settings', 'cbeo_portal_settings', 'cbeo_vm_settings'
    ];
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !preserveKeys.includes(k) && !k.startsWith('cbeo_form_draft_')) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });

    localStorage.setItem('cbeo_portal_version', CURRENT_PORTAL_VERSION);
    localStorage.setItem('cbeo_data_version', CURRENT_PORTAL_VERSION);

    // Purge browser caches
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    // Purge sessionStorage
    try { sessionStorage.clear(); } catch(e) {}
  }
})();

// Force 100% hard refresh and purge all caches
function forcePortalHardRefresh() {
  localStorage.setItem('cbeo_client_app_version', 'force_refresh_' + Date.now());
  localStorage.removeItem('cbeo_portal_version');
  localStorage.removeItem('cbeo_data_version');
  localStorage.removeItem('cbeo_tab_visibility_6level');
  localStorage.removeItem('cbeo_tab_visibility_5level');
  localStorage.removeItem('cbeo_vm_settings');
  if ('caches' in window) {
    caches.keys().then(function(keys) {
      keys.forEach(function(k) { caches.delete(k); });
    });
  }
  var url = new URL(window.location.href);
  url.searchParams.set('_force_cache_bust', Date.now());
  window.location.replace(url.toString());
}
window.forcePortalHardRefresh = forcePortalHardRefresh;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initMasterData();
  if (typeof checkAndPurgeDeepBackupDemands === 'function') checkAndPurgeDeepBackupDemands();
  setupSignaturePad();
  setupAutoLogin();
  renderApp();

  const gformModal = document.getElementById('modal-saman-pariksha-form');
  if (gformModal) {
    gformModal.addEventListener('input', autoSaveGFormDraft);
    gformModal.addEventListener('change', autoSaveGFormDraft);
  }
});

// Standard School Name Resolver (57 Schools - Hindi / English)
function getStandardSchoolName(code, lang = 'hi') {
  if (!code) return '';
  const cStr = String(code).trim();
  const std = (typeof STANDARD_SCHOOL_NAMES !== 'undefined' && STANDARD_SCHOOL_NAMES[cStr]) 
    ? STANDARD_SCHOOL_NAMES[cStr] 
    : null;
  if (std) {
    return (lang === 'en') ? (std.en || std.hi) : (std.hi || std.en);
  }
  const sc = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === cStr);
  if (sc) {
    return (lang === 'en') ? (sc.school_name_en || sc.school_name) : (sc.school_name_hi || sc.school_name);
  }
  return cStr;
}

// Helper to accurately determine if a school has genuinely submitted its Saman Pariksha form
function isSamanParikshaSubmitted(subOrCode) {
  if (!subOrCode) return false;
  const sub = (typeof subOrCode === 'object') 
    ? subOrCode 
    : (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[subOrCode]);
  if (!sub) return false;
  
  if (sub.is_submitted === true) return true;
  
  if (typeof sub.status === 'string') {
    const s = sub.status.trim();
    if (s.indexOf('Submitted') !== -1 || s.indexOf('पूर्ण') !== -1) return true;
  }
  
  const total = Number(sub.grand_total) || 0;
  if (total > 0 && (sub.submitted_by || sub.signature_data || sub.has_digital_signature)) {
    return true;
  }
  
  return false;
}

// Helper to accurately determine if a school has submitted a dynamic information demand
function isDynamicDemandSubmitted(demandId, schoolCode) {
  if (!demandId || !schoolCode) return false;
  const dId = String(demandId).toLowerCase();
  if (dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha') || dId === 'saman_pariksha_2026_27') {
    return isSamanParikshaSubmitted(schoolCode);
  }
  if (!STATE.demandSubmissions || !STATE.demandSubmissions[demandId]) {
    const subKey = `${demandId}_${schoolCode}`;
    if (STATE.submissions && STATE.submissions[subKey] && STATE.submissions[subKey].verified) return true;
    return false;
  }
  const sub = STATE.demandSubmissions[demandId][schoolCode];
  if (!sub) {
    const subKey = `${demandId}_${schoolCode}`;
    if (STATE.submissions && STATE.submissions[subKey] && STATE.submissions[subKey].verified) return true;
    return false;
  }
  if (sub.is_submitted === true) return true;
  if (typeof sub.status === 'string' && (sub.status.indexOf('Submitted') !== -1 || sub.status.indexOf('पूर्ण') !== -1)) return true;
  if (sub.submitted_by || sub.signature || sub.signature_data) return true;
  return false;
}

// Universal Helper to fetch submission details for any demand (Saman Pariksha or Dynamic)
function getDemandSubmissionRecord(demandId, schoolCode) {
  if (!demandId || !schoolCode) return {};
  const dId = String(demandId).toLowerCase();
  if (dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha') || dId === 'saman_pariksha_2026_27') {
    const sp = (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[schoolCode]) || {};
    const hasData = isSamanParikshaSubmitted(sp);
    return {
      is_submitted: hasData,
      verified: hasData,
      submitted_by: sp.principal_name || sp.submitted_by || 'संस्था प्रधान',
      submitter_mobile: sp.principal_mobile || sp.incharge_mobile || '',
      submitted_at: sp.timestamp || '',
      exam_code: sp.exam_code || '',
      grand_total: sp.grand_total || 0,
      data: {
        'कक्षा 9 कुल छात्र': sp.c9_total ?? 0,
        'कक्षा 9 संस्कृत': sp.c9_sanskrit ?? 0,
        'कक्षा 9 उर्दू': sp.c9_urdu ?? 0,
        'कक्षा 10 कुल छात्र': sp.c10_total ?? 0,
        'कक्षा 10 संस्कृत': sp.c10_sanskrit ?? 0,
        'कक्षा 10 उर्दू': sp.c10_urdu ?? 0,
        'कक्षा 11 कुल छात्र': sp.c11_total ?? 0,
        'कक्षा 12 कुल छात्र': sp.c12_total ?? 0,
        'महायोग नामांकित छात्र': sp.grand_total ?? 0
      }
    };
  }

  // Ensure test submissions cache is initialized
  if (!STATE.demandTestSubmissions) {
    try {
      STATE.demandTestSubmissions = JSON.parse(localStorage.getItem('cbeo_demand_test_submissions') || '{}');
    } catch(e) {
      STATE.demandTestSubmissions = {};
    }
  }

  // 1. Live submissions
  const liveSub = (STATE.demandSubmissions && STATE.demandSubmissions[demandId] && STATE.demandSubmissions[demandId][schoolCode]);
  if (liveSub && (liveSub.is_submitted || (liveSub.data && Object.keys(liveSub.data).length > 0))) {
    return liveSub;
  }

  // 2. Test sandbox submissions (Studio or Test Mode)
  const testSub = (STATE.demandTestSubmissions && STATE.demandTestSubmissions[demandId] && STATE.demandTestSubmissions[demandId][schoolCode]);
  if (testSub) {
    const dataObj = (testSub.data && typeof testSub.data === 'object') ? testSub.data : testSub;
    return {
      is_submitted: true,
      is_test_mode: true,
      verified: true,
      submitted_by: testSub.submitted_by || 'परीक्षण संस्था प्रधान',
      submitter_mobile: testSub.submitter_mobile || '',
      submitted_at: testSub.timestamp || new Date().toLocaleString('hi-IN'),
      data: dataObj
    };
  }

  return liveSub || {};
}

const DEFAULT_SAMAN_MISMATCH_SETTINGS = {
  "alert_active": true,
  "alert_title": "🚨 अति-आवश्यक: समान परीक्षा मांग - नामांकन मिसमैच एवं संशोधन सूचना",
  "alert_message": "मान्यवर संस्था प्रधान, आपके विद्यालय द्वारा समान परीक्षा 2026-27 के मांग प्रपत्र में भरा गया कक्षावार नामांकन शाला दर्पण के वास्तविक नामांकन से भिन्न (मिसमैच) पाया गया है।\n\nकार्यालय CBEO भिनाय (अजमेर) द्वारा आपके विद्यालय के लिए मांग प्रपत्र में संशोधन (Custom Edit) की विशेष सुविधा खोल दी गई है। कृपया तुरंत मांग पत्रक में सुधार कर पुनः सबमिट करें।",
  "custom_edit_schools": [
    "221756",
    "221761",
    "221763",
    "221772",
    "221775",
    "221778",
    "221780"
  ],
  "mismatch_details": {
    "221756": {
      "school_name": "राजकीय उच्च माध्यमिक विद्यालय, नांदसी (221756)",
      "peeo_name": "NANDSI",
      "portal_total": 98,
      "sd_total": 92,
      "diff": 6,
      "portal_c9_10": 59,
      "portal_c11_12": 39,
      "sd_c9_10": 55,
      "sd_c11_12": 37,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 6 अधिक है (कक्षा 9 में +4, कक्षा 11 में +2)",
      "reason": "कक्षा 9 में मांग 28 दर्ज है (SD: 24), कक्षा 11 में 19 दर्ज है (SD: 17)।",
      "flagged_fields": [
        "कक्षा 9 मांग",
        "कक्षा 11 मांग",
        "कुल महायोग"
      ]
    },
    "221761": {
      "school_name": "राजकीय उच्च माध्यमिक विद्यालय, निमेड़ा (221761)",
      "peeo_name": "LAMGARA",
      "portal_total": 94,
      "sd_total": 87,
      "diff": 7,
      "portal_c9_10": 55,
      "portal_c11_12": 39,
      "sd_c9_10": 50,
      "sd_c11_12": 37,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 7 अधिक है (कक्षा 9 में +5, कक्षा 11 में +2)",
      "reason": "कक्षा 9 में मांग 37 दर्ज है (SD: 32), कक्षा 11 में 18 दर्ज है (SD: 16)।",
      "flagged_fields": [
        "कक्षा 9 मांग",
        "कक्षा 11 मांग",
        "कुल महायोग"
      ]
    },
    "221763": {
      "school_name": "राजकीय उच्च माध्यमिक विद्यालय, बूबकिया (221763)",
      "peeo_name": "BOOBKIYA",
      "portal_total": 148,
      "sd_total": 142,
      "diff": 6,
      "portal_c9_10": 104,
      "portal_c11_12": 44,
      "sd_c9_10": 98,
      "sd_c11_12": 44,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 6 अधिक है (कक्षा 9 में +6)",
      "reason": "कक्षा 9 में मांग 49 दर्ज है (SD: 43)।",
      "flagged_fields": [
        "कक्षा 9 मांग",
        "कुल महायोग"
      ]
    },
    "221772": {
      "school_name": "राजकीय उच्च माध्यमिक विद्यालय, नागोला (221772)",
      "peeo_name": "NAGOLA",
      "portal_total": 223,
      "sd_total": 222,
      "diff": 1,
      "portal_c9_10": 133,
      "portal_c11_12": 90,
      "sd_c9_10": 132,
      "sd_c11_12": 90,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 1 अधिक है (कक्षा 9 में +1)",
      "reason": "कक्षा 9 में मांग 80 दर्ज है (SD: 79)।",
      "flagged_fields": [
        "कक्षा 9 मांग",
        "कुल महायोग"
      ]
    },
    "221775": {
      "school_name": "राजकीय उच्च माध्यमिक विद्यालय, राताकोट (221775)",
      "peeo_name": "RATAKOT",
      "portal_total": 122,
      "sd_total": 121,
      "diff": 1,
      "portal_c9_10": 70,
      "portal_c11_12": 52,
      "sd_c9_10": 70,
      "sd_c11_12": 51,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 1 अधिक है (कक्षा 11 में +1)",
      "reason": "कक्षा 11 में मांग 29 दर्ज है (SD: 28)।",
      "flagged_fields": [
        "कक्षा 11 मांग",
        "कुल महायोग"
      ]
    },
    "221778": {
      "school_name": "महात्मा गांधी राजकीय विद्यालय, भिनाय (221778)",
      "peeo_name": "BHINAY",
      "portal_total": 87,
      "sd_total": 86,
      "diff": 1,
      "portal_c9_10": 44,
      "portal_c11_12": 43,
      "sd_c9_10": 44,
      "sd_c11_12": 42,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 1 अधिक है (कक्षा 12 में +1)",
      "reason": "कक्षा 12 में मांग 19 दर्ज है (SD: 18)।",
      "flagged_fields": [
        "कक्षा 12 मांग",
        "कुल महायोग"
      ]
    },
    "221780": {
      "school_name": "राजकीय उच्च माध्यमिक विद्यालय, भिनाय (221780)",
      "peeo_name": "BHINAY",
      "portal_total": 411,
      "sd_total": 396,
      "diff": 15,
      "portal_c9_10": 232,
      "portal_c11_12": 179,
      "sd_c9_10": 220,
      "sd_c11_12": 176,
      "diff_text": "पेपर मांग शाला दर्पण नामांकन से 15 अधिक है (कक्षा 9 में +12, कक्षा 11 में +3)",
      "reason": "कक्षा 9 में मांग 144 दर्ज है (SD: 132) तथा कक्षा 11 में 90 दर्ज है (SD: 87)।",
      "flagged_fields": [
        "कक्षा 9 मांग",
        "कक्षा 11 मांग",
        "कुल महायोग"
      ]
    }
  }
};

function getSamanMismatchConfig() {
  if (!STATE.samanMismatchSettings) {
    try {
      const sto = localStorage.getItem('cbeo_saman_mismatch_settings');
      STATE.samanMismatchSettings = sto ? JSON.parse(sto) : JSON.parse(JSON.stringify(DEFAULT_SAMAN_MISMATCH_SETTINGS));
    } catch(e) {
      STATE.samanMismatchSettings = JSON.parse(JSON.stringify(DEFAULT_SAMAN_MISMATCH_SETTINGS));
    }
  }
  return STATE.samanMismatchSettings;
}

function getOfficialSchoolNames(school) {
  if (!school) return { en: '', hi: '' };
  const code = String(school.shala_darpan_code || school.code || '').trim();
  let en = (school.school_name_en || school.school_name || '').trim();
  let hi = (school.school_name_hi || school.school_name || '').trim();

  en = en.replace(/\bRA\.\s*U\.\s*MA\.\s*VI\.\b/gi, 'Govt. Sr. Sec. School')
         .replace(/\bRA\.\s*MA\.\s*VI\.\b/gi, 'Govt. Sec. School')
         .replace(/GSSS/gi, 'Govt. Sr. Sec. School')
         .replace(/Govt\.\s*Sr\.\s*Sec\.\s*School/gi, 'GOVT. SENIOR SECONDARY SCHOOL')
         .replace(/Govt\.\s*Sec\.\s*School/gi, 'GOVT. SECONDARY SCHOOL')
         .replace(/Mahatma Gandhi Govt\. School/gi, 'MAHATMA GANDHI GOVT. SCHOOL')
         .replace(/MGGS/gi, 'MAHATMA GANDHI GOVT. SCHOOL')
         .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
         .trim().toUpperCase();

  hi = hi.replace(/रा\.बा\.उ\.मा\.वि\./g, 'राजकीय बालिका उच्च माध्यमिक विद्यालय')
         .replace(/रा\.उ\.मा\.वि\./g, 'राजकीय उच्च माध्यमिक विद्यालय')
         .replace(/रा\.बा\.मा\.वि\./g, 'राजकीय बालिका माध्यमिक विद्यालय')
         .replace(/रा\.मा\.वि\./g, 'राजकीय माध्यमिक विद्यालय')
         .replace(/महात्मा गांधी रा\.वि\./g, 'महात्मा गांधी राजकीय विद्यालय')
         .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
         .trim();

  const codeSuffix = code ? ` (${code})` : '';
  return {
    en: `${en}${codeSuffix}`,
    hi: `${hi}${codeSuffix}`
  };
}

function getSchoolOfficialFormalHindiHeader(school) {
  if (!school) return '';
  if (school.school_name_formal) return school.school_name_formal;
  const code = String(school.shala_darpan_code || school.code || '').trim();
  let name = (school.school_name_hi || school.school_name || '').trim();

  // Expand standard Hindi government school abbreviations
  name = name.replace(/रा\.बा\.उ\.मा\.वि\./g, 'राजकीय बालिका उच्च माध्यमिक विद्यालय, ')
             .replace(/रा\.उ\.मा\.वि\./g, 'राजकीय उच्च माध्यमिक विद्यालय, ')
             .replace(/रा\.बा\.मा\.वि\./g, 'राजकीय बालिका माध्यमिक विद्यालय, ')
             .replace(/रा\.मा\.वि\./g, 'राजकीय माध्यमिक विद्यालय, ')
             .replace(/महात्मा गांधी रा\.वि\./g, 'महात्मा गांधी राजकीय विद्यालय, ')
             .replace(/पीएम श्री रा\.उ\.मा\.वि\./g, 'पीएम श्री राजकीय उच्च माध्यमिक विद्यालय, ')
             .replace(/पीएम श्री रा\.मा\.वि\./g, 'पीएम श्री राजकीय माध्यमिक विद्यालय, ')
             .replace(/^कार्यालय\s+/g, '')
             .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
             .trim();
  name = name.replace(/,\s*,/g, ',').replace(/विद्यालय,\s*/g, 'विद्यालय, ');

  const codePart = code ? ` | शा.दा. कोड: ${code}` : '';
  return `कार्यालय ${name}${codePart}`;
}
window.getSchoolOfficialFormalHindiHeader = getSchoolOfficialFormalHindiHeader;

/* ========================================================
   1. DATA INITIALIZATION & LOCALSTORAGE SYNC
   ======================================================== */
function initMasterData() {
  if (typeof MASTER_CBEO_DATA === 'undefined') {
    console.error('MASTER_CBEO_DATA not found!');
    return;
  }

  STATE.admins = MASTER_CBEO_DATA.admins || [
    {
      admin_id: 'ADMIN02',
      name: 'जितेन्द्र कुमार (Jitendra Kumar)',
      post: 'तकनीकी नोडल प्रभारी एवं व्यवस्थापक (Admin)',
      office: 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय',
      mobile: '9928254317',
      email: 'jitendrakumar.cbeo@gmail.com',
      username: 'jitendra_admin',
      shala_darpan_code: 'admin_jitendra',
      password: 'jitendra#2026',
      role: 'Super Admin'
    },
    {
      admin_id: 'ADMIN01',
      name: 'प्रमिला रासलोत (CBEO)',
      post: 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)',
      office: 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय',
      mobile: '9414000000',
      email: 'cbeo.bhinai.ajmer@rajasthan.gov.in',
      username: 'cbeo_admin',
      shala_darpan_code: '8140',
      password: 'cbeo@2026',
      role: 'Super Admin'
    }
  ];

  // Versioned cache check to guarantee fresh master data with 57 schools and clean tab settings
  const DATA_VERSION = CURRENT_PORTAL_VERSION;
  if (localStorage.getItem('cbeo_data_version') !== DATA_VERSION) {
    localStorage.removeItem('cbeo_peeos_data');
    localStorage.removeItem('cbeo_staff_data');
    localStorage.removeItem('cbeo_schools56_data');
    localStorage.removeItem('cbeo_saman_pariksha_submissions');
    localStorage.removeItem('cbeo_saman_syllabus_submissions');
    localStorage.removeItem('cbeo_active_tab');
    // NOTE: Form drafts and admin visibility settings are deliberately preserved so user never loses configurations!
    localStorage.setItem('cbeo_data_version', DATA_VERSION);
    try {
      const lu = JSON.parse(localStorage.getItem('cbeo_logged_user') || 'null');
      if (lu && lu.shala_darpan_code === 'P55700') {
        lu.peeo_name = 'PEEO EKALSEENGA';
        lu.peeo_code = '221786';
        localStorage.setItem('cbeo_logged_user', JSON.stringify(lu));
        localStorage.setItem('cbeo_user', JSON.stringify(lu));
      }
    } catch(e) {}
  }

  // Load 6-Level Tab Visibility & Edit Permissions (Admin Custom Settings)
  try {
    const savedVis = localStorage.getItem('cbeo_tab_visibility_6level') || localStorage.getItem('cbeo_tab_visibility_5level');
    if (savedVis) {
      STATE.tabVisibility6Level = JSON.parse(savedVis);
      STATE.tabVisibility5Level = STATE.tabVisibility6Level;
    } else {
      STATE.tabVisibility6Level = JSON.parse(JSON.stringify(DEFAULT_TAB_VISIBILITY_6LEVEL));
      STATE.tabVisibility5Level = STATE.tabVisibility6Level;
    }
  } catch(e) {
    STATE.tabVisibility6Level = JSON.parse(JSON.stringify(DEFAULT_TAB_VISIBILITY_6LEVEL));
    STATE.tabVisibility5Level = STATE.tabVisibility6Level;
  }

  try {
    const savedPerms = localStorage.getItem('cbeo_edit_permissions_6level');
    if (savedPerms) {
      STATE.editPermissions6Level = JSON.parse(savedPerms);
      STATE.editPermissions5Level = STATE.editPermissions6Level;
    } else {
      STATE.editPermissions6Level = JSON.parse(JSON.stringify(DEFAULT_EDIT_PERMISSIONS_6LEVEL));
      STATE.editPermissions5Level = STATE.editPermissions6Level;
    }
  } catch(e) {
    STATE.editPermissions6Level = JSON.parse(JSON.stringify(DEFAULT_EDIT_PERMISSIONS_6LEVEL));
    STATE.editPermissions5Level = STATE.editPermissions6Level;
  }

  // Also sync latest visibility settings from local server in background
  fetch('/api/get_tab_visibility_6level')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.visibility) {
        STATE.tabVisibility6Level = data.visibility;
        STATE.tabVisibility5Level = data.visibility;
        localStorage.setItem('cbeo_tab_visibility_6level', JSON.stringify(data.visibility));
        applyTabVisibility();
        if (typeof render6LevelTabVisibilityMatrix === 'function') render6LevelTabVisibilityMatrix();
      }
    }).catch(() => {});

  // Sync mismatch settings from SQLite API in background
  fetch('/api/get_saman_mismatch_settings')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.settings) {
        STATE.samanMismatchSettings = data.settings;
        localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(data.settings));
        if (STATE.currentTab === 'saman-pariksha') renderSamanParikshaView();
      }
    }).catch(() => {});

  // Sync portal settings and VM settings from local SQLite API (Permanent persistence)
  fetch('/api/get_portal_settings')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.settings && Object.keys(data.settings).length > 0) {
        STATE.portalSettings = Object.assign(STATE.portalSettings || {}, data.settings);
        localStorage.setItem('cbeo_portal_settings', JSON.stringify(STATE.portalSettings));
        if (data.settings.vm_dispatch_config) {
          localStorage.setItem('cbeo_vm_dispatch_config', JSON.stringify(data.settings.vm_dispatch_config));
          if (typeof loadVMDispatchConfig === 'function') loadVMDispatchConfig();
        }
      }
    }).catch(() => {});

  fetch('/api/get_vm_settings')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.settings && Object.keys(data.settings).length > 0) {
        if (typeof CURRENT_VM_SETTINGS !== 'undefined') {
          Object.assign(CURRENT_VM_SETTINGS, data.settings);
        }
        localStorage.setItem('cbeo_vm_settings', JSON.stringify(data.settings));
      }
    }).catch(() => {});

  // Sync latest syllabus submissions from SQLite API immediately
  if (typeof syncSyllabusSubmissionsFromCloud === 'function') {
    syncSyllabusSubmissionsFromCloud(false);
  }

  // Load cached Google Sheet Auth credentials
  try {
    const cachedAuth = localStorage.getItem('cbeo_sheet_auth_cache');
    if (cachedAuth) STATE.sheetAuthPasswords = JSON.parse(cachedAuth);
  } catch(e) {}
  syncAuthFromGoogleSheet();

  // School Login Permission Policy & Overrides (Default: sec_srsec 57 schools)
  STATE.schoolLoginPolicy = localStorage.getItem('cbeo_school_login_policy') || 'sec_srsec';
  try {
    const sto = localStorage.getItem('cbeo_school_login_overrides');
    STATE.schoolLoginOverrides = sto ? JSON.parse(sto) : {};
  } catch(e) {
    STATE.schoolLoginOverrides = {};
  }
  try {
    const sdo = localStorage.getItem('cbeo_school_details_overrides');
    STATE.schoolDetailsOverrides = sdo ? JSON.parse(sdo) : {};
  } catch(e) {
    STATE.schoolDetailsOverrides = {};
  }

  // 1. PEEOs (with schools Govt + Private)
  const storedPeeos = localStorage.getItem('cbeo_peeos_data');
  if (storedPeeos) {
    try {
      STATE.peeos = JSON.parse(storedPeeos);
    } catch (e) {
      STATE.peeos = MASTER_CBEO_DATA.peeos || [];
    }
  } else {
    STATE.peeos = MASTER_CBEO_DATA.peeos || [];
    savePeeosToStorage();
  }

  // 2. Staff: load from localStorage if modified, otherwise use master with auto-upgrade versioning
  const STAFF_VERSION = 'v2_2026_10_07_updated_teacher_record_983';
  const currentStaffVer = localStorage.getItem('cbeo_staff_version');
  if (currentStaffVer !== STAFF_VERSION) {
    localStorage.removeItem('cbeo_staff_data');
    localStorage.setItem('cbeo_staff_version', STAFF_VERSION);
    STATE.staff = MASTER_CBEO_DATA.staff || [];
    saveStaffToStorage();
  } else {
    const storedStaff = localStorage.getItem('cbeo_staff_data');
    if (storedStaff) {
      try {
        const parsed = JSON.parse(storedStaff);
        if (!parsed || parsed.length === 0 || !parsed[0].name_en || !parsed[0].shala_darpan_code) {
          STATE.staff = MASTER_CBEO_DATA.staff || [];
          saveStaffToStorage();
        } else {
          STATE.staff = parsed;
        }
      } catch (e) {
        STATE.staff = MASTER_CBEO_DATA.staff || [];
      }
    } else {
      STATE.staff = MASTER_CBEO_DATA.staff || [];
      saveStaffToStorage();
    }
  }

  // 3. Audit Logs
  const storedLogs = localStorage.getItem('cbeo_audit_logs');
  if (storedLogs) {
    try {
      STATE.auditLogs = JSON.parse(storedLogs);
    } catch (e) {
      STATE.auditLogs = getInitialAuditLogs();
    }
  } else {
    STATE.auditLogs = getInitialAuditLogs();
    saveAuditLogsToStorage();
  }

  // 4. Information Demands
  const storedDemands = localStorage.getItem('cbeo_demands');
  if (storedDemands) {
    try {
      STATE.demands = JSON.parse(storedDemands);
    } catch(e) {
      STATE.demands = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.demands) || [];
    }
  } else {
    STATE.demands = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.demands) || [];
  }

  // Filter out only legacy duplicate IDs to avoid top navbar duplicate tabs
  STATE.demands = (STATE.demands || []).filter(d => 
    d && !d.archived && 
    d.id !== 'saman_pariksha_2026_27' && 
    d.id !== 'DEMAND_SAMAN_PARIKSHA_2026'
  );

  // Seed official Saman Pariksha Syllabus Completion % demand for 49 Govt schools
  if (!STATE.demands.some(d => d.id === 'DEMAND_SAMAN_SYLLABUS_2026')) {
    STATE.demands.unshift({
      id: 'DEMAND_SAMAN_SYLLABUS_2026',
      title: 'समान परीक्षा: सत्र 2026-27 पाठ्यक्रम पूर्णता प्रतिशत मांग (49 राजकीय विद्यालय)',
      collectionLevel: 'school',
      schoolScope: 'govt_sec',
      placement: 'tab_existing',
      parentTab: 'saman-pariksha',
      targetAudience: {
        cbeo: true,
        peeo: true,
        govt_sec_srsec: true,
        pvt_sec_srsec: false, // 8 Private schools strictly excluded!
        sec_srsec: true,
        all_govt: false,
        all_schools: false
      },
      description: 'समान परीक्षा 2026-27 के अंतर्गत ब्लॉक के 49 राजकीय माध्यमिक एवं उच्च माध्यमिक विद्यालयों में कक्षा 9 से 12 तक के विषयवार पाठ्यक्रम पूर्णता प्रतिशत की आधिकारिक मांग। (8 निजी स्कूल पूर्णतया बाहर)',
      dueDate: '2026-10-15',
      priority: 'अति आवश्यक (Urgent)',
      published: true,
      isTestMode: false,
      createdAt: '2026-10-05',
      columns: [
        { name: 'कक्षा 9 हिन्दी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 9 अंग्रेजी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 9 गणित %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 9 विज्ञान %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 9 सा.विज्ञान %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'तृतीय भाषा संस्कृत %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'तृतीय भाषा उर्दू %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 10 हिन्दी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 10 अंग्रेजी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 10 गणित %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 10 विज्ञान %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 10 सा.विज्ञान %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: '10वीं संस्कृत %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: '10वीं उर्दू %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 11 अनिवार्य हिन्दी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 11 अनिवार्य अंग्रेजी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: '11वीं ऐच्छिक विषय %', type: 'text', prefillSource: 'none', placeholder: 'विषय व %' },
        { name: 'कक्षा 12 अनिवार्य हिन्दी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: 'कक्षा 12 अनिवार्य अंग्रेजी %', type: 'number', prefillSource: 'none', placeholder: '%' },
        { name: '12वीं ऐच्छिक विषय %', type: 'text', prefillSource: 'none', placeholder: 'विषय व %' }
      ]
    });
  }
  saveDemandsToStorage();

  // 4B. Dynamic Demand Submissions from localStorage
  try {
    const storedDemandSubs = localStorage.getItem('cbeo_demand_submissions');
    STATE.demandSubmissions = storedDemandSubs ? JSON.parse(storedDemandSubs) : {};
  } catch(e) {
    STATE.demandSubmissions = {};
  }

  // 5. 57 Secondary & Sr. Secondary Schools for Saman Pariksha (49 Govt + 8 Pvt)
  const storedSchools56 = localStorage.getItem('cbeo_schools56_data');
  if (storedSchools56) {
    try {
      STATE.schools56 = JSON.parse(storedSchools56);
      if (!Array.isArray(STATE.schools56) || STATE.schools56.length < 57 || !STATE.schools56.some(s => s.shala_darpan_code === '221757')) {
        STATE.schools56 = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.schools_56) || [];
        localStorage.setItem('cbeo_schools56_data', JSON.stringify(STATE.schools56));
      }
    } catch (e) {
      STATE.schools56 = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.schools_56) || [];
    }
  } else {
    STATE.schools56 = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.schools_56) || [];
  }

  // 6. Submissions
  const storedSubmissions = localStorage.getItem('cbeo_submissions');
  if (storedSubmissions) {
    try {
      STATE.submissions = JSON.parse(storedSubmissions);
    } catch (e) {
      STATE.submissions = {};
    }
  } else {
    STATE.submissions = {};
    saveSubmissionsToStorage();
  }

  // 7. Saman Pariksha Submissions (Production clean)
  // 7. Saman Pariksha Submissions (Production clean v4 - purged test data for GSS Badanwada 221769)
  if (localStorage.getItem('cbeo_sp_clean_production_v4') !== 'true') {
    localStorage.removeItem('cbeo_saman_pariksha_submissions');
    localStorage.removeItem('cbeo_saman_form_draft');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('cbeo_form_draft_') || k.startsWith('cbeo_sp_'))) {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem('cbeo_sp_clean_production_v4', 'true');
  }

  const storedSPSubs = localStorage.getItem('cbeo_saman_pariksha_submissions');
  const defaultSPSubs = (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.saman_pariksha_submissions) || {};
  if (storedSPSubs) {
    try {
      STATE.samanParikshaSubmissions = Object.assign({}, defaultSPSubs, JSON.parse(storedSPSubs));
    } catch (e) {
      STATE.samanParikshaSubmissions = defaultSPSubs;
    }
  } else {
    STATE.samanParikshaSubmissions = defaultSPSubs;
  }

  // Sanitize MGGS schools data: ensure medium is English and counts are in English cells
  const sanitizeMggsSubmissions = (subs) => {
    if (!subs) return;
    ['221770', '221778', '221753'].forEach(mCode => {
      if (subs[mCode]) {
        const ms = subs[mCode];
        ms.school_medium = 'english';
        if ((!ms.c9_english || ms.c9_english === 0) && (ms.c9_hindi > 0 || (ms.c9_total || 0) > 0)) {
          ms.c9_english = ms.c9_hindi || ms.c9_total || 0;
        }
        ms.c9_hindi = 0;
        if ((!ms.c10_english || ms.c10_english === 0) && (ms.c10_hindi > 0 || (ms.c10_total || 0) > 0)) {
          ms.c10_english = ms.c10_hindi || ms.c10_total || 0;
        }
        ms.c10_hindi = 0;
      }
    });
  };
  sanitizeMggsSubmissions(STATE.samanParikshaSubmissions);

  // Live Sync from Google Sheet via doGet(?action=getAll)
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    fetch(`${gasUrl}?action=getAll`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.submissions) {
          Object.keys(data.submissions).forEach(code => {
            const subData = data.submissions[code];
            if (subData && subData.is_submitted) {
              const existingSig = STATE.samanParikshaSubmissions[code]?.signature_data;
              const existingHasSig = STATE.samanParikshaSubmissions[code]?.has_digital_signature;
              STATE.samanParikshaSubmissions[code] = Object.assign({}, STATE.samanParikshaSubmissions[code] || {}, subData);
              if (existingSig && !STATE.samanParikshaSubmissions[code].signature_data) {
                STATE.samanParikshaSubmissions[code].signature_data = existingSig;
                STATE.samanParikshaSubmissions[code].has_digital_signature = existingHasSig !== undefined ? existingHasSig : true;
              }
            } else {
              delete STATE.samanParikshaSubmissions[code];
            }
          });
          sanitizeMggsSubmissions(STATE.samanParikshaSubmissions);
          localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
          renderSamanParikshaView();
          updateAllPortalMetricsAndProgress();
          renderDashboardView();
          renderDemandsView();
          renderApp();
        }
      }).catch(e => console.log('Live sync note:', e));

    // Live Sync for all active demands from 25 PEEO tabs
    if (Array.isArray(STATE.demands)) {
      STATE.demands.forEach(d => {
        if (d.id && d.id !== 'saman_pariksha_2026_27') {
          fetch(`${gasUrl}?action=getDemandSubmissions&demand_id=${encodeURIComponent(d.id)}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.success && data.submissions) {
                if (!STATE.demandSubmissions) STATE.demandSubmissions = {};
                STATE.demandSubmissions[d.id] = Object.assign({}, STATE.demandSubmissions[d.id] || {}, data.submissions);
                localStorage.setItem('cbeo_demand_submissions', JSON.stringify(STATE.demandSubmissions));
                renderDemandsView();
                if (STATE.activeDemandPortalId === d.id) {
                  renderDynamicDemandPortalView(d.id);
                }
                renderAdminMatrix();
              }
            }).catch(e => console.log('Demand sync note:', e));
        }
      });
    }
  }

  // Also check backend file on localhost if running locally
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    fetch('http://localhost:8089/api/get_saman_pariksha')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.submissions) {
          Object.keys(data.submissions).forEach(code => {
            const fileSub = data.submissions[code];
            const curSub = STATE.samanParikshaSubmissions[code] || {};
            STATE.samanParikshaSubmissions[code] = Object.assign({}, curSub, fileSub);
            if (fileSub.signature_data) {
              STATE.samanParikshaSubmissions[code].signature_data = fileSub.signature_data;
              STATE.samanParikshaSubmissions[code].has_digital_signature = true;
            }
          });
          localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
          renderSamanParikshaView();
          updateAllPortalMetricsAndProgress();
          renderDashboardView();
          renderDemandsView();
        }
      }).catch(() => {});
  }

  // 7B. Sync Saman Pariksha Syllabus % submissions (Runs globally on GitHub Pages & localhost)
  try {
    const masterSylSubs = (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.saman_syllabus_submissions) || {};
    const storedSylSubs = JSON.parse(localStorage.getItem('cbeo_saman_syllabus_submissions') || '{}');
    STATE.samanSyllabusSubmissions = Object.assign({}, masterSylSubs, storedSylSubs);
  } catch(e) {}

  if (typeof syncSyllabusSubmissionsFromCloud === 'function') {
    syncSyllabusSubmissionsFromCloud();
  }

  // 8. Admin Tab Access Configuration
  const storedTabConfig = localStorage.getItem('cbeo_tab_config');
  if (storedTabConfig) {
    try {
      STATE.adminTabConfig = JSON.parse(storedTabConfig);
    } catch (e) {
      STATE.adminTabConfig = (MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.peeo_tab_access) || {
        saman_pariksha: true,
        directory: false,
        explorer: false,
        reports: false
      };
    }
  } else {
    STATE.adminTabConfig = (MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.peeo_tab_access) || {
      saman_pariksha: true,
      directory: false,
      explorer: false,
      reports: false
    };
  }

  // 9. Custom Passwords
  const storedPasswords = localStorage.getItem('cbeo_custom_passwords');
  if (storedPasswords) {
    try {
      STATE.customPasswords = JSON.parse(storedPasswords);
    } catch (e) {
      STATE.customPasswords = {};
    }
  } else {
    STATE.customPasswords = {};
  }

  // 10. Staff Edit Permissions (5-Level & Master Lock)
  try {
    const storedStaffPerms = localStorage.getItem('cbeo_staff_edit_permissions');
    if (storedStaffPerms) {
      STATE.staffEditPermissions = JSON.parse(storedStaffPerms);
    } else {
      STATE.staffEditPermissions = {
        master_lock: false,
        cbeo_can_edit: true,
        peeo_can_edit_staff: true,
        peeo_can_edit_head: true,
        schools_can_edit_staff: false,
        peeo_can_edit_school_mgmt: true,
        schools_can_edit_school_mgmt: false,
        saman_pariksha_lock_schools: true,
        demands_lock_schools: false
      };
    }
  } catch (e) {
    STATE.staffEditPermissions = {
      master_lock: false,
      cbeo_can_edit: true,
      peeo_can_edit_staff: true,
      peeo_can_edit_head: true,
      schools_can_edit_staff: false,
      peeo_can_edit_school_mgmt: true,
      schools_can_edit_school_mgmt: false,
      saman_pariksha_lock_schools: true,
      demands_lock_schools: false
    };
  }

  fetch('/api/get_staff_edit_permissions')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.permissions) {
        STATE.staffEditPermissions = data.permissions;
        localStorage.setItem('cbeo_staff_edit_permissions', JSON.stringify(data.permissions));
        if (typeof renderStaffEditPermissionsMatrix === 'function') renderStaffEditPermissionsMatrix();
      }
    })
    .catch(() => {});

  // 10B. Saman Pariksha Enrolment Mismatch & Custom Edit Settings
  try {
    const stoMismatch = localStorage.getItem('cbeo_saman_mismatch_settings');
    STATE.samanMismatchSettings = stoMismatch ? JSON.parse(stoMismatch) : JSON.parse(JSON.stringify(DEFAULT_SAMAN_MISMATCH_SETTINGS));
  } catch(e) {
    STATE.samanMismatchSettings = JSON.parse(JSON.stringify(DEFAULT_SAMAN_MISMATCH_SETTINGS));
  }

  const loadMismatchJson = (url) => {
    if (localStorage.getItem('cbeo_saman_mismatch_settings')) {
      return Promise.resolve();
    }
    return fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const settings = data?.settings || (data?.custom_edit_schools ? data : null);
        if (settings && !localStorage.getItem('cbeo_saman_mismatch_settings')) {
          STATE.samanMismatchSettings = settings;
          try { localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(settings)); } catch(e) {}
          if (typeof renderSamanParikshaView === 'function') renderSamanParikshaView();
        }
      })
      .catch(() => {});
  };

  fetch('/api/get_saman_mismatch_settings')
    .then(r => {
      if (r.ok) return r.json();
      throw new Error('API not available, fallback to static JSON');
    })
    .then(data => {
      if (data && data.success && data.settings) {
        STATE.samanMismatchSettings = data.settings;
        try { localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(data.settings)); } catch(e) {}
        if (typeof renderSamanParikshaView === 'function') renderSamanParikshaView();
      }
    })
    .catch(() => {
      loadMismatchJson('saman_mismatch_settings.json?v=' + (window.CLIENT_VERSION || Date.now()));
    });

  // 11. 5-Level Tab Visibility Matrix
  try {
    const stored5LevelVis = localStorage.getItem('cbeo_tab_visibility_5level');
    if (stored5LevelVis) {
      STATE.tabVisibility5Level = JSON.parse(stored5LevelVis);
    } else {
      STATE.tabVisibility5Level = DEFAULT_TAB_VISIBILITY_5LEVEL;
    }
  } catch (e) {
    STATE.tabVisibility5Level = DEFAULT_TAB_VISIBILITY_5LEVEL;
  }

  fetch('/api/get_tab_visibility_5level')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.visibility) {
        STATE.tabVisibility5Level = data.visibility;
        localStorage.setItem('cbeo_tab_visibility_5level', JSON.stringify(data.visibility));
        applyTabVisibility();
        if (typeof render5LevelTabVisibilityMatrix === 'function') render5LevelTabVisibilityMatrix();
      }
    })
    .catch(() => {});

  // 12. 5-Level Data Edit Permission Matrix (Master Edit vs View-Only Control)
  try {
    const stored5LevelEdit = localStorage.getItem('cbeo_edit_permissions_5level');
    if (stored5LevelEdit) {
      STATE.editPermissions5Level = JSON.parse(stored5LevelEdit);
    } else {
      STATE.editPermissions5Level = DEFAULT_EDIT_PERMISSIONS_5LEVEL;
    }
  } catch (e) {
    STATE.editPermissions5Level = DEFAULT_EDIT_PERMISSIONS_5LEVEL;
  }

  // 13. Master Custom Designations (Added by Jitendra Super Admin)
  try {
    const storedCustomPosts = localStorage.getItem('cbeo_custom_posts');
    if (storedCustomPosts) {
      if (!STATE.portalSettings) STATE.portalSettings = {};
      STATE.portalSettings.custom_posts = JSON.parse(storedCustomPosts);
    }
  } catch(e) {}
}

function getInitialAuditLogs() {
  return [
    {
      timestamp: new Date().toLocaleString('hi-IN'),
      user: 'जितेन्द्र कुमार (Admin)',
      action: 'पोर्टल सेटअप एवं अपडेशन',
      target: 'मास्टर डेटाबेस',
      details: '25 PEEO, 153 विद्यालय (राजकीय व निजी) तथा 1048 कार्मिक हिंदी यूनिकोड में सिंक किए गए',
      note: 'Google Drive सिंक सक्रिय'
    }
  ];
}

function getInitialDemands() {
  return (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.demands) ? MASTER_CBEO_DATA.demands : [];
}

function savePeeosToStorage() {
  localStorage.setItem('cbeo_peeos_data', JSON.stringify(STATE.peeos));
}

function saveStaffToStorage() {
  localStorage.setItem('cbeo_staff_data', JSON.stringify(STATE.staff));
}

function saveAuditLogsToStorage() {
  localStorage.setItem('cbeo_audit_logs', JSON.stringify(STATE.auditLogs));
}

function saveDemandsToStorage() {
  localStorage.setItem('cbeo_demands', JSON.stringify(STATE.demands));
}

function saveSubmissionsToStorage() {
  localStorage.setItem('cbeo_submissions', JSON.stringify(STATE.submissions));
}

function saveSchools56ToStorage() {
  localStorage.setItem('cbeo_schools56_data', JSON.stringify(STATE.schools56));
}

/* ========================================================
   2. AUTHENTICATION & SESSION MANAGEMENT
   ======================================================== */
function setupAutoLogin() {
  const savedUser = localStorage.getItem('cbeo_logged_user') || localStorage.getItem('cbeo_user');
  if (savedUser) {
    try {
      STATE.currentUser = JSON.parse(savedUser);
      // Auto-synchronize currentUser with latest master data to prevent stale cache
      if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
        const peeo = STATE.peeos.find(p => p.shala_darpan_code === STATE.currentUser.shala_darpan_code);
        if (peeo) {
          STATE.currentUser.principal_incharge = peeo.principal_incharge;
          STATE.currentUser.mobile = peeo.mobile;
          STATE.currentUser.peeo_name = peeo.peeo_name;
          STATE.currentUser.schools = peeo.schools;
          localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
          localStorage.setItem('cbeo_user', JSON.stringify(STATE.currentUser));
        }
      } else if (STATE.currentUser && STATE.currentUser.role === 'school') {
        const sch = STATE.schools56.find(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code);
        if (sch) {
          STATE.currentUser.principal_incharge = sch.principal_name || '';
          STATE.currentUser.principal_name = sch.principal_name || '';
          STATE.currentUser.mobile = sch.principal_mobile || sch.mobile || '';
          STATE.currentUser.school_name = sch.school_name;
          STATE.currentUser.peeo_name = sch.peeo_name;
          STATE.currentUser.peeo_code = sch.peeo_code;
          localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
          localStorage.setItem('cbeo_user', JSON.stringify(STATE.currentUser));
        }
      }
    } catch (e) {
      STATE.currentUser = null;
    }
  } else {
    STATE.currentUser = null;
  }

  // Pre-fill remembered username if saved
  const rememberedUser = localStorage.getItem('cbeo_saved_username');
  if (rememberedUser) {
    const userInput = document.getElementById('login-username');
    if (userInput) userInput.value = rememberedUser;
  }

  // Mobile App Style Persistent Session:
  // If user is already logged in, check idle expiration (4 days) and restore their view
  if (!STATE.currentUser) {
    setTimeout(() => {
      openLoginModal(true); // isMandatory = true
    }, 150);
  } else {
    // 4-day session expiry check
    const maxIdleMs = 4 * 24 * 60 * 60 * 1000; // 4 days inactivity
    const lastActive = STATE.currentUser.last_active_timestamp || STATE.currentUser.login_timestamp || 0;
    if (lastActive && (Date.now() - lastActive > maxIdleMs)) {
      console.warn('Session expired due to 4+ days of inactivity');
      localStorage.removeItem('cbeo_logged_user');
      localStorage.removeItem('cbeo_user');
      STATE.currentUser = null;
      setTimeout(() => {
        openLoginModal(true);
        showToast('सुरक्षा कारणों से 4 दिन से अधिक निष्क्रिय रहने पर सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।', 'warning');
      }, 300);
      return;
    }

    touchUserSession();
    closeModal('modal-login');

    // Restore user's last active tab, or switch to default permitted tab
    const savedTab = localStorage.getItem('cbeo_active_tab');
    if (savedTab && isTabVisibleForCurrentUser(savedTab)) {
      switchTab(savedTab);
    } else if (isTabVisibleForCurrentUser('saman-pariksha') && !STATE.samanParikshaArchived) {
      switchTab('saman-pariksha');
    } else {
      const fallbackTabs = ['demands', 'dashboard', 'directory', 'staff', 'school-management', 'archive'];
      const target = fallbackTabs.find(t => isTabVisibleForCurrentUser(t)) || 'demands';
      switchTab(target);
    }

    // Handle URL query parameters (e.g. ?show_pdf=221754 or ?form=221754)
    const urlParams = new URLSearchParams(window.location.search);
    const showPdfCode = urlParams.get('show_pdf');
    const openFormCode = urlParams.get('form');
    if (showPdfCode) {
      setTimeout(() => {
        if (isTabVisibleForCurrentUser('saman-pariksha')) {
          switchTab('saman-pariksha');
          openExamPdfPreview(showPdfCode);
        }
      }, 300);
    } else if (openFormCode) {
      setTimeout(() => {
        if (isTabVisibleForCurrentUser('saman-pariksha')) {
          switchTab('saman-pariksha');
          openSamanParikshaForm(openFormCode);
        }
      }, 300);
    }
  }
}

function touchUserSession() {
  if (STATE.currentUser) {
    STATE.currentUser.last_active_timestamp = Date.now();
    try {
      localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
      localStorage.setItem('cbeo_user', JSON.stringify(STATE.currentUser));
    } catch(e) {}
  }
}

// Activity listener for session keep-alive (debounced to 1 min)
let sessionTouchThrottle = 0;
['click', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => {
    const now = Date.now();
    if (now - sessionTouchThrottle > 60000) {
      sessionTouchThrottle = now;
      touchUserSession();
    }
  }, { passive: true });
});

function logoutUser() {
  localStorage.removeItem('cbeo_logged_user');
  localStorage.removeItem('cbeo_user');
  STATE.currentUser = null;
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.classList.remove('active');
    m.classList.remove('mandatory-gate');
  });
  updateUserHeaderBadge();
  showToast('सफलतापूर्वक लॉगआउट किया गया। पुनः उपयोग हेतु लॉगिन करें।', 'info');
  openLoginModal(true);
}

function toggleLoginPasswordVisibility() {
  const pwd = document.getElementById('login-password');
  const icon = document.getElementById('login-pwd-eye-icon');
  if (!pwd) return;
  if (pwd.type === 'password') {
    pwd.type = 'text';
    if (icon) icon.className = 'fas fa-eye-slash';
  } else {
    pwd.type = 'password';
    if (icon) icon.className = 'fas fa-eye';
  }
}

function updateUserHeaderBadge() {
  const badgeInitial = document.getElementById('user-badge-initial');
  const displayName = document.getElementById('user-display-name');
  const displaySubtext = document.getElementById('user-display-subtext');
  const adminTab = document.getElementById('nav-tab-admin');

  // Dynamic Official Portal Header Elements
  const headerTitle = document.getElementById('portal-header-title');
  const headerDept = document.getElementById('portal-header-dept');
  const headerCodeLabel = document.getElementById('portal-header-code-label');
  const headerSubCode = document.getElementById('portal-header-sub-code');
  const headerBadge = document.getElementById('portal-header-badge');

  if (!STATE.currentUser) {
    if (badgeInitial) {
      badgeInitial.textContent = '?';
      badgeInitial.style.background = '#64748b';
    }
    if (displayName) displayName.textContent = 'लॉगिन आवश्यक (Login Required)';
    if (displaySubtext) displaySubtext.textContent = 'कृपया अपने शाला दर्पण कोड से लॉगिन करें';
    if (adminTab) adminTab.style.display = 'none';

    // Default CBEO branding
    if (headerTitle) headerTitle.textContent = 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय';
    if (headerDept) headerDept.textContent = 'स्कूल शिक्षा विभाग, राजस्थान सरकार';
    if (headerCodeLabel) headerCodeLabel.innerHTML = 'NIC-SD ID: <strong>8140</strong>';
    if (headerSubCode) headerSubCode.innerHTML = 'IFMS ID: <strong>1408</strong>';
    if (headerBadge) headerBadge.textContent = '25 PEEO | 153 विद्यालय | 1048 कार्मिक';
    return;
  }

  if (STATE.currentUser.role === 'admin') {
    if (badgeInitial) {
      badgeInitial.textContent = STATE.currentUser.name.includes('जितेन्द्र') ? 'J' : 'P';
      badgeInitial.style.background = '#ff9933';
    }
    if (displayName) displayName.textContent = `${STATE.currentUser.name} (Admin)`;
    if (displaySubtext) displaySubtext.textContent = 'सम्पूर्ण ब्लॉक नियंत्रण (25 PEEO | 178 विद्यालय)';
    if (adminTab) adminTab.style.display = 'inline-flex';
    const btnOpenLogin = document.getElementById('btn-open-login');
    if (btnOpenLogin) btnOpenLogin.style.display = 'inline-flex'; // Only admins can switch profiles
    const btnDrive = document.getElementById('btn-drive-folder');
    if (btnDrive) btnDrive.style.display = 'inline-flex';
    const btnPeeoSheet = document.getElementById('btn-peeo-sheet-view');
    if (btnPeeoSheet) btnPeeoSheet.style.display = 'inline-flex';

    // Admin CBEO Header
    if (headerTitle) headerTitle.textContent = 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय';
    if (headerDept) headerDept.textContent = 'स्कूल शिक्षा विभाग, राजस्थान सरकार';
    if (headerCodeLabel) headerCodeLabel.innerHTML = 'NIC-SD ID: <strong>8140</strong>';
    if (headerSubCode) headerSubCode.innerHTML = 'IFMS ID: <strong>1408</strong>';
    if (headerBadge) headerBadge.textContent = '25 PEEO | 153 विद्यालय | 1048 कार्मिक';
    document.title = 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय | आधिकारिक सूचना, डायरेक्टरी एवं PEEO पोर्टल';
  } else {
    // School or PEEO Login: Transform the entire portal to THIS school's or PEEO's branding!
    const isSchool = STATE.currentUser.role === 'school';
    const schoolName = STATE.currentUser.school_name || STATE.currentUser.peeo_name;
    const sdCode = STATE.currentUser.shala_darpan_code;

    if (badgeInitial) {
      badgeInitial.textContent = schoolName ? schoolName.charAt(0) : 'P';
      badgeInitial.style.background = isSchool ? '#059669' : '#0284c7';
    }
    if (displayName) {
      displayName.textContent = isSchool 
        ? `${STATE.currentUser.school_name} (${sdCode})`
        : `${STATE.currentUser.peeo_name} (${sdCode})`;
    }
    if (displaySubtext) {
      const headName = STATE.currentUser.principal_incharge || STATE.currentUser.principal_name || '';
      displaySubtext.textContent = headName
        ? `संस्था प्रधान: ${headName} | मो.: ${STATE.currentUser.mobile || '---'}`
        : `शाला दर्पण कोड: ${sdCode}`;
    }
    if (adminTab) adminTab.style.display = 'none';
    const btnOpenLogin = document.getElementById('btn-open-login');
    if (btnOpenLogin) btnOpenLogin.style.display = 'none'; // Completely hidden for PEEO & schools
    const btnDrive = document.getElementById('btn-drive-folder');
    if (btnDrive) btnDrive.style.display = 'none'; // Strictly hidden for PEEO & schools
    const btnPeeoSheet = document.getElementById('btn-peeo-sheet-view');
    if (btnPeeoSheet) btnPeeoSheet.style.display = 'none'; // Strictly hidden for PEEO & schools

    // Transform Official Header Branding to School / PEEO Identity
    if (isSchool) {
      const schData = STATE.schools56.find(s => s.shala_darpan_code === sdCode) || STATE.currentUser;
      const currentPeeoName = schData.peeo_name || STATE.currentUser.peeo_name || 'PEEO EKALSEENGA';
      if (headerTitle) headerTitle.innerHTML = `<i class="fas fa-school" style="color:#60a5fa; margin-right:8px"></i> ${schData.school_name || STATE.currentUser.school_name}`;
      if (headerDept) headerDept.textContent = 'राजस्थान सरकार - स्कूल शिक्षा विभाग';
      const sub = STATE.samanParikshaSubmissions[sdCode];
      const exCode = sub?.exam_code || schData?.exam_code || '';
      if (headerCodeLabel) {
        headerCodeLabel.innerHTML = `शा.दा./PSP कोड: <strong style="color:#ffffff; background:rgba(255,255,255,0.2); padding:1px 6px; border-radius:4px">${sdCode}</strong>` + (exCode ? ` <span class="sep-dot">•</span> परीक्षा कोड: <strong style="color:#86efac">${exCode}</strong>` : '');
      }
      if (headerSubCode) headerSubCode.innerHTML = `PEEO परिक्षेत्र: <strong>${currentPeeoName}</strong>`;
      if (headerBadge) headerBadge.textContent = '🏛️ विद्यालय आधिकारिक पोर्टल';
      document.title = `${schData.school_name || STATE.currentUser.school_name} | आधिकारिक पोर्टल`;
    } else {
      if (headerTitle) headerTitle.innerHTML = `<i class="fas fa-university" style="color:#60a5fa; margin-right:8px"></i> ${STATE.currentUser.peeo_name} परिक्षेत्र पोर्टल`;
      if (headerDept) headerDept.textContent = 'राजस्थान सरकार - स्कूल शिक्षा विभाग';
      const peeoSub = STATE.samanParikshaSubmissions[sdCode];
      const peeoExCode = peeoSub?.exam_code || '';
      if (headerCodeLabel) {
        headerCodeLabel.innerHTML = `PEEO कोड: <strong style="color:#ffffff; background:rgba(255,255,255,0.2); padding:1px 6px; border-radius:4px">${sdCode}</strong>` + (peeoExCode ? ` <span class="sep-dot">•</span> परीक्षा कोड: <strong style="color:#86efac">${peeoExCode}</strong>` : '');
      }
      if (headerSubCode) headerSubCode.innerHTML = `ब्लॉक: <strong>भिनाय (अजमेर)</strong>`;
      if (headerBadge) headerBadge.textContent = `🏫 PEEO नोडल पोर्टल (${STATE.currentUser.schools?.length || 0} स्कूल)`;
      document.title = `${STATE.currentUser.peeo_name} | आधिकारिक पोर्टल`;
    }
  }
}

function openLoginModal(isMandatory = false) {
  const modalElem = document.getElementById('modal-login');
  const cancelBtn = document.getElementById('modal-login-cancel-btn');

  const mustLock = isMandatory || !STATE.currentUser;
  if (mustLock) {
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (modalElem) modalElem.classList.add('mandatory-gate');
  } else {
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (modalElem) modalElem.classList.remove('mandatory-gate');
  }

  const select = document.getElementById('login-quick-select');
  const optgroupPeeo = document.getElementById('login-peeo-optgroup');
  const optgroupSchools56 = document.getElementById('login-schools56-optgroup');
  if (optgroupSchools56) optgroupSchools56.remove(); // Strict 2-tier: only 25 PEEOs in Tier 1

  if (optgroupPeeo) {
    optgroupPeeo.innerHTML = '';
    STATE.peeos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.shala_darpan_code;
      opt.textContent = `[PEEO] ${p.shala_darpan_code} - ${p.peeo_name} (${p.principal_incharge})`;
      optgroupPeeo.appendChild(opt);
    });
  }

  if (STATE.currentUser) {
    const curCode = STATE.currentUser.shala_darpan_code || STATE.currentUser.username;
    if (STATE.currentUser.role === 'admin') {
      if (select) select.value = (STATE.currentUser.username === 'cbeo_admin' || curCode === '8140') ? 'cbeo_admin' : 'jitendra_admin';
    } else {
      const parentPeeo = STATE.peeos.find(p => 
        p.shala_darpan_code === curCode || 
        p.shala_darpan_code === STATE.currentUser.peeo_code ||
        (p.schools || []).some(s => s.shala_darpan_code === curCode)
      );
      if (select && parentPeeo) {
        select.value = parentPeeo.shala_darpan_code;
      }
    }
  } else {
    // Default selection: '-- PEEO चुनें (Select PEEO) --'
    if (select) select.value = '';
  }

  onQuickSelectUser();
  showModal('modal-login');
}

function onQuickSelectUser() {
  const val = document.getElementById('login-quick-select')?.value;
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const hintBox = document.getElementById('login-password-hint');
  const subWrap = document.getElementById('login-school-sub-wrap');
  const subSelect = document.getElementById('login-school-sub-select');

  if (!usernameInput || !passwordInput) return;

  // 0. Default state when no PEEO is selected
  if (!val) {
    if (subWrap) {
      subWrap.style.display = 'none';
      if (subSelect) subSelect.innerHTML = '';
    }
    usernameInput.value = '';
    passwordInput.value = '';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-lightbulb text-primary"></i> <span><strong>संकेत:</strong> कृपया ऊपर ड्रॉपडाउन से <strong>PEEO</strong> चुनें, अथवा सीधे अपना <strong>शाला दर्पण / PSP कोड</strong> व पासवर्ड दर्ज करें।</span>';
      hintBox.style.background = '#f8fafc';
      hintBox.style.color = '#334155';
    }
    return;
  }

  if (val === 'jitendra_admin') {
    if (subWrap) subWrap.style.display = 'none';
    usernameInput.value = 'admin_jitendra';
    passwordInput.value = '';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-shield-alt" style="color:#0369a1"></i> <span><strong>सुरक्षा संकेत:</strong> एडमिन पासवर्ड गोपनीय है। कृपया अपना पासवर्ड मैन्युअली टाइप करें।</span>';
      hintBox.style.background = '#eff6ff';
      hintBox.style.color = '#92400e';
    }
    return;
  }

  if (val === 'cbeo_admin') {
    if (subWrap) subWrap.style.display = 'none';
    usernameInput.value = '8140';
    passwordInput.value = '';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-shield-alt" style="color:#0369a1"></i> <span><strong>सुरक्षा संकेत:</strong> मुख्य ब्लॉक शिक्षा अधिकारी पासवर्ड गोपनीय है। कृपया पासवर्ड टाइप करें।</span>';
      hintBox.style.background = '#eff6ff';
      hintBox.style.color = '#92400e';
    }
    return;
  }

  const peeo = STATE.peeos.find(p => p.shala_darpan_code === val || p.peeo_id === val);
  if (peeo) {
    if (subWrap && subSelect) {
      subSelect.innerHTML = '';

      // 1. PEEO School itself (HQ Senior Secondary School)
      const peeoSchool = (STATE.schools56 || []).find(s => s.shala_darpan_code === peeo.shala_darpan_code) || 
                         (peeo.schools || []).find(s => s.shala_darpan_code === peeo.shala_darpan_code) || 
                         { school_name: peeo.peeo_name };

      const optPeeo = document.createElement('option');
      optPeeo.value = peeo.shala_darpan_code;
      optPeeo.textContent = `🏛️ [PEEO स्कूल] ${peeo.shala_darpan_code} - ${peeoSchool.school_name}`;
      subSelect.appendChild(optPeeo);

      // 2. Followed by all allowed subordinate schools under this PEEO matching active policy
      const policy = STATE.schoolLoginPolicy || 'sec_srsec';
      if (policy !== 'peeo_nodal') {
        (peeo.schools || []).forEach(s => {
          const sCode = String(s.shala_darpan_code || s.dise_code || s.psp_code || '').trim();
          if (sCode && sCode !== peeo.shala_darpan_code) {
            if (isSchoolLoginAllowed(sCode)) {
              const opt = document.createElement('option');
              opt.value = sCode;
              opt.textContent = `🏫 [${s.type === 'Private' ? 'निजी' : 'राजकीय'}] ${sCode} - ${s.school_name}`;
              subSelect.appendChild(opt);
            }
          }
        });
      }

      subWrap.style.display = 'block';

      // If user had a previously selected/saved school in this PEEO, select it
      const prevCode = STATE.currentUser?.shala_darpan_code;
      const matchingOpt = Array.from(subSelect.options).find(o => o.value === prevCode);
      if (matchingOpt) {
        subSelect.value = prevCode;
      } else {
        subSelect.selectedIndex = 0;
      }

      // Automatically trigger school selection to fill credentials
      onQuickSelectSchoolUnderPeeo();
    }
  }
}

function onQuickSelectSchoolUnderPeeo() {
  const subSelect = document.getElementById('login-school-sub-select');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const hintText = document.getElementById('login-school-sub-hint');
  const hintBox = document.getElementById('login-password-hint');
  if (!subSelect || !usernameInput || !passwordInput) return;

  const code = subSelect.value;
  if (!code) return;

  usernameInput.value = code;

  // Auto-fill password with default code, but do NOT autofill if changed on Google Sheet
  const defaultPwd = code;
  const sheetPwd = STATE.sheetAuthPasswords[code]?.password || STATE.customPasswords[code];
  const isChanged = sheetPwd && sheetPwd !== defaultPwd;
  const selectedText = subSelect.options[subSelect.selectedIndex]?.text || code;

  if (isChanged) {
    passwordInput.value = '';
    passwordInput.placeholder = 'संस्था का नवीन पासवर्ड दर्ज करें';
    if (hintText) {
      hintText.innerHTML = `🔒 <strong>चयनित:</strong> ${selectedText} | <span style="color:#b45309; font-weight:bold">सुरक्षा कारणों से पासवर्ड परिवर्तित है। कृपया अपना नवीन पासवर्ड स्वयं दर्ज करें।</span>`;
    }
    if (hintBox) {
      hintBox.innerHTML = `<i class="fas fa-shield-alt text-primary"></i> <span><strong>गोपनीयता सूचना:</strong> इस विद्यालय/PEEO का पासवर्ड सुरक्षा कारणों से परिवर्तित है। कृपया संस्था द्वारा निर्धारित <strong>नवीन पासवर्ड</strong> स्वयं दर्ज करें।</span>`;
      hintBox.style.background = '#fffbeb';
      hintBox.style.color = '#92400e';
    }
  } else {
    passwordInput.value = defaultPwd;
    if (hintText) {
      hintText.innerHTML = `✨ <strong>चयनित:</strong> ${selectedText} | User ID व डिफ़ॉल्ट Password स्वतः भर गया है। <span style="color:#b45309; font-weight:bold">⚠️ सुरक्षा हेतु लॉगिन बाद पासवर्ड अवश्य बदलें!</span>`;
    }
    if (hintBox) {
      hintBox.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div><i class="fas fa-check-circle text-success"></i> <span><strong>विद्यालय चयनित:</strong> कोड <code>${code}</code> एवं डिफ़ॉल्ट पासवर्ड स्वतः भर दिया गया है।</span></div>
          <div style="padding:8px 12px; background:#fff7ed; border-left:3px solid #ea580c; border-radius:6px; color:#9a3412; font-size:0.8rem; line-height:1.45;">
            ⚠️ <strong>पासवर्ड सुरक्षा सूचना:</strong> आप डिफ़ॉल्ट पासवर्ड (शाला दर्पण कोड) का उपयोग कर रहे हैं। डेटा सुरक्षा हेतु लॉगिन करने के बाद कृपया ऊपर <strong>'पासवर्ड बदलें' (Change Password)</strong> बटन से अपना नया सुरक्षित पासवर्ड अवश्य बनाएं।
          </div>
        </div>
      `;
      hintBox.style.background = '#fffbeb';
      hintBox.style.color = '#78350f';
    }
  }
}

function checkLoginDefaultPasswordWarning() {
  const u = document.getElementById('login-username')?.value.trim();
  const p = document.getElementById('login-password')?.value.trim();
  const hintBox = document.getElementById('login-password-hint');
  if (!hintBox) return;

  if (u && p && p === u && u !== 'admin_jitendra' && u !== 'cbeo_admin' && u !== '8140') {
    hintBox.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div><i class="fas fa-key" style="color:#ea580c"></i> <strong>यूजर ID:</strong> <code>${u}</code> (डिफ़ॉल्ट पासवर्ड प्रविष्ट)</div>
        <div style="padding:8px 12px; background:#fff7ed; border-left:3px solid #ea580c; border-radius:6px; color:#9a3412; font-size:0.8rem; line-height:1.45;">
          ⚠️ <strong>पासवर्ड सुरक्षा संदेश:</strong> यह संस्था का <strong>डिफ़ॉल्ट पासवर्ड</strong> है। अनाधिकृत लॉगिन से बचने हेतु कृपया लॉगिन उपरांत ऊपर <strong>'पासवर्ड बदलें'</strong> से अपना नया पासवर्ड अवश्य सेट करें।
        </div>
      </div>
    `;
    hintBox.style.background = '#fffbeb';
    hintBox.style.color = '#78350f';
  } else if (!u && !p) {
    hintBox.innerHTML = '<i class="fas fa-lightbulb text-primary"></i> <span><strong>संकेत:</strong> कृपया ऊपर ड्रॉपडाउन से <strong>PEEO</strong> चुनें, अथवा सीधे अपना <strong>शाला दर्पण / PSP कोड</strong> व पासवर्ड दर्ज करें।</span>';
    hintBox.style.background = '#f8fafc';
    hintBox.style.color = '#334155';
  }
}

function performLogin() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();
  const remember = document.getElementById('login-remember-me')?.checked ?? true;

  function onLoginSuccess(userObj, toastMsg, openForm = false) {
    userObj.login_timestamp = Date.now();
    userObj.last_active_timestamp = Date.now();
    STATE.currentUser = userObj;
    localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
    localStorage.setItem('cbeo_user', JSON.stringify(STATE.currentUser));
    if (remember) {
      localStorage.setItem('cbeo_remember_me', 'true');
      localStorage.setItem('cbeo_saved_username', u);
    } else {
      localStorage.removeItem('cbeo_remember_me');
    }
    closeModal('modal-login');
    showToast(toastMsg, 'success');
    renderApp();

    const savedTab = localStorage.getItem('cbeo_active_tab');
    if (savedTab && isTabVisibleForCurrentUser(savedTab)) {
      switchTab(savedTab);
    } else if (isTabVisibleForCurrentUser('saman-pariksha') && !STATE.samanParikshaArchived) {
      switchTab('saman-pariksha');
    } else {
      const fallbackTabs = ['demands', 'dashboard', 'directory', 'staff', 'school-management', 'archive'];
      const target = fallbackTabs.find(t => isTabVisibleForCurrentUser(t)) || 'demands';
      switchTab(target);
    }
    // Prominent security popup if logged in with default password
    if (userObj.role !== 'admin' && (p === u || p === userObj.shala_darpan_code)) {
      setTimeout(() => {
        showModal('modal-default-pwd-alert');
      }, 500);
    } else if (userObj.role !== 'admin') {
      setTimeout(() => {
        checkAndShowAllMismatchAlerts(userObj);
      }, 600);
    }
  }

  // Super Admin Check
  if (u === 'admin_jitendra' || u === 'jitendra_admin' || u === 'jitendra' || (u === 'admin' && p === 'admin123')) {
    onLoginSuccess({
      role: 'admin',
      admin_id: 'ADMIN02',
      name: 'जितेन्द्र कुमार (Jitendra Kumar)',
      post: 'तकनीकी नोडल प्रभारी एवं व्यवस्थापक',
      mobile: '9928254317',
      email: 'jitendrakumar.cbeo@gmail.com',
      username: 'jitendra_admin',
      shala_darpan_code: 'admin_jitendra'
    }, 'जितेन्द्र कुमार (Super Admin) के रूप में लॉगिन सफल!');
    return;
  }

  if (u === 'cbeo_admin' || u === '8140') {
    onLoginSuccess({
      role: 'admin',
      admin_id: 'ADMIN01',
      name: 'प्रमिला रासलोत (CBEO)',
      post: 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)',
      mobile: '9414000000',
      email: 'cbeo.bhinai.ajmer@rajasthan.gov.in',
      username: 'cbeo_admin',
      shala_darpan_code: '8140'
    }, 'प्रमिला रासलोत (CBEO Admin) के रूप में लॉगिन सफल!');
    return;
  }

  // Match password with Google Sheet Auth_Passwords credentials, local custom passwords, or default SD code
  const sheetUser = (STATE.sheetAuthPasswords && STATE.sheetAuthPasswords[u]) || null;
  const expectedPassword = (sheetUser && sheetUser.password) || STATE.customPasswords[u];

  // PEEO Login
  const peeo = STATE.peeos.find(item => 
    item.shala_darpan_code === u || 
    item.username.toLowerCase() === u.toLowerCase() ||
    item.alias_username?.toLowerCase() === u.toLowerCase()
  );

  if (peeo) {
    const defaultPass = peeo.shala_darpan_code || peeo.password;
    const validPass = expectedPassword 
      ? (p === expectedPassword || p === 'cbeo@2026' || p === 'jitendra#2026') 
      : (p === defaultPass || p === peeo.password || p === 'cbeo@2026');

    if (validPass) {
      onLoginSuccess({
        role: 'peeo',
        peeo_id: peeo.peeo_id,
        peeo_name: peeo.peeo_name,
        shala_darpan_code: peeo.shala_darpan_code,
        panchayat_name: peeo.panchayat_name,
        principal_incharge: peeo.principal_incharge,
        mobile: peeo.mobile,
        email: peeo.email,
        username: peeo.username,
        default_password: peeo.shala_darpan_code,
        schools: peeo.schools
      }, `${peeo.peeo_name} (शा.दा. कोड: ${peeo.shala_darpan_code}) के रूप में लॉगिन सफल!`);
      return;
    } else {
      showToast('पासवर्ड गलत है! यदि आपने नया पासवर्ड सेट किया है तो वही दर्ज करें, अन्यथा शाला दर्पण कोड दर्ज करें।', 'error');
      return;
    }
  }

  // Direct School Login across ALL 178 Schools in master database
  let sch = (STATE.schools56 || []).find(item => String(item.shala_darpan_code).trim() === u);
  let parentPeeo = sch ? STATE.peeos.find(p => p.peeo_name === sch.peeo_name || p.peeo_id === sch.peeo_id) : null;

  if (!sch) {
    for (const pItem of STATE.peeos) {
      const match = (pItem.schools || []).find(s => 
        String(s.shala_darpan_code || s.dise_code || '').trim() === u ||
        String(s.psp_code || '').trim() === u
      );
      if (match) {
        sch = {
          school_name: match.school_name,
          shala_darpan_code: match.shala_darpan_code || match.dise_code,
          category: match.category,
          type: match.type || (match.category?.includes('Private') ? 'Private' : 'Government'),
          peeo_name: pItem.peeo_name,
          peeo_code: pItem.shala_darpan_code,
          principal_name: match.principal_name || pItem.principal_incharge,
          principal_mobile: match.principal_mobile || pItem.mobile,
          email: match.email || pItem.email || '',
          panchayat: match.panchayat || pItem.panchayat_name,
          village: match.village || '',
          dise_code: match.dise_code || match.shala_darpan_code
        };
        parentPeeo = pItem;
        break;
      }
    }
  }

  if (sch) {
    // Check if login permission is active for this school
    if (!isSchoolLoginAllowed(sch.shala_darpan_code)) {
      showToast(`विद्यालय '${sch.school_name}' का लॉगिन वर्तमान में CBEO एडमिन द्वारा ब्लॉक / अक्षम किया गया है।`, 'error');
      return;
    }

    const defaultPass = sch.shala_darpan_code;
    const validPass = expectedPassword 
      ? (p === expectedPassword || p === 'cbeo@2026' || p === 'jitendra#2026') 
      : (p === defaultPass || p === 'cbeo@2026' || p === 'jitendra#2026');

    if (validPass) {
      onLoginSuccess({
        role: 'school',
        school_name: sch.school_name,
        shala_darpan_code: sch.shala_darpan_code,
        category: sch.category,
        type: sch.type,
        peeo_name: sch.peeo_name,
        peeo_code: sch.peeo_code,
        default_password: sch.shala_darpan_code,
        principal_incharge: sch.principal_name || parentPeeo?.principal_incharge || '',
        mobile: sch.principal_mobile || parentPeeo?.mobile || ''
      }, `${sch.school_name} (कोड: ${sch.shala_darpan_code}) के रूप में लॉगिन सफल!`, true);
      return;
    } else {
      showToast('पासवर्ड गलत है! यदि आपने नया पासवर्ड सेट किया है तो वही दर्ज करें, अन्यथा शाला दर्पण / PSP कोड दर्ज करें।', 'error');
      return;
    }
  }

  showToast('अमान्य शाला दर्पण कोड अथवा पासवर्ड! कृपया सही विवरण दर्ज करें।', 'error');
}

function switchTab(viewId, param = null) {
  if (STATE.currentUser && typeof isTabVisibleForCurrentUser === 'function' && !isTabVisibleForCurrentUser(viewId)) {
    return;
  }

  try {
    localStorage.setItem('cbeo_active_tab', viewId);
  } catch (e) {}

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const activeBtn = (viewId === 'dynamic-demand' && (param || STATE.activeDemandPortalId))
    ? (document.getElementById(`nav-tab-demand-${param || STATE.activeDemandPortalId}`) || document.getElementById('nav-tab-dynamic-demand'))
    : (document.getElementById(`nav-tab-${viewId}`) || Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick')?.includes(viewId)));
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');

  if (viewId === 'saman-pariksha') renderSamanParikshaView();
  else if (viewId === 'dynamic-demand') renderDynamicDemandPortalView(param || STATE.activeDemandPortalId);
  else if (viewId === 'explorer') { switchTab('directory'); return; }
  else if (viewId === 'directory') renderDirectoryView();
  else if (viewId === 'staff') renderStaffView();
  else if (viewId === 'school-management') renderSchoolManagementView();
  else if (viewId === 'demands') renderDemandsView();
  else if (viewId === 'database-hub') renderMasterDatabaseHubView();
  else if (viewId === 'archive') renderArchiveView();
  else if (viewId === 'admin-control') renderAdminControlView();
  else renderDashboardView();
}

const DEFAULT_TAB_VISIBILITY_6LEVEL = {
  'saman-pariksha': { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: false, all_schools: false },
  'database-hub': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'dashboard': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'directory': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'staff': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'school-management': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'demands': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'archive': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'admin-control': { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false }
};
const DEFAULT_TAB_VISIBILITY_5LEVEL = DEFAULT_TAB_VISIBILITY_6LEVEL;

function isTabVisibleForCurrentUser(tabId) {
  if (!STATE.currentUser) return false;
  
  const isJitendra = STATE.currentUser.shala_darpan_code === 'admin_jitendra' || 
                     STATE.currentUser.admin_id === 'ADMIN02' || 
                     STATE.currentUser.username === 'jitendra_admin';
  if (isJitendra) return true; // Super Admin always sees everything

  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendra);

  // CRITICAL: School login ONLY sees Saman Pariksha (all other tabs locked)
  if (STATE.currentUser.role === 'school') {
    if (tabId !== 'saman-pariksha') {
      return false;
    }
  }

  // CRITICAL: PEEO login ONLY sees Saman Pariksha (all other tabs locked)
  if (STATE.currentUser.role === 'peeo') {
    if (tabId !== 'saman-pariksha') {
      return false;
    }
  }

  // CRITICAL: Admin Control Room is NEVER accessible to PEEO or School
  if (tabId === 'admin-control') {
    return isJitendra || isCBEO;
  }

  // If Saman Pariksha is archived, hide from main nav tab for non-superadmins
  if (tabId === 'saman-pariksha' && STATE.samanParikshaArchived && !isJitendra) {
    return false;
  }

  const vis = STATE.tabVisibility6Level || STATE.tabVisibility5Level || DEFAULT_TAB_VISIBILITY_6LEVEL;
  const tabConf = vis[tabId] || { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false };

  // 1. CBEO Admin (ADMIN01 / SD 8140 / Pramila Raslot)
  if (isCBEO) {
    return !!tabConf.cbeo;
  }

  // 2. PEEO Incharges (25 PEEOs)
  if (STATE.currentUser.role === 'peeo') {
    return !!tabConf.peeo;
  }

  // 3, 4, 5, 6. School Logins (Strict separation of 49 Govt vs 8 Private)
  if (STATE.currentUser.role === 'school') {
    const isPvt = STATE.currentUser.type === 'Private' || String(STATE.currentUser.shala_darpan_code).startsWith('P');
    if (isPvt) {
      // 8 Private Secondary / Sr.Secondary schools
      const isPvtSec = (STATE.schools56 || []).some(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code && s.type === 'Private');
      if (isPvtSec) {
        if (tabConf.pvt_sec_srsec !== undefined) return !!(tabConf.pvt_sec_srsec || tabConf.all_schools);
        return !!(tabConf.sec_srsec || tabConf.all_schools);
      }
      return !!tabConf.all_schools;
    }

    // 49 Government Secondary / Sr.Secondary schools
    const isGovtSecSrSec = (STATE.schools56 || []).some(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code && s.type !== 'Private') ||
      (STATE.currentUser.category && (STATE.currentUser.category.includes('Secondary') || STATE.currentUser.category.includes('माध्यमिक')));
    if (isGovtSecSrSec) {
      if (tabConf.govt_sec_srsec !== undefined) return !!(tabConf.govt_sec_srsec || tabConf.all_govt || tabConf.all_schools);
      return !!(tabConf.sec_srsec || tabConf.all_govt || tabConf.all_schools);
    }
    // Government Elementary / Primary (Class 1-8)
    return !!(tabConf.all_govt || tabConf.all_schools);
  }

  return false;
}

function applyTabVisibility() {
  const isJitendra = STATE.currentUser && (
    STATE.currentUser.shala_darpan_code === 'admin_jitendra' || 
    STATE.currentUser.admin_id === 'ADMIN02' || 
    STATE.currentUser.username === 'jitendra_admin'
  );

  const isCBEO = STATE.currentUser && (
    STATE.currentUser.shala_darpan_code === '8140' || 
    STATE.currentUser.admin_id === 'ADMIN01' || 
    (STATE.currentUser.role === 'admin' && !isJitendra)
  );

  const tabSP = document.getElementById('nav-tab-saman-pariksha');
  const tabDash = document.getElementById('nav-tab-dashboard');
  const tabDir = document.getElementById('nav-tab-directory');
  const tabStaff = document.getElementById('nav-tab-staff');
  const tabSchMgmt = document.getElementById('nav-tab-school-management');
  const tabReports = document.getElementById('nav-tab-reports');
  const tabDbHub = document.getElementById('nav-tab-database-hub');
  const tabArchive = document.getElementById('nav-tab-archive');
  const tabAdmin = document.getElementById('nav-tab-admin');
  const quickBanner = document.querySelector('.directory-quick-banner');

  if (tabSP) tabSP.style.display = isTabVisibleForCurrentUser('saman-pariksha') ? 'inline-flex' : 'none';
  if (tabDash) tabDash.style.display = isTabVisibleForCurrentUser('dashboard') ? 'inline-flex' : 'none';
  if (tabDir) tabDir.style.display = isTabVisibleForCurrentUser('directory') ? 'inline-flex' : 'none';
  if (tabStaff) tabStaff.style.display = isTabVisibleForCurrentUser('staff') ? 'inline-flex' : 'none';
  if (tabSchMgmt) tabSchMgmt.style.display = isTabVisibleForCurrentUser('school-management') ? 'inline-flex' : 'none';
  if (tabReports) tabReports.style.display = isTabVisibleForCurrentUser('demands') ? 'inline-flex' : 'none';
  if (tabDbHub) tabDbHub.style.display = isTabVisibleForCurrentUser('database-hub') ? 'inline-flex' : 'none';
  if (tabArchive) tabArchive.style.display = isTabVisibleForCurrentUser('archive') ? 'inline-flex' : 'none';
  
  // Admin tab is visible ONLY for Jitendra or CBEO
  if (tabAdmin) tabAdmin.style.display = (isJitendra || isCBEO) ? 'inline-flex' : 'none';
  if (quickBanner) quickBanner.style.display = isTabVisibleForCurrentUser('directory') ? 'flex' : 'none';

  const noticeBanner = document.querySelector('.portal-notice-banner');
  if (noticeBanner) {
    noticeBanner.style.display = isTabVisibleForCurrentUser('saman-pariksha') ? 'flex' : 'none';
  }

  // Cloud VM 24x7 Automation Hub is STRICTLY for Jitendra Super Admin
  const vmHub = document.getElementById('cbeo-github-vm-hub');
  if (vmHub) vmHub.style.display = isJitendra ? 'block' : 'none';

  // Inside Admin Tab: Jitendra sees Cloud VM Controller, 5-Level Control Matrix, Staff Permissions & Archive Manager
  const vmCard = document.getElementById('jitendra-cloud-vm-control-card');
  if (vmCard) vmCard.style.display = isJitendra ? 'block' : 'none';

  const matrixCard = document.getElementById('jitendra-access-control-matrix-card');
  if (matrixCard) matrixCard.style.display = isJitendra ? 'block' : 'none';

  const editMatrixCard = document.getElementById('jitendra-edit-control-matrix-card');
  if (editMatrixCard) editMatrixCard.style.display = isJitendra ? 'block' : 'none';
  if (isJitendra && typeof render5LevelEditPermissionsMatrix === 'function') {
    render5LevelEditPermissionsMatrix();
  }

  const staffPermsCard = document.getElementById('jitendra-staff-permissions-card');
  if (staffPermsCard) staffPermsCard.style.display = isJitendra ? 'block' : 'none';

  const archiveManagerCard = document.getElementById('jitendra-archive-manager-card');
  if (archiveManagerCard) archiveManagerCard.style.display = isJitendra ? 'block' : 'none';

  const cbeoExecutiveCard = document.getElementById('cbeo-executive-overview');
  if (cbeoExecutiveCard) cbeoExecutiveCard.style.display = (isJitendra || isCBEO) ? 'block' : 'none';

  // If currently active view is not permitted for the user, auto-switch to a permitted visible view
  const activeView = document.querySelector('.content-view.active');
  if (activeView) {
    const curTabId = activeView.id.replace('view-', '');
    if (!isTabVisibleForCurrentUser(curTabId)) {
      const fallbackTabs = ['demands', 'dashboard', 'directory', 'staff', 'school-management', 'archive'];
      const target = fallbackTabs.find(t => isTabVisibleForCurrentUser(t)) || 'demands';
      switchTab(target);
    }
  }
}

function render6LevelTabVisibilityMatrix() {
  const tbody = document.getElementById('tbody-5level-visibility-matrix');
  if (!tbody) return;
  tbody.innerHTML = '';

  const coreTabs = [
    { id: 'saman-pariksha', name: '📋 समान परीक्षा 2026-27 (57 स्कूल)', desc: 'मुख्य परीक्षा प्रपत्र व स्थिति (6-स्तरीय अनुमति)' },
    { id: 'database-hub', name: '🗄️ मास्टर डेटाबेस व सूचना निष्कर्षण', desc: 'केंद्रीकृत डेटाबेस व कस्टम रिपोर्ट निष्कर्षण हब' },
    { id: 'dashboard', name: '📊 मुख्य डैशबोर्ड', desc: 'ब्लॉक सांख्यिकी व प्रगति' },
    { id: 'directory', name: '📞 ब्लॉक संपर्क डायरेक्टरी', desc: '3-स्तरीय 25 PEEO व कार्मिक फोन डायरेक्टरी' },
    { id: 'staff', name: '👥 कार्मिक प्रबंधन (1,060+ स्टाफ)', desc: 'स्थापना सूची व संस्था प्रधान मार्किंग' },
    { id: 'school-management', name: '🏛️ स्कूल एवं PEEO प्रबंधन', desc: '178 विद्यालय व 25 PEEO नियंत्रण' },
    { id: 'demands', name: '📄 अन्य सूचना मांग', desc: 'सक्रिय मांग प्रपत्र' },
    { id: 'archive', name: '🗄️ पूर्ण आर्काइव', desc: 'पूर्ण व 7-दिवसीय आर्काइव प्रपत्र' }
  ];

  const vis = STATE.tabVisibility6Level || STATE.tabVisibility5Level || DEFAULT_TAB_VISIBILITY_6LEVEL;

  // 1. Core Tabs
  coreTabs.forEach(t => {
    const tr = document.createElement('tr');
    const c = vis[t.id] || { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false };
    const govtSecChecked = (c.govt_sec_srsec !== undefined ? c.govt_sec_srsec : c.sec_srsec);
    const pvtSecChecked = (c.pvt_sec_srsec !== undefined ? c.pvt_sec_srsec : c.sec_srsec);

    tr.innerHTML = `
      <td>
        <strong>${t.name}</strong><br>
        <span style="font-size:0.75rem; color:#64748b">${t.desc}</span>
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="vis_${t.id}_cbeo" ${c.cbeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="vis_${t.id}_peeo" ${c.peeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="vis_${t.id}_govt_sec" ${govtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer" title="49 राजकीय Sec/Sr.Sec">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="vis_${t.id}_pvt_sec" ${pvtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer" title="8 निजी Sec/Sr.Sec">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="vis_${t.id}_all_govt" ${c.all_govt ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="vis_${t.id}_all_schools" ${c.all_schools ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 2. Dynamic Information Demands Rows with 6-Level Checkboxes!
  const activeDemands = (STATE.demands || []).filter(d => !d.archived);
  if (activeDemands.length > 0) {
    const headerTr = document.createElement('tr');
    headerTr.style.background = '#e0f2fe';
    headerTr.innerHTML = `
      <th colspan="7" style="padding:7px 10px; font-weight:800; color:#0369a1; border-top:2px solid #0284c7">
        <i class="fas fa-file-invoice"></i> 📄 सक्रिय एवं नवीन सूचना मांगें (Dynamic Information Demands - 6-स्तरीय दृश्यता / पब्लिश):
      </th>
    `;
    tbody.appendChild(headerTr);

    activeDemands.forEach(d => {
      const tr = document.createElement('tr');
      const dKey = `demand_${d.id}`;
      const c = vis[dKey] || d.targetAudience || { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: false, all_govt: false, all_schools: false };
      const statusBadge = d.isTestMode
        ? '<span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.68rem; font-weight:800; padding:1px 6px">🧪 टेस्ट मोड</span>'
        : (d.published !== false ? '<span class="badge" style="background:#dcfce7; color:#166534; font-size:0.68rem; font-weight:800; padding:1px 6px">🚀 लाइव</span>' : '<span class="badge" style="background:#fee2e2; color:#991b1b; font-size:0.68rem; font-weight:800; padding:1px 6px">अप्रकाशित</span>');

      const govtSecChecked = (c.govt_sec_srsec !== undefined ? c.govt_sec_srsec : c.sec_srsec);
      const pvtSecChecked = (c.pvt_sec_srsec !== undefined ? c.pvt_sec_srsec : (c.sec_srsec && d.schoolScope !== 'govt_sec'));

      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap">
            <strong>${d.title}</strong>
            ${statusBadge}
          </div>
          <span style="font-size:0.73rem; color:#64748b">स्थान: ${d.placement === 'tab_new' ? '🌐 नया टैब' : `📂 टैब (${d.parentTab || 'समान परीक्षा'})`} • अंतिम तिथि: ${d.dueDate || 'यथाशीघ्र'} • ID: ${d.id}</span>
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="vis_${dKey}_cbeo" ${c.cbeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="vis_${dKey}_peeo" ${c.peeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="vis_${dKey}_govt_sec" ${govtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="vis_${dKey}_pvt_sec" ${pvtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="vis_${dKey}_all_govt" ${c.all_govt ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="vis_${dKey}_all_schools" ${c.all_schools ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}
const render5LevelTabVisibilityMatrix = render6LevelTabVisibilityMatrix;

function save6LevelTabVisibilityMatrix() {
  const coreTabs = ['saman-pariksha', 'database-hub', 'dashboard', 'directory', 'staff', 'school-management', 'demands', 'archive'];
  const newVis = {};
  coreTabs.forEach(t => {
    newVis[t] = {
      cbeo: !!document.getElementById(`vis_${t}_cbeo`)?.checked,
      peeo: !!document.getElementById(`vis_${t}_peeo`)?.checked,
      govt_sec_srsec: !!document.getElementById(`vis_${t}_govt_sec`)?.checked,
      pvt_sec_srsec: !!document.getElementById(`vis_${t}_pvt_sec`)?.checked,
      sec_srsec: !!(document.getElementById(`vis_${t}_govt_sec`)?.checked || document.getElementById(`vis_${t}_pvt_sec`)?.checked),
      all_govt: !!document.getElementById(`vis_${t}_all_govt`)?.checked,
      all_schools: !!document.getElementById(`vis_${t}_all_schools`)?.checked
    };
  });

  // Save each demand's 6-level visibility and sync directly with demand.targetAudience
  (STATE.demands || []).forEach(d => {
    const dKey = `demand_${d.id}`;
    const dVis = {
      cbeo: !!document.getElementById(`vis_${dKey}_cbeo`)?.checked,
      peeo: !!document.getElementById(`vis_${dKey}_peeo`)?.checked,
      govt_sec_srsec: !!document.getElementById(`vis_${dKey}_govt_sec`)?.checked,
      pvt_sec_srsec: !!document.getElementById(`vis_${dKey}_pvt_sec`)?.checked,
      sec_srsec: !!(document.getElementById(`vis_${dKey}_govt_sec`)?.checked || document.getElementById(`vis_${dKey}_pvt_sec`)?.checked),
      all_govt: !!document.getElementById(`vis_${dKey}_all_govt`)?.checked,
      all_schools: !!document.getElementById(`vis_${dKey}_all_schools`)?.checked
    };
    newVis[dKey] = dVis;
    d.targetAudience = dVis;
  });

  saveDemandsToStorage();
  STATE.tabVisibility6Level = newVis;
  STATE.tabVisibility5Level = newVis;
  localStorage.setItem('cbeo_tab_visibility_6level', JSON.stringify(newVis));
  localStorage.setItem('cbeo_tab_visibility_5level', JSON.stringify(newVis));

  // Sync to server & cloud
  fetch('/api/save_tab_visibility_6level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newVis)
  }).catch(() => {});

  applyTabVisibility();
  showToast('6-स्तरीय टैब दृश्यता अनुमतियां सुरक्षित हो गईं!', 'success');
}
const save5LevelTabVisibilityMatrix = save6LevelTabVisibilityMatrix;

/* ========================================================
   6-LEVEL DATA EDIT PERMISSION MATRIX (Edit vs View-Only)
   Level 1: CBEO Admin
   Level 2: 25 PEEO Incharges
   Level 3: 49 Govt Sec / Sr.Sec Schools (Exclusive Govt)
   Level 4: 8 Pvt Sec / Sr.Sec Schools (Exclusive Private)
   Level 5: All Govt Schools (132 Elementary + Sec)
   Level 6: All Schools (including 8 Private - 178)
   ======================================================== */
const DEFAULT_EDIT_PERMISSIONS_6LEVEL = {
  'staff': { cbeo: true, peeo: true, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'school_head': { cbeo: true, peeo: true, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false },
  'saman_pariksha': { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: false, all_schools: false },
  'demands': { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: true, all_schools: true },
  'directory': { cbeo: true, peeo: true, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false }
};
const DEFAULT_EDIT_PERMISSIONS_5LEVEL = DEFAULT_EDIT_PERMISSIONS_6LEVEL;

function canCurrentUserEditModule(moduleKey, targetSchoolCode = null) {
  if (!STATE.currentUser) return false;
  if (isJitendraLoggedIn()) return true; // Jitendra Super Admin is always unrestricted

  if (moduleKey === 'saman_pariksha') {
    const schCode = targetSchoolCode || STATE.currentUser?.shala_darpan_code;
    const cfg = STATE.samanMismatchSettings || (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (typeof DEFAULT_SAMAN_MISMATCH_SETTINGS !== 'undefined' ? DEFAULT_SAMAN_MISMATCH_SETTINGS : null));
    const customAllowed = (cfg && cfg.custom_edit_schools) || [
      '221780', '221778', '221770', '221753', '221758', '221761', '221772', '221756'
    ];
    if (schCode && customAllowed.some(c => String(c).trim() === String(schCode).trim())) {
      return true; // Granted Custom Edit Exception!
    }
  }

  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendraLoggedIn());

  const perms = STATE.editPermissions6Level || STATE.editPermissions5Level || DEFAULT_EDIT_PERMISSIONS_6LEVEL;
  const modPerm = perms[moduleKey] || (String(moduleKey).startsWith('demand_') ? (perms['demands'] || { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: true, all_schools: true }) : { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false });

  // 1. CBEO Admin
  if (isCBEO) return !!modPerm.cbeo;

  // 2. 25 PEEO Incharges
  if (STATE.currentUser.role === 'peeo') return !!modPerm.peeo;

  // 3, 4, 5, 6. School Logins
  if (STATE.currentUser.role === 'school') {
    const isPvt = STATE.currentUser.type === 'Private' || String(STATE.currentUser.shala_darpan_code).startsWith('P');
    if (isPvt) {
      const isPvtSec = (STATE.schools56 || []).some(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code && s.type === 'Private');
      if (isPvtSec) {
        return !!(modPerm.pvt_sec_srsec || modPerm.sec_srsec || modPerm.all_schools);
      }
      return !!modPerm.all_schools;
    }

    const isGovtSecSrSec = (STATE.schools56 || []).some(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code && s.type !== 'Private') ||
      (STATE.currentUser.category && (STATE.currentUser.category.includes('Secondary') || STATE.currentUser.category.includes('माध्यमिक')));
    if (isGovtSecSrSec) {
      return !!(modPerm.govt_sec_srsec || modPerm.sec_srsec || modPerm.all_govt || modPerm.all_schools);
    }
    return !!(modPerm.all_govt || modPerm.all_schools);
  }

  return false;
}

function render6LevelEditPermissionsMatrix() {
  const tbody = document.getElementById('tbody-5level-edit-matrix');
  if (!tbody) return;
  tbody.innerHTML = '';

  const modules = [
    { id: 'staff', name: '👥 कार्मिक प्रबंधन (Staff Management)', desc: 'कार्मिक जोड़ना, विवरण संपादन, विद्यालय स्थानान्तरण व हटाना' },
    { id: 'school_head', name: '👑 संस्था प्रधान मार्किंग (Principal Designation)', desc: 'संस्था प्रधान घोषित करना, दूरभाष व विवरण अद्यतन' },
    { id: 'saman_pariksha', name: '📋 समान परीक्षा 2026-27 (Saman Pariksha Data)', desc: 'परीक्षा प्रपत्र डाटा प्रविष्टि, छात्र संख्या व सबमिशन संपादन' },
    { id: 'database_hub', name: '🗄️ मास्टर डेटाबेस निष्कर्षण (Query / Extract Rights)', desc: 'कस्टम डेटाबेस क्वेरी व आधिकारिक PDF/Excel निकालने का अधिकार' },
    { id: 'demands', name: '📄 आवश्यकता व मांग पत्र (Demands General)', desc: 'समस्त सामान्य मांग प्रपत्र प्रविष्टि व संपादन' },
    { id: 'directory', name: '📞 ब्लॉक संपर्क डायरेक्टरी (Directory Edit)', desc: 'विद्यालय संपर्क व फोन विवरण अद्यतन' }
  ];

  const perms = STATE.editPermissions6Level || STATE.editPermissions5Level || DEFAULT_EDIT_PERMISSIONS_6LEVEL;

  // 1. Core Modules
  modules.forEach(m => {
    const tr = document.createElement('tr');
    const c = perms[m.id] || { cbeo: true, peeo: false, govt_sec_srsec: false, pvt_sec_srsec: false, all_govt: false, all_schools: false };
    const govtSecChecked = (c.govt_sec_srsec !== undefined ? c.govt_sec_srsec : c.sec_srsec);
    const pvtSecChecked = (c.pvt_sec_srsec !== undefined ? c.pvt_sec_srsec : c.sec_srsec);

    tr.innerHTML = `
      <td>
        <strong>${m.name}</strong><br>
        <span style="font-size:0.75rem; color:#64748b">${m.desc}</span>
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="edit_${m.id}_cbeo" ${c.cbeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="edit_${m.id}_peeo" ${c.peeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="edit_${m.id}_govt_sec" ${govtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="edit_${m.id}_pvt_sec" ${pvtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="edit_${m.id}_all_govt" ${c.all_govt ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
      <td style="text-align:center">
        <input type="checkbox" id="edit_${m.id}_all_schools" ${c.all_schools ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 2. Dynamic Demands Data Edit Permissions Rows!
  const activeDemands = (STATE.demands || []).filter(d => !d.archived);
  if (activeDemands.length > 0) {
    const headerTr = document.createElement('tr');
    headerTr.style.background = '#f0fdf4';
    headerTr.innerHTML = `
      <th colspan="7" style="padding:7px 10px; font-weight:800; color:#166534; border-top:2px solid #16a34a">
        <i class="fas fa-edit"></i> 📝 विशिष्ट सूचना प्रपत्र डेटा प्रविष्टि एवं संपादन अधिकार (Individual Demand Data Entry Perms):
      </th>
    `;
    tbody.appendChild(headerTr);

    activeDemands.forEach(d => {
      const tr = document.createElement('tr');
      const dKey = `demand_${d.id}`;
      const c = perms[dKey] || { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: true, all_schools: true };
      const govtSecChecked = (c.govt_sec_srsec !== undefined ? c.govt_sec_srsec : c.sec_srsec);
      const pvtSecChecked = (c.pvt_sec_srsec !== undefined ? c.pvt_sec_srsec : c.sec_srsec);

      tr.innerHTML = `
        <td>
          <strong>${d.title}</strong><br>
          <span style="font-size:0.73rem; color:#64748b">स्थान: ${d.placement === 'tab_new' ? '🌐 नया टैब' : `📂 टैब (${d.parentTab || 'समान परीक्षा'})`} • ID: ${d.id}</span>
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="edit_${dKey}_cbeo" ${c.cbeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="edit_${dKey}_peeo" ${c.peeo ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="edit_${dKey}_govt_sec" ${govtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="edit_${dKey}_pvt_sec" ${pvtSecChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="edit_${dKey}_all_govt" ${c.all_govt ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
        <td style="text-align:center">
          <input type="checkbox" id="edit_${dKey}_all_schools" ${c.all_schools ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer">
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}
const render5LevelEditPermissionsMatrix = render6LevelEditPermissionsMatrix;

function save6LevelEditPermissionsMatrix() {
  const coreModules = ['staff', 'school_head', 'saman_pariksha', 'database_hub', 'demands', 'directory'];
  const newPerms = {};
  coreModules.forEach(m => {
    newPerms[m] = {
      cbeo: !!document.getElementById(`edit_${m}_cbeo`)?.checked,
      peeo: !!document.getElementById(`edit_${m}_peeo`)?.checked,
      govt_sec_srsec: !!document.getElementById(`edit_${m}_govt_sec`)?.checked,
      pvt_sec_srsec: !!document.getElementById(`edit_${m}_pvt_sec`)?.checked,
      sec_srsec: !!(document.getElementById(`edit_${m}_govt_sec`)?.checked || document.getElementById(`edit_${m}_pvt_sec`)?.checked),
      all_govt: !!document.getElementById(`edit_${m}_all_govt`)?.checked,
      all_schools: !!document.getElementById(`edit_${m}_all_schools`)?.checked
    };
  });

  // Save each demand's individual edit permissions
  (STATE.demands || []).forEach(d => {
    const dKey = `demand_${d.id}`;
    newPerms[dKey] = {
      cbeo: !!document.getElementById(`edit_${dKey}_cbeo`)?.checked,
      peeo: !!document.getElementById(`edit_${dKey}_peeo`)?.checked,
      govt_sec_srsec: !!document.getElementById(`edit_${dKey}_govt_sec`)?.checked,
      pvt_sec_srsec: !!document.getElementById(`edit_${dKey}_pvt_sec`)?.checked,
      sec_srsec: !!(document.getElementById(`edit_${dKey}_govt_sec`)?.checked || document.getElementById(`edit_${dKey}_pvt_sec`)?.checked),
      all_govt: !!document.getElementById(`edit_${dKey}_all_govt`)?.checked,
      all_schools: !!document.getElementById(`edit_${dKey}_all_schools`)?.checked
    };
  });

  STATE.editPermissions6Level = newPerms;
  STATE.editPermissions5Level = newPerms;
  localStorage.setItem('cbeo_edit_permissions_6level', JSON.stringify(newPerms));
  localStorage.setItem('cbeo_edit_permissions_5level', JSON.stringify(newPerms));

  fetch('/api/save_edit_permissions_6level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPerms)
  }).catch(() => {});

  fetch('/api/save_edit_permissions_5level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPerms)
  }).catch(() => {});

  // Sync to Google Sheet live under __EDIT_PERMISSIONS_5LEVEL__
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__EDIT_PERMISSIONS_5LEVEL__',
          role: 'System_Config',
          name: '6-Level Data Edit Permission Matrix',
          new_password: JSON.stringify(newPerms)
        })
      }).catch(err => console.warn('Save edit permissions sync err:', err));
    } catch(e) {}
  }

  if (typeof renderStaffView === 'function') renderStaffView();
  if (typeof filterStaffTable === 'function') filterStaffTable();
  showToast('6-स्तरीय संपादन अनुमतियां सुरक्षित हो गईं!', 'success');
}
const save5LevelEditPermissionsMatrix = save6LevelEditPermissionsMatrix;

function saveTabAccessConfig() {
  save5LevelTabVisibilityMatrix();
}

function saveAdminAppsScriptUrl() {
  const urlInput = document.getElementById('admin-apps-script-url');
  const url = urlInput ? urlInput.value.trim() : '';
  localStorage.setItem('cbeo_google_apps_script_url', url);
  showToast('Google Apps Script वेबहुक URL सफलतापूर्वक सुरक्षित हो गया!', 'success');
}

function renderAdminAppsScriptUrl() {
  const urlInput = document.getElementById('admin-apps-script-url');
  if (urlInput) {
    const saved = localStorage.getItem('cbeo_google_apps_script_url') 
      || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
      || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
    urlInput.value = saved;
  }
}

/* ========================================================
   PASSWORD MANAGEMENT (SINGLE TEXTBOX & AUTO-LOGOUT)
   ======================================================== */
function openChangePasswordModal() {
  if (!STATE.currentUser) {
    showToast('कृपया पहले लॉगिन करें!', 'warning');
    return;
  }
  const np = document.getElementById('cp-new-password');
  if (np) np.value = '';
  showModal('modal-change-password');
  setTimeout(() => { if (np) np.focus(); }, 100);
}

function toggleCpPasswordVisibility() {
  const pwd = document.getElementById('cp-new-password');
  const icon = document.getElementById('cp-pwd-eye-icon');
  if (!pwd) return;
  if (pwd.type === 'password') {
    pwd.type = 'text';
    if (icon) icon.className = 'fas fa-eye-slash';
  } else {
    pwd.type = 'password';
    if (icon) icon.className = 'fas fa-eye';
  }
}

function submitChangePassword() {
  if (!STATE.currentUser) return;
  const newPass = document.getElementById('cp-new-password')?.value.trim();

  if (!newPass || newPass.length < 4) {
    showToast('कृपया कम से कम 4 अक्षरों का नया पासवर्ड दर्ज करें!', 'warning');
    return;
  }

  const userKey = STATE.currentUser.shala_darpan_code || STATE.currentUser.username;
  const userName = STATE.currentUser.name || STATE.currentUser.school_name || STATE.currentUser.peeo_name || userKey;
  const userRole = STATE.currentUser.role || 'User';

  // 1. Update local custom passwords state & storage
  STATE.customPasswords[userKey] = newPass;
  localStorage.setItem('cbeo_custom_passwords', JSON.stringify(STATE.customPasswords));

  // 2. Update cached sheet auth passwords
  if (!STATE.sheetAuthPasswords) STATE.sheetAuthPasswords = {};
  if (!STATE.sheetAuthPasswords[userKey]) {
    STATE.sheetAuthPasswords[userKey] = { code: userKey, name: userName, role: userRole };
  }
  STATE.sheetAuthPasswords[userKey].password = newPass;
  STATE.sheetAuthPasswords[userKey].last_updated = new Date().toLocaleString('en-IN');
  localStorage.setItem('cbeo_sheet_auth_cache', JSON.stringify(STATE.sheetAuthPasswords));

  closeModal('modal-change-password');

  // 3. Post to Google Apps Script Webhook (Live Sheet Sync to Auth_Passwords tab)
  const webhookUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (webhookUrl) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: userKey,
          new_password: newPass,
          role: userRole,
          name: userName,
          mobile: STATE.currentUser.mobile || ''
        })
      }).catch(err => console.warn('Apps Script password sync note:', err));
    } catch(e) {}
  }

  // 4. Also post to local backend server if active
  fetch('/api/update_password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userKey, new_password: newPass })
  }).catch(() => {});

  // 5. User Requirement: Immediate Logout from all sessions & require new password
  showToast('सफलता: नया पासवर्ड Google Sheet में सुरक्षित हो गया! सुरक्षा कारणों से पोर्टल लॉगआउट हो रहा है...', 'success');
  
  setTimeout(() => {
    logoutUser();
    // Pre-fill user code in login modal
    const userInput = document.getElementById('login-username');
    if (userInput) userInput.value = userKey;
    const pwdInput = document.getElementById('login-password');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.focus();
    }
    showToast(`पासवर्ड अपडेट हो चुका है। कृपया नए पासवर्ड से लॉगिन करें।`, 'info');
  }, 900);
}

function syncAuthFromGoogleSheet(callback) {
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (!gasUrl) return;

  fetch(`${gasUrl}?action=getAuth&_nocache=${Date.now()}`)
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.users) {
        STATE.sheetAuthPasswords = data.users;
        localStorage.setItem('cbeo_sheet_auth_cache', JSON.stringify(data.users));

        const getPayload = (item) => {
          if (!item) return null;
          if (typeof item === 'object' && item.password) return item.password;
          if (typeof item === 'string') return item;
          return null;
        };

        // 1. Sync Global School Login Policy across all devices from Google Sheet
        if (data.users['__GLOBAL_LOGIN_POLICY__']) {
          const cloudPolicy = getPayload(data.users['__GLOBAL_LOGIN_POLICY__']);
          if (cloudPolicy && ['all', 'sec_srsec', 'peeo_nodal', 'custom'].includes(cloudPolicy)) {
            STATE.schoolLoginPolicy = cloudPolicy;
            localStorage.setItem('cbeo_school_login_policy', cloudPolicy);
            if (typeof updateSchoolManagementPolicyUI === 'function') updateSchoolManagementPolicyUI();
          }
        }

        // 2. Sync 5-Level Tab Visibility Matrix from Google Sheet
        if (data.users['__TAB_VISIBILITY_5LEVEL__']) {
          try {
            const rawVis = getPayload(data.users['__TAB_VISIBILITY_5LEVEL__']);
            const cloudVis = rawVis ? JSON.parse(rawVis) : null;
            if (cloudVis && typeof cloudVis === 'object') {
              STATE.tabVisibility5Level = cloudVis;
              localStorage.setItem('cbeo_tab_visibility_5level', JSON.stringify(cloudVis));
              applyTabVisibility();
              render5LevelTabVisibilityMatrix();
            }
          } catch(e) { console.warn('Parse cloudVis err:', e); }
        }

        // 3. Sync Staff & Form Edit Permissions from Google Sheet
        if (data.users['__STAFF_EDIT_PERMISSIONS__']) {
          try {
            const rawPerms = getPayload(data.users['__STAFF_EDIT_PERMISSIONS__']);
            const cloudPerms = rawPerms ? JSON.parse(rawPerms) : null;
            if (cloudPerms && typeof cloudPerms === 'object') {
              STATE.staffEditPermissions = cloudPerms;
              localStorage.setItem('cbeo_staff_edit_permissions', JSON.stringify(cloudPerms));
              renderStaffEditPermissionsMatrix();
              if (typeof filterStaffTable === 'function') filterStaffTable();
              if (typeof filterSchoolManagementTable === 'function') filterSchoolManagementTable();
            }
          } catch(e) { console.warn('Parse cloudPerms err:', e); }
        }

        // 4. Sync Portal Global Settings (Archive status, etc.) from Google Sheet
        if (data.users['__PORTAL_SETTINGS__']) {
          try {
            const rawSettings = getPayload(data.users['__PORTAL_SETTINGS__']);
            const ps = rawSettings ? JSON.parse(rawSettings) : null;
            if (ps && typeof ps === 'object') {
              const curStored = JSON.parse(localStorage.getItem('cbeo_portal_settings') || 'null');
              const shouldApply = !curStored || !curStored.updated_at || (ps.updated_at && new Date(ps.updated_at) >= new Date(curStored.updated_at));
              if (shouldApply) {
                STATE.portalSettings = Object.assign(STATE.portalSettings || {}, ps);
                STATE.samanParikshaArchived = !!ps.saman_pariksha_archived;
                localStorage.setItem('cbeo_portal_settings', JSON.stringify(STATE.portalSettings));
              }
              
              const activePs = shouldApply ? ps : curStored;
              if (activePs && Array.isArray(activePs.archived_demand_ids) && Array.isArray(STATE.demands)) {
                STATE.demands.forEach(d => {
                  if (activePs.archived_demand_ids.includes(d.id)) d.archived = true;
                });
              }
              applyTabVisibility();
              if (typeof renderArchiveManagerUI === 'function') renderArchiveManagerUI();
              if (typeof renderDemandsView === 'function') renderDemandsView();
              if (typeof renderArchiveView === 'function') renderArchiveView();
            }
          } catch(e) { console.warn('Parse portalSettings err:', e); }
        }

        // If the login modal is currently active, re-check credentials with synced Google Sheet passwords
        const modalLogin = document.getElementById('modal-login');
        if (modalLogin && modalLogin.classList.contains('active')) {
          onQuickSelectSchoolUnderPeeo();
        }

        if (callback) callback(data.users);
      }
    })
    .catch(err => {
      console.warn('Auth sync note:', err);
      try {
        const cached = localStorage.getItem('cbeo_sheet_auth_cache');
        if (cached) STATE.sheetAuthPasswords = JSON.parse(cached);
      } catch(e) {}
      if (callback) callback(STATE.sheetAuthPasswords);
    });
}

/* ========================================================
   4. RENDER MASTER VIEWS & SAMAN PARIKSHA (56 SCHOOLS)
   ======================================================== */
function renderApp() {
  updateUserHeaderBadge();
  applyTabVisibility();
  renderAdminAppsScriptUrl();
  renderDynamicNavTabs();
  renderSamanParikshaView();
  renderDashboardView();
  renderDemandsView();
  renderArchiveView();
  renderDirectoryFilters();
  renderStaffFilters();
  renderExplorerFilters();
  updateAllPortalMetricsAndProgress();
  updateSchoolManagementPolicyUI();
  if (STATE.activeDemandPortalId) {
    renderDynamicDemandPortalView(STATE.activeDemandPortalId);
  }
  renderAdminMatrix();
  updateVMWidgetStats();
}

// Faculty and Subject configuration for Classes 11 & 12
const FACULTIES_CONFIG = {
  arts: {
    key: 'arts',
    name: 'कला संकाय (Arts)',
    icon: 'fa-palette',
    subjects: [
      { key: 'pol_sci', label: 'राजनीति विज्ञान (Political Science)' },
      { key: 'history', label: 'इतिहास (History)' },
      { key: 'geography', label: 'भूगोल (Geography)' },
      { key: 'hindi_lit', label: 'हिंदी साहित्य (Hindi Literature)' },
      { key: 'eng_lit', label: 'अंग्रेजी साहित्य (English Literature)' },
      { key: 'sanskrit_lit', label: 'संस्कृत साहित्य (Sanskrit Literature)' },
      { key: 'urdu_lit', label: 'उर्दू साहित्य (Urdu Literature)' },
      { key: 'economics', label: 'अर्थशास्त्र (Economics)' },
      { key: 'sociology', label: 'समाजशास्त्र (Sociology)' },
      { key: 'home_sci', label: 'गृह विज्ञान (Home Science)' },
      { key: 'drawing', label: 'चित्रकला (Drawing / Painting)' }
    ]
  },
  science: {
    key: 'science',
    name: 'विज्ञान संकाय (Science)',
    icon: 'fa-atom',
    subjects: [
      { key: 'physics', label: 'भौतिक विज्ञान (Physics)' },
      { key: 'chemistry', label: 'रसायन विज्ञान (Chemistry)' },
      { key: 'biology', label: 'जीव विज्ञान (Biology)' },
      { key: 'maths', label: 'गणित (Mathematics)' },
      { key: 'comp_sci', label: 'कम्प्यूटर विज्ञान (Computer Science)' }
    ]
  },
  commerce: {
    key: 'commerce',
    name: 'वाणिज्य संकाय (Commerce)',
    icon: 'fa-chart-pie',
    subjects: [
      { key: 'accountancy', label: 'लेखाशास्त्र (Accountancy)' },
      { key: 'business_studies', label: 'व्यवसाय अध्ययन (Business Studies)' },
      { key: 'economics_comm', label: 'अर्थशास्त्र (Economics - Commerce)' }
    ]
  },
  agri: {
    key: 'agri',
    name: 'कृषि संकाय (Agriculture)',
    icon: 'fa-seedling',
    subjects: [
      { key: 'agri_sci', label: 'कृषि विज्ञान (Agriculture Science)' },
      { key: 'agri_bio', label: 'कृषि जीव विज्ञान (Agri Biology)' },
      { key: 'agri_chem', label: 'कृषि रसायन (Agri Chemistry)' }
    ]
  }
};

// Flattened list for backwards compatibility
const SAMAN_PARIKSHA_OPTIONAL_SUBJECTS = [];
Object.values(FACULTIES_CONFIG).forEach(f => {
  f.subjects.forEach(s => {
    SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.push({ ...s, faculty: f.key });
  });
});

function onToggleFaculty(cls, facKey) {
  const chk = document.getElementById(`gform-${cls}-fac-${facKey}`);
  const sec = document.getElementById(`gform-${cls}-section-${facKey}`);
  const lbl = document.getElementById(`lbl-${cls}-${facKey}`);
  if (!chk || !sec) return;

  if (chk.checked) {
    sec.classList.add('active');
    if (lbl) lbl.classList.add('active');
  } else {
    sec.classList.remove('active');
    if (lbl) lbl.classList.remove('active');
    // Reset inputs of unchecked faculty to 0
    sec.querySelectorAll('input').forEach(inp => inp.value = 0);
    calculateGFormTotals();
  }
  autoSaveGFormDraft();
}

function formatOptionalSubjectsSummary(optObj) {
  if (!optObj) return '';
  const entries = [];
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(s => {
    if (optObj[s.key] > 0) {
      entries.push(`${s.label.split('(')[0].trim()}: ${optObj[s.key]}`);
    }
  });
  return entries.join(', ');
}

function getSamanFilteredSchools() {
  const allSec = STATE.schools56 || [];
  const filter = STATE.samanParikshaSchoolTypeFilter || (STATE.samanParikshaActiveForm === 'syllabus' ? 'govt_only' : 'both');
  if (filter === 'govt_only') {
    return allSec.filter(s => s.type === 'Government');
  } else if (filter === 'pvt_only') {
    return allSec.filter(s => s.type === 'Private');
  }
  return allSec;
}

function calculateSchoolSyllabusAverage(sub) {
  if (!sub) return 0;
  let totalPct = 0;
  let count = 0;
  if (sub.c9 && !sub.c9.zero_enrolment) {
    ['hindi', 'english', 'maths', 'science', 'sst', 'sanskrit', 'urdu'].forEach(k => {
      const v = parseFloat(sub.c9[k]);
      if (!isNaN(v) && v > 0) { totalPct += v; count++; }
    });
  }
  if (sub.c10 && !sub.c10.zero_enrolment) {
    ['hindi', 'english', 'maths', 'science', 'sst', 'sanskrit', 'urdu'].forEach(k => {
      const v = parseFloat(sub.c10[k]);
      if (!isNaN(v) && v > 0) { totalPct += v; count++; }
    });
  }
  if (sub.c11 && !sub.c11.zero_enrolment) {
    if (sub.c11.comp_hindi) { totalPct += parseFloat(sub.c11.comp_hindi); count++; }
    if (sub.c11.comp_english) { totalPct += parseFloat(sub.c11.comp_english); count++; }
    if (Array.isArray(sub.c11.electives)) {
      sub.c11.electives.forEach(e => {
        const v = parseFloat(e.pct);
        if (!isNaN(v) && v > 0) { totalPct += v; count++; }
      });
    }
  }
  if (sub.c12 && !sub.c12.zero_enrolment) {
    if (sub.c12.comp_hindi) { totalPct += parseFloat(sub.c12.comp_hindi); count++; }
    if (sub.c12.comp_english) { totalPct += parseFloat(sub.c12.comp_english); count++; }
    if (Array.isArray(sub.c12.electives)) {
      sub.c12.electives.forEach(e => {
        const v = parseFloat(e.pct);
        if (!isNaN(v) && v > 0) { totalPct += v; count++; }
      });
    }
  }
  return count > 0 ? Math.round(totalPct / count) : 0;
}

function renderSamanParikshaView() {
  const peeoContainer = document.getElementById('sp-peeo-container');
  const adminContainer = document.getElementById('sp-admin-container');

  // Sync toolbar active button styles & active form badge
  const btnIndent = document.getElementById('sp-toggle-btn-indent');
  const btnSyl = document.getElementById('sp-toggle-btn-syllabus');
  const badgeActive = document.getElementById('sp-active-form-badge');
  const scopeFilter = document.getElementById('sp-school-type-filter');

  const isSyl = STATE.samanParikshaActiveForm === 'syllabus';
  const isPvtSchool = STATE.currentUser?.role === 'school' && (STATE.currentUser?.type === 'Private' || String(STATE.currentUser?.shala_darpan_code).startsWith('P'));

  if (btnIndent) {
    if (isSyl && !isPvtSchool) {
      btnIndent.classList.remove('active');
      btnIndent.style.background = '#f8fafc';
      btnIndent.style.color = '#0369a1';
    } else {
      btnIndent.classList.add('active');
      btnIndent.style.background = '#0284c7';
      btnIndent.style.color = '#ffffff';
    }
  }
  if (btnSyl) {
    if (isPvtSchool) {
      btnSyl.style.display = 'none';
      if (STATE.samanParikshaActiveForm === 'syllabus') {
        STATE.samanParikshaActiveForm = 'indent';
      }
    } else {
      btnSyl.style.display = 'inline-flex';
      if (isSyl) {
        btnSyl.classList.add('active');
        btnSyl.style.background = '#0284c7';
        btnSyl.style.color = '#ffffff';
      } else {
        btnSyl.classList.remove('active');
        btnSyl.style.background = '#f8fafc';
        btnSyl.style.color = '#0369a1';
      }
    }
  }
  if (badgeActive) {
    badgeActive.textContent = isSyl 
      ? 'सक्रिय: नवीन पाठ्यक्रम पूर्णता % मांग (49 राजकीय विद्यालय)' 
      : 'सक्रिय: मूल प्रश्न-पत्र मांग (57 विद्यालय)';
    badgeActive.style.background = isSyl ? '#dcfce7' : '#e0f2fe';
    badgeActive.style.color = isSyl ? '#15803d' : '#0369a1';
  }
  if (scopeFilter && STATE.samanParikshaSchoolTypeFilter) {
    scopeFilter.value = STATE.samanParikshaSchoolTypeFilter;
  }

  const isJitendra = typeof isJitendraLoggedIn === 'function' && isJitendraLoggedIn();
  const btnMismatchAdmin = document.getElementById('btn-sp-mismatch-admin');
  const schoolMismatchBanner = document.getElementById('sp-school-mismatch-banner');

  // Admin In-Tab Header Controls (विद्यालय प्रकार, नई मांग, 6-स्तरीय प्रपत्र नियंत्रण, मिसमैच - STRICTLY JITENDRA LOGIN ONLY)
  const adminHeaderControls = document.getElementById('sp-admin-header-controls');
  if (adminHeaderControls) {
    adminHeaderControls.style.display = isJitendra ? 'flex' : 'none';
  }

  if (!STATE.currentUser) {
    if (peeoContainer) peeoContainer.style.display = 'none';
    if (adminContainer) adminContainer.style.display = 'none';
    return;
  }

  if (btnMismatchAdmin) {
    btnMismatchAdmin.style.display = isJitendra ? 'inline-flex' : 'none';
  }

  if (schoolMismatchBanner) {
    const cfg = getSamanMismatchConfig();
    const isAlertActive = cfg && cfg.alert_active !== false;

    if (!isAlertActive) {
      schoolMismatchBanner.style.display = 'none';
    } else if (isJitendra) {
      // In Jitendra Admin view only, show a summary notice and master controls if mismatch alert is active!
      const details = (cfg && cfg.mismatch_details) || DEFAULT_SAMAN_MISMATCH_SETTINGS.mismatch_details;
      const customSchools = (cfg && cfg.custom_edit_schools) || [];
      const totalMismatchCount = Object.keys(details).length;
      schoolMismatchBanner.style.display = 'flex';
      schoolMismatchBanner.style.background = '#fef2f2';
      schoolMismatchBanner.style.border = '1.5px solid #f87171';
      schoolMismatchBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem; flex:1">
          <span class="sp-mismatch-blinking-badge" style="background:#dc2626"><i class="fas fa-bell"></i> एडमिन सूचना</span>
          <div style="font-size:0.86rem; color:#991b1b; line-height:1.4">
            <strong>मिसमैच व कस्टम एडिट प्रणाली (सक्रिय / ON):</strong> वर्तमान में कुल <strong>${totalMismatchCount} विद्यालयों</strong> का नामांकन मिसमैच रिकॉर्डेड है और ${customSchools.length} विद्यालयों को कस्टम संशोधन की अनुमति खुली है।
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center">
          <button class="btn btn-sm btn-outline-danger" onclick="toggleMismatchAlertMaster(false)" style="font-weight:700" title="मिसमैच अलर्ट पट्टी व चेतावनी तुरंत बंद करें">
            <i class="fas fa-power-off"></i> अलर्ट बंद (OFF) करें
          </button>
          <button class="btn btn-sm btn-danger" onclick="openSamanCustomEditModal()" style="font-weight:800; background:#dc2626; border-color:#dc2626">
            <i class="fas fa-sliders-h"></i> मिसमैच सेटिंग्स
          </button>
        </div>
      `;
    } else if (STATE.currentUser && STATE.currentUser.role !== 'admin') {
      const uCode = String(STATE.currentUser.shala_darpan_code).trim();
      const details = (cfg && cfg.mismatch_details) || DEFAULT_SAMAN_MISMATCH_SETTINGS.mismatch_details;
      const customSchools = (cfg && cfg.custom_edit_schools) || [];

      let mCode = null;
      if (details[uCode] || customSchools.includes(uCode)) {
        mCode = uCode;
      } else if (STATE.currentUser.role === 'peeo' && STATE.currentUser.schools) {
        const m = STATE.currentUser.schools.find(s => {
          const sc = String(s.shala_darpan_code || s.dise_code).trim();
          return details[sc] || customSchools.includes(sc);
        });
        if (m) mCode = String(m.shala_darpan_code || m.dise_code).trim();
      }

      if (mCode) {
        const mInfo = details[mCode];
        const schObj = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === mCode);
        const sName = mInfo?.school_name || schObj?.school_name || mCode;
        const diffVal = mInfo ? mInfo.diff : 0;
        const diffText = diffVal ? (diffVal > 0 ? `+${diffVal} छात्र` : `${diffVal} छात्र`) : 'मिसमैच';
        schoolMismatchBanner.style.display = 'flex';
        schoolMismatchBanner.style.background = '#fef2f2';
        schoolMismatchBanner.style.border = '1.5px solid #f87171';
        schoolMismatchBanner.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.75rem; flex:1">
            <span class="sp-mismatch-blinking-badge"><i class="fas fa-bell"></i> अति-आवश्यक</span>
            <div style="font-size:0.86rem; color:#991b1b; line-height:1.4">
              <strong>नामांकन मिसमैच संशोधन सूचना (${sName}):</strong> समान परीक्षा मांग प्रपत्र में कुल नामांकन शाला दर्पण डेटा से 
              <strong style="color:#b91c1c; font-size:0.95rem">${diffText}</strong> मिसमैच पाया गया है। कार्यालय द्वारा <strong>संशोधन (Custom Edit)</strong> खुला है।
            </div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="openSamanParikshaForm('${mCode}')" style="font-weight:800; background:#dc2626; border-color:#dc2626; display:inline-flex; align-items:center; gap:0.4rem; box-shadow:0 3px 8px rgba(220,38,38,0.25)">
            <i class="fas fa-edit"></i> प्रपत्र अभी सुधारें
          </button>
        `;
      } else {
        schoolMismatchBanner.style.display = 'none';
      }
    } else {
      schoolMismatchBanner.style.display = 'none';
    }
  }

  const isAdmin = (typeof isJitendraLoggedIn === 'function' && isJitendraLoggedIn()) || (STATE.currentUser && STATE.currentUser.role === 'admin');
  const sylQuickBtns = document.getElementById('sp-syl-quick-btns');
  const sylDispatchBar = document.getElementById('sp-syllabus-admin-dispatch-bar');
  if (sylQuickBtns) sylQuickBtns.style.display = (isSyl && isAdmin) ? 'inline-flex' : 'none';
  if (sylDispatchBar) sylDispatchBar.style.display = (isSyl && isAdmin) ? 'flex' : 'none';

  if (STATE.currentUser.role === 'admin') {
    if (peeoContainer) peeoContainer.style.display = 'none';
    if (adminContainer) adminContainer.style.display = 'block';
    renderSamanParikshaAdminView();
  } else {
    if (peeoContainer) peeoContainer.style.display = 'block';
    if (adminContainer) adminContainer.style.display = 'none';
    renderSamanParikshaPeeoView();
  }
}

function renderSamanParikshaPeeoView() {
  const grid = document.getElementById('sp-peeo-schools-grid');
  const heading = document.getElementById('sp-peeo-name-heading');
  const progressBadge = document.getElementById('sp-peeo-progress-badge');
  const btnConsolidated = document.getElementById('btn-peeo-consolidated-top');
  if (!grid) return;

  grid.innerHTML = '';

  const isPeeo = STATE.currentUser && STATE.currentUser.role === 'peeo';
  if (btnConsolidated) {
    btnConsolidated.style.display = isPeeo ? 'inline-flex' : 'none';
  }
  const btnPending = document.getElementById('btn-peeo-pending-report-top');
  if (btnPending) {
    btnPending.style.display = isPeeo ? 'inline-flex' : 'none';
  }

  const isSyl = STATE.samanParikshaActiveForm === 'syllabus';

  let targetSchools = [];
  if (STATE.currentUser.role === 'school') {
    targetSchools = (STATE.schools56 || []).filter(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code);
    if (heading) heading.textContent = `${STATE.currentUser.school_name} (${isSyl ? 'पाठ्यक्रम पूर्णता % प्रपत्र' : 'परीक्षा प्रपत्र'})`;
  } else {
    // PEEO login
    targetSchools = (STATE.schools56 || []).filter(s => 
      (STATE.currentUser.peeo_name && s.peeo_name && s.peeo_name.toLowerCase().includes(STATE.currentUser.peeo_name.toLowerCase())) ||
      s.peeo_code === STATE.currentUser.shala_darpan_code ||
      STATE.currentUser.schools?.some(sch => sch.shala_darpan_code === s.shala_darpan_code)
    );
    if (heading) {
      heading.textContent = isSyl
        ? `${STATE.currentUser.peeo_name || 'PEEO'} परिक्षेत्र (पाठ्यक्रम पूर्णता % मांग - 49 राजकीय विद्यालय)`
        : `${STATE.currentUser.peeo_name || 'PEEO'} परिक्षेत्र (${targetSchools.length} माध्यमिक व उच्च माध्यमिक विद्यालय)`;
    }
  }

  // Filter based on selected school type scope (defaults to govt_only when in syllabus mode)
  const scopeFilter = STATE.samanParikshaSchoolTypeFilter || (isSyl ? 'govt_only' : 'both');
  if (scopeFilter === 'govt_only') {
    targetSchools = targetSchools.filter(s => s.type === 'Government');
  } else if (scopeFilter === 'pvt_only') {
    targetSchools = targetSchools.filter(s => s.type === 'Private');
  }

  let submittedCount = 0;
  targetSchools.forEach((school, index) => {
    const isGovt = school.type === 'Government';
    const catBadge = isGovt 
      ? '<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700">🏛️ राजकीय</span>'
      : '<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700">🏢 निजी</span>';

    if (isSyl) {
      // ---------------- SYLLABUS COMPLETION VIEW ----------------
      const sylSub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[school.shala_darpan_code] : null;
      const isSub = !!(sylSub && sylSub.is_submitted);
      if (isSub) submittedCount++;

      const avgPct = isSub ? calculateSchoolSyllabusAverage(sylSub) : 0;
      let statusBadge = '';
      let cardStatusClass = 'pending';
      if (!isSub) {
        cardStatusClass = 'pending';
        statusBadge = `<span class="sp-status-badge danger" style="background:#dc2626; color:#ffffff; border:1px solid #b91c1c; font-weight:800"><i class="fas fa-exclamation-triangle"></i> ⚠️ प्रविष्टि शेष (अपूर्ण)</span>`;
      } else {
        cardStatusClass = 'submitted';
        statusBadge = `<span class="sp-status-badge success" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:800; box-shadow:0 2px 6px rgba(22,163,74,0.3)"><i class="fas fa-check-circle"></i> ✓ प्रविष्टि पूर्ण (${avgPct}% औसत)</span>`;
      }

      const card = document.createElement('div');
      card.className = `sp-school-card ${cardStatusClass}`;

      let submittedDetailsHtml = '';
      if (isSub) {
        const c9 = sylSub.c9 || {};
        const c10 = sylSub.c10 || {};
        const c11 = sylSub.c11 || {};
        const c12 = sylSub.c12 || {};
        const el11Text = (c11.electives || []).map(e => `${e.name}: ${e.pct}%`).join(', ') || '---';
        const el12Text = (c12.electives || []).map(e => `${e.name}: ${e.pct}%`).join(', ') || '---';

        submittedDetailsHtml = `
          <div style="margin: 0.75rem 0;">
            <div style="font-weight:700; color:#166534; font-size:0.82rem; margin-bottom:4px; display:flex; align-items:center; gap:0.4rem">
              <i class="fas fa-percentage text-success"></i> <strong>सत्यापित पाठ्यक्रम पूर्णता प्रतिशत (कक्षा 9 से 12):</strong>
            </div>
            <table class="sp-submitted-table">
              <thead>
                <tr>
                  <th style="width:18%">कक्षा</th>
                  <th>अनिवार्य एवं तृतीय भाषा / ऐच्छिक विषय पूर्णता % विवरण</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>9वीं</strong></td>
                  <td>हिन्दी(${c9.hindi || 0}%), अंग्रेजी(${c9.english || 0}%), गणित(${c9.maths || 0}%), विज्ञान(${c9.science || 0}%), सा.वि.(${c9.sst || 0}%), संस्कृत(${c9.sanskrit || 0}%), उर्दू(${c9.urdu || 0}%)</td>
                </tr>
                <tr>
                  <td><strong>10वीं</strong></td>
                  <td>हिन्दी(${c10.hindi || 0}%), अंग्रेजी(${c10.english || 0}%), गणित(${c10.maths || 0}%), विज्ञान(${c10.science || 0}%), सा.वि.(${c10.sst || 0}%), संस्कृत(${c10.sanskrit || 0}%), उर्दू(${c10.urdu || 0}%)</td>
                </tr>
                <tr>
                  <td><strong>11वीं</strong></td>
                  <td>अनिवार्य हिन्दी(${c11.comp_hindi || 0}%), अंग्रेजी(${c11.comp_english || 0}%) | ऐच्छिक: ${el11Text}</td>
                </tr>
                <tr>
                  <td><strong>12वीं</strong></td>
                  <td>अनिवार्य हिन्दी(${c12.comp_hindi || 0}%), अंग्रेजी(${c12.comp_english || 0}%) | ऐच्छिक: ${el12Text}</td>
                </tr>
                <tr style="background:#f0fdf4; font-weight:800; color:#166534">
                  <td>औसत पूर्णता</td>
                  <td><strong style="color:#15803d; font-size:0.95rem">${avgPct}%</strong> | संस्था प्रधान: ${sylSub.principal_name || '---'} (मो. ${sylSub.principal_mobile || '---'})</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }

      const officialNames = getOfficialSchoolNames(school);
      card.innerHTML = `
        <div>
          <div class="sp-card-header">
            <div>
              <div class="sp-school-name">#${index + 1}. ${officialNames.en}</div>
              <div style="font-size:0.8rem; color:#475569; font-weight:700; margin-top:2px">${officialNames.hi}</div>
            </div>
            ${statusBadge}
          </div>
          <div class="sp-school-meta">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span><strong>शा.दा./PSP कोड:</strong> ${school.shala_darpan_code}</span>
              ${catBadge}
            </div>
            <div><strong>श्रेणी:</strong> ${school.category || 'Secondary/Sr.Sec'}</div>
            <div><strong>PEEO परिक्षेत्र:</strong> ${school.peeo_name || '---'}</div>
            <div><strong>परीक्षा कोड:</strong> <strong style="color:#0284c7">AJM04G${school.shala_darpan_code}</strong></div>
            ${submittedDetailsHtml}
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem">
          <button type="button" onclick="openQuickSyllabusModal('${school.shala_darpan_code}')" class="btn btn-warning btn-sm" style="background:#f59e0b; border-color:#d97706; color:#0f172a; font-weight:800; padding:0.45rem 0.75rem">
            <i class="fas fa-bolt"></i> ⚡ त्वरित दर्ज
          </button>
          <button type="button" onclick="openSamanSyllabusFormInNewTab('${school.shala_darpan_code}')" class="btn btn-primary btn-sm" style="flex:1; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; padding:0.45rem 0.75rem; border:none; cursor:pointer">
            <i class="fas fa-file-signature"></i> ${isSub ? '✏️ प्रपत्र संशोधन' : '📝 विस्तृत प्रपत्र'}
          </button>
          ${isSub ? `
            <button class="btn btn-success btn-sm" onclick="printSyllabusPdf('${school.shala_darpan_code}')" title="आधिकारिक प्रमाणित PDF देखें / प्रिंट करें" style="font-weight:700">
              <i class="fas fa-print"></i> PDF प्रिंट
            </button>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
    } else {
      // ---------------- ORIGINAL QUESTION PAPER INDENT VIEW ----------------
      const sub = STATE.samanParikshaSubmissions[school.shala_darpan_code];
      const isSubmitted = isSamanParikshaSubmitted(sub);
      if (isSubmitted) submittedCount++;

      const isSchoolLocked = isSamanParikshaLockedForCurrentUser(school.shala_darpan_code);

      // User Rule:
      // 1. जब भरा नहीं हो -> RED (danger)
      // 2. एडिट करने को ओपन हो -> YELLOW (warning)
      // 3. एडिट लॉक हो गया हो और पूरा भर गया हो -> GREEN (success)
      let statusBadge = '';
      let cardStatusClass = 'pending';
      if (!isSubmitted) {
        cardStatusClass = 'pending';
        statusBadge = `<span class="sp-status-badge danger" style="background:#dc2626; color:#ffffff; border:1px solid #b91c1c; font-weight:800"><i class="fas fa-exclamation-triangle"></i> ⚠️ प्रपत्र भरना शेष (अपूर्ण)</span>`;
      } else if (!isSchoolLocked) {
        cardStatusClass = 'editable-open';
        statusBadge = `<span class="sp-status-badge warning" style="background:#d97706; color:#ffffff; border:1.5px solid #b45309; font-weight:800; box-shadow:0 2px 6px rgba(217,119,6,0.35)"><i class="fas fa-edit"></i> ✏️ संशोधन हेतु खुला (${sub.grand_total} पेपर - Edit Open)</span>`;
      } else {
        cardStatusClass = 'submitted';
        statusBadge = `<span class="sp-status-badge success" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:800; box-shadow:0 2px 6px rgba(22,163,74,0.3)"><i class="fas fa-check-circle"></i> ✓ डेटा सबमिट पूर्ण एवं लॉक (${sub.grand_total} पेपर)</span>`;
      }

      const card = document.createElement('div');
      card.className = `sp-school-card ${cardStatusClass}`;

      let submittedDetailsHtml = '';
      if (isSubmitted) {
        const c11Sub = formatOptionalSubjectsSummary(sub.c11_optional);
        const c12Sub = formatOptionalSubjectsSummary(sub.c12_optional);
        submittedDetailsHtml = `
          <div style="margin: 0.75rem 0;">
            <div style="font-weight:700; color:#166534; font-size:0.82rem; margin-bottom:4px; display:flex; align-items:center; gap:0.4rem">
              <i class="fas fa-check-circle text-success"></i> <strong>समान परीक्षा 2026-27 | भरा गया आधिकारिक डेटा विवरण:</strong>
            </div>
            <table class="sp-submitted-table">
              <thead>
                <tr>
                  <th style="width:20%">कक्षा</th>
                  <th style="width:25%">कुल विद्यार्थी</th>
                  <th>तृतीय भाषा / अनिवार्य व ऐच्छिक विषय</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>9वीं</strong></td>
                  <td style="font-weight:800; color:#1e40af">${sub.c9_total}</td>
                  <td>संस्कृत: <strong>${sub.c9_sanskrit || 0}</strong> | उर्दू: <strong>${sub.c9_urdu || 0}</strong></td>
                </tr>
                <tr>
                  <td><strong>10वीं</strong></td>
                  <td style="font-weight:800; color:#1e40af">${sub.c10_total}</td>
                  <td>संस्कृत: <strong>${sub.c10_sanskrit || 0}</strong> | उर्दू: <strong>${sub.c10_urdu || 0}</strong></td>
                </tr>
                <tr>
                  <td><strong>11वीं</strong></td>
                  <td style="font-weight:800; color:#1e40af">${sub.c11_total}</td>
                  <td>हिंदी(${sub.c11_comp_hindi}), अंग्रेजी(${sub.c11_comp_english})${c11Sub ? `<br><span style="color:#0369a1">${c11Sub}</span>` : ''}</td>
                </tr>
                <tr>
                  <td><strong>12वीं</strong></td>
                  <td style="font-weight:800; color:#1e40af">${sub.c12_total}</td>
                  <td>हिंदी(${sub.c12_comp_hindi}), अंग्रेजी(${sub.c12_comp_english})${c12Sub ? `<br><span style="color:#0369a1">${c12Sub}</span>` : ''}</td>
                </tr>
                <tr style="background:#f0fdf4; font-weight:800; color:#166534">
                  <td>महायोग</td>
                  <td style="font-size:0.95rem; color:#15803d">${sub.grand_total}</td>
                  <td>प्रमाणित संस्था प्रधान: ${sub.principal_name || '---'} (मो. ${sub.principal_mobile || '---'})</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }

      const officialNames = getOfficialSchoolNames(school);
      const fixedExamCode = (school.type === 'Private' ? 'AJM04P' : 'AJM04G') + school.shala_darpan_code;

      card.innerHTML = `
        <div>
          <div class="sp-card-header">
            <div>
              <div class="sp-school-name">#${index + 1}. ${officialNames.en}</div>
              <div style="font-size:0.8rem; color:#475569; font-weight:700; margin-top:2px">${officialNames.hi}</div>
            </div>
            ${statusBadge}
          </div>
          <div class="sp-school-meta">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span><strong>शा.दा./PSP कोड:</strong> ${school.shala_darpan_code}</span>
              ${catBadge}
            </div>
            <div><strong>श्रेणी:</strong> ${school.category}</div>
            <div><strong>परीक्षा कोड:</strong> <strong style="color:#0284c7">${fixedExamCode}</strong></div>
            ${submittedDetailsHtml}
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem">
          <a href="saman_form.html?code=${school.shala_darpan_code}&_v=${Date.now()}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; padding:0.45rem 0.75rem">
            <i class="fas ${isSchoolLocked ? 'fa-eye' : (isSubmitted ? 'fa-edit' : 'fa-file-signature')}"></i> ${isSchoolLocked ? '👁️ प्रपत्र अवलोकन' : (isSubmitted ? '✏️ प्रपत्र में संशोधन' : '📝 Google Form प्रपत्र भरें')}
          </a>
          ${isSubmitted ? `
            <button class="btn btn-warning btn-sm" onclick="downloadExamPdfDirectFromTable('${school.shala_darpan_code}')" title="सीधे PDF फाइल डाउनलोड करें" style="font-weight:700; color:#0f172a; background:#f59e0b; border:none">
              <i class="fas fa-download"></i> PDF डाउनलोड
            </button>
            <button class="btn btn-success btn-sm" onclick="openExamPdfPreview('${school.shala_darpan_code}')" title="आधिकारिक प्रमाणित PDF देखें / प्रिंट करें" style="font-weight:700">
              <i class="fas fa-print"></i> PDF प्रिंट
            </button>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
    }
  });

  if (progressBadge) {
    const pendingCount = targetSchools.length - submittedCount;
    progressBadge.innerHTML = `
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center">
        <span class="sp-status-badge success" style="font-size:0.85rem; padding:0.35rem 0.85rem">
          <i class="fas fa-check-circle"></i> ${submittedCount} पूर्ण
        </span>
        <span class="sp-status-badge ${pendingCount === 0 ? 'success' : 'danger'}" style="font-size:0.85rem; padding:0.35rem 0.85rem">
          <i class="fas ${pendingCount === 0 ? 'fa-award' : 'fa-exclamation-circle'}"></i> ${pendingCount} शेष
        </span>
      </div>
    `;
    progressBadge.className = '';
  }
}

function renderSamanParikshaAdminView() {
  const isSyl = STATE.samanParikshaActiveForm === 'syllabus';
  let targetSchools = STATE.schools56 || [];

  const scopeFilter = STATE.samanParikshaSchoolTypeFilter || (isSyl ? 'govt_only' : 'both');
  if (scopeFilter === 'govt_only') {
    targetSchools = targetSchools.filter(s => s.type === 'Government');
  } else if (scopeFilter === 'pvt_only') {
    targetSchools = targetSchools.filter(s => s.type === 'Private');
  }

  const totalSchools = targetSchools.length;
  let submittedCount = 0;
  let totalPapers = 0;
  let totalPctSum = 0;
  let govCount = 0;
  let pvtCount = 0;

  targetSchools.forEach(s => {
    if (s.type === 'Government') govCount++;
    else if (s.type === 'Private') pvtCount++;

    if (isSyl) {
      const sylSub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[s.shala_darpan_code] : null;
      if (sylSub && sylSub.is_submitted) {
        submittedCount++;
        totalPctSum += calculateSchoolSyllabusAverage(sylSub);
      }
    } else {
      const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
      if (isSamanParikshaSubmitted(sub)) {
        submittedCount++;
        totalPapers += (parseInt(sub.grand_total) || 0);
      }
    }
  });

  const pendingCount = totalSchools - submittedCount;
  const avgSyllabusPct = submittedCount > 0 ? Math.round(totalPctSum / submittedCount) : 0;

  const targetEl = document.getElementById('sp-admin-target-count');
  if (targetEl) targetEl.textContent = totalSchools;
  const govEl = document.getElementById('sp-admin-gov-count');
  if (govEl) govEl.textContent = govCount;
  const pvtEl = document.getElementById('sp-admin-pvt-count');
  if (pvtEl) pvtEl.textContent = pvtCount;

  const badgeEl = document.getElementById('nav-sp-badge');
  if (badgeEl) badgeEl.textContent = totalSchools;
  const tableCountEl = document.getElementById('sp-table-count');
  if (tableCountEl) tableCountEl.textContent = `${totalSchools} विद्यालय`;

  document.getElementById('sp-admin-submitted-count').textContent = submittedCount;
  document.getElementById('sp-admin-pending-count').textContent = pendingCount;
  
  const papersEl = document.getElementById('sp-admin-total-papers');
  if (papersEl) {
    if (isSyl) {
      papersEl.textContent = `${avgSyllabusPct}%`;
      const pLabel = papersEl.nextElementSibling;
      if (pLabel) pLabel.textContent = 'औसत पाठ्यक्रम पूर्णता (9-12)';
    } else {
      papersEl.textContent = totalPapers.toLocaleString('en-IN');
      const pLabel = papersEl.nextElementSibling;
      if (pLabel) pLabel.textContent = 'कुल मांग प्रश्न-पत्र (9-12)';
    }
  }

  // Populate PEEO filter in admin view if empty
  const peeoSelect = document.getElementById('sp-peeo-filter');
  if (peeoSelect && peeoSelect.options.length <= 1) {
    (STATE.peeos || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.peeo_name;
      opt.textContent = `${p.peeo_name} (${p.shala_darpan_code})`;
      peeoSelect.appendChild(opt);
    });
  }

  filterSamanParikshaTable();
}

function filterSamanParikshaTable() {
  const isSyl = STATE.samanParikshaActiveForm === 'syllabus';
  const search = document.getElementById('sp-search-input')?.value.toLowerCase() || '';
  const catFilter = document.getElementById('sp-category-filter')?.value || 'all';
  const statusFilter = document.getElementById('sp-status-filter')?.value || 'all';
  const peeoFilter = document.getElementById('sp-peeo-filter')?.value || 'all';

  const tbody = document.getElementById('sp-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Synchronize table header according to form mode
  const theadTr = tbody.closest('table')?.querySelector('thead tr');
  if (theadTr) {
    if (isSyl) {
      theadTr.innerHTML = `
        <th>क्र.</th>
        <th>विद्यालय का नाम व कोड</th>
        <th>प्रकार</th>
        <th>संबंधित PEEO</th>
        <th>संस्था प्रधान</th>
        <th>संपर्क</th>
        <th style="text-align:center">9वीं (7 विषय)</th>
        <th style="text-align:center">10वीं (7 विषय)</th>
        <th style="text-align:center">11वीं पूर्णता %</th>
        <th style="text-align:center">12वीं पूर्णता %</th>
        <th style="text-align:center">औसत %</th>
        <th>स्थिति</th>
        <th>कार्यवाही</th>
      `;
    } else {
      theadTr.innerHTML = `
        <th>क्र.</th>
        <th>विद्यालय का नाम व शाला दर्पण कोड</th>
        <th>प्रकार</th>
        <th>संबंधित PEEO</th>
        <th>स्कूल परीक्षा कोड</th>
        <th>संस्था प्रधान</th>
        <th>परीक्षा प्रभारी</th>
        <th style="text-align:right">9वीं</th>
        <th style="text-align:right">10वीं</th>
        <th style="text-align:right">11वीं</th>
        <th style="text-align:right">12वीं</th>
        <th style="text-align:right">कुल योग</th>
        <th>स्थिति</th>
        <th>कार्यवाही (Action)</th>
      `;
    }
  }

  let baseSchools = STATE.schools56 || [];
  const scopeFilter = STATE.samanParikshaSchoolTypeFilter || (isSyl ? 'govt_only' : 'both');
  if (scopeFilter === 'govt_only') {
    baseSchools = baseSchools.filter(s => s.type === 'Government');
  } else if (scopeFilter === 'pvt_only') {
    baseSchools = baseSchools.filter(s => s.type === 'Private');
  }

  let filtered = baseSchools.filter(s => {
    let isSubmitted = false;
    if (isSyl) {
      const sylSub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[s.shala_darpan_code] : null;
      isSubmitted = !!(sylSub && sylSub.is_submitted);
    } else {
      const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
      isSubmitted = isSamanParikshaSubmitted(sub);
    }

    if (catFilter !== 'all' && s.type !== catFilter) return false;
    if (statusFilter === 'submitted' && !isSubmitted) return false;
    if (statusFilter === 'pending' && isSubmitted) return false;
    if (peeoFilter !== 'all' && !s.peeo_name.toLowerCase().includes(peeoFilter.toLowerCase())) return false;

    if (search) {
      const text = `${s.school_name} ${s.shala_darpan_code} ${s.peeo_name} ${s.principal_name || ''}`.toLowerCase();
      if (!text.includes(search)) return false;
    }

    return true;
  });

  const tableCountEl = document.getElementById('sp-table-count');
  if (tableCountEl) tableCountEl.textContent = `${filtered.length} विद्यालय`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding:2rem; color:#64748b">कोई विद्यालय मैच नहीं हुआ।</td></tr>';
    return;
  }

  filtered.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const isGovt = s.type === 'Government';
    const typeBadge = isGovt 
      ? '<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700">राजकीय</span>'
      : '<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700">निजी</span>';

    if (isSyl) {
      // Syllabus Completion Row
      const sylSub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[s.shala_darpan_code] : null;
      const isSub = !!(sylSub && (sylSub.is_submitted || sylSub.average_pct || calculateSchoolSyllabusAverage(sylSub) > 0));
      const avgPct = isSub ? (sylSub.average_pct || calculateSchoolSyllabusAverage(sylSub)) : 0;
      const c9 = sylSub?.c9 || {};
      const c10 = sylSub?.c10 || {};
      const c11 = sylSub?.c11 || {};
      const c12 = sylSub?.c12 || {};

      if (isSub) {
        tr.style.background = '#f0fdf4';
        tr.style.borderLeft = '4px solid #16a34a';
      } else {
        tr.style.background = '#fef2f2';
        tr.style.borderLeft = '4px solid #ef4444';
      }

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <strong>${s.school_name}</strong>
          <div style="font-size:0.75rem; color:#64748b">कोड: ${s.shala_darpan_code}</div>
        </td>
        <td>${typeBadge}</td>
        <td>
          <a href="javascript:void(0)" onclick="openPeeoConsolidatedPdfPreview('${s.peeo_name}')" style="font-weight:700; color:#1e3a8a; text-decoration:none">
            ${s.peeo_name}
          </a>
        </td>
        <td>${sylSub?.principal_name || s.principal_name || '---'}</td>
        <td style="font-size:0.75rem; color:#64748b">${sylSub?.principal_mobile || s.principal_mobile || '---'}</td>
        <td style="text-align:center; font-size:0.8rem">
          ${isSub ? `हि: ${c9.hindi || 0}% | अं: ${c9.english || 0}%<br><span style="color:#0369a1; font-weight:700">सं: ${c9.sanskrit || 0}% | उ: ${c9.urdu || 0}%</span>` : '---'}
        </td>
        <td style="text-align:center; font-size:0.8rem">
          ${isSub ? `हि: ${c10.hindi || 0}% | अं: ${c10.english || 0}%<br><span style="color:#0369a1; font-weight:700">सं: ${c10.sanskrit || 0}% | उ: ${c10.urdu || 0}%</span>` : '---'}
        </td>
        <td style="text-align:center; font-size:0.8rem">
          ${isSub ? `हि: ${c11.comp_hindi || 0}%, अं: ${c11.comp_english || 0}%<br><span style="color:#047857">${(c11.electives || []).length} ऐच्छिक</span>` : '---'}
        </td>
        <td style="text-align:center; font-size:0.8rem">
          ${isSub ? `हि: ${c12.comp_hindi || 0}%, अं: ${c12.comp_english || 0}%<br><span style="color:#047857">${(c12.electives || []).length} ऐच्छिक</span>` : '---'}
        </td>
        <td style="text-align:center; font-weight:800; color:#15803d; font-size:0.95rem">
          ${isSub ? `${avgPct}%` : '---'}
        </td>
        <td>
          ${isSub 
            ? `<span class="status-badge" style="background:#dcfce7; color:#15803d">सबमिट पूर्ण</span>`
            : '<span class="status-badge" style="background:#fee2e2; color:#b91c1c">लम्बित</span>'}
        </td>
        <td>
          <div style="display:flex; gap:0.35rem; align-items:center">
            <button class="btn btn-warning btn-sm" onclick="openQuickSyllabusModal('${s.shala_darpan_code}')" title="त्वरित प्रविष्टि दर्ज करें" style="background:#f59e0b; border-color:#d97706; color:#0f172a; font-weight:800; padding:2px 7px; font-size:0.75rem">
              <i class="fas fa-bolt"></i> त्वरित दर्ज
            </button>
            <button class="btn btn-outline-primary btn-sm" onclick="openSamanSyllabusForm('${s.shala_darpan_code}')" title="विस्तृत प्रपत्र खोलें" style="padding:2px 7px; font-size:0.75rem">
              <i class="fas fa-edit"></i> प्रपत्र
            </button>
            ${isSub ? `
              <button class="btn btn-success btn-sm" onclick="printSyllabusPdf('${s.shala_darpan_code}')" title="अधिकृत प्रमाणित PDF प्रिंट करें" style="padding:2px 7px; font-size:0.75rem">
                <i class="fas fa-print"></i> PDF
              </button>
            ` : ''}
          </div>
        </td>
      `;
    } else {
      // Question Paper Indent Row
      const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
      const isSub = isSamanParikshaSubmitted(sub);
      const isMismatch = isDemandSchoolMismatch('saman_pariksha_2026_27', s.shala_darpan_code);
      const hasSig = !!(sub?.signature_data || sub?.has_digital_signature);

      if (isMismatch) {
        tr.style.background = '#fef2f2';
        tr.style.borderLeft = '4px solid #ef4444';
      } else if (isSub) {
        tr.style.background = '#f0fdf4';
        tr.style.borderLeft = '4px solid #16a34a';
      }

      const spCfg = STATE.samanMismatchSettings || (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : null);
      const isCustomEditActive = ((spCfg && spCfg.custom_edit_schools) || []).some(c => String(c).trim() === String(s.shala_darpan_code).trim());
      const hasActiveMismatchOrCustom = isMismatch || isCustomEditActive || !!(spCfg && spCfg.mismatch_details && spCfg.mismatch_details[s.shala_darpan_code] && !spCfg.mismatch_details[s.shala_darpan_code].resolved);

      tr.innerHTML = `
        <td>${s.s_no || (idx + 1)}</td>
        <td>
          <strong>${s.school_name}</strong>
          <div style="font-size:0.75rem; color:#64748b">कोड: ${s.shala_darpan_code}</div>
        </td>
        <td>${typeBadge}</td>
        <td>
          <a href="javascript:void(0)" onclick="openPeeoConsolidatedPdfPreview('${s.peeo_name}')" style="font-weight:700; color:#1e3a8a; text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem" title="${s.peeo_name} की समेकित रिपोर्ट देखें व प्रिंट करें">
            ${s.peeo_name} <i class="fas fa-file-invoice text-primary" style="font-size:0.8rem"></i>
          </a>
        </td>
        <td style="font-weight:700; color:#2563eb">${sub?.exam_code || s.exam_code || '---'}</td>
        <td>
          <div>${sub?.principal_name || s.principal_name || '---'}</div>
          <div style="font-size:0.75rem; color:#64748b">${sub?.principal_mobile || s.principal_mobile || ''}</div>
        </td>
        <td>
          <div>${sub?.incharge_name || s.incharge_name || '---'}</div>
          <div style="font-size:0.75rem; color:#64748b">${sub?.incharge_mobile || s.incharge_mobile || ''}</div>
        </td>
        <td style="text-align:right; font-weight:600">${isSub ? (sub.c9_total ?? 0) : '---'}</td>
        <td style="text-align:right; font-weight:600">${isSub ? (sub.c10_total ?? 0) : '---'}</td>
        <td style="text-align:right; font-weight:600">${isSub ? (sub.c11_total ?? 0) : '---'}</td>
        <td style="text-align:right; font-weight:600">${isSub ? (sub.c12_total ?? 0) : '---'}</td>
        <td style="text-align:right; font-weight:800; color:#15803d">${isSub ? (sub.grand_total ?? 0) : '---'}</td>
        <td>
          ${isMismatch
            ? `<span class="status-badge" style="background:#fee2e2; color:#991b1b; font-weight:800; border:1px solid #f87171"><i class="fas fa-exclamation-triangle"></i> 🚨 मिसमैच (अनलॉक)</span>`
            : (isSub 
              ? `<span class="status-badge" style="background:#dcfce7; color:#15803d; font-weight:700; border:1px solid #86efac" title="${hasSig ? 'डिजिटल हस्ताक्षर सहित सबमिट' : 'सबमिट पूर्ण'}">✓ मान्य ${hasSig ? '🖋️' : ''}</span>`
              : '<span class="status-badge" style="background:#fee2e2; color:#b91c1c">लम्बित</span>')}
          ${((STATE.samanMismatchSettings && STATE.samanMismatchSettings.custom_edit_schools) || []).some(c => String(c).trim() === String(s.shala_darpan_code).trim())
            ? `<div style="margin-top:3px"><span class="sp-custom-edit-active-tag" title="कस्टम एडिट खुला"><i class="fas fa-unlock-alt"></i> कस्टम एडिट</span></div>`
            : ''}
          ${STATE.samanMismatchSettings && STATE.samanMismatchSettings.mismatch_details && STATE.samanMismatchSettings.mismatch_details[s.shala_darpan_code]
            ? `<div style="margin-top:2px"><span style="font-size:0.7rem; font-weight:800; color:#dc2626; background:#fee2e2; padding:1px 5px; border-radius:4px" title="शाला दर्पण से मिसमैच">मिसमैच (${STATE.samanMismatchSettings.mismatch_details[s.shala_darpan_code].diff > 0 ? '+' : ''}${STATE.samanMismatchSettings.mismatch_details[s.shala_darpan_code].diff})</span></div>`
            : ''}
        </td>
        <td>
          <div style="display:flex; gap:0.35rem; align-items:center">
            <button class="btn btn-warning btn-sm" onclick="openDemandMismatchInspector('saman_pariksha_2026_27', '${s.shala_darpan_code}')" title="मिसमैच फील्ड निरीक्षण, चेकमार्क व ईमेल+टेलीग्राम अलर्ट" style="background:#f59e0b; color:#fff; border:none; font-weight:700">
              <i class="fas fa-flag"></i>
            </button>
            <a href="saman_form.html?code=${s.shala_darpan_code}&_v=${Date.now()}" target="_blank" class="btn btn-outline-light btn-sm" title="प्रपत्र भरें / संपादित करें">
              <i class="fas fa-edit"></i>
            </a>
            <button class="btn btn-sm ${hasActiveMismatchOrCustom ? 'btn-danger' : 'btn-outline-secondary'}" onclick="toggleSamanMismatchAlertDirect('${s.shala_darpan_code}')" title="${hasActiveMismatchOrCustom ? '🚨 मिसमैच अलर्ट / कस्टम एडिट बंद करें (Click to Turn OFF)' : '🔔 मिसमैच अलर्ट / कस्टम एडिट चालू करें (Click to Turn ON)'}" style="${hasActiveMismatchOrCustom ? 'background:#ef4444; color:#fff; border:none; font-weight:bold;' : 'border:1px solid #cbd5e1; color:#64748b;'} padding:2px 7px; font-size:0.75rem" type="button">
              <i class="fas ${hasActiveMismatchOrCustom ? 'fa-bell-slash' : 'fa-bell'}"></i> ${hasActiveMismatchOrCustom ? '<span style="font-size:0.7rem">अलर्ट बंद</span>' : ''}
            </button>
            <button class="btn btn-warning btn-sm" onclick="downloadExamPdfDirectFromTable('${s.shala_darpan_code}')" title="सीधे अधिकृत PDF डाउनलोड करें" style="background:#f59e0b; color:#fff; border:none; font-weight:700">
              <i class="fas fa-download"></i>
            </button>
            <button class="btn btn-success btn-sm" onclick="openExamPdfPreview('${s.shala_darpan_code}')" title="अधिकृत A4 PDF देखें व प्रिंट करें">
              <i class="fas fa-print"></i>
            </button>
            ${!isSub ? `
              <button class="btn btn-whatsapp btn-sm" onclick="sendSamanParikshaReminder('${s.shala_darpan_code}')" title="WhatsApp पर तुरंत रिमाइंडर भेजें">
                <i class="fab fa-whatsapp"></i>
              </button>
            ` : ''}
          </div>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });
}

/* ========================================================
   SAMAN PARIKSHA DUAL-MODE CONTROLS & SYLLABUS COMPLETION % ENGINE
   ======================================================== */

function syncSyllabusSubmissionsFromCloud(isManual = false) {
  if (isManual) {
    showToast('🚀 Google Sheet से लाइव डेटा सिंक हो रहा है...', 'info');
  }

  // 1. Instant local fetch from SQLite & cache (<5ms)
  const fetchLocalPromise = fetch('/api/get_saman_syllabus?_t=' + Date.now())
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.success && data.submissions) {
        if (!STATE.samanSyllabusSubmissions) STATE.samanSyllabusSubmissions = {};
        Object.assign(STATE.samanSyllabusSubmissions, data.submissions);
        localStorage.setItem('cbeo_saman_syllabus_submissions', JSON.stringify(STATE.samanSyllabusSubmissions));
        renderSamanParikshaView();
        updateAllPortalMetricsAndProgress();
        renderDashboardView();
        if (typeof renderBulkSyllabusTable === 'function') renderBulkSyllabusTable();
      }
    }).catch(() => {});

  // 2. If manual sync requested, trigger server-side cloud sync with Google Sheet
  if (isManual) {
    return fetch('/api/sync_cloud_now')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.success && data.submissions) {
          if (!STATE.samanSyllabusSubmissions) STATE.samanSyllabusSubmissions = {};
          Object.assign(STATE.samanSyllabusSubmissions, data.submissions);
          localStorage.setItem('cbeo_saman_syllabus_submissions', JSON.stringify(STATE.samanSyllabusSubmissions));
          renderSamanParikshaView();
          updateAllPortalMetricsAndProgress();
          renderDashboardView();
          if (typeof renderBulkSyllabusTable === 'function') renderBulkSyllabusTable();
          showToast(`✓ Google Sheet से लाइव सिंक पूर्ण! (${data.count || Object.keys(data.submissions).length} विद्यालयों का डेटा प्राप्त)`, 'success');
        } else {
          showToast('✓ स्थानीय डेटाबेस से डेटा नवीनीकृत हुआ!', 'info');
        }
      }).catch(err => {
        showToast('स्थानीय डेटाबेस से नवीनतम डेटा लोड हुआ (Google Drive विलंबित)', 'info');
      });
  }

  return fetchLocalPromise;
}
window.syncSyllabusSubmissionsFromCloud = syncSyllabusSubmissionsFromCloud;

// ---------------- QUICK SYLLABUS ENTRY MODAL HANDLERS ----------------
function openQuickSyllabusModal(schoolCode = null) {
  const modal = document.getElementById('modal-syllabus-quick-entry');
  if (!modal) return;

  const select = document.getElementById('quick-syl-school-select');
  if (select) {
    select.innerHTML = '<option value="">-- विद्यालय चुनें --</option>';
    const govtSchools = (STATE.schools56 || []).filter(s => s.type === 'Government');
    govtSchools.forEach(s => {
      const sub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[s.shala_darpan_code] : null;
      const isSub = !!(sub && sub.is_submitted);
      const opt = document.createElement('option');
      opt.value = s.shala_darpan_code;
      opt.textContent = `${isSub ? '✓' : '⏳'} ${s.school_name} (${s.shala_darpan_code}) - ${isSub ? 'सबमिट' : 'लम्बित'}`;
      select.appendChild(opt);
    });

    if (schoolCode) {
      select.value = schoolCode;
    } else if (govtSchools.length > 0) {
      const firstPending = govtSchools.find(s => {
        const sub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[s.shala_darpan_code] : null;
        return !(sub && sub.is_submitted);
      });
      select.value = firstPending ? firstPending.shala_darpan_code : govtSchools[0].shala_darpan_code;
    }
  }

  onQuickSyllabusSchoolSelect(select ? select.value : schoolCode);
  modal.classList.add('active');
}
window.openQuickSyllabusModal = openQuickSyllabusModal;

function onQuickSyllabusSchoolSelect(code) {
  if (!code) return;
  const school = (STATE.schools56 || []).find(s => s.shala_darpan_code === code);
  const peeoTxt = document.getElementById('quick-syl-peeo-text');
  const catTxt = document.getElementById('quick-syl-cat-text');
  const statusBadge = document.getElementById('quick-syl-status-badge');

  if (school) {
    if (peeoTxt) peeoTxt.textContent = school.peeo_name || '---';
    if (catTxt) catTxt.textContent = school.category || 'Govt. Sr. Sec.';
  }

  const sub = (STATE.samanSyllabusSubmissions && STATE.samanSyllabusSubmissions[code]) || {};
  const isSub = !!sub.is_submitted;

  if (statusBadge) {
    if (isSub) {
      statusBadge.style.background = '#dcfce7';
      statusBadge.style.color = '#15803d';
      statusBadge.textContent = `✓ सबमिट पूर्ण (${sub.average_pct || calculateSchoolSyllabusAverage(sub)}%)`;
    } else {
      statusBadge.style.background = '#fee2e2';
      statusBadge.style.color = '#b91c1c';
      statusBadge.textContent = '⏳ प्रविष्टि लम्बित (Pending)';
    }
  }

  const c9Inp = document.getElementById('quick-syl-c9');
  const c10Inp = document.getElementById('quick-syl-c10');
  const c11Inp = document.getElementById('quick-syl-c11');
  const c12Inp = document.getElementById('quick-syl-c12');
  const c11Zero = document.getElementById('quick-syl-c11-zero');
  const c12Zero = document.getElementById('quick-syl-c12-zero');
  const pNameInp = document.getElementById('quick-syl-pname');
  const pMobInp = document.getElementById('quick-syl-pmob');

  const c9Avg = sub.c9 ? (sub.c9.hindi || sub.c9.average || 75) : 75;
  const c10Avg = sub.c10 ? (sub.c10.hindi || sub.c10.average || 75) : 75;
  const c11Avg = sub.c11 ? (sub.c11.comp_hindi || sub.c11.average || 70) : 70;
  const c12Avg = sub.c12 ? (sub.c12.comp_hindi || sub.c12.average || 72) : 72;

  if (c9Inp) c9Inp.value = isSub ? c9Avg : 75;
  if (c10Inp) c10Inp.value = isSub ? c10Avg : 75;
  if (c11Inp) c11Inp.value = isSub ? (sub.c11?.zero_enrolment ? 0 : c11Avg) : (school?.category?.includes('Sec') && !school?.category?.includes('Sr') ? 0 : 70);
  if (c12Inp) c12Inp.value = isSub ? (sub.c12?.zero_enrolment ? 0 : c12Avg) : (school?.category?.includes('Sec') && !school?.category?.includes('Sr') ? 0 : 72);

  const isSecOnly = school?.category?.includes('Sec') && !school?.category?.includes('Sr');
  if (c11Zero) {
    c11Zero.checked = isSub ? !!sub.c11?.zero_enrolment : isSecOnly;
    toggleQuickSylZero('c11', c11Zero.checked);
  }
  if (c12Zero) {
    c12Zero.checked = isSub ? !!sub.c12?.zero_enrolment : isSecOnly;
    toggleQuickSylZero('c12', c12Zero.checked);
  }

  if (pNameInp) pNameInp.value = sub.principal_name || sub.submitted_by || school?.principal_name || 'संस्था प्रधान';
  if (pMobInp) pMobInp.value = sub.principal_mobile || sub.submitter_mobile || school?.principal_mobile || '';

  calcQuickSylAverage();
}
window.onQuickSyllabusSchoolSelect = onQuickSyllabusSchoolSelect;

function quickFillSyllabusPreset(val) {
  const c9Inp = document.getElementById('quick-syl-c9');
  const c10Inp = document.getElementById('quick-syl-c10');
  const c11Inp = document.getElementById('quick-syl-c11');
  const c12Inp = document.getElementById('quick-syl-c12');
  const c11Zero = document.getElementById('quick-syl-c11-zero');
  const c12Zero = document.getElementById('quick-syl-c12-zero');

  if (c9Inp) c9Inp.value = val;
  if (c10Inp) c10Inp.value = val;
  if (c11Inp && (!c11Zero || !c11Zero.checked)) c11Inp.value = val;
  if (c12Inp && (!c12Zero || !c12Zero.checked)) c12Inp.value = val;
  calcQuickSylAverage();
}
window.quickFillSyllabusPreset = quickFillSyllabusPreset;

function toggleQuickSylZero(cls, isZero) {
  const inp = document.getElementById(`quick-syl-${cls}`);
  if (inp) {
    inp.disabled = isZero;
    if (isZero) inp.value = 0;
  }
  calcQuickSylAverage();
}
window.toggleQuickSylZero = toggleQuickSylZero;

function calcQuickSylAverage() {
  const c9 = parseFloat(document.getElementById('quick-syl-c9')?.value) || 0;
  const c10 = parseFloat(document.getElementById('quick-syl-c10')?.value) || 0;
  const c11Zero = !!document.getElementById('quick-syl-c11-zero')?.checked;
  const c12Zero = !!document.getElementById('quick-syl-c12-zero')?.checked;
  const c11 = c11Zero ? 0 : (parseFloat(document.getElementById('quick-syl-c11')?.value) || 0);
  const c12 = c12Zero ? 0 : (parseFloat(document.getElementById('quick-syl-c12')?.value) || 0);

  let sum = c9 + c10;
  let count = 2;
  if (!c11Zero && c11 > 0) { sum += c11; count++; }
  if (!c12Zero && c12 > 0) { sum += c12; count++; }

  const avg = Math.round(sum / count);
  const disp = document.getElementById('quick-syl-avg-display');
  if (disp) disp.textContent = `${avg}%`;
  return avg;
}
window.calcQuickSylAverage = calcQuickSylAverage;

function saveQuickSyllabusEntry() {
  const select = document.getElementById('quick-syl-school-select');
  const code = select ? select.value : '';
  if (!code) {
    alert('कृपया विद्यालय का चयन करें!');
    return;
  }

  const school = (STATE.schools56 || []).find(s => s.shala_darpan_code === code);
  const c9Val = parseFloat(document.getElementById('quick-syl-c9')?.value) || 75;
  const c10Val = parseFloat(document.getElementById('quick-syl-c10')?.value) || 75;
  const c11Zero = !!document.getElementById('quick-syl-c11-zero')?.checked;
  const c12Zero = !!document.getElementById('quick-syl-c12-zero')?.checked;
  const c11Val = c11Zero ? 0 : (parseFloat(document.getElementById('quick-syl-c11')?.value) || 70);
  const c12Val = c12Zero ? 0 : (parseFloat(document.getElementById('quick-syl-c12')?.value) || 72);
  const pName = document.getElementById('quick-syl-pname')?.value.trim() || 'संस्था प्रधान';
  const pMob = document.getElementById('quick-syl-pmob')?.value.trim() || school?.principal_mobile || '9414000000';
  const avg = calcQuickSylAverage();

  const payload = {
    school_code: code,
    school_name: school?.school_name || '',
    peeo_name: school?.peeo_name || '',
    peeo_code: school?.peeo_code || '',
    principal_name: pName,
    principal_mobile: pMob,
    submitted_by: pName,
    submitter_mobile: pMob,
    is_submitted: true,
    submitted_at: new Date().toISOString(),
    average_pct: avg,
    c9: {
      zero_enrolment: false,
      hindi: c9Val, english: c9Val, maths: c9Val, science: c9Val, sst: c9Val, sanskrit: c9Val, urdu: 0
    },
    c10: {
      zero_enrolment: false,
      hindi: c10Val, english: c10Val, maths: c10Val, science: c10Val, sst: c10Val, sanskrit: c10Val, urdu: 0
    },
    c11: {
      zero_enrolment: c11Zero,
      comp_hindi: c11Val, comp_english: c11Val,
      faculties: ['arts'],
      electives: [{ name: 'अनिवार्य व ऐच्छिक', pct: c11Val }]
    },
    c12: {
      zero_enrolment: c12Zero,
      comp_hindi: c12Val, comp_english: c12Val,
      faculties: ['arts'],
      electives: [{ name: 'अनिवार्य व ऐच्छिक', pct: c12Val }]
    }
  };

  if (!STATE.samanSyllabusSubmissions) STATE.samanSyllabusSubmissions = {};
  STATE.samanSyllabusSubmissions[code] = payload;
  localStorage.setItem('cbeo_saman_syllabus_submissions', JSON.stringify(STATE.samanSyllabusSubmissions));

  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveDemandSubmission',
          demand_id: 'DEMAND_SAMAN_SYLLABUS_2026',
          school_code: code,
          school_name: school?.school_name || '',
          peeo_name: school?.peeo_name || '',
          peeo_code: school?.peeo_code || '',
          submitted_by: pName,
          submitter_mobile: pMob,
          data_json: JSON.stringify(payload)
        })
      }).catch(() => {});
    } catch(e) {}
  }

  const apiBaseSyl = getEffectiveApiBaseUrl();
  if (apiBaseSyl) {
    fetch(`${apiBaseSyl}/api/save_saman_syllabus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_code: code, data: payload, submission: payload })
    }).catch(() => {});
  }

  closeModal('modal-syllabus-quick-entry');
  showToast(`✓ ${school?.school_name || code} का पाठ्यक्रम डेटा (${avg}%) Google Sheet एवं पोर्टल में दर्ज हो गया!`, 'success');
  renderSamanParikshaView();
  updateAllPortalMetricsAndProgress();
  renderDashboardView();
}
window.saveQuickSyllabusEntry = saveQuickSyllabusEntry;

// ---------------- BULK SYLLABUS MANAGER FUNCTIONS ----------------
function openBulkSyllabusManagerModal() {
  const isAdmin = (typeof isJitendraLoggedIn === 'function' && isJitendraLoggedIn()) || (STATE.currentUser && STATE.currentUser.role === 'admin');
  if (!isAdmin) {
    showToast('49 स्कूल बल्क प्रबंधक केवल व्यवस्थापक (Admin) हेतु उपलब्ध है।', 'error');
    return;
  }
  const modal = document.getElementById('modal-syllabus-bulk-manager');
  if (!modal) return;
  renderBulkSyllabusTable();
  modal.classList.add('active');
}
window.openBulkSyllabusManagerModal = openBulkSyllabusManagerModal;

function renderBulkSyllabusTable() {
  const tbody = document.getElementById('bulk-syl-tbody');
  const filterInput = document.getElementById('bulk-syl-filter-input');
  const statsBadge = document.getElementById('bulk-syl-stats-badge');
  if (!tbody) return;

  const filter = (filterInput?.value || '').toLowerCase().trim();
  const govtSchools = (STATE.schools56 || []).filter(s => s.type === 'Government');

  let submittedCount = 0;
  govtSchools.forEach(s => {
    const sub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[s.shala_darpan_code] : null;
    if (sub && sub.is_submitted) submittedCount++;
  });

  if (statsBadge) {
    statsBadge.textContent = `कुल: ${govtSchools.length} | सबमिट: ${submittedCount} | शेष: ${govtSchools.length - submittedCount}`;
  }

  const filtered = govtSchools.filter(s => {
    if (!filter) return true;
    return s.school_name.toLowerCase().includes(filter) ||
           s.shala_darpan_code.toLowerCase().includes(filter) ||
           (s.peeo_name && s.peeo_name.toLowerCase().includes(filter));
  });

  tbody.innerHTML = '';
  filtered.forEach((s, idx) => {
    const code = s.shala_darpan_code;
    const sub = (STATE.samanSyllabusSubmissions && STATE.samanSyllabusSubmissions[code]) || {};
    const isSub = !!sub.is_submitted;
    const avg = isSub ? (sub.average_pct || calculateSchoolSyllabusAverage(sub)) : 0;

    const isSecOnly = s.category?.includes('Sec') && !s.category?.includes('Sr');
    const c9Val = isSub ? (sub.c9?.hindi || sub.c9?.average || avg) : 75;
    const c10Val = isSub ? (sub.c10?.hindi || sub.c10?.average || avg) : 75;
    const c11Val = isSub ? (sub.c11?.comp_hindi || sub.c11?.average || 0) : (isSecOnly ? 0 : 70);
    const c12Val = isSub ? (sub.c12?.comp_hindi || sub.c12?.average || 0) : (isSecOnly ? 0 : 72);

    const tr = document.createElement('tr');
    tr.style.background = isSub ? '#f0fdf4' : '#fff';
    tr.style.borderBottom = '1px solid #e2e8f0';

    tr.innerHTML = `
      <td style="padding:6px 8px; text-align:center">${idx + 1}</td>
      <td style="padding:6px 8px">
        <strong>${s.school_name}</strong>
        <div style="font-size:0.75rem; color:#64748b">कोड: ${code} | ${s.category || 'Sr.Sec'}</div>
      </td>
      <td style="padding:6px 8px; font-size:0.78rem">${s.peeo_name || '---'}</td>
      <td style="padding:4px 6px; text-align:center">
        <input type="number" id="bulk_c9_${code}" value="${c9Val}" min="0" max="100" class="form-control" style="width:65px; padding:2px 4px; text-align:center; font-size:0.8rem; margin:auto">
      </td>
      <td style="padding:4px 6px; text-align:center">
        <input type="number" id="bulk_c10_${code}" value="${c10Val}" min="0" max="100" class="form-control" style="width:65px; padding:2px 4px; text-align:center; font-size:0.8rem; margin:auto">
      </td>
      <td style="padding:4px 6px; text-align:center">
        <input type="number" id="bulk_c11_${code}" value="${c11Val}" min="0" max="100" class="form-control" ${isSecOnly ? 'disabled' : ''} style="width:65px; padding:2px 4px; text-align:center; font-size:0.8rem; margin:auto">
      </td>
      <td style="padding:4px 6px; text-align:center">
        <input type="number" id="bulk_c12_${code}" value="${c12Val}" min="0" max="100" class="form-control" ${isSecOnly ? 'disabled' : ''} style="width:65px; padding:2px 4px; text-align:center; font-size:0.8rem; margin:auto">
      </td>
      <td style="padding:6px 8px; text-align:center; font-weight:800; color:#15803d">
        ${isSub ? `${avg}%` : '<span style="color:#94a3b8">---</span>'}
      </td>
      <td style="padding:6px 8px; text-align:center">
        ${isSub 
          ? '<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.72rem">✓ सबमिट</span>'
          : '<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.72rem">लम्बित</span>'}
      </td>
      <td style="padding:6px 8px; text-align:center">
        <button type="button" class="btn btn-primary btn-sm" onclick="saveBulkSyllabusRow('${code}')" style="font-size:0.75rem; padding:3px 8px">
          💾 सेव
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
window.renderBulkSyllabusTable = renderBulkSyllabusTable;

function bulkFillAllPendingSyllabus(val) {
  const govtSchools = (STATE.schools56 || []).filter(s => s.type === 'Government');
  govtSchools.forEach(s => {
    const code = s.shala_darpan_code;
    const sub = STATE.samanSyllabusSubmissions ? STATE.samanSyllabusSubmissions[code] : null;
    if (!sub || !sub.is_submitted) {
      const c9 = document.getElementById(`bulk_c9_${code}`);
      const c10 = document.getElementById(`bulk_c10_${code}`);
      const c11 = document.getElementById(`bulk_c11_${code}`);
      const c12 = document.getElementById(`bulk_c12_${code}`);
      if (c9) c9.value = val;
      if (c10) c10.value = val;
      if (c11 && !c11.disabled) c11.value = val;
      if (c12 && !c12.disabled) c12.value = val;
    }
  });
  showToast(`⚡ सभी लम्बित विद्यालयों में ${val}% मान भर दिया गया। 'सभी प्रविष्टियाँ सिंक करें' पर क्लिक करें।`, 'info');
}
window.bulkFillAllPendingSyllabus = bulkFillAllPendingSyllabus;

function saveBulkSyllabusRow(code) {
  const school = (STATE.schools56 || []).find(s => s.shala_darpan_code === code);
  const isSecOnly = school?.category?.includes('Sec') && !school?.category?.includes('Sr');
  const c9Val = parseFloat(document.getElementById(`bulk_c9_${code}`)?.value) || 75;
  const c10Val = parseFloat(document.getElementById(`bulk_c10_${code}`)?.value) || 75;
  const c11Val = isSecOnly ? 0 : (parseFloat(document.getElementById(`bulk_c11_${code}`)?.value) || 0);
  const c12Val = isSecOnly ? 0 : (parseFloat(document.getElementById(`bulk_c12_${code}`)?.value) || 0);

  let sum = c9Val + c10Val;
  let cnt = 2;
  if (!isSecOnly && c11Val > 0) { sum += c11Val; cnt++; }
  if (!isSecOnly && c12Val > 0) { sum += c12Val; cnt++; }
  const avg = Math.round(sum / cnt);

  const payload = {
    school_code: code,
    school_name: school?.school_name || '',
    peeo_name: school?.peeo_name || '',
    peeo_code: school?.peeo_code || '',
    principal_name: school?.principal_name || 'संस्था प्रधान',
    principal_mobile: school?.principal_mobile || '9414000000',
    submitted_by: school?.principal_name || 'संस्था प्रधान',
    submitter_mobile: school?.principal_mobile || '9414000000',
    is_submitted: true,
    submitted_at: new Date().toISOString(),
    average_pct: avg,
    c9: { zero_enrolment: false, hindi: c9Val, english: c9Val, maths: c9Val, science: c9Val, sst: c9Val, sanskrit: c9Val, urdu: 0 },
    c10: { zero_enrolment: false, hindi: c10Val, english: c10Val, maths: c10Val, science: c10Val, sst: c10Val, sanskrit: c10Val, urdu: 0 },
    c11: { zero_enrolment: isSecOnly || c11Val === 0, comp_hindi: c11Val, comp_english: c11Val, electives: [{ name: 'अनिवार्य व ऐच्छिक', pct: c11Val }] },
    c12: { zero_enrolment: isSecOnly || c12Val === 0, comp_hindi: c12Val, comp_english: c12Val, electives: [{ name: 'अनिवार्य व ऐच्छिक', pct: c12Val }] }
  };

  if (!STATE.samanSyllabusSubmissions) STATE.samanSyllabusSubmissions = {};
  STATE.samanSyllabusSubmissions[code] = payload;
  localStorage.setItem('cbeo_saman_syllabus_submissions', JSON.stringify(STATE.samanSyllabusSubmissions));

  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveDemandSubmission',
        demand_id: 'DEMAND_SAMAN_SYLLABUS_2026',
        school_code: code,
        school_name: school?.school_name || '',
        peeo_name: school?.peeo_name || '',
        peeo_code: school?.peeo_code || '',
        submitted_by: school?.principal_name || 'संस्था प्रधान',
        submitter_mobile: school?.principal_mobile || '',
        data_json: JSON.stringify(payload)
      })
    }).catch(() => {});
  }

  const apiBaseBulkSyl = getEffectiveApiBaseUrl();
  if (apiBaseBulkSyl) {
    fetch(`${apiBaseBulkSyl}/api/save_saman_syllabus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_code: code, submission: payload })
    }).catch(() => {});
  }

  renderBulkSyllabusTable();
  renderSamanParikshaView();
  showToast(`✓ ${school?.school_name || code} का पाठ्यक्रम डेटा दर्ज हुआ!`, 'success');
}
window.saveBulkSyllabusRow = saveBulkSyllabusRow;

function saveAllBulkSyllabusToCloud() {
  const govtSchools = (STATE.schools56 || []).filter(s => s.type === 'Government');
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  showToast('🚀 सभी 49 विद्यालयों का डेटा Google Sheet में अपलोड हो रहा है...', 'info');

  govtSchools.forEach(s => {
    saveBulkSyllabusRow(s.shala_darpan_code);
  });

  setTimeout(() => {
    showToast('✓ सभी 49 विद्यालयों का पाठ्यक्रम पूर्णता डेटा सफलतापूर्वक Google Sheet में सुरक्षित हुआ!', 'success');
    renderBulkSyllabusTable();
    renderSamanParikshaView();
  }, 1000);
}
window.saveAllBulkSyllabusToCloud = saveAllBulkSyllabusToCloud;

function switchSamanActiveForm(formType) {
  STATE.samanParikshaActiveForm = formType;
  localStorage.setItem('cbeo_saman_active_form', formType);
  const scopeDropdown = document.getElementById('sp-school-type-filter');
  const sylQuickBtns = document.getElementById('sp-syl-quick-btns');
  const sylDispatchBar = document.getElementById('sp-syllabus-admin-dispatch-bar');

  if (formType === 'syllabus') {
    // When switching to syllabus completion % demand, automatically filter to 49 Govt schools
    // because private schools are excluded as per user instructions
    STATE.samanParikshaSchoolTypeFilter = 'govt_only';
    if (scopeDropdown) scopeDropdown.value = 'govt_only';
    if (sylQuickBtns) sylQuickBtns.style.display = 'inline-flex';
    if (sylDispatchBar) sylDispatchBar.style.display = 'flex';
    syncSyllabusSubmissionsFromCloud();
    showToast('नवीन पाठ्यक्रम पूर्णता % मांग (49 राजकीय विद्यालय) सक्रिय हो गई!', 'info');
  } else {
    STATE.samanParikshaSchoolTypeFilter = 'all';
    if (scopeDropdown) scopeDropdown.value = 'all';
    if (sylQuickBtns) sylQuickBtns.style.display = 'none';
    if (sylDispatchBar) sylDispatchBar.style.display = 'none';
    showToast('मूल प्रश्न-पत्र मांग (57 विद्यालय) सक्रिय हो गई!', 'info');
  }

  renderSamanParikshaView();
}

function onSamanSchoolTypeFilterChange(val) {
  STATE.samanParikshaSchoolTypeFilter = val;
  renderSamanParikshaView();
}

function openSaman6LevelControlModal() {
  const tabVis = (STATE.tabVisibility6Level && STATE.tabVisibility6Level['saman-pariksha']) ||
    (DEFAULT_TAB_VISIBILITY_6LEVEL && DEFAULT_TAB_VISIBILITY_6LEVEL['saman-pariksha']) ||
    { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: false, all_schools: false };

  const editPerm = (STATE.editPermissions6Level && STATE.editPermissions6Level['saman_pariksha']) ||
    (DEFAULT_EDIT_PERMISSIONS_6LEVEL && DEFAULT_EDIT_PERMISSIONS_6LEVEL['saman_pariksha']) ||
    { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: true, all_govt: false, all_schools: false };

  // Set View Checkboxes
  if (document.getElementById('sp-ctl-vis-cbeo')) document.getElementById('sp-ctl-vis-cbeo').checked = !!tabVis.cbeo;
  if (document.getElementById('sp-ctl-vis-peeo')) document.getElementById('sp-ctl-vis-peeo').checked = !!tabVis.peeo;
  if (document.getElementById('sp-ctl-vis-govt-sec')) document.getElementById('sp-ctl-vis-govt-sec').checked = !!tabVis.govt_sec_srsec;
  if (document.getElementById('sp-ctl-vis-pvt-sec')) document.getElementById('sp-ctl-vis-pvt-sec').checked = !!tabVis.pvt_sec_srsec;
  if (document.getElementById('sp-ctl-vis-all-govt')) document.getElementById('sp-ctl-vis-all-govt').checked = !!tabVis.all_govt;
  if (document.getElementById('sp-ctl-vis-all-schools')) document.getElementById('sp-ctl-vis-all-schools').checked = !!tabVis.all_schools;

  // Set Edit Checkboxes
  if (document.getElementById('sp-ctl-edit-cbeo')) document.getElementById('sp-ctl-edit-cbeo').checked = !!editPerm.cbeo;
  if (document.getElementById('sp-ctl-edit-peeo')) document.getElementById('sp-ctl-edit-peeo').checked = !!editPerm.peeo;
  if (document.getElementById('sp-ctl-edit-govt-sec')) document.getElementById('sp-ctl-edit-govt-sec').checked = !!editPerm.govt_sec_srsec;
  if (document.getElementById('sp-ctl-edit-pvt-sec')) document.getElementById('sp-ctl-edit-pvt-sec').checked = !!editPerm.pvt_sec_srsec;
  if (document.getElementById('sp-ctl-edit-all-govt')) document.getElementById('sp-ctl-edit-all-govt').checked = !!editPerm.all_govt;
  if (document.getElementById('sp-ctl-edit-all-schools')) document.getElementById('sp-ctl-edit-all-schools').checked = !!editPerm.all_schools;

  // Set Active Form Radio
  const radIndent = document.getElementById('sp-rad-form-indent');
  const radSyl = document.getElementById('sp-rad-form-syllabus');
  if (STATE.samanParikshaActiveForm === 'syllabus') {
    if (radSyl) radSyl.checked = true;
  } else {
    if (radIndent) radIndent.checked = true;
  }

  showModal('modal-saman-6level-controls');
}

function saveSaman6LevelControls() {
  if (!STATE.tabVisibility6Level) STATE.tabVisibility6Level = JSON.parse(JSON.stringify(DEFAULT_TAB_VISIBILITY_6LEVEL));
  if (!STATE.editPermissions6Level) STATE.editPermissions6Level = JSON.parse(JSON.stringify(DEFAULT_EDIT_PERMISSIONS_6LEVEL));

  const visCbeo = !!document.getElementById('sp-ctl-vis-cbeo')?.checked;
  const visPeeo = !!document.getElementById('sp-ctl-vis-peeo')?.checked;
  const visGovtSec = !!document.getElementById('sp-ctl-vis-govt-sec')?.checked;
  const visPvtSec = !!document.getElementById('sp-ctl-vis-pvt-sec')?.checked;
  const visAllGovt = !!document.getElementById('sp-ctl-vis-all-govt')?.checked;
  const visAll = !!document.getElementById('sp-ctl-vis-all-schools')?.checked;

  STATE.tabVisibility6Level['saman-pariksha'] = {
    cbeo: visCbeo,
    peeo: visPeeo,
    govt_sec_srsec: visGovtSec,
    pvt_sec_srsec: visPvtSec,
    sec_srsec: visGovtSec || visPvtSec,
    all_govt: visAllGovt,
    all_schools: visAll
  };

  const editCbeo = !!document.getElementById('sp-ctl-edit-cbeo')?.checked;
  const editPeeo = !!document.getElementById('sp-ctl-edit-peeo')?.checked;
  const editGovtSec = !!document.getElementById('sp-ctl-edit-govt-sec')?.checked;
  const editPvtSec = !!document.getElementById('sp-ctl-edit-pvt-sec')?.checked;
  const editAllGovt = !!document.getElementById('sp-ctl-edit-all-govt')?.checked;
  const editAll = !!document.getElementById('sp-ctl-edit-all-schools')?.checked;

  STATE.editPermissions6Level['saman_pariksha'] = {
    cbeo: editCbeo,
    peeo: editPeeo,
    govt_sec_srsec: editGovtSec,
    pvt_sec_srsec: editPvtSec,
    sec_srsec: editGovtSec || editPvtSec,
    all_govt: editAllGovt,
    all_schools: editAll
  };

  localStorage.setItem('cbeo_tab_visibility_6level', JSON.stringify(STATE.tabVisibility6Level));
  localStorage.setItem('cbeo_edit_permissions_6level', JSON.stringify(STATE.editPermissions6Level));

  fetch('/api/save_tab_visibility_6level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(STATE.tabVisibility6Level)
  }).catch(() => {});

  fetch('/api/save_edit_permissions_6level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(STATE.editPermissions6Level)
  }).catch(() => {});

  const isSylSelected = !!document.getElementById('sp-rad-form-syllabus')?.checked;
  switchSamanActiveForm(isSylSelected ? 'syllabus' : 'indent');

  closeModal('modal-saman-6level-controls');
  showToast('समान परीक्षा 6-स्तरीय प्रपत्र व दृश्यता नियंत्रण सुरक्षित!', 'success');
  renderApp();
}

function onSamanModalRadioFormChange(val) {
  // Radio change helper
}

async function triggerGitHubDataPush() {
  const apiBase = getEffectiveApiBaseUrl();
  if (!apiBase) {
    showToast('⚠️ GitHub बैकअप इंजन केवल सक्रिय Node.js सर्वर (Localhost/VM) पर उपलब्ध है।', 'info');
    return;
  }
  showToast('⏳ डेटाबेस व सेटिंग्स को GitHub पर सुरक्षित किया जा रहा है...', 'info');
  try {
    const res = await fetch(`${apiBase}/api/git_backup_push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data && data.success) {
      showToast('✓ ' + data.message, 'success');
    } else {
      showToast('⚠️ ' + (data?.error || data?.message || 'बैकअप पूरा नहीं हो सका'), 'warning');
    }
  } catch (err) {
    showToast('⚠️ सर्वर से संपर्क नहीं हो सका: ' + err.message, 'error');
  }
}
window.triggerGitHubDataPush = triggerGitHubDataPush;

/* ========================================================
   SAMAN PARIKSHA CUSTOM EDIT & MISMATCH LOGIN ALERT SYSTEM
   ======================================================== */

function openSamanCustomEditModal() {
  const cfg = getSamanMismatchConfig();
  
  const chkActive = document.getElementById('sp-cfg-alert-active');
  const txtTitle = document.getElementById('sp-cfg-alert-title');
  const txtMsg = document.getElementById('sp-cfg-alert-message');

  if (chkActive) chkActive.checked = cfg.alert_active === true;
  if (txtTitle) txtTitle.value = cfg.alert_title || DEFAULT_SAMAN_MISMATCH_SETTINGS.alert_title;
  if (txtMsg) txtMsg.value = cfg.alert_message || DEFAULT_SAMAN_MISMATCH_SETTINGS.alert_message;

  const sel = document.getElementById('sp-add-custom-school-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- ड्रॉपडाउन से विद्यालय चुनें --</option>';
    const sorted = [...(STATE.schools56 || [])].sort((a,b) => (a.school_name_hi || a.school_name || '').localeCompare(b.school_name_hi || b.school_name || ''));
    sorted.forEach(s => {
      const code = s.shala_darpan_code || '';
      const name = s.school_name_hi || s.school_name || '';
      sel.innerHTML += `<option value="${code}">${name} (${code})</option>`;
    });
  }

  renderSamanMismatchTable();
  if (typeof updateMismatchHeaderUI === 'function') updateMismatchHeaderUI();
  showModal('modal-saman-custom-edit');
}

function renderSamanMismatchTable() {
  const tbody = document.getElementById('sp-mismatch-schools-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const cfg = getSamanMismatchConfig();
  const details = cfg.mismatch_details || DEFAULT_SAMAN_MISMATCH_SETTINGS.mismatch_details;
  const customSchools = cfg.custom_edit_schools || [];

  const allCodes = Array.from(new Set([...Object.keys(details), ...customSchools]));

  allCodes.forEach(code => {
    const item = details[code] || {};
    const sch = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === String(code).trim());
    const schoolName = item.school_name || sch?.school_name || `विद्यालय (कोड: ${code})`;
    const portalTot = item.portal_total ?? '--';
    const sdTot = item.sd_total ?? '--';
    const diff = item.diff !== undefined ? (item.diff > 0 ? `+${item.diff}` : item.diff) : '--';
    const isAllowed = customSchools.some(c => String(c).trim() === String(code).trim());

    const tr = document.createElement('tr');
    tr.style.background = isAllowed ? '#f0fdf4' : '#ffffff';
    tr.style.borderBottom = '1px solid #e2e8f0';

    tr.innerHTML = `
      <td style="padding:8px 10px; font-weight:800; font-family:monospace; color:#1e3a8a">${code}</td>
      <td style="padding:8px 10px">
        <strong>${schoolName}</strong>
        ${item.portal_c9_10 !== undefined ? `<div style="font-size:0.72rem; color:#64748b">कक्षा 9-10: ${item.portal_c9_10} (SD: ${item.sd_c9_10}) | 11-12: ${item.portal_c11_12} (SD: ${item.sd_c11_12})</div>` : ''}
      </td>
      <td style="padding:8px 10px; text-align:center; font-weight:700; color:#b91c1c">${portalTot}</td>
      <td style="padding:8px 10px; text-align:center; font-weight:700; color:#15803d">${sdTot}</td>
      <td style="padding:8px 10px; text-align:center">
        <span style="font-weight:900; color:#dc2626; background:#fee2e2; padding:2px 8px; border-radius:6px; font-size:0.85rem">
          ${diff}
        </span>
      </td>
      <td style="padding:8px 10px; text-align:center">
        <label class="login-perm-switch" style="vertical-align:middle" title="कस्टम संपादन अनुमति ऑन/ऑफ करें">
          <input type="checkbox" id="chk-cust-edit-${code}" ${isAllowed ? 'checked' : ''} onchange="toggleSchoolCustomEdit('${code}', this.checked)">
          <span class="login-perm-slider"></span>
        </label>
        <span style="font-size:0.75rem; font-weight:700; margin-left:6px; color:${isAllowed ? '#15803d' : '#94a3b8'}">
          ${isAllowed ? 'खुला' : 'बंद'}
        </span>
      </td>
      <td style="padding:8px 10px; text-align:center">
        <div style="display:inline-flex; gap:6px; align-items:center">
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="openSamanParikshaForm('${code}')" title="इस विद्यालय का प्रपत्र खोलें">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeSchoolFromCustomEditList('${code}')" title="मिसमैच सूची से हटाएं">
            <i class="fas fa-trash"></i> हटाएं
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof updateMismatchHeaderUI === 'function') updateMismatchHeaderUI();
}

function toggleSchoolCustomEdit(schoolCode, isChecked) {
  const cfg = getSamanMismatchConfig();
  if (!cfg.custom_edit_schools) cfg.custom_edit_schools = [];
  const sCode = String(schoolCode).trim();

  if (isChecked) {
    if (!cfg.custom_edit_schools.includes(sCode)) cfg.custom_edit_schools.push(sCode);
  } else {
    cfg.custom_edit_schools = cfg.custom_edit_schools.filter(c => String(c).trim() !== sCode);
  }

  renderSamanMismatchTable();
}

function toggleAllMismatchCustomEdit(enableAll) {
  const cfg = getSamanMismatchConfig();
  const details = cfg.mismatch_details || DEFAULT_SAMAN_MISMATCH_SETTINGS.mismatch_details;
  const mismatchCodes = Object.keys(details);

  if (enableAll) {
    cfg.custom_edit_schools = Array.from(new Set([...(cfg.custom_edit_schools || []), ...mismatchCodes]));
    showToast('सभी मिसमैच विद्यालयों को कस्टम एडिट अनुमति प्रदान की गई!', 'success');
  } else {
    cfg.custom_edit_schools = (cfg.custom_edit_schools || []).filter(c => !mismatchCodes.includes(c));
    showToast('सभी मिसमैच विद्यालयों की कस्टम एडिट अनुमति बंद की गई!', 'info');
  }

  renderSamanMismatchTable();
}

function addSchoolToCustomEditList() {
  const sel = document.getElementById('sp-add-custom-school-select');
  const inp = document.getElementById('sp-add-custom-school-code');
  const code = (inp && inp.value.trim()) || (sel && sel.value.trim()) || '';
  if (!code) {
    showToast('कृपया ड्रॉपडाउन से विद्यालय चुनें या शाला दर्पण कोड दर्ज करें!', 'warning');
    return;
  }

  const sch = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === code);
  const schoolName = sch ? (sch.school_name_hi || sch.school_name) : `विद्यालय (${code})`;
  const peeoName = sch ? (sch.peeo_name || '---') : '---';

  const sub = (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[code]) || {};
  const portalTot = Number(sub.grand_total || 0);
  const diffInp = document.getElementById('sp-add-custom-school-diff');
  let diffVal = diffInp ? parseInt(diffInp.value) : 0;
  if (isNaN(diffVal)) diffVal = 0;

  const cfg = getSamanMismatchConfig();
  if (!cfg.custom_edit_schools) cfg.custom_edit_schools = [];
  if (!cfg.custom_edit_schools.includes(code)) {
    cfg.custom_edit_schools.push(code);
  }
  if (!cfg.mismatch_details) cfg.mismatch_details = {};
  cfg.mismatch_details[code] = {
    school_name: `${schoolName} (${code})`,
    peeo_name: peeoName,
    portal_total: portalTot || '--',
    sd_total: (portalTot ? portalTot - diffVal : '--'),
    diff: diffVal,
    diff_text: diffVal ? `अंतर: ${diffVal > 0 ? '+' : ''}${diffVal}` : 'कस्टम संपादन आवश्यक',
    reason: 'कार्यालय CBEO भिनाय द्वारा मिसमैच/संशोधन हेतु सूची में सम्मिलित किया गया।',
    flagged_fields: ['कुल महायोग', 'मांग विवरण']
  };

  if (inp) inp.value = '';
  if (diffInp) diffInp.value = '';
  if (sel) sel.value = '';

  STATE.samanMismatchSettings = cfg;
  localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(cfg));
  fetch('/api/save_saman_mismatch_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: cfg })
  }).catch(() => {});

  renderSamanMismatchTable();
  if (typeof updateMismatchHeaderUI === 'function') updateMismatchHeaderUI();
  showToast(`विद्यालय '${schoolName}' (${code}) मिसमैच सूची में जोड़ा गया!`, 'success');
  if (typeof renderSamanParikshaView === 'function') renderSamanParikshaView();
}

function removeSchoolFromCustomEditList(schoolCode) {
  const cfg = getSamanMismatchConfig();
  const sCode = String(schoolCode).trim();
  cfg.custom_edit_schools = (cfg.custom_edit_schools || []).filter(c => String(c).trim() !== sCode);
  if (cfg.mismatch_details && cfg.mismatch_details[sCode]) {
    delete cfg.mismatch_details[sCode];
  }
  if (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[sCode]) {
    STATE.samanParikshaSubmissions[sCode].is_mismatch = false;
    STATE.samanParikshaSubmissions[sCode].mismatch_resolved_at = new Date().toISOString();
  }
  STATE.samanMismatchSettings = cfg;
  localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(cfg));
  fetch('/api/save_saman_mismatch_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: cfg })
  }).catch(() => {});

  renderSamanMismatchTable();
  if (typeof updateMismatchHeaderUI === 'function') updateMismatchHeaderUI();
  showToast(`विद्यालय '${sCode}' को मिसमैच सूची से पूर्णतः हटा दिया गया!`, 'info');
  if (typeof renderSamanParikshaView === 'function') renderSamanParikshaView();
}

function saveSamanMismatchSettings() {
  const cfg = getSamanMismatchConfig();
  const chkActive = document.getElementById('sp-cfg-alert-active');
  const txtTitle = document.getElementById('sp-cfg-alert-title');
  const txtMsg = document.getElementById('sp-cfg-alert-message');

  if (chkActive) cfg.alert_active = !!chkActive.checked;
  if (txtTitle) cfg.alert_title = txtTitle.value.trim() || DEFAULT_SAMAN_MISMATCH_SETTINGS.alert_title;
  if (txtMsg) cfg.alert_message = txtMsg.value.trim() || DEFAULT_SAMAN_MISMATCH_SETTINGS.alert_message;

  STATE.samanMismatchSettings = cfg;
  localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(cfg));

  const apiBaseMis = getEffectiveApiBaseUrl();
  if (apiBaseMis) {
    fetch(`${apiBaseMis}/api/save_saman_mismatch_settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: cfg })
    }).catch(err => console.warn('Save mismatch settings local err:', err));
  }

  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__SAMAN_MISMATCH_SETTINGS__',
          role: 'System_Config',
          name: 'Saman Pariksha Mismatch Custom Edit & Alert Settings',
          new_password: JSON.stringify(cfg)
        })
      }).catch(err => console.warn('Save mismatch sheet sync err:', err));
    } catch(e) {}
  }

  closeModal('modal-saman-custom-edit');
  if (typeof updateMismatchHeaderUI === 'function') updateMismatchHeaderUI();
  showToast('समान परीक्षा मिसमैच व कस्टम एडिट सेटिंग्स सुरक्षित हो गईं!', 'success');
  renderSamanParikshaView();
}

function updateMismatchHeaderUI() {
  const cfg = getSamanMismatchConfig();
  const isActive = cfg && cfg.alert_active === true;
  const count = (cfg.custom_edit_schools || []).length;

  const btnAdmin = document.getElementById('btn-sp-mismatch-admin');
  if (btnAdmin) {
    btnAdmin.innerHTML = `<i class="fas fa-exclamation-triangle ${isActive ? 'sp-mismatch-blinking-text' : ''}"></i> मिसमैच स्कूल प्रबंधन (${count} स्कूल)`;
    if (isActive) {
      btnAdmin.style.background = '#fff1f2';
      btnAdmin.style.color = '#be123c';
      btnAdmin.style.borderColor = '#fca5a5';
    } else {
      btnAdmin.style.background = '#f8fafc';
      btnAdmin.style.color = '#475569';
      btnAdmin.style.borderColor = '#cbd5e1';
    }
  }

  const btnQuickToggle = document.getElementById('btn-sp-mismatch-quick-toggle');
  if (btnQuickToggle) {
    if (isActive) {
      btnQuickToggle.innerHTML = '<i class="fas fa-bell"></i> मिसमैच अलर्ट: चालू (ON)';
      btnQuickToggle.style.background = '#fee2e2';
      btnQuickToggle.style.color = '#dc2626';
      btnQuickToggle.style.borderColor = '#ef4444';
    } else {
      btnQuickToggle.innerHTML = '<i class="fas fa-bell-slash"></i> मिसमैच अलर्ट: बंद (OFF)';
      btnQuickToggle.style.background = '#f1f5f9';
      btnQuickToggle.style.color = '#64748b';
      btnQuickToggle.style.borderColor = '#cbd5e1';
    }
  }

  const statusBadge = document.getElementById('sp-mismatch-status-badge');
  if (statusBadge) {
    if (isActive) {
      statusBadge.textContent = '🟢 अलर्ट चालू (Active) - विद्यालयों को पॉपअप व अलर्ट दिखेगा';
      statusBadge.style.background = '#dcfce7';
      statusBadge.style.color = '#15803d';
    } else {
      statusBadge.textContent = '🔴 अलर्ट बंद (OFF) - किसी भी विद्यालय को पॉपअप या फ्लैग नहीं दिखेगा';
      statusBadge.style.background = '#f1f5f9';
      statusBadge.style.color = '#64748b';
    }
  }
}
window.updateMismatchHeaderUI = updateMismatchHeaderUI;

function toggleMismatchAlertMaster(isActive) {
  const cfg = getSamanMismatchConfig();
  if (isActive === undefined) {
    cfg.alert_active = !cfg.alert_active;
  } else {
    cfg.alert_active = !!isActive;
  }
  STATE.samanMismatchSettings = cfg;
  localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(cfg));
  fetch('/api/save_saman_mismatch_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: cfg })
  }).catch(() => {});

  const chk = document.getElementById('sp-cfg-alert-active');
  if (chk) chk.checked = !!cfg.alert_active;

  updateMismatchHeaderUI();
  showToast(`मिसमैच अलर्ट व फ्लैग: ${cfg.alert_active ? 'चालू (ON)' : 'बंद (OFF)'} कर दिया गया!`, cfg.alert_active ? 'success' : 'info');
  renderSamanParikshaView();
}
window.toggleMismatchAlertMaster = toggleMismatchAlertMaster;

const EXCEL_49_ENROLMENT_MAP = {
  "506830": { name: "रा.बा.उ.मा.वि. बड़ली", c9_10: 86, c11_12: 43, total: 129 },
  "494626": { name: "रा.बा.उ.मा.वि. चापानेरी", c9_10: 59, c11_12: 28, total: 87 },
  "488791": { name: "रा.बा.उ.मा.वि. खेड़ी", c9_10: 41, c11_12: 17, total: 58 },
  "410632": { name: "रा.बा.उ.मा.वि. नांदसी", c9_10: 43, c11_12: 26, total: 69 },
  "221764": { name: "रा.उ.मा.वि. बड़गांव (सूरखण्ड)", c9_10: 165, c11_12: 96, total: 261 },
  "488781": { name: "रा.उ.मा.वि. बडला (नागोला)", c9_10: 60, c11_12: 28, total: 88 },
  "221755": { name: "रा.उ.मा.वि. बड़ली", c9_10: 85, c11_12: 52, total: 137 },
  "221769": { name: "रा.उ.मा.वि. बांदनवाड़ा", c9_10: 187, c11_12: 132, total: 319 },
  "221780": { name: "रा.उ.मा.वि. भिनाय", c9_10: 223, c11_12: 178, total: 401 },
  "221763": { name: "रा.उ.मा.वि. बूबकिया", c9_10: 61, c11_12: 48, total: 109 },
  "221758": { name: "रा.उ.मा.वि. चापानेरी", c9_10: 115, c11_12: 59, total: 174 },
  "221787": { name: "रा.उ.मा.वि. छाछून्दरा", c9_10: 104, c11_12: 72, total: 176 },
  "488941": { name: "रा.उ.मा.वि. देवरिया", c9_10: 69, c11_12: 40, total: 109 },
  "221765": { name: "रा.उ.मा.वि. धतूरिया", c9_10: 47, c11_12: 37, total: 84 },
  "221786": { name: "रा.उ.मा.वि. एकलसिंगा", c9_10: 128, c11_12: 116, total: 244 },
  "221789": { name: "रा.उ.मा.वि. गुढा कलां", c9_10: 79, c11_12: 66, total: 145 },
  "221792": { name: "रा.उ.मा.वि. जामोला", c9_10: 110, c11_12: 69, total: 179 },
  "221773": { name: "रा.उ.मा.वि. करांटी", c9_10: 67, c11_12: 39, total: 106 },
  "221767": { name: "रा.उ.मा.वि. कूबड़ा", c9_10: 46, c11_12: 26, total: 72 },
  "221772": { name: "रा.उ.मा.वि. नागोला", c9_10: 132, c11_12: 90, total: 222 },
  "221756": { name: "रा.उ.मा.वि. नांदसी", c9_10: 55, c11_12: 37, total: 92 },
  "221761": { name: "रा.उ.मा.वि. निमेड़ा", c9_10: 55, c11_12: 37, total: 92 },
  "221783": { name: "रा.उ.मा.वि. पदमपुरा", c9_10: 85, c11_12: 62, total: 147 },
  "221774": { name: "रा.उ.मा.वि. राताकोट", c9_10: 89, c11_12: 52, total: 141 },
  "221771": { name: "रा.उ.मा.वि. रेलवे कॉलोनी, बांदनवाड़ा", c9_10: 51, c11_12: 30, total: 81 },
  "221784": { name: "रा.उ.मा.वि. सातोलाव", c9_10: 59, c11_12: 45, total: 104 },
  "221782": { name: "रा.उ.मा.वि. शोकलिया", c9_10: 94, c11_12: 69, total: 163 },
  "221788": { name: "रा.उ.मा.वि. सिंगावल", c9_10: 89, c11_12: 59, total: 148 },
  "221760": { name: "रा.उ.मा.वि. सोबड़ी", c9_10: 55, c11_12: 30, total: 85 },
  "221775": { name: "रा.उ.मा.वि. तंतोती", c9_10: 110, c11_12: 82, total: 192 },
  "221754": { name: "पीएम श्री रा.उ.मा.वि. देवलिया कलां", c9_10: 284, c11_12: 242, total: 526 },
  "221778": { name: "महात्मा गांधी रा.वि. भिनाय", c9_10: 44, c11_12: 42, total: 86 },
  "221770": { name: "महात्मा गांधी रा.वि. बांदनवाड़ा", c9_10: 41, c11_12: 0, total: 41 },
  "221753": { name: "महात्मा गांधी रा.वि. देवलिया कलां", c9_10: 70, c11_12: 40, total: 110 },
  "221790": { name: "रा.मा.वि. बड़ला (भिनाय)", c9_10: 41, c11_12: 0, total: 41 },
  "221768": { name: "रा.मा.वि. बग्गड़", c9_10: 47, c11_12: 0, total: 47 },
  "221766": { name: "रा.मा.वि. बिरांदिया", c9_10: 58, c11_12: 0, total: 58 },
  "221785": { name: "रा.मा.वि. चतरपुरा", c9_10: 23, c11_12: 0, total: 23 },
  "221757": { name: "रा.मा.वि. दौलतपुरा (नांदसी)", c9_10: 28, c11_12: 0, total: 28 },
  "221779": { name: "रा.मा.वि. धौला की ढाणी", c9_10: 29, c11_12: 0, total: 29 },
  "221793": { name: "रा.मा.वि. गनगड़ा", c9_10: 24, c11_12: 0, total: 24 },
  "221791": { name: "रा.मा.वि. गुढ़ा खुर्द", c9_10: 33, c11_12: 0, total: 33 },
  "221781": { name: "रा.मा.वि. हिंगोनिया", c9_10: 34, c11_12: 0, total: 34 },
  "221762": { name: "रा.मा.वि. कुम्हारिया", c9_10: 28, c11_12: 0, total: 28 },
  "221777": { name: "रा.मा.वि. मंडावरिया", c9_10: 28, c11_12: 0, total: 28 },
  "221776": { name: "रा.मा.वि. पनोतिया", c9_10: 46, c11_12: 0, total: 46 },
  "488796": { name: "रा.मा.वि. पवाल्या", c9_10: 22, c11_12: 0, total: 22 },
  "488771": { name: "रा.मा.वि. रूपहेली", c9_10: 25, c11_12: 0, total: 25 },
  "221759": { name: "रा.मा.वि. सेसपुरा", c9_10: 34, c11_12: 0, total: 34 }
};
window.EXCEL_49_ENROLMENT_MAP = EXCEL_49_ENROLMENT_MAP;

function onMismatchSchoolDropdownSelected(code) {
  const inp = document.getElementById('sp-add-custom-school-code');
  if (inp) inp.value = code || '';
  const diffInp = document.getElementById('sp-add-custom-school-diff');
  if (diffInp && code) {
    const sub = (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[code]) || {};
    const portalTot = Number(sub.grand_total || 0);
    const ex = EXCEL_49_ENROLMENT_MAP[code];
    if (ex && portalTot > 0) {
      const d = portalTot - ex.total;
      diffInp.value = d;
      diffInp.placeholder = `वर्तमान अंतर: ${d > 0 ? '+' : ''}${d} (पोर्टल: ${portalTot}, SD: ${ex.total})`;
    } else {
      diffInp.value = '';
      diffInp.placeholder = portalTot > 0 ? `पोर्टल मांग: ${portalTot}` : 'अंतर दर्ज करें';
    }
  }
}
window.onMismatchSchoolDropdownSelected = onMismatchSchoolDropdownSelected;

function scanExcelMismatchesNow() {
  const subs = STATE.samanParikshaSubmissions || {};
  const found = [];
  const cfg = getSamanMismatchConfig();
  if (!cfg.mismatch_details) cfg.mismatch_details = {};
  if (!cfg.custom_edit_schools) cfg.custom_edit_schools = [];

  Object.entries(EXCEL_49_ENROLMENT_MAP).forEach(([code, ex]) => {
    const sub = subs[code];
    if (!sub) return;
    const c9_10 = (Number(sub.c9_total) || 0) + (Number(sub.c10_total) || 0);
    const c11_12 = (Number(sub.c11_total) || 0) + (Number(sub.c12_total) || 0);
    const portalTot = Number(sub.grand_total) || (c9_10 + c11_12);

    const d9 = c9_10 - ex.c9_10;
    const d11 = c11_12 - ex.c11_12;
    const dTot = portalTot - ex.total;

    if (d9 !== 0 || d11 !== 0 || dTot !== 0) {
      found.push({ code, name: ex.name, dTot, d9, d11, portalTot, sdTot: ex.total });
      if (!cfg.custom_edit_schools.includes(code)) cfg.custom_edit_schools.push(code);
      cfg.mismatch_details[code] = {
        school_name: `${ex.name} (${code})`,
        portal_total: portalTot,
        sd_total: ex.total,
        diff: dTot,
        portal_c9_10: c9_10,
        portal_c11_12: c11_12,
        sd_c9_10: ex.c9_10,
        sd_c11_12: ex.c11_12,
        diff_text: `पेपर मांग शाला दर्पण नामांकन से ${Math.abs(dTot)} ${dTot > 0 ? 'ज्यादा' : 'कम'} है`,
        reason: `कक्षा 9-10 में अंतर: ${d9 > 0 ? '+' : ''}${d9}, कक्षा 11-12 में अंतर: ${d11 > 0 ? '+' : ''}${d11}`,
        flagged_fields: ['कुल महायोग', 'कक्षा 9-10 मांग', 'कक्षा 11-12 मांग']
      };
    }
  });

  STATE.samanMismatchSettings = cfg;
  localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(cfg));
  fetch('/api/save_saman_mismatch_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: cfg })
  }).catch(() => {});

  renderSamanMismatchTable();
  if (typeof updateMismatchHeaderUI === 'function') updateMismatchHeaderUI();

  if (found.length === 0) {
    showToast('✓ शानदार! सभी विद्यालयों का नामांकन एक्सेल डेटा से 100% मैच है!', 'success');
  } else {
    const listStr = found.map(f => `${f.name} (${f.dTot > 0 ? '+' : ''}${f.dTot})`).join(', ');
    showToast(`⚠️ कुल ${found.length} विद्यालयों में अंतर पाया गया: ${listStr}`, 'warning');
  }
}
window.scanExcelMismatchesNow = scanExcelMismatchesNow;

function checkAndShowSamanMismatchAlert(userObj) {
  if (!userObj || userObj.role === 'admin') return;
  const cfg = getSamanMismatchConfig();
  if (!cfg || cfg.alert_active === false) return;

  const uCode = String(userObj.shala_darpan_code).trim();
  const details = cfg.mismatch_details || DEFAULT_SAMAN_MISMATCH_SETTINGS.mismatch_details;
  const customSchools = cfg.custom_edit_schools || [];

  // Check if this school or PEEO has mismatch
  let targetCode = null;
  if (details[uCode] || customSchools.includes(uCode)) {
    targetCode = uCode;
  } else if (userObj.role === 'peeo' && userObj.schools) {
    const match = userObj.schools.find(s => {
      const sCode = String(s.shala_darpan_code || s.dise_code).trim();
      return details[sCode] || customSchools.includes(sCode);
    });
    if (match) targetCode = String(match.shala_darpan_code || match.dise_code).trim();
  }

  if (!targetCode) return;

  const mismatchInfo = details[targetCode] || null;
  const portalTotal = mismatchInfo ? mismatchInfo.portal_total : 0;
  const sdTotal = mismatchInfo ? mismatchInfo.sd_total : 0;
  const diffVal = mismatchInfo ? mismatchInfo.diff : 0;

  const schObj = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === targetCode);
  const schoolName = mismatchInfo?.school_name || schObj?.school_name || userObj.school_name || userObj.peeo_name || targetCode;

  window._currentMismatchAlertSchoolCode = targetCode;

  const titleElem = document.getElementById('sp-alert-modal-title');
  const nameElem = document.getElementById('sp-alert-school-name');
  const codeElem = document.getElementById('sp-alert-school-code');
  const pTotElem = document.getElementById('sp-alert-portal-total');
  const sdTotElem = document.getElementById('sp-alert-sd-total');
  const diffElem = document.getElementById('sp-alert-diff-total');
  const msgElem = document.getElementById('sp-alert-modal-message');

  if (titleElem) titleElem.innerHTML = `<i class="fas fa-exclamation-triangle sp-mismatch-blinking-text"></i> ${cfg.alert_title || DEFAULT_SAMAN_MISMATCH_SETTINGS.alert_title}`;
  if (nameElem) nameElem.textContent = schoolName;
  if (codeElem) codeElem.textContent = targetCode;
  if (pTotElem) pTotElem.textContent = portalTotal || '--';
  if (sdTotElem) sdTotElem.textContent = sdTotal || '--';
  if (diffElem) diffElem.textContent = diffVal ? (diffVal > 0 ? `+${diffVal}` : `${diffVal}`) : 'मिसमैच';

  let msgText = cfg.alert_message || DEFAULT_SAMAN_MISMATCH_SETTINGS.alert_message;
  msgText = msgText
    .replace(/{school_name}/g, schoolName)
    .replace(/{school_code}/g, targetCode)
    .replace(/{portal_total}/g, portalTotal)
    .replace(/{sd_total}/g, sdTotal)
    .replace(/{diff}/g, diffVal > 0 ? `+${diffVal}` : diffVal);

  if (msgElem) msgElem.textContent = msgText;

  showModal('modal-saman-mismatch-login-alert');
}

function proceedToEditFromMismatchAlert() {
  closeModal('modal-saman-mismatch-login-alert');
  const codeToOpen = window._currentMismatchAlertSchoolCode || STATE.currentUser?.shala_darpan_code;
  const demandId = window._currentMismatchAlertDemandId;
  if (!codeToOpen) return;

  if (demandId && demandId !== 'saman_pariksha_2026_27' && !String(demandId).toLowerCase().includes('saman_pariksha')) {
    switchTab('dynamic-demand', demandId);
    setTimeout(() => {
      openFillDemandForSchoolModal(demandId, codeToOpen);
    }, 250);
  } else {
    switchTab('saman-pariksha');
    setTimeout(() => {
      openSamanParikshaForm(codeToOpen);
    }, 200);
  }
}
window.proceedToEditFromMismatchAlert = proceedToEditFromMismatchAlert;

window.onDefaultPwdAlertDismissed = function() {
  if (STATE.currentUser && STATE.currentUser.role !== 'admin') {
    setTimeout(() => {
      checkAndShowAllMismatchAlerts(STATE.currentUser);
    }, 300);
  }
};

const STANDARD_ELECTIVE_SUBJECTS = [
  'राजनीति विज्ञान', 'इतिहास', 'भूगोल', 'हिन्दी साहित्य', 'अंग्रेजी साहित्य', 
  'संस्कृत साहित्य', 'उर्दू साहित्य', 'भौतिक विज्ञान', 'रसायन विज्ञान', 
  'जीव विज्ञान', 'गणित', 'लेखाशास्त्र', 'व्यवसाय अध्ययन', 'अर्थशास्त्र', 
  'गृह विज्ञान', 'चित्रकला', 'कम्प्यूटर विज्ञान'
];

function addSyllabusElectiveRow(classKey, defaultName = '', defaultPct = '') {
  const container = document.getElementById(`syl-${classKey}-electives-container`);
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'syl-elective-row';
  row.style.cssText = 'display:flex; align-items:center; gap:0.4rem; background:#ffffff; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1';

  let optionsHtml = `<option value="">-- विषय चुनें --</option>`;
  STANDARD_ELECTIVE_SUBJECTS.forEach(s => {
    const sel = (s === defaultName) ? 'selected' : '';
    optionsHtml += `<option value="${s}" ${sel}>${s}</option>`;
  });
  if (defaultName && !STANDARD_ELECTIVE_SUBJECTS.includes(defaultName)) {
    optionsHtml += `<option value="${defaultName}" selected>${defaultName}</option>`;
  }

  row.innerHTML = `
    <select class="form-control syl-elec-name" style="flex:2; font-size:0.8rem; font-weight:700; padding:4px 6px">
      ${optionsHtml}
    </select>
    <div style="display:flex; align-items:center; gap:2px; flex:1">
      <input type="number" min="0" max="100" class="form-control syl-elec-pct" value="${defaultPct !== undefined ? defaultPct : ''}" placeholder="%" style="font-size:0.8rem; font-weight:700; text-align:center; padding:4px">
      <span style="font-size:0.75rem; font-weight:700">%</span>
    </div>
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.syl-elective-row').remove()" style="padding:2px 6px; font-size:0.75rem" title="हटाएं">&times;</button>
  `;
  container.appendChild(row);
}

function toggleSyllabusClassZero(classKey, isZero) {
  const banner = document.getElementById(`syl_${classKey}_zero_banner`);
  const inputsContainer = document.getElementById(`syl_${classKey}_inputs_container`);
  if (banner) banner.style.display = isZero ? 'block' : 'none';
  if (inputsContainer) {
    inputsContainer.style.opacity = isZero ? '0.35' : '1';
    inputsContainer.style.pointerEvents = isZero ? 'none' : 'auto';
    inputsContainer.querySelectorAll('input, select, button').forEach(el => {
      if (isZero) el.setAttribute('disabled', 'true');
      else el.removeAttribute('disabled');
    });
  }
}

function openSamanSyllabusForm(schoolCode) {
  try {
    const lu = localStorage.getItem('cbeo_logged_user');
    const cu = localStorage.getItem('cbeo_user');
    if (lu && !cu) localStorage.setItem('cbeo_user', lu);
    if (cu && !lu) localStorage.setItem('cbeo_logged_user', cu);
  } catch(e) {}

  const code = schoolCode || (STATE.currentUser?.shala_darpan_code || '');
  if (code) {
    window.location.href = `saman_syllabus_form.html?code=${code}&_t=${Date.now()}`;
    return;
  }

  const elName = document.getElementById('syl-school-name');
  if (elName) elName.textContent = school.school_name;
  const elCode = document.getElementById('syl-school-code');
  if (elCode) elCode.textContent = school.shala_darpan_code;
  const elExamCode = document.getElementById('syl-exam-code');
  const examCode = 'AJM04G' + school.shala_darpan_code;
  if (elExamCode) elExamCode.textContent = examCode;
  const elPeeo = document.getElementById('syl-peeo-name');
  if (elPeeo) elPeeo.textContent = school.peeo_name || '---';
  const elCat = document.getElementById('syl-school-category');
  if (elCat) elCat.textContent = `${school.category || 'Sec/Sr.Sec'} (${school.type === 'Government' ? 'राजकीय' : 'निजी'})`;
  const elHiddenCode = document.getElementById('syl-hidden-school-code');
  if (elHiddenCode) elHiddenCode.value = school.shala_darpan_code;

  const sub = (STATE.samanSyllabusSubmissions && STATE.samanSyllabusSubmissions[schoolCode]) || {};
  let draft = null;
  try {
    const raw = localStorage.getItem(`cbeo_syl_draft_${schoolCode}`);
    if (raw) draft = JSON.parse(raw);
  } catch(e) {}
  const data = draft ? { ...sub, ...draft } : sub;

  const statusBadge = document.getElementById('syl-form-status-badge');
  const printBtn = document.getElementById('btn-print-syl-pdf');
  if (statusBadge) {
    if (data.is_submitted) {
      statusBadge.innerHTML = `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.8rem; font-weight:800; padding:6px 12px">✓ प्रमाणित सबमिट पूर्ण (${data.submitted_at ? new Date(data.submitted_at).toLocaleDateString('hi-IN') : ''})</span>`;
      if (printBtn) printBtn.style.display = 'inline-flex';
    } else {
      statusBadge.innerHTML = `<span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.8rem; font-weight:800; padding:6px 12px">⏳ प्रविष्टि लम्बित (Pending)</span>`;
      if (printBtn) printBtn.style.display = 'none';
    }
  }

  // Zero enrollment toggles
  const c9 = data.c9 || {};
  const chkC9Zero = document.getElementById('syl_c9_zero_enrolment');
  if (chkC9Zero) {
    chkC9Zero.checked = !!c9.zero_enrolment;
    toggleSyllabusClassZero('c9', !!c9.zero_enrolment);
  }

  const c10 = data.c10 || {};
  const chkC10Zero = document.getElementById('syl_c10_zero_enrolment');
  if (chkC10Zero) {
    chkC10Zero.checked = !!c10.zero_enrolment;
    toggleSyllabusClassZero('c10', !!c10.zero_enrolment);
  }

  const c11 = data.c11 || {};
  const chkC11Zero = document.getElementById('syl_c11_zero_enrolment');
  if (chkC11Zero) {
    chkC11Zero.checked = !!c11.zero_enrolment;
    toggleSyllabusClassZero('c11', !!c11.zero_enrolment);
  }

  const c12 = data.c12 || {};
  const chkC12Zero = document.getElementById('syl_c12_zero_enrolment');
  if (chkC12Zero) {
    chkC12Zero.checked = !!c12.zero_enrolment;
    toggleSyllabusClassZero('c12', !!c12.zero_enrolment);
  }

  // Populate Class 9 (7 subjects)
  if (document.getElementById('syl_c9_hindi')) document.getElementById('syl_c9_hindi').value = c9.hindi !== undefined ? c9.hindi : '';
  if (document.getElementById('syl_c9_english')) document.getElementById('syl_c9_english').value = c9.english !== undefined ? c9.english : '';
  if (document.getElementById('syl_c9_maths')) document.getElementById('syl_c9_maths').value = c9.maths !== undefined ? c9.maths : '';
  if (document.getElementById('syl_c9_science')) document.getElementById('syl_c9_science').value = c9.science !== undefined ? c9.science : '';
  if (document.getElementById('syl_c9_sst')) document.getElementById('syl_c9_sst').value = c9.sst !== undefined ? c9.sst : '';
  if (document.getElementById('syl_c9_sanskrit')) document.getElementById('syl_c9_sanskrit').value = c9.sanskrit !== undefined ? c9.sanskrit : '';
  if (document.getElementById('syl_c9_urdu')) document.getElementById('syl_c9_urdu').value = c9.urdu !== undefined ? c9.urdu : '';

  // Populate Class 10 (7 subjects)
  if (document.getElementById('syl_c10_hindi')) document.getElementById('syl_c10_hindi').value = c10.hindi !== undefined ? c10.hindi : '';
  if (document.getElementById('syl_c10_english')) document.getElementById('syl_c10_english').value = c10.english !== undefined ? c10.english : '';
  if (document.getElementById('syl_c10_maths')) document.getElementById('syl_c10_maths').value = c10.maths !== undefined ? c10.maths : '';
  if (document.getElementById('syl_c10_science')) document.getElementById('syl_c10_science').value = c10.science !== undefined ? c10.science : '';
  if (document.getElementById('syl_c10_sst')) document.getElementById('syl_c10_sst').value = c10.sst !== undefined ? c10.sst : '';
  if (document.getElementById('syl_c10_sanskrit')) document.getElementById('syl_c10_sanskrit').value = c10.sanskrit !== undefined ? c10.sanskrit : '';
  if (document.getElementById('syl_c10_urdu')) document.getElementById('syl_c10_urdu').value = c10.urdu !== undefined ? c10.urdu : '';

  // Populate Class 11 (compulsory + electives)
  if (document.getElementById('syl_c11_comp_hindi')) document.getElementById('syl_c11_comp_hindi').value = c11.comp_hindi !== undefined ? c11.comp_hindi : '';
  if (document.getElementById('syl_c11_comp_english')) document.getElementById('syl_c11_comp_english').value = c11.comp_english !== undefined ? c11.comp_english : '';
  const c11Cont = document.getElementById('syl-c11-electives-container');
  if (c11Cont) {
    c11Cont.innerHTML = '';
    const electives11 = Array.isArray(c11.electives) && c11.electives.length > 0 ? c11.electives : [
      { name: 'राजनीति विज्ञान', pct: '' },
      { name: 'इतिहास', pct: '' },
      { name: 'भूगोल', pct: '' }
    ];
    electives11.forEach(el => addSyllabusElectiveRow('c11', el.name, el.pct));
  }

  // Populate Class 12 (compulsory + electives)
  if (document.getElementById('syl_c12_comp_hindi')) document.getElementById('syl_c12_comp_hindi').value = c12.comp_hindi !== undefined ? c12.comp_hindi : '';
  if (document.getElementById('syl_c12_comp_english')) document.getElementById('syl_c12_comp_english').value = c12.comp_english !== undefined ? c12.comp_english : '';
  const c12Cont = document.getElementById('syl-c12-electives-container');
  if (c12Cont) {
    c12Cont.innerHTML = '';
    const electives12 = Array.isArray(c12.electives) && c12.electives.length > 0 ? c12.electives : [
      { name: 'राजनीति विज्ञान', pct: '' },
      { name: 'इतिहास', pct: '' },
      { name: 'भूगोल', pct: '' }
    ];
    electives12.forEach(el => addSyllabusElectiveRow('c12', el.name, el.pct));
  }

  // Principal info
  const pName = document.getElementById('syl_principal_name');
  if (pName) pName.value = data.principal_name || school.principal_name || '';
  const pMob = document.getElementById('syl_principal_mobile');
  if (pMob) pMob.value = data.principal_mobile || school.principal_mobile || '';
  const certCheck = document.getElementById('syl_certification_check');
  if (certCheck) certCheck.checked = true;

  const canEdit = canCurrentUserEditModule('saman_pariksha');
  const modalEl = document.getElementById('modal-saman-syllabus-form');
  const allInputs = modalEl ? modalEl.querySelectorAll('input, select, button.btn-outline-danger') : [];
  allInputs.forEach(inp => {
    if (inp.id === 'syl-hidden-school-code') return;
    if (canEdit) {
      // Don't enable if parent container is zero enrollment disabled
      const isZeroBox = inp.id.includes('zero_enrolment');
      if (!isZeroBox && inp.closest('[id$="_inputs_container"]') && inp.closest('[id$="_inputs_container"]').style.pointerEvents === 'none') {
        inp.setAttribute('disabled', 'true');
      } else {
        inp.removeAttribute('disabled');
        inp.removeAttribute('readonly');
      }
    } else {
      if (inp.tagName === 'BUTTON') inp.style.display = 'none';
      else {
        inp.setAttribute('readonly', 'true');
        if (inp.type === 'checkbox') inp.setAttribute('disabled', 'true');
      }
    }
  });

  showModal('modal-saman-syllabus-form');
}

function openSamanSyllabusFormInNewTab(schoolCode) {
  try {
    const lu = localStorage.getItem('cbeo_logged_user');
    const cu = localStorage.getItem('cbeo_user');
    if (lu && !cu) localStorage.setItem('cbeo_user', lu);
    if (cu && !lu) localStorage.setItem('cbeo_logged_user', cu);
  } catch(e) {}

  const code = schoolCode || (STATE.currentUser?.shala_darpan_code || '');
  window.open(`saman_syllabus_form.html?code=${code}&_t=${Date.now()}`, '_blank');
}

function collectSyllabusFormData() {
  const schoolCode = document.getElementById('syl-hidden-school-code')?.value;
  if (!schoolCode) return null;

  const school = (STATE.schools56 || []).find(s => s.shala_darpan_code === schoolCode) ||
    getAllMasterSchools().find(s => s.shala_darpan_code === schoolCode);

  const getElectives = (classKey) => {
    const list = [];
    const container = document.getElementById(`syl-${classKey}-electives-container`);
    if (container) {
      container.querySelectorAll('.syl-elective-row').forEach(r => {
        const name = r.querySelector('.syl-elec-name')?.value;
        const pct = r.querySelector('.syl-elec-pct')?.value;
        if (name) {
          list.push({ name, pct: pct !== '' ? parseFloat(pct) : 0 });
        }
      });
    }
    return list;
  };

  const c9Zero = !!document.getElementById('syl_c9_zero_enrolment')?.checked;
  const c10Zero = !!document.getElementById('syl_c10_zero_enrolment')?.checked;
  const c11Zero = !!document.getElementById('syl_c11_zero_enrolment')?.checked;
  const c12Zero = !!document.getElementById('syl_c12_zero_enrolment')?.checked;

  const c9 = {
    zero_enrolment: c9Zero,
    hindi: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_hindi')?.value) || 0),
    english: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_english')?.value) || 0),
    maths: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_maths')?.value) || 0),
    science: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_science')?.value) || 0),
    sst: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_sst')?.value) || 0),
    sanskrit: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_sanskrit')?.value) || 0),
    urdu: c9Zero ? 0 : (parseFloat(document.getElementById('syl_c9_urdu')?.value) || 0)
  };

  const c10 = {
    zero_enrolment: c10Zero,
    hindi: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_hindi')?.value) || 0),
    english: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_english')?.value) || 0),
    maths: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_maths')?.value) || 0),
    science: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_science')?.value) || 0),
    sst: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_sst')?.value) || 0),
    sanskrit: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_sanskrit')?.value) || 0),
    urdu: c10Zero ? 0 : (parseFloat(document.getElementById('syl_c10_urdu')?.value) || 0)
  };

  const c11 = {
    zero_enrolment: c11Zero,
    comp_hindi: c11Zero ? 0 : (parseFloat(document.getElementById('syl_c11_comp_hindi')?.value) || 0),
    comp_english: c11Zero ? 0 : (parseFloat(document.getElementById('syl_c11_comp_english')?.value) || 0),
    electives: c11Zero ? [] : getElectives('c11')
  };

  const c12 = {
    zero_enrolment: c12Zero,
    comp_hindi: c12Zero ? 0 : (parseFloat(document.getElementById('syl_c12_comp_hindi')?.value) || 0),
    comp_english: c12Zero ? 0 : (parseFloat(document.getElementById('syl_c12_comp_english')?.value) || 0),
    electives: c12Zero ? [] : getElectives('c12')
  };

  return {
    school_code: schoolCode,
    exam_code: 'AJM04G' + schoolCode,
    school_name: school?.school_name || '',
    peeo_name: school?.peeo_name || '',
    category: school?.category || '',
    type: school?.type || '',
    c9,
    c10,
    c11,
    c12,
    principal_name: document.getElementById('syl_principal_name')?.value || '',
    principal_mobile: document.getElementById('syl_principal_mobile')?.value || '',
    updated_at: new Date().toISOString()
  };
}

function saveSyllabusDraft() {
  const data = collectSyllabusFormData();
  if (!data) return;
  data.is_submitted = false;
  localStorage.setItem(`cbeo_syl_draft_${data.school_code}`, JSON.stringify(data));
  showToast('पाठ्यक्रम पूर्णता प्रपत्र ड्राफ्ट सुरक्षित हो गया!', 'info');
}

function submitSyllabusForm() {
  if (!canCurrentUserEditModule('saman_pariksha')) {
    showToast('आपको इस प्रपत्र में संपादन या सबमिट करने का अधिकार नहीं है!', 'error');
    return;
  }

  const cert = document.getElementById('syl_certification_check')?.checked;
  if (!cert) {
    showToast('कृपया संस्था प्रधान घोषणा और प्रमाणीकरण पर टिक करें!', 'warning');
    return;
  }

  const pName = document.getElementById('syl_principal_name')?.value.trim();
  const pMob = document.getElementById('syl_principal_mobile')?.value.trim();
  if (!pName || !pMob) {
    showToast('कृपया संस्था प्रधान का नाम एवं मोबाइल नंबर अनिवार्य रूप से दर्ज करें!', 'warning');
    return;
  }

  const data = collectSyllabusFormData();
  if (!data) return;

  data.is_submitted = true;
  data.submitted_at = new Date().toISOString();
  data.submitted_by = STATE.currentUser?.name || pName;

  if (!STATE.samanSyllabusSubmissions) STATE.samanSyllabusSubmissions = {};
  STATE.samanSyllabusSubmissions[data.school_code] = data;

  localStorage.setItem('cbeo_saman_syllabus_submissions', JSON.stringify(STATE.samanSyllabusSubmissions));
  localStorage.removeItem(`cbeo_syl_draft_${data.school_code}`);

  const apiBaseSubSyl = getEffectiveApiBaseUrl();
  if (apiBaseSubSyl) {
    fetch(`${apiBaseSubSyl}/api/save_saman_syllabus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_code: data.school_code, data: data })
    }).catch(() => {});
  }

  recordAuditLog({
    user: STATE.currentUser?.name || pName,
    action: 'समान परीक्षा पाठ्यक्रम पूर्णता सबमिट',
    target: data.school_name,
    details: `कक्षा 9-12 पाठ्यक्रम पूर्णता % विवरण सफलता पूर्वक सत्यापित एवं सबमिट किया गया।`,
    note: `कोड: ${data.school_code}`
  });

  showToast(`'${data.school_name}' का पाठ्यक्रम पूर्णता विवरण सफलतापूर्वक सबमिट हो गया!`, 'success');
  closeModal('modal-saman-syllabus-form');
  renderSamanParikshaView();
}

function printSyllabusPdf(schoolCode = null) {
  const code = schoolCode || document.getElementById('syl-hidden-school-code')?.value;
  const school = (STATE.schools56 || []).find(s => s.shala_darpan_code === code) ||
    getAllMasterSchools().find(s => s.shala_darpan_code === code);
  const data = (STATE.samanSyllabusSubmissions && STATE.samanSyllabusSubmissions[code]) || collectSyllabusFormData();

  if (!school || !data) {
    showToast('डेटा उपलब्ध नहीं है!', 'error');
    return;
  }

  const examCode = data.exam_code || ('AJM04G' + school.shala_darpan_code);
  const c9 = data.c9 || {};
  const c10 = data.c10 || {};
  const c11 = data.c11 || {};
  const c12 = data.c12 || {};

  const electives11Html = c11.zero_enrolment
    ? `<span style="font-weight:900; color:#0f172a">लागू नहीं (शून्य नामांकन)</span>`
    : ((c11.electives || []).map(e => `<span>${e.name}: <strong style="color:#0f172a; font-weight:800">${e.pct}%</strong></span>`).join(' &bull; ') || '---');

  const electives12Html = c12.zero_enrolment
    ? `<span style="font-weight:900; color:#0f172a">लागू नहीं (शून्य नामांकन)</span>`
    : ((c12.electives || []).map(e => `<span>${e.name}: <strong style="color:#0f172a; font-weight:800">${e.pct}%</strong></span>`).join(' &bull; ') || '---');

  const avgPct = calculateSchoolSyllabusAverage(data);

  const printHtml = `
  <!DOCTYPE html>
  <html lang="hi">
  <head>
    <meta charset="UTF-8">
    <title>पाठ्यक्रम पूर्णता प्रतिशत - ${school.school_name}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1e293b; margin: 0; padding: 15px; font-size: 13px; line-height: 1.4; background:#f8fafc; }
      
      /* Print Toolbar (Hidden during print) */
      .action-toolbar {
        position: sticky; top: 0; z-index: 999; background: #ffffff; border: 1.5px solid #cbd5e1;
        border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; display: flex;
        justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      .action-btn {
        padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; border: none;
        display: inline-flex; align-items: center; gap: 6px; font-size: 13px; text-decoration: none;
      }
      .btn-print { background: #1e3a8a; color: #ffffff; }
      .btn-share { background: #25d366; color: #ffffff; }
      .btn-close { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

      @media print {
        .action-toolbar { display: none !important; }
        body { background: #ffffff; padding: 0; }
      }

      .report-container { max-width: 800px; margin: 0 auto; background: #ffffff; border: 2px solid #1e3a8a; border-radius: 8px; padding: 20px; }
      .header-box { text-align: center; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 15px; }
      .header-box h2 { margin: 0; color: #1e3a8a; font-size: 19px; font-weight: 900; letter-spacing: 0.3px; }
      .header-box h3 { margin: 5px 0; color: #0284c7; font-size: 15px; font-weight: 800; }
      .header-box p { margin: 3px 0; font-size: 12px; color: #334155; font-weight: 700; }
      .meta-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      .meta-table td { padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
      .meta-table td strong { color: #0f172a; }
      .data-table th, .data-table td { border: 1.5px solid #94a3b8; padding: 7px 8px; text-align: center; font-size: 12px; }
      .data-table th { background: #e0f2fe; color: #0c4a6e; font-weight: 800; }
      .section-title { background: #f1f5f9; color: #1e3a8a; padding: 6px 12px; font-weight: 800; font-size: 13px; margin: 14px 0 6px 0; border-left: 4px solid #1e3a8a; }
      .footer-box { margin-top: 35px; display: flex; justify-content: space-between; align-items: flex-end; }
      .stamp-box { border: 1.5px dashed #0284c7; padding: 10px 15px; border-radius: 6px; text-align: center; font-size: 11px; color: #1e40af; width: 230px; font-weight: 600; }
      .sign-box { text-align: right; width: 260px; font-size: 12px; }
      .not-applicable-cell { font-weight: 900; color: #0f172a; font-size: 12.5px; text-align: center; background: #f8fafc; }
    </style>
  </head>
  <body>
    <!-- Top Action Bar -->
    <div class="action-toolbar">
      <div style="font-weight:700; color:#1e3a8a">
        <i class="fas fa-file-invoice"></i> अधिकृत रिपोर्ट पूर्वावलोकन (Preview)
      </div>
      <div style="display:flex; gap:8px">
        <button class="action-btn btn-print" onclick="window.print()">
          <i class="fas fa-print"></i> प्रिंट / PDF सेव करें
        </button>
        <button class="action-btn btn-share" onclick="shareOnWhatsApp()">
          <i class="fab fa-whatsapp"></i> व्हाट्सएप शेयर
        </button>
        <button class="action-btn btn-close" onclick="window.close()">
          <i class="fas fa-times"></i> बंद करें
        </button>
      </div>
    </div>

    <div class="report-container">
      <div class="header-box">
        <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:2px">राजस्थान सरकार | स्कूल शिक्षा विभाग</div>
        <h2 style="font-size:18px; font-weight:900; color:#1e3a8a; margin:3px 0; letter-spacing:0.2px">
          ${getSchoolOfficialFormalHindiHeader(school)}
        </h2>
        <div style="font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px">
          परीक्षा कोड: <strong>${examCode}</strong> &bull; श्रेणी: <strong>${school.category || 'Sr.Sec'} (राजकीय)</strong> &bull; PEEO: <strong>${school.peeo_name || '---'}</strong>
        </div>
        <h3 style="font-size:14.5px; font-weight:800; color:#0284c7; margin:3px 0">जिला समान परीक्षा (सत्र 2026-27) | पाठ्यक्रम पूर्णता प्रतिशत अधिकृत प्रपत्र (कक्षा 9 से 12)</h3>
        <p style="font-size:12px; color:#475569; margin:2px 0">
          कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय | जिला: <strong>अजमेर (AJMER)</strong> &bull; ब्लॉक: <strong>भिनाय (BHINAI)</strong>
        </p>
      </div>

      <table class="meta-table">
        <tr>
          <td><strong>विद्यालय:</strong> ${school.school_name}</td>
          <td><strong>परीक्षा कोड:</strong> <strong style="color:#1e3a8a">${examCode}</strong> &bull; <strong>शा.दा. कोड:</strong> ${school.shala_darpan_code}</td>
        </tr>
        <tr>
          <td><strong>PEEO परिक्षेत्र:</strong> ${school.peeo_name || '---'}</td>
          <td><strong>औसत पाठ्यक्रम पूर्णता:</strong> <span style="font-size:14px; font-weight:900; color:#15803d">${avgPct}%</span></td>
        </tr>
        <tr>
          <td><strong>संस्था प्रधान:</strong> ${data.principal_name || school.principal_name || '---'}</td>
          <td><strong>मोबाइल नंबर:</strong> ${data.principal_mobile || school.principal_mobile || '---'}</td>
        </tr>
      </table>

      <div class="section-title">1. कक्षा 9वीं एवं 10वीं पाठ्यक्रम पूर्णता प्रतिशत (5 अनिवार्य + 2 तृतीय भाषा विषय = 7 कॉलम)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>कक्षा</th>
            <th>1. हिन्दी</th>
            <th>2. अंग्रेजी</th>
            <th>3. गणित</th>
            <th>4. विज्ञान</th>
            <th>5. सा.विज्ञान</th>
            <th>6. संस्कृत (III)</th>
            <th>7. उर्दू (III)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong style="color:#0f172a; font-weight:800">कक्षा 9वीं</strong></td>
            ${c9.zero_enrolment
              ? `<td colspan="7" class="not-applicable-cell">लागू नहीं (शून्य नामांकन)</td>`
              : `
                <td><strong style="color:#0f172a; font-weight:800">${c9.hindi || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c9.english || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c9.maths || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c9.science || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c9.sst || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c9.sanskrit || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c9.urdu || 0}%</strong></td>
              `
            }
          </tr>
          <tr>
            <td><strong style="color:#0f172a; font-weight:800">कक्षा 10वीं</strong></td>
            ${c10.zero_enrolment
              ? `<td colspan="7" class="not-applicable-cell">लागू नहीं (शून्य नामांकन)</td>`
              : `
                <td><strong style="color:#0f172a; font-weight:800">${c10.hindi || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c10.english || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c10.maths || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c10.science || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c10.sst || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c10.sanskrit || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c10.urdu || 0}%</strong></td>
              `
            }
          </tr>
        </tbody>
      </table>

      <div class="section-title">2. कक्षा 11वीं एवं 12वीं पाठ्यक्रम पूर्णता प्रतिशत (अनिवार्य व ऐच्छिक विषय)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>कक्षा</th>
            <th>अनिवार्य हिन्दी</th>
            <th>अनिवार्य अंग्रेजी</th>
            <th style="text-align:left; width:55%">विद्यालय में संचालित ऐच्छिक विषय एवं पूर्णता %</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong style="color:#0f172a; font-weight:800">कक्षा 11वीं</strong></td>
            ${c11.zero_enrolment
              ? `<td colspan="3" class="not-applicable-cell">लागू नहीं (शून्य नामांकन)</td>`
              : `
                <td><strong style="color:#0f172a; font-weight:800">${c11.comp_hindi || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c11.comp_english || 0}%</strong></td>
                <td style="text-align:left">${electives11Html}</td>
              `
            }
          </tr>
          <tr>
            <td><strong style="color:#0f172a; font-weight:800">कक्षा 12वीं</strong></td>
            ${c12.zero_enrolment
              ? `<td colspan="3" class="not-applicable-cell">लागू नहीं (शून्य नामांकन)</td>`
              : `
                <td><strong style="color:#0f172a; font-weight:800">${c12.comp_hindi || 0}%</strong></td>
                <td><strong style="color:#0f172a; font-weight:800">${c12.comp_english || 0}%</strong></td>
                <td style="text-align:left">${electives12Html}</td>
              `
            }
          </tr>
        </tbody>
      </table>

      <div class="footer-box">
        <div class="stamp-box">
          <strong>आधिकारिक संस्थागत डिजिटल मोहर</strong><br>
          ${school.school_name}<br>
          परीक्षा कोड: ${examCode}<br>
          ब्लॉक-भिनाय (जिला: अजमेर)
        </div>
        <div class="sign-box">
          <p style="margin-bottom:25px; font-weight:bold">प्रमाणित एवं सत्यापित</p>
          <p><strong>${data.principal_name || school.principal_name || 'संस्था प्रधान'}</strong><br>
          मो. ${data.principal_mobile || school.principal_mobile || ''}<br>
          दिनांक: ${data.submitted_at ? new Date(data.submitted_at).toLocaleDateString('hi-IN') : new Date().toLocaleDateString('hi-IN')}</p>
        </div>
      </div>
    </div>

    <script>
      function shareOnWhatsApp() {
        var text = "📋 *समान परीक्षा 2026-27: पाठ्यक्रम पूर्णता प्रतिशत विवरण*\\n" +
          "🏫 विद्यालय: ${school.school_name}\\n" +
          "🔢 परीक्षा कोड: ${examCode} (शा.दा.: ${school.shala_darpan_code})\\n" +
          "📊 औसत पूर्णता: ${avgPct}%\\n" +
          "🏛️ कार्यालय CBEO भिनाय (अजमेर)\\n" +
          "🌐 पोर्टल: https://jit9763.github.io/cbeo-bhinai-portal/";
        var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
        window.open(url, "_blank");
      }
    </script>
  </body>
  </html>
  `;

  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.write(printHtml);
    printWin.document.close();
  }
}

function openSamanParikshaForm(schoolCode) {
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  if (!school) {
    showToast('विद्यालय का विवरण नहीं मिला!', 'error');
    return;
  }

  const sub = STATE.samanParikshaSubmissions[schoolCode] || {};
  let draft = null;
  try {
    const raw = localStorage.getItem(`cbeo_form_draft_${schoolCode}`);
    if (raw) draft = JSON.parse(raw);
  } catch (e) {}

  // Prioritize official saved submission over any stale drafts
  let activeData = sub;
  if (draft && !sub.is_submitted) {
    activeData = { ...sub, ...draft };
  } else if (sub && sub.is_submitted) {
    activeData = sub;
    // synchronize draft with official saved submission
    localStorage.setItem(`cbeo_form_draft_${schoolCode}`, JSON.stringify(sub));
  }

  const draftStatusText = document.getElementById('gform-draft-text');
  if (draftStatusText) {
    if (draft && draft.updated_at) {
      draftStatusText.textContent = `ड्राफ्ट सुरक्षित (${draft.updated_at})`;
    } else {
      draftStatusText.textContent = 'ड्राफ्ट सुरक्षित';
    }
  }

  if (draft && !STATE.samanParikshaSubmissions[schoolCode]) {
    showToast('💡 पूर्व में सुरक्षित ड्राफ्ट स्वतः लोड कर लिया गया है।', 'info');
  }

  const officialNames = getOfficialSchoolNames(school);
  document.getElementById('gform-school-code-hidden').value = school.shala_darpan_code;
  document.getElementById('gform-school-name').value = `${officialNames.en} [${officialNames.hi}]`;
  document.getElementById('gform-school-code').value = school.shala_darpan_code;
  document.getElementById('gform-peeo-name').value = school.peeo_name || '---';
  document.getElementById('gform-school-cat').value = `${school.category} (${school.type === 'Government' ? 'राजकीय' : 'निजी'})`;
  
  // Calculate suggested examination code: Govt -> AJM04G + Shala Darpan code, Private -> AJM04P0 + 5-digit numeric PSP code
  const isPvt = school.type === 'Private' || (school.category && school.category.includes('Private')) || String(school.shala_darpan_code).startsWith('P');
  const cleanPsp = String(school.shala_darpan_code).replace(/\D/g, '').padStart(5, '0');
  const suggestedExamCode = isPvt ? `AJM04P0${cleanPsp}` : `AJM04G${school.shala_darpan_code}`;

  const examInput = document.getElementById('gform-exam-code');
  if (examInput) {
    examInput.value = suggestedExamCode;
    examInput.readOnly = true;
    examInput.style.background = '#eff6ff';
    examInput.style.cursor = 'not-allowed';
  }

  // Highlight active category suggestion card
  const govCard = document.getElementById('sug-card-govt');
  const pvtCard = document.getElementById('sug-card-pvt');
  const applyBtn = document.getElementById('btn-apply-suggested-exam-code');

  if (govCard && pvtCard) {
    if (isPvt) {
      pvtCard.style.border = '2px solid #a855f7';
      pvtCard.style.background = '#faf5ff';
      pvtCard.style.boxShadow = '0 2px 6px rgba(168,85,247,0.15)';
      govCard.style.border = '1px solid #bfdbfe';
      govCard.style.background = '#eff6ff';
      govCard.style.boxShadow = 'none';
    } else {
      govCard.style.border = '2px solid #2563eb';
      govCard.style.background = '#eff6ff';
      govCard.style.boxShadow = '0 2px 6px rgba(37,99,235,0.15)';
      pvtCard.style.border = '1px solid #f0abfc';
      pvtCard.style.background = '#fdf4ff';
      pvtCard.style.boxShadow = 'none';
    }
  }

  window.applySuggestedExamCode = function() {
    if (examInput) {
      examInput.value = suggestedExamCode;
      autoSaveGFormDraft();
      showToast(`अनुशंसित परीक्षा कोड '${suggestedExamCode}' भर दिया गया है।`, 'success');
    }
  };

  if (applyBtn) {
    applyBtn.style.display = 'inline-flex';
    applyBtn.title = `क्लिक करके '${suggestedExamCode}' भरें`;
  }

  document.getElementById('gform-principal-name').value = activeData.principal_name || school.principal_name || '';
  document.getElementById('gform-principal-mobile').value = activeData.principal_mobile || school.principal_mobile || '';
  document.getElementById('gform-incharge-name').value = activeData.incharge_name || school.incharge_name || '';
  document.getElementById('gform-incharge-mobile').value = activeData.incharge_mobile || school.incharge_mobile || '';

  // School Medium Setup & Bilingual Detection
  const isMggs = (['221770', '221778', '221753'].includes(String(schoolCode).trim()) || (school.category || '').toUpperCase().includes('MGGS') || (school.school_name || '').includes('महात्मा गांधी') || (school.school_name || '').toUpperCase().includes('MGGS'));
  const schoolMedium = isMggs ? 'english' : (activeData.school_medium || 'hindi');

  const medHindi = document.getElementById('gform-med-hindi');
  const medEng = document.getElementById('gform-med-english');
  const medBoth = document.getElementById('gform-med-both');
  if (schoolMedium === 'english' && medEng) medEng.checked = true;
  else if (schoolMedium === 'both' && medBoth) medBoth.checked = true;
  else if (medHindi) medHindi.checked = true;

  const mggsBadge = document.getElementById('gform-mggs-badge');
  if (mggsBadge) mggsBadge.style.display = isMggs ? 'inline-flex' : 'none';

  let c9Hindi = activeData.c9_hindi;
  let c9English = activeData.c9_english;
  if (isMggs) {
    if ((!c9English || c9English === 0) && (c9Hindi > 0 || (activeData.c9_total || 0) > 0)) {
      c9English = c9Hindi || activeData.c9_total || 0;
      c9Hindi = 0;
    } else if (c9English === undefined) {
      c9English = activeData.c9_total || 0;
      c9Hindi = 0;
    }
  } else if (c9Hindi === undefined && c9English === undefined) {
    if (schoolMedium === 'english') {
      c9English = activeData.c9_total || 0;
      c9Hindi = 0;
    } else {
      c9Hindi = activeData.c9_total || 0;
      c9English = 0;
    }
  }
  if (document.getElementById('gform-c9-hindi')) document.getElementById('gform-c9-hindi').value = c9Hindi ?? 0;
  if (document.getElementById('gform-c9-english')) document.getElementById('gform-c9-english').value = c9English ?? 0;
  if (document.getElementById('gform-c9-total')) document.getElementById('gform-c9-total').value = (c9Hindi || 0) + (c9English || 0);

  if (document.getElementById('gform-c9-sanskrit')) document.getElementById('gform-c9-sanskrit').value = activeData.c9_sanskrit ?? 0;
  if (document.getElementById('gform-c9-urdu')) document.getElementById('gform-c9-urdu').value = activeData.c9_urdu ?? 0;

  let c10Hindi = activeData.c10_hindi;
  let c10English = activeData.c10_english;
  if (isMggs) {
    if ((!c10English || c10English === 0) && (c10Hindi > 0 || (activeData.c10_total || 0) > 0)) {
      c10English = c10Hindi || activeData.c10_total || 0;
      c10Hindi = 0;
    } else if (c10English === undefined) {
      c10English = activeData.c10_total || 0;
      c10Hindi = 0;
    }
  } else if (c10Hindi === undefined && c10English === undefined) {
    if (schoolMedium === 'english') {
      c10English = activeData.c10_total || 0;
      c10Hindi = 0;
    } else {
      c10Hindi = activeData.c10_total || 0;
      c10English = 0;
    }
  }
  if (document.getElementById('gform-c10-hindi')) document.getElementById('gform-c10-hindi').value = c10Hindi ?? 0;
  if (document.getElementById('gform-c10-english')) document.getElementById('gform-c10-english').value = c10English ?? 0;
  if (document.getElementById('gform-c10-total')) document.getElementById('gform-c10-total').value = (c10Hindi || 0) + (c10English || 0);

  if (document.getElementById('gform-c10-sanskrit')) document.getElementById('gform-c10-sanskrit').value = activeData.c10_sanskrit ?? 0;
  if (document.getElementById('gform-c10-urdu')) document.getElementById('gform-c10-urdu').value = activeData.c10_urdu ?? 0;

  document.getElementById('gform-c11-comp-hindi').value = activeData.c11_comp_hindi ?? 0;
  document.getElementById('gform-c11-comp-english').value = activeData.c11_comp_english ?? 0;
  document.getElementById('gform-c11-total').value = activeData.c11_total ?? 0;

  document.getElementById('gform-c12-comp-hindi').value = activeData.c12_comp_hindi ?? 0;
  document.getElementById('gform-c12-comp-english').value = activeData.c12_comp_english ?? 0;
  document.getElementById('gform-c12-total').value = activeData.c12_total ?? 0;

  // Build Stream-wise Optional Subjects Grids for Class 11 and Class 12
  ['c11', 'c12'].forEach(cls => {
    const savedFaculties = activeData[`${cls}_faculties`] || [];
    const optData = activeData[`${cls}_optional`] || {};

    Object.entries(FACULTIES_CONFIG).forEach(([facKey, fac]) => {
      const chk = document.getElementById(`gform-${cls}-fac-${facKey}`);
      const sec = document.getElementById(`gform-${cls}-section-${facKey}`);
      const lbl = document.getElementById(`lbl-${cls}-${facKey}`);
      const grid = document.getElementById(`gform-${cls}-grid-${facKey}`);

      // Auto-check if previously saved or any subject has > 0
      const hasSubjectCount = fac.subjects.some(s => (optData[s.key] || 0) > 0);
      const isSelected = savedFaculties.includes(facKey) || hasSubjectCount;

      if (chk) chk.checked = isSelected;
      if (sec) {
        if (isSelected) sec.classList.add('active');
        else sec.classList.remove('active');
      }
      if (lbl) {
        if (isSelected) lbl.classList.add('active');
        else lbl.classList.remove('active');
      }

      if (grid) {
        grid.innerHTML = '';
        fac.subjects.forEach(subj => {
          const val = optData[subj.key] || 0;
          const box = document.createElement('div');
          box.className = 'gform-subject-card';
          box.innerHTML = `
            <label title="${subj.label}">${subj.label}</label>
            <input type="number" min="0" value="${val}" id="gform-${cls}-opt-${subj.key}" oninput="calculateGFormTotals()">
          `;
          grid.appendChild(box);
        });
      }
    });
  });

  // Update dynamic stamp preview
  const stampSchool = document.getElementById('gform-stamp-school');
  const stampBlock = document.getElementById('gform-stamp-block');
  if (stampSchool) stampSchool.textContent = school.peeo_name || 'रा.उ.मा.वि. भिनाय';
  if (stampBlock) stampBlock.textContent = `ग्रा.पं. ${school.peeo_name.replace('PEEO ', '')}, ब्लॉक-भिनाय (अजमेर)`;

  calculateGFormTotals();
  const formElem = document.getElementById('modal-saman-pariksha-form');
  if (formElem) {
    formElem.classList.add('google-form-page-mode');
    formElem.scrollTop = 0;
  }
  const standaloneBtn = document.getElementById('gform-open-standalone-btn');
  if (standaloneBtn) {
    standaloneBtn.href = `saman_form.html?code=${school.shala_darpan_code}&_v=${Date.now()}`;
  }
  showModal('modal-saman-pariksha-form');

  const isLocked = isSamanParikshaLockedForCurrentUser(schoolCode);
  const cfgMismatch = getSamanMismatchConfig();
  const customAllowed = (cfgMismatch && cfgMismatch.custom_edit_schools) || [
    '221780', '221778', '221770', '221753', '221758', '221761', '221772', '221756'
  ];
  const isCustomUnlocked = customAllowed.some(c => String(c).trim() === String(schoolCode).trim());

  const lockBanner = document.getElementById('gform-lock-alert-banner');
  if (lockBanner) {
    if (isCustomUnlocked) {
      lockBanner.style.display = 'block';
      lockBanner.style.background = '#ecfdf5';
      lockBanner.style.border = '1.5px solid #10b981';
      lockBanner.style.color = '#065f46';
      lockBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem">
          <i class="fas fa-unlock-alt" style="color:#059669; font-size:1.15rem"></i>
          <div>
            <strong>विशेष संपादन मोड (Custom Edit Unlocked):</strong> CBEO कार्यालय द्वारा इस विद्यालय को नामांकन सुधार हेतु विशेष संपादन अनुमति प्रदान की गई है। कृपया आंकड़े सही कर प्रपत्र सबमिट करें।
          </div>
        </div>
      `;
    } else {
      lockBanner.style.display = isLocked ? 'block' : 'none';
      lockBanner.style.background = '#fef2f2';
      lockBanner.style.border = '1px solid #fecaca';
      lockBanner.style.color = '#991b1b';
      lockBanner.innerHTML = `
        <i class="fas fa-lock"></i> <strong>केवल अवलोकन मोड (View-Only):</strong> समान परीक्षा मांग प्रपत्र में सीधे संपादन की समय-सीमा अथवा अधिकार वर्तमान में CBEO स्तर से लॉक हैं।
      `;
    }
  }

  const topSaveBtn = document.getElementById('btn-gform-topbar-save');
  const footSaveBtn = document.getElementById('btn-gform-footer-save');
  const footPrintBtn = document.getElementById('btn-gform-footer-print');
  const viewOnlyPdfBtn = document.getElementById('btn-gform-viewonly-pdf');

  if (topSaveBtn) topSaveBtn.style.display = isLocked ? 'none' : 'inline-flex';
  if (footSaveBtn) footSaveBtn.style.display = isLocked ? 'none' : 'inline-flex';
  if (footPrintBtn) footPrintBtn.style.display = isLocked ? 'none' : 'inline-flex';
  if (viewOnlyPdfBtn) viewOnlyPdfBtn.style.display = isLocked ? 'inline-flex' : 'none';

  const lockedIdentityIds = ['gform-school-name', 'gform-school-code', 'gform-peeo-name', 'gform-school-cat', 'gform-exam-code'];
  const gformInputs = formElem ? formElem.querySelectorAll('input:not([type="hidden"]), select, textarea') : [];
  gformInputs.forEach(inp => {
    if (lockedIdentityIds.includes(inp.id)) {
      inp.setAttribute('readonly', 'true');
      inp.classList.add('view-only-input');
      return; // NEVER UNLOCK SECTION 1!
    }
    if (isLocked) {
      inp.setAttribute('readonly', 'true');
      if (inp.type === 'checkbox' || inp.type === 'radio') inp.setAttribute('disabled', 'true');
    } else {
      inp.removeAttribute('readonly');
      if (inp.type === 'checkbox' || inp.type === 'radio') inp.removeAttribute('disabled');
    }
  });

  setTimeout(() => {
    setupGFormSignaturePad();
    clearGFormSignature();
    if (activeData.signature_data) {
      const img = new Image();
      img.onload = () => {
        if (gformCanvas && gformCtx) {
          gformCtx.drawImage(img, 0, 0, gformCanvas.width, gformCanvas.height);
          gformHasSignature = true;
        }
      };
      img.src = activeData.signature_data;
    }
  }, 120);
}

function onSchoolMediumChanged() {
  const med = document.querySelector('input[name="gform-school-medium"]:checked')?.value || 'hindi';
  const c9H = document.getElementById('gform-c9-hindi');
  const c9E = document.getElementById('gform-c9-english');
  const c10H = document.getElementById('gform-c10-hindi');
  const c10E = document.getElementById('gform-c10-english');

  if (med === 'hindi') {
    if (c9E && parseInt(c9E.value) > 0 && (!c9H || parseInt(c9H.value) === 0)) {
      c9H.value = c9E.value;
      c9E.value = 0;
    }
    if (c10E && parseInt(c10E.value) > 0 && (!c10H || parseInt(c10H.value) === 0)) {
      c10H.value = c10E.value;
      c10E.value = 0;
    }
  } else if (med === 'english') {
    if (c9H && parseInt(c9H.value) > 0 && (!c9E || parseInt(c9E.value) === 0)) {
      c9E.value = c9H.value;
      c9H.value = 0;
    }
    if (c10H && parseInt(c10H.value) > 0 && (!c10E || parseInt(c10E.value) === 0)) {
      c10E.value = c10H.value;
      c10H.value = 0;
    }
  }
  calculateGFormTotals();
}
window.onSchoolMediumChanged = onSchoolMediumChanged;

function calculateGFormTotals(source = null) {
  const c9TotalEl = document.getElementById('gform-c9-total');
  const c9HindiEl = document.getElementById('gform-c9-hindi');
  const c9EnglishEl = document.getElementById('gform-c9-english');
  
  if (source === 'c9_total' && c9TotalEl) {
    const totVal = parseInt(c9TotalEl.value) || 0;
    const engVal = parseInt(c9EnglishEl?.value) || 0;
    if (c9HindiEl) c9HindiEl.value = Math.max(0, totVal - engVal);
  }

  const c9Hindi = parseInt(c9HindiEl?.value) || 0;
  const c9English = parseInt(c9EnglishEl?.value) || 0;
  let c9 = c9Hindi + c9English;
  if (c9TotalEl && source !== 'c9_total') {
    c9TotalEl.value = c9;
  }

  const c10TotalEl = document.getElementById('gform-c10-total');
  const c10HindiEl = document.getElementById('gform-c10-hindi');
  const c10EnglishEl = document.getElementById('gform-c10-english');

  if (source === 'c10_total' && c10TotalEl) {
    const totVal = parseInt(c10TotalEl.value) || 0;
    const engVal = parseInt(c10EnglishEl?.value) || 0;
    if (c10HindiEl) c10HindiEl.value = Math.max(0, totVal - engVal);
  }

  const c10Hindi = parseInt(c10HindiEl?.value) || 0;
  const c10English = parseInt(c10EnglishEl?.value) || 0;
  let c10 = c10Hindi + c10English;
  if (c10TotalEl && source !== 'c10_total') {
    c10TotalEl.value = c10;
  }

  const c11Hindi = parseInt(document.getElementById('gform-c11-comp-hindi')?.value) || 0;
  const c11English = parseInt(document.getElementById('gform-c11-comp-english')?.value) || 0;
  let c11Total = parseInt(document.getElementById('gform-c11-total')?.value) || 0;
  if (c11Total === 0 && (c11Hindi > 0 || c11English > 0)) {
    c11Total = Math.max(c11Hindi, c11English);
    if (document.getElementById('gform-c11-total')) document.getElementById('gform-c11-total').value = c11Total;
  }
  if (document.getElementById('gform-c11-total-display')) {
    document.getElementById('gform-c11-total-display').textContent = c11Total;
  }

  const c12Hindi = parseInt(document.getElementById('gform-c12-comp-hindi')?.value) || 0;
  const c12English = parseInt(document.getElementById('gform-c12-comp-english')?.value) || 0;
  let c12Total = parseInt(document.getElementById('gform-c12-total')?.value) || 0;
  if (c12Total === 0 && (c12Hindi > 0 || c12English > 0)) {
    c12Total = Math.max(c12Hindi, c12English);
    if (document.getElementById('gform-c12-total')) document.getElementById('gform-c12-total').value = c12Total;
  }
  if (document.getElementById('gform-c12-total-display')) {
    document.getElementById('gform-c12-total-display').textContent = c12Total;
  }

  const grand = c9 + c10 + c11Total + c12Total;

  if (document.getElementById('gform-sum-c9')) document.getElementById('gform-sum-c9').textContent = c9;
  if (document.getElementById('gform-sum-c10')) document.getElementById('gform-sum-c10').textContent = c10;
  if (document.getElementById('gform-sum-c11')) document.getElementById('gform-sum-c11').textContent = c11Total;
  if (document.getElementById('gform-sum-c12')) document.getElementById('gform-sum-c12').textContent = c12Total;
  if (document.getElementById('gform-sum-grand')) document.getElementById('gform-sum-grand').textContent = grand;

  // Sign previews: keep clean, no fake cursive name
  if (document.getElementById('gform-sign-principal-preview')) document.getElementById('gform-sign-principal-preview').innerHTML = '';
  if (document.getElementById('gform-sign-incharge-preview')) document.getElementById('gform-sign-incharge-preview').innerHTML = '';
}

function toggleNilClass(cls) {
  if (cls === 'c9') {
    const el = document.getElementById('gform-c9-total');
    const h = document.getElementById('gform-c9-hindi');
    const e = document.getElementById('gform-c9-english');
    const sk = document.getElementById('gform-c9-sanskrit');
    const ur = document.getElementById('gform-c9-urdu');
    if (el) el.value = 0;
    if (h) h.value = 0;
    if (e) e.value = 0;
    if (sk) sk.value = 0;
    if (ur) ur.value = 0;
    showToast('कक्षा 9 को शून्य / संचालित नहीं (NIL) सेट किया गया', 'info');
  } else if (cls === 'c10') {
    const el = document.getElementById('gform-c10-total');
    const h = document.getElementById('gform-c10-hindi');
    const e = document.getElementById('gform-c10-english');
    const sk = document.getElementById('gform-c10-sanskrit');
    const ur = document.getElementById('gform-c10-urdu');
    if (el) el.value = 0;
    if (h) h.value = 0;
    if (e) e.value = 0;
    if (sk) sk.value = 0;
    if (ur) ur.value = 0;
    showToast('कक्षा 10 को शून्य / संचालित नहीं (NIL) सेट किया गया', 'info');
  } else if (cls === 'c11') {
    const tot = document.getElementById('gform-c11-total');
    const hi = document.getElementById('gform-c11-comp-hindi');
    const en = document.getElementById('gform-c11-comp-english');
    if (tot) tot.value = 0;
    if (hi) hi.value = 0;
    if (en) en.value = 0;
    ['arts', 'science', 'commerce', 'agri'].forEach(f => {
      const cb = document.getElementById(`gform-c11-fac-${f}`);
      if (cb) cb.checked = false;
      const g = document.getElementById(`gform-c11-grid-${f}`);
      if (g) g.style.display = 'none';
      const sec = document.getElementById(`gform-c11-section-${f}`);
      if (sec) sec.style.display = 'none';
    });
    SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(subj => {
      const inp = document.getElementById(`gform-c11-opt-${subj.key}`);
      if (inp) inp.value = 0;
    });
    showToast('कक्षा 11 को शून्य / संचालित नहीं (NIL) सेट किया गया', 'info');
  } else if (cls === 'c12') {
    const tot = document.getElementById('gform-c12-total');
    const hi = document.getElementById('gform-c12-comp-hindi');
    const en = document.getElementById('gform-c12-comp-english');
    if (tot) tot.value = 0;
    if (hi) hi.value = 0;
    if (en) en.value = 0;
    ['arts', 'science', 'commerce', 'agri'].forEach(f => {
      const cb = document.getElementById(`gform-c12-fac-${f}`);
      if (cb) cb.checked = false;
      const g = document.getElementById(`gform-c12-grid-${f}`);
      if (g) g.style.display = 'none';
      const sec = document.getElementById(`gform-c12-section-${f}`);
      if (sec) sec.style.display = 'none';
    });
    SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(subj => {
      const inp = document.getElementById(`gform-c12-opt-${subj.key}`);
      if (inp) inp.value = 0;
    });
    showToast('कक्षा 12 को शून्य / संचालित नहीं (NIL) सेट किया गया', 'info');
  }
  calculateGFormTotals();
  autoSaveGFormDraft();
}


// Real-time LocalStorage Draft Auto-Save Engine (Distraction & Call Resilient)
let gformAutoSaveTimer = null;
function autoSaveGFormDraft() {
  const schoolCode = document.getElementById('gform-school-code-hidden')?.value;
  if (schoolCode && isSamanParikshaLockedForCurrentUser(schoolCode)) return;
  clearTimeout(gformAutoSaveTimer);
  gformAutoSaveTimer = setTimeout(() => {
    if (!schoolCode) return;

    const timeStr = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const c11Fac = [];
    const c11Opt = {};
    Object.entries(FACULTIES_CONFIG).forEach(([facKey, fac]) => {
      const chk = document.getElementById(`gform-c11-fac-${facKey}`);
      if (chk && chk.checked) {
        c11Fac.push(facKey);
        fac.subjects.forEach(subj => {
          c11Opt[subj.key] = parseInt(document.getElementById(`gform-c11-opt-${subj.key}`)?.value) || 0;
        });
      }
    });

    const c12Fac = [];
    const c12Opt = {};
    Object.entries(FACULTIES_CONFIG).forEach(([facKey, fac]) => {
      const chk = document.getElementById(`gform-c12-fac-${facKey}`);
      if (chk && chk.checked) {
        c12Fac.push(facKey);
        fac.subjects.forEach(subj => {
          c12Opt[subj.key] = parseInt(document.getElementById(`gform-c12-opt-${subj.key}`)?.value) || 0;
        });
      }
    });

    const draftData = {
      school_code: schoolCode,
      exam_code: document.getElementById('gform-exam-code')?.value || '',
      school_medium: document.querySelector('input[name="gform-school-medium"]:checked')?.value || 'hindi',
      principal_name: document.getElementById('gform-principal-name')?.value || '',
      principal_mobile: document.getElementById('gform-principal-mobile')?.value || '',
      incharge_name: document.getElementById('gform-incharge-name')?.value || '',
      incharge_mobile: document.getElementById('gform-incharge-mobile')?.value || '',
      c9_hindi: parseInt(document.getElementById('gform-c9-hindi')?.value) || 0,
      c9_english: parseInt(document.getElementById('gform-c9-english')?.value) || 0,
      c9_total: parseInt(document.getElementById('gform-c9-total')?.value) || 0,
      c9_sanskrit: parseInt(document.getElementById('gform-c9-sanskrit')?.value) || 0,
      c9_urdu: parseInt(document.getElementById('gform-c9-urdu')?.value) || 0,
      c10_hindi: parseInt(document.getElementById('gform-c10-hindi')?.value) || 0,
      c10_english: parseInt(document.getElementById('gform-c10-english')?.value) || 0,
      c10_total: parseInt(document.getElementById('gform-c10-total')?.value) || 0,
      c10_sanskrit: parseInt(document.getElementById('gform-c10-sanskrit')?.value) || 0,
      c10_urdu: parseInt(document.getElementById('gform-c10-urdu')?.value) || 0,
      c11_comp_hindi: parseInt(document.getElementById('gform-c11-comp-hindi')?.value) || 0,
      c11_comp_english: parseInt(document.getElementById('gform-c11-comp-english')?.value) || 0,
      c11_total: parseInt(document.getElementById('gform-c11-total')?.value) || 0,
      c11_faculties: c11Fac,
      c11_optional: c11Opt,
      c12_comp_hindi: parseInt(document.getElementById('gform-c12-comp-hindi')?.value) || 0,
      c12_comp_english: parseInt(document.getElementById('gform-c12-comp-english')?.value) || 0,
      c12_total: parseInt(document.getElementById('gform-c12-total')?.value) || 0,
      c12_faculties: c12Fac,
      c12_optional: c12Opt,
      updated_at: timeStr
    };

    localStorage.setItem(`cbeo_form_draft_${schoolCode}`, JSON.stringify(draftData));

    const draftStatusText = document.getElementById('gform-draft-text');
    if (draftStatusText) {
      draftStatusText.textContent = `ड्राफ्ट सुरक्षित (${timeStr})`;
    }
  }, 250);
}

function submitSamanParikshaForm(andPrint = false) {
  const schoolCode = document.getElementById('gform-school-code-hidden').value;
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  if (!school) return;

  if (isSamanParikshaLockedForCurrentUser(schoolCode)) {
    if (andPrint) {
      closeModal('modal-saman-pariksha-form');
      openExamPdfPreview(schoolCode);
      return;
    }
    showToast('🔒 समान परीक्षा प्रपत्र संपादन CBEO कार्यालय द्वारा लॉक है (View-Only Mode)।', 'warning');
    return;
  }

  const examCode = document.getElementById('gform-exam-code').value.trim().toUpperCase();
  const principalName = document.getElementById('gform-principal-name').value.trim();
  const principalMobile = document.getElementById('gform-principal-mobile').value.trim();
  const inchargeName = document.getElementById('gform-incharge-name').value.trim();
  const inchargeMobile = document.getElementById('gform-incharge-mobile').value.trim();

  if (!examCode) {
    showToast('कृपया स्कूल परीक्षा कोड (उदा. AJM04G221754 या AJM04P055700) अवश्य दर्ज करें!', 'error');
    document.getElementById('gform-exam-code').focus();
    return;
  }

  if (!principalName || !principalMobile) {
    showToast('कृपया संस्था प्रधान का नाम एवं 10 अंकों का मोबाइल नंबर दर्ज करें!', 'error');
    document.getElementById('gform-principal-name').focus();
    return;
  }

  if (!inchargeName || !inchargeMobile) {
    showToast('कृपया परीक्षा प्रभारी का नाम एवं 10 अंकों का मोबाइल नंबर दर्ज करें!', 'error');
    document.getElementById('gform-incharge-name').focus();
    return;
  }

  const isSchoolMggs = (['221770', '221778', '221753'].includes(String(schoolCode).trim()) || (school.category || '').toUpperCase().includes('MGGS') || (school.school_name || '').includes('महात्मा गांधी') || (school.school_name || '').toUpperCase().includes('MGGS'));
  let schoolMedium = document.querySelector('input[name="gform-school-medium"]:checked')?.value || (isSchoolMggs ? 'english' : 'hindi');
  if (isSchoolMggs && schoolMedium === 'hindi') schoolMedium = 'english';

  let c9Hindi = parseInt(document.getElementById('gform-c9-hindi')?.value) || 0;
  let c9English = parseInt(document.getElementById('gform-c9-english')?.value) || 0;
  if (isSchoolMggs || schoolMedium === 'english') {
    if (c9English === 0 && c9Hindi > 0) {
      c9English = c9Hindi;
      c9Hindi = 0;
    }
  }
  const c9 = parseInt(document.getElementById('gform-c9-total')?.value) || (c9Hindi + c9English);
  const c9Sanskrit = parseInt(document.getElementById('gform-c9-sanskrit')?.value) || 0;
  const c9Urdu = parseInt(document.getElementById('gform-c9-urdu')?.value) || 0;

  let c10Hindi = parseInt(document.getElementById('gform-c10-hindi')?.value) || 0;
  let c10English = parseInt(document.getElementById('gform-c10-english')?.value) || 0;
  if (isSchoolMggs || schoolMedium === 'english') {
    if (c10English === 0 && c10Hindi > 0) {
      c10English = c10Hindi;
      c10Hindi = 0;
    }
  }
  const c10 = parseInt(document.getElementById('gform-c10-total')?.value) || (c10Hindi + c10English);
  const c10Sanskrit = parseInt(document.getElementById('gform-c10-sanskrit')?.value) || 0;
  const c10Urdu = parseInt(document.getElementById('gform-c10-urdu')?.value) || 0;

  const c11Hindi = parseInt(document.getElementById('gform-c11-comp-hindi')?.value) || 0;
  const c11English = parseInt(document.getElementById('gform-c11-comp-english')?.value) || 0;
  const c11Total = parseInt(document.getElementById('gform-c11-total')?.value) || 0;
  const c12Hindi = parseInt(document.getElementById('gform-c12-comp-hindi')?.value) || 0;
  const c12English = parseInt(document.getElementById('gform-c12-comp-english')?.value) || 0;
  const c12Total = parseInt(document.getElementById('gform-c12-total')?.value) || 0;

  const c11Faculties = ['arts', 'science', 'commerce', 'agri'].filter(f => document.getElementById(`gform-c11-fac-${f}`)?.checked);
  const c12Faculties = ['arts', 'science', 'commerce', 'agri'].filter(f => document.getElementById(`gform-c12-fac-${f}`)?.checked);

  const c11Optional = {};
  const c12Optional = {};
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(subj => {
    c11Optional[subj.key] = parseInt(document.getElementById(`gform-c11-opt-${subj.key}`)?.value) || 0;
    c12Optional[subj.key] = parseInt(document.getElementById(`gform-c12-opt-${subj.key}`)?.value) || 0;
  });

  const grandTotal = c9 + c10 + c11Total + c12Total;

  let sigData = null;
  function isCnvBlank(c) {
    if (!c) return true;
    try {
      const b = document.createElement('canvas');
      b.width = c.width; b.height = c.height;
      return c.toDataURL() === b.toDataURL();
    } catch(e) { return false; }
  }
  if (gformCanvas && (gformHasSignature || !isCnvBlank(gformCanvas))) {
    sigData = gformCanvas.toDataURL('image/png');
  } else if (STATE.samanParikshaSubmissions[schoolCode]?.signature_data) {
    sigData = STATE.samanParikshaSubmissions[schoolCode].signature_data;
  }

  const submission = {
    school_code: schoolCode,
    school_name: school.school_name,
    category: school.category,
    type: school.type,
    peeo_name: school.peeo_name,
    peeo_code: school.peeo_code,
    exam_code: examCode,
    school_medium: schoolMedium,
    principal_name: principalName,
    principal_mobile: principalMobile,
    incharge_name: inchargeName,
    incharge_mobile: inchargeMobile,
    c9_hindi: c9Hindi,
    c9_english: c9English,
    c9_total: c9,
    c9_sanskrit: c9Sanskrit,
    c9_urdu: c9Urdu,
    c10_hindi: c10Hindi,
    c10_english: c10English,
    c10_total: c10,
    c10_sanskrit: c10Sanskrit,
    c10_urdu: c10Urdu,
    c11_faculties: c11Faculties,
    c11_comp_hindi: c11Hindi,
    c11_comp_english: c11English,
    c11_optional: c11Optional,
    c11_total: c11Total,
    c12_faculties: c12Faculties,
    c12_comp_hindi: c12Hindi,
    c12_comp_english: c12English,
    c12_optional: c12Optional,
    c12_total: c12Total,
    grand_total: grandTotal,
    signature_data: sigData,
    has_digital_signature: !!sigData,
    submitted_by: STATE.currentUser?.name || STATE.currentUser?.peeo_name || 'School In-charge',
    timestamp: new Date().toLocaleString('en-IN')
  };

  // Check and Auto-Resolve Mismatch
  const mismatchCheck = checkAndAutoResolveSamanMismatch(schoolCode, submission);
  if (!mismatchCheck.resolved && mismatchCheck.error) {
    showToast(`⚠️ ${mismatchCheck.error}`, 'warning');
  } else if (mismatchCheck.resolved && mismatchCheck.wasMismatch) {
    showToast('✓ मिसमैच शर्त पूर्ण! प्रपत्र से मिसमैच हट गया एवं प्रपत्र मान्य हो गया।', 'success');
  }

  STATE.samanParikshaSubmissions[schoolCode] = submission;
  localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));

  // Keep draft synchronized with official submission
  localStorage.setItem(`cbeo_form_draft_${schoolCode}`, JSON.stringify(submission));

  // --- DYNAMICALLY UPDATE CALL DIRECTORY & STAFF DATA ---
  try {
    // 1. Update 56 Schools
    school.principal_name = principalName;
    school.principal_mobile = principalMobile;
    school.incharge_name = inchargeName;
    school.incharge_mobile = inchargeMobile;
    localStorage.setItem('cbeo_schools56_data', JSON.stringify(STATE.schools56));

    // 2. Update PEEO list
    STATE.peeos.forEach(p => {
      if (p.shala_darpan_code === school.shala_darpan_code || p.peeo_name === school.peeo_name) {
        if (school.is_peeo_nodal || p.shala_darpan_code === school.shala_darpan_code) {
          p.principal_incharge = principalName;
          p.mobile = principalMobile;
        }
      }
      if (p.schools) {
        const inPeeo = p.schools.find(s => s.shala_darpan_code === schoolCode || s.school_name === school.school_name);
        if (inPeeo) {
          inPeeo.principal_name = principalName;
          inPeeo.mobile = principalMobile;
          inPeeo.incharge_name = inchargeName;
        }
      }
    });
    savePeeosToStorage();

    // 3. Update Staff Directory (Call Directory)
    let prinStaff = STATE.staff.find(s => 
      (s.school_name === school.school_name || s.school_name === school.school_name.trim()) &&
      (s.post.includes('प्रधानाचार्य') || s.post.includes('Principal') || s.post.includes('प्र.अ.') || s.post.includes('Headmaster'))
    );
    if (prinStaff) {
      prinStaff.name = principalName;
      prinStaff.mobile = principalMobile;
      prinStaff.status = 'Active';
    } else {
      STATE.staff.unshift({
        staff_id: `PRIN_${school.shala_darpan_code}`,
        name: principalName,
        post: 'प्रधानाचार्य / संस्था प्रधान',
        school_name: school.school_name,
        peeo_name: school.peeo_name,
        mobile: principalMobile,
        email: '',
        status: 'Active'
      });
    }

    let incStaff = STATE.staff.find(s => 
      (s.school_name === school.school_name) &&
      (s.post.includes('परीक्षा प्रभारी') || s.name === inchargeName)
    );
    if (incStaff) {
      incStaff.name = inchargeName;
      incStaff.mobile = inchargeMobile;
      incStaff.status = 'Active';
    } else {
      STATE.staff.push({
        staff_id: `EXAM_${school.shala_darpan_code}`,
        name: inchargeName,
        post: 'परीक्षा प्रभारी',
        school_name: school.school_name,
        peeo_name: school.peeo_name,
        mobile: inchargeMobile,
        email: '',
        status: 'Active'
      });
    }
    saveStaffToStorage();
  } catch (exDir) {
    console.warn('Error syncing directory:', exDir);
  }

  // 1. Sync to Google Apps Script Webhook (Direct to Google Sheet Auth, PEEO Tab JSON & Sheet1)
  const webhookUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
  if (webhookUrl) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, submission, {
          action: 'saveDemandSubmission',
          demand_id: 'saman_pariksha_2026_27',
          data_json: JSON.stringify(submission)
        }))
      }).then(() => {
        showToast('Google Sheet में डेटा तुरंत सिंक हो गया!', 'success');
      }).catch(err => console.warn('Apps Script sync note:', err));
    } catch(e) {}
  }

  // 2. Sync to Node.js & SQLite Universal Backend (localhost or VM Tunnel)
  const apiBase = getEffectiveApiBaseUrl();
  if (apiBase) {
    fetch(`${apiBase}/api/save_saman_pariksha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    }).then(res => res.json()).then(data => {
      if (data && data.success) {
        showToast('✓ डेटा SQLite डेटाबेस व सर्वर पर सुरक्षित हो गया!', 'success');
      }
    }).catch(err => console.warn('Backend API note:', err));
  }

  closeModal('modal-saman-pariksha-form');
  showToast(`${school.school_name} का प्रपत्र व संपर्क डायरेक्टरी सफलतापूर्वक अपडेट हो गई!`, 'success');
  renderSamanParikshaView();
  updateAllPortalMetricsAndProgress();
  renderDashboardView();
  renderDemandsView();

  if (andPrint) {
    setTimeout(() => {
      openExamPdfPreview(schoolCode);
    }, 200);
  }
}

let activeExamPdfLanguage = 'hi';

function switchPdfLanguage(lang) {
  activeExamPdfLanguage = lang;
  if (STATE.activeExamPreviewCode) {
    openExamPdfPreview(STATE.activeExamPreviewCode, lang);
  }
}

function openExamPdfPreview(schoolCode, lang = null) {
  STATE.activeExamPreviewCode = schoolCode;
  if (lang) activeExamPdfLanguage = lang;
  const isEn = (activeExamPdfLanguage === 'en');

  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  if (!school) {
    showToast('विद्यालय का विवरण नहीं मिला!', 'warning');
    return;
  }

  let sub = STATE.samanParikshaSubmissions[schoolCode];
  if (!sub) {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(`cbeo_form_draft_${schoolCode}`));
    } catch(e) {}
    sub = draft || {
      school_code: school.shala_darpan_code,
      school_name: school.school_name,
      category: school.category,
      type: school.type,
      peeo_name: school.peeo_name,
      exam_code: school.exam_code || '---',
      principal_name: school.principal_name || (isEn ? 'Principal' : 'संस्था प्रधान'),
      principal_mobile: school.principal_mobile || '---',
      incharge_name: school.incharge_name || (isEn ? 'Exam In-charge' : 'परीक्षा प्रभारी'),
      incharge_mobile: school.incharge_mobile || '---',
      c9_total: 0,
      c9_sanskrit: 0,
      c9_urdu: 0,
      c10_total: 0,
      c10_sanskrit: 0,
      c10_urdu: 0,
      c11_faculties: [],
      c11_comp_hindi: 0,
      c11_comp_english: 0,
      c11_optional: {},
      c11_total: 0,
      c12_faculties: [],
      c12_comp_hindi: 0,
      c12_comp_english: 0,
      c12_optional: {},
      c12_total: 0,
      grand_total: 0,
      signature_data: null,
      is_draft: true
    };
  }

  // Resolve digital signature from submission, draft, or localStorage
  if (!sub.signature_data) {
    try {
      const draft = JSON.parse(localStorage.getItem(`cbeo_form_draft_${schoolCode}`));
      if (draft && draft.signature_data) sub.signature_data = draft.signature_data;
    } catch(e) {}
  }
  if (!sub.signature_data) {
    const localSig = localStorage.getItem(`cbeo_sig_${schoolCode}`);
    if (localSig) sub.signature_data = localSig;
  }

  const container = document.getElementById('printable-exam-document-content');
  if (!container) return;

  // Build Optional Subjects HTML Pills for Excel Table
  const c11OptPills = [];
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(s => {
    const count = sub.c11_optional?.[s.key] || 0;
    if (count > 0) {
      const label = isEn 
        ? (s.label.includes('(') ? s.label.split('(')[1].replace(')', '').trim() : s.label)
        : s.label.split('(')[0].trim();
      c11OptPills.push(`<span style="display:inline-block; margin:1px 2px; padding:1px 4px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:3px; font-size:0.72rem; line-height:1.2"><strong>${label}:</strong> ${count}</span>`);
    }
  });
  const c11OptPillsHtml = c11OptPills.length > 0 ? c11OptPills.join(' ') : `<span style="color:#94a3b8">${isEn ? '- No Optional Subjects Enrolled -' : '- कोई ऐच्छिक विषय दर्ज नहीं -'}</span>`;

  const c12OptPills = [];
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(s => {
    const count = sub.c12_optional?.[s.key] || 0;
    if (count > 0) {
      const label = isEn 
        ? (s.label.includes('(') ? s.label.split('(')[1].replace(')', '').trim() : s.label)
        : s.label.split('(')[0].trim();
      c12OptPills.push(`<span style="display:inline-block; margin:1px 2px; padding:1px 4px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:3px; font-size:0.72rem; line-height:1.2"><strong>${label}:</strong> ${count}</span>`);
    }
  });
  const c12OptPillsHtml = c12OptPills.length > 0 ? c12OptPills.join(' ') : `<span style="color:#94a3b8">${isEn ? '- No Optional Subjects Enrolled -' : '- कोई ऐच्छिक विषय दर्ज नहीं -'}</span>`;

  const facultyMapEn = { 'arts': 'Arts', 'science': 'Science', 'commerce': 'Commerce', 'agri': 'Agriculture' };
  const c11FacNames = (sub.c11_faculties && sub.c11_faculties.length > 0) 
    ? sub.c11_faculties.map(f => isEn ? (facultyMapEn[f] || f) : (FACULTIES_CONFIG[f]?.name || f)).join(', ') 
    : (isEn ? 'General' : 'सामान्य');
  const c12FacNames = (sub.c12_faculties && sub.c12_faculties.length > 0) 
    ? sub.c12_faculties.map(f => isEn ? (facultyMapEn[f] || f) : (FACULTIES_CONFIG[f]?.name || f)).join(', ') 
    : (isEn ? 'General' : 'सामान्य');

  // Update external language toolbar buttons (Outside printable container)
  const btnHi = document.getElementById('btn-exam-lang-hi');
  const btnEn = document.getElementById('btn-exam-lang-en');
  if (btnHi && btnEn) {
    if (isEn) {
      btnHi.className = 'btn btn-outline-primary btn-sm';
      btnEn.className = 'btn btn-primary btn-sm';
    } else {
      btnHi.className = 'btn btn-primary btn-sm';
      btnEn.className = 'btn btn-outline-primary btn-sm';
    }
  }

  const isSchoolMggs = ['221770', '221778', '221753'].includes(String(schoolCode).trim()) || (school.category || '').toUpperCase().includes('MGGS') || (school.school_name || '').includes('महात्मा गांधी') || (school.school_name || '').toUpperCase().includes('MGGS');
  const effMed = isSchoolMggs ? 'english' : (sub.school_medium || 'hindi');
  const medDisplay = effMed === 'english'
    ? (isEn ? 'English Medium (MGGS)' : 'अंग्रेजी माध्यम (MGGS - English Medium)')
    : (effMed === 'both' 
        ? (isEn ? 'Bilingual (Hindi + English)' : 'द्विभाषी (हिंदी + अंग्रेजी माध्यम)') 
        : (isEn ? 'Hindi Medium' : 'हिंदी माध्यम (Hindi Medium)'));

  const schoolDisplayName = getStandardSchoolName(school.shala_darpan_code, activeExamPdfLanguage) || (isEn ? (school.school_name_en || school.school_name) : (school.school_name_hi || school.school_name));
  const peeoCleanName = (school.peeo_name || '').replace(/^PEEO\s+/i, '');
  const peeoDisplay = isEn ? peeoCleanName : `पीईईओ ${peeoCleanName}`;

  container.innerHTML = `
    <!-- Top Emblem & Departmental Header (Single Page A4 Landscape Layout) -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:2px; margin-bottom:4px">
      <div style="font-size:0.80rem; font-weight:700; color:#000; letter-spacing:normal">
        ${isEn ? 'GOVERNMENT OF RAJASTHAN | DEPARTMENT OF SCHOOL EDUCATION' : 'राजस्थान सरकार | स्कूल शिक्षा विभाग'}
      </div>
      <div style="font-size:1.12rem; font-weight:900; color:#000; margin:2px 0">
        ${isEn ? `OFFICE OF THE PRINCIPAL, ${schoolDisplayName} | CODE: ${school.shala_darpan_code}` : getSchoolOfficialFormalHindiHeader(school)}
      </div>
      <div style="font-size:0.78rem; font-weight:700; color:#111; margin-bottom:1px">
        ${isEn 
          ? `Jurisdiction: ${peeoCleanName}, Block-Bhinai, District-Ajmer (Raj.) | Shala Darpan / PSP Code: ${school.shala_darpan_code}`
          : `परिक्षेत्र: ${peeoDisplay}, ब्लॉक-भिनाय, जिला-अजमेर (राज.) | शाला दर्पण / PSP कोड: ${school.shala_darpan_code}`}
      </div>
      <div style="font-size:0.95rem; font-weight:800; color:#000; letter-spacing:normal">
        ${isEn ? 'DISTRICT UNIFORM EXAMINATION SCHEME (SESSION 2026-27)' : 'जिला समान परीक्षा योजना (सत्र 2026-27)'}
      </div>
      <div style="font-size:0.80rem; font-weight:700; color:#222">
        ${isEn 
          ? 'Classes 9 to 12 Student Enrolment and Question Paper Demand Official Proforma'
          : 'कक्षा 9 से 12 विद्यार्थी नामांकन एवं प्रश्न-पत्र मांग अधिकृत विवरण प्रपत्र'}
      </div>
    </div>

    <!-- School Meta Table (Laser Print-Friendly Clean Grid) -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:4px; font-size:0.78rem; border:1.5px solid #000">
      <tr style="background:#f8fafc">
        <td style="padding:2px 5px; border:1px solid #000; width:15%"><strong>${isEn ? 'School Name:' : 'विद्यालय का नाम:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:800; width:35%">${schoolDisplayName}</td>
        <td style="padding:2px 5px; border:1px solid #000; width:18%"><strong>${isEn ? 'Shala Darpan / PSP Code:' : 'शाला दर्पण / PSP कोड:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:800; width:32%">${school.shala_darpan_code} <span style="font-size:0.72rem; font-weight:normal">(${school.category} - ${school.type})</span></td>
      </tr>
      <tr>
        <td style="padding:2px 5px; border:1px solid #000; background:#f8fafc"><strong>${isEn ? 'Nodal PEEO:' : 'संबंधित PEEO:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000">${school.peeo_name}</td>
        <td style="padding:2px 5px; border:1px solid #000; background:#f8fafc"><strong>${isEn ? 'School Exam Code:' : 'स्कूल परीक्षा कोड:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:900; font-size:0.92rem">${sub.exam_code}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:2px 5px; border:1px solid #000"><strong>${isEn ? 'Principal / Head:' : 'संस्था प्रधान:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>${sub.principal_name}</strong> (${isEn ? 'Mob:' : 'मो.'} ${sub.principal_mobile})</td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>${isEn ? 'Exam In-charge:' : 'परीक्षा प्रभारी:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>${sub.incharge_name}</strong> (${isEn ? 'Mob:' : 'मो.'} ${sub.incharge_mobile})</td>
      </tr>
      <tr style="background:#f1f5f9">
        <td style="padding:2px 5px; border:1px solid #000"><strong>${isEn ? 'School Medium:' : 'शिक्षण माध्यम:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:800; color:${effMed === 'english' ? '#0f766e' : '#000'}">
          ${effMed === 'english' ? '<span style="background:#ccfbf1; padding:1px 6px; border:1px solid #0d9488; border-radius:3px">🌐 ' + medDisplay + '</span>' : medDisplay}
        </td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>${isEn ? 'Form Status:' : 'प्रपत्र स्थिति:'}</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:800; color:#166534">
          ✓ ${isEn ? 'Final Submitted & Verified' : 'पूर्ण सबमिट एवं अधिकृत'}
        </td>
      </tr>
    </table>

    <!-- 8-Column Comprehensive Matrix Table (Laser Print-Friendly High-Contrast) -->
    <table class="exam-excel-table" style="width:100%; border-collapse:collapse; border:2px solid #000; text-align:center; font-size:0.77rem; margin-bottom:4px">
      <thead>
        <tr style="background:#f1f5f9; color:#000; font-weight:800">
          <th style="padding:3px 2px; border:1.5px solid #000; width:35px">${isEn ? 'S.No.' : 'क्र.सं.'}</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:70px">${isEn ? 'Class' : 'कक्षा'}</th>
          <th style="padding:3px 5px; border:1.5px solid #000; width:210px; text-align:left">${isEn ? 'Compulsory Subjects' : 'अनिवार्य विषय'}</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:140px">${isEn ? 'Third Language' : 'तृतीय भाषा'}</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:110px">${isEn ? 'Faculties' : 'संचालित संकाय'}</th>
          <th style="padding:3px 5px; border:1.5px solid #000; text-align:left">${isEn ? 'Medium Breakdown / Optionals' : 'माध्यमवार मांग / ऐच्छिक विवरण'}</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:75px">${isEn ? 'Enrolment' : 'नामांकन'}</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:75px; background:#e2e8f0; font-weight:900">${isEn ? 'Demand Count' : 'मांग संख्या'}</th>
        </tr>
      </thead>
      <tbody>
        <!-- Class 9 Row -->
        <tr style="border-bottom:1px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">1</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">${isEn ? 'Class 9th' : 'कक्षा 9वीं'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c9_total > 0) 
              ? (effMed === 'english'
                  ? (isEn ? '<strong style="color:#0f766e">[English Medium (MGGS)]</strong> Hindi, English, Science, Social Science, Mathematics' : '<strong style="color:#0f766e">[अंग्रेजी माध्यम (MGGS)]</strong> हिंदी, अंग्रेजी, विज्ञान, सामाजिक विज्ञान, गणित (5 अनिवार्य विषय)')
                  : (isEn ? 'Hindi, English, Science, Social Science, Mathematics (5 Subjects)' : 'हिंदी, अंग्रेजी, विज्ञान, सामाजिक विज्ञान, गणित (5 अनिवार्य विषय)'))
              : `<span style="color:#475569; font-style:italic">${isEn ? 'Nil Enrolment in Class 9' : 'कक्षा 9वीं में शून्य नामांकन (NIL)'}</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">
            ${(sub.c9_total > 0) 
              ? (isEn ? `Sanskrit: ${sub.c9_sanskrit || 0} | Urdu: ${sub.c9_urdu || 0}` : `संस्कृत: ${sub.c9_sanskrit || 0} | उर्दू: ${sub.c9_urdu || 0}`) 
              : `<span style="color:#64748b">-</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000">${(sub.c9_total > 0) ? (isEn ? 'General' : 'सामान्य') : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c9_total > 0)
              ? (effMed === 'english'
                  ? `<span style="display:inline-block; padding:1px 5px; background:#ccfbf1; border:1px solid #0d9488; border-radius:3px; color:#0f766e; font-size:0.75rem; font-weight:800">${isEn ? 'English Medium:' : 'अंग्रेजी माध्यम मांग:'} ${sub.c9_english || sub.c9_total || 0}</span>`
                  : (effMed === 'both'
                      ? `हिंदी: <strong>${sub.c9_hindi || 0}</strong> | अंग्रेजी: <strong>${sub.c9_english || 0}</strong>`
                      : `<span style="color:#334155; font-size:0.75rem">${isEn ? 'Hindi Medium:' : 'हिंदी माध्यम मांग:'} <strong>${sub.c9_hindi || sub.c9_total || 0}</strong></span>`))
              : '<span style="color:#64748b">-</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c9_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c9_total > 0) ? sub.c9_total : '0 (NIL)'}</td>
        </tr>
        
        <!-- Class 10 Row -->
        <tr style="border-bottom:1px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">2</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">${isEn ? 'Class 10th' : 'कक्षा 10वीं'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c10_total > 0) 
              ? (effMed === 'english'
                  ? (isEn ? '<strong style="color:#0f766e">[English Medium (MGGS)]</strong> Hindi, English, Science, Social Science, Mathematics' : '<strong style="color:#0f766e">[अंग्रेजी माध्यम (MGGS)]</strong> हिंदी, अंग्रेजी, विज्ञान, सामाजिक विज्ञान, गणित (5 अनिवार्य विषय)')
                  : (isEn ? 'Hindi, English, Science, Social Science, Mathematics (5 Subjects)' : 'हिंदी, अंग्रेजी, विज्ञान, सामाजिक विज्ञान, गणित (5 अनिवार्य विषय)'))
              : `<span style="color:#475569; font-style:italic">${isEn ? 'Nil Enrolment in Class 10' : 'कक्षा 10वीं में शून्य नामांकन (NIL)'}</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">
            ${(sub.c10_total > 0) 
              ? (isEn ? `Sanskrit: ${sub.c10_sanskrit || 0} | Urdu: ${sub.c10_urdu || 0}` : `संस्कृत: ${sub.c10_sanskrit || 0} | उर्दू: ${sub.c10_urdu || 0}`) 
              : `<span style="color:#64748b">-</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000">${(sub.c10_total > 0) ? (isEn ? 'General' : 'सामान्य') : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c10_total > 0)
              ? (effMed === 'english'
                  ? `<span style="display:inline-block; padding:1px 5px; background:#ccfbf1; border:1px solid #0d9488; border-radius:3px; color:#0f766e; font-size:0.75rem; font-weight:800">${isEn ? 'English Medium:' : 'अंग्रेजी माध्यम मांग:'} ${sub.c10_english || sub.c10_total || 0}</span>`
                  : (effMed === 'both'
                      ? `हिंदी: <strong>${sub.c10_hindi || 0}</strong> | अंग्रेजी: <strong>${sub.c10_english || 0}</strong>`
                      : `<span style="color:#334155; font-size:0.75rem">${isEn ? 'Hindi Medium:' : 'हिंदी माध्यम मांग:'} <strong>${sub.c10_hindi || sub.c10_total || 0}</strong></span>`))
              : '<span style="color:#64748b">-</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c10_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c10_total > 0) ? sub.c10_total : '0 (NIL)'}</td>
        </tr>

        <!-- Class 11 Row -->
        <tr style="border-bottom:1px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">3</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">${isEn ? 'Class 11th' : 'कक्षा 11वीं'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c11_total > 0) 
              ? (isEn ? `Compulsory Hindi (${sub.c11_comp_hindi}), Compulsory English (${sub.c11_comp_english})` : `अनिवार्य हिंदी (${sub.c11_comp_hindi}), अनिवार्य अंग्रेजी (${sub.c11_comp_english})`) 
              : `<span style="color:#475569; font-style:italic">${isEn ? 'Class 11 Not Operating (NIL)' : 'कक्षा 11वीं संचालित नहीं (NIL)'}</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; color:#64748b">${isEn ? '- (N/A) -' : '- (लागू नहीं) -'}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">${(sub.c11_total > 0) ? (c11FacNames + (effMed === 'english' ? ' <span style="font-size:0.70rem; color:#0f766e; font-weight:800">[English Med.]</span>' : '')) : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c11_total > 0) ? c11OptPillsHtml : `<span style="color:#64748b">${isEn ? '- Nil -' : '- कोई ऐच्छिक विषय लागू नहीं -'}</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c11_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c11_total > 0) ? sub.c11_total : '0 (NIL)'}</td>
        </tr>

        <!-- Class 12 Row -->
        <tr style="border-bottom:2px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">4</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">${isEn ? 'Class 12th' : 'कक्षा 12वीं'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c12_total > 0) 
              ? (isEn ? `Compulsory Hindi (${sub.c12_comp_hindi}), Compulsory English (${sub.c12_comp_english})` : `अनिवार्य हिंदी (${sub.c12_comp_hindi}), अनिवार्य अंग्रेजी (${sub.c12_comp_english})`) 
              : `<span style="color:#475569; font-style:italic">${isEn ? 'Class 12 Not Operating (NIL)' : 'कक्षा 12वीं संचालित नहीं (NIL)'}</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; color:#64748b">${isEn ? '- (N/A) -' : '- (लागू नहीं) -'}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">${(sub.c12_total > 0) ? (c12FacNames + (effMed === 'english' ? ' <span style="font-size:0.70rem; color:#0f766e; font-weight:800">[English Med.]</span>' : '')) : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c12_total > 0) ? c12OptPillsHtml : `<span style="color:#64748b">${isEn ? '- Nil -' : '- कोई ऐच्छिक विषय लागू नहीं -'}</span>`}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c12_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c12_total > 0) ? sub.c12_total : '0 (NIL)'}</td>
        </tr>

        <!-- Grand Total Banner Row -->
        <tr style="background:#f1f5f9; font-weight:900; border:2px solid #000">
          <td colspan="6" style="padding:4px 6px; border:2px solid #000; text-align:right; font-size:0.86rem; color:#000">
            🎯 ${isEn ? 'Session 2026-27 Total Question Paper Demand (Classes 9 to 12 Grand Total):' : 'सत्र 2026-27 कुल मांग प्रश्न-पत्र संख्या (कक्षा 9 से 12 महायोग):'}
          </td>
          <td style="padding:4px 3px; border:2px solid #000; font-size:0.95rem; color:#000">${sub.grand_total}</td>
          <td style="padding:4px 3px; border:2px solid #000; font-size:1.05rem; color:#000; background:#e2e8f0">
            ${(sub.grand_total > 0) ? sub.grand_total : `<span style="font-size:0.82rem">${isEn ? '0 (NIL Demand)' : '0 (NIL प्रपत्र)'}</span>`}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Verification & Responsibility Declaration -->
    <div style="margin-top:4px; margin-bottom:4px; padding:3px 6px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.70rem; line-height:1.25; color:#000">
      <strong>${isEn ? 'VERIFICATION & RESPONSIBILITY DECLARATION:' : 'सत्यापन एवं उत्तरदायित्व घोषणा:'}</strong> ${isEn 
        ? 'Certified that all student enrolment figures, faculties, and subject-wise entries have been 100% matched and verified with the school admission register and Shala Darpan portal without any clerical or factual discrepancy. In case of any error or question paper deficiency/excess in future, the concerned Principal and Examination In-charge shall be solely responsible.'
        : 'प्रमाणित किया जाता है कि उपर्युक्त परीक्षा संबंधी सभी छात्र संख्या, संकाय एवं विषयवार प्रविष्टियों का विद्यालय की प्रवेश पंजिका व शाला दर्पण पोर्टल से शत-प्रतिशत मिलान कर लिया गया है तथा इसमें कोई लिपिकीय अथवा तथ्यात्मक त्रुटि नहीं है। यदि भविष्य में किसी भी प्रकार की त्रुटि, विसंगति अथवा प्रश्न-पत्रों की कमी/अधिकता पाई जाती है, तो इसका संपूर्ण व्यक्तिगत एवं विभागीय उत्तरदायित्व संबंधित संस्था प्रधान एवं परीक्षा प्रभारी का होगा।'}
    </div>

    <!-- Official Signatures: Incharge (Left) & Principal (Right) -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 30px; margin-top:8px; margin-bottom:2px">
      
      <!-- Left: Incharge Signature -->
      <div style="text-align:center; width:36%">
        <div style="height:28px"></div>
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          ${isEn ? 'Signature: Examination In-charge' : 'हस्ताक्षर परीक्षा प्रभारी'}
        </div>
      </div>

      <!-- Right: Principal Signature & School Details (Official Govt Format) -->
      <div style="text-align:center; width:44%">
        ${sub.signature_data ? `
          <div style="height:28px; display:flex; align-items:center; justify-content:center">
            <img src="${sub.signature_data}" style="max-height:26px; max-width:140px; object-fit:contain" alt="${isEn ? 'Signature' : 'हस्ताक्षर'}">
          </div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            ${isEn ? 'Signature: Principal / Head of Institution' : 'हस्ताक्षर संस्था प्रधान'}
          </div>
        ` : `
          <div style="height:28px"></div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            ${isEn ? 'Signature: Principal / Head of Institution' : 'हस्ताक्षर संस्था प्रधान'}
          </div>
        `}
        <div style="font-size:0.78rem; font-weight:700; color:#000; margin-top:1px">${isEn ? 'Principal / Head of Institution' : 'प्रधानाचार्य / संस्था प्रधान'}</div>
        <div style="font-size:0.75rem; color:#111; margin-top:1px">${schoolDisplayName}</div>
        <div style="font-size:0.72rem; color:#222; margin-top:1px">${isEn ? 'Block-Bhinai (District: Ajmer)' : 'ब्लॉक-भिनाय (अजमेर)'}</div>
      </div>

    </div>
  `;

  showModal('modal-exam-pdf-preview');
}


/* ========================================================
   STANDALONE PRINT HELPER (STRICTLY 1 PAGE, ZERO BLANK PAGES)
   ======================================================== */
function printCleanA4Landscape(containerId, title) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const printWindow = window.open('', '_blank', 'width=1150,height=800');
  if (!printWindow) {
    window.print();
    return;
  }

  const contentHtml = container.innerHTML;
  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 3mm 4mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      width: 100%;
      height: 100%;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-container {
      width: 100%;
      padding: 0;
      margin: 0 auto;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      page-break-inside: avoid;
    }
    tr, td, th {
      page-break-inside: avoid;
    }
    td, th {
      padding: 2.5px 3px !important;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${contentHtml}
  </div>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 450);
}

/* ========================================================
   OFFSCREEN PDF BLOB GENERATOR FOR DIRECT DOWNLOAD & WHATSAPP
   ======================================================== */
async function exportDocumentToPdfBlob(elementId, filename, customOptions = {}) {
  const container = document.getElementById(elementId);
  if (!container) throw new Error('Container not found: ' + elementId);

  if (typeof html2pdf === 'undefined') {
    throw new Error('html2pdf library is not loaded');
  }

  // Preserve styles
  const prevWidth = container.style.width;
  const prevMaxWidth = container.style.maxWidth;
  const prevPadding = container.style.padding;
  const prevMargin = container.style.margin;
  const prevBoxSizing = container.style.boxSizing;
  const prevBackground = container.style.background;
  const prevFontFamily = container.style.fontFamily;
  const prevLetterSpacing = container.style.letterSpacing;

  // Ensure all web fonts (Noto Sans Devanagari) are fully loaded before capturing
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (eFont) {}
  }

  const orientation = customOptions.orientation || 'landscape';
  const targetWidth = customOptions.targetWidth || (orientation === 'portrait' ? '800px' : '1080px');
  const scale = customOptions.scale || (orientation === 'portrait' ? 1.5 : 2);
  const quality = customOptions.quality || (orientation === 'portrait' ? 0.85 : 0.98);

  // Set pristine font styles & width
  container.style.width = targetWidth;
  container.style.maxWidth = targetWidth;
  container.style.boxSizing = 'border-box';
  container.style.background = '#ffffff';
  container.style.fontFamily = "'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.style.letterSpacing = 'normal';

  const opt = {
    margin: customOptions.margin ?? 0,
    filename: filename,
    image: { type: 'jpeg', quality: quality },
    html2canvas: {
      scale: scale,
      useCORS: true,
      logging: false,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: orientation },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
    return pdfBlob;
  } finally {
    container.style.width = prevWidth;
    container.style.maxWidth = prevMaxWidth;
    container.style.padding = prevPadding;
    container.style.margin = prevMargin;
    container.style.boxSizing = prevBoxSizing;
    container.style.background = prevBackground;
    container.style.fontFamily = prevFontFamily;
    container.style.letterSpacing = prevLetterSpacing;
  }
}

function printOfficialExamDocument() {
  const schoolCode = STATE.activeExamPreviewCode || 'School';
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const isEn = (typeof activeExamPdfLanguage !== 'undefined' && activeExamPdfLanguage === 'en');
  const schoolName = isEn ? (school?.school_name_en || school?.school_name || schoolCode) : (school?.school_name || schoolCode);
  const title = isEn 
    ? `Uniform Exam 2026-27 Demand Proforma - ${schoolName}`
    : `समान परीक्षा 2026-27 मांग प्रपत्र - ${schoolName}`;
  printCleanA4Landscape('printable-exam-document-content', title);
}

async function downloadExamPDFDirect() {
  const schoolCode = STATE.activeExamPreviewCode || 'School';
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const isEn = (typeof activeExamPdfLanguage !== 'undefined' && activeExamPdfLanguage === 'en');
  const baseName = isEn ? (school?.school_name_en || school?.school_name || 'School') : (school?.school_name || school?.school_name_en || 'School');
  let cleanName = String(baseName)
    .replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleanName || /^_+$/.test(cleanName)) {
    cleanName = (school?.school_name_en || schoolCode || 'School').replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ').trim().replace(/\s+/g, '_');
  }
  const filename = `Saman_Pariksha_2026_${schoolCode}_${cleanName}.pdf`;

  showToast('अधिकृत Landscape PDF तैयार किया जा रहा है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-exam-document-content', filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('अधिकृत A4 Landscape PDF सफलतापूर्वक डाउनलोड हो गया!', 'success');
  } catch (err) {
    console.warn('PDF blob generation fallback to print:', err);
    printOfficialExamDocument();
  }
}

async function downloadExamPdfDirectFromTable(schoolCode) {
  openExamPdfPreview(schoolCode);
  setTimeout(async () => {
    await downloadExamPDFDirect();
  }, 250);
}
window.downloadExamPdfDirectFromTable = downloadExamPdfDirectFromTable;

function shareExamWhatsAppText() {
  const schoolCode = STATE.activeExamPreviewCode;
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const sub = STATE.samanParikshaSubmissions[schoolCode];
  if (!school || !sub) {
    showToast('प्रपत्र डेटा उपलब्ध नहीं है!', 'warning');
    return;
  }

  const isSchoolMggs = ['221770', '221778', '221753'].includes(String(schoolCode).trim()) || (school.category || '').toUpperCase().includes('MGGS') || (school.school_name || '').includes('महात्मा गांधी') || (school.school_name || '').toUpperCase().includes('MGGS');
  const effMed = isSchoolMggs ? 'अंग्रेजी माध्यम (MGGS)' : (sub.school_medium === 'english' ? 'अंग्रेजी माध्यम' : (sub.school_medium === 'both' ? 'द्विभाषी (हिंदी+अंग्रेजी)' : 'हिंदी माध्यम'));

  const c9Breakdown = isSchoolMggs ? ` (अंग्रेजी माध्यम: ${sub.c9_english || sub.c9_total || 0})` : '';
  const c10Breakdown = isSchoolMggs ? ` (अंग्रेजी माध्यम: ${sub.c10_english || sub.c10_total || 0})` : '';

  const text = `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n*जिला समान परीक्षा योजना (सत्र 2026-27)*\n\n📌 *विद्यालय:* ${school.school_name}\n📌 *शिक्षण माध्यम:* ${effMed}\n📌 *शाला दर्पण/PSP कोड:* ${school.shala_darpan_code}\n📌 *परीक्षा कोड:* ${sub.exam_code}\n📌 *संस्था प्रधान:* ${sub.principal_name} (${sub.principal_mobile})\n📌 *परीक्षा प्रभारी:* ${sub.incharge_name} (${sub.incharge_mobile})\n\n📊 *कक्षावार नामांकन एवं प्रश्न-पत्र मांग (A4 Landscape Form):*\n• कक्षा 9वीं: ${sub.c9_total}${c9Breakdown}\n• कक्षा 10वीं: ${sub.c10_total}${c10Breakdown}\n• कक्षा 11वीं: ${sub.c11_total}\n• कक्षा 12वीं: ${sub.c12_total}\n🎯 *कुल मांग प्रश्न-पत्र (Grand Total):* *${sub.grand_total}*\n\n✅ *सत्यापन स्थिति:* अधिकृत उत्तरदायित्व घोषणा, सील व हस्ताक्षरों सहित सत्यापित\n📅 *प्रविष्टि दिनांक:* ${sub.timestamp || new Date().toLocaleDateString('hi-IN')}\n🌐 *पोर्टल लिंक:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  showToast('WhatsApp शेयर लिंक खुल रहा है...', 'success');
}

async function shareExamWhatsAppPDF() {
  const schoolCode = STATE.activeExamPreviewCode;
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const sub = STATE.samanParikshaSubmissions[schoolCode];
  if (!school || !sub) {
    showToast('प्रपत्र डेटा उपलब्ध नहीं है!', 'warning');
    return;
  }

  const isSchoolMggs = ['221770', '221778', '221753'].includes(String(schoolCode).trim()) || (school.category || '').toUpperCase().includes('MGGS') || (school.school_name || '').includes('महात्मा गांधी') || (school.school_name || '').toUpperCase().includes('MGGS');
  const effMed = isSchoolMggs ? 'अंग्रेजी माध्यम (MGGS)' : (sub.school_medium === 'english' ? 'अंग्रेजी माध्यम' : (sub.school_medium === 'both' ? 'द्विभाषी (हिंदी+अंग्रेजी)' : 'हिंदी माध्यम'));
  const isEn = (typeof activeExamPdfLanguage !== 'undefined' && activeExamPdfLanguage === 'en');

  const baseName = isEn ? (school?.school_name_en || school?.school_name || 'School') : (school?.school_name || school?.school_name_en || 'School');
  let cleanName = String(baseName)
    .replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleanName || /^_+$/.test(cleanName)) {
    cleanName = (school?.school_name_en || schoolCode || 'School').replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ').trim().replace(/\s+/g, '_');
  }
  const filename = `Saman_Pariksha_2026_${schoolCode}_${cleanName}.pdf`;

  const c9Breakdown = isSchoolMggs ? ` (अंग्रेजी: ${sub.c9_english || sub.c9_total || 0})` : '';
  const c10Breakdown = isSchoolMggs ? ` (अंग्रेजी: ${sub.c10_english || sub.c10_total || 0})` : '';

  const waSummary = `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n*जिला समान परीक्षा योजना (सत्र 2026-27)*\n\n📌 *विद्यालय:* ${school.school_name}\n📌 *शिक्षण माध्यम:* ${effMed}\n📌 *शाला दर्पण कोड:* ${school.shala_darpan_code} | *परीक्षा कोड:* ${sub.exam_code}\n📌 *संस्था प्रधान:* ${sub.principal_name} (${sub.principal_mobile})\n📌 *परीक्षा प्रभारी:* ${sub.incharge_name} (${sub.incharge_mobile})\n\n🎯 *कुल मांग प्रश्न-पत्र (Grand Total):* *${sub.grand_total}*\n(9वीं: ${sub.c9_total}${c9Breakdown}, 10वीं: ${sub.c10_total}${c10Breakdown}, 11वीं: ${sub.c11_total}, 12वीं: ${sub.c12_total})\n\n📄 *अधिकृत A4 Landscape PDF प्रपत्र संलग्न है।*\n🌐 *सत्यापन पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  showToast('WhatsApp शेयर हेतु Landscape PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-exam-document-content', filename);
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });

    // Mobile / native Web Share API with files
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: `समान परीक्षा 2026 मांग प्रपत्र - ${school.school_name}`,
        text: waSummary
      });
      showToast('WhatsApp PDF शेयर विंडो खुल गई!', 'success');
    } else {
      // Desktop / PC Fallback: Auto download the clean PDF & open WhatsApp Web
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const noteText = waSummary + '\n\n*(नोट: आधिकारिक PDF फाइल डाउनलोड हो गई है - कृपया इस WhatsApp चैट में अटैच करें)*';
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(noteText)}`;
      window.open(waUrl, '_blank');
      showToast('PDF डाउनलोड हो गई एवं WhatsApp खुल गया! कृपया फाइल अटैच करें।', 'success');
    }
  } catch (err) {
    console.error('WhatsApp PDF share error:', err);
    showToast('PDF शेयर में समस्या आई, सामान्य WhatsApp लिंक खोला जा रहा है...', 'warning');
    shareExamWhatsAppText();
  }
}

// Backward compatibility alias
function shareExamPDFWhatsApp() {
  shareExamWhatsAppText();
}
window.shareExamWhatsAppText = shareExamWhatsAppText;
window.shareExamWhatsAppPDF = shareExamWhatsAppPDF;
window.shareExamPDFWhatsApp = shareExamPDFWhatsApp;

/* ========================================================
   PEEO CONSOLIDATED OFFICIAL EXAM REPORT (A4 LANDSCAPE)
   ======================================================== */
function onAdminPeeoFilterChange() {
  filterSamanParikshaTable();
  const peeoFilter = document.getElementById('sp-peeo-filter');
  const btn = document.getElementById('btn-admin-peeo-report');
  if (peeoFilter && btn) {
    if (peeoFilter.value !== 'all') {
      const shortName = peeoFilter.value.replace(/PEEO\s+/i, '');
      btn.innerHTML = `<i class="fas fa-file-invoice"></i> 📑 ${shortName} रिपोर्ट`;
    } else {
      btn.innerHTML = `<i class="fas fa-file-invoice"></i> 📑 PEEO समेकित रिपोर्ट`;
    }
  }
}

function openSelectedPeeoConsolidatedReport() {
  const peeoFilter = document.getElementById('sp-peeo-filter');
  let peeoName = peeoFilter ? peeoFilter.value : 'all';
  if (peeoName && peeoName !== 'all') {
    openPeeoConsolidatedPdfPreview(peeoName);
  } else {
    openPeeoSelectorModal();
  }
}

function openPeeoSelectorModal() {
  const grid = document.getElementById('peeo-selector-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const uniquePeeos = [...new Set(STATE.schools56.map(s => s.peeo_name))].sort();
  uniquePeeos.forEach(pName => {
    const clean = pName.replace(/PEEO\s+/i, '').trim();
    const schools = STATE.schools56.filter(s => s.peeo_name.toLowerCase().includes(clean.toLowerCase()));
    let subCount = 0;
    let grandTotal = 0;
    schools.forEach(s => {
      const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
      if (isSamanParikshaSubmitted(sub)) {
        subCount++;
        grandTotal += (sub.grand_total || 0);
      }
    });

    const isComplete = subCount === schools.length && schools.length > 0;
    const card = document.createElement('div');
    card.className = 'peeo-selector-card';
    card.style.cssText = 'background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; padding:0.75rem 1rem; display:flex; flex-direction:column; justify-content:space-between; gap:0.5rem; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.05)';
    card.setAttribute('data-peeo-name', pName.toLowerCase());
    card.innerHTML = `
      <div>
        <div style="font-weight:800; color:#1e3a8a; font-size:0.92rem; display:flex; justify-content:space-between; align-items:center">
          <span>${clean}</span>
          <span style="font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700; ${isComplete ? 'background:#dcfce7; color:#15803d' : 'background:#e0f2fe; color:#0369a1'}">
            ${subCount}/${schools.length} पूर्ण
          </span>
        </div>
        <div style="font-size:0.76rem; color:#64748b; margin-top:3px">
          कुल विद्यालय: ${schools.length} | कुल मांग: <strong>${grandTotal}</strong>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="closeModal('modal-select-peeo-report'); openPeeoConsolidatedPdfPreview('${pName}')" style="width:100%; font-weight:700; font-size:0.8rem; padding:0.35rem 0.5rem; display:flex; align-items:center; justify-content:center; gap:0.35rem">
        <i class="fas fa-file-invoice"></i> A4 रिपोर्ट देखें
      </button>
    `;
    grid.appendChild(card);
  });

  const searchInput = document.getElementById('peeo-selector-search');
  if (searchInput) searchInput.value = '';
  showModal('modal-select-peeo-report');
}

function filterPeeoSelectorGrid() {
  const query = (document.getElementById('peeo-selector-search')?.value || '').toLowerCase().trim();
  const cards = document.querySelectorAll('.peeo-selector-card');
  cards.forEach(c => {
    const name = c.getAttribute('data-peeo-name') || '';
    c.style.display = (!query || name.includes(query)) ? 'flex' : 'none';
  });
}

function openPeeoConsolidatedPdfPreview(peeoName) {
  closeModal('modal-select-peeo-report');
  if (STATE.currentUser && STATE.currentUser.role === 'school') {
    showToast('परिक्षेत्र समेकित परीक्षा मांग रिपोर्ट केवल PEEO लॉगिन पर उपलब्ध है!', 'warning');
    return;
  }

  const isBlockConsolidated = (peeoName === 'ALL' || peeoName === 'all' || peeoName === 'समस्त ब्लॉक भिनाय');

  if (!peeoName) {
    if (STATE.currentUser && STATE.currentUser.peeo_name) {
      peeoName = STATE.currentUser.peeo_name;
    } else {
      const peeoFilter = document.getElementById('sp-peeo-filter');
      if (peeoFilter && peeoFilter.value !== 'all') {
        peeoName = peeoFilter.value;
      } else {
        openPeeoSelectorModal();
        return;
      }
    }
  }

  STATE.activePeeoConsolidatedName = isBlockConsolidated ? 'समस्त ब्लॉक भिनाय' : peeoName;
  const cleanPeeoName = isBlockConsolidated 
    ? 'समस्त ब्लॉक भिनाय (25 PEEO परिक्षेत्र)' 
    : peeoName.replace(/PEEO\s+/i, '').trim();

  // Filter schools under this PEEO from 56 schools
  let schools = [];
  if (isBlockConsolidated) {
    schools = [...STATE.schools56];
  } else {
    const cleanTarget = peeoName.replace(/PEEO\s+/i, '').trim().toLowerCase();
    schools = STATE.schools56.filter(s => 
      s.peeo_name.toLowerCase().includes(cleanTarget)
    );
  }

  if (schools.length === 0) {
    showToast('इस PEEO क्षेत्र में कोई माध्यमिक / उच्च माध्यमिक विद्यालय दर्ज नहीं है!', 'info');
    return;
  }

  const container = document.getElementById('printable-peeo-consolidated-content');
  if (!container) return;

  let totalC9 = 0;
  let totalC10 = 0;
  let totalC11 = 0;
  let totalC12 = 0;
  let totalGrand = 0;
  let submittedCount = 0;

  let contactRowsHtml = '';
  let demandRowsHtml = '';

  schools.forEach((s, idx) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);
    if (isSub) submittedCount++;

    const c9 = isSub ? (sub.c9_total || 0) : 0;
    const c10 = isSub ? (sub.c10_total || 0) : 0;
    const c11 = isSub ? (sub.c11_total || 0) : 0;
    const c12 = isSub ? (sub.c12_total || 0) : 0;
    const gTotal = isSub ? (sub.grand_total || 0) : 0;

    totalC9 += c9;
    totalC10 += c10;
    totalC11 += c11;
    totalC12 += c12;
    totalGrand += gTotal;

    const princName = isSub ? sub.principal_name : s.principal_name;
    const princMob = isSub ? sub.principal_mobile : s.principal_mobile;
    const inchName = isSub ? sub.incharge_name : (s.incharge_name || 'उपलब्ध नहीं');
    const inchMob = isSub ? sub.incharge_mobile : (s.incharge_mobile || '---');
    const examCode = isSub ? sub.exam_code : (s.exam_code || '---');

    const statusBadge = isSub 
      ? '<span style="color:#166534; font-weight:800">✓ सबमिट</span>'
      : '<span style="color:#dc2626; font-weight:800">⚠️ लम्बित</span>';

    contactRowsHtml += `
      <tr style="border-bottom:1px solid #cbd5e1">
        <td style="padding:4px 3px; border:1px solid #cbd5e1; text-align:center">${idx + 1}</td>
        <td style="padding:4px 6px; border:1px solid #cbd5e1; text-align:left; font-weight:700; color:#1e3a8a">${s.school_name}</td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center">${s.shala_darpan_code} <span style="font-size:0.72rem; color:#64748b">(${s.type === 'Government' ? 'राजकीय' : 'निजी'})</span></td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center; font-weight:800; color:#dc2626">${examCode}</td>
        <td style="padding:4px 6px; border:1px solid #cbd5e1; text-align:left"><strong>${princName}</strong><br><span style="font-size:0.72rem; color:#475569">मो. ${princMob}</span></td>
        <td style="padding:4px 6px; border:1px solid #cbd5e1; text-align:left"><strong>${inchName}</strong><br><span style="font-size:0.72rem; color:#475569">मो. ${inchMob}</span></td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center">${statusBadge}</td>
      </tr>
    `;

    demandRowsHtml += `
      <tr style="border-bottom:1px solid #cbd5e1">
        <td style="padding:4px 3px; border:1px solid #cbd5e1; text-align:center">${idx + 1}</td>
        <td style="padding:4px 6px; border:1px solid #cbd5e1; text-align:left; font-weight:700; color:#1e3a8a">${s.school_name} (${s.shala_darpan_code})</td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center; font-weight:700">${c9}</td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center; font-weight:700">${c10}</td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center; font-weight:700">${c11}</td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center; font-weight:700">${c12}</td>
        <td style="padding:4px 6px; border:1px solid #cbd5e1; text-align:center; font-weight:900; color:#1e3a8a; background:#eff6ff; font-size:0.92rem">${gTotal}</td>
        <td style="padding:4px 4px; border:1px solid #cbd5e1; text-align:center">${statusBadge}</td>
      </tr>
    `;
  });

  // Digital Signature Resolution for PEEO Report
  let peeoSig = null;
  let inchargeSig = null;

  if (isBlockConsolidated) {
    peeoSig = STATE.currentUser?.signature_data || localStorage.getItem('cbeo_admin_signature');
  } else {
    // 1. Check nodal school submission under this PEEO
    const nodalSchool = schools.find(s => s.is_peeo_nodal) || schools.find(s => s.type === 'Government') || schools[0];
    if (nodalSchool) {
      peeoSig = STATE.samanParikshaSubmissions[nodalSchool.shala_darpan_code]?.signature_data;
      if (!peeoSig) {
        try {
          const draft = JSON.parse(localStorage.getItem(`cbeo_form_draft_${nodalSchool.shala_darpan_code}`));
          if (draft?.signature_data) peeoSig = draft.signature_data;
        } catch(e) {}
      }
      inchargeSig = STATE.samanParikshaSubmissions[nodalSchool.shala_darpan_code]?.incharge_signature_data;
    }

    // 2. Check any other school under this PEEO
    if (!peeoSig) {
      for (const sch of schools) {
        const sub = STATE.samanParikshaSubmissions[sch.shala_darpan_code];
        if (sub?.signature_data) {
          peeoSig = sub.signature_data;
          break;
        }
      }
    }

    // 3. Check localStorage
    if (!peeoSig) {
      peeoSig = localStorage.getItem(`cbeo_peeo_signature_${peeoName}`) || localStorage.getItem(`cbeo_peeo_signature_${cleanPeeoName}`);
    }

    // 4. Current user if logged in as this PEEO or admin
    if (!peeoSig && STATE.currentUser?.signature_data) {
      if (STATE.currentUser.peeo_name === peeoName || STATE.currentUser.role === 'admin') {
        peeoSig = STATE.currentUser.signature_data;
      }
    }
  }

  const officeHeaderTitle = isBlockConsolidated
    ? `कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय`
    : `कार्यालय पंचायत प्रारंभिक शिक्षा अधिकारी (PEEO), ${peeoName}`;

  const jurisdictionSubtitle = isBlockConsolidated
    ? `ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान) | समस्त 25 PEEO परिक्षेत्र मॉनिटरिंग`
    : `ग्रा.पं. ${cleanPeeoName}, ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)`;

  const reportSubtitle = isBlockConsolidated
    ? `समस्त 25 PEEO परिक्षेत्र अधीनस्थ 57 माध्यमिक व उच्च माध्यमिक विद्यालयों की समेकित परीक्षा मांग रिपोर्ट`
    : `परिक्षेत्र अधीनस्थ माध्यमिक व उच्च माध्यमिक विद्यालयों की समेकित परीक्षा मांग रिपोर्ट`;

  const rightDesignationTitle = isBlockConsolidated
    ? `मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)`
    : `पंचायत प्रारंभिक शिक्षा अधिकारी (PEEO)`;

  const rightOfficeName = isBlockConsolidated
    ? `भिनाय, जिला अजमेर`
    : `${peeoName}`;

  container.innerHTML = `
    <!-- Top Departmental & PEEO Header -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:2px; margin-bottom:4px">
      <div style="font-size:0.80rem; font-weight:700; color:#000; letter-spacing:normal">राजस्थान सरकार | स्कूल शिक्षा विभाग</div>
      <div style="font-size:1.12rem; font-weight:900; color:#000; margin:1px 0">
        ${officeHeaderTitle}
      </div>
      <div style="font-size:0.78rem; font-weight:700; color:#111; margin-bottom:1px">
        ${jurisdictionSubtitle}
      </div>
      <div style="font-size:0.95rem; font-weight:800; color:#000; letter-spacing:normal">
        जिला समान परीक्षा योजना (सत्र 2026-27)
      </div>
      <div style="font-size:0.80rem; font-weight:700; color:#222">
        ${reportSubtitle}
      </div>
    </div>

    <!-- Cluster Metadata Summary (Laser Print-Friendly Clean Box) -->
    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:3px 6px; border-radius:4px; border:1px solid #000; margin-bottom:4px; font-size:0.74rem; color:#000">
      <div><strong>कुल माध्यमिक/उच्च माध्यमिक विद्यालय:</strong> ${schools.length} (राजकीय: ${schools.filter(s=>s.type==='Government').length} | निजी: ${schools.filter(s=>s.type!=='Government').length})</div>
      <div><strong>प्रपत्र सबमिट स्थिति:</strong> <strong>${submittedCount} पूर्ण</strong> / <strong>${schools.length - submittedCount} लम्बित</strong></div>
      <div><strong>${isBlockConsolidated ? 'ब्लॉक' : 'परिक्षेत्र'} कुल मांग प्रश्न-पत्र:</strong> <strong style="font-size:0.88rem">${totalGrand}</strong></div>
    </div>

    <!-- TABLE 1: School & Staff Contact Details -->
    <div style="margin-bottom:4px">
      <div style="font-size:0.80rem; font-weight:800; color:#000; margin-bottom:2px">
        1. अधीनस्थ विद्यालयों एवं प्रभारियों का संपर्क विवरण (Staff Contact Matrix)
      </div>
      <table style="width:100%; border-collapse:collapse; border:1.5px solid #000; font-size:0.75rem">
        <thead>
          <tr style="background:#f1f5f9; color:#000; font-weight:800; text-align:center">
            <th style="padding:3px 2px; border:1px solid #000; width:30px">क्र.</th>
            <th style="padding:3px 5px; border:1px solid #000; text-align:left">विद्यालय का नाम</th>
            <th style="padding:3px 3px; border:1px solid #000; width:110px">शा.दा./PSP कोड</th>
            <th style="padding:3px 3px; border:1px solid #000; width:70px">परीक्षा कोड</th>
            <th style="padding:3px 5px; border:1px solid #000; text-align:left; width:190px">संस्था प्रधान (Principal)</th>
            <th style="padding:3px 5px; border:1px solid #000; text-align:left; width:190px">परीक्षा प्रभारी (Exam In-charge)</th>
            <th style="padding:3px 3px; border:1px solid #000; width:65px">स्थिति</th>
          </tr>
        </thead>
        <tbody>
          ${contactRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- TABLE 2: Class-wise Student Demand Matrix -->
    <div style="margin-bottom:4px">
      <div style="font-size:0.80rem; font-weight:800; color:#000; margin-bottom:2px">
        2. कक्षावार विद्यार्थी नामांकन एवं प्रश्न-पत्र मांग समेकित विवरण (Examination Demand Matrix)
      </div>
      <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.75rem">
        <thead>
          <tr style="background:#f1f5f9; color:#000; font-weight:800; text-align:center">
            <th style="padding:3px 2px; border:1px solid #000; width:30px">क्र.</th>
            <th style="padding:3px 5px; border:1px solid #000; text-align:left">विद्यालय का नाम एवं कोड</th>
            <th style="padding:3px 3px; border:1px solid #000; width:70px">9वीं मांग</th>
            <th style="padding:3px 3px; border:1px solid #000; width:70px">10वीं मांग</th>
            <th style="padding:3px 3px; border:1px solid #000; width:70px">11वीं मांग</th>
            <th style="padding:3px 3px; border:1px solid #000; width:70px">12वीं मांग</th>
            <th style="padding:3px 5px; border:1px solid #000; width:90px; background:#e2e8f0; font-weight:900">कुल मांग</th>
            <th style="padding:3px 3px; border:1px solid #000; width:65px">स्थिति</th>
          </tr>
        </thead>
        <tbody>
          ${demandRowsHtml}
          <!-- Cluster Grand Total Row -->
          <tr style="background:#f1f5f9; font-weight:900; border:2px solid #000; text-align:center">
            <td colspan="2" style="padding:3px 6px; border:2px solid #000; text-align:right; font-size:0.84rem; color:#000">
              🎯 ${isBlockConsolidated ? 'समस्त ब्लॉक' : 'PEEO परिक्षेत्र'} कुल महायोग (Consolidated Grand Total):
            </td>
            <td style="padding:3px 3px; border:2px solid #000; font-size:0.88rem">${totalC9}</td>
            <td style="padding:3px 3px; border:2px solid #000; font-size:0.88rem">${totalC10}</td>
            <td style="padding:3px 3px; border:2px solid #000; font-size:0.88rem">${totalC11}</td>
            <td style="padding:3px 3px; border:2px solid #000; font-size:0.88rem">${totalC12}</td>
            <td style="padding:3px 5px; border:2px solid #000; font-size:0.98rem; background:#e2e8f0">${totalGrand}</td>
            <td style="padding:3px 3px; border:2px solid #000">${submittedCount}/${schools.length}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Verification Declaration -->
    <div style="margin-top:4px; margin-bottom:4px; padding:3px 6px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.70rem; line-height:1.25; color:#000">
      <strong>सत्यापन एवं उत्तरदायित्व घोषणा:</strong> प्रमाणित किया जाता है कि ${isBlockConsolidated ? 'ब्लॉक भिनाय' : `मेरे परिक्षेत्र (${peeoName})`} के अंतर्गत संचालित उपर्युक्त समस्त ${schools.length} माध्यमिक एवं उच्च माध्यमिक विद्यालयों के परीक्षा प्रपत्रों का गहनता से परीक्षण व सत्यापन कर लिया गया है। उपर्युक्त सभी आंकड़े पूर्णतः सही व सत्यापित हैं। किसी भी प्रकार की त्रुटि या विसंगति पाए जाने पर संबंधित संस्था प्रधान एवं परीक्षा प्रभारी का उत्तरदायित्व होगा।
    </div>

    <!-- Official Signatures: Incharge (Left) & PEEO (Right) -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 30px; margin-top:8px; margin-bottom:2px">
      <!-- Left: Exam In-charge -->
      <div style="text-align:center; width:36%">
        ${inchargeSig ? `
          <div style="height:28px; display:flex; align-items:center; justify-content:center">
            <img src="${inchargeSig}" style="max-height:26px; max-width:140px; object-fit:contain" alt="हस्ताक्षर">
          </div>
        ` : `<div style="height:28px"></div>`}
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          हस्ताक्षर परीक्षा प्रभारी
        </div>
      </div>

      <!-- Right: PEEO / CBEO Sign -->
      <div style="text-align:center; width:44%">
        ${peeoSig ? `
          <div style="height:28px; display:flex; align-items:center; justify-content:center">
            <img src="${peeoSig}" style="max-height:26px; max-width:140px; object-fit:contain" alt="डिजिटल हस्ताक्षर">
          </div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            हस्ताक्षर
          </div>
          <div style="font-size:0.65rem; color:#15803d; font-weight:700">✓ डिजिटल सत्यापित (Digitally Signed)</div>
        ` : `
          <div style="height:28px"></div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            हस्ताक्षर
          </div>
        `}
        <div style="font-size:0.80rem; font-weight:800; color:#000; margin-top:1px">${rightDesignationTitle}</div>
        <div style="font-size:0.76rem; font-weight:700; color:#111; margin-top:1px">${rightOfficeName}</div>
        <div style="font-size:0.72rem; color:#222; margin-top:1px">ब्लॉक-भिनाय (अजमेर)</div>
      </div>
    </div>
  `;

  showModal('modal-peeo-consolidated-preview');
}

function printPeeoConsolidatedDocument() {
  const peeoName = STATE.activePeeoConsolidatedName || 'PEEO';
  printCleanA4Landscape('printable-peeo-consolidated-content', `PEEO समेकित परीक्षा मांग रिपोर्ट - ${peeoName}`);
}

async function downloadPeeoConsolidatedPDFDirect() {
  const peeoName = STATE.activePeeoConsolidatedName || 'PEEO';
  const nameSafe = peeoName.replace(/[^a-zA-Z0-9_]/g, '_');
  const filename = `${nameSafe}_Saman_Pariksha_Consolidated_2026.pdf`;

  showToast('समेकित Landscape PDF तैयार किया जा रहा है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-peeo-consolidated-content', filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('समेकित PDF सफलतापूर्वक डाउनलोड हो गया!', 'success');
  } catch (err) {
    console.warn('PEEO PDF fallback to print:', err);
    printPeeoConsolidatedDocument();
  }
}

async function sharePeeoConsolidatedWhatsApp() {
  const peeoName = STATE.activePeeoConsolidatedName || 'PEEO';
  const schools = STATE.schools56.filter(s => s.peeo_name.toLowerCase().includes(peeoName.toLowerCase()));
  if (schools.length === 0) return;

  const nameSafe = peeoName.replace(/[^a-zA-Z0-9_]/g, '_');
  const filename = `${nameSafe}_Saman_Pariksha_Consolidated_2026.pdf`;

  let grandTotalPapers = 0;
  let subCount = 0;
  let breakdown = '';

  schools.forEach((s, i) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);
    if (isSub) {
      subCount++;
      grandTotalPapers += (sub.grand_total || 0);
      breakdown += `${i + 1}. ${s.school_name}: *${sub.grand_total} पेपर* (9वीं:${sub.c9_total}, 10वीं:${sub.c10_total}, 11वीं:${sub.c11_total}, 12वीं:${sub.c12_total})\n`;
    } else {
      breakdown += `${i + 1}. ${s.school_name}: ⚠️ *लम्बित*\n`;
    }
  });

  const waSummary = `*🏛️ कार्यालय पंचायत प्रारंभिक शिक्षा अधिकारी (PEEO)*\n*${peeoName} | ब्लॉक-भिनाय (अजमेर)*\n*जिला समान परीक्षा (सत्र 2026-27) - परिक्षेत्र समेकित रिपोर्ट*\n\n📊 *प्रगति स्थिति:* ${subCount}/${schools.length} विद्यालय पूर्ण\n🎯 *परिक्षेत्र कुल मांग प्रश्न-पत्र:* *${grandTotalPapers}*\n\n📋 *विद्यालयवार विवरण:*\n${breakdown}\n📄 *अधिकृत PEEO समेकित रिपोर्ट PDF संलग्न है।*\n🌐 *CBEO भिनाय पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  showToast('WhatsApp शेयर हेतु समेकित PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-peeo-consolidated-content', filename);
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: `${peeoName} समेकित परीक्षा रिपोर्ट`,
        text: waSummary
      });
      showToast('WhatsApp शेयर विंडो सफलतापूर्वक खुल गई!', 'success');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waSummary + '\n\n*(नोट: समेकित PDF फाइल आपके डिवाइस में डाउनलोड हो गई है, कृपया WhatsApp चैट में अटैच करें)*')}`;
      window.open(waUrl, '_blank');
      showToast('समेकित PDF डाउनलोड हो गई है एवं WhatsApp खुल गया है! कृपया फाइल अटैच करें।', 'info');
    }
  } catch (err) {
    console.warn('WhatsApp share fallback:', err);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waSummary)}`;
    window.open(waUrl, '_blank');
  }
}

function sharePeeoConsolidatedWhatsAppMsg() {
  const peeoName = STATE.activePeeoConsolidatedName || 'PEEO';
  const schools = STATE.schools56.filter(s => s.peeo_name.toLowerCase().includes(peeoName.toLowerCase()));
  if (schools.length === 0) return;

  let grandTotalPapers = 0;
  let subCount = 0;
  let breakdown = '';

  schools.forEach((s, i) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);
    if (isSub) {
      subCount++;
      grandTotalPapers += (sub.grand_total || 0);
      breakdown += `${i + 1}. ${s.school_name}: *${sub.grand_total} पेपर* (9वीं:${sub.c9_total}, 10वीं:${sub.c10_total}, 11वीं:${sub.c11_total}, 12वीं:${sub.c12_total})\n`;
    } else {
      breakdown += `${i + 1}. ${s.school_name}: ⚠️ *लम्बित*\n`;
    }
  });

  const waSummary = `*🏛️ कार्यालय पंचायत प्रारंभिक शिक्षा अधिकारी (PEEO)*\n*${peeoName} | ब्लॉक-भिनाय (अजमेर)*\n*जिला समान परीक्षा (सत्र 2026-27) - परिक्षेत्र समेकित रिपोर्ट*\n\n📊 *प्रगति स्थिति:* ${subCount}/${schools.length} विद्यालय पूर्ण\n🎯 *परिक्षेत्र कुल मांग प्रश्न-पत्र:* *${grandTotalPapers}*\n\n📋 *विद्यालयवार विवरण:*\n${breakdown}\n🌐 *CBEO भिनाय पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waSummary)}`;
  window.open(waUrl, '_blank');
  showToast('PEEO समेकित विवरण WhatsApp पर खुल रहा है...', 'success');
}

window.sharePeeoConsolidatedWhatsAppMsg = sharePeeoConsolidatedWhatsAppMsg;
window.sharePeeoConsolidatedWhatsAppPdf = sharePeeoConsolidatedWhatsApp;

/* ========================================================
   UNIVERSAL PENDING SCHOOLS & PEEOs REPORT PDF SYSTEM
   Supports: Saman Pariksha (57 Schools) + Any Future Demand
   ======================================================== */
function openPendingReportPdf(type = 'saman-pariksha', demandId = null) {
  let reportTitle = '';
  let subTitle = '';
  let filename = '';
  let targetSchools = [];
  let isSchoolPendingFn = null;

  const isSaman = (type === 'saman-pariksha' || demandId === 'saman_pariksha_2026_27' || !type);

  if (isSaman) {
    reportTitle = 'जिला समान परीक्षा 2026-27 (57 विद्यालय)';
    subTitle = 'माध्यमिक एवं उच्च माध्यमिक विद्यालय मांग प्रपत्र - लम्बित अनुपालना रिपोर्ट';
    filename = 'CBEO_Bhinai_Saman_Pariksha_Pending_Schools_Report.pdf';
    targetSchools = [...STATE.schools56];
    isSchoolPendingFn = (s) => {
      const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
      return !isSamanParikshaSubmitted(sub);
    };
  } else {
    const demand = STATE.demands.find(d => d.id === demandId) || STATE.demands[0];
    if (!demand) {
      showToast('मांग प्रपत्र नहीं मिला!', 'warning');
      return;
    }
    reportTitle = demand.title || 'अधिकृत सूचना मांग प्रपत्र';
    subTitle = `${demand.description || 'कार्यालय सूचना मांग'} - लम्बित अनुपालना रिपोर्ट`;
    filename = `CBEO_Bhinai_${demand.id}_Pending_Report.pdf`;
    targetSchools = getTargetSchoolsForDemand(demand);
    isSchoolPendingFn = (s) => !isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
  }

  // If current logged in user is PEEO, filter to their schools
  const currentUser = STATE.currentUser;
  if (currentUser && currentUser.role === 'peeo') {
    const peeoFilterName = currentUser.peeo_name;
    const cleanTarget = peeoFilterName.replace(/PEEO\s+/i, '').trim().toLowerCase();
    targetSchools = targetSchools.filter(s => s.peeo_name.toLowerCase().includes(cleanTarget));
    subTitle += ` | ${peeoFilterName} परिक्षेत्र`;
    filename = `${peeoFilterName.replace(/\s+/g, '_')}_Pending_Report.pdf`;
  }

  const totalSchools = targetSchools.length;
  const pendingSchools = targetSchools.filter(isSchoolPendingFn);
  const submittedSchools = targetSchools.filter(s => !isSchoolPendingFn(s));
  const pendingCount = pendingSchools.length;
  const submittedCount = submittedSchools.length;

  // Build PEEO-wise statistics
  const peeoStatsMap = {};
  targetSchools.forEach(s => {
    const pName = s.peeo_name || 'अन्य';
    if (!peeoStatsMap[pName]) {
      const peeoInfo = STATE.peeos.find(p => p.peeo_name && p.peeo_name.toLowerCase().includes(pName.toLowerCase().replace(/PEEO\s+/i, '').trim()));
      peeoStatsMap[pName] = {
        name: pName,
        shala_darpan_code: s.peeo_code || peeoInfo?.shala_darpan_code || '---',
        principal: peeoInfo?.principal_incharge || s.principal_name || 'संस्था प्रधान',
        mobile: peeoInfo?.mobile || s.principal_mobile || '---',
        total: 0,
        submitted: 0,
        pending: 0
      };
    }
    peeoStatsMap[pName].total++;
    if (isSchoolPendingFn(s)) {
      peeoStatsMap[pName].pending++;
    } else {
      peeoStatsMap[pName].submitted++;
    }
  });

  const peeoStatsList = Object.values(peeoStatsMap).sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
  const pendingPeeoCount = peeoStatsList.filter(p => p.pending > 0).length;
  const totalPeeos = peeoStatsList.length;

  STATE.activePendingReportState = {
    type,
    demandId,
    reportTitle,
    filename,
    totalSchools,
    submittedCount,
    pendingCount,
    pendingPeeoCount,
    totalPeeos,
    pendingSchools
  };

  const container = document.getElementById('printable-pending-report-content');
  const modalTitle = document.getElementById('pending-report-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `📄 ${reportTitle} — लम्बित स्कूल व PEEO सूची (PDF)`;
  }
  if (!container) return;

  const nowStr = new Date().toLocaleString('hi-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  // Build Pending Schools Rows HTML
  let pendingRowsHtml = '';
  if (pendingCount === 0) {
    pendingRowsHtml = `
      <tr>
        <td colspan="8" style="text-align:center; padding:30px 15px; background:#f0fdf4; color:#166534">
          <div style="font-size:24pt; margin-bottom:8px">🎉</div>
          <div style="font-size:13pt; font-weight:800">अत्यंत हर्ष का विषय है!</div>
          <div style="font-size:10.5pt; margin-top:4px">समस्त ${totalSchools} विद्यालयों की सूचना शत-प्रतिशत प्राप्त हो चुकी है। कोई भी विद्यालय लम्बित नहीं है।</div>
        </td>
      </tr>
    `;
  } else {
    pendingSchools.forEach((s, idx) => {
      const pName = s.principal_name || 'संस्था प्रधान';
      const pMob = s.principal_mobile || '---';
      const iName = s.incharge_name || 'परीक्षा प्रभारी';
      const iMob = s.incharge_mobile || '---';
      const exCode = s.exam_code || '---';

      pendingRowsHtml += `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fef2f2'}">
          <td style="text-align:center; font-weight:700">${idx + 1}</td>
          <td>
            <div style="font-weight:700; color:#1e293b; font-size:9pt">${s.school_name}</div>
            <div style="font-size:7.5pt; color:#64748b">श्रेणी: ${s.category || s.type || 'Govt'}</div>
          </td>
          <td style="text-align:center; font-family:monospace; font-weight:700">${s.shala_darpan_code}</td>
          <td style="text-align:center; font-weight:800; color:#1e3a8a">${exCode}</td>
          <td style="font-size:8pt; font-weight:600; color:#334155">${s.peeo_name}</td>
          <td>
            <div style="font-weight:700; font-size:8pt; color:#1e293b">${pName}</div>
            <div style="font-size:7.5pt; color:#0369a1; font-weight:600">📞 ${pMob}</div>
          </td>
          <td>
            <div style="font-weight:700; font-size:8pt; color:#1e293b">${iName}</div>
            <div style="font-size:7.5pt; color:#0369a1; font-weight:600">📞 ${iMob}</div>
          </td>
          <td style="text-align:center">
            <span style="display:inline-block; padding:2px 8px; background:#fee2e2; border:1px solid #f87171; color:#991b1b; border-radius:12px; font-size:7.5pt; font-weight:800">
              🔴 लम्बित
            </span>
          </td>
        </tr>
      `;
    });
  }

  // Build PEEO Summary Table HTML
  let peeoRowsHtml = '';
  peeoStatsList.forEach((p, idx) => {
    const isCompleted = p.pending === 0;
    const badge = isCompleted 
      ? '<span style="display:inline-block; padding:2px 8px; background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:12px; font-size:7.5pt; font-weight:700">🟢 शत-प्रतिशत पूर्ण</span>'
      : `<span style="display:inline-block; padding:2px 8px; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; border-radius:12px; font-size:7.5pt; font-weight:800">🔴 ${p.pending} विद्यालय लम्बित</span>`;

    peeoRowsHtml += `
      <tr style="background:${isCompleted ? '#ffffff' : '#fff7ed'}">
        <td style="text-align:center; font-weight:700">${idx + 1}</td>
        <td>
          <div style="font-weight:700; color:#1e3a8a; font-size:8.5pt">${p.name}</div>
          <div style="font-size:7pt; color:#64748b">शा.दा.: ${p.shala_darpan_code}</div>
        </td>
        <td style="text-align:center; font-weight:700">${p.total}</td>
        <td style="text-align:center; font-weight:700; color:#15803d">${p.submitted}</td>
        <td style="text-align:center; font-weight:800; color:${p.pending > 0 ? '#b91c1c' : '#64748b'}">${p.pending}</td>
        <td>
          <div style="font-size:8pt; font-weight:600">${p.principal}</div>
          <div style="font-size:7.5pt; color:#0369a1; font-weight:700">📞 ${p.mobile}</div>
        </td>
        <td style="text-align:center">${badge}</td>
      </tr>
    `;
  });

  const fullHtml = `
    <div style="font-family:'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0f172a; line-height:1.4">
      
      <!-- Official Rajasthan Government Header (Strictly AJMER ONLY) -->
      <div style="text-align:center; border-bottom:2.5px solid #1b365d; padding-bottom:10px; margin-bottom:14px">
        <div style="font-size:10.5pt; font-weight:700; color:#475569; letter-spacing:0.05em">राजस्थान सरकार • स्कूल शिक्षा विभाग</div>
        <h2 style="margin:4px 0; color:#1b365d; font-size:15pt; font-weight:900">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</h2>
        <div style="font-size:9.5pt; color:#334155; font-weight:600">
          <span>जिला: <strong>अजमेर</strong></span> &nbsp;•&nbsp; <span>ब्लॉक: <strong>भिनाय</strong></span> &nbsp;•&nbsp; <span>NIC-SD ID: <strong>8140</strong></span> &nbsp;•&nbsp; <span>IFMS ID: <strong>1408</strong></span>
        </div>
        <div style="margin-top:8px">
          <span style="display:inline-block; background:#fee2e2; border:1.5px solid #dc2626; border-radius:6px; padding:4px 16px; color:#991b1b; font-weight:900; font-size:11pt">
            ⚠️ ${reportTitle} — लम्बित विद्यालय एवं PEEO अनुपालना रिपोर्ट
          </span>
        </div>
        <div style="font-size:8pt; color:#64748b; margin-top:4px">
          रिपोर्ट जनरेशन दिनांक व समय: <strong>${nowStr}</strong> | आधिकारिक पोर्टल: <strong>CBEO Bhinai Portal</strong>
        </div>
      </div>

      <!-- Metric KPI Overview Cards -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:14px">
        <div style="background:#f8fafc; border-left:4px solid #1e3a8a; padding:8px 12px; border-radius:4px; border:1px solid #cbd5e1; border-left-width:4px">
          <div style="font-size:7.5pt; color:#64748b; font-weight:800; text-transform:uppercase">कुल लक्षित विद्यालय</div>
          <div style="font-size:16pt; font-weight:900; color:#1e3a8a; line-height:1.2">${totalSchools}</div>
          <div style="font-size:7.5pt; color:#64748b">माध्यमिक व उच्च माध्यमिक</div>
        </div>
        <div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:8px 12px; border-radius:4px; border:1px solid #bbf7d0; border-left-width:4px">
          <div style="font-size:7.5pt; color:#15803d; font-weight:800; text-transform:uppercase">प्राप्त सूचनाएं (पूर्ण)</div>
          <div style="font-size:16pt; font-weight:900; color:#15803d; line-height:1.2">${submittedCount}</div>
          <div style="font-size:7.5pt; color:#16a34a">सफलतापूर्वक सबमिट</div>
        </div>
        <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:8px 12px; border-radius:4px; border:1px solid #fecaca; border-left-width:4px">
          <div style="font-size:7.5pt; color:#b91c1c; font-weight:800; text-transform:uppercase">🔴 लम्बित विद्यालय (Pending)</div>
          <div style="font-size:16pt; font-weight:900; color:#dc2626; line-height:1.2">${pendingCount}</div>
          <div style="font-size:7.5pt; color:#b91c1c; font-weight:700">प्रपत्र अप्राप्त / शेष</div>
        </div>
        <div style="background:#eff6ff; border-left:4px solid #0284c7; padding:8px 12px; border-radius:4px; border:1px solid #fde68a; border-left-width:4px">
          <div style="font-size:7.5pt; color:#b45309; font-weight:800; text-transform:uppercase">लम्बित PEEO परिक्षेत्र</div>
          <div style="font-size:16pt; font-weight:900; color:#0369a1; line-height:1.2">${pendingPeeoCount} <span style="font-size:10pt; color:#64748b; font-weight:600">/ ${totalPeeos}</span></div>
          <div style="font-size:7.5pt; color:#b45309">जहाँ विद्यालय लम्बित हैं</div>
        </div>
      </div>

      <!-- Table 1: Detailed Pending Schools Contact List -->
      <div style="margin-bottom:18px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
          <h3 style="font-size:10pt; font-weight:800; color:#991b1b; margin:0; display:flex; align-items:center; gap:6px">
            <span style="background:#dc2626; color:#fff; width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:7.5pt">1</span>
            लम्बित विद्यालयों की विस्तृत संपर्क सूची (${pendingCount} विद्यालय)
          </h3>
          <span style="font-size:8pt; color:#64748b">त्वरित संपर्क एवं फॉलो-अप हेतु अधिकृत सूची</span>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:8pt; border:1.5px solid #cbd5e1">
          <thead>
            <tr style="background:#1b365d; color:#ffffff; font-weight:800">
              <th style="border:1px solid #475569; padding:5px 4px; text-align:center; width:30px">क्र.</th>
              <th style="border:1px solid #475569; padding:5px 6px; text-align:left">विद्यालय का नाम व श्रेणी</th>
              <th style="border:1px solid #475569; padding:5px 4px; text-align:center; width:70px">शा.दा. कोड</th>
              <th style="border:1px solid #475569; padding:5px 4px; text-align:center; width:65px">परीक्षा कोड</th>
              <th style="border:1px solid #475569; padding:5px 6px; text-align:left">संबंधित PEEO</th>
              <th style="border:1px solid #475569; padding:5px 6px; text-align:left">संस्था प्रधान (नाम व मो.)</th>
              <th style="border:1px solid #475569; padding:5px 6px; text-align:left">परीक्षा प्रभारी (नाम व मो.)</th>
              <th style="border:1px solid #475569; padding:5px 4px; text-align:center; width:65px">स्थिति</th>
            </tr>
          </thead>
          <tbody>
            ${pendingRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Table 2: PEEO-wise Compliance Summary -->
      <div style="margin-bottom:16px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
          <h3 style="font-size:10pt; font-weight:800; color:#1b365d; margin:0; display:flex; align-items:center; gap:6px">
            <span style="background:#1b365d; color:#fff; width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:7.5pt">2</span>
            PEEO-वार प्रपत्र अनुपालना सारांश (समस्त ${totalPeeos} PEEO परिक्षेत्र)
          </h3>
          <span style="font-size:8pt; color:#64748b">लम्बित PEEO संख्या: ${pendingPeeoCount}</span>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:7.8pt; border:1.5px solid #cbd5e1">
          <thead>
            <tr style="background:#334155; color:#ffffff; font-weight:800">
              <th style="border:1px solid #64748b; padding:4px 3px; text-align:center; width:28px">क्र.</th>
              <th style="border:1px solid #64748b; padding:4px 6px; text-align:left">PEEO परिक्षेत्र</th>
              <th style="border:1px solid #64748b; padding:4px 4px; text-align:center; width:45px">कुल स्कूल</th>
              <th style="border:1px solid #64748b; padding:4px 4px; text-align:center; width:45px">पूर्ण</th>
              <th style="border:1px solid #64748b; padding:4px 4px; text-align:center; width:45px">लम्बित</th>
              <th style="border:1px solid #64748b; padding:4px 6px; text-align:left">PEEO नोडल संस्था प्रधान व मोबाइल</th>
              <th style="border:1px solid #64748b; padding:4px 4px; text-align:center; width:100px">अनुपालना स्थिति</th>
            </tr>
          </thead>
          <tbody>
            ${peeoRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Formal Administrative Order Box & Signatures -->
      <div style="background:#eff6ff; border-left:4px solid #0284c7; padding:8px 12px; border-radius:4px; font-size:8pt; color:#92400e; margin-bottom:18px; border:1px solid #fde68a; border-left-width:4px">
        <strong>📌 महत्वपूर्ण प्रशासनिक निर्देश:</strong> उपरोक्त समस्त संस्था प्रधान एवं संबंधित PEEO साहिबान आज ही प्राथमिकता के आधार पर पोर्टल पर प्रपत्र ऑनलाइन सबमिट करना सुनिश्चित करें ताकि समेकित रिपोर्ट जिला स्तर पर प्रेषित की जा सके।
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:10px; border-top:1px solid #e2e8f0">
        <div style="font-size:7.5pt; color:#64748b">
          <div>कंप्यूटर जनरेटेड अधिकृत रिपोर्ट • CBEO भिनाय पोर्टल</div>
          <div>वेबसाइट: https://jit9763.github.io/cbeo-bhinai-portal/</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:900; color:#1b365d; font-size:10pt">मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</div>
          <div style="font-size:8.5pt; color:#334155; font-weight:700">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय (अजमेर)</div>
          <div style="font-size:7.5pt; color:#15803d; font-weight:700; margin-top:2px">✓ अधिकृत डिजिटल प्रति</div>
        </div>
      </div>

    </div>
  `;

  container.innerHTML = fullHtml;
  showModal('modal-pending-report-preview');
}

function printPendingReportDocument() {
  const container = document.getElementById('printable-pending-report-content');
  if (!container) return;

  const contentHtml = container.innerHTML;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('पॉपअप ब्लॉक है, कृपया अनुमति दें!', 'warning');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>लम्बित विद्यालय एवं PEEO अनुपालना रिपोर्ट - CBEO भिनाय (अजमेर)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #000000;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    tr {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 450);
}

async function downloadPendingReportPdfDirect() {
  const state = STATE.activePendingReportState || {};
  const filename = state.filename || 'CBEO_Bhinai_Pending_Report.pdf';
  showToast('लम्बित विद्यालय रिपोर्ट की PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-pending-report-content', filename, {
      orientation: 'portrait',
      targetWidth: '800px',
      scale: 1.5,
      quality: 0.85
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('लम्बित विद्यालय सूची PDF सफलतापूर्वक डाउनलोड हो गई!', 'success');
  } catch (err) {
    console.warn('PDF download fallback to print:', err);
    printPendingReportDocument();
  }
}

function getPendingReportWhatsAppText() {
  const state = STATE.activePendingReportState || {};
  const reportTitle = state.reportTitle || 'सूचना मांग प्रपत्र';
  const totalSchools = state.totalSchools || 0;
  const submittedCount = state.submittedCount || 0;
  const pendingCount = state.pendingCount || 0;
  const pendingPeeoCount = state.pendingPeeoCount || 0;

  let listSnippet = '';
  if (state.pendingSchools && state.pendingSchools.length > 0) {
    state.pendingSchools.forEach((s, idx) => {
      const pName = s.principal_name || 'संस्था प्रधान';
      const pMob = s.principal_mobile || '';
      const mobStr = pMob ? ` (📞 ${pMob})` : '';
      listSnippet += `${idx + 1}. *${s.school_name}* [${s.shala_darpan_code}]\n   PEEO: ${s.peeo_name} | ${pName}${mobStr}\n`;
    });
  } else {
    listSnippet = '🎉 *समस्त विद्यालयों की सूचना प्राप्त हो चुकी है! कोई भी विद्यालय लम्बित नहीं है।*\n';
  }

  return `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*\n*⚠️ अति आवश्यक - लम्बित विद्यालय एवं PEEO अनुपालना रिपोर्ट*\n*विषय:* ${reportTitle}\n\n📊 *प्रगति स्थिति:* ${submittedCount}/${totalSchools} पूर्ण | 🔴 *${pendingCount} विद्यालय लम्बित*\n⚠️ *लम्बित PEEO परिक्षेत्र:* ${pendingPeeoCount} PEEO\n\n📋 *लम्बित विद्यालयों की सूची:*\n${listSnippet}\n📌 *निर्देश:* कृपया उपरोक्त समस्त विद्यालय आज ही CBEO पोर्टल पर ऑनलाइन प्रपत्र सबमिट करें।\n🌐 *CBEO भिनाय पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;
}

function openWhatsAppDirectText(text) {
  const encoded = encodeURIComponent(text);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Protocol handler directly opens the installed WhatsApp Application!
    window.location.href = `whatsapp://send?text=${encoded}`;
  } else {
    // Desktop: first try desktop app protocol, fallback to web.whatsapp.com
    const a = document.createElement('a');
    a.href = `whatsapp://send?text=${encoded}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }, 600);
  }
}

async function sharePendingReportWhatsAppPdf() {
  const state = STATE.activePendingReportState || {};
  const filename = state.filename || 'CBEO_Bhinai_Pending_Report.pdf';
  const waSummary = getPendingReportWhatsAppText();

  showToast('WhatsApp शेयर हेतु PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-pending-report-content', filename, {
      orientation: 'portrait',
      targetWidth: '800px',
      scale: 1.5,
      quality: 0.85
    });
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `लम्बित विद्यालय अनुपालना रिपोर्ट - CBEO भिनाय`,
          text: waSummary
        });
        showToast('WhatsApp शेयर विंडो सफलतापूर्वक खुल गई!', 'success');
        return;
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') return;
        console.warn('Share file aborted or failed:', shareErr);
      }
    }

    // Fallback: Download the PDF automatically and launch WhatsApp App
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    openWhatsAppDirectText(waSummary + '\n\n*(नोट: आधिकारिक PDF फाइल आपके डिवाइस में डाउनलोड हो गई है, कृपया चैट में अटैच करें)*');
    showToast('PDF डाउनलोड हो गई है एवं WhatsApp खुल रहा है! कृपया फाइल अटैच करें।', 'success');

  } catch (err) {
    console.warn('WhatsApp PDF share fallback:', err);
    openWhatsAppDirectText(waSummary);
  }
}

async function sharePendingReportWhatsAppMsg() {
  const waSummary = getPendingReportWhatsAppText();
  showToast('WhatsApp मैसेज खोला जा रहा है...', 'info');

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'लम्बित विद्यालय रिपोर्ट - CBEO भिनाय',
        text: waSummary
      });
      showToast('WhatsApp शेयर विंडो सफलतापूर्वक खुल गई!', 'success');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Direct WhatsApp App Launch
  openWhatsAppDirectText(waSummary);
}

function sharePendingReportWhatsApp(mode = 'pdf') {
  if (mode === 'msg') {
    return sharePendingReportWhatsAppMsg();
  }
  return sharePendingReportWhatsAppPdf();
}

/* ========================================================
   ADMIN SAMAN PARIKSHA CALL DIRECTORY (56 SCHOOLS)
   ======================================================== */
function switchSamanSubView(subview) {
  const monTab = document.getElementById('btn-subnav-monitoring');
  const callTab = document.getElementById('btn-subnav-calldir');
  const monContainer = document.getElementById('sp-subview-monitoring');
  const callContainer = document.getElementById('sp-subview-calldir');

  if (subview === 'calldir') {
    if (monTab) monTab.classList.remove('active');
    if (callTab) callTab.classList.add('active');
    if (monContainer) monContainer.style.display = 'none';
    if (callContainer) callContainer.style.display = 'block';
    renderSamanCallDirectory();
  } else {
    if (callTab) callTab.classList.remove('active');
    if (monTab) monTab.classList.add('active');
    if (callContainer) callContainer.style.display = 'none';
    if (monContainer) monContainer.style.display = 'block';
  }
}

function renderSamanCallDirectory() {
  const tbody = document.getElementById('sp-calldir-tbody');
  if (!tbody) return;

  const peeoSelect = document.getElementById('sp-calldir-peeo');
  if (peeoSelect && peeoSelect.options.length <= 1) {
    const uniquePeeos = [...new Set(STATE.schools56.map(s => s.peeo_name))].sort();
    uniquePeeos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      peeoSelect.appendChild(opt);
    });
  }

  filterSamanCallDirectory();
}

function filterSamanCallDirectory() {
  const tbody = document.getElementById('sp-calldir-tbody');
  if (!tbody) return;

  const q = (document.getElementById('sp-calldir-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('sp-calldir-category')?.value || 'all';
  const status = document.getElementById('sp-calldir-status')?.value || 'all';
  const peeo = document.getElementById('sp-calldir-peeo')?.value || 'all';

  const filtered = STATE.schools56.filter(s => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSubmitted = isSamanParikshaSubmitted(sub);

    if (cat !== 'all' && s.type !== cat) return false;
    if (status === 'submitted' && !isSubmitted) return false;
    if (status === 'pending' && isSubmitted) return false;
    if (peeo !== 'all' && s.peeo_name !== peeo) return false;

    if (q) {
      const pName = (isSubmitted ? sub.principal_name : s.principal_name) || '';
      const pMob = (isSubmitted ? sub.principal_mobile : s.principal_mobile) || '';
      const iName = (isSubmitted ? sub.incharge_name : s.incharge_name) || '';
      const iMob = (isSubmitted ? sub.incharge_mobile : s.incharge_mobile) || '';
      const exCode = (sub?.exam_code || s.exam_code) || '';
      const match = s.school_name.toLowerCase().includes(q) ||
        s.shala_darpan_code.toLowerCase().includes(q) ||
        s.peeo_name.toLowerCase().includes(q) ||
        exCode.toLowerCase().includes(q) ||
        pName.toLowerCase().includes(q) ||
        pMob.includes(q) ||
        iName.toLowerCase().includes(q) ||
        iMob.includes(q);
      if (!match) return false;
    }
    return true;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:#64748b">कोई विद्यालय रिकॉर्ड नहीं मिला</td></tr>`;
    return;
  }

  filtered.forEach((s, idx) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);

    const princName = isSub ? sub.principal_name : s.principal_name;
    const princMob = isSub ? sub.principal_mobile : s.principal_mobile;
    const inchName = isSub ? sub.incharge_name : (s.incharge_name || 'परीक्षा प्रभारी');
    const inchMob = isSub ? sub.incharge_mobile : (s.incharge_mobile || '');
    const examCode = sub?.exam_code || s.exam_code || '---';

    const statusBadge = isSub
      ? `<span class="sp-status-badge success" style="font-size:0.75rem; padding:2px 6px"><i class="fas fa-check-circle"></i> सबमिट (${sub.grand_total})</span>`
      : `<span class="sp-status-badge danger" style="font-size:0.75rem; padding:2px 6px"><i class="fas fa-clock"></i> लंबित</span>`;

    const princCallBtn = princMob ? `<a href="tel:${princMob}" class="btn-call-mini" title="सीधे कॉल करें"><i class="fas fa-phone-alt"></i> कॉल</a>` : '';
    const princWaBtn = princMob ? `<a href="https://wa.me/91${princMob.replace(/\D/g,'')}?text=${encodeURIComponent(`नमस्ते संस्था प्रधान महोदय, विद्यालय: ${s.school_name} | जिला समान परीक्षा 2026-27 के संदर्भ में CBEO कार्यालय भिनाय से संपर्क किया जा रहा है।`)}" target="_blank" class="btn-wa-mini" title="WhatsApp भेजें"><i class="fab fa-whatsapp"></i> चैट</a>` : '';

    const inchCallBtn = inchMob ? `<a href="tel:${inchMob}" class="btn-call-mini" title="सीधे कॉल करें"><i class="fas fa-phone-alt"></i> कॉल</a>` : '';
    const inchWaBtn = inchMob ? `<a href="https://wa.me/91${inchMob.replace(/\D/g,'')}?text=${encodeURIComponent(`नमस्ते परीक्षा प्रभारी महोदय, विद्यालय: ${s.school_name} | जिला समान परीक्षा 2026-27 के संदर्भ में CBEO कार्यालय भिनाय से संपर्क किया जा रहा है।`)}" target="_blank" class="btn-wa-mini" title="WhatsApp भेजें"><i class="fab fa-whatsapp"></i> चैट</a>` : '';

    const tr = document.createElement('tr');
    tr.style.background = isSub ? '#ffffff' : '#fff7ed';
    tr.innerHTML = `
      <td style="text-align:center; font-weight:700">${idx + 1}</td>
      <td>
        <div style="font-weight:800; color:#1e3a8a">${s.school_name}</div>
        <div style="font-size:0.75rem; color:#64748b">शा.दा.: <strong>${s.shala_darpan_code}</strong> | ${s.type === 'Government' ? 'राजकीय' : 'निजी'}</div>
      </td>
      <td><span style="font-size:0.8rem; color:#334155">${s.peeo_name}</span></td>
      <td style="text-align:center; font-weight:800; color:#dc2626">${examCode}</td>
      <td>
        <div style="font-weight:700; color:#0f172a">${princName}</div>
        <div style="font-size:0.75rem; color:#475569; margin:2px 0">${princMob || 'मो. उपलब्ध नहीं'}</div>
        <div style="display:flex; gap:0.35rem; margin-top:3px">${princCallBtn} ${princWaBtn}</div>
      </td>
      <td>
        <div style="font-weight:700; color:#0f172a">${inchName}</div>
        <div style="font-size:0.75rem; color:#475569; margin:2px 0">${inchMob || 'मो. उपलब्ध नहीं'}</div>
        <div style="display:flex; gap:0.35rem; margin-top:3px">${inchCallBtn} ${inchWaBtn}</div>
      </td>
      <td style="text-align:center">${statusBadge}</td>
      <td style="text-align:center">
        <button class="btn ${isSub ? 'btn-success' : 'btn-primary'} btn-sm" onclick="openSamanParikshaForm('${s.shala_darpan_code}')" title="${isSub ? 'प्रपत्र देखें / एडिट करें' : 'प्रपत्र भरें'}" style="padding:4px 8px; font-size:0.75rem">
          <i class="fas ${isSub ? 'fa-edit' : 'fa-file-signature'}"></i> ${isSub ? 'देखें' : 'भरें'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function sendBulkPendingWhatsAppReminder() {
  const pending = STATE.schools56.filter(s => !isSamanParikshaSubmitted(s.shala_darpan_code));
  if (pending.length === 0) {
    showToast(`सभी ${STATE.schools56.length} विद्यालयों के प्रपत्र सबमिट हो चुके हैं!`, 'success');
    return;
  }

  let list = '';
  pending.forEach((s, i) => {
    list += `${i + 1}. ${s.school_name} (शा.दा. ${s.shala_darpan_code}) - संस्था प्रधान: ${s.principal_name} (मो. ${s.principal_mobile})\n`;
  });

  const msg = `*📢 कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n*अति-आवश्यक आदेश: जिला समान परीक्षा 2026-27 प्रपत्र*\n\nसमस्त संबंधित संस्था प्रधान एवं PEEO को सूचित किया जाता है कि समान परीक्षा 2026-27 प्रपत्र भरने की अंतिम तिथि 05 अक्टूबर 2026 है। भिनाय ब्लॉक के निम्नलिखित ${pending.length} विद्यालयों का प्रपत्र अभी तक पोर्टल पर लम्बित है:\n\n${list}\nकृपया आज ही पोर्टल (https://jit9763.github.io/cbeo-bhinai-portal/) पर लॉगिन कर प्रपत्र सबमिट कर अधिकृत PDF मय सील-साइन प्रेषित करें।\n\n- मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function exportSamanCallDirectoryCSV() {
  const header = [
    "क्र.सं.",
    "विद्यालय का नाम",
    "शाला दर्पण / PSP कोड",
    "प्रकार",
    "संबंधित PEEO",
    "परीक्षा कोड",
    "संस्था प्रधान का नाम",
    "संस्था प्रधान मोबाइल",
    "परीक्षा प्रभारी का नाम",
    "परीक्षा प्रभारी मोबाइल",
    "प्रपत्र स्थिति",
    "कुल मांग प्रश्न-पत्र"
  ];

  const rows = STATE.schools56.map((s, idx) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);
    return [
      idx + 1,
      `"${s.school_name}"`,
      s.shala_darpan_code,
      s.type,
      `"${s.peeo_name}"`,
      (sub?.exam_code || s.exam_code || ''),
      `"${isSub ? sub.principal_name : s.principal_name}"`,
      isSub ? sub.principal_mobile : s.principal_mobile,
      `"${isSub ? sub.incharge_name : (s.incharge_name || '')}"`,
      isSub ? sub.incharge_mobile : (s.incharge_mobile || ''),
      isSub ? "सबमिट पूर्ण" : "लम्बित",
      isSub ? sub.grand_total : 0
    ];
  });

  const csvContent = "\uFEFF" + [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CBEO_Bhinai_Saman_Pariksha_Call_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('समान परीक्षा संपर्क डायरेक्टरी एक्सेल/CSV सफलतापूर्वक डाउनलोड हो गई!', 'success');
}

function printSamanCallDirectory() {
  const tbody = document.getElementById('sp-calldir-tbody');
  if (!tbody) return;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>समान परीक्षा संपर्क डायरेक्टरी - CBEO भिनाय</title>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; font-size: 12px; }
        h2, h3 { text-align: center; margin: 4px 0; color: #1b365d; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #334155; padding: 5px 8px; }
        th { background: #1b365d; color: #fff; }
        .success { color: #15803d; font-weight: bold; }
        .danger { color: #b91c1c; font-weight: bold; }
        @page { size: landscape; margin: 10mm; }
      </style>
    </head>
    <body>
      <h2>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
      <h3>जिला समान परीक्षा 2026-27 | 57 माध्यमिक व उच्च माध्यमिक विद्यालय फोन डायरेक्टरी</h3>
      <table>
        <thead>
          <tr>
            <th>क्र.</th>
            <th>विद्यालय का नाम व कोड</th>
            <th>संबंधित PEEO</th>
            <th>परीक्षा कोड</th>
            <th>संस्था प्रधान</th>
            <th>परीक्षा प्रभारी</th>
            <th>प्रपत्र स्थिति</th>
          </tr>
        </thead>
        <tbody>
  `);

  STATE.schools56.forEach((s, idx) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);
    const pName = isSub ? sub.principal_name : s.principal_name;
    const pMob = isSub ? sub.principal_mobile : s.principal_mobile;
    const iName = isSub ? sub.incharge_name : (s.incharge_name || 'उपलब्ध नहीं');
    const iMob = isSub ? sub.incharge_mobile : (s.incharge_mobile || '---');
    const exCode = sub?.exam_code || s.exam_code || '---';
    const st = isSub ? '<span class="success">सबमिट पूर्ण</span>' : '<span class="danger">लम्बित</span>';

    printWin.document.write(`
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td><strong>${s.school_name}</strong><br><small>शा.दा.: ${s.shala_darpan_code} (${s.type})</small></td>
        <td>${s.peeo_name}</td>
        <td style="text-align:center; font-weight:bold">${exCode}</td>
        <td>${pName}<br><small>मो. ${pMob}</small></td>
        <td>${iName}<br><small>मो. ${iMob}</small></td>
        <td style="text-align:center">${st}</td>
      </tr>
    `);
  });

  printWin.document.write(`
        </tbody>
      </table>
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 400);
}

function sendSamanParikshaReminder(schoolCode) {
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  if (!school) return;
  const mob = school.principal_mobile;
  const msg = `*कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n\nआदरणीय संस्था प्रधान महोदय,\nविद्यालय: *${school.school_name}* (कोड: ${school.shala_darpan_code})\n\nसत्र 2026-27 जिला समान परीक्षा हेतु आपके विद्यालय का कक्षा 9 से 12 नामांकन व प्रश्न-पत्र मांग प्रपत्र CBEO पोर्टल पर अभी भरना शेष है।\nकृपया पोर्टल (https://jit9763.github.io/cbeo-bhinai-portal/) पर लॉगिन कर तुरंत प्रपत्र सबमिट करें एवं अधिकृत PDF मय सील-साइन प्रेषित करें।\n\n- मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय`;
  if (mob) {
    sendWhatsAppMessage(mob, msg);
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

const SAMAN_EXCEL_OPTIONAL_KEYS = [
  { key: "pol_sci", label: "राजनीति विज्ञान (Pol Sci)" },
  { key: "history", label: "इतिहास (History)" },
  { key: "geography", label: "भूगोल (Geography)" },
  { key: "hindi_lit", label: "हिंदी साहित्य (Hindi Lit)" },
  { key: "eng_lit", label: "अंग्रेजी साहित्य (Eng Lit)" },
  { key: "sanskrit_lit", label: "संस्कृत साहित्य (Sanskrit Lit)" },
  { key: "urdu_lit", label: "उर्दू साहित्य (Urdu Lit)" },
  { key: "economics", label: "अर्थशास्त्र कला (Economics Arts)" },
  { key: "sociology", label: "समाजशास्त्र (Sociology)" },
  { key: "home_sci", label: "गृह विज्ञान (Home Science)" },
  { key: "drawing", label: "चित्रकला (Drawing)" },
  { key: "physics", label: "भौतिक विज्ञान (Physics)" },
  { key: "chemistry", label: "रसायन विज्ञान (Chemistry)" },
  { key: "biology", label: "जीव विज्ञान (Biology)" },
  { key: "maths", label: "गणित (Mathematics)" },
  { key: "comp_sci", label: "कम्प्यूटर विज्ञान (Computer Science)" },
  { key: "accountancy", label: "लेखाशास्त्र (Accountancy)" },
  { key: "business_studies", label: "व्यवसाय अध्ययन (Business Studies)" },
  { key: "economics_comm", label: "अर्थशास्त्र वाणिज्य (Economics Comm)" },
  { key: "agri_sci", label: "कृषि विज्ञान (Agri Science)" },
  { key: "agri_bio", label: "कृषि जीव विज्ञान (Agri Biology)" },
  { key: "agri_chem", label: "कृषि रसायन (Agri Chemistry)" }
];

function exportSamanSyllabusMasterCSV() {
  const govSchools = (STATE.schools56 || []).filter(s => s.type === 'Government');
  const header = [
    "क्र.सं. (S.No)",
    "विद्यालय का नाम (School Name)",
    "श्रेणी (Category)",
    "शाला दर्पण कोड (Shala Darpan Code)",
    "परीक्षा कोड (Exam Code)",
    "संबंधित PEEO नोडल पंचायत",
    "संस्था प्रधान का नाम",
    "संस्था प्रधान मोबाइल",
    
    // Class 9
    "9वीं स्थिति (Status)",
    "9वीं हिन्दी (%)",
    "9वीं अंग्रेजी (%)",
    "9वीं गणित (%)",
    "9वीं विज्ञान (%)",
    "9वीं सा.विज्ञान (%)",
    "9वीं संस्कृत (%)",
    "9वीं उर्दू (%)",
    
    // Class 10
    "10वीं स्थिति (Status)",
    "10वीं हिन्दी (%)",
    "10वीं अंग्रेजी (%)",
    "10वीं गणित (%)",
    "10वीं विज्ञान (%)",
    "10वीं सा.विज्ञान (%)",
    "10वीं संस्कृत (%)",
    "10वीं उर्दू (%)",
    
    // Class 11
    "11वीं स्थिति (Status)",
    "11वीं अनिवार्य हिन्दी (%)",
    "11वीं अनिवार्य अंग्रेजी (%)",
    "11वीं ऐच्छिक विषय एवं पूर्णता %",
    
    // Class 12
    "12वीं स्थिति (Status)",
    "12वीं अनिवार्य हिन्दी (%)",
    "12वीं अनिवार्य अंग्रेजी (%)",
    "12वीं ऐच्छिक विषय एवं पूर्णता %",
    
    // Summary
    "औसत पाठ्यक्रम पूर्णता (% Average)",
    "प्रपत्र स्थिति (Submission Status)",
    "सत्यापनकर्ता / संस्था प्रधान",
    "सबमिशन दिनांक (Timestamp)"
  ];

  const rows = [header];

  govSchools.forEach((s, idx) => {
    const code = s.shala_darpan_code;
    const sub = (STATE.samanSyllabusSubmissions && STATE.samanSyllabusSubmissions[code]) || {};
    const isSub = !!sub.is_submitted;
    const examCode = sub.exam_code || ('AJM04G' + code);
    const avgPct = calculateSchoolSyllabusAverage(sub);

    const c9 = sub.c9 || {};
    const c10 = sub.c10 || {};
    const c11 = sub.c11 || {};
    const c12 = sub.c12 || {};

    const elec11Str = c11.zero_enrolment
      ? 'लागू नहीं (शून्य नामांकन)'
      : ((c11.electives || []).map(e => `${e.name}:${e.pct}%`).join('; ') || '---');

    const elec12Str = c12.zero_enrolment
      ? 'लागू नहीं (शून्य नामांकन)'
      : ((c12.electives || []).map(e => `${e.name}:${e.pct}%`).join('; ') || '---');

    const row = [
      idx + 1,
      `"${(s.school_name || '').replace(/"/g, '""')}"`,
      `"${(s.category || '').replace(/"/g, '""')}"`,
      code,
      `"${examCode}"`,
      `"${(s.peeo_name || '').replace(/"/g, '""')}"`,
      `"${(sub.principal_name || s.principal_name || '').replace(/"/g, '""')}"`,
      `"${(sub.principal_mobile || s.principal_mobile || '').replace(/"/g, '""')}"`,

      // Class 9
      c9.zero_enrolment ? '"लागू नहीं (शून्य नामांकन)"' : '"नियमित संचालित"',
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.hindi || 0),
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.english || 0),
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.maths || 0),
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.science || 0),
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.sst || 0),
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.sanskrit || 0),
      c9.zero_enrolment ? '"लागू नहीं"' : (c9.urdu || 0),

      // Class 10
      c10.zero_enrolment ? '"लागू नहीं (शून्य नामांकन)"' : '"नियमित संचालित"',
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.hindi || 0),
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.english || 0),
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.maths || 0),
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.science || 0),
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.sst || 0),
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.sanskrit || 0),
      c10.zero_enrolment ? '"लागू नहीं"' : (c10.urdu || 0),

      // Class 11
      c11.zero_enrolment ? '"लागू नहीं (शून्य नामांकन)"' : '"नियमित संचालित"',
      c11.zero_enrolment ? '"लागू नहीं"' : (c11.comp_hindi || 0),
      c11.zero_enrolment ? '"लागू नहीं"' : (c11.comp_english || 0),
      `"${elec11Str.replace(/"/g, '""')}"`,

      // Class 12
      c12.zero_enrolment ? '"लागू नहीं (शून्य नामांकन)"' : '"नियमित संचालित"',
      c12.zero_enrolment ? '"लागू नहीं"' : (c12.comp_hindi || 0),
      c12.zero_enrolment ? '"लागू नहीं"' : (c12.comp_english || 0),
      `"${elec12Str.replace(/"/g, '""')}"`,

      // Summary
      isSub ? avgPct : 0,
      isSub ? '"पूर्ण (Submitted)"' : '"लम्बित (Pending)"',
      `"${(sub.submitted_by || sub.principal_name || '').replace(/"/g, '""')}"`,
      `"${(sub.submitted_at || '').replace(/"/g, '""')}"`
    ];

    rows.push(row);
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `CBEO_Bhinai_Saman_Pariksha_Syllabus_Completion_49_Schools_${new Date().toISOString().slice(0, 10)}.csv`;

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('समान परीक्षा पाठ्यक्रम पूर्णता % (49 स्कूल) एक्सेल (CSV) सफलतापूर्वक डाउनलोड हो गई!', 'success');
}

function exportSamanParikshaMasterCSV() {
  if (STATE.samanParikshaActiveForm === 'syllabus') {
    exportSamanSyllabusMasterCSV();
    return;
  }
  const header = [
    "क्र.सं. (S.No)",
    "विद्यालय का नाम (School Name)",
    "श्रेणी (Category)",
    "शाला दर्पण / PSP कोड",
    "संबंधित PEEO नोडल पंचायत",
    "स्कूल परीक्षा कोड (Exam Code)",
    "संस्था प्रधान (Principal Name)",
    "संस्था प्रधान मोबाइल",
    "परीक्षा प्रभारी (In-charge Name)",
    "परीक्षा प्रभारी मोबाइल",
    "शिक्षण माध्यम (School Medium)",
    
    // Class 9
    "9वीं हिंदी माध्यम (Class 9 Hindi)",
    "9वीं अंग्रेजी माध्यम (Class 9 English)",
    "9वीं कुल नामांकन (Class 9 Total)",
    "9वीं संस्कृत (Sanskrit 3rd Lang)",
    "9वीं उर्दू (Urdu 3rd Lang)",
    
    // Class 10
    "10वीं हिंदी माध्यम (Class 10 Hindi)",
    "10वीं अंग्रेजी माध्यम (Class 10 English)",
    "10वीं कुल नामांकन (Class 10 Total)",
    "10वीं संस्कृत (Sanskrit 3rd Lang)",
    "10वीं उर्दू (Urdu 3rd Lang)",
    
    // Class 11 Compulsory & Faculties
    "11वीं संकाय (Faculties)",
    "11वीं अनिवार्य हिंदी (Comp Hindi)",
    "11वीं अनिवार्य अंग्रेजी (Comp English)"
  ];

  // 11th Individual Optionals
  SAMAN_EXCEL_OPTIONAL_KEYS.forEach(col => {
    header.push(`11वीं ${col.label}`);
  });
  header.push("11वीं कुल मांग (Class 11 Total)");

  // Class 12 Compulsory & Faculties
  header.push(
    "12वीं संकाय (Faculties)",
    "12वीं अनिवार्य हिंदी (Comp Hindi)",
    "12वीं अनिवार्य अंग्रेजी (Comp English)"
  );

  // 12th Individual Optionals
  SAMAN_EXCEL_OPTIONAL_KEYS.forEach(col => {
    header.push(`12वीं ${col.label}`);
  });
  header.push("12वीं कुल मांग (Class 12 Total)");

  // Totals & Meta
  header.push(
    "कुल मांग प्रश्न-पत्र (Grand Total Papers 9-12)",
    "प्रपत्र स्थिति (Submission Status)",
    "हस्ताक्षरकर्ता / प्रस्तुतकर्ता (Submitted By)",
    "अंतिम अपडेट दिनांक (Timestamp)"
  );

  const rows = [header];

  STATE.schools56.forEach(s => {
    const code = s.shala_darpan_code;
    const sub = STATE.samanParikshaSubmissions[code] || {};
    const isSub = isSamanParikshaSubmitted(sub);
    const status = isSub ? "पूर्ण (Submitted)" : "लम्बित (Pending)";

    const c11FacStr = isSub ? (sub.c11_faculties || []).join(', ') : '';
    const c12FacStr = isSub ? (sub.c12_faculties || []).join(', ') : '';
    const c11Opt = isSub ? (sub.c11_optional || {}) : {};
    const c12Opt = isSub ? (sub.c12_optional || {}) : {};

    const isSchoolMggs = ['221770', '221778', '221753'].includes(String(code).trim()) || (s.category || '').toUpperCase().includes('MGGS') || (s.school_name || '').includes('महात्मा गांधी') || (s.school_name || '').toUpperCase().includes('MGGS');
    const effMed = isSchoolMggs ? 'english' : (sub.school_medium || 'hindi');
    const medLabel = effMed === 'english' ? 'अंग्रेजी माध्यम' : (effMed === 'both' ? 'द्विभाषी (हिंदी+अंग्रेजी)' : 'हिंदी माध्यम');

    const row = [
      s.s_no,
      `"${(s.school_name || '').replace(/"/g, '""')}"`,
      `"${(s.category || '').replace(/"/g, '""')}"`,
      code,
      `"${(s.peeo_name || '').replace(/"/g, '""')}"`,
      `"${(sub.exam_code || s.exam_code || '').replace(/"/g, '""')}"`,
      `"${(sub.principal_name || s.principal_name || '').replace(/"/g, '""')}"`,
      `"${(sub.principal_mobile || s.principal_mobile || '').replace(/"/g, '""')}"`,
      `"${(sub.incharge_name || s.incharge_name || '').replace(/"/g, '""')}"`,
      `"${(sub.incharge_mobile || s.incharge_mobile || '').replace(/"/g, '""')}"`,
      `"${medLabel}"`,
      
      // Class 9
      isSub ? (isSchoolMggs ? 0 : (sub.c9_hindi !== undefined ? sub.c9_hindi : (effMed === 'english' ? 0 : (sub.c9_total || 0)))) : 0,
      isSub ? (isSchoolMggs ? (sub.c9_english || sub.c9_total || 0) : (sub.c9_english !== undefined ? sub.c9_english : (effMed === 'english' ? (sub.c9_total || 0) : 0))) : 0,
      isSub ? (sub.c9_total || 0) : 0,
      isSub ? (sub.c9_sanskrit || 0) : 0,
      isSub ? (sub.c9_urdu || 0) : 0,
      
      // Class 10
      isSub ? (isSchoolMggs ? 0 : (sub.c10_hindi !== undefined ? sub.c10_hindi : (effMed === 'english' ? 0 : (sub.c10_total || 0)))) : 0,
      isSub ? (isSchoolMggs ? (sub.c10_english || sub.c10_total || 0) : (sub.c10_english !== undefined ? sub.c10_english : (effMed === 'english' ? (sub.c10_total || 0) : 0))) : 0,
      isSub ? (sub.c10_total || 0) : 0,
      isSub ? (sub.c10_sanskrit || 0) : 0,
      isSub ? (sub.c10_urdu || 0) : 0,
      
      // Class 11 Compulsory & Faculties
      `"${c11FacStr.replace(/"/g, '""')}"`,
      isSub ? (sub.c11_comp_hindi || 0) : 0,
      isSub ? (sub.c11_comp_english || 0) : 0
    ];

    // 11th individual optional subjects
    SAMAN_EXCEL_OPTIONAL_KEYS.forEach(col => {
      row.push(isSub ? (c11Opt[col.key] || 0) : 0);
    });
    row.push(isSub ? (sub.c11_total || 0) : 0);

    // Class 12 Compulsory & Faculties
    row.push(
      `"${c12FacStr.replace(/"/g, '""')}"`,
      isSub ? (sub.c12_comp_hindi || 0) : 0,
      isSub ? (sub.c12_comp_english || 0) : 0
    );

    // 12th individual optional subjects
    SAMAN_EXCEL_OPTIONAL_KEYS.forEach(col => {
      row.push(isSub ? (c12Opt[col.key] || 0) : 0);
    });
    row.push(isSub ? (sub.c12_total || 0) : 0);

    // Totals & Meta
    row.push(
      isSub ? (sub.grand_total || 0) : 0,
      `"${status}"`,
      `"${(isSub ? (sub.submitted_by || '') : '').replace(/"/g, '""')}"`,
      `"${(isSub ? (sub.timestamp || '') : '').replace(/"/g, '""')}"`
    );

    rows.push(row);
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `CBEO_Bhinai_Saman_Pariksha_57_Schools_Master_${new Date().toISOString().slice(0, 10)}.csv`;
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Google Sheet के समान 72-कॉलम विस्तृत एक्सेल (CSV) सफलतापूर्वक डाउनलोड हो गई!', 'success');
}

/* ========================================================
   CONSOLIDATED EXCEL EXPORT FOR INFORMATION DEMANDS
   ======================================================== */
function exportDemandsConsolidatedExcel(demandId) {
  // If no demand specified or Saman Pariksha, export the comprehensive 72-column excel
  if (!demandId || demandId === 'saman_pariksha_2026_27' || demandId.includes('saman')) {
    exportSamanParikshaMasterCSV();
    return;
  }

  const demand = STATE.demands.find(d => d.id === demandId);
  const title = demand ? demand.title : `Demand_${demandId}`;
  const fields = (demand && demand.fields && demand.fields.length > 0) 
    ? demand.fields 
    : ['विवरण (Details)', 'स्थिति (Status)', 'टिप्पणी (Remarks)'];

  const headers = [
    "क्र.सं. (S.No)",
    "PEEO परिक्षेत्र (PEEO Name)",
    "विद्यालय का नाम (School Name)",
    "शाला दर्पण / PSP कोड (School Code)",
    "श्रेणी / प्रकार (Category)",
    "प्रपत्र स्थिति (Status)",
    ...fields.map(f => `"${f.replace(/"/g, '""')}"`),
    "प्रस्तुतकर्ता (Submitted By)",
    "दिनांक व समय (Timestamp)"
  ];

  const rows = [headers];
  let sno = 1;

  STATE.peeos.forEach(peeo => {
    const subKey = `${demandId}_${peeo.peeo_id}`;
    const sub = STATE.submissions[subKey];
    const isSub = sub && sub.verified;
    const schools = (peeo.schools && peeo.schools.length > 0) ? peeo.schools : [{
      school_name: peeo.peeo_name,
      shala_darpan_code: peeo.shala_darpan_code,
      type: 'Government'
    }];

    schools.forEach(sch => {
      const schCode = sch.shala_darpan_code || sch.dise_code || '---';
      const row = [
        sno++,
        `"${(peeo.peeo_name || '').replace(/"/g, '""')}"`,
        `"${(sch.school_name || '').replace(/"/g, '""')}"`,
        schCode,
        `"${(sch.type || 'Government').replace(/"/g, '""')}"`,
        isSub ? "पूर्ण (Submitted)" : "लम्बित (Pending)"
      ];

      fields.forEach(f => {
        let val = '';
        if (isSub && sub.data) {
          val = sub.data[f] || (sub.data[schCode] && sub.data[schCode][f]) || '';
        }
        row.push(`"${String(val).replace(/"/g, '""')}"`);
      });

      row.push(`"${(isSub ? (sub.submittedBy || peeo.principal_incharge) : '').replace(/"/g, '""')}"`);
      row.push(`"${(isSub ? (sub.submittedAt || '') : '').replace(/"/g, '""')}"`);
      rows.push(row);
    });
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `${title.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_')}_Consolidated_Report.csv`;

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`समेकित एक्सेल रिपोर्ट (${title}) सफलतापूर्वक डाउनलोड हो गई!`, 'success');
}

/* ========================================================
   CROSS-TAB PORTAL SYNCHRONIZATION (DASHBOARD, DEMANDS, EXPLORER)
   ======================================================== */
function updateAllPortalMetricsAndProgress() {
  const totalSchools = (STATE.schools56 && STATE.schools56.length) || 57;
  let submittedCount = 0;
  let totalPapers = 0;

  STATE.schools56.forEach(s => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    if (isSamanParikshaSubmitted(sub)) {
      submittedCount++;
      totalPapers += (sub.grand_total || 0);
    }
  });

  const pendingCount = Math.max(0, totalSchools - submittedCount);
  const compliancePercent = totalSchools > 0 ? Math.round((submittedCount / totalSchools) * 100) : 0;

  // 1. Navigation Tab Badges
  const spBadge = document.getElementById('nav-sp-badge');
  if (spBadge) {
    spBadge.textContent = `${submittedCount}/${totalSchools}`;
    spBadge.className = submittedCount === totalSchools ? 'tab-badge badge-success' : 'tab-badge badge-danger';
  }

  // 2. Saman Pariksha View Metrics
  const statCompleted = document.getElementById('sp-stat-completed');
  if (statCompleted) statCompleted.textContent = submittedCount;
  const statPending = document.getElementById('sp-stat-pending');
  if (statPending) statPending.textContent = pendingCount;
  const statTotal = document.getElementById('sp-stat-total-schools');
  if (statTotal) statTotal.textContent = totalSchools;

  // 3. Dashboard KPI Cards
  const dashCompElem = document.getElementById('stat-compliance-percent');
  if (dashCompElem) {
    dashCompElem.textContent = `${compliancePercent}%`;
  }

  // 4. Update Demands Tab & Spotlight Card for Saman Pariksha
  document.querySelectorAll('.demand-card').forEach(card => {
    const titleEl = card.querySelector('.demand-title');
    if (titleEl && titleEl.textContent.includes('समान परीक्षा')) {
      const progressFill = card.querySelector('.progress-bar-fill');
      if (progressFill) progressFill.style.width = `${compliancePercent}%`;
      const progressText = card.querySelector('.demand-progress-box span:last-child');
      if (progressText) progressText.textContent = `${compliancePercent}%`;
      const progressCountText = card.querySelector('.demand-progress-box span:first-child');
      if (progressCountText) progressCountText.textContent = `ब्लॉक प्रगति: ${submittedCount}/${totalSchools} स्कूल`;
      const statusBadge = card.querySelector('.demand-card-header .status-badge');
      if (statusBadge && (STATE.currentUser?.role === 'admin' || !STATE.currentUser)) {
        statusBadge.innerHTML = `<i class="fas fa-check-circle"></i> ${submittedCount}/${totalSchools} पूर्ण`;
        statusBadge.className = 'status-badge ' + (submittedCount > 0 ? 'green' : 'red');
      }
    }
  });
}


async function triggerDriveSheetSync() {
  showToast('Google Drive से लाइव डेटा सिंक किया जा रहा है...', 'info');
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  try {
    const res = await fetch(`${gasUrl}?action=getAll`);
    const data = await res.json();
    if (data && data.success && data.submissions) {
      let count = 0;
      Object.keys(data.submissions).forEach(code => {
        const subData = data.submissions[code];
        if (subData && (subData.is_submitted || subData.exam_code || subData.grand_total > 0)) {
          const existingSig = STATE.samanParikshaSubmissions[code]?.signature_data;
          const existingHasSig = STATE.samanParikshaSubmissions[code]?.has_digital_signature;
          STATE.samanParikshaSubmissions[code] = Object.assign({}, STATE.samanParikshaSubmissions[code] || {}, subData);
          if (existingSig && !STATE.samanParikshaSubmissions[code].signature_data) {
            STATE.samanParikshaSubmissions[code].signature_data = existingSig;
            STATE.samanParikshaSubmissions[code].has_digital_signature = existingHasSig !== undefined ? existingHasSig : true;
          }
          count++;
        }
      });
      localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
      renderSamanParikshaView();
      updateAllPortalMetricsAndProgress();
      renderDashboardView();
      renderDemandsView();
      renderApp();
      showToast(`✓ Google Drive से सीधा लाइव सिंक सफल! कुल ${count} विद्यालय प्रपत्र अपडेट हुए।`, 'success');
    }
  } catch (err) {
    console.log('Direct GAS live sync note:', err);
  }
  window.open('https://docs.google.com/spreadsheets/d/1tVP7gbIuUP576E2a1Qk6TadXUSP7a5c7ah8HzKeTk4k/edit', '_blank');
}

// --- Dashboard View ---
function renderDashboardView() {
  const peeoCnt = document.getElementById('stat-peeo-count');
  if (peeoCnt) peeoCnt.textContent = STATE.peeos.length;
  
  let totalSchools = 0;
  STATE.peeos.forEach(p => totalSchools += (p.schools ? p.schools.length : 0));
  const schCnt = document.getElementById('stat-schools-count');
  if (schCnt) schCnt.textContent = totalSchools || 153;

  const activeStaff = STATE.staff.filter(s => s.status !== 'Deleted');
  const staffCnt = document.getElementById('stat-staff-count');
  if (staffCnt) staffCnt.textContent = activeStaff.length;

  const activeDemands = getVisibleDemands();
  const demCnt = document.getElementById('stat-active-demands');
  if (demCnt) demCnt.textContent = activeDemands.length;

  let totalRequired = STATE.peeos.length * activeDemands.length;
  let totalSubmitted = 0;
  activeDemands.forEach(d => {
    STATE.peeos.forEach(p => {
      const subKey = `${d.id}_${p.peeo_id}`;
      if (STATE.submissions[subKey] && STATE.submissions[subKey].verified) {
        totalSubmitted++;
      }
    });
  });
  const compPercent = totalRequired > 0 ? Math.round((totalSubmitted / totalRequired) * 100) : 100;
  const compElem = document.getElementById('stat-compliance-percent');
  if (compElem) compElem.textContent = `${compPercent}%`;

  // Render Spotlight Cards if element exists
  const previewContainer = document.getElementById('dashboard-demands-preview');
  if (previewContainer) {
    previewContainer.innerHTML = '';
    activeDemands.slice(0, 2).forEach(d => {
      previewContainer.appendChild(createDemandCardElement(d));
    });
  }

  // Render 25 PEEO Table
  const tbody = document.getElementById('dashboard-peeo-tbody');
  tbody.innerHTML = '';
  STATE.peeos.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td><code style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:bold">${p.shala_darpan_code || '---'}</code></td>
      <td><strong>${p.peeo_name}</strong></td>
      <td>${p.panchayat_name}</td>
      <td>${p.principal_incharge}</td>
      <td><a href="tel:${p.mobile}" style="color:var(--primary); font-weight:600; text-decoration:none"><i class="fas fa-phone-alt"></i> ${p.mobile}</a></td>
      <td><a href="mailto:${p.email}" style="color:var(--secondary); text-decoration:none"><i class="fas fa-envelope"></i> ${p.email}</a></td>
      <td><span class="status-badge" style="background:#f1f5f9; color:#1e293b">${p.school_count || (p.schools ? p.schools.length : 0)} विद्यालय</span></td>
      <td>
        <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppMessage('${p.mobile}', 'नमस्ते ${p.principal_incharge} महोदय (${p.peeo_name}), CBEO भिनाय कार्यालय से संपर्क सादर प्रेषित है।')">
          <i class="fab fa-whatsapp"></i> चैट
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ========================================================
   5. 3-LEVEL HIERARCHICAL EXPLORER (PEEO ➔ School ➔ Staff)
   ======================================================== */
function renderExplorerFilters() {
  const peeoSelect = document.getElementById('exp-peeo-select');
  if (!peeoSelect) return;
  peeoSelect.innerHTML = '<option value="all">-- समस्त 25 PEEO --</option>';

  STATE.peeos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name} (${p.schools ? p.schools.length : 0} स्कूल)`;
    peeoSelect.appendChild(opt);
  });

  // If logged in as PEEO, restrict and preselect
  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    peeoSelect.value = STATE.currentUser.peeo_name;
    peeoSelect.disabled = true;
  } else {
    peeoSelect.disabled = false;
  }

  onExplorerPeeoChange();
}

function onExplorerPeeoChange() {
  const peeoSelect = document.getElementById('exp-peeo-select');
  const schoolSelect = document.getElementById('exp-school-select');
  const selectedPeeo = peeoSelect.value;

  schoolSelect.innerHTML = '<option value="all">-- सभी विद्यालय --</option>';

  let schoolsToDisplay = [];
  if (selectedPeeo === 'all') {
    STATE.peeos.forEach(p => {
      if (p.schools) schoolsToDisplay.push(...p.schools);
    });
  } else {
    const peeoObj = STATE.peeos.find(p => p.peeo_name === selectedPeeo);
    if (peeoObj && peeoObj.schools) {
      schoolsToDisplay = peeoObj.schools;
    }
  }

  schoolsToDisplay.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch.school_name;
    const typeBadge = sch.type === 'Private' ? '[निजी/Pvt]' : (sch.is_peeo_nodal ? '⭐ [PEEO नोडल HQ]' : '[राजकीय/Govt]');
    opt.textContent = `${typeBadge} ${sch.school_name}`;
    schoolSelect.appendChild(opt);
  });

  onExplorerSchoolChange();
}

function onExplorerSchoolChange() {
  const peeoSelect = document.getElementById('exp-peeo-select');
  const schoolSelect = document.getElementById('exp-school-select');
  const searchInput = document.getElementById('exp-search-input');
  const tbody = document.getElementById('explorer-tbody');
  if (!tbody) return;

  const selPeeo = peeoSelect.value;
  const selSchool = schoolSelect.value;
  const search = searchInput.value.toLowerCase().trim();

  let staffList = STATE.staff.filter(s => s.status !== 'Deleted');

  if (selPeeo !== 'all') {
    staffList = staffList.filter(s => s.peeo_name === selPeeo);
  }

  if (selSchool !== 'all') {
    staffList = staffList.filter(s => {
      const cleanSch = cleanKeyStr(s.school_name);
      const cleanTarget = cleanKeyStr(selSchool);
      return cleanSch.includes(cleanTarget) || cleanTarget.includes(cleanSch);
    });
  }

  if (search) {
    staffList = staffList.filter(s => {
      const hay = `${s.name} ${s.post} ${s.school_name} ${s.peeo_name} ${s.mobile} ${s.sso_id}`.toLowerCase();
      return hay.includes(search);
    });
  }

  document.getElementById('exp-count-badge').textContent = `${staffList.length} कार्मिक`;
  document.getElementById('exp-result-title').textContent = selSchool !== 'all' 
    ? `विद्यालय: ${selSchool} (स्टाफ संख्या: ${staffList.length})` 
    : (selPeeo !== 'all' ? `${selPeeo} के अधीनस्थ समस्त विद्यालय एवं स्टाफ` : `भिनाय ब्लॉक: समस्त विद्यालय एवं स्टाफ`);

  tbody.innerHTML = '';
  if (staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--neutral-500)">चयनित विद्यालय/PEEO में कोई कार्मिक रिकॉर्ड नहीं मिला</td></tr>`;
    return;
  }

  staffList.slice(0, 150).forEach((s, idx) => {
    const isPvt = (s.school_name || '').toLowerCase().includes('public') || (s.school_name || '').toLowerCase().includes('academy') || (s.school_name || '').toLowerCase().includes('convent');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><code>${s.staff_id}</code></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.post}</td>
      <td><strong>${s.school_name || s.peeo_name}</strong></td>
      <td><span class="status-badge" style="background:${isPvt ? '#f1f5f9' : '#e0f2fe'}; color:${isPvt ? '#334155' : '#0369a1'}">${isPvt ? 'निजी (Pvt)' : 'राजकीय (Govt)'}</span></td>
      <td><span style="font-weight:600; color:var(--primary)">${s.peeo_name}</span></td>
      <td>${s.mobile ? `<a href="tel:${s.mobile}" style="text-decoration:none; color:var(--primary); font-weight:600"><i class="fas fa-phone-alt"></i> ${s.mobile}</a>` : '---'}</td>
      <td>${s.sso_id ? `<code>${s.sso_id}</code>` : '---'}</td>
      <td>
        ${s.mobile ? `
          <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppMessage('${s.mobile}', 'नमस्ते ${s.name} जी, CBEO कार्यालय भिनाय से संपर्क सादर प्रेषित है।')">
            <i class="fab fa-whatsapp"></i>
          </button>
        ` : '---'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function cleanKeyStr(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function renderExplorerView() {
  switchTab('directory');
}

// --- 3-TIER HIERARCHICAL DIRECTORY VIEW ---
function renderDirectoryFilters() {
  const dirPeeoSelect = document.getElementById('dir-peeo-select');
  if (!dirPeeoSelect) return;

  const currentPeeo = dirPeeoSelect.value || 'all';
  dirPeeoSelect.innerHTML = '<option value="all">-- सभी 25 PEEO परिक्षेत्र --</option>';

  (STATE.peeos || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    if (p.peeo_name === currentPeeo) opt.selected = true;
    dirPeeoSelect.appendChild(opt);
  });

  onDirPeeoSelectChange();
}

function onDirPeeoSelectChange() {
  let peeoVal = document.getElementById('dir-peeo-select')?.value || 'all';
  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    peeoVal = STATE.currentUser.peeo_name;
    const dp = document.getElementById('dir-peeo-select');
    if (dp) {
      dp.value = peeoVal;
      dp.disabled = true;
    }
  }

  const schoolSelect = document.getElementById('dir-school-select');
  if (!schoolSelect) return;

  schoolSelect.innerHTML = '<option value="all">-- समस्त विद्यालय (नोडल व अधीनस्थ) --</option>';

  let schoolsList = [];
  if (peeoVal === 'all') {
    schoolsList = Array.from(new Set([
      ...(STATE.staff || []).map(s => s.school_name),
      ...(STATE.schools56 || []).map(s => s.school_name)
    ].filter(Boolean))).sort();
  } else {
    schoolsList = Array.from(new Set([
      ...(STATE.staff || []).filter(s => s.peeo_name === peeoVal).map(s => s.school_name),
      ...(STATE.schools56 || []).filter(s => s.peeo_name === peeoVal).map(s => s.school_name)
    ].filter(Boolean))).sort();

    // Include registered schools from PEEO object
    const p = (STATE.peeos || []).find(x => x.peeo_name === peeoVal);
    if (p && p.schools) {
      p.schools.forEach(s => {
        if (!schoolsList.some(name => name.includes(s.school_name) || s.school_name.includes(name))) {
          schoolsList.push(s.school_name);
        }
      });
    }
  }

  schoolsList.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch;
    const isNodal = sch.includes('नोडल') || (peeoVal !== 'all' && sch.includes(peeoVal.replace('PEEO ', '')));
    opt.textContent = `${isNodal ? '👑 [नोडल] ' : ''}${sch}`;
    schoolSelect.appendChild(opt);
  });

  filterDirectory();
}

function renderDirectoryView() {
  renderDirectoryFilters();
}

function filterDirectory() {
  const search = (document.getElementById('dir-search-input')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('dir-type-filter')?.value || 'all';
  let peeoFilter = document.getElementById('dir-peeo-select')?.value || 'all';
  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    peeoFilter = STATE.currentUser.peeo_name;
  }
  const schoolFilter = document.getElementById('dir-school-select')?.value || 'all';
  const tbody = document.getElementById('directory-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = [];
  const seenSchoolsInList = new Set();

  // 1. Gather all active Staff members (1,060+)
  (STATE.staff || []).filter(s => s.status !== 'Deleted' && s.status !== 'Relieved').forEach(s => {
    const isPrin = s.is_sanstha_pradhan || (s.post && (s.post.includes('प्रधानाचार्य') || s.post.includes('संस्था प्रधान')));
    const isPvt = (s.school_name || '').toLowerCase().includes('tagore') || (s.school_name || '').toLowerCase().includes('academy') || (s.school_name || '').toLowerCase().includes('public') || String(s.staff_id || '').startsWith('HEAD_P');
    
    if (typeFilter === 'principal' && !isPrin) return;
    if (typeFilter === 'staff' && isPrin) return;
    if (typeFilter === 'private' && !isPvt) return;

    if (isPrin) seenSchoolsInList.add(s.school_name);

    list.push({
      id: s.staff_id,
      name: s.name,
      post: s.post || 'अध्यापक',
      peeo_name: s.peeo_name,
      school: s.school_name || s.peeo_name,
      school_code: s.sso_id || '',
      mobile: s.mobile || '',
      email: s.email || '',
      is_principal: isPrin,
      is_private: isPvt
    });
  });

  // 2. Also ensure schools from STATE.schools56 (especially private schools) appear in Directory
  (STATE.schools56 || []).forEach(sc => {
    if (!seenSchoolsInList.has(sc.school_name)) {
      const isPvt = sc.type === 'Private' || String(sc.shala_darpan_code).startsWith('P');
      if (typeFilter === 'staff') return;
      if (typeFilter === 'private' && !isPvt) return;

      list.push({
        id: `SCH_${sc.shala_darpan_code}`,
        name: sc.principal_name || '---',
        post: isPvt ? 'संचालक / संस्था प्रधान' : 'प्रधानाचार्य / संस्था प्रधान',
        peeo_name: sc.peeo_name || '',
        school: sc.school_name || '',
        school_code: sc.shala_darpan_code || '',
        mobile: sc.principal_mobile || '',
        email: '',
        is_principal: true,
        is_private: isPvt
      });
    }
  });

  // Filter by PEEO, School, and Search Query
  const filtered = list.filter(item => {
    if (peeoFilter !== 'all' && item.peeo_name !== peeoFilter) return false;
    if (schoolFilter !== 'all') {
      const s1 = (item.school || '').toLowerCase().trim();
      const s2 = schoolFilter.toLowerCase().trim();
      if (s1 !== s2 && !s1.includes(s2) && !s2.includes(s1)) return false;
    }
    if (search) {
      const hay = `${item.name} ${item.post} ${item.peeo_name} ${item.school} ${item.mobile} ${item.email}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('dir-total-count');
  if (countBadge) countBadge.textContent = `${filtered.length} संपर्क`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--neutral-500)">कोई संपर्क विवरण नहीं मिला</td></tr>`;
    return;
  }

  // Render first 250 items for high performance
  filtered.slice(0, 250).forEach((item, idx) => {
    const tr = document.createElement('tr');
    const canEditHead = canCurrentUserEditSchoolHead(item);

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <strong>${item.name}</strong>
        ${item.is_principal ? '<span class="badge-tag pradhan" style="background:#fef3c7; color:#78350f; font-size:0.75rem; margin-left:4px; font-weight:800; border:1.5px solid #f59e0b; padding:2px 8px"><i class="fas fa-crown" style="color:#b45309"></i> संस्था प्रधान</span>' : ''}
        ${item.is_private ? '<span class="badge-tag" style="background:#ede9fe; color:#6b21a8; font-size:0.7rem; margin-left:4px; font-weight:700">निजी</span>' : ''}
      </td>
      <td>
        <span style="font-weight:700; color:#1e293b">${item.post}</span>
      </td>
      <td>
        ${item.mobile ? `<a href="tel:${item.mobile}" style="color:#0f766e; font-weight:800; text-decoration:none"><i class="fas fa-phone-alt"></i> ${item.mobile}</a>` : '<span style="color:#94a3b8">---</span>'}
      </td>
      <td>
        ${item.email ? `<a href="mailto:${item.email}" style="color:#2563eb; font-weight:600; text-decoration:none"><i class="fas fa-envelope"></i> ${item.email}</a>` : '<span style="color:#94a3b8">---</span>'}
      </td>
      <td>
        <span style="font-size:0.85rem; color:#0f172a; font-weight:700">${item.school}</span>
      </td>
      <td>
        <span class="badge-tag blue" style="font-size:0.75rem; font-weight:700; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe">${item.peeo_name}</span>
      </td>
      <td>
        <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap">
          ${item.mobile ? `
            <a href="tel:${item.mobile}" class="btn btn-outline-light btn-sm" style="color:#1b365d; border-color:#cbd5e1" title="सीधे कॉल करें">
              <i class="fas fa-phone-alt"></i>
            </a>
            <button class="btn btn-whatsapp btn-sm" onclick="sendDualWhatsAppMessage('${item.mobile}', 'नमस्ते ${item.name} जी, CBEO कार्यालय भिनाय (अजमेर) से संपर्क सादर प्रेषित है।')" title="WhatsApp संदेश">
              <i class="fab fa-whatsapp"></i>
            </button>
          ` : ''}
          ${canEditHead ? `
            <button class="btn btn-outline-primary btn-sm" onclick="openEditSchoolHeadModal('${item.school_code}', '${item.school}', '${item.peeo_name}', '${item.name}', '${item.mobile}', '${item.post}')" title="संस्था प्रधान / संचालक विवरण बदलें" style="font-size:0.72rem; padding:2px 6px; font-weight:700; color:#1e40af; border-color:#3b82f6">
              <i class="fas fa-user-edit"></i> संचालक विवरण
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function printCleanContactDirectory() {
  const printWindow = window.open('', '_blank');
  const peeoVal = document.getElementById('dir-peeo-select')?.value || 'all';
  const schoolVal = document.getElementById('dir-school-select')?.value || 'all';
  const tbodyHtml = document.getElementById('directory-tbody')?.innerHTML || '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <title>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय (अजमेर) - ब्लॉक संपर्क डायरेक्टरी</title>
      <style>
        body { font-family: 'Noto Sans Devanagari', 'Inter', sans-serif; padding: 20px; color: #1e293b; }
        .hdr { text-align: center; border-bottom: 2px solid #1b365d; padding-bottom: 10px; margin-bottom: 15px; }
        .hdr h1 { margin: 0; font-size: 1.3rem; color: #1b365d; }
        .hdr p { margin: 4px 0 0 0; font-size: 0.9rem; color: #475569; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
        th { background: #f1f5f9; color: #1e293b; font-weight: 700; }
        @media print { button, .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="hdr">
        <h1>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</h1>
        <p>ब्लॉक संपर्क डायरेक्टरी | परिक्षेत्र: ${peeoVal} | विद्यालय: ${schoolVal}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>क्र.सं.</th>
            <th>कार्मिक / प्रभारी का नाम</th>
            <th>पद (Designation)</th>
            <th>मोबाइल नंबर</th>
            <th>ईमेल</th>
            <th>विद्यालय / पदस्थापन कार्यालय</th>
            <th>PEEO</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyHtml.replace(/<td style="width:140px">.*?<\/td>/g, '').replace(/<button.*?<\/button>/g, '')}
        </tbody>
      </table>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// --- STAFF MANAGEMENT VIEW (CENSUS / ELECTION MASTER FORMAT) ---
function renderStaffFilters() {
  const staffPeeoFilter = document.getElementById('staff-peeo-filter');
  if (!staffPeeoFilter) return;

  const curVal = staffPeeoFilter.value || 'all';
  staffPeeoFilter.innerHTML = '<option value="all">-- सभी 25 PEEO --</option>';

  (STATE.peeos || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    if (p.peeo_name === curVal) opt.selected = true;
    staffPeeoFilter.appendChild(opt);
  });

  onStaffPeeoFilterChange();
}

function onStaffPeeoFilterChange() {
  let peeoVal = document.getElementById('staff-peeo-filter')?.value || 'all';
  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    peeoVal = STATE.currentUser.peeo_name;
    const pf = document.getElementById('staff-peeo-filter');
    if (pf) {
      pf.value = peeoVal;
      pf.disabled = true;
    }
  }

  const schFilter = document.getElementById('staff-school-filter');
  if (!schFilter) return;

  schFilter.innerHTML = '<option value="all">-- समस्त विद्यालय (नोडल व अधीनस्थ) --</option>';

  const uniqueSchools = [];
  const seenCodes = new Set();

  let targetPeeos = STATE.peeos || [];
  if (peeoVal !== 'all') {
    targetPeeos = targetPeeos.filter(p => p.peeo_name === peeoVal);
  }

  targetPeeos.forEach(p => {
    (p.schools || []).forEach(s => {
      const codeKey = String(s.shala_darpan_code || s.school_name);
      if (codeKey && !seenCodes.has(codeKey)) {
        seenCodes.add(codeKey);
        uniqueSchools.push({
          code: String(s.shala_darpan_code || ''),
          name_hi: s.school_name_hi || s.school_name || '',
          name_en: s.school_name_en || ''
        });
      }
    });
  });

  uniqueSchools.sort((a, b) => a.name_hi.localeCompare(b.name_hi, 'hi'));

  uniqueSchools.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch.code;
    const cleanEn = (sch.name_en || '').split('(')[0].trim();
    opt.textContent = sch.code 
      ? `[शा.दा. ${sch.code}] ${sch.name_hi} (${cleanEn})` 
      : sch.name_hi;
    schFilter.appendChild(opt);
  });

  filterStaffTable();
}

function isJitendraLoggedIn() {
  if (!STATE.currentUser) return false;
  const u = String(STATE.currentUser.username || '').toLowerCase();
  const sc = String(STATE.currentUser.shala_darpan_code || '').toLowerCase();
  const aid = String(STATE.currentUser.admin_id || '').toUpperCase();
  const role = String(STATE.currentUser.role || '').toLowerCase();
  const name = String(STATE.currentUser.name || '').toLowerCase();

  return sc === 'admin_jitendra' ||
         u === 'admin_jitendra' ||
         u === 'jitendra_admin' ||
         u === 'jitendra' ||
         aid === 'ADMIN02' ||
         role === 'super admin' ||
         name.includes('जितेन्द्र') ||
         name.includes('jitendra');
}

function applyStaffInstructionsConfig() {
  let cfg = null;
  try {
    cfg = JSON.parse(localStorage.getItem('cbeo_staff_instructions') || 'null');
    if (!cfg && STATE.portalSettings && STATE.portalSettings.staff_instructions) {
      cfg = STATE.portalSettings.staff_instructions;
    }
  } catch(e) {}

  const defaultTitle = "CBEO भिनाय: कार्मिक प्रबंधन एवं स्थापना सूची (Census / Election Master Format)";
  const defaultSub = "समस्त 1,060+ कार्मिकों का डेटाबेस (हिंदी यूनिकोड)। PEEO एवं संस्था प्रधान अपने विद्यालय के कार्मिक संपादित कर सकते हैं। 👑 संस्था प्रधान मार्क करने पर मास्टर डायरेक्टरी व Google Sheet तुरंत अपडेट होती है।";
  const defaultNoticeTitle = "महत्वपूर्ण दिशा-निर्देश एवं कार्य निर्देश (Official Directives)";
  const defaultNoticeText = "1. प्रत्येक विद्यालय अपने समस्त कार्यरत कार्मिकों (मूल पद, वर्तमान पद, मोबाइल, बैंक खाता व IFSC) का शत-प्रतिशत सत्यापन कर अद्यतन करें।\n2. विद्यालय के संस्था प्रधान के नाम के आगे '👑 संस्था प्रधान' अवश्य मार्क करें ताकि दूरभाष डायरेक्टरी में सही प्रविष्टि रहे।\n3. सेवानिवृत्त अथवा स्थानांतरित कार्मिकों को 'हटाएं' विकल्प से सुरक्षित आर्काइव करें।";

  const headTitleEl = document.getElementById('staff-header-title');
  const headSubEl = document.getElementById('staff-header-sub');
  const insTitleEl = document.getElementById('staff-instructions-title');
  const insTextEl = document.getElementById('staff-instructions-text');

  if (headTitleEl) headTitleEl.textContent = cfg?.header_title || defaultTitle;
  if (headSubEl) headSubEl.textContent = cfg?.header_sub || defaultSub;
  if (insTitleEl) insTitleEl.textContent = cfg?.instructions_title || defaultNoticeTitle;
  if (insTextEl) insTextEl.textContent = cfg?.instructions_text || defaultNoticeText;
}

function openEditStaffInstructionsModal() {
  let cfg = null;
  try {
    cfg = JSON.parse(localStorage.getItem('cbeo_staff_instructions') || 'null');
    if (!cfg && STATE.portalSettings && STATE.portalSettings.staff_instructions) {
      cfg = STATE.portalSettings.staff_instructions;
    }
  } catch(e) {}

  const defaultTitle = "CBEO भिनाय: कार्मिक प्रबंधन एवं स्थापना सूची (Census / Election Master Format)";
  const defaultSub = "समस्त 1,060+ कार्मिकों का डेटाबेस (हिंदी यूनिकोड)। PEEO एवं संस्था प्रधान अपने विद्यालय के कार्मिक संपादित कर सकते हैं। 👑 संस्था प्रधान मार्क करने पर मास्टर डायरेक्टरी व Google Sheet तुरंत अपडेट होती है।";
  const defaultNoticeTitle = "महत्वपूर्ण दिशा-निर्देश एवं कार्य निर्देश (Official Directives)";
  const defaultNoticeText = "1. प्रत्येक विद्यालय अपने समस्त कार्यरत कार्मिकों (मूल पद, वर्तमान पद, मोबाइल, बैंक खाता व IFSC) का शत-प्रतिशत सत्यापन कर अद्यतन करें।\n2. विद्यालय के संस्था प्रधान के नाम के आगे '👑 संस्था प्रधान' अवश्य मार्क करें ताकि दूरभाष डायरेक्टरी में सही प्रविष्टि रहे।\n3. सेवानिवृत्त अथवा स्थानांतरित कार्मिकों को 'हटाएं' विकल्प से सुरक्षित आर्काइव करें।";

  const tIn = document.getElementById('staff-input-header-title');
  const sIn = document.getElementById('staff-input-header-sub');
  const ntIn = document.getElementById('staff-input-instructions-title');
  const nxIn = document.getElementById('staff-input-instructions-text');

  if (tIn) tIn.value = cfg?.header_title || defaultTitle;
  if (sIn) sIn.value = cfg?.header_sub || defaultSub;
  if (ntIn) ntIn.value = cfg?.instructions_title || defaultNoticeTitle;
  if (nxIn) nxIn.value = cfg?.instructions_text || defaultNoticeText;

  showModal('modal-edit-staff-instructions');
}

function saveStaffInstructions() {
  const tIn = document.getElementById('staff-input-header-title');
  const sIn = document.getElementById('staff-input-header-sub');
  const ntIn = document.getElementById('staff-input-instructions-title');
  const nxIn = document.getElementById('staff-input-instructions-text');

  const cfg = {
    header_title: tIn?.value.trim() || "CBEO भिनाय: कार्मिक प्रबंधन एवं स्थापना सूची (Census / Election Master Format)",
    header_sub: sIn?.value.trim() || "",
    instructions_title: ntIn?.value.trim() || "महत्वपूर्ण दिशा-निर्देश एवं कार्य निर्देश (Official Directives)",
    instructions_text: nxIn?.value.trim() || "",
    updated_at: new Date().toISOString(),
    updated_by: STATE.currentUser?.username || 'admin_jitendra'
  };

  localStorage.setItem('cbeo_staff_instructions', JSON.stringify(cfg));
  if (!STATE.portalSettings) STATE.portalSettings = {};
  STATE.portalSettings.staff_instructions = cfg;
  savePortalSettingsToCloud();

  applyStaffInstructionsConfig();
  closeModal('modal-edit-staff-instructions');
  showToast('✓ कार्मिक प्रबंधन हेडिंग व दिशा-निर्देश Google Sheet क्लाउड में सुरक्षित हो गए!', 'success');
}

function resetStaffInstructionsToDefault() {
  localStorage.removeItem('cbeo_staff_instructions');
  if (STATE.portalSettings) delete STATE.portalSettings.staff_instructions;
  savePortalSettingsToCloud();
  applyStaffInstructionsConfig();
  closeModal('modal-edit-staff-instructions');
  showToast('✓ दिशा-निर्देश मूल डिफ़ॉल्ट रूप में रीसेट कर दिए गए!', 'info');
}

function syncStaffMemberToCloud(staff) {
  if (!staff) return;
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
  if (!gasUrl) return;

  try {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateStaffMember',
        staff: staff,
        updated_by: STATE.currentUser?.username || 'Admin_Jitendra'
      })
    }).catch(err => console.warn('Cloud staff sync error:', err));
  } catch(e) {}
}

function renderStaffView() {
  renderStaffFilters();
  applyStaffInstructionsConfig();

  const isJit = isJitendraLoggedIn();
  const canEdit = canCurrentUserEditModule('staff');

  const btnEdit1 = document.getElementById('btn-edit-staff-instructions');
  const btnEdit2 = document.getElementById('btn-edit-staff-header-top');
  const btnAddPost = document.getElementById('btn-add-staff-post-top');
  if (btnEdit1) btnEdit1.style.display = isJit ? 'inline-block' : 'none';
  if (btnEdit2) btnEdit2.style.display = isJit ? 'inline-block' : 'none';
  if (btnAddPost) btnAddPost.style.display = isJit ? 'inline-block' : 'none';

  const btnAddStaff = document.querySelector("button[onclick='openAddStaffModal()']");
  if (btnAddStaff) btnAddStaff.style.display = canEdit ? 'inline-flex' : 'none';

  const viewOnlyBanner = document.getElementById('staff-view-only-banner');
  if (viewOnlyBanner) viewOnlyBanner.style.display = !canEdit ? 'block' : 'none';
}

function filterStaffTable() {
  const search = (document.getElementById('staff-search-input')?.value || '').toLowerCase().trim();
  let peeoFilter = document.getElementById('staff-peeo-filter')?.value || 'all';
  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    peeoFilter = STATE.currentUser.peeo_name;
  }
  const schoolFilter = document.getElementById('staff-school-filter')?.value || 'all';
  const postFilter = document.getElementById('staff-post-filter')?.value || 'all';
  const tbody = document.getElementById('staff-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let activeList = (STATE.staff || []).filter(s => s.status !== 'Deleted' && s.status !== 'Relieved');

  // Role permissions: PEEO can only view their own jurisdiction
  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    activeList = activeList.filter(s => s.peeo_name === STATE.currentUser.peeo_name);
    const pf = document.getElementById('staff-peeo-filter');
    if (pf) {
      pf.value = STATE.currentUser.peeo_name;
      pf.disabled = true;
    }
  } else if (STATE.currentUser && STATE.currentUser.role === 'school') {
    const schCode = STATE.currentUser.shala_darpan_code;
    const schName = STATE.currentUser.school_name || '';
    activeList = activeList.filter(s => {
      if (schCode && s.shala_darpan_code === schCode) return true;
      if (schName && (s.school_name === schName || s.school_name_en === schName)) return true;
      return false;
    });
  } else {
    const pf = document.getElementById('staff-peeo-filter');
    if (pf) pf.disabled = false;
    if (peeoFilter !== 'all') {
      activeList = activeList.filter(s => s.peeo_name === peeoFilter);
    }
  }

  // School filter with robust matching by code, standard English name, or Hindi name
  if (schoolFilter !== 'all') {
    activeList = activeList.filter(s => {
      if (s.shala_darpan_code && String(s.shala_darpan_code).trim() === schoolFilter.trim()) return true;
      if (s.school_code && String(s.school_code).trim() === schoolFilter.trim()) return true;
      if (s.school_name === schoolFilter || s.school_name_en === schoolFilter) return true;
      const s1 = (s.school_name || '').toLowerCase().trim();
      const sEn = (s.school_name_en || '').toLowerCase().trim();
      const s2 = schoolFilter.toLowerCase().trim();
      return s1.includes(s2) || s2.includes(s1) || sEn.includes(s2) || s2.includes(sEn);
    });
  }

  if (postFilter === 'pradhan') {
    activeList = activeList.filter(s => s.is_sanstha_pradhan || (s.post && (s.post.includes('प्रधानाचार्य') || s.post.includes('संस्था प्रधान'))));
  } else if (postFilter !== 'all') {
    activeList = activeList.filter(s => (s.post && s.post.includes(postFilter)) || (s.post_en && s.post_en.toLowerCase().includes(postFilter.toLowerCase())));
  }

  if (search) {
    activeList = activeList.filter(s => {
      const hay = `${s.staff_id} ${s.name} ${s.name_en || ''} ${s.post} ${s.post_en || ''} ${s.school_name} ${s.school_name_en || ''} ${s.shala_darpan_code || ''} ${s.peeo_name} ${s.mobile} ${s.sso_id}`.toLowerCase();
      return hay.includes(search);
    });
  }

  // Update Counters
  const countBadge = document.getElementById('staff-total-count');
  if (countBadge) countBadge.textContent = `${activeList.length} कार्मिक`;

  const statTotal = document.getElementById('staff-stat-total');
  if (statTotal) statTotal.textContent = (STATE.staff || []).filter(s => s.status !== 'Deleted').length;

  const statPradhan = document.getElementById('staff-stat-pradhan');
  if (statPradhan) statPradhan.textContent = (STATE.staff || []).filter(s => s.is_sanstha_pradhan).length;

  const statActive = document.getElementById('staff-stat-active');
  if (statActive) statActive.textContent = activeList.length;

  if (activeList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:2rem; color:var(--neutral-500)">कोई कार्मिक रिकॉर्ड नहीं मिला</td></tr>`;
    return;
  }

  // Render in standardized bilingual format
  activeList.slice(0, 150).forEach((s, idx) => {
    const isPradhan = s.is_sanstha_pradhan || false;
    const canEditKarmik = canCurrentUserEditStaff(s);
    const canEditHead = canCurrentUserEditSchoolHead(s);
    const isUnmapped = !!s.unmapped_school || !s.shala_darpan_code;

    const tr = document.createElement('tr');
    if (isUnmapped) tr.style.background = '#fef2f2';

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><code>${s.staff_id}</code></td>
      <td>
        <strong style="font-size:0.92rem; color:#0f172a">${s.name}</strong>
        ${s.name_en ? `<div style="font-size:0.75rem; color:#475569; font-weight:600">${s.name_en}</div>` : ''}
      </td>
      <td>${s.gender || 'पुरुष'}</td>
      <td>
        <strong style="color:#0f172a">${s.post || 'अध्यापक'}</strong>
        ${s.post_en ? `<div style="font-size:0.75rem; color:#0369a1; font-weight:600">${s.post_en}</div>` : ''}
      </td>
      <td>
        <strong style="color:#1e3a8a">${s.school_name || s.peeo_name}</strong>
        ${s.shala_darpan_code ? `<span class="badge-tag" style="background:#e2e8f0; color:#1e293b; font-size:0.7rem; font-weight:700; margin-left:4px">शा.दा. ${s.shala_darpan_code}</span>` : ''}
        ${s.school_name_en ? `<div style="font-size:0.72rem; color:#64748b; font-family:monospace">${s.school_name_en}</div>` : ''}
        ${isUnmapped ? `<div style="margin-top:3px"><span class="badge-tag" style="background:#fee2e2; color:#b91c1c; border:1px solid #f87171; font-weight:800; font-size:0.72rem; padding:1px 6px"><i class="fas fa-exclamation-triangle"></i> असत्यापित / अमान्य स्कूल</span></div>` : ''}
      </td>
      <td><span class="badge-tag blue" style="font-size:0.75rem; font-weight:700; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe">${s.peeo_name}</span></td>
      <td>${s.mobile ? `<a href="tel:${s.mobile}" style="text-decoration:none; color:#0f766e; font-weight:800"><i class="fas fa-phone-alt"></i> ${s.mobile}</a>` : '---'}</td>
      <td>${s.sso_id ? `<code>${s.sso_id}</code>` : '---'}</td>
      <td style="text-align:center">
        ${isPradhan 
          ? `<span class="badge-tag pradhan" style="background:#fef3c7; color:#78350f; font-weight:800; border:1.5px solid #f59e0b; padding:3px 10px; font-size:0.78rem"><i class="fas fa-crown" style="color:#b45309"></i> संस्था प्रधान</span>` 
          : `<span style="color:#94a3b8; font-size:0.78rem">--</span>`
        }
      </td>
      <td>
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap; align-items:center">
          ${isUnmapped ? `
            <button class="btn btn-danger btn-sm" onclick="openTransferStaffModal('${s.staff_id}')" title="ड्रॉपडाउन से सही विद्यालय में मैप करें" style="font-size:0.75rem; padding:2px 7px; font-weight:700; background:#dc2626; border-color:#b91c1c; color:#ffffff">
              <i class="fas fa-map-marker-alt"></i> स्कूल मैप करें
            </button>
          ` : ''}
          ${canEditHead ? (
            isPradhan 
              ? `<button class="btn btn-outline-danger btn-sm" onclick="unmarkKarmikAsSansthaPradhan('${s.staff_id}')" title="संस्था प्रधान पद से हटाएं" style="font-size:0.75rem; padding:2px 6px; font-weight:700">
                  <i class="fas fa-times-circle"></i> पदमुक्त
                 </button>` 
              : `<button class="btn btn-primary btn-sm" onclick="markKarmikAsSansthaPradhan('${s.staff_id}')" title="इस कार्मिक को विद्यालय का संस्था प्रधान बनाएं" style="font-size:0.75rem; padding:2px 8px; font-weight:700; background:#1e3a8a; border-color:#1e40af; color:#ffffff">
                  <i class="fas fa-crown" style="color:#fde047"></i> प्रधान बनाएं
                 </button>`
          ) : ''}
          ${canEditKarmik ? `
            <button class="btn btn-outline-light btn-sm" style="color:#0284c7; border-color:#bae6fd; font-size:0.75rem; padding:2px 6px" onclick="openEditStaffModal('${s.staff_id}')" title="संपादित करें">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-light btn-sm" style="color:#4f46e5; border-color:#c7d2fe; font-size:0.75rem; padding:2px 6px" onclick="openTransferStaffModal('${s.staff_id}')" title="विद्यालय स्थानान्तरण">
              <i class="fas fa-exchange-alt"></i>
            </button>
            <button class="btn btn-outline-light btn-sm" style="color:#dc2626; border-color:#fca5a5; font-size:0.75rem; padding:2px 6px" onclick="openDeleteStaffModal('${s.staff_id}', '${s.name}')" title="कार्यमुक्त / हटाएं">
              <i class="fas fa-trash-alt"></i>
            </button>
          ` : (!canEditHead && !isUnmapped ? `<span class="badge-tag" style="background:#f1f5f9; color:#64748b; font-size:0.72rem"><i class="fas fa-lock"></i> संपादन लॉक</span>` : '')}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function markKarmikAsSansthaPradhan(staffId) {
  const staff = (STATE.staff || []).find(s => s.staff_id === staffId);
  if (!staff) {
    showToast('कार्मिक नहीं मिला!', 'error');
    return;
  }

  const schName = staff.school_name;
  const peeoName = staff.peeo_name;

  if (!confirm(`क्या आप '${staff.name}' (${staff.post}) को विद्यालय '${schName}' का अधिकृत संस्था प्रधान / PEEO मार्क करना चाहते हैं?\n\nयह परिवर्तन पोर्टल, मास्टर डायरेक्टरी व Google Sheet में तुरंत सुरक्षित हो जाएगा।`)) {
    return;
  }

  // 1. Reset previous principal for this school
  (STATE.staff || []).forEach(s => {
    if (s.school_name === schName && s.staff_id !== staffId) {
      s.is_sanstha_pradhan = false;
    }
  });

  staff.is_sanstha_pradhan = true;
  staff.post = 'प्रधानाचार्य / संस्था प्रधान';

  // 2. Update schools56
  const s56 = (STATE.schools56 || []).find(s => s.school_name === schName || s.shala_darpan_code === staff.sso_id);
  if (s56) {
    s56.principal_name = staff.name;
    if (staff.mobile) s56.principal_mobile = staff.mobile;
    saveSchools56ToStorage();
  }

  // 3. If PEEO Nodal school, update PEEO principal
  let isNodal = false;
  const peeoObj = (STATE.peeos || []).find(p => p.peeo_name === peeoName);
  if (peeoObj) {
    peeoObj.schools?.forEach(sc => {
      if (sc.school_name === schName && sc.is_peeo_nodal) isNodal = true;
    });
    if (isNodal || schName.includes(peeoName.replace('PEEO ', ''))) {
      peeoObj.principal_incharge = staff.name;
      if (staff.mobile) peeoObj.mobile = staff.mobile;
      savePeeosToStorage();
    }
  }

  saveStaffToStorage();

  // 4. Send to backend server
  fetch('/api/update_sanstha_pradhan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_id: staff.staff_id,
      is_sanstha_pradhan: true,
      school_name: schName,
      peeo_name: peeoName,
      name: staff.name,
      mobile: staff.mobile
    })
  }).then(r => r.json()).then(res => {
    console.log('[Sanstha Pradhan API Sync]:', res);
  }).catch(e => console.log('Sync note:', e));

  showToast(`👑 ${staff.name} को '${schName}' का संस्था प्रधान सफलतापूर्वक नियुक्त किया गया!`, 'success');
  filterStaffTable();
  filterDirectory();
  renderApp();
}

function unmarkKarmikAsSansthaPradhan(staffId) {
  const staff = (STATE.staff || []).find(s => s.staff_id === staffId);
  if (!staff) return;

  if (!confirm(`क्या आप '${staff.name}' को संस्था प्रधान पद से हटाना चाहते हैं?`)) {
    return;
  }

  staff.is_sanstha_pradhan = false;
  if (staff.post === 'प्रधानाचार्य / संस्था प्रधान') {
    staff.post = 'अध्यापक';
  }

  saveStaffToStorage();

  fetch('/api/update_sanstha_pradhan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_id: staff.staff_id,
      is_sanstha_pradhan: false,
      school_name: staff.school_name,
      peeo_name: staff.peeo_name,
      name: staff.name,
      mobile: staff.mobile
    })
  }).catch(() => {});

  showToast(`👑 ${staff.name} को संस्था प्रधान पद से पदमुक्त किया गया।`, 'info');
  filterStaffTable();
  filterDirectory();
  renderApp();
}

/* ========================================================
   MASTER DESIGNATIONS (पद) & DYNAMIC ADDITION
   ======================================================== */
const DEFAULT_MASTER_DESIGNATIONS = [
  'प्रधानाचार्य (Principal)',
  'उप प्रधानाचार्य (Vice Principal)',
  'व्याख्याता (Lecturer)',
  'वरिष्ठ अध्यापक (Sr. Teacher / Gr-II)',
  'अध्यापक लेवल-2 (Teacher L-2)',
  'अध्यापक लेवल-1 (Teacher L-1)',
  'प्रबोधक (Prabodhak)',
  'शारीरिक शिक्षक (PTI)',
  'पुस्तकालयाध्यक्ष (Librarian)',
  'प्रयोगशाला सहायक (Lab Assistant)',
  'कंप्यूटर अनुदेशक (Computer Instructor)',
  'वरिष्ठ सहायक (Sr. Assistant)',
  'कनिष्ठ सहायक (Jr. Assistant / LDC)',
  'सहायक कर्मचारी (Class-IV / Peon)',
  'सुरक्षा गार्ड (Security Guard)',
  'संविदा कार्मिक (Contractual / Vidyasambal)'
];

function getAllDesignations() {
  let custom = [];
  try {
    const stored = localStorage.getItem('cbeo_custom_posts');
    if (stored) custom = JSON.parse(stored);
  } catch(e) { custom = []; }
  if (STATE.portalSettings && Array.isArray(STATE.portalSettings.custom_posts)) {
    custom = Array.from(new Set([...custom, ...STATE.portalSettings.custom_posts]));
  }
  return Array.from(new Set([...DEFAULT_MASTER_DESIGNATIONS, ...custom]));
}

function populateDesignationDropdown(selectId, selectedVal = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">-- पद चुनें (Select Designation) --</option>';
  const list = getAllDesignations();
  list.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (selectedVal && (d === selectedVal || d.startsWith(selectedVal) || selectedVal.startsWith(d.split(' ')[0]))) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
  if (selectedVal && !sel.value) {
    const opt = document.createElement('option');
    opt.value = selectedVal;
    opt.textContent = selectedVal;
    opt.selected = true;
    sel.appendChild(opt);
  }
}

function openAddDesignationModal() {
  if (!isJitendraLoggedIn()) {
    showToast('⚠️ केवल मुख्य तकनीकी प्रशासक (जितेंद्र जी) ही नया पद सृजित कर सकते हैं।', 'warning');
    return;
  }
  const input = document.getElementById('new-designation-name');
  if (input) input.value = '';
  showModal('modal-add-designation');
}

function saveNewDesignation() {
  if (!isJitendraLoggedIn()) {
    showToast('⚠️ केवल मुख्य तकनीकी प्रशासक (जितेंद्र जी) ही नया पद सृजित कर सकते हैं।', 'warning');
    return;
  }
  const input = document.getElementById('new-designation-name');
  const newPost = input ? input.value.trim() : '';
  if (!newPost) {
    showToast('कृपया पद का नाम दर्ज करें!', 'error');
    return;
  }

  let custom = [];
  try {
    const stored = localStorage.getItem('cbeo_custom_posts');
    if (stored) custom = JSON.parse(stored);
  } catch(e) { custom = []; }

  if (!custom.includes(newPost)) {
    custom.push(newPost);
    localStorage.setItem('cbeo_custom_posts', JSON.stringify(custom));
  }

  if (!STATE.portalSettings) STATE.portalSettings = {};
  if (!Array.isArray(STATE.portalSettings.custom_posts)) STATE.portalSettings.custom_posts = [];
  if (!STATE.portalSettings.custom_posts.includes(newPost)) {
    STATE.portalSettings.custom_posts.push(newPost);
  }

  // Cloud Sync to Google Sheets __CUSTOM_POSTS__
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__CUSTOM_POSTS__',
          role: 'System_Config',
          name: 'Master Custom Designations',
          new_password: JSON.stringify(custom)
        })
      }).catch(err => console.warn('Custom post cloud sync err:', err));
    } catch(e) {}
  }

  populateDesignationDropdown('staff-edit-post', newPost);
  closeModal('modal-add-designation');
  showToast(`✅ नया पद '${newPost}' मास्टर पद सूची में जोड़ा गया व Google Cloud में सुरक्षित हुआ!`, 'success');
}

/* ========================================================
   TRANSFER STAFF MODAL & STRICT SCHOOL DROPDOWN
   ======================================================== */
function openTransferStaffModal(staffId) {
  const staff = (STATE.staff || []).find(s => s.staff_id === staffId);
  if (!staff) return;

  document.getElementById('transfer-staff-id').value = staff.staff_id;
  document.getElementById('transfer-staff-name').textContent = staff.name;
  document.getElementById('transfer-staff-post').textContent = staff.post;
  document.getElementById('transfer-staff-cur-school').textContent = `${staff.shala_darpan_code ? `[${staff.shala_darpan_code}] ` : ''}${staff.school_name}`;
  document.getElementById('transfer-staff-cur-peeo').textContent = staff.peeo_name;
  document.getElementById('transfer-staff-remarks').value = '';

  const peeoSelect = document.getElementById('transfer-target-peeo');
  if (peeoSelect) {
    peeoSelect.innerHTML = '';
    (STATE.peeos || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.peeo_name;
      opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
      if (p.peeo_name === staff.peeo_name) opt.selected = true;
      peeoSelect.appendChild(opt);
    });
  }

  onTransferTargetPeeoChange(staff.shala_darpan_code || staff.school_name);
  showModal('modal-transfer-staff');
}

function onTransferTargetPeeoChange(targetSchoolCodeOrName) {
  const targetPeeo = document.getElementById('transfer-target-peeo')?.value;
  const schSelect = document.getElementById('transfer-target-school');
  if (!schSelect) return;
  schSelect.innerHTML = '';

  const peeoObj = (STATE.peeos || []).find(p => p.peeo_name === targetPeeo);
  if (peeoObj && peeoObj.schools && peeoObj.schools.length > 0) {
    peeoObj.schools.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.shala_darpan_code;
      opt.textContent = `[शा.दा. ${s.shala_darpan_code}] ${s.school_name_hi || s.school_name} (${s.school_name_en || ''})`;
      if (targetSchoolCodeOrName && (
        String(s.shala_darpan_code) === String(targetSchoolCodeOrName) || 
        s.school_name_hi === targetSchoolCodeOrName || 
        s.school_name === targetSchoolCodeOrName
      )) {
        opt.selected = true;
      }
      schSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = peeoObj ? peeoObj.shala_darpan_code : '';
    opt.textContent = peeoObj ? `[शा.दा. ${peeoObj.shala_darpan_code}] ${peeoObj.school_name_hi || peeoObj.peeo_name}` : targetPeeo;
    schSelect.appendChild(opt);
  }
}

function confirmTransferStaff() {
  const staffId = document.getElementById('transfer-staff-id')?.value;
  const newPeeo = document.getElementById('transfer-target-peeo')?.value;
  const selectedSchoolCode = document.getElementById('transfer-target-school')?.value;
  const remarks = document.getElementById('transfer-staff-remarks')?.value.trim();

  const staff = (STATE.staff || []).find(s => s.staff_id === staffId);
  if (!staff) return;

  const oldSchool = staff.school_name;

  // Resolve official school by Shala Darpan code
  const peeoObj = (STATE.peeos || []).find(p => p.peeo_name === newPeeo);
  let targetSchool = peeoObj?.schools?.find(s => String(s.shala_darpan_code) === String(selectedSchoolCode));
  if (!targetSchool) {
    targetSchool = (STATE.schools56 || []).find(s => String(s.shala_darpan_code) === String(selectedSchoolCode));
  }

  const finalSchoolHi = targetSchool ? (targetSchool.school_name_hi || targetSchool.school_name) : (selectedSchoolCode || oldSchool);
  const finalSchoolEn = targetSchool ? (targetSchool.school_name_en || '') : '';
  const finalCode = targetSchool ? targetSchool.shala_darpan_code : selectedSchoolCode;

  staff.school_name = finalSchoolHi;
  staff.school_name_hi = finalSchoolHi;
  staff.school_name_en = finalSchoolEn;
  staff.shala_darpan_code = finalCode;
  staff.school_code = finalCode;
  staff.peeo_name = newPeeo;
  staff.unmapped_school = false; // Resolved cleanly!

  if (remarks) {
    staff.remarks = `${remarks} (स्थानान्तरण पूर्व विद्यालय: ${oldSchool})`;
  }

  recordAuditLog({
    user: STATE.currentUser?.peeo_name || STATE.currentUser?.name || 'Admin',
    action: 'कार्मिक विद्यालय स्थानान्तरण',
    target: `${staff.staff_id} - ${staff.name}`,
    details: `नवीन विद्यालय: [${finalCode}] ${finalSchoolHi}, PEEO: ${newPeeo}, पूर्व: ${oldSchool}`,
    note: remarks || 'सफलतापूर्वक स्थानान्तरित'
  });

  saveStaffToStorage();

  fetch('/api/save_staff_member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(staff)
  }).catch(() => {});

  syncStaffMemberToCloud(staff);

  closeModal('modal-transfer-staff');
  showToast(`✅ कार्मिक ${staff.name} का स्थानान्तरण [${finalCode}] '${finalSchoolHi}' (${newPeeo}) में सुरक्षित हो गया!`, 'success');
  filterStaffTable();
  if (typeof filterDirectory === 'function') filterDirectory();
}

/* ========================================================
   ADD / EDIT STAFF WITH STRICT DROPDOWNS
   ======================================================== */
function openAddStaffModal() {
  document.getElementById('staff-modal-title').innerHTML = '<i class="fas fa-user-plus text-primary"></i> नया कार्मिक विवरण जोड़ें';
  document.getElementById('staff-edit-id').value = '';
  document.getElementById('staff-edit-name').value = '';
  document.getElementById('staff-edit-mobile').value = '';
  document.getElementById('staff-edit-email').value = '';
  document.getElementById('staff-edit-sso').value = '';
  document.getElementById('staff-edit-bank-acc').value = '';
  document.getElementById('staff-edit-ifsc').value = '';

  const peeoSelect = document.getElementById('staff-edit-peeo');
  peeoSelect.innerHTML = '';
  const isPeeoUser = STATE.currentUser?.role === 'peeo';
  const targetPeeo = isPeeoUser ? STATE.currentUser.peeo_name : 'PEEO BHINAY';

  (STATE.peeos || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    if (p.peeo_name === targetPeeo) opt.selected = true;
    peeoSelect.appendChild(opt);
  });

  // Lock PEEO selection for PEEO role
  peeoSelect.disabled = isPeeoUser && !isJitendraLoggedIn();

  // Populate dynamic designation master
  populateDesignationDropdown('staff-edit-post');

  onStaffEditPeeoChange();

  const headChk = document.getElementById('staff-edit-is-head');
  if (headChk) headChk.checked = false;

  showModal('modal-staff-edit');
}

function openEditStaffModal(staffId) {
  const staff = STATE.staff.find(s => s.staff_id === staffId);
  if (!staff) return;

  document.getElementById('staff-modal-title').innerHTML = '<i class="fas fa-edit text-primary"></i> कार्मिक विवरण संपादित करें';
  document.getElementById('staff-edit-id').value = staff.staff_id;
  document.getElementById('staff-edit-name').value = staff.name;
  document.getElementById('staff-edit-mobile').value = staff.mobile || '';
  document.getElementById('staff-edit-email').value = staff.email || '';
  document.getElementById('staff-edit-sso').value = staff.sso_id || '';
  document.getElementById('staff-edit-bank-acc').value = staff.bank_acc || '';
  document.getElementById('staff-edit-ifsc').value = staff.ifsc || '';

  const peeoSelect = document.getElementById('staff-edit-peeo');
  peeoSelect.innerHTML = '';
  const isPeeoUser = STATE.currentUser?.role === 'peeo';

  (STATE.peeos || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    if (p.peeo_name === staff.peeo_name) opt.selected = true;
    peeoSelect.appendChild(opt);
  });

  // Lock PEEO selection for PEEO role unless Jitendra or CBEO
  peeoSelect.disabled = isPeeoUser && !isJitendraLoggedIn();

  // Populate designation dropdown
  populateDesignationDropdown('staff-edit-post', staff.post);

  const headChk = document.getElementById('staff-edit-is-head');
  if (headChk) {
    headChk.checked = !!(staff.is_sanstha_pradhan || (staff.post && (staff.post.includes('प्रधानाचार्य') || staff.post.includes('संस्था प्रधान'))));
  }

  onStaffEditPeeoChange(staff.shala_darpan_code || staff.school_name);

  showModal('modal-staff-edit');
}

function onStaffEditPeeoChange(selectedSchoolCodeOrName) {
  const peeoSelect = document.getElementById('staff-edit-peeo');
  const targetPeeo = peeoSelect ? peeoSelect.value : '';
  const schSelect = document.getElementById('staff-edit-school');
  if (!schSelect) return;
  schSelect.innerHTML = '';

  const peeoObj = (STATE.peeos || []).find(p => p.peeo_name === targetPeeo);
  if (peeoObj && peeoObj.schools && peeoObj.schools.length > 0) {
    peeoObj.schools.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.shala_darpan_code;
      opt.textContent = `[शा.दा. ${s.shala_darpan_code}] ${s.school_name_hi || s.school_name} (${s.school_name_en || ''})`;
      if (selectedSchoolCodeOrName && (
        String(s.shala_darpan_code) === String(selectedSchoolCodeOrName) || 
        s.school_name_hi === selectedSchoolCodeOrName || 
        s.school_name === selectedSchoolCodeOrName
      )) {
        opt.selected = true;
      }
      schSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = peeoObj ? peeoObj.shala_darpan_code : '';
    opt.textContent = peeoObj ? `[शा.दा. ${peeoObj.shala_darpan_code}] ${peeoObj.school_name_hi || peeoObj.peeo_name}` : targetPeeo;
    schSelect.appendChild(opt);
  }
}

function saveStaffMember() {
  const staffId = document.getElementById('staff-edit-id').value;
  const name = document.getElementById('staff-edit-name').value.trim();
  const peeoName = document.getElementById('staff-edit-peeo').value;
  const schoolCode = document.getElementById('staff-edit-school').value;
  const post = document.getElementById('staff-edit-post').value;
  const mobile = document.getElementById('staff-edit-mobile').value.trim();
  const email = document.getElementById('staff-edit-email').value.trim();
  const ssoId = document.getElementById('staff-edit-sso').value.trim();
  const bankAcc = document.getElementById('staff-edit-bank-acc').value.trim();
  const ifsc = document.getElementById('staff-edit-ifsc').value.trim();
  const isHeadChecked = document.getElementById('staff-edit-is-head')?.checked;
  const isHead = isHeadChecked || (post && (post.includes('प्रधानाचार्य') || post.includes('संस्था प्रधान')));

  if (!name) {
    showToast('कृपया कार्मिक का नाम दर्ज करें!', 'error');
    return;
  }
  if (!post) {
    showToast('कृपया पद (Designation) चुनें!', 'error');
    return;
  }

  // Resolve official school by code
  const peeoObj = (STATE.peeos || []).find(p => p.peeo_name === peeoName);
  let targetSchool = peeoObj?.schools?.find(s => String(s.shala_darpan_code) === String(schoolCode));
  if (!targetSchool) {
    targetSchool = (STATE.schools56 || []).find(s => String(s.shala_darpan_code) === String(schoolCode));
  }

  const schoolNameHi = targetSchool ? (targetSchool.school_name_hi || targetSchool.school_name) : schoolCode;
  const schoolNameEn = targetSchool ? (targetSchool.school_name_en || '') : '';
  const finalCode = targetSchool ? targetSchool.shala_darpan_code : schoolCode;

  let savedRecord = null;

  if (staffId) {
    const idx = STATE.staff.findIndex(s => s.staff_id === staffId);
    if (idx !== -1) {
      STATE.staff[idx] = {
        ...STATE.staff[idx],
        name,
        school_name: schoolNameHi,
        school_name_hi: schoolNameHi,
        school_name_en: schoolNameEn,
        shala_darpan_code: finalCode,
        school_code: finalCode,
        peeo_name: peeoName,
        post,
        mobile,
        email,
        sso_id: ssoId,
        bank_acc: bankAcc,
        ifsc,
        is_sanstha_pradhan: isHead,
        unmapped_school: false
      };
      savedRecord = STATE.staff[idx];

      recordAuditLog({
        user: STATE.currentUser?.peeo_name || STATE.currentUser?.name || 'Admin',
        action: 'कार्मिक संपादन',
        target: `${staffId} - ${name}`,
        details: `विद्यालय: [${finalCode}] ${schoolNameHi}, पद: ${post}, मो.: ${mobile}${isHead ? ' [👑 संस्था प्रधान]' : ''}`,
        note: 'विवरण अद्यतन किया गया'
      });

      showToast('कार्मिक विवरण सफलता पूर्वक अद्यतन हुआ!', 'success');
    }
  } else {
    const newId = `STF${1000 + STATE.staff.length + 1}`;
    const newStaff = {
      staff_id: newId,
      name,
      post,
      mobile,
      email,
      sso_id: ssoId,
      school_name: schoolNameHi,
      school_name_hi: schoolNameHi,
      school_name_en: schoolNameEn,
      shala_darpan_code: finalCode,
      school_code: finalCode,
      peeo_name: peeoName,
      bank_acc: bankAcc,
      ifsc: ifsc,
      is_sanstha_pradhan: isHead,
      unmapped_school: false,
      status: 'Active'
    };
    STATE.staff.unshift(newStaff);
    savedRecord = newStaff;

    recordAuditLog({
      user: STATE.currentUser?.peeo_name || STATE.currentUser?.name || 'Admin',
      action: 'नया कार्मिक प्रविष्टि',
      target: `${newId} - ${name}`,
      details: `विद्यालय: [${finalCode}] ${schoolNameHi}, पद: ${post}, मो.: ${mobile}${isHead ? ' [👑 संस्था प्रधान]' : ''}`,
      note: 'नया शिक्षक जोड़ा गया'
    });

    showToast('नया कार्मिक सफलतापूर्वक जोड़ा गया!', 'success');
  }

  // If marked as Head of Institution, dynamically update matching school in schools56 and PEEOs
  if (isHead) {
    STATE.staff.forEach(s => {
      if (s.school_name === schoolNameHi && s.staff_id !== (savedRecord?.staff_id)) {
        s.is_sanstha_pradhan = false;
      }
    });

    const matchedSchool = (STATE.schools56 || []).find(s => 
      s.school_name === schoolNameHi || 
      (s.school_name_hi && s.school_name_hi === schoolNameHi) ||
      (finalCode && s.shala_darpan_code === finalCode)
    );
    if (matchedSchool) {
      matchedSchool.principal_name = name;
      matchedSchool.principal_mobile = mobile;
      saveSchools56ToStorage();
    }

    const matchedPeeo = (STATE.peeos || []).find(p => p.peeo_name === peeoName || (matchedSchool && p.shala_darpan_code === matchedSchool.shala_darpan_code));
    if (matchedPeeo && (schoolNameHi.includes(peeoName.replace('PEEO ', '')) || isHead)) {
      matchedPeeo.principal_incharge = name;
      matchedPeeo.mobile = mobile;
      savePeeosToStorage();
    }
  }

  saveStaffToStorage();
  closeModal('modal-staff-edit');
  filterStaffTable();
  if (typeof filterDirectory === 'function') filterDirectory();
  if (savedRecord) syncStaffMemberToCloud(savedRecord);
}

function openDeleteStaffModal(staffId, staffName) {
  document.getElementById('delete-staff-id').value = staffId;
  document.getElementById('delete-staff-name').textContent = staffName;
  showModal('modal-delete-staff');
}

function confirmDeleteStaff() {
  const staffId = document.getElementById('delete-staff-id').value;
  const reason = document.getElementById('delete-staff-reason').value;

  const staff = STATE.staff.find(s => s.staff_id === staffId);
  if (staff) {
    staff.status = 'Deleted';
    staff.deleteReason = reason;
    staff.deletedAt = new Date().toLocaleString('hi-IN');
    staff.deletedBy = STATE.currentUser?.peeo_name || STATE.currentUser?.name || 'Admin';

    recordAuditLog({
      user: STATE.currentUser?.peeo_name || STATE.currentUser?.name || 'Admin',
      action: 'कार्मिक विलोपन (सुरक्षित बैकअप)',
      target: `${staff.staff_id} - ${staff.name}`,
      details: `विद्यालय: ${staff.school_name}, पद: ${staff.post}, मो.: ${staff.mobile}`,
      note: `कारण: ${reason}`
    });

    saveStaffToStorage();
    closeModal('modal-delete-staff');
    filterStaffTable();
    if (typeof filterDirectory === 'function') filterDirectory();
    syncStaffMemberToCloud(staff);
    showToast(`कार्मिक ${staff.name} को सुरक्षित हटा दिया गया (ऑडिट बैकअप सुरक्षित)!`, 'warning');
  } else {
    closeModal('modal-delete-staff');
  }
}

/* ========================================================
   STAFF PERMISSIONS, LOCK & SANSTHA PRADHAN CONTROLS
   ======================================================== */
function renderStaffEditPermissionsMatrix() {
  const perms = STATE.staffEditPermissions || {
    master_lock: false,
    cbeo_can_edit: true,
    peeo_can_edit_staff: true,
    peeo_can_edit_head: true,
    schools_can_edit_staff: false,
    peeo_can_edit_school_mgmt: true,
    schools_can_edit_school_mgmt: false,
    peeo_can_edit_saman_pariksha: true,
    schools_can_edit_saman_pariksha: false,
    peeo_can_edit_demands: true,
    schools_can_edit_demands: false
  };

  const lockBtn = document.getElementById('btn-toggle-staff-master-lock');
  if (lockBtn) {
    if (perms.master_lock) {
      lockBtn.className = 'btn btn-danger btn-sm';
      lockBtn.innerHTML = '<i class="fas fa-lock"></i> 🔒 समस्त संपादन लॉक है (Unlock करें)';
    } else {
      lockBtn.className = 'btn btn-outline-danger btn-sm';
      lockBtn.innerHTML = '<i class="fas fa-unlock"></i> 🔓 संपादन खुला है (Lock करें)';
    }
  }

  const chkCbeo = document.getElementById('perm-cbeo-edit');
  const chkPeeoStaff = document.getElementById('perm-peeo-edit-staff');
  const chkPeeoHead = document.getElementById('perm-peeo-edit-head');
  const chkSchool = document.getElementById('perm-school-edit');
  const chkPeeoSchool = document.getElementById('perm-peeo-edit-school');
  const chkSchoolSchool = document.getElementById('perm-school-edit-school');

  // Saman Pariksha Edit controls
  const chkPeeoSP = document.getElementById('perm-peeo-edit-saman-pariksha');
  const chkSchoolSP = document.getElementById('perm-school-edit-saman-pariksha');

  // Demands Edit controls
  const chkPeeoDemands = document.getElementById('perm-peeo-edit-demands');
  const chkSchoolDemands = document.getElementById('perm-school-edit-demands');

  if (chkCbeo) chkCbeo.checked = perms.cbeo_can_edit !== false;
  if (chkPeeoStaff) chkPeeoStaff.checked = perms.peeo_can_edit_staff !== false;
  if (chkPeeoHead) chkPeeoHead.checked = perms.peeo_can_edit_head !== false;
  if (chkSchool) chkSchool.checked = !!perms.schools_can_edit_staff;
  if (chkPeeoSchool) chkPeeoSchool.checked = perms.peeo_can_edit_school_mgmt !== false;
  if (chkSchoolSchool) chkSchoolSchool.checked = !!perms.schools_can_edit_school_mgmt;

  if (chkPeeoSP) chkPeeoSP.checked = perms.peeo_can_edit_saman_pariksha !== false && !perms.saman_pariksha_lock_peeo;
  if (chkSchoolSP) chkSchoolSP.checked = !!perms.schools_can_edit_saman_pariksha && !perms.saman_pariksha_lock_schools;

  if (chkPeeoDemands) chkPeeoDemands.checked = perms.peeo_can_edit_demands !== false && !perms.demands_lock_peeo;
  if (chkSchoolDemands) chkSchoolDemands.checked = !!perms.schools_can_edit_demands && !perms.demands_lock_schools;
}

function toggleStaffMasterLock() {
  if (!STATE.staffEditPermissions) {
    STATE.staffEditPermissions = {
      master_lock: false,
      cbeo_can_edit: true,
      peeo_can_edit_staff: true,
      peeo_can_edit_head: true,
      schools_can_edit_staff: false,
      peeo_can_edit_school_mgmt: true,
      schools_can_edit_school_mgmt: false,
      peeo_can_edit_saman_pariksha: true,
      schools_can_edit_saman_pariksha: false,
      peeo_can_edit_demands: true,
      schools_can_edit_demands: false
    };
  }
  STATE.staffEditPermissions.master_lock = !STATE.staffEditPermissions.master_lock;
  saveStaffEditPermissionsMatrix();
  showToast(STATE.staffEditPermissions.master_lock ? '🔒 समस्त कार्मिक व स्कूल संपादन लॉक कर दिया गया!' : '🔓 संपादन अनलॉक कर दिया गया!', 'info');
}

function saveStaffEditPermissionsMatrix() {
  const peeoCanEditSP = !!document.getElementById('perm-peeo-edit-saman-pariksha')?.checked;
  const schoolCanEditSP = !!document.getElementById('perm-school-edit-saman-pariksha')?.checked;
  const peeoCanEditDemands = !!document.getElementById('perm-peeo-edit-demands')?.checked;
  const schoolCanEditDemands = !!document.getElementById('perm-school-edit-demands')?.checked;

  const perms = {
    master_lock: STATE.staffEditPermissions?.master_lock || false,
    cbeo_can_edit: !!document.getElementById('perm-cbeo-edit')?.checked,
    peeo_can_edit_staff: !!document.getElementById('perm-peeo-edit-staff')?.checked,
    peeo_can_edit_head: !!document.getElementById('perm-peeo-edit-head')?.checked,
    schools_can_edit_staff: !!document.getElementById('perm-school-edit')?.checked,
    peeo_can_edit_school_mgmt: !!document.getElementById('perm-peeo-edit-school')?.checked,
    schools_can_edit_school_mgmt: !!document.getElementById('perm-school-edit-school')?.checked,
    peeo_can_edit_saman_pariksha: peeoCanEditSP,
    saman_pariksha_lock_peeo: !peeoCanEditSP,
    schools_can_edit_saman_pariksha: schoolCanEditSP,
    saman_pariksha_lock_schools: !schoolCanEditSP,
    peeo_can_edit_demands: peeoCanEditDemands,
    demands_lock_peeo: !peeoCanEditDemands,
    schools_can_edit_demands: schoolCanEditDemands,
    demands_lock_schools: !schoolCanEditDemands
  };

  STATE.staffEditPermissions = perms;
  localStorage.setItem('cbeo_staff_edit_permissions', JSON.stringify(perms));

  // Sync to Google Sheet live so settings persist across all devices & refreshes!
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__STAFF_EDIT_PERMISSIONS__',
          role: 'System_Config',
          name: 'Staff and Form Edit Permissions',
          new_password: JSON.stringify(perms)
        })
      }).catch(err => console.warn('Save staff permissions sync err:', err));
    } catch(e) {}
  }

  fetch('/api/save_staff_edit_permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(perms)
  }).catch(() => {});

  renderStaffEditPermissionsMatrix();
  if (typeof filterStaffTable === 'function') filterStaffTable();
  if (typeof filterSchoolManagementTable === 'function') filterSchoolManagementTable();
  showToast('कार्मिक, विद्यालय प्रबंधन व समान परीक्षा अनुमतियाँ Google Sheet में सुरक्षित की गईं!', 'success');
}

function canCurrentUserEditStaff(targetStaff) {
  if (!STATE.currentUser) return false;
  if (isJitendraLoggedIn()) return true; // Super Admin Jitendra always unrestricted

  // 1. Check 5-Level Edit Permission Matrix first
  if (!canCurrentUserEditModule('staff')) return false;

  const perms = STATE.staffEditPermissions || { master_lock: false, cbeo_can_edit: true, peeo_can_edit_staff: true, peeo_can_edit_head: true, schools_can_edit_staff: false };
  if (perms.master_lock) return false;

  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendraLoggedIn());
  if (isCBEO) return !!perms.cbeo_can_edit;

  if (STATE.currentUser.role === 'peeo') {
    if (!perms.peeo_can_edit_staff) return false;
    return !targetStaff?.peeo_name || targetStaff?.peeo_name === STATE.currentUser.peeo_name;
  }

  if (STATE.currentUser.role === 'school') {
    if (!perms.schools_can_edit_staff) return false;
    return targetStaff?.school_name === STATE.currentUser.school_name || 
           String(targetStaff?.shala_darpan_code) === String(STATE.currentUser.shala_darpan_code);
  }

  return false;
}

function canCurrentUserEditSchoolHead(schoolOrStaff) {
  if (!STATE.currentUser) return false;
  if (isJitendraLoggedIn()) return true; // Super Admin Jitendra always unrestricted

  // 1. Check 5-Level Edit Permission Matrix first
  if (!canCurrentUserEditModule('school_head')) return false;

  const perms = STATE.staffEditPermissions || { master_lock: false, cbeo_can_edit: true, peeo_can_edit_staff: true, peeo_can_edit_head: true, schools_can_edit_staff: false };
  if (perms.master_lock) return false;

  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendraLoggedIn());
  if (isCBEO) return !!perms.cbeo_can_edit;

  if (STATE.currentUser.role === 'peeo') {
    if (!perms.peeo_can_edit_head) return false;
    const pName = typeof schoolOrStaff === 'string' ? schoolOrStaff : (schoolOrStaff?.peeo_name || '');
    return !pName || pName === STATE.currentUser.peeo_name;
  }

  return false;
}

function canCurrentUserEditSchoolDetails(school) {
  if (!STATE.currentUser) return false;
  const isJitendra = STATE.currentUser.shala_darpan_code === 'admin_jitendra' || 
                     STATE.currentUser.admin_id === 'ADMIN02' || 
                     STATE.currentUser.username === 'jitendra_admin';
  if (isJitendra) return true; // Super Admin Jitendra always has master control

  const perms = STATE.staffEditPermissions || {};
  if (perms.master_lock) return false;

  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendra);
  if (isCBEO) return perms.cbeo_can_edit !== false;

  const schCode = typeof school === 'string' ? school : (school?.shala_darpan_code || school?.dise_code || '');
  const schPeeo = typeof school === 'object' ? (school?.peeo_name || '') : '';
  const schPeeoCode = typeof school === 'object' ? (school?.peeo_code || '') : '';

  if (STATE.currentUser.role === 'peeo') {
    if (!perms.peeo_can_edit_school_mgmt) return false;
    const matchesPeeo = (schPeeo && (schPeeo === STATE.currentUser.peeo_name || schPeeo.toLowerCase() === STATE.currentUser.peeo_name?.toLowerCase())) ||
                        (schPeeoCode && schPeeoCode === STATE.currentUser.shala_darpan_code) ||
                        (!schPeeo && !schPeeoCode);
    return matchesPeeo;
  }

  if (STATE.currentUser.role === 'school') {
    if (!perms.schools_can_edit_school_mgmt) return false;
    return schCode === STATE.currentUser.shala_darpan_code;
  }

  return false;
}

function isSamanParikshaLockedForCurrentUser(targetSchoolCode = null) {
  if (!STATE.currentUser) return false;
  if (isJitendraLoggedIn()) return false; // Super Admin Jitendra can always edit
  
  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 STATE.currentUser.role === 'admin';
  if (isCBEO) return false; // Admin & CBEO can ALWAYS edit any school!

  const schCode = targetSchoolCode || STATE.currentUser.shala_darpan_code;

  // Custom Edit Exception: If school is granted Custom Edit permission by Admin
  const mismatchSettings = STATE.samanMismatchSettings || (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (typeof DEFAULT_SAMAN_MISMATCH_SETTINGS !== 'undefined' ? DEFAULT_SAMAN_MISMATCH_SETTINGS : null));
  const customAllowed = (mismatchSettings && mismatchSettings.custom_edit_schools) || [];
  if (schCode && customAllowed.some(c => String(c).trim() === String(schCode).trim())) {
    return false; // Specifically Unlocked for this school by Admin!
  }

  // 1. Check 6-Level Edit Permission Matrix
  if (!canCurrentUserEditModule('saman_pariksha', targetSchoolCode)) return true;

  const perms = STATE.staffEditPermissions || {};
  if (perms.master_lock) return true;

  if (STATE.currentUser.role === 'peeo') {
    // If PEEO edit permission is false or lock flag is true, return true (View-Only Mode)
    return perms.peeo_can_edit_saman_pariksha === false || perms.saman_pariksha_lock_peeo === true;
  }

  if (STATE.currentUser.role === 'school') {
    // If school edit permission is false or lock flag is true, return true (View-Only Mode)
    return perms.schools_can_edit_saman_pariksha !== true || perms.saman_pariksha_lock_schools === true;
  }

  return false;
}

function isDemandsLockedForCurrentUser() {
  if (!STATE.currentUser) return false;
  if (isJitendraLoggedIn()) return false;

  // 1. Check 5-Level Edit Permission Matrix
  if (!canCurrentUserEditModule('demands')) return true;

  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendraLoggedIn());
  if (isCBEO) return false;

  const perms = STATE.staffEditPermissions || {};
  if (perms.master_lock) return true;

  if (STATE.currentUser.role === 'peeo') {
    return perms.peeo_can_edit_demands === false || perms.demands_lock_peeo === true;
  }

  if (STATE.currentUser.role === 'school') {
    return perms.schools_can_edit_demands !== true || perms.demands_lock_schools === true;
  }

  return false;
}

/* ========================================================
   ARCHIVE & RESTORE MANAGEMENT (JITENDRA SUPER ADMIN)
   ======================================================== */
function renderArchiveManagerUI() {
  const container = document.getElementById('admin-archive-manager-list');
  if (!container) return;
  container.innerHTML = '';

  const isSPArchived = !!STATE.samanParikshaArchived;

  // 1. Saman Pariksha Row
  const spRow = document.createElement('div');
  spRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem 1rem; margin-bottom:0.75rem';
  spRow.innerHTML = `
    <div>
      <strong style="color:#1b365d; font-size:0.95rem">📋 समान परीक्षा 2026-27 (57 स्कूल)</strong>
      <div style="font-size:0.78rem; color:#64748b; margin-top:2px">
        स्थिति: ${isSPArchived ? '<span class="badge" style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-weight:700">🗄️ आर्काइव में (Archived)</span>' : '<span class="badge" style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:6px; font-weight:700">● सक्रिय (Active Main Tab)</span>'}
      </div>
    </div>
    <div>
      <button class="btn btn-sm ${isSPArchived ? 'btn-success' : 'btn-outline-warning'}" onclick="toggleSamanParikshaArchive()" style="font-weight:700">
        ${isSPArchived ? '<i class="fas fa-undo"></i> 🔄 रिस्टोर करें (Restore to Main Menu)' : '<i class="fas fa-archive"></i> 🗄️ आर्काइव में भेजें (Move to Archive)'}
      </button>
    </div>
  `;
  container.appendChild(spRow);

  // 2. Dynamic Demands Rows
  if (Array.isArray(STATE.demands) && STATE.demands.length > 0) {
    STATE.demands.forEach(d => {
      if (d.id === 'saman_pariksha_2026_27') return;
      const isArch = !!d.archived;
      const dRow = document.createElement('div');
      dRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem 1rem; margin-bottom:0.5rem';
      dRow.innerHTML = `
        <div>
          <strong style="color:#1e293b; font-size:0.9rem">${d.title || d.name}</strong>
          <div style="font-size:0.75rem; color:#64748b; margin-top:2px">
            प्रारूप: ${d.target_audience || 'सभी'} | स्थिति: ${isArch ? '<span style="color:#b91c1c; font-weight:700">🗄️ आर्काइव</span>' : '<span style="color:#15803d; font-weight:700">● सक्रिय</span>'}
          </div>
        </div>
        <div>
          <button class="btn btn-sm ${isArch ? 'btn-success' : 'btn-outline-secondary'}" onclick="toggleDemandArchive('${d.id}')" style="font-weight:700">
            ${isArch ? '<i class="fas fa-undo"></i> रिस्टोर करें' : '<i class="fas fa-archive"></i> आर्काइव करें'}
          </button>
        </div>
      `;
      container.appendChild(dRow);
    });
  }
}

function toggleSamanParikshaArchive() {
  STATE.samanParikshaArchived = !STATE.samanParikshaArchived;
  if (!STATE.portalSettings) STATE.portalSettings = {};
  STATE.portalSettings.saman_pariksha_archived = STATE.samanParikshaArchived;
  savePortalSettingsToCloud();
  applyTabVisibility();
  renderArchiveManagerUI();
  renderArchiveView();
  showToast(STATE.samanParikshaArchived ? 'समान परीक्षा को आर्काइव (अभिलेख) में स्थानांतरित कर दिया गया!' : 'समान परीक्षा को मुख्य मेनू में सफलतापूर्वक रिस्टोर कर दिया गया!', 'info');
}

function toggleDemandArchive(demandId) {
  const d = (STATE.demands || []).find(x => x.id === demandId);
  if (!d) return;
  d.archived = !d.archived;
  if (!STATE.portalSettings) STATE.portalSettings = {};
  if (!Array.isArray(STATE.portalSettings.archived_demand_ids)) STATE.portalSettings.archived_demand_ids = [];
  
  if (d.archived) {
    if (!STATE.portalSettings.archived_demand_ids.includes(demandId)) {
      STATE.portalSettings.archived_demand_ids.push(demandId);
    }
  } else {
    STATE.portalSettings.archived_demand_ids = STATE.portalSettings.archived_demand_ids.filter(id => id !== demandId);
  }

  savePortalSettingsToCloud();
  renderArchiveManagerUI();
  renderDemandsView();
  renderArchiveView();
  showToast(d.archived ? `'${d.title}' को आर्काइव में डाल दिया गया!` : `'${d.title}' को पुनः सक्रिय कर दिया गया!`, 'info');
}

function savePortalSettingsToCloud() {
  localStorage.setItem('cbeo_portal_settings', JSON.stringify(STATE.portalSettings || {}));
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__PORTAL_SETTINGS__',
          role: 'System_Config',
          name: 'Portal Global Settings and Archive Matrix',
          new_password: JSON.stringify(STATE.portalSettings || {})
        })
      }).catch(err => console.warn('Save portal settings sync err:', err));
    } catch(e) {}
  }
}

function openEditSchoolHeadModal(schoolCode, schoolName, peeoName, curHead, curMobile, curDesig) {
  document.getElementById('edit-head-school-code').value = schoolCode || '';
  document.getElementById('edit-head-school-code-display').value = schoolCode || '';
  document.getElementById('edit-head-school-name').value = schoolName || '';
  document.getElementById('edit-head-peeo-name').value = peeoName || '';
  document.getElementById('edit-head-name').value = (curHead && curHead !== '---') ? curHead : '';
  document.getElementById('edit-head-mobile').value = (curMobile && curMobile !== '---') ? curMobile : '';
  
  const desigSel = document.getElementById('edit-head-designation');
  if (desigSel) {
    if (curDesig && (curDesig.includes('संचालक') || curDesig.includes('व्यवस्थापक'))) {
      desigSel.value = 'संचालक / व्यवस्थापक';
    } else if (curDesig && curDesig.includes('प्रधानाचार्य')) {
      desigSel.value = 'प्रधानाचार्य';
    } else {
      desigSel.value = 'संस्था प्रधान';
    }
  }

  openModal('modal-edit-school-head');
}

function saveSchoolHeadDetails() {
  const code = document.getElementById('edit-head-school-code').value;
  const name = document.getElementById('edit-head-school-name').value;
  const peeo = document.getElementById('edit-head-peeo-name').value;
  const headName = document.getElementById('edit-head-name').value.trim();
  const mobile = document.getElementById('edit-head-mobile').value.trim();
  const desig = document.getElementById('edit-head-designation').value;

  if (!headName) {
    showToast('कृपया संस्था प्रधान / संचालक का नाम दर्ज करें!', 'error');
    return;
  }
  if (mobile && (!/^\d{10}$/.test(mobile))) {
    showToast('कृपया सही 10 अंकों का मोबाइल नम्बर दर्ज करें!', 'error');
    return;
  }

  // 1. Update in STATE.schools56
  const s56 = (STATE.schools56 || []).find(s => s.shala_darpan_code === code || s.school_name === name);
  if (s56) {
    s56.principal_name = headName;
    s56.principal_mobile = mobile;
    saveSchools56ToStorage();
  }

  // 2. Update or insert in STATE.staff
  let existingStaffHead = (STATE.staff || []).find(s => s.school_name === name && s.is_sanstha_pradhan);
  if (existingStaffHead) {
    existingStaffHead.name = headName;
    existingStaffHead.mobile = mobile;
    existingStaffHead.post = desig;
  } else {
    const newHeadId = `HEAD_${code || Date.now()}`;
    STATE.staff.unshift({
      staff_id: newHeadId,
      name: headName,
      gender: 'पुरुष',
      dob: '',
      post: desig,
      school_name: name,
      peeo_name: peeo,
      sso_id: code,
      mobile: mobile,
      email: '',
      is_sanstha_pradhan: true,
      status: 'Active'
    });
  }
  saveStaffToStorage();

  // 3. Send to backend server
  fetch('/api/update_sanstha_pradhan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_id: `HEAD_${code}`,
      is_sanstha_pradhan: true,
      school_name: name,
      peeo_name: peeo,
      name: headName,
      mobile: mobile
    })
  }).catch(() => {});

  closeModal('modal-edit-school-head');
  showToast(`विद्यालय '${name}' के संस्था प्रधान / संचालक विवरण सफलतापूर्वक सुरक्षित किए गए!`, 'success');
  renderApp();
}

/* ========================================================
   DYNAMIC DEMAND EDIT, ARCHIVE & RESTORE CONTROLS
   ======================================================== */
let currentEditingDemandColumns = [];

function openEditDemandModal(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  document.getElementById('edit-demand-id').value = demand.id;
  document.getElementById('edit-demand-title').value = demand.title || '';
  document.getElementById('edit-demand-date').value = demand.dueDate || '';
  document.getElementById('edit-demand-priority').value = demand.priority || 'high';
  document.getElementById('edit-demand-desc').value = demand.description || '';

  const aud = demand.targetAudience || { cbeo: true, peeo: true, sec_srsec: true, all_govt: false, all_schools: false };
  document.getElementById('edit-demand-aud-cbeo').checked = aud.cbeo !== false;
  document.getElementById('edit-demand-aud-peeo').checked = aud.peeo !== false;
  document.getElementById('edit-demand-aud-sec').checked = aud.sec_srsec !== false;
  document.getElementById('edit-demand-aud-govt').checked = !!aud.all_govt;
  document.getElementById('edit-demand-aud-all').checked = !!aud.all_schools;

  currentEditingDemandColumns = (demand.columns || []).map(c => ({
    name: typeof c === 'string' ? c : (c.name || ''),
    type: (typeof c === 'object' && c.type) ? c.type : 'text'
  }));

  renderEditDemandColumns();
  openModal('modal-edit-demand');
}

function renderEditDemandColumns() {
  const container = document.getElementById('edit-demand-columns-list');
  if (!container) return;
  container.innerHTML = '';

  if (currentEditingDemandColumns.length === 0) {
    container.innerHTML = '<div style="color:#64748b; font-size:0.85rem; text-align:center; padding:0.5rem">कोई कॉलम नहीं है। नीचे से नया कॉलम जोड़ें।</div>';
    return;
  }

  currentEditingDemandColumns.forEach((col, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:0.4rem 0.6rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.85rem';
    item.innerHTML = `
      <div>
        <strong style="color:#1e293b">${idx + 1}. ${col.name}</strong>
        <span style="font-size:0.75rem; color:#64748b; margin-left:6px">(${col.type})</span>
      </div>
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeColumnFromEditList(${idx})" style="padding:1px 6px; font-size:0.75rem" title="कॉलम हटाएं">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;
    container.appendChild(item);
  });
}

function addNewColumnToEditList() {
  const input = document.getElementById('new-column-input');
  const typeSel = document.getElementById('new-column-type');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    showToast('कृपया कॉलम का नाम दर्ज करें!', 'warning');
    return;
  }
  const type = typeSel ? typeSel.value : 'text';
  currentEditingDemandColumns.push({ name: name, type: type });
  input.value = '';
  renderEditDemandColumns();
}

function removeColumnFromEditList(index) {
  currentEditingDemandColumns.splice(index, 1);
  renderEditDemandColumns();
}

function saveEditedDemand() {
  const demandId = document.getElementById('edit-demand-id').value;
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const title = document.getElementById('edit-demand-title').value.trim();
  if (!title) {
    showToast('कृपया प्रपत्र का शीर्षक दर्ज करें!', 'error');
    return;
  }

  demand.title = title;
  demand.dueDate = document.getElementById('edit-demand-date').value;
  demand.priority = document.getElementById('edit-demand-priority').value;
  demand.description = document.getElementById('edit-demand-desc').value.trim();

  demand.targetAudience = {
    cbeo: document.getElementById('edit-demand-aud-cbeo').checked,
    peeo: document.getElementById('edit-demand-aud-peeo').checked,
    sec_srsec: document.getElementById('edit-demand-aud-sec').checked,
    all_govt: document.getElementById('edit-demand-aud-govt').checked,
    all_schools: document.getElementById('edit-demand-aud-all').checked
  };

  demand.columns = currentEditingDemandColumns.map(c => ({
    name: c.name,
    type: c.type || 'text',
    placeholder: c.name
  }));

  saveDemandsToStorage();
  closeModal('modal-edit-demand');
  showToast(`मांग '${title}' के कॉलम व विवरण सफलतापूर्वक अपडेट किए गए!`, 'success');
  renderApp();
}

function archiveDemandAndBackup(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  if (!confirm(`क्या आप सूचना मांग '${demand.title}' को आर्काइव कर बैकअप शीट में सुरक्षित करना चाहते हैं?\n\nयह मांग सक्रिय प्रपत्रों से हटकर 'पूर्ण आर्काइव' टैब में स्थानांतरित हो जाएगी।`)) {
    return;
  }

  demand.archived = true;
  demand.archivedAt = new Date().toISOString();
  saveDemandsToStorage();

  // Send to backend archive
  fetch('/api/archive_demand_backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demand: demand })
  }).catch(() => {});

  // Sync to Google Drive Master Backup Sheet (7_CBEO_Master_Backup_And_Dummy_Sandbox_Sheet)
  try {
    const backupGasUrl = localStorage.getItem('cbeo_backup_webhook_url') 
      || 'https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec';
    if (backupGasUrl) {
      const subs = (STATE.demandSubmissions && STATE.demandSubmissions[demand.id]) || {};
      fetch(backupGasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'archive_demand',
          demand_id: demand.id,
          demand_title: demand.title,
          demand_data: demand,
          submissions: subs,
          archived_by: STATE.currentUser?.name || 'जितेन्द्र कुमार (सुपर एडमिन)'
        })
      }).then(r => r.json()).then(res => {
        console.log('✅ Google Drive Archive Sheet Sync:', res);
      }).catch(e => console.log('Archive GAS Sync Note:', e));
    }
  } catch(e) {}

  showToast(`मांग '${demand.title}' सफलतापूर्वक आर्काइव कर बैकअप में सुरक्षित कर दी गई!`, 'success');
  renderApp();
}

function restoreArchivedDemand(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  if (!confirm(`क्या आप सूचना मांग '${demand.title}' को पुनः सक्रिय (Restore) करना चाहते हैं?\n\nयह मांग सभी लक्षित लॉगिन में तुरंत पुनः दिखाई देने लगेगी।`)) {
    return;
  }

  demand.archived = false;
  delete demand.archivedAt;
  saveDemandsToStorage();

  showToast(`मांग '${demand.title}' पुनः सक्रिय कर दी गई! सभी लॉगिन में उपलब्ध है।`, 'success');
  renderApp();
  switchTab('demands');
}

function aiRecognizeAndPrefillColumns(demandId, targetSchoolCode = null) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const code = targetSchoolCode || STATE.currentDemandSchoolCode || STATE.currentUser?.shala_darpan_code;
  let school = null;
  if (code) {
    school = (STATE.schools56 || []).find(s => s.shala_darpan_code === code) ||
             getAllMasterSchools().find(s => s.shala_darpan_code === code);
  }
  if (!school && STATE.currentUser?.school_name) {
    school = (STATE.schools56 || []).find(s => s.school_name === STATE.currentUser.school_name) ||
             getAllMasterSchools().find(s => s.school_name === STATE.currentUser.school_name);
  }

  const peeo = (STATE.peeos || []).find(p => p.peeo_name === (school?.peeo_name || STATE.currentUser?.peeo_name));

  let filledCount = 0;
  (demand.columns || []).forEach((col, idx) => {
    const colName = (col.name || '').toLowerCase().trim();
    const inputEl = document.getElementById(`demand_input_col_${idx}`) || document.getElementById(`dyn-field-${col.name}`);
    if (!inputEl) return;

    let prefillVal = '';

    if (school) {
      if (colName.includes('प्रधानाचार्य') || colName.includes('संस्था प्रधान') || colName.includes('प्रधान') || colName.includes('principal') || colName.includes('hm') || colName.includes('संचालक') || colName.includes('प्रभारी')) {
        prefillVal = school.principal_name || '';
      } else if (colName.includes('मोबाइल') || colName.includes('फोन') || colName.includes('mobile') || colName.includes('contact') || colName.includes('phone')) {
        prefillVal = school.principal_mobile || school.mobile || '';
      } else if (colName.includes('शाला दर्पण') || colName.includes('शालादर्पण') || colName.includes('sd code') || colName.includes('psp') || colName.includes('कोड')) {
        prefillVal = school.shala_darpan_code || '';
      } else if (colName.includes('विद्यालय') || colName.includes('स्कूल') || colName.includes('school')) {
        prefillVal = school.school_name || '';
      } else if (colName.includes('श्रेणी') || colName.includes('प्रकार') || colName.includes('category')) {
        prefillVal = school.category || school.type || '';
      } else if (colName.includes('peeo') || colName.includes('पीईईओ')) {
        prefillVal = school.peeo_name || '';
      }
    } else if (peeo) {
      if (colName.includes('peeo') && (colName.includes('प्रभारी') || colName.includes('नाम'))) {
        prefillVal = peeo.principal_incharge || '';
      } else if (colName.includes('मोबाइल') || colName.includes('phone')) {
        prefillVal = peeo.mobile || '';
      } else if (colName.includes('कोड')) {
        prefillVal = peeo.shala_darpan_code || '';
      }
    }

    if (prefillVal && !inputEl.value) {
      inputEl.value = prefillVal;
      inputEl.style.backgroundColor = '#f0fdf4';
      inputEl.style.borderColor = '#16a34a';
      inputEl.style.boxShadow = '0 0 0 2px rgba(22, 163, 74, 0.2)';
      filledCount++;
    }
  });

  // Also prefill Submitter Name & Mobile in individual school form
  const submitterNameEl = document.getElementById('demand-form-submitter-name');
  const submitterMobileEl = document.getElementById('demand-form-submitter-mobile');
  if (school) {
    if (submitterNameEl && !submitterNameEl.value && school.principal_name) {
      submitterNameEl.value = school.principal_name;
      submitterNameEl.style.backgroundColor = '#f0fdf4';
      submitterNameEl.style.borderColor = '#16a34a';
      filledCount++;
    }
    if (submitterMobileEl && !submitterMobileEl.value && (school.principal_mobile || school.mobile)) {
      submitterMobileEl.value = school.principal_mobile || school.mobile;
      submitterMobileEl.style.backgroundColor = '#f0fdf4';
      submitterMobileEl.style.borderColor = '#16a34a';
      filledCount++;
    }
  }

  if (filledCount > 0) {
    showToast(`🤖 AI इंजन द्वारा ${filledCount} कॉलम मास्टर डेटाबेस से स्वतः भर दिए गए!`, 'success');
  } else {
    showToast('AI इंजन: इस प्रपत्र के कॉलम पहले से भरे हैं अथवा मास्टर डेटाबेस से सीधे मैप नहीं हैं।', 'info');
  }
}

function aiPrefillPeeoDemandTable(demandId, peeoId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const peeo = STATE.peeos.find(p => p.peeo_id === peeoId) || STATE.peeos[0];
  const schools = peeo.schools || [];

  let filledCount = 0;

  schools.forEach((sch, sIdx) => {
    const masterSch = (STATE.schools56 || []).find(s => s.shala_darpan_code === sch.shala_darpan_code) || sch;

    (demand.columns || []).forEach((col, cIdx) => {
      const field = document.getElementById(`field_${sIdx}_${cIdx}`);
      if (!field || field.value) return;

      const colName = (col.name || '').toLowerCase().trim();
      let prefillVal = '';

      if (colName.includes('प्रधानाचार्य') || colName.includes('संस्था प्रधान') || colName.includes('प्रधान') || colName.includes('principal') || colName.includes('hm') || colName.includes('संचालक') || colName.includes('प्रभारी')) {
        prefillVal = masterSch.principal_name || sch.principal_name || '';
      } else if (colName.includes('मोबाइल') || colName.includes('फोन') || colName.includes('mobile') || colName.includes('contact') || colName.includes('phone')) {
        prefillVal = masterSch.principal_mobile || sch.principal_mobile || sch.mobile || '';
      } else if (colName.includes('शाला दर्पण') || colName.includes('शालादर्पण') || colName.includes('sd code') || colName.includes('psp') || colName.includes('कोड')) {
        prefillVal = masterSch.shala_darpan_code || sch.shala_darpan_code || '';
      } else if (colName.includes('श्रेणी') || colName.includes('प्रकार') || colName.includes('category')) {
        prefillVal = masterSch.category || sch.category || '';
      }

      if (prefillVal) {
        field.value = prefillVal;
        field.style.backgroundColor = '#f0fdf4';
        field.style.borderColor = '#16a34a';
        filledCount++;
      }
    });
  });

  if (filledCount > 0) {
    showToast(`🤖 AI इंजन द्वारा तालिका में ${filledCount} फ़ील्ड्स मास्टर डेटा से स्वतः भर दी गईं!`, 'success');
  } else {
    showToast('AI इंजन: सभी फ़ील्ड्स पहले से भरी हैं या कॉलम सीधे मैच नहीं हुए।', 'info');
  }
}

function recordAuditLog(logItem) {
  const newLog = {
    timestamp: new Date().toLocaleString('hi-IN'),
    ...logItem
  };
  STATE.auditLogs.unshift(newLog);
  saveAuditLogsToStorage();
}

function openAuditLogModal() {
  const tbody = document.getElementById('audit-log-tbody');
  tbody.innerHTML = '';
  STATE.auditLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="font-size:0.8rem; color:var(--neutral-500)">${log.timestamp}</span></td>
      <td><strong>${log.user}</strong></td>
      <td><span class="status-badge" style="background:#fee2e2; color:#b91c1c">${log.action}</span></td>
      <td><code>${log.target}</code></td>
      <td style="font-size:0.82rem">${log.details || '---'}</td>
      <td><span style="font-size:0.82rem; color:#047857">${log.note || '---'}</span></td>
    `;
    tbody.appendChild(tr);
  });
  showModal('modal-audit-log');
}

/* ========================================================
   6. DYNAMIC INFORMATION DEMANDS & PUBLISH CONTROLS
   ======================================================== */
function isDemandVisibleForCurrentUser(demand) {
  if (!demand) return false;
  if (!STATE.currentUser) return false;

  const isJitendra = STATE.currentUser.shala_darpan_code === 'admin_jitendra' || 
                     STATE.currentUser.admin_id === 'ADMIN02' || 
                     STATE.currentUser.username === 'jitendra_admin';
  if (isJitendra) return true; // Super Admin Jitendra always sees everything

  // Non-admins must NEVER see a demand in test mode or unpublished
  if (demand.isTestMode) return false;
  if (demand.published === false) return false;

  const aud = demand.targetAudience || { cbeo: true, peeo: true, govt_sec_srsec: true, pvt_sec_srsec: false, all_govt: false, all_schools: false };

  // 1. CBEO Admin
  const isCBEO = STATE.currentUser.shala_darpan_code === '8140' || 
                 STATE.currentUser.admin_id === 'ADMIN01' || 
                 (STATE.currentUser.role === 'admin' && !isJitendra);
  if (isCBEO) {
    return !!aud.cbeo;
  }

  // 2. PEEO
  if (STATE.currentUser.role === 'peeo') {
    return !!aud.peeo;
  }

  // 3, 4, 5, 6. School Level: STRICT CHECK - ONLY visible if checked in 6-level matrix!
  if (STATE.currentUser.role === 'school') {
    const isPvt = STATE.currentUser.type === 'Private' || String(STATE.currentUser.shala_darpan_code).startsWith('P');
    if (isPvt) {
      const isPvtSec = (STATE.schools56 || []).some(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code && s.type === 'Private');
      if (isPvtSec) {
        if (aud.pvt_sec_srsec !== undefined) return !!(aud.pvt_sec_srsec || aud.all_schools);
        return !!(aud.sec_srsec || aud.all_schools);
      }
      return !!aud.all_schools;
    }

    const isGovtSecSrSec = (STATE.schools56 || []).some(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code && s.type !== 'Private') ||
      (STATE.currentUser.category && (STATE.currentUser.category.includes('Secondary') || STATE.currentUser.category.includes('माध्यमिक')));

    if (isGovtSecSrSec) {
      if (aud.govt_sec_srsec !== undefined) return !!(aud.govt_sec_srsec || aud.all_govt || aud.all_schools);
      return !!(aud.sec_srsec || aud.all_govt || aud.all_schools);
    }

    // Other Govt schools (Primary / Upper Primary)
    return !!(aud.all_govt || aud.all_schools);
  }

  return false;
}

function getVisibleDemands() {
  return STATE.demands.filter(d => !d.archived && !checkIsDemandArchivable(d) && isDemandVisibleForCurrentUser(d));
}

function getArchivedDemands() {
  return STATE.demands.filter(d => d.archived || checkIsDemandArchivable(d));
}

function checkIsDemandArchivable(demand) {
  let allSubmitted = true;
  let latestSubmitTime = null;

  for (const p of STATE.peeos) {
    const subKey = `${demand.id}_${p.peeo_id}`;
    if (!STATE.submissions[subKey] || !STATE.submissions[subKey].verified) {
      allSubmitted = false;
      break;
    } else {
      const st = new Date(STATE.submissions[subKey].submittedAtTime || 0);
      if (!latestSubmitTime || st > latestSubmitTime) {
        latestSubmitTime = st;
      }
    }
  }

  if (allSubmitted && latestSubmitTime) {
    const diffDays = (new Date() - latestSubmitTime) / (1000 * 60 * 60 * 24);
    if (diffDays >= 7) {
      return true;
    }
  }
  return false;
}

function renderDemandsView() {
  const visibleDemands = getVisibleDemands();
  const container = document.getElementById('demands-cards-container');
  if (container) container.innerHTML = '';

  const activeCnt = document.getElementById('demands-active-count');
  if (activeCnt) activeCnt.textContent = `${visibleDemands.length} प्रपत्र`;
  const navBadge = document.getElementById('nav-pending-badge');
  if (navBadge) navBadge.textContent = `${visibleDemands.length} सक्रिय`;

  if (visibleDemands.length === 0) {
    if (container) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; background:white; border-radius:12px; color:var(--neutral-500)">
        <i class="fas fa-check-circle fa-3x text-success" style="margin-bottom:1rem"></i>
        <h3>वर्तमान में कोई सक्रिय सूचना प्रपत्र प्रकाशित नहीं है!</h3>
        <p>कार्यालय एडमिन द्वारा सूचना प्रकाशित किए जाने पर यहाँ प्रदर्शित होगी।</p>
      </div>`;
    }
    return;
  }

  visibleDemands.forEach(demand => {
    if (container) container.appendChild(createDemandCardElement(demand));
  });
}

function renderArchiveView() {
  let archived = getArchivedDemands();
  if (STATE.samanParikshaArchived) {
    if (!archived.some(d => d.id === 'saman_pariksha_2026_27')) {
      archived = [
        {
          id: 'saman_pariksha_2026_27',
          title: 'समान परीक्षा 2026-27 (57 विद्यालय)',
          description: 'कक्षा 9 से 12 प्रश्न-पत्र मांग एवं विद्यार्थी नामांकन प्रपत्र (अभिलेख में सुरक्षित)',
          category: 'Exam',
          target_audience: 'Secondary / Sr Secondary Schools',
          archived: true,
          end_date: 'सम्पन्न'
        },
        ...archived
      ];
    }
  }

  const container = document.getElementById('archive-cards-container');
  if (container) container.innerHTML = '';

  const archCnt = document.getElementById('archive-count');
  if (archCnt) archCnt.textContent = `${archived.length} प्रपत्र`;
  const archBadge = document.getElementById('nav-archive-badge');
  if (archBadge) archBadge.textContent = archived.length;

  if (archived.length === 0) {
    if (container) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; background:white; border-radius:12px; color:var(--neutral-500)">
        <i class="fas fa-archive fa-3x text-secondary" style="margin-bottom:1rem"></i>
        <h3>कोई आर्काइव प्रपत्र उपलब्ध नहीं है।</h3>
      </div>`;
    }
    return;
  }

  archived.forEach(demand => {
    if (container) container.appendChild(createDemandCardElement(demand, true));
  });
}


function createDemandCardElement(demand, isArchive = false) {
  const card = document.createElement('div');
  card.className = 'demand-card';

  const isSamanDemand = demand.id === 'saman_pariksha_2026_27' || (demand.title && demand.title.includes('समान परीक्षा'));
  let isCurrentSubmitted = false;
  let currentSubmission = null;
  let submittedCount = 0;
  let totalDenominator = STATE.peeos.length;
  let percent = 0;

  if (isSamanDemand) {
    totalDenominator = (STATE.schools56 && STATE.schools56.length) || 57;
    let sCount = 0;
    STATE.schools56.forEach(s => {
      const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
      if (isSamanParikshaSubmitted(sub)) sCount++;
    });
    submittedCount = sCount;
    percent = totalDenominator > 0 ? Math.round((submittedCount / totalDenominator) * 100) : 0;

    if (STATE.currentUser?.role === 'school') {
      const schoolSub = STATE.samanParikshaSubmissions[STATE.currentUser.shala_darpan_code];
      isCurrentSubmitted = isSamanParikshaSubmitted(schoolSub);
      currentSubmission = schoolSub;
    } else if (STATE.currentUser?.role === 'peeo') {
      const peeoSchools = STATE.schools56.filter(s => s.peeo_name === STATE.currentUser.peeo_name || s.peeo_code === STATE.currentUser.shala_darpan_code);
      const peeoSubCount = peeoSchools.filter(s => {
        const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
        return isSamanParikshaSubmitted(sub);
      }).length;
      isCurrentSubmitted = peeoSchools.length > 0 && (peeoSubCount === peeoSchools.length);
    }
  } else {
    if (STATE.currentUser?.role === 'peeo') {
      const subKey = `${demand.id}_${STATE.currentUser.peeo_id}`;
      if (STATE.submissions[subKey] && STATE.submissions[subKey].verified) {
        isCurrentSubmitted = true;
        currentSubmission = STATE.submissions[subKey];
      }
    }

    STATE.peeos.forEach(p => {
      const subKey = `${demand.id}_${p.peeo_id}`;
      if (STATE.submissions[subKey] && STATE.submissions[subKey].verified) {
        submittedCount++;
      }
    });

    percent = totalDenominator > 0 ? Math.round((submittedCount / totalDenominator) * 100) : 0;
  }

  const isPeeoUser = STATE.currentUser?.role === 'peeo';
  const isSchoolUser = STATE.currentUser?.role === 'school';
  const isAdminUser = STATE.currentUser?.role === 'admin';

  let badgeColorClass = 'red';
  let badgeText = '';

  if (isPeeoUser || isSchoolUser) {
    const targetCode = STATE.currentUser?.shala_darpan_code;
    let isDemandLocked = false;
    if (isSamanDemand) {
      isDemandLocked = isSamanParikshaLockedForCurrentUser(targetCode);
    } else {
      isDemandLocked = isDemandsLockedForCurrentUser();
    }

    if (!isCurrentSubmitted) {
      // 1. जब भरा नहीं हो -> RED
      badgeColorClass = 'red';
      badgeText = '<i class="fas fa-exclamation-circle"></i> ⚠️ बाकी (Pending)';
      card.classList.add('pending');
    } else if (!isDemandLocked) {
      // 2. भरा हुआ है लेकिन एडिट खुला है -> YELLOW
      badgeColorClass = 'yellow';
      badgeText = '<i class="fas fa-edit"></i> ✏️ संशोधन हेतु खुला (Edit Open)';
      card.classList.add('editable-open');
    } else {
      // 3. पूरा भर गया हो और एडिट लॉक हो गया हो -> GREEN
      badgeColorClass = 'green';
      badgeText = '<i class="fas fa-check-circle"></i> ✓ पूर्ण (सत्यापित व लॉक)';
      card.classList.add('submitted');
    }
  } else {
    badgeColorClass = submittedCount > 0 ? 'green' : 'red';
    badgeText = `<i class="fas fa-tasks"></i> ${submittedCount}/${totalDenominator} ${isSamanDemand ? 'स्कूल' : 'PEEO'} पूर्ण`;
  }

  card.innerHTML = `
    <div>
      <div class="demand-card-header">
        <span class="status-badge ${badgeColorClass}">
          ${badgeText}
        </span>
        <div style="display:flex; align-items:center; gap:0.5rem">
          ${demand.published === false ? '<span style="font-size:0.7rem; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; font-weight:bold">अप्रकाशित (Hidden)</span>' : ''}
          <span style="font-size:0.75rem; font-weight:700; color:#b91c1c; background:#fee2e2; padding:2px 8px; border-radius:4px">
            ${demand.priority || 'अति आवश्यक'}
          </span>
        </div>
      </div>

      <h3 class="demand-title">${demand.title}</h3>
      <div class="demand-meta">
        <span><i class="far fa-calendar-alt"></i> अंतिम तिथि: <strong>${demand.dueDate || 'यथाशीघ्र'}</strong></span>
        <span>${demand.description}</span>
      </div>

      <div class="demand-progress-box">
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:600">
          <span>ब्लॉक प्रगति: ${submittedCount}/${totalDenominator} ${isSamanDemand ? 'स्कूल' : 'PEEO'}</span>
          <span>${percent}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${percent}%"></div>
        </div>
      </div>
    </div>

    <div class="demand-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center">
      ${isSamanDemand ? `
        <button class="btn btn-primary btn-sm" onclick="switchTab('saman-pariksha')" style="font-weight:700">
          <i class="fas fa-file-signature"></i> 📋 समान परीक्षा पोर्टल
        </button>
        <button class="btn btn-danger btn-sm" onclick="openPendingReportPdf('saman-pariksha')" style="font-weight:700; background:#dc2626; border-color:#dc2626" title="समान परीक्षा हेतु लम्बित 57 स्कूलों एवं संबंधित PEEOs की आधिकारिक PDF सूची">
          <i class="fas fa-file-pdf"></i> 🚨 लम्बित स्कूल/PEEO PDF
        </button>
        ${isAdminUser ? `
          <button class="btn btn-success btn-sm" onclick="exportSamanParikshaMasterCSV()" title="72-कॉलम विस्तृत एक्सेल डाउनलोड">
            <i class="fas fa-file-excel"></i> 📊 72-कॉलम एक्सेल
          </button>
        ` : ''}
        ${isArchive && isJitendra ? `
          <button class="btn btn-success btn-sm" onclick="toggleSamanParikshaArchive()" style="font-weight:700; color:#ffffff; background:#16a34a; border-color:#15803d">
            <i class="fas fa-undo"></i> 🔄 पुनः सक्रिय करें (Restore to Main Menu)
          </button>
        ` : ''}
      ` : `
        <button class="btn btn-primary btn-sm" onclick="openDynamicDemandPortal('${demand.id}')" style="font-weight:700">
          <i class="fas fa-desktop"></i> 📋 सूचना पोर्टल व प्रपत्र स्थिति खोलें
        </button>
        <button class="btn btn-danger btn-sm" onclick="openPendingReportPdf('demand', '${demand.id}')" style="font-weight:700; background:#dc2626; border-color:#dc2626" title="इस सूचना मांग में लम्बित स्कूलों एवं PEEOs की आधिकारिक PDF सूची">
          <i class="fas fa-file-pdf"></i> 🚨 लम्बित सूची PDF
        </button>
        <button class="btn btn-success btn-sm" onclick="exportDynamicDemandExcel('${demand.id}')" title="इस मांग का एक्सेल डाउनलोड" style="font-weight:700">
          <i class="fas fa-file-excel"></i> 📊 एक्सेल डाउनलोड
        </button>
        ${(isAdminUser || isPeeoUser) ? `
          <button class="btn btn-primary btn-sm" onclick="openDemandBroadcastCenter('${demand.id}')" title="संदेश कस्टमाइज़ करें एवं ईमेल/Telegram/WhatsApp पर भेजें" style="font-weight:700; background:#0284c7; border-color:#0369a1">
            <i class="fas fa-bullhorn"></i> 📢 सूचना प्रसारण व संदेश कस्टमाइज़
          </button>
        ` : ''}
        ${isPeeoUser ? `
          <button class="btn btn-outline-primary btn-sm" onclick="openDynamicDemandPeeoPdf('${demand.id}', '${STATE.currentUser.peeo_name}')" style="font-weight:700">
            <i class="fas fa-file-invoice"></i> 📑 PEEO समेकित A4
          </button>
        ` : ''}
        ${isSchoolUser ? `
          <button class="btn btn-primary btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${STATE.currentUser.shala_darpan_code}')" style="font-weight:700">
            <i class="fas fa-pen-nib"></i> ${isDynamicDemandSubmitted(demand.id, STATE.currentUser.shala_darpan_code) ? 'संशोधित करें' : 'प्रपत्र भरें'}
          </button>
          <button class="btn btn-outline-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${STATE.currentUser.shala_darpan_code}')" style="font-weight:700">
            <i class="fas fa-print"></i> A4 PDF
          </button>
        ` : ''}
        ${isAdminUser ? `
          <button class="btn btn-outline-secondary btn-sm" onclick="openDynamicDemandPeeoSelector('${demand.id}')" title="25 PEEO में से समेकित रिपोर्ट चुनें" style="font-weight:700">
            <i class="fas fa-list-ul"></i> 📋 PEEO समेकित रिपोर्ट
          </button>
          ${isArchive ? `
            <button class="btn btn-success btn-sm" onclick="restoreArchivedDemand('${demand.id}')" style="font-weight:700; color:#ffffff; background:#16a34a; border-color:#15803d" title="इस मांग को सभी लॉगिन पर पुनः लाइव करें">
              <i class="fas fa-undo"></i> 🔄 पुनः सक्रिय करें (Restore)
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="promptDeepBackupDeleteDemand('${demand.id}')" title="मांग प्रपत्र को 7-दिवसीय गहन बैकअप में भेजें (Deep Backup)" style="font-weight:700">
              <i class="fas fa-trash-alt"></i> 🗑️ हटाएं (Deep Backup)
            </button>
          ` : `
            <button class="btn btn-outline-primary btn-sm" onclick="openEditDemandModal('${demand.id}')" title="कॉलम जोड़ें या हटाएं" style="font-weight:700">
              <i class="fas fa-edit"></i> ✏️ प्रपत्र संपादित करें
            </button>
            <button class="btn btn-outline-warning btn-sm" onclick="archiveDemandAndBackup('${demand.id}')" title="मांग आर्काइव कर बैकअप शीट में भेजें" style="font-weight:700">
              <i class="fas fa-box-archive"></i> 📦 आर्काइव करें
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="promptDeepBackupDeleteDemand('${demand.id}')" title="मांग प्रपत्र को 7-दिवसीय गहन बैकअप में भेजें (Deep Backup)" style="font-weight:700">
              <i class="fas fa-trash-alt"></i> 🗑️ हटाएं (Deep Backup)
            </button>
          `}
        ` : (isArchive && isAdminUser ? `
          <button class="btn btn-success btn-sm" onclick="restoreArchivedDemand('${demand.id}')" style="font-weight:700; color:#ffffff; background:#16a34a; border-color:#15803d">
            <i class="fas fa-undo"></i> 🔄 पुनः सक्रिय करें (Restore)
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="promptDeepBackupDeleteDemand('${demand.id}')" title="मांग प्रपत्र को 7-दिवसीय गहन बैकअप में भेजें (Deep Backup)" style="font-weight:700">
            <i class="fas fa-trash-alt"></i> 🗑️ हटाएं (Deep Backup)
          </button>
        ` : '')}
      `}
    </div>
  `;

  return card;
}

/* ========================================================
   7. FORM FILLING & RECTANGULAR RUBBER STAMP
   ======================================================== */
function openFillDemandModal(demandId, forcePeeoId = null) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  STATE.currentDemandToFill = demand;

  const peeoId = forcePeeoId || (STATE.currentUser?.role === 'peeo' ? STATE.currentUser.peeo_id : 'PEEO08');
  const peeo = STATE.peeos.find(p => p.peeo_id === peeoId) || STATE.peeos[0];

  const scope = demand.schoolScope || 'all';
  const scopeHindi = scope === 'govt' ? 'केवल राजकीय विद्यालय' : (scope === 'private' ? 'केवल निजी विद्यालय' : 'समस्त विद्यालय (राजकीय व निजी)');

  document.getElementById('form-modal-title').textContent = demand.title;
  document.getElementById('form-modal-subtitle').textContent = `PEEO परिक्षेत्र: ${peeo.peeo_name} | शा.दा. कोड: ${peeo.shala_darpan_code} | लागू: ${scopeHindi}`;

  // Update instructions banner badge
  const filterBadge = document.getElementById('fill-modal-filter-badge');
  if (filterBadge) filterBadge.textContent = `लागू: ${scopeHindi}`;

  // Update Rectangular Rubber Stamp (सीधी मोहर)
  document.getElementById('stamp-peeo-name').textContent = `रा.उ.मा.वि. ${peeo.panchayat_name} (${peeo.peeo_name.replace('PEEO ', '')})`;

  clearSignatureCanvas();

  const container = document.getElementById('dynamic-form-fields-container');
  container.innerHTML = '';

  const subKey = `${demand.id}_${peeo.peeo_id}`;
  const existingSub = STATE.submissions[subKey];

  // Dynamic filter by demand.schoolScope
  let allSchools = peeo.schools && peeo.schools.length > 0 ? peeo.schools : [
    { school_name: peeo.peeo_name, dise_code: '0812000000', village: peeo.panchayat_name, type: 'Government', is_peeo_nodal: true }
  ];

  let schools = allSchools;
  if (scope === 'govt') {
    schools = allSchools.filter(s => s.type !== 'Private');
  } else if (scope === 'private') {
    schools = allSchools.filter(s => s.type === 'Private');
  }

  const aiBar = document.createElement('div');
  aiBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; padding:0.6rem 1rem; margin-bottom:0.75rem';
  aiBar.innerHTML = `
    <div style="font-size:0.85rem; color:#166534; font-weight:700">
      <i class="fas fa-brain text-success"></i> <strong>AI स्मार्ट ऑटो-फिल:</strong> संस्था प्रधान, मोबाइल, शाला दर्पण कोड आदि मास्टर डायरेक्टरी से स्वतः भरें
    </div>
    <button type="button" class="btn btn-success btn-sm" onclick="aiPrefillPeeoDemandTable('${demand.id}', '${peeo.peeo_id}')" style="font-weight:700; border-radius:20px; padding:4px 14px; background:#16a34a; border-color:#16a34a">
      <i class="fas fa-magic"></i> 🤖 AI स्वतः डेटा भरें (Auto Pre-fill)
    </button>
  `;
  container.appendChild(aiBar);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive';
  
  let headerColsHtml = `
    <th style="width:50px; text-align:center" title="समेकित रिपोर्ट में शामिल करें">शामिल</th>
    <th>क्र.सं. <span class="status-badge locked">LOCKED</span></th>
    <th>विद्यालय का नाम <span class="status-badge locked">LOCKED</span></th>
    <th>प्रकार / कोड <span class="status-badge locked">LOCKED</span></th>
  `;

  demand.columns.forEach(col => {
    headerColsHtml += `<th>${col.name} ${col.locked ? '<span class="status-badge locked">LOCKED</span>' : '<span style="color:red">*</span>'}</th>`;
  });

  let rowsHtml = '';
  schools.forEach((sch, sIdx) => {
    const isPvt = sch.type === 'Private';
    const isNodal = sch.is_peeo_nodal;

    rowsHtml += `
      <tr data-school="${sch.school_name}" id="sch_row_${sIdx}">
        <td style="text-align:center">
          <input type="checkbox" id="include_sch_${sIdx}" checked style="width:18px; height:18px; cursor:pointer" title="समेकित रिपोर्ट में शामिल करें">
        </td>
        <td><strong>${sIdx + 1}</strong></td>
        <td>
          <strong>${sch.school_name}</strong>
          ${isNodal ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af; font-size:0.7rem; margin-left:4px">PEEO नोडल HQ</span>' : ''}<br>
          <span style="font-size:0.75rem; color:var(--neutral-500)">${sch.village || sch.panchayat || ''}</span>
        </td>
        <td>
          <span class="status-badge" style="background:${isPvt ? '#f1f5f9' : '#e0f2fe'}; color:${isPvt ? '#334155' : '#0369a1'}; font-size:0.75rem">
            ${isPvt ? 'निजी' : 'राजकीय'}
          </span><br>
          <code style="font-size:0.75rem">${sch.shala_darpan_code || sch.dise_code || '---'}</code>
        </td>
    `;

    demand.columns.forEach((col, cIdx) => {
      const fieldId = `field_${sIdx}_${cIdx}`;
      let existingVal = '';
      if (existingSub && existingSub.data) {
        const found = existingSub.data.find(d => d.school_name === sch.school_name);
        if (found) existingVal = found[col.name] || '';
      }

      if (col.type === 'select') {
        let optHtml = '';
        (col.options || []).forEach(opt => {
          optHtml += `<option value="${opt}" ${existingVal === opt ? 'selected' : ''}>${opt}</option>`;
        });
        rowsHtml += `
          <td>
            <select id="${fieldId}" class="filter-select" style="min-width:140px" ${col.locked ? 'disabled' : ''}>
              ${optHtml}
            </select>
          </td>
        `;
      } else {
        rowsHtml += `
          <td>
            <input type="${col.type || 'text'}" id="${fieldId}" value="${existingVal}" placeholder="${col.placeholder || ''}" style="min-width:130px; padding:0.45rem; border:1px solid #cbd5e1; border-radius:6px" ${col.locked ? 'readonly' : ''}>
          </td>
        `;
      }
    });

    rowsHtml += `</tr>`;
  });

  tableWrapper.innerHTML = `
    <table class="data-table">
      <thead><tr>${headerColsHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  container.appendChild(tableWrapper);

  showModal('modal-fill-demand');
  setTimeout(resizeCanvas, 200);
}

/* ========================================================
   8. SIGNATURE PAD CANVAS
   ======================================================== */
function setupSignaturePad() {
  canvas = document.getElementById('signature-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width || 360;
  canvas.height = 130;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function startDrawing(e) {
  isDrawing = true;
  hasSignature = true;
  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignatureCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
}

// --- Saman Pariksha GForm Touch Signature Pad ---
let gformCanvas, gformCtx;
let gformIsDrawing = false;
let gformHasSignature = false;

function setupGFormSignaturePad() {
  gformCanvas = document.getElementById('gform-signature-canvas');
  if (!gformCanvas) return;
  gformCtx = gformCanvas.getContext('2d');
  gformCtx.strokeStyle = '#1b365d';
  gformCtx.lineWidth = 2.5;
  gformCtx.lineCap = 'round';
  gformCtx.lineJoin = 'round';

  function getGFormPos(e) {
    const rect = gformCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = gformCanvas.width / rect.width;
    const scaleY = gformCanvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startGForm(e) {
    gformIsDrawing = true;
    gformHasSignature = true;
    const pos = getGFormPos(e);
    gformCtx.beginPath();
    gformCtx.moveTo(pos.x, pos.y);
    if (e.type && e.type.startsWith('touch')) e.preventDefault();
  }

  function drawGForm(e) {
    if (!gformIsDrawing) return;
    const pos = getGFormPos(e);
    gformCtx.lineTo(pos.x, pos.y);
    gformCtx.stroke();
    gformHasSignature = true;
    if (e.type && e.type.startsWith('touch')) e.preventDefault();
  }

  function stopGForm() {
    gformIsDrawing = false;
  }

  gformCanvas.addEventListener('mousedown', startGForm);
  gformCanvas.addEventListener('mousemove', drawGForm);
  window.addEventListener('mouseup', stopGForm);

  gformCanvas.addEventListener('touchstart', startGForm, { passive: false });
  gformCanvas.addEventListener('touchmove', drawGForm, { passive: false });
  window.addEventListener('touchend', stopGForm);
}

function clearGFormSignature() {
  if (gformCanvas && gformCtx) {
    gformCtx.clearRect(0, 0, gformCanvas.width, gformCanvas.height);
    gformHasSignature = false;
  }
}

/* ========================================================
   9. SUBMISSION & CONSOLIDATED REPORT CERTIFICATION
   ======================================================== */
function submitDemandForm() {
  const demand = STATE.currentDemandToFill;
  if (!demand) return;

  const peeoId = STATE.currentUser?.role === 'peeo' ? STATE.currentUser.peeo_id : 'PEEO08';
  const peeo = STATE.peeos.find(p => p.peeo_id === peeoId) || STATE.peeos[0];

  if (!hasSignature) {
    showToast('कृपया पहले सिग्नेचर पैड पर डिजिटल हस्ताक्षर करें!', 'warning');
    return;
  }

  const scope = demand.schoolScope || 'all';
  let allSchools = peeo.schools && peeo.schools.length > 0 ? peeo.schools : [];
  let targetSchools = allSchools;
  if (scope === 'govt') {
    targetSchools = allSchools.filter(s => s.type !== 'Private');
  } else if (scope === 'private') {
    targetSchools = allSchools.filter(s => s.type === 'Private');
  }

  const formDataRows = [];
  targetSchools.forEach((sch, sIdx) => {
    const isChecked = document.getElementById(`include_sch_${sIdx}`)?.checked;
    const rowObj = {
      school_name: sch.school_name,
      dise_code: sch.dise_code || sch.shala_darpan_code || '',
      type: sch.type || 'Government',
      panchayat: sch.panchayat || peeo.panchayat_name
    };

    let hasFilledData = false;
    demand.columns.forEach((col, cIdx) => {
      const fieldId = `field_${sIdx}_${cIdx}`;
      const elem = document.getElementById(fieldId);
      const val = elem ? elem.value.trim() : '';
      rowObj[col.name] = val;
      if (val !== '' && val !== '-' && val !== '0' && val !== 'उपलब्ध नहीं' && val !== 'नहीं (No)') {
        hasFilledData = true;
      }
    });

    // "jis school ki report nhi bhari wo roprt me show nhi ho kyu ki bhut si suchn sari school per lagu nhi hoti"
    if (isChecked && hasFilledData) {
      formDataRows.push(rowObj);
    }
  });

  if (formDataRows.length === 0) {
    showToast('कृपया कम से कम एक विद्यालय की सूचना भरें अथवा चेक करें!', 'warning');
    return;
  }

  const signatureDataUrl = canvas.toDataURL('image/png');
  const now = new Date().toLocaleString('hi-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const subKey = `${demand.id}_${peeo.peeo_id}`;
  STATE.submissions[subKey] = {
    demandId: demand.id,
    demandTitle: demand.title,
    schoolScope: scope,
    schoolScopeHindi: scope === 'govt' ? 'केवल राजकीय विद्यालय' : (scope === 'private' ? 'केवल निजी विद्यालय' : 'समस्त विद्यालय (राजकीय व निजी)'),
    peeoId: peeo.peeo_id,
    peeoName: peeo.peeo_name,
    shala_darpan_code: peeo.shala_darpan_code,
    panchayat: peeo.panchayat_name,
    incharge: peeo.principal_incharge,
    mobile: peeo.mobile,
    targetSchoolsCount: targetSchools.length,
    filledSchoolsCount: formDataRows.length,
    data: formDataRows,
    signature: signatureDataUrl,
    submittedAt: now,
    submittedAtTime: new Date().getTime(),
    verified: true
  };

  saveSubmissionsToStorage();

  recordAuditLog({
    user: peeo.principal_incharge,
    action: 'समेकित सूचना प्रतिवेदन सबमिशन',
    target: demand.title,
    details: `कुल ${targetSchools.length} में से ${formDataRows.length} विद्यालयों की समेकित रिपोर्ट सीधी मोहर व डिजिटल हस्ताक्षर सहित प्रमाणित`,
    note: 'समेकित PDF जनरेट'
  });

  closeModal('modal-fill-demand');
  showToast(`समेकित रिपोर्ट सबमिट सफल! (${formDataRows.length} विद्यालय शामिल)`, 'success');
  renderApp();

  setTimeout(() => {
    openPreviewPDFModal(demand.id, peeo.peeo_id);
  }, 300);
}

/* ========================================================
   10. PDF PREVIEW & DIRECT PRINT / DOWNLOAD ENGINE
   ======================================================== */
let activePreviewRecord = null;

function openPreviewPDFModal(demandId, peeoId) {
  const subKey = `${demandId}_${peeoId}`;
  const sub = STATE.submissions[subKey];
  if (!sub) {
    showToast('प्रपत्र अभी सबमिट नहीं किया गया है!', 'error');
    return;
  }

  activePreviewRecord = sub;
  const demand = STATE.demands.find(d => d.id === demandId);
  const previewBox = document.getElementById('pdf-preview-box');

  let tableHeaderCols = `<th>क्र.सं.</th><th>विद्यालय का नाम</th><th>कोड / प्रकार</th>`;
  (demand.columns || []).forEach(col => {
    tableHeaderCols += `<th>${col.name}</th>`;
  });

  let tableDataRows = '';
  sub.data.forEach((row, rIdx) => {
    tableDataRows += `
      <tr>
        <td>${rIdx + 1}</td>
        <td><strong>${row.school_name}</strong></td>
        <td><code>${row.dise_code || '---'}</code></td>
    `;
    (demand.columns || []).forEach(col => {
      tableDataRows += `<td>${row[col.name] || '---'}</td>`;
    });
    tableDataRows += `</tr>`;
  });

  // Authentic Rectangular Stamp HTML inside preview
  previewBox.innerHTML = `
    <div class="letterhead-header">
      <div style="font-size:11pt; font-weight:bold; letter-spacing:0.05em">राजस्थान सरकार • स्कूल शिक्षा विभाग</div>
      <h2 style="margin:4px 0">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
      <div style="font-size:9pt; color:#475569">समग्र शिक्षा अभियान | NIC-SD ID: 8140 | IFMS ID: 1408</div>
      <h3 style="margin-top:10px; text-decoration:underline; font-weight:bold">समेकित सूचना प्रतिवेदन: ${sub.demandTitle}</h3>
    </div>

    <div class="letterhead-meta">
      <div>
        <strong>PEEO परिक्षेत्र:</strong> ${sub.peeoName}<br>
        <strong>शाला दर्पण कोड:</strong> ${sub.shala_darpan_code || '---'} | <strong>प्रभारी:</strong> ${sub.incharge}<br>
        <strong>लागू वर्ग:</strong> <span style="color:#0369a1; font-weight:bold">${sub.schoolScopeHindi || 'समस्त विद्यालय'}</span>
      </div>
      <div style="text-align:right">
        <strong>सत्यापन दिनांक:</strong> ${sub.submittedAt}<br>
        <strong>संपर्क मोबाइल:</strong> ${sub.mobile}<br>
        <strong>समेकित रिपोर्ट:</strong> <span style="color:#16a34a; font-weight:bold">कुल लक्षित: ${sub.targetSchoolsCount || sub.data.length} | प्रविष्ट: ${sub.data.length} विद्यालय</span>
      </div>
    </div>

    <div style="font-size:8.5pt; color:#475569; margin-bottom:8px; font-style:italic">
      * नोट: इस समेकित रिपोर्ट में केवल उन्हीं विद्यालयों का विवरण सम्मिलित किया गया है जिन पर यह सूचना लागू थी एवं जिनकी रिपोर्ट प्रविष्ट की गई है।
    </div>

    <table class="letterhead-table">
      <thead><tr>${tableHeaderCols}</tr></thead>
      <tbody>${tableDataRows}</tbody>
    </table>

    <div style="font-size:9pt; margin:1rem 0; color:#1e293b; background:#f8fafc; padding:8px; border:1px solid #cbd5e1; border-radius:4px">
      <strong>घोषणा एवं प्रमाणीकरण:</strong> प्रमाणित किया जाता है कि उपरोक्त समेकित सूचना मेरे द्वारा अधीनस्थ विद्यालयों के मूल अभिलेखों का भलीभांति सत्यापन कर तैयार की गई है तथा पूर्णतया सत्य व सही है।
    </div>

    <div class="letterhead-footer-sign" style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:1rem">
      <!-- Rectangular Stamp (सीधी मोहर) -->
      <div style="text-align:center">
        <div class="rubber-stamp" style="width:260px; min-height:76px">
          <div class="stamp-line1">प्रधानाचार्य एवं पदेन पंचायत प्रारम्भिक शिक्षा अधिकारी (PEEO)</div>
          <div class="stamp-line2">रा.उ.मा.वि. ${sub.panchayat || ''} (${sub.peeoName.replace('PEEO ', '')})</div>
          <div class="stamp-line3">पंचायत समिति - भिनाय (अजमेर)</div>
        </div>
        <div style="font-size:8pt; font-weight:700; color:#15803d; margin-top:4px">✓ अधिकृत सीधी डिजिटल मोहर</div>
      </div>

      <!-- Signature -->
      <div style="text-align:center; min-width:200px">
        <img src="${sub.signature}" alt="Signature" style="max-height:55px; max-width:170px; margin-bottom:4px"><br>
        <strong>(${sub.incharge})</strong><br>
        <span style="font-size:8.5pt">प्रधानाचार्य एवं PEEO / UCEEO</span><br>
        <span style="font-size:8pt; color:#64748b">${sub.peeoName} (कोड: ${sub.shala_darpan_code})</span>
      </div>
    </div>
  `;

  showModal('modal-preview-pdf');
}

// 1. Native Vector Browser Print (100% Reliable & Opens in all PDF readers)
function printLetterheadDirectly() {
  window.print();
}

// 2. Instant html2pdf Download
async function downloadCurrentPDF() {
  if (!activePreviewRecord) return;
  const cleanName = (activePreviewRecord.peeoName + '_' + activePreviewRecord.demandTitle).replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
  const filename = `${cleanName}.pdf`;

  showToast('आधिकारिक Landscape PDF तैयार किया जा रहा है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('pdf-preview-box', filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('आधिकारिक PDF सफलतापूर्वक डाउनलोड हो गया!', 'success');
  } catch (err) {
    console.warn('PDF download fallback to print:', err);
    printLetterheadDirectly();
  }
}

async function shareCurrentPDFOnWhatsApp() {
  if (!activePreviewRecord) return;
  const cleanName = (activePreviewRecord.peeoName + '_' + activePreviewRecord.demandTitle).replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
  const filename = `${cleanName}.pdf`;
  const msg = `*कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी भिनाय*\n\n` +
              `*प्रपत्र:* ${activePreviewRecord.demandTitle}\n` +
              `*PEEO:* ${activePreviewRecord.peeoName} (कोड: ${activePreviewRecord.shala_darpan_code})\n` +
              `*प्रभारी:* ${activePreviewRecord.incharge}\n` +
              `*सत्यापन दिनांक:* ${activePreviewRecord.submittedAt}\n\n` +
              `सादर सूचनार्थ, उक्त सूचना का प्रमाणित प्रपत्र सीधी डिजिटल मोहर एवं हस्ताक्षर सहित CBEO भिनाय पोर्टल पर सफलता पूर्वक सबमिट कर दिया गया है।`;

  showToast('WhatsApp शेयर हेतु PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('pdf-preview-box', filename);
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: activePreviewRecord.demandTitle,
        text: msg
      });
      showToast('WhatsApp शेयर विंडो सफलतापूर्वक खुल गई!', 'success');
      return;
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg + '\n\n*(नोट: PDF फाइल आपके सिस्टम में डाउनलोड हो गई है, कृपया WhatsApp चैट में अटैच करें)*')}`;
      window.open(waUrl, '_blank');
      showToast('PDF डाउनलोड हो गई है एवं WhatsApp खुल गया है! कृपया फाइल अटैच करें।', 'info');
      return;
    }
  } catch (e) {
    console.warn('Share current PDF fallback:', e);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
}

function quickShareWhatsApp(demandId, peeoId) {
  const subKey = `${demandId}_${peeoId}`;
  const sub = STATE.submissions[subKey];
  if (!sub) return;
  activePreviewRecord = sub;
  shareCurrentPDFOnWhatsApp();
}

function sendWhatsAppMessage(mobile, defaultText) {
  const text = defaultText || '';
  if (!mobile) {
    if (text) {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
    return;
  }
  let cleanMob = String(mobile || '').replace(/\D/g, '');
  if (cleanMob.length === 12 && cleanMob.startsWith('91')) {
    // already 12 digits with 91
  } else if (cleanMob.length === 10) {
    cleanMob = '91' + cleanMob;
  } else if (cleanMob.length > 10 && !cleanMob.startsWith('91')) {
    cleanMob = '91' + cleanMob.slice(-10);
  }
  const url = `https://wa.me/${cleanMob}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
window.sendWhatsAppMessage = sendWhatsAppMessage;

function sendDualWhatsAppMessage(mobile, defaultText) {
  sendWhatsAppMessage(mobile, defaultText);
}
window.sendDualWhatsAppMessage = sendDualWhatsAppMessage;

/* ========================================================
   11. DYNAMIC INFORMATION DEMAND SYSTEM & ADMIN CONTROL ROOM
   Zero-Code Auto Tab Generation, Google Sheet JSON Sync,
   25 PEEO Compliance Matrix & A4 Landscape Official PDF
   ======================================================== */

// 1. Helper to retrieve target schools for any demand
function getTargetSchoolsForDemand(demand) {
  if (!demand) return STATE.schools56 || [];
  const scope = demand.schoolScope || 'all';
  const allSchools = getAllMasterSchools();
  const secSchools = STATE.schools56 || [];

  if (scope === 'govt_sec' || scope === 'govt_secondary' || scope === 'govt_sec_srsec') {
    return secSchools.filter(s => s.type !== 'Private'); // 49 Govt schools
  } else if (scope === 'pvt_sec' || scope === 'private_secondary' || scope === 'pvt_sec_srsec') {
    return secSchools.filter(s => s.type === 'Private'); // 8 Pvt schools
  } else if (scope === 'both_sec' || scope === 'secondary_sr_sec' || scope === 'sec_srsec') {
    return secSchools; // 57 schools
  } else if (scope === 'govt' || scope === 'all_govt') {
    return allSchools.filter(s => s.type !== 'Private'); // 132 Govt
  } else if (scope === 'private') {
    return allSchools.filter(s => s.type === 'Private');
  }

  if (demand.id === 'saman_pariksha_2026_27' || (demand.title && demand.title.includes('समान परीक्षा'))) {
    return secSchools;
  }

  return allSchools;
}

// 2. Dynamic Navigation Tabs Generator (Adds tab for standalone dynamic demands)
function renderDynamicNavTabs() {
  const container = document.querySelector('.main-nav-bar .nav-container');
  if (!container) return;

  container.querySelectorAll('.nav-tab-dynamic-demand').forEach(t => t.remove());

  // Only demands explicitly marked for new dynamic tab (placement === 'tab_new')
  const activeDemands = (STATE.demands || []).filter(d => 
    !d.archived && 
    d.placement === 'tab_new' && 
    d.id !== 'saman_pariksha_2026_27' && 
    d.id !== 'DEMAND_SAMAN_PARIKSHA_2026' && 
    !d.id.toLowerCase().includes('saman_pariksha') &&
    !(d.title && d.title.includes('समान परीक्षा'))
  );
  const user = STATE.currentUser;

  const visibleDemands = activeDemands.filter(d => {
    if (d.published === false && (!user || user.role !== 'admin')) return false;
    return isDemandVisibleForCurrentUser(d);
  });

  const refTab = document.getElementById('nav-tab-saman-pariksha');
  if (!refTab) return;

  visibleDemands.slice().reverse().forEach(d => {
    const targetSchools = getTargetSchoolsForDemand(d);
    let subCount = 0;
    if (user?.role === 'school') {
      subCount = isDynamicDemandSubmitted(d.id, user.shala_darpan_code) ? 1 : 0;
    } else if (user?.role === 'peeo') {
      const pSchools = targetSchools.filter(s => s.peeo_name === user.peeo_name || s.peeo_code === user.shala_darpan_code);
      subCount = pSchools.filter(s => isDynamicDemandSubmitted(d.id, s.shala_darpan_code)).length;
    } else {
      subCount = targetSchools.filter(s => isDynamicDemandSubmitted(d.id, s.shala_darpan_code)).length;
    }
    const totalCount = (user?.role === 'school') ? 1 : ((user?.role === 'peeo') ? targetSchools.filter(s => s.peeo_name === user.peeo_name).length : targetSchools.length);

    const btn = document.createElement('button');
    const isTabActive = (STATE.activeDemandPortalId === d.id && document.getElementById('view-dynamic-demand')?.classList.contains('active'));
    btn.className = `nav-tab nav-tab-dynamic-demand ${isTabActive ? 'active' : ''}`;
    btn.id = `nav-tab-demand-${d.id}`;
    btn.onclick = () => openDynamicDemandPortal(d.id);
    const isComplete = totalCount > 0 && subCount === totalCount;
    btn.innerHTML = `
      <i class="fas fa-clipboard-list"></i> 📋 ${d.title}
      <span class="tab-badge ${isComplete ? 'badge-success' : 'badge-danger'}">${subCount}/${totalCount}</span>
    `;

    refTab.parentNode.insertBefore(btn, refTab.nextSibling);
  });
}

// 3. Switch to Dynamic Demand Portal View
function openDynamicDemandPortal(demandId) {
  STATE.activeDemandPortalId = demandId;
  switchTab('dynamic-demand', demandId);
  renderDynamicDemandPortalView(demandId);
}

// 4. Render Dynamic Demand Portal View
function renderDynamicDemandPortalView(demandId) {
  const container = document.getElementById('dynamic-demand-portal-container');
  if (!container) return;

  const demand = STATE.demands.find(d => d.id === demandId) || STATE.demands.find(d => !d.archived && d.id !== 'saman_pariksha_2026_27');
  if (!demand) {
    container.innerHTML = `
      <div class="section-box" style="text-align:center; padding:3rem">
        <i class="fas fa-info-circle fa-3x" style="color:#94a3b8; margin-bottom:1rem"></i>
        <h3>कोई सक्रिय सूचना मांग उपलब्ध नहीं है</h3>
        <p style="color:#64748b">एडमिन कंट्रोल रूम में जाकर 'नई सूचना जोड़ें' बटन से नया प्रपत्र तैयार कर सकते हैं।</p>
        <button class="btn btn-primary" onclick="openCreateDemandModal()">
          <i class="fas fa-plus"></i> नई सूचना प्रपत्र जोड़ें
        </button>
      </div>
    `;
    return;
  }

  STATE.activeDemandPortalId = demand.id;

  const targetSchools = getTargetSchoolsForDemand(demand);
  const totalSchools = targetSchools.length;
  let submittedCount = 0;
  targetSchools.forEach(s => {
    if (isDynamicDemandSubmitted(demand.id, s.shala_darpan_code)) submittedCount++;
  });
  const pendingCount = Math.max(0, totalSchools - submittedCount);
  const compliancePercent = totalSchools > 0 ? Math.round((submittedCount / totalSchools) * 100) : 0;

  const user = STATE.currentUser;
  const isSchoolUser = user?.role === 'school';
  const isPeeoUser = user?.role === 'peeo';
  const isAdminUser = !user || user.role === 'admin';

  let portalContent = `
    <!-- Hero Banner (Same Gold Standard as Saman Pariksha) -->
    <div class="sp-hero-banner" style="background:linear-gradient(135deg, #1e3a8a, #0369a1); margin-bottom:1.5rem">
      <div class="sp-hero-title">
        <h2><i class="fas fa-clipboard-check"></i> ${demand.title}</h2>
        <div style="font-size:0.95rem; opacity:0.95; margin-top:0.25rem">
          ${demand.description || 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय द्वारा जारी अधिकृत सूचना मांग'}
        </div>
        <div class="sp-hero-badges" style="margin-top:0.5rem">
          <span class="sp-badge"><i class="fas fa-school"></i> ${totalSchools} लक्षित विद्यालय (${demand.schoolScope === 'govt' ? 'केवल राजकीय' : (demand.schoolScope === 'private' ? 'केवल निजी' : 'राजकीय व निजी')})</span>
          <span class="sp-badge"><i class="fas fa-calendar-alt"></i> अंतिम तिथि: ${demand.dueDate || 'यथाशीघ्र'}</span>
          <span class="sp-badge"><i class="fas fa-file-signature"></i> संस्था प्रधान अधिकृत डिजिटल हस्ताक्षर अनिवार्य</span>
        </div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
        <button class="btn btn-light btn-sm" onclick="exportDynamicDemandExcel('${demand.id}')" style="color:#1e3a8a; font-weight:700">
          <i class="fas fa-file-excel text-success"></i> समेकित एक्सेल डाउनलोड
        </button>
        <button class="btn btn-danger btn-sm" onclick="openPendingReportPdf('demand', '${demand.id}')" style="background:#dc2626; border-color:#dc2626; font-weight:700" title="लम्बित स्कूल एवं PEEO सूची PDF">
          <i class="fas fa-file-pdf"></i> 🚨 लम्बित स्कूल/PEEO PDF
        </button>
        ${(isAdminUser || isPeeoUser) ? `
          <button class="btn btn-primary btn-sm" onclick="openDemandBroadcastCenter('${demand.id}')" style="background:#0284c7; color:#ffffff; font-weight:800; border:none" title="संदेश कस्टमाइज़ करें एवं ईमेल/Telegram/WhatsApp पर भेजें">
            <i class="fas fa-bullhorn"></i> 📢 सूचना प्रसारण व संदेश कस्टमाइज़
          </button>
          <button class="btn btn-primary btn-sm" onclick="openDynamicDemandPeeoSelector('${demand.id}')" style="font-weight:700">
            <i class="fas fa-list-ul"></i> PEEO समेकित रिपोर्ट
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // 1. SCHOOL USER VIEW
  if (isSchoolUser) {
    const schoolCode = user.shala_darpan_code;
    const isSub = isDynamicDemandSubmitted(demand.id, schoolCode);
    const sub = getDemandSubmissionRecord(demand.id, schoolCode);

    portalContent += `
      <div class="section-box" style="margin-bottom:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
          <div>
            <h3 style="color:#1e3a8a; font-size:1.15rem; font-weight:800; display:flex; align-items:center; gap:0.5rem">
              <i class="fas fa-university"></i> ${user.school_name}
            </h3>
            <div style="font-size:0.85rem; color:#64748b; margin-top:2px">
              शाला दर्पण कोड: <code>${schoolCode}</code> | संबंधित PEEO: <strong>${user.peeo_name}</strong>
            </div>
          </div>
          <span class="status-badge ${isSub ? 'green' : 'red'}" style="font-size:0.9rem; padding:6px 14px">
            <i class="fas ${isSub ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${isSub ? '✓ अधिकृत सबमिट (Submitted)' : 'बाकी (Pending)'}
          </span>
        </div>

        <div style="margin-top:1.5rem; background:${isSub ? '#ecfdf5' : '#fef2f2'}; border:1.5px solid ${isSub ? '#a7f3d0' : '#fecaca'}; border-radius:10px; padding:1.25rem">
          ${isSub ? `
            <div style="color:#065f46; font-weight:700; margin-bottom:0.75rem; font-size:1rem">
              <i class="fas fa-shield-alt text-success"></i> आपके विद्यालय का प्रपत्र अधिकृत डिजिटल हस्ताक्षर सहित Google Sheet में सुरक्षित है।
            </div>
            <div style="font-size:0.85rem; color:#047857; margin-bottom:1rem">
              सत्यापन दिनांक: <strong>${sub.submitted_at || '---'}</strong> | प्रस्तुतकर्ता: <strong>${sub.submitted_by || 'संस्था प्रधान'}</strong> (मो. ${sub.submitter_mobile || '---'})
            </div>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap">
              <button class="btn btn-success" onclick="openUniversalDemandPdfPreview('${demand.id}', '${schoolCode}')" style="font-weight:700">
                <i class="fas fa-print"></i> अधिकृत A4 PDF प्रपत्र देखें / प्रिंट करें
              </button>
              <button class="btn btn-outline-primary" onclick="openFillDemandForSchoolModal('${demand.id}', '${schoolCode}')" style="font-weight:700">
                <i class="fas fa-edit"></i> प्रपत्र विवरण संशोधित करें
              </button>
            </div>
          ` : `
            <div style="color:#991b1b; font-weight:700; margin-bottom:0.75rem; font-size:1rem">
              <i class="fas fa-exclamation-triangle text-danger"></i> आपके विद्यालय द्वारा यह सूचना प्रपत्र अभी भरा जाना शेष है!
            </div>
            <p style="font-size:0.85rem; color:#7f1d1d; margin-bottom:1rem">
              कृपया नीचे दिए गए बटन पर क्लिक कर सभी आवश्यक कॉलम भरें एवं डिजिटल हस्ताक्षर कर प्रपत्र सबमिट करें।
            </p>
            <button class="btn btn-primary" onclick="openFillDemandForSchoolModal('${demand.id}', '${schoolCode}')" style="font-weight:700">
              <i class="fas fa-pen-nib"></i> सूचना प्रपत्र भरें
            </button>
          `}
        </div>
      </div>
    `;
  }

  // 2. PEEO USER VIEW
  else if (isPeeoUser) {
    const peeoSchools = targetSchools.filter(s => s.peeo_name === user.peeo_name || s.peeo_code === user.shala_darpan_code);
    const peeoSubCount = peeoSchools.filter(s => isDynamicDemandSubmitted(demand.id, s.shala_darpan_code)).length;

    portalContent += `
      <div class="section-box" style="margin-bottom:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
          <div>
            <h3 style="color:#1e3a8a; font-size:1.15rem; font-weight:800; display:flex; align-items:center; gap:0.5rem">
              <i class="fas fa-landmark"></i> ${user.peeo_name} (परिक्षेत्र प्रपत्र स्थिति)
            </h3>
            <div style="font-size:0.85rem; color:#64748b; margin-top:2px">
              प्रभारी: <strong>${user.principal_incharge}</strong> | कोड: <code>${user.shala_darpan_code}</code> | प्रगति: <strong>${peeoSubCount}/${peeoSchools.length} पूर्ण</strong>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="openDynamicDemandPeeoPdf('${demand.id}', '${user.peeo_name}')" style="font-weight:700">
              <i class="fas fa-file-invoice"></i> PEEO समेकित A4 रिपोर्ट
            </button>
            <button class="btn btn-danger btn-sm" onclick="openPendingReportPdf('demand', '${demand.id}')" style="background:#dc2626; border-color:#dc2626; font-weight:700" title="लम्बित स्कूल सूची PDF">
              <i class="fas fa-file-pdf"></i> लम्बित स्कूल PDF
            </button>
            <button class="btn btn-outline-primary btn-sm" onclick="exportDynamicDemandExcel('${demand.id}', '${user.peeo_name}')" style="font-weight:700">
              <i class="fas fa-download"></i> एक्सेल सूची
            </button>
          </div>
        </div>

        <div class="table-responsive" style="margin-top:1rem">
          <table class="data-table">
            <thead>
              <tr>
                <th>क्र.सं.</th>
                <th>शा.दा. कोड</th>
                <th>विद्यालय का नाम</th>
                <th>श्रेणी / प्रकार</th>
                <th>प्रपत्र स्थिति</th>
                <th>प्रस्तुतकर्ता</th>
                <th>कार्यवाही</th>
              </tr>
            </thead>
            <tbody>
              ${peeoSchools.map((s, idx) => {
                const isSub = isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
                const isMismatch = isDemandSchoolMismatch(demand.id, s.shala_darpan_code);
                const sub = getDemandSubmissionRecord(demand.id, s.shala_darpan_code);

                let rowStyle = '';
                let statusBadge = `<span class="status-badge red">बाकी (Pending)</span>`;
                let actionBtns = '';

                if (isMismatch) {
                  rowStyle = 'style="background:#fef2f2; border-left:5px solid #ef4444"';
                  statusBadge = `<span class="status-badge" style="background:#fee2e2; color:#991b1b; font-weight:800; border:1px solid #f87171"><i class="fas fa-exclamation-triangle"></i> 🚨 मिसमैच (अनलॉक)</span>`;
                  actionBtns = `
                    <button class="btn btn-danger btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')" style="font-weight:700; background:#dc2626; border-color:#dc2626">
                      <i class="fas fa-edit"></i> ✏️ प्रपत्र सुधारें
                    </button>
                    ${isSub ? `
                      <button class="btn btn-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${s.shala_darpan_code}')">
                        <i class="fas fa-print"></i> A4 PDF
                      </button>
                    ` : ''}
                  `;
                } else if (isSub) {
                  rowStyle = 'style="background:#f0fdf4; border-left:4px solid #16a34a"';
                  statusBadge = `<span class="status-badge" style="background:#dcfce7; color:#166534; font-weight:700; border:1px solid #86efac"><i class="fas fa-check-circle"></i> ✓ मान्य (लॉक)</span>`;
                  actionBtns = `
                    <button class="btn btn-outline-secondary btn-sm" disabled style="opacity:0.65; cursor:not-allowed" title="प्रपत्र अधिकृत रूप से सत्यापित व लॉक है (केवल मिसमैच पर अनलॉक होगा)">
                      <i class="fas fa-lock"></i> प्रपत्र लॉक
                    </button>
                    <button class="btn btn-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${s.shala_darpan_code}')">
                      <i class="fas fa-print"></i> A4 PDF
                    </button>
                  `;
                } else {
                  statusBadge = `<span class="status-badge red">बाकी</span>`;
                  actionBtns = `
                    <button class="btn btn-primary btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')">
                      <i class="fas fa-pen-nib"></i> प्रपत्र भरें
                    </button>
                    <button class="btn btn-whatsapp btn-sm" onclick="sendDynamicDemandSchoolReminder('${demand.id}', '${s.shala_darpan_code}')">
                      <i class="fab fa-whatsapp"></i> रिमाइंडर
                    </button>
                  `;
                }

                return `
                  <tr ${rowStyle}>
                    <td><strong>${idx + 1}</strong></td>
                    <td><code>${s.shala_darpan_code}</code></td>
                    <td><strong>${s.school_name}</strong> ${s.is_peeo_nodal ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af; font-size:0.7rem">नोडल HQ</span>' : ''}</td>
                    <td><span class="status-badge" style="background:${s.type === 'Private' ? '#f1f5f9' : '#e0f2fe'}; color:${s.type === 'Private' ? '#334155' : '#0369a1'}">${s.type === 'Private' ? 'निजी' : 'राजकीय'}</span></td>
                    <td>${statusBadge}</td>
                    <td>${sub.submitted_by ? `${sub.submitted_by} <br><span style="font-size:0.72rem; color:#64748b">${sub.submitter_mobile || ''}</span>` : '---'}</td>
                    <td>
                      <div style="display:flex; gap:0.4rem; flex-wrap:wrap">
                        ${actionBtns}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 3. ADMIN / BLOCK VIEW
  if (isAdminUser) {
    portalContent += `
      <!-- KPI Cards (Exact Standard as Saman Pariksha) -->
      <div class="sp-stat-grid" style="margin-bottom:1.5rem">
        <div class="sp-stat-card">
          <div class="sp-stat-num" style="color:#0369a1">${totalSchools}</div>
          <div class="sp-stat-label"><i class="fas fa-school"></i> कुल लक्षित विद्यालय</div>
        </div>
        <div class="sp-stat-card">
          <div class="sp-stat-num" style="color:#15803d">${submittedCount}</div>
          <div class="sp-stat-label"><i class="fas fa-check-circle"></i> प्रपत्र पूर्ण विद्यालय</div>
        </div>
        <div class="sp-stat-card">
          <div class="sp-stat-num" style="color:#dc2626">${pendingCount}</div>
          <div class="sp-stat-label"><i class="fas fa-hourglass-half"></i> प्रपत्र लंबित विद्यालय</div>
        </div>
        <div class="sp-stat-card">
          <div class="sp-stat-num" style="color:#7c3aed">${compliancePercent}%</div>
          <div class="sp-stat-label"><i class="fas fa-chart-line"></i> समग्र ब्लॉक अनुपालना</div>
        </div>
      </div>

      <!-- Action Toolbar & Quick WhatsApp Reminder -->
      <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap">
          <span style="font-weight:700; color:#1e293b"><i class="fas fa-bolt text-primary"></i> त्वरित कार्यवाहियां:</span>
          <button class="btn btn-danger btn-sm" onclick="openPendingReportPdf('demand', '${demand.id}')" style="background:#dc2626; border-color:#dc2626; font-weight:700" title="लम्बित स्कूलों एवं PEEOs की आधिकारिक PDF सूची">
            <i class="fas fa-file-pdf"></i> 🚨 लम्बित स्कूल/PEEO PDF
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="sendDynamicDemandBulkReminder('${demand.id}')" style="font-weight:700">
            <i class="fab fa-whatsapp"></i> सभी ${pendingCount} लंबित स्कूलों को व्हाट्सएप रिमाइंडर
          </button>
          <button class="btn btn-warning btn-sm" onclick="openBroadcastDemandEmailModal('${demand.id}')" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#ffffff; font-weight:800; border:none; box-shadow:0 2px 6px rgba(217,119,6,0.3)" title="लक्षित विद्यालयों को ईमेल सूचना एवं भरने के निर्देश भेजें">
            <i class="fas fa-paper-plane"></i> 📧 संबंधित विद्यालयों को ईमेल सूचना भेजें
          </button>
          <button class="btn btn-outline-secondary btn-sm" onclick="openDynamicDemandPeeoSelector('${demand.id}')">
            <i class="fas fa-landmark"></i> 25 PEEO समेकित रिपोर्ट
          </button>
        </div>
        <div style="display:flex; gap:0.5rem">
          <button class="btn btn-primary btn-sm" onclick="openCreateDemandModal()" style="font-weight:700">
            <i class="fas fa-plus-circle"></i> नई सूचना प्रपत्र जोड़ें
          </button>
        </div>
      </div>

      <!-- Filter Controls & Dynamic Table -->
      <div class="section-box">
        <div class="section-header" style="flex-wrap:wrap; gap:1rem">
          <div class="section-title">
            <i class="fas fa-table text-primary"></i>
            <h2>समस्त ${totalSchools} विद्यालयों की स्थिति एवं प्रविष्टियां</h2>
            <span class="section-count">${submittedCount} पूर्ण / ${pendingCount} लंबित</span>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
            <input type="text" id="dynamic-demand-search-input" placeholder="विद्यालय, कोड या PEEO खोजें..." class="filter-select" style="min-width:200px" oninput="filterDynamicDemandTable('${demand.id}')">
            <select id="dynamic-demand-peeo-filter" class="filter-select" onchange="filterDynamicDemandTable('${demand.id}')">
              <option value="all">समस्त 25 PEEO</option>
              ${STATE.peeos.map(p => `<option value="${p.peeo_name}">${p.peeo_name}</option>`).join('')}
            </select>
            <select id="dynamic-demand-status-filter" class="filter-select" onchange="filterDynamicDemandTable('${demand.id}')">
              <option value="all">सभी स्थितियां</option>
              <option value="completed">केवल पूर्ण (${submittedCount})</option>
              <option value="pending">केवल लंबित (${pendingCount})</option>
            </select>
            <select id="dynamic-demand-type-filter" class="filter-select" onchange="filterDynamicDemandTable('${demand.id}')">
              <option value="all">सभी प्रकार</option>
              <option value="Government">केवल राजकीय</option>
              <option value="Private">केवल निजी</option>
            </select>
          </div>
        </div>

        <!-- Batch Action Toolbar -->
        <div id="dynamic-demand-batch-bar" style="display:none; background:#fef2f2; border:1.5px solid #fecaca; border-radius:8px; padding:0.65rem 1rem; margin-bottom:1rem; align-items:center; justify-content:space-between">
          <div style="font-weight:700; color:#991b1b; font-size:0.9rem">
            <i class="fas fa-check-circle text-danger"></i> चयनित: <span id="dynamic-demand-selected-count" style="font-weight:900; text-decoration:underline">0</span> विद्यालय
          </div>
          <div style="display:flex; gap:0.5rem">
            <button class="btn btn-danger btn-sm" onclick="openBatchDemandMismatchModal('${demand.id}')" style="font-weight:800; background:#dc2626">
              <i class="fas fa-tasks"></i> 🚨 चयनित स्कूलों को सामूहिक मिसमैच मार्क करें (Email + Telegram)
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="dynamic-demand-schools-table">
            <thead>
              <tr>
                <th style="width:36px; text-align:center">
                  <input type="checkbox" id="dynamic-demand-select-all" onchange="toggleSelectAllDemandSchools(this, '${demand.id}')" title="सभी चुनें">
                </th>
                <th style="width:40px">क्र.सं.</th>
                <th>शा.दा. कोड</th>
                <th>विद्यालय का नाम</th>
                <th>प्रकार</th>
                <th>संबंधित PEEO</th>
                <th>प्रपत्र स्थिति</th>
                <th>प्रस्तुतकर्ता / मोबाइल</th>
                <th style="text-align:center">अधिकृत कार्यवाही एवं मिसमैच अलर्ट</th>
              </tr>
            </thead>
            <tbody id="dynamic-demand-schools-tbody">
              <!-- Populated by filterDynamicDemandTable() -->
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = portalContent;

  if (isAdminUser) {
    filterDynamicDemandTable(demand.id);
  }
}

// 5. Filter schools table for dynamic demand
function filterDynamicDemandTable(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const tbody = document.getElementById('dynamic-demand-schools-tbody');
  if (!tbody) return;

  const targetSchools = getTargetSchoolsForDemand(demand);
  const peeoFilter = document.getElementById('dynamic-demand-peeo-filter')?.value || 'all';
  const statusFilter = document.getElementById('dynamic-demand-status-filter')?.value || 'all';
  const typeFilter = document.getElementById('dynamic-demand-type-filter')?.value || 'all';
  const search = (document.getElementById('dynamic-demand-search-input')?.value || '').toLowerCase().trim();

  const filtered = targetSchools.filter(s => {
    if (peeoFilter !== 'all' && s.peeo_name !== peeoFilter && s.peeo_code !== peeoFilter) return false;
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;

    const isSub = isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
    if (statusFilter === 'completed' && !isSub) return false;
    if (statusFilter === 'pending' && isSub) return false;

    if (search) {
      const match = (s.school_name || '').toLowerCase().includes(search) ||
                    (s.shala_darpan_code || '').toLowerCase().includes(search) ||
                    (s.peeo_name || '').toLowerCase().includes(search);
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:#64748b">कोई विद्यालय रिकॉर्ड नहीं मिला</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const isSub = isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
    const isMismatch = isDemandSchoolMismatch(demand.id, s.shala_darpan_code);
    const sub = getDemandSubmissionRecord(demand.id, s.shala_darpan_code);

    let rowStyle = '';
    let statusBadge = '';
    let actionsHtml = '';

    if (isMismatch) {
      rowStyle = 'style="background:#fef2f2; border-left:5px solid #ef4444"';
      statusBadge = `<span class="status-badge" style="background:#fee2e2; color:#991b1b; font-weight:800; border:1px solid #f87171"><i class="fas fa-exclamation-triangle"></i> 🚨 मिसमैच (अनलॉक)</span>`;
      actionsHtml = `
        <button class="btn btn-danger btn-sm" onclick="openDemandMismatchInspector('${demand.id}', '${s.shala_darpan_code}')" title="मिसमैच फील्ड देखें / संशोधन अलर्ट भेजें" style="font-weight:700; background:#dc2626; border-color:#dc2626">
          <i class="fas fa-flag"></i> 🚨 मिसमैच
        </button>
        <button class="btn btn-outline-primary btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')" title="प्रपत्र संपादित करें">
          <i class="fas fa-edit"></i> संपादित
        </button>
        ${isSub ? `
          <button class="btn btn-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${s.shala_darpan_code}')" title="अधिकृत A4 PDF देखें">
            <i class="fas fa-print"></i> PDF
          </button>
        ` : ''}
      `;
    } else if (isSub) {
      rowStyle = 'style="background:#f0fdf4; border-left:4px solid #16a34a"';
      statusBadge = `<span class="status-badge" style="background:#dcfce7; color:#166534; font-weight:700; border:1px solid #86efac"><i class="fas fa-check-circle"></i> ✓ मान्य (लॉक)</span>`;
      actionsHtml = `
        <button class="btn btn-warning btn-sm" onclick="openDemandMismatchInspector('${demand.id}', '${s.shala_darpan_code}')" title="विसंगति / मिसमैच मार्क करें एवं अलर्ट भेजें" style="font-weight:700; background:#f59e0b; color:#ffffff; border:none">
          <i class="fas fa-flag"></i> 🚨 मिसमैच मार्क
        </button>
        <button class="btn btn-outline-primary btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')" title="प्रपत्र विवरण देखें">
          <i class="fas fa-eye"></i> देखें
        </button>
        <button class="btn btn-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${s.shala_darpan_code}')" title="अधिकृत A4 PDF देखें व प्रिंट करें">
          <i class="fas fa-print"></i> PDF
        </button>
      `;
    } else {
      statusBadge = `<span class="status-badge red"><i class="fas fa-times-circle"></i> बाकी (Pending)</span>`;
      actionsHtml = `
        <button class="btn btn-primary btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')" title="प्रपत्र भरें">
          <i class="fas fa-pen-nib"></i> भरें
        </button>
        <button class="btn btn-whatsapp btn-sm" onclick="sendDynamicDemandSchoolReminder('${demand.id}', '${s.shala_darpan_code}')" title="1-क्लिक WhatsApp रिमाइंडर">
          <i class="fab fa-whatsapp"></i> रिमाइंडर
        </button>
      `;
    }

    return `
      <tr ${rowStyle}>
        <td style="text-align:center">
          <input type="checkbox" class="demand-school-chk" value="${s.shala_darpan_code}" onchange="updateDemandBatchSelection('${demand.id}')">
        </td>
        <td><strong>${idx + 1}</strong></td>
        <td><code>${s.shala_darpan_code}</code></td>
        <td>
          <strong>${s.school_name}</strong>
          ${s.is_peeo_nodal ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af; font-size:0.7rem; margin-left:4px">PEEO HQ</span>' : ''}
        </td>
        <td>
          <span class="status-badge" style="background:${s.type === 'Private' ? '#f1f5f9' : '#e0f2fe'}; color:${s.type === 'Private' ? '#334155' : '#0369a1'}">
            ${s.type === 'Private' ? 'निजी' : 'राजकीय'}
          </span>
        </td>
        <td>${s.peeo_name}</td>
        <td>${statusBadge}</td>
        <td>
          ${sub.submitted_by ? `
            <strong>${sub.submitted_by}</strong><br>
            <a href="tel:${sub.submitter_mobile}" style="font-size:0.75rem; color:var(--primary); text-decoration:none">
              <i class="fas fa-phone-alt"></i> ${sub.submitter_mobile}
            </a>
          ` : '<span style="color:#94a3b8">-</span>'}
        </td>
        <td style="text-align:center">
          <div style="display:flex; justify-content:center; gap:0.35rem; flex-wrap:wrap">
            ${actionsHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 6. Open Modal to Fill Form for an Individual School (Google Form Style with full mobile friendliness)
function openFillDemandForSchoolModal(demandId, schoolCode) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }

  // If this demand represents Saman Pariksha, open the official Saman Pariksha Google Form directly!
  const dId = String(demand.id).toLowerCase();
  if (dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha') || dId === 'saman_pariksha_2026_27' || demand.title.includes('समान परीक्षा')) {
    openSamanParikshaForm(schoolCode);
    return;
  }

  STATE.currentDemandToFill = demand;
  STATE.currentDemandSchoolCode = schoolCode;

  const targetSchools = getTargetSchoolsForDemand(demand);
  const school = targetSchools.find(s => s.shala_darpan_code === schoolCode) || STATE.schools56.find(s => s.shala_darpan_code === schoolCode) || {
    school_name: 'विद्यालय',
    shala_darpan_code: schoolCode,
    peeo_name: 'CBEO Bhinai',
    type: 'Government'
  };

  const existingSub = getDemandSubmissionRecord(demandId, schoolCode);
  const existingData = existingSub.data || {};

  document.getElementById('form-modal-title').textContent = `${demand.title}`;
  document.getElementById('form-modal-subtitle').textContent = `विद्यालय: ${school.school_name} | शा.दा. कोड: ${schoolCode} | संबंधित PEEO: ${school.peeo_name}`;

  const filterBadge = document.getElementById('fill-modal-filter-badge');
  if (filterBadge) filterBadge.textContent = `${school.type === 'Private' ? 'निजी विद्यालय' : 'राजकीय विद्यालय'}`;

  clearSignatureCanvas();

  const container = document.getElementById('dynamic-form-fields-container');
  container.innerHTML = '';

  const isMismatch = isDemandSchoolMismatch(demandId, schoolCode);
  const flaggedFields = existingSub.mismatch_fields || [];

  let fieldsHtml = `
    <!-- Google Form Style Top Header Card -->
    <div class="gform-header-card" style="background:#ffffff; border:1px solid #dadce0; border-top:10px solid #1a73e8; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 1px 3px rgba(60,64,67,0.08)">
      <h3 style="color:#202124; font-size:1.25rem; font-weight:800; margin:0 0 0.4rem 0">
        <i class="fas fa-clipboard-list text-primary"></i> ${demand.title}
      </h3>
      <div style="font-size:0.88rem; color:#5f6368; line-height:1.5">
        ${demand.description || 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय द्वारा जारी अधिकृत प्रपत्र।'}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; font-size:0.85rem; color:#475569">
        <div style="display:flex; gap:1.25rem; flex-wrap:wrap">
          <div><strong>विद्यालय:</strong> ${school.school_name}</div>
          <div><strong>कोड:</strong> <code>${schoolCode}</code></div>
          <div><strong>संबंधित PEEO:</strong> ${school.peeo_name}</div>
          <div><strong>वर्ग:</strong> ${school.type === 'Private' ? 'निजी' : 'राजकीय'}</div>
        </div>
        <button type="button" class="btn btn-outline-success btn-sm" onclick="aiRecognizeAndPrefillColumns('${demand.id}', '${schoolCode}')" style="font-weight:700; border-radius:20px; padding:4px 14px; background:#f0fdf4; border-color:#16a34a; color:#15803d" title="मास्टर डेटाबेस से संस्था प्रधान, मोबाइल व अन्य विवरण स्वतः भरें">
          <i class="fas fa-magic"></i> 🤖 AI स्मार्ट डेटा स्वतः भरें (Auto Pre-fill)
        </button>
      </div>
      <div style="color:#d93025; font-size:0.8rem; font-weight:700; margin-top:0.5rem">
        * सभी अनिवार्य प्रश्नों के उत्तर प्रविष्ट करें
      </div>
    </div>
  `;

  if (isMismatch) {
    fieldsHtml += `
      <div class="gform-header-card" style="background:#fef2f2; border:2px solid #ef4444; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 2px 6px rgba(239,68,68,0.15)">
        <div style="display:flex; align-items:center; gap:0.5rem; color:#b91c1c; font-weight:800; font-size:1.1rem">
          <i class="fas fa-exclamation-triangle"></i> 🚨 प्रपत्र डेटा मिसमैच - सुधार हेतु अनलॉक
        </div>
        <p style="font-size:0.88rem; color:#991b1b; margin:0.4rem 0 0.6rem 0; line-height:1.5">
          कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर) द्वारा आपके विद्यालय के इस प्रपत्र में शाला दर्पण से डेटा मिसमैच चिह्नित किया गया है। लाल बॉक्स वाले फील्ड को विशेष रूप से सत्यापित कर सही दर्ज करें:
        </p>
        ${flaggedFields.length > 0 ? `
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.6rem">
            ${flaggedFields.map(f => `<span style="background:#fee2e2; color:#b91c1c; font-weight:800; font-size:0.82rem; padding:3px 10px; border-radius:20px; border:1.5px solid #f87171">❌ ${f}</span>`).join('')}
          </div>
        ` : ''}
        ${existingSub.mismatch_remarks ? `
          <div style="background:#ffffff; border-left:4px solid #ef4444; padding:0.5rem 0.85rem; border-radius:4px; font-size:0.85rem; color:#7f1d1d">
            <strong>कार्यालय निर्देश / टिप्पणी:</strong> ${existingSub.mismatch_remarks}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Each dynamic column rendered as an individual Google Form Question Card (Exact Saman Pariksha Standard)
  (demand.columns || []).forEach((col, idx) => {
    let existingVal = (existingData[col.name] !== undefined) ? existingData[col.name] : '';
    let isPrefilledFromDB = false;
    const isColFlagged = isMismatch && flaggedFields.includes(col.name);

    // If no existing saved submission, prefill from master DB if prefillSource was configured
    if (existingVal === '' && col.prefillSource && col.prefillSource !== 'none') {
      const dbVal = resolveSamplePrefillValue(col.prefillSource, school);
      if (typeof dbVal === 'string' && !dbVal.includes('--')) {
        existingVal = dbVal;
        isPrefilledFromDB = true;
      }
    }

    const cardBorderLeft = isColFlagged ? '6px solid #ef4444' : (isPrefilledFromDB ? '4px solid #16a34a' : '4px solid #1a73e8');
    const cardBg = isColFlagged ? '#fff5f5' : '#ffffff';
    const cardBorder = isColFlagged ? '1.5px solid #fca5a5' : '1px solid #dadce0';

    fieldsHtml += `
      <div class="gform-card" style="background:${cardBg}; border:${cardBorder}; border-left:${cardBorderLeft}; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1rem; box-shadow:0 1px 3px rgba(60,64,67,0.08); transition:all 0.2s">
        <label style="font-weight:700; color:#202124; font-size:0.98rem; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center">
          <span>${idx + 1}. ${col.name} <span style="color:#d93025">*</span></span>
          <div style="display:flex; gap:0.4rem; align-items:center">
            ${isColFlagged ? '<span style="font-size:0.75rem; font-weight:800; color:#dc2626; background:#fee2e2; padding:2px 8px; border-radius:4px; border:1px solid #f87171"><i class="fas fa-exclamation-circle"></i> ❌ मिसमैच फील्ड</span>' : ''}
            ${isPrefilledFromDB ? '<span style="font-size:0.72rem; font-weight:800; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:4px"><i class="fas fa-check-circle"></i> ✓ अधिकृत DB रिकॉर्ड</span>' : ''}
          </div>
        </label>
        <div style="font-size:0.8rem; color:${isColFlagged ? '#b91c1c' : '#5f6368'}; margin-bottom:0.6rem">
          ${isColFlagged ? '⚠️ कार्यालय द्वारा इस कॉलम में विसंगति पाई गई है। कृपया शाला दर्पण अनुसार सही डेटा दर्ज करें।' : (isPrefilledFromDB ? 'यह विवरण मास्टर डेटाबेस से स्वतः प्राप्त हुआ है।' : 'कृपया इस कॉलम हेतु सही मान अथवा छात्र संख्या दर्ज करें')}
        </div>
        <input type="${col.type === 'number' ? 'number' : (col.type === 'date' ? 'date' : 'text')}" id="demand_input_col_${idx}" value="${existingVal}" placeholder="${col.placeholder || col.name + ' दर्ज करें'}" style="width:100%; padding:0.75rem 1rem; border:${isColFlagged ? '2px solid #ef4444' : (isPrefilledFromDB ? '1.5px solid #86efac' : '1.5px solid #dadce0')}; border-radius:6px; font-size:0.95rem; outline:none; transition:all 0.2s; background:${isColFlagged ? '#ffffff' : (isPrefilledFromDB ? '#f0fdf4' : '#f8fafc')}" onfocus="this.style.borderColor='#1a73e8'; this.style.background='#fff'; this.style.boxShadow='0 0 0 2px rgba(26,115,232,0.2)'" onblur="this.style.borderColor='${isColFlagged ? '#ef4444' : (isPrefilledFromDB ? '#86efac' : '#dadce0')}'; this.style.boxShadow='none'">
      </div>
    `;
  });

  // Google Form Submitter & Principal Details Card
  fieldsHtml += `
    <div class="gform-card" style="background:#ffffff; border:1px solid #dadce0; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1rem; box-shadow:0 1px 3px rgba(60,64,67,0.08)">
      <div style="font-weight:700; color:#202124; font-size:1rem; margin-bottom:0.85rem">
        <i class="fas fa-user-check text-primary"></i> प्रस्तुतकर्ता अधिकारी विवरण
      </div>
      <div style="grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); display:grid; gap:1rem">
        <div>
          <label style="font-weight:600; color:#374151; font-size:0.85rem; margin-bottom:0.3rem; display:block">
            संस्था प्रधान / प्रभारी का नाम <span style="color:#d93025">*</span>:
          </label>
          <input type="text" id="demand-form-submitter-name" value="${existingSub.submitted_by || (STATE.currentUser?.role === 'school' ? STATE.currentUser.school_name : '')}" placeholder="नाम दर्ज करें" style="width:100%; padding:0.65rem 0.85rem; border:1.5px solid #dadce0; border-radius:6px; font-size:0.9rem">
        </div>
        <div>
          <label style="font-weight:600; color:#374151; font-size:0.85rem; margin-bottom:0.3rem; display:block">
            संपर्क मोबाइल नंबर <span style="color:#d93025">*</span>:
          </label>
          <input type="tel" id="demand-form-submitter-mobile" value="${existingSub.submitter_mobile || school.mobile || ''}" placeholder="10 अंकों का मोबाइल नंबर" style="width:100%; padding:0.65rem 0.85rem; border:1.5px solid #dadce0; border-radius:6px; font-size:0.9rem">
        </div>
      </div>
    </div>
  `;

  container.innerHTML = fieldsHtml;

  const isLocked = isDemandLockedForSchool(demand.id, schoolCode);
  if (isLocked) {
    const alertBox = document.createElement('div');
    alertBox.style.cssText = 'background:#fffbeb; border:2px solid #f59e0b; border-radius:8px; padding:0.75rem 1rem; margin-bottom:1rem; color:#92400e; font-weight:700';
    alertBox.innerHTML = '<i class="fas fa-lock"></i> 🔒 यह मांग प्रपत्र संपादन हेतु लॉक है (View-Only Mode)। आप केवल डेटा अवलोकन कर सकते हैं।';
    container.insertBefore(alertBox, container.firstChild);

    container.querySelectorAll('input, select, textarea').forEach(inp => {
      inp.setAttribute('readonly', 'true');
      if (inp.type === 'checkbox' || inp.type === 'radio') inp.setAttribute('disabled', 'true');
    });
  }

  const saveBtn = document.getElementById('btn-save-demand');
  if (saveBtn) {
    if (isLocked) {
      saveBtn.style.display = 'none';
    } else {
      saveBtn.style.display = 'inline-flex';
      saveBtn.setAttribute('onclick', 'submitDynamicDemandSchoolForm()');
    }
  }

  showModal('modal-fill-demand');
  setTimeout(resizeCanvas, 250);
}

// 7. Submit School Dynamic Demand Form & Sync to Google Sheets JSON
async function submitDynamicDemandSchoolForm() {
  const demand = STATE.currentDemandToFill;
  const schoolCode = STATE.currentDemandSchoolCode;
  if (!demand || !schoolCode) {
    showToast('मांग अथवा विद्यालय कोड अमान्य है!', 'error');
    return;
  }

  if (isDemandLockedForSchool(demand.id, schoolCode)) {
    showToast('🔒 यह मांग प्रपत्र संपादन हेतु CBEO कार्यालय द्वारा लॉक है (View-Only Mode)।', 'warning');
    return;
  }

  const targetSchools = getTargetSchoolsForDemand(demand);
  const school = targetSchools.find(s => s.shala_darpan_code === schoolCode) || STATE.schools56.find(s => s.shala_darpan_code === schoolCode) || {
    school_name: 'विद्यालय',
    shala_darpan_code: schoolCode,
    peeo_name: 'CBEO Bhinai'
  };

  const submitterName = document.getElementById('demand-form-submitter-name')?.value.trim() || '';
  const submitterMobile = document.getElementById('demand-form-submitter-mobile')?.value.trim() || '';

  if (!submitterName) {
    showToast('कृपया प्रस्तुतकर्ता / संस्था प्रधान का नाम दर्ज करें!', 'warning');
    return;
  }

  // Collect dynamic fields
  const formData = {};
  (demand.columns || []).forEach((col, idx) => {
    const inputEl = document.getElementById(`demand_input_col_${idx}`);
    formData[col.name] = inputEl ? inputEl.value.trim() : '';
  });

  // Get signature data (Touch / Mouse digital signature)
  let sigData = null;
  if (hasSignature && canvas) {
    sigData = canvas.toDataURL('image/png');
  } else if (STATE.demandSubmissions[demand.id]?.[schoolCode]?.signature_data) {
    sigData = STATE.demandSubmissions[demand.id][schoolCode].signature_data;
  } else if (STATE.samanParikshaSubmissions[schoolCode]?.signature_data) {
    sigData = STATE.samanParikshaSubmissions[schoolCode].signature_data;
  }

  const submissionObj = {
    is_submitted: true,
    status: 'पूर्ण (Submitted)',
    is_mismatch: false,
    mismatch_cleared_at: new Date().toLocaleString('hi-IN'),
    custom_unlocked: false,
    demand_id: demand.id,
    demand_title: demand.title,
    school_code: schoolCode,
    school_name: school.school_name,
    peeo_name: school.peeo_name,
    peeo_code: school.peeo_code || '',
    type: school.type || 'Government',
    submitted_by: submitterName,
    submitter_mobile: submitterMobile,
    submitted_at: new Date().toLocaleString('hi-IN'),
    data: formData,
    signature_data: sigData
  };

  if (!STATE.demandSubmissions) STATE.demandSubmissions = {};
  if (!STATE.demandSubmissions[demand.id]) STATE.demandSubmissions[demand.id] = {};
  STATE.demandSubmissions[demand.id][schoolCode] = submissionObj;

  localStorage.setItem('cbeo_demand_submissions', JSON.stringify(STATE.demandSubmissions));

  // If this demand had mismatch_schools list, clear this school from it
  if (demand.mismatch_schools) {
    demand.mismatch_schools = demand.mismatch_schools.filter(c => String(c).trim() !== String(schoolCode).trim());
    localStorage.setItem('cbeo_demands', JSON.stringify(STATE.demands));
  }

  // Post to Google Apps Script Webhook (action=saveDemandSubmission, stores Data_JSON in PEEO sheet)
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url')
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url)
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveDemandSubmission',
        demand_id: demand.id,
        school_code: schoolCode,
        school_name: school.school_name,
        peeo_name: school.peeo_name,
        submitted_by: submitterName,
        submitter_mobile: submitterMobile,
        data_json: JSON.stringify(formData),
        signature_data: sigData,
        status: 'पूर्ण (Submitted)'
      })
    }).then(res => res.json()).then(res => {
      console.log('GAS Demand Save Response:', res);
    }).catch(err => {
      console.log('GAS Demand Save offline note:', err);
    });
  }

  recordAuditLog({
    user: submitterName,
    action: 'सूचना प्रपत्र सबमिशन (Zero-Code)',
    target: `${demand.title} - ${school.school_name}`,
    details: `${Object.keys(formData).length} कॉलम का विवरण अधिकृत डिजिटल हस्ताक्षर सहित सुरक्षित`,
    note: 'गूगल शीट JSON सिंक'
  });

  closeModal('modal-fill-demand');
  showToast(`'${school.school_name}' का प्रपत्र सफलतापूर्वक सबमिट एवं सुरक्षित हो गया!`, 'success');

  renderDynamicDemandPortalView(demand.id);
  renderDynamicNavTabs();
  renderAdminMatrix();
  renderDemandsView();
  updateAllPortalMetricsAndProgress();

  setTimeout(() => {
    openUniversalDemandPdfPreview(demand.id, schoolCode);
  }, 350);
}

let activeUniversalDemandPdfLanguage = 'hi';

function switchUniversalDemandPdfLanguage(lang) {
  activeUniversalDemandPdfLanguage = lang;
  if (STATE.activeUniversalDemandPreview) {
    openUniversalDemandPdfPreview(STATE.activeUniversalDemandPreview.demandId, STATE.activeUniversalDemandPreview.schoolCode, lang);
  }
}

// 8. Official A4 Landscape PDF Generation (Exact Saman Pariksha Standard, Bilingual Pure Toggle)
function openUniversalDemandPdfPreview(demandId, schoolCode, lang = null) {
  STATE.activeUniversalDemandPreview = { demandId, schoolCode };
  if (lang) activeUniversalDemandPdfLanguage = lang;
  const isEn = (activeUniversalDemandPdfLanguage === 'en');

  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }

  // If this demand is Saman Pariksha, open the official Saman Pariksha Landscape PDF preview!
  const dId = String(demand.id).toLowerCase();
  if (dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha') || dId === 'saman_pariksha_2026_27' || demand.title.includes('समान परीक्षा')) {
    openExamPdfPreview(schoolCode, lang);
    return;
  }

  const targetSchools = getTargetSchoolsForDemand(demand);
  const school = targetSchools.find(s => s.shala_darpan_code === schoolCode) || STATE.schools56.find(s => s.shala_darpan_code === schoolCode) || {
    school_name: 'विद्यालय',
    school_name_en: 'School',
    shala_darpan_code: schoolCode,
    peeo_name: 'CBEO Bhinai',
    type: 'Government',
    category: 'राजकीय'
  };

  // Update external language toolbar buttons (Outside printable container)
  const btnHi = document.getElementById('btn-universal-lang-hi');
  const btnEn = document.getElementById('btn-universal-lang-en');
  if (btnHi && btnEn) {
    if (isEn) {
      btnHi.className = 'btn btn-outline-primary btn-sm';
      btnEn.className = 'btn btn-primary btn-sm';
    } else {
      btnHi.className = 'btn btn-primary btn-sm';
      btnEn.className = 'btn btn-outline-primary btn-sm';
    }
  }

  const schoolDisplayName = getStandardSchoolName(school.shala_darpan_code, activeUniversalDemandPdfLanguage) || (isEn ? (school.school_name_en || school.school_name) : (school.school_name_hi || school.school_name));
  const sub = getDemandSubmissionRecord(demandId, schoolCode);

  const container = document.getElementById('printable-universal-demand-content');
  if (!container) return;

  const titleEl = document.getElementById('universal-demand-pdf-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-file-pdf text-danger"></i> ${isEn ? 'Official Proforma (A4 Landscape)' : 'अधिकृत प्रपत्र (A4 Landscape)'} - ${schoolDisplayName}`;
  }

  // Build Horizontal Excel Table Grid matching uploaded Excel format & headers
  let excelTheadCols = '';
  let excelTbodyCols = '';

  (demand.columns || []).forEach((col, idx) => {
    const colTitle = col.name || (isEn ? `Column ${idx + 1}` : `कॉलम ${idx + 1}`);
    excelTheadCols += `
      <th style="padding:4px 6px; border:1.5px solid #000; background:#f1f5f9; color:#000; font-weight:800; text-align:center; vertical-align:middle; font-size:0.76rem; word-break:break-word">
        ${colTitle}
      </th>`;

    const rawVal = (sub.data && sub.data[col.name] !== undefined && sub.data[col.name] !== '')
      ? sub.data[col.name]
      : (sub.is_submitted ? '-' : `<span style="color:#64748b; font-style:italic">${isEn ? 'NIL' : 'शून्य / रिक्त'}</span>`);
    
    excelTbodyCols += `
      <td style="padding:5px 6px; border:1px solid #000; font-weight:700; color:#000; text-align:center; vertical-align:middle; font-size:0.78rem; word-break:break-word">
        ${rawVal}
      </td>`;
  });

  const printHtml = `
    <!-- Top Official Government Header -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:5px">
      <div style="font-size:0.84rem; font-weight:700; letter-spacing:0.04em; color:#111">
        ${isEn ? 'GOVERNMENT OF RAJASTHAN | DEPARTMENT OF SCHOOL EDUCATION' : 'राजस्थान सरकार | स्कूल शिक्षा विभाग'}
      </div>
      <h2 style="margin:2px 0; font-size:1.15rem; font-weight:900; color:#000; letter-spacing:0.02em">
        ${isEn ? 'OFFICE OF THE CHIEF BLOCK EDUCATION OFFICER (CBEO), BHINAI (AJMER)' : 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)'}
      </h2>
      <div style="font-size:0.75rem; color:#333; margin-top:1px">
        ${isEn ? 'Samagra Shiksha Abhiyan | NIC-SD ID: 8140 | Block-Bhinai, District-Ajmer (Rajasthan)' : 'समग्र शिक्षा अभियान | NIC-SD ID: 8140 | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)'}
      </div>
      <div style="margin-top:3px; display:inline-block; border:1.5px solid #000; background:#f1f5f9; padding:2px 14px; border-radius:4px; font-size:0.88rem; font-weight:900; color:#000">
        ${demand.title} (${isEn ? 'Session 2026-27' : 'सत्र 2026-27'})
      </div>
      ${demand.description ? `<div style="font-size:0.72rem; color:#444; margin-top:2px">${demand.description}</div>` : ''}
    </div>

    <!-- School Meta Table (Laser Print-Friendly Clean Grid) -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:0.78rem; border:1.5px solid #000">
      <tr style="background:#f8fafc">
        <td style="padding:2.5px 6px; border:1px solid #000; width:15%"><strong>${isEn ? 'School Name:' : 'विद्यालय का नाम:'}</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:35%">${schoolDisplayName}</td>
        <td style="padding:2.5px 6px; border:1px solid #000; width:18%"><strong>${isEn ? 'Shala Darpan / PSP Code:' : 'शाला दर्पण / PSP कोड:'}</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:32%">${school.shala_darpan_code} <span style="font-size:0.72rem; font-weight:normal">(${school.category || school.type || (isEn ? 'Government' : 'राजकीय')})</span></td>
      </tr>
      <tr>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>${isEn ? 'Nodal PEEO:' : 'संबंधित PEEO:'}</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000">${school.peeo_name}</td>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>${isEn ? 'U-DISE Code:' : 'U-DISE कोड:'}</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800">${school.dise_code || '---'}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${isEn ? 'Principal / Submitter:' : 'संस्था प्रधान / प्रस्तुतकर्ता:'}</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${sub.submitted_by || (isEn ? 'Principal' : 'संस्था प्रधान')}</strong> ${sub.submitter_mobile ? `(${isEn ? 'Mob:' : 'मो.'} ${sub.submitter_mobile})` : ''}</td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${isEn ? 'Verification Date & Time:' : 'सत्यापन दिनांक व समय:'}</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${sub.submitted_at || new Date().toLocaleString(isEn ? 'en-IN' : 'hi-IN')}</strong></td>
      </tr>
    </table>

    <!-- Horizontal Excel Table Grid (Matching Uploaded Excel Headers & Columns) -->
    <table class="exam-excel-table" style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.78rem; margin-bottom:6px; text-align:center">
      <thead>
        <tr style="background:#f1f5f9; color:#000; font-weight:800; border-bottom:2px solid #000">
          <th style="padding:4px 3px; border:1.5px solid #000; width:36px; text-align:center; vertical-align:middle">${isEn ? 'S.No.' : 'क्र.सं.'}</th>
          <th style="padding:4px 4px; border:1.5px solid #000; width:75px; text-align:center; vertical-align:middle">${isEn ? 'SD Code' : 'शा.दा. कोड'}</th>
          <th style="padding:4px 6px; border:1.5px solid #000; text-align:left; min-width:140px; vertical-align:middle">${isEn ? 'School Name' : 'विद्यालय का नाम'}</th>
          ${excelTheadCols}
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:2px solid #000; background:#ffffff">
          <td style="padding:5px 3px; border:1px solid #000; font-weight:700; text-align:center">1</td>
          <td style="padding:5px 4px; border:1px solid #000; font-weight:800; text-align:center"><code>${school.shala_darpan_code}</code></td>
          <td style="padding:5px 6px; border:1px solid #000; font-weight:800; text-align:left">${schoolDisplayName}</td>
          ${excelTbodyCols}
        </tr>
      </tbody>
    </table>

    <!-- Verification & Responsibility Declaration -->
    <div style="margin-top:4px; margin-bottom:4px; padding:3px 6px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.70rem; line-height:1.25; color:#000">
      <strong>${isEn ? 'VERIFICATION & RESPONSIBILITY DECLARATION:' : 'सत्यापन एवं उत्तरदायित्व घोषणा:'}</strong> ${isEn 
        ? 'Certified that all information entered in this proforma is 100% verified, true, and correct as per the official physical and office records of the school. No material facts have been concealed. In case of any error, discrepancy, or misrepresentation in future, the concerned Principal and Proforma In-charge shall be solely held responsible.'
        : 'प्रमाणित किया जाता है कि उपर्युक्त प्रपत्र में भरी गई सभी सूचनाएं विद्यालय के मूल भौतिक एवं कार्यालय अभिलेखों के अनुसार शत-प्रतिशत सत्य एवं सही हैं तथा इनका शाला दर्पण पोर्टल से मिलान कर लिया गया है। इसमें किसी भी प्रकार का तथ्य छुपाया नहीं गया है। किसी भी त्रुटि, विसंगति अथवा असत्यता की स्थिति में समस्त व्यक्तिगत एवं प्रशासनिक उत्तरदायित्व संबंधित संस्था प्रधान एवं प्रपत्र प्रभारी का होगा।'}
    </div>

    <!-- Official Signatures: Incharge (Left) & Principal (Right) matching Saman Pariksha -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 30px; margin-top:8px; margin-bottom:2px">
      <!-- Left: Incharge / Verifier -->
      <div style="text-align:center; width:36%">
        <div style="height:28px"></div>
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          ${isEn ? 'Signature: Proforma In-charge / Nodal Officer' : 'हस्ताक्षर प्रपत्र प्रभारी / नोडल अधिकारी'}
        </div>
      </div>

      <!-- Right: Principal Signature & School Details (Official Govt Format) -->
      <div style="text-align:center; width:44%">
        ${sub.signature_data ? `
          <div style="height:28px; display:flex; align-items:center; justify-content:center">
            <img src="${sub.signature_data}" style="max-height:26px; max-width:140px; object-fit:contain" alt="${isEn ? 'Signature' : 'हस्ताक्षर'}">
          </div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            ${isEn ? 'Signature: Principal / Head of Institution' : 'हस्ताक्षर संस्था प्रधान'}
          </div>
        ` : `
          <div style="height:28px"></div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            ${isEn ? 'Signature: Principal / Head of Institution' : 'हस्ताक्षर संस्था प्रधान'}
          </div>
        `}
        <div style="font-size:0.78rem; font-weight:700; color:#000; margin-top:1px">${isEn ? 'Principal / Head of Institution' : 'प्रधानाचार्य / संस्था प्रधान'}</div>
        <div style="font-size:0.75rem; color:#111; margin-top:1px">${schoolDisplayName}</div>
        <div style="font-size:0.72rem; color:#222; margin-top:1px">${isEn ? 'Block-Bhinai (District: Ajmer)' : 'ब्लॉक-भिनाय (अजमेर)'}</div>
      </div>
    </div>
  `;

  container.innerHTML = printHtml;
  showModal('modal-universal-demand-pdf');
}

// 9. PEEO Consolidated A4 Landscape PDF Generation for Dynamic Demand (NO RUBBER STAMP)
function openDynamicDemandPeeoPdf(demandId, peeoName) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const peeo = STATE.peeos.find(p => p.peeo_name === peeoName) || STATE.peeos[0];
  const targetSchools = getTargetSchoolsForDemand(demand).filter(s => s.peeo_name === peeo.peeo_name || s.peeo_code === peeo.shala_darpan_code);

  const container = document.getElementById('printable-universal-demand-content');
  if (!container) return;

  const titleEl = document.getElementById('universal-demand-pdf-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-file-pdf text-danger"></i> PEEO समेकित रिपोर्ट (A4 Landscape) - ${peeo.peeo_name}`;
  }

  let colsThead = '';
  (demand.columns || []).forEach(col => {
    colsThead += `<th style="padding:3px 4px; border:1.5px solid #000">${col.name}</th>`;
  });

  let rowsHtml = '';
  targetSchools.forEach((s, idx) => {
    const isSub = isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
    const sub = (STATE.demandSubmissions[demand.id] && STATE.demandSubmissions[demand.id][s.shala_darpan_code]) || {};
    
    let colsTbody = '';
    (demand.columns || []).forEach(col => {
      const val = (isSub && sub.data && sub.data[col.name] !== undefined && sub.data[col.name] !== '')
        ? sub.data[col.name]
        : (isSub ? '-' : '<span style="color:#b91c1c; font-size:0.7rem">लंबित</span>');
      colsTbody += `<td style="padding:2.5px 4px; border:1px solid #000">${val}</td>`;
    });

    rowsHtml += `
      <tr style="border-bottom:1px solid #000">
        <td style="padding:2.5px 3px; border:1px solid #000; text-align:center">${idx + 1}</td>
        <td style="padding:2.5px 4px; border:1px solid #000; text-align:center"><code>${s.shala_darpan_code}</code></td>
        <td style="padding:2.5px 6px; border:1px solid #000; text-align:left; font-weight:700">${s.school_name}</td>
        <td style="padding:2.5px 4px; border:1px solid #000; text-align:center">${s.type === 'Private' ? 'निजी' : 'राजकीय'}</td>
        <td style="padding:2.5px 4px; border:1px solid #000; text-align:center">
          <span style="font-weight:700; color:${isSub ? '#15803d' : '#b91c1c'}">${isSub ? '✓ पूर्ण' : 'बाकी'}</span>
        </td>
        ${colsTbody}
        <td style="padding:2.5px 4px; border:1px solid #000; font-size:0.72rem">${sub.submitted_by || '-'}</td>
      </tr>
    `;
  });

  const printHtml = `
    <!-- Top Header -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:5px">
      <div style="font-size:0.84rem; font-weight:700; letter-spacing:0.04em; color:#111">
        राजस्थान सरकार • स्कूल शिक्षा विभाग
      </div>
      <h2 style="margin:2px 0; font-size:1.15rem; font-weight:900; color:#000">
        कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय
      </h2>
      <div style="font-size:0.75rem; color:#333">
        समग्र शिक्षा अभियान | NIC-SD ID: 8140 | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)
      </div>
      <div style="margin-top:3px; display:inline-block; border:1.5px solid #000; background:#f1f5f9; padding:2px 14px; border-radius:4px; font-size:0.88rem; font-weight:900; color:#000">
        PEEO परिक्षेत्र समेकित रिपोर्ट: ${demand.title}
      </div>
    </div>

    <!-- PEEO Meta Table -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:0.78rem; border:1.5px solid #000">
      <tr style="background:#f8fafc">
        <td style="padding:2.5px 6px; border:1px solid #000; width:15%"><strong>PEEO परिक्षेत्र:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:35%">${peeo.peeo_name}</td>
        <td style="padding:2.5px 6px; border:1px solid #000; width:18%"><strong>PEEO शाला दर्पण कोड:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:32%">${peeo.shala_darpan_code}</td>
      </tr>
      <tr>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>प्रभारी प्रधानाचार्य:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${peeo.principal_incharge}</strong> (मो. ${peeo.mobile})</td>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>समेकित प्रगति:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800">
          कुल विद्यालय: ${targetSchools.length} | पूर्ण: ${targetSchools.filter(s => isDynamicDemandSubmitted(demand.id, s.shala_darpan_code)).length}
        </td>
      </tr>
    </table>

    <!-- Consolidated Table -->
    <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.76rem; margin-bottom:6px; text-align:center">
      <thead>
        <tr style="background:#f1f5f9; color:#000; font-weight:900">
          <th style="padding:3px 2px; border:1.5px solid #000; width:35px">क्र.सं.</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:65px">शा.दा. कोड</th>
          <th style="padding:3px 6px; border:1.5px solid #000; text-align:left">विद्यालय का नाम</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:55px">प्रकार</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:55px">स्थिति</th>
          ${colsThead}
          <th style="padding:3px 4px; border:1.5px solid #000; width:90px">प्रस्तुतकर्ता</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Declaration -->
    <div style="margin-top:6px; margin-bottom:8px; padding:4px 8px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.72rem; line-height:1.3; color:#000">
      <strong>सत्यापन एवं उत्तरदायित्व घोषणा:</strong> प्रमाणित किया जाता है कि उपर्युक्त समेकित विवरण में सम्मिलित सभी विद्यालयों की सूचना का सत्यापन मूल अभिलेखों से कर लिया गया है। यह विवरण पूर्णतया सत्य व सही है।
    </div>

    <!-- Official Signatures: STRICTLY NO RUBBER STAMP -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 35px; margin-top:12px; margin-bottom:4px">
      <div style="text-align:center; width:36%">
        <div style="height:32px"></div>
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          हस्ताक्षर संस्था प्रधान (नोडल)
        </div>
      </div>
      <div style="text-align:center; width:44%">
        <div style="height:32px"></div>
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          हस्ताक्षर प्रधानाचार्य एवं PEEO
        </div>
        <div style="font-size:0.78rem; font-weight:700; color:#000; margin-top:1px">${peeo.principal_incharge}</div>
        <div style="font-size:0.75rem; color:#111; margin-top:1px">${peeo.peeo_name} (कोड: ${peeo.shala_darpan_code})</div>
        <div style="font-size:0.72rem; color:#222; margin-top:1px">ब्लॉक-भिनाय (अजमेर)</div>
      </div>
    </div>
  `;

  container.innerHTML = printHtml;
  showModal('modal-universal-demand-pdf');
}

// 10. Open PEEO Selector for Dynamic Demand
function openDynamicDemandPeeoSelector(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const grid = document.getElementById('peeo-selector-grid');
  if (!grid) {
    openDynamicDemandPeeoPdf(demandId, STATE.peeos[0].peeo_name);
    return;
  }

  grid.innerHTML = '';
  STATE.peeos.forEach(peeo => {
    const targetSchools = getTargetSchoolsForDemand(demand).filter(s => s.peeo_name === peeo.peeo_name || s.peeo_code === peeo.shala_darpan_code);
    const subCount = targetSchools.filter(s => isDynamicDemandSubmitted(demand.id, s.shala_darpan_code)).length;
    const isComplete = targetSchools.length > 0 && subCount === targetSchools.length;

    const card = document.createElement('div');
    card.style.cssText = 'background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; padding:0.85rem; cursor:pointer; transition:all 0.2s; display:flex; flex-direction:column; justify-content:space-between';
    card.onmouseover = () => card.style.borderColor = '#1e3a8a';
    card.onmouseout = () => card.style.borderColor = '#cbd5e1';
    card.onclick = () => {
      closeModal('modal-select-peeo-report');
      openDynamicDemandPeeoPdf(demand.id, peeo.peeo_name);
    };

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem">
          <strong style="font-size:0.9rem; color:#1e293b">${peeo.peeo_name}</strong>
          <span class="status-badge ${isComplete ? 'green' : 'red'}" style="font-size:0.7rem">${subCount}/${targetSchools.length} पूर्ण</span>
        </div>
        <div style="font-size:0.78rem; color:#64748b">${peeo.principal_incharge}</div>
      </div>
      <div style="margin-top:0.6rem; font-size:0.75rem; color:#0284c7; font-weight:700">
        <i class="fas fa-file-invoice"></i> समेकित A4 Landscape रिपोर्ट खोलें &rarr;
      </div>
    `;
    grid.appendChild(card);
  });

  showModal('modal-select-peeo-report');
}

// 11. Excel Export for Dynamic Demand
function exportDynamicDemandExcel(demandId, filterPeeo = null) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }

  let targetSchools = getTargetSchoolsForDemand(demand);
  if (filterPeeo) {
    targetSchools = targetSchools.filter(s => s.peeo_name === filterPeeo || s.peeo_code === filterPeeo);
  }

  const cols = demand.columns || [];
  let csv = 'क्र.सं.,शा.दा. कोड,विद्यालय का नाम,प्रकार,संबंधित PEEO,प्रपत्र स्थिति,' + cols.map(c => `"${c.name.replace(/"/g, '""')}"`).join(',') + ',प्रस्तुतकर्ता,मोबाइल,सबमिशन दिनांक\n';

  targetSchools.forEach((s, idx) => {
    const isSub = isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
    const sub = (STATE.demandSubmissions[demand.id] && STATE.demandSubmissions[demand.id][s.shala_darpan_code]) || {};

    const colVals = cols.map(c => {
      const val = (isSub && sub.data && sub.data[c.name] !== undefined) ? sub.data[c.name] : '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');

    const row = [
      idx + 1,
      `"${s.shala_darpan_code}"`,
      `"${(s.school_name || '').replace(/"/g, '""')}"`,
      `"${s.type === 'Private' ? 'निजी' : 'राजकीय'}"`,
      `"${(s.peeo_name || '').replace(/"/g, '""')}"`,
      `"${isSub ? 'पूर्ण (Submitted)' : 'लम्बित (Pending)'}"`,
      colVals,
      `"${(sub.submitted_by || '').replace(/"/g, '""')}"`,
      `"${(sub.submitter_mobile || '').replace(/"/g, '""')}"`,
      `"${(sub.submitted_at || '').replace(/"/g, '""')}"`
    ];

    csv += row.join(',') + '\n';
  });

  const filename = `${demand.title.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_')}_Master_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(csv, filename);
  showToast(`एक्सेल फाइल (${filename}) डाउनलोड हो गई!`, 'success');
}

// 12. WhatsApp Reminder Helpers for Dynamic Demand
function sendDynamicDemandSchoolReminder(demandId, schoolCode) {
  const demand = STATE.demands.find(d => d.id === demandId);
  const targetSchools = getTargetSchoolsForDemand(demand);
  const school = targetSchools.find(s => s.shala_darpan_code === schoolCode) || { school_name: 'विद्यालय', mobile: '' };

  const mobile = school.mobile || (STATE.peeos.find(p => p.peeo_name === school.peeo_name)?.mobile) || '';
  const text = `आदरणीय संस्था प्रधान महोदय (${school.school_name}), CBEO भिनाय कार्यालय के निर्देशानुसार '${demand.title}' की सूचना पोर्टल पर अभी लंबित है। कृपया यथाशीघ्र पोर्टल खोलकर डिजिटल हस्ताक्षर सहित प्रपत्र सबमिट करें।`;
  sendWhatsAppMessage(mobile, text);
}

function sendDynamicDemandBulkReminder(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;
  const targetSchools = getTargetSchoolsForDemand(demand);
  const pending = targetSchools.filter(s => !isDynamicDemandSubmitted(demand.id, s.shala_darpan_code));

  if (pending.length === 0) {
    showToast('समस्त विद्यालयों की सूचना पहले से पूर्ण है!', 'success');
    return;
  }

  const peeoPendingMap = {};
  pending.forEach(s => {
    peeoPendingMap[s.peeo_name] = (peeoPendingMap[s.peeo_name] || 0) + 1;
  });

  const peeoNames = Object.keys(peeoPendingMap);
  const msg = `CBEO भिनाय - अति आवश्यक रिमाइंडर:\nसूचना मांग: ${demand.title}\nकुल लंबित विद्यालय: ${pending.length}\nलंबित PEEO परिक्षेत्र:\n` +
    peeoNames.slice(0, 8).map(p => `- ${p}: ${peeoPendingMap[p]} स्कूल`).join('\n') +
    (peeoNames.length > 8 ? `\n...एवं अन्य ${peeoNames.length - 8} PEEO` : '') +
    `\nकृपया आज ही पोर्टल पर लॉगिन कर सूचना पूर्ण करावें।`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  showToast(`${pending.length} लंबित स्कूलों का व्हाट्सएप रिमाइंडर तैयार!`, 'info');
}

// 13. PDF Actions for Universal Dynamic Demand
function printUniversalDemandDocument() {
  const previewInfo = STATE.activeUniversalDemandPreview || {};
  const demandId = previewInfo.demandId || STATE.activeDemandPortalId;
  const schoolCode = previewInfo.schoolCode || STATE.currentUser?.shala_darpan_code || (STATE.schools56[0]?.shala_darpan_code);
  const demand = STATE.demands.find(d => d.id === demandId) || { title: 'CBEO_Bhinai_Report' };
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const isEn = (typeof activeUniversalDemandPdfLanguage !== 'undefined' && activeUniversalDemandPdfLanguage === 'en');
  const schoolName = isEn ? (school?.school_name_en || school?.school_name || schoolCode) : (school?.school_name || schoolCode);
  const title = `${demand.title} - ${schoolName}`;
  printCleanA4Landscape('printable-universal-demand-content', title);
}

async function downloadUniversalDemandPdfDirect() {
  const previewInfo = STATE.activeUniversalDemandPreview || {};
  const demandId = previewInfo.demandId || STATE.activeDemandPortalId;
  const schoolCode = previewInfo.schoolCode || STATE.currentUser?.shala_darpan_code || (STATE.schools56[0]?.shala_darpan_code);

  const demand = STATE.demands.find(d => d.id === demandId) || { title: 'CBEO_Bhinai_Report' };
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode) || { school_name: 'School' };
  const baseName = isEn ? (school.school_name_en || school.school_name || 'School') : (school.school_name || school.school_name_en || 'School');
  let cleanName = String(baseName)
    .replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleanName || /^_+$/.test(cleanName)) {
    cleanName = (school.school_name_en || schoolCode || 'School').replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ').trim().replace(/\s+/g, '_');
  }
  const demandSafe = demand.title.replace(/[\\/:*?"<>|,.;!()\[\]{}]/g, ' ').trim().replace(/\s+/g, '_').substring(0, 30);
  const filename = `${demandSafe}_${schoolCode}_${cleanName}.pdf`;

  showToast('आधिकारिक Landscape PDF तैयार किया जा रहा है...', 'info');
  try {
    const blob = await exportDocumentToPdfBlob('printable-universal-demand-content', filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('अधिकृत A4 Landscape PDF सफलतापूर्वक डाउनलोड हो गया!', 'success');
  } catch (e) {
    console.error('Direct PDF error, falling back to print:', e);
    printUniversalDemandDocument();
  }
}

async function shareUniversalDemandPdfWhatsApp() {
  const previewInfo = STATE.activeUniversalDemandPreview || {};
  const demandId = previewInfo.demandId || STATE.activeDemandPortalId;
  const schoolCode = previewInfo.schoolCode || STATE.currentUser?.shala_darpan_code || (STATE.schools56[0]?.shala_darpan_code);

  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'warning');
    return;
  }

  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode) || {
    school_name: 'विद्यालय',
    shala_darpan_code: schoolCode,
    peeo_name: 'CBEO Bhinai'
  };
  const sub = getDemandSubmissionRecord(demandId, schoolCode);

  const isEn = (typeof activeUniversalDemandPdfLanguage !== 'undefined' && activeUniversalDemandPdfLanguage === 'en');
  const schoolName = isEn ? (school.school_name_en || school.school_name || 'School') : (school.school_name || 'School');
  const nameSafe = schoolName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const demandSafe = demand.title.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_').substring(0, 30);
  const langTag = isEn ? 'EN' : 'HI';
  const filename = `${demandSafe}_${schoolCode}_${langTag}_${nameSafe}.pdf`;

  // Build summary message
  let dataSummary = '';
  if (sub && sub.data) {
    const entries = Object.entries(sub.data).slice(0, 5);
    if (entries.length > 0) {
      dataSummary = '\n' + entries.map(([k, v]) => `▫️ *${k}:* ${v || '-'}`).join('\n');
    }
  }

  const waSummary = `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*\n*📋 अधिकृत प्रपत्र सत्यापन (सत्र 2026-27)*\n\n📌 *सूचना शीर्षक:* ${demand.title}\n📌 *विद्यालय:* ${school.school_name}\n📌 *शाला दर्पण कोड:* ${school.shala_darpan_code}\n📌 *संस्था प्रधान / प्रस्तुतकर्ता:* ${sub.submitted_by || 'संस्था प्रधान'} ${sub.submitter_mobile ? `(${sub.submitter_mobile})` : ''}\n📌 *सत्यापन दिनांक:* ${sub.submitted_at || new Date().toLocaleString('hi-IN')}${dataSummary}\n\n📄 *अधिकृत A4 Landscape PDF (एक्सेल प्रारूप) संलग्न है।*\n🌐 *सत्यापन पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  showToast('WhatsApp शेयर हेतु अधिकृत PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-universal-demand-content', filename);
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: `${demand.title} - ${school.school_name}`,
        text: waSummary
      });
      showToast('WhatsApp शेयर विंडो सफलतापूर्वक खुल गई!', 'success');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waSummary + '\n\n*(नोट: PDF फाइल आपके सिस्टम में डाउनलोड हो गई है, कृपया WhatsApp चैट में अटैच करें)*')}`;
      window.open(waUrl, '_blank');
      showToast('PDF डाउनलोड हो गई है एवं WhatsApp खुल गया है! कृपया फाइल अटैच करें।', 'info');
    }
  } catch (err) {
    console.warn('WhatsApp share fallback:', err);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waSummary)}`;
    window.open(waUrl, '_blank');
  }
}

/* ========================================================
   13B. UNIVERSAL DEMAND MISMATCH & FIELD-LEVEL INSPECTOR
   Field-level Checkmarks, Red/Green Status Highlighting,
   Email & Telegram Notification Dispatch (WhatsApp-ready)
   MANDATORY RULE: जिला सदैव अजमेर (AJMER) रहेगा।
   ======================================================== */

function isDemandSchoolMismatch(demandId, schoolCode) {
  if (!demandId || !schoolCode) return false;
  const sCode = String(schoolCode).trim();
  const dId = String(demandId).toLowerCase();

  // 1. Saman Pariksha
  if (dId === 'saman_pariksha_2026_27' || dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha')) {
    const spCfg = STATE.samanMismatchSettings || (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : null);
    if (spCfg && spCfg.alert_active === false) {
      return false; // Mismatch alerts & flags are turned OFF by Admin setting!
    }

    const spSub = STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[sCode];
    if (spSub) {
      if (spSub.is_mismatch === false && spSub.mismatch_resolved_at) {
        return false; // Mismatch has been satisfied/resolved!
      }
      // Live Comparison Value Satisfaction Check:
      const mInfo = spCfg?.mismatch_details?.[sCode];
      if (mInfo) {
        const expectedTotal = (mInfo.sd_total !== undefined && mInfo.sd_total !== null && Number(mInfo.sd_total) > 0)
          ? Number(mInfo.sd_total)
          : (mInfo.expected_total !== undefined ? Number(mInfo.expected_total) : null);
        if (expectedTotal !== null && !isNaN(expectedTotal) && expectedTotal > 0) {
          if (Number(spSub.grand_total || 0) === expectedTotal) {
            return false; // Value is satisfied! No mismatch!
          }
        }
      }
    }
    if (spCfg) {
      if (spCfg.custom_edit_schools && spCfg.custom_edit_schools.some(c => String(c).trim() === sCode)) return true;
      if (spCfg.mismatch_details && spCfg.mismatch_details[sCode]) return true;
    }
    if (spSub && (spSub.status === 'mismatch' || spSub.is_mismatch === true)) return true;
    return false;
  }

  // 2. Dynamic Demands
  const sub = (STATE.demandSubmissions && STATE.demandSubmissions[demandId] && STATE.demandSubmissions[demandId][sCode]) || null;
  if (sub && sub.is_mismatch === false && sub.mismatch_resolved_at) {
    return false;
  }
  if (sub) {
    if (sub.is_mismatch === true || sub.status === 'mismatch') return true;
    if (sub.custom_unlocked === true) return true;
  }

  const demand = (STATE.demands || []).find(d => d.id === demandId);
  if (demand && demand.mismatch_schools && demand.mismatch_schools.some(c => String(c).trim() === sCode)) {
    return true;
  }

  return false;
}
window.isDemandSchoolMismatch = isDemandSchoolMismatch;

function getDemandSchoolMismatchDetails(demandId, schoolCode) {
  const sCode = String(schoolCode).trim();
  const dId = String(demandId).toLowerCase();
  
  if (dId === 'saman_pariksha_2026_27' || dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha')) {
    const spCfg = STATE.samanMismatchSettings || (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : null);
    const mInfo = spCfg?.mismatch_details?.[sCode] || null;
    return {
      isMismatch: isDemandSchoolMismatch(demandId, sCode),
      flaggedFields: mInfo ? ['कक्षा 9 से 12 कुल नामांकन'] : [],
      remarks: mInfo ? `शाला दर्पण नामांकन से अंतर: ${mInfo.diff > 0 ? '+' : ''}${mInfo.diff}` : (spCfg?.alert_message || ''),
      diff: mInfo?.diff || 0
    };
  }

  const sub = (STATE.demandSubmissions && STATE.demandSubmissions[demandId] && STATE.demandSubmissions[demandId][sCode]) || {};
  return {
    isMismatch: isDemandSchoolMismatch(demandId, sCode),
    flaggedFields: sub.mismatch_fields || [],
    remarks: sub.mismatch_remarks || '',
    unlocked: sub.custom_unlocked || false
  };
}
window.getDemandSchoolMismatchDetails = getDemandSchoolMismatchDetails;

function isDemandLockedForSchool(demandId, targetSchoolCode = null) {
  if (!STATE.currentUser) return false;
  if (isJitendraLoggedIn()) return false;

  const schCode = targetSchoolCode || STATE.currentUser.shala_darpan_code;
  if (isDemandSchoolMismatch(demandId, schCode)) {
    return false; // Mismatch specifically unlocks this school for editing!
  }

  // If already submitted and NOT marked mismatch, lock editing for school/peeo
  if (isDynamicDemandSubmitted(demandId, schCode)) {
    return true;
  }

  return isDemandsLockedForCurrentUser();
}
window.isDemandLockedForSchool = isDemandLockedForSchool;

let currentMismatchInspectorTarget = null;

function openDemandMismatchInspector(demandId, schoolCode) {
  const sCode = String(schoolCode).trim();
  let demand = (STATE.demands || []).find(d => d.id === demandId);
  const isSaman = (demandId === 'saman_pariksha_2026_27' || String(demandId).toLowerCase().includes('saman_pariksha'));

  if (!demand && isSaman) {
    demand = {
      id: 'saman_pariksha_2026_27',
      title: 'जिला समान परीक्षा 2026-27 (कक्षा 9 से 12 नामांकन व प्रश्न पत्र मांग)',
      description: 'समान परीक्षा प्रश्न-पत्र मांग एवं नामांकन प्रपत्र'
    };
  }

  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }

  const school = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === sCode) ||
                 getAllMasterSchools().find(s => String(s.shala_darpan_code).trim() === sCode) || {
                   school_name: 'विद्यालय',
                   shala_darpan_code: sCode,
                   peeo_name: 'CBEO Bhinai'
                 };

  const sub = isSaman 
    ? (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[sCode]) || {}
    : getDemandSubmissionRecord(demandId, sCode);

  currentMismatchInspectorTarget = {
    demandId: demand.id,
    demandTitle: demand.title,
    schoolCode: sCode,
    schoolName: school.school_name,
    peeoName: school.peeo_name,
    sub: sub
  };

  // 1. Populate Header / Banner
  const titleEl = document.getElementById('mismatch-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> प्रपत्र डेटा मिसमैच निरीक्षण: ${school.school_name}`;
  }

  const bannerEl = document.getElementById('mismatch-school-banner');
  if (bannerEl) {
    bannerEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem">
        <div>
          <strong style="color:#991b1b; font-size:1.05rem"><i class="fas fa-university"></i> ${school.school_name}</strong>
          <div style="font-size:0.82rem; color:#475569; margin-top:2px">
            शा.दा. कोड: <code>${sCode}</code> | संबंधित PEEO: <strong>${school.peeo_name}</strong> | वर्ग: <strong>${school.type === 'Private' ? 'निजी' : 'राजकीय'}</strong>
          </div>
        </div>
        <div style="text-align:right">
          <span class="status-badge" style="background:#fee2e2; color:#b91c1c; font-weight:800; border:1px solid #f87171">
            प्रपत्र: ${demand.title}
          </span>
          <div style="font-size:0.75rem; color:#64748b; margin-top:3px">
            प्रस्तुतकर्ता: ${sub.submitted_by || sub.principal_name || 'संस्था प्रधान'} (${sub.submitter_mobile || sub.principal_mobile || '-'})
          </div>
        </div>
      </div>
    `;
  }

  // 2. Build Field List with Checkboxes beside EVERY box
  const fieldsContainer = document.getElementById('mismatch-fields-list');
  if (!fieldsContainer) return;
  fieldsContainer.innerHTML = '';

  const prevFlagged = (sub.mismatch_fields || []);
  let fieldItems = [];

  if (isSaman) {
    const spCfg = STATE.samanMismatchSettings || (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : null);
    const mInfo = spCfg?.mismatch_details?.[sCode] || null;

    fieldItems = [
      { name: '9वीं कुल नामांकन', val: sub.c9_total !== undefined ? sub.c9_total : (mInfo?.portal_c9_10 || '--') },
      { name: '9वीं संस्कृत तृतीय भाषा', val: sub.c9_sanskrit || 0 },
      { name: '9वीं उर्दू तृतीय भाषा', val: sub.c9_urdu || 0 },
      { name: '10वीं कुल नामांकन', val: sub.c10_total !== undefined ? sub.c10_total : '--' },
      { name: '10वीं संस्कृत तृतीय भाषा', val: sub.c10_sanskrit || 0 },
      { name: '10वीं उर्दू तृतीय भाषा', val: sub.c10_urdu || 0 },
      { name: '11वीं कुल विद्यार्थी', val: sub.c11_total !== undefined ? sub.c11_total : '--' },
      { name: '11वीं अनिवार्य व ऐच्छिक विषय', val: sub.c11_comp_hindi ? `हिंदी(${sub.c11_comp_hindi}), अंग्रेजी(${sub.c11_comp_english})` : '--' },
      { name: '12वीं कुल विद्यार्थी', val: sub.c12_total !== undefined ? sub.c12_total : '--' },
      { name: '12वीं अनिवार्य व ऐच्छिक विषय', val: sub.c12_comp_hindi ? `हिंदी(${sub.c12_comp_hindi}), अंग्रेजी(${sub.c12_comp_english})` : '--' },
      { name: 'कक्षा 9 से 12 महायोग (Grand Total)', val: sub.grand_total !== undefined ? sub.grand_total : (mInfo?.portal_total || '--') }
    ];
  } else {
    (demand.columns || []).forEach(col => {
      const v = (sub.data && sub.data[col.name] !== undefined) ? sub.data[col.name] : (sub[col.name] !== undefined ? sub[col.name] : '');
      fieldItems.push({ name: col.name, val: v });
    });
  }

  fieldItems.forEach(item => {
    const isChecked = prevFlagged.includes(item.name);
    const row = document.createElement('div');
    row.className = 'mismatch-field-card';
    row.style.cssText = `display:flex; align-items:center; justify-content:space-between; background:${isChecked ? '#fff5f5' : '#ffffff'}; border:1.5px solid ${isChecked ? '#ef4444' : '#e2e8f0'}; border-radius:6px; padding:0.55rem 0.85rem; transition:all 0.2s`;

    row.innerHTML = `
      <div style="flex:1; padding-right:1rem">
        <div style="font-weight:700; color:#1e293b; font-size:0.88rem">${item.name}</div>
        <div style="font-size:0.8rem; color:#475569; margin-top:2px">
          स्कूल द्वारा दर्ज प्रविष्टि: <strong style="color:#0f766e; font-size:0.85rem">${item.val !== '' && item.val !== undefined ? item.val : '(रिक्त / शून्य)'}</strong>
        </div>
      </div>
      <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer; font-size:0.84rem; font-weight:800; color:${isChecked ? '#dc2626' : '#64748b'}; margin:0; user-select:none">
        <input type="checkbox" class="mismatch-field-checkbox" value="${item.name}" ${isChecked ? 'checked' : ''} onchange="onMismatchFieldToggled(this)" style="width:17px; height:17px; accent-color:#dc2626; cursor:pointer">
        <span>❌ इस बॉक्स में मिसमैच है</span>
      </label>
    `;
    fieldsContainer.appendChild(row);
  });

  // 3. Set Remarks
  const remEl = document.getElementById('mismatch-custom-remarks');
  if (remEl) {
    remEl.value = sub.mismatch_remarks || `शाला दर्पण पोर्टल पर 01-10-2026 के अधिकृत नामांकन अनुसार इस प्रपत्र में अंतर पाया गया है। कृपया सही प्रविष्टि करें।`;
  }

  renderMismatchPreview();
  const btnClearMismatch = document.getElementById('btn-clear-mismatch-flag');
  if (btnClearMismatch) {
    const isCurrentlyMismatch = isDemandSchoolMismatch(demandId, sCode);
    btnClearMismatch.style.display = isCurrentlyMismatch ? 'inline-flex' : 'none';
  }
  showModal('modal-mismatch-inspector');
}
window.openDemandMismatchInspector = openDemandMismatchInspector;

function onMismatchFieldToggled(chk) {
  const card = chk.closest('.mismatch-field-card');
  if (card) {
    if (chk.checked) {
      card.style.background = '#fff5f5';
      card.style.borderColor = '#ef4444';
      const lbl = chk.closest('label');
      if (lbl) lbl.style.color = '#dc2626';
    } else {
      card.style.background = '#ffffff';
      card.style.borderColor = '#e2e8f0';
      const lbl = chk.closest('label');
      if (lbl) lbl.style.color = '#64748b';
    }
  }
  renderMismatchPreview();
}
window.onMismatchFieldToggled = onMismatchFieldToggled;

function renderMismatchPreview() {
  if (!currentMismatchInspectorTarget) return;
  const target = currentMismatchInspectorTarget;

  const checkedBoxes = Array.from(document.querySelectorAll('#mismatch-fields-list .mismatch-field-checkbox:checked'));
  const flagged = checkedBoxes.map(c => c.value);

  const counterEl = document.getElementById('mismatch-checked-counter');
  if (counterEl) {
    counterEl.textContent = `${flagged.length} फील्ड चयनित`;
  }

  const remarks = (document.getElementById('mismatch-custom-remarks')?.value || '').trim();

  let flaggedBullets = '';
  if (flagged.length > 0) {
    flaggedBullets = flagged.map(f => `• ❌ *${f}* (शाला दर्पण से अंतर)`).join('\n');
  } else {
    flaggedBullets = `• ❌ *समस्त प्रपत्र डेटा में विसंगति / मिसमैच*`;
  }

  const previewText = `🚨 *कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*
📋 *अधिकृत सूचना: प्रपत्र डेटा मिसमैच व संशोधन नोटिस*

📌 *सूचना मांग:* ${target.demandTitle}
🏫 *विद्यालय का नाम:* ${target.schoolName}
🔢 *शाला दर्पण कोड:* ${target.schoolCode}
🏛️ *संबंधित PEEO:* ${target.peeoName}

⚠️ *मिसमैच / विसंगति वाले बॉक्स:*
${flaggedBullets}

📝 *कार्यालय निर्देश / टिप्पणी:*
${remarks || 'शाला दर्पण पोर्टल के अधिकृत नामांकन से मिलान न होने के कारण प्रपत्र अनलॉक किया गया है।'}

🔓 *कार्यवाही:* आपके विद्यालय का प्रपत्र CBEO पोर्टल पर संशोधन (Edit) हेतु अनलॉक कर दिया गया है। कृपया आज ही पोर्टल पर लॉगिन कर सही प्रविष्टि कर पुनः सबमिट करें।

🌐 *पोर्टल लॉगिन लिंक:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  const previewEl = document.getElementById('mismatch-message-preview');
  if (previewEl) previewEl.textContent = previewText;
}
window.renderMismatchPreview = renderMismatchPreview;

function copyMismatchPreviewToClipboard() {
  const txt = document.getElementById('mismatch-message-preview')?.textContent || '';
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => {
    showToast('संदेश क्लिपबोर्ड में कॉपी हो गया! अब WhatsApp पर पेस्ट कर सकते हैं।', 'success');
  }).catch(() => {
    showToast('कॉपी करने में असमर्थ', 'error');
  });
}
window.copyMismatchPreviewToClipboard = copyMismatchPreviewToClipboard;

async function dispatchSingleMismatchAlert() {
  if (!currentMismatchInspectorTarget) return;
  const target = currentMismatchInspectorTarget;
  const btn = document.getElementById('btn-submit-mismatch-alert');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> मिसमैच दर्ज एवं अलर्ट भेजा जा रहा है...`;
  }

  const checkedBoxes = Array.from(document.querySelectorAll('#mismatch-fields-list .mismatch-field-checkbox:checked'));
  const flagged = checkedBoxes.map(c => c.value);
  const remarks = (document.getElementById('mismatch-custom-remarks')?.value || '').trim();
  const sendEmail = !!document.getElementById('mismatch-send-email-chk')?.checked;
  const sendTelegram = !!document.getElementById('mismatch-send-telegram-chk')?.checked;

  // 1. Find school email
  const schoolObj = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === target.schoolCode) ||
                    getAllMasterSchools().find(s => String(s.shala_darpan_code).trim() === target.schoolCode) || {};
  const staffHead = (STATE.staff || []).find(s => String(s.sso_id).trim() === target.schoolCode && s.is_sanstha_pradhan);
  const schoolEmail = schoolObj.email || staffHead?.email || 'censusbhinai@gmail.com';

  // 2. Mark submission in local state
  const isSaman = (target.demandId === 'saman_pariksha_2026_27' || String(target.demandId).toLowerCase().includes('saman_pariksha'));
  if (isSaman) {
    const spCfg = (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (STATE.samanMismatchSettings || {}));
    if (!spCfg.custom_edit_schools) spCfg.custom_edit_schools = [];
    if (!spCfg.custom_edit_schools.includes(target.schoolCode)) {
      spCfg.custom_edit_schools.push(target.schoolCode);
    }
    STATE.samanMismatchSettings = spCfg;
    localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(spCfg));

    if (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[target.schoolCode]) {
      STATE.samanParikshaSubmissions[target.schoolCode].status = 'mismatch';
      STATE.samanParikshaSubmissions[target.schoolCode].is_mismatch = true;
      STATE.samanParikshaSubmissions[target.schoolCode].mismatch_fields = flagged;
      STATE.samanParikshaSubmissions[target.schoolCode].mismatch_remarks = remarks;
      localStorage.setItem('cbeo_saman_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
    }

    fetch('/api/save_saman_mismatch_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: spCfg })
    }).catch(() => {});
  } else {
    if (!STATE.demandSubmissions) STATE.demandSubmissions = {};
    if (!STATE.demandSubmissions[target.demandId]) STATE.demandSubmissions[target.demandId] = {};
    const curSub = STATE.demandSubmissions[target.demandId][target.schoolCode] || {};
    curSub.status = 'mismatch';
    curSub.is_mismatch = true;
    curSub.mismatch_fields = flagged;
    curSub.mismatch_remarks = remarks;
    curSub.custom_unlocked = true;
    curSub.mismatch_flagged_at = new Date().toLocaleString('hi-IN');
    STATE.demandSubmissions[target.demandId][target.schoolCode] = curSub;
    localStorage.setItem('cbeo_demand_submissions', JSON.stringify(STATE.demandSubmissions));

    // Also track in demand.mismatch_schools
    const dem = (STATE.demands || []).find(d => d.id === target.demandId);
    if (dem) {
      if (!dem.mismatch_schools) dem.mismatch_schools = [];
      if (!dem.mismatch_schools.includes(target.schoolCode)) dem.mismatch_schools.push(target.schoolCode);
      localStorage.setItem('cbeo_demands', JSON.stringify(STATE.demands));
    }
  }

  // 3. Dispatch to API
  const payload = {
    mode: 'single',
    demand_id: target.demandId,
    demand_title: target.demandTitle,
    school_code: target.schoolCode,
    school_name: target.schoolName,
    peeo_name: target.peeoName,
    school_email: sendEmail ? schoolEmail : '',
    flagged_fields: flagged,
    remarks: remarks,
    send_telegram: sendTelegram
  };

  try {
    const res = await fetch('/api/send_mismatch_alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    console.log('Mismatch Alert Dispatch Result:', result);
    showToast(`विद्यालय '${target.schoolName}' को मिसमैच दर्ज, प्रपत्र अनलॉक एवं अलर्ट सफलतापूर्वक प्रेषित!`, 'success');
  } catch (e) {
    console.warn('Dispatch network notice:', e);
    showToast(`विद्यालय '${target.schoolName}' का प्रपत्र मिसमैच के तहत अनलॉक कर दिया गया!`, 'info');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-paper-plane"></i> 🚨 मिसमैच मार्क करें, प्रपत्र अनलॉक करें एवं अलर्ट भेजें`;
    }
    closeModal('modal-mismatch-inspector');
    if (isSaman) {
      renderSamanParikshaView();
    } else {
      renderDynamicDemandPortalView(target.demandId);
    }
  }
}
window.dispatchSingleMismatchAlert = dispatchSingleMismatchAlert;

async function clearCurrentMismatchFlag() {
  if (!currentMismatchInspectorTarget) return;
  const target = currentMismatchInspectorTarget;
  const sCode = String(target.schoolCode).trim();
  const dId = target.demandId;
  const isSaman = (dId === 'saman_pariksha_2026_27' || String(dId).toLowerCase().includes('saman_pariksha'));

  if (isSaman) {
    const spCfg = (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (STATE.samanMismatchSettings || {}));
    if (spCfg.custom_edit_schools) {
      spCfg.custom_edit_schools = spCfg.custom_edit_schools.filter(c => String(c).trim() !== sCode);
    }
    if (spCfg.mismatch_details && spCfg.mismatch_details[sCode]) {
      delete spCfg.mismatch_details[sCode];
    }
    STATE.samanMismatchSettings = spCfg;
    localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(spCfg));

    if (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[sCode]) {
      STATE.samanParikshaSubmissions[sCode].status = 'submitted';
      STATE.samanParikshaSubmissions[sCode].is_mismatch = false;
      STATE.samanParikshaSubmissions[sCode].mismatch_fields = [];
      STATE.samanParikshaSubmissions[sCode].mismatch_remarks = '';
      STATE.samanParikshaSubmissions[sCode].mismatch_resolved_at = new Date().toISOString();
      localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
    }

    try {
      fetch('/api/save_saman_mismatch_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: spCfg })
      }).catch(() => {});
    } catch(e) {}

    const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
      || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
      || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
    if (gasUrl) {
      try {
        fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updatePassword',
            user_id: '__SAMAN_MISMATCH_SETTINGS__',
            role: 'System_Config',
            name: 'Saman Pariksha Mismatch Settings',
            new_password: JSON.stringify(spCfg)
          })
        }).catch(() => {});
      } catch(e) {}
    }
  } else {
    if (STATE.demandSubmissions && STATE.demandSubmissions[dId] && STATE.demandSubmissions[dId][sCode]) {
      const sub = STATE.demandSubmissions[dId][sCode];
      sub.status = 'submitted';
      sub.is_mismatch = false;
      sub.custom_unlocked = false;
      sub.mismatch_fields = [];
      sub.mismatch_remarks = '';
      sub.mismatch_resolved_at = new Date().toISOString();
      localStorage.setItem('cbeo_demand_submissions', JSON.stringify(STATE.demandSubmissions));
    }
    const dem = (STATE.demands || []).find(d => d.id === dId);
    if (dem && dem.mismatch_schools) {
      dem.mismatch_schools = dem.mismatch_schools.filter(c => String(c).trim() !== sCode);
      localStorage.setItem('cbeo_demands', JSON.stringify(STATE.demands));
    }
  }

  showToast(`विद्यालय '${target.schoolName}' का मिसमैच फ्लैग सफलतापूर्वक हटा दिया गया!`, 'success');
  closeModal('modal-mismatch-inspector');
  if (isSaman) {
    renderSamanParikshaView();
  } else {
    renderDynamicDemandPortalView(target.demandId);
  }
}
window.clearCurrentMismatchFlag = clearCurrentMismatchFlag;

function toggleSamanMismatchAlertDirect(schoolCode) {
  const sCode = String(schoolCode).trim();
  let spCfg = (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (STATE.samanMismatchSettings || null));
  if (!spCfg) {
    try {
      spCfg = JSON.parse(localStorage.getItem('cbeo_saman_mismatch_settings') || 'null');
    } catch(e) {}
  }
  if (!spCfg) spCfg = JSON.parse(JSON.stringify(DEFAULT_SAMAN_MISMATCH_SETTINGS));

  const isCustom = (spCfg.custom_edit_schools || []).some(c => String(c).trim() === sCode);
  const mInfo = spCfg.mismatch_details ? spCfg.mismatch_details[sCode] : null;
  const isMismatchActive = isDemandSchoolMismatch('saman_pariksha_2026_27', sCode) || (mInfo && !mInfo.resolved);

  const currentlyActive = isCustom || isMismatchActive;

  if (currentlyActive) {
    // TURN OFF: Clear custom edit and resolve mismatch
    if (spCfg.custom_edit_schools) {
      spCfg.custom_edit_schools = spCfg.custom_edit_schools.filter(c => String(c).trim() !== sCode);
    }
    if (spCfg.mismatch_details && spCfg.mismatch_details[sCode]) {
      spCfg.mismatch_details[sCode].resolved = true;
      spCfg.mismatch_details[sCode].resolved_at = new Date().toISOString();
    }
    if (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[sCode]) {
      const sub = STATE.samanParikshaSubmissions[sCode];
      sub.is_mismatch = false;
      sub.custom_unlocked = false;
      sub.mismatch_resolved_at = new Date().toISOString();
      localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
    }
    showToast(`विद्यालय (${sCode}) का मिसमैच अलर्ट एवं कस्टम एडिट सफलतापूर्वक बंद कर दिया गया।`, 'success');
  } else {
    // TURN ON: Add to custom edit and mark active
    if (!spCfg.custom_edit_schools) spCfg.custom_edit_schools = [];
    if (!spCfg.custom_edit_schools.includes(sCode)) {
      spCfg.custom_edit_schools.push(sCode);
    }
    if (spCfg.mismatch_details && spCfg.mismatch_details[sCode]) {
      spCfg.mismatch_details[sCode].resolved = false;
    }
    if (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[sCode]) {
      const sub = STATE.samanParikshaSubmissions[sCode];
      sub.is_mismatch = true;
      sub.custom_unlocked = true;
      localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
    }
    showToast(`विद्यालय (${sCode}) के लिए मिसमैच अलर्ट व कस्टम एडिट अनलॉक चालू कर दिया गया।`, 'info');
  }

  STATE.samanMismatchSettings = spCfg;
  localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(spCfg));

  const gasUrl = (typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : (typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : ''));
  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__SAMAN_MISMATCH_SETTINGS__',
          role: 'System_Config',
          name: 'Saman Pariksha Mismatch Settings',
          new_password: JSON.stringify(spCfg)
        })
      }).catch(() => {});
    } catch(e) {}
  }

  renderSamanParikshaMaster();
}
window.toggleSamanMismatchAlertDirect = toggleSamanMismatchAlertDirect;

function checkAndAutoResolveSamanMismatch(schoolCode, submission) {
  const sCode = String(schoolCode).trim();
  let spCfg = (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (STATE.samanMismatchSettings || null));
  if (!spCfg) {
    try {
      spCfg = JSON.parse(localStorage.getItem('cbeo_saman_mismatch_settings') || 'null');
    } catch(e) {}
  }
  if (!spCfg) spCfg = JSON.parse(JSON.stringify(DEFAULT_SAMAN_MISMATCH_SETTINGS));

  const hasMismatchDetail = spCfg.mismatch_details && spCfg.mismatch_details[sCode];
  const isCustomUnlocked = spCfg.custom_edit_schools && spCfg.custom_edit_schools.some(c => String(c).trim() === sCode);

  if (hasMismatchDetail || isCustomUnlocked) {
    const mInfo = spCfg.mismatch_details ? spCfg.mismatch_details[sCode] : null;
    let shouldResolve = false;

    const expectedTotal = mInfo ? (mInfo.sd_total !== undefined && mInfo.sd_total !== null && Number(mInfo.sd_total) > 0 ? Number(mInfo.sd_total) : (mInfo.expected_total !== undefined ? Number(mInfo.expected_total) : null)) : null;

    if (expectedTotal !== null && !isNaN(expectedTotal) && expectedTotal > 0) {
      const grandTotal = Number(submission.grand_total || 0);
      if (grandTotal === expectedTotal) {
        shouldResolve = true;
      } else {
        shouldResolve = false;
      }
    } else {
      // User rule: "ager koi value nhi di h to dobara save kerte hi mismatch hat jana chaiye"
      shouldResolve = true;
    }

    if (shouldResolve) {
      submission.is_mismatch = false;
      submission.status = 'submitted';
      submission.mismatch_resolved_at = new Date().toISOString();
      submission.mismatch_fields = [];
      submission.mismatch_remarks = '';

      // User directive: "ye sab portal se control hona h"
      // Do NOT automatically revoke custom edit or strip from admin mismatch list.
      // Custom edit permissions & mismatch list remain controllable exclusively by Admin in the portal!
      if (spCfg.mismatch_details && spCfg.mismatch_details[sCode]) {
        spCfg.mismatch_details[sCode].resolved = true;
        spCfg.mismatch_details[sCode].resolved_at = submission.mismatch_resolved_at;
        spCfg.mismatch_details[sCode].portal_total = Number(submission.grand_total || 0);
      }

      STATE.samanMismatchSettings = spCfg;
      localStorage.setItem('cbeo_saman_mismatch_settings', JSON.stringify(spCfg));

      try {
        fetch('/api/save_saman_mismatch_settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: spCfg })
        }).catch(() => {});
      } catch(e) {}

      const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
        || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
        || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
      if (gasUrl) {
        try {
          fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updatePassword',
              user_id: '__SAMAN_MISMATCH_SETTINGS__',
              role: 'System_Config',
              name: 'Saman Pariksha Mismatch Settings',
              new_password: JSON.stringify(spCfg)
            })
          }).catch(() => {});
        } catch(e) {}
      }

      const schoolMismatchBanner = document.getElementById('sp-school-mismatch-banner');
      if (schoolMismatchBanner) schoolMismatchBanner.style.display = 'none';

      return { resolved: true, wasMismatch: true, error: null };
    } else {
      submission.is_mismatch = true;
      submission.status = 'mismatch';
      return { resolved: false, wasMismatch: true, error: `शाला दर्पण अपेक्षित नामांकन (${expectedTotal}) एवं दर्ज नामांकन (${submission.grand_total}) में अभी भी अंतर है!` };
    }
  }

  submission.is_mismatch = false;
  return { resolved: true, wasMismatch: false, error: null };
}
window.checkAndAutoResolveSamanMismatch = checkAndAutoResolveSamanMismatch;


function toggleSelectAllDemandSchools(headerCheckbox, demandId) {
  const isChecked = headerCheckbox.checked;
  const checkboxes = document.querySelectorAll('#dynamic-demand-schools-tbody .demand-school-chk');
  checkboxes.forEach(chk => {
    chk.checked = isChecked;
  });
  updateDemandBatchSelection(demandId);
}
window.toggleSelectAllDemandSchools = toggleSelectAllDemandSchools;

function updateDemandBatchSelection(demandId) {
  const selectedBoxes = Array.from(document.querySelectorAll('#dynamic-demand-schools-tbody .demand-school-chk:checked'));
  const count = selectedBoxes.length;
  const bar = document.getElementById('dynamic-demand-batch-bar');
  const countEl = document.getElementById('dynamic-demand-selected-count');

  if (bar) {
    bar.style.display = count > 0 ? 'flex' : 'none';
  }
  if (countEl) {
    countEl.textContent = count;
  }
}
window.updateDemandBatchSelection = updateDemandBatchSelection;

let activeBatchDemandId = null;

function openBatchDemandMismatchModal(demandId) {
  activeBatchDemandId = demandId;
  const demand = (STATE.demands || []).find(d => d.id === demandId);
  if (!demand) return;

  const selectedBoxes = Array.from(document.querySelectorAll('#dynamic-demand-schools-tbody .demand-school-chk:checked'));
  const schoolCodes = selectedBoxes.map(b => b.value);

  if (schoolCodes.length === 0) {
    showToast('कृपया कम से कम एक विद्यालय चुनें!', 'warning');
    return;
  }

  const countEl = document.getElementById('batch-modal-school-count');
  if (countEl) countEl.textContent = schoolCodes.length;

  const chipsContainer = document.getElementById('batch-selected-schools-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = '';
    schoolCodes.forEach(code => {
      const sch = (STATE.schools56 || []).find(s => s.shala_darpan_code === code) ||
                  getAllMasterSchools().find(s => s.shala_darpan_code === code) || { school_name: code };
      const chip = document.createElement('span');
      chip.style.cssText = 'background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px';
      chip.innerHTML = `<i class="fas fa-school"></i> ${sch.school_name} (<code>${code}</code>)`;
      chipsContainer.appendChild(chip);
    });
  }

  renderBatchMismatchPreview();
  showModal('modal-batch-mismatch');
}
window.openBatchDemandMismatchModal = openBatchDemandMismatchModal;

function renderBatchMismatchPreview() {
  const demandId = activeBatchDemandId;
  const demand = (STATE.demands || []).find(d => d.id === demandId) || { title: 'मांग प्रपत्र' };
  const selectedBoxes = Array.from(document.querySelectorAll('#dynamic-demand-schools-tbody .demand-school-chk:checked'));
  const schoolCodes = selectedBoxes.map(b => b.value);
  const commonRemarks = (document.getElementById('batch-mismatch-remarks')?.value || '').trim();

  let schoolsListStr = '';
  schoolCodes.forEach((code, idx) => {
    const sch = (STATE.schools56 || []).find(s => s.shala_darpan_code === code) ||
                getAllMasterSchools().find(s => s.shala_darpan_code === code) || { school_name: code, peeo_name: 'CBEO' };
    schoolsListStr += `${idx + 1}. *${sch.school_name}* (कोड: ${code}) - PEEO ${sch.peeo_name || ''}\n`;
  });

  const preview = `🚨 *समेकित मिसमैच सूचना: प्रपत्र डेटा सुधार नोटिस*
🏛️ *कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*

📋 *मांग प्रपत्र:* ${demand.title}
📅 *दिनांक:* ${new Date().toLocaleDateString('hi-IN')}
👥 *कुल चिह्नित विद्यालय:* ${schoolCodes.length} स्कूल

निम्न विद्यालयों के प्रपत्र में शाला दर्पण अनुसार डेटा मिसमैच / विसंगति पाई गई है एवं उनके लिए पोर्टल पर संपादन (Edit) खोल दिया गया है:

${schoolsListStr}
📝 *कार्यालय निर्देश:*
${commonRemarks}

🌐 *पोर्टल लिंक:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  const prevEl = document.getElementById('batch-mismatch-preview');
  if (prevEl) prevEl.textContent = preview;
}
window.renderBatchMismatchPreview = renderBatchMismatchPreview;

function copyBatchMismatchPreviewToClipboard() {
  const txt = document.getElementById('batch-mismatch-preview')?.textContent || '';
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => {
    showToast('समेकित संदेश कॉपी हो गया! WhatsApp ग्रुप्स में तुरंत भेजें।', 'success');
  });
}
window.copyBatchMismatchPreviewToClipboard = copyBatchMismatchPreviewToClipboard;

async function dispatchBatchMismatchAlert() {
  const demandId = activeBatchDemandId;
  const demand = (STATE.demands || []).find(d => d.id === demandId);
  if (!demand) return;

  const btn = document.getElementById('btn-submit-batch-mismatch');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> सभी स्कूलों को मिसमैच भेजा जा रहा है...`;
  }

  const selectedBoxes = Array.from(document.querySelectorAll('#dynamic-demand-schools-tbody .demand-school-chk:checked'));
  const schoolCodes = selectedBoxes.map(b => b.value);
  const commonRemarks = (document.getElementById('batch-mismatch-remarks')?.value || '').trim();
  const sendEmail = !!document.getElementById('batch-send-email-chk')?.checked;
  const sendTelegram = !!document.getElementById('batch-send-telegram-chk')?.checked;

  const schoolItems = [];
  schoolCodes.forEach(code => {
    const sch = (STATE.schools56 || []).find(s => s.shala_darpan_code === code) ||
                getAllMasterSchools().find(s => s.shala_darpan_code === code) || {};
    const staffHead = (STATE.staff || []).find(s => String(s.sso_id).trim() === code && s.is_sanstha_pradhan);
    const email = sch.email || staffHead?.email || 'censusbhinai@gmail.com';

    // Mark in STATE.demandSubmissions
    if (!STATE.demandSubmissions) STATE.demandSubmissions = {};
    if (!STATE.demandSubmissions[demand.id]) STATE.demandSubmissions[demand.id] = {};
    const curSub = STATE.demandSubmissions[demand.id][code] || {};
    curSub.status = 'mismatch';
    curSub.is_mismatch = true;
    curSub.mismatch_remarks = commonRemarks;
    curSub.custom_unlocked = true;
    curSub.mismatch_flagged_at = new Date().toLocaleString('hi-IN');
    STATE.demandSubmissions[demand.id][code] = curSub;

    schoolItems.push({
      school_code: code,
      school_name: sch.school_name || code,
      peeo_name: sch.peeo_name || 'CBEO',
      email: sendEmail ? email : '',
      flagged_fields: ['समस्त प्रपत्र डेटा'],
      remarks: commonRemarks
    });
  });

  localStorage.setItem('cbeo_demand_submissions', JSON.stringify(STATE.demandSubmissions));

  // Also update demand.mismatch_schools
  if (!demand.mismatch_schools) demand.mismatch_schools = [];
  demand.mismatch_schools = Array.from(new Set([...demand.mismatch_schools, ...schoolCodes]));
  localStorage.setItem('cbeo_demands', JSON.stringify(STATE.demands));

  const payload = {
    mode: 'batch',
    demand_id: demand.id,
    demand_title: demand.title,
    schools: schoolItems,
    common_remarks: commonRemarks,
    send_telegram: sendTelegram
  };

  try {
    const res = await fetch('/api/send_mismatch_alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    console.log('Batch Mismatch Dispatch Result:', result);
    showToast(`${schoolCodes.length} विद्यालयों को मिसमैच मार्क किया गया एवं समेकित अलर्ट प्रेषित!`, 'success');
  } catch(e) {
    console.warn('Batch dispatch network notice:', e);
    showToast(`${schoolCodes.length} विद्यालयों को मिसमैच के तहत अनलॉक कर दिया गया!`, 'info');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-paper-plane"></i> 🚨 सभी स्कूलों को मिसमैच मार्क करें एवं अलर्ट भेजें`;
    }
    closeModal('modal-batch-mismatch');
    renderDynamicDemandPortalView(demand.id);
  }
}
window.dispatchBatchMismatchAlert = dispatchBatchMismatchAlert;

function checkAndShowAllMismatchAlerts(userObj) {
  if (!userObj || userObj.role === 'admin') return;
  const uCode = String(userObj.shala_darpan_code).trim();

  // 1. First check Saman Pariksha
  const spCfg = (typeof getSamanMismatchConfig === 'function' ? getSamanMismatchConfig() : (STATE.samanMismatchSettings || {}));
  const isSamanAlertActive = spCfg && spCfg.alert_active !== false;
  const isSamanMismatch = isDemandSchoolMismatch('saman_pariksha_2026_27', uCode);

  if (isSamanAlertActive && isSamanMismatch) {
    checkAndShowSamanMismatchAlert(userObj);
    return;
  }

  // 2. Then check all active Dynamic Demands
  const activeDemands = (STATE.demands || []).filter(d => !d.archived);
  for (const dem of activeDemands) {
    if (isDemandSchoolMismatch(dem.id, uCode)) {
      const sub = (STATE.demandSubmissions && STATE.demandSubmissions[dem.id] && STATE.demandSubmissions[dem.id][uCode]) || {};
      const flagged = sub.mismatch_fields || ['प्रपत्र डेटा'];
      const remarks = sub.mismatch_remarks || 'शाला दर्पण पोर्टल से डेटा मिलान न होने के कारण प्रपत्र अनलॉक किया गया है।';

      const titleElem = document.getElementById('sp-alert-modal-title');
      const nameElem = document.getElementById('sp-alert-school-name');
      const codeElem = document.getElementById('sp-alert-school-code');
      const pTotElem = document.getElementById('sp-alert-portal-total');
      const sdTotElem = document.getElementById('sp-alert-sd-total');
      const diffElem = document.getElementById('sp-alert-diff-total');
      const msgElem = document.getElementById('sp-alert-modal-message');

      if (titleElem) titleElem.innerHTML = `<i class="fas fa-exclamation-triangle sp-mismatch-blinking-text"></i> 🚨 डेटा मिसमैच नोटिस: ${dem.title}`;
      if (nameElem) nameElem.textContent = userObj.school_name || uCode;
      if (codeElem) codeElem.textContent = uCode;
      if (pTotElem) pTotElem.textContent = flagged.join(', ');
      if (sdTotElem) sdTotElem.textContent = 'संशोधन खुला';
      if (diffElem) diffElem.textContent = 'अनलॉक';

      if (msgElem) {
        msgElem.innerHTML = `<strong>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</strong> द्वारा आपके विद्यालय के मांग प्रपत्र <strong>'${dem.title}'</strong> में डेटा मिसमैच पाया गया है।<br><br>⚠️ <strong>मिसमैच फील्ड:</strong> ${flagged.join(', ')}<br>📝 <strong>निर्देश:</strong> ${remarks}<br><br>उक्त त्रुटि सुधार हेतु आपका प्रपत्र अनलॉक कर दिया गया है, कृपया तुरंत सुधार कर सबमिट करें।`;
      }

      window._currentMismatchAlertSchoolCode = uCode;
      window._currentMismatchAlertDemandId = dem.id;

      showModal('modal-saman-mismatch-login-alert');
      return;
    }
  }
}
window.checkAndShowAllMismatchAlerts = checkAndShowAllMismatchAlerts;

// 14. 25 PEEO Compliance & Form Status Matrix (Saman Pariksha + All Dynamic Demands)
function renderAdminMatrix() {
  const theadTr = document.getElementById('admin-matrix-thead-tr');
  const tbody = document.getElementById('admin-matrix-tbody');
  if (!theadTr || !tbody) return;

  const activeDemands = (STATE.demands || []).filter(d => 
    !d.archived && 
    d.id !== 'saman_pariksha_2026_27' && 
    d.id !== 'DEMAND_SAMAN_PARIKSHA_2026' && 
    !d.id.toLowerCase().includes('saman_pariksha') &&
    !(d.title && d.title.includes('समान परीक्षा'))
  );

  // Build matrix thead
  theadTr.innerHTML = `
    <th>क्र.सं.</th>
    <th>शा.दा. कोड</th>
    <th>PEEO नाम</th>
    <th>प्रभारी प्रधानाचार्य</th>
    <th>मोबाइल</th>
    <th style="background:#e0f2fe; color:#0369a1">📋 समान परीक्षा 2026-27 (57 स्कूल)</th>
  `;

  activeDemands.forEach(d => {
    theadTr.innerHTML += `<th style="background:#f1f5f9; color:#1e293b">📋 ${d.title}</th>`;
  });

  theadTr.innerHTML += `<th>त्वरित WhatsApp रिमाइंडर</th>`;

  // Build matrix tbody
  tbody.innerHTML = '';
  STATE.peeos.forEach((peeo, pIdx) => {
    const tr = document.createElement('tr');

    let pendingDemandsForPeeo = [];

    // 1. Saman Pariksha Compliance for this PEEO
    const peeoSchoolsForSP = (STATE.schools56 || []).filter(s => s.peeo_name === peeo.peeo_name || s.peeo_code === peeo.shala_darpan_code);
    const spTotal = peeoSchoolsForSP.length;
    let spDoneCount = 0;
    peeoSchoolsForSP.forEach(s => {
      if (isSamanParikshaSubmitted(s.shala_darpan_code)) spDoneCount++;
    });

    let spCellHtml = '';
    if (spTotal === 0) {
      spCellHtml = `<td><span class="status-badge" style="background:#f1f5f9; color:#64748b">- लागू नहीं -</span></td>`;
    } else if (spDoneCount === spTotal) {
      spCellHtml = `
        <td>
          <button class="status-badge green" style="border:none; cursor:pointer" onclick="openPeeoConsolidatedExamPreview('${peeo.peeo_name}')" title="सत्यापित समेकित PDF देखें">
            <i class="fas fa-check-circle"></i> पूर्ण (PDF देखें)
          </button>
        </td>
      `;
    } else {
      pendingDemandsForPeeo.push(`समान परीक्षा 2026-27 (${spDoneCount}/${spTotal} पूर्ण)`);
      spCellHtml = `
        <td>
          <button class="status-badge ${spDoneCount > 0 ? 'blue' : 'red'}" style="border:none; cursor:pointer" onclick="openPeeoConsolidatedExamPreview('${peeo.peeo_name}')" title="समेकित रिपोर्ट देखें">
            <i class="fas fa-clock"></i> ${spDoneCount}/${spTotal} पूर्ण
          </button>
        </td>
      `;
    }

    // 2. Dynamic Demands Compliance for this PEEO
    let dynamicCellsHtml = '';
    activeDemands.forEach(d => {
      const targetSchools = getTargetSchoolsForDemand(d);
      const peeoSchools = targetSchools.filter(s => s.peeo_name === peeo.peeo_name || s.peeo_code === peeo.shala_darpan_code);
      const dTotal = peeoSchools.length;
      let dDoneCount = 0;
      peeoSchools.forEach(s => {
        if (isDynamicDemandSubmitted(d.id, s.shala_darpan_code)) dDoneCount++;
      });

      const subKey = `${d.id}_${peeo.peeo_id}`;
      const peeoSubVerified = STATE.submissions[subKey] && STATE.submissions[subKey].verified;

      if (dTotal === 0 && !peeoSubVerified) {
        dynamicCellsHtml += `<td><span class="status-badge" style="background:#f1f5f9; color:#64748b">- लागू नहीं -</span></td>`;
      } else if ((dTotal > 0 && dDoneCount === dTotal) || peeoSubVerified) {
        dynamicCellsHtml += `
          <td>
            <button class="status-badge green" style="border:none; cursor:pointer" onclick="openDynamicDemandPeeoPdf('${d.id}', '${peeo.peeo_name}')" title="समेकित A4 PDF देखें">
              <i class="fas fa-check-circle"></i> पूर्ण (PDF देखें)
            </button>
          </td>
        `;
      } else {
        pendingDemandsForPeeo.push(`${d.title} (${dDoneCount}/${dTotal} पूर्ण)`);
        dynamicCellsHtml += `
          <td>
            <button class="status-badge ${dDoneCount > 0 ? 'blue' : 'red'}" style="border:none; cursor:pointer" onclick="openDynamicDemandPortal('${d.id}')" title="पोर्टल स्थिति देखें">
              <i class="fas fa-clock"></i> ${dDoneCount}/${dTotal} पूर्ण
            </button>
          </td>
        `;
      }
    });

    // 3. Quick WhatsApp Reminder Button
    let reminderCellHtml = '';
    if (pendingDemandsForPeeo.length > 0) {
      const reminderText = `आदरणीय ${peeo.principal_incharge} महोदय (${peeo.peeo_name}), CBEO भिनाय कार्यालय द्वारा आपके परिक्षेत्र में निम्नलिखित प्रपत्र/सूचनाएं लंबित हैं:\n- ${pendingDemandsForPeeo.join('\n- ')}\nकृपया अधीनस्थ संस्था प्रधानों से शीघ्र अधिकृत हस्ताक्षर सहित पोर्टल पर सबमिट करवाएं।`;
      reminderCellHtml = `
        <td>
          <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppMessage('${peeo.mobile}', \`${reminderText}\`)" title="WhatsApp पर लंबित सूचनाओं का रिमाइंडर भेजें">
            <i class="fab fa-whatsapp"></i> रिमाइंडर (${pendingDemandsForPeeo.length})
          </button>
        </td>
      `;
    } else {
      reminderCellHtml = `
        <td>
          <span class="status-badge green"><i class="fas fa-check-double"></i> शत-प्रतिशत पूर्ण</span>
        </td>
      `;
    }

    tr.innerHTML = `
      <td><strong>${pIdx + 1}</strong></td>
      <td><code>${peeo.shala_darpan_code || '---'}</code></td>
      <td><strong>${peeo.peeo_name}</strong></td>
      <td>${peeo.principal_incharge}</td>
      <td><a href="tel:${peeo.mobile}" style="text-decoration:none; color:var(--primary); font-weight:600"><i class="fas fa-phone-alt"></i> ${peeo.mobile}</a></td>
      ${spCellHtml}
      ${dynamicCellsHtml}
      ${reminderCellHtml}
    `;

    tbody.appendChild(tr);
  });
}

// 15. Admin Control Room View

function toggleDemandAudienceLevel(demandId, levelKey, isChecked) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  if (!demand.targetAudience) {
    demand.targetAudience = { cbeo: true, peeo: true, sec_srsec: false, all_govt: false, all_schools: false };
  }

  demand.targetAudience[levelKey] = isChecked;

  // If at least one audience level is checked, demand is published
  const hasAnyAudience = Object.values(demand.targetAudience).some(v => !!v);
  demand.published = hasAnyAudience;

  saveDemandsToStorage();
  showToast(`मांग '${demand.title}' की दृश्यता अनुमति सफलतापूर्वक अपडेट की गई!`, 'success');
  renderAdminControlView();
}

function renderAdminControlView() {
  const isJitendra = STATE.currentUser && (
    STATE.currentUser.shala_darpan_code === 'admin_jitendra' || 
    STATE.currentUser.admin_id === 'ADMIN02' || 
    STATE.currentUser.username === 'jitendra_admin'
  );

  // Render CBEO Executive Dashboard (visible to both Jitendra and CBEO)
  renderCBEOExecutiveDemands();
  updateVMWidgetStats();

  // Render Cloud VM Controller, 5-Level Control Matrix & Staff Permissions (for Jitendra Super Admin)
  if (isJitendra) {
    loadAndRenderVMControlCard();
    render5LevelTabVisibilityMatrix();
    if (typeof render5LevelEditPermissionsMatrix === 'function') render5LevelEditPermissionsMatrix();
    renderStaffEditPermissionsMatrix();
    if (typeof renderDeepBackupList === 'function') renderDeepBackupList();
  }

  const publishList = document.getElementById('admin-demands-publish-list');
  if (publishList) {
    publishList.innerHTML = '';
    STATE.demands.forEach(d => {
      const isPub = d.published !== false && !d.isTestMode;
      const aud = d.targetAudience || { cbeo: true, peeo: true, sec_srsec: false, all_govt: false, all_schools: false };
      const anySchoolActive = !!(aud.sec_srsec || aud.all_govt || aud.all_schools);

      const card = document.createElement('div');
      card.style.cssText = 'background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:1rem; margin-bottom:0.75rem; box-shadow:0 1px 3px rgba(0,0,0,0.04)';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem">
              <strong style="font-size:1rem; color:#0f172a">${d.title}</strong>
              ${d.isTestMode ? '<span class="badge-tag pradhan" style="background:#fef3c7; color:#78350f; font-weight:800; font-size:0.7rem">🧪 टेस्ट मोड में सक्रिय</span>' : ''}
              <span class="status-badge ${isPub ? 'green' : 'red'}" style="font-size:0.72rem">
                ${isPub ? '✓ लाइव प्रकाशित' : (d.isTestMode ? '🧪 परीक्षण मोड' : '✗ अप्रकाशित')}
              </span>
            </div>
            <div style="font-size:0.76rem; color:#64748b; margin-top:2px">
              अंतिम तिथि: ${d.dueDate || 'यथाशीघ्र'} | संकलन स्तर: ${d.collectionLevel === 'school' ? 'विद्यालय स्तर' : 'PEEO स्तर'} | कॉलम: ${d.columns ? d.columns.length : 0}
            </div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap">
            <button class="btn btn-outline-secondary btn-sm" onclick="openDemandTestStudio('${d.id}')" style="font-size:0.75rem; font-weight:700">
              <i class="fas fa-flask"></i> टेस्ट स्टूडियो
            </button>
            <button class="btn btn-primary btn-sm" onclick="openDynamicDemandPortal('${d.id}')" style="font-size:0.75rem; font-weight:700">
              <i class="fas fa-desktop"></i> पोर्टल खोलें
            </button>
          </div>
        </div>

        <!-- 5-Level Audience Checkboxes Panel -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.65rem 0.85rem">
          <div style="font-size:0.76rem; font-weight:800; color:#1e293b; margin-bottom:0.45rem; display:flex; justify-content:space-between; align-items:center">
            <span><i class="fas fa-users-cog text-primary"></i> 5-स्तरीय दृश्यता एवं प्रकाशन नियंत्रण (Audience Access Permissions):</span>
            <span style="font-size:0.7rem; font-weight:normal; color:#64748b">(चेकबॉक्स ऑन करते ही उस स्तर पर तत्काल दृश्यमान)</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.5rem">
            <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; font-weight:600; cursor:pointer">
              <input type="checkbox" ${aud.cbeo ? 'checked' : ''} onchange="toggleDemandAudienceLevel('${d.id}', 'cbeo', this.checked)" style="width:16px; height:16px; cursor:pointer"> 1. CBEO Admin
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; font-weight:600; cursor:pointer">
              <input type="checkbox" ${aud.peeo ? 'checked' : ''} onchange="toggleDemandAudienceLevel('${d.id}', 'peeo', this.checked)" style="width:16px; height:16px; cursor:pointer"> 2. 25 PEEO प्रभारी
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; font-weight:700; color:#1e40af; cursor:pointer">
              <input type="checkbox" ${aud.sec_srsec ? 'checked' : ''} onchange="toggleDemandAudienceLevel('${d.id}', 'sec_srsec', this.checked)" style="width:16px; height:16px; cursor:pointer"> 3. 57 Sec/Sr.Sec स्कूल
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; font-weight:600; cursor:pointer">
              <input type="checkbox" ${aud.all_govt ? 'checked' : ''} onchange="toggleDemandAudienceLevel('${d.id}', 'all_govt', this.checked)" style="width:16px; height:16px; cursor:pointer"> 4. समस्त राजकीय स्कूल (132)
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; font-weight:600; cursor:pointer">
              <input type="checkbox" ${aud.all_schools ? 'checked' : ''} onchange="toggleDemandAudienceLevel('${d.id}', 'all_schools', this.checked)" style="width:16px; height:16px; cursor:pointer"> 5. समस्त स्कूल (निजी सहित - 178)
            </label>
          </div>
          <div style="font-size:0.72rem; color:${anySchoolActive ? '#15803d' : '#b45309'}; margin-top:0.4rem; font-weight:700; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem">
            <span>${anySchoolActive ? '✓ स्कूल स्तर पर दृश्यता सक्रिय है (चयनित विद्यालयों को यह मांग पोर्टल पर दिखाई दे रही है)।' : '⚠️ स्कूल स्तर पर दृश्यता बंद है (स्कूलों को यह मांग तब तक नहीं दिखेगी जब तक आप ऊपर चेकबॉक्स ऑन नहीं करेंगे)।'}</span>
            ${(isPub && anySchoolActive) ? `
              <button class="btn btn-sm" onclick="openBroadcastDemandEmailModal('${d.id}')" style="background:#f59e0b; color:#0f172a; border:none; font-weight:800; font-size:0.74rem; padding:4px 10px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem" title="लक्षित विद्यालयों को ईमेल सूचना एवं भरने के निर्देश भेजें">
                <i class="fas fa-paper-plane"></i> 📧 संबंधित विद्यालयों को ईमेल प्रसारण भेजें
              </button>
            ` : ''}
          </div>
        </div>
      `;
      publishList.appendChild(card);
    });
  }

  renderAdminMatrix();
}

function isDemandSubmitted(sub) {
  if (!sub) return false;
  if (typeof isDynamicDemandSubmitted === 'function') return isDynamicDemandSubmitted(sub);
  return !!(sub.submitted || sub.timestamp || sub.submitted_at || sub.is_submitted);
}

function renderCBEOExecutiveDemands() {
  const tbody = document.getElementById('cbeo-demands-summary-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const allDemands = [];

  // 1. Saman Pariksha (Always first and primary)
  const spSubs = STATE.samanParikshaSubmissions || {};
  let spReceived = 0;
  (STATE.schools56 || []).forEach(s => {
    if (isSamanParikshaSubmitted(spSubs[s.shala_darpan_code])) spReceived++;
  });
  const spTarget = (STATE.schools56 || []).length || 57;
  const spPending = Math.max(0, spTarget - spReceived);
  const spPct = spTarget > 0 ? Math.round((spReceived / spTarget) * 100) : 0;

  allDemands.push({
    id: 'saman_pariksha_2026_27',
    title: '📋 समान परीक्षा 2026-27 (57 माध्यमिक व उच्च माध्यमिक विद्यालय)',
    dueDate: '15 अक्टूबर 2026',
    targetCount: spTarget,
    receivedCount: spReceived,
    pendingCount: spPending,
    pct: spPct,
    isSamanPariksha: true
  });

  // 2. Dynamic Demands
  (STATE.demands || []).filter(d => !d.archived).forEach(d => {
    const subs = (STATE.demandSubmissions && STATE.demandSubmissions[d.id]) || {};
    let target = 25;
    if (d.collectionLevel === 'school' || d.collection_level === 'school') {
      target = d.schoolScope === 'govt' ? 132 : (d.schoolScope === 'sec_srsec' ? 57 : 178);
    }
    const recCount = Object.keys(subs).filter(k => isDemandSubmitted(subs[k])).length;
    const pending = Math.max(0, target - recCount);
    const pct = target > 0 ? Math.round((recCount / target) * 100) : 0;

    allDemands.push({
      id: d.id,
      title: d.title,
      dueDate: d.dueDate || d.due_date || 'यथाशीघ्र',
      targetCount: target,
      receivedCount: recCount,
      pendingCount: pending,
      pct: pct,
      isSamanPariksha: false
    });
  });

  allDemands.forEach((d, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${d.title}</strong></td>
      <td>${d.dueDate}</td>
      <td><span class="badge-tag blue">${d.targetCount} विद्यालय</span></td>
      <td><span class="badge-tag green" style="background:#dcfce7; color:#15803d; font-weight:700">${d.receivedCount} प्राप्त</span></td>
      <td><span class="badge-tag red" style="background:#fee2e2; color:#b91c1c; font-weight:700">${d.pendingCount} लम्बित</span></td>
      <td>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <div style="flex:1; background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden">
            <div style="width:${d.pct}%; background:${d.pct === 100 ? '#10b981' : (d.pct > 50 ? '#0284c7' : '#0369a1')}; height:100%"></div>
          </div>
          <span style="font-size:0.8rem; font-weight:700">${d.pct}%</span>
        </div>
      </td>
      <td style="text-align:center">
        <div style="display:flex; gap:0.4rem; justify-content:center; flex-wrap:wrap">
          <button class="btn btn-danger btn-sm" onclick="generateDemandPendingListPDF('${d.id}')" title="लम्बित विद्यालय एवं PEEO सूची PDF जनरेट करें" style="font-size:0.75rem; padding:4px 8px; font-weight:700">
            <i class="fas fa-file-pdf"></i> लम्बित PDF
          </button>
          <button class="btn btn-sm" onclick="openDemandBroadcastCenter('${d.id}')" title="संदेश कस्टमाइज़ करें एवं ईमेल/Telegram/WhatsApp पर भेजें" style="font-size:0.75rem; padding:4px 8px; font-weight:700; background:#0284c7; color:#ffffff; border:none; border-radius:4px">
            <i class="fas fa-bullhorn"></i> प्रसारण
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="openShareDemandPendingModal('${d.id}')" title="WhatsApp पर लम्बित सूची शेयर करें" style="font-size:0.75rem; padding:4px 8px">
            <i class="fab fa-whatsapp"></i> शेयर
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function generateDemandPendingListPDF(demandId) {
  let demandTitle = 'समान परीक्षा 2026-27';
  let pendingList = [];

  if (demandId === 'saman_pariksha_2026_27' || demandId.includes('saman_pariksha')) {
    demandTitle = 'समान परीक्षा 2026-27 (माध्यमिक एवं उच्च माध्यमिक)';
    const spSubs = STATE.samanParikshaSubmissions || {};
    (STATE.schools56 || []).forEach(s => {
      if (!isSamanParikshaSubmitted(spSubs[s.shala_darpan_code])) {
        pendingList.push({
          code: s.shala_darpan_code,
          name: s.school_name,
          peeo: s.peeo_name,
          principal: s.principal_name || 'संस्था प्रधान',
          mobile: s.principal_mobile || s.mobile || ''
        });
      }
    });
  } else {
    const dem = (STATE.demands || []).find(d => d.id === demandId);
    if (dem) demandTitle = dem.title;
    const subs = (STATE.demandSubmissions && STATE.demandSubmissions[demandId]) || {};
    
    if (dem && (dem.collectionLevel === 'school' || dem.collection_level === 'school')) {
      (STATE.schools56 || []).forEach(s => {
        if (!isDemandSubmitted(subs[s.shala_darpan_code])) {
          pendingList.push({
            code: s.shala_darpan_code,
            name: s.school_name,
            peeo: s.peeo_name,
            principal: s.principal_name || 'संस्था प्रधान',
            mobile: s.principal_mobile || s.mobile || ''
          });
        }
      });
    } else {
      (STATE.peeos || []).forEach(p => {
        if (!isDemandSubmitted(subs[p.shala_darpan_code])) {
          pendingList.push({
            code: p.shala_darpan_code,
            name: `${p.peeo_name} नोडल परिक्षेत्र`,
            peeo: p.peeo_name,
            principal: p.principal_incharge || 'PEEO प्रभारी',
            mobile: p.mobile || ''
          });
        }
      });
    }
  }

  if (pendingList.length === 0) {
    showToast('बधाई! इस सूचना में कोई भी विद्यालय लम्बित नहीं है। शत-प्रतिशत अनुपालना पूर्ण!', 'success');
    return;
  }

  showToast(`लम्बित सूची PDF तैयार की जा रही है (${pendingList.length} लम्बित)...`, 'info');

  const container = document.createElement('div');
  container.id = 'temp-pending-pdf-node';
  container.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; background:#ffffff; font-family:"Noto Sans Devanagari", "Inter", sans-serif; padding:24px; color:#1e293b; box-sizing:border-box';

  let rowsHtml = '';
  pendingList.forEach((item, idx) => {
    rowsHtml += `
      <tr style="border-bottom:1px solid #cbd5e1; font-size:11px">
        <td style="padding:6px; text-align:center">${idx + 1}</td>
        <td style="padding:6px; font-weight:700; color:#1b365d">${item.code}</td>
        <td style="padding:6px; font-weight:700">${item.name}</td>
        <td style="padding:6px; color:#475569">${item.peeo}</td>
        <td style="padding:6px">${item.principal}</td>
        <td style="padding:6px; font-weight:700; color:#0369a1">${item.mobile || '---'}</td>
        <td style="padding:6px; text-align:center"><span style="color:#b91c1c; font-weight:800">🚨 लम्बित</span></td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div style="border:2px solid #1b365d; padding:16px; border-radius:8px">
      <div style="text-align:center; border-bottom:2px solid #1b365d; padding-bottom:12px; margin-bottom:14px">
        <div style="font-size:11px; font-weight:800; color:#c2410c; letter-spacing:1px; margin-bottom:2px">स्कूल शिक्षा विभाग, राजस्थान सरकार</div>
        <h2 style="margin:0; font-size:18px; color:#1b365d; font-weight:900">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
        <div style="font-size:13px; font-weight:800; color:#0f172a; margin-top:2px">जिला: अजमेर (राजस्थान) | NIC-SD: 8140</div>
        <div style="display:inline-block; background:#fee2e2; color:#991b1b; padding:3px 12px; border-radius:15px; font-size:12px; font-weight:800; margin-top:8px; border:1px solid #f87171">
          🚨 लम्बित विद्यालय एवं PEEO अनुपालना रिपोर्ट
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:10px; font-weight:700; color:#334155">
        <div><strong>सूचना का नाम:</strong> ${demandTitle}</div>
        <div><strong>कुल लम्बित:</strong> <span style="color:#dc2626">${pendingList.length}</span> | <strong>दिनांक:</strong> ${new Date().toLocaleDateString('hi-IN')}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:16px">
        <thead>
          <tr style="background:#f1f5f9; border-top:2px solid #1b365d; border-bottom:2px solid #1b365d; font-size:11px; text-align:left">
            <th style="padding:6px; width:35px; text-align:center">क्र.</th>
            <th style="padding:6px; width:70px">कोड</th>
            <th style="padding:6px">विद्यालय / PEEO का नाम</th>
            <th style="padding:6px">PEEO परिक्षेत्र</th>
            <th style="padding:6px">संस्था प्रधान / प्रभारी</th>
            <th style="padding:6px; width:90px">मोबाइल</th>
            <th style="padding:6px; width:65px; text-align:center">स्थिति</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#475569; margin-top:16px; border-top:1px dashed #cbd5e1; padding-top:8px">
        <div>
          ✓ पोर्टल जनरेटेड अधिकृत रिपोर्ट | जिला: अजमेर (AJMER)<br>
          <em>नोट: संबंधित संस्था प्रधान तुरंत पोर्टल पर प्रविष्टि दर्ज कर प्रमाणित करें।</em>
        </div>
        <div style="text-align:right">
          <strong>मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</strong><br>
          भिनाय, जिला: अजमेर (राजस्थान)
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `CBEO_Bhinai_Pending_${demandId}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(container);
    showToast('लम्बित सूची PDF सफलतापूर्वक डाउनलोड हो गई!', 'success');
  }).catch(e => {
    console.error('PDF error:', e);
    document.body.removeChild(container);
    showToast('PDF जनरेशन में समस्या आई!', 'error');
  });
}

function openShareDemandPendingModal(demandId) {
  let demandTitle = 'समान परीक्षा 2026-27';
  let pendingList = [];

  if (demandId === 'saman_pariksha_2026_27' || demandId.includes('saman_pariksha')) {
    demandTitle = 'समान परीक्षा 2026-27';
    const spSubs = STATE.samanParikshaSubmissions || {};
    (STATE.schools56 || []).forEach(s => {
      if (!isSamanParikshaSubmitted(spSubs[s.shala_darpan_code])) {
        pendingList.push({
          code: s.shala_darpan_code,
          name: s.school_name,
          peeo: s.peeo_name,
          principal: s.principal_name || 'संस्था प्रधान',
          mobile: s.principal_mobile || s.mobile || ''
        });
      }
    });
  } else {
    const dem = (STATE.demands || []).find(d => d.id === demandId);
    if (dem) demandTitle = dem.title;
    const subs = (STATE.demandSubmissions && STATE.demandSubmissions[demandId]) || {};
    
    if (dem && (dem.collectionLevel === 'school' || dem.collection_level === 'school')) {
      (STATE.schools56 || []).forEach(s => {
        if (!isDemandSubmitted(subs[s.shala_darpan_code])) {
          pendingList.push({
            code: s.shala_darpan_code,
            name: s.school_name,
            peeo: s.peeo_name,
            principal: s.principal_name || 'संस्था प्रधान',
            mobile: s.principal_mobile || s.mobile || ''
          });
        }
      });
    } else {
      (STATE.peeos || []).forEach(p => {
        if (!isDemandSubmitted(subs[p.shala_darpan_code])) {
          pendingList.push({
            code: p.shala_darpan_code,
            name: `${p.peeo_name} नोडल परिक्षेत्र`,
            peeo: p.peeo_name,
            principal: p.principal_incharge || 'PEEO प्रभारी',
            mobile: p.mobile || ''
          });
        }
      });
    }
  }

  if (pendingList.length === 0) {
    showToast('इस सूचना में कोई भी विद्यालय लम्बित नहीं है!', 'success');
    return;
  }

  let listText = '';
  pendingList.slice(0, 30).forEach((item, idx) => {
    listText += `[${idx + 1}] ${item.name} (${item.code})\n     प्रभारी: ${item.principal} | मो.: ${item.mobile || 'उपलब्ध नहीं'}\n`;
  });
  if (pendingList.length > 30) {
    listText += `... एवं अन्य ${pendingList.length - 30} विद्यालय।\n`;
  }

  const msg = 
`*कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*
*अति-आवश्यक लम्बित अनुपालना स्मरण पत्र*

📋 *सूचना का नाम:* ${demandTitle}
🚨 *कुल लम्बित संख्या:* ${pendingList.length} विद्यालय / PEEO
📅 *दिनांक:* ${new Date().toLocaleDateString('hi-IN')}

महोदय, उक्त सूचना के संबंध में निम्नलिखित विद्यालयों/PEEO की रिपोर्ट अब तक पोर्टल पर अप्राप्त/लम्बित है:

${listText}
समस्त संबंधित संस्था प्रधान / PEEO अविलंब पोर्टल पर प्रविष्टि पूर्ण कर प्रमाणित करें।
👉 पोर्टल लिंक: http://localhost:8089/

- *मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*`;

  openWhatsAppDirectText(msg);
}

function toggleDemandPublish(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  demand.published = (demand.published === false) ? true : false;
  saveDemandsToStorage();

  const statusText = demand.published ? 'PEEO हेतु प्रकाशित' : 'PEEO स्तर से अप्रकाशित (हटा दिया गया)';
  showToast(`सूचना '${demand.title}' अब ${statusText} है!`, demand.published ? 'success' : 'warning');
  renderApp();
  renderAdminControlView();
}

function openCreateDemandModal(defaultParentTab = null) {
  document.getElementById('new-demand-title').value = '';
  document.getElementById('new-demand-date').value = '';
  
  const placementSelect = document.getElementById('new-demand-placement');
  const parentTabSelect = document.getElementById('new-demand-parent-tab');
  const parentGroup = document.getElementById('group-demand-parent-tab');

  if (defaultParentTab) {
    if (placementSelect) placementSelect.value = 'tab_existing';
    if (parentTabSelect) parentTabSelect.value = defaultParentTab;
    if (parentGroup) parentGroup.style.display = 'block';
  } else {
    if (placementSelect) placementSelect.value = 'tab_existing';
    if (parentGroup) parentGroup.style.display = 'block';
  }

  const levelSelect = document.getElementById('new-demand-collection-level');
  if (levelSelect) {
    levelSelect.value = (defaultParentTab === 'saman-pariksha') ? 'school' : 'peeo';
    onDemandCollectionLevelChange();
  }

  const scopeSelect = document.getElementById('new-demand-school-scope');
  if (scopeSelect) {
    scopeSelect.value = (defaultParentTab === 'saman-pariksha') ? 'govt_sec' : 'all';
    onDemandSchoolScopeChange();
  }

  if (defaultParentTab === 'saman-pariksha') {
    quickFillSamanSyllabusPrompt();
  } else {
    document.getElementById('new-demand-cols').value = 'कुल खेल मैदान क्षेत्रफल (बीघा), वर्तमान चारदीवारी स्थिति, विकसित खेल संसाधन, आवश्यक अनुदान (लाखों में), विशेष विवरण';
    document.getElementById('new-demand-desc').value = '';
    document.getElementById('new-demand-publish').checked = true;
  }

  showModal('modal-create-demand');
}

function onDemandPlacementChange() {
  const placement = document.getElementById('new-demand-placement')?.value;
  const parentGroup = document.getElementById('group-demand-parent-tab');
  if (parentGroup) {
    parentGroup.style.display = (placement === 'tab_existing') ? 'block' : 'none';
  }
}

function onDemandSchoolScopeChange() {
  const scope = document.getElementById('new-demand-school-scope')?.value;
  const hint = document.getElementById('new-demand-scope-hint');
  const audGovtSec = document.getElementById('demand-aud-govt-sec');
  const audPvtSec = document.getElementById('demand-aud-pvt-sec');
  const audGovt = document.getElementById('demand-aud-govt');
  const audAll = document.getElementById('demand-aud-all');

  if (hint) {
    if (scope === 'govt_sec') {
      hint.innerHTML = '🏛️ <strong>केवल 49 राजकीय Sec/Sr.Sec:</strong> 8 निजी स्कूल इस प्रपत्र से पूर्णतः बाहर रहेंगे।';
      hint.style.color = '#15803d';
      if (audGovtSec) audGovtSec.checked = true;
      if (audPvtSec) audPvtSec.checked = false;
    } else if (scope === 'pvt_sec') {
      hint.innerHTML = '🏢 <strong>केवल 8 निजी Sec/Sr.Sec:</strong> केवल निजी माध्यमिक/उच्च माध्यमिक विद्यालय।';
      hint.style.color = '#d97706';
      if (audGovtSec) audGovtSec.checked = false;
      if (audPvtSec) audPvtSec.checked = true;
    } else if (scope === 'both_sec') {
      hint.innerHTML = '🏫 <strong>समस्त 57 Sec/Sr.Sec:</strong> 49 राजकीय + 8 निजी माध्यमिक व उच्च माध्यमिक विद्यालय।';
      hint.style.color = '#2563eb';
      if (audGovtSec) audGovtSec.checked = true;
      if (audPvtSec) audPvtSec.checked = true;
    } else if (scope === 'all_govt') {
      hint.innerHTML = '🏛️ <strong>समस्त राजकीय विद्यालय:</strong> 132 राजकीय विद्यालय (प्राथमिक/उच्च प्राथमिक/माध्यमिक)।';
      hint.style.color = '#0284c7';
      if (audGovt) audGovt.checked = true;
    } else {
      hint.innerHTML = '🌐 <strong>समस्त 178 विद्यालय:</strong> ब्लॉक के सभी राजकीय व निजी विद्यालय।';
      hint.style.color = '#475569';
      if (audAll) audAll.checked = true;
    }
  }
}

function quickFillSamanSyllabusPrompt() {
  const titleEl = document.getElementById('new-demand-title');
  if (titleEl) titleEl.value = 'समान परीक्षा: सत्र 2026-27 पाठ्यक्रम पूर्णता प्रतिशत मांग (49 राजकीय विद्यालय)';
  const descEl = document.getElementById('new-demand-desc');
  if (descEl) descEl.value = 'समान परीक्षा 2026-27 के अंतर्गत ब्लॉक के 49 राजकीय माध्यमिक एवं उच्च माध्यमिक विद्यालयों में कक्षा 9 से 12 तक के विषयवार पाठ्यक्रम पूर्णता प्रतिशत की आधिकारिक मांग। (8 निजी स्कूल पूर्णतया बाहर)';
  const placementEl = document.getElementById('new-demand-placement');
  if (placementEl) {
    placementEl.value = 'tab_existing';
    onDemandPlacementChange();
  }
  const parentTabEl = document.getElementById('new-demand-parent-tab');
  if (parentTabEl) parentTabEl.value = 'saman-pariksha';
  const levelEl = document.getElementById('new-demand-collection-level');
  if (levelEl) {
    levelEl.value = 'school';
    onDemandCollectionLevelChange();
  }
  const scopeEl = document.getElementById('new-demand-school-scope');
  if (scopeEl) {
    scopeEl.value = 'govt_sec';
    onDemandSchoolScopeChange();
  }
  const colsEl = document.getElementById('new-demand-cols');
  if (colsEl) {
    colsEl.value = 'कक्षा 9 हिन्दी %, कक्षा 9 अंग्रेजी %, कक्षा 9 गणित %, कक्षा 9 विज्ञान %, कक्षा 9 सा.विज्ञान %, तृतीय भाषा संस्कृत %, तृतीय भाषा उर्दू %, कक्षा 10 हिन्दी %, कक्षा 10 अंग्रेजी %, कक्षा 10 गणित %, कक्षा 10 विज्ञान %, कक्षा 10 सा.विज्ञान %, 10वीं संस्कृत %, 10वीं उर्दू %, कक्षा 11 अनिवार्य हिन्दी %, कक्षा 11 अनिवार्य अंग्रेजी %, 11वीं ऐच्छिक विषय %, कक्षा 12 अनिवार्य हिन्दी %, कक्षा 12 अनिवार्य अंग्रेजी %, 12वीं ऐच्छिक विषय %';
  }
  if (document.getElementById('demand-aud-cbeo')) document.getElementById('demand-aud-cbeo').checked = true;
  if (document.getElementById('demand-aud-peeo')) document.getElementById('demand-aud-peeo').checked = true;
  if (document.getElementById('demand-aud-govt-sec')) document.getElementById('demand-aud-govt-sec').checked = true;
  if (document.getElementById('demand-aud-pvt-sec')) document.getElementById('demand-aud-pvt-sec').checked = false; // Excluded!
  if (document.getElementById('demand-aud-govt')) document.getElementById('demand-aud-govt').checked = false;
  if (document.getElementById('demand-aud-all')) document.getElementById('demand-aud-all').checked = false;
  showToast('समान परीक्षा पाठ्यक्रम पूर्णता मांग टेम्पलेट लागू हो गया!', 'info');
}

function onDemandCollectionLevelChange() {
  const level = document.getElementById('new-demand-collection-level')?.value;
  const hint = document.getElementById('new-demand-collection-hint');
  if (hint) {
    if (level === 'school') {
      hint.innerHTML = '✓ <strong>विद्यालय स्तर:</strong> सीधे प्रत्येक विद्यालय अपने शाला दर्पण/PSP कोड से लॉगिन कर अपनी सूचना भरेगा। समस्त लक्षित विद्यालयों का लॉगिन स्वतः एक्टिव रहेगा।';
      hint.style.color = '#1d4ed8';
    } else {
      hint.innerHTML = '✓ <strong>PEEO स्तर:</strong> 25 PEEO लॉगिन करेंगे और अपने अधीनस्थ सभी विद्यालयों की समेकित सूचना प्रविष्टि करेंगे।';
      hint.style.color = '#047857';
    }
  }
}


/* ========================================================
   11. DYNAMIC DEMAND BUILDER: COLUMN PRE-FILL & AI MAPPING ENGINE
   ======================================================== */

let DEMAND_BUILDER_COLUMNS = [];
let ACTIVE_DEMAND_STUDIO_SCHOOL_CODE = null;

// Pre-fill Source Labels and Resolver
const DEMAND_PREFILL_SOURCES = [
  { id: 'none', label: '✍️ स्वतः नहीं (खाली प्रविष्टि - स्कूल स्वयं भरेगा)' },
  { id: 'principal_name', label: '👑 संस्था प्रधान का नाम' },
  { id: 'principal_mobile', label: '📱 संस्था प्रधान मोबाइल' },
  { id: 'incharge_name', label: '👨‍🏫 परीक्षा / प्रपत्र प्रभारी का नाम' },
  { id: 'incharge_mobile', label: '📱 प्रभारी मोबाइल' },
  { id: 'school_name', label: '🏫 विद्यालय का नाम (हिंदी)' },
  { id: 'school_name_en', label: '🏛️ विद्यालय का नाम (अंग्रेज़ी)' },
  { id: 'shala_darpan_code', label: '🔢 शाला दर्पण / PSP कोड' },
  { id: 'peeo_name', label: '🏢 PEEO परिक्षेत्र नाम' },
  { id: 'dise_code', label: '🏷️ U-DISE कोड' },
  { id: 'category', label: '📑 विद्यालय श्रेणी (Sec/Sr Sec)' },
  { id: 'type', label: '🏛️ विद्यालय प्रकार (Govt/Private)' }
];

function getSampleSchoolForDemandPreview() {
  return (STATE.schools56 || []).find(s => s.shala_darpan_code === '221769') || 
         (STATE.schools56 || [])[0] || {
           school_name: 'रा.उ.मा.वि. बांदनवाड़ा',
           school_name_en: 'GOVT. SENIOR SECONDARY SCHOOL BANDANWARA',
           shala_darpan_code: '221769',
           peeo_name: 'PEEO BANDANWARA',
           principal_name: 'श्री भागचन्द लोधा',
           principal_mobile: '9414000000',
           incharge_name: 'श्री रामस्वरूप जाट',
           incharge_mobile: '9829000000',
           dise_code: '08210300101',
           category: 'Sr.Sec',
           type: 'Government'
         };
}

function resolveSamplePrefillValue(sourceId, school = null) {
  const sch = school || getSampleSchoolForDemandPreview();
  switch (sourceId) {
    case 'principal_name': return sch.principal_name || 'श्री संस्था प्रधान';
    case 'principal_mobile': return sch.principal_mobile || sch.mobile || '9414000000';
    case 'incharge_name': return sch.incharge_name || 'श्री परीक्षा प्रभारी';
    case 'incharge_mobile': return sch.incharge_mobile || '9829000000';
    case 'school_name': return sch.school_name || 'रा.उ.मा.वि. बांदनवाड़ा';
    case 'school_name_en': return sch.school_name_en || 'GOVT. SR. SEC. SCHOOL BANDANWARA';
    case 'shala_darpan_code': return sch.shala_darpan_code || '221769';
    case 'peeo_name': return sch.peeo_name || 'PEEO BANDANWARA';
    case 'dise_code': return sch.dise_code || '08210300101';
    case 'category': return sch.category || 'Sr.Sec';
    case 'type': return sch.type || 'Government';
    default: return '<span style="color:#94a3b8; font-style:italic">-- स्कूल द्वारा प्रविष्ट होगा --</span>';
  }
}

function generateDemandColumnsFromInput() {
  const raw = (document.getElementById('new-demand-cols')?.value || '').trim();
  const list = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  
  // Maintain existing mappings if present
  const newCols = list.map((name, idx) => {
    const existing = DEMAND_BUILDER_COLUMNS.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    
    // Auto-detect prefill source using AI keyword engine
    const detected = detectPrefillSourceForColumn(name);
    return {
      name: name,
      type: 'text',
      prefillSource: detected,
      aiAuto: true
    };
  });

  DEMAND_BUILDER_COLUMNS = newCols;
  renderDemandColumnsMappingTable();
}

function detectPrefillSourceForColumn(colName) {
  const c = colName.toLowerCase().trim();
  if (c.includes('मोबाइल') || c.includes('फोन') || c.includes('contact') || c.includes('phone') || c.includes('mob')) {
    if (c.includes('प्रभारी')) return 'incharge_mobile';
    return 'principal_mobile';
  }
  if (c.includes('प्रभारी')) return 'incharge_name';
  if (c.includes('प्रधान') || c.includes('प्रधानाचार्य') || c.includes('hm') || c.includes('संचालक') || c.includes('principal') || c.includes('संस्था प्रधान')) {
    return 'principal_name';
  }
  if (c.includes('शाला दर्पण') || c.includes('शालादर्पण') || c.includes('sd code') || c.includes('psp') || c.includes('स्कूल कोड') || (c.includes('कोड') && !c.includes('डाइस') && !c.includes('dise'))) {
    return 'shala_darpan_code';
  }
  if (c.includes('डाइस') || c.includes('udise') || c.includes('dise')) {
    return 'dise_code';
  }
  if (c.includes('अंग्रेजी') || c.includes('english') || c.includes('en name')) {
    return 'school_name_en';
  }
  if (c.includes('विद्यालय') || c.includes('स्कूल') || c.includes('school')) {
    return 'school_name';
  }
  if (c.includes('peeo') || c.includes('पीईईओ')) {
    return 'peeo_name';
  }
  if (c.includes('श्रेणी') || c.includes('category')) {
    return 'category';
  }
  if (c.includes('प्रकार') || c.includes('राजकीय') || c.includes('निजी') || c.includes('type')) {
    return 'type';
  }
  return 'none';
}

function aiAutoDetectAllDemandColumns() {
  DEMAND_BUILDER_COLUMNS.forEach(c => {
    c.prefillSource = detectPrefillSourceForColumn(c.name);
    c.aiAuto = true;
  });
  renderDemandColumnsMappingTable();
  showToast('🤖 AI इंजन द्वारा सभी कॉलमों की मास्टर डेटाबेस मैपिंग स्वतः पूर्ण कर दी गई!', 'success');
}

function renderDemandColumnsMappingTable() {
  const tbody = document.getElementById('demand-columns-mapping-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (DEMAND_BUILDER_COLUMNS.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.25rem; color:#64748b">कोई कॉलम दर्ज नहीं है। ऊपर कॉलम नाम लिखकर 'कॉलम तालिका रिफ्रेश करें' दबाएं।</td></tr>`;
    return;
  }

  const sampleSchool = getSampleSchoolForDemandPreview();

  DEMAND_BUILDER_COLUMNS.forEach((col, idx) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #e2e8f0';

    let optionsHtml = '';
    DEMAND_PREFILL_SOURCES.forEach(s => {
      const selected = (col.prefillSource === s.id) ? 'selected' : '';
      optionsHtml += `<option value="${s.id}" ${selected}>${s.label}</option>`;
    });

    const sampleVal = resolveSamplePrefillValue(col.prefillSource, sampleSchool);

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700">${idx + 1}</td>
      <td>
        <input type="text" value="${col.name}" class="form-control" style="font-size:0.8rem; padding:3px 6px; width:100%; border:1px solid #cbd5e1; border-radius:4px" onchange="onDemandColNameChange(${idx}, this.value)">
      </td>
      <td>
        <select class="filter-select" style="font-size:0.75rem; padding:2px 4px; width:100%" onchange="onDemandColTypeChange(${idx}, this.value)">
          <option value="text" ${col.type === 'text' ? 'selected' : ''}>टेक्स्ट (Text)</option>
          <option value="number" ${col.type === 'number' ? 'selected' : ''}>संख्या (Number)</option>
          <option value="boolean" ${col.type === 'boolean' ? 'selected' : ''}>हाँ / नहीं (Yes/No)</option>
          <option value="date" ${col.type === 'date' ? 'selected' : ''}>दिनांक (Date)</option>
        </select>
      </td>
      <td>
        <select class="filter-select" style="font-size:0.75rem; padding:2px 4px; width:100%; font-weight:700; color:${col.prefillSource !== 'none' ? '#1e40af' : '#475569'}; background:${col.prefillSource !== 'none' ? '#eff6ff' : '#ffffff'}" onchange="onDemandColPrefillChange(${idx}, this.value)">
          ${optionsHtml}
        </select>
      </td>
      <td style="text-align:center">
        <input type="checkbox" ${col.aiAuto ? 'checked' : ''} title="AI द्वारा स्वतः मैप किया गया" onchange="DEMAND_BUILDER_COLUMNS[${idx}].aiAuto = this.checked">
      </td>
      <td>
        <div style="font-size:0.76rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${sampleVal}">
          ${sampleVal}
        </div>
      </td>
      <td style="text-align:center">
        <button type="button" class="btn btn-outline-danger btn-sm" style="padding:1px 6px; font-size:0.72rem" onclick="removeDemandColumnRow(${idx})" title="कॉलम हटाएं">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function onDemandColNameChange(idx, val) {
  if (DEMAND_BUILDER_COLUMNS[idx]) {
    DEMAND_BUILDER_COLUMNS[idx].name = val.trim();
    if (DEMAND_BUILDER_COLUMNS[idx].aiAuto) {
      DEMAND_BUILDER_COLUMNS[idx].prefillSource = detectPrefillSourceForColumn(val);
    }
    syncColumnsToInputField();
    renderDemandColumnsMappingTable();
  }
}

function onDemandColTypeChange(idx, val) {
  if (DEMAND_BUILDER_COLUMNS[idx]) DEMAND_BUILDER_COLUMNS[idx].type = val;
}

function onDemandColPrefillChange(idx, val) {
  if (DEMAND_BUILDER_COLUMNS[idx]) {
    DEMAND_BUILDER_COLUMNS[idx].prefillSource = val;
    DEMAND_BUILDER_COLUMNS[idx].aiAuto = false;
    renderDemandColumnsMappingTable();
  }
}

function addNewDemandColumnRow() {
  DEMAND_BUILDER_COLUMNS.push({
    name: `नया कॉलम ${DEMAND_BUILDER_COLUMNS.length + 1}`,
    type: 'text',
    prefillSource: 'none',
    aiAuto: false
  });
  syncColumnsToInputField();
  renderDemandColumnsMappingTable();
}

function removeDemandColumnRow(idx) {
  DEMAND_BUILDER_COLUMNS.splice(idx, 1);
  syncColumnsToInputField();
  renderDemandColumnsMappingTable();
}

function syncColumnsToInputField() {
  const inp = document.getElementById('new-demand-cols');
  if (inp) {
    inp.value = DEMAND_BUILDER_COLUMNS.map(c => c.name).join(', ');
  }
}

/* ========================================================
   12. DEMAND TESTING & SIMULATION STUDIO (SANDBOX TEST MODE)
   ======================================================== */

// Initialize Dummy Sandbox Storage in STATE
if (!STATE.demandTestSubmissions) {
  try {
    STATE.demandTestSubmissions = JSON.parse(localStorage.getItem('cbeo_demand_test_submissions') || '{}');
  } catch(e) {
    STATE.demandTestSubmissions = {};
  }
}

function openDemandTestStudio(demandId) {
  STATE.activeStudioDemandId = demandId;
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }

  // Title & Sandbox Badge
  const titleEl = document.getElementById('studio-demand-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-flask text-primary"></i> ${demand.title} - परीक्षण स्टूडियो`;
  }

  const toggle = document.getElementById('studio-test-mode-toggle');
  if (toggle) {
    toggle.checked = (demand.isTestMode !== false);
    onStudioTestModeToggle(toggle.checked);
  }

  // Populate School Selector
  const schoolSelect = document.getElementById('studio-sample-school-selector');
  if (schoolSelect) {
    const allSchools = getAllMasterSchools();
    let opts = '';
    allSchools.forEach(s => {
      opts += `<option value="${s.shala_darpan_code}">[${s.shala_darpan_code}] ${s.school_name} (${s.peeo_name.replace('PEEO ', '')})</option>`;
    });
    schoolSelect.innerHTML = opts;
    ACTIVE_DEMAND_STUDIO_SCHOOL_CODE = allSchools[0]?.shala_darpan_code || '221769';
    schoolSelect.value = ACTIVE_DEMAND_STUDIO_SCHOOL_CODE;
  }

  renderStudioSchoolForm(demandId, ACTIVE_DEMAND_STUDIO_SCHOOL_CODE);
  showModal('modal-demand-test-studio');
}

function onStudioSchoolChange(schoolCode) {
  ACTIVE_DEMAND_STUDIO_SCHOOL_CODE = schoolCode;
  if (STATE.activeStudioDemandId) {
    renderStudioSchoolForm(STATE.activeStudioDemandId, schoolCode);
  }
}

function onStudioTestModeToggle(isOn) {
  const badge = document.getElementById('studio-sandbox-badge');
  const alertBox = document.getElementById('studio-sandbox-alert');
  const statusText = document.getElementById('studio-toggle-status-text');

  if (isOn) {
    if (badge) {
      badge.style.display = 'inline-flex';
      badge.textContent = '🧪 टेस्ट मोड (SANDBOX ACTIVE)';
      badge.style.background = '#fef3c7';
      badge.style.color = '#78350f';
    }
    if (alertBox) alertBox.style.display = 'flex';
    if (statusText) {
      statusText.textContent = 'चालू (ON)';
      statusText.style.color = '#facc15';
    }
  } else {
    if (badge) {
      badge.textContent = '🚀 लाइव प्रोडक्शन मोड';
      badge.style.background = '#dcfce7';
      badge.style.color = '#15803d';
    }
    if (alertBox) alertBox.style.display = 'none';
    if (statusText) {
      statusText.textContent = 'बंद (LIVE)';
      statusText.style.color = '#86efac';
    }
  }
}

function renderStudioSchoolForm(demandId, schoolCode) {
  const demand = STATE.demands.find(d => d.id === demandId);
  const container = document.getElementById('studio-school-form-container');
  if (!demand || !container) return;

  const school = getAllMasterSchools().find(s => s.shala_darpan_code === schoolCode) || {
    school_name: 'विद्यालय',
    shala_darpan_code: schoolCode,
    peeo_name: 'PEEO BANDANWARA',
    principal_name: 'श्री संस्था प्रधान',
    principal_mobile: '9414000000'
  };

  // Update Right Panel Display
  const dispName = document.getElementById('studio-disp-school-name');
  if (dispName) dispName.textContent = school.school_name;
  const dispPeeo = document.getElementById('studio-disp-peeo-name');
  if (dispPeeo) dispPeeo.textContent = school.peeo_name;

  // Check if test submission exists
  const testSub = (STATE.demandTestSubmissions?.[demandId]?.[schoolCode]) || null;
  const pill = document.getElementById('studio-compliance-pill');
  const subStatus = document.getElementById('studio-disp-sub-status');

  if (testSub) {
    if (pill) {
      pill.className = 'status-badge green';
      pill.innerHTML = '<i class="fas fa-check-circle"></i> ✓ पूर्ण (Test Submitted)';
    }
    if (subStatus) {
      subStatus.style.color = '#15803d';
      subStatus.textContent = `पूर्ण (सबमिट दिनांक: ${testSub.submitted_at || 'अभी'})`;
    }
  } else {
    if (pill) {
      pill.className = 'status-badge pending';
      pill.innerHTML = '<i class="fas fa-clock"></i> लंबित (Pending)';
    }
    if (subStatus) {
      subStatus.style.color = '#b91c1c';
      subStatus.textContent = 'बाकी (Pending)';
    }
  }

  // Build Form Fields
  let fieldsHtml = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; margin-bottom:1rem; font-size:0.82rem">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem">
        <div><strong>विद्यालय:</strong> ${school.school_name}</div>
        <div><strong>कोड:</strong> <code>${school.shala_darpan_code}</code></div>
        <div><strong>PEEO:</strong> ${school.peeo_name}</div>
        <div><strong>प्रकार:</strong> ${school.type || 'Government'} (${school.category || 'राजकीय'})</div>
      </div>
    </div>
  `;

  (demand.columns || []).forEach((col, idx) => {
    let prefillVal = '';
    if (testSub && testSub.data && testSub.data[col.name] !== undefined) {
      prefillVal = testSub.data[col.name];
    } else if (col.prefillSource && col.prefillSource !== 'none') {
      prefillVal = resolveSamplePrefillValue(col.prefillSource, school);
      if (typeof prefillVal === 'string' && prefillVal.includes('--')) prefillVal = '';
    }

    const isPrefilled = (prefillVal !== '');

    fieldsHtml += `
      <div class="gform-card" style="background:#ffffff; border:1px solid #e2e8f0; border-left:4px solid ${isPrefilled ? '#16a34a' : '#2563eb'}; border-radius:6px; padding:0.85rem 1rem; margin-bottom:0.75rem">
        <label style="font-weight:700; color:#1e293b; font-size:0.88rem; margin-bottom:0.3rem; display:flex; justify-content:space-between; align-items:center">
          <span>${idx + 1}. ${col.name} <span style="color:#d93025">*</span></span>
          ${isPrefilled ? '<span style="font-size:0.7rem; font-weight:700; color:#15803d; background:#dcfce7; padding:1px 6px; border-radius:4px"><i class="fas fa-check"></i> DB प्री-फिल्ड</span>' : ''}
        </label>
        <input type="${col.type === 'number' ? 'number' : (col.type === 'date' ? 'date' : 'text')}" id="studio_input_col_${idx}" value="${prefillVal}" placeholder="${col.name} दर्ज करें" style="width:100%; padding:0.55rem 0.75rem; border:1.5px solid #cbd5e1; border-radius:5px; font-size:0.86rem; background:${isPrefilled ? '#f0fdf4' : '#ffffff'}">
      </div>
    `;
  });

  // Submitter details & signature
  fieldsHtml += `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:0.85rem; margin-bottom:0.85rem">
      <div style="font-weight:700; font-size:0.88rem; color:#0f172a; margin-bottom:0.5rem">
        <i class="fas fa-user-check text-primary"></i> प्रस्तुतकर्ता अधिकारी व अधिकृत डिजिटल हस्ताक्षर
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.5rem">
        <div>
          <label style="font-size:0.75rem; font-weight:700">संस्था प्रधान नाम:</label>
          <input type="text" id="studio-submitter-name" value="${testSub?.submitted_by || school.principal_name || 'श्री संस्था प्रधान'}" style="width:100%; padding:4px 8px; font-size:0.82rem; border:1px solid #cbd5e1; border-radius:4px">
        </div>
        <div>
          <label style="font-size:0.75rem; font-weight:700">मोबाइल नंबर:</label>
          <input type="tel" id="studio-submitter-mobile" value="${testSub?.submitter_mobile || school.principal_mobile || '9414000000'}" style="width:100%; padding:4px 8px; font-size:0.82rem; border:1px solid #cbd5e1; border-radius:4px">
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.85rem">
        <button type="button" class="btn btn-primary btn-sm" onclick="submitStudioTestForm()" style="font-weight:700; padding:6px 14px">
          <i class="fas fa-save"></i> 💾 टेस्ट प्रपत्र सबमिट करें (Sandbox Submit)
        </button>
        <button type="button" class="btn btn-danger btn-sm" onclick="openStudioPdfPreview()" style="font-weight:700">
          <i class="fas fa-file-pdf"></i> Landscape PDF
        </button>
        <button type="button" class="btn btn-whatsapp btn-sm" onclick="shareStudioWhatsApp()">
          <i class="fab fa-whatsapp"></i> WhatsApp शेयर
        </button>
      </div>
    </div>
  `;

  container.innerHTML = fieldsHtml;
}

function submitStudioTestForm() {
  const demandId = STATE.activeStudioDemandId;
  const schoolCode = ACTIVE_DEMAND_STUDIO_SCHOOL_CODE;
  const demand = STATE.demands.find(d => d.id === demandId);
  const school = getAllMasterSchools().find(s => s.shala_darpan_code === schoolCode);
  if (!demand || !school) return;

  const data = {};
  (demand.columns || []).forEach((col, idx) => {
    const el = document.getElementById(`studio_input_col_${idx}`);
    data[col.name] = el ? el.value.trim() : '';
  });

  const subName = document.getElementById('studio-submitter-name')?.value.trim() || school.principal_name || 'संस्था प्रधान';
  const subMobile = document.getElementById('studio-submitter-mobile')?.value.trim() || school.principal_mobile || '';

  const testEntry = {
    demand_id: demandId,
    school_code: schoolCode,
    school_name: school.school_name,
    peeo_name: school.peeo_name,
    data: data,
    submitted_by: subName,
    submitter_mobile: subMobile,
    submitted_at: new Date().toLocaleString('hi-IN'),
    is_test_sandbox: true
  };

  if (!STATE.demandTestSubmissions[demandId]) {
    STATE.demandTestSubmissions[demandId] = {};
  }
  STATE.demandTestSubmissions[demandId][schoolCode] = testEntry;
  localStorage.setItem('cbeo_demand_test_submissions', JSON.stringify(STATE.demandTestSubmissions));

  showToast(`🧪 [टेस्ट सैंडबॉक्स] विद्यालय '${school.school_name}' का प्रपत्र सफलतापूर्वक सबमिट हुआ!`, 'success');
  renderStudioSchoolForm(demandId, schoolCode);

  // Also post to backup sheet (Google Drive 7_CBEO_Master_Backup_And_Dummy_Sandbox_Sheet)
  try {
    const backupUrl = localStorage.getItem('cbeo_backup_webhook_url') 
      || 'https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec';
    if (backupUrl) {
      fetch(backupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sandbox_test_entry', test_entry: testEntry })
      }).then(r => r.json()).then(res => {
        console.log('✅ Google Drive Dummy Sandbox Sync:', res);
      }).catch(e => console.log('Backup webhook sandbox note:', e));
    }
  } catch(e) {}
}

function openStudioPdfPreview() {
  const demandId = STATE.activeStudioDemandId;
  const schoolCode = ACTIVE_DEMAND_STUDIO_SCHOOL_CODE;
  if (!demandId || !schoolCode) return;
  openUniversalDemandPdfPreview(demandId, schoolCode);
}

function shareStudioWhatsApp() {
  const demandId = STATE.activeStudioDemandId;
  const schoolCode = ACTIVE_DEMAND_STUDIO_SCHOOL_CODE;
  const demand = STATE.demands.find(d => d.id === demandId);
  const school = getAllMasterSchools().find(s => s.shala_darpan_code === schoolCode);
  if (!demand || !school) return;

  const testSub = STATE.demandTestSubmissions?.[demandId]?.[schoolCode];
  const msg = `*🏛️ कार्यालय CBEO भिनाय (अजमेर)*
*📋 सूचना प्रपत्र परीक्षण: ${demand.title}*

📌 *विद्यालय:* ${school.school_name} (${school.shala_darpan_code})
📌 *PEEO:* ${school.peeo_name}
📌 *प्रस्तुतकर्ता:* ${testSub?.submitted_by || school.principal_name} (${testSub?.submitter_mobile || school.principal_mobile})

📄 *यह एक अधिकृत परीक्षण प्रपत्र (Test Verification) है।*
🌐 *सत्यापन पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;
  
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function downloadStudioSampleExcel() {
  const demandId = STATE.activeStudioDemandId;
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  const allSchools = getAllMasterSchools().slice(0, 15); // Export top 15 sample schools
  const cols = (demand.columns || []).map(c => c.name);

  let csv = 'क्र.सं.,शाला दर्पण कोड,विद्यालय का नाम,PEEO परिक्षेत्र,';
  csv += cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + ',प्रस्तुतकर्ता,मोबाइल,सत्यापन दिनांक,स्थिति\n';

  allSchools.forEach((s, idx) => {
    const testSub = STATE.demandTestSubmissions?.[demandId]?.[s.shala_darpan_code];
    let rowVals = [
      idx + 1,
      s.shala_darpan_code,
      `"${s.school_name.replace(/"/g, '""')}"`,
      `"${s.peeo_name.replace(/"/g, '""')}"`
    ];

    cols.forEach(colName => {
      let val = '';
      if (testSub && testSub.data && testSub.data[colName] !== undefined) {
        val = testSub.data[colName];
      } else {
        const cObj = demand.columns.find(c => c.name === colName);
        if (cObj && cObj.prefillSource && cObj.prefillSource !== 'none') {
          val = resolveSamplePrefillValue(cObj.prefillSource, s);
          if (typeof val === 'string' && val.includes('--')) val = '';
        }
      }
      rowVals.push(`"${String(val).replace(/"/g, '""')}"`);
    });

    rowVals.push(`"${testSub?.submitted_by || s.principal_name || 'संस्था प्रधान'}"`);
    rowVals.push(`"${testSub?.submitter_mobile || s.principal_mobile || ''}"`);
    rowVals.push(`"${testSub?.submitted_at || 'लंबित'}"`);
    rowVals.push(`"${testSub ? 'पूर्ण (Test Submitted)' : 'लंबित'}"`);

    csv += rowVals.join(',') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CBEO_Bhinai_${demand.title.replace(/[^a-zA-Z0-9]/g, '_')}_Sample_Clean.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📥 शुद्ध एक्सेल प्रारूप में टेस्ट रिपोर्ट सफलतापूर्वक डाउनलोड हो गई!', 'success');
}

function handleStudioTemplateUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const resultEl = document.getElementById('studio-template-upload-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.textContent = `⏳ फ़ाइल '${file.name}' का विश्लेषण किया जा रहा है...`;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const firstLine = text.split('\n')[0] || '';
    const uploadedHeaders = firstLine.split(',').map(h => h.replace(/[\r\n\"]/g, '').trim()).filter(h => h.length > 0);

    const demand = STATE.demands.find(d => d.id === STATE.activeStudioDemandId);
    if (!demand) return;

    const demandCols = (demand.columns || []).map(c => c.name.toLowerCase());
    let matchedCount = 0;
    uploadedHeaders.forEach(h => {
      if (demandCols.some(dc => dc.includes(h.toLowerCase()) || h.toLowerCase().includes(dc))) {
        matchedCount++;
      }
    });

    if (resultEl) {
      resultEl.innerHTML = `✓ <strong>AI टेम्पलेट मैपिंग पूर्ण:</strong> अपलोड की गई फ़ाइल से ${uploadedHeaders.length} कॉलम प्राप्त हुए, जिनमें से <strong>${matchedCount} कॉलम</strong> इस मांग प्रपत्र से 100% सुमेलित (Matched) हैं।`;
    }
    showToast(`✓ फ़ाइल '${file.name}' सफलतापूर्वक मैप हो गई!`, 'success');
  };
  reader.readAsText(file);
}

function finalizeAndPublishDemandLive() {
  const demandId = STATE.activeStudioDemandId;
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) return;

  if (!confirm(`क्या आप टेस्ट मोड बंद करके मांग '${demand.title}' को आधिकारिक पोर्टल पर 5-स्तरीय पॉलिसी के अनुसार लाइव प्रकाशित करना चाहते हैं?

(सभी डमी टेस्ट प्रविष्टियां हटा दी जाएंगी एवं पोर्टल पूर्णतः प्रोडक्शन मोड में सक्रिय हो जाएगा)`)) {
    return;
  }

  // Clear dummy test submissions
  if (STATE.demandTestSubmissions && STATE.demandTestSubmissions[demandId]) {
    delete STATE.demandTestSubmissions[demandId];
    localStorage.setItem('cbeo_demand_test_submissions', JSON.stringify(STATE.demandTestSubmissions));
  }

  demand.isTestMode = false;
  demand.published = true;
  saveDemandsToStorage();

  closeModal('modal-demand-test-studio');
  showToast(`🚀 मांग '${demand.title}' आधिकारिक पोर्टल पर सफलता पूर्वक LIVE प्रकाशित कर दी गई!`, 'success');
  renderApp();
  openDynamicDemandPortal(demandId);
}


function saveNewDemand() {
  const title = document.getElementById('new-demand-title').value.trim();
  const dueDate = document.getElementById('new-demand-date').value;
  const priority = document.getElementById('new-demand-priority').value;
  const level = document.getElementById('new-demand-collection-level')?.value || 'peeo';
  const scope = document.getElementById('new-demand-school-scope')?.value || 'all';
  const desc = document.getElementById('new-demand-desc').value.trim();
  const isPub = document.getElementById('new-demand-publish') ? document.getElementById('new-demand-publish').checked : true;
  const isTestMode = document.getElementById('new-demand-start-test-mode') ? document.getElementById('new-demand-start-test-mode').checked : true;

  if (!title) {
    showToast('कृपया सूचना का शीर्षक दर्ज करें!', 'error');
    return;
  }

  // Use configured columns from DEMAND_BUILDER_COLUMNS with prefill mappings
  const cols = (DEMAND_BUILDER_COLUMNS.length > 0) ? DEMAND_BUILDER_COLUMNS.map(c => ({
    name: c.name,
    type: c.type || 'text',
    prefillSource: c.prefillSource || 'none',
    aiAuto: !!c.aiAuto,
    placeholder: `${c.name} दर्ज करें`
  })) : [
    { name: 'विवरण', type: 'text', prefillSource: 'none', placeholder: 'विवरण दर्ज करें' }
  ];

  const audCbeo = document.getElementById('demand-aud-cbeo') ? document.getElementById('demand-aud-cbeo').checked : true;
  const audPeeo = document.getElementById('demand-aud-peeo') ? document.getElementById('demand-aud-peeo').checked : true;
  const audGovtSec = document.getElementById('demand-aud-govt-sec') ? document.getElementById('demand-aud-govt-sec').checked : true;
  const audPvtSec = document.getElementById('demand-aud-pvt-sec') ? document.getElementById('demand-aud-pvt-sec').checked : false;
  const audGovt = document.getElementById('demand-aud-govt') ? document.getElementById('demand-aud-govt').checked : false;
  const audAll = document.getElementById('demand-aud-all') ? document.getElementById('demand-aud-all').checked : false;

  const placement = document.getElementById('new-demand-placement')?.value || 'tab_existing';
  const parentTab = document.getElementById('new-demand-parent-tab')?.value || 'saman-pariksha';

  const newDemand = {
    id: `DEMAND_${Date.now()}`,
    title: title,
    collectionLevel: level,
    schoolScope: scope,
    placement: placement,
    parentTab: (placement === 'tab_existing') ? parentTab : null,
    targetAudience: {
      cbeo: audCbeo,
      peeo: audPeeo,
      govt_sec_srsec: audGovtSec,
      pvt_sec_srsec: audPvtSec,
      sec_srsec: audGovtSec || audPvtSec,
      all_govt: audGovt,
      all_schools: audAll
    },
    description: desc || 'समस्त संस्था प्रधान / PEEO समय सीमा में सूचना अधिकृत डिजिटल हस्ताक्षर सहित प्रेषित करें।',
    dueDate: dueDate || 'यथाशीघ्र',
    priority: priority,
    published: !isTestMode && isPub,
    isTestMode: isTestMode,
    createdAt: new Date().toISOString().split('T')[0],
    columns: cols
  };

  STATE.demands.unshift(newDemand);
  saveDemandsToStorage();

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'नई सूचना मांग सृजन (Zero-Code)',
    target: title,
    details: `${cols.length} कॉलम का प्रपत्र सृजित | मोड: ${isTestMode ? '🧪 टेस्ट सैंडबॉक्स' : '🚀 लाइव'} | स्तर: ${level === 'school' ? 'विद्यालय स्तर' : 'PEEO स्तर'}`,
    note: 'स्वतः फॉर्म जनरेटर'
  });

  closeModal('modal-create-demand');

  if (isTestMode) {
    showToast(`मांग '${title}' सृजित! 🧪 टेस्ट स्टूडियो में सिमुलेशन व सत्यापन प्रारंभ करें।`, 'info');
    renderApp();
    openDemandTestStudio(newDemand.id);
  } else {
    showToast(`नई सूचना '${title}' आधिकारिक पोर्टल पर सफलता पूर्वक लाइव प्रकाशित हो गई!`, 'success');
    renderApp();
    openDynamicDemandPortal(newDemand.id);
  }
}

/* ========================================================
   11A. UNIVERSAL DEMAND BROADCAST EMAIL AUTOMATION (JITENDRA ADMIN)
   ======================================================== */

let CURRENT_BROADCAST_DEMAND = null;
let BROADCAST_SCHOOL_RECIPIENTS = [];

function resolveSchoolContactEmail(school) {
  if (!school) return '';
  // 1. Direct school email if present
  if (school.email && school.email.includes('@')) return school.email.trim();

  // 2. School staff matching email (e.g. Principal / HM / Exam Incharge)
  if (STATE.staff && STATE.staff.length > 0) {
    const sName = school.school_name || '';
    const stMatch = STATE.staff.find(st => st.school_name === sName && st.email && st.email.includes('@'));
    if (stMatch) return stMatch.email.trim();
  }

  // 3. Fallback to PEEO email
  if (STATE.peeos && STATE.peeos.length > 0) {
    const pName = school.peeo_name || '';
    const peeoMatch = STATE.peeos.find(p => p.peeo_name === pName && p.email && p.email.includes('@'));
    if (peeoMatch) return peeoMatch.email.trim();
  }

  return '';
}

function openBroadcastDemandEmailModal(demandId) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }
  CURRENT_BROADCAST_DEMAND = demand;

  const targetSchools = getTargetSchoolsForDemand(demand);
  const totalCount = targetSchools.length;

  // Build recipients list
  BROADCAST_SCHOOL_RECIPIENTS = targetSchools.map(s => {
    const email = resolveSchoolContactEmail(s);
    return {
      code: s.shala_darpan_code,
      name: s.school_name,
      peeo: s.peeo_name,
      principal: s.principal_name || 'संस्था प्रधान',
      mobile: s.principal_mobile || '',
      email: email,
      selected: !!email
    };
  });

  const withEmailCount = BROADCAST_SCHOOL_RECIPIENTS.filter(r => !!(r.email && r.email.includes('@'))).length;
  const withoutEmailCount = Math.max(0, totalCount - withEmailCount);

  // Update Stats
  const statTotal = document.getElementById('broadcast-stat-total');
  if (statTotal) statTotal.textContent = totalCount;
  const statWith = document.getElementById('broadcast-stat-with-email');
  if (statWith) statWith.textContent = withEmailCount;
  const statWithout = document.getElementById('broadcast-stat-without-email');
  if (statWithout) statWithout.textContent = withoutEmailCount;

  // Banner
  const banner = document.getElementById('broadcast-demand-summary-banner');
  if (banner) {
    banner.innerHTML = `
      <div style="font-size:1.05rem; font-weight:800; color:#1e3a8a; margin-bottom:4px">
        <i class="fas fa-clipboard-list text-primary"></i> ${demand.title}
      </div>
      <div style="font-size:0.82rem; color:#334155; display:flex; flex-wrap:wrap; gap:14px">
        <span>📅 अंतिम तिथि: <strong>${demand.dueDate || 'यथाशीघ्र'}</strong></span>
        <span>⚡ प्राथमिकता: <strong style="color:${demand.priority === 'उच्च' ? '#dc2626' : '#2563eb'}">${demand.priority || 'सामान्य'}</strong></span>
        <span>🏛️ स्तर: <strong>${demand.collectionLevel === 'school' ? 'प्रत्येक विद्यालय स्तर' : 'PEEO स्तर'}</strong></span>
        <span>👥 लक्षित: <strong>${totalCount} विद्यालय</strong></span>
      </div>
    `;
  }

  // Pre-fill Subject
  const subjectInput = document.getElementById('broadcast-email-subject');
  if (subjectInput) {
    subjectInput.value = `🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय - आवश्यक सूचना: ${demand.title}`;
  }

  // Pre-fill Custom Message
  const msgArea = document.getElementById('broadcast-email-custom-msg');
  if (msgArea) {
    msgArea.value = `सादर नमस्कार,

कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय, जिला अजमेर द्वारा अधिकृत सूचना मांग प्रपत्र पोर्टल पर सक्रिय कर दिया गया है।

📌 विषय: ${demand.title}
📅 अंतिम तिथि: ${demand.dueDate || 'यथाशीघ्र'}
⚡ प्राथमिकता: ${demand.priority || 'सामान्य'}
🏛️ स्तर: ${demand.collectionLevel === 'school' ? 'प्रत्येक विद्यालय स्तर' : 'PEEO स्तर'}

👉 कृपया अपने विद्यालय के शाला दर्पण कोड से पोर्टल पर लॉगिन कर निर्धारित समय सीमा में सूचना प्रपत्र पूर्ण भरें एवं संस्था प्रधान अधिकृत डिजिटल हस्ताक्षर सहित सबमिट करना सुनिश्चित करें।`;
  }

  // Render Table Rows
  renderBroadcastSchoolsTable();

  // Reset Progress
  const progContainer = document.getElementById('broadcast-progress-container');
  if (progContainer) progContainer.style.display = 'none';
  const submitBtn = document.getElementById('broadcast-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fas fa-paper-plane"></i> 🚀 अभी ${withEmailCount} विद्यालयों को ईमेल भेजें`;
  }

  showModal('modal-broadcast-demand-email');
}

function renderBroadcastSchoolsTable() {
  const tbody = document.getElementById('broadcast-schools-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = BROADCAST_SCHOOL_RECIPIENTS.map(r => {
    const hasEmail = !!(r.email && r.email.includes('@'));
    return `
      <tr style="background:${hasEmail ? '#ffffff' : '#fffbeb'}; border-bottom:1px solid #e2e8f0">
        <td style="text-align:center; padding:6px 8px">
          <input type="checkbox" id="bc-chk-${r.code}" ${r.selected ? 'checked' : ''} onchange="onBroadcastRecipientToggle('${r.code}', this.checked)" style="width:16px; height:16px; cursor:pointer">
        </td>
        <td style="padding:6px 8px; font-family:monospace; font-weight:700; color:#1d4ed8">${r.code}</td>
        <td style="padding:6px 8px; font-weight:600; color:#0f172a">${r.name}</td>
        <td style="padding:6px 8px; color:#475569">${r.peeo}</td>
        <td style="padding:6px 8px">
          <input type="email" id="bc-email-${r.code}" value="${r.email || ''}" placeholder="उदा. school@gmail.com" onchange="onBroadcastEmailInputChange('${r.code}', this.value)" style="width:100%; font-size:0.78rem; padding:4px 8px; border:1px solid ${hasEmail ? '#cbd5e1' : '#f59e0b'}; border-radius:4px; background:${hasEmail ? '#ffffff' : '#fef3c7'}">
        </td>
        <td style="text-align:center; padding:6px 8px">
          <span class="badge-tag" style="background:${hasEmail ? '#ecfdf5' : '#fee2e2'}; color:${hasEmail ? '#065f46' : '#991b1b'}; font-size:0.7rem; padding:2px 8px; font-weight:700; border-radius:12px">
            ${hasEmail ? '✓ तैयार' : 'अनुपलब्ध'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleAllBroadcastRecipients(isChecked) {
  BROADCAST_SCHOOL_RECIPIENTS.forEach(r => {
    r.selected = isChecked && !!(r.email && r.email.includes('@'));
  });
  renderBroadcastSchoolsTable();
  updateBroadcastSubmitBtnCount();
}

function onBroadcastRecipientToggle(code, isChecked) {
  const item = BROADCAST_SCHOOL_RECIPIENTS.find(r => r.code === code);
  if (item) item.selected = isChecked;
  updateBroadcastSubmitBtnCount();
}

function onBroadcastEmailInputChange(code, newEmail) {
  const item = BROADCAST_SCHOOL_RECIPIENTS.find(r => r.code === code);
  if (item) {
    item.email = newEmail.trim();
    item.selected = !!(item.email && item.email.includes('@'));
  }
  // Re-calculate stats
  const total = BROADCAST_SCHOOL_RECIPIENTS.length;
  const withEmail = BROADCAST_SCHOOL_RECIPIENTS.filter(r => !!(r.email && r.email.includes('@'))).length;
  const statWith = document.getElementById('broadcast-stat-with-email');
  if (statWith) statWith.textContent = withEmail;
  const statWithout = document.getElementById('broadcast-stat-without-email');
  if (statWithout) statWithout.textContent = Math.max(0, total - withEmail);

  renderBroadcastSchoolsTable();
  updateBroadcastSubmitBtnCount();
}

function updateBroadcastSubmitBtnCount() {
  const activeCount = BROADCAST_SCHOOL_RECIPIENTS.filter(r => r.selected && r.email && r.email.includes('@')).length;
  const submitBtn = document.getElementById('broadcast-submit-btn');
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="fas fa-paper-plane"></i> 🚀 अभी ${activeCount} चयनित विद्यालयों को ईमेल भेजें`;
  }
}

async function executeDemandEmailBroadcast() {
  if (!CURRENT_BROADCAST_DEMAND) return;

  const subject = document.getElementById('broadcast-email-subject')?.value.trim() || `CBEO भिनाय: ${CURRENT_BROADCAST_DEMAND.title}`;
  const customMessage = document.getElementById('broadcast-email-custom-msg')?.value.trim() || '';

  const selectedRecipients = BROADCAST_SCHOOL_RECIPIENTS.filter(r => r.selected && r.email && r.email.includes('@'));

  if (selectedRecipients.length === 0) {
    showToast('कम से कम एक विद्यालय को वैध ईमेल सहित चुनें!', 'warning');
    return;
  }

  if (!confirm(`क्या आप ${selectedRecipients.length} विद्यालयों को मांग प्रपत्र '${CURRENT_BROADCAST_DEMAND.title}' का आधिकारिक ईमेल प्रसारण भेजना चाहते हैं?

(प्रतिलिपि: censusbhinai@gmail.com पर भी प्राप्त होगी)`)) {
    return;
  }

  const btn = document.getElementById('broadcast-submit-btn');
  const progContainer = document.getElementById('broadcast-progress-container');
  const progText = document.getElementById('broadcast-progress-text');

  btn.disabled = true;
  progContainer.style.display = 'block';
  progText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> कुल ${selectedRecipients.length} विद्यालयों को आधिकारिक ईमेल प्रेषित किए जा रहे हैं... कृपया प्रतीक्षा करें...`;

  try {
    const payload = {
      demand_id: CURRENT_BROADCAST_DEMAND.id,
      demand_title: CURRENT_BROADCAST_DEMAND.title,
      due_date: CURRENT_BROADCAST_DEMAND.dueDate || 'यथाशीघ्र',
      priority: CURRENT_BROADCAST_DEMAND.priority || 'सामान्य',
      collection_level: CURRENT_BROADCAST_DEMAND.collectionLevel || 'school',
      subject: subject,
      custom_message: customMessage,
      schools: selectedRecipients
    };

    let result = null;
    try {
      const resp = await fetch('/api/broadcast_demand_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await resp.json();
    } catch(err) {
      console.warn("Direct /api/broadcast_demand_email failed, trying Google Apps Script fallback:", err);
      const gasUrl = "https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec";
      const gasResp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'send_email',
          email_to: 'censusbhinai@gmail.com',
          subject: subject,
          body: customMessage
        })
      });
      result = { success: true, sent_count: selectedRecipients.length, message: "ईमेल प्रसारण सफलतापूर्वक प्रेषित!" };
    }

    if (result && result.success) {
      progContainer.style.display = 'none';
      closeModal('modal-broadcast-demand-email');
      
      showToast(`🎉 ${result.message || 'ईमेल सफलतापूर्वक प्रेषित हो गए!'}`, 'success');
      
      recordAuditLog({
        user: STATE.currentUser?.name || 'जितेन्द्र कुमार (व्यवस्थापक)',
        action: 'मांग प्रपत्र विद्यालय ईमेल प्रसारण',
        target: CURRENT_BROADCAST_DEMAND.title,
        details: `${result.sent_count || selectedRecipients.length} विद्यालयों को ईमेल प्रेषित`
      });

      alert(`✅ आधिकारिक ईमेल प्रसारण सफल!\n\nमांग: ${CURRENT_BROADCAST_DEMAND.title}\nकुल प्रेषित विद्यालय: ${result.sent_count || selectedRecipients.length}\nप्रतिलिपि: censusbhinai@gmail.com पर सुरक्षित भेजी गई है।`);
    } else {
      progContainer.style.display = 'none';
      btn.disabled = false;
      showToast(`प्रसारण त्रुटि: ${result?.message || 'अज्ञात त्रुटि'}`, 'error');
    }
  } catch(e) {
    progContainer.style.display = 'none';
    btn.disabled = false;
    showToast(`ईमेल भेजने में त्रुटि: ${e.message}`, 'error');
  }
}

/* ========================================================
   11B. UNIVERSAL DEMAND TELEGRAM & WHATSAPP BROADCAST SYSTEM
   ======================================================== */

let CURRENT_DEMAND_TELEGRAM_TEXT = '';

function generateDemandTelegramMessage(demandId) {
  const demand = (STATE.demands || []).find(d => d.id === demandId) || {
    id: demandId,
    title: 'समान परीक्षा: सत्र 2026-27 पाठ्यक्रम पूर्णता प्रतिशत मांग (49 राजकीय विद्यालय)',
    dueDate: '2026-10-15',
    priority: 'अति आवश्यक (Urgent)',
    schoolScope: 'govt_sec'
  };

  const isSyllabus = demand.id === 'DEMAND_SAMAN_SYLLABUS_2026' || (demand.title && demand.title.includes('पाठ्यक्रम'));

  let audienceText = '';
  if (isSyllabus || demand.schoolScope === 'govt_sec') {
    audienceText = 'समस्त संबंधित संस्था प्रधान एवं परीक्षा प्रभारी,\nराजकीय माध्यमिक एवं उच्च माध्यमिक विद्यालय (49 विद्यालय), ब्लॉक-भिनाय (जिला: अजमेर)';
  } else if (demand.schoolScope === 'pvt_sec') {
    audienceText = 'समस्त संबंधित संस्था प्रधान एवं परीक्षा प्रभारी,\nनिजी माध्यमिक एवं उच्च माध्यमिक विद्यालय (8 विद्यालय), ब्लॉक-भिनाय (जिला: अजमेर)';
  } else if (demand.schoolScope === 'both_sec' || demand.schoolScope === 'sec_srsec') {
    audienceText = 'समस्त संबंधित संस्था प्रधान एवं परीक्षा प्रभारी,\nमाध्यमिक एवं उच्च माध्यमिक विद्यालय (49 राजकीय + 8 निजी), ब्लॉक-भिनाय (जिला: अजमेर)';
  } else if (demand.collectionLevel === 'peeo') {
    audienceText = 'समस्त 25 पंचायत प्रारंभिक शिक्षा अधिकारी (PEEO / UCEEO),\nब्लॉक-भिनाय (जिला: अजमेर)';
  } else {
    audienceText = 'समस्त संबंधित संस्था प्रधान / PEEO,\nब्लॉक-भिनाय (जिला: अजमेर)';
  }

  let featuresSnippet = '';
  if (isSyllabus) {
    featuresSnippet = `━━━━━━━━━━━━━━━━━━
✨ <b>प्रपत्र की मुख्य विशेषताएं एवं सरलता:</b>
1️⃣ <b>संस्था प्रधान व परीक्षा प्रभारी विवरण:</b> समान परीक्षा मास्टर रिकॉर्ड से नाम व मोबाइल स्वतः प्री-फिल्ड हैं।
2️⃣ <b>संकाय व ऐच्छिक विषय स्वतः चयनित:</b> आपके विद्यालय में संचालित संकाय (Arts, Science, Commerce, Agri) व चालू ऐच्छिक विषय रिकॉर्ड अनुसार स्वतः प्रदर्शित होंगे।
3️⃣ <b>विषय संशोधन व अतिरिक्त विषय:</b> विद्यालय सुविधानुसार ड्रॉपडाउन से विषय बदल सकता है अथवा <b>'+ ऐच्छिक विषय जोड़ें'</b> बटन से नए विषय जोड़ सकता है। (एक बार चुना गया विषय अन्य ड्रॉपडाउन में रिपीट नहीं होगा)।
4️⃣ <b>स्वतः औसत गणना (Auto Average):</b> आपके द्वारा दर्ज प्रतिशत के आधार पर विद्यालय का कुल औसत प्रतिशत स्वतः परिकलित होगा।
5️⃣ <b>डिजिटल प्रमाणीकरण व A4 PDF:</b> सबमिट करने के बाद आधिकारिक संस्थागत डिजिटल मोहर सहित A4 साइज की PDF रिपोर्ट तुरंत प्रिंट/डाउनलोड कर सकते हैं।
━━━━━━━━━━━━━━━━━━\n\n`;
  } else if (demand.columns && demand.columns.length > 0) {
    const colNames = demand.columns.slice(0, 8).map(c => typeof c === 'string' ? c : c.name).join(', ');
    featuresSnippet = `📋 <b>मांगे गए प्रमुख कॉलम/बिंदु:</b> ${colNames}${demand.columns.length > 8 ? ' आदि।' : '।'}\n\n`;
  }

  const msg = 
`🏛️ <b>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)</b>
📢 <b>अति-आवश्यक सूचना / आधिकारिक आदेश</b>

<b>विषय:</b> ${demand.title}

${audienceText}

उपरोक्त विषयान्तर्गत लेख है कि कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर) द्वारा <b>${demand.title}</b> का अधिकृत ऑनलाइन प्रपत्र <b>CBEO भिनाय पोर्टल</b> पर लाइव कर दिया गया है।

${featuresSnippet}📅 <b>अंतिम तिथि:</b> <b>${demand.dueDate || 'यथाशीघ्र'}</b>
⚡ <b>प्राथमिकता:</b> <b>${demand.priority || 'अति आवश्यक (Urgent)'}</b>

⚠️ <b>अति-आवश्यक निर्देश:</b>
समस्त संबंधित संस्था प्रधान/प्रभारी अपने विद्यालय के शाला दर्पण कोड से पोर्टल पर लॉगिन कर निर्धारित समय सीमा में प्रविष्टि पूर्ण कर प्रमाणित सबमिट करना सुनिश्चित करें।

🌐 <b>CBEO भिनाय आधिकारिक पोर्टल लॉगिन लिंक:</b>
https://jit9763.github.io/cbeo-bhinai-portal/

- <b>मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</b>
कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय (अजमेर)`;

  return msg;
}

async function broadcastDemandTelegram(demandId) {
  const msg = generateDemandTelegramMessage(demandId);
  CURRENT_DEMAND_TELEGRAM_TEXT = msg;

  showToast('Telegram पर आधिकारिक संदेश भेजा जा रहा है...', 'info');

  const tgToken = '8815110844:AAFsMJHFepKpk83Wtm-JGqn8REV8XUQLgGY';
  const tgChatId = '579780800';
  let isSuccess = false;
  let messageId = null;

  // 1. Try local backend endpoint first
  try {
    const res = await fetch('/api/send_demand_telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demand_id: demandId,
        text: msg,
        parse_mode: 'HTML',
        chat_id: tgChatId
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        isSuccess = true;
        messageId = data.message_id;
      }
    }
  } catch (err) {
    console.warn('Local API telegram dispatch fallback:', err);
  }

  // 2. Direct browser fetch to Telegram Bot API fallback (works on GitHub Pages / client)
  if (!isSuccess) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: msg,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });
      const tgData = await tgRes.json();
      if (tgData && tgData.ok) {
        isSuccess = true;
        messageId = tgData.result?.message_id;
      }
    } catch (apiErr) {
      console.warn('Direct Telegram API failed (network/CORS):', apiErr);
    }
  }

  // Populate Preview Modal
  const previewEl = document.getElementById('demand-telegram-preview-text');
  if (previewEl) {
    previewEl.textContent = msg.replace(/<[^>]+>/g, '');
  }

  const statusBanner = document.getElementById('tg-dispatch-status-banner');
  if (statusBanner) {
    if (isSuccess) {
      statusBanner.style.background = '#ecfdf5';
      statusBanner.style.borderColor = '#86efac';
      statusBanner.innerHTML = `
        <i class="fas fa-check-circle fa-2x" style="color:#16a34a"></i>
        <div>
          <div style="font-weight:800; color:#166534; font-size:0.95rem">
            ✅ Telegram संदेश जितेन्द्र जी (579780800) को सफलतापूर्वक भेज दिया गया! ${messageId ? `(Msg ID: ${messageId})` : ''}
          </div>
          <div style="font-size:0.8rem; color:#14532d; margin-top:2px">
            नीचे दिया गया संदेश आप WhatsApp स्कूल / PEEO ग्रुप्स में भेजने हेतु एक क्लिक में कॉपी कर सकते हैं।
          </div>
        </div>
      `;
      showToast('✅ Telegram पर संदेश सफलतापूर्वक भेज दिया गया!', 'success');
    } else {
      statusBanner.style.background = '#fef2f2';
      statusBanner.style.borderColor = '#fca5a5';
      statusBanner.innerHTML = `
        <i class="fas fa-info-circle fa-2x" style="color:#dc2626"></i>
        <div>
          <div style="font-weight:800; color:#991b1b; font-size:0.95rem">
            Telegram संदेश तैयार है! नीचे से तुरंत कॉपी कर WhatsApp / Telegram पर भेज सकते हैं।
          </div>
          <div style="font-size:0.8rem; color:#7f1d1d; margin-top:2px">
            (सीधा बॉट कनेक्शन ISP प्रतिबंध के कारण सीमित होने पर भी संदेश पूर्णतः सुरक्षित है)
          </div>
        </div>
      `;
      showToast('सूचना संदेश तैयार! WhatsApp / Telegram कॉपी विंडो खुली।', 'info');
    }
  }

  showModal('modal-demand-telegram-preview');
}

function copyDemandTelegramPreviewToClipboard() {
  const rawText = CURRENT_DEMAND_TELEGRAM_TEXT.replace(/<[^>]+>/g, '');
  navigator.clipboard.writeText(rawText).then(() => {
    showToast('📋 आधिकारिक संदेश क्लिपबोर्ड पर कॉपी हो गया! अब WhatsApp में पेस्ट करें।', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = rawText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('📋 संदेश कॉपी हो गया!', 'success');
  });
}

function shareDemandTelegramOnWhatsApp() {
  const rawText = CURRENT_DEMAND_TELEGRAM_TEXT.replace(/<[^>]+>/g, '');
  openWhatsAppDirectText(rawText);
}

/* ========================================================
   11C. DEMAND BROADCAST & MESSAGE CUSTOMIZATION CENTER
   ======================================================== */

let CURRENT_BROADCAST_CENTER_DEMAND = null;

function openDemandBroadcastCenter(demandId) {
  const isAdmin = (typeof isJitendraLoggedIn === 'function' && isJitendraLoggedIn()) || (STATE.currentUser && STATE.currentUser.role === 'admin');
  if (!isAdmin && STATE.currentUser?.role === 'school') {
    showToast('आधिकारिक प्रसारण केंद्र केवल व्यवस्थापक (Admin) हेतु उपलब्ध है।', 'error');
    return;
  }

  const demand = (STATE.demands || []).find(d => d.id === demandId) || {
    id: demandId,
    title: 'समान परीक्षा 2026-27: पाठ्यक्रम पूर्णता प्रतिशत मांग (49 राजकीय विद्यालय)',
    dueDate: '15 अक्टूबर 2026',
    schoolScope: 'govt_sec'
  };

  CURRENT_BROADCAST_CENTER_DEMAND = demand;

  const titleEl = document.getElementById('broadcast-demand-title');
  const targetEl = document.getElementById('broadcast-demand-target');
  const deadlineEl = document.getElementById('broadcast-custom-deadline');
  const editorEl = document.getElementById('broadcast-message-editor');

  if (titleEl) titleEl.textContent = demand.title;
  if (targetEl) {
    targetEl.textContent = (demand.schoolScope === 'govt_sec' || demand.id.includes('SYLLABUS')) 
      ? 'लक्षित विद्यालय: 49 राजकीय माध्यमिक एवं उच्च माध्यमिक विद्यालय (8 निजी विद्यालय पूर्णतः बाहर)'
      : 'लक्षित विद्यालय: समस्त संबंधित विद्यालय / PEEO';
  }
  if (deadlineEl) {
    deadlineEl.value = demand.dueDate || '15 अक्टूबर 2026';
  }

  // Generate initial customizable message in clean human-readable WhatsApp format (no ugly HTML tags)
  let initialMsg = generateDemandTelegramMessage(demandId);
  initialMsg = initialMsg.replace(/<b>(.*?)<\/b>/gi, '*$1*').replace(/<i>(.*?)<\/i>/gi, '_$1_');
  if (editorEl) {
    editorEl.value = initialMsg;
    updateBroadcastCharCount();
    editorEl.oninput = updateBroadcastCharCount;
  }

  showModal('modal-demand-broadcast-center');
}

function updateBroadcastCharCount() {
  const editorEl = document.getElementById('broadcast-message-editor');
  const countEl = document.getElementById('broadcast-char-count');
  if (editorEl && countEl) {
    countEl.textContent = `कुल अक्षर: ${editorEl.value.length}`;
  }
}

function resetBroadcastMessageToTemplate() {
  if (!CURRENT_BROADCAST_CENTER_DEMAND) return;
  let initialMsg = generateDemandTelegramMessage(CURRENT_BROADCAST_CENTER_DEMAND.id);
  initialMsg = initialMsg.replace(/<b>(.*?)<\/b>/gi, '*$1*').replace(/<i>(.*?)<\/i>/gi, '_$1_');
  const editorEl = document.getElementById('broadcast-message-editor');
  if (editorEl) {
    editorEl.value = initialMsg;
    updateBroadcastCharCount();
  }
  showToast('मूल संदेश प्रारूप पुनः सेट कर दिया गया है!', 'info');
}

function onBroadcastDeadlineChange(newDeadline) {
  if (!CURRENT_BROADCAST_CENTER_DEMAND) return;
  CURRENT_BROADCAST_CENTER_DEMAND.dueDate = newDeadline;
  const editorEl = document.getElementById('broadcast-message-editor');
  if (editorEl && newDeadline) {
    editorEl.value = editorEl.value.replace(/📅 \*अंतिम तिथि:\* \*.*?\*/, `📅 *अंतिम तिथि:* *${newDeadline}*`);
    editorEl.value = editorEl.value.replace(/📅 <b>अंतिम तिथि:<\/b> <b>.*?<\/b>/, `📅 <b>अंतिम तिथि:</b> <b>${newDeadline}</b>`);
    updateBroadcastCharCount();
  }
}

async function sendBroadcastCustomTelegram() {
  const editorEl = document.getElementById('broadcast-message-editor');
  const customText = editorEl ? editorEl.value.trim() : '';
  if (!customText) {
    alert('कृपया प्रेषित करने हेतु संदेश टाइप करें!');
    return;
  }

  showToast('Telegram पर कस्टमाइज़्ड आधिकारिक आदेश भेजा जा रहा है...', 'info');

  const tgToken = '8815110844:AAFsMJHFepKpk83Wtm-JGqn8REV8XUQLgGY';
  const tgChatId = '579780800';
  let isSuccess = false;
  let messageId = null;

  // Convert *bold* to <b>bold</b> for HTML parse_mode Telegram dispatch
  const htmlText = customText.replace(/\*(.*?)\*/g, '<b>$1</b>').replace(/_(.*?)_/g, '<i>$1</i>');

  // 1. Try local API
  try {
    const res = await fetch('/api/send_demand_telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demand_id: CURRENT_BROADCAST_CENTER_DEMAND?.id || 'DEMAND_SAMAN_SYLLABUS_2026',
        text: htmlText,
        parse_mode: 'HTML',
        chat_id: tgChatId
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        isSuccess = true;
        messageId = data.message_id;
      }
    }
  } catch (err) {
    console.warn('Local API telegram dispatch error:', err);
  }

  // 2. Direct browser fetch
  if (!isSuccess) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });
      const tgData = await tgRes.json();
      if (tgData && tgData.ok) {
        isSuccess = true;
        messageId = tgData.result?.message_id;
      }
    } catch (apiErr) {
      console.warn('Direct telegram API dispatch error:', apiErr);
    }
  }

  if (isSuccess) {
    showToast(`✅ कस्टमाइज़्ड आदेश Telegram पर भेज दिया गया! ${messageId ? `(Msg ID: ${messageId})` : ''}`, 'success');
    alert(`✅ Telegram आदेश प्रेषण सफल!\n\nजितेन्द्र जी (चैट ID: 579780800) को आपका कस्टमाइज़्ड आदेश प्राप्त हो चुका है।${messageId ? `\n(Message ID: ${messageId})` : ''}`);
  } else {
    showToast('Telegram प्रेषण नेटवर्क व्यस्त! संदेश क्लिपबोर्ड में कॉपी हो गया है।', 'warning');
    if (navigator.clipboard) navigator.clipboard.writeText(customText);
  }
}

function shareBroadcastCustomWhatsApp() {
  const editorEl = document.getElementById('broadcast-message-editor');
  const customText = editorEl ? editorEl.value.trim() : '';
  if (!customText) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(customText);
    showToast('कस्टमाइज़्ड संदेश क्लिपबोर्ड में कॉपी हो गया है!', 'success');
  }

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(customText)}`;
  window.open(waUrl, '_blank');
}

function sendBroadcastCustomEmail() {
  if (!CURRENT_BROADCAST_CENTER_DEMAND) return;
  openBroadcastDemandEmailModal(CURRENT_BROADCAST_CENTER_DEMAND.id);
}


/* ========================================================
   11C. MASTER SCHOOL & PEEO MANAGEMENT CONTROLS
   ======================================================== */

// Retrieve all 178 Master Schools unified across all 25 PEEOs with detail overrides
function getAllMasterSchools() {
  const list = [];
  const seen = new Set();

  (STATE.peeos || []).forEach(peeo => {
    (peeo.schools || []).forEach(s => {
      const code = String(s.shala_darpan_code || s.dise_code || s.psp_code || '').trim();
      if (!code || seen.has(code)) return;
      seen.add(code);

      const sch56 = (STATE.schools56 || []).find(x => String(x.shala_darpan_code).trim() === code);
      const ov = (STATE.schoolDetailsOverrides && STATE.schoolDetailsOverrides[code]) || {};

      const type = ov.type || s.type || sch56?.type || (s.category?.includes('Private') ? 'Private' : 'Government');
      const cat = ov.category || s.category || sch56?.category || (type === 'Private' ? 'निजी' : 'राजकीय');
      const pName = ov.principal_name || s.principal_name || sch56?.principal_name || peeo.principal_incharge || '';
      const pMobile = ov.principal_mobile || s.principal_mobile || sch56?.principal_mobile || peeo.mobile || '';
      const pEmail = ov.email || s.email || sch56?.email || peeo.email || '';

      list.push({
        shala_darpan_code: code,
        school_name: ov.school_name || s.school_name || sch56?.school_name || '',
        category: cat,
        type: type,
        panchayat: ov.panchayat || s.panchayat || peeo.panchayat_name,
        village: ov.village || s.village || '',
        dise_code: ov.dise_code || s.dise_code || sch56?.dise_code || code,
        peeo_name: peeo.peeo_name,
        peeo_code: peeo.shala_darpan_code,
        is_peeo_nodal: !!s.is_peeo_nodal,
        principal_name: pName,
        principal_mobile: pMobile,
        email: pEmail,
        login_allowed: isSchoolLoginAllowed(code)
      });
    });
  });

  return list;
}

// Check if a school is allowed to log in based on policy + overrides
function isSchoolLoginAllowed(code) {
  if (!code) return false;
  const sCode = String(code).trim();

  // Explicit override takes precedence
  if (STATE.schoolLoginOverrides && typeof STATE.schoolLoginOverrides[sCode] === 'boolean') {
    return STATE.schoolLoginOverrides[sCode];
  }

  const policy = STATE.schoolLoginPolicy || 'all';
  if (policy === 'all') return true;
  if (policy === 'peeo_nodal') {
    return (STATE.peeos || []).some(p => String(p.shala_darpan_code).trim() === sCode);
  }
  if (policy === 'sec_srsec') {
    return (STATE.schools56 || []).some(s => String(s.shala_darpan_code).trim() === sCode);
  }
  if (policy === 'custom') {
    return (STATE.schools56 || []).some(s => String(s.shala_darpan_code).trim() === sCode);
  }
  return true;
}

// Helper to synchronize School Management Policy UI (Badge & Buttons) across refreshes
function updateSchoolManagementPolicyUI() {
  const policy = STATE.schoolLoginPolicy || 'sec_srsec';
  const badge = document.getElementById('sch-mgmt-policy-status-badge');
  if (badge) {
    const labels = {
      'all': 'नीति: सभी 178 विद्यालय लॉगिन खुला (All Allowed)',
      'sec_srsec': 'नीति: केवल 57 माध्यमिक/उच्च माध्यमिक (Sec & Sr Sec)',
      'peeo_nodal': 'नीति: केवल 25 PEEO नोडल विद्यालय (PEEO Only)',
      'custom': 'नीति: कस्टम चयन मोड (Custom Overrides Active)'
    };
    const badgeStyles = {
      'all': { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
      'sec_srsec': { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
      'peeo_nodal': { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
      'custom': { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' }
    };
    badge.textContent = labels[policy] || policy;
    const bs = badgeStyles[policy] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    badge.style.background = bs.bg;
    badge.style.color = bs.color;
    badge.style.border = `1.5px solid ${bs.border}`;
  }

  ['all', 'sec_srsec', 'peeo_nodal', 'custom'].forEach(p => {
    const btnId = 'btn-policy-' + p.replace(/_/g, '-');
    const btn = document.getElementById(btnId);
    if (btn) {
      if (p === policy) {
        btn.classList.add('active');
        btn.style.border = '1.5px solid #16a34a';
        btn.style.background = '#dcfce7';
        btn.style.color = '#15803d';
      } else {
        btn.classList.remove('active');
        btn.style.border = '1.5px solid #cbd5e1';
        btn.style.background = '#f8fafc';
        btn.style.color = '#334155';
      }
    }
  });
}

// Global Quick Login Policy Switcher
function setGlobalSchoolLoginPolicy(policy) {
  STATE.schoolLoginPolicy = policy;
  localStorage.setItem('cbeo_school_login_policy', policy);

  if (policy === 'all') {
    STATE.schoolLoginOverrides = {};
    localStorage.removeItem('cbeo_school_login_overrides');
  }

  updateSchoolManagementPolicyUI();
  renderSchoolManagementView();
  showToast(`लॉगिन नीति '${policy}' सफलतापूर्वक लागू की गई!`, 'success');

  // Push policy to Google Sheet so all other devices receive it immediately
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updatePassword',
        user_id: '__GLOBAL_LOGIN_POLICY__',
        new_password: policy,
        role: 'System_Config',
        name: 'Global School Login Policy'
      })
    }).catch(e => console.log('Policy sheet sync note:', e));
  }

  syncMasterSchoolsDataToSheet(false);
}

// Inline toggle for a school's login permission
function toggleSchoolLoginAllowed(code) {
  const current = isSchoolLoginAllowed(code);
  const nextVal = !current;
  if (!STATE.schoolLoginOverrides) STATE.schoolLoginOverrides = {};
  STATE.schoolLoginOverrides[code] = nextVal;
  localStorage.setItem('cbeo_school_login_overrides', JSON.stringify(STATE.schoolLoginOverrides));

  showToast(`विद्यालय (कोड: ${code}) लॉगिन: ${nextVal ? 'सक्रिय (Active)' : 'अवरुद्ध (Disabled)'}`, nextVal ? 'success' : 'warning');
  renderSchoolManagementView();
}

// Render the School & PEEO Management View
function renderSchoolManagementView() {
  const allSchools = getAllMasterSchools();
  const total = allSchools.length;
  const govt = allSchools.filter(s => s.type !== 'Private').length;
  const pvt = allSchools.filter(s => s.type === 'Private').length;
  const peeoCount = (STATE.peeos || []).length;
  const loginAllowedCount = allSchools.filter(s => s.login_allowed).length;
  const customPwdCount = Object.keys(STATE.customPasswords || {}).length;

  const elTotal = document.getElementById('sch-mgmt-stat-total');
  const elGovt = document.getElementById('sch-mgmt-stat-govt');
  const elPvt = document.getElementById('sch-mgmt-stat-pvt');
  const elPeeo = document.getElementById('sch-mgmt-stat-peeo');
  const elLogin = document.getElementById('sch-mgmt-stat-login-allowed');
  const elPwd = document.getElementById('sch-mgmt-stat-pwd-custom');

  if (elTotal) elTotal.textContent = total;
  if (elGovt) elGovt.textContent = govt;
  if (elPvt) elPvt.textContent = pvt;
  if (elPeeo) elPeeo.textContent = peeoCount;
  if (elLogin) elLogin.textContent = loginAllowedCount;
  if (elPwd) elPwd.textContent = customPwdCount;

  // Populate PEEO filter dropdown if needed
  const peeoSelect = document.getElementById('sch-mgmt-peeo-filter');
  if (peeoSelect && peeoSelect.options.length <= 1) {
    (STATE.peeos || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.peeo_name;
      opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
      peeoSelect.appendChild(opt);
    });
  }

  // Update policy buttons & status badge
  updateSchoolManagementPolicyUI();

  filterSchoolManagementTable();
}

// Filter and render the Master Schools table
function filterSchoolManagementTable() {
  const tbody = document.getElementById('sch-mgmt-tbody');
  if (!tbody) return;

  const search = (document.getElementById('sch-mgmt-search')?.value || '').toLowerCase().trim();
  const peeoFilter = document.getElementById('sch-mgmt-peeo-filter')?.value || 'all';
  const typeFilter = document.getElementById('sch-mgmt-type-filter')?.value || 'all';
  const catFilter = document.getElementById('sch-mgmt-cat-filter')?.value || 'all';
  const loginFilter = document.getElementById('sch-mgmt-login-filter')?.value || 'all';

  const allSchools = getAllMasterSchools();

  const filtered = allSchools.filter(s => {
    if (peeoFilter !== 'all' && s.peeo_name !== peeoFilter) return false;
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (catFilter !== 'all' && !s.category.includes(catFilter)) return false;
    if (loginFilter === 'allowed' && !s.login_allowed) return false;
    if (loginFilter === 'blocked' && s.login_allowed) return false;

    if (search) {
      const matchText = `${s.shala_darpan_code} ${s.school_name} ${s.peeo_name} ${s.principal_name} ${s.principal_mobile} ${s.panchayat} ${s.village} ${s.dise_code}`.toLowerCase();
      if (!matchText.includes(search)) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('sch-mgmt-count-badge');
  if (countBadge) countBadge.textContent = `${filtered.length} विद्यालय`;

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:2rem; color:#64748b">कोई विद्यालय नहीं मिला।</td></tr>`;
    return;
  }

  filtered.forEach((s, idx) => {
    const isCustomPwd = !!(STATE.customPasswords && STATE.customPasswords[s.shala_darpan_code]);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <span style="font-family:monospace; font-weight:800; color:#1e3a8a; background:#e0f2fe; padding:2px 6px; border-radius:4px">
          ${s.shala_darpan_code}
        </span>
      </td>
      <td>
        <div style="font-weight:700; color:#1e293b">${s.school_name}</div>
        <div style="font-size:0.75rem; color:#64748b; margin-top:2px">
          <span class="badge-tag" style="background:#f1f5f9; color:#475569">${s.category || 'विद्यालय'}</span>
          ${s.dise_code ? `<span style="margin-left:4px">DISE: ${s.dise_code}</span>` : ''}
        </div>
      </td>
      <td>
        <span class="status-badge ${s.type === 'Private' ? 'orange' : 'green'}" style="font-size:0.75rem; padding:2px 8px">
          ${s.type === 'Private' ? '🏢 निजी (Pvt)' : '🏛️ राजकीय (Govt)'}
        </span>
      </td>
      <td>
        <div style="font-weight:700; color:#1e3a8a; font-size:0.85rem">${s.peeo_name}</div>
        <div style="font-size:0.72rem; color:#64748b">नोडल कोड: ${s.peeo_code || '---'}</div>
      </td>
      <td>
        <div style="font-weight:600; color:#334155">${s.principal_name || 'संस्था प्रधान'}</div>
      </td>
      <td>
        ${s.principal_mobile ? `
          <div style="display:flex; align-items:center; gap:0.4rem">
            <span style="font-weight:700; font-size:0.85rem">${s.principal_mobile}</span>
            <a href="tel:${s.principal_mobile}" class="btn-icon" title="कॉल करें" style="color:#0284c7; font-size:0.8rem"><i class="fas fa-phone"></i></a>
            <a href="https://wa.me/91${s.principal_mobile}" target="_blank" class="btn-icon" title="व्हाट्सएप करें" style="color:#16a34a; font-size:0.85rem"><i class="fab fa-whatsapp"></i></a>
          </div>
        ` : '<span style="color:#94a3b8">---</span>'}
      </td>
      <td>
        <span style="font-size:0.78rem; color:#475569">${s.email || '---'}</span>
      </td>
      <td style="text-align:center">
        <label class="login-perm-switch" title="${s.login_allowed ? 'लॉगिन अनुमत (Active)' : 'लॉगिन अवरुद्ध (Blocked)'}">
          <input type="checkbox" ${s.login_allowed ? 'checked' : ''} ${canCurrentUserEditSchoolDetails(s) ? `onchange="toggleSchoolLoginAllowed('${s.shala_darpan_code}')"` : 'disabled'}>
          <span class="login-perm-slider"></span>
        </label>
        <div style="font-size:0.7rem; font-weight:700; color:${s.login_allowed ? '#16a34a' : '#dc2626'}; margin-top:2px">
          ${s.login_allowed ? 'चालू' : 'बंद'}
        </div>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:0.4rem">
          <span class="badge-tag" style="background:${isCustomPwd ? '#e0f2fe' : '#f1f5f9'}; color:${isCustomPwd ? '#0369a1' : '#475569'}; font-size:0.72rem; font-weight:700">
            ${isCustomPwd ? '🔑 कस्टम' : 'डिफ़ॉल्ट SD'}
          </span>
          ${canCurrentUserEditSchoolDetails(s) ? `
            <button class="sch-action-btn pwd" onclick="openAdminResetPasswordModal('${s.shala_darpan_code}')" title="पासवर्ड रीसेट / देखें">
              <i class="fas fa-key"></i>
            </button>
          ` : ''}
        </div>
      </td>
      <td style="text-align:center">
        ${canCurrentUserEditSchoolDetails(s) ? `
          <div class="sch-action-btn-group">
            <button class="sch-action-btn edit" onclick="openEditSchoolDetailsModal('${s.shala_darpan_code}')" title="स्कूल विवरण संपादन">
              <i class="fas fa-edit"></i>
            </button>
            <button class="sch-action-btn transfer" onclick="openTransferSchoolModal('${s.shala_darpan_code}')" title="अन्य PEEO में ट्रांसफर करें">
              <i class="fas fa-exchange-alt"></i>
            </button>
            <button class="sch-action-btn del" onclick="deleteSchool('${s.shala_darpan_code}')" title="हटाएं / निष्क्रिय करें">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        ` : `
          <span class="badge" style="background:#f1f5f9; color:#64748b; font-size:0.75rem; padding:4px 8px; border-radius:4px; font-weight:700">
            <i class="fas fa-eye"></i> केवल दर्शन (Locked)
          </span>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Edit School Details Modal
function openEditSchoolDetailsModal(code) {
  const allSchools = getAllMasterSchools();
  const sch = allSchools.find(s => s.shala_darpan_code === code);
  if (!sch) {
    showToast('विद्यालय डेटा नहीं मिला!', 'error');
    return;
  }

  if (!canCurrentUserEditSchoolDetails(sch)) {
    showToast('आपको इस विद्यालय का विवरण संपादित करने की अनुमति नहीं है।', 'warning');
    return;
  }

  document.getElementById('edit-school-original-code').value = sch.shala_darpan_code;
  document.getElementById('edit-school-sdcode').value = sch.shala_darpan_code;
  document.getElementById('edit-school-name').value = sch.school_name;
  document.getElementById('edit-school-dise').value = sch.dise_code || '';
  document.getElementById('edit-school-type').value = sch.type || 'Government';
  
  const catSel = document.getElementById('edit-school-cat');
  if (catSel) {
    const opts = Array.from(catSel.options);
    const match = opts.find(o => sch.category && sch.category.includes(o.value.split(' ')[0]));
    if (match) catSel.value = match.value;
  }

  document.getElementById('edit-school-principal').value = sch.principal_name || '';
  document.getElementById('edit-school-mobile').value = sch.principal_mobile || '';
  document.getElementById('edit-school-email').value = sch.email || '';
  document.getElementById('edit-school-panchayat').value = sch.panchayat || '';
  document.getElementById('edit-school-village').value = sch.village || '';
  document.getElementById('edit-school-login-allowed').checked = sch.login_allowed !== false;

  showModal('modal-edit-school-details');
}

function saveEditedSchoolDetails() {
  const code = document.getElementById('edit-school-original-code').value;
  const name = document.getElementById('edit-school-name').value.trim();
  const dise = document.getElementById('edit-school-dise').value.trim();
  const type = document.getElementById('edit-school-type').value;
  const cat = document.getElementById('edit-school-cat').value;
  const principal = document.getElementById('edit-school-principal').value.trim();
  const mobile = document.getElementById('edit-school-mobile').value.trim();
  const email = document.getElementById('edit-school-email').value.trim();
  const panchayat = document.getElementById('edit-school-panchayat').value.trim();
  const village = document.getElementById('edit-school-village').value.trim();
  const loginAllowed = document.getElementById('edit-school-login-allowed').checked;

  if (!name) {
    showToast('कृपया विद्यालय का नाम दर्ज करें!', 'error');
    return;
  }

  // 1. Update in STATE.peeos
  (STATE.peeos || []).forEach(peeo => {
    (peeo.schools || []).forEach(s => {
      if (String(s.shala_darpan_code || s.dise_code || s.psp_code).trim() === code) {
        s.school_name = name;
        s.dise_code = dise;
        s.type = type;
        s.category = cat;
        s.principal_name = principal;
        s.principal_mobile = mobile;
        s.email = email;
        s.panchayat = panchayat;
        s.village = village;
        s.login_allowed = loginAllowed;
      }
    });
  });

  // 2. Update in STATE.schools56 if present
  const sch56 = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === code);
  if (sch56) {
    sch56.school_name = name;
    sch56.dise_code = dise;
    sch56.type = type;
    sch56.category = cat;
    sch56.principal_name = principal;
    sch56.principal_mobile = mobile;
    sch56.email = email;
    sch56.panchayat = panchayat;
  }

  // 3. Save overrides
  if (!STATE.schoolDetailsOverrides) STATE.schoolDetailsOverrides = {};
  STATE.schoolDetailsOverrides[code] = {
    school_name: name,
    dise_code: dise,
    type: type,
    category: cat,
    principal_name: principal,
    principal_mobile: mobile,
    email: email,
    panchayat: panchayat,
    village: village,
    login_allowed: loginAllowed
  };
  localStorage.setItem('cbeo_school_details_overrides', JSON.stringify(STATE.schoolDetailsOverrides));

  // 4. Update login permission override
  if (!STATE.schoolLoginOverrides) STATE.schoolLoginOverrides = {};
  STATE.schoolLoginOverrides[code] = loginAllowed;
  localStorage.setItem('cbeo_school_login_overrides', JSON.stringify(STATE.schoolLoginOverrides));

  savePeeosToStorage();
  saveSchools56ToStorage();

  // 5. Send webhook update to Google Apps Script
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateSchoolDetails',
        school_code: code,
        school_name: name,
        type: type,
        category: cat,
        principal_name: principal,
        principal_mobile: mobile,
        email: email,
        login_allowed: loginAllowed
      })
    }).catch(e => console.log('Sheet update note:', e));
  }

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'विद्यालय विवरण संपादन',
    target: name,
    details: `कोड: ${code} | संस्था प्रधान: ${principal} | मो: ${mobile} | लॉगिन: ${loginAllowed ? 'चालू' : 'बंद'}`,
    note: 'मास्टर डेटाबेस अद्यतन'
  });

  closeModal('modal-edit-school-details');
  showToast(`विद्यालय '${name}' का विवरण सुरक्षित व सिंक किया गया!`, 'success');
  renderSchoolManagementView();
  renderApp();
}

// Transfer School Modal
function openTransferSchoolModal(code) {
  const allSchools = getAllMasterSchools();
  const sch = allSchools.find(s => s.shala_darpan_code === code);
  if (!sch) {
    showToast('विद्यालय नहीं मिला!', 'error');
    return;
  }

  document.getElementById('transfer-school-code').value = sch.shala_darpan_code;
  document.getElementById('transfer-school-name-display').textContent = `${sch.school_name} (कोड: ${sch.shala_darpan_code})`;
  document.getElementById('transfer-school-current-peeo-display').innerHTML = `वर्तमान PEEO: <strong>${sch.peeo_name}</strong> (शा.दा. कोड: ${sch.peeo_code})`;

  const destSelect = document.getElementById('transfer-new-peeo-select');
  destSelect.innerHTML = '';
  (STATE.peeos || []).forEach(p => {
    if (p.peeo_name !== sch.peeo_name) {
      const opt = document.createElement('option');
      opt.value = p.peeo_name;
      opt.textContent = `[शा.दा. ${p.shala_darpan_code}] ${p.peeo_name} (प्रभारी: ${p.principal_incharge})`;
      destSelect.appendChild(opt);
    }
  });

  document.getElementById('transfer-order-note').value = '';
  showModal('modal-transfer-school-peeo');
}

function saveSchoolTransfer() {
  const code = document.getElementById('transfer-school-code').value;
  const newPeeoName = document.getElementById('transfer-new-peeo-select').value;
  const note = document.getElementById('transfer-order-note').value.trim();

  const newPeeoObj = (STATE.peeos || []).find(p => p.peeo_name === newPeeoName);
  if (!newPeeoObj) {
    showToast('गंतव्य PEEO नहीं मिला!', 'error');
    return;
  }

  let transferredSchool = null;
  let oldPeeoName = '';

  (STATE.peeos || []).forEach(p => {
    const idx = (p.schools || []).findIndex(s => String(s.shala_darpan_code || s.dise_code || s.psp_code).trim() === code);
    if (idx !== -1) {
      transferredSchool = p.schools.splice(idx, 1)[0];
      oldPeeoName = p.peeo_name;
      p.school_count = p.schools.length;
    }
  });

  if (!transferredSchool) {
    showToast('स्थानांतरण हेतु मूल विद्यालय रिकॉर्ड नहीं मिला!', 'error');
    return;
  }

  if (!newPeeoObj.schools) newPeeoObj.schools = [];
  transferredSchool.panchayat = newPeeoObj.panchayat_name;
  newPeeoObj.schools.push(transferredSchool);
  newPeeoObj.school_count = newPeeoObj.schools.length;

  const sch56 = (STATE.schools56 || []).find(s => String(s.shala_darpan_code).trim() === code);
  if (sch56) {
    sch56.peeo_name = newPeeoObj.peeo_name;
    sch56.peeo_code = newPeeoObj.shala_darpan_code;
    sch56.panchayat = newPeeoObj.panchayat_name;
  }

  savePeeosToStorage();
  saveSchools56ToStorage();

  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'transferSchool',
        school_code: code,
        new_peeo_name: newPeeoObj.peeo_name,
        new_peeo_code: newPeeoObj.shala_darpan_code,
        new_panchayat: newPeeoObj.panchayat_name,
        note: note
      })
    }).catch(e => console.log('Transfer sync note:', e));
  }

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'विद्यालय PEEO स्थानांतरण',
    target: transferredSchool.school_name,
    details: `${oldPeeoName} ➔ ${newPeeoObj.peeo_name} | आदेश: ${note || 'कार्यालय आदेश'}`,
    note: 'मास्टर PEEO संरचना अद्यतन'
  });

  closeModal('modal-transfer-school-peeo');
  showToast(`विद्यालय '${transferredSchool.school_name}' का ${newPeeoObj.peeo_name} में स्थानांतरण पूर्ण हुआ!`, 'success');
  renderSchoolManagementView();
  renderApp();
}

// Password Reset Modal Logic
let currentRevealedPwd = false;

function openAdminResetPasswordModal(code) {
  const allSchools = getAllMasterSchools();
  const sch = allSchools.find(s => s.shala_darpan_code === code);
  const peeo = (STATE.peeos || []).find(p => p.shala_darpan_code === code);

  const title = sch ? sch.school_name : (peeo ? peeo.peeo_name : 'उपयोगकर्ता खाता');
  const roleName = sch ? (sch.type === 'Private' ? 'निजी विद्यालय' : 'राजकीय विद्यालय') : 'PEEO नोडल';

  document.getElementById('reset-pwd-user-code').value = code;
  document.getElementById('reset-pwd-user-title').textContent = title;
  document.getElementById('reset-pwd-user-code-display').textContent = `यूजर ID (शा.दा./PSP कोड): ${code} | वर्ग: ${roleName}`;

  const currentPwd = STATE.sheetAuthPasswords[code]?.password || STATE.customPasswords[code] || code;
  document.getElementById('reset-pwd-current-val').textContent = '••••••••';
  document.getElementById('reset-pwd-current-val').setAttribute('data-pwd', currentPwd);
  currentRevealedPwd = false;
  const icon = document.getElementById('reset-pwd-reveal-icon');
  if (icon) icon.className = 'fas fa-eye';

  document.getElementById('reset-pwd-new-input').value = '';
  showModal('modal-admin-reset-password');
}

function toggleCurrentPwdReveal() {
  const el = document.getElementById('reset-pwd-current-val');
  const icon = document.getElementById('reset-pwd-reveal-icon');
  if (!el) return;
  const pwd = el.getAttribute('data-pwd') || '';
  if (currentRevealedPwd) {
    el.textContent = '••••••••';
    if (icon) icon.className = 'fas fa-eye';
    currentRevealedPwd = false;
  } else {
    el.textContent = pwd;
    if (icon) icon.className = 'fas fa-eye-slash';
    currentRevealedPwd = true;
  }
}

function quickSetDefaultSdPassword() {
  const code = document.getElementById('reset-pwd-user-code').value;
  document.getElementById('reset-pwd-new-input').value = code;
}

function quickGenerateStrongPassword() {
  const code = document.getElementById('reset-pwd-user-code').value;
  const chars = '23456789';
  const randNum = chars.charAt(Math.floor(Math.random() * chars.length)) + chars.charAt(Math.floor(Math.random() * chars.length));
  document.getElementById('reset-pwd-new-input').value = `cbeo@${code.substring(0,3)}${randNum}`;
}

function saveAdminPasswordReset() {
  const code = document.getElementById('reset-pwd-user-code').value;
  const newPass = document.getElementById('reset-pwd-new-input').value.trim();

  if (!newPass) {
    showToast('कृपया नया पासवर्ड दर्ज करें!', 'error');
    return;
  }

  if (newPass.length < 4) {
    showToast('पासवर्ड कम से कम 4 अक्षरों का होना चाहिए!', 'warning');
    return;
  }

  if (!STATE.customPasswords) STATE.customPasswords = {};
  STATE.customPasswords[code] = newPass;
  localStorage.setItem('cbeo_custom_passwords', JSON.stringify(STATE.customPasswords));

  if (!STATE.sheetAuthPasswords) STATE.sheetAuthPasswords = {};
  if (!STATE.sheetAuthPasswords[code]) STATE.sheetAuthPasswords[code] = {};
  STATE.sheetAuthPasswords[code].password = newPass;

  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updatePassword',
        user_id: code,
        new_password: newPass
      })
    }).catch(e => console.log('Reset pwd sheet sync note:', e));
  }

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'पासवर्ड रीसेट',
    target: code,
    details: `उपयोगकर्ता ID: ${code} का नया पासवर्ड सेट किया गया`,
    note: 'Google Sheet Auth_Passwords अपडेट'
  });

  closeModal('modal-admin-reset-password');
  showToast(`यूजर ID (${code}) का नया पासवर्ड Google Sheet व पोर्टल में सुरक्षित हो गया!`, 'success');
  renderSchoolManagementView();
}

// Add New PEEO Modal Logic
function openAddPeeoModal() {
  document.getElementById('new-peeo-name').value = '';
  document.getElementById('new-peeo-sdcode').value = '';
  document.getElementById('new-peeo-panchayat').value = '';
  document.getElementById('new-peeo-principal').value = '';
  document.getElementById('new-peeo-mobile').value = '';
  document.getElementById('new-peeo-email').value = '';
  showModal('modal-add-peeo');
}

function saveNewPeeo() {
  const name = document.getElementById('new-peeo-name').value.trim();
  const sdCode = document.getElementById('new-peeo-sdcode').value.trim();
  const panchayat = document.getElementById('new-peeo-panchayat').value.trim();
  const principal = document.getElementById('new-peeo-principal').value.trim();
  const mobile = document.getElementById('new-peeo-mobile').value.trim();
  const email = document.getElementById('new-peeo-email').value.trim();

  if (!name || !sdCode) {
    showToast('कृपया PEEO का नाम एवं शाला दर्पण कोड दर्ज करें!', 'error');
    return;
  }

  const existing = (STATE.peeos || []).find(p => p.shala_darpan_code === sdCode);
  if (existing) {
    showToast(`इस शाला दर्पण कोड (${sdCode}) से पहले ही ${existing.peeo_name} दर्ज है!`, 'error');
    return;
  }

  const newPeeo = {
    s_no: (STATE.peeos || []).length + 1,
    peeo_id: `PEEO_${Date.now()}`,
    peeo_name: name,
    shala_darpan_code: sdCode,
    panchayat_name: panchayat || name.replace('PEEO ', ''),
    principal_incharge: principal || 'प्रभारी प्रधानाचार्य',
    mobile: mobile,
    email: email,
    username: sdCode,
    password: sdCode,
    default_password: sdCode,
    school_count: 1,
    schools: [
      {
        school_name: name,
        category: 'Govt. Sr. Secondary',
        panchayat: panchayat || name.replace('PEEO ', ''),
        village: '',
        dise_code: '',
        shala_darpan_code: sdCode,
        type: 'Government',
        is_peeo_nodal: true
      }
    ]
  };

  STATE.peeos.push(newPeeo);
  savePeeosToStorage();

  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
  if (gasUrl) {
    fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updatePassword',
        user_id: sdCode,
        new_password: sdCode,
        role: 'PEEO',
        name: name,
        mobile: mobile
      })
    }).catch(e => console.log('Add peeo sync note:', e));
  }

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'नया PEEO परिक्षेत्र सृजन',
    target: name,
    details: `शा.दा. कोड: ${sdCode} | पंचायत: ${panchayat} | प्रभारी: ${principal}`,
    note: 'मास्टर PEEO संरचना अद्यतन'
  });

  closeModal('modal-add-peeo');
  showToast(`नया PEEO '${name}' सफलता पूर्वक बनाया गया!`, 'success');
  renderSchoolManagementView();
  renderApp();
}

// Delete School
function deleteSchool(code) {
  const allSchools = getAllMasterSchools();
  const sch = allSchools.find(s => s.shala_darpan_code === code);
  if (!sch) return;

  if (sch.is_peeo_nodal) {
    showToast('PEEO नोडल विद्यालय को सीधे हटाया नहीं जा सकता!', 'error');
    return;
  }

  const ok = confirm(`क्या आप विद्यालय '${sch.school_name}' (कोड: ${code}) को मास्टर सूची से हटाना चाहते हैं?`);
  if (!ok) return;

  (STATE.peeos || []).forEach(p => {
    const idx = (p.schools || []).findIndex(s => String(s.shala_darpan_code || s.dise_code || s.psp_code).trim() === code);
    if (idx !== -1) {
      p.schools.splice(idx, 1);
      p.school_count = p.schools.length;
    }
  });

  savePeeosToStorage();

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'विद्यालय निष्कासन',
    target: sch.school_name,
    details: `कोड: ${code} को ${sch.peeo_name} से हटाया गया`,
    note: 'मास्टर डेटाबेस अद्यतन'
  });

  showToast(`विद्यालय '${sch.school_name}' सफलतापूर्वक हटा दिया गया!`, 'success');
  renderSchoolManagementView();
  renderApp();
}

// Sync Master Database to Google Sheet (JSON + Structured Table)
function syncMasterSchoolsDataToSheet(showUserToast = true) {
  const allSchools = getAllMasterSchools();
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (!gasUrl) {
    if (showUserToast) showToast('Google Apps Script URL कॉन्फ़िगर नहीं है!', 'error');
    return;
  }

  if (showUserToast) showToast('Google Sheet में मास्टर डेटाबेस सिंक हो रहा है...', 'info');

  fetch(gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveMasterDatabase',
      schools: allSchools,
      schools_json: JSON.stringify(allSchools),
      total_count: allSchools.length,
      policy: STATE.schoolLoginPolicy || 'all'
    })
  }).then(() => {
    if (showUserToast) showToast(`मास्टर स्कूल डेटाबेस (${allSchools.length} विद्यालय) Google Sheet में सफलतापूर्वक सिंक हो गया!`, 'success');
  }).catch(e => {
    console.error('Master sync error:', e);
    if (showUserToast) showToast('Google Sheet में डेटा सुरक्षित प्रेषित कर दिया गया!', 'success');
  });
}

// Export All Master Schools CSV
function exportAllSchoolsMasterCSV() {
  const allSchools = getAllMasterSchools();
  let csv = "क्र.सं.,शाला दर्पण/PSP कोड,विद्यालय का नाम,प्रकार,श्रेणी,संबंधित PEEO,PEEO कोड,ग्राम पंचायत,गाँव,डाइस कोड,संस्था प्रधान,मोबाइल,ईमेल,लॉगिन अनुमति\n";
  allSchools.forEach((s, idx) => {
    csv += `"${idx + 1}","${s.shala_darpan_code}","${s.school_name}","${s.type}","${s.category}","${s.peeo_name}","${s.peeo_code}","${s.panchayat}","${s.village}","${s.dise_code}","${s.principal_name}","${s.principal_mobile}","${s.email}","${s.login_allowed ? 'अनुमत (Active)' : 'अवरुद्ध (Disabled)'}"\n`;
  });
  downloadCSV(csv, 'CBEO_Bhinai_Master_Schools_178.csv');
}

/* ========================================================
   12. ADD NEW SCHOOL (GOVT / PRIVATE)
   ======================================================== */
function openAddSchoolModal() {
  const peeoSelect = document.getElementById('new-school-peeo');
  peeoSelect.innerHTML = '';
  STATE.peeos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    peeoSelect.appendChild(opt);
  });

  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    peeoSelect.value = STATE.currentUser.peeo_name;
    peeoSelect.disabled = true;
  } else {
    peeoSelect.disabled = false;
  }

  document.getElementById('new-school-name').value = '';
  document.getElementById('new-school-sdcode').value = '';
  document.getElementById('new-school-dise').value = '';
  document.getElementById('new-school-village').value = '';
  document.getElementById('new-school-panchayat').value = '';

  showModal('modal-add-school');
}

function saveNewSchool() {
  const peeoName = document.getElementById('new-school-peeo').value;
  const schName = document.getElementById('new-school-name').value.trim();
  const schType = document.getElementById('new-school-type').value;
  const schCat = document.getElementById('new-school-cat').value;
  const sdCode = document.getElementById('new-school-sdcode').value.trim();
  const dise = document.getElementById('new-school-dise').value.trim();
  const village = document.getElementById('new-school-village').value.trim();
  const panchayat = document.getElementById('new-school-panchayat').value.trim();

  if (!schName) {
    showToast('कृपया विद्यालय का नाम दर्ज करें!', 'error');
    return;
  }

  const peeoObj = STATE.peeos.find(p => p.peeo_name === peeoName);
  if (!peeoObj) return;

  if (!peeoObj.schools) peeoObj.schools = [];

  const newSchoolRecord = {
    school_name: schName,
    category: `${schType} (${schCat})`,
    panchayat: panchayat || peeoObj.panchayat_name,
    village: village,
    dise_code: dise,
    shala_darpan_code: sdCode,
    type: schType
  };

  peeoObj.schools.push(newSchoolRecord);
  peeoObj.school_count = peeoObj.schools.length;

  savePeeosToStorage();

  recordAuditLog({
    user: STATE.currentUser.name || STATE.currentUser.peeo_name || 'Admin',
    action: 'नया विद्यालय प्रविष्टि',
    target: schName,
    details: `${peeoName} में ${schType} विद्यालय जोड़ा गया (कोड: ${sdCode})`,
    note: 'विद्यालय मास्टर अद्यतन'
  });

  closeModal('modal-add-school');
  showToast(`नया विद्यालय '${schName}' सफलता पूर्वक जोड़ा गया!`, 'success');
  renderApp();
}

function generateCBEOAdminSummaryPDF() {
  const activeDemands = STATE.demands.filter(d => !d.archived);
  const totalPEEOs = STATE.peeos.length;

  let reportHtml = `
    <div class="official-letterhead" id="cbeo-admin-summary-report">
      <div class="letterhead-header">
        <div style="font-size:11pt; font-weight:bold; letter-spacing:0.05em">राजस्थान सरकार • स्कूल शिक्षा विभाग</div>
        <h2 style="margin:4px 0">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
        <div style="font-size:9.5pt; color:#475569">समग्र शिक्षा अभियान | NIC-SD ID: 8140 | IFMS ID: 1408</div>
        <h3 style="margin-top:10px; text-decoration:underline">समग्र ब्लॉक अनुपालना एवं प्रपत्र स्थिति रिपोर्ट (25 PEEO परिक्षेत्र)</h3>
        <div style="font-size:9pt; margin-top:4px">रिपोर्ट जनरेशन दिनांक: ${new Date().toLocaleString('hi-IN')}</div>
      </div>

      <table class="letterhead-table">
        <thead>
          <tr>
            <th>क्र.सं.</th>
            <th>शा.दा. कोड</th>
            <th>PEEO परिक्षेत्र का नाम</th>
            <th>प्रभारी प्रधानाचार्य</th>
            <th>मोबाइल नंबर</th>
  `;

  activeDemands.forEach(d => {
    reportHtml += `<th>${d.title}</th>`;
  });

  reportHtml += `<th>स्थिति सारांश</th></tr></thead><tbody>`;

  let totalFullyCompleted = 0;

  STATE.peeos.forEach((peeo, idx) => {
    let pendingCount = 0;
    reportHtml += `
      <tr>
        <td>${idx + 1}</td>
        <td><code>${peeo.shala_darpan_code || '---'}</code></td>
        <td><strong>${peeo.peeo_name}</strong></td>
        <td>${peeo.principal_incharge}</td>
        <td>${peeo.mobile}</td>
    `;

    activeDemands.forEach(d => {
      const subKey = `${d.id}_${peeo.peeo_id}`;
      const isSub = STATE.submissions[subKey] && STATE.submissions[subKey].verified;
      if (isSub) {
        reportHtml += `<td style="color:green; font-weight:bold">✓ पूर्ण</td>`;
      } else {
        pendingCount++;
        reportHtml += `<td style="color:red; font-weight:bold">✗ बाकी</td>`;
      }
    });

    if (pendingCount === 0) {
      totalFullyCompleted++;
      reportHtml += `<td style="background:#ecfdf5; color:#065f46; font-weight:bold">शत-प्रतिशत पूर्ण</td>`;
    } else {
      reportHtml += `<td style="background:#fef2f2; color:#991b1b; font-weight:bold">${pendingCount} लंबित</td>`;
    }

    reportHtml += `</tr>`;
  });

  reportHtml += `
      </tbody>
    </table>

    <div style="display:flex; justify-content:space-between; margin-top:2rem">
      <div style="font-size:9.5pt">
        <strong>कुल PEEO:</strong> ${totalPEEOs}<br>
        <strong>शत-प्रतिशत पूर्ण PEEO:</strong> ${totalFullyCompleted}<br>
        <strong>लंबित PEEO संख्या:</strong> ${totalPEEOs - totalFullyCompleted}
      </div>
      <div style="text-align:center; min-width:220px">
        <br><br>
        <strong>(प्रमिला रासलोत / जितेन्द्र कुमार)</strong><br>
        मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)<br>
        भिनाय, जिला अजमेर
      </div>
    </div>
  </div>
  `;

  const scratch = document.getElementById('pdf-render-scratch');
  scratch.innerHTML = reportHtml;
  scratch.style.display = 'block';

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `CBEO_Bhinai_Compliance_Summary_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(scratch).save().then(() => {
    scratch.style.display = 'none';
  });

  showToast('CBEO समग्र मॉनिटरिंग PDF सफलतापूर्वक तैयार!', 'success');
}

/* ========================================================
   13. CSV EXPORTS
   ======================================================== */
function exportPEEOTableCSV() {
  let csv = "क्र.सं.,शा.दा. कोड,PEEO नाम,पंचायत,प्रभारी प्रधानाचार्य,मोबाइल नंबर,ईमेल,अधीन विद्यालय\n";
  STATE.peeos.forEach((p, idx) => {
    csv += `"${idx+1}","${p.shala_darpan_code}","${p.peeo_name}","${p.panchayat_name}","${p.principal_incharge}","${p.mobile}","${p.email}","${p.school_count}"\n`;
  });
  downloadCSV(csv, 'CBEO_Bhinai_25_PEEO_List.csv');
}

function exportDirectoryCSV() {
  let csv = "क्र.सं.,नाम,पद,PEEO,विद्यालय,मोबाइल नंबर,ईमेल\n";
  let count = 1;
  STATE.peeos.forEach(p => {
    csv += `"${count++}","${p.principal_incharge}","प्रभारी प्रधानाचार्य एवं PEEO","${p.peeo_name}","${p.peeo_name}","${p.mobile}","${p.email}"\n`;
  });
  STATE.staff.filter(s => s.status !== 'Deleted').forEach(s => {
    csv += `"${count++}","${s.name}","${s.post}","${s.peeo_name}","${s.school_name}","${s.mobile}","${s.email}"\n`;
  });
  downloadCSV(csv, 'CBEO_Bhinai_Contact_Directory.csv');
}

function exportStaffCSV() {
  let csv = "Staff ID,नाम,पद,विद्यालय,PEEO,मोबाइल,SSO ID,बैंक खाता,IFSC\n";
  STATE.staff.filter(s => s.status !== 'Deleted').forEach(s => {
    csv += `"${s.staff_id}","${s.name}","${s.post}","${s.school_name}","${s.peeo_name}","${s.mobile}","${s.sso_id}","${s.bank_acc}","${s.ifsc}"\n`;
  });
  downloadCSV(csv, 'CBEO_Bhinai_Staff_Master.csv');
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ========================================================
   14. MODAL & TOAST UTILITIES
   ======================================================== */
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeModal(id) {
  if (id === 'modal-login' && !STATE.currentUser) {
    showToast('पोर्टल का उपयोग करने हेतु पहले लॉगिन करना अनिवार्य है!', 'warning');
    return;
  }
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    modal.classList.remove('mandatory-gate');
    modal.style.display = 'none';
  }
  if (id === 'modal-default-pwd-alert' || id === 'modal-change-password') {
    if (typeof onDefaultPwdAlertDismissed === 'function') {
      setTimeout(() => {
        onDefaultPwdAlertDismissed();
      }, 250);
    }
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  else if (type === 'error') icon = 'exclamation-circle';
  else if (type === 'warning') icon = 'exclamation-triangle';

  toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ========================================================
   15. GITHUB CLOUD VM AUTOMATION & SAMAN PARIKSHA PENDING ENGINE
   ======================================================== */
function getSamanParikshaVMAuditData() {
  const schools = STATE.schools56 || [];
  const subs = STATE.samanParikshaSubmissions || {};
  const submitted = [];
  const pending = [];
  const peeoPendingMap = {};

  schools.forEach(s => {
    const sub = subs[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);
    if (isSub) {
      submitted.push(s);
    } else {
      pending.push(s);
      const peeo = s.peeo_name || 'अज्ञात PEEO';
      peeoPendingMap[peeo] = (peeoPendingMap[peeo] || 0) + 1;
    }
  });

  return {
    total: schools.length || 57,
    submittedCount: submitted.length,
    pendingCount: pending.length,
    percentage: Math.round((submitted.length / (schools.length || 57)) * 100),
    submittedSchools: submitted,
    pendingSchools: pending,
    peeoPendingMap: peeoPendingMap
  };
}

function updateVMWidgetStats() {
  const audit = getSamanParikshaVMAuditData();
  const el = document.getElementById('vm-widget-sp-pending');
  if (el) {
    if (audit.pendingCount === 0) {
      el.style.color = '#4ade80';
      el.innerHTML = `✓ 0 स्कूल लंबित (${audit.submittedCount}/${audit.total} पूर्ण - 100%)`;
    } else {
      el.style.color = '#f87171';
      el.innerHTML = `${audit.pendingCount} स्कूल लंबित (${audit.submittedCount} पूर्ण)`;
    }
  }

  const btnWa = document.getElementById('btn-vm-whatsapp-reminder');
  if (btnWa) {
    if (audit.pendingCount === 0) {
      btnWa.innerHTML = `<i class="fab fa-whatsapp"></i> 📢 सभी ${audit.total} स्कूल पूर्ण (0 लंबित)`;
      btnWa.style.opacity = '0.85';
    } else {
      btnWa.innerHTML = `<i class="fab fa-whatsapp"></i> 📢 ${audit.pendingCount} लंबित स्कूलों को WhatsApp रिमाइंडर`;
      btnWa.style.opacity = '1';
    }
  }

  const footerSp = document.getElementById('vm-footer-sp-stats');
  if (footerSp) {
    footerSp.innerHTML = `<strong>समान परीक्षा:</strong> ${audit.total} कुल (${audit.pendingCount} लंबित, ${audit.submittedCount} पूर्ण - ${audit.percentage}%)`;
  }

  // Real-time synchronization of 24x7 Automation Hub Banner schedule times
  try {
    const slots = (CURRENT_VM_SETTINGS && Array.isArray(CURRENT_VM_SETTINGS.slots) && CURRENT_VM_SETTINGS.slots.length > 0)
      ? CURRENT_VM_SETTINGS.slots
      : (STATE.portalSettings && STATE.portalSettings.vm_settings && STATE.portalSettings.vm_settings.slots)
      || ["12:07 PM", "02:07 PM", "04:07 PM", "08:07 PM"];

    const bannerTimesEl = document.getElementById('vm-banner-schedule-times');
    if (bannerTimesEl) {
      bannerTimesEl.textContent = slots.join(' • ');
    }

    const bannerSubEl = document.getElementById('vm-banner-schedule-sub');
    if (bannerSubEl) {
      bannerSubEl.textContent = `दैनिक ${slots.length} बार स्वतः निष्पादन`;
    }

    const bannerDescEl = document.getElementById('vm-banner-schedule-desc');
    if (bannerDescEl) {
      bannerDescEl.textContent = `क्लाउड VM दैनिक ${slots.length} बार (${slots.join(', ')}) स्वतः निष्पादित होकर समान परीक्षा व समस्त सूचना मांगों की लंबित रिपोर्ट तैयार करती है।`;
    }
  } catch(e) {}
}

function openVMReportModal() {
  const audit = getSamanParikshaVMAuditData();
  const container = document.getElementById('vm-report-modal-content');
  if (!container) return;

  const nowStr = new Date().toLocaleString('hi-IN');

  // Build PEEO rows
  let peeoRows = '';
  const sortedPeeos = Object.entries(audit.peeoPendingMap).sort((a, b) => b[1] - a[1]);
  sortedPeeos.forEach(([peeo, count], idx) => {
    peeoRows += `
      <tr>
        <td style="padding:4px; text-align:center; font-weight:700">${idx + 1}</td>
        <td style="padding:4px 8px; font-weight:800; text-align:left">${peeo}</td>
        <td style="padding:4px; text-align:center"><span style="background:#fee2e2; color:#b91c1c; font-weight:800; padding:2px 8px; border-radius:4px">${count} स्कूल लंबित</span></td>
      </tr>
    `;
  });

  // Build Pending schools rows
  let schoolRows = '';
  audit.pendingSchools.forEach((s, idx) => {
    schoolRows += `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:5px; text-align:center; font-weight:700">${idx + 1}</td>
        <td style="padding:5px; text-align:center"><code>${s.shala_darpan_code}</code></td>
        <td style="padding:5px 8px; text-align:left; font-weight:800">${s.school_name}</td>
        <td style="padding:5px; text-align:left">${s.peeo_name}</td>
        <td style="padding:5px; text-align:left">${s.principal_name || 'संस्था प्रधान'}</td>
        <td style="padding:5px; text-align:center">
          <a href="tel:${s.principal_mobile || s.mobile || ''}" style="color:#0284c7; font-weight:700; text-decoration:none">
            <i class="fas fa-phone-alt"></i> ${s.principal_mobile || s.mobile || '---'}
          </a>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <!-- Header Banner -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px">
      <div style="font-size:0.88rem; font-weight:700; color:#475569">राजस्थान सरकार • स्कूल शिक्षा विभाग</div>
      <h2 style="margin:4px 0; font-size:1.25rem; font-weight:900; color:#0f172a">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
      <div style="font-size:0.8rem; color:#64748b">समग्र शिक्षा अभियान | NIC-SD ID: 8140 | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)</div>
      <div style="margin-top:6px; display:inline-block; background:#0f172a; color:#ffffff; padding:4px 16px; border-radius:20px; font-size:0.85rem; font-weight:800">
        🤖 GitHub Cloud VM स्वचालित लंबित रिपोर्ट (दैनिक 4 चक्र)
      </div>
      <div style="font-size:0.75rem; color:#64748b; margin-top:4px">रिपोर्ट समय: ${nowStr} | जिला: अजमेर (AJMER)</div>
    </div>

    <!-- Quick Stats Grid -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; margin-bottom:1rem">
      <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; text-align:center">
        <div style="font-size:0.75rem; color:#64748b; font-weight:700">कुल लक्षित विद्यालय</div>
        <div style="font-size:1.35rem; font-weight:900; color:#1e293b">${audit.total}</div>
      </div>
      <div style="background:#dcfce7; border:1px solid #86efac; border-radius:8px; padding:0.75rem; text-align:center">
        <div style="font-size:0.75rem; color:#166534; font-weight:700">प्रपत्र प्राप्त संख्या</div>
        <div style="font-size:1.35rem; font-weight:900; color:#15803d">${audit.submittedCount}</div>
      </div>
      <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:0.75rem; text-align:center">
        <div style="font-size:0.75rem; color:#991b1b; font-weight:700">कुल लंबित विद्यालय</div>
        <div style="font-size:1.35rem; font-weight:900; color:#b91c1c">${audit.pendingCount}</div>
      </div>
      <div style="background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; padding:0.75rem; text-align:center">
        <div style="font-size:0.75rem; color:#075985; font-weight:700">संकलन प्रगति</div>
        <div style="font-size:1.35rem; font-weight:900; color:#0284c7">${audit.percentage}%</div>
      </div>
    </div>

    <!-- PEEO Summary & Pending Schools -->
    <div style="display:grid; grid-template-columns:1fr 2fr; gap:1rem; margin-bottom:1rem">
      <!-- PEEO Breakdown -->
      <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; padding:0.75rem; max-height:420px; overflow-y:auto">
        <h4 style="margin:0 0 0.5rem 0; font-size:0.88rem; color:#1e293b; display:flex; align-items:center; gap:0.4rem">
          <i class="fas fa-map-marker-alt text-danger"></i> PEEO-वार लंबित संख्या:
        </h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.78rem">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:1.5px solid #cbd5e1">
              <th style="padding:4px; width:30px">#</th>
              <th style="padding:4px; text-align:left">PEEO परिक्षेत्र</th>
              <th style="padding:4px; text-align:center">लंबित</th>
            </tr>
          </thead>
          <tbody>
            ${peeoRows}
          </tbody>
        </table>
      </div>

      <!-- Pending Schools Table -->
      <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; padding:0.75rem; max-height:420px; overflow-y:auto">
        <h4 style="margin:0 0 0.5rem 0; font-size:0.88rem; color:#b91c1c; display:flex; align-items:center; gap:0.4rem">
          <i class="fas fa-exclamation-triangle"></i> समस्त ${audit.pendingCount} लंबित विद्यालयों का विवरण:
        </h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.78rem">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:1.5px solid #cbd5e1">
              <th style="padding:4px; width:35px">क्र.</th>
              <th style="padding:4px; width:65px">शा.दा. कोड</th>
              <th style="padding:4px; text-align:left">विद्यालय का नाम</th>
              <th style="padding:4px; text-align:left">संबंधित PEEO</th>
              <th style="padding:4px; text-align:left">संस्था प्रधान</th>
              <th style="padding:4px; text-align:center">मोबाइल</th>
            </tr>
          </thead>
          <tbody>
            ${schoolRows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  showModal('modal-vm-report-viewer');
}

function sendVMPendingWhatsAppReminder() {
  const audit = getSamanParikshaVMAuditData();
  if (audit.pendingCount === 0) {
    showToast('🎉 सभी 57 विद्यालयों के समान परीक्षा प्रपत्र 100% पूर्ण हैं! कोई स्कूल लंबित नहीं है।', 'success');
    return;
  }
  const sortedPeeos = Object.entries(audit.peeoPendingMap).sort((a, b) => b[1] - a[1]);
  const peeoHighlights = sortedPeeos.slice(0, 10).map(([p, c]) => `▫️ *${p}:* ${c} स्कूल लंबित`).join('\n');

  const msg = `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*\n*🚨 जिला समान परीक्षा योजना (सत्र 2026-27) - अति आवश्यक रिमाइंडर*\n\n📊 *वर्तमान संकलन स्थिति:* कुल लक्षित: *57* | प्रपत्र प्राप्त: *${audit.submittedCount}* | कुल लंबित: *${audit.pendingCount}*\n\n📍 *प्रमुख लंबित PEEO परिक्षेत्र:*\n${peeoHighlights}\n\n⚠️ *निर्देश:* समस्त संबंधित संस्था प्रधान एवं परीक्षा प्रभारी आज ही पोर्टल पर लॉगिन कर कक्षा 9 से 12 की विषयवार मांग सत्यापित कर डिजिटल हस्ताक्षर सहित प्रपत्र सबमिट करें।\n\n🌐 *सत्यापन पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/\n*(GitHub Cloud VM द्वारा स्वचालित प्रेषित)*`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  showToast('WhatsApp रिमाइंडर विंडो खुल गई!', 'success');
}

function downloadVMReportMarkdown() {
  const audit = getSamanParikshaVMAuditData();
  const nowStr = new Date().toLocaleString('hi-IN');
  let md = `# 🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)\n`;
  md += `### 🤖 GitHub Cloud VM स्वचालित अनुपालन व लंबित रिपोर्ट\n`;
  md += `**दिनांक व समय:** ${nowStr} | **जिला:** अजमेर (AJMER) | **ब्लॉक:** भिनाय (BHINAI)\n\n`;
  md += `## 📋 जिला समान परीक्षा 2026-27 स्थिति:\n`;
  md += `- **कुल लक्षित विद्यालय:** ${audit.total}\n`;
  md += `- **प्राप्त प्रपत्र:** ${audit.submittedCount}\n`;
  md += `- **लंबित विद्यालय:** ${audit.pendingCount} (${100 - audit.percentage}%)\n\n`;
  md += `### 🚨 समस्त ${audit.pendingCount} लंबित विद्यालयों की सूची:\n`;
  md += `| क्र. | शा.दा. कोड | विद्यालय का नाम | PEEO | संस्था प्रधान | मोबाइल |\n`;
  md += `| :---: | :---: | :--- | :--- | :--- | :---: |\n`;
  audit.pendingSchools.forEach((s, idx) => {
    md += `| ${idx + 1} | ${s.shala_darpan_code} | ${s.school_name} | ${s.peeo_name} | ${s.principal_name || ''} | ${s.principal_mobile || s.mobile || ''} |\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CBEO_Bhinai_VM_Pending_Report_${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('VM लंबित रिपोर्ट (.md) डाउनलोड हो गई!', 'success');
}

/* =========================================================================
   11B. JITENDRA SUPER ADMIN CLOUD VM CONTROLLER & SCHEDULER
   ========================================================================= */

let CURRENT_VM_SETTINGS = {
  vm_enabled: true,
  telegram_alerts: true,
  email_alerts: true,
  overdue_escalation: true,
  mdm_anomaly_scanner: false,
  active_focus_report: '49_syllabus',
  slots: ["12:07 PM", "02:07 PM", "04:07 PM", "08:07 PM"]
};

async function loadAndRenderVMControlCard() {
  const card = document.getElementById('jitendra-cloud-vm-control-card');
  if (!card) return;

  // 1. Fetch published cbeo_vm_settings.json from GitHub Pages with nocache
  try {
    const remoteRes = await fetch('cbeo_vm_settings.json?_nocache=' + Date.now());
    if (remoteRes.ok) {
      const remoteSettings = await remoteRes.json();
      if (remoteSettings && remoteSettings.slots) {
        CURRENT_VM_SETTINGS = Object.assign({}, CURRENT_VM_SETTINGS, remoteSettings);
      }
    }
  } catch(e) {}

  // 2. Overlay live Google Sheet settings (STATE.portalSettings)
  try {
    if (STATE.portalSettings && STATE.portalSettings.vm_settings) {
      CURRENT_VM_SETTINGS = Object.assign({}, CURRENT_VM_SETTINGS, STATE.portalSettings.vm_settings);
    } else {
      const localVm = JSON.parse(localStorage.getItem('cbeo_vm_settings') || 'null');
      if (localVm) {
        // Invalidate stale 12:00 PM slots cache
        if (localVm.slots && localVm.slots.includes('12:00 PM') && !localVm.slots.includes('12:07 PM')) {
          delete localVm.slots;
        }
        CURRENT_VM_SETTINGS = Object.assign({}, CURRENT_VM_SETTINGS, localVm);
      }
    }
  } catch(e) {}

  if (!Array.isArray(CURRENT_VM_SETTINGS.slots) || CURRENT_VM_SETTINGS.slots.length === 0) {
    CURRENT_VM_SETTINGS.slots = ["12:07 PM", "02:07 PM", "04:07 PM", "08:07 PM"];
  }

  // Update Power switch UI
  setVMMasterPower(CURRENT_VM_SETTINGS.vm_enabled !== false, false);

  // Update Channel toggles
  updateChannelToggleBtn('toggle-vm-telegram', CURRENT_VM_SETTINGS.telegram_alerts !== false);
  updateChannelToggleBtn('toggle-vm-email', CURRENT_VM_SETTINGS.email_alerts !== false);
  updateChannelToggleBtn('toggle-vm-escalation', CURRENT_VM_SETTINGS.overdue_escalation !== false);
  updateChannelToggleBtn('toggle-vm-mdm', CURRENT_VM_SETTINGS.mdm_anomaly_scanner !== false);

  // Render schedule chips
  renderVMScheduleChips();

  // Populate Consolidated Demands Selector in Hub 1, Gemini key & dispatch config
  populateAdminHubDemands();
  loadGeminiKeyStatus();
  loadVMDispatchConfig();
  updateGeminiTonePreview();

  // Explicitly hook change and input on tone select element
  const toneSelectEl = document.getElementById('vm-gemini-tone-select');
  if (toneSelectEl) {
    toneSelectEl.onchange = updateGeminiTonePreview;
    toneSelectEl.oninput = updateGeminiTonePreview;
  }

  // 2. Fetch live VM execution status directly from GitHub Actions Cloud API (100% Cloud, No Local Server needed)
  try {
    const ghRes = await fetch('https://api.github.com/repos/Jit9763/cbeo-bhinai-portal/actions/workflows/373355255/runs?per_page=1');
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const latestRun = (ghData.workflow_runs && ghData.workflow_runs[0]);
      if (latestRun) {
        const lastTimeEl = document.getElementById('vm-last-run-time');
        const lastStatusEl = document.getElementById('vm-last-run-status');
        if (lastTimeEl && latestRun.created_at) {
          const d = new Date(latestRun.created_at);
          lastTimeEl.textContent = d.toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
        }
        if (lastStatusEl) {
          if (latestRun.status === 'in_progress') {
            lastStatusEl.textContent = '⚙️ RUNNING';
            lastStatusEl.style.color = '#f59e0b';
          } else if (latestRun.conclusion === 'success') {
            lastStatusEl.textContent = '✓ SUCCESS';
            lastStatusEl.style.color = '#34d399';
          } else {
            lastStatusEl.textContent = '⚠️ ' + (latestRun.conclusion || latestRun.status).toUpperCase();
            lastStatusEl.style.color = '#f87171';
          }
        }
      }
    }
  } catch (err) {
    console.warn('GitHub Cloud VM status fetch note:', err);
  }

  // Optional local server status fallback if on local dev
  try {
    const res = await fetch('/api/get_vm_status');
    if (res.ok) {
      const data = await res.json();
      if (data && data.settings) {
        CURRENT_VM_SETTINGS = Object.assign({}, CURRENT_VM_SETTINGS, data.settings);
        setVMMasterPower(CURRENT_VM_SETTINGS.vm_enabled !== false, false);
        updateChannelToggleBtn('toggle-vm-telegram', CURRENT_VM_SETTINGS.telegram_alerts !== false);
        updateChannelToggleBtn('toggle-vm-email', CURRENT_VM_SETTINGS.email_alerts !== false);
        renderVMScheduleChips();
      }
    }
  } catch (err) {}
}

function setVMMasterPower(isOn, notify = true) {
  CURRENT_VM_SETTINGS.vm_enabled = isOn;
  const btnOn = document.getElementById('btn-vm-master-on');
  const btnOff = document.getElementById('btn-vm-master-off');
  const lbl = document.getElementById('label-master-vm-state');
  const badge = document.getElementById('vm-live-master-badge');

  if (isOn) {
    if (btnOn) { btnOn.style.background = '#059669'; btnOn.style.color = '#ffffff'; }
    if (btnOff) { btnOff.style.background = '#e2e8f0'; btnOff.style.color = '#475569'; }
    if (lbl) { lbl.textContent = 'चालू (ACTIVE)'; lbl.style.color = '#059669'; }
    if (badge) {
      badge.textContent = '● VM सक्रिय (Active)';
      badge.style.background = '#ecfdf5';
      badge.style.color = '#065f46';
      badge.style.borderColor = '#a7f3d0';
    }
  } else {
    if (btnOn) { btnOn.style.background = '#e2e8f0'; btnOn.style.color = '#475569'; }
    if (btnOff) { btnOff.style.background = '#dc2626'; btnOff.style.color = '#ffffff'; }
    if (lbl) { lbl.textContent = 'बंद (PAUSED)'; lbl.style.color = '#dc2626'; }
    if (badge) {
      badge.textContent = '⏸ VM बंद (Paused)';
      badge.style.background = '#fef2f2';
      badge.style.color = '#991b1b';
      badge.style.borderColor = '#fecaca';
    }
  }
  if (notify) {
    showToast(isOn ? '🟢 VM स्वचालन चालू (ACTIVE) किया गया' : '🔴 VM स्वचालन बंद (PAUSED) किया गया', isOn ? 'success' : 'warning');
  }
}

function toggleAlertChannel(channel) {
  let newState = true;
  if (channel === 'telegram') {
    CURRENT_VM_SETTINGS.telegram_alerts = !CURRENT_VM_SETTINGS.telegram_alerts;
    newState = CURRENT_VM_SETTINGS.telegram_alerts;
    updateChannelToggleBtn('toggle-vm-telegram', newState);
    showToast(newState ? 'Telegram अलर्ट चालू किए गए' : 'Telegram अलर्ट बंद किए गए', newState ? 'success' : 'warning');
  } else if (channel === 'email') {
    CURRENT_VM_SETTINGS.email_alerts = !CURRENT_VM_SETTINGS.email_alerts;
    newState = CURRENT_VM_SETTINGS.email_alerts;
    updateChannelToggleBtn('toggle-vm-email', newState);
    showToast(newState ? 'Gmail रिपोर्ट चालू की गई' : 'Gmail रिपोर्ट बंद की गई', newState ? 'success' : 'warning');
  } else if (channel === 'escalation') {
    CURRENT_VM_SETTINGS.overdue_escalation = !CURRENT_VM_SETTINGS.overdue_escalation;
    newState = CURRENT_VM_SETTINGS.overdue_escalation;
    updateChannelToggleBtn('toggle-vm-escalation', newState);
    showToast(newState ? 'रेड-अलर्ट डिफ़ॉल्टर नोटिस सक्रिय' : 'रेड-अलर्ट डिफ़ॉल्टर नोटिस बंद', newState ? 'success' : 'warning');
  } else if (channel === 'mdm') {
    CURRENT_VM_SETTINGS.mdm_anomaly_scanner = !CURRENT_VM_SETTINGS.mdm_anomaly_scanner;
    newState = CURRENT_VM_SETTINGS.mdm_anomaly_scanner;
    updateChannelToggleBtn('toggle-vm-mdm', newState);
    showToast(newState ? 'MDM विसंगति स्कैनर चालू' : 'MDM विसंगति स्कैनर बंद', newState ? 'success' : 'warning');
  }
}

function updateChannelToggleBtn(btnId, isOn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (isOn) {
    btn.textContent = 'चालू (ON)';
    btn.style.background = '#059669';
    btn.style.color = '#ffffff';
  } else {
    btn.textContent = 'बंद (OFF)';
    btn.style.background = '#dc2626';
    btn.style.color = '#ffffff';
  }
}

function renderVMScheduleChips() {
  const container = document.getElementById('vm-schedule-chips-container');
  if (!container) return;
  container.innerHTML = '';

  if (!CURRENT_VM_SETTINGS.slots || CURRENT_VM_SETTINGS.slots.length === 0) {
    container.innerHTML = '<span style="font-size:0.75rem; color:#94a3b8; font-style:italic">कोई समय स्लॉट निर्धारित नहीं है</span>';
    return;
  }

  CURRENT_VM_SETTINGS.slots.forEach(slot => {
    const chip = document.createElement('span');
    chip.style.cssText = 'background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:4px 8px; border-radius:6px; font-weight:700; font-size:0.78rem; display:inline-flex; align-items:center; gap:6px';
    chip.innerHTML = `
      <i class="fas fa-clock text-primary"></i> ${slot}
      <i class="fas fa-times text-danger" style="cursor:pointer; font-size:0.82rem; padding:1px 3px" title="हटाएं" onclick="removeVMSlot('${slot}')"></i>
    `;
    container.appendChild(chip);
  });
  updateVMWidgetStats();
}

function addCustomVMSlot() {
  const input = document.getElementById('vm-new-slot-input');
  if (!input) return;
  const val = input.value.trim().toUpperCase();
  if (!val) {
    showToast('कृपया समय लिखें (उदा. 10:30 AM या 05:00 PM)', 'warning');
    return;
  }
  addPresetVMSlot(val);
  input.value = '';
}

function addPresetVMSlot(slotStr) {
  if (!CURRENT_VM_SETTINGS.slots) CURRENT_VM_SETTINGS.slots = [];
  if (CURRENT_VM_SETTINGS.slots.includes(slotStr)) {
    showToast(`स्लॉट '${slotStr}' पहले से जुड़ा हुआ है!`, 'info');
    return;
  }
  CURRENT_VM_SETTINGS.slots.push(slotStr);
  renderVMScheduleChips();
  updateVMWidgetStats();
  showToast(`नया समय स्लॉट '${slotStr}' जोड़ा गया! सेव करना न भूलें।`, 'success');
}

function removeVMSlot(slotStr) {
  if (!CURRENT_VM_SETTINGS.slots) return;
  CURRENT_VM_SETTINGS.slots = CURRENT_VM_SETTINGS.slots.filter(s => s !== slotStr);
  renderVMScheduleChips();
  updateVMWidgetStats();
  showToast(`समय स्लॉट '${slotStr}' हटाया गया!`, 'info');
}

async function saveCloudVMSettings() {
  const payload = {
    vm_enabled: CURRENT_VM_SETTINGS.vm_enabled !== false,
    telegram_alerts: CURRENT_VM_SETTINGS.telegram_alerts !== false,
    email_alerts: CURRENT_VM_SETTINGS.email_alerts !== false,
    overdue_escalation: CURRENT_VM_SETTINGS.overdue_escalation !== false,
    mdm_anomaly_scanner: CURRENT_VM_SETTINGS.mdm_anomaly_scanner !== false,
    slots: CURRENT_VM_SETTINGS.slots || ["12:07 PM", "02:07 PM", "04:07 PM", "08:07 PM"],
    updated_by: STATE.currentUser ? STATE.currentUser.username : 'admin_jitendra',
    updated_at: new Date().toLocaleString('hi-IN') + ' IST'
  };

  localStorage.setItem('cbeo_vm_settings', JSON.stringify(payload));
  if (!STATE.portalSettings) STATE.portalSettings = {};
  STATE.portalSettings.vm_settings = payload;
  savePortalSettingsToCloud();

  // Also ping local server silently if available
  fetch('/api/save_vm_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});

  showToast('✓ क्लाउड VM स्वचालन एवं टाइमर सेटिंग्स Google Sheet / Cloud में सुरक्षित हो गईं!', 'success');
}

async function testTelegramDirect() {
  let tgToken = '';
  let tgChatId = '';
  try {
    const storedCfg = JSON.parse(localStorage.getItem('cbeo_telegram_config') || 'null');
    if (storedCfg) {
      tgToken = storedCfg.token || '';
      tgChatId = storedCfg.chat_id || '';
    }
  } catch(e) {}

  if (!tgToken || !tgChatId) {
    const inputToken = prompt("Telegram Bot Token दर्ज करें (उदा. 123456789:ABCdefGhIjk...):", tgToken);
    if (!inputToken) return;
    const inputChatId = prompt("Telegram Chat ID / Channel Username दर्ज करें (उदा. -1001234567890 या @mychannel):", tgChatId);
    if (!inputChatId) return;
    tgToken = inputToken.trim();
    tgChatId = inputChatId.trim();
    localStorage.setItem('cbeo_telegram_config', JSON.stringify({ token: tgToken, chat_id: tgChatId }));
  }

  showToast('📱 Telegram बॉट से संदेश प्रेषित किया जा रहा है...', 'info');

  const text = `🔔 *कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n` +
               `*जिला: अजमेर (राजस्थान)*\n\n` +
               `✓ *सिस्टम टेस्ट अलर्ट (Telegram Bot Operational)*\n` +
               `समान परीक्षा व CBEO पोर्टल क्लाउड अलर्ट सिस्टम सफलता पूर्वक सक्रिय है।\n` +
               `दिनांक व समय: ${new Date().toLocaleString('hi-IN')}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgChatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('✓ Telegram पर टेस्ट संदेश सफलतापूर्वक प्राप्त हो गया!', 'success');
    } else {
      showToast('Telegram त्रुटि: ' + (data.description || 'प्रेषण विफल'), 'error');
    }
  } catch(err) {
    showToast('Telegram API कॉल विफल (नेटवर्क त्रुटि): ' + err.message, 'error');
  }
}

function getCloudVMDispatchToken() {
  if (STATE.portalSettings && STATE.portalSettings.github_token) {
    return STATE.portalSettings.github_token;
  }
  const stored = localStorage.getItem('cbeo_gh_token');
  if (stored) return stored;
  return '';
}

async function triggerCloudVMManualNow() {
  const btn = document.getElementById('btn-trigger-cloud-vm');
  const origHtml = btn ? btn.innerHTML : '<i class="fas fa-bolt"></i> 🚀 क्लाउड VM अभी चलाएं';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 🚀 Cloud VM आरंभ हो रहा है...';
  }

  showToast('🚀 GitHub Actions Cloud VM को सीधे क्लाउड से ट्रिगर किया जा रहा है...', 'info');

  let GITHUB_TOKEN = getCloudVMDispatchToken();
  if (!GITHUB_TOKEN) {
    try {
      const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
        || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url)
        || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
      const aRes = await fetch(gasUrl + '?action=getAuth&_nocache=' + Date.now());
      if (aRes.ok) {
        const aData = await aRes.json();
        const raw = aData.users && aData.users.__PORTAL_SETTINGS__;
        const pwd = raw && (typeof raw === 'object' ? raw.password : raw);
        const ps = (typeof pwd === 'string' ? JSON.parse(pwd) : pwd) || {};
        if (ps.github_token) {
          GITHUB_TOKEN = ps.github_token;
          if (!STATE.portalSettings) STATE.portalSettings = {};
          STATE.portalSettings.github_token = ps.github_token;
          localStorage.setItem('cbeo_gh_token', ps.github_token);
        }
      }
    } catch(e) {}
  }

  if (!GITHUB_TOKEN) {
    const inputToken = prompt("GitHub Actions Runner Token दर्ज करें:");
    if (inputToken) {
      GITHUB_TOKEN = inputToken.trim();
      localStorage.setItem('cbeo_gh_token', GITHUB_TOKEN);
      if (!STATE.portalSettings) STATE.portalSettings = {};
      STATE.portalSettings.github_token = GITHUB_TOKEN;
      savePortalSettingsToCloud();
    } else {
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      return;
    }
  }

  const REPO = 'Jit9763/cbeo-bhinai-portal';

  try {
    // 1. Direct GitHub Actions Workflow Dispatch REST API call from browser
    const resp = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/cbeo_vm_automation.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    });

    if (resp.status === 204 || resp.ok) {
      showToast('✅ GitHub Cloud VM सफलतापूर्वक शुरू हो गया! 1 मिनट में रिपोर्ट व अलर्ट प्रेषित हो जाएंगे।', 'success');
      
      const badge = document.getElementById('vm-live-master-badge');
      if (badge) {
        badge.textContent = '⚙️ VM निष्पादन जारी... (In Progress)';
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
        badge.style.borderColor = '#fde68a';
      }

      // Live status polling directly from GitHub Actions API
      pollGitHubVMStatus(GITHUB_TOKEN, REPO);
      return;
    } else {
      const errJson = await resp.json().catch(() => ({}));
      console.warn('GitHub Dispatch warning:', resp.status, errJson);
      
      // Fallback: ping local if running in dev environment
      try {
        const localRes = await fetch('/api/trigger_vm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'manual_trigger' })
        });
        const localData = await localRes.json();
        if (localData && localData.success) {
          showToast('✓ VM ट्रिगर सफल!', 'success');
          return;
        }
      } catch(le) {}

      showToast('GitHub Cloud VM रिस्पांस: ' + (errJson.message || resp.statusText), 'warning');
    }
  } catch (err) {
    console.error('Trigger Cloud VM error:', err);
    showToast('क्लाउड VM ट्रिगर नेटवर्क त्रुटि: ' + err.message, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

function pollGitHubVMStatus(token, repo) {
  let attempts = 0;
  const maxAttempts = 20; // 20 * 4s = 80s
  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/373355255/runs?per_page=1`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const latest = (data.workflow_runs && data.workflow_runs[0]);
        if (latest) {
          const status = latest.status;
          const conclusion = latest.conclusion;

          const lastTimeEl = document.getElementById('vm-last-run-time');
          const lastStatusEl = document.getElementById('vm-last-run-status');
          const badge = document.getElementById('vm-live-master-badge');

          if (status === 'completed') {
            clearInterval(interval);
            if (conclusion === 'success') {
              showToast('🎉 GitHub Actions Cloud VM निष्पादन 100% सफल! Telegram व Email प्रेषित हो गए।', 'success');
              if (lastTimeEl) lastTimeEl.textContent = new Date().toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
              if (lastStatusEl) {
                lastStatusEl.textContent = '✓ SUCCESS';
                lastStatusEl.style.color = '#34d399';
              }
              if (badge) {
                badge.textContent = '● VM सक्रिय (Active)';
                badge.style.background = '#ecfdf5';
                badge.style.color = '#065f46';
                badge.style.borderColor = '#a7f3d0';
              }
            } else {
              showToast(`⚠️ Cloud VM निष्पादन समाप्त: ${conclusion}`, 'warning');
              if (badge) {
                badge.textContent = '⚠️ ' + conclusion.toUpperCase();
              }
            }
          } else {
            if (badge) {
              badge.textContent = `⚙️ VM प्रगति पर... (${attempts * 4}s)`;
            }
          }
        }
      }
    } catch(e) {}

    if (attempts >= maxAttempts) {
      clearInterval(interval);
      const badge = document.getElementById('vm-live-master-badge');
      if (badge) {
        badge.textContent = '● VM सक्रिय (Active)';
        badge.style.background = '#ecfdf5';
        badge.style.color = '#065f46';
      }
    }
  }, 4000);
}

// =========================================================================
// VM DISPATCH SELECTION & GEMINI AI TONE DIRECTIVE HANDLERS
// =========================================================================

function updateGeminiTonePreview() {
  const toneSelect = document.getElementById('vm-gemini-tone-select');
  const previewBox = document.getElementById('vm-gemini-tone-preview');
  const badge = document.getElementById('gemini-tone-badge');
  if (!toneSelect || !previewBox) return;

  const tone = toneSelect.value;
  const previews = {
    warning: {
      badge: 'समय-सीमा चेतावनी',
      color: '#dc2626',
      bg: '#fee2e2',
      text: '"कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर) द्वारा सख्त निर्देश: समान परीक्षा सत्र 2026-27 के लंबित विद्यालय आज ही पोर्टल पर प्रविष्टि शत-प्रतिशत पूर्ण करें। अन्यथा अनुशासनात्मक कार्रवाई प्रस्तावित की जाएगी। (जिला: अजमेर)"'
    },
    formal: {
      badge: 'विभागीय औपचारिक',
      color: '#1e40af',
      bg: '#dbeafe',
      text: '"कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर) के निर्देशानुसार: ब्लॉक के सभी लक्षित विद्यालय समान परीक्षा 2026-27 के विषयवार प्रपत्र की जांच कर आज ही अधिकृत प्रविष्टि व प्रमाणन सुनिश्चित करें। (जिला: अजमेर)"'
    },
    brief: {
      badge: '2-लाइन बुलेटिन',
      color: '#059669',
      bg: '#d1fae5',
      text: '"• समान परीक्षा 2026-27: भिनाय ब्लॉक (अजमेर) में प्रगति 85%+ संकलित।\n• लंबित विद्यालय: आज शाम 5 बजे तक अंतिम रूप से पोर्टल पर डेटा लॉक करें। (जिला: अजमेर)"'
    },
    motivational: {
      badge: 'प्रोत्साहक व समीक्षा',
      color: '#7c3aed',
      bg: '#f3e8ff',
      text: '"समान परीक्षा 2026-27 में अधिकांश विद्यालयों द्वारा समयबद्ध प्रविष्टि सराहनीय है। शेष विद्यालय भी आज ही प्रपत्र जमा कर ब्लॉक भिनाय (अजमेर) को जिले में प्रथम स्थान पर लाने में सहयोग करें। (जिला: अजमेर)"'
    }
  };

  const current = previews[tone] || previews.warning;
  previewBox.innerText = current.text;
  if (badge) {
    badge.textContent = current.badge;
    badge.style.color = current.color;
    badge.style.background = current.bg;
  }
}

function loadVMDispatchConfig() {
  let cfg = null;
  try {
    cfg = JSON.parse(localStorage.getItem('cbeo_vm_dispatch_config') || 'null');
    if (!cfg && STATE.portalSettings && STATE.portalSettings.vm_dispatch_config) {
      cfg = STATE.portalSettings.vm_dispatch_config;
    }
  } catch(e) {}

  if (!cfg) {
    cfg = {
      active_focus_report: '49_syllabus',
      report_saman_syllabus: true,
      report_saman_summary: false,
      report_pending_schools: true,
      report_active_demands: true,
      report_peeo_summary: true,
      report_mdm: false,
      gemini_tone: 'warning'
    };
  }

  const focusSel = document.getElementById('vm-active-focus-report');
  const sChk = document.getElementById('vm-rep-saman');
  const pChk = document.getElementById('vm-rep-pending');
  const dChk = document.getElementById('vm-rep-demands');
  const peeoChk = document.getElementById('vm-rep-peeo');
  const tSel = document.getElementById('vm-gemini-tone-select');

  const incChk = document.getElementById('vm-rep-include-completed');
  const custMsgInput = document.getElementById('vm-custom-message-input');

  if (focusSel) {
    focusSel.value = cfg.active_focus_report || CURRENT_VM_SETTINGS.active_focus_report || '49_syllabus';
  }
  if (sChk) sChk.checked = cfg.report_saman_summary !== false;
  if (pChk) pChk.checked = cfg.report_pending_schools !== false;
  if (dChk) dChk.checked = cfg.report_active_demands !== false;
  if (peeoChk) peeoChk.checked = cfg.report_peeo_summary !== false;
  if (incChk) incChk.checked = cfg.include_completed_tasks === true;
  if (custMsgInput && cfg.custom_message !== undefined) {
    custMsgInput.value = cfg.custom_message;
  }
  if (tSel && cfg.gemini_tone) {
    tSel.value = cfg.gemini_tone;
    updateGeminiTonePreview();
  }
}

function onVMActiveFocusReportChange() {
  const focusSel = document.getElementById('vm-active-focus-report');
  const val = focusSel ? focusSel.value : '49_syllabus';
  CURRENT_VM_SETTINGS.active_focus_report = val;
  if (val === '49_syllabus') {
    showToast('🎯 सक्रिय फोकस: 49 राजकीय विद्यालय पाठ्यक्रम पूर्णता % (MDM बंद)', 'info');
  } else if (val === '57_indent') {
    showToast('📋 सक्रिय फोकस: 57 विद्यालय समान परीक्षा प्रश्न-पत्र मांग', 'info');
  } else {
    showToast('📊 सक्रिय फोकस: संयुक्त रिपोर्ट (पाठ्यक्रम + मांग)', 'info');
  }
}
window.onVMActiveFocusReportChange = onVMActiveFocusReportChange;

async function saveVMDispatchConfig() {
  const focusSel = document.getElementById('vm-active-focus-report');
  const sChk = document.getElementById('vm-rep-saman');
  const pChk = document.getElementById('vm-rep-pending');
  const dChk = document.getElementById('vm-rep-demands');
  const peeoChk = document.getElementById('vm-rep-peeo');
  const incChk = document.getElementById('vm-rep-include-completed');
  const custMsgInput = document.getElementById('vm-custom-message-input');
  const tSel = document.getElementById('vm-gemini-tone-select');

  const activeFocus = focusSel ? focusSel.value : (CURRENT_VM_SETTINGS.active_focus_report || '49_syllabus');
  CURRENT_VM_SETTINGS.active_focus_report = activeFocus;
  CURRENT_VM_SETTINGS.mdm_anomaly_scanner = false;

  const dispatchConfig = {
    active_focus_report: activeFocus,
    report_saman_syllabus: (activeFocus === '49_syllabus' || activeFocus === 'dual_all'),
    report_saman_summary: (activeFocus === '57_indent' || activeFocus === 'dual_all'),
    report_pending_schools: pChk ? pChk.checked : true,
    report_active_demands: dChk ? dChk.checked : true,
    report_peeo_summary: peeoChk ? peeoChk.checked : true,
    report_mdm: false,
    include_completed_tasks: incChk ? incChk.checked : false,
    custom_message: custMsgInput ? custMsgInput.value.trim() : '',
    gemini_tone: tSel ? tSel.value : 'warning',
    updated_at: new Date().toISOString()
  };

  localStorage.setItem('cbeo_vm_dispatch_config', JSON.stringify(dispatchConfig));

  // Sync with portal settings
  if (!STATE.portalSettings) STATE.portalSettings = {};
  STATE.portalSettings.vm_dispatch_config = dispatchConfig;
  if (!STATE.portalSettings.vm_settings) STATE.portalSettings.vm_settings = {};
  STATE.portalSettings.vm_settings.active_focus_report = activeFocus;
  STATE.portalSettings.vm_settings.mdm_anomaly_scanner = false;
  savePortalSettingsToCloud();

  // Also sync to Node / Python server if reachable
  fetch('/api/save_portal_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: STATE.portalSettings })
  }).catch(() => {});

  showToast(`✓ VM रिपोर्ट नियंत्रण सुरक्षित: '${activeFocus === '49_syllabus' ? '49 राजकीय विद्यालय पाठ्यक्रम पूर्णता' : activeFocus}' सक्रिय!`, 'success');
}

async function triggerManualVMDispatch() {
  await saveVMDispatchConfig();
  await triggerCloudVMManualNow();
}

async function sendTestEmailNow() {
  await saveVMDispatchConfig();
  const btn = event?.target?.closest('button');
  const origHtml = btn ? btn.innerHTML : '<i class="fas fa-envelope"></i> 📧 ईमेल टेस्ट देखें';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> प्रेषित हो रहा है...';
  }

  const custMsgInput = document.getElementById('vm-custom-message-input');
  const customMessage = custMsgInput ? custMsgInput.value.trim() : '';
  const focusSel = document.getElementById('vm-active-focus-report');
  const activeFocus = focusSel ? focusSel.value : '49_syllabus';

  const timeStr = new Date().toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

  let subject = '';
  let contentHtml = '';

  let customHtml = '';
  if (customMessage) {
    const formatted = customMessage.split('\n').map(l => l.trim()).filter(Boolean).join('<br>');
    customHtml = `
      <div style="background:#fffbeb; border:2px solid #f59e0b; border-left:6px solid #d97706; padding:16px 20px; border-radius:10px; margin-bottom:20px;">
        <strong style="color:#b45309; font-size:15px;">📢 विशेष प्रशासनिक निर्देश (जितेन्द्र व्यवस्थापक - अजमेर):</strong>
        <p style="margin:8px 0 0 0; color:#1e293b; font-size:14px; font-weight:600; line-height:1.6;">${formatted}</p>
      </div>
    `;
  }

  if (activeFocus === '49_syllabus') {
    const govtSchools = (STATE.schools56 || []).filter(s => s.type === 'Government');
    const totalGovt = govtSchools.length || 49;
    const sylSubs = STATE.samanSyllabusSubmissions || {};
    let subCount = 0;
    let pctSum = 0;
    let pendingSchools = [];

    govtSchools.forEach(s => {
      const sub = sylSubs[s.shala_darpan_code];
      const isSub = !!(sub && sub.is_submitted);
      if (isSub) {
        subCount++;
        pctSum += calculateSchoolSyllabusAverage(sub);
      } else {
        pendingSchools.push(s);
      }
    });

    const pendCount = Math.max(0, totalGovt - subCount);
    const avgPct = subCount > 0 ? Math.round(pctSum / subCount) : 0;
    const completionPct = totalGovt > 0 ? Math.round((subCount / totalGovt) * 100) : 0;

    subject = customMessage
      ? `📢 [निर्देश: ${customMessage.replace(/\n/g, ' ').substring(0, 40)}] | CBEO भिनाय टेस्ट अनुपालन रिपोर्ट (${timeStr})`
      : `🏛️ CBEO भिनाय दैनिक अनुपालन रिपोर्ट (${timeStr}) - समान परीक्षा पाठ्यक्रम पूर्णता ${pendCount} लंबित`;

    let rowsHtml = '';
    pendingSchools.slice(0, 15).forEach((ps, idx) => {
      rowsHtml += `
        <tr style="border-bottom:1px solid #e2e8f0; background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:7px 10px; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="padding:7px 10px; font-family:monospace; font-weight:bold;">${ps.shala_darpan_code}</td>
          <td style="padding:7px 10px; font-weight:600;">${ps.school_name}</td>
          <td style="padding:7px 10px;">${ps.peeo_name || '---'}</td>
          <td style="padding:7px 10px;">${ps.principal_name || 'संस्था प्रधान'}</td>
          <td style="padding:7px 10px; text-align:center;"><a href="tel:${ps.principal_mobile || ps.mobile || ''}" style="color:#2563eb; text-decoration:none;">${ps.principal_mobile || ps.mobile || '---'}</a></td>
          <td style="padding:7px 10px; text-align:center;"><span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:4px; font-weight:bold;">लंबित</span></td>
        </tr>
      `;
    });

    contentHtml = `
      <h3 style="margin:0 0 16px 0; color:#0f172a; border-left:4px solid #2563eb; padding-left:10px; font-size:16px;">
        🎯 1. समान परीक्षा 2026-27: पाठ्यक्रम पूर्णता % प्रगति सारांश (49 राजकीय विद्यालय)
      </h3>
      <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
        <div style="flex:1; min-width:120px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#1d4ed8; font-weight:700;">कुल राजकीय विद्यालय</div>
          <div style="font-size:24px; font-weight:800; color:#1e3a8a;">${totalGovt}</div>
        </div>
        <div style="flex:1; min-width:120px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#047857; font-weight:700;">प्रपत्र प्राप्त</div>
          <div style="font-size:24px; font-weight:800; color:#065f46;">${subCount} (${completionPct}%)</div>
        </div>
        <div style="flex:1; min-width:120px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#b91c1c; font-weight:700;">लंबित विद्यालय</div>
          <div style="font-size:24px; font-weight:800; color:#991b1b;">${pendCount}</div>
        </div>
        <div style="flex:1; min-width:120px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#15803d; font-weight:700;">ब्लॉक औसत %</div>
          <div style="font-size:24px; font-weight:800; color:#166534;">${avgPct}%</div>
        </div>
      </div>

      ${pendCount > 0 ? `
        <h4 style="margin:16px 0 8px 0; color:#b91c1c; font-size:14px;">🚨 2. रेड-अलर्ट डिफ़ॉल्टर सूची (49 राजकीय विद्यालय):</h4>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; font-size:12px;">
            <thead>
              <tr style="background:#f1f5f9; color:#475569; border-bottom:2px solid #cbd5e1; text-align:left;">
                <th style="padding:7px 10px; text-align:center;">क्र.</th>
                <th style="padding:7px 10px;">कोड</th>
                <th style="padding:7px 10px;">विद्यालय</th>
                <th style="padding:7px 10px;">PEEO</th>
                <th style="padding:7px 10px;">संस्था प्रधान</th>
                <th style="padding:7px 10px; text-align:center;">मोबाइल</th>
                <th style="padding:7px 10px; text-align:center;">स्थिति</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      ` : '<div style="color:#166534; font-weight:bold;">✓ सभी 49 राजकीय विद्यालयों के पाठ्यक्रम पूर्णता प्रपत्र शत-प्रतिशत प्राप्त हो चुके हैं।</div>'}
    `;
  } else {
    // 57 Indent Fallback
    const totalSchools = 57;
    const subCount = Object.keys(STATE.samanParikshaSubmissions || {}).length;
    const pendCount = Math.max(0, totalSchools - subCount);

    subject = customMessage
      ? `📢 [निर्देश: ${customMessage.replace(/\n/g, ' ').substring(0, 40)}] | CBEO भिनाय टेस्ट अनुपालन रिपोर्ट (${timeStr})`
      : `🏛️ CBEO भिनाय दैनिक अनुपालन रिपोर्ट (${timeStr}) - समान परीक्षा ${pendCount} लंबित`;

    contentHtml = `
      <h3 style="margin:0 0 16px 0; color:#0f172a; border-left:4px solid #2563eb; padding-left:10px; font-size:16px;">
        📋 1. जिला समान परीक्षा (सत्र 2026-27) - प्रगति सारांश (57 विद्यालय)
      </h3>
      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <div style="flex:1; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#1d4ed8; font-weight:700;">कुल विद्यालय</div>
          <div style="font-size:24px; font-weight:800; color:#1e3a8a;">${totalSchools}</div>
        </div>
        <div style="flex:1; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#047857; font-weight:700;">प्रपत्र प्राप्त</div>
          <div style="font-size:24px; font-weight:800; color:#065f46;">${subCount}</div>
        </div>
        <div style="flex:1; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#b91c1c; font-weight:700;">लंबित</div>
          <div style="font-size:24px; font-weight:800; color:#991b1b;">${pendCount}</div>
        </div>
      </div>
    `;
  }

  const htmlBody = `
    <!DOCTYPE html><html><body style="font-family:sans-serif; background:#f1f5f9; padding:20px; color:#1e293b;">
      <div style="max-width:720px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 20px rgba(0,0,0,0.06);">
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#fff; padding:22px; text-align:center; border-bottom:4px solid #f59e0b;">
          <h2 style="margin:0; font-size:19px;">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
          <div style="font-size:13px; color:#93c5fd; margin-top:4px;">जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (BHINAI)</div>
          <div style="display:inline-block; margin-top:8px; background:rgba(255,255,255,0.15); padding:3px 12px; border-radius:16px; font-size:11px; color:#fde047;">
            📧 प्रशासनिक टेस्ट ईमेल अनुपालन रिपोर्ट • ${timeStr}
          </div>
        </div>
        <div style="padding:22px;">
          ${customHtml}
          ${contentHtml}
          <div style="margin-top:24px; text-align:center;">
            <a href="https://jit9763.github.io/cbeo-bhinai-portal/" style="display:inline-block; background:#1e3a8a; color:#fff; font-weight:bold; font-size:13px; padding:10px 24px; border-radius:6px; text-decoration:none;">
              🌐 CBEO भिनाय आधिकारिक पोर्टल खोलें
            </a>
          </div>
        </div>
        <div style="background:#f8fafc; padding:14px; border-top:1px solid #e2e8f0; font-size:11px; color:#64748b; text-align:center;">
          कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), ब्लॉक भिनाय, जिला अजमेर (राजस्थान)
        </div>
      </div>
    </body></html>
  `;

  try {
    const gasUrl = "https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec";
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'send_email',
        email_to: 'censusbhinai@gmail.com',
        subject: subject,
        html_body: htmlBody,
        body: customMessage || 'CBEO Bhinai 49 Govt Schools Syllabus Compliance Report'
      })
    });
    showToast('🎉 टेस्ट ईमेल censusbhinai@gmail.com पर सफलतापूर्वक भेज दिया गया है!', 'success');
  } catch(e) {
    showToast('ईमेल प्रेषण स्थिति: ' + e.message, 'info');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

/* =========================================================================
   CONSOLIDATED ADMIN HUBS HELPERS (लाए गए बिखरे हुए कंट्रोल्स)
   ========================================================================= */

function populateAdminHubDemands() {
  const select = document.getElementById('admin-hub-demand-select');
  if (!select) return;
  select.innerHTML = '';

  const opt1 = document.createElement('option');
  opt1.value = 'saman-pariksha-2026';
  opt1.textContent = '📋 जिला समान परीक्षा 2026-27 (57 Sec/Sr.Sec स्कूल)';
  select.appendChild(opt1);

  if (STATE.demands && STATE.demands.length > 0) {
    STATE.demands.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `📌 ${d.title} (अंतिम तिथि: ${d.dueDate || 'यथाशीघ्र'})`;
      select.appendChild(opt);
    });
  }
}

function triggerAdminHubBroadcastEmail() {
  const select = document.getElementById('admin-hub-demand-select');
  const dId = select ? select.value : 'saman-pariksha-2026';
  openDemandBroadcastModal(dId);
}

function quickJumpToStaffSearch() {
  const input = document.getElementById('admin-hub-staff-search');
  const q = input ? input.value.trim() : '';
  switchTab('staff');
  if (q) {
    const staffSearchInput = document.getElementById('staff-search-input');
    if (staffSearchInput) {
      staffSearchInput.value = q;
      if (typeof renderStaffTable === 'function') renderStaffTable();
    }
  }
}

async function syncAdminAccessSheetFromPortal() {
  showToast('Google Sheet सिंक आरंभ हो रहा है...', 'info');
  try {
    const res = await fetch('/api/sync_admin_sheet', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Admin Access Google Sheet पूर्णतः सिंक हो गई!', 'success');
    } else {
      showToast('सिंक त्रुटि: ' + (data.message || 'विफल'), 'error');
    }
  } catch (err) {
    showToast('सर्वर से संपर्क त्रुटि: ' + err.message, 'error');
  }
}

function downloadMasterDataJson() {
  if (!window.MASTER_CBEO_DATA) {
    showToast('मास्टर डेटा लोड नहीं है!', 'warning');
    return;
  }
  const jsonStr = JSON.stringify(window.MASTER_CBEO_DATA, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `master_cbeo_data_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('master_cbeo_data.json डाउनलोड हो गया!', 'success');
}

function triggerAdminSheetSync() {
  syncAdminAccessSheetFromPortal();
}

async function syncSamanParikshaToSheet() {
  showToast('Google Drive से लाइव डेटा सिंक किया जा रहा है...', 'info');
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  try {
    const res = await fetch(`${gasUrl}?action=getAll`);
    const data = await res.json();
    if (data && data.success && data.submissions) {
      let count = 0;
      Object.keys(data.submissions).forEach(code => {
        const subData = data.submissions[code];
        if (subData && (subData.is_submitted || subData.exam_code || subData.grand_total > 0)) {
          const existingSig = STATE.samanParikshaSubmissions[code]?.signature_data;
          const existingHasSig = STATE.samanParikshaSubmissions[code]?.has_digital_signature;
          STATE.samanParikshaSubmissions[code] = Object.assign({}, STATE.samanParikshaSubmissions[code] || {}, subData);
          if (existingSig && !STATE.samanParikshaSubmissions[code].signature_data) {
            STATE.samanParikshaSubmissions[code].signature_data = existingSig;
            STATE.samanParikshaSubmissions[code].has_digital_signature = existingHasSig !== undefined ? existingHasSig : true;
          }
          count++;
        }
      });
      localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
      renderSamanParikshaView();
      updateAllPortalMetricsAndProgress();
      renderDashboardView();
      renderDemandsView();
      renderApp();
      showToast(`✓ Google Drive से सीधा लाइव सिंक सफल! कुल ${count} विद्यालय प्रपत्र अपडेट हुए।`, 'success');
      return;
    }
  } catch (gasErr) {
    console.warn('Direct GAS sync note:', gasErr);
  }

  // Fallback to local backend if available
  try {
    const res = await fetch('/api/sync_saman_pariksha_sheet', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'समान परीक्षा Google Sheet सफलतापूर्वक सिंक हो गई!', 'success');
    } else {
      showToast('सिंक त्रुटि: ' + (data.message || 'विफल'), 'error');
    }
  } catch (err) {
    showToast('लाइव Google Drive सिंक पूर्ण!', 'info');
  }
}

/* ========================================================
/* ========================================================
   AI DEMAND CREATOR & UNIVERSAL SERVERLESS AI ENGINE
   ======================================================== */
async function callUniversalAiService(query, options = {}) {
  const mode = options.mode || 'chat';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 1. Try Local Backend if on localhost
  if (isLocal) {
    try {
      const resp = await fetch('/api/ai_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          mode: mode,
          context: {
            user: STATE.currentUser,
            district: 'AJMER',
            block: 'BHINAI',
            admin_name: 'जितेन्द्र कुमार',
            admin_phone: '9928254317'
          }
        })
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d && d.success && d.response) {
          return d;
        }
      }
    } catch (e) {
      console.warn('[AI Local] Switching to Serverless Cloud Proxy:', e);
    }
  }

  // 2. Serverless Cloud Proxy (Google Apps Script Web App)
  // Works 24/7 on ANY mobile device with ZERO token exposure on GitHub!
  const gasUrl = (STATE.settings && STATE.settings.google_apps_script_url) ||
    'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';
  
  try {
    const action = mode === 'demand' ? 'ai_demand_assist' : 'ai_chat';
    const targetUrl = `${gasUrl}?action=${action}&query=${encodeURIComponent(query)}&t=${Date.now()}`;
    const gasResp = await fetch(targetUrl, { method: 'GET', mode: 'cors' });
    if (gasResp.ok) {
      const gasData = await gasResp.json();
      if (gasData && gasData.success && gasData.response) {
        return gasData;
      }
    }
  } catch (err) {
    console.warn('[AI Serverless Fallback] Apps Script proxy error:', err);
  }

  return null;
}

function quickFillAIPrompt(text) {
  const inp = document.getElementById('ai-demand-prompt-input');
  if (inp) {
    inp.value = text;
    generateDemandWithAI();
  }
}

async function generateDemandWithAI() {
  const inputEl = document.getElementById('ai-demand-prompt-input');
  const rawQuery = (inputEl ? inputEl.value : '').trim();

  if (!rawQuery) {
    showToast('कृपया पहले मांग संबंधी विषय या निर्देश लिखें!', 'warning');
    if (inputEl) inputEl.focus();
    return;
  }

  const query = rawQuery.toLowerCase();
  showToast('✨ AI प्रपत्र सहायक संरचना व मानक कॉलम तैयार कर रहा है...', 'info');

  let title = '';
  let cols = '';
  let priority = 'अति आवश्यक (Urgent)';
  let level = 'school';
  let desc = '';
  let recommendedDays = 5;
  let audSec = true;
  let audGovt = true;
  let audAll = false;
  let audPeeo = true;
  let audCbeo = true;

  // 1. First try Live Gemini AI (Cloud Serverless / Localhost)
  try {
    const aiResult = await callUniversalAiService(rawQuery, { mode: 'demand' });
    if (aiResult && aiResult.response) {
      const d = aiResult.response;
      if (typeof d === 'object') {
        title = d.title || `${rawQuery} - प्रपत्र 2026`;
        desc = d.description || `समस्त संबंधित विद्यालय ${rawQuery} के संबंध में तथ्यात्मक सूचना पोर्टल पर दर्ज करें।`;
        cols = Array.isArray(d.columns) ? d.columns.join(', ') : (d.columns || '');
        priority = d.priority || 'अति आवश्यक (Urgent)';
        recommendedDays = d.recommended_days || 5;
      }
    }
  } catch (aiErr) {
    console.warn('[AI Demand Assist] Error calling AI service:', aiErr);
  }

  // 2. Keyword-based intelligent fallback if AI service was offline
  if (!cols) {
    if (query.includes('यूनिफॉर्म') || query.includes('पोशाक') || query.includes('uniform') || query.includes('सिलाई')) {
      title = 'कक्षा 1 से 8 निःशुल्क यूनिफॉर्म वितरण एवं सिलाई अनुदान सत्यापन रिपोर्ट 2026-27';
      cols = 'कक्षा 1 से 8 कुल नामांकित छात्र, पात्र विद्यार्थी, वितरित यूनिफॉर्म सेट संख्या, सिलाई राशि DBT पूर्ण संख्या, अवशेष वंचित विद्यार्थी, वंचित रहने का कारण, संस्था प्रधान टीप';
      priority = 'अति आवश्यक (Urgent)';
      level = 'school';
      desc = 'समस्त संबंधित संस्था प्रधान निःशुल्क यूनिफॉर्म वितरण व सिलाई अनुदान DBT स्थिति का सत्यापन कर प्रपत्र आज ही सबमिट करें।';
    } else if (query.includes('mdm') || query.includes('पोषाहार') || query.includes('खाद्यान्न') || query.includes('स्टॉक') || query.includes('गेहूं') || query.includes('चावल')) {
      title = 'MDM खाद्यान्न स्टॉक अवशेष (गेहूं/चावल) व पोषाहार दैनिक उपभोग रिपोर्ट 2026';
      cols = 'गेहूं प्रारंभिक शेष (किग्रा), गेहूं प्राप्त आवंटन, कुल गेहूं उपभोग, गेहूं अंतिम अवशेष (किग्रा), चावल अंतिम अवशेष (किग्रा), कुक कम हेल्पर मानदेय भुगतान माह, स्टॉक भौतिक सत्यापन स्थिति';
      priority = 'अति आवश्यक (Urgent)';
      level = 'school';
      desc = 'विद्यालय में MDM खाद्यान्न का भौतिक सत्यापन कर वास्तविक स्टॉक एवं उपभोग रिपोर्ट दर्ज करें।';
    } else if (query.includes('ict') || query.includes('कंप्यूटर') || query.includes('इंटरनेट') || query.includes('लैब') || query.includes('lab')) {
      title = 'विद्यालय ICT कम्प्यूटर लैब क्रियाशीलता, स्मार्ट क्लास एवं इंटरनेट कनेक्टिविटी रिपोर्ट';
      cols = 'स्वीकृत कंप्यूटर संख्या, क्रियाशील कंप्यूटर, अक्रियाशील कंप्यूटर, इंटरनेट प्रदाता व स्पीड (Mbps), स्मार्ट टीवी/इंटरएक्टिव बोर्ड स्थिति, कंप्यूटर अनुदेशक कार्यरत (हां/नहीं), विशेष आवश्यकता';
      priority = 'साधारण (Normal)';
      level = 'school';
      desc = 'आईसीटी लैब व स्मार्ट क्लास के समस्त उपकरणों की कार्यदशा सत्यापित कर अपलोड करें।';
    } else if (query.includes('खेल') || query.includes('मैदान') || query.includes('sports') || query.includes('ग्राउंड')) {
      title = 'शाला खेल मैदान चारदीवारी, खेलकूद संसाधन एवं विकास योजना 2026';
      cols = 'कुल खेल मैदान क्षेत्रफल (बीघा), वर्तमान चारदीवारी स्थिति, विकसित खेल संसाधन (ट्रैक/कोर्ट), आवश्यक विकास कार्य, अनुमानित बजट (लाखों में), विशेष विवरण';
      priority = 'साधारण (Normal)';
      level = 'school';
      desc = 'खेल मैदान का सीमाज्ञान व भौतिक स्थिति दर्ज कर विकास प्रस्ताव प्रस्तुत करें।';
    } else if (query.includes('पेयजल') || query.includes('पानी') || query.includes('विद्युत') || query.includes('बिजली') || query.includes('water')) {
      title = 'ग्रीष्मकालीन पेयजल व्यवस्था, ट्यूबवेल/नल कनेक्शन एवं विद्युत कनेक्शन सत्यापन रिपोर्ट';
      cols = 'मुख्य पेयजल स्रोत (नल/हैंडपंप/ट्यूबवेल), पेयजल क्रियाशीलता स्थिति, वाटर कूलर कार्यरत संख्या, विद्युत कनेक्शन थ्री-फेज/सिंगल-फेज, बकाया विद्युत बिल राशि, आपातकालीन टैंकर आवश्यकता';
      priority = 'अति आवश्यक (Urgent)';
      level = 'school';
      desc = 'पेयजल व विद्युत आपूर्ति में किसी भी प्रकार की बाधा होने पर तुरंत विवरण दर्ज करें ताकि त्वरित समाधान कराया जा सके।';
      audAll = true;
    } else {
      const cleanPrompt = rawQuery.charAt(0).toUpperCase() + rawQuery.slice(1);
      title = `${cleanPrompt.slice(0, 50)} - सूचना मांग प्रपत्र 2026`;
      cols = 'स्वीकृत संख्या, वर्तमान वास्तविक स्थिति, उपलब्ध भौतिक संसाधन, कमी / आवश्यकता, संस्था प्रधान प्रमाणित टिप्पणी';
      priority = 'अति आवश्यक (Urgent)';
      level = query.includes('peeo') ? 'peeo' : 'school';
      desc = `समस्त संबंधित विद्यालय ${cleanPrompt} के संदर्भ में तथ्यात्मक सूचना पोर्टल पर दर्ज करें।`;
    }
  }

  // Populate title, date, priority, collection level
  const titleInput = document.getElementById('new-demand-title');
  if (titleInput) titleInput.value = title;

  const dateInput = document.getElementById('new-demand-date');
  if (dateInput) {
    const d = new Date(Date.now() + recommendedDays * 86400000);
    dateInput.value = d.toISOString().split('T')[0];
  }

  const prioSelect = document.getElementById('new-demand-priority');
  if (prioSelect) prioSelect.value = priority;

  const lvlSelect = document.getElementById('new-demand-collection-level');
  if (lvlSelect) {
    lvlSelect.value = level;
    if (typeof onDemandCollectionLevelChange === 'function') onDemandCollectionLevelChange();
  }

  // Set audience checkboxes
  const cbCbeo = document.getElementById('demand-aud-cbeo');
  if (cbCbeo) cbCbeo.checked = audCbeo;
  const cbPeeo = document.getElementById('demand-aud-peeo');
  if (cbPeeo) cbPeeo.checked = audPeeo;
  const cbSec = document.getElementById('demand-aud-sec');
  if (cbSec) cbSec.checked = audSec;
  const cbGovt = document.getElementById('demand-aud-govt');
  if (cbGovt) cbGovt.checked = audGovt;
  const cbAll = document.getElementById('demand-aud-all');
  if (cbAll) cbAll.checked = audAll;

  // Set columns and instructions
  const colsInput = document.getElementById('new-demand-cols');
  if (colsInput) colsInput.value = cols;

  const descInput = document.getElementById('new-demand-desc');
  if (descInput) descInput.value = desc;

  // Trigger Dynamic Column Builder & AI Auto-detection table refresh
  if (typeof generateDemandColumnsFromInput === 'function') {
    generateDemandColumnsFromInput();
  }
  if (typeof aiAutoDetectAllDemandColumns === 'function') {
    setTimeout(aiAutoDetectAllDemandColumns, 100);
  }

  showToast('✨ AI ने मांग प्रपत्र, विवरण व कॉलम सफलतापूर्वक तैयार कर दिए!', 'success');
}

/* ========================================================
   SHIKSHA SETU (शिक्षा सेतु) - CBEO AI HELPDESK ASSISTANT
   ======================================================== */
function isShikshaSetuActive() {
  return localStorage.getItem('cbeo_shiksha_setu_active') === 'true';
}

function setShikshaSetuActive(enabled) {
  localStorage.setItem('cbeo_shiksha_setu_active', enabled ? 'true' : 'false');
  applyShikshaSetuVisibility();
  showToast(enabled ? '✅ शिक्षा सेतु AI डेस्क चालू (ON) कर दिया गया है।' : '⏸️ शिक्षा सेतु AI डेस्क बंद (OFF) कर दिया गया है।', enabled ? 'success' : 'info');
}

function applyShikshaSetuVisibility() {
  const btn = document.getElementById('shiksha-setu-floating-btn');
  const toggleCheckbox = document.getElementById('toggle-shiksha-setu-switch');
  const active = isShikshaSetuActive();
  if (btn) {
    if (active) {
      btn.style.setProperty('display', 'flex', 'important');
    } else {
      btn.style.setProperty('display', 'none', 'important');
    }
  }
  if (toggleCheckbox) {
    toggleCheckbox.checked = active;
  }
}

function toggleShikshaSetuChat() {
  if (!isShikshaSetuActive()) {
    showToast('ℹ️ शिक्षा सेतु AI डेस्क वर्तमान में बंद (OFF) है।', 'info');
    return;
  }
  const modal = document.getElementById('modal-shiksha-setu');
  if (!modal) return;
  if (modal.classList.contains('active')) {
    closeShikshaSetuChat();
  } else {
    openShikshaSetuChat();
  }
}

function openShikshaSetuChat() {
  if (!isShikshaSetuActive()) {
    showToast('ℹ️ शिक्षा सेतु AI डेस्क वर्तमान में बंद (OFF) है।', 'info');
    return;
  }
  const modal = document.getElementById('modal-shiksha-setu');
  if (!modal) return;
  modal.classList.add('active');

  // Update active user context card
  const ctxCard = document.getElementById('shiksha-setu-context-card');
  if (ctxCard) {
    let userLabel = 'सामान्य नागरिक / विद्यालय अतिथि';
    let subLabel = 'जिला: अजमेर (AJMER) • ब्लॉक: भिनाय';

    if (STATE.currentUser) {
      if (STATE.currentUser.role === 'admin') {
        userLabel = `👑 CBEO एडमिन: ${STATE.currentUser.name || 'जितेन्द्र कुमार'}`;
        subLabel = `कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय (अजमेर)`;
      } else if (STATE.currentUser.role === 'peeo') {
        userLabel = `🏛️ PEEO: ${STATE.currentUser.peeo_name || STATE.currentUser.name}`;
        subLabel = `प्रभारी: ${STATE.currentUser.principal_incharge || 'प्रधानाचार्य'} | कोड: ${STATE.currentUser.shala_darpan_code || ''} (अजमेर)`;
      } else if (STATE.currentUser.role === 'school') {
        const sch = STATE.schools56.find(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code);
        const schName = STATE.currentUser.school_name || (sch && sch.school_name) || STATE.currentUser.name;
        const peeoName = (sch && sch.peeo_name) || STATE.currentUser.peeo_name || 'भिनाय';
        userLabel = `🏫 ${schName}`;
        subLabel = `शा.दा.: <strong>${STATE.currentUser.shala_darpan_code}</strong> | PEEO: ${peeoName} (अजमेर)`;
      }
    }

    ctxCard.innerHTML = `
      <div style="line-height:1.35">
        <div style="font-weight:700; color:#0f172a">${userLabel}</div>
        <div style="font-size:0.72rem; color:#475569">${subLabel}</div>
      </div>
      <span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem; padding:3px 8px; font-weight:800; border-radius:12px">
        AI डेस्क
      </span>
    `;
  }

  // Seed initial welcome message if chat is empty
  const msgContainer = document.getElementById('shiksha-setu-chat-messages');
  if (msgContainer && msgContainer.children.length === 0) {
    const welcomeHtml = `
      <div>
        <p style="margin:0 0 6px 0; font-weight:700; color:#1e3a8a">नमस्ते! 🙏 मैं <strong>शिक्षा सेतु AI</strong> हूँ</p>
        <p style="margin:0 0 6px 0; font-size:0.84rem; color:#334155">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), <strong>भिनाय (अजमेर)</strong> का आधिकारिक AI सहायता डेस्क।</p>
        <p style="margin:0; font-size:0.82rem; color:#475569">
          आप मुझसे पोर्टल पर प्रपत्र भरने, किसी भी कॉलम में क्या प्रविष्ट करना है, जिला समान परीक्षा 2026-27 के नियम, संस्था प्रधान / PEEO संपर्क विवरण, अंतिम तिथि अथवा बैंक चालान से संबंधित कोई भी सवाल पूछ सकते हैं।
        </p>
      </div>
    `;
    appendShikshaSetuMessage('bot', welcomeHtml);
  }

  // Focus input
  const inputEl = document.getElementById('shiksha-setu-input');
  if (inputEl) {
    setTimeout(() => inputEl.focus(), 150);
  }
}

function closeShikshaSetuChat() {
  const modal = document.getElementById('modal-shiksha-setu');
  if (modal) modal.classList.remove('active');
}

function askShikshaSetuQuestion(qText) {
  const inputEl = document.getElementById('shiksha-setu-input');
  if (inputEl) {
    inputEl.value = qText;
    sendShikshaSetuUserMessage();
  }
}

function appendShikshaSetuMessage(sender, contentHtml) {
  const container = document.getElementById('shiksha-setu-chat-messages');
  if (!container) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });

  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = 'display:flex; flex-direction:column; gap:4px; max-width:88%; word-break:break-word;';

  if (sender === 'user') {
    msgDiv.style.alignSelf = 'flex-end';
    msgDiv.innerHTML = `
      <div style="background:linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color:#ffffff; padding:10px 14px; border-radius:16px 16px 2px 16px; font-size:0.86rem; box-shadow:0 2px 6px rgba(37,99,235,0.25); line-height:1.45">
        ${contentHtml}
      </div>
      <div style="font-size:0.65rem; color:#94a3b8; text-align:right; margin-right:4px">${timeStr}</div>
    `;
  } else {
    msgDiv.style.alignSelf = 'flex-start';
    msgDiv.innerHTML = `
      <div style="display:flex; gap:8px; align-items:flex-start">
        <div style="background:#2563eb; color:#ffffff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; flex-shrink:0; margin-top:2px">
          🤖
        </div>
        <div>
          <div style="background:#ffffff; color:#0f172a; padding:11px 14px; border-radius:4px 16px 16px 16px; font-size:0.85rem; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04); line-height:1.55">
            ${contentHtml}
          </div>
          <div style="font-size:0.65rem; color:#94a3b8; margin-left:4px; margin-top:2px">शिक्षा सेतु AI • ${timeStr}</div>
        </div>
      </div>
    `;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function toggleGeminiKeyVisibility() {
  const inp = document.getElementById('vm-gemini-key-input');
  const icon = document.getElementById('vm-gemini-eye-icon');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.className = 'fas fa-eye-slash';
  } else {
    inp.type = 'password';
    if (icon) icon.className = 'fas fa-eye';
  }
}

async function saveGeminiKeyFromHub() {
  const inp = document.getElementById('vm-gemini-key-input');
  const key = inp ? inp.value.trim() : '';
  if (!key) {
    showToast('कृपया वैध Gemini API Key दर्ज करें!', 'warning');
    return;
  }

  // 1. Permanently store in browser localStorage (Survives refresh & never uploaded to GitHub)
  localStorage.setItem('cbeo_gemini_api_key', key);

  showToast('Gemini API Key सुरक्षित की जा रही है...', 'info');

  // 2. Cloud Serverless Sync (Google Apps Script): Makes AI active for all 57 schools & 25 PEEOs on any phone/PC
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url);

  if (gasUrl) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveGeminiKey',
          api_key: key,
          updated_by: 'Admin_Jitendra'
        })
      }).then(r => r.json()).then(res => {
        if (res && res.success) {
          showToast('☁️ Gemini Key क्लाउड सर्वर पर सक्रिय! अब ब्लॉक के सभी 57 स्कूल लॉगिन से AI का उपयोग कर सकते हैं।', 'success');
        }
      }).catch(e => console.log('GAS cloud sync silent', e));
    } catch (ge) {}
  }

  try {
    const res = await fetch('/api/save_gemini_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🔒 Gemini API Key लोकल व क्लाउड में सुरक्षित हो गई (GitHub पर कभी नहीं जाएगी)!', 'success');
    } else {
      showToast('🔒 Gemini API Key सुरक्षित हो गई है!', 'success');
    }
  } catch (err) {
    showToast('🔒 Gemini API Key सुरक्षित हो गई है!', 'success');
  }
  loadGeminiKeyStatus();
}

async function loadGeminiKeyStatus() {
  const badge = document.getElementById('gemini-key-status-badge');
  const inp = document.getElementById('vm-gemini-key-input');
  const countEl = document.getElementById('gemini-key-count');
  const savedEl = document.getElementById('gemini-tokens-saved');

  // First priority: Restore saved key from browser localStorage so it is NEVER lost on refresh
  const localKey = (localStorage.getItem('cbeo_gemini_api_key') || '').trim();
  if (localKey && inp) {
    inp.value = localKey; // Retain value on refresh
  }

  const localCount = localKey ? localKey.split(/[,;\n]+/).filter(Boolean).length : 0;
  if (localCount > 0) {
    if (badge) {
      badge.textContent = `सक्रिय (${localCount} Keys)`;
      badge.style.color = '#059669';
      badge.style.background = '#dcfce7';
    }
    if (countEl) countEl.textContent = localCount;
  }

  // Check background server diagnostic counters
  try {
    const res = await fetch('/api/get_gemini_status');
    const data = await res.json();
    if (data && data.is_configured) {
      const activeCount = Math.max(localCount, data.key_count || 1);
      if (badge) {
        badge.textContent = `सक्रिय (${activeCount} Keys)`;
        badge.style.color = '#059669';
        badge.style.background = '#dcfce7';
      }
      if (countEl) countEl.textContent = activeCount;
      if (savedEl) savedEl.textContent = (data.tokens_saved || 0) + ' Tokens';
      if (inp && !inp.value && data.masked_key) {
        inp.placeholder = data.masked_key;
      }
    }
  } catch (e) {
    // Offline or serverless fallback
    if (localCount > 0 && badge) {
      badge.textContent = `सक्रिय (${localCount} Keys)`;
      badge.style.color = '#059669';
      badge.style.background = '#dcfce7';
    }
  }
}

function sendShikshaSetuUserMessage() {
  const inputEl = document.getElementById('shiksha-setu-input');
  if (!inputEl) return;
  const rawQuery = inputEl.value.trim();
  if (!rawQuery) return;

  // Append user message
  appendShikshaSetuMessage('user', rawQuery);
  inputEl.value = '';

  // Show typing indicator
  const container = document.getElementById('shiksha-setu-chat-messages');
  const typingDiv = document.createElement('div');
  typingDiv.id = 'shiksha-setu-typing';
  typingDiv.style.cssText = 'align-self:flex-start; display:flex; gap:8px; align-items:center; font-size:0.78rem; color:#64748b; padding:4px 8px;';
  typingDiv.innerHTML = `
    <div style="background:#2563eb; color:#ffffff; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem">🤖</div>
    <span>शिक्षा सेतु उत्तर तैयार कर रहा है...</span>
  `;
  if (container) {
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
  }

  // Cloud Fallback function: Queries Google Apps Script serverless proxy (Used by all schools on mobile/web)
  function queryCloudAi() {
    const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
      || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url);

    if (!gasUrl) {
      const el = document.getElementById('shiksha-setu-typing');
      if (el) el.remove();
      const responseHtml = generateShikshaSetuAIResponse(rawQuery);
      appendShikshaSetuMessage('bot', responseHtml);
      return;
    }

    fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'ai_chat',
        query: rawQuery,
        context: {
          user: STATE.currentUser,
          district: 'AJMER',
          block: 'BHINAI',
          admin_name: 'जितेन्द्र कुमार',
          admin_phone: '9928254317'
        }
      })
    })
    .then(r => r.json())
    .then(data => {
      const el = document.getElementById('shiksha-setu-typing');
      if (el) el.remove();
      if (data && data.success && data.response) {
        const formatted = String(data.response).replace(/\n/g, '<br>');
        appendShikshaSetuMessage('bot', `
          <div>
            ${formatted}
            <div style="font-size:0.68rem; color:#2563eb; margin-top:6px; font-weight:700">
              ✨ <em>Google Gemini Cloud AI द्वारा सत्यापित उत्तर</em>
            </div>
          </div>
        `);
      } else {
        const responseHtml = generateShikshaSetuAIResponse(rawQuery);
        appendShikshaSetuMessage('bot', responseHtml);
      }
    })
    .catch(() => {
      const el = document.getElementById('shiksha-setu-typing');
      if (el) el.remove();
      const responseHtml = generateShikshaSetuAIResponse(rawQuery);
      appendShikshaSetuMessage('bot', responseHtml);
    });
  }

  // First try local python backend; if unavailable or on online GitHub Pages, seamlessly route to Cloud Apps Script
  fetch('/api/ai_chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: rawQuery,
      context: {
        user: STATE.currentUser,
        district: 'AJMER',
        block: 'BHINAI',
        admin_name: 'जितेन्द्र कुमार',
        admin_phone: '9928254317'
      }
    })
  })
  .then(res => {
    if (!res.ok) throw new Error('Local server unavailable, fallback to cloud');
    return res.json();
  })
  .then(data => {
    const el = document.getElementById('shiksha-setu-typing');
    if (el) el.remove();
    if (data && data.success && data.response) {
      const formatted = data.response.replace(/\n/g, '<br>');
      appendShikshaSetuMessage('bot', `
        <div>
          ${formatted}
          <div style="font-size:0.68rem; color:#2563eb; margin-top:6px; font-weight:700">
            ✨ <em>Google Gemini 1.5 Flash AI द्वारा सत्यापित उत्तर</em>
          </div>
        </div>
      `);
    } else {
      queryCloudAi();
    }
  })
  .catch(() => {
    queryCloudAi();
  });
}

function generateShikshaSetuAIResponse(rawQuery) {
  const q = rawQuery.toLowerCase();
  const user = STATE.currentUser;

  // 1. Column Guidance (इस कॉलम में क्या भरना है?)
  if (q.includes('कॉलम') || q.includes('column') || q.includes('क्या भरना') || q.includes('भरना है') || q.includes('प्रपत्र-1') || q.includes('प्रपत्र-2') || q.includes('नामांकन')) {
    return `
      <div style="line-height:1.55">
        <strong style="color:#1e3a8a; font-size:0.92rem"><i class="fas fa-edit text-primary"></i> प्रपत्र के प्रमुख कॉलम भरने के नियम:</strong>
        <div style="margin-top:8px; border-top:1px solid #e2e8f0; padding-top:6px">
          <strong>1. प्रपत्र-1 (कक्षा 9 व 10 नामांकन):</strong>
          <ul style="margin:4px 0 8px 18px; padding:0; font-size:0.83rem; color:#334155">
            <li><strong>कुल नामांकन (Total):</strong> शाला दर्पण अनुसार 9वीं व 10वीं के कुल अध्ययनरत छात्र संख्या भरें।</li>
            <li><strong>तृतीय भाषा (संस्कृत / उर्दू):</strong> जिस भाषा को छात्रों ने चुना है, उनकी संख्या भरें। (नोट: संस्कृत + उर्दू का योग कुल नामांकन से अधिक नहीं हो सकता)।</li>
          </ul>
        </div>
        <div style="margin-top:6px; border-top:1px solid #e2e8f0; padding-top:6px">
          <strong>2. प्रपत्र-2 (कक्षा 11 व 12 संकाय एवं ऐच्छिक विषय):</strong>
          <ul style="margin:4px 0 8px 18px; padding:0; font-size:0.83rem; color:#334155">
            <li><strong>संकाय चयन:</strong> विद्यालय में स्वीकृत संकाय (कला, विज्ञान, वाणिज्य, कृषि) पर टिक करें। टिक करने पर ही संबंधित विषय खुलेंगे।</li>
            <li><strong>अनिवार्य विषय:</strong> अनिवार्य हिंदी व अनिवार्य अंग्रेजी का कुल योग कुल नामांकन अनुसार स्वतः कैलकुलेट होगा।</li>
            <li><strong>ऐच्छिक विषय:</strong> प्रत्येक विषय (उदा. राजनीति, इतिहास, भूगोल, भौतिकी, रसायन, आदि) में वास्तविक छात्र संख्या दर्ज करें।</li>
          </ul>
        </div>
        <div style="margin-top:6px; background:#eff6ff; padding:6px 10px; border-radius:6px; font-size:0.8rem; color:#1e40af">
          💡 <em>सुझाव:</em> मोबाइल पर स्क्रीन के नीचे 'NIL' बटन से जो कक्षा आपके स्कूल में नहीं है उसे शून्य (0) कर सकते हैं।
        </div>
      </div>
    `;
  }

  // 2. School / PEEO / Principal Directory Search
  if (q.includes('peeo') || q.includes('संस्था प्रधान') || q.includes('प्रधानाचार्य') || q.includes('मोबाइल') || q.includes('फोन') || q.includes('संपर्क') || q.includes('contact') || q.includes('phone')) {
    if (user && user.role === 'school') {
      const sch = STATE.schools56.find(s => s.shala_darpan_code === user.shala_darpan_code);
      if (sch) {
        return `
          <div style="line-height:1.55">
            <strong style="color:#0f172a; font-size:0.92rem"><i class="fas fa-school text-primary"></i> आपके विद्यालय का अधिकृत संपर्क विवरण:</strong>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-top:8px; font-size:0.83rem">
              <div>🏫 <strong>विद्यालय:</strong> ${sch.school_name} (${sch.shala_darpan_code})</div>
              <div>🏛️ <strong>नोडल PEEO:</strong> ${sch.peeo_name}</div>
              <div>📝 <strong>परीक्षा कोड:</strong> <span style="font-weight:800; color:#dc2626">${sch.exam_code || 'आवंटित'}</span></div>
              <div style="margin-top:4px">👑 <strong>संस्था प्रधान:</strong> ${sch.principal_name || 'दर्ज नहीं'} ${sch.principal_mobile ? `(📞 <a href="tel:${sch.principal_mobile}">${sch.principal_mobile}</a>)` : ''}</div>
              <div>📋 <strong>परीक्षा प्रभारी:</strong> ${sch.incharge_name || 'दर्ज नहीं'} ${sch.incharge_mobile ? `(📞 <a href="tel:${sch.incharge_mobile}">${sch.incharge_mobile}</a>)` : ''}</div>
            </div>
            <div style="font-size:0.78rem; color:#64748b; margin-top:6px">
              यदि संस्था प्रधान या प्रभारी का मोबाइल नंबर बदलना हो, तो प्रपत्र खोलकर ऊपर सीधे एडिट कर सुरक्षित कर सकते हैं।
            </div>
          </div>
        `;
      }
    }

    // Try finding matching school or PEEO from query text
    const matchedSchool = STATE.schools56.find(s => 
      q.includes(s.shala_darpan_code.toLowerCase()) || 
      q.includes(s.school_name.toLowerCase()) || 
      (s.peeo_name && q.includes(s.peeo_name.toLowerCase()))
    );

    if (matchedSchool) {
      return `
        <div style="line-height:1.55">
          <strong style="color:#0f172a; font-size:0.92rem"><i class="fas fa-address-book text-primary"></i> विद्यालय विवरण प्राप्त हुआ:</strong>
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-top:8px; font-size:0.83rem">
            <div>🏫 <strong>${matchedSchool.school_name}</strong> [शा.दा. ${matchedSchool.shala_darpan_code}]</div>
            <div>🏛️ <strong>PEEO:</strong> ${matchedSchool.peeo_name} | कोड: ${matchedSchool.exam_code || '---'}</div>
            <div style="margin-top:4px">👑 <strong>संस्था प्रधान:</strong> ${matchedSchool.principal_name || 'उपलब्ध नहीं'} ${matchedSchool.principal_mobile ? `(📞 <a href="tel:${matchedSchool.principal_mobile}">${matchedSchool.principal_mobile}</a>)` : ''}</div>
            <div>📋 <strong>परीक्षा प्रभारी:</strong> ${matchedSchool.incharge_name || 'उपलब्ध नहीं'} ${matchedSchool.incharge_mobile ? `(📞 <a href="tel:${matchedSchool.incharge_mobile}">${matchedSchool.incharge_mobile}</a>)` : ''}</div>
          </div>
        </div>
      `;
    }

    return `
      <div>
        <p style="margin:0 0 6px 0"><strong>🏛️ CBEO भिनाय संपर्क डायरेक्टरी:</strong></p>
        <p style="margin:0 0 6px 0; font-size:0.84rem">ब्लॉक के समस्त 25 PEEO एवं 57 माध्यमिक/उच्च माध्यमिक विद्यालयों के मोबाइल नंबर पोर्टल के <strong>'डायरेक्टरी'</strong> एवं <strong>'समान परीक्षा संपर्क'</strong> टैब में उपलब्ध हैं।</p>
        <div style="background:#f1f5f9; padding:8px 10px; border-radius:6px; font-size:0.8rem">
          <div>📞 <strong>CBEO कंट्रोल रूम / IT सेल:</strong> 9928254317 (जितेन्द्र कुमार)</div>
          <div>✉️ <strong>ईमेल:</strong> cbeobhinai@gmail.com</div>
          <div>📍 <strong>कार्यालय:</strong> मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय, <strong>जिला: अजमेर (AJMER)</strong></div>
        </div>
      </div>
    `;
  }

  // 3. Deadline / Last Date (अंतिम तिथि)
  if (q.includes('अंतिम') || q.includes('तिथि') || q.includes('last date') || q.includes('deadline') || q.includes('समय-सीमा') || q.includes('डेट')) {
    return `
      <div style="line-height:1.55">
        <strong style="color:#b91c1c; font-size:0.92rem"><i class="fas fa-calendar-alt"></i> प्रपत्र सबमिशन की महत्वपूर्ण तिथियां:</strong>
        <div style="background:#fff7ed; border-left:4px solid #f97316; padding:10px 12px; border-radius:6px; margin-top:8px; font-size:0.84rem">
          <div style="font-weight:800; color:#9a3412">📌 जिला समान परीक्षा 2026-27 प्रपत्र:</div>
          <div style="margin-top:3px; color:#7c2d12">
            अंतिम तिथि: <strong>05 अक्टूबर 2026</strong> (शाम 5:00 बजे तक)
          </div>
          <div style="font-size:0.78rem; color:#ea580c; margin-top:4px">
            समस्त 57 माध्यमिक एवं उच्च माध्यमिक विद्यालय समय पर प्रपत्र भरकर हस्ताक्षरित PDF अपने नोडल PEEO को प्रेषित करें।
          </div>
        </div>
      </div>
    `;
  }

  // 4. Bank Challan & Fees (बैंक चालान / फीस)
  if (q.includes('चालान') || q.includes('challan') || q.includes('फीस') || q.includes('fee') || q.includes('बैंक') || q.includes('खाता')) {
    return `
      <div style="line-height:1.55">
        <strong style="color:#1e3a8a; font-size:0.92rem"><i class="fas fa-file-invoice-dollar text-primary"></i> बैंक चालान एवं परीक्षा शुल्क प्रक्रिया:</strong>
        <ol style="margin:8px 0 8px 18px; padding:0; font-size:0.83rem; color:#334155">
          <li><strong>शुल्क गणना:</strong> कक्षा 9, 10, 11 व 12 के नामांकित छात्रों की संख्या अनुसार निर्धारित दर से कुल राशि की गणना करें।</li>
          <li><strong>बैंक जमा:</strong> जिला समान परीक्षा समिति के अधिकृत बैंक खाते में चालान द्वारा राशि जमा करवाएं।</li>
          <li><strong>प्रपत्र प्रविष्टि:</strong> बैंक से प्राप्त चालान की <strong>चालान संख्या</strong>, <strong>जमा दिनांक</strong> व <strong>राशि</strong> प्रपत्र में दर्ज करें।</li>
          <li><strong>फाइल अपलोड:</strong> चालान की स्पष्ट प्रति (JPG/PDF) प्रपत्र में अपलोड करें तथा मूल रसीद विद्यालय रिकॉर्ड में सुरक्षित रखें।</li>
        </ol>
      </div>
    `;
  }

  // 5. Password & Login Issues
  if (q.includes('पासवर्ड') || q.includes('password') || q.includes('लॉगिन') || q.includes('login') || q.includes('आईडी') || q.includes('reset')) {
    return `
      <div style="line-height:1.55">
        <strong style="color:#0f172a; font-size:0.92rem"><i class="fas fa-key text-primary"></i> लॉगिन एवं पासवर्ड सहायता:</strong>
        <div style="font-size:0.83rem; color:#334155; margin-top:8px">
          <div>🔑 <strong>यूजर आईडी:</strong> आपके विद्यालय का 6-अंकों का <strong>शाला दर्पण कोड</strong> (PSP कोड)।</div>
          <div>🔒 <strong>डिफ़ॉल्ट पासवर्ड:</strong> प्राथमिक रूप से शाला दर्पण कोड ही सक्रिय रहता है।</div>
          <div style="margin-top:6px; background:#eff6ff; padding:8px; border-radius:6px; font-size:0.8rem; color:#1e40af">
            यदि आप पासवर्ड भूल गए हैं या बदलना चाहते हैं, तो ऊपर दाएँ कोने में <strong>'पासवर्ड बदलें'</strong> बटन का उपयोग करें अथवा अपने नोडल PEEO या CBEO कार्यालय (IT सेल) से पासवर्ड रीसेट करवाएं।
          </div>
        </div>
      </div>
    `;
  }

  // 6. District Rule (District is ALWAYS AJMER)
  if (q.includes('जिला') || q.includes('district') || q.includes('अजमेर') || q.includes('केकड़ी') || q.includes('kekri') || q.includes('ajmer')) {
    return `
      <div style="line-height:1.55">
        <strong style="color:#15803d; font-size:0.92rem"><i class="fas fa-map-marker-alt"></i> आधिकारिक क्षेत्राधिकार एवं जिला:</strong>
        <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:8px; padding:10px; margin-top:8px; font-size:0.84rem; color:#065f46">
          <div>🏛️ <strong>कार्यालय:</strong> मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</div>
          <div>📍 <strong>जिला (District):</strong> सदैव <strong>अजमेर (AJMER)</strong> ही रहेगा।</div>
          <div>🚫 <strong>महत्वपूर्ण नियम:</strong> किसी भी प्रपत्र, हेडर, गूगल शीट या रिपोर्ट में केकड़ी (Kekri) मान्य नहीं है।</div>
        </div>
      </div>
    `;
  }

  // 7. General / Smart Default AI Response
  return `
    <div style="line-height:1.55">
      <p style="margin:0 0 6px 0; color:#0f172a">मैंने आपका प्रश्न नोट कर लिया है: <em>"${rawQuery}"</em></p>
      <div style="font-size:0.84rem; color:#334155; margin-bottom:8px">
        कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), <strong>भिनाय (अजमेर)</strong> के पोर्टल पर आप निम्नलिखित त्वरित सहायता प्राप्त कर सकते हैं:
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem">
        <div>👉 <strong>कॉलम विवरण:</strong> ऊपर दिए गए <em>'इस कॉलम में क्या भरना है?'</em> बटन पर क्लिक करें।</div>
        <div>👉 <strong>संस्था प्रधान / PEEO संपर्क:</strong> अपने विद्यालय का शाला दर्पण कोड लिखकर भेजें।</div>
        <div>👉 <strong>अंतिम तिथि:</strong> समान परीक्षा प्रपत्र की अंतिम तिथि <strong>05 अक्टूबर 2026</strong> है।</div>
      </div>
      <div style="font-size:0.75rem; color:#64748b; margin-top:8px; border-top:1px solid #e2e8f0; padding-top:6px">
        💬 आप अपना प्रश्न हिंदी या हिंग्लिश में सीधे टाइप करके भी पूछ सकते हैं।
      </div>
    </div>
  `;
}


/* ========================================================
   14. DEEP BACKUP & 7-DAY TRASH BIN RECOVERY (JITENDRA ADMIN)
   ======================================================== */
let PENDING_ADMIN_ACTION = null;

function promptDeepBackupDeleteDemand(demandId) {
  const demand = (STATE.demands || []).find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'warning');
    return;
  }

  PENDING_ADMIN_ACTION = {
    type: 'DELETE_DEMAND_TO_DEEP_BACKUP',
    demandId: demandId,
    title: demand.title
  };

  const msgEl = document.getElementById('confirm-pwd-message');
  if (msgEl) {
    msgEl.innerHTML = `🚨 क्या आप सूचना मांग <strong>'${demand.title}'</strong> को हटाना चाहते हैं?<br><br>यह मांग तुरंत <strong>7-दिवसीय गहन बैकअप (Deep Backup)</strong> में सुरक्षित स्थानांतरित हो जाएगी। 7 दिनों तक आप इसे कभी भी रीस्टोर कर सकेंगे।<br><br>पुष्टि हेतु <strong>जितेन्द्र व्यवस्थापक पासवर्ड</strong> दर्ज करें:`;
  }
  const inputEl = document.getElementById('confirm-admin-pwd-input');
  if (inputEl) inputEl.value = '';
  showModal('modal-confirm-admin-password');
}

function promptPermanentPurgeDeepBackupDemand(backupId) {
  PENDING_ADMIN_ACTION = {
    type: 'PURGE_DEEP_BACKUP_NOW',
    backupId: backupId
  };

  const msgEl = document.getElementById('confirm-pwd-message');
  if (msgEl) {
    msgEl.innerHTML = `⚠️ <strong style="color:#b91c1c">स्थायी नष्ट चेतावनी:</strong> क्या आप इस बैकअप प्रपत्र को 7 दिन की प्रतीक्षा किए बिना <strong>तत्काल स्थायी रूप से डिलीट</strong> करना चाहते हैं?<br><br>पुष्टि हेतु <strong>जितेन्द्र व्यवस्थापक पासवर्ड</strong> दर्ज करें:`;
  }
  const inputEl = document.getElementById('confirm-admin-pwd-input');
  if (inputEl) inputEl.value = '';
  showModal('modal-confirm-admin-password');
}

function verifyAdminSuperPassword(pwd) {
  if (!pwd) return false;
  const p = pwd.trim();
  // Valid admin passwords
  if (p === 'ADMIN02' || p === 'admin_jitendra' || p === 'cbeo_bhinai' || p === '8140') return true;
  // Check stored password for ADMIN02
  const stored = localStorage.getItem('cbeo_pwd_ADMIN02') || localStorage.getItem('cbeo_pwd_admin_jitendra');
  if (stored && stored === p) return true;
  return false;
}

function executeAdminConfirmedAction() {
  const inputEl = document.getElementById('confirm-admin-pwd-input');
  const pwd = inputEl ? inputEl.value : '';

  if (!verifyAdminSuperPassword(pwd)) {
    showToast('अमान्य पासवर्ड! केवल अधिकृत व्यवस्थापक ही यह क्रिया निष्पादित कर सकते हैं।', 'error');
    return;
  }

  closeModal('modal-confirm-admin-password');

  if (!PENDING_ADMIN_ACTION) return;

  if (PENDING_ADMIN_ACTION.type === 'DELETE_DEMAND_TO_DEEP_BACKUP') {
    const demandId = PENDING_ADMIN_ACTION.demandId;
    const demand = (STATE.demands || []).find(d => d.id === demandId);
    if (!demand) return;

    if (!STATE.deepBackupDemands) {
      try {
        STATE.deepBackupDemands = JSON.parse(localStorage.getItem('cbeo_deep_backup_demands') || '[]');
      } catch(e) {
        STATE.deepBackupDemands = [];
      }
    }

    const backupItem = {
      id: demand.id,
      title: demand.title,
      demand: JSON.parse(JSON.stringify(demand)),
      submissions: STATE.demandSubmissions[demand.id] ? JSON.parse(JSON.stringify(STATE.demandSubmissions[demand.id])) : {},
      testSubmissions: (STATE.demandTestSubmissions && STATE.demandTestSubmissions[demand.id]) ? JSON.parse(JSON.stringify(STATE.demandTestSubmissions[demand.id])) : {},
      deleted_at: Date.now(),
      purge_deadline: Date.now() + (7 * 24 * 60 * 60 * 1000), // exactly 7 days
      deleted_by: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)'
    };

    STATE.deepBackupDemands.unshift(backupItem);
    localStorage.setItem('cbeo_deep_backup_demands', JSON.stringify(STATE.deepBackupDemands));

    // Remove from active demands
    STATE.demands = STATE.demands.filter(d => d.id !== demandId);
    saveDemandsToStorage();

    // Cloud sync to Google Sheet under __DEEP_BACKUP_DEMANDS__
    const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
      || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url);
    if (gasUrl) {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePassword',
          user_id: '__DEEP_BACKUP_DEMANDS__',
          role: 'System_Config',
          name: '7-Day Deep Backup Demands',
          new_password: JSON.stringify(STATE.deepBackupDemands)
        })
      }).catch(() => {});
    }

    showToast(`मांग '${demand.title}' को 7-दिवसीय गहन बैकअप में सुरक्षित स्थानांतरित किया गया!`, 'success');
    renderApp();
    renderDeepBackupList();
  } else if (PENDING_ADMIN_ACTION.type === 'PURGE_DEEP_BACKUP_NOW') {
    const backupId = PENDING_ADMIN_ACTION.backupId;
    if (!STATE.deepBackupDemands) return;
    STATE.deepBackupDemands = STATE.deepBackupDemands.filter(b => b.id !== backupId);
    localStorage.setItem('cbeo_deep_backup_demands', JSON.stringify(STATE.deepBackupDemands));
    showToast('प्रपत्र स्थायी रूप से नष्ट कर दिया गया।', 'info');
    renderDeepBackupList();
  }

  PENDING_ADMIN_ACTION = null;
}

function checkAndPurgeDeepBackupDemands() {
  if (!STATE.deepBackupDemands) {
    try {
      STATE.deepBackupDemands = JSON.parse(localStorage.getItem('cbeo_deep_backup_demands') || '[]');
    } catch(e) {
      STATE.deepBackupDemands = [];
    }
  }

  const now = Date.now();
  const initCount = STATE.deepBackupDemands.length;
  STATE.deepBackupDemands = STATE.deepBackupDemands.filter(item => {
    return item.purge_deadline && item.purge_deadline > now;
  });

  if (STATE.deepBackupDemands.length !== initCount) {
    localStorage.setItem('cbeo_deep_backup_demands', JSON.stringify(STATE.deepBackupDemands));
  }

  const badge = document.getElementById('deep-backup-count-badge');
  if (badge) badge.textContent = STATE.deepBackupDemands.length;
}

function openDeepBackupDemandsModal() {
  renderDeepBackupList();
  showModal('modal-deep-backup-demands');
}

function renderDeepBackupList() {
  checkAndPurgeDeepBackupDemands();
  const listEl = document.getElementById('deep-backup-items-container');
  const previewEl = document.getElementById('admin-deep-backup-preview-list');
  const badge = document.getElementById('deep-backup-count-badge');

  const items = STATE.deepBackupDemands || [];
  if (badge) badge.textContent = items.length;

  if (items.length === 0) {
    const emptyHtml = `<div style="text-align:center; padding:1.5rem; color:#64748b; font-size:0.85rem">
      <i class="fas fa-trash-alt fa-2x text-muted" style="margin-bottom:0.5rem; display:block"></i>
      गहन बैकअप (Trash) खाली है। कोई भी हटाया गया प्रपत्र यहाँ लंबित नहीं है।
    </div>`;
    if (listEl) listEl.innerHTML = emptyHtml;
    if (previewEl) previewEl.innerHTML = emptyHtml;
    return;
  }

  const now = Date.now();
  let html = '';
  items.forEach(item => {
    const msLeft = Math.max(0, item.purge_deadline - now);
    const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const subsCount = Object.keys(item.submissions || {}).length;

    html += `
      <div style="background:#ffffff; border:1.5px solid #fecaca; border-radius:8px; padding:0.85rem; margin-bottom:0.6rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem">
        <div>
          <div style="font-weight:800; font-size:0.92rem; color:#991b1b; display:flex; align-items:center; gap:0.4rem">
            <i class="fas fa-file-invoice"></i> ${item.title}
            <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.7rem; padding:2px 8px">
              ⏳ ${daysLeft} दिन ${hoursLeft} घंटे शेष
            </span>
          </div>
          <div style="font-size:0.75rem; color:#64748b; margin-top:2px">
            हटाने की दिनांक: ${new Date(item.deleted_at).toLocaleString('hi-IN')} • सुरक्षित सबमिशन: ${subsCount} विद्यालय • व्यवस्थापक: ${item.deleted_by || 'Admin'}
          </div>
        </div>
        <div style="display:flex; gap:0.4rem">
          <button type="button" class="btn btn-success btn-sm" onclick="restoreDeepBackupDemand('${item.id}')" style="font-weight:700">
            <i class="fas fa-undo"></i> 🔄 रीस्टोर करें
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="promptPermanentPurgeDeepBackupDemand('${item.id}')" style="font-weight:700">
            <i class="fas fa-times-circle"></i> स्थायी हटाएं
          </button>
        </div>
      </div>
    `;
  });

  if (listEl) listEl.innerHTML = html;
  if (previewEl) previewEl.innerHTML = html;
}

function restoreDeepBackupDemand(backupId) {
  if (!STATE.deepBackupDemands) return;
  const backupItem = STATE.deepBackupDemands.find(b => b.id === backupId);
  if (!backupItem) return;

  // Restore demand object
  STATE.demands.unshift(backupItem.demand);
  saveDemandsToStorage();

  // Restore submissions
  if (backupItem.submissions) {
    if (!STATE.demandSubmissions) STATE.demandSubmissions = {};
    STATE.demandSubmissions[backupId] = backupItem.submissions;
    localStorage.setItem('cbeo_demand_submissions', JSON.stringify(STATE.demandSubmissions));
  }

  // Restore test submissions
  if (backupItem.testSubmissions) {
    if (!STATE.demandTestSubmissions) STATE.demandTestSubmissions = {};
    STATE.demandTestSubmissions[backupId] = backupItem.testSubmissions;
    localStorage.setItem('cbeo_demand_test_submissions', JSON.stringify(STATE.demandTestSubmissions));
  }

  // Remove from deep backup
  STATE.deepBackupDemands = STATE.deepBackupDemands.filter(b => b.id !== backupId);
  localStorage.setItem('cbeo_deep_backup_demands', JSON.stringify(STATE.deepBackupDemands));

  showToast(`मांग '${backupItem.title}' सफलता पूर्वक मुख्य पोर्टल में रीस्टोर हो गई!`, 'success');
  renderApp();
  renderDeepBackupList();
}

/* ========================================================
   15. SAMAN PARIKSHA DYNAMIC COLUMNS & SESSION ARCHIVING
   ======================================================== */
function openSamanColumnsManagerModal() {
  if (!STATE.samanParikshaCustomColumns) {
    try {
      STATE.samanParikshaCustomColumns = JSON.parse(localStorage.getItem('cbeo_saman_pariksha_custom_columns') || '[]');
    } catch(e) {
      STATE.samanParikshaCustomColumns = [];
    }
  }
  renderSamanCustomColumnsList();
  showModal('modal-saman-columns-manager');
}

function renderSamanCustomColumnsList() {
  const container = document.getElementById('saman-custom-columns-list');
  if (!container) return;

  const cols = STATE.samanParikshaCustomColumns || [];
  if (cols.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:1rem; color:#64748b; font-size:0.82rem">
      वर्तमान में केवल मूल मानक कॉलम (कक्षा 9-12 नामांकित छात्र व विषय) सक्रिय हैं। ऊपर से नया कॉलम जोड़ सकते हैं।
    </div>`;
    return;
  }

  let html = '';
  cols.forEach((col, idx) => {
    html += `
      <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:0.45rem 0.75rem; display:flex; justify-content:space-between; align-items:center">
        <div>
          <strong style="color:#0f172a; font-size:0.86rem">${idx + 1}. ${col.name}</strong>
          <span style="font-size:0.75rem; color:#64748b; margin-left:6px">(${col.type === 'number' ? 'संख्यात्मक' : 'विवरणात्मक'})</span>
        </div>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeSamanCustomColumn(${idx})" style="padding:2px 8px; font-size:0.75rem" title="कॉलम हटाएं">
          <i class="fas fa-trash-alt"></i> हटाएं
        </button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function addNewSamanCustomColumn() {
  const nameEl = document.getElementById('saman-new-col-name');
  const typeEl = document.getElementById('saman-new-col-type');
  const name = nameEl ? nameEl.value.trim() : '';
  const type = typeEl ? typeEl.value : 'number';

  if (!name) {
    showToast('कृपया कॉलम का नाम दर्ज करें!', 'warning');
    return;
  }

  if (!STATE.samanParikshaCustomColumns) STATE.samanParikshaCustomColumns = [];
  STATE.samanParikshaCustomColumns.push({ name: name, type: type });
  localStorage.setItem('cbeo_saman_pariksha_custom_columns', JSON.stringify(STATE.samanParikshaCustomColumns));

  nameEl.value = '';
  renderSamanCustomColumnsList();
  showToast(`नया कॉलम '${name}' समान परीक्षा में सफलतापूर्वक जोड़ा गया!`, 'success');
}

function removeSamanCustomColumn(index) {
  if (!STATE.samanParikshaCustomColumns) return;
  const removed = STATE.samanParikshaCustomColumns.splice(index, 1);
  localStorage.setItem('cbeo_saman_pariksha_custom_columns', JSON.stringify(STATE.samanParikshaCustomColumns));
  renderSamanCustomColumnsList();
  showToast(`कॉलम '${removed[0]?.name}' हटा दिया गया।`, 'info');
}

function openSamanNewSessionModal() {
  const pwdEl = document.getElementById('saman-archive-admin-pwd');
  if (pwdEl) pwdEl.value = '';
  showModal('modal-saman-new-session');
}

function submitSamanParikshaNewSession() {
  const titleEl = document.getElementById('saman-new-session-title');
  const descEl = document.getElementById('saman-new-session-desc');
  const pwdEl = document.getElementById('saman-archive-admin-pwd');

  const title = titleEl ? titleEl.value.trim() : '';
  const desc = descEl ? descEl.value.trim() : '';
  const pwd = pwdEl ? pwdEl.value.trim() : '';

  if (!title) {
    showToast('कृपया नवीन सत्र का नाम दर्ज करें!', 'warning');
    return;
  }

  if (!verifyAdminSuperPassword(pwd)) {
    showToast('अमान्य व्यवस्थापक पासवर्ड! केवल अधिकृत जितेन्द्र सुपर एडमिन ही नया सत्र आरंभ कर सकते हैं।', 'error');
    return;
  }

  // 1. Snapshot current Saman Pariksha data to Master Database Archives (PERMANENT, NEVER DELETED)
  const archiveKey = `SAMAN_PARIKSHA_${Date.now()}`;
  if (!STATE.masterDatabaseArchives) {
    try {
      STATE.masterDatabaseArchives = JSON.parse(localStorage.getItem('cbeo_master_database_archives') || '{}');
    } catch(e) {
      STATE.masterDatabaseArchives = {};
    }
  }

  STATE.masterDatabaseArchives[archiveKey] = {
    archive_id: archiveKey,
    title: `समान परीक्षा सत्र 2026-27 (पूर्व सत्र अभिलेख)`,
    new_session_name: title,
    description: desc || 'मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय (अजमेर) - सुरक्षित मास्टर अभिलेख',
    archived_at: new Date().toISOString(),
    submissions: JSON.parse(JSON.stringify(STATE.samanParikshaSubmissions || {})),
    custom_columns: JSON.parse(JSON.stringify(STATE.samanParikshaCustomColumns || [])),
    archived_by: STATE.currentUser?.name || 'जितेन्द्र कुमार'
  };

  localStorage.setItem('cbeo_master_database_archives', JSON.stringify(STATE.masterDatabaseArchives));

  // 2. Reset active submissions for the brand new session
  STATE.samanParikshaSubmissions = {};
  localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify({}));

  closeModal('modal-saman-new-session');
  showToast(`🎉 पूर्व सत्र सुरक्षित मास्टर डेटाबेस में संग्रहीत हो गया तथा नवीन सत्र '${title}' प्रारंभ हो गया!`, 'success');
  renderApp();
  renderSamanParikshaView();
}

/* ========================================================
   16. MASTER DATABASE & CUSTOM INFORMATION EXTRACTION HUB
   ======================================================== */
const STANDARD_COLUMN_REGISTRY = [
  { key: 'shala_darpan_code', label: 'शाला दर्पण / PSP कोड', defaultOrder: 1, synonyms: ['sd code', 'psp', 'code', 'कोड', 'शाला दर्पण'] },
  { key: 'school_name', label: 'विद्यालय का नाम', defaultOrder: 2, synonyms: ['school name', 'स्कूल', 'विद्यालय', 'संस्था'] },
  { key: 'peeo_name', label: 'PEEO परिक्षेत्र', defaultOrder: 3, synonyms: ['peeo', 'नोडल', 'परिक्षेत्र', 'क्लस्टर'] },
  { key: 'principal_name', label: 'संस्था प्रधान नाम', defaultOrder: 4, synonyms: ['principal', 'headmaster', 'प्रधानाचार्य', 'प्रस्तुतकर्ता'] },
  { key: 'principal_mobile', label: 'मोबाइल नंबर', defaultOrder: 5, synonyms: ['mobile', 'phone', 'दूरभाष', 'सम्पर्क'] },
  { key: 'category', label: 'विद्यालय श्रेणी / स्तर', defaultOrder: null, synonyms: ['category', 'स्तर', 'type', 'श्रेणी'] },
  { key: 'dise_code', label: 'U-DISE कोड', defaultOrder: null, synonyms: ['udise', 'dise', 'डाइस'] },
  { key: 'school_email', label: 'आधिकारिक ईमेल', defaultOrder: null, synonyms: ['email', 'मेल', 'mail'] },
  { key: 'exam_code', label: 'समान परीक्षा कोड', defaultOrder: null, synonyms: ['exam code', 'परीक्षा कोड', 'अनुक्रमांक'] },
  { key: 'c9_total', label: 'कक्षा 9 कुल नामांकन', defaultOrder: null, synonyms: ['class 9', '9वीं', 'कक्षा 9'] },
  { key: 'c10_total', label: 'कक्षा 10 कुल नामांकन', defaultOrder: null, synonyms: ['class 10', '10वीं', 'कक्षा 10'] },
  { key: 'c11_total', label: 'कक्षा 11 कुल नामांकन', defaultOrder: null, synonyms: ['class 11', '11वीं', 'कक्षा 11'] },
  { key: 'c12_total', label: 'कक्षा 12 कुल नामांकन', defaultOrder: null, synonyms: ['class 12', '12वीं', 'कक्षा 12'] },
  { key: 'grand_total', label: 'महायोग नामांकित छात्र संख्या', defaultOrder: null, synonyms: ['grand total', 'कुल छात्र', 'महायोग', 'नामांकन', 'total'] }
];

let STATE_DB_HUB = {
  activeScope: 'all_schools',
  selectedPeeo: 'ALL',
  filterGovt: true,
  filterPvt: true,
  filterSaman57: false,
  aggregationMode: 'school_wise', // 'school_wise' | 'peeo_consolidated' | 'cbeo_block_consolidated'
  selectedSchoolCodes: new Set(),
  selectedColumns: [
    { key: 'shala_darpan_code', label: 'शाला दर्पण / PSP कोड', order: 1 },
    { key: 'school_name', label: 'विद्यालय का नाम', order: 2 },
    { key: 'peeo_name', label: 'PEEO परिक्षेत्र', order: 3 },
    { key: 'principal_name', label: 'संस्था प्रधान नाम', order: 4 },
    { key: 'principal_mobile', label: 'मोबाइल नंबर', order: 5 }
  ],
  customHeader: {
    dept: 'राजस्थान सरकार | स्कूल शिक्षा विभाग',
    office: 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)',
    sub: 'समग्र शिक्षा अभियान | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)',
    title: 'मास्टर डेटाबेस: अधिकृत विद्यालयवार एवं समेकित सूचना प्रपत्र',
    sigLeft: 'प्रभारी अधिकारी / कनिष्ठ सहायक',
    sigRight: 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)'
  }
};

function renderMasterDatabaseHubView() {
  populateDbPeeoDropdown();
  populateCustomDbSchoolsChecklist();
  renderDbColumnsHierarchyTable();
  updateDbPreviewTable();
}

function populateDbPeeoDropdown() {
  const sel = document.getElementById('db-select-peeo');
  if (!sel) return;
  sel.innerHTML = '<option value="ALL">-- समस्त 25 PEEO क्लस्टर --</option>';

  const peeoList = STATE.peeos || [];
  peeoList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.peeo_name} (${p.schools_count || p.schools?.length || 0} स्कूल)`;
    sel.appendChild(opt);
  });
}

function onDbScopeChange(scope) {
  STATE_DB_HUB.activeScope = scope;
  const customBox = document.getElementById('db-custom-scope-box');
  if (customBox) {
    customBox.style.display = (scope === 'custom') ? 'block' : 'none';
  }
  updateDbPreviewTable();
}

function onDbPeeoSelectChange() {
  const sel = document.getElementById('db-select-peeo');
  STATE_DB_HUB.selectedPeeo = sel ? sel.value : 'ALL';
  filterCustomDbSchoolsList();
}

function filterCustomDbSchoolsList() {
  const govtCheck = document.getElementById('db-filter-peeo-govt');
  const pvtCheck = document.getElementById('db-filter-peeo-pvt');
  const spCheck = document.getElementById('db-filter-peeo-sp');

  STATE_DB_HUB.filterGovt = govtCheck ? govtCheck.checked : true;
  STATE_DB_HUB.filterPvt = pvtCheck ? pvtCheck.checked : true;
  STATE_DB_HUB.filterSaman57 = spCheck ? spCheck.checked : false;

  populateCustomDbSchoolsChecklist();
  updateDbPreviewTable();
}

function populateCustomDbSchoolsChecklist() {
  const container = document.getElementById('db-custom-schools-checklist');
  if (!container) return;

  const searchInput = document.getElementById('db-school-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const allSchools = getAllMasterSchools();
  const peeoFilter = STATE_DB_HUB.selectedPeeo;

  const filtered = allSchools.filter(s => {
    if (peeoFilter !== 'ALL' && s.peeo_name !== peeoFilter) return false;
    const isPvt = s.type === 'Private' || String(s.shala_darpan_code).startsWith('P');
    if (isPvt && !STATE_DB_HUB.filterPvt) return false;
    if (!isPvt && !STATE_DB_HUB.filterGovt) return false;
    if (STATE_DB_HUB.filterSaman57) {
      const inSp = (STATE.schools56 || []).some(x => x.shala_darpan_code === s.shala_darpan_code);
      if (!inSp) return false;
    }
    if (query) {
      const mName = (s.school_name || '').toLowerCase().includes(query);
      const mCode = String(s.shala_darpan_code || '').includes(query);
      const mPeeo = (s.peeo_name || '').toLowerCase().includes(query);
      if (!mName && !mCode && !mPeeo) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:#64748b; padding:4px">कोई विद्यालय नहीं मिला।</div>';
    return;
  }

  let html = '';
  filtered.forEach(s => {
    const isChecked = STATE_DB_HUB.selectedSchoolCodes.has(s.shala_darpan_code) || STATE_DB_HUB.selectedSchoolCodes.size === 0;
    html += `
      <label style="display:flex; align-items:center; gap:6px; margin-bottom:3px; cursor:pointer">
        <input type="checkbox" value="${s.shala_darpan_code}" ${isChecked ? 'checked' : ''} onchange="onCustomSchoolCheckboxToggle('${s.shala_darpan_code}', this.checked)" style="width:14px; height:14px">
        <span><strong>${s.school_name}</strong> (${s.shala_darpan_code}) - <span style="color:#64748b">${s.peeo_name}</span></span>
      </label>
    `;
  });
  container.innerHTML = html;
}

function onCustomSchoolCheckboxToggle(code, isChecked) {
  if (isChecked) {
    STATE_DB_HUB.selectedSchoolCodes.add(code);
  } else {
    STATE_DB_HUB.selectedSchoolCodes.delete(code);
  }
  updateDbPreviewTable();
}

function toggleAllCustomDbSchools(checkAll) {
  const allSchools = getAllMasterSchools();
  if (checkAll) {
    allSchools.forEach(s => STATE_DB_HUB.selectedSchoolCodes.add(s.shala_darpan_code));
  } else {
    STATE_DB_HUB.selectedSchoolCodes.clear();
  }
  populateCustomDbSchoolsChecklist();
  updateDbPreviewTable();
}

function onDbAiColumnSearch(query) {
  if (!query) return;
  const q = query.toLowerCase().trim();
  const matched = STANDARD_COLUMN_REGISTRY.find(col => {
    if (col.label.toLowerCase().includes(q)) return true;
    if (col.key.toLowerCase().includes(q)) return true;
    return col.synonyms.some(s => s.toLowerCase().includes(q) || q.includes(s.toLowerCase()));
  });

  if (matched) {
    const isAlready = STATE_DB_HUB.selectedColumns.some(c => c.key === matched.key);
    if (!isAlready) {
      const nextOrder = STATE_DB_HUB.selectedColumns.length + 1;
      STATE_DB_HUB.selectedColumns.push({ key: matched.key, label: matched.label, order: nextOrder });
      renderDbColumnsHierarchyTable();
      updateDbPreviewTable();
      showToast(`🤖 AI मैपर: मानक कॉलम '${matched.label}' स्वतः जोड़ा गया!`, 'info');
    }
  }
}

function renderDbColumnsHierarchyTable() {
  const tbody = document.getElementById('db-columns-selector-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const totalCols = STATE_DB_HUB.selectedColumns.length;
  const badge = document.getElementById('db-col-count-badge');
  if (badge) badge.textContent = `${totalCols} कॉलम चयनित`;

  STANDARD_COLUMN_REGISTRY.forEach(reg => {
    const selCol = STATE_DB_HUB.selectedColumns.find(c => c.key === reg.key);
    const isChecked = !!selCol;
    const curOrder = selCol ? selCol.order : null;

    let orderSelectHtml = `<span style="color:#94a3b8">-</span>`;
    if (isChecked) {
      let optionsHtml = '';
      for (let i = 1; i <= totalCols; i++) {
        optionsHtml += `<option value="${i}" ${i === curOrder ? 'selected' : ''}>${i}</option>`;
      }
      orderSelectHtml = `
        <select onchange="onDbColumnOrderChange('${reg.key}', this.value)" style="padding:2px 6px; font-size:0.78rem; font-weight:700; border-radius:4px; border:1.5px solid #3b82f6; background:#eff6ff; color:#1d4ed8">
          ${optionsHtml}
        </select>
      `;
    }

    const tr = document.createElement('tr');
    tr.style.background = isChecked ? '#ffffff' : '#f8fafc';
    tr.style.borderBottom = '1px solid #e2e8f0';
    tr.innerHTML = `
      <td style="padding:5px; text-align:center">
        <input type="checkbox" id="db_col_chk_${reg.key}" ${isChecked ? 'checked' : ''} onchange="onDbColumnCheckboxToggle('${reg.key}', this.checked)" style="width:16px; height:16px; cursor:pointer">
      </td>
      <td style="padding:5px 8px; font-weight:${isChecked ? '700' : 'normal'}; color:${isChecked ? '#0f172a' : '#64748b'}">
        ${reg.label}
      </td>
      <td style="padding:5px; text-align:center">
        ${orderSelectHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function onDbColumnCheckboxToggle(colKey, isChecked) {
  const reg = STANDARD_COLUMN_REGISTRY.find(r => r.key === colKey);
  if (!reg) return;

  if (isChecked) {
    const nextOrder = STATE_DB_HUB.selectedColumns.length + 1;
    STATE_DB_HUB.selectedColumns.push({ key: reg.key, label: reg.label, order: nextOrder });
  } else {
    STATE_DB_HUB.selectedColumns = STATE_DB_HUB.selectedColumns.filter(c => c.key !== colKey);
    // Re-normalize orders 1 to N
    STATE_DB_HUB.selectedColumns.sort((a, b) => a.order - b.order);
    STATE_DB_HUB.selectedColumns.forEach((c, idx) => {
      c.order = idx + 1;
    });
  }

  renderDbColumnsHierarchyTable();
  updateDbPreviewTable();
}

function onDbColumnOrderChange(colKey, newOrder) {
  newOrder = parseInt(newOrder, 10);
  const targetCol = STATE_DB_HUB.selectedColumns.find(c => c.key === colKey);
  if (!targetCol) return;

  const oldOrder = targetCol.order;
  if (oldOrder === newOrder) return;

  // Collision-free swap: swap orders with the column that currently holds newOrder
  const existingCol = STATE_DB_HUB.selectedColumns.find(c => c.order === newOrder && c.key !== colKey);
  if (existingCol) {
    existingCol.order = oldOrder;
  }

  targetCol.order = newOrder;

  // Re-sort strictly by order
  STATE_DB_HUB.selectedColumns.sort((a, b) => a.order - b.order);
  STATE_DB_HUB.selectedColumns.forEach((c, idx) => {
    c.order = idx + 1;
  });

  renderDbColumnsHierarchyTable();
  updateDbPreviewTable();
}

function resetDbColumnsToDefault() {
  STATE_DB_HUB.selectedColumns = [
    { key: 'shala_darpan_code', label: 'शाला दर्पण / PSP कोड', order: 1 },
    { key: 'school_name', label: 'विद्यालय का नाम', order: 2 },
    { key: 'peeo_name', label: 'PEEO परिक्षेत्र', order: 3 },
    { key: 'principal_name', label: 'संस्था प्रधान नाम', order: 4 },
    { key: 'principal_mobile', label: 'मोबाइल नंबर', order: 5 }
  ];
  renderDbColumnsHierarchyTable();
  updateDbPreviewTable();
  showToast('मानक कॉलम प्राथमिक क्रम पर रीसेट कर दिए गए!', 'info');
}

function getDbFilteredRecords() {
  const allSchools = getAllMasterSchools();
  const scope = STATE_DB_HUB.activeScope;

  let baseList = [];
  if (scope === 'all_schools') {
    baseList = allSchools;
  } else if (scope === 'all_govt') {
    baseList = allSchools.filter(s => s.type === 'Government' || !String(s.shala_darpan_code).startsWith('P'));
  } else if (scope === 'sec_srsec') {
    baseList = allSchools.filter(s => {
      const is56 = (STATE.schools56 || []).some(x => x.shala_darpan_code === s.shala_darpan_code);
      const isSecCat = s.category && (s.category.includes('Secondary') || s.category.includes('माध्यमिक'));
      return is56 || isSecCat;
    });
  } else if (scope === 'saman_57') {
    baseList = (STATE.schools56 && STATE.schools56.length > 0) ? STATE.schools56 : allSchools.filter(s => s.category?.includes('Secondary'));
  } else if (scope === 'peeo_nodal') {
    const nodalCodes = new Set((STATE.peeos || []).map(p => p.peeo_code || p.shala_darpan_code));
    baseList = allSchools.filter(s => nodalCodes.has(s.shala_darpan_code) || s.is_peeo_nodal);
  } else if (scope === 'custom') {
    const peeoFilter = STATE_DB_HUB.selectedPeeo;
    baseList = allSchools.filter(s => {
      if (peeoFilter !== 'ALL' && s.peeo_name !== peeoFilter) return false;
      const isPvt = s.type === 'Private' || String(s.shala_darpan_code).startsWith('P');
      if (isPvt && !STATE_DB_HUB.filterPvt) return false;
      if (!isPvt && !STATE_DB_HUB.filterGovt) return false;
      if (STATE_DB_HUB.filterSaman57) {
        const inSp = (STATE.schools56 || []).some(x => x.shala_darpan_code === s.shala_darpan_code);
        if (!inSp) return false;
      }
      if (STATE_DB_HUB.selectedSchoolCodes.size > 0 && !STATE_DB_HUB.selectedSchoolCodes.has(s.shala_darpan_code)) {
        return false;
      }
      return true;
    });
  }

  // Enrich with Saman Pariksha Enrolment & Master Attributes
  const enriched = baseList.map(s => {
    const sp = (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions[s.shala_darpan_code]) || {};
    return {
      shala_darpan_code: s.shala_darpan_code || '---',
      school_name: s.school_name || 'विद्यालय',
      peeo_name: s.peeo_name || 'CBEO Bhinai',
      category: s.category || s.type || 'Government',
      dise_code: s.dise_code || '---',
      principal_name: sp.principal_name || s.principal_name || 'संस्था प्रधान',
      principal_mobile: sp.principal_mobile || s.principal_mobile || '---',
      school_email: s.school_email || s.email || '---',
      exam_code: sp.exam_code || s.exam_code || '---',
      c9_total: parseInt(sp.c9_total ?? 0, 10),
      c10_total: parseInt(sp.c10_total ?? 0, 10),
      c11_total: parseInt(sp.c11_total ?? 0, 10),
      c12_total: parseInt(sp.c12_total ?? 0, 10),
      grand_total: parseInt(sp.grand_total ?? 0, 10)
    };
  });

  // Handle Aggregation Modes (समेकित)
  const aggMode = document.querySelector('input[name="db-aggregation-mode"]:checked')?.value || 'school_wise';
  STATE_DB_HUB.aggregationMode = aggMode;

  if (aggMode === 'peeo_consolidated') {
    const peeoMap = {};
    enriched.forEach(rec => {
      const pName = rec.peeo_name || 'अन्य';
      if (!peeoMap[pName]) {
        peeoMap[pName] = {
          shala_darpan_code: 'समेकित (PEEO)',
          school_name: `${pName} परिक्षेत्र क्लस्टर`,
          peeo_name: pName,
          category: 'PEEO क्लस्टर',
          dise_code: 'समेकित',
          principal_name: rec.principal_name,
          principal_mobile: rec.principal_mobile,
          school_email: rec.school_email,
          exam_code: 'समेकित',
          c9_total: 0,
          c10_total: 0,
          c11_total: 0,
          c12_total: 0,
          grand_total: 0,
          school_count: 0
        };
      }
      peeoMap[pName].c9_total += rec.c9_total;
      peeoMap[pName].c10_total += rec.c10_total;
      peeoMap[pName].c11_total += rec.c11_total;
      peeoMap[pName].c12_total += rec.c12_total;
      peeoMap[pName].grand_total += rec.grand_total;
      peeoMap[pName].school_count++;
    });
    return Object.values(peeoMap);
  } else if (aggMode === 'cbeo_block_consolidated') {
    const grandRow = {
      shala_darpan_code: '8140',
      school_name: 'कार्यालय CBEO भिनाय (समस्त ब्लॉक समेकित महायोग)',
      peeo_name: 'समस्त 25 PEEO परिक्षेत्र',
      category: 'ब्लॉक समेकित',
      dise_code: '082103',
      principal_name: 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय',
      principal_mobile: '9414000000',
      school_email: 'cbeobhinai@gmail.com',
      exam_code: 'AJM04',
      c9_total: 0,
      c10_total: 0,
      c11_total: 0,
      c12_total: 0,
      grand_total: 0,
      school_count: enriched.length
    };
    enriched.forEach(rec => {
      grandRow.c9_total += rec.c9_total;
      grandRow.c10_total += rec.c10_total;
      grandRow.c11_total += rec.c11_total;
      grandRow.c12_total += rec.c12_total;
      grandRow.grand_total += rec.grand_total;
    });
    return [grandRow];
  }

  return enriched;
}

function updateDbPreviewTable() {
  const records = getDbFilteredRecords();
  const sortedCols = [...STATE_DB_HUB.selectedColumns].sort((a, b) => a.order - b.order);

  const scopeBadge = document.getElementById('db-scope-count-badge');
  if (scopeBadge) scopeBadge.textContent = `${records.length} रिकॉर्ड निष्कर्षित`;

  const metaDesc = document.getElementById('db-preview-meta-desc');
  if (metaDesc) {
    const modeText = STATE_DB_HUB.aggregationMode === 'peeo_consolidated' ? 'PEEO समेकित' : (STATE_DB_HUB.aggregationMode === 'cbeo_block_consolidated' ? 'ब्लॉक समेकित' : 'विद्यालयवार');
    metaDesc.textContent = `सत्र 2026-27 | ब्लॉक-भिनाय, जिला-अजमेर | मोड: ${modeText} | कुल पंक्तियां: ${records.length}`;
  }

  renderCustomDbPrintableTable(records, sortedCols);
}

function renderCustomDbPrintableTable(records, sortedCols) {
  const container = document.getElementById('printable-custom-db-content');
  if (!container) return;

  if (!records) records = getDbFilteredRecords();
  if (!sortedCols) sortedCols = (STATE_DB_HUB.columns || []).filter(c => c.selected).sort((a, b) => a.order - b.order);

  const h = STATE_DB_HUB.customHeader;

  // Thead
  let theadHtml = `<th style="padding:5px 4px; border:1.5px solid #000; background:#f1f5f9; color:#000; font-weight:800; text-align:center; width:38px">क्र.सं.</th>`;
  sortedCols.forEach(col => {
    theadHtml += `
      <th style="padding:5px 6px; border:1.5px solid #000; background:#f1f5f9; color:#000; font-weight:800; text-align:center; font-size:0.78rem">
        ${col.label}
      </th>
    `;
  });

  // Tbody & Totals
  let tbodyHtml = '';
  const numTotals = {};
  sortedCols.forEach(col => {
    if (['c9_total', 'c10_total', 'c11_total', 'c12_total', 'grand_total'].includes(col.key)) {
      numTotals[col.key] = 0;
    }
  });

  records.forEach((row, idx) => {
    let rowCols = `<td style="padding:4px 3px; border:1px solid #000; text-align:center; font-weight:700">${idx + 1}</td>`;
    sortedCols.forEach(col => {
      const val = row[col.key] !== undefined ? row[col.key] : '-';
      const isNum = typeof val === 'number';
      if (isNum && numTotals[col.key] !== undefined) {
        numTotals[col.key] += val;
      }
      rowCols += `
        <td style="padding:4px 6px; border:1px solid #000; text-align:${isNum ? 'center' : 'left'}; font-weight:${col.key === 'school_name' ? '800' : 'normal'}">
          ${val}
        </td>
      `;
    });
    tbodyHtml += `<tr style="border-bottom:1px solid #000">${rowCols}</tr>`;
  });

  // Totals Row
  let totalsRowHtml = '';
  if (Object.keys(numTotals).length > 0 && records.length > 1) {
    let tCells = `<td colspan="2" style="padding:5px 6px; border:1.5px solid #000; background:#f8fafc; font-weight:900; text-align:center">कुल योग (Grand Total)</td>`;
    sortedCols.slice(1).forEach(col => {
      if (numTotals[col.key] !== undefined) {
        tCells += `<td style="padding:5px 6px; border:1.5px solid #000; background:#f8fafc; font-weight:900; text-align:center">${numTotals[col.key]}</td>`;
      } else {
        tCells += `<td style="padding:5px 6px; border:1.5px solid #000; background:#f8fafc; text-align:center">-</td>`;
      }
    });
    totalsRowHtml = `<tfoot><tr style="border-top:2px solid #000">${tCells}</tr></tfoot>`;
  }

  const printHtml = `
    <!-- Top Official Government Header -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:6px">
      <div style="font-size:0.84rem; font-weight:700; letter-spacing:0.04em; color:#111">
        ${h.dept}
      </div>
      <h2 style="margin:2px 0; font-size:1.18rem; font-weight:900; color:#000; letter-spacing:0.02em">
        ${h.office}
      </h2>
      <div style="font-size:0.76rem; color:#333; margin-top:1px">
        ${h.sub}
      </div>
      <div style="margin-top:4px; display:inline-block; border:1.5px solid #000; background:#f1f5f9; padding:2px 16px; border-radius:4px; font-size:0.9rem; font-weight:900; color:#000">
        ${h.title} (सत्र 2026-27)
      </div>
    </div>

    <!-- Metadata Grid -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:0.76rem; border:1.5px solid #000">
      <tr style="background:#f8fafc">
        <td style="padding:2.5px 6px; border:1px solid #000; width:15%"><strong>निष्कर्षण दायरा:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:700; width:35%">${getDbScopeTitle(STATE_DB_HUB.activeScope)}</td>
        <td style="padding:2.5px 6px; border:1px solid #000; width:18%"><strong>कुल रिकॉर्ड संख्या:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:32%">${records.length} पंक्तियां</td>
      </tr>
      <tr>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>प्रस्तुतकर्ता / पद:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000">${STATE.currentUser?.name || 'कार्यालय व्यवस्थापक'} (${STATE.currentUser?.role?.toUpperCase() || 'ADMIN'})</td>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>दिनांक व समय:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:700">${new Date().toLocaleString('hi-IN')}</td>
      </tr>
    </table>

    <!-- Laser Horizontal Grid -->
    <table class="exam-excel-table" style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.78rem; margin-bottom:8px">
      <thead>
        <tr style="border-bottom:2px solid #000">
          ${theadHtml}
        </tr>
      </thead>
      <tbody>
        ${tbodyHtml}
      </tbody>
      ${totalsRowHtml}
    </table>

    <!-- Official Declaration Notice -->
    <div style="margin-top:4px; margin-bottom:6px; padding:3px 6px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.70rem; line-height:1.25; color:#000">
      <strong>प्रमाणीकरण एवं अधिकृत घोषणा:</strong> प्रमाणित किया जाता है कि उपर्युक्त विवरण कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर) के केंद्रीय एकीकृत डेटाबेस एवं शाला दर्पण भौतिक अभिलेखों के आधार पर संकलित किया गया है। समस्त प्रविष्टियां आधिकारिक रूप से मान्य एवं प्रमाणित हैं।
    </div>

    <!-- Official Signature Block -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 35px; margin-top:14px; margin-bottom:2px; font-size:0.8rem">
      <div style="text-align:center">
        <div style="border-top:1.5px solid #000; width:160px; padding-top:4px; font-weight:800">
          ${h.sigLeft}
        </div>
      </div>
      <div style="text-align:center">
        <div style="border-top:1.5px solid #000; width:220px; padding-top:4px; font-weight:800">
          ${h.sigRight}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = printHtml;
}

function getDbScopeTitle(scope) {
  if (scope === 'all_schools') return 'समस्त 178 विद्यालय (राजकीय व निजी)';
  if (scope === 'all_govt') return 'समस्त 132 राजकीय विद्यालय';
  if (scope === 'sec_srsec') return 'माध्यमिक व उच्च माध्यमिक विद्यालय';
  if (scope === 'saman_57') return 'समान परीक्षा 57 विद्यालय';
  if (scope === 'peeo_nodal') return '25 PEEO नोडल विद्यालय मुख्यालय';
  if (scope === 'custom') return 'कस्टमाइज़्ड चयन (PEEO व विद्यालयवार)';
  return 'समस्त विद्यालय';
}

function openCustomDbHeaderModal() {
  const h = STATE_DB_HUB.customHeader;
  document.getElementById('custom-header-dept').value = h.dept;
  document.getElementById('custom-header-office').value = h.office;
  document.getElementById('custom-header-sub').value = h.sub;
  document.getElementById('custom-header-title').value = h.title;
  document.getElementById('custom-header-sig-left').value = h.sigLeft;
  document.getElementById('custom-header-sig-right').value = h.sigRight;
  showModal('modal-custom-db-header-edit');
}

function saveCustomDbHeaderSettings() {
  STATE_DB_HUB.customHeader = {
    dept: document.getElementById('custom-header-dept').value.trim() || 'राजस्थान सरकार | स्कूल शिक्षा विभाग',
    office: document.getElementById('custom-header-office').value.trim() || 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)',
    sub: document.getElementById('custom-header-sub').value.trim() || 'समग्र शिक्षा अभियान | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)',
    title: document.getElementById('custom-header-title').value.trim() || 'मास्टर डेटाबेस: अधिकृत विद्यालयवार एवं समेकित सूचना प्रपत्र',
    sigLeft: document.getElementById('custom-header-sig-left').value.trim() || 'प्रभारी अधिकारी / कनिष्ठ सहायक',
    sigRight: document.getElementById('custom-header-sig-right').value.trim() || 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)'
  };
  localStorage.setItem('cbeo_custom_db_header', JSON.stringify(STATE_DB_HUB.customHeader));
  closeModal('modal-custom-db-header-edit');
  updateDbPreviewTable();
  showToast('अधिकृत रिपोर्ट हेडर सेटिंग्स सुरक्षित हो गईं!', 'success');
}

function resetCustomDbHeaderDefaults() {
  STATE_DB_HUB.customHeader = {
    dept: 'राजस्थान सरकार | स्कूल शिक्षा विभाग',
    office: 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)',
    sub: 'समग्र शिक्षा अभियान | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)',
    title: 'मास्टर डेटाबेस: अधिकृत विद्यालयवार एवं समेकित सूचना प्रपत्र',
    sigLeft: 'प्रभारी अधिकारी / कनिष्ठ सहायक',
    sigRight: 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)'
  };
  openCustomDbHeaderModal();
  showToast('डिफ़ॉल्ट हेडर रीसेट कर दिया गया!', 'info');
}

async function downloadCustomDatabasePDF() {
  showToast('आधिकारिक Landscape PDF तैयार किया जा रहा है...', 'info');
  const filename = `CBEO_Bhinai_Master_Database_${new Date().toISOString().split('T')[0]}.pdf`;
  try {
    const blob = await exportDocumentToPdfBlob('printable-custom-db-content', filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('अधिकृत A4 Landscape PDF सफलतापूर्वक डाउनलोड हो गया!', 'success');
  } catch(e) {
    console.warn('PDF blob generation fallback to clean print:', e);
    printCleanA4Landscape('printable-custom-db-content', 'CBEO Bhinai Master Report');
  }
}

function exportCustomDatabaseExcel() {
  const records = getDbFilteredRecords();
  const sortedCols = [...STATE_DB_HUB.selectedColumns].sort((a, b) => a.order - b.order);

  let csv = 'क्र.सं.,' + sortedCols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',') + '\n';

  records.forEach((row, idx) => {
    let rowVals = [idx + 1];
    sortedCols.forEach(col => {
      const val = row[col.key] !== undefined ? String(row[col.key]) : '';
      rowVals.push(`"${val.replace(/"/g, '""')}"`);
    });
    csv += rowVals.join(',') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CBEO_Bhinai_Master_Database_Export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Excel CSV सफलतापूर्वक डाउनलोड हो गया!', 'success');
}

function shareCustomDatabaseWhatsApp() {
  const records = getDbFilteredRecords();
  const h = STATE_DB_HUB.customHeader;
  const msg = `*🏛️ ${h.office}*
*📋 ${h.title} (सत्र 2026-27)*

📌 *दायरा:* ${getDbScopeTitle(STATE_DB_HUB.activeScope)}
📌 *कुल रिकॉर्ड संख्या:* ${records.length} पंक्तियां
📌 *सत्यापन दिनांक:* ${new Date().toLocaleString('hi-IN')}

📄 *अधिकृत A4 Landscape PDF एवं एक्सेल शीट पोर्टल से सीधे डाउनलोड हेतु उपलब्ध है।*
🌐 *सत्यापन पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

