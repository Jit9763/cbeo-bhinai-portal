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

  // Versioned cache check to guarantee fresh master data with Nodal Schools and 1048 staff
  const DATA_VERSION = 'v4_2026_09_30_nodal_schools_scope_posts';
  if (localStorage.getItem('cbeo_data_version') !== DATA_VERSION) {
    localStorage.removeItem('cbeo_peeos_data');
    localStorage.removeItem('cbeo_staff_data');
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

  // 4. Information Demands
  const storedDemands = localStorage.getItem('cbeo_demands');
  if (storedDemands) {
    try {
      STATE.demands = JSON.parse(storedDemands);
    } catch (e) {
      STATE.demands = getInitialDemands();
    }
  } else {
    STATE.demands = getInitialDemands();
    saveDemandsToStorage();
  }

  // 5. Submissions
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
  return [
    {
      id: 'DEMAND_01',
      title: 'कक्षा कक्ष मरम्मत आवश्यकता सूचना 2026',
      description: 'समस्त PEEO अधीनस्थ विद्यालयों में वर्तमान में क्षतिग्रस्त एवं मरम्मत योग्य कमरों का भौतिक सत्यापन कर विवरण दें।',
      dueDate: '2026-10-05',
      priority: 'अति आवश्यक (Urgent)',
      published: true,
      createdAt: '2026-09-28',
      columns: [
        { name: 'कुल स्वीकृत कक्षा कक्ष', type: 'number', locked: false, placeholder: 'कमरों की संख्या' },
        { name: 'वर्तमान में मरम्मत योग्य कक्ष', type: 'number', locked: false, placeholder: 'मरम्मत योग्य' },
        { name: 'नवीन भवन/कक्ष की आवश्यकता', type: 'number', locked: false, placeholder: 'नवीन आवश्यकता' },
        { name: 'अनुमानित व्यय (लाखों में)', type: 'number', locked: false, placeholder: 'लाख रु. में' },
        { name: 'विशेष अभियुक्ति / स्थिति', type: 'text', locked: false, placeholder: 'कमरों की वर्तमान स्थिति' }
      ]
    },
    {
      id: 'DEMAND_02',
      title: 'विद्या संबल योजना शिक्षक रिक्त पद विवरण',
      description: 'सत्र 2026-27 हेतु विद्यालयवार रिक्त पदों की वास्तविक स्थिति एवं विद्या संबल योजना की आवश्यकता प्रेषित करें।',
      dueDate: '2026-10-07',
      priority: 'साधारण (Normal)',
      published: true,
      createdAt: '2026-09-29',
      columns: [
        { name: 'स्वीकृत पद', type: 'number', locked: false, placeholder: 'कुल स्वीकृत पद' },
        { name: 'कार्यरत पद', type: 'number', locked: false, placeholder: 'कार्यरत शिक्षक' },
        { name: 'रिक्त पद संख्या', type: 'number', locked: false, placeholder: 'रिक्तियां' },
        { name: 'आवश्यक विषय/लेवल', type: 'text', locked: false, placeholder: 'उदा. Level-2 गणित' },
        { name: 'प्राथमिकता', type: 'select', options: ['उच्च (High)', 'मध्यम (Medium)', 'सामान्य (Normal)'], locked: false }
      ]
    },
    {
      id: 'DEMAND_03',
      title: 'पुस्तकालय एवं ICT लैब क्रियाशीलता रिपोर्ट',
      description: 'कम्प्यूटर लैब में उपलब्ध चालू कम्प्यूटरों की संख्या तथा पुस्तकालय पुस्तकों के वितरण की स्थिति।',
      dueDate: '2026-10-10',
      priority: 'साधारण (Normal)',
      published: true,
      createdAt: '2026-09-30',
      columns: [
        { name: 'क्या ICT लैब स्थापित है?', type: 'select', options: ['हाँ (Yes)', 'नहीं (No)'], locked: false },
        { name: 'चालू कंप्यूटर संख्या', type: 'number', locked: false, placeholder: 'चालू PC' },
        { name: 'इंटरनेट कनेक्टिविटी प्रकार', type: 'select', options: ['Fiber Broadband', '4G Dongle', 'Mobile Hotspot', 'उपलब्ध नहीं'], locked: false },
        { name: 'कुल पुस्तकालय पुस्तकें', type: 'number', locked: false, placeholder: 'पुस्तकों की संख्या' }
      ]
    }
  ];
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

  // Mandatory Login Gate on Portal Open
  if (!STATE.currentUser) {
    setTimeout(() => {
      openLoginModal(true); // isMandatory = true
    }, 150);
  }
}

function logoutUser() {
  localStorage.removeItem('cbeo_logged_user');
  STATE.currentUser = null;
  updateUserHeaderBadge();
  showToast('सफलतापूर्वक लॉगआउट किया गया। पुनः उपयोग हेतु लॉगिन करें।', 'info');
  openLoginModal(true);
}

