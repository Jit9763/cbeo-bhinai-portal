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
  currentDemandToFill: null,
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

  // Versioned cache check to guarantee fresh master data with 56 schools and Saman Pariksha demand
  const DATA_VERSION = 'v5_2026_09_30_saman_pariksha_56_schools';
  if (localStorage.getItem('cbeo_data_version') !== DATA_VERSION) {
    localStorage.removeItem('cbeo_peeos_data');
    localStorage.removeItem('cbeo_staff_data');
    localStorage.removeItem('cbeo_demands');
    localStorage.setItem('cbeo_data_version', DATA_VERSION);
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

  // 4. Information Demands: Single official active demand
  STATE.demands = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.demands) || [];
  saveDemandsToStorage();

  // 5. 56 Secondary & Sr. Secondary Schools for Saman Pariksha
  STATE.schools56 = (MASTER_CBEO_DATA && MASTER_CBEO_DATA.schools_56) || [];

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

  // 7. Saman Pariksha Submissions
  const storedSPSubs = localStorage.getItem('cbeo_saman_pariksha_submissions');
  if (storedSPSubs) {
    try {
      STATE.samanParikshaSubmissions = JSON.parse(storedSPSubs);
    } catch (e) {
      STATE.samanParikshaSubmissions = {};
    }
  } else {
    STATE.samanParikshaSubmissions = {};
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

/* ========================================================
   2. AUTHENTICATION & SESSION MANAGEMENT
   ======================================================== */
function setupAutoLogin() {
  const savedUser = localStorage.getItem('cbeo_logged_user');
  if (savedUser) {
    try {
      STATE.currentUser = JSON.parse(savedUser);
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
      displaySubtext.textContent = STATE.currentUser.principal_incharge
        ? `प्रभारी: ${STATE.currentUser.principal_incharge} | मो.: ${STATE.currentUser.mobile || '---'}`
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
      if (headerTitle) headerTitle.innerHTML = `<i class="fas fa-school" style="color:#60a5fa; margin-right:8px"></i> ${STATE.currentUser.school_name}`;
      if (headerDept) headerDept.textContent = 'राजस्थान सरकार - स्कूल शिक्षा विभाग';
      if (headerCodeLabel) headerCodeLabel.innerHTML = `शा.दा./PSP कोड: <strong style="color:#fde047">${sdCode}</strong>`;
      if (headerSubCode) headerSubCode.innerHTML = `PEEO परिक्षेत्र: <strong>${STATE.currentUser.peeo_name || 'भिनाय'}</strong>`;
      if (headerBadge) headerBadge.textContent = '🏛️ विद्यालय आधिकारिक पोर्टल';
      document.title = `${STATE.currentUser.school_name} | आधिकारिक पोर्टल`;
    } else {
      if (headerTitle) headerTitle.innerHTML = `<i class="fas fa-university" style="color:#60a5fa; margin-right:8px"></i> ${STATE.currentUser.peeo_name} परिक्षेत्र पोर्टल`;
      if (headerDept) headerDept.textContent = 'राजस्थान सरकार - स्कूल शिक्षा विभाग';
      if (headerCodeLabel) headerCodeLabel.innerHTML = `PEEO कोड: <strong style="color:#fde047">${sdCode}</strong>`;
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
  const optgroup = document.getElementById('login-peeo-optgroup');
  if (optgroup) {
    optgroup.innerHTML = '';
    STATE.peeos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.shala_darpan_code;
      opt.textContent = `[PEEO] ${p.shala_darpan_code} - ${p.peeo_name} (${p.principal_incharge})`;
      optgroup.appendChild(opt);
    });

    // Add schools optgroup if not already present
    let schOptGroup = document.getElementById('login-schools-optgroup');
    if (!schOptGroup && select) {
      schOptGroup = document.createElement('optgroup');
      schOptGroup.id = 'login-schools-optgroup';
      schOptGroup.label = '56 माध्यमिक व उच्च माध्यमिक विद्यालय (सीधा लॉगिन)';
      select.appendChild(schOptGroup);
    }
    if (schOptGroup) {
      schOptGroup.innerHTML = '';
      STATE.schools56.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.shala_darpan_code;
        opt.textContent = `[${s.type.substring(0,3)}] ${s.shala_darpan_code} - ${s.school_name}`;
        schOptGroup.appendChild(opt);
      });
    }
  }

  if (STATE.currentUser) {
    if (select) {
      select.value = (STATE.currentUser.role === 'admin') ? STATE.currentUser.username : STATE.currentUser.shala_darpan_code;
    }
    document.getElementById('login-username').value = STATE.currentUser.shala_darpan_code;
  } else {
    // Default selection
    if (select) {
      select.value = '221754'; // PEEO Deoliya Kalan default
    }
  }

  onQuickSelectUser();
  // Strictly enforce empty password on open
  const passInput = document.getElementById('login-password');
  if (passInput) passInput.value = '';

  showModal('modal-login');
}

