/**
 * CBEO Bhinai Portal - Saman Pariksha & Syllabus Operations Engine
 * Block: Bhinai | District: AJMER (अजमेर)
 * Handles Examination Demand Proforma, Syllabus Completion Tracking, MGGS Medium Logic, and Verification.
 */

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

