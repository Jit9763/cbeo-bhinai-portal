/**
 * CBEO Bhinai Portal - Universal PDF Engine & Official Document Print / WhatsApp Share
 * Block: Bhinai | District: AJMER (अजमेर)
 * Manages A4 Clean Print Layouts, html2pdf Blob Conversions, and Direct WhatsApp Sharing.
 */

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

