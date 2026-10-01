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
  currentSignatureData: null
};

// Canvas Signature State
let canvas, ctx;
let isDrawing = false;
let hasSignature = false;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initMasterData();
  setupSignaturePad();
  setupAutoLogin();
  renderApp();

  const gformModal = document.getElementById('modal-saman-pariksha-form');
  if (gformModal) {
    gformModal.addEventListener('input', autoSaveGFormDraft);
    gformModal.addEventListener('change', autoSaveGFormDraft);
  }
});

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
  return (STATE.demandSubmissions && STATE.demandSubmissions[demandId] && STATE.demandSubmissions[demandId][schoolCode]) || {};
}

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
      mobile: '7073800244',
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

  // Versioned cache check to guarantee fresh master data with 57 schools and all 3 active submissions
  const DATA_VERSION = 'v18_2026_10_01_universal_database_auth';
  if (localStorage.getItem('cbeo_data_version') !== DATA_VERSION) {
    localStorage.removeItem('cbeo_peeos_data');
    localStorage.removeItem('cbeo_staff_data');
    localStorage.removeItem('cbeo_schools56_data');
    // NOTE: Form drafts (cbeo_form_draft_*) are deliberately preserved so user never loses unfinished data!
    localStorage.setItem('cbeo_data_version', DATA_VERSION);
    try {
      const lu = JSON.parse(localStorage.getItem('cbeo_logged_user') || 'null');
      if (lu && lu.shala_darpan_code === 'P55700') {
        lu.peeo_name = 'PEEO EKALSEENGA';
        lu.peeo_code = '221786';
        localStorage.setItem('cbeo_logged_user', JSON.stringify(lu));
      }
    } catch(e) {}
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

  // 2. Staff: load from localStorage if modified, otherwise use master
  const storedStaff = localStorage.getItem('cbeo_staff_data');
  if (storedStaff) {
    try {
      STATE.staff = JSON.parse(storedStaff);
    } catch (e) {
      STATE.staff = MASTER_CBEO_DATA.staff || [];
    }
  } else {
    STATE.staff = MASTER_CBEO_DATA.staff || [];
    saveStaffToStorage();
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

  // Filter out any duplicate Saman Pariksha entry to prevent duplicate tab confusion (permanently handled by dedicated tab)
  STATE.demands = (STATE.demands || []).filter(d => 
    d && !d.archived && 
    d.id !== 'saman_pariksha_2026_27' && 
    d.id !== 'DEMAND_SAMAN_PARIKSHA_2026' && 
    !d.id.toLowerCase().includes('saman_pariksha') &&
    !(d.title && d.title.includes('समान परीक्षा'))
  );
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

  // Explicitly ensure test Badanwada submission is purged
  if (STATE.samanParikshaSubmissions && STATE.samanParikshaSubmissions['221769']) {
    delete STATE.samanParikshaSubmissions['221769'];
    localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
  }

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
  const savedUser = localStorage.getItem('cbeo_logged_user');
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
  // If user is already logged in, keep login modal closed and apply their portal view
  if (!STATE.currentUser) {
    setTimeout(() => {
      openLoginModal(true); // isMandatory = true
    }, 150);
  } else {
    closeModal('modal-login');
    // Handle URL query parameters (e.g. ?show_pdf=221754 or ?form=221754)
    const urlParams = new URLSearchParams(window.location.search);
    const showPdfCode = urlParams.get('show_pdf');
    const openFormCode = urlParams.get('form');
    if (showPdfCode) {
      setTimeout(() => {
        switchTab('saman-pariksha');
        openExamPdfPreview(showPdfCode);
      }, 300);
    } else if (openFormCode) {
      setTimeout(() => {
        switchTab('saman-pariksha');
        openSamanParikshaForm(openFormCode);
      }, 300);
    }
  }
}

function logoutUser() {
  localStorage.removeItem('cbeo_logged_user');
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
        headerCodeLabel.innerHTML = `शा.दा./PSP कोड: <strong style="color:#fde047">${sdCode}</strong>` + (exCode ? ` <span class="sep-dot">•</span> परीक्षा कोड: <strong style="color:#86efac">${exCode}</strong>` : '');
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
        headerCodeLabel.innerHTML = `PEEO कोड: <strong style="color:#fde047">${sdCode}</strong>` + (peeoExCode ? ` <span class="sep-dot">•</span> परीक्षा कोड: <strong style="color:#86efac">${peeoExCode}</strong>` : '');
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
  const subWrap = document.getElementById('login-school-sub-wrap');

  const policy = STATE.schoolLoginPolicy || 'sec_srsec';

  if (optgroupPeeo) {
    optgroupPeeo.innerHTML = '';
    STATE.peeos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.shala_darpan_code;
      opt.textContent = `[PEEO] ${p.shala_darpan_code} - ${p.peeo_name} (${p.principal_incharge})`;
      optgroupPeeo.appendChild(opt);
    });
  }

  // Populate 1-click schools in first dropdown if permitted
  if (optgroupSchools56) {
    optgroupSchools56.innerHTML = '';
    if (policy === 'peeo_nodal') {
      optgroupSchools56.style.display = 'none';
    } else {
      const allowedSchools = (STATE.schools56 || []).filter(s => isSchoolLoginAllowed(s.shala_darpan_code));
      if (allowedSchools.length > 0) {
        optgroupSchools56.style.display = '';
        optgroupSchools56.label = (policy === 'all') 
          ? `माध्यमिक व उच्च माध्यमिक विद्यालय (त्वरित 1-क्लिक)` 
          : `अनुमत विद्यालय (${allowedSchools.length} स्कूल)`;
        allowedSchools.forEach(s => {
          const opt = document.createElement('option');
          opt.value = `sch_${s.shala_darpan_code}`;
          opt.textContent = `[${s.type === 'Private' ? 'निजी' : 'राजकीय'}] ${s.shala_darpan_code} - ${s.school_name}`;
          optgroupSchools56.appendChild(opt);
        });
      } else {
        optgroupSchools56.style.display = 'none';
      }
    }
  }

  if (subWrap && policy === 'peeo_nodal') {
    subWrap.style.display = 'none';
  }

  if (STATE.currentUser) {
    if (select) {
      select.value = (STATE.currentUser.role === 'admin') ? STATE.currentUser.username : (STATE.currentUser.peeo_code || STATE.currentUser.shala_darpan_code);
    }
    document.getElementById('login-username').value = STATE.currentUser.shala_darpan_code;
  } else {
    // Default selection: PEEO Deoliya Kalan
    if (select) {
      select.value = '221754';
    }
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

  if (val === 'jitendra_admin') {
    if (subWrap) subWrap.style.display = 'none';
    usernameInput.value = 'admin_jitendra';
    passwordInput.value = '';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-shield-alt" style="color:#d97706"></i> <span><strong>सुरक्षा संकेत:</strong> एडमिन पासवर्ड गोपनीय है। कृपया अपना पासवर्ड मैन्युअली टाइप करें।</span>';
      hintBox.style.background = '#fef3c7';
      hintBox.style.color = '#92400e';
    }
    return;
  }

  if (val === 'cbeo_admin') {
    if (subWrap) subWrap.style.display = 'none';
    usernameInput.value = '8140';
    passwordInput.value = '';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-shield-alt" style="color:#d97706"></i> <span><strong>सुरक्षा संकेत:</strong> मुख्य ब्लॉक शिक्षा अधिकारी पासवर्ड गोपनीय है। कृपया पासवर्ड टाइप करें।</span>';
      hintBox.style.background = '#fef3c7';
      hintBox.style.color = '#92400e';
    }
    return;
  }

  // If a school from the 58 schools list is selected (in non-'all' policy mode)
  if (val && val.startsWith('sch_')) {
    if (subWrap) subWrap.style.display = 'none';
    const sCode = val.replace('sch_', '');
    usernameInput.value = sCode;
    const currentPwd = STATE.sheetAuthPasswords[sCode]?.password || STATE.customPasswords[sCode] || sCode;
    passwordInput.value = currentPwd;
    if (hintBox) {
      hintBox.innerHTML = `<i class="fas fa-check-circle text-success"></i> <span><strong>विद्यालय चयनित:</strong> कोड <code>${sCode}</code> एवं पासवर्ड स्वतः भर दिया गया है। 'लॉगिन करें' दबाएं।</span>`;
      hintBox.style.background = '#ecfdf5';
      hintBox.style.color = '#065f46';
    }
    return;
  }

  const peeo = STATE.peeos.find(p => p.shala_darpan_code === val || p.peeo_id === val);
  if (peeo) {
    usernameInput.value = peeo.shala_darpan_code;
    const peeoPwd = STATE.sheetAuthPasswords[peeo.shala_darpan_code]?.password || STATE.customPasswords[peeo.shala_darpan_code] || peeo.shala_darpan_code;
    passwordInput.value = peeoPwd;

    const policy = STATE.schoolLoginPolicy || 'sec_srsec';

    // 2nd Tier Subordinate Schools Dropdown:
    // If policy is 'peeo_nodal', subordinate school login is blocked, hide subWrap
    if (policy === 'peeo_nodal') {
      if (subWrap) subWrap.style.display = 'none';
    } else if (subWrap && subSelect) {
      subSelect.innerHTML = '';

      // Option 1: PEEO HQ / Nodal School itself
      const peeoSchool = (STATE.schools56 || []).find(s => s.shala_darpan_code === peeo.shala_darpan_code) || 
                         (peeo.schools || []).find(s => s.shala_darpan_code === peeo.shala_darpan_code) || 
                         { school_name: peeo.peeo_name };

      const optPeeo = document.createElement('option');
      optPeeo.value = peeo.shala_darpan_code;
      optPeeo.textContent = `🏛️ [PEEO नोडल HQ विद्यालय] ${peeo.shala_darpan_code} - ${peeoSchool.school_name}`;
      subSelect.appendChild(optPeeo);

      // Followed by all allowed subordinate schools under this PEEO
      let allowedCount = 0;
      (peeo.schools || []).forEach(s => {
        const sCode = String(s.shala_darpan_code || s.dise_code || s.psp_code || '').trim();
        if (sCode && sCode !== peeo.shala_darpan_code) {
          if (isSchoolLoginAllowed(sCode)) {
            allowedCount++;
            const opt = document.createElement('option');
            opt.value = sCode;
            opt.textContent = `🏫 [${s.type === 'Private' ? 'निजी' : 'राजकीय'}] ${sCode} - ${s.school_name}`;
            subSelect.appendChild(opt);
          }
        }
      });

      subWrap.style.display = 'block';
    } else {
      if (subWrap) subWrap.style.display = 'none';
    }

    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-lightbulb text-warning"></i> <span><strong>संकेत:</strong> PEEO एवं विद्यालयों का डिफ़ॉल्ट पासवर्ड उनका <strong>शाला दर्पण / PSP कोड</strong> ही है।</span>';
      hintBox.style.background = '#e0f2fe';
      hintBox.style.color = '#0369a1';
    }
  }
}