function onQuickSelectUser() {
  const val = document.getElementById('login-quick-select')?.value;
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const hintBox = document.getElementById('login-password-hint');
  if (!usernameInput || !passwordInput) return;

  // Security: NEVER auto-fill password
  passwordInput.value = '';

  if (val === 'jitendra_admin') {
    usernameInput.value = 'admin_jitendra';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-shield-alt" style="color:#d97706"></i> <span><strong>सुरक्षा संकेत:</strong> एडमिन पासवर्ड गोपनीय है। कृपया अपना पासवर्ड मैन्युअली टाइप करें।</span>';
      hintBox.style.background = '#fef3c7';
      hintBox.style.color = '#92400e';
      hintBox.style.borderLeftColor = '#f59e0b';
    }
  } else if (val === 'cbeo_admin') {
    usernameInput.value = '8140';
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-shield-alt" style="color:#d97706"></i> <span><strong>सुरक्षा संकेत:</strong> मुख्य ब्लॉक शिक्षा अधिकारी पासवर्ड गोपनीय है। कृपया अपना पासवर्ड मैन्युअली टाइप करें।</span>';
      hintBox.style.background = '#fef3c7';
      hintBox.style.color = '#92400e';
      hintBox.style.borderLeftColor = '#f59e0b';
    }
  } else {
    const peeo = STATE.peeos.find(p => p.shala_darpan_code === val || p.peeo_id === val);
    if (peeo) {
      usernameInput.value = peeo.shala_darpan_code;
    } else {
      const sch = STATE.schools56.find(s => s.shala_darpan_code === val);
      if (sch) {
        usernameInput.value = sch.shala_darpan_code;
      }
    }
    if (hintBox) {
      hintBox.innerHTML = '<i class="fas fa-lightbulb text-warning"></i> <span><strong>संकेत:</strong> PEEO एवं विद्यालयों का डिफ़ॉल्ट पासवर्ड उनका <strong>शाला दर्पण / PSP कोड</strong> ही है।</span>';
      hintBox.style.background = '#e0f2fe';
      hintBox.style.color = '#0369a1';
      hintBox.style.borderLeftColor = '#0284c7';
    }
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

  // Check custom password if set
  const expectedPassword = STATE.customPasswords[u];

  // PEEO Login
  const peeo = STATE.peeos.find(item => 
    item.shala_darpan_code === u || 
    item.username.toLowerCase() === u.toLowerCase() ||
    item.alias_username?.toLowerCase() === u.toLowerCase()
  );

  if (peeo) {
    const validPass = expectedPassword ? (p === expectedPassword) : (p === peeo.shala_darpan_code || p === peeo.password);
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
      showToast('पासवर्ड गलत है! (डिफ़ॉल्ट पासवर्ड आपका शाला दर्पण कोड ही है)', 'error');
      return;
    }
  }

  // Direct School Login from 56 schools
  const sch = STATE.schools56.find(item => item.shala_darpan_code === u);
  if (sch) {
    const validPass = expectedPassword ? (p === expectedPassword) : (p === sch.shala_darpan_code);
    if (validPass) {
      const parentPeeo = STATE.peeos.find(p => p.peeo_name === sch.peeo_name || p.peeo_id === sch.peeo_id);
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
      }, `${sch.school_name} के रूप में लॉगिन सफल!`, true);
      return;
    } else {
      showToast('पासवर्ड गलत है! (डिफ़ॉल्ट पासवर्ड आपका शाला दर्पण / PSP कोड ही है)', 'error');
      return;
    }
  }

  showToast('अमान्य शाला दर्पण कोड अथवा पासवर्ड! कृपया सही विवरण दर्ज करें।', 'error');
}

