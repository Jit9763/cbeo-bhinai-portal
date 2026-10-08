/**
 * CBEO Bhinai Portal - Election 2026 Verification Module
 * Block: Bhinai | District: AJMER (अजमेर)
 * 30 Panchayat Schools & 116 Polling Booths (State Election Commission Order 2026)
 */

let ELECTION_FILTER_STATUS = 'all';
let ELECTION_SEARCH_QUERY = '';

function renderElectionView() {
  const container = document.getElementById('view-election');
  if (!container) return;

  const user = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
  const isJitendra = user && (user.shala_darpan_code === 'admin_jitendra' || user.admin_id === 'ADMIN02' || user.username === 'jitendra_admin');
  const isCBEO = user && (user.shala_darpan_code === '8140' || user.admin_id === 'ADMIN01' || (user.role === 'admin' && !isJitendra));
  const isAdmin = isJitendra || isCBEO || (user && user.role === 'admin');

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
      <div style="overflow-x:auto">
        <table class="table" style="width:100%; border-collapse:collapse; font-size:0.88rem; margin:0">
          <thead>
            <tr style="background:#f1f5f9; text-align:left">
              <th style="padding:8px 12px; border:1px solid #cbd5e1; width:70px">बूथ नं.</th>
              <th style="padding:8px 12px; border:1px solid #cbd5e1">मतदान कक्ष / कमरा विवरण</th>
              <th style="padding:8px 12px; border:1px solid #cbd5e1; width:100px; text-align:center">वार्ड संख्या</th>
              <th style="padding:8px 12px; border:1px solid #cbd5e1; width:120px; text-align:center">प.स. क्षे.सं.</th>
              <th style="padding:8px 12px; border:1px solid #cbd5e1; width:120px; text-align:center">जि.प. क्षे.सं.</th>
              <th style="padding:8px 12px; border:1px solid #cbd5e1; width:100px; text-align:center">वि.स.</th>
              <th style="padding:8px 12px; border:1px solid #cbd5e1; width:130px; text-align:center">सत्यापन स्थिति</th>
            </tr>
          </thead>
          <tbody>
            ${(mySchool.booths || []).map(b => `
              <tr>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; font-weight:800; text-align:center; background:#f8fafc">${b.booth_no}</td>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; font-weight:600">${b.room_hi}</td>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center">${b.ward || '-'}</td>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center">${b.ps_constituency || '-'}</td>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center">${b.zp_constituency || '-'}</td>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center">${b.ac_constituency || 104}</td>
                <td style="padding:8px 12px; border:1px solid #cbd5e1; text-align:center">
                  ${isSubmitted ? '<span style="color:#15803d; font-weight:700">✓ सत्यापित</span>' : '<span style="color:#b91c1c; font-weight:700">लंबित</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:1.25rem; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:0.85rem 1.15rem; font-size:0.85rem; color:#1e40af">
        <i class="fas fa-info-circle"></i> <strong>निर्देश:</strong> ऊपर <strong>'प्रपत्र-3 भौतिक सत्यापन भरें'</strong> बटन पर क्लिक करके मौके पर हवा, प्रकाश, रैंप, फर्नीचर, पंखे, दरवाजे व BLO का विवरण दर्ज करें। सबमिट करने के बाद <strong>'A4 PDF मुद्रित करें'</strong> बटन से प्रपत्र प्रिंट कर BLO के भौतिक हस्ताक्षर करवाकर फाइल में सुरक्षित रखें।
      </div>
    </div>
  `;
}

// 2. Dedicated View for PEEO Login (ONLY Their Panchayat Schools)
function renderElectionPeeoView(container, user) {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  const uCode = String(user.shala_darpan_code || '').trim();
  const peeoName = String(user.peeo_name || '').trim();

  const myPeeoSchools = schools.filter(s => 
    String(s.shala_darpan_code) === uCode || 
    (peeoName && s.peeo_name && (s.peeo_name.includes(peeoName) || peeoName.includes(s.peeo_name))) ||
    (user.schools && user.schools.some(sch => String(sch.shala_darpan_code || sch.dise_code) === String(s.shala_darpan_code)))
  );

  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const displaySchools = myPeeoSchools.length > 0 ? myPeeoSchools : schools.filter(s => String(s.shala_darpan_code) === uCode);

  container.innerHTML = `
    <!-- Top PEEO Banner -->
    <div style="background:linear-gradient(135deg, #065f46, #0f172a); color:#fff; border-radius:12px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 4px 14px rgba(6,95,70,0.25)">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#6ee7b7; text-transform:uppercase; letter-spacing:0.5px">
            🏛️ PEEO परिक्षेत्र: ${peeoName || 'भिनाय'} • चुनाव 2026 प्रपत्र-3
          </div>
          <h2 style="font-size:1.35rem; font-weight:900; margin:4px 0">
            मतदान केन्द्र भौतिक सत्यापन हब
          </h2>
          <div style="font-size:0.84rem; opacity:0.9">
            इस PEEO परिक्षेत्र अंतर्गत स्थापित मतदान केंद्र विद्यालय एवं बूथों का भौतिक सत्यापन
          </div>
        </div>
        <div style="display:flex; gap:0.5rem">
          <span class="badge" style="background:#10b981; color:#fff; font-size:0.85rem; padding:6px 12px; border-radius:20px">
            ${displaySchools.length} मतदान केंद्र विद्यालय
          </span>
        </div>
      </div>
    </div>

    <!-- PEEO Schools Cards Grid -->
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:1.25rem">
      ${displaySchools.map((s, idx) => {
        const sub = submissions[s.shala_darpan_code];
        const isSubmitted = !!sub;
        return `
          <div style="background:#fff; border:1px solid ${isSubmitted ? '#86efac' : '#e2e8f0'}; border-top:4px solid ${isSubmitted ? '#16a34a' : '#0284c7'}; border-radius:8px; padding:1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem">
                <span style="font-size:0.75rem; font-weight:800; color:#0369a1; background:#e0f2fe; padding:2px 6px; border-radius:4px">#${idx + 1} मतदान केंद्र</span>
                ${isSubmitted 
                  ? '<span style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px"><i class="fas fa-check-circle"></i> ✓ सत्यापित</span>' 
                  : '<span style="background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px"><i class="fas fa-clock"></i> लंबित</span>'}
              </div>
              <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin-bottom:0.25rem">
                ${s.school_name}
              </h3>
              <div style="font-size:0.82rem; color:#475569; margin-bottom:0.6rem">
                <strong>ग्राम पंचायत:</strong> ${s.panchayat_name} | <strong>कोड:</strong> <code>${s.shala_darpan_code}</code>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.6rem 0.75rem; font-size:0.78rem; margin-bottom:0.85rem">
                <div><strong>संस्था प्रधान:</strong> ${s.principal_name} (${s.principal_mobile})</div>
                <div style="color:#0369a1; font-weight:700; margin-top:2px">
                  🗳️ कुल मतदान बूथ: <strong>${s.booth_count}</strong>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
              <a href="election_form.html?code=${s.shala_darpan_code}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:0.35rem">
                <i class="fas ${isSubmitted ? 'fa-edit' : 'fa-file-signature'}"></i> ${isSubmitted ? 'संशोधन करें' : '📝 प्रपत्र भरें'}
              </a>
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

// 3. Admin View for CBEO / Jitendra (Full Block 30 Schools Hub)
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

  container.innerHTML = `
    <!-- Top Banner -->
    <div style="background:linear-gradient(135deg, #0f172a, #1e3a8a); color:#fff; border-radius:12px; padding:1.25rem 1.5rem; margin-bottom:1.25rem; box-shadow:0 4px 14px rgba(15,23,42,0.25)">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px">
            🏛️ राज्य निर्वाचन आयोग, राजस्थान • प.2(9)रानिआ/सामान्य/2025-26/10161
          </div>
          <h2 style="font-size:1.4rem; font-weight:900; margin:4px 0">
            🗳️ पंचायती राज आम चुनाव 2026 - मतदान केन्द्र भौतिक सत्यापन हब
          </h2>
          <div style="font-size:0.84rem; opacity:0.9">
            कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय | <strong>जिला: अजमेर (AJMER)</strong> | 30 ग्राम पंचायत विद्यालय • 116 बूथ
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
          <button type="button" class="btn btn-success btn-sm" id="btn-publish-election-live" onclick="publishElectionDemandLive()" style="font-weight:800; background:#10b981; border-color:#059669; color:#fff; box-shadow:0 2px 6px rgba(16,185,129,0.3)">
            <i class="fas fa-bullhorn"></i> 🚀 30 विद्यालयों को मांग लाइव जारी करें
          </button>
          <button type="button" class="btn btn-light btn-sm" onclick="downloadElectionSummaryExcel()" style="font-weight:800; color:#0f172a">
            <i class="fas fa-file-excel text-success"></i> 📥 30 विद्यालय समेकित Excel
          </button>
          <button type="button" class="btn btn-warning btn-sm" onclick="downloadElection116BoothsExcel()" style="font-weight:800; color:#0f172a">
            <i class="fas fa-table"></i> 📊 116 बूथ-वार विस्तृत Excel
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats Metric Cards (No Total Voters) -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.25rem">
      <div style="background:#fff; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 2px 6px rgba(0,0,0,0.03)">
        <div style="font-size:0.75rem; font-weight:700; color:#64748b">कुल लक्षित विद्यालय</div>
        <div style="font-size:1.5rem; font-weight:900; color:#0f172a; margin-top:2px">${schools.length} <span style="font-size:0.78rem; font-weight:normal; color:#475569">(25 PEEO + 5 अन्य)</span></div>
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

    <!-- Filters & Search Toolbar -->
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem 1.1rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem">
      <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:260px">
        <i class="fas fa-search text-muted"></i>
        <input type="text" id="election-search-input" class="form-control" placeholder="विद्यालय का नाम, ग्राम पंचायत या शाला दर्पण कोड से खोजें..." oninput="onElectionSearchChange(this.value)" style="border:1px solid #cbd5e1; border-radius:6px; padding:0.45rem 0.75rem; font-size:0.88rem; width:100%">
      </div>
      <div style="display:flex; gap:0.5rem">
        <button type="button" class="btn btn-sm ${ELECTION_FILTER_STATUS === 'all' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="setElectionFilter('all')">सभी (30)</button>
        <button type="button" class="btn btn-sm ${ELECTION_FILTER_STATUS === 'submitted' ? 'btn-success' : 'btn-outline-secondary'}" onclick="setElectionFilter('submitted')">पूर्ण (${submittedCount})</button>
        <button type="button" class="btn btn-sm ${ELECTION_FILTER_STATUS === 'pending' ? 'btn-danger' : 'btn-outline-secondary'}" onclick="setElectionFilter('pending')">लंबित (${pendingCount})</button>
      </div>
    </div>

    <!-- 30 Schools Cards Grid -->
    <div id="election-schools-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:1rem">
      <!-- Populated below -->
    </div>
  `;

  renderElectionSchoolsGrid();
}

function onElectionSearchChange(val) {
  ELECTION_SEARCH_QUERY = (val || '').toLowerCase().trim();
  renderElectionSchoolsGrid();
}

function setElectionFilter(st) {
  ELECTION_FILTER_STATUS = st;
  renderElectionView();
}

function renderElectionSchoolsGrid() {
  const grid = document.getElementById('election-schools-grid');
  if (!grid) return;

  const schools = window.ELECTION_2026_SCHOOLS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  const filtered = schools.filter(s => {
    const isSub = !!submissions[s.shala_darpan_code];
    if (ELECTION_FILTER_STATUS === 'submitted' && !isSub) return false;
    if (ELECTION_FILTER_STATUS === 'pending' && isSub) return false;

    if (ELECTION_SEARCH_QUERY) {
      const q = ELECTION_SEARCH_QUERY;
      const matchName = s.school_name.toLowerCase().includes(q);
      const matchCode = s.shala_darpan_code.toLowerCase().includes(q);
      const matchGp = s.panchayat_name.toLowerCase().includes(q);
      const matchPeeo = (s.peeo_name || '').toLowerCase().includes(q);
      return matchName || matchCode || matchGp || matchPeeo;
    }
    return true;
  });

  const myCode = (typeof STATE !== 'undefined' && STATE.currentUser?.role === 'school') ? String(STATE.currentUser.shala_darpan_code) : null;
  if (myCode) {
    filtered.sort((a, b) => {
      if (String(a.shala_darpan_code) === myCode) return -1;
      if (String(b.shala_darpan_code) === myCode) return 1;
      return 0;
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2.5rem; color:#64748b; font-weight:700">कोई विद्यालय नहीं मिला।</div>';
    return;
  }

  grid.innerHTML = filtered.map((s, idx) => {
    const sub = submissions[s.shala_darpan_code];
    const isSubmitted = !!sub;
    const isSpecial5 = ["485030", "488897", "488947", "221774", "410859"].includes(s.shala_darpan_code);
    const isMySchool = myCode && String(s.shala_darpan_code) === myCode;

    return `
      <div style="background:#fff; border:1px solid ${isMySchool ? '#f59e0b' : (isSubmitted ? '#86efac' : '#e2e8f0')}; border-top:4px solid ${isMySchool ? '#f59e0b' : (isSubmitted ? '#16a34a' : '#0284c7')}; border-radius:8px; padding:1.1rem; box-shadow:${isMySchool ? '0 4px 14px rgba(245,158,11,0.25)' : '0 2px 6px rgba(0,0,0,0.04)'}; display:flex; flex-direction:column; justify-content:space-between">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem; gap:0.4rem; flex-wrap:wrap">
            <div>
              <span style="font-size:0.75rem; font-weight:800; color:#0369a1; background:#e0f2fe; padding:2px 6px; border-radius:4px">#${idx + 1}</span>
              ${isMySchool ? '<span style="font-size:0.72rem; font-weight:900; color:#fff; background:#f59e0b; padding:2px 8px; border-radius:4px; margin-left:4px"><i class="fas fa-star"></i> आपका विद्यालय</span>' : ''}
              ${isSpecial5 ? '<span style="font-size:0.7rem; font-weight:800; color:#92400e; background:#fef3c7; padding:2px 6px; border-radius:4px; margin-left:4px">🌟 विशेष गैर-PEEO मुख्यालय</span>' : '<span style="font-size:0.7rem; font-weight:800; color:#1e40af; background:#dbeafe; padding:2px 6px; border-radius:4px; margin-left:4px">🏛️ PEEO मुख्यालय</span>'}
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
          <a href="election_form.html?code=${s.shala_darpan_code}&autoclick=pdf" target="_blank" class="btn btn-success btn-sm" style="font-weight:700; display:inline-flex; align-items:center; gap:0.3rem">
            <i class="fas fa-file-pdf"></i> A4 PDF
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function downloadElectionSummaryExcel() {
  const schools = window.ELECTION_2026_SCHOOLS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  let csv = 'क्र.सं.,जिला,ब्लॉक,ग्राम पंचायत,विद्यालय का नाम,शाला दर्पण कोड,PEEO परिक्षेत्र,मतदान बूथ संख्या,संस्था प्रधान नाम,मोबाइल,विद्यालय ईमेल आईडी,सत्यापन स्थिति,सबमिशन दिनांक\n';

  schools.forEach((s, idx) => {
    const sub = submissions[s.shala_darpan_code];
    const status = sub ? 'सत्यापित (Submitted)' : 'लंबित (Pending)';
    const email = sub?.school_email || '';
    const date = sub?.submitted_at || '';

    csv += `${idx + 1},"अजमेर (AJMER)","भिनाय","${s.panchayat_name}","${s.school_name.replace(/"/g, '""')}","${s.shala_darpan_code}","${s.peeo_name}",${s.booth_count},"${s.principal_name}","${s.principal_mobile}","${email}","${status}","${date}"\n`;
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CBEO_Bhinai_Panchayat_Election_2026_30_Schools_Summary.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof showToast === 'function') showToast('📥 30 विद्यालयों की चुनाव सत्यापन समेकित रिपोर्ट डाउनलोड हो गई!', 'success');
}

function downloadElection116BoothsExcel() {
  const booths = window.ELECTION_2026_BOOTHS || [];
  let submissions = {};
  try {
    submissions = JSON.parse(localStorage.getItem('cbeo_election_submissions') || '{}');
  } catch(e) {}

  let csv = 'क्र.सं.,बूथ संख्या,ग्राम पंचायत,मतदान केंद्र भवन का नाम,मतदान कक्ष विवरण,वार्ड संख्या,शाला दर्पण कोड,विद्युत व पंखे,फर्नीचर स्थिति,पृथक द्वार,चूना लाइनिंग,BLO का नाम,BLO पद,BLO मोबाइल,सत्यापन स्थिति\n';

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

    csv += `${idx + 1},${b.booth_no},"${b.panchayat_hi}","${b.building_hi}","${b.room_hi}","${b.ward}","${b.school_code}","${light}","${furn}","${door}","${lining}","${bloName}","${bloPost}","${bloMob}","${status}"\n`;
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CBEO_Bhinai_Panchayat_Election_2026_116_Booths_Detailed.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof showToast === 'function') showToast('📊 116 मतदान बूथों का विस्तृत एक्सेल डाउनलोड हो गया!', 'success');
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

if (typeof window !== 'undefined') {
  window.renderElectionView = renderElectionView;
  window.downloadElectionSummaryExcel = downloadElectionSummaryExcel;
  window.downloadElection116BoothsExcel = downloadElection116BoothsExcel;
  window.publishElectionDemandLive = publishElectionDemandLive;
}