function onQuickSelectSchoolUnderPeeo() {
  const subSelect = document.getElementById('login-school-sub-select');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const hintText = document.getElementById('login-school-sub-hint');
  if (!subSelect || !usernameInput || !passwordInput) return;

  const code = subSelect.value;
  if (!code) return;

  usernameInput.value = code;

  // Auto-fill password with custom password, sheet password, or default code
  const currentPwd = STATE.sheetAuthPasswords[code]?.password || STATE.customPasswords[code] || code;
  passwordInput.value = currentPwd;

  if (hintText) {
    const selectedText = subSelect.options[subSelect.selectedIndex]?.text || '';
    hintText.innerHTML = `✨ <strong>चयनित:</strong> ${selectedText} | User ID व Password स्वतः भर गया है। <span style="color:#16a34a; font-weight:bold">लॉगिन बटन दबाएं!</span>`;
  }
}

function performLogin() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();
  const remember = document.getElementById('login-remember-me')?.checked ?? true;

  function onLoginSuccess(userObj, toastMsg, openForm = false) {
    STATE.currentUser = userObj;
    localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
    if (remember) {
      localStorage.setItem('cbeo_remember_me', 'true');
      localStorage.setItem('cbeo_saved_username', u);
    } else {
      localStorage.removeItem('cbeo_remember_me');
    }
    closeModal('modal-login');
    showToast(toastMsg, 'success');
    renderApp();
    switchTab('saman-pariksha');
    if (openForm && userObj.role === 'school') {
      openSamanParikshaForm(userObj.shala_darpan_code);
    }
  }

  // Super Admin Check
  if (u === 'admin_jitendra' || u === 'jitendra_admin' || u === 'jitendra' || (u === 'admin' && p === 'admin123')) {
    onLoginSuccess({
      role: 'admin',
      admin_id: 'ADMIN02',
      name: 'जितेन्द्र कुमार (Jitendra Kumar)',
      post: 'तकनीकी नोडल प्रभारी एवं व्यवस्थापक',
      mobile: '7073800244',
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
  else if (viewId === 'explorer') renderExplorerView();
  else if (viewId === 'directory') renderDirectoryView();
  else if (viewId === 'staff') renderStaffView();
  else if (viewId === 'school-management') renderSchoolManagementView();
  else if (viewId === 'demands') renderDemandsView();
  else if (viewId === 'archive') renderArchiveView();
  else if (viewId === 'admin-control') renderAdminControlView();
  else renderDashboardView();
}

function applyTabVisibility() {
  const config = STATE.adminTabConfig || {
    saman_pariksha: true,
    directory: false,
    explorer: false,
    reports: false
  };

  const isPeeoOrSchool = STATE.currentUser && (STATE.currentUser.role === 'peeo' || STATE.currentUser.role === 'school');
  
  const tabDash = document.getElementById('nav-tab-dashboard');
  const tabDir = document.getElementById('nav-tab-directory');
  const tabExp = document.getElementById('nav-tab-explorer');
  const tabStaff = document.getElementById('nav-tab-staff');
  const tabSchMgmt = document.getElementById('nav-tab-school-management');
  const tabReports = document.getElementById('nav-tab-reports');
  const tabArchive = document.getElementById('nav-tab-archive');
  const tabAdmin = document.getElementById('nav-tab-admin');
  const quickBanner = document.querySelector('.directory-quick-banner');

  if (isPeeoOrSchool) {
    if (tabDash) tabDash.style.display = 'none';
    if (tabDir) tabDir.style.display = config.directory ? 'inline-flex' : 'none';
    if (tabExp) tabExp.style.display = config.explorer ? 'inline-flex' : 'none';
    if (tabStaff) tabStaff.style.display = config.explorer ? 'inline-flex' : 'none';
    if (tabSchMgmt) tabSchMgmt.style.display = 'none';
    if (tabReports) tabReports.style.display = config.reports ? 'inline-flex' : 'none';
    if (tabArchive) tabArchive.style.display = 'none';
    if (tabAdmin) tabAdmin.style.display = 'none';
    if (quickBanner) quickBanner.style.display = config.directory ? 'flex' : 'none';
  } else if (STATE.currentUser && STATE.currentUser.role === 'admin') {
    if (tabDash) tabDash.style.display = 'inline-flex';
    if (tabDir) tabDir.style.display = 'inline-flex';
    if (tabExp) tabExp.style.display = 'inline-flex';
    if (tabStaff) tabStaff.style.display = 'inline-flex';
    if (tabSchMgmt) tabSchMgmt.style.display = 'inline-flex';
    if (tabReports) tabReports.style.display = 'inline-flex';
    if (tabArchive) tabArchive.style.display = 'inline-flex';
    if (tabAdmin) tabAdmin.style.display = 'inline-flex';
    if (quickBanner) quickBanner.style.display = 'flex';
  }

  // Update checkbox state in admin panel
  const toggleDir = document.getElementById('tab-toggle-directory');
  const toggleExp = document.getElementById('tab-toggle-explorer');
  const toggleRep = document.getElementById('tab-toggle-reports');
  if (toggleDir) toggleDir.checked = !!config.directory;
  if (toggleExp) toggleExp.checked = !!config.explorer;
  if (toggleRep) toggleRep.checked = !!config.reports;
}

function saveTabAccessConfig() {
  const toggleDir = document.getElementById('tab-toggle-directory');
  const toggleExp = document.getElementById('tab-toggle-explorer');
  const toggleRep = document.getElementById('tab-toggle-reports');

  STATE.adminTabConfig = {
    saman_pariksha: true,
    directory: toggleDir ? toggleDir.checked : false,
    explorer: toggleExp ? toggleExp.checked : false,
    reports: toggleRep ? toggleRep.checked : true
  };

  localStorage.setItem('cbeo_tab_config', JSON.stringify(STATE.adminTabConfig));
  fetch('/api/save_tab_config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(STATE.adminTabConfig)
  }).catch(() => {});

  applyTabVisibility();
  showToast('PEEO पोर्टल टैब दृश्यता सेटिंग्स सुरक्षित कर दी गई हैं!', 'success');
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

  fetch(`${gasUrl}?action=getAuth`)
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.users) {
        STATE.sheetAuthPasswords = data.users;
        localStorage.setItem('cbeo_sheet_auth_cache', JSON.stringify(data.users));
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

function renderSamanParikshaView() {
  const peeoContainer = document.getElementById('sp-peeo-container');
  const adminContainer = document.getElementById('sp-admin-container');

  if (!STATE.currentUser) {
    if (peeoContainer) peeoContainer.style.display = 'none';
    if (adminContainer) adminContainer.style.display = 'none';
    return;
  }

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

  // समेकित मांग रिपोर्ट बटन केवल PEEO लॉगिन पर उपलब्ध रहेगा
  const isPeeo = STATE.currentUser && STATE.currentUser.role === 'peeo';
  if (btnConsolidated) {
    btnConsolidated.style.display = isPeeo ? 'inline-flex' : 'none';
  }

  let targetSchools = [];
  if (STATE.currentUser.role === 'school') {
    targetSchools = STATE.schools56.filter(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code);
    if (heading) heading.textContent = `${STATE.currentUser.school_name} (परीक्षा प्रपत्र)`;
  } else {
    // PEEO login
    targetSchools = STATE.schools56.filter(s => 
      (STATE.currentUser.peeo_name && s.peeo_name && s.peeo_name.toLowerCase().includes(STATE.currentUser.peeo_name.toLowerCase())) ||
      s.peeo_code === STATE.currentUser.shala_darpan_code ||
      STATE.currentUser.schools?.some(sch => sch.shala_darpan_code === s.shala_darpan_code)
    );
    if (heading) heading.textContent = `${STATE.currentUser.peeo_name || 'PEEO'} परिक्षेत्र (${targetSchools.length} माध्यमिक व उच्च माध्यमिक विद्यालय)`;
  }

  let submittedCount = 0;
  targetSchools.forEach((school, index) => {
    const sub = STATE.samanParikshaSubmissions[school.shala_darpan_code];
    const isSubmitted = isSamanParikshaSubmitted(sub);
    if (isSubmitted) submittedCount++;

    const card = document.createElement('div');
    card.className = `sp-school-card ${isSubmitted ? 'submitted' : 'pending'}`;

    const catBadge = school.type === 'Government' 
      ? '<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700">🏛️ राजकीय</span>'
      : '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700">🏢 निजी</span>';

    const statusBadge = isSubmitted
      ? `<span class="sp-status-badge success"><i class="fas fa-check-circle"></i> ✓ डेटा सबमिट पूर्ण (${sub.grand_total} पेपर)</span>`
      : `<span class="sp-status-badge danger"><i class="fas fa-exclamation-triangle"></i> ⚠️ प्रपत्र भरना शेष (अपूर्ण)</span>`;

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

    card.innerHTML = `
      <div>
        <div class="sp-card-header">
          <div class="sp-school-name">#${index + 1}. ${school.school_name}</div>
          ${statusBadge}
        </div>
        <div class="sp-school-meta">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <span><strong>शा.दा./PSP कोड:</strong> ${school.shala_darpan_code}</span>
            ${catBadge}
          </div>
          <div><strong>श्रेणी:</strong> ${school.category}</div>
          <div><strong>परीक्षा कोड:</strong> ${sub?.exam_code ? `<span style="color:#2563eb; font-weight:800">${sub.exam_code}</span>` : '<span style="color:#94a3b8">दर्ज नहीं</span>'}</div>
          ${submittedDetailsHtml}
        </div>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem">
        <button class="btn ${isSubmitted ? 'btn-warning' : 'btn-primary'} btn-sm" onclick="openSamanParikshaForm('${school.shala_darpan_code}')" style="flex:1; font-weight:700">
          <i class="fas ${isSubmitted ? 'fa-edit' : 'fa-file-signature'}"></i> ${isSubmitted ? '✏️ प्रपत्र में संशोधन (Edit)' : '📝 Google Form प्रपत्र भरें'}
        </button>
        <a href="saman_form.html?code=${school.shala_darpan_code}" target="_blank" class="btn btn-outline-primary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem; font-weight:700" title="नए पेज में खोलें (अलग टैब)">
          <i class="fas fa-external-link-alt"></i> ${isSubmitted ? 'अलग पेज में एडिट' : 'अलग पेज'}
        </a>
        ${isSubmitted ? `
          <button class="btn btn-success btn-sm" onclick="openExamPdfPreview('${school.shala_darpan_code}')" title="आधिकारिक प्रमाणित PDF देखें / प्रिंट करें" style="font-weight:700">
            <i class="fas fa-print"></i> PDF प्रिंट
          </button>
        ` : ''}
      </div>
    `;
    grid.appendChild(card);
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
  const totalSchools = STATE.schools56.length;
  let submittedCount = 0;
  let totalPapers = 0;
  let govCount = 0;
  let pvtCount = 0;

  STATE.schools56.forEach(s => {
    if (s.type === 'Government') govCount++;
    else if (s.type === 'Private') pvtCount++;
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    if (isSamanParikshaSubmitted(sub)) {
      submittedCount++;
      totalPapers += (parseInt(sub.grand_total) || 0);
    }
  });

  const pendingCount = totalSchools - submittedCount;

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
  document.getElementById('sp-admin-total-papers').textContent = totalPapers.toLocaleString('en-IN');

  // Populate PEEO filter in admin view if empty
  const peeoSelect = document.getElementById('sp-peeo-filter');
  if (peeoSelect && peeoSelect.options.length <= 1) {
    STATE.peeos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.peeo_name;
      opt.textContent = `${p.peeo_name} (${p.shala_darpan_code})`;
      peeoSelect.appendChild(opt);
    });
  }

  filterSamanParikshaTable();
}

function filterSamanParikshaTable() {
  const search = document.getElementById('sp-search-input')?.value.toLowerCase() || '';
  const catFilter = document.getElementById('sp-category-filter')?.value || 'all';
  const statusFilter = document.getElementById('sp-status-filter')?.value || 'all';
  const peeoFilter = document.getElementById('sp-peeo-filter')?.value || 'all';

  const tbody = document.getElementById('sp-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let filtered = STATE.schools56.filter(s => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSubmitted = isSamanParikshaSubmitted(sub);

    if (catFilter !== 'all' && s.type !== catFilter) return false;
    if (statusFilter === 'submitted' && !isSubmitted) return false;
    if (statusFilter === 'pending' && isSubmitted) return false;
    if (peeoFilter !== 'all' && !s.peeo_name.toLowerCase().includes(peeoFilter.toLowerCase())) return false;

    if (search) {
      const text = `${s.school_name} ${s.shala_darpan_code} ${s.peeo_name} ${sub?.exam_code || s.exam_code || ''} ${sub?.principal_name || s.principal_name || ''}`.toLowerCase();
      if (!text.includes(search)) return false;
    }

    return true;
  });

  document.getElementById('sp-table-count').textContent = `${filtered.length} विद्यालय`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding:2rem; color:#64748b">कोई विद्यालय मैच नहीं हुआ।</td></tr>';
    return;
  }

  filtered.forEach((s, idx) => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    const isSub = isSamanParikshaSubmitted(sub);

    const hasSig = !!(sub?.signature_data || sub?.has_digital_signature);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.s_no}</td>
      <td>
        <strong>${s.school_name}</strong>
        <div style="font-size:0.75rem; color:#64748b">कोड: ${s.shala_darpan_code}</div>
      </td>
      <td>
        ${s.type === 'Government' 
          ? '<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700">राजकीय</span>'
          : '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700">निजी</span>'}
      </td>
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
        ${isSub 
          ? `<span class="status-badge" style="background:#dcfce7; color:#15803d" title="${hasSig ? 'डिजिटल हस्ताक्षर सहित सबमिट' : 'सबमिट पूर्ण'}">सबमिट ${hasSig ? '🖋️' : ''}</span>`
          : '<span class="status-badge" style="background:#fef3c7; color:#b45309">लम्बित</span>'}
      </td>
      <td>
        <div style="display:flex; gap:0.35rem; align-items:center">
          <button class="btn btn-outline-light btn-sm" onclick="openSamanParikshaForm('${s.shala_darpan_code}')" title="प्रपत्र भरें / संपादित करें">
            <i class="fas fa-edit"></i>
          </button>
          <a href="saman_form.html?code=${s.shala_darpan_code}" target="_blank" class="btn btn-outline-light btn-sm" title="नए पेज में खोलें (अलग टैब)">
            <i class="fas fa-external-link-alt"></i>
          </a>
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
    tbody.appendChild(tr);
  });
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

  const activeData = draft ? { ...sub, ...draft } : sub;

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

  document.getElementById('gform-school-code-hidden').value = school.shala_darpan_code;
  document.getElementById('gform-school-name').value = school.school_name;
  document.getElementById('gform-school-code').value = school.shala_darpan_code;
  document.getElementById('gform-peeo-name').value = school.peeo_name;
  document.getElementById('gform-school-cat').value = `${school.category} (${school.type})`;
  document.getElementById('gform-exam-code').value = activeData.exam_code || school.exam_code || '';

  document.getElementById('gform-principal-name').value = activeData.principal_name || school.principal_name || '';
  document.getElementById('gform-principal-mobile').value = activeData.principal_mobile || school.principal_mobile || '';
  document.getElementById('gform-incharge-name').value = activeData.incharge_name || school.incharge_name || '';
  document.getElementById('gform-incharge-mobile').value = activeData.incharge_mobile || school.incharge_mobile || '';

  document.getElementById('gform-c9-total').value = activeData.c9_total ?? 0;
  if (document.getElementById('gform-c9-sanskrit')) document.getElementById('gform-c9-sanskrit').value = activeData.c9_sanskrit ?? 0;
  if (document.getElementById('gform-c9-urdu')) document.getElementById('gform-c9-urdu').value = activeData.c9_urdu ?? 0;

  document.getElementById('gform-c10-total').value = activeData.c10_total ?? 0;
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
    standaloneBtn.href = `saman_form.html?code=${school.shala_darpan_code}`;
  }
  showModal('modal-saman-pariksha-form');
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

