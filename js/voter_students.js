/**
 * CBEO Bhinai Portal - 18+ & 17+ Student Voter Registration Management Module
 * Block: Bhinai | District: AJMER (अजमेर)
 * 🚨 MANDATORY PERMANENT RULE: District is ALWAYS AJMER (अजमेर). NEVER use Kekri.
 * Full Monitoring Suite for Super Admin (Jitendra) and CBEO Bhinai
 */

(function() {
  'use strict';

  var currentFilter = 'all'; // all, govt, pvt, test, submitted, pending, locked, unlocked
  var currentPeeoFilter = 'all';
  var currentSearchQuery = '';
  var currentViewMode = 'grid'; // grid or table
  var activeModalSchoolCode = null;
  var activeVoterSubDemand = 'both'; // '18', '17', or 'both'

  // Test School (999999) Visibility Toggle - Default is OFF as ordered by user
  var includeTestSchool = (function() {
    var saved = localStorage.getItem('cbeo_voter_include_test_school');
    return saved === 'true'; // Default is false (OFF)
  })();

  window.toggleVoterTestSchool = function() {
    includeTestSchool = !includeTestSchool;
    localStorage.setItem('cbeo_voter_include_test_school', includeTestSchool ? 'true' : 'false');
    if (!includeTestSchool && currentFilter === 'test') {
      currentFilter = 'all';
    }
    renderVoterStudentsView();
    if (typeof renderDemandsSummary === 'function') {
      try { renderDemandsSummary(); } catch(e) {}
    }
  };

  window.isVoterTestSchoolIncluded = function() {
    return includeTestSchool;
  };

  window.switchVoterSubDemand = function(mode) {
    activeVoterSubDemand = mode;
    renderVoterStudentsView();
  };

  function getSubmissions() {
    var subs = {};
    try {
      subs = JSON.parse(localStorage.getItem('cbeo_voter_submissions') || '{}');
    } catch(e) {}
    // If old mock/dummy submission exists for 999999, clean it up so test school doesn't show false submitted status
    if (subs['999999']) {
      if (subs['999999'].submitted_by === 'जितेन्द्र कुमार (टेस्ट व्यवस्थापक)' || !subs['999999'].test_flag) {
        delete subs['999999'];
        try { localStorage.setItem('cbeo_voter_submissions', JSON.stringify(subs)); } catch(e) {}
      } else {
        subs['999999'].is_test = true;
        subs['999999'].test_flag = true;
      }
    }
    return subs;
  }

  function getMasterSchools(forceAll) {
    var master = window.VOTER_STUDENTS_MASTER || {};
    var schools = master.schools || [];
    if (!forceAll && !includeTestSchool) {
      return schools.filter(function(s) {
        return s.shala_darpan_code !== '999999' && !s.is_test;
      });
    }
    return schools;
  }

  function getPrefilled18Students() {
    var master = window.VOTER_STUDENTS_MASTER || {};
    return master.prefilled_18_students || {};
  }

  function getPrefilled17Students() {
    var master = window.VOTER_STUDENTS_MASTER || {};
    return master.prefilled_17_students || {};
  }

  function getSchoolMetrics(schoolCode) {
    var subs = getSubmissions();
    var prefilled18 = getPrefilled18Students();
    var prefilled17 = getPrefilled17Students();

    var sub = subs[schoolCode];
    if (sub && sub.submission_status === 'submitted') {
      var stu18 = sub.students_18 || [];
      var stu17 = sub.students_17 || [];
      var reg = stu18.filter(function(s) { return s.is_registered === 'हाँ'; }).length;
      var isNil = !!(sub.is_nil || (sub.is_nil_18 && sub.is_nil_17) || (stu18.length === 0 && stu17.length === 0));
      var isNil18 = !!(sub.is_nil_18 || (sub.is_nil && stu18.length === 0));
      var isNil17 = !!(sub.is_nil_17 || (sub.is_nil && stu17.length === 0));
      var c11_17 = stu17.filter(function(s) { return String(s.class_name || '').includes('11'); }).length;
      var c12_17 = stu17.length - c11_17;

      return {
        isSubmitted: true,
        submittedAt: sub.submitted_at || '',
        submittedBy: sub.submitted_by || '',
        isLocked: !!sub.is_locked,
        isNil: isNil,
        isNil18: isNil18,
        isNil17: isNil17,
        total18: stu18.length,
        reg18: reg,
        unreg18: stu18.length - reg,
        total17: stu17.length,
        c11_17: c11_17,
        c12_17: c12_17,
        adv17: stu17.filter(function(s) { return s.advance_form6_submitted === 'हाँ'; }).length,
        students18: stu18,
        students17: stu17
      };
    }

    var default18 = prefilled18[schoolCode] || [];
    var default17 = prefilled17[schoolCode] || [];
    var regDef = default18.filter(function(s) { return s.is_registered === 'हाँ'; }).length;
    var c11_def = default17.filter(function(s) { return String(s.class_name || '').includes('11'); }).length;
    var c12_def = default17.length - c11_def;

    return {
      isSubmitted: false,
      submittedAt: '',
      submittedBy: '',
      isLocked: !!(sub && sub.is_locked),
      isNil: false,
      isNil18: false,
      isNil17: false,
      total18: default18.length,
      reg18: regDef,
      unreg18: default18.length - regDef,
      total17: default17.length,
      c11_17: c11_def,
      c12_17: c12_def,
      adv17: 0,
      students18: default18,
      students17: default17
    };
  }

  function checkIsJitendra(loggedUser) {
    if (!loggedUser) return false;
    if (typeof isJitendraLoggedIn === 'function' && isJitendraLoggedIn()) return true;
    var u = String(loggedUser.username || '').toLowerCase();
    var sc = String(loggedUser.shala_darpan_code || '').toLowerCase();
    var aid = String(loggedUser.admin_id || '').toUpperCase();
    var role = String(loggedUser.role || '').toLowerCase();
    var name = String(loggedUser.name || '').toLowerCase();

    return (
      sc === 'admin_jitendra' ||
      u === 'admin_jitendra' ||
      u === 'jitendra_admin' ||
      u === 'jitendra' ||
      aid === 'ADMIN02' ||
      role === 'super admin' ||
      name.includes('जितेन्द्र') ||
      name.includes('jitendra')
    );
  }

  function checkIsAdmin(loggedUser) {
    if (!loggedUser) return false;
    return (
      checkIsJitendra(loggedUser) ||
      loggedUser.role === 'admin' ||
      loggedUser.admin_id === 'ADMIN01' ||
      loggedUser.username === 'cbeo_admin' ||
      loggedUser.shala_darpan_code === '8140'
    );
  }

  function renderVoterStudentsView() {
    var container = document.getElementById('view-voter-students');
    if (!container) return;

    var loggedUser = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
    var isJit = checkIsJitendra(loggedUser);
    var isSchool = loggedUser && loggedUser.role === 'school';
    var isPeeo = loggedUser && loggedUser.role === 'peeo';
    var isAdmin = checkIsAdmin(loggedUser);

    var allSchools = getMasterSchools();

    // 1. UN趋THENTICATED VISITOR (NOT LOGGED IN)
    if (!loggedUser) {
      container.innerHTML = `
        <div class="voter-view-wrapper" style="padding:1.5rem 0; max-width:1000px; margin:0 auto">
          <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#ffffff; padding:2rem 2.5rem; border-radius:16px; margin-bottom:2rem; box-shadow:0 10px 30px rgba(15,23,42,0.15); border-left:6px solid #f59e0b">
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); padding:4px 14px; border-radius:20px; font-size:0.82rem; font-weight:700; color:#fde047; margin-bottom:12px">
              <span>🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</span>
              <span style="opacity:0.6">|</span>
              <span>जिला: अजमेर (AJMER)</span>
            </div>
            <h2 style="font-size:1.6rem; font-weight:800; margin:0 0 10px 0; color:#ffffff">
              🗳️ 18+ एवं 17+ विद्यार्थी मतदाता सूची सत्यापन व अग्रिम पंजीकरण प्रपत्र 2026
            </h2>
            <p style="font-size:1rem; color:#cbd5e1; margin:0 0 1.5rem 0; max-width:850px; line-height:1.6">
              ब्लॉक भिनाय के ${includeTestSchool ? 'समस्त 58 माध्यमिक व उच्च माध्यमिक विद्यालयों (49 राजकीय + 8 निजी + 1 टेस्ट)' : 'समस्त 57 माध्यमिक व उच्च माध्यमिक विद्यालयों (49 राजकीय + 8 निजी)'} के विद्यार्थियों का मतदाता सूची सत्यापन, भाग/क्रम संख्या अंकन एवं 17+ अग्रिम भावी मतदाता पंजीकरण प्रपत्र।
            </p>
            <div style="display:flex; gap:1rem; flex-wrap:wrap">
              <button onclick="openLoginModal(false)" class="btn btn-warning" style="font-weight:800; padding:0.75rem 1.75rem; font-size:1rem; border-radius:8px">
                <i class="fas fa-sign-in-alt"></i> 🔐 विद्यालय लॉगिन करके प्रपत्र भरें
              </button>
              <a href="voter_form.html?code=999999" target="_blank" class="btn btn-outline-light" style="font-weight:700; padding:0.75rem 1.5rem; font-size:0.95rem; border-radius:8px; text-decoration:none">
                <i class="fas fa-flask"></i> टेस्ट स्कूल प्रपत्र देखें (999999)
              </a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 2. SCHOOL USER VIEW: Dedicated Single-School Proforma Dashboard with Separate 18+ & 17+ Cards
    if (isSchool) {
      var myCode = String(loggedUser.shala_darpan_code).trim();
      var mySchool = getMasterSchools(true).find(function(s) {
        return String(s.shala_darpan_code).trim() === myCode;
      }) || {
        shala_darpan_code: myCode,
        school_name: loggedUser.school_name || 'विद्यालय',
        school_name_hi: loggedUser.school_name_hi || loggedUser.school_name || 'विद्यालय',
        peeo_name: loggedUser.peeo_name || '',
        principal_name: loggedUser.principal_name || '',
        principal_mobile: loggedUser.principal_mobile || ''
      };

      var m = getSchoolMetrics(myCode);

      var statusBadge = m.isSubmitted 
        ? `<span style="background:#16a34a; color:#fff; padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.9rem; display:inline-flex; align-items:center; gap:6px"><i class="fas fa-check-circle"></i> ✓ प्रपत्र सफलतापूर्वक सबमिट पूर्ण</span>`
        : `<span style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.9rem; display:inline-flex; align-items:center; gap:6px"><i class="fas fa-exclamation-triangle"></i> ⚠️ प्रपत्र सबमिशन लंबित (अति-आवश्यक)</span>`;

      var html = `
        <div id="school-voter-dashboard" class="voter-view-wrapper" style="padding:1rem 0; max-width:1150px; margin:0 auto">
          <!-- School Dedicated Header Banner -->
          <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#ffffff; padding:1.5rem 2rem; border-radius:14px; margin-bottom:1.5rem; box-shadow:0 8px 24px rgba(15,23,42,0.15); border-left:6px solid #f59e0b">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem">
              <div>
                <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px">
                  <span>🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</span>
                  <span style="opacity:0.6">|</span>
                  <span>जिला: अजमेर (AJMER)</span>
                </div>
                <h2 style="font-size:1.5rem; font-weight:800; margin:0 0 6px 0; color:#ffffff">
                  🏫 ${mySchool.school_name_hi || mySchool.school_name}
                </h2>
                <div style="font-size:0.92rem; color:#cbd5e1; display:flex; gap:1.25rem; flex-wrap:wrap; margin-top:6px">
                  <span><strong>शाला दर्पण / कोड:</strong> <code style="background:rgba(255,255,255,0.2); color:#fff; padding:2px 8px; border-radius:4px">${mySchool.shala_darpan_code}</code></span>
                  <span><strong>PEEO क्लस्टर:</strong> ${mySchool.peeo_name || '---'}</span>
                  ${mySchool.principal_name ? `<span><strong>संस्था प्रधान:</strong> ${mySchool.principal_name}</span>` : ''}
                </div>
              </div>
              <div style="text-align:right">
                ${statusBadge}
                ${m.submittedAt ? `<div style="font-size:0.8rem; color:#93c5fd; margin-top:6px">सबमिट दिनांक: ${m.submittedAt}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- Sub-Demand Switcher (18+ & 17+ Separate) -->
          <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:0.85rem 1.25rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-weight:800; color:#0f172a; font-size:1rem; display:flex; align-items:center; gap:8px">
              <span>📌 प्रपत्र कार्ड दृश्य (18+ एवं 17+ अलग-अलग):</span>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
              <button class="btn btn-sm ${activeVoterSubDemand === 'both' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('both')" style="font-weight:800; padding:0.5rem 1rem">
                📋 दोनों कार्ड अलग-अलग (18+ एवं 17+)
              </button>
              <button class="btn btn-sm ${activeVoterSubDemand === '18' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('18')" style="font-weight:800; padding:0.5rem 1rem">
                🗳️ केवल 18+ प्रपत्र कार्ड (कक्षा 12)
              </button>
              <button class="btn btn-sm ${activeVoterSubDemand === '17' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('17')" style="font-weight:800; padding:0.5rem 1rem">
                🌟 केवल 17+ प्रपत्र कार्ड (कक्षा 11 व 12)
              </button>
            </div>
          </div>

          <!-- Cards Display Container -->
          <div id="voter-schools-content"></div>
        </div>
      `;

      container.innerHTML = html;
      renderGridView(document.getElementById('voter-schools-content'), [mySchool]);
      return;
    }

    // 3. PEEO CLUSTER VIEW: Restricted to PEEO's secondary/sr secondary schools
    if (isPeeo) {
      var pCode = String(loggedUser.shala_darpan_code).trim();
      var pName = String(loggedUser.peeo_name || '').toUpperCase().replace('PEEO ', '');
      var peeoSchools = allSchools.filter(function(s) {
        return String(s.peeo_code) === pCode || 
               String(s.shala_darpan_code) === pCode ||
               String(s.peeo_name || '').toUpperCase().includes(pName);
      });
      if (peeoSchools.length === 0) peeoSchools = allSchools;

      var peeoSubCount = 0;
      peeoSchools.forEach(function(s) {
        if (getSchoolMetrics(s.shala_darpan_code).isSubmitted) peeoSubCount++;
      });

      var html = `
        <div id="school-voter-dashboard" class="voter-view-wrapper" style="padding:1rem 0; max-width:1100px; margin:0 auto">
          <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#ffffff; padding:1.75rem 2rem; border-radius:14px; margin-bottom:1.5rem; box-shadow:0 8px 24px rgba(15,23,42,0.15); border-left:6px solid #f59e0b">
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:10px">
              <span>🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</span>
              <span style="opacity:0.6">|</span>
              <span>जिला: अजमेर (AJMER)</span>
            </div>
            <h2 style="font-size:1.5rem; font-weight:800; margin:0 0 6px 0; color:#ffffff">
              🏢 PEEO क्लस्टर मॉनिटरिंग: ${loggedUser.peeo_name || loggedUser.school_name || 'PEEO'}
            </h2>
            <p style="font-size:0.92rem; color:#cbd5e1; margin:0">
              आपके परिक्षेत्र के समस्त माध्यमिक/उच्च माध्यमिक विद्यालयों के 18+ एवं 17+ विद्यार्थी मतदाता प्रपत्र सबमिशन स्थिति (${peeoSubCount}/${peeoSchools.length} पूर्ण)।
            </p>
          </div>

          <!-- PEEO Nodal School Quick Action -->
          <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:14px; padding:1.25rem 1.5rem; margin-bottom:1.5rem; box-shadow:0 4px 16px rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem">
            <div>
              <div style="font-weight:800; font-size:1rem; color:#0f172a">📝 आपके नोडल उच्च माध्यमिक विद्यालय का प्रपत्र:</div>
              <div style="font-size:0.85rem; color:#64748b; margin-top:2px">शाला दर्पण कोड: <code>${pCode}</code></div>
            </div>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap">
              <a href="voter_form.html?code=${pCode}" target="_blank" class="btn btn-warning btn-sm" style="font-weight:800; padding:0.6rem 1.25rem; border-radius:8px; text-decoration:none">
                <i class="fas fa-edit"></i> 📝 नोडल स्कूल प्रपत्र भरें
              </a>
              <button class="btn btn-info btn-sm" onclick="window.openVoterPdfPreviewModal('${pCode}')" style="background:#0284c7; color:#fff; font-weight:700; border:none; padding:0.6rem 1.1rem; border-radius:8px">
                <i class="fas fa-eye"></i> 👁️ अवलोकन
              </button>
              <button class="btn btn-success btn-sm" onclick="window.downloadVoterSingleSchoolPdf('${pCode}')" style="background:#16a34a; font-weight:700; border:none; padding:0.6rem 1.1rem; border-radius:8px">
                <i class="fas fa-file-pdf"></i> 📄 PDF
              </button>
            </div>
          <!-- Sub-Demand Switcher (18+ & 17+ Separate) -->
          <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:0.85rem 1.25rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-weight:800; color:#0f172a; font-size:1rem; display:flex; align-items:center; gap:8px">
              <span>📌 प्रपत्र कार्ड दृश्य:</span>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
              <button class="btn btn-sm ${activeVoterSubDemand === 'both' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('both')" style="font-weight:800; padding:0.5rem 1rem">
                📋 दोनों कार्ड अलग-अलग (18+ एवं 17+)
              </button>
              <button class="btn btn-sm ${activeVoterSubDemand === '18' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('18')" style="font-weight:800; padding:0.5rem 1rem">
                🗳️ केवल 18+ प्रपत्र कार्ड (कक्षा 12)
              </button>
              <button class="btn btn-sm ${activeVoterSubDemand === '17' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('17')" style="font-weight:800; padding:0.5rem 1rem">
                🌟 केवल 17+ प्रपत्र कार्ड (कक्षा 11 व 12)
              </button>
            </div>
          </div>

          <div id="voter-schools-content"></div>
        </div>
      `;
      container.innerHTML = html;
      renderGridView(document.getElementById('voter-schools-content'), peeoSchools);
      return;
    }

    // 4. JITENDRA SUPER ADMIN: FULL BLOCK LIVE MONITORING CONTROL ROOM (58 SCHOOLS)
    var targetSchools = allSchools;

    // Calculate Global Block Totals
    var blockTotalSchools = allSchools.length;
    var blockSubmittedCount = 0;
    var blockPendingCount = 0;
    var blockLockedCount = 0;
    var blockTotal18 = 0;
    var blockReg18 = 0;
    var blockUnreg18 = 0;
    var blockTotal17 = 0;

    allSchools.forEach(function(s) {
      var m = getSchoolMetrics(s.shala_darpan_code);
      if (m.isSubmitted) blockSubmittedCount++;
      else blockPendingCount++;
      if (m.isLocked) blockLockedCount++;
      blockTotal18 += m.total18;
      blockReg18 += m.reg18;
      blockUnreg18 += m.unreg18;
      blockTotal17 += m.total17;
    });

    var progressPct = blockTotalSchools > 0 ? Math.round((blockSubmittedCount / blockTotalSchools) * 100) : 0;
    var progressColor = progressPct === 100 ? '#16a34a' : (progressPct >= 50 ? '#0284c7' : '#ea580c');
    var progressStatusText = progressPct === 100 ? '✓ 100% कार्य पूर्ण' : (progressPct >= 50 ? 'तेजी से प्रगति पर' : '⚠️ लंबित सबमिशन शेष');

    var uniquePeeos = Array.from(new Set(allSchools.map(function(s) { return s.peeo_name; }))).filter(Boolean).sort();

    var html = `
      <div class="voter-view-wrapper" style="padding:1rem 0">
        <!-- Hero Banner with Saman Pariksha Monitoring Layout -->
        <div id="voter-block-hero" class="sp-hero-banner" style="background:linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color:#ffffff; padding:1.5rem 1.75rem; border-radius:12px; margin-bottom:1.5rem; box-shadow:0 6px 20px rgba(15,23,42,0.15); border-left:6px solid #f59e0b">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem">
            <div>
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); padding:3px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px">
                <span>🏛️ कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</span>
                <span style="opacity:0.6">|</span>
                <span>जिला: अजमेर (AJMER)</span>
                ${isAdmin ? '<span style="background:#dc2626; color:#fff; padding:1px 8px; border-radius:10px; font-size:0.72rem; margin-left:4px">👑 Super Admin Monitor</span>' : ''}
              </div>
              <h2 style="font-size:1.45rem; font-weight:800; margin:0 0 6px 0; letter-spacing:0.3px">
                🗳️ 18+ एवं 17+ विद्यार्थी मतदाता सूची सत्यापन व अग्रिम पंजीकरण मांग 2026
              </h2>
              <p style="font-size:0.92rem; color:#cbd5e1; margin:0 0 10px 0; max-width:850px">
                ब्लॉक भिनाय के ${includeTestSchool ? 'समस्त 58 माध्यमिक/उच्च माध्यमिक विद्यालयों (49 राजकीय + 8 निजी + 1 टेस्ट स्कूल)' : 'समस्त 57 माध्यमिक/उच्च माध्यमिक विद्यालयों (49 राजकीय + 8 निजी)'} के विद्यार्थियों का मतदाता सूची सत्यापन, भाग/क्रम संख्या अंकन एवं 17+ अग्रिम भावी मतदाता सूची का संपूर्ण लाइव मॉनिटरिंग कंट्रोल रूम।
              </p>
              <!-- Dynamic Animated Progress Bar (Saman Pariksha Style) -->
              <div style="background:rgba(255,255,255,0.12); border-radius:8px; padding:0.6rem 0.85rem; max-width:680px">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; margin-bottom:4px">
                  <span>समग्र ब्लॉक प्रगति: <strong style="color:#fde047">${progressPct}%</strong> (${blockSubmittedCount}/${blockTotalSchools} विद्यालय पूर्ण)</span>
                  <span style="color:#6ee7b7">${progressStatusText}</span>
                </div>
                <div style="width:100%; height:8px; background:rgba(0,0,0,0.3); border-radius:4px; overflow:hidden">
                  <div style="width:${progressPct}%; height:100%; background:linear-gradient(90deg, #10b981, #38bdf8); border-radius:4px; transition:width 0.4s ease"></div>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:flex-start">
              <a href="voter_form.html?code=${(loggedUser && loggedUser.role === 'school') ? loggedUser.shala_darpan_code : '999999'}" target="_blank" class="btn btn-warning" style="font-weight:800; text-decoration:none; padding:0.6rem 1.1rem; box-shadow:0 4px 12px rgba(217,119,6,0.3)">
                <i class="fas fa-edit"></i> 📝 प्रपत्र भरें / संशोधित करें
              </a>
              <button class="btn btn-light" onclick="window.downloadVoterConsolidatedExcel()" style="background:#ffffff; color:#1e3a8a; font-weight:800; border:none; padding:0.6rem 1rem">
                <i class="fas fa-file-excel text-success"></i> समेकित Excel
              </button>
              <button class="btn btn-light" onclick="window.downloadVoterMasterPdf()" style="background:#ffffff; color:#b91c1c; font-weight:800; border:none; padding:0.6rem 1rem">
                <i class="fas fa-file-pdf"></i> समेकित PDF
              </button>
              ${isAdmin ? `
                <button class="btn btn-success" onclick="window.openVoterBroadcastModal()" style="font-weight:800; border:none; padding:0.6rem 1rem">
                  <i class="fab fa-whatsapp"></i> WhatsApp ब्रॉडकास्ट
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div id="voter-hero-kpis" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:1rem; margin-bottom:1.5rem">
          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#64748b; text-transform:uppercase">कुल विद्यालय</div>
            <div style="font-size:1.75rem; font-weight:900; color:#1e3a8a; margin-top:4px">${blockTotalSchools}</div>
            <div style="font-size:0.72rem; color:#64748b; margin-top:2px">${includeTestSchool ? '49 राजकीय + 8 निजी + 1 टेस्ट' : '49 राजकीय + 8 निजी (टेस्ट बंद)'}</div>
          </div>

          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#16a34a; text-transform:uppercase">डेटा सबमिट पूर्ण</div>
            <div style="font-size:1.75rem; font-weight:900; color:#15803d; margin-top:4px">${blockSubmittedCount}</div>
            <div style="font-size:0.72rem; color:#16a34a; font-weight:700; margin-top:2px">${progressPct}% पूर्णता दर</div>
          </div>

          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#dc2626; text-transform:uppercase">लंबित डिफ़ॉल्टर</div>
            <div style="font-size:1.75rem; font-weight:900; color:#b91c1c; margin-top:4px">${blockPendingCount}</div>
            <div style="font-size:0.72rem; color:#dc2626; font-weight:700; margin-top:2px">अति-आवश्यक सबमिशन शेष</div>
          </div>

          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#0369a1; text-transform:uppercase">18+ कुल विद्यार्थी</div>
            <div style="font-size:1.75rem; font-weight:900; color:#0284c7; margin-top:4px">${blockTotal18}</div>
            <div style="font-size:0.72rem; color:#0369a1; margin-top:2px">शाला दर्पण + नव-प्रविष्ट</div>
          </div>

          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#166534; text-transform:uppercase">18+ पंजीकृत (हाँ)</div>
            <div style="font-size:1.75rem; font-weight:900; color:#166534; margin-top:4px">${blockReg18}</div>
            <div style="font-size:0.72rem; color:#166534; font-weight:700; margin-top:2px">मतदाता सूची में नाम जुड़ा</div>
          </div>

          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#d97706; text-transform:uppercase">18+ अपेक्षित (नहीं)</div>
            <div style="font-size:1.75rem; font-weight:900; color:#d97706; margin-top:4px">${blockUnreg18}</div>
            <div style="font-size:0.72rem; color:#d97706; font-weight:700; margin-top:2px">कारण अंकित</div>
          </div>

          <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="font-size:0.75rem; font-weight:800; color:#7c3aed; text-transform:uppercase">17+ भावी विद्यार्थी</div>
            <div style="font-size:1.75rem; font-weight:900; color:#7c3aed; margin-top:4px">${blockTotal17}</div>
            <div style="font-size:0.72rem; color:#7c3aed; margin-top:2px">PEEO/स्कूल द्वारा जोड़े गए</div>
          </div>

          ${isAdmin ? `
            <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
              <div style="font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase">🔒 लॉक प्रपत्र</div>
              <div style="font-size:1.75rem; font-weight:900; color:#0f172a; margin-top:4px">${blockLockedCount}</div>
              <div style="font-size:0.72rem; color:#64748b; margin-top:2px">एडमिन द्वारा लॉक</div>
            </div>
          ` : ''}
        </div>

        <!-- Sub-Demand Switcher Toolbar (18+ & 17+ Separate Cards) -->
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:0.75rem 1.15rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
          <div style="font-weight:800; color:#0f172a; font-size:0.95rem; display:flex; align-items:center; gap:8px">
            <span>📌 प्रपत्र कार्ड चयन (18+ एवं 17+ अलग-अलग):</span>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
            <button class="btn btn-sm ${activeVoterSubDemand === 'both' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('both')" style="font-weight:800">
              📋 1. दोनों कार्ड अलग-अलग (18+ एवं 17+)
            </button>
            <button class="btn btn-sm ${activeVoterSubDemand === '18' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('18')" style="font-weight:800">
              🗳️ 2. 18+ विद्यार्थी मतदाता सत्यापन कार्ड (कक्षा 12)
            </button>
            <button class="btn btn-sm ${activeVoterSubDemand === '17' ? 'btn-primary' : 'btn-outline'}" onclick="window.switchVoterSubDemand('17')" style="font-weight:800">
              🌟 3. 17+ अग्रिम भावी मतदाता कार्ड (कक्षा 11 व 12)
            </button>
          </div>
        </div>

        <!-- Filter & Control Toolbar (Saman Pariksha Style) -->
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:0.85rem 1.15rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap">
            <button class="btn btn-sm ${currentFilter === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="window.setVoterFilter('all')">
              सभी विद्यालय (${targetSchools.length})
            </button>
            <button class="btn btn-sm ${currentFilter === 'govt' ? 'btn-primary' : 'btn-outline'}" onclick="window.setVoterFilter('govt')">
              राजकीय (Govt - 49)
            </button>
            <button class="btn btn-sm ${currentFilter === 'pvt' ? 'btn-primary' : 'btn-outline'}" onclick="window.setVoterFilter('pvt')">
              निजी (8 Private)
            </button>
            <button class="btn btn-sm" onclick="window.toggleVoterTestSchool()" style="background:${includeTestSchool ? '#f5f3ff' : '#fef2f2'}; color:${includeTestSchool ? '#7c3aed' : '#b91c1c'}; border:1.5px solid ${includeTestSchool ? '#8b5cf6' : '#f87171'}; font-weight:800; padding:0.35rem 0.75rem; border-radius:6px; display:inline-flex; align-items:center; gap:6px; cursor:pointer" title="टेस्ट स्कूल (999999) शामिल करें या पूरी सूची, गणना व एक्सेल से हटाएं">
              <i class="fas ${includeTestSchool ? 'fa-toggle-on' : 'fa-toggle-off'}" style="font-size:1.15rem; color:${includeTestSchool ? '#7c3aed' : '#dc2626'}"></i>
              <span>${includeTestSchool ? '🧪 टेस्ट स्कूल: ऑन (58)' : '🧪 टेस्ट स्कूल: ऑफ (57)'}</span>
            </button>
            <button class="btn btn-sm ${currentFilter === 'submitted' ? 'btn-success' : 'btn-outline'}" onclick="window.setVoterFilter('submitted')">
              ✅ सबमिट पूर्ण
            </button>
            <button class="btn btn-sm ${currentFilter === 'pending' ? 'btn-warning' : 'btn-outline'}" onclick="window.setVoterFilter('pending')">
              ⚠️ लंबित (${blockPendingCount})
            </button>
            ${isAdmin ? `
              <button class="btn btn-sm ${currentFilter === 'locked' ? 'btn-danger' : 'btn-outline'}" onclick="window.setVoterFilter('locked')">
                🔒 लॉक (${blockLockedCount})
              </button>
              <button class="btn btn-sm ${currentFilter === 'unlocked' ? 'btn-primary' : 'btn-outline'}" onclick="window.setVoterFilter('unlocked')">
                🔓 अनलॉक
              </button>
            ` : ''}
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap">
            <select id="voter-peeo-filter" class="form-control" style="width:180px; padding:0.4rem 0.6rem; font-size:0.85rem; font-weight:700" onchange="window.onVoterPeeoFilterChange(this.value)">
              <option value="all">-- समस्त 25 PEEO क्लस्टर --</option>
              ${uniquePeeos.map(function(p) { return '<option value="' + p + '" ' + (currentPeeoFilter === p ? 'selected' : '') + '>' + p + '</option>'; }).join('')}
            </select>

            <div style="position:relative; width:220px">
              <input type="text" id="voter-search-input" class="form-control" placeholder="🔍 खोजें (नाम / कोड / PEEO)..." style="padding:0.4rem 0.75rem; font-size:0.85rem" value="${currentSearchQuery}" oninput="window.onVoterSearchInput(this.value)">
            </div>

            <div style="display:flex; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden">
              <button class="btn btn-sm" style="background:${currentViewMode === 'grid' ? '#1e3a8a' : '#fff'}; color:${currentViewMode === 'grid' ? '#fff' : '#334155'}; border:none; padding:0.4rem 0.75rem" onclick="window.setVoterViewMode('grid')" title="कार्ड ग्रिड दृश्य">
                <i class="fas fa-th-large"></i>
              </button>
              <button class="btn btn-sm" style="background:${currentViewMode === 'table' ? '#1e3a8a' : '#fff'}; color:${currentViewMode === 'table' ? '#fff' : '#334155'}; border:none; padding:0.4rem 0.75rem" onclick="window.setVoterViewMode('table')" title="तालिका दृश्य">
                <i class="fas fa-list"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic School Cards Grid / Table -->
        <div id="voter-schools-content">
          <!-- Rendered by renderDynamicContent -->
        </div>
      </div>
    `;

    container.innerHTML = html;
    renderVoterDynamicContent(targetSchools);
  }

  function getFilteredSchools(schools) {
    return schools.filter(function(s) {
      var m = getSchoolMetrics(s.shala_darpan_code);

      // If test school toggle is OFF, exclude 999999
      if (!includeTestSchool && (s.shala_darpan_code === '999999' || s.is_test)) return false;

      // Status / Type filter
      if (currentFilter === 'govt' && s.type === 'Private') return false;
      if (currentFilter === 'pvt' && s.type !== 'Private') return false;
      if (currentFilter === 'test' && s.shala_darpan_code !== '999999') return false;
      if (currentFilter === 'submitted' && !m.isSubmitted) return false;
      if (currentFilter === 'pending' && m.isSubmitted) return false;
      if (currentFilter === 'locked' && !m.isLocked) return false;
      if (currentFilter === 'unlocked' && m.isLocked) return false;

      // PEEO filter
      if (currentPeeoFilter !== 'all' && s.peeo_name !== currentPeeoFilter) return false;

      // Search query
      if (currentSearchQuery) {
        var q = currentSearchQuery.toLowerCase().trim();
        var name = (s.school_name_hi || s.school_name || '').toLowerCase();
        var code = String(s.shala_darpan_code).toLowerCase();
        var peeo = (s.peeo_name || '').toLowerCase();
        var prin = (s.principal_name || '').toLowerCase();
        var mob = String(s.principal_mobile || '');
        if (!name.includes(q) && !code.includes(q) && !peeo.includes(q) && !prin.includes(q) && !mob.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }

  function renderVoterDynamicContent(schools) {
    var contentBox = document.getElementById('voter-schools-content');
    if (!contentBox) return;

    var filtered = getFilteredSchools(schools);

    if (filtered.length === 0) {
      contentBox.innerHTML = `
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:3rem; text-align:center; color:#64748b">
          <i class="fas fa-search" style="font-size:2.5rem; opacity:0.4; margin-bottom:0.75rem"></i>
          <h4>कोई विद्यालय परिणाम नहीं मिला</h4>
          <p>कृपया अपने फ़िल्टर अथवा खोज शब्दों में परिवर्तन करें।</p>
        </div>
      `;
      return;
    }

    if (currentViewMode === 'table') {
      renderTableView(contentBox, filtered);
    } else {
      renderGridView(contentBox, filtered);
    }
  }

  function generateSchoolCardHtml(s, sec, idx, isAdmin) {
    if (sec === 'both') {
      return generateSchoolCardHtml(s, '18', idx, isAdmin) + generateSchoolCardHtml(s, '17', idx, isAdmin);
    }

    var m = getSchoolMetrics(s.shala_darpan_code);
    var isPvt = s.type === 'Private';
    var isTest = s.shala_darpan_code === '999999';
    var is18 = (sec === '18');

    var isSectionNil = is18 ? (m.isNil18 || (m.isNil && m.total18 === 0)) : (m.isNil17 || (m.isNil && m.total17 === 0));
    var isSubmitted = m.isSubmitted;

    var badgeClass = isSubmitted ? 'background:#16a34a; color:#fff;' : 'background:#fef3c7; color:#92400e; border:1px solid #fde68a;';
    var badgeText = isSubmitted 
      ? (isSectionNil ? `<i class="fas fa-check-circle"></i> ✓ पूर्ण (NIL)` : `<i class="fas fa-check-circle"></i> ✓ सबमिट पूर्ण`) 
      : `<i class="fas fa-clock"></i> ⚠️ लंबित`;

    var lockBadge = m.isLocked 
      ? `<span style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:800; display:inline-flex; align-items:center; gap:3px"><i class="fas fa-lock"></i> लॉक</span>`
      : `<span style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:800; display:inline-flex; align-items:center; gap:3px"><i class="fas fa-lock-open"></i> खुला</span>`;

    var sectionTag = is18
      ? `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:800; display:inline-flex; align-items:center; gap:4px">🗳️ 18+ सत्यापन (कक्षा 12)</span>`
      : `<span style="background:#faf5ff; color:#7c3aed; border:1px solid #ddd6fe; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:800; display:inline-flex; align-items:center; gap:4px">🌟 17+ अग्रिम (कक्षा 11 व 12)</span>`;

    var topBorderColor = isSubmitted ? '#16a34a' : (is18 ? '#2563eb' : '#7c3aed');

    var miniBoxesHtml = is18 ? `
      <div style="flex:1; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px; text-align:center">
        <div style="font-size:0.7rem; color:#1d4ed8; font-weight:700">18+ कुल</div>
        <div style="font-size:1.15rem; font-weight:900; color:#1e40af">${m.total18}</div>
        <div style="font-size:0.68rem; color:#1d4ed8">कक्षा 12वीं</div>
      </div>
      <div style="flex:1; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:6px; text-align:center">
        <div style="font-size:0.7rem; color:#15803d; font-weight:700">18+ पंजीकृत</div>
        <div style="font-size:1.15rem; font-weight:900; color:#166534">${m.reg18}</div>
        <div style="font-size:0.68rem; color:#15803d">EPIC नंबर दर्ज</div>
      </div>
      <div style="flex:1; background:#fff7ed; border:1px solid #fed7aa; border-radius:6px; padding:6px; text-align:center">
        <div style="font-size:0.7rem; color:#9a3412; font-weight:700">18+ अपेक्षित</div>
        <div style="font-size:1.15rem; font-weight:900; color:#ea580c">${m.unreg18}</div>
        <div style="font-size:0.68rem; color:#9a3412">कारण दर्ज</div>
      </div>
    ` : `
      <div style="flex:1; background:#faf5ff; border:1px solid #ddd6fe; border-radius:6px; padding:6px; text-align:center">
        <div style="font-size:0.7rem; color:#6d28d9; font-weight:700">17+ अग्रिम</div>
        <div style="font-size:1.15rem; font-weight:900; color:#7c3aed">${m.total17}</div>
        <div style="font-size:0.68rem; color:#6d28d9">भावी मतदाता</div>
      </div>
      <div style="flex:1; background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:6px; text-align:center">
        <div style="font-size:0.7rem; color:#0369a1; font-weight:700">कक्षा 11वीं</div>
        <div style="font-size:1.15rem; font-weight:900; color:#0284c7">${m.c11_17}</div>
        <div style="font-size:0.68rem; color:#0369a1">17+ विद्यार्थी</div>
      </div>
      <div style="flex:1; background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; padding:6px; text-align:center">
        <div style="font-size:0.7rem; color:#3730a3; font-weight:700">कक्षा 12वीं</div>
        <div style="font-size:1.15rem; font-weight:900; color:#4338ca">${m.c12_17}</div>
        <div style="font-size:0.68rem; color:#3730a3">17+ विद्यार्थी</div>
      </div>
    `;

    var formBtnLabel = is18 ? (m.isSubmitted ? '18+ संशोधन' : '18+ प्रपत्र भरें') : (m.isSubmitted ? '17+ संशोधन' : '17+ प्रपत्र भरें');
    var formBtnUrl = `voter_form.html?code=${s.shala_darpan_code}&sec=${is18 ? '18' : '17'}`;

    return `
      <div class="sp-school-card" style="background:#ffffff; border:1.5px solid ${m.isSubmitted ? '#86efac' : '#cbd5e1'}; border-radius:10px; padding:1.25rem; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden">
        <div style="position:absolute; top:0; left:0; right:0; height:4px; background:${topBorderColor}"></div>
        
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem">
            <div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px">
                <span style="font-size:0.75rem; font-weight:800; color:#64748b">#${idx + 1}</span>
                ${sectionTag}
              </div>
              <h4 style="font-size:0.95rem; font-weight:800; color:#0f172a; margin:2px 0 0 0">
                ${s.school_name_hi || s.school_name}
              </h4>
              <div style="font-size:0.76rem; color:#64748b">${s.school_name_en || ''}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px">
              <span style="padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:800; ${badgeClass}">
                ${badgeText}
              </span>
              ${lockBadge}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; font-size:0.8rem; background:#f8fafc; padding:0.6rem 0.8rem; border-radius:6px; margin:0.6rem 0; border:1px solid #e2e8f0">
            <div><strong>कोड:</strong> <code>${s.shala_darpan_code}</code></div>
            <div><strong>श्रेणी:</strong> ${isTest ? '<span style="color:#7c3aed; font-weight:800">🧪 टेस्ट स्कूल</span>' : (isPvt ? '<span style="color:#b45309; font-weight:700">निजी</span>' : '<span style="color:#15803d; font-weight:700">राजकीय</span>')}</div>
            <div style="grid-column:span 2"><strong>PEEO:</strong> ${s.peeo_name}</div>
            <div style="grid-column:span 2"><strong>संस्था प्रधान:</strong> ${s.principal_name || 'श्री संस्था प्रधान'} (मो. ${s.principal_mobile || '---'})</div>
            ${m.submittedAt ? `<div style="grid-column:span 2; font-size:0.74rem; color:#15803d"><strong>सबमिट दिनांक:</strong> ${m.submittedAt}</div>` : ''}
          </div>

          <!-- Student Metrics Mini Table -->
          <div style="display:flex; gap:0.5rem; margin-bottom:0.85rem">
            ${miniBoxesHtml}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.5rem">
          <a href="${formBtnUrl}" target="_blank" class="btn btn-primary btn-sm" style="flex:1.2; font-weight:800; text-decoration:none; justify-content:center; padding:0.4rem 0.5rem">
            <i class="fas fa-edit"></i> ${formBtnLabel}
          </a>
          <button class="btn btn-info btn-sm" onclick="window.openVoterPdfPreviewModal('${s.shala_darpan_code}', '${is18 ? '18' : '17'}')" title="${is18 ? '18+' : '17+'} अधिकृत प्रपत्र अवलोकन" style="color:#ffffff; background:#0284c7; border:none; padding:0.4rem 0.65rem; font-weight:700">
            <i class="fas fa-eye"></i> अवलोकन
          </button>
          <button class="btn btn-warning btn-sm" onclick="window.downloadVoterSingleSchoolPdf('${s.shala_darpan_code}', '${is18 ? '18' : '17'}')" title="${is18 ? '18+' : '17+'} प्रमाणित PDF डाउनलोड करें" style="font-weight:700; color:#0f172a; padding:0.4rem 0.65rem">
            <i class="fas fa-download"></i> PDF
          </button>
          ${isAdmin ? `
            <button class="btn btn-sm ${m.isLocked ? 'btn-danger' : 'btn-outline-secondary'}" onclick="window.toggleVoterSchoolLock('${s.shala_darpan_code}')" title="${m.isLocked ? 'विद्यालय प्रपत्र अनलॉक करें' : 'विद्यालय प्रपत्र लॉक करें'}" style="padding:0.4rem 0.6rem; font-weight:700">
              <i class="fas ${m.isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm" onclick="window.sendVoterSchoolReminder('${s.shala_darpan_code}', '${s.school_name_hi || s.school_name}', '${s.principal_mobile}')" title="संस्था प्रधान को WhatsApp संदेश भेजें" style="color:#16a34a; border-color:#86efac; padding:0.4rem 0.6rem">
            <i class="fab fa-whatsapp"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderGridView(container, schools) {
    var loggedUser = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
    var isAdmin = checkIsAdmin(loggedUser);

    var cardsHtml = schools.map(function(s, idx) {
      return generateSchoolCardHtml(s, activeVoterSubDemand, idx, isAdmin);
    }).join('');

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1.25rem">
        ${cardsHtml}
      </div>
    `;
  }

  function renderTableView(container, schools) {
    var loggedUser = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
    var isAdmin = checkIsAdmin(loggedUser);
    var is18Only = (activeVoterSubDemand === '18');
    var is17Only = (activeVoterSubDemand === '17');

    var rowsHtml = schools.map(function(s, idx) {
      var m = getSchoolMetrics(s.shala_darpan_code);
      var isTest = s.shala_darpan_code === '999999';
      var isSectionNil = is18Only ? (m.isNil18 || (m.isNil && m.total18 === 0)) : (is17Only ? (m.isNil17 || (m.isNil && m.total17 === 0)) : m.isNil);
      var statusBadge = m.isSubmitted
        ? (isSectionNil ? `<span style="background:#16a34a; color:#fff; padding:3px 8px; border-radius:12px; font-weight:800; font-size:0.75rem">✓ पूर्ण (NIL)</span>` : `<span style="background:#16a34a; color:#fff; padding:3px 8px; border-radius:12px; font-weight:800; font-size:0.75rem">✓ सबमिट पूर्ण</span>`)
        : `<span style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:3px 8px; border-radius:12px; font-weight:800; font-size:0.75rem">⚠️ लंबित</span>`;

      var lockBadge = m.isLocked 
        ? `<span style="color:#b91c1c; font-weight:800; font-size:0.75rem"><i class="fas fa-lock"></i> लॉक</span>`
        : `<span style="color:#15803d; font-size:0.75rem"><i class="fas fa-lock-open"></i> खुला</span>`;

      var targetSec = is18Only ? '18' : (is17Only ? '17' : '18');

      var metricsCols = is18Only ? `
        <td style="text-align:center; font-weight:800; color:#1e40af; background:#eff6ff">${m.total18}</td>
        <td style="text-align:center; font-weight:800; color:#166534; background:#f0fdf4">${m.reg18}</td>
        <td style="text-align:center; font-weight:800; color:#ea580c; background:#fff7ed">${m.unreg18}</td>
      ` : (is17Only ? `
        <td style="text-align:center; font-weight:800; color:#7c3aed; background:#faf5ff">${m.total17}</td>
        <td style="text-align:center; font-weight:800; color:#0284c7; background:#f0f9ff">${m.c11_17}</td>
        <td style="text-align:center; font-weight:800; color:#4338ca; background:#eef2ff">${m.c12_17}</td>
      ` : `
        <td style="text-align:center; font-weight:800; color:#1e40af; background:#eff6ff">${m.total18}</td>
        <td style="text-align:center; font-weight:800; color:#166534; background:#f0fdf4">${m.reg18}</td>
        <td style="text-align:center; font-weight:800; color:#ea580c; background:#fff7ed">${m.unreg18}</td>
        <td style="text-align:center; font-weight:800; color:#7c3aed; background:#faf5ff">${m.total17}</td>
      `);

      return `
        <tr>
          <td style="text-align:center; font-weight:700; color:#64748b">${idx + 1}</td>
          <td><strong>${s.shala_darpan_code}</strong></td>
          <td>
            <div style="font-weight:800; color:#0f172a">${s.school_name_hi || s.school_name}</div>
            <div style="font-size:0.75rem; color:#64748b">${s.principal_name || 'संस्था प्रधान'} (मो. ${s.principal_mobile || '---'})</div>
          </td>
          <td>${s.peeo_name}</td>
          <td>${isTest ? '<span style="color:#7c3aed; font-weight:800">टेस्ट</span>' : (s.type === 'Private' ? '<span style="color:#b45309; font-weight:700">निजी</span>' : 'राजकीय')}</td>
          ${metricsCols}
          <td style="text-align:center">${statusBadge}</td>
          <td style="text-align:center">${lockBadge}</td>
          <td style="text-align:center">
            <div style="display:flex; gap:0.25rem; justify-content:center; flex-wrap:wrap">
              <a href="voter_form.html?code=${s.shala_darpan_code}&sec=${targetSec}" target="_blank" class="btn btn-primary btn-sm" style="padding:0.25rem 0.5rem; font-size:0.78rem; text-decoration:none" title="प्रपत्र खोलें">
                <i class="fas fa-edit"></i>
              </a>
              <button class="btn btn-info btn-sm" onclick="window.openVoterPdfPreviewModal('${s.shala_darpan_code}', '${targetSec}')" style="padding:0.25rem 0.5rem; font-size:0.78rem; color:#fff; background:#0284c7; border:none" title="प्रपत्र अवलोकन">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-warning btn-sm" onclick="window.downloadVoterSingleSchoolPdf('${s.shala_darpan_code}', '${targetSec}')" style="padding:0.25rem 0.5rem; font-size:0.78rem" title="PDF">
                <i class="fas fa-file-pdf"></i>
              </button>
              ${isAdmin ? `
                <button class="btn btn-sm ${m.isLocked ? 'btn-danger' : 'btn-outline-secondary'}" onclick="window.toggleVoterSchoolLock('${s.shala_darpan_code}')" style="padding:0.25rem 0.45rem; font-size:0.78rem" title="${m.isLocked ? 'अनलॉक करें' : 'लॉक करें'}">
                  <i class="fas ${m.isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
                </button>
              ` : ''}
              <button class="btn btn-outline btn-sm" onclick="window.sendVoterSchoolReminder('${s.shala_darpan_code}', '${s.school_name_hi || s.school_name}', '${s.principal_mobile}')" style="padding:0.25rem 0.45rem; font-size:0.78rem; color:#16434a; border-color:#86efac" title="WhatsApp">
                <i class="fab fa-whatsapp"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    var tableHeaders = is18Only ? `
      <th style="padding:0.75rem 0.5rem; width:35px; text-align:center">क्र.</th>
      <th style="padding:0.75rem 0.5rem; width:75px">कोड</th>
      <th style="padding:0.75rem 0.5rem">विद्यालय का नाम व संस्था प्रधान</th>
      <th style="padding:0.75rem 0.5rem">PEEO</th>
      <th style="padding:0.75rem 0.5rem; width:55px">श्रेणी</th>
      <th style="padding:0.75rem 0.5rem; width:75px; text-align:center; background:#dbeafe">18+ कुल (12वीं)</th>
      <th style="padding:0.75rem 0.5rem; width:75px; text-align:center; background:#dcfce7">पंजीकृत (हाँ)</th>
      <th style="padding:0.75rem 0.5rem; width:75px; text-align:center; background:#ffedd5">अपेक्षित (नहीं)</th>
      <th style="padding:0.75rem 0.5rem; width:85px; text-align:center">स्थिति</th>
      <th style="padding:0.75rem 0.5rem; width:60px; text-align:center">लॉक</th>
      <th style="padding:0.75rem 0.5rem; width:130px; text-align:center">एक्शन</th>
    ` : (is17Only ? `
      <th style="padding:0.75rem 0.5rem; width:35px; text-align:center">क्र.</th>
      <th style="padding:0.75rem 0.5rem; width:75px">कोड</th>
      <th style="padding:0.75rem 0.5rem">विद्यालय का नाम व संस्था प्रधान</th>
      <th style="padding:0.75rem 0.5rem">PEEO</th>
      <th style="padding:0.75rem 0.5rem; width:55px">श्रेणी</th>
      <th style="padding:0.75rem 0.5rem; width:75px; text-align:center; background:#f3e8ff">17+ अग्रिम कुल</th>
      <th style="padding:0.75rem 0.5rem; width:75px; text-align:center; background:#e0f2fe">कक्षा 11वीं</th>
      <th style="padding:0.75rem 0.5rem; width:75px; text-align:center; background:#e0e7ff">कक्षा 12वीं</th>
      <th style="padding:0.75rem 0.5rem; width:85px; text-align:center">स्थिति</th>
      <th style="padding:0.75rem 0.5rem; width:60px; text-align:center">लॉक</th>
      <th style="padding:0.75rem 0.5rem; width:130px; text-align:center">एक्शन</th>
    ` : `
      <th style="padding:0.75rem 0.5rem; width:35px; text-align:center">क्र.</th>
      <th style="padding:0.75rem 0.5rem; width:75px">कोड</th>
      <th style="padding:0.75rem 0.5rem">विद्यालय का नाम व संस्था प्रधान</th>
      <th style="padding:0.75rem 0.5rem">PEEO</th>
      <th style="padding:0.75rem 0.5rem; width:55px">श्रेणी</th>
      <th style="padding:0.75rem 0.5rem; width:65px; text-align:center; background:#dbeafe">18+ कुल</th>
      <th style="padding:0.75rem 0.5rem; width:65px; text-align:center; background:#dcfce7">पंजीकृत</th>
      <th style="padding:0.75rem 0.5rem; width:65px; text-align:center; background:#ffedd5">अपेक्षित</th>
      <th style="padding:0.75rem 0.5rem; width:65px; text-align:center; background:#f3e8ff">17+ कुल</th>
      <th style="padding:0.75rem 0.5rem; width:85px; text-align:center">स्थिति</th>
      <th style="padding:0.75rem 0.5rem; width:60px; text-align:center">लॉक</th>
      <th style="padding:0.75rem 0.5rem; width:130px; text-align:center">एक्शन</th>
    `);

    container.innerHTML = `
      <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; overflow-x:auto; box-shadow:0 2px 6px rgba(0,0,0,0.04)">
        <table class="data-table" style="width:100%; font-size:0.86rem; border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1">
              ${tableHeaders}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Global Handlers
  window.setVoterFilter = function(filter) {
    currentFilter = filter;
    renderVoterStudentsView();
  };

  window.onVoterPeeoFilterChange = function(peeo) {
    currentPeeoFilter = peeo;
    renderVoterStudentsView();
  };

  window.onVoterSearchInput = function(val) {
    currentSearchQuery = val;
    renderVoterDynamicContent(getMasterSchools());
  };

  window.setVoterViewMode = function(mode) {
    currentViewMode = mode;
    renderVoterStudentsView();
  };

  window.sendVoterSchoolReminder = function(code, schoolName, mobile) {
    var text = `*अति-आवश्यक स्मरण पत्र: CBEO कार्यालय भिनाय (जिला: अजमेर)*\n\n` +
               `सेवा में, संस्था प्रधान, ${schoolName} (कोड: ${code})\n\n` +
               `महोदय, आपके विद्यालय का *18+ एवं 17+ विद्यार्थी मतदाता सूची सत्यापन व पंजीकरण प्रपत्र 2026* CBEO पोर्टल पर अपेक्षित है।\n\n` +
               `कृपया नीचे दिए गए अधिकृत लिंक से प्रपत्र अनिवार्य रूप से जांच कर सबमिट करें:\n` +
               `🔗 https://jit9763.github.io/cbeo-bhinai-portal/voter_form.html?code=${code}\n\n` +
               `- कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)`;

    var cleanMob = String(mobile || '').replace(/\D/g, '');
    var url = cleanMob.length >= 10
      ? `https://api.whatsapp.com/send?phone=91${cleanMob.slice(-10)}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Lock / Unlock School Submissions (Admin Super Control)
  window.toggleVoterSchoolLock = function(code) {
    var subs = getSubmissions();
    var currentSub = subs[code] || {};
    var willLock = !currentSub.is_locked;

    currentSub.is_locked = willLock;
    subs[code] = currentSub;

    try {
      localStorage.setItem('cbeo_voter_submissions', JSON.stringify(subs));
    } catch(e) {}

    var toastMsg = willLock 
      ? `विद्यालय [${code}] का प्रपत्र सफलतापूर्वक लॉक कर दिया गया है।`
      : `विद्यालय [${code}] का प्रपत्र सफलतापूर्वक अनलॉक कर दिया गया है (संपादन खुला)।`;
    
    if (typeof showToast === 'function') {
      showToast(toastMsg, willLock ? 'warning' : 'success');
    } else {
      alert(toastMsg);
    }

    renderVoterStudentsView();

    // If modal is currently open for this school, update lock button inside modal
    if (activeModalSchoolCode === code) {
      updateModalLockButton(code, willLock);
    }
  };

  function updateModalLockButton(code, isLocked) {
    var container = document.getElementById('voter-modal-lock-container');
    if (!container) return;
    container.innerHTML = `
      <button class="btn btn-sm ${isLocked ? 'btn-danger' : 'btn-outline-light'}" onclick="window.toggleVoterSchoolLock('${code}')" style="font-weight:800; border-radius:6px; padding:0.4rem 0.8rem">
        <i class="fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}"></i> ${isLocked ? '🔒 प्रपत्र लॉक है (अनलॉक करें)' : '🔓 खुला है (लॉक करें)'}
      </button>
    `;
  }

  var activeModalSec = 'both';

  // Certified Official PDF Preview Modal (Saman Pariksha Style)
  window.openVoterPdfPreviewModal = function(schoolCode, sec) {
    activeModalSchoolCode = schoolCode;
    activeModalSec = sec || 'both';
    var allSchools = getMasterSchools();
    var school = allSchools.find(function(s) { return String(s.shala_darpan_code) === String(schoolCode); });
    if (!school) {
      alert('विद्यालय विवरण प्राप्त नहीं हुआ।');
      return;
    }

    var m = getSchoolMetrics(schoolCode);
    var loggedUser = (typeof STATE !== 'undefined' && STATE.currentUser) ? STATE.currentUser : null;
    var isAdmin = checkIsAdmin(loggedUser);

    var previewBox = document.getElementById('printable-voter-document-content');
    if (!previewBox) return;

    var editLink = document.getElementById('voter-modal-edit-link');
    if (editLink) {
      var editSecParam = (sec === '17') ? '&sec=17' : (sec === '18' ? '&sec=18' : '');
      editLink.href = `voter_form.html?code=${schoolCode}${editSecParam}`;
    }

    if (isAdmin) {
      updateModalLockButton(schoolCode, m.isLocked);
    } else {
      var lockC = document.getElementById('voter-modal-lock-container');
      if (lockC) lockC.innerHTML = '';
    }

    var is18Only = (sec === '18');
    var is17Only = (sec === '17');

    // Build 18+ Rows
    var rows18Html = (m.students18 || []).map(function(stu, idx) {
      return `
        <tr style="border-bottom:1px solid #cbd5e1">
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${idx + 1}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8; font-weight:700">${stu.name || ''}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8">${stu.father_name || ''}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.dob || ''}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.mobile_no || '---'}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8; font-weight:800; color:${stu.is_registered === 'हाँ' ? '#166534' : '#dc2626'}">${stu.is_registered || 'नहीं'}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.part_no || '---'}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.serial_no || '---'}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8; font-size:7.5pt">${stu.vidhan_sabha || '100 - मसूदा'}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8; font-size:7.5pt; color:#9a3412">${stu.reason_not_registered || '---'}</td>
        </tr>
      `;
    }).join('');

    if (!rows18Html) {
      rows18Html = `<tr><td colspan="10" style="text-align:center; padding:12px; color:#64748b; border:1px solid #94a3b8">कोई 18+ विद्यार्थी दर्ज नहीं है (शून्य / NIL प्रविष्टि)।</td></tr>`;
    }

    // Build 17+ Rows
    var rows17Html = (m.students17 || []).map(function(stu, idx) {
      return `
        <tr style="border-bottom:1px solid #cbd5e1">
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${idx + 1}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8; font-weight:700">${stu.name || ''}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8">${stu.father_name || ''}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.dob || ''}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.mobile_no || '---'}</td>
          <td style="text-align:center; padding:5px 4px; border:1px solid #94a3b8">${stu.class_name || '11वीं'}</td>
          <td style="padding:5px 6px; border:1px solid #94a3b8; font-size:7.5pt">${stu.vidhan_sabha || '100 - मसूदा'}</td>
        </tr>
      `;
    }).join('');

    if (!rows17Html) {
      rows17Html = `<tr><td colspan="7" style="text-align:center; padding:12px; color:#64748b; border:1px solid #94a3b8">कोई 17+ विद्यार्थी दर्ज नहीं है (शून्य / NIL प्रविष्टि)।</td></tr>`;
    }

    var docTitle = is18Only 
      ? '🗳️ 18+ विद्यार्थी मतदाता सूची सत्यापन अधिकृत घोषणा-पत्र 2026 (कक्षा 12)'
      : (is17Only 
          ? '🌟 17+ अग्रिम भावी विद्यार्थी मतदाता पंजीकरण अधिकृत घोषणा-पत्र 2026 (कक्षा 11 व 12)'
          : '🗳️ 18+ एवं 17+ विद्यार्थी मतदाता सूची सत्यापन व अग्रिम पंजीकरण अधिकृत घोषणा-पत्र 2026');

    var metricBadgesHtml = is18Only ? `
      <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:6px 14px; border-radius:6px; color:#1e40af">
        18+ कुल विद्यार्थी (कक्षा 12): <strong>${m.total18}</strong>
      </div>
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:6px 14px; border-radius:6px; color:#166534">
        मतदाता सूची में पंजीकृत (हाँ): <strong>${m.reg18}</strong>
      </div>
      <div style="background:#fff7ed; border:1px solid #fed7aa; padding:6px 14px; border-radius:6px; color:#ea580c">
        अपंजीकृत (नहीं): <strong>${m.unreg18}</strong>
      </div>
    ` : (is17Only ? `
      <div style="background:#faf5ff; border:1px solid #ddd6fe; padding:6px 14px; border-radius:6px; color:#7c3aed">
        17+ अग्रिम कुल भावी मतदाता: <strong>${m.total17}</strong>
      </div>
      <div style="background:#f0f9ff; border:1px solid #bae6fd; padding:6px 14px; border-radius:6px; color:#0369a1">
        कक्षा 11वीं के विद्यार्थी: <strong>${m.c11_17}</strong>
      </div>
      <div style="background:#eef2ff; border:1px solid #c7d2fe; padding:6px 14px; border-radius:6px; color:#3730a3">
        कक्षा 12वीं के विद्यार्थी: <strong>${m.c12_17}</strong>
      </div>
    ` : `
      <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:6px 12px; border-radius:6px; color:#1e40af">
        18+ कुल: ${m.total18}
      </div>
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:6px 12px; border-radius:6px; color:#166534">
        मतदाता सूची में पंजीकृत (हाँ): ${m.reg18}
      </div>
      <div style="background:#fff7ed; border:1px solid #fed7aa; padding:6px 12px; border-radius:6px; color:#ea580c">
        अपंजीकृत (नहीं): ${m.unreg18}
      </div>
      <div style="background:#faf5ff; border:1px solid #ddd6fe; padding:6px 12px; border-radius:6px; color:#7c3aed">
        17+ भावी मतदाता अग्रिम: ${m.total17}
      </div>
    `);

    var tablesContentHtml = '';
    if (!is17Only) {
      tablesContentHtml += `
        <!-- SECTION 1: 18+ Student Table -->
        <div style="margin-bottom:18px">
          <div style="font-size:0.9rem; font-weight:800; color:#1e3a8a; margin-bottom:6px; display:flex; justify-content:space-between">
            <span>1. 18+ आयु वर्ग विद्यार्थी मतदाता सूची सत्यापन विवरण (कक्षा 12):</span>
            <span style="font-size:0.8rem; color:#64748b">कुल विद्यार्थी: ${m.total18}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:7.5pt; border:1px solid #94a3b8">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:1.5px solid #94a3b8">
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:25px">क्र.</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8">विद्यार्थी का नाम</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8">पिता का नाम</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:65px">जन्म तिथि</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:75px">मोबाइल</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:65px">मतदाता सूची में?</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:45px">भाग सं.</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:45px">क्रम सं.</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8; width:100px">विधानसभा</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8; width:110px">अपंजीकृत का कारण</th>
              </tr>
            </thead>
            <tbody>
              ${rows18Html}
            </tbody>
          </table>
        </div>
      `;
    }

    if (!is18Only) {
      tablesContentHtml += `
        <!-- SECTION 2: 17+ Student Table -->
        <div style="margin-bottom:20px">
          <div style="font-size:0.9rem; font-weight:800; color:#7c3aed; margin-bottom:6px; display:flex; justify-content:space-between">
            <span>${is17Only ? '1.' : '2.'} 17+ आयु वर्ग विद्यार्थी विवरण (भावी मतदाता सूची - कक्षा 11 व 12):</span>
            <span style="font-size:0.8rem; color:#64748b">कुल विद्यार्थी: ${m.total17}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:7.5pt; border:1px solid #94a3b8">
            <thead>
              <tr style="background:#f5f3ff; border-bottom:1.5px solid #94a3b8">
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:25px">क्र.</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8">विद्यार्थी का नाम</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8">पिता का नाम</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:70px">जन्म तिथि</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:80px">मोबाइल नं.</th>
                <th style="padding:5px 4px; border:1px solid #94a3b8; width:55px">कक्षा</th>
                <th style="padding:5px 6px; border:1px solid #94a3b8">विधानसभा क्षेत्र</th>
              </tr>
            </thead>
            <tbody>
              ${rows17Html}
            </tbody>
          </table>
        </div>
      `;
    }

    var certText = is18Only 
      ? 'प्रमाणित किया जाता है कि उपरोक्त 18+ आयु वर्ग (कक्षा 12) के विद्यार्थियों का विवरण शाला दर्पण पोर्टल / विद्यालय अभिलेख एवं संबंधित निर्वाचन नामावली (मतदाता सूची) से शत-प्रतिशत मिलान कर पूर्णतः शुद्ध व सत्य रूप से दर्ज किया गया है। कोई भी पात्र विद्यार्थी छूटा नहीं है।'
      : (is17Only 
          ? 'प्रमाणित किया जाता है कि उपरोक्त 17+ आयु वर्ग (कक्षा 11 व 12) के भावी विद्यार्थियों का विवरण शाला दर्पण पोर्टल / विद्यालय अभिलेख से शत-प्रतिशत मिलान कर पूर्णतः शुद्ध व सत्य रूप से अग्रिम पंजीकरण हेतु दर्ज किया गया है।'
          : 'प्रमाणित किया जाता है कि उपरोक्त 18+ एवं 17+ आयु वर्ग के विद्यार्थियों का विवरण शाला दर्पण पोर्टल / विद्यालय अभिलेख एवं संबंधित निर्वाचन नामावली (मतदाता सूची) से शत-प्रतिशत मिलान कर पूर्णतः शुद्ध व सत्य रूप से दर्ज किया गया है। कोई भी पात्र विद्यार्थी छूटा नहीं है।');

    previewBox.innerHTML = `
      <div id="voter-printable-proforma" style="font-family:'Segoe UI', Arial, sans-serif; color:#0f172a; line-height:1.4">
        <!-- Official Government Letterhead (Strict AJMER Rule) -->
        <div style="text-align:center; border-bottom:2.5px double #1e3a8a; padding-bottom:10px; margin-bottom:15px">
          <div style="font-size:1.15rem; font-weight:900; color:#1e3a8a; letter-spacing:0.5px">
            कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय
          </div>
          <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-top:2px">
            जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (राजस्थान)
          </div>
          <div style="display:inline-block; margin-top:8px; background:#eff6ff; border:1.5px solid #3b82f6; border-radius:6px; padding:4px 16px; font-size:0.9rem; font-weight:800; color:#1e40af">
            ${docTitle}
          </div>
        </div>

        <!-- School Metadata Information Box -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px 14px; margin-bottom:15px; font-size:0.85rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px">
          <div><strong>विद्यालय:</strong> ${school.school_name_hi || school.school_name}</div>
          <div><strong>शाला दर्पण कोड:</strong> <code>${school.shala_darpan_code}</code></div>
          <div><strong>PEEO परिक्षेत्र:</strong> ${school.peeo_name}</div>
          <div><strong>श्रेणी:</strong> ${school.type === 'Private' ? 'निजी विद्यालय' : 'राजकीय विद्यालय'}</div>
          <div><strong>संस्था प्रधान:</strong> ${m.submittedBy || school.principal_name || 'श्री संस्था प्रधान'}</div>
          <div><strong>सत्यापन स्थिति:</strong> ${m.isSubmitted ? '<span style="color:#16a34a; font-weight:800">✓ सबमिट पूर्ण</span>' : '<span style="color:#dc2626; font-weight:800">⚠️ लंबित</span>'}</div>
          <div><strong>सबमिट दिनांक:</strong> ${m.submittedAt || 'लंबित'}</div>
          <div><strong>लॉक स्थिति:</strong> ${m.isLocked ? '<span style="color:#dc2626; font-weight:800">🔒 लॉक</span>' : '<span style="color:#16a34a; font-weight:800">🔓 अनलॉक</span>'}</div>
        </div>

        <!-- Summary Metric Count Badges -->
        <div style="display:flex; gap:0.75rem; margin-bottom:15px; font-size:0.82rem; font-weight:800; flex-wrap:wrap">
          ${metricBadgesHtml}
        </div>

        ${tablesContentHtml}

        <!-- Official Undertaking / Certificate Declaration -->
        <div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px 14px; background:#f8fafc; margin-bottom:25px; font-size:0.82rem; line-height:1.5">
          <strong>प्रमाणीकरण एवं घोषणा:</strong> ${certText}
        </div>

        <!-- Official Signatures Block -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:35px; padding:0 20px">
          <div style="text-align:center">
            <div style="border-top:1.5px dashed #475569; width:200px; padding-top:6px; font-weight:800; font-size:0.85rem">
              हस्ताक्षर संस्था प्रधान
            </div>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px">
              (मय पदनाम व विद्यालय मोहर/सील)
            </div>
          </div>

          <div style="text-align:center">
            <div style="border-top:1.5px dashed #475569; width:240px; padding-top:6px; font-weight:800; font-size:0.85rem; color:#1e3a8a">
              मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)
            </div>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px">
              कार्यालय CBEO भिनाय, जिला अजमेर (राज.)
            </div>
          </div>
        </div>
      </div>
    `;

    if (typeof showModal === 'function') {
      showModal('modal-voter-pdf-preview');
    } else {
      var mEl = document.getElementById('modal-voter-pdf-preview');
      if (mEl) mEl.classList.add('active');
    }
  };

  window.downloadCurrentVoterPdfModal = function() {
    if (!activeModalSchoolCode) return;
    window.downloadVoterSingleSchoolPdf(activeModalSchoolCode, activeModalSec);
  };

  window.printCurrentVoterPdfModal = function() {
    var prtContent = document.getElementById('printable-voter-document-content');
    if (!prtContent) return;

    var WinPrint = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    WinPrint.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CBEO_Bhinai_Voter_${activeModalSchoolCode || 'Proforma'}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #333 !important; }
          </style>
        </head>
        <body>
          ${prtContent.innerHTML}
        </body>
      </html>
    `);
    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(function() {
      WinPrint.print();
      WinPrint.close();
    }, 500);
  };

  window.shareCurrentVoterPdfWhatsApp = function() {
    if (!activeModalSchoolCode) return;
    var allSchools = getMasterSchools();
    var s = allSchools.find(function(sc) { return String(sc.shala_darpan_code) === String(activeModalSchoolCode); });
    if (!s) return;

    var m = getSchoolMetrics(activeModalSchoolCode);
    var text = `*🗳️ अधिकृत घोषणा-पत्र: CBEO भिनाय (अजमेर)*\n\n` +
               `विद्यालय: ${s.school_name_hi || s.school_name} (कोड: ${s.shala_darpan_code})\n` +
               `PEEO: ${s.peeo_name}\n\n` +
               `📊 *मतदाता सत्यापन सारांश 2026:*\n` +
               `• 18+ कुल विद्यार्थी: ${m.total18}\n` +
               `• मतदाता सूची में पंजीकृत (हाँ): ${m.reg18}\n` +
               `• अपंजीकृत (कारण अंकित): ${m.unreg18}\n` +
               `• 17+ भावी मतदाता: ${m.total17}\n` +
               `• स्थिति: ${m.isSubmitted ? '✓ सबमिट पूर्ण' : '⚠️ लंबित'}\n` +
               `• लॉक स्थिति: ${m.isLocked ? '🔒 लॉक' : '🔓 अनलॉक'}\n\n` +
               `प्रपत्र देखने/डाउनलोड करने हेतु लिंक:\n` +
               `https://jit9763.github.io/cbeo-bhinai-portal/voter_form.html?code=${s.shala_darpan_code}\n\n` +
               `- मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)`;

    var cleanMob = String(s.principal_mobile || '').replace(/\D/g, '');
    var url = cleanMob.length >= 10
      ? `https://api.whatsapp.com/send?phone=91${cleanMob.slice(-10)}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  window.downloadVoterSingleSchoolPdf = function(schoolCode, sec) {
    var allSchools = getMasterSchools();
    var school = allSchools.find(function(s) { return String(s.shala_darpan_code) === String(schoolCode); });
    if (!school) return;

    sec = sec || 'both';

    // Trigger modal if not open or if different sec, then use html2pdf
    if (activeModalSchoolCode !== schoolCode || activeModalSec !== sec) {
      window.openVoterPdfPreviewModal(schoolCode, sec);
    }

    setTimeout(function() {
      var el = document.getElementById('printable-voter-document-content');
      var suffix = (sec === '18') ? '18plus' : ((sec === '17') ? '17plus' : 'Consolidated');
      if (typeof html2pdf !== 'undefined' && el) {
        var opt = {
          margin: [8, 8, 8, 8],
          filename: `CBEO_Bhinai_Voter_${schoolCode}_${suffix}_Certified.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(el).save();
      } else {
        window.printCurrentVoterPdfModal();
      }
    }, 400);
  };

  // WhatsApp Broadcast Modal (Saman Pariksha Style)
  window.openVoterBroadcastModal = function() {
    var allSchools = getMasterSchools();
    var pendingSchools = allSchools.filter(function(s) {
      return !getSchoolMetrics(s.shala_darpan_code).isSubmitted;
    });

    var listContainer = document.getElementById('voter-broadcast-list');
    if (listContainer) {
      if (pendingSchools.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding:2rem; color:#16a34a">
            <i class="fas fa-check-circle" style="font-size:3rem; margin-bottom:0.75rem"></i>
            <h4>बधाई! समस्त 58 विद्यालयों का प्रपत्र सफलतापूर्वक सबमिट हो चुका है।</h4>
          </div>
        `;
      } else {
        var itemsHtml = pendingSchools.map(function(s, idx) {
          var cleanMob = String(s.principal_mobile || '').replace(/\D/g, '');
          var text = `*अति-आवश्यक CBEO भिनाय (अजमेर) आदेश*\n` +
                     `संस्था प्रधान, ${s.school_name_hi || s.school_name} (कोड: ${s.shala_darpan_code})\n` +
                     `आपके विद्यालय का 18+ एवं 17+ विद्यार्थी मतदाता सत्यापन प्रपत्र लंबित है। कृपया आज सायं तक अवश्य सबमिट करें:\n` +
                     `https://jit9763.github.io/cbeo-bhinai-portal/voter_form.html?code=${s.shala_darpan_code}`;
          var waLink = cleanMob.length >= 10
            ? `https://api.whatsapp.com/send?phone=91${cleanMob.slice(-10)}&text=${encodeURIComponent(text)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.6rem 1rem; margin-bottom:0.5rem">
              <div>
                <strong>${idx + 1}. [${s.shala_darpan_code}] ${s.school_name_hi || s.school_name}</strong>
                <div style="font-size:0.8rem; color:#64748b">PEEO: ${s.peeo_name} | ${s.principal_name || 'संस्था प्रधान'} (${s.principal_mobile || '---'})</div>
              </div>
              <a href="${waLink}" target="_blank" class="btn btn-sm btn-whatsapp" style="background:#25D366; color:#fff; font-weight:700; text-decoration:none; padding:0.35rem 0.75rem">
                <i class="fab fa-whatsapp"></i> WhatsApp भेजें
              </a>
            </div>
          `;
        }).join('');

        listContainer.innerHTML = itemsHtml;
      }
    }

    if (typeof showModal === 'function') {
      showModal('modal-voter-broadcast');
    } else {
      var mEl = document.getElementById('modal-voter-broadcast');
      if (mEl) mEl.classList.add('active');
    }
  };

  window.copyAllVoterPendingContacts = function() {
    var allSchools = getMasterSchools();
    var pendingSchools = allSchools.filter(function(s) {
      return !getSchoolMetrics(s.shala_darpan_code).isSubmitted;
    });

    var mobiles = pendingSchools
      .map(function(s) { return String(s.principal_mobile || '').replace(/\D/g, ''); })
      .filter(function(m) { return m.length >= 10; });

    var uniqueMobs = Array.from(new Set(mobiles)).join(', ');
    if (!uniqueMobs) {
      alert('कोई लंबित मोबाइल नंबर प्राप्त नहीं हुआ।');
      return;
    }

    navigator.clipboard.writeText(uniqueMobs).then(function() {
      alert(`कुल ${mobiles.length} संस्था प्रधानों के मोबाइल नंबर क्लिपबोर्ड पर कॉपी हो गए हैं:\n\n${uniqueMobs}`);
    });
  };

  window.downloadVoterConsolidatedExcel = function() {
    var allSchools = getMasterSchools();
    var summaryRows = [
      ["क्र.सं.", "शाला दर्पण कोड", "विद्यालय का नाम", "श्रेणी", "PEEO परिक्षेत्र", "18+ कुल विद्यार्थी", "18+ पंजीकृत (हाँ)", "18+ अपेक्षित (नहीं)", "17+ कुल विद्यार्थी", "स्थिति", "लॉक स्थिति", "सबमिट दिनांक", "सत्यापित संस्था प्रधान", "मोबाइल"]
    ];

    var detailedRows = [
      ["क्र.सं.", "शाला दर्पण कोड", "विद्यालय का नाम", "PEEO", "आयु वर्ग", "विद्यार्थी का नाम", "पिता का नाम", "जन्म तिथि", "मोबाइल नं.", "कक्षा", "विधानसभा क्षेत्र (डिफ़ॉल्ट मसूदा)", "मतदाता स्थिति", "भाग संख्या", "क्रम संख्या", "EPIC No.", "कारण (यदि नहीं जुड़ा)"]
    ];

    var stuCounter = 1;

    allSchools.forEach(function(s, idx) {
      var m = getSchoolMetrics(s.shala_darpan_code);
      var isTestSchool = (s.shala_darpan_code === '999999' || s.is_test);
      summaryRows.push([
        idx + 1,
        s.shala_darpan_code,
        s.school_name_hi || s.school_name,
        isTestSchool ? '🧪 टेस्ट स्कूल (TEST DUMMY DATA)' : (s.type === 'Private' ? 'निजी' : 'राजकीय'),
        s.peeo_name,
        m.total18,
        m.reg18,
        m.unreg18,
        m.total17,
        isTestSchool ? 'परीक्षण डेटा (TEST)' : (m.isSubmitted ? 'सबमिट पूर्ण' : 'लंबित'),
        m.isLocked ? 'लॉक' : 'अनलॉक',
        m.submittedAt || '---',
        s.principal_name || '---',
        s.principal_mobile || '---'
      ]);

      // 18+ Students
      (m.students18 || []).forEach(function(stu) {
        detailedRows.push([
          stuCounter++,
          s.shala_darpan_code,
          s.school_name_hi || s.school_name,
          s.peeo_name,
          isTestSchool ? "18+ [TEST DUMMY]" : "18+",
          stu.name || '',
          stu.father_name || '',
          stu.dob || '',
          stu.mobile_no || '---',
          stu.class_name || '12वीं',
          stu.vidhan_sabha || '100 - मसूदा',
          isTestSchool ? "टेस्ट डेटा" : (stu.is_registered || 'नहीं'),
          stu.part_no || '',
          stu.serial_no || '',
          stu.epic_no || '',
          isTestSchool ? "परीक्षण डेटा - अमान्य" : (stu.reason_not_registered || '')
        ]);
      });

      // 17+ Students
      (m.students17 || []).forEach(function(stu) {
        detailedRows.push([
          stuCounter++,
          s.shala_darpan_code,
          s.school_name_hi || s.school_name,
          s.peeo_name,
          isTestSchool ? "17+ [TEST DUMMY]" : "17+",
          stu.name || '',
          stu.father_name || '',
          stu.dob || '',
          stu.mobile_no || '',
          stu.class_name || '11वीं',
          stu.vidhan_sabha || '100 - मसूदा',
          isTestSchool ? "परीक्षण भावी मतदाता" : "भावी मतदाता (17+)",
          "---",
          "---",
          "---",
          "---"
        ]);
      });
    });

    if (typeof XLSX !== 'undefined') {
      var wb = XLSX.utils.book_new();
      var wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      var wsStudents = XLSX.utils.aoa_to_sheet(detailedRows);

      XLSX.utils.book_append_sheet(wb, wsSummary, "विद्यालय प्रगति सारांश");
      XLSX.utils.book_append_sheet(wb, wsStudents, "समस्त विद्यार्थी रोस्टर");

      XLSX.writeFile(wb, "CBEO_Bhinai_Voter_Students_Master_2026.xlsx");
    } else {
      alert('XLSX लाइब्रेरी लोड नहीं हो सकी।');
    }
  };

  window.downloadVoterMasterPdf = function() {
    var allSchools = getMasterSchools();
    var rowsHtml = allSchools.map(function(s, idx) {
      var m = getSchoolMetrics(s.shala_darpan_code);
      var isTestSchool = (s.shala_darpan_code === '999999' || s.is_test);
      return `
        <tr>
          <td style="text-align:center; padding:4px; border:1px solid #333">${idx + 1}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center">${s.shala_darpan_code}</td>
          <td style="padding:4px; border:1px solid #333"><strong>${s.school_name_hi || s.school_name}</strong></td>
          <td style="padding:4px; border:1px solid #333">${s.peeo_name}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center">${isTestSchool ? 'टेस्ट' : (s.type === 'Private' ? 'निजी' : 'राजकीय')}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center; font-weight:bold">${m.total18}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center; color:#16a34a; font-weight:bold">${m.reg18}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center; color:#d97706">${m.unreg18}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center; font-weight:bold">${m.total17}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center; font-weight:bold">${m.isSubmitted ? '✓ सबमिट' : 'लंबित'}</td>
          <td style="padding:4px; border:1px solid #333; text-align:center">${m.isLocked ? '🔒 लॉक' : 'खुला'}</td>
          <td style="padding:4px; border:1px solid #333; font-size:7.5pt">${s.principal_name || '---'} (${s.principal_mobile || '---'})</td>
        </tr>
      `;
    }).join('');

    var pdfHtml = `
      <div style="font-family:'Segoe UI', Arial, sans-serif; padding:15px; color:#000; font-size:8.5pt">
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px">
          <h2 style="margin:0; font-size:14pt; color:#1e3a8a">कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय</h2>
          <div style="font-size:11pt; font-weight:bold; margin-top:2px">जिला: अजमेर (AJMER) | ब्लॉक: भिनाय (राजस्थान)</div>
          <div style="font-size:12pt; font-weight:bold; margin-top:4px; background:#e2e8f0; padding:4px">
            🗳️ 18+ एवं 17+ विद्यार्थी मतदाता सूची सत्यापन व पंजीकरण ब्लॉक समेकित रिपोर्ट 2026 (${allSchools.length} विद्यालय)
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:7.5pt">
          <thead>
            <tr style="background:#cbd5e1">
              <th style="padding:4px; border:1px solid #333; width:25px">क्र.</th>
              <th style="padding:4px; border:1px solid #333; width:60px">शा.दा. कोड</th>
              <th style="padding:4px; border:1px solid #333">विद्यालय का नाम</th>
              <th style="padding:4px; border:1px solid #333">PEEO</th>
              <th style="padding:4px; border:1px solid #333; width:45px">श्रेणी</th>
              <th style="padding:4px; border:1px solid #333; width:50px">18+ कुल</th>
              <th style="padding:4px; border:1px solid #333; width:50px">पंजीकृत</th>
              <th style="padding:4px; border:1px solid #333; width:50px">अपेक्षित</th>
              <th style="padding:4px; border:1px solid #333; width:50px">17+ कुल</th>
              <th style="padding:4px; border:1px solid #333; width:55px">स्थिति</th>
              <th style="padding:4px; border:1px solid #333; width:45px">लॉक</th>
              <th style="padding:4px; border:1px solid #333">संस्था प्रधान (मो.)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top:20px; display:flex; justify-content:space-between; align-items:flex-end">
          <div>रिपोर्ट जनरेट दिनांक: ${new Date().toLocaleString('en-IN')}</div>
          <div style="text-align:center">
            <strong>मुख्य ब्लॉक शिक्षा अधिकारी (CBEO)</strong><br>
            ब्लॉक भिनाय, जिला अजमेर (राज.)
          </div>
        </div>
      </div>
    `;

    if (typeof html2pdf !== 'undefined') {
      var opt = {
        margin: [6, 6, 6, 6],
        filename: 'CBEO_Bhinai_Voter_Students_Consolidated_Master.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };
      html2pdf().set(opt).from(pdfHtml).save();
    }
  };

  // Export to Global Scope
  window.renderVoterStudentsView = renderVoterStudentsView;

})();