function updateUserHeaderBadge() {
  const badgeInitial = document.getElementById('user-badge-initial');
  const displayName = document.getElementById('user-display-name');
  const displaySubtext = document.getElementById('user-display-subtext');
  const adminTab = document.getElementById('nav-tab-admin');

  if (!STATE.currentUser) {
    if (badgeInitial) {
      badgeInitial.textContent = '?';
      badgeInitial.style.background = '#64748b';
    }
    if (displayName) displayName.textContent = 'लॉगिन आवश्यक (Login Required)';
    if (displaySubtext) displaySubtext.textContent = 'कृपया अपने शाला दर्पण कोड से लॉगिन करें';
    if (adminTab) adminTab.style.display = 'none';
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
  } else {
    if (badgeInitial) {
      badgeInitial.textContent = STATE.currentUser.peeo_name.charAt(5) || 'P';
      badgeInitial.style.background = '#0284c7';
    }
    if (displayName) displayName.textContent = `${STATE.currentUser.peeo_name} (${STATE.currentUser.shala_darpan_code})`;
    if (displaySubtext) displaySubtext.textContent = `प्रभारी: ${STATE.currentUser.principal_incharge} | मो.: ${STATE.currentUser.mobile || '---'}`;
    if (adminTab) adminTab.style.display = 'none';
  }
}

function openLoginModal(isMandatory = false) {
  const modalElem = document.getElementById('modal-login');
  const closeBtn = document.getElementById('modal-login-close-btn');
  const cancelBtn = document.getElementById('modal-login-cancel-btn');

  const mustLock = isMandatory || !STATE.currentUser;
  if (mustLock) {
    if (closeBtn) closeBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (modalElem) modalElem.classList.add('mandatory-gate');
  } else {
    if (closeBtn) closeBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (modalElem) modalElem.classList.remove('mandatory-gate');
  }

  const select = document.getElementById('login-quick-select');
  const optgroup = document.getElementById('login-peeo-optgroup');
  if (optgroup) {
    optgroup.innerHTML = '';
    STATE.peeos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.shala_darpan_code;
      opt.textContent = `${p.shala_darpan_code} - ${p.peeo_name} (${p.principal_incharge})`;
      optgroup.appendChild(opt);
    });
  }

  if (STATE.currentUser) {
    if (STATE.currentUser.role === 'admin') {
      if (select) select.value = STATE.currentUser.username;
      document.getElementById('login-username').value = STATE.currentUser.shala_darpan_code;
      document.getElementById('login-password').value = STATE.currentUser.username === 'cbeo_admin' ? 'cbeo@2026' : 'jitendra#2026';
    } else {
      if (select) select.value = STATE.currentUser.shala_darpan_code;
      document.getElementById('login-username').value = STATE.currentUser.shala_darpan_code;
      document.getElementById('login-password').value = STATE.currentUser.password || '';
    }
  } else {
    // Default selection for immediate 1-click convenience
    if (select) {
      select.value = '221754'; // PEEO Deoliya Kalan default
      onQuickSelectUser();
    }
  }

  showModal('modal-login');
}

function onQuickSelectUser() {
  const val = document.getElementById('login-quick-select').value;
  if (val === 'jitendra_admin') {
    document.getElementById('login-username').value = 'admin_jitendra';
    document.getElementById('login-password').value = 'jitendra#2026';
  } else if (val === 'cbeo_admin') {
    document.getElementById('login-username').value = '8140';
    document.getElementById('login-password').value = 'cbeo@2026';
  } else {
    const peeo = STATE.peeos.find(p => p.shala_darpan_code === val || p.peeo_id === val);
    if (peeo) {
      document.getElementById('login-username').value = peeo.shala_darpan_code;
      document.getElementById('login-password').value = peeo.password;
    }
  }
}