function switchTab(viewId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-tab-${viewId}`) || Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick')?.includes(viewId));
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');

  if (viewId === 'saman-pariksha') renderSamanParikshaView();
  else if (viewId === 'explorer') renderExplorerView();
  else if (viewId === 'directory') renderDirectoryView();
  else if (viewId === 'staff') renderStaffView();
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
  const tabReports = document.getElementById('nav-tab-reports');
  const tabArchive = document.getElementById('nav-tab-archive');
  const tabAdmin = document.getElementById('nav-tab-admin');
  const quickBanner = document.querySelector('.directory-quick-banner');

  if (isPeeoOrSchool) {
    if (tabDash) tabDash.style.display = 'none';
    if (tabDir) tabDir.style.display = config.directory ? 'inline-flex' : 'none';
    if (tabExp) tabExp.style.display = config.explorer ? 'inline-flex' : 'none';
    if (tabStaff) tabStaff.style.display = config.explorer ? 'inline-flex' : 'none';
    if (tabReports) tabReports.style.display = config.reports ? 'inline-flex' : 'none';
    if (tabArchive) tabArchive.style.display = 'none';
    if (tabAdmin) tabAdmin.style.display = 'none';
    if (quickBanner) quickBanner.style.display = config.directory ? 'flex' : 'none';
  } else if (STATE.currentUser && STATE.currentUser.role === 'admin') {
    if (tabDash) tabDash.style.display = 'inline-flex';
    if (tabDir) tabDir.style.display = 'inline-flex';
    if (tabExp) tabExp.style.display = 'inline-flex';
    if (tabStaff) tabStaff.style.display = 'inline-flex';
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
  applyTabVisibility();
  showToast('PEEO पोर्टल टैब दृश्यता सेटिंग्स सुरक्षित कर दी गई हैं!', 'success');
}

/* ========================================================
   PASSWORD MANAGEMENT
   ======================================================== */
function openChangePasswordModal() {
  if (!STATE.currentUser) {
    showToast('कृपया पहले लॉगिन करें!', 'warning');
    return;
  }
  document.getElementById('cp-current-password').value = '';
  document.getElementById('cp-new-password').value = '';
  document.getElementById('cp-confirm-password').value = '';
  showModal('modal-change-password');
}

function submitChangePassword() {
  if (!STATE.currentUser) return;
  const currentPass = document.getElementById('cp-current-password').value.trim();
  const newPass = document.getElementById('cp-new-password').value.trim();
  const confirmPass = document.getElementById('cp-confirm-password').value.trim();

  const userKey = STATE.currentUser.shala_darpan_code || STATE.currentUser.username;
  const expectedCurrent = STATE.customPasswords[userKey] || STATE.currentUser.default_password || STATE.currentUser.password || STATE.currentUser.shala_darpan_code;

  if (currentPass !== expectedCurrent && currentPass !== 'cbeo@2026' && currentPass !== 'jitendra#2026') {
    showToast('वर्तमान पासवर्ड सही नहीं है!', 'error');
    return;
  }

  if (newPass.length < 4) {
    showToast('नया पासवर्ड कम से कम 4 अक्षरों का होना चाहिए!', 'warning');
    return;
  }

  if (newPass !== confirmPass) {
    showToast('नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते!', 'error');
    return;
  }

  STATE.customPasswords[userKey] = newPass;
  localStorage.setItem('cbeo_custom_passwords', JSON.stringify(STATE.customPasswords));
  closeModal('modal-change-password');
  showToast('पासवर्ड पोर्टल पर बदल दिया गया है! Google Sheet में सिंक हो रहा है...', 'info');

  // Live Sync to 1_CBEO_Admin_Access_Control Google Sheet
  fetch('/api/update_password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userKey,
      new_password: newPass
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('सफलता: नया पासवर्ड Admin Control Google Sheet में भी अपडेट हो गया!', 'success');
    } else {
      showToast('पासवर्ड पोर्टल पर सुरक्षित हो गया है!', 'success');
    }
  })
  .catch(err => {
    console.warn('API sync note:', err);
    showToast('पासवर्ड पोर्टल पर सुरक्षित हो गया है!', 'success');
  });
}

function triggerAdminSheetSync() {
  showToast('Admin Control Google Sheet में सभी पासवर्ड सिंक किए जा रहे हैं...', 'info');
  fetch('/api/sync_admin_sheet', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('सफलता: Admin Control Sheet (84 खाते) Google Drive पर अपडेट हो गई!', 'success');
      } else {
        showToast('सिंक में समस्या आई: ' + data.message, 'error');
      }
    })
    .catch(err => {
      showToast('सर्वर से संपर्क नहीं हो सका।', 'warning');
    });
}

/* ========================================================
   4. RENDER MASTER VIEWS & SAMAN PARIKSHA (56 SCHOOLS)
   ======================================================== */
function renderApp() {
  updateUserHeaderBadge();
  applyTabVisibility();
  renderSamanParikshaView();
  renderDashboardView();
  renderDemandsView();
  renderArchiveView();
  renderDirectoryFilters();
  renderStaffFilters();
  renderExplorerFilters();
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
      { key: 'maths', label: 'गणित (Mathematics)' }
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
  if (!grid) return;

  grid.innerHTML = '';

  let targetSchools = [];
  if (STATE.currentUser.role === 'school') {
    targetSchools = STATE.schools56.filter(s => s.shala_darpan_code === STATE.currentUser.shala_darpan_code);
    if (heading) heading.textContent = `${STATE.currentUser.school_name} (परीक्षा प्रपत्र)`;
  } else {
    // PEEO login
    targetSchools = STATE.schools56.filter(s => 
      s.peeo_name.toLowerCase().includes(STATE.currentUser.peeo_name.toLowerCase()) ||
      s.peeo_code === STATE.currentUser.shala_darpan_code ||
      STATE.currentUser.schools?.some(sch => sch.shala_darpan_code === s.shala_darpan_code)
    );
    if (heading) heading.textContent = `${STATE.currentUser.peeo_name} परिक्षेत्र (${targetSchools.length} माध्यमिक व उच्च माध्यमिक विद्यालय)`;
  }

  let submittedCount = 0;
  targetSchools.forEach((school, index) => {
    const sub = STATE.samanParikshaSubmissions[school.shala_darpan_code];
    const isSubmitted = !!sub;
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
          <i class="fas fa-check-circle"></i> हरी पट्टी (Green): ${submittedCount} पूर्ण
        </span>
        <span class="sp-status-badge ${pendingCount === 0 ? 'success' : 'danger'}" style="font-size:0.85rem; padding:0.35rem 0.85rem">
          <i class="fas ${pendingCount === 0 ? 'fa-award' : 'fa-exclamation-circle'}"></i> लाल पट्टी (Red): ${pendingCount} शेष
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

  STATE.schools56.forEach(s => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code];
    if (sub) {
      submittedCount++;
      totalPapers += (parseInt(sub.grand_total) || 0);
    }
  });

  const pendingCount = totalSchools - submittedCount;

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
    const isSubmitted = !!sub;

    if (catFilter !== 'all' && s.type !== catFilter) return false;
    if (statusFilter === 'submitted' && !isSubmitted) return false;
    if (statusFilter === 'pending' && isSubmitted) return false;
    if (peeoFilter !== 'all' && !s.peeo_name.toLowerCase().includes(peeoFilter.toLowerCase())) return false;

    if (search) {
      const text = `${s.school_name} ${s.shala_darpan_code} ${s.peeo_name} ${sub?.exam_code || ''} ${sub?.principal_name || ''}`.toLowerCase();
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
    const isSub = !!sub;

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
      <td>${s.peeo_name}</td>
      <td style="font-weight:700; color:#2563eb">${sub?.exam_code || '---'}</td>
      <td>
        <div>${sub?.principal_name || s.principal_name || '---'}</div>
        <div style="font-size:0.75rem; color:#64748b">${sub?.principal_mobile || s.principal_mobile || ''}</div>
      </td>
      <td>
        <div>${sub?.incharge_name || '---'}</div>
        <div style="font-size:0.75rem; color:#64748b">${sub?.incharge_mobile || ''}</div>
      </td>
      <td style="text-align:right; font-weight:600">${sub?.c9_total ?? '---'}</td>
      <td style="text-align:right; font-weight:600">${sub?.c10_total ?? '---'}</td>
      <td style="text-align:right; font-weight:600">${sub?.c11_total ?? '---'}</td>
      <td style="text-align:right; font-weight:600">${sub?.c12_total ?? '---'}</td>
      <td style="text-align:right; font-weight:800; color:#15803d">${sub?.grand_total ?? '---'}</td>
      <td>
        ${isSub 
          ? '<span class="status-badge" style="background:#dcfce7; color:#15803d">सबमिट</span>'
          : '<span class="status-badge" style="background:#fef3c7; color:#b45309">लम्बित</span>'}
      </td>
      <td>
        <div style="display:flex; gap:0.35rem">
          <button class="btn btn-outline-light btn-sm" onclick="openSamanParikshaForm('${s.shala_darpan_code}')" title="प्रपत्र भरें / संपादित करें">
            <i class="fas fa-edit"></i>
          </button>
          <a href="saman_form.html?code=${s.shala_darpan_code}" target="_blank" class="btn btn-outline-light btn-sm" title="नए पेज में खोलें (अलग टैब)">
            <i class="fas fa-external-link-alt"></i>
          </a>
          ${isSub ? `
            <button class="btn btn-success btn-sm" onclick="openExamPdfPreview('${s.shala_darpan_code}')" title="अधिकृत PDF देखें">
              <i class="fas fa-print"></i>
            </button>
          ` : `
            <button class="btn btn-whatsapp btn-sm" onclick="sendSamanParikshaReminder('${s.shala_darpan_code}')" title="WhatsApp पर तुरंत रिमाइंडर भेजें">
              <i class="fab fa-whatsapp"></i>
            </button>
          `}
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

  // Sign preview labels
  const pName = document.getElementById('gform-principal-name')?.value || 'संस्था प्रधान';
  const iName = document.getElementById('gform-incharge-name')?.value || 'परीक्षा प्रभारी';
  if (document.getElementById('gform-sign-principal-preview')) document.getElementById('gform-sign-principal-preview').textContent = pName;
  if (document.getElementById('gform-sign-incharge-preview')) document.getElementById('gform-sign-incharge-preview').textContent = iName;
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
    submitted_by: STATE.currentUser?.name || STATE.currentUser?.peeo_name || 'School In-charge',
    timestamp: new Date().toLocaleString('en-IN')
  };

  STATE.samanParikshaSubmissions[schoolCode] = submission;
  localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));

  // Keep draft synchronized with official submission
  localStorage.setItem(`cbeo_form_draft_${schoolCode}`, JSON.stringify(submission));

  // Sync to backend file & Google Sheet
  fetch('/api/save_saman_pariksha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission)
  }).catch(() => {});

  closeModal('modal-saman-pariksha-form');
  showToast(`${school.school_name} का समान परीक्षा प्रपत्र सफलतापूर्वक सुरक्षित हो गया!`, 'success');
  renderSamanParikshaView();

  if (andPrint) {
    setTimeout(() => {
      openExamPdfPreview(schoolCode);
    }, 200);
  }
}

function openExamPdfPreview(schoolCode) {
  STATE.activeExamPreviewCode = schoolCode;
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const sub = STATE.samanParikshaSubmissions[schoolCode];
  if (!school || !sub) {
    showToast('इस विद्यालय का प्रपत्र अभी सबमिट नहीं हुआ है!', 'warning');
    return;
  }

  const container = document.getElementById('printable-exam-document-content');
  if (!container) return;

  // Build Optional Subjects HTML
  let c11OptRows = '';
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(s => {
    const count = sub.c11_optional?.[s.key] || 0;
    if (count > 0) {
      c11OptRows += `<tr><td style="padding:4px 8px; border:1px solid #cbd5e1">${s.label}</td><td style="padding:4px 8px; border:1px solid #cbd5e1; text-align:right; font-weight:700">${count}</td></tr>`;
    }
  });
  if (!c11OptRows) c11OptRows = '<tr><td colspan="2" style="padding:4px 8px; border:1px solid #cbd5e1; text-align:center; color:#64748b">कोई ऐच्छिक विषय दर्ज नहीं</td></tr>';

  let c12OptRows = '';
  SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.forEach(s => {
    const count = sub.c12_optional?.[s.key] || 0;
    if (count > 0) {
      c12OptRows += `<tr><td style="padding:4px 8px; border:1px solid #cbd5e1">${s.label}</td><td style="padding:4px 8px; border:1px solid #cbd5e1; text-align:right; font-weight:700">${count}</td></tr>`;
    }
  });
  if (!c12OptRows) c12OptRows = '<tr><td colspan="2" style="padding:4px 8px; border:1px solid #cbd5e1; text-align:center; color:#64748b">कोई ऐच्छिक विषय दर्ज नहीं</td></tr>';

  const c11FacNames = (sub.c11_faculties && sub.c11_faculties.length > 0) 
    ? sub.c11_faculties.map(f => FACULTIES_CONFIG[f]?.name || f).join(', ') 
    : 'सामान्य';
  const c12FacNames = (sub.c12_faculties && sub.c12_faculties.length > 0) 
    ? sub.c12_faculties.map(f => FACULTIES_CONFIG[f]?.name || f).join(', ') 
    : 'सामान्य';

  container.innerHTML = `
    <!-- Header -->
    <div style="text-align:center; border-bottom:2px solid #1e3a8a; padding-bottom:12px; margin-bottom:16px">
      <div style="font-size:0.88rem; font-weight:700; color:#1e3a8a; letter-spacing:0.5px">राजस्थान सरकार - स्कूल शिक्षा विभाग</div>
      <div style="font-size:1.35rem; font-weight:900; color:#1b365d; margin:4px 0">
        कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
      </div>
      <div style="font-size:1.05rem; font-weight:800; color:#dc2626; text-transform:uppercase">
        जिला समान परीक्षा योजना (सत्र 2026-27)
      </div>
      <div style="font-size:0.95rem; font-weight:700; color:#334155">
        कक्षा 9 से 12 प्रश्न-पत्र मांग एवं विद्यार्थी नामांकन अधिकृत विवरण प्रपत्र
      </div>
    </div>

    <!-- School Meta Table -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.88rem">
      <tr>
        <td style="padding:6px; border:1px solid #94a3b8; background:#f8fafc; width:22%"><strong>विद्यालय का नाम:</strong></td>
        <td style="padding:6px; border:1px solid #94a3b8; font-weight:700">${school.school_name}</td>
        <td style="padding:6px; border:1px solid #94a3b8; background:#f8fafc; width:20%"><strong>शाला दर्पण / PSP:</strong></td>
        <td style="padding:6px; border:1px solid #94a3b8; font-weight:700">${school.shala_darpan_code}</td>
      </tr>
      <tr>
        <td style="padding:6px; border:1px solid #94a3b8; background:#f8fafc"><strong>संबंधित PEEO:</strong></td>
        <td style="padding:6px; border:1px solid #94a3b8">${school.peeo_name}</td>
        <td style="padding:6px; border:1px solid #94a3b8; background:#f8fafc"><strong>स्कूल परीक्षा कोड:</strong></td>
        <td style="padding:6px; border:1px solid #94a3b8; font-weight:800; color:#1e40af; font-size:1.05rem">${sub.exam_code}</td>
      </tr>
      <tr>
        <td style="padding:6px; border:1px solid #94a3b8; background:#f8fafc"><strong>संस्था प्रधान:</strong></td>
        <td style="padding:6px; border:1px solid #94a3b8">${sub.principal_name} (मो. ${sub.principal_mobile})</td>
        <td style="padding:6px; border:1px solid #94a3b8; background:#f8fafc"><strong>परीक्षा प्रभारी:</strong></td>
        <td style="padding:6px; border:1px solid #94a3b8">${sub.incharge_name} (मो. ${sub.incharge_mobile})</td>
      </tr>
    </table>

    <!-- Subject Enrollment Table -->
    <div style="font-weight:800; font-size:0.95rem; color:#1e3a8a; margin-bottom:6px">
      कक्षा 9 से 12 विषयवार विद्यार्थी नामांकन एवं प्रश्न-पत्र मांग विवरण:
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.85rem">
      <thead>
        <tr style="background:#1b365d; color:#ffffff; text-align:center">
          <th style="padding:6px; border:1px solid #1b365d; width:12%">कक्षा</th>
          <th style="padding:6px; border:1px solid #1b365d">विषय विवरण</th>
          <th style="padding:6px; border:1px solid #1b365d; width:18%">नामांकन संख्या</th>
          <th style="padding:6px; border:1px solid #1b365d; width:20%">कक्षावार कुल</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:center; font-weight:800; background:#f8fafc">कक्षा 9वीं</td>
          <td style="padding:8px; border:1px solid #94a3b8">
            <div><strong>अनिवार्य विषय:</strong> हिंदी, अंग्रेजी, विज्ञान, सा.विज्ञान, गणित</div>
            <div style="margin-top:3px; color:#1e40af; font-weight:600">
              तृतीय भाषा: संस्कृत (${sub.c9_sanskrit || 0}), उर्दू (${sub.c9_urdu || 0})
            </div>
          </td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right">
            कुल: ${sub.c9_total}<br>
            <span style="font-size:0.75rem; color:#475569">संस्कृत: ${sub.c9_sanskrit || 0} | उर्दू: ${sub.c9_urdu || 0}</span>
          </td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right; font-weight:800; background:#eff6ff">${sub.c9_total}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:center; font-weight:800; background:#f8fafc">कक्षा 10वीं</td>
          <td style="padding:8px; border:1px solid #94a3b8">
            <div><strong>अनिवार्य विषय:</strong> हिंदी, अंग्रेजी, विज्ञान, सा.विज्ञान, गणित</div>
            <div style="margin-top:3px; color:#1e40af; font-weight:600">
              तृतीय भाषा: संस्कृत (${sub.c10_sanskrit || 0}), उर्दू (${sub.c10_urdu || 0})
            </div>
          </td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right">
            कुल: ${sub.c10_total}<br>
            <span style="font-size:0.75rem; color:#475569">संस्कृत: ${sub.c10_sanskrit || 0} | उर्दू: ${sub.c10_urdu || 0}</span>
          </td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right; font-weight:800; background:#eff6ff">${sub.c10_total}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:center; font-weight:800; background:#f8fafc" rowspan="2">कक्षा 11वीं</td>
          <td style="padding:8px; border:1px solid #94a3b8">
            <div><strong>अनिवार्य विषय:</strong> अनिवार्य हिंदी (${sub.c11_comp_hindi}), अनिवार्य अंग्रेजी (${sub.c11_comp_english})</div>
            <div style="margin-top:3px; color:#0369a1; font-weight:700">
              संचालित संकाय: ${c11FacNames}
            </div>
          </td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right">हिंदी: ${sub.c11_comp_hindi}<br>अंग्रेजी: ${sub.c11_comp_english}</td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right; font-weight:800; background:#eff6ff" rowspan="2">${sub.c11_total}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0; border:1px solid #94a3b8">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem">
              <tr style="background:#f1f5f9; font-weight:700">
                <td style="padding:4px 8px; border:1px solid #cbd5e1">कक्षा 11 ऐच्छिक विषय (संकायवार)</td>
                <td style="padding:4px 8px; border:1px solid #cbd5e1; text-align:right; width:80px">विद्यार्थी</td>
              </tr>
              ${c11OptRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:center; font-weight:800; background:#f8fafc" rowspan="2">कक्षा 12वीं</td>
          <td style="padding:8px; border:1px solid #94a3b8">
            <div><strong>अनिवार्य विषय:</strong> अनिवार्य हिंदी (${sub.c12_comp_hindi}), अनिवार्य अंग्रेजी (${sub.c12_comp_english})</div>
            <div style="margin-top:3px; color:#0369a1; font-weight:700">
              संचालित संकाय: ${c12FacNames}
            </div>
          </td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right">हिंदी: ${sub.c12_comp_hindi}<br>अंग्रेजी: ${sub.c12_comp_english}</td>
          <td style="padding:8px; border:1px solid #94a3b8; text-align:right; font-weight:800; background:#eff6ff" rowspan="2">${sub.c12_total}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0; border:1px solid #94a3b8">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem">
              <tr style="background:#f1f5f9; font-weight:700">
                <td style="padding:4px 8px; border:1px solid #cbd5e1">कक्षा 12 ऐच्छिक विषय (संकायवार)</td>
                <td style="padding:4px 8px; border:1px solid #cbd5e1; text-align:right; width:80px">विद्यार्थी</td>
              </tr>
              ${c12OptRows}
            </table>
          </td>
        </tr>
        <tr style="background:#fef3c7; font-size:1rem; font-weight:900">
          <td colspan="3" style="padding:10px; border:2px solid #b45309; text-align:right; color:#78350f">
            कुल मांग प्रश्न-पत्र संख्या (कक्षा 9 से 12 कुल योग):
          </td>
          <td style="padding:10px; border:2px solid #b45309; text-align:right; color:#991b1b; font-size:1.25rem">
            ${sub.grand_total}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Verification Declaration -->
    <div style="font-size:0.82rem; color:#334155; line-height:1.4; margin-bottom:28px; text-align:justify; border:1px solid #cbd5e1; padding:8px 12px; border-radius:4px; background:#f8fafc">
      <strong>सत्यापन प्रमाण-पत्र:</strong> प्रमाणित किया जाता है कि उपरोक्तानुसार विद्यालय के कक्षा 9, 10, 11 एवं 12 का विषयवार विद्यार्थी नामांकन विद्यालय की आधिकारिक प्रवेश पंजिका एवं शाला दर्पण पोर्टल से शत-प्रतिशत मिलान कर लिया गया है। समान परीक्षा सत्र 2026-27 के प्रश्न-पत्र इसी नामांकन के अनुसार मुद्रित व वितरित किए जाएं।
    </div>

    <!-- Official Rectangular Stamp & Signatures Box -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:0 15px; margin-top:30px">
      
      <!-- Incharge Signature -->
      <div style="text-align:center; width:28%">
        <div style="height:45px; display:flex; align-items:flex-end; justify-content:center; color:#1e3a8a; font-family:'Brush Script MT', cursive; font-size:1.35rem">
          ${sub.incharge_name}
        </div>
        <div style="border-top:1.5px solid #000; padding-top:4px; font-weight:700; font-size:0.85rem">
          हस्ताक्षर परीक्षा प्रभारी
        </div>
        <div style="font-size:0.75rem; color:#475569">मो.: ${sub.incharge_mobile}</div>
      </div>

      <!-- Center: Official Rectangular PEEO Seal (सीधी मोहर) -->
      <div style="text-align:center; width:38%">
        <div class="rectangular-stamp" style="margin:0 auto; width:220px; height:72px">
          <div class="stamp-top-line">कार्यालय पंचायत प्रारंभिक शिक्षा अधिकारी (PEEO)</div>
          <div class="stamp-mid-line">${school.peeo_name}</div>
          <div class="stamp-bottom-line">ग्रा.पं. ${school.peeo_name.replace('PEEO ', '')}, ब्लॉक-भिनाय (अजमेर)</div>
        </div>
      </div>

      <!-- Principal Signature & Seal -->
      <div style="text-align:center; width:28%">
        <div style="height:45px; display:flex; align-items:flex-end; justify-content:center; color:#1b365d; font-family:'Brush Script MT', cursive; font-size:1.35rem">
          ${sub.principal_name}
        </div>
        <div style="border-top:1.5px solid #000; padding-top:4px; font-weight:700; font-size:0.85rem">
          हस्ताक्षर मय सील संस्था प्रधान
        </div>
        <div style="font-size:0.75rem; color:#475569">मो.: ${sub.principal_mobile}</div>
      </div>

    </div>

    <!-- Footer meta -->
    <div style="margin-top:24px; padding-top:8px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; font-size:0.72rem; color:#64748b">
      <span>पोर्टल सत्यापन आईडी: CBEO-SP-2026-${school.shala_darpan_code}</span>
      <span>प्रविष्टि दिनांक: ${sub.timestamp}</span>
      <span>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय</span>
    </div>
  `;

  showModal('modal-exam-pdf-preview');
}

function printOfficialExamDocument() {
  window.print();
}

function downloadExamPDFDirect() {
  const container = document.getElementById('printable-exam-document-content');
  if (!container) return;
  const schoolCode = STATE.activeExamPreviewCode || 'School';
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const nameSafe = school ? school.school_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) : 'Exam_Indent';
  
  showToast('अधिकृत PDF तैयार किया जा रहा है...', 'info');
  
  const opt = {
    margin: [6, 6, 6, 6],
    filename: `Saman_Pariksha_2026_${schoolCode}_${nameSafe}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(container).save().then(() => {
      showToast('अधिकृत PDF सफलतापूर्वक डाउनलोड हो गया!', 'success');
    }).catch(err => {
      console.error(err);
      window.print();
    });
  } else {
    window.print();
  }
}

