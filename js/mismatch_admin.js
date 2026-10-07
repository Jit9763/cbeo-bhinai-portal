/**
 * CBEO Bhinai Portal - Saman Pariksha Mismatch Admin & 6-Level Permission Engine
 * Block: Bhinai | District: AJMER (अजमेर)
 * Controls Mismatch Overrides, Login Blinking Alerts, and Role-Based Permissions.
 */


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