function performLogin() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();

  // Admin Check
  if (u === 'admin_jitendra' || u === 'jitendra_admin' || u === 'jitendra') {
    STATE.currentUser = {
      role: 'admin',
      admin_id: 'ADMIN02',
      name: 'जितेन्द्र कुमार (Jitendra Kumar)',
      post: 'तकनीकी नोडल प्रभारी एवं व्यवस्थापक',
      mobile: '7073800244',
      email: 'jitendrakumar.cbeo@gmail.com',
      username: 'jitendra_admin',
      shala_darpan_code: 'admin_jitendra'
    };
    localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
    closeModal('modal-login');
    showToast('जितेन्द्र कुमार (Super Admin) के रूप में लॉगिन सफल!', 'success');
    renderApp();
    return;
  }

  if (u === 'cbeo_admin' || u === 'admin' || u === '8140') {
    STATE.currentUser = {
      role: 'admin',
      admin_id: 'ADMIN01',
      name: 'प्रमिला रासलोत (CBEO)',
      post: 'मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)',
      mobile: '9414000000',
      email: 'cbeo.bhinai.ajmer@rajasthan.gov.in',
      username: 'cbeo_admin',
      shala_darpan_code: '8140'
    };
    localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
    closeModal('modal-login');
    showToast('प्रमिला रासलोत (CBEO Admin) के रूप में लॉगिन सफल!', 'success');
    renderApp();
    return;
  }

  // PEEO Login by Shala Darpan Code or Username
  const peeo = STATE.peeos.find(item => 
    item.shala_darpan_code === u || 
    item.username.toLowerCase() === u.toLowerCase() ||
    item.alias_username?.toLowerCase() === u.toLowerCase()
  );

  if (peeo) {
    STATE.currentUser = {
      role: 'peeo',
      peeo_id: peeo.peeo_id,
      peeo_name: peeo.peeo_name,
      shala_darpan_code: peeo.shala_darpan_code,
      panchayat_name: peeo.panchayat_name,
      principal_incharge: peeo.principal_incharge,
      mobile: peeo.mobile,
      email: peeo.email,
      username: peeo.username,
      password: peeo.password,
      schools: peeo.schools
    };
    localStorage.setItem('cbeo_logged_user', JSON.stringify(STATE.currentUser));
    closeModal('modal-login');
    showToast(`${peeo.peeo_name} (शा.दा. कोड: ${peeo.shala_darpan_code}) के रूप में लॉगिन सफल!`, 'success');
    renderApp();
  } else {
    showToast('अमान्य शाला दर्पण कोड अथवा पासवर्ड! कृपया सही विवरण दर्ज करें।', 'error');
  }
}

/* ========================================================
   3. NAVIGATION & VIEW SWITCHING
   ======================================================== */
function switchTab(viewId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick')?.includes(viewId));
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');

  if (viewId === 'explorer') renderExplorerView();
  else if (viewId === 'directory') renderDirectoryView();
  else if (viewId === 'staff') renderStaffView();
  else if (viewId === 'demands') renderDemandsView();
  else if (viewId === 'archive') renderArchiveView();
  else if (viewId === 'admin-control') renderAdminControlView();
  else renderDashboardView();
}

/* ========================================================
   4. RENDER MASTER VIEWS
   ======================================================== */
function renderApp() {
  updateUserHeaderBadge();
  renderDashboardView();
  renderDemandsView();
  renderArchiveView();
  renderDirectoryFilters();
  renderStaffFilters();
  renderExplorerFilters();
}

// --- Dashboard View ---
function renderDashboardView() {
  document.getElementById('stat-peeo-count').textContent = STATE.peeos.length;
  
  let totalSchools = 0;
  STATE.peeos.forEach(p => totalSchools += (p.schools ? p.schools.length : 0));
  document.getElementById('stat-schools-count').textContent = totalSchools || 153;

  const activeStaff = STATE.staff.filter(s => s.status !== 'Deleted');
  document.getElementById('stat-staff-count').textContent = activeStaff.length;

  const activeDemands = getVisibleDemands();
  document.getElementById('stat-active-demands').textContent = activeDemands.length;

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
  document.getElementById('stat-compliance-percent').textContent = `${compPercent}%`;

  // Render Spotlight Cards
  const previewContainer = document.getElementById('dashboard-demands-preview');
  previewContainer.innerHTML = '';
  activeDemands.slice(0, 2).forEach(d => {
    previewContainer.appendChild(createDemandCardElement(d));
  });

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
  container.innerHTML = '';

  document.getElementById('demands-active-count').textContent = `${visibleDemands.length} प्रपत्र`;
  document.getElementById('nav-pending-badge').textContent = `${visibleDemands.length} सक्रिय`;

  if (visibleDemands.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; background:white; border-radius:12px; color:var(--neutral-500)">
      <i class="fas fa-check-circle fa-3x text-success" style="margin-bottom:1rem"></i>
      <h3>वर्तमान में कोई सक्रिय सूचना प्रपत्र प्रकाशित नहीं है!</h3>
      <p>कार्यालय एडमिन द्वारा सूचना प्रकाशित किए जाने पर यहाँ प्रदर्शित होगी।</p>
    </div>`;
    return;
  }

  visibleDemands.forEach(demand => {
    container.appendChild(createDemandCardElement(demand));
  });
}

function renderArchiveView() {
  const archived = getArchivedDemands();
  const container = document.getElementById('archive-cards-container');
  container.innerHTML = '';

  document.getElementById('archive-count').textContent = `${archived.length} प्रपत्र`;
  document.getElementById('nav-archive-badge').textContent = archived.length;

  if (archived.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; background:white; border-radius:12px; color:var(--neutral-500)">
      <i class="fas fa-archive fa-3x" style="margin-bottom:1rem; color:#cbd5e1"></i>
      <h3>वर्तमान में कोई आर्काइव्ड प्रपत्र नहीं है।</h3>
      <p>शत-प्रतिशत पूर्ण होने के 7 दिन पश्चात प्रपत्र यहाँ स्वतः सुरक्षित रहेंगे।</p>
    </div>`;
    return;
  }

  archived.forEach(demand => {
    container.appendChild(createDemandCardElement(demand, true));
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
