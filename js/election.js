/**
 * CBEO Bhinai Portal - Election 2026 Verification Module
 * Block: Bhinai | District: AJMER (अजमेर)
 * 30 Panchayat Schools & 116 Polling Booths (State Election Commission Order 2026)
 */

let ELECTION_FILTER_STATUS = 'all';
let ELECTION_SEARCH_QUERY = '';
let ELECTION_VIEW_MODE = 'grid'; // 'grid' | 'table_30' | 'table_116'
let ELECTION_ACTIVE_FORM_TAB = 'form_p3'; // 'form_p3' | 'booth_116'
let ELECTION_SCOPE_FILTER = 'all'; // 'all' | 'peeo_only' | 'non_peeo'

// Dynamic Custom Columns Store
function getElectionCustomColumns() {
  try {
    return JSON.parse(localStorage.getItem('cbeo_election_custom_columns') || '[]');
  } catch(e) {
    return [];
  }
}

function saveElectionCustomColumns(cols) {
  try {
    localStorage.setItem('cbeo_election_custom_columns', JSON.stringify(cols));
  } catch(e) {}
  if (typeof saveCloudPortalSetting === 'function') {
    saveCloudPortalSetting('election_custom_columns', cols);
  }
  window.ELECTION_CUSTOM_COLUMNS = cols;
}

function renderElectionView() {
  const container = document.getElementById('view-election');
  if (!container) return;

  const user = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
  const isJitendra = user && (user.shala_darpan_code === 'admin_jitendra' || user.admin_id === 'ADMIN02' || user.username === 'jitendra_admin');
  const isCBEO = user && (user.shala_darpan_code === '8140' || user.admin_id === 'ADMIN01' || (user.role === 'admin' && !isJitendra));
  const isAdmin = isJitendra || isCBEO || (user && user.role === 'admin');

  // Update tab badge dynamically
  const badge = document.getElementById('nav-election-badge');
  if (badge) {
    if (isAdmin) {
      badge.textContent = (window.ELECTION_2026_SCHOOLS || []).length || 33;
    } else if (user && user.role === 'peeo') {
      const pCode = String(user.shala_darpan_code || user.peeo_code || '').trim();
      const pName = String(user.peeo_name || user.name || '').toUpperCase();
      const pSchools = (window.ELECTION_2026_SCHOOLS || []).filter(s => {
        if (pCode && (String(s.peeo_code) === pCode || String(s.shala_darpan_code) === pCode)) return true;
        if (pName && String(s.peeo_name || '').toUpperCase().includes(pName.replace('PEEO ', ''))) return true;
        if (user.schools && user.schools.some(sub => String(sub.shala_darpan_code) === String(s.shala_darpan_code))) return true;
        return false;
      });
      badge.textContent = pSchools.length || 1;
    } else {
      badge.textContent = '1';
    }
  }

  if (isAdmin) {
    renderElectionAdminView(container);
  } else if (user && user.role === 'school') {
    renderElectionSchoolView(container, user);
  } else if (user && user.role === 'peeo') {
    renderElectionPeeoView(container, user);
  } else {
    renderElectionAdminView(container);
  }
}

// 1. Dedicated View for School Login (ONLY Their School)
function renderElectionSchoolView(container, user) {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const uCode = String(user.shala_darpan_code || user.dise_code || '').trim();
  const mySchool = schools.find(s => String(s.shala_darpan_code) === uCode);

  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  if (!mySchool) {
    container.innerHTML = `
      <div style="background:#fff; border-radius:12px; padding:2.5rem 1.5rem; text-align:center; box-shadow:0 4px 14px rgba(0,0,0,0.06); max-width:650px; margin:2rem auto">
        <i class="fas fa-info-circle fa-3x" style="color:#0284c7; margin-bottom:1rem"></i>
        <h3 style="color:#0f172a; margin-bottom:0.5rem">मतदान केंद्र भौतिक सत्यापन (प्रपत्र-3)</h3>
        <p style="color:#64748b; font-size:0.95rem; line-height:1.5">
          आपके विद्यालय (कोड: ${uCode || 'अज्ञात'}) में पंचायती राज आम चुनाव 2026 हेतु कोई मतदान केंद्र स्थापित नहीं है।<br>
          यह प्रपत्र केवल भिनाय ब्लॉक के <strong>30 ग्राम पंचायत मुख्यालय विद्यालयों</strong> (116 बूथ) के लिए लागू है।
        </p>
      </div>
    `;
    return;
  }

  const sub = submissions[mySchool.shala_darpan_code];
  const isSubmitted = !!sub;

  container.innerHTML = `
    <!-- Top School Personalized Banner -->
    <div style="background:linear-gradient(135deg, #1e3a8a, #0f172a); color:#fff; border-radius:12px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 4px 14px rgba(15,23,42,0.25)">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px">
            🏛️ पंचायती राज आम चुनाव 2026 • प्रपत्र-3 भौतिक सत्यापन
          </div>
          <h2 style="font-size:1.4rem; font-weight:900; margin:4px 0">
            ${mySchool.school_name}
          </h2>
          <div style="font-size:0.86rem; opacity:0.9">
            <strong>ग्राम पंचायत:</strong> ${mySchool.panchayat_name} | <strong>शाला दर्पण कोड:</strong> <code>${mySchool.shala_darpan_code}</code> | <strong>PEEO:</strong> ${mySchool.peeo_name}
          </div>
        </div>
        <div>
          ${isSubmitted 
            ? '<span style="background:#15803d; color:#fff; font-size:0.9rem; font-weight:800; padding:6px 14px; border-radius:30px; display:inline-flex; align-items:center; gap:6px"><i class="fas fa-check-circle"></i> ✓ प्रपत्र सफलतापूर्वक सत्यापित</span>' 
            : '<span style="background:#b91c1c; color:#fff; font-size:0.9rem; font-weight:800; padding:6px 14px; border-radius:30px; display:inline-flex; align-items:center; gap:6px"><i class="fas fa-clock"></i> ⚠️ भौतिक सत्यापन लंबित (बाकी)</span>'}
        </div>
      </div>
    </div>

    <!-- Main Card for This School -->
    <div style="background:#fff; border:2px solid ${isSubmitted ? '#86efac' : '#93c5fd'}; border-radius:12px; padding:1.5rem; box-shadow:0 4px 14px rgba(0,0,0,0.06); margin-bottom:1.5rem">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:1rem; margin-bottom:1rem">
        <div>
          <h3 style="font-size:1.15rem; font-weight:900; color:#0f172a; margin:0">
            <i class="fas fa-vote-yea text-primary"></i> इस विद्यालय में स्थापित मतदान केंद्र एवं बूथ (${mySchool.booth_count} बूथ)
          </h3>
          <div style="font-size:0.85rem; color:#64748b; margin-top:3px">
            संस्था प्रधान: <strong>${mySchool.principal_name}</strong> (मो. ${mySchool.principal_mobile})
          </div>
        </div>
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap">
          <a href="election_form.html?code=${mySchool.shala_darpan_code}" target="_blank" class="btn btn-primary" style="font-weight:800; font-size:0.95rem; padding:0.6rem 1.4rem; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none">
            <i class="fas ${isSubmitted ? 'fa-edit' : 'fa-file-signature'}"></i> ${isSubmitted ? 'प्रपत्र संशोधित करें' : '📝 प्रपत्र-3 भौतिक सत्यापन भरें'}
          </a>
          <a href="election_form.html?code=${mySchool.shala_darpan_code}&autoclick=pdf" target="_blank" class="btn btn-success" style="font-weight:800; font-size:0.95rem; padding:0.6rem 1.2rem; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none">
            <i class="fas fa-file-pdf"></i> 🖨️ A4 PDF मुद्रित करें
          </a>
        </div>
      </div>

      <!-- Booths List Table -->
      <div class="table-responsive" style="margin-top:1rem">
        <table class="table table-bordered table-sm" style="font-size:0.86rem; margin-bottom:0">
          <thead style="background:#f1f5f9; color:#1e293b">
            <tr>
              <th style="width:70px">बूथ सं.</th>
              <th>मतदान केंद्र भवन व कक्ष विवरण (P-3)</th>
              <th style="width:90px">वार्ड</th>
              <th>व्यवस्थाएं (विद्युत/फर्नीचर/द्वार/लाइनिंग)</th>
              <th>अधिकृत BLO प्रगणक (नाम / पद / मो.)</th>
            </tr>
          </thead>
          <tbody>
            ${mySchool.booths.map(b => {
              const bd = sub?.booth_details?.[b.booth_no] || {};
              const bloName = bd.blo_name || 'BLO विवरण प्रपत्र में भरें';
              const bloPost = bd.blo_post || '';
              const bloMob = bd.blo_mobile || '';
              return `
                <tr>
                  <td style="font-weight:800; text-align:center; color:#0284c7; background:#f8fafc">#${b.booth_no}</td>
                  <td>
                    <strong>${b.room_hi}</strong>
                    <div style="font-size:0.75rem; color:#64748b">${b.building_hi}</div>
                  </td>
                  <td style="text-align:center; font-weight:700">${b.ward || '-'}</td>
                  <td>
                    <span style="display:inline-block; font-size:0.75rem; background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px">विद्युत: ${bd.light !== false ? 'हाँ' : 'नहीं'}</span>
                    <span style="display:inline-block; font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; margin-left:3px">फर्नीचर: ${bd.furniture !== false ? 'हाँ' : 'नहीं'}</span>
                    <span style="display:inline-block; font-size:0.75rem; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; margin-left:3px">द्वार: ${bd.door !== false ? 'हाँ' : 'नहीं'}</span>
                  </td>
                  <td>
                    <strong>${bloName}</strong> ${bloPost ? `<small>(${bloPost})</small>` : ''}
                    ${bloMob ? `<div style="font-size:0.75rem; color:#059669"><i class="fas fa-phone"></i> ${bloMob}</div>` : ''}
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

let ELECTION_PEEO_VIEW_TAB = 'schools'; // 'schools' | 'booths'

function setElectionPeeoTab(tab) {
  ELECTION_PEEO_VIEW_TAB = tab;
  renderElectionView();
}

function downloadPeeoBoothsExcel() {
  const user = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
  if (!user) return;
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const peeoCode = String(user.shala_darpan_code || user.peeo_code || '').trim();
  const peeoName = String(user.peeo_name || user.name || '').toUpperCase();

  const mySchools = schools.filter(s => {
    if (peeoCode && (String(s.peeo_code) === peeoCode || String(s.shala_darpan_code) === peeoCode)) return true;
    if (peeoName && String(s.peeo_name || '').toUpperCase().includes(peeoName.replace('PEEO ', ''))) return true;
    if (user.schools && user.schools.some(sub => String(sub.shala_darpan_code) === String(s.shala_darpan_code))) return true;
    return false;
  });

  const allPeeoBooths = mySchools.flatMap(s => (s.booths || []).map(b => ({ ...b, school_name: s.school_name, peeo_name: s.peeo_name })));
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const headers = [
    'बूथ सं.', 'ग्राम पंचायत', 'विद्यालय का नाम', 'शाला दर्पण कोड', 'कमरा/कक्ष विवरण (P-3)',
    'वार्ड', 'विद्युत/पंखा', 'फर्नीचर', 'पृथक द्वार', 'चूना लाइनिंग',
    'BLO प्रगणक नाम', 'पद', 'मोबाइल', 'सत्यापन स्थिति'
  ];
  const rows = [headers];
  allPeeoBooths.forEach(b => {
    const sub = submissions[b.school_code];
    const bd = sub?.booth_details?.[b.booth_no] || {};
    const isSub = !!sub;
    rows.push([
      b.booth_no,
      b.panchayat_hi,
      b.school_name || b.building_hi,
      b.school_code,
      b.room_hi,
      b.ward || '-',
      bd.light !== false ? 'हाँ' : 'नहीं',
      bd.furniture !== false ? 'हाँ' : 'नहीं',
      bd.door !== false ? 'हाँ' : 'नहीं',
      bd.lining !== false ? 'हाँ' : 'नहीं',
      bd.blo_name || '',
      bd.blo_post || '',
      bd.blo_mobile || '',
      isSub ? 'सत्यापित' : 'लंबित'
    ]);
  });

  const filename = `${peeoName.replace(/\s+/g, '_')}_Election_2026_Booths`;
  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Booths");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    if (typeof showToast === 'function') showToast(`📥 ${peeoName} के समस्त बूथ Excel (.xlsx) में डाउनलोड हो गए!`, 'success');
  } else {
    exportTableDataToHtmlExcel(rows, `${filename}.xls`);
  }
}