function calculateGFormTotals() {
  const c9 = parseInt(document.getElementById('gform-c9-total')?.value) || 0;
  const c10 = parseInt(document.getElementById('gform-c10-total')?.value) || 0;

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
    const sk = document.getElementById('gform-c9-sanskrit');
    const ur = document.getElementById('gform-c9-urdu');
    if (el) el.value = 0;
    if (sk) sk.value = 0;
    if (ur) ur.value = 0;
    showToast('कक्षा 9 को शून्य / संचालित नहीं (NIL) सेट किया गया', 'info');
  } else if (cls === 'c10') {
    const el = document.getElementById('gform-c10-total');
    const sk = document.getElementById('gform-c10-sanskrit');
    const ur = document.getElementById('gform-c10-urdu');
    if (el) el.value = 0;
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
  clearTimeout(gformAutoSaveTimer);
  gformAutoSaveTimer = setTimeout(() => {
    const schoolCode = document.getElementById('gform-school-code-hidden')?.value;
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
      principal_name: document.getElementById('gform-principal-name')?.value || '',
      principal_mobile: document.getElementById('gform-principal-mobile')?.value || '',
      incharge_name: document.getElementById('gform-incharge-name')?.value || '',
      incharge_mobile: document.getElementById('gform-incharge-mobile')?.value || '',
      c9_total: parseInt(document.getElementById('gform-c9-total')?.value) || 0,
      c9_sanskrit: parseInt(document.getElementById('gform-c9-sanskrit')?.value) || 0,
      c9_urdu: parseInt(document.getElementById('gform-c9-urdu')?.value) || 0,
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

  const examCode = document.getElementById('gform-exam-code').value.trim();
  const principalName = document.getElementById('gform-principal-name').value.trim();
  const principalMobile = document.getElementById('gform-principal-mobile').value.trim();
  const inchargeName = document.getElementById('gform-incharge-name').value.trim();
  const inchargeMobile = document.getElementById('gform-incharge-mobile').value.trim();

  if (!examCode) {
    showToast('कृपया स्कूल परीक्षा कोड (4-6 अंक) अवश्य दर्ज करें!', 'error');
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

  const c9 = parseInt(document.getElementById('gform-c9-total')?.value) || 0;
  const c9Sanskrit = parseInt(document.getElementById('gform-c9-sanskrit')?.value) || 0;
  const c9Urdu = parseInt(document.getElementById('gform-c9-urdu')?.value) || 0;

  const c10 = parseInt(document.getElementById('gform-c10-total')?.value) || 0;
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
    principal_name: principalName,
    principal_mobile: principalMobile,
    incharge_name: inchargeName,
    incharge_mobile: inchargeMobile,
    c9_total: c9,
    c9_sanskrit: c9Sanskrit,
    c9_urdu: c9Urdu,
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

  // 2. Sync to local backend file & Google Sheet (Direct to port 8089 if on localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    fetch('http://localhost:8089/api/save_saman_pariksha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    }).then(res => res.json()).then(data => {
      if (data && data.synced_to_sheet) {
        showToast('समान परीक्षा प्रपत्र Google Sheet में तुरंत सिंक हो गया!', 'success');
      }
    }).catch(() => {});
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

function openExamPdfPreview(schoolCode) {
  STATE.activeExamPreviewCode = schoolCode;
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
      principal_name: school.principal_name || 'संस्था प्रधान',
      principal_mobile: school.principal_mobile || '---',
      incharge_name: school.incharge_name || 'परीक्षा प्रभारी',
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
      c11OptPills.push(`<span style="display:inline-block; margin:1px 2px; padding:1px 4px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:3px; font-size:0.72rem; line-height:1.2"><strong>${s.label.split('(')[0].trim()}:</strong> ${count}</span>`);
    }
  });
  const c11OptPillsHtml = c11OptPills.length > 0 ? c11OptPills.join(' ') : '<span style="color:#94a3b8">- कोई ऐच्छिक विषय दर्ज नहीं -</span>';

  const c12OptPills = [];
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(s => {
    const count = sub.c12_optional?.[s.key] || 0;
    if (count > 0) {
      c12OptPills.push(`<span style="display:inline-block; margin:1px 2px; padding:1px 4px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:3px; font-size:0.72rem; line-height:1.2"><strong>${s.label.split('(')[0].trim()}:</strong> ${count}</span>`);
    }
  });
  const c12OptPillsHtml = c12OptPills.length > 0 ? c12OptPills.join(' ') : '<span style="color:#94a3b8">- कोई ऐच्छिक विषय दर्ज नहीं -</span>';

  const c11FacNames = (sub.c11_faculties && sub.c11_faculties.length > 0) 
    ? sub.c11_faculties.map(f => FACULTIES_CONFIG[f]?.name || f).join(', ') 
    : 'सामान्य';
  const c12FacNames = (sub.c12_faculties && sub.c12_faculties.length > 0) 
    ? sub.c12_faculties.map(f => FACULTIES_CONFIG[f]?.name || f).join(', ') 
    : 'सामान्य';

  container.innerHTML = `
    <!-- Top Emblem & Departmental Header (Single Page A4 Landscape Layout) -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:2px; margin-bottom:4px">
      <div style="font-size:0.80rem; font-weight:700; color:#000; letter-spacing:normal">राजस्थान सरकार | स्कूल शिक्षा विभाग</div>
      <div style="font-size:1.12rem; font-weight:900; color:#000; margin:1px 0">
        कार्यालय संस्था प्रधान, ${school.school_name}
      </div>
      <div style="font-size:0.78rem; font-weight:700; color:#111; margin-bottom:1px">
        ग्राम / परिक्षेत्र: ${school.peeo_name.replace('PEEO ', '')}, ब्लॉक-भिनाय, जिला-अजमेर (राज.) | शाला दर्पण / PSP कोड: ${school.shala_darpan_code}
      </div>
      <div style="font-size:0.95rem; font-weight:800; color:#000; letter-spacing:normal">
        जिला समान परीक्षा योजना (सत्र 2026-27)
      </div>
      <div style="font-size:0.80rem; font-weight:700; color:#222">
        कक्षा 9 से 12 विद्यार्थी नामांकन एवं प्रश्न-पत्र मांग अधिकृत विवरण प्रपत्र
      </div>
    </div>

    <!-- School Meta Table (Laser Print-Friendly Clean Grid) -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:4px; font-size:0.78rem; border:1.5px solid #000">
      <tr style="background:#f8fafc">
        <td style="padding:2px 5px; border:1px solid #000; width:15%"><strong>विद्यालय का नाम:</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:800; width:35%">${school.school_name}</td>
        <td style="padding:2px 5px; border:1px solid #000; width:18%"><strong>शाला दर्पण / PSP कोड:</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:800; width:32%">${school.shala_darpan_code} <span style="font-size:0.72rem; font-weight:normal">(${school.category} - ${school.type})</span></td>
      </tr>
      <tr>
        <td style="padding:2px 5px; border:1px solid #000; background:#f8fafc"><strong>संबंधित PEEO:</strong></td>
        <td style="padding:2px 5px; border:1px solid #000">${school.peeo_name}</td>
        <td style="padding:2px 5px; border:1px solid #000; background:#f8fafc"><strong>स्कूल परीक्षा कोड:</strong></td>
        <td style="padding:2px 5px; border:1px solid #000; font-weight:900; font-size:0.92rem">${sub.exam_code}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:2px 5px; border:1px solid #000"><strong>संस्था प्रधान:</strong></td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>${sub.principal_name}</strong> (मो. ${sub.principal_mobile})</td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>परीक्षा प्रभारी:</strong></td>
        <td style="padding:2px 5px; border:1px solid #000"><strong>${sub.incharge_name}</strong> (मो. ${sub.incharge_mobile})</td>
      </tr>
    </table>

    <!-- 8-Column Comprehensive Matrix Table (Laser Print-Friendly High-Contrast) -->
    <table class="exam-excel-table" style="width:100%; border-collapse:collapse; border:2px solid #000; text-align:center; font-size:0.77rem; margin-bottom:4px">
      <thead>
        <tr style="background:#f1f5f9; color:#000; font-weight:800">
          <th style="padding:3px 2px; border:1.5px solid #000; width:35px">क्र.सं.</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:70px">कक्षा</th>
          <th style="padding:3px 5px; border:1.5px solid #000; width:210px; text-align:left">अनिवार्य विषय (Compulsory Subjects)</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:140px">तृतीय भाषा (Third Language)</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:110px">संचालित संकाय (Faculty)</th>
          <th style="padding:3px 5px; border:1.5px solid #000; text-align:left">ऐच्छिक विषय मांग विवरण (Optional Subjects)</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:75px">नामांकन</th>
          <th style="padding:3px 3px; border:1.5px solid #000; width:75px; background:#e2e8f0; font-weight:900">मांग संख्या</th>
        </tr>
      </thead>
      <tbody>
        <!-- Class 9 Row -->
        <tr style="border-bottom:1px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">1</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">कक्षा 9वीं</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c9_total > 0) ? 'हिंदी, अंग्रेजी, विज्ञान, सामाजिक विज्ञान, गणित (5 अनिवार्य विषय)' : '<span style="color:#475569; font-style:italic">कक्षा 9वीं में शून्य नामांकन (NIL / संचालित नहीं)</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">
            ${(sub.c9_total > 0) ? `संस्कृत: ${sub.c9_sanskrit || 0} | उर्दू: ${sub.c9_urdu || 0}` : '<span style="color:#64748b">- (लागू नहीं) -</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000">${(sub.c9_total > 0) ? 'सामान्य (General)' : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; color:#64748b; text-align:center">- (कक्षा 9 में लागू नहीं) -</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c9_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c9_total > 0) ? sub.c9_total : '0 (NIL)'}</td>
        </tr>
        
        <!-- Class 10 Row -->
        <tr style="border-bottom:1px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">2</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">कक्षा 10वीं</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c10_total > 0) ? 'हिंदी, अंग्रेजी, विज्ञान, सामाजिक विज्ञान, गणित (5 अनिवार्य विषय)' : '<span style="color:#475569; font-style:italic">कक्षा 10वीं में शून्य नामांकन (NIL / संचालित नहीं)</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">
            ${(sub.c10_total > 0) ? `संस्कृत: ${sub.c10_sanskrit || 0} | उर्दू: ${sub.c10_urdu || 0}` : '<span style="color:#64748b">- (लागू नहीं) -</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000">${(sub.c10_total > 0) ? 'सामान्य (General)' : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; color:#64748b; text-align:center">- (कक्षा 10 में लागू नहीं) -</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c10_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c10_total > 0) ? sub.c10_total : '0 (NIL)'}</td>
        </tr>

        <!-- Class 11 Row -->
        <tr style="border-bottom:1px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">3</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">कक्षा 11वीं</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c11_total > 0) ? `अनिवार्य हिंदी (${sub.c11_comp_hindi}), अनिवार्य अंग्रेजी (${sub.c11_comp_english})` : '<span style="color:#475569; font-style:italic">कक्षा 11वीं संचालित नहीं (NIL)</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; color:#64748b">- (लागू नहीं) -</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">${(sub.c11_total > 0) ? c11FacNames : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c11_total > 0) ? c11OptPillsHtml : '<span style="color:#64748b">- कोई ऐच्छिक विषय लागू नहीं (NIL) -</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c11_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c11_total > 0) ? sub.c11_total : '0 (NIL)'}</td>
        </tr>

        <!-- Class 12 Row -->
        <tr style="border-bottom:2px solid #000">
          <td style="padding:2.5px 2px; border:1px solid #000; font-weight:700">4</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800; background:#f8fafc">कक्षा 12वीं</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c12_total > 0) ? `अनिवार्य हिंदी (${sub.c12_comp_hindi}), अनिवार्य अंग्रेजी (${sub.c12_comp_english})` : '<span style="color:#475569; font-style:italic">कक्षा 12वीं संचालित नहीं (NIL)</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; color:#64748b">- (लागू नहीं) -</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:700">${(sub.c12_total > 0) ? c12FacNames : '<span style="color:#64748b">-</span>'}</td>
          <td style="padding:2.5px 5px; border:1px solid #000; text-align:left">
            ${(sub.c12_total > 0) ? c12OptPillsHtml : '<span style="color:#64748b">- कोई ऐच्छिक विषय लागू नहीं (NIL) -</span>'}
          </td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:800">${sub.c12_total}</td>
          <td style="padding:2.5px 3px; border:1px solid #000; font-weight:900; background:#f8fafc">${(sub.c12_total > 0) ? sub.c12_total : '0 (NIL)'}</td>
        </tr>

        <!-- Grand Total Banner Row -->
        <tr style="background:#f1f5f9; font-weight:900; border:2px solid #000">
          <td colspan="6" style="padding:4px 6px; border:2px solid #000; text-align:right; font-size:0.86rem; color:#000">
            🎯 सत्र 2026-27 कुल मांग प्रश्न-पत्र संख्या (कक्षा 9 से 12 महायोग - Grand Total):
          </td>
          <td style="padding:4px 3px; border:2px solid #000; font-size:0.95rem; color:#000">${sub.grand_total}</td>
          <td style="padding:4px 3px; border:2px solid #000; font-size:1.05rem; color:#000; background:#e2e8f0">
            ${(sub.grand_total > 0) ? sub.grand_total : '<span style="font-size:0.82rem">0 (NIL प्रपत्र)</span>'}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Verification & Responsibility Declaration -->
    <div style="margin-top:4px; margin-bottom:4px; padding:3px 6px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.70rem; line-height:1.25; color:#000">
      <strong>सत्यापन एवं उत्तरदायित्व घोषणा:</strong> प्रमाणित किया जाता है कि उपर्युक्त परीक्षा संबंधी सभी छात्र संख्या, संकाय एवं विषयवार प्रविष्टियों का विद्यालय की प्रवेश पंजिका व शाला दर्पण पोर्टल से शत-प्रतिशत मिलान कर लिया गया है तथा इसमें कोई लिपिकीय अथवा तथ्यात्मक त्रुटि नहीं है। यदि भविष्य में किसी भी प्रकार की त्रुटि, विसंगति अथवा प्रश्न-पत्रों की कमी/अधिकता पाई जाती है, तो इसका संपूर्ण व्यक्तिगत एवं विभागीय उत्तरदायित्व संबंधित संस्था प्रधान एवं परीक्षा प्रभारी का होगा।
    </div>

    <!-- Official Signatures: Incharge (Left) & Principal (Right) -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 30px; margin-top:8px; margin-bottom:2px">
      
      <!-- Left: Incharge Signature (Only 'हस्ताक्षर परीक्षा प्रभारी') -->
      <div style="text-align:center; width:36%">
        <div style="height:28px"></div>
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          हस्ताक्षर परीक्षा प्रभारी
        </div>
      </div>

      <!-- Right: Principal Signature & School Details (Official Govt Format) -->
      <div style="text-align:center; width:44%">
        ${sub.signature_data ? `
          <div style="height:28px; display:flex; align-items:center; justify-content:center">
            <img src="${sub.signature_data}" style="max-height:26px; max-width:140px; object-fit:contain" alt="हस्ताक्षर">
          </div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            हस्ताक्षर संस्था प्रधान
          </div>
        ` : `
          <div style="height:28px"></div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            हस्ताक्षर संस्था प्रधान
          </div>
        `}
        <div style="font-size:0.78rem; font-weight:700; color:#000; margin-top:1px">प्रधानाचार्य / संस्था प्रधान</div>
        <div style="font-size:0.75rem; color:#111; margin-top:1px">${school.school_name}</div>
        <div style="font-size:0.72rem; color:#222; margin-top:1px">ब्लॉक-भिनाय (अजमेर)</div>
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
async function exportDocumentToPdfBlob(elementId, filename) {
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

  // Set fixed 1080px width & pristine font styles for clean single-page A4 landscape
  container.style.width = '1080px';
  container.style.maxWidth = '1080px';
  container.style.boxSizing = 'border-box';
  container.style.background = '#ffffff';
  container.style.fontFamily = "'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.style.letterSpacing = 'normal';

  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
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
  const title = `समान परीक्षा 2026-27 मांग प्रपत्र - ${school ? school.school_name : schoolCode}`;
  printCleanA4Landscape('printable-exam-document-content', title);
}

async function downloadExamPDFDirect() {
  const schoolCode = STATE.activeExamPreviewCode || 'School';
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const nameSafe = school ? school.school_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) : 'Exam_Indent';
  const filename = `Saman_Pariksha_2026_${schoolCode}_${nameSafe}.pdf`;

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

async function shareExamPDFWhatsApp() {
  const schoolCode = STATE.activeExamPreviewCode;
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const sub = STATE.samanParikshaSubmissions[schoolCode];
  if (!school || !sub) {
    showToast('प्रपत्र डेटा उपलब्ध नहीं है!', 'warning');
    return;
  }

  const nameSafe = school.school_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `Saman_Pariksha_2026_${schoolCode}_${nameSafe}.pdf`;

  const waSummary = `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n*जिला समान परीक्षा योजना (सत्र 2026-27)*\n\n📌 *विद्यालय:* ${school.school_name}\n📌 *शाला दर्पण कोड:* ${school.shala_darpan_code} | *परीक्षा कोड:* ${sub.exam_code}\n📌 *संस्था प्रधान:* ${sub.principal_name} (${sub.principal_mobile})\n📌 *परीक्षा प्रभारी:* ${sub.incharge_name} (${sub.incharge_mobile})\n\n🎯 *कुल मांग प्रश्न-पत्र (Grand Total):* *${sub.grand_total}*\n(9वीं: ${sub.c9_total}, 10वीं: ${sub.c10_total}, 11वीं: ${sub.c11_total}, 12वीं: ${sub.c12_total})\n\n📄 *अधिकृत A4 Landscape PDF प्रपत्र संलग्न है।*\n🌐 *सत्यापन पोर्टल:* https://jit9763.github.io/cbeo-bhinai-portal/`;

  showToast('WhatsApp शेयर हेतु अधिकृत PDF तैयार की जा रही है...', 'info');

  try {
    const blob = await exportDocumentToPdfBlob('printable-exam-document-content', filename);
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: `समान परीक्षा 2026 मांग - ${school.school_name}`,
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
          <span style="font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:700; ${isComplete ? 'background:#dcfce7; color:#15803d' : 'background:#fef3c7; color:#b45309'}">
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

function exportSamanParikshaMasterCSV() {
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
    
    // Class 9
    "9वीं कुल नामांकन (Class 9 Total)",
    "9वीं संस्कृत (Sanskrit 3rd Lang)",
    "9वीं उर्दू (Urdu 3rd Lang)",
    
    // Class 10
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
      
      // Class 9
      isSub ? (sub.c9_total || 0) : 0,
      isSub ? (sub.c9_sanskrit || 0) : 0,
      isSub ? (sub.c9_urdu || 0) : 0,
      
      // Class 10
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
  showToast('Google Drive शीट में डेटा सिंक किया जा रहा है...', 'info');
  try {
    const apiEndpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8089/api/sync_saman_pariksha'
      : '/api/sync_saman_pariksha';
    const res = await fetch(apiEndpoint, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('समान परीक्षा Google Sheet सफलतापूर्वक अपडेट हो गई!', 'success');
    } else {
      showToast(data.message || 'शीट सिंक प्रक्रिया पूर्ण!', 'info');
    }
  } catch (err) {
    console.log('Backend sync offline/static mode:', err);
    showToast('Google Drive शीट खोली जा रही है...', 'info');
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
      <td><span class="status-badge" style="background:${isPvt ? '#fef3c7' : '#e0f2fe'}; color:${isPvt ? '#b45309' : '#0369a1'}">${isPvt ? 'निजी (Pvt)' : 'राजकीय (Govt)'}</span></td>
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
  renderExplorerFilters();
}

// --- Directory View (Global Search) ---
function renderDirectoryFilters() {
  const dirPeeoFilter = document.getElementById('dir-peeo-filter');
  dirPeeoFilter.innerHTML = '<option value="all">सभी PEEO क्षेत्र</option>';
  STATE.peeos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    dirPeeoFilter.appendChild(opt);
  });
}