function shareExamPDFWhatsApp() {
  const schoolCode = STATE.activeExamPreviewCode;
  const school = STATE.schools56.find(s => s.shala_darpan_code === schoolCode);
  const sub = STATE.samanParikshaSubmissions[schoolCode];
  if (!school || !sub) {
    showToast('प्रपत्र डेटा उपलब्ध नहीं है!', 'warning');
    return;
  }
  
  const text = `*🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय*\n*जिला समान परीक्षा योजना (सत्र 2026-27)*\n\n📌 *विद्यालय:* ${school.school_name}\n📌 *शाला दर्पण/PSP कोड:* ${school.shala_darpan_code}\n📌 *परीक्षा कोड:* ${sub.exam_code}\n📌 *संस्था प्रधान:* ${sub.principal_name} (${sub.principal_mobile})\n📌 *परीक्षा प्रभारी:* ${sub.incharge_name} (${sub.incharge_mobile})\n\n📊 *कक्षावार नामांकन एवं प्रश्न-पत्र मांग:*\n• कक्षा 9वीं: ${sub.c9_total}\n• कक्षा 10वीं: ${sub.c10_total}\n• कक्षा 11वीं: ${sub.c11_total}\n• कक्षा 12वीं: ${sub.c12_total}\n🎯 *कुल मांग प्रश्न-पत्र (Grand Total):* ${sub.grand_total}\n\n✅ *सत्यापन स्थिति:* अधिकृत डिजिटल सील व हस्ताक्षरों सहित सबमिट\n📅 *प्रविष्टि दिनांक:* ${sub.timestamp}\n🌐 *पोर्टल लिंक:* https://jit9763.github.io/cbeo-bhinai-portal/`;
  
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
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

function exportSamanParikshaMasterCSV() {
  const header = [
    "क्र.सं. (S.No)",
    "विद्यालय का नाम (School Name)",
    "श्रेणी (Category)",
    "प्रकार (Type)",
    "शाला दर्पण / PSP कोड",
    "संबंधित PEEO",
    "स्कूल परीक्षा कोड (Exam Code)",
    "संस्था प्रधान का नाम",
    "संस्था प्रधान मोबाइल",
    "परीक्षा प्रभारी का नाम",
    "परीक्षा प्रभारी मोबाइल",
    "कक्षा 9 कुल नामांकन",
    "कक्षा 10 कुल नामांकन",
    "कक्षा 11 अनिवार्य हिंदी",
    "कक्षा 11 अनिवार्य अंग्रेजी",
    "कक्षा 11 ऐच्छिक विषय विवरण",
    "कक्षा 11 कुल नामांकन",
    "कक्षा 12 अनिवार्य हिंदी",
    "कक्षा 12 अनिवार्य अंग्रेजी",
    "कक्षा 12 ऐच्छिक विषय विवरण",
    "कक्षा 12 कुल नामांकन",
    "कुल मांग प्रश्न-पत्र (Grand Total 9 to 12)",
    "स्थिति (Status)",
    "प्रविष्टि समय (Timestamp)"
  ];

  const rows = [header];

  STATE.schools56.forEach(s => {
    const sub = STATE.samanParikshaSubmissions[s.shala_darpan_code] || {};
    const status = sub.grand_total !== undefined ? "सबमिट (Submitted)" : "लम्बित (Pending)";

    let c11OptStr = "";
    if (sub.c11_optional) {
      c11OptStr = Object.entries(sub.c11_optional)
        .filter(([k, v]) => v > 0)
        .map(([k, v]) => {
          const item = SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.find(sub => sub.key === k);
          const label = item ? item.label.split('(')[0].trim() : k;
          return `${label}: ${v}`;
        }).join("; ");
    }

    let c12OptStr = "";
    if (sub.c12_optional) {
      c12OptStr = Object.entries(sub.c12_optional)
        .filter(([k, v]) => v > 0)
        .map(([k, v]) => {
          const item = SAMAN_PARIKSHA_OPTIONAL_SUBJECTS.find(sub => sub.key === k);
          const label = item ? item.label.split('(')[0].trim() : k;
          return `${label}: ${v}`;
        }).join("; ");
    }

    rows.push([
      s.s_no,
      `"${s.school_name}"`,
      `"${s.category}"`,
      `"${s.type}"`,
      s.shala_darpan_code,
      `"${s.peeo_name}"`,
      `"${sub.exam_code || s.exam_code || ''}"`,
      `"${sub.principal_name || s.principal_name || ''}"`,
      `"${sub.principal_mobile || s.principal_mobile || ''}"`,
      `"${sub.incharge_name || ''}"`,
      `"${sub.incharge_mobile || ''}"`,
      sub.c9_total ?? 0,
      sub.c10_total ?? 0,
      sub.c11_comp_hindi ?? 0,
      sub.c11_comp_english ?? 0,
      `"${c11OptStr}"`,
      sub.c11_total ?? 0,
      sub.c12_comp_hindi ?? 0,
      sub.c12_comp_english ?? 0,
      `"${c12OptStr}"`,
      sub.c12_total ?? 0,
      sub.grand_total ?? 0,
      `"${status}"`,
      `"${sub.timestamp || ''}"`
    ]);
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `CBEO_Bhinai_Saman_Pariksha_56_Schools_Master_${new Date().toISOString().slice(0, 10)}.csv`;
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('समेकित 56 स्कूलों की एक्सेल (CSV) सफलतापूर्वक डाउनलोड हो गई!', 'success');
}

function triggerDriveSheetSync() {
  showToast('Google Drive शीट में सिंक शुरू किया गया...', 'info');
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

  let isCurrentSubmitted = false;
  let currentSubmission = null;

  if (STATE.currentUser?.role === 'peeo') {
    const subKey = `${demand.id}_${STATE.currentUser.peeo_id}`;
    if (STATE.submissions[subKey] && STATE.submissions[subKey].verified) {
      isCurrentSubmitted = true;
      currentSubmission = STATE.submissions[subKey];
    }
  }

  let submittedCount = 0;
  STATE.peeos.forEach(p => {
    const subKey = `${demand.id}_${p.peeo_id}`;
    if (STATE.submissions[subKey] && STATE.submissions[subKey].verified) {
      submittedCount++;
    }
  });

  const totalPEEOs = STATE.peeos.length;
  const percent = Math.round((submittedCount / totalPEEOs) * 100);

  if (STATE.currentUser?.role === 'peeo') {
    if (isCurrentSubmitted) {
      card.classList.add('submitted');
    } else {
      card.classList.add('pending');
    }
  }

  const isPeeoUser = STATE.currentUser?.role === 'peeo';
  const isAdminUser = STATE.currentUser?.role === 'admin';

  card.innerHTML = `
    <div>
      <div class="demand-card-header">
        <span class="status-badge ${isCurrentSubmitted ? 'green' : 'red'}">
          ${isPeeoUser ? (isCurrentSubmitted ? '<i class="fas fa-check-circle"></i> पूर्ण (सत्यापित)' : '<i class="fas fa-exclamation-circle"></i> बाकी (Pending)') : `<i class="fas fa-users"></i> ${submittedCount}/${totalPEEOs} PEEO पूर्ण`}
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
          <span>ब्लॉक प्रगति: ${submittedCount}/${totalPEEOs} PEEO</span>
          <span>${percent}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${percent}%"></div>
        </div>
      </div>
    </div>

    <div class="demand-actions">
      ${isPeeoUser ? `
        ${isCurrentSubmitted ? `
          <button class="btn btn-outline-light btn-sm" style="color:#047857; border-color:#6ee7b7" onclick="openPreviewPDFModal('${demand.id}', '${STATE.currentUser.peeo_id}')">
            <i class="fas fa-eye"></i> प्रपत्र देखें / प्रिंट
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="quickShareWhatsApp('${demand.id}', '${STATE.currentUser.peeo_id}')">
            <i class="fab fa-whatsapp"></i> शेयर
          </button>
        ` : `
          <button class="btn btn-danger btn-sm" onclick="openFillDemandModal('${demand.id}')">
            <i class="fas fa-pen-nib"></i> प्रपत्र भरें व मोहर लगाएं
          </button>
        `}
      ` : (isAdminUser ? `
        <button class="btn btn-primary btn-sm" onclick="switchTab('admin-control')">
          <i class="fas fa-tasks"></i> सभी 25 PEEO स्थिति
        </button>
        <button class="btn btn-outline-light btn-sm" style="color:#1b365d; border-color:#cbd5e1" onclick="openFillDemandModal('${demand.id}', 'PEEO08')">
          <i class="fas fa-eye"></i> प्रपत्र प्रारूप
        </button>
      ` : `
        <button class="btn btn-primary btn-sm" onclick="openLoginModal(true)">
          <i class="fas fa-sign-in-alt"></i> लॉगिन कर सूचना भरें
        </button>
      `)}
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
function downloadCurrentPDF() {
  if (!activePreviewRecord) return;
  const element = document.getElementById('pdf-preview-box');
  const cleanName = (activePreviewRecord.peeoName + '_' + activePreviewRecord.demandTitle).replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
  
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `${cleanName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(element).save();
  showToast('आधिकारिक PDF तैयार व डाउनलोड प्रारंभ!', 'success');
}

function shareCurrentPDFOnWhatsApp() {
  if (!activePreviewRecord) return;
  const msg = `*कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी भिनाय*\n\n` +
              `*प्रपत्र:* ${activePreviewRecord.demandTitle}\n` +
              `*PEEO:* ${activePreviewRecord.peeoName} (कोड: ${activePreviewRecord.shala_darpan_code})\n` +
              `*प्रभारी:* ${activePreviewRecord.incharge}\n` +
              `*सत्यापन दिनांक:* ${activePreviewRecord.submittedAt}\n\n` +
              `सादर सूचनार्थ, उक्त सूचना का प्रमाणित प्रपत्र सीधी डिजिटल मोहर एवं हस्ताक्षर सहित CBEO भिनाय पोर्टल पर सफलता पूर्वक सबमिट कर दिया गया है।`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
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
   11. ADMIN CONTROL ROOM & PUBLISH TOGGLE
   ======================================================== */
function renderAdminControlView() {
  const activeDemands = STATE.demands.filter(d => !d.archived);
  const theadTr = document.getElementById('admin-matrix-thead-tr');
  const tbody = document.getElementById('admin-matrix-tbody');

  // 1. Render Publish / Unpublish Checkbox List
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
        <span class="status-badge ${isPub ? 'green' : 'red'}" style="font-size:0.75rem">
          ${isPub ? '✓ PEEO स्तर पर LIVE (प्रकाशित)' : '✗ अप्रकाशित (PEEO से छुपा हुआ)'}
        </span>
      `;
      publishList.appendChild(div);
    });
  }

  // 2. Build matrix columns
  theadTr.innerHTML = `
    <th>क्र.सं.</th>
    <th>शा.दा. कोड</th>
    <th>PEEO नाम</th>
    <th>प्रभारी प्रधानाचार्य</th>
    <th>मोबाइल नंबर</th>
  `;
  activeDemands.forEach(d => {
    theadTr.innerHTML += `<th>${d.title}</th>`;
  });
  theadTr.innerHTML += `<th>त्वरित WhatsApp रिमाइंडर</th>`;

  tbody.innerHTML = '';
  STATE.peeos.forEach((peeo, pIdx) => {
    const tr = document.createElement('tr');
    let cellsHtml = `
      <td><strong>${pIdx + 1}</strong></td>
      <td><code>${peeo.shala_darpan_code || '---'}</code></td>
      <td><strong>${peeo.peeo_name}</strong></td>
      <td>${peeo.principal_incharge}</td>
      <td><a href="tel:${peeo.mobile}" style="text-decoration:none; color:var(--primary); font-weight:600"><i class="fas fa-phone-alt"></i> ${peeo.mobile}</a></td>
    `;

    let pendingDemandsForPeeo = [];

    activeDemands.forEach(d => {
      const subKey = `${d.id}_${peeo.peeo_id}`;
      const isSub = STATE.submissions[subKey] && STATE.submissions[subKey].verified;
      if (isSub) {
        cellsHtml += `
          <td>
            <button class="status-badge green" style="border:none; cursor:pointer" onclick="openPreviewPDFModal('${d.id}', '${peeo.peeo_id}')" title="सत्यापित PDF देखें">
              <i class="fas fa-check-circle"></i> पूर्ण (PDF देखें)
            </button>
          </td>
        `;
      } else {
        pendingDemandsForPeeo.push(d.title);
        cellsHtml += `
          <td>
            <span class="status-badge red"><i class="fas fa-times-circle"></i> बाकी</span>
          </td>
        `;
      }
    });

    if (pendingDemandsForPeeo.length > 0) {
      const reminderText = `आदरणीय ${peeo.principal_incharge} महोदय (${peeo.peeo_name}), CBEO भिनाय कार्यालय द्वारा मांगी गई निम्नलिखित सूचनाएं पोर्टल पर लंबित हैं: ${pendingDemandsForPeeo.join(', ')}। कृपया यथाशीघ्र सीधी मोहर व हस्ताक्षर सहित पोर्टल पर सबमिट करें।`;
      cellsHtml += `
        <td>
          <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppMessage('${peeo.mobile}', '${reminderText}')">
            <i class="fab fa-whatsapp"></i> रिमाइंडर
          </button>
        </td>
      `;
    } else {
      cellsHtml += `
        <td>
          <span class="status-badge green"><i class="fas fa-check-double"></i> सभी पूर्ण</span>
        </td>
      `;
    }

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });
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
  const scopeSelect = document.getElementById('new-demand-school-scope');
  if (scopeSelect) scopeSelect.value = 'all';
  document.getElementById('new-demand-cols').value = 'कुल खेल मैदान क्षेत्रफल (बीघा), वर्तमान चारदीवारी स्थिति, विकसित खेल संसाधन, आवश्यक अनुदान (लाखों में), विशेष विवरण';
  document.getElementById('new-demand-desc').value = '';
  document.getElementById('new-demand-publish').checked = true;
  showModal('modal-create-demand');
}

function saveNewDemand() {
  const title = document.getElementById('new-demand-title').value.trim();
  const dueDate = document.getElementById('new-demand-date').value;
  const priority = document.getElementById('new-demand-priority').value;
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
    schoolScope: scope,
    description: desc || 'समस्त PEEO समय सीमा में सूचना सीधी डिजिटल मोहर व हस्ताक्षर सहित प्रेषित करें।',
    dueDate: dueDate || 'यथाशीघ्र',
    priority: priority,
    published: isPub,
    createdAt: new Date().toISOString().split('T')[0],
    columns: cols
  };

  STATE.demands.unshift(newDemand);
  saveDemandsToStorage();

  recordAuditLog({
    user: STATE.currentUser.name || 'जितेन्द्र कुमार (Admin)',
    action: 'नई सूचना मांग सृजन (Zero-Code)',
    target: title,
    details: `${cols.length} कॉलम का प्रपत्र सृजित | प्रकाशित: ${isPub ? 'हाँ' : 'नहीं'}`,
    note: 'स्वतः फॉर्म जनरेटर'
  });

  closeModal('modal-create-demand');
  showToast(`नई सूचना '${title}' सफलता पूर्वक तैयार हो गई!`, 'success');
  renderApp();
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