// 2. Dedicated View for PEEO Login (All Schools and Booths in their jurisdiction)
function renderElectionPeeoView(container, user) {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const peeoCode = String(user.shala_darpan_code || user.peeo_code || '').trim();
  const peeoName = String(user.peeo_name || user.name || '').toUpperCase();

  const mySchools = schools.filter(s => {
    if (peeoCode && (String(s.peeo_code) === peeoCode || String(s.shala_darpan_code) === peeoCode)) return true;
    if (peeoName && String(s.peeo_name || '').toUpperCase().includes(peeoName.replace('PEEO ', ''))) return true;
    if (user.schools && user.schools.some(sub => String(sub.shala_darpan_code) === String(s.shala_darpan_code))) return true;
    return false;
  });

  const allPeeoBooths = mySchools.flatMap(s => (s.booths || []).map(b => ({ ...b, school_name: s.school_name, peeo_name: s.peeo_name })));

  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  if (mySchools.length === 0) {
    container.innerHTML = `
      <div style="background:#fff; border-radius:12px; padding:2.5rem 1.5rem; text-align:center; box-shadow:0 4px 14px rgba(0,0,0,0.06); max-width:650px; margin:2rem auto">
        <i class="fas fa-info-circle fa-3x" style="color:#0284c7; margin-bottom:1rem"></i>
        <h3 style="color:#0f172a; margin-bottom:0.5rem">मतदान केंद्र भौतिक सत्यापन (प्रपत्र-3)</h3>
        <p style="color:#64748b; font-size:0.95rem; line-height:1.5">
          आपके PEEO परिक्षेत्र में पंचायती राज आम चुनाव 2026 हेतु कोई मतदान केंद्र स्थापित नहीं पाया गया।
        </p>
      </div>
    `;
    return;
  }

  const submittedCount = mySchools.filter(s => !!submissions[s.shala_darpan_code]).length;
  const pendingCount = mySchools.length - submittedCount;

  container.innerHTML = `
    <!-- Top PEEO Banner -->
    <div style="background:linear-gradient(135deg, #1e3a8a, #0f172a); color:#fff; border-radius:12px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 4px 14px rgba(15,23,42,0.25)">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px">
            🏛️ PEEO परिक्षेत्र चुनाव मॉनिटरिंग • पंचायती राज आम चुनाव 2026
          </div>
          <h2 style="font-size:1.4rem; font-weight:900; margin:4px 0">
            ${peeoName} (${mySchools.length} विद्यालय • ${allPeeoBooths.length} मतदान बूथ)
          </h2>
          <div style="font-size:0.86rem; opacity:0.9">
            कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय | <strong>जिला: अजमेर (AJMER)</strong>
          </div>
        </div>
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap">
          <span style="background:#0284c7; color:#fff; font-size:0.85rem; font-weight:800; padding:4px 12px; border-radius:20px">
            🗳️ कुल बूथ: ${allPeeoBooths.length}
          </span>
          <span style="background:#15803d; color:#fff; font-size:0.85rem; font-weight:800; padding:4px 12px; border-radius:20px">
            ✓ सत्यापित: ${submittedCount}
          </span>
          <span style="background:#b91c1c; color:#fff; font-size:0.85rem; font-weight:800; padding:4px 12px; border-radius:20px">
            ⚠️ लंबित: ${pendingCount}
          </span>
        </div>
      </div>
    </div>

    <!-- Sub-tab Navigation Bar for PEEO -->
    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:0.75rem 1rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
      <div class="btn-group" role="group">
        <button type="button" class="btn btn-sm ${ELECTION_PEEO_VIEW_TAB === 'schools' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setElectionPeeoTab('schools')" style="font-weight:700">
          <i class="fas fa-school"></i> 1. विद्यालयवार प्रपत्र स्थिति (${mySchools.length} विद्यालय)
        </button>
        <button type="button" class="btn btn-sm ${ELECTION_PEEO_VIEW_TAB === 'booths' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setElectionPeeoTab('booths')" style="font-weight:700">
          <i class="fas fa-vote-yea"></i> 2. समस्त मतदान कक्ष / बूथ सूची (${allPeeoBooths.length} बूथ)
        </button>
      </div>
      <div>
        <button type="button" class="btn btn-sm btn-success" onclick="downloadPeeoBoothsExcel()" style="font-weight:700">
          <i class="fas fa-file-excel"></i> 📥 इस PEEO के बूथ Excel (.xlsx)
        </button>
      </div>
    </div>

    <!-- PEEO Content Area -->
    ${ELECTION_PEEO_VIEW_TAB === 'schools' ? `
      <!-- PEEO Schools Cards Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1rem">
        ${mySchools.map((s, idx) => {
          const sub = submissions[s.shala_darpan_code];
          const isSubmitted = !!sub;
          return `
            <div style="background:#fff; border:1px solid ${isSubmitted ? '#86efac' : '#cbd5e1'}; border-top:4px solid ${isSubmitted ? '#16a34a' : '#0284c7'}; border-radius:8px; padding:1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem">
                  <span style="font-size:0.75rem; font-weight:800; color:#0369a1; background:#e0f2fe; padding:2px 6px; border-radius:4px">#${idx + 1}</span>
                  ${isSubmitted 
                    ? '<span style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px"><i class="fas fa-check-circle"></i> ✓ सत्यापित</span>' 
                    : '<span style="background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px"><i class="fas fa-clock"></i> लंबित</span>'}
                </div>
                <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin-bottom:0.25rem; line-height:1.3">
                  ${s.school_name}
                </h3>
                <div style="font-size:0.82rem; color:#475569; margin-bottom:0.6rem">
                  <strong>ग्राम पंचायत:</strong> ${s.panchayat_name} | <strong>कोड:</strong> <code>${s.shala_darpan_code}</code>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.6rem 0.75rem; font-size:0.78rem; margin-bottom:0.85rem">
                  <div><strong>संस्था प्रधान:</strong> ${s.principal_name} (${s.principal_mobile})</div>
                  <div style="color:#0369a1; font-weight:700; margin-top:3px">
                    🗳️ कुल मतदान कक्ष / बूथ: <strong>${s.booth_count}</strong>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px">
                    ${(s.booths || []).map(b => `<span style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; padding:1px 6px; border-radius:10px; font-weight:700">बूथ #${b.booth_no}</span>`).join('')}
                  </div>
                </div>
              </div>
              <div style="display:flex; gap:0.5rem">
                <a href="election_form.html?code=${s.shala_darpan_code}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:0.35rem">
                  <i class="fas ${isSubmitted ? 'fa-edit' : 'fa-file-signature'}"></i> ${isSubmitted ? 'संशोधन' : 'प्रपत्र भरें'}
                </a>
                <a href="election_form.html?code=${s.shala_darpan_code}&autoclick=pdf" target="_blank" class="btn btn-success btn-sm" style="font-weight:700; display:inline-flex; align-items:center; gap:0.3rem">
                  <i class="fas fa-file-pdf"></i> PDF
                </a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <!-- PEEO All Booths Detailed Table -->
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
        <div class="table-responsive">
          <table class="table table-hover table-bordered table-sm mb-0" style="font-size:0.85rem">
            <thead style="background:#0f172a; color:#fff">
              <tr>
                <th style="width:60px; text-align:center">बूथ सं.</th>
                <th>विद्यालय का नाम</th>
                <th>मतदान कक्ष / कमरा विवरण (प्रपत्र-3)</th>
                <th style="width:70px; text-align:center">वार्ड</th>
                <th style="width:70px; text-align:center">विद्युत/पंखा</th>
                <th style="width:70px; text-align:center">फर्नीचर</th>
                <th style="width:70px; text-align:center">पृथक द्वार</th>
                <th style="width:70px; text-align:center">चूना लाइनिंग</th>
                <th>अधिकृत BLO प्रगणक (नाम, पद, मो.)</th>
                <th style="width:80px; text-align:center">स्थिति</th>
                <th style="width:80px; text-align:center">एक्शन</th>
              </tr>
            </thead>
            <tbody>
              ${allPeeoBooths.map(b => {
                const sub = submissions[b.school_code];
                const bd = sub?.booth_details?.[b.booth_no] || {};
                const isSub = !!sub;
                const bloName = bd.blo_name || '';
                const bloPost = bd.blo_post || '';
                const bloMob = bd.blo_mobile || '';
                return `
                  <tr style="background:${isSub ? '#f0fdf4' : '#fff'}">
                    <td style="text-align:center; font-weight:800; color:#0284c7; background:#f8fafc">#${b.booth_no}</td>
                    <td><strong>${b.school_name || b.building_hi}</strong> <br><small style="color:#64748b">कोड: ${b.school_code}</small></td>
                    <td>${b.room_hi}</td>
                    <td style="text-align:center; font-weight:700">${b.ward || '-'}</td>
                    <td style="text-align:center">${bd.light !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                    <td style="text-align:center">${bd.furniture !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                    <td style="text-align:center">${bd.door !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                    <td style="text-align:center">${bd.lining !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                    <td>
                      ${bloName ? `<strong>${bloName}</strong> <small>(${bloPost})</small> ${bloMob ? `<br><a href="tel:${bloMob}" style="color:#059669">${bloMob}</a>` : ''}` : '<span style="color:#94a3b8">--</span>'}
                    </td>
                    <td style="text-align:center">
                      ${isSub 
                        ? '<span style="background:#dcfce7; color:#15803d; font-size:0.72rem; font-weight:800; padding:2px 6px; border-radius:10px">सत्यापित</span>' 
                        : '<span style="background:#fee2e2; color:#b91c1c; font-size:0.72rem; font-weight:800; padding:2px 6px; border-radius:10px">लंबित</span>'}
                    </td>
                    <td style="text-align:center">
                      <a href="election_form.html?code=${b.school_code}" target="_blank" class="btn btn-sm btn-outline-primary" style="padding:2px 6px; font-size:0.75rem" title="प्रपत्र खोलें">
                        <i class="fas fa-edit"></i>
                      </a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;
}

// 3. Admin View for CBEO / Jitendra (Full Block 33 Schools Hub)
function renderElectionAdminView(container) {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const booths = window.ELECTION_2026_BOOTHS || [];

  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const submittedCount = Object.keys(submissions).length;
  const pendingCount = Math.max(0, schools.length - submittedCount);
  const totalBooths = booths.length;
  const customCols = getElectionCustomColumns();

  container.innerHTML = `
    <!-- Top Active Demand Selector Bar (Matching Saman Pariksha Aesthetic) -->
    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:0.75rem 1rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
      <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap">
        <strong style="color:#0f172a; font-size:0.9rem; display:inline-flex; align-items:center; gap:0.35rem">
          <i class="fas fa-layer-group text-primary"></i> सक्रिय प्रपत्र मांग:
        </strong>
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm ${ELECTION_ACTIVE_FORM_TAB === 'form_p3' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setElectionActiveFormTab('form_p3')" style="font-weight:700">
            <i class="fas fa-file-alt"></i> 1. प्रपत्र-3 भौतिक सत्यापन (33 स्कूल)
          </button>
          <button type="button" class="btn btn-sm ${ELECTION_ACTIVE_FORM_TAB === 'booth_116' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setElectionActiveFormTab('booth_116')" style="font-weight:700">
            <i class="fas fa-vote-yea"></i> 2. 116 बूथ-वार BLO प्रगणक सत्यापन
          </button>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap">
        <span style="font-size:0.82rem; font-weight:700; color:#475569">विद्यालय प्रकार:</span>
        <select id="election-scope-select" class="form-select form-select-sm" onchange="onElectionScopeFilterChange(this.value)" style="width:auto; font-weight:700; border-color:#94a3b8">
          <option value="all" ${ELECTION_SCOPE_FILTER === 'all' ? 'selected' : ''}>🏛️ सभी 33 मतदान केंद्र विद्यालय</option>
          <option value="peeo_only" ${ELECTION_SCOPE_FILTER === 'peeo_only' ? 'selected' : ''}>🏛️ केवल 25 PEEO मुख्यालय विद्यालय</option>
          <option value="non_peeo" ${ELECTION_SCOPE_FILTER === 'non_peeo' ? 'selected' : ''}>🌟 केवल 8 गैर-PEEO / अधीनस्थ विद्यालय</option>
        </select>
        <button type="button" class="btn btn-sm btn-outline-dark" onclick="openElectionColumnManagerModal()" style="font-weight:700" title="नए सत्यापन कॉलम जोड़ें या हटाएं">
          <i class="fas fa-columns text-primary"></i> कॉलम प्रबंधन (${customCols.length} अतिरिक्त)
        </button>
      </div>
    </div>

    <!-- Official Broadcast & Action Center (Blue Card from Pic) -->
    <div style="background:linear-gradient(135deg, #1e3a8a, #0f172a); border-radius:10px; padding:1rem 1.25rem; margin-bottom:1.25rem; color:#fff; box-shadow:0 4px 12px rgba(15,23,42,0.2)">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.85rem">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem">
            <span style="background:#ef4444; color:#fff; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:4px; text-transform:uppercase">
              📢 आधिकारिक प्रसारण केंद्र
            </span>
            <span style="font-size:0.85rem; color:#93c5fd; font-weight:600">
              जिला: अजमेर (AJMER) | ब्लॉक: भिनाय
            </span>
          </div>
          <h3 style="font-size:1.15rem; font-weight:900; margin:4px 0 2px 0">
            पंचायती राज चुनाव 2026: मतदान केन्द्र भौतिक सत्यापन रिपोर्ट (प्रपत्र-3)
          </h3>
          <p style="font-size:0.82rem; color:#cbd5e1; margin:0">
            लंबित विद्यालयों को एक क्लिक में WhatsApp/Telegram रिमाइंडर भेजें, एक्सेल डाउनलोड करें व कॉलम प्रबंधित करें।
          </p>
        </div>
        <div style="display:flex; gap:0.45rem; flex-wrap:wrap">
          <button type="button" class="btn btn-warning btn-sm" onclick="openElectionBroadcastModal()" style="font-weight:800; color:#0f172a">
            <i class="fas fa-bullhorn"></i> प्रसारण केंद्र
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="openElectionQuickEntryModal()" style="font-weight:800; background:#38bdf8; border-color:#0284c7; color:#0f172a">
            <i class="fas fa-bolt"></i> त्वरित प्रविष्टि दर्ज
          </button>
          <button type="button" class="btn btn-success btn-sm" onclick="downloadElectionSummaryExcel()" style="font-weight:800">
            <i class="fas fa-file-excel"></i> 📥 33 विद्यालय समेकित Excel (.xlsx)
          </button>
          <button type="button" class="btn btn-light btn-sm" onclick="downloadElection116BoothsExcel()" style="font-weight:800; color:#0f172a">
            <i class="fas fa-table text-success"></i> 📊 116 बूथ Excel (.xlsx)
          </button>
          <button type="button" class="btn btn-outline-light btn-sm" onclick="publishElectionDemandLive()" style="font-weight:700">
            <i class="fas fa-share"></i> लाइव मांग जारी
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats Metric Cards -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.25rem">
      <div style="background:#fff; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
        <div style="font-size:0.75rem; font-weight:700; color:#64748b">कुल लक्षित विद्यालय</div>
        <div style="font-size:1.5rem; font-weight:900; color:#0f172a; margin-top:2px">${schools.length} <span style="font-size:0.78rem; font-weight:normal; color:#475569">(25 PEEO + 8 अन्य)</span></div>
      </div>
      <div style="background:#fff; border:1px solid #e2e8f0; border-left:4px solid #8b5cf6; border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
        <div style="font-size:0.75rem; font-weight:700; color:#64748b">कुल मतदान कक्ष / बूथ</div>
        <div style="font-size:1.5rem; font-weight:900; color:#6d28d9; margin-top:2px">${totalBooths}</div>
      </div>
      <div style="background:#fff; border:1px solid #e2e8f0; border-left:4px solid #16a34a; border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
        <div style="font-size:0.75rem; font-weight:700; color:#64748b">सत्यापित एवं सबमिट</div>
        <div style="font-size:1.5rem; font-weight:900; color:#15803d; margin-top:2px">${submittedCount}</div>
      </div>
      <div style="background:#fff; border:1px solid #e2e8f0; border-left:4px solid #ef4444; border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
        <div style="font-size:0.75rem; font-weight:700; color:#64748b">सत्यापन शेष (लंबित)</div>
        <div style="font-size:1.5rem; font-weight:900; color:#b91c1c; margin-top:2px">${pendingCount}</div>
      </div>
    </div>

    <!-- View Mode Switcher & Filter Toolbar -->
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem 1.1rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem">
      <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:260px">
        <i class="fas fa-search text-muted"></i>
        <input type="text" id="election-search-input" value="${ELECTION_SEARCH_QUERY}" class="form-control" placeholder="विद्यालय का नाम, ग्राम पंचायत, शाला दर्पण कोड या बूथ से खोजें..." oninput="onElectionSearchChange(this.value)" style="border:1px solid #cbd5e1; border-radius:6px; padding:0.45rem 0.75rem; font-size:0.88rem; width:100%">
      </div>
      <div style="display:flex; gap:0.45rem; flex-wrap:wrap">
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm ${ELECTION_VIEW_MODE === 'grid' ? 'btn-dark' : 'btn-outline-secondary'}" onclick="setElectionViewMode('grid')" title="कार्ड दृश्य"><i class="fas fa-th-large"></i> कार्ड</button>
          <button type="button" class="btn btn-sm ${ELECTION_VIEW_MODE === 'table_30' ? 'btn-dark' : 'btn-outline-secondary'}" onclick="setElectionViewMode('table_30')" title="30 स्कूल प्रपत्र मॉनिटरिंग टेबल"><i class="fas fa-table"></i> 30 स्कूल मॉनिटरिंग</button>
          <button type="button" class="btn btn-sm ${ELECTION_VIEW_MODE === 'table_116' ? 'btn-dark' : 'btn-outline-secondary'}" onclick="setElectionViewMode('table_116')" title="116 बूथ विस्तृत मॉनिटरिंग"><i class="fas fa-list-ol"></i> 116 बूथ विस्तृत</button>
        </div>
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm ${ELECTION_FILTER_STATUS === 'all' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="setElectionFilter('all')">सभी (${schools.length})</button>
          <button type="button" class="btn btn-sm ${ELECTION_FILTER_STATUS === 'submitted' ? 'btn-success' : 'btn-outline-secondary'}" onclick="setElectionFilter('submitted')">पूर्ण (${submittedCount})</button>
          <button type="button" class="btn btn-sm ${ELECTION_FILTER_STATUS === 'pending' ? 'btn-danger' : 'btn-outline-secondary'}" onclick="setElectionFilter('pending')">लंबित (${pendingCount})</button>
        </div>
      </div>
    </div>

    <!-- Active Content Area -->
    <div id="election-dynamic-content-area"></div>
  `;

  renderElectionDynamicContent();
}

function setElectionActiveFormTab(tab) {
  ELECTION_ACTIVE_FORM_TAB = tab;
  if (tab === 'booth_116') {
    ELECTION_VIEW_MODE = 'table_116';
  } else {
    ELECTION_VIEW_MODE = 'grid';
  }
  renderElectionView();
}

function onElectionScopeFilterChange(scope) {
  ELECTION_SCOPE_FILTER = scope;
  renderElectionDynamicContent();
}

function setElectionViewMode(mode) {
  ELECTION_VIEW_MODE = mode;
  renderElectionDynamicContent();
}

function onElectionSearchChange(val) {
  ELECTION_SEARCH_QUERY = (val || '').toLowerCase().trim();
  renderElectionDynamicContent();
}

function setElectionFilter(st) {
  ELECTION_FILTER_STATUS = st;
  renderElectionView();
}

function getFilteredElectionSchools() {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  return schools.filter(s => {
    const isSub = !!submissions[s.shala_darpan_code];
    if (ELECTION_FILTER_STATUS === 'submitted' && !isSub) return false;
    if (ELECTION_FILTER_STATUS === 'pending' && isSub) return false;

    const isSpecial8 = ["485030", "488897", "488947", "221774", "410859", "221770", "221778", "221753"].includes(s.shala_darpan_code);
    if (ELECTION_SCOPE_FILTER === 'peeo_only' && isSpecial8) return false;
    if (ELECTION_SCOPE_FILTER === 'non_peeo' && !isSpecial8) return false;

    if (ELECTION_SEARCH_QUERY) {
      const q = ELECTION_SEARCH_QUERY;
      const matchName = s.school_name.toLowerCase().includes(q);
      const matchCode = s.shala_darpan_code.toLowerCase().includes(q);
      const matchGp = s.panchayat_name.toLowerCase().includes(q);
      const matchPeeo = (s.peeo_name || '').toLowerCase().includes(q);
      const matchBooth = s.booths?.some(b => String(b.booth_no).includes(q) || b.room_hi?.toLowerCase().includes(q));
      return matchName || matchCode || matchGp || matchPeeo || matchBooth;
    }
    return true;
  });
}

function renderElectionDynamicContent() {
  const container = document.getElementById('election-dynamic-content-area');
  if (!container) return;

  if (ELECTION_VIEW_MODE === 'table_30') {
    renderElection30Table(container);
  } else if (ELECTION_VIEW_MODE === 'table_116') {
    renderElection116BoothsTable(container);
  } else {
    renderElectionSchoolsGrid(container);
  }
}

function renderElectionSchoolsGrid(container) {
  const filtered = getFilteredElectionSchools();
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  if (filtered.length === 0) {
    container.innerHTML = '<div style="background:#fff; border-radius:8px; padding:2.5rem; text-align:center; color:#64748b; font-weight:700">कोई विद्यालय नहीं मिला।</div>';
    return;
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:1rem">
      ${filtered.map((s, idx) => {
        const sub = submissions[s.shala_darpan_code];
        const isSubmitted = !!sub;
        const isSpecial8 = ["485030", "488897", "488947", "221774", "410859", "221770", "221778", "221753"].includes(s.shala_darpan_code);

        return `
          <div style="background:#fff; border:1px solid ${isSubmitted ? '#86efac' : '#e2e8f0'}; border-top:4px solid ${isSubmitted ? '#16a34a' : '#0284c7'}; border-radius:8px; padding:1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem; gap:0.4rem; flex-wrap:wrap">
                <div>
                  <span style="font-size:0.75rem; font-weight:800; color:#0369a1; background:#e0f2fe; padding:2px 6px; border-radius:4px">#${idx + 1}</span>
                  ${isSpecial8 ? '<span style="font-size:0.7rem; font-weight:800; color:#92400e; background:#fef3c7; padding:2px 6px; border-radius:4px; margin-left:4px">🌟 अधीनस्थ / गैर-PEEO मुख्यालय</span>' : '<span style="font-size:0.7rem; font-weight:800; color:#1e40af; background:#dbeafe; padding:2px 6px; border-radius:4px; margin-left:4px">🏛️ PEEO मुख्यालय</span>'}
                </div>
                ${isSubmitted 
                  ? '<span style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px"><i class="fas fa-check-circle"></i> ✓ सत्यापित</span>' 
                  : '<span style="background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px"><i class="fas fa-clock"></i> लंबित</span>'}
              </div>

              <h3 style="font-size:1.02rem; font-weight:900; color:#0f172a; margin-bottom:0.25rem; line-height:1.3">
                ${s.school_name}
              </h3>

              <div style="font-size:0.82rem; color:#475569; margin-bottom:0.6rem">
                <strong>ग्राम पंचायत:</strong> ${s.panchayat_name} | <strong>कोड:</strong> <code>${s.shala_darpan_code}</code>
              </div>

              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.6rem 0.75rem; font-size:0.78rem; margin-bottom:0.85rem">
                <div><strong>PEEO:</strong> ${s.peeo_name}</div>
                <div><strong>संस्था प्रधान:</strong> ${s.principal_name} (${s.principal_mobile})</div>
                <div style="color:#0369a1; font-weight:700; margin-top:2px">
                  🗳️ कुल मतदान बूथ: <strong>${s.booth_count}</strong>
                </div>
                ${sub?.school_email ? `<div style="color:#15803d; margin-top:2px">📧 ईमेल: <strong>${sub.school_email}</strong></div>` : ''}
              </div>
            </div>

            <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
              <a href="election_form.html?code=${s.shala_darpan_code}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:0.35rem">
                <i class="fas ${isSubmitted ? 'fa-edit' : 'fa-file-signature'}"></i> ${isSubmitted ? 'संशोधन करें' : '📝 प्रपत्र भरें'}
              </a>
              <button type="button" class="btn btn-light btn-sm" onclick="openElectionQuickEntryModal('${s.shala_darpan_code}')" style="font-weight:700; border:1px solid #cbd5e1" title="त्वरित संपादन">
                <i class="fas fa-bolt text-warning"></i>
              </button>
              <a href="election_form.html?code=${s.shala_darpan_code}&autoclick=pdf" target="_blank" class="btn btn-success btn-sm" style="font-weight:700; display:inline-flex; align-items:center; gap:0.3rem">
                <i class="fas fa-file-pdf"></i> A4 PDF
              </a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 30 Schools Monitoring Table View
function renderElection30Table(container) {
  const filtered = getFilteredElectionSchools();
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  container.innerHTML = `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
      <div class="table-responsive">
        <table class="table table-hover table-bordered table-sm mb-0" style="font-size:0.86rem">
          <thead style="background:#0f172a; color:#fff">
            <tr>
              <th style="width:50px; text-align:center">क्र.सं.</th>
              <th style="width:100px">शाला दर्पण कोड</th>
              <th>विद्यालय का नाम</th>
              <th>ग्राम पंचायत</th>
              <th>PEEO परिक्षेत्र</th>
              <th style="width:80px; text-align:center">कुल बूथ</th>
              <th>संस्था प्रधान</th>
              <th>मोबाइल</th>
              <th style="width:110px; text-align:center">सत्यापन स्थिति</th>
              <th style="width:150px; text-align:center">कार्यवाही</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((s, idx) => {
              const sub = submissions[s.shala_darpan_code];
              const isSub = !!sub;
              return `
                <tr style="background:${isSub ? '#f0fdf4' : '#fff'}">
                  <td style="text-align:center; font-weight:700">${idx + 1}</td>
                  <td style="font-family:monospace; font-weight:800; color:#1e3a8a">${s.shala_darpan_code}</td>
                  <td><strong>${s.school_name}</strong></td>
                  <td>${s.panchayat_name}</td>
                  <td>${s.peeo_name}</td>
                  <td style="text-align:center; font-weight:900; color:#0369a1">${s.booth_count}</td>
                  <td>${s.principal_name}</td>
                  <td><a href="tel:${s.principal_mobile}" style="color:#059669; font-weight:700; text-decoration:none">${s.principal_mobile}</a></td>
                  <td style="text-align:center">
                    ${isSub 
                      ? '<span style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px">✓ सत्यापित</span>' 
                      : '<span style="background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px">लंबित</span>'}
                  </td>
                  <td style="text-align:center">
                    <a href="election_form.html?code=${s.shala_darpan_code}" target="_blank" class="btn btn-sm btn-outline-primary" style="padding:2px 6px; font-size:0.78rem" title="प्रपत्र खोलें">
                      <i class="fas fa-edit"></i>
                    </a>
                    <a href="election_form.html?code=${s.shala_darpan_code}&autoclick=pdf" target="_blank" class="btn btn-sm btn-outline-success" style="padding:2px 6px; font-size:0.78rem" title="PDF">
                      <i class="fas fa-file-pdf"></i>
                    </a>
                    <button type="button" class="btn btn-sm btn-outline-warning" onclick="openElectionQuickEntryModal('${s.shala_darpan_code}')" style="padding:2px 6px; font-size:0.78rem" title="त्वरित प्रविष्टि">
                      <i class="fas fa-bolt"></i>
                    </button>
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

// 116 Booths Detailed Monitoring Table View
function renderElection116BoothsTable(container) {
  const booths = window.ELECTION_2026_BOOTHS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const customCols = getElectionCustomColumns();

  const filteredBooths = booths.filter(b => {
    const isSub = !!submissions[b.school_code];
    if (ELECTION_FILTER_STATUS === 'submitted' && !isSub) return false;
    if (ELECTION_FILTER_STATUS === 'pending' && isSub) return false;

    if (ELECTION_SEARCH_QUERY) {
      const q = ELECTION_SEARCH_QUERY;
      const mNo = String(b.booth_no).includes(q);
      const mRoom = (b.room_hi || '').toLowerCase().includes(q);
      const mBldg = (b.building_hi || '').toLowerCase().includes(q);
      const mGp = (b.panchayat_hi || '').toLowerCase().includes(q);
      const mCode = (b.school_code || '').toLowerCase().includes(q);
      return mNo || mRoom || mBldg || mGp || mCode;
    }
    return true;
  });

  container.innerHTML = `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
      <div class="table-responsive">
        <table class="table table-hover table-bordered table-sm mb-0" style="font-size:0.83rem">
          <thead style="background:#1e3a8a; color:#fff">
            <tr>
              <th style="width:60px; text-align:center">बूथ सं.</th>
              <th>ग्राम पंचायत</th>
              <th>मतदान भवन व कक्ष विवरण</th>
              <th style="width:70px; text-align:center">वार्ड</th>
              <th style="width:85px">शा.दा. कोड</th>
              <th style="width:70px; text-align:center">विद्युत/पंखा</th>
              <th style="width:70px; text-align:center">फर्नीचर</th>
              <th style="width:70px; text-align:center">पृथक द्वार</th>
              <th style="width:70px; text-align:center">चूना लाइनिंग</th>
              ${customCols.map(c => `<th>${c.name}</th>`).join('')}
              <th>अधिकृत BLO प्रगणक</th>
              <th style="width:80px; text-align:center">स्थिति</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBooths.map(b => {
              const sub = submissions[b.school_code];
              const bd = sub?.booth_details?.[b.booth_no] || {};
              const isSub = !!sub;
              const bloName = bd.blo_name || '';
              const bloPost = bd.blo_post || '';
              const bloMob = bd.blo_mobile || '';

              return `
                <tr style="background:${isSub ? '#f0fdf4' : '#fff'}">
                  <td style="text-align:center; font-weight:800; color:#0284c7; background:#f8fafc">#${b.booth_no}</td>
                  <td><strong>${b.panchayat_hi}</strong></td>
                  <td>
                    <strong>${b.room_hi}</strong>
                    <div style="font-size:0.72rem; color:#64748b">${b.building_hi}</div>
                  </td>
                  <td style="text-align:center; font-weight:700">${b.ward || '-'}</td>
                  <td style="font-family:monospace; font-weight:700; color:#1e40af">${b.school_code}</td>
                  <td style="text-align:center">${bd.light !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                  <td style="text-align:center">${bd.furniture !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                  <td style="text-align:center">${bd.door !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                  <td style="text-align:center">${bd.lining !== false ? '<span class="text-success font-weight-bold">✓ हाँ</span>' : '<span class="text-danger">✗ नहीं</span>'}</td>
                  ${customCols.map(c => `<td>${bd[c.id] || '-'}</td>`).join('')}
                  <td>
                    ${bloName ? `<strong>${bloName}</strong> <small>(${bloPost})</small> ${bloMob ? `<br><a href="tel:${bloMob}" style="color:#059669">${bloMob}</a>` : ''}` : '<span style="color:#94a3b8">--</span>'}
                  </td>
                  <td style="text-align:center">
                    ${isSub 
                      ? '<span style="background:#dcfce7; color:#15803d; font-size:0.72rem; font-weight:800; padding:2px 6px; border-radius:10px">सत्यापित</span>' 
                      : '<span style="background:#fee2e2; color:#b91c1c; font-size:0.72rem; font-weight:800; padding:2px 6px; border-radius:10px">लंबित</span>'}
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

// 4. Excel Exporters: Genuine .xlsx with SheetJS and fallback HTML .xls
function downloadElectionSummaryExcel() {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const headers = [
    'क्र.सं.', 'जिला', 'ब्लॉक', 'ग्राम पंचायत', 'विद्यालय का नाम',
    'शाला दर्पण कोड', 'PEEO परिक्षेत्र', 'मतदान कक्ष/बूथ संख्या', 'संस्था प्रधान नाम',
    'मोबाइल', 'विद्यालय आधिकारिक ईमेल', 'सत्यापन स्थिति', 'सबमिशन दिनांक/समय'
  ];

  const rows = [headers];
  schools.forEach((s, idx) => {
    const sub = submissions[s.shala_darpan_code];
    const status = sub ? 'सत्यापित (Submitted)' : 'लंबित (Pending)';
    const email = sub?.school_email || '';
    const date = sub?.submitted_at || '';
    rows.push([
      idx + 1,
      'अजमेर (AJMER)',
      'भिनाय',
      s.panchayat_name,
      s.school_name,
      s.shala_darpan_code,
      s.peeo_name || '',
      s.booth_count,
      s.principal_name,
      s.principal_mobile,
      email,
      status,
      date
    ]);
  });

  const filename = "CBEO_Bhinai_Panchayat_Election_2026_33_Schools_Summary";
  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 38 },
      { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 22 },
      { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "33_Schools_Summary");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    if (typeof showToast === 'function') showToast('📥 33 विद्यालयों की समेकित Excel (.xlsx) सफलतापूर्वक डाउनलोड हो गई!', 'success');
  } else {
    exportTableDataToHtmlExcel(rows, `${filename}.xls`);
  }
}

function downloadElection116BoothsExcel() {
  const booths = window.ELECTION_2026_BOOTHS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const customCols = getElectionCustomColumns();
  const headers = [
    'क्र.सं.', 'बूथ संख्या', 'ग्राम पंचायत', 'मतदान केंद्र भवन का नाम',
    'मतदान कक्ष विवरण', 'वार्ड संख्या', 'शाला दर्पण कोड',
    'विद्युत व पंखे', 'फर्नीचर स्थिति', 'पृथक द्वार', 'चूना लाइनिंग',
    ...customCols.map(c => c.name),
    'BLO का नाम', 'BLO पद', 'BLO मोबाइल', 'सत्यापन स्थिति'
  ];

  const rows = [headers];
  booths.forEach((b, idx) => {
    const sub = submissions[b.school_code];
    const bd = sub?.booth_details?.[b.booth_no] || {};
    const light = bd.light !== false ? 'हाँ' : 'नहीं';
    const furn = bd.furniture !== false ? 'हाँ' : 'नहीं';
    const door = bd.door !== false ? 'हाँ' : 'नहीं';
    const lining = bd.lining !== false ? 'हाँ' : 'नहीं';
    const bloName = bd.blo_name || '';
    const bloPost = bd.blo_post || '';
    const bloMob = bd.blo_mobile || '';
    const status = sub ? 'सत्यापित' : 'लंबित';

    const customVals = customCols.map(c => bd[c.id] || '');

    rows.push([
      idx + 1,
      b.booth_no,
      b.panchayat_hi,
      b.building_hi,
      b.room_hi,
      b.ward || '',
      b.school_code,
      light,
      furn,
      door,
      lining,
      ...customVals,
      bloName,
      bloPost,
      bloMob,
      status
    ]);
  });

  const filename = "CBEO_Bhinai_Panchayat_Election_2026_116_Booths_Detailed";
  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 35 }, { wch: 35 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ...customCols.map(() => ({ wch: 18 })),
      { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "116_Booths_Details");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    if (typeof showToast === 'function') showToast('📊 116 मतदान बूथों का विस्तृत Excel (.xlsx) सफलतापूर्वक डाउनलोड हो गया!', 'success');
  } else {
    exportTableDataToHtmlExcel(rows, `${filename}.xls`);
  }
}

// Fallback HTML/XML Excel Exporter (.xls) that opens natively in MS Excel
function exportTableDataToHtmlExcel(rows, filename) {
  let tableHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Segoe UI,Tahoma,sans-serif;} th{background:#0f172a;color:#ffffff;border:1px solid #94a3b8;padding:8px;} td{border:1px solid #cbd5e1;padding:6px;}</style></head><body><table>';
  rows.forEach((r, rIdx) => {
    tableHtml += '<tr>';
    r.forEach(cell => {
      if (rIdx === 0) {
        tableHtml += `<th>${cell}</th>`;
      } else {
        tableHtml += `<td>${cell !== undefined && cell !== null ? String(cell) : ''}</td>`;
      }
    });
    tableHtml += '</tr>';
  });
  tableHtml += '</table></body></html>';

  const blob = new Blob(['\uFEFF' + tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof showToast === 'function') showToast(`📥 Excel फाइल (${filename}) डाउनलोड हो गई!`, 'success');
}

// 5. Custom Columns Manager Modal
function openElectionColumnManagerModal() {
  let modal = document.getElementById('modal-election-column-manager');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-election-column-manager';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:none; justify-content:center; align-items:center; z-index:99999; backdrop-filter:blur(3px);';
    document.body.appendChild(modal);
  }

  const customCols = getElectionCustomColumns();

  modal.innerHTML = `
    <div style="background:#fff; border-radius:12px; max-width:650px; width:92%; max-height:90vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid #cbd5e1">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a); color:#fff; padding:1.1rem 1.4rem; border-top-left-radius:12px; border-top-right-radius:12px; display:flex; justify-content:space-between; align-items:center">
        <h4 style="margin:0; font-weight:800; font-size:1.1rem">
          <i class="fas fa-columns text-primary"></i> चुनाव प्रपत्र-3 व बूथ कॉलम प्रबंधन
        </h4>
        <button type="button" onclick="closeModal('modal-election-column-manager')" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer">&times;</button>
      </div>

      <div style="padding:1.25rem">
        <p style="font-size:0.86rem; color:#475569; margin-bottom:1rem">
          यहाँ से आप चुनाव प्रपत्र व 116 बूथों के सत्यापन हेतु नए अतिरिक्त कॉलम जोड़ सकते हैं। नए कॉलम प्रपत्र, मॉनिटरिंग टेबल व एक्सेल में तुरंत सम्मिलित हो जाएंगे।
        </p>

        <!-- Add New Column Form -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1.25rem">
          <h5 style="font-size:0.9rem; font-weight:800; color:#0f172a; margin-bottom:0.75rem">
            <i class="fas fa-plus-circle text-success"></i> नया सत्यापन कॉलम जोड़ें:
          </h5>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; margin-bottom:0.75rem">
            <div>
              <label style="font-size:0.78rem; font-weight:700">कॉलम का नाम (हिंदी में):</label>
              <input type="text" id="el-new-col-name" class="form-control form-control-sm" placeholder="उदा. पेयजल व्यवस्था / CCTV">
            </div>
            <div>
              <label style="font-size:0.78rem; font-weight:700">कॉलम प्रकार:</label>
              <select id="el-new-col-type" class="form-select form-select-sm">
                <option value="yes_no">हाँ / नहीं (Yes/No Toggle)</option>
                <option value="text">टेक्स्ट (विस्तृत विवरण)</option>
                <option value="number">संख्या (Numeric)</option>
              </select>
            </div>
          </div>
          <button type="button" class="btn btn-success btn-sm" onclick="addElectionCustomColumn()" style="font-weight:700">
            <i class="fas fa-plus"></i> कॉलम जोड़ें
          </button>
        </div>

        <!-- Existing Columns List -->
        <div>
          <h5 style="font-size:0.9rem; font-weight:800; color:#0f172a; margin-bottom:0.5rem">
            सक्रिय अतिरिक्त कॉलम (${customCols.length}):
          </h5>
          ${customCols.length === 0 ? '<div style="color:#64748b; font-size:0.84rem; font-style:italic">वर्तमान में कोई अतिरिक्त कॉलम नहीं जोड़ा गया है। मानक 11 P-3 कॉलम सक्रिय हैं।</div>' : `
            <div class="table-responsive">
              <table class="table table-bordered table-sm" style="font-size:0.84rem">
                <thead style="background:#f1f5f9">
                  <tr>
                    <th>कॉलम नाम</th>
                    <th>प्रकार</th>
                    <th style="width:70px; text-align:center">हटाएं</th>
                  </tr>
                </thead>
                <tbody>
                  ${customCols.map(c => `
                    <tr>
                      <td><strong>${c.name}</strong></td>
                      <td>${c.type === 'yes_no' ? 'हाँ / नहीं' : c.type}</td>
                      <td style="text-align:center">
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteElectionCustomColumn('${c.id}')" style="padding:1px 6px">
                          <i class="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>

      <div style="background:#f8fafc; padding:0.75rem 1.25rem; border-top:1px solid #e2e8f0; text-align:right">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('modal-election-column-manager')">बंद करें</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function addElectionCustomColumn() {
  const nameInp = document.getElementById('el-new-col-name');
  const typeInp = document.getElementById('el-new-col-type');
  const name = (nameInp && nameInp.value.trim()) || '';
  const type = (typeInp && typeInp.value) || 'yes_no';

  if (!name) {
    if (typeof showToast === 'function') showToast('कृपया कॉलम का नाम दर्ज करें!', 'warning');
    return;
  }

  const cols = getElectionCustomColumns();
  const id = 'col_' + Date.now();
  cols.push({ id, name, type });
  saveElectionCustomColumns(cols);

  if (typeof showToast === 'function') showToast(`कॉलम '${name}' सफलतापूर्वक जोड़ा गया!`, 'success');
  openElectionColumnManagerModal();
  renderElectionView();
}

function deleteElectionCustomColumn(colId) {
  let cols = getElectionCustomColumns();
  cols = cols.filter(c => c.id !== colId);
  saveElectionCustomColumns(cols);

  if (typeof showToast === 'function') showToast('कॉलम हटा दिया गया!', 'info');
  openElectionColumnManagerModal();
  renderElectionView();
}

// 6. Broadcast Center Modal (WhatsApp / Telegram Notification to Schools)
function openElectionBroadcastModal() {
  let modal = document.getElementById('modal-election-broadcast');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-election-broadcast';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:none; justify-content:center; align-items:center; z-index:99999; backdrop-filter:blur(3px);';
    document.body.appendChild(modal);
  }

  const schools = window.ELECTION_2026_SCHOOLS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const pendingSchools = schools.filter(s => !submissions[s.shala_darpan_code]);

  const defaultMsg = `*कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)*\n\n*अति-आवश्यक चुनाव प्रपत्र-3 भौतिक सत्यापन सूचना:*\nमान्यवर संस्था प्रधान, राज्य निर्वाचन आयोग राजस्थान के आदेश क्र. 10161 के अनुसार पंचायती राज आम चुनाव 2026 हेतु आपके विद्यालय में स्थापित मतदान केन्द्रों के भौतिक सत्यापन (प्रपत्र-3) एवं अधिकृत BLO प्रगणक सत्यापन को तत्काल ऑनलाइन सबमिट करें।\n\n👉 *ऑनलाइन पोर्टल लिंक:* https://jit9763.github.io/cbeo-bhinai-portal/index.html?tab=election\n\n- मुख्य ब्लॉक शिक्षा अधिकारी, भिनाय (अजमेर)`;

  modal.innerHTML = `
    <div style="background:#fff; border-radius:12px; max-width:680px; width:92%; max-height:90vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid #cbd5e1">
      <div style="background:linear-gradient(135deg,#1e3a8a,#0f172a); color:#fff; padding:1.1rem 1.4rem; border-top-left-radius:12px; border-top-right-radius:12px; display:flex; justify-content:space-between; align-items:center">
        <h4 style="margin:0; font-weight:800; font-size:1.1rem">
          <i class="fas fa-bullhorn text-warning"></i> चुनाव भौतिक सत्यापन आधिकारिक प्रसारण केंद्र
        </h4>
        <button type="button" onclick="closeModal('modal-election-broadcast')" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer">&times;</button>
      </div>

      <div style="padding:1.25rem">
        <div style="margin-bottom:1rem; font-size:0.86rem; color:#475569">
          वर्तमान में <strong>${pendingSchools.length}</strong> विद्यालयों का प्रपत्र सत्यापन लंबित है। आप नीचे दिए गए संदेश को कस्टमाइज़ कर सीधे संस्था प्रधानों को WhatsApp/Telegram पर प्रेषित कर सकते हैं:
        </div>

        <div style="margin-bottom:1rem">
          <label style="font-size:0.82rem; font-weight:700">संदेश सामग्री (Message Template):</label>
          <textarea id="el-broadcast-msg-txt" class="form-control" rows="6" style="font-size:0.85rem; line-height:1.5">${defaultMsg}</textarea>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; margin-bottom:1rem">
          <div style="font-size:0.82rem; font-weight:800; color:#0f172a; margin-bottom:0.4rem">लक्षित विद्यालय चयन:</div>
          <label style="font-size:0.84rem; display:inline-flex; align-items:center; gap:0.4rem; margin-right:1rem; cursor:pointer">
            <input type="radio" name="el-bc-target" value="pending" checked> केवल लंबित विद्यालय (${pendingSchools.length})
          </label>
          <label style="font-size:0.84rem; display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer">
            <input type="radio" name="el-bc-target" value="all"> सभी 30 ग्राम पंचायत विद्यालय
          </label>
        </div>

        <div style="display:flex; gap:0.6rem; flex-wrap:wrap">
          <button type="button" class="btn btn-success btn-sm" onclick="sendElectionWhatsAppBroadcast()" style="font-weight:700">
            <i class="fab fa-whatsapp"></i> WhatsApp प्रसारण खोलें
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="copyElectionBroadcastMsg()" style="font-weight:700">
            <i class="fas fa-copy"></i> संदेश कॉपी करें
          </button>
        </div>
      </div>

      <div style="background:#f8fafc; padding:0.75rem 1.25rem; border-top:1px solid #e2e8f0; text-align:right">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('modal-election-broadcast')">बंद करें</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function sendElectionWhatsAppBroadcast() {
  const msg = (document.getElementById('el-broadcast-msg-txt')?.value || '').trim();
  const radPending = document.querySelector('input[name="el-bc-target"]:checked')?.value === 'pending';
  const schools = window.ELECTION_2026_SCHOOLS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const targetList = radPending ? schools.filter(s => !submissions[s.shala_darpan_code]) : schools;

  if (targetList.length === 0) {
    if (typeof showToast === 'function') showToast('कोई लंबित विद्यालय नहीं है!', 'success');
    return;
  }

  // Pick first pending principal's number for direct chat or open web
  const firstMobile = targetList[0].principal_mobile || '9928254317';
  const url = `https://api.whatsapp.com/send?phone=91${firstMobile}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function copyElectionBroadcastMsg() {
  const msg = document.getElementById('el-broadcast-msg-txt')?.value || '';
  navigator.clipboard.writeText(msg).then(() => {
    if (typeof showToast === 'function') showToast('संदेश क्लिपबोर्ड पर कॉपी हो गया!', 'success');
  });
}

// 7. Quick Entry Modal (Admin Quick Verification Entry)
function openElectionQuickEntryModal(preselectCode = null) {
  let modal = document.getElementById('modal-election-quick-entry');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-election-quick-entry';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:none; justify-content:center; align-items:center; z-index:99999; backdrop-filter:blur(3px);';
    document.body.appendChild(modal);
  }

  const schools = window.ELECTION_2026_SCHOOLS || [];
  const selectedCode = preselectCode || schools[0]?.shala_darpan_code;

  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const currentSchool = schools.find(s => s.shala_darpan_code === selectedCode) || schools[0];
  const isSub = !!submissions[currentSchool.shala_darpan_code];

  modal.innerHTML = `
    <div style="background:#fff; border-radius:12px; max-width:620px; width:92%; max-height:90vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid #cbd5e1">
      <div style="background:linear-gradient(135deg,#0284c7,#0f172a); color:#fff; padding:1.1rem 1.4rem; border-top-left-radius:12px; border-top-right-radius:12px; display:flex; justify-content:space-between; align-items:center">
        <h4 style="margin:0; font-weight:800; font-size:1.1rem">
          <i class="fas fa-bolt text-warning"></i> त्वरित सत्यापन प्रविष्टि (Quick Entry)
        </h4>
        <button type="button" onclick="closeModal('modal-election-quick-entry')" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer">&times;</button>
      </div>

      <div style="padding:1.25rem">
        <div style="margin-bottom:1rem">
          <label style="font-size:0.82rem; font-weight:700">विद्यालय चुनें:</label>
          <select id="el-quick-school-select" class="form-select form-select-sm" onchange="openElectionQuickEntryModal(this.value)">
            ${schools.map(s => `
              <option value="${s.shala_darpan_code}" ${s.shala_darpan_code === currentSchool.shala_darpan_code ? 'selected' : ''}>
                [${s.shala_darpan_code}] ${s.school_name} (${s.booth_count} बूथ)
              </option>
            `).join('')}
          </select>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; margin-bottom:1rem">
          <div><strong>ग्राम पंचायत:</strong> ${currentSchool.panchayat_name}</div>
          <div><strong>संस्था प्रधान:</strong> ${currentSchool.principal_name} (${currentSchool.principal_mobile})</div>
          <div style="margin-top:4px">
            <strong>वर्तमान स्थिति:</strong> 
            ${isSub 
              ? '<span class="badge bg-success">सत्यापित (Submitted)</span>' 
              : '<span class="badge bg-danger">लंबित (Pending)</span>'}
          </div>
        </div>

        <div style="margin-bottom:1rem">
          <label style="font-size:0.82rem; font-weight:700">विद्यालय आधिकारिक ईमेल:</label>
          <input type="email" id="el-quick-email" class="form-control form-control-sm" value="${submissions[currentSchool.shala_darpan_code]?.school_email || ''}" placeholder="school@gmail.com">
        </div>

        <div style="display:flex; gap:0.6rem; flex-wrap:wrap">
          <button type="button" class="btn btn-success btn-sm" onclick="saveQuickElectionStatus('${currentSchool.shala_darpan_code}', true)" style="font-weight:700">
            <i class="fas fa-check"></i> 'सत्यापित' के रूप में सुरक्षित करें
          </button>
          ${isSub ? `
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="saveQuickElectionStatus('${currentSchool.shala_darpan_code}', false)" style="font-weight:700">
              <i class="fas fa-undo"></i> सत्यापन रद्द (लंबित करें)
            </button>
          ` : ''}
          <a href="election_form.html?code=${currentSchool.shala_darpan_code}" target="_blank" class="btn btn-primary btn-sm" style="font-weight:700">
            <i class="fas fa-external-link-alt"></i> विस्तृत फॉर्म खोलें
          </a>
        </div>
      </div>

      <div style="background:#f8fafc; padding:0.75rem 1.25rem; border-top:1px solid #e2e8f0; text-align:right">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('modal-election-quick-entry')">बंद करें</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function saveQuickElectionStatus(schoolCode, isVerified) {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const sch = schools.find(s => s.shala_darpan_code === schoolCode);
  if (!sch) return;

  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const email = document.getElementById('el-quick-email')?.value || '';

  if (isVerified) {
    submissions[schoolCode] = {
      school_code: schoolCode,
      school_name: sch.school_name,
      panchayat_name: sch.panchayat_name,
      peeo_name: sch.peeo_name,
      school_email: email,
      bldg_type: 'सरकारी',
      bldg_condition: 'अच्छी',
      bldg_area: 60,
      bldg_road_dist: '100 मीटर',
      principal: { name: sch.principal_name, mobile: sch.principal_mobile },
      facilities: {},
      booth_details: {},
      remarks: 'एडमिन द्वारा त्वरित सत्यापन दर्ज',
      submitted_at: new Date().toLocaleString('en-IN')
    };
    if (typeof showToast === 'function') showToast(`विद्यालय '${sch.school_name}' सत्यापित दर्ज हो गया!`, 'success');
  } else {
    delete submissions[schoolCode];
    if (typeof showToast === 'function') showToast(`विद्यालय '${sch.school_name}' लंबित कर दिया गया!`, 'info');
  }

  localStorage.setItem('cbeo_election_submissions', JSON.stringify(submissions));
  closeModal('modal-election-quick-entry');
  renderElectionView();

  // Push to cloud Google Apps Script
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (gasUrl && isVerified) {
    try {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'election_verification_submit',
          school_code: schoolCode,
          entry: submissions[schoolCode]
        })
      }).catch(() => {});
    } catch(e) {}
  }
}

function publishElectionDemandLive() {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const schoolCodes = schools.map(s => s.shala_darpan_code);

  const existingIdx = (STATE.demands || []).findIndex(d => d.id === 'DEMAND_ELECTION_2026');
  const electionDemand = {
    id: 'DEMAND_ELECTION_2026',
    title: 'पंचायती राज आम चुनाव 2026: मतदान केन्द्र भौतिक सत्यापन रिपोर्ट (प्रपत्र-3)',
    collectionLevel: 'school',
    schoolScope: 'election_30',
    targetSchools: schoolCodes,
    placement: 'tab_existing',
    parentTab: 'election',
    targetAudience: {
      cbeo: true,
      peeo: true,
      govt_sec_srsec: true,
      pvt_sec_srsec: false,
      sec_srsec: true,
      all_govt: true,
      all_schools: false
    },
    description: 'राज्य निर्वाचन आयोग राजस्थान के आदेश क्र. 10161 दिनांक 07-10-2026 अनुसार भिनाय ब्लॉक के 30 ग्राम पंचायत मुख्यालय विद्यालयों में स्थापित 116 मतदान केन्द्रों के भौतिक सत्यापन (प्रपत्र-3) एवं अधिकृत BLO प्रगणक सत्यापन की अनिवार्य मांग। (जिला: अजमेर)',
    dueDate: '2026-10-15',
    priority: 'अति आवश्यक (Urgent)',
    published: true,
    isTestMode: false,
    createdAt: new Date().toISOString().split('T')[0],
    columns: [
      { name: 'विद्यालय आधिकारिक ईमेल', type: 'email', prefillSource: 'none', placeholder: 'school@gmail.com' },
      { name: 'भवन प्रकार', type: 'text', prefillSource: 'none', placeholder: 'सरकारी' },
      { name: 'भवन स्थिति', type: 'text', prefillSource: 'none', placeholder: 'अच्छी' },
      { name: 'क्षेत्रफल वर्ग मी.', type: 'number', prefillSource: 'none', placeholder: '60' },
      { name: 'पहुंच दूरी', type: 'text', prefillSource: 'none', placeholder: '100 मीटर' },
      { name: 'मूलभूत व्यवस्थाएं (पेयजल/शौचालय/रैम्प/बिजली)', type: 'text', prefillSource: 'none', placeholder: 'पूर्ण' },
      { name: 'बूथ-वार P-3 व्यवस्थाएं व BLO प्रगणक विवरण', type: 'text', prefillSource: 'none', placeholder: 'पूर्ण' },
      { name: 'विशेष टिप्पणी', type: 'text', prefillSource: 'none', placeholder: 'वैकल्पिक' }
    ]
  };

  if (existingIdx >= 0) {
    STATE.demands[existingIdx] = electionDemand;
  } else {
    STATE.demands.unshift(electionDemand);
  }

  saveDemandsToStorage();
  if (typeof recordAuditLog === 'function') {
    recordAuditLog({
      user: STATE.currentUser?.name || 'जितेन्द्र कुमार (Admin)',
      action: 'चुनाव 2026 मांग लाइव जारी',
      target: electionDemand.title,
      details: '30 ग्राम पंचायत विद्यालयों (116 बूथ) को पंचायती राज चुनाव भौतिक सत्यापन मांग लाइव जारी की गई।',
      note: 'पोर्टल बटन द्वारा लाइव प्रकाशन'
    });
  }

  if (typeof showToast === 'function') {
    showToast('🚀 सफल! पंचायती राज चुनाव 2026 मांग प्रपत्र 30 विद्यालयों को लाइव जारी कर दिया गया है!', 'success');
  } else {
    alert('🚀 सफल! पंचायती राज चुनाव 2026 मांग प्रपत्र 30 विद्यालयों को लाइव जारी कर दिया गया है!');
  }

  renderElectionView();
  if (typeof renderDemandsView === 'function') renderDemandsView();
}

function syncElectionSubmissionsFromCloud(callback) {
  const gasUrl = localStorage.getItem('cbeo_backup_webhook_url') 
    || 'https://script.google.com/macros/s/AKfycbzmauNuu8DUjgsK-TBdiv45efshvaf6x3Z6bJrhyC2LOmF-yg9ErGq3XWEKZ8Umw8Ao/exec';

  fetch(`${gasUrl}?action=getElectionSubmissions`)
    .then(r => r.json())
    .then(res => {
      if (res && res.success && res.submissions) {
        let localSubs = {};
        try { localSubs = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}'); } catch(e) {}
        const merged = { ...localSubs, ...res.submissions };
        localStorage.setItem('cbeo_election_submissions', JSON.stringify(merged));
        
        // Re-render if election view is active
        const elView = document.getElementById('view-election');
        if (elView && elView.classList.contains('active')) {
          const user = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
          const isAdmin = user && (user.shala_darpan_code === 'admin_jitendra' || user.admin_id === 'ADMIN02' || user.username === 'jitendra_admin' || user.shala_darpan_code === '8140' || user.role === 'admin');
          if (isAdmin) renderElectionAdminView(elView);
        }
        // Update demands view progress bar if active
        if (typeof renderDemandsView === 'function') {
          const dView = document.getElementById('view-demands');
          if (dView && dView.classList.contains('active')) renderDemandsView();
        }
        if (callback) callback(merged);
      }
    })
    .catch(() => {});
}

// Global Exports
if (typeof window !== 'undefined') {
  window.renderElectionView = renderElectionView;
  window.downloadElectionSummaryExcel = downloadElectionSummaryExcel;
  window.downloadElection116BoothsExcel = downloadElection116BoothsExcel;
  window.publishElectionDemandLive = publishElectionDemandLive;
  window.syncElectionSubmissionsFromCloud = syncElectionSubmissionsFromCloud;
  window.openElectionColumnManagerModal = openElectionColumnManagerModal;
  window.addElectionCustomColumn = addElectionCustomColumn;
  window.deleteElectionCustomColumn = deleteElectionCustomColumn;
  window.openElectionBroadcastModal = openElectionBroadcastModal;
  window.sendElectionWhatsAppBroadcast = sendElectionWhatsAppBroadcast;
  window.copyElectionBroadcastMsg = copyElectionBroadcastMsg;
  window.openElectionQuickEntryModal = openElectionQuickEntryModal;
  window.saveQuickElectionStatus = saveQuickElectionStatus;
  window.setElectionActiveFormTab = setElectionActiveFormTab;
  window.onElectionScopeFilterChange = onElectionScopeFilterChange;
  window.setElectionViewMode = setElectionViewMode;
  setTimeout(syncElectionSubmissionsFromCloud, 1000);
}