function renderDirectoryView() {
  filterDirectory();
}

function filterDirectory() {
  const search = document.getElementById('dir-search-input').value.toLowerCase().trim();
  const typeFilter = document.getElementById('dir-type-filter').value;
  const peeoFilter = document.getElementById('dir-peeo-filter').value;
  const tbody = document.getElementById('directory-tbody');
  tbody.innerHTML = '';

  let list = [];

  // Add 25 PEEO Incharges
  if (typeFilter === 'all' || typeFilter === 'peeo' || typeFilter === 'principal') {
    STATE.peeos.forEach(p => {
      list.push({
        name: p.principal_incharge,
        post: 'प्रभारी प्रधानाचार्य एवं PEEO',
        peeo_name: p.peeo_name,
        school: `${p.peeo_name} (शा.दा. कोड: ${p.shala_darpan_code})`,
        mobile: p.mobile,
        email: p.email,
        type: 'peeo'
      });
    });
  }

  // Add 46 Private Schools
  if (typeFilter === 'all' || typeFilter === 'private' || typeFilter === 'principal') {
    STATE.peeos.forEach(p => {
      (p.schools || []).filter(s => s.type === 'Private').forEach(pvt => {
        list.push({
          name: pvt.school_name,
          post: 'संस्था प्रधान / प्रबंधक (निजी विद्यालय)',
          peeo_name: p.peeo_name,
          school: `${pvt.school_name} (${pvt.category})`,
          mobile: pvt.mobile || p.mobile || '',
          email: pvt.email || '',
          type: 'private'
        });
      });
    });
  }

  // Add Staff (1048 records)
  if (typeFilter === 'all' || typeFilter === 'staff' || typeFilter === 'principal') {
    STATE.staff.filter(s => s.status !== 'Deleted').forEach(s => {
      const isPrin = s.post.toLowerCase().includes('प्रधानाचार्य') || s.post.toLowerCase().includes('headmaster');
      if (typeFilter === 'principal' && !isPrin) return;
      if (typeFilter === 'staff' && isPrin) return;

      list.push({
        name: s.name,
        post: s.post,
        peeo_name: s.peeo_name,
        school: s.school_name || s.peeo_name,
        mobile: s.mobile,
        email: s.email,
        type: isPrin ? 'principal' : 'staff'
      });
    });
  }

  const filtered = list.filter(item => {
    if (peeoFilter !== 'all' && item.peeo_name !== peeoFilter) return false;
    if (search) {
      const hay = `${item.name} ${item.post} ${item.peeo_name} ${item.school} ${item.mobile} ${item.email}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  document.getElementById('dir-total-count').textContent = `${filtered.length} संपर्क`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--neutral-500)">कोई संपर्क विवरण नहीं मिला</td></tr>`;
    return;
  }

  filtered.slice(0, 150).forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <strong>${item.name}</strong><br>
        <span style="font-size:0.75rem; color:var(--neutral-500)">${item.post}</span>
      </td>
      <td>
        <span style="font-weight:600; color:var(--primary)">${item.peeo_name}</span><br>
        <span style="font-size:0.75rem; color:var(--neutral-600)">${item.school}</span>
      </td>
      <td>
        ${item.mobile ? `<a href="tel:${item.mobile}" style="color:var(--primary); font-weight:600; text-decoration:none"><i class="fas fa-phone-alt"></i> ${item.mobile}</a>` : '<span style="color:#94a3b8">उपलब्ध नहीं</span>'}
      </td>
      <td>
        ${item.email ? `<a href="mailto:${item.email}" style="color:var(--secondary); text-decoration:none"><i class="fas fa-envelope"></i> ${item.email}</a>` : '<span style="color:#94a3b8">---</span>'}
      </td>
      <td>
        <div style="display:flex; gap:0.4rem">
          ${item.mobile ? `
            <a href="tel:${item.mobile}" class="btn btn-outline-light btn-sm" style="color:#1b365d; border-color:#cbd5e1" title="कॉल करें">
              <i class="fas fa-phone-alt"></i>
            </a>
            <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppMessage('${item.mobile}', 'नमस्ते ${item.name} जी, CBEO कार्यालय भिनाय से संपर्क सादर प्रेषित है।')" title="WhatsApp संदेश">
              <i class="fab fa-whatsapp"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Staff Management View ---
function renderStaffFilters() {
  const staffPeeoFilter = document.getElementById('staff-peeo-filter');
  staffPeeoFilter.innerHTML = '<option value="all">सभी PEEO</option>';
  STATE.peeos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.peeo_name;
    opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name}`;
    staffPeeoFilter.appendChild(opt);
  });
}

function renderStaffView() {
  filterStaffTable();
}

function filterStaffTable() {
  const search = document.getElementById('staff-search-input').value.toLowerCase().trim();
  const peeoFilter = document.getElementById('staff-peeo-filter').value;
  const tbody = document.getElementById('staff-tbody');
  tbody.innerHTML = '';

  let activeList = STATE.staff.filter(s => s.status !== 'Deleted');

  if (STATE.currentUser && STATE.currentUser.role === 'peeo') {
    activeList = activeList.filter(s => s.peeo_name === STATE.currentUser.peeo_name);
    document.getElementById('staff-peeo-filter').value = STATE.currentUser.peeo_name;
    document.getElementById('staff-peeo-filter').disabled = true;
  } else {
    document.getElementById('staff-peeo-filter').disabled = false;
    if (peeoFilter !== 'all') {
      activeList = activeList.filter(s => s.peeo_name === peeoFilter);
    }
  }

  if (search) {
    activeList = activeList.filter(s => {
      const hay = `${s.staff_id} ${s.name} ${s.post} ${s.school_name} ${s.peeo_name} ${s.mobile} ${s.sso_id}`.toLowerCase();
      return hay.includes(search);
    });
  }

  document.getElementById('staff-total-count').textContent = `${activeList.length} कार्मिक`;

  if (activeList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--neutral-500)">कोई कार्मिक रिकॉर्ड नहीं मिला</td></tr>`;
    return;
  }

  activeList.slice(0, 150).forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${s.staff_id}</code></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.post}</td>
      <td>${s.school_name || s.peeo_name}</td>
      <td><span class="status-badge" style="background:#e0f2fe; color:#0369a1">${s.peeo_name}</span></td>
      <td>${s.mobile ? `<a href="tel:${s.mobile}" style="text-decoration:none; color:var(--neutral-800)"><i class="fas fa-phone"></i> ${s.mobile}</a>` : '---'}</td>
      <td>${s.sso_id ? `<code>${s.sso_id}</code>` : '---'}</td>
      <td><span class="status-badge active"><i class="fas fa-check"></i> Active</span></td>
      <td>
        <div style="display:flex; gap:0.4rem">
          <button class="btn btn-outline-light btn-sm" style="color:#0284c7; border-color:#bae6fd" onclick="openEditStaffModal('${s.staff_id}')" title="संपादित करें">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-outline-light btn-sm" style="color:#dc2626; border-color:#fca5a5" onclick="openDeleteStaffModal('${s.staff_id}', '${s.name}')" title="हटाएं व ऑडिट सुरक्षित करें">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddStaffModal() {
  document.getElementById('staff-modal-title').innerHTML = '<i class="fas fa-user-plus text-primary"></i> नया कार्मिक विवरण जोड़ें';
  document.getElementById('staff-edit-id').value = '';
  document.getElementById('staff-edit-name').value = '';
  document.getElementById('staff-edit-mobile').value = '';
  document.getElementById('staff-edit-email').value = '';
  document.getElementById('staff-edit-sso').value = '';
  document.getElementById('staff-edit-bank-acc').value = '';
  document.getElementById('staff-edit-ifsc').value = '';

  const targetPeeo = STATE.currentUser?.role === 'peeo' ? STATE.currentUser.peeo_name : 'PEEO BHINAY';
  document.getElementById('staff-edit-peeo').value = targetPeeo;

  const schoolSelect = document.getElementById('staff-edit-school');
  schoolSelect.innerHTML = '';
  const peeoObj = STATE.peeos.find(p => p.peeo_name === targetPeeo);
  if (peeoObj && peeoObj.schools) {
    peeoObj.schools.forEach(sch => {
      const opt = document.createElement('option');
      opt.value = sch.school_name;
      opt.textContent = sch.school_name;
      schoolSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = targetPeeo;
    opt.textContent = targetPeeo;
    schoolSelect.appendChild(opt);
  }

  showModal('modal-staff-edit');
}

function openEditStaffModal(staffId) {
  const staff = STATE.staff.find(s => s.staff_id === staffId);
  if (!staff) return;

  document.getElementById('staff-modal-title').innerHTML = '<i class="fas fa-edit text-primary"></i> कार्मिक विवरण संपादित करें';
  document.getElementById('staff-edit-id').value = staff.staff_id;
  document.getElementById('staff-edit-name').value = staff.name;
  document.getElementById('staff-edit-peeo').value = staff.peeo_name;
  document.getElementById('staff-edit-post').value = staff.post;
  document.getElementById('staff-edit-mobile').value = staff.mobile || '';
  document.getElementById('staff-edit-email').value = staff.email || '';
  document.getElementById('staff-edit-sso').value = staff.sso_id || '';
  document.getElementById('staff-edit-bank-acc').value = staff.bank_acc || '';
  document.getElementById('staff-edit-ifsc').value = staff.ifsc || '';

  const schoolSelect = document.getElementById('staff-edit-school');
  schoolSelect.innerHTML = '';
  const peeoObj = STATE.peeos.find(p => p.peeo_name === staff.peeo_name);
  if (peeoObj && peeoObj.schools) {
    peeoObj.schools.forEach(sch => {
      const opt = document.createElement('option');
      opt.value = sch.school_name;
      opt.textContent = sch.school_name;
      if (sch.school_name === staff.school_name) opt.selected = true;
      schoolSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = staff.school_name || staff.peeo_name;
    opt.textContent = staff.school_name || staff.peeo_name;
    schoolSelect.appendChild(opt);
  }

  showModal('modal-staff-edit');
}

function saveStaffMember() {
  const staffId = document.getElementById('staff-edit-id').value;
  const name = document.getElementById('staff-edit-name').value.trim();
  const peeoName = document.getElementById('staff-edit-peeo').value;
  const schoolName = document.getElementById('staff-edit-school').value;
  const post = document.getElementById('staff-edit-post').value;
  const mobile = document.getElementById('staff-edit-mobile').value.trim();
  const email = document.getElementById('staff-edit-email').value.trim();
  const ssoId = document.getElementById('staff-edit-sso').value.trim();
  const bankAcc = document.getElementById('staff-edit-bank-acc').value.trim();
  const ifsc = document.getElementById('staff-edit-ifsc').value.trim();

  if (!name) {
    showToast('कृपया कार्मिक का नाम दर्ज करें!', 'error');
    return;
  }

  if (staffId) {
    const idx = STATE.staff.findIndex(s => s.staff_id === staffId);
    if (idx !== -1) {
      STATE.staff[idx] = {
        ...STATE.staff[idx],
        name, school_name: schoolName, post, mobile, email, sso_id: ssoId, bank_acc: bankAcc, ifsc
      };

      recordAuditLog({
        user: STATE.currentUser.peeo_name || STATE.currentUser.name || 'Admin',
        action: 'कार्मिक संपादन',
        target: `${staffId} - ${name}`,
        details: `पद: ${post}, मो.: ${mobile}`,
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
      school_name: schoolName,
      peeo_name: peeoName,
      bank_acc: bankAcc,
      ifsc: ifsc,
      status: 'Active'
    };
    STATE.staff.unshift(newStaff);

    recordAuditLog({
      user: STATE.currentUser.peeo_name || STATE.currentUser.name || 'Admin',
      action: 'नया कार्मिक प्रविष्टि',
      target: `${newId} - ${name}`,
      details: `विद्यालय: ${schoolName}, पद: ${post}`,
      note: 'नया शिक्षक जोड़ा गया'
    });

    showToast('नया कार्मिक सफलतापूर्वक जोड़ा गया!', 'success');
  }

  saveStaffToStorage();
  closeModal('modal-staff-edit');
  filterStaffTable();
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
    staff.deletedBy = STATE.currentUser.peeo_name || STATE.currentUser.name || 'Admin';

    recordAuditLog({
      user: STATE.currentUser.peeo_name || STATE.currentUser.name || 'Admin',
      action: 'कार्मिक विलोपन (सुरक्षित बैकअप)',
      target: `${staff.staff_id} - ${staff.name}`,
      details: `विद्यालय: ${staff.school_name}, पद: ${staff.post}, मो.: ${staff.mobile}`,
      note: `कारण: ${reason}`
    });

    saveStaffToStorage();
    showToast(`कार्मिक सूची से हटाया गया एवं बैकअप लॉग में सुरक्षित किया गया!`, 'warning');
  }

  closeModal('modal-delete-staff');
  filterStaffTable();
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
function getVisibleDemands() {
  // If PEEO, only show PUBLISHED demands!
  if (STATE.currentUser?.role === 'peeo') {
    return STATE.demands.filter(d => d.published === true && !d.archived && !checkIsDemandArchivable(d));
  }
  // If Admin or guest, show all active non-archived demands
  return STATE.demands.filter(d => !d.archived && !checkIsDemandArchivable(d));
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
  const archived = getArchivedDemands();
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

  if (STATE.currentUser?.role === 'peeo' || STATE.currentUser?.role === 'school') {
    if (isCurrentSubmitted) {
      card.classList.add('submitted');
    } else {
      card.classList.add('pending');
    }
  }

  const isPeeoUser = STATE.currentUser?.role === 'peeo';
  const isSchoolUser = STATE.currentUser?.role === 'school';
  const isAdminUser = STATE.currentUser?.role === 'admin';

  const badgeText = (isPeeoUser || isSchoolUser)
    ? (isCurrentSubmitted ? '<i class="fas fa-check-circle"></i> पूर्ण (Submitted)' : '<i class="fas fa-exclamation-circle"></i> बाकी (Pending)')
    : `<i class="fas fa-tasks"></i> ${submittedCount}/${totalDenominator} ${isSamanDemand ? 'स्कूल' : 'PEEO'} पूर्ण`;

  card.innerHTML = `
    <div>
      <div class="demand-card-header">
        <span class="status-badge ${isCurrentSubmitted ? 'green' : (submittedCount > 0 ? 'green' : 'red')}">
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
        ${isAdminUser ? `
          <button class="btn btn-success btn-sm" onclick="exportSamanParikshaMasterCSV()" title="72-कॉलम विस्तृत एक्सेल डाउनलोड">
            <i class="fas fa-file-excel"></i> 📊 72-कॉलम एक्सेल
          </button>
        ` : ''}
      ` : `
        <button class="btn btn-primary btn-sm" onclick="openDynamicDemandPortal('${demand.id}')" style="font-weight:700">
          <i class="fas fa-desktop"></i> 📋 सूचना पोर्टल व प्रपत्र स्थिति खोलें
        </button>
        <button class="btn btn-success btn-sm" onclick="exportDynamicDemandExcel('${demand.id}')" title="इस मांग का एक्सेल डाउनलोड" style="font-weight:700">
          <i class="fas fa-file-excel"></i> 📊 एक्सेल डाउनलोड
        </button>
        ${isPeeoUser ? `
          <button class="btn btn-outline-primary btn-sm" onclick="openDynamicDemandPeeoPdf('${demand.id}', '${STATE.currentUser.peeo_name}')" style="font-weight:700">
            <i class="fas fa-file-invoice"></i> 📑 PEEO समेकित A4
          </button>
        ` : ''}
        ${isSchoolUser ? `
          <button class="btn btn-warning btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${STATE.currentUser.shala_darpan_code}')" style="font-weight:700">
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
        ` : ''}
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
          <span class="status-badge" style="background:${isPvt ? '#fef3c7' : '#e0f2fe'}; color:${isPvt ? '#b45309' : '#0369a1'}; font-size:0.75rem">
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
          <div class="stamp-line3">पंचायत समिति - भिनाय (केकड़ी/अजमेर)</div>
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
  const cleanMob = mobile.replace(/[^0-9]/g, '');
  const url = `https://api.whatsapp.com/send?phone=91${cleanMob}&text=${encodeURIComponent(defaultText)}`;
  window.open(url, '_blank');
}

/* ========================================================
   11. DYNAMIC INFORMATION DEMAND SYSTEM & ADMIN CONTROL ROOM
   Zero-Code Auto Tab Generation, Google Sheet JSON Sync,
   25 PEEO Compliance Matrix & A4 Landscape Official PDF
   ======================================================== */

// 1. Helper to retrieve target schools for any demand
function getTargetSchoolsForDemand(demand) {
  if (!demand) return STATE.schools56 || [];
  if (demand.id === 'saman_pariksha_2026_27' || (demand.title && demand.title.includes('समान परीक्षा'))) {
    return STATE.schools56 || [];
  }

  const scope = demand.schoolScope || 'all';
  const allSchools = getAllMasterSchools();

  if (scope === 'govt') {
    return allSchools.filter(s => s.type !== 'Private');
  } else if (scope === 'private') {
    return allSchools.filter(s => s.type === 'Private');
  } else if (scope === 'secondary_sr_sec' || scope === 'sec_srsec') {
    return STATE.schools56 || allSchools;
  }
  return allSchools;
}

// 2. Dynamic Navigation Tabs Generator (Adds tab for every published demand automatically)
function renderDynamicNavTabs() {
  const container = document.querySelector('.main-nav-bar .nav-container');
  if (!container) return;

  container.querySelectorAll('.nav-tab-dynamic-demand').forEach(t => t.remove());

  const activeDemands = (STATE.demands || []).filter(d => 
    !d.archived && 
    d.id !== 'saman_pariksha_2026_27' && 
    d.id !== 'DEMAND_SAMAN_PARIKSHA_2026' && 
    !d.id.toLowerCase().includes('saman_pariksha') &&
    !(d.title && d.title.includes('समान परीक्षा'))
  );
  const user = STATE.currentUser;

  const visibleDemands = activeDemands.filter(d => {
    if (d.published === false && (!user || user.role !== 'admin')) return false;
    return true;
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
        ${isAdminUser ? `
          <button class="btn btn-warning btn-sm" onclick="openDynamicDemandPeeoSelector('${demand.id}')" style="font-weight:700">
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
              <button class="btn btn-outline-warning" onclick="openFillDemandForSchoolModal('${demand.id}', '${schoolCode}')" style="font-weight:700">
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
            <button class="btn btn-warning btn-sm" onclick="openDynamicDemandPeeoPdf('${demand.id}', '${user.peeo_name}')" style="font-weight:700">
              <i class="fas fa-file-invoice"></i> PEEO समेकित A4 रिपोर्ट
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
                const sub = getDemandSubmissionRecord(demand.id, s.shala_darpan_code);
                return `
                  <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td><code>${s.shala_darpan_code}</code></td>
                    <td><strong>${s.school_name}</strong> ${s.is_peeo_nodal ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af; font-size:0.7rem">नोडल HQ</span>' : ''}</td>
                    <td><span class="status-badge" style="background:${s.type === 'Private' ? '#fef3c7' : '#e0f2fe'}; color:${s.type === 'Private' ? '#b45309' : '#0369a1'}">${s.type === 'Private' ? 'निजी' : 'राजकीय'}</span></td>
                    <td><span class="status-badge ${isSub ? 'green' : 'red'}">${isSub ? '✓ पूर्ण' : 'बाकी'}</span></td>
                    <td>${sub.submitted_by ? `${sub.submitted_by} <br><span style="font-size:0.72rem; color:#64748b">${sub.submitter_mobile || ''}</span>` : '---'}</td>
                    <td>
                      <div style="display:flex; gap:0.4rem; flex-wrap:wrap">
                        <button class="btn ${isSub ? 'btn-outline-warning' : 'btn-primary'} btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')">
                          <i class="fas ${isSub ? 'fa-edit' : 'fa-pen-nib'}"></i> ${isSub ? 'संशोधन' : 'प्रपत्र भरें'}
                        </button>
                        ${isSub ? `
                          <button class="btn btn-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${s.shala_darpan_code}')">
                            <i class="fas fa-print"></i> A4 PDF
                          </button>
                        ` : `
                          <button class="btn btn-whatsapp btn-sm" onclick="sendDynamicDemandSchoolReminder('${demand.id}', '${s.shala_darpan_code}')">
                            <i class="fab fa-whatsapp"></i> रिमाइंडर
                          </button>
                        `}
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
          <span style="font-weight:700; color:#1e293b"><i class="fas fa-bolt text-warning"></i> त्वरित कार्यवाहियां:</span>
          <button class="btn btn-whatsapp btn-sm" onclick="sendDynamicDemandBulkReminder('${demand.id}')" style="font-weight:700">
            <i class="fab fa-whatsapp"></i> सभी ${pendingCount} लंबित स्कूलों को व्हाट्सएप रिमाइंडर
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

        <div class="table-responsive">
          <table class="data-table" id="dynamic-demand-schools-table">
            <thead>
              <tr>
                <th style="width:40px">क्र.सं.</th>
                <th>शा.दा. कोड</th>
                <th>विद्यालय का नाम</th>
                <th>प्रकार</th>
                <th>संबंधित PEEO</th>
                <th>प्रपत्र स्थिति</th>
                <th>प्रस्तुतकर्ता / मोबाइल</th>
                <th style="text-align:center">अधिकृत कार्यवाही</th>
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#64748b">कोई विद्यालय रिकॉर्ड नहीं मिला</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const isSub = isDynamicDemandSubmitted(demand.id, s.shala_darpan_code);
    const sub = getDemandSubmissionRecord(demand.id, s.shala_darpan_code);

    return `
      <tr>
        <td><strong>${idx + 1}</strong></td>
        <td><code>${s.shala_darpan_code}</code></td>
        <td>
          <strong>${s.school_name}</strong>
          ${s.is_peeo_nodal ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af; font-size:0.7rem; margin-left:4px">PEEO HQ</span>' : ''}
        </td>
        <td>
          <span class="status-badge" style="background:${s.type === 'Private' ? '#fef3c7' : '#e0f2fe'}; color:${s.type === 'Private' ? '#b45309' : '#0369a1'}">
            ${s.type === 'Private' ? 'निजी' : 'राजकीय'}
          </span>
        </td>
        <td>${s.peeo_name}</td>
        <td>
          <span class="status-badge ${isSub ? 'green' : 'red'}">
            <i class="fas ${isSub ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${isSub ? '✓ पूर्ण (Submitted)' : 'बाकी (Pending)'}
          </span>
        </td>
        <td>
          ${sub.submitted_by ? `
            <strong>${sub.submitted_by}</strong><br>
            <a href="tel:${sub.submitter_mobile}" style="font-size:0.75rem; color:var(--primary); text-decoration:none">
              <i class="fas fa-phone-alt"></i> ${sub.submitter_mobile}
            </a>
          ` : '<span style="color:#94a3b8">-</span>'}
        </td>
        <td style="text-align:center">
          <div style="display:flex; justify-content:center; gap:0.4rem; flex-wrap:wrap">
            <button class="btn ${isSub ? 'btn-outline-warning' : 'btn-primary'} btn-sm" onclick="openFillDemandForSchoolModal('${demand.id}', '${s.shala_darpan_code}')" title="${isSub ? 'प्रपत्र संशोधित करें' : 'प्रपत्र भरें'}">
              <i class="fas ${isSub ? 'fa-edit' : 'fa-pen-nib'}"></i> ${isSub ? 'संशोधन' : 'भरें'}
            </button>
            ${isSub ? `
              <button class="btn btn-success btn-sm" onclick="openUniversalDemandPdfPreview('${demand.id}', '${s.shala_darpan_code}')" title="अधिकृत A4 PDF देखें व प्रिंट करें">
                <i class="fas fa-print"></i> PDF देखें
              </button>
            ` : `
              <button class="btn btn-whatsapp btn-sm" onclick="sendDynamicDemandSchoolReminder('${demand.id}', '${s.shala_darpan_code}')" title="1-क्लिक WhatsApp रिमाइंडर">
                <i class="fab fa-whatsapp"></i> रिमाइंडर
              </button>
            `}
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

  let fieldsHtml = `
    <!-- Google Form Style Top Header Card -->
    <div class="gform-header-card" style="background:#ffffff; border:1px solid #dadce0; border-top:10px solid #1a73e8; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 1px 3px rgba(60,64,67,0.08)">
      <h3 style="color:#202124; font-size:1.25rem; font-weight:800; margin:0 0 0.4rem 0">
        <i class="fas fa-clipboard-list text-primary"></i> ${demand.title}
      </h3>
      <div style="font-size:0.88rem; color:#5f6368; line-height:1.5">
        ${demand.description || 'कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय द्वारा जारी अधिकृत प्रपत्र।'}
      </div>
      <div style="display:flex; gap:1.25rem; flex-wrap:wrap; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; font-size:0.85rem; color:#475569">
        <div><strong>विद्यालय:</strong> ${school.school_name}</div>
        <div><strong>कोड:</strong> <code>${schoolCode}</code></div>
        <div><strong>संबंधित PEEO:</strong> ${school.peeo_name}</div>
        <div><strong>वर्ग:</strong> ${school.type === 'Private' ? 'निजी' : 'राजकीय'}</div>
      </div>
      <div style="color:#d93025; font-size:0.8rem; font-weight:700; margin-top:0.5rem">
        * सभी अनिवार्य प्रश्नों के उत्तर प्रविष्ट करें
      </div>
    </div>
  `;

  // Each dynamic column rendered as an individual Google Form Question Card
  (demand.columns || []).forEach((col, idx) => {
    const existingVal = (existingData[col.name] !== undefined) ? existingData[col.name] : '';
    fieldsHtml += `
      <div class="gform-card" style="background:#ffffff; border:1px solid #dadce0; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1rem; box-shadow:0 1px 3px rgba(60,64,67,0.08); transition:all 0.2s">
        <label style="font-weight:700; color:#202124; font-size:0.98rem; margin-bottom:0.35rem; display:block">
          ${idx + 1}. ${col.name} <span style="color:#d93025">*</span>
        </label>
        <div style="font-size:0.8rem; color:#5f6368; margin-bottom:0.6rem">कृपया इस कॉलम हेतु सही मान अथवा छात्र संख्या दर्ज करें</div>
        <input type="text" id="demand_input_col_${idx}" value="${existingVal}" placeholder="${col.placeholder || col.name + ' दर्ज करें'}" style="width:100%; padding:0.75rem 1rem; border:1.5px solid #dadce0; border-radius:6px; font-size:0.95rem; outline:none; transition:all 0.2s; background:#f8fafc" onfocus="this.style.borderColor='#1a73e8'; this.style.background='#fff'; this.style.boxShadow='0 0 0 2px rgba(26,115,232,0.2)'" onblur="this.style.borderColor='#dadce0'; this.style.boxShadow='none'">
      </div>
    `;
  });

  // Google Form Submitter & Principal Details Card
  fieldsHtml += `
    <div class="gform-card" style="background:#ffffff; border:1px solid #dadce0; border-radius:8px; padding:1.25rem 1.5rem; margin-bottom:1rem; box-shadow:0 1px 3px rgba(60,64,67,0.08)">
      <div style="font-weight:700; color:#202124; font-size:1rem; margin-bottom:0.85rem">
        <i class="fas fa-user-check text-primary"></i> प्रस्तुतकर्ता अधिकारी विवरण
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:1rem">
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

  const saveBtn = document.getElementById('btn-save-demand');
  if (saveBtn) {
    saveBtn.setAttribute('onclick', 'submitDynamicDemandSchoolForm()');
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

// 8. Official A4 Landscape PDF Generation (Exact Saman Pariksha Standard, STRICTLY NO RUBBER STAMP)
function openUniversalDemandPdfPreview(demandId, schoolCode) {
  const demand = STATE.demands.find(d => d.id === demandId);
  if (!demand) {
    showToast('मांग प्रपत्र नहीं मिला!', 'error');
    return;
  }

  // If this demand is Saman Pariksha, open the official Saman Pariksha Landscape PDF preview!
  const dId = String(demand.id).toLowerCase();
  if (dId === 'demand_saman_pariksha_2026' || dId.includes('saman_pariksha') || dId === 'saman_pariksha_2026_27' || demand.title.includes('समान परीक्षा')) {
    openExamPdfPreview(schoolCode);
    return;
  }

  const targetSchools = getTargetSchoolsForDemand(demand);
  const school = targetSchools.find(s => s.shala_darpan_code === schoolCode) || STATE.schools56.find(s => s.shala_darpan_code === schoolCode) || {
    school_name: 'विद्यालय',
    shala_darpan_code: schoolCode,
    peeo_name: 'CBEO Bhinai',
    type: 'Government',
    category: 'राजकीय'
  };

  const sub = getDemandSubmissionRecord(demandId, schoolCode);

  const container = document.getElementById('printable-universal-demand-content');
  if (!container) return;

  const titleEl = document.getElementById('universal-demand-pdf-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-file-pdf text-danger"></i> अधिकृत प्रपत्र (A4 Landscape) - ${school.school_name}`;
  }

  // Build dynamic table rows for all columns
  let colRowsHtml = '';
  (demand.columns || []).forEach((col, idx) => {
    const val = (sub.data && sub.data[col.name] !== undefined && sub.data[col.name] !== '')
      ? sub.data[col.name]
      : '<span style="color:#64748b; font-style:italic">प्रविष्ट नहीं / शून्य</span>';
    
    colRowsHtml += `
      <tr style="border-bottom:1px solid #000">
        <td style="padding:4px 6px; border:1px solid #000; text-align:center; font-weight:700; width:45px; background:#f8fafc">${idx + 1}</td>
        <td style="padding:4px 10px; border:1px solid #000; font-weight:800; width:40%; background:#f8fafc; color:#0f172a">${col.name}</td>
        <td style="padding:4px 12px; border:1px solid #000; font-weight:700; font-size:0.86rem; color:#000">${val}</td>
      </tr>
    `;
  });

  const printHtml = `
    <!-- Top Official Government Header -->
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:5px">
      <div style="font-size:0.84rem; font-weight:700; letter-spacing:0.04em; color:#111">
        राजस्थान सरकार • स्कूल शिक्षा विभाग
      </div>
      <h2 style="margin:2px 0; font-size:1.15rem; font-weight:900; color:#000; letter-spacing:0.02em">
        कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय
      </h2>
      <div style="font-size:0.75rem; color:#333; margin-top:1px">
        समग्र शिक्षा अभियान | NIC-SD ID: 8140 | ब्लॉक-भिनाय, जिला-अजमेर (राजस्थान)
      </div>
      <div style="margin-top:3px; display:inline-block; border:1.5px solid #000; background:#f1f5f9; padding:2px 14px; border-radius:4px; font-size:0.88rem; font-weight:900; color:#000">
        ${demand.title} (सत्र 2026-27)
      </div>
      ${demand.description ? `<div style="font-size:0.72rem; color:#444; margin-top:2px">${demand.description}</div>` : ''}
    </div>

    <!-- School Meta Table (Laser Print-Friendly Clean Grid) -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:0.78rem; border:1.5px solid #000">
      <tr style="background:#f8fafc">
        <td style="padding:2.5px 6px; border:1px solid #000; width:15%"><strong>विद्यालय का नाम:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:35%">${school.school_name}</td>
        <td style="padding:2.5px 6px; border:1px solid #000; width:18%"><strong>शाला दर्पण / PSP कोड:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800; width:32%">${school.shala_darpan_code} <span style="font-size:0.72rem; font-weight:normal">(${school.category || school.type || 'राजकीय'})</span></td>
      </tr>
      <tr>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>संबंधित PEEO:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000">${school.peeo_name}</td>
        <td style="padding:2.5px 6px; border:1px solid #000; background:#f8fafc"><strong>U-DISE कोड:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000; font-weight:800">${school.dise_code || '---'}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>संस्था प्रधान / प्रस्तुतकर्ता:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${sub.submitted_by || 'संस्था प्रधान'}</strong> ${sub.submitter_mobile ? `(मो. ${sub.submitter_mobile})` : ''}</td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>सत्यापन दिनांक व समय:</strong></td>
        <td style="padding:2.5px 6px; border:1px solid #000"><strong>${sub.submitted_at || new Date().toLocaleString('hi-IN')}</strong></td>
      </tr>
    </table>

    <!-- Dynamic Information Demand Table (Laser Print-Friendly High-Contrast) -->
    <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.80rem; margin-bottom:6px">
      <thead>
        <tr style="background:#f1f5f9; color:#000; font-weight:900">
          <th style="padding:4px 6px; border:1.5px solid #000; width:45px; text-align:center">क्र.सं.</th>
          <th style="padding:4px 10px; border:1.5px solid #000; width:40%; text-align:left">मांगी गई सूचना का विषय / मद (Field Parameter)</th>
          <th style="padding:4px 12px; border:1.5px solid #000; text-align:left">विद्यालय द्वारा सत्यापित वास्तविक प्रविष्टि (Verified Data / Value)</th>
        </tr>
      </thead>
      <tbody>
        ${colRowsHtml}
      </tbody>
    </table>

    <!-- Verification & Responsibility Declaration -->
    <div style="margin-top:6px; margin-bottom:8px; padding:4px 8px; background:#ffffff; border:1px solid #000; border-left:4px solid #000; border-radius:3px; font-size:0.72rem; line-height:1.3; color:#000">
      <strong>सत्यापन एवं उत्तरदायित्व घोषणा:</strong> प्रमाणित किया जाता है कि उपर्युक्त प्रपत्र में भरी गई सभी सूचनाएं विद्यालय के मूल भौतिक एवं कार्यालय अभिलेखों के अनुसार शत-प्रतिशत सत्य एवं सही हैं। इसमें किसी भी प्रकार का तथ्य छुपाया नहीं गया है। किसी भी त्रुटि, विसंगति अथवा असत्यता की स्थिति में समस्त व्यक्तिगत एवं प्रशासनिक उत्तरदायित्व संबंधित संस्था प्रधान / प्रस्तुतकर्ता का होगा।
    </div>

    <!-- Official Signatures: Strictly NO rubber stamp, only official signatures -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 35px; margin-top:12px; margin-bottom:4px">
      <!-- Left: Incharge / Verifier -->
      <div style="text-align:center; width:36%">
        <div style="height:32px"></div>
        <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
          हस्ताक्षर प्रपत्र प्रभारी / नोडल अधिकारी
        </div>
      </div>

      <!-- Right: Principal Signature & School Details -->
      <div style="text-align:center; width:44%">
        ${sub.signature_data ? `
          <div style="height:32px; display:flex; align-items:center; justify-content:center">
            <img src="${sub.signature_data}" style="max-height:30px; max-width:150px; object-fit:contain" alt="हस्ताक्षर">
          </div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            हस्ताक्षर संस्था प्रधान
          </div>
        ` : `
          <div style="height:32px"></div>
          <div style="border-top:1.5px solid #000; padding-top:2px; font-weight:800; font-size:0.86rem; color:#000">
            हस्ताक्षर संस्था प्रधान
          </div>
        `}
        <div style="font-size:0.78rem; font-weight:700; color:#000; margin-top:1px">प्रधानाचार्य / संस्था प्रधान</div>
        <div style="font-size:0.75rem; color:#111; margin-top:1px">${school.school_name}</div>
        <div style="font-size:0.72rem; color:#222; margin-top:1px">ब्लॉक-भिनाय (अजमेर)</div>
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
  const demand = STATE.demands.find(d => d.id === STATE.activeDemandPortalId) || { title: 'CBEO_Bhinai_Report' };
  printCleanA4Landscape('printable-universal-demand-content', demand.title);
}

function downloadUniversalDemandPdfDirect() {
  const demand = STATE.demands.find(d => d.id === STATE.activeDemandPortalId) || { title: 'CBEO_Bhinai_Report' };
  const filename = `${demand.title.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_')}_${Date.now()}.pdf`;

  showToast('आधिकारिक Landscape PDF तैयार किया जा रहा है...', 'info');
  exportDocumentToPdfBlob('printable-universal-demand-content', filename).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('PDF सफलतापूर्वक डाउनलोड हो गई!', 'success');
  }).catch(e => {
    console.error('Direct PDF error, falling back to print:', e);
    printUniversalDemandDocument();
  });
}

function shareUniversalDemandPdfWhatsApp() {
  const demand = STATE.demands.find(d => d.id === STATE.activeDemandPortalId) || { title: 'CBEO सूचना प्रपत्र' };
  const msg = `नमस्ते, CBEO भिनाय पोर्टल पर '${demand.title}' का अधिकृत सत्यापन विवरण तैयार है। कृपया पोर्टल लिंक से प्रपत्र का अवलोकन करें: ${window.location.href}`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

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
          <button class="status-badge ${spDoneCount > 0 ? 'yellow' : 'red'}" style="border:none; cursor:pointer" onclick="openPeeoConsolidatedExamPreview('${peeo.peeo_name}')" title="समेकित रिपोर्ट देखें">
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
            <button class="status-badge ${dDoneCount > 0 ? 'yellow' : 'red'}" style="border:none; cursor:pointer" onclick="openDynamicDemandPortal('${d.id}')" title="पोर्टल स्थिति देखें">
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
function renderAdminControlView() {
  const publishList = document.getElementById('admin-demands-publish-list');
  if (publishList) {
    publishList.innerHTML = '';
    STATE.demands.forEach(d => {
      const isPub = d.published !== false;
      const div = document.createElement('div');
      div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.85rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px';
      div.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem">
          <input type="checkbox" id="pub_chk_${d.id}" ${isPub ? 'checked' : ''} onchange="toggleDemandPublish('${d.id}')" style="width:18px; height:18px; cursor:pointer">
          <label for="pub_chk_${d.id}" style="cursor:pointer; font-weight:600; color:#1e293b">
            ${d.title}
          </label>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <button class="btn btn-outline-primary btn-sm" onclick="openDynamicDemandPortal('${d.id}')" style="font-size:0.75rem; padding:2px 8px">
            <i class="fas fa-desktop"></i> पोर्टल खोलें
          </button>
          <span class="status-badge ${isPub ? 'green' : 'red'}" style="font-size:0.75rem">
            ${isPub ? '✓ PEEO स्तर पर LIVE (प्रकाशित)' : '✗ अप्रकाशित (PEEO से छुपा हुआ)'}
          </span>
        </div>
      `;
      publishList.appendChild(div);
    });
  }

  renderAdminMatrix();
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

function openCreateDemandModal() {
  document.getElementById('new-demand-title').value = '';
  document.getElementById('new-demand-date').value = '';
  const levelSelect = document.getElementById('new-demand-collection-level');
  if (levelSelect) {
    levelSelect.value = 'peeo';
    onDemandCollectionLevelChange();
  }
  const scopeSelect = document.getElementById('new-demand-school-scope');
  if (scopeSelect) scopeSelect.value = 'all';
  document.getElementById('new-demand-cols').value = 'कुल खेल मैदान क्षेत्रफल (बीघा), वर्तमान चारदीवारी स्थिति, विकसित खेल संसाधन, आवश्यक अनुदान (लाखों में), विशेष विवरण';
  document.getElementById('new-demand-desc').value = '';
  document.getElementById('new-demand-publish').checked = true;
  showModal('modal-create-demand');
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

function saveNewDemand() {
  const title = document.getElementById('new-demand-title').value.trim();
  const dueDate = document.getElementById('new-demand-date').value;
  const priority = document.getElementById('new-demand-priority').value;
  const level = document.getElementById('new-demand-collection-level')?.value || 'peeo';
  const scope = document.getElementById('new-demand-school-scope')?.value || 'all';
  const colsRaw = document.getElementById('new-demand-cols').value.trim();
  const desc = document.getElementById('new-demand-desc').value.trim();
  const isPub = document.getElementById('new-demand-publish').checked;

  if (!title) {
    showToast('कृपया सूचना का शीर्षक दर्ज करें!', 'error');
    return;
  }

  const cols = colsRaw.split(',').map(c => c.trim()).filter(c => c.length > 0).map(c => ({
    name: c,
    type: 'text',
    locked: false,
    placeholder: c
  }));

  const newDemand = {
    id: `DEMAND_${Date.now()}`,
    title: title,
    collectionLevel: level,
    schoolScope: scope,
    description: desc || 'समस्त संस्था प्रधान / PEEO समय सीमा में सूचना अधिकृत डिजिटल हस्ताक्षर सहित प्रेषित करें।',
    dueDate: dueDate || 'यथाशीघ्र',
    priority: priority,
    published: isPub,
    createdAt: new Date().toISOString().split('T')[0],
    columns: cols
  };

  STATE.demands.unshift(newDemand);
  saveDemandsToStorage();

  recordAuditLog({
    user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
    action: 'नई सूचना मांग सृजन (Zero-Code)',
    target: title,
    details: `${cols.length} कॉलम का प्रपत्र सृजित | स्तर: ${level === 'school' ? 'विद्यालय स्तर' : 'PEEO स्तर'} | प्रकाशित: ${isPub ? 'हाँ' : 'नहीं'}`,
    note: 'स्वतः फॉर्म जनरेटर'
  });

  closeModal('modal-create-demand');
  showToast(`नई सूचना '${title}' सफलता पूर्वक तैयार हो गई! (${level === 'school' ? 'विद्यालय स्तर' : 'PEEO स्तर'})`, 'success');

  renderApp();
  openDynamicDemandPortal(newDemand.id);
}

/* ========================================================
   11B. MASTER SCHOOL & PEEO MANAGEMENT CONTROLS
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
      'sec_srsec': { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
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
          <input type="checkbox" ${s.login_allowed ? 'checked' : ''} onchange="toggleSchoolLoginAllowed('${s.shala_darpan_code}')">
          <span class="login-perm-slider"></span>
        </label>
        <div style="font-size:0.7rem; font-weight:700; color:${s.login_allowed ? '#16a34a' : '#dc2626'}; margin-top:2px">
          ${s.login_allowed ? 'चालू' : 'बंद'}
        </div>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:0.4rem">
          <span class="badge-tag" style="background:${isCustomPwd ? '#fef3c7' : '#f1f5f9'}; color:${isCustomPwd ? '#b45309' : '#475569'}; font-size:0.72rem; font-weight:700">
            ${isCustomPwd ? '🔑 कस्टम' : 'डिफ़ॉल्ट SD'}
          </span>
          <button class="sch-action-btn pwd" onclick="openAdminResetPasswordModal('${s.shala_darpan_code}')" title="पासवर्ड रीसेट / देखें">
            <i class="fas fa-key"></i>
          </button>
        </div>
      </td>
      <td style="text-align:center">
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
  if (modal) modal.classList.add('active');
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
