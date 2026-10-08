/**
 * =========================================================================
 * CBEO BHINAI - UNIVERSAL DATABASE & AUTHENTICATION GOOGLE APPS SCRIPT
 * Target Sheet ID: 1tVP7gbIuUP576E2a1Qk6TadXUSP7a5c7ah8HzKeTk4k
 * =========================================================================
 * 
 * Architecture:
 * 1. Sheet "Auth_Passwords": Master credentials store for Super Admins, 25 PEEOs & 57 Schools.
 * 2. 25 Sheets ("PEEO_..."): Dynamic PEEO-wise database storing any form submission in Data_JSON.
 * 3. Sheet "Sheet1": Detailed 72-column table for Saman Pariksha (Full Backward Compatibility).
 * 
 * Endpoints:
 * - doPost:
 *    - action: 'updatePassword' -> Updates password in Auth_Passwords
 *    - action: 'saveDemandSubmission' -> Universal submission saved to PEEO tab & Sheet1
 * - doGet:
 *    - action: 'getAuth' -> Returns all credentials from Auth_Passwords for login verification
 *    - action: 'getDemandSubmissions' -> Reads submissions for any demand across PEEO tabs
 *    - action: 'getAll' -> Returns all Saman Pariksha submissions
 *    - action: 'get' -> Returns single school Saman Pariksha submission
 */

const OPTIONAL_KEYS = [
  "pol_sci", "history", "geography", "hindi_lit", "eng_lit", "sanskrit_lit",
  "urdu_lit", "economics", "sociology", "home_sci", "drawing", "physics",
  "chemistry", "biology", "maths", "comp_sci", "accountancy", "business_studies",
  "economics_comm", "agri_sci", "agri_bio", "agri_chem"
];

/**
 * ⚡ केवल 1 बार इस फंक्शन को Apps Script में ऊपर ड्रॉपडाउन से चुनकर 'Run ▶️' दबाएं:
 * इससे Google Apps Script को GitHub API से बात करने की परमिशन (Authorization) मिल जाएगी!
 */
function authorizeExternalRequests() {
  var res = UrlFetchApp.fetch("https://api.github.com", {
    headers: { "User-Agent": "CBEO-Bhinai-GAS" },
    muteHttpExceptions: true
  });
  Logger.log("✓ Google Apps Script GitHub API Authorization Successful! Code: " + res.getResponseCode());
}

function sanitizeTabName(name) {
  if (!name) return "PEEO_GENERAL";
  return String(name).replace(/\s+/g, '_').replace(/[^\w]/g, '_').toUpperCase().substring(0, 100);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (ex) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Server busy, please retry in a moment." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (pe) {
        data = e.parameter || {};
      }
    } else if (e.parameter) {
      data = e.parameter;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // -------------------------------------------------------------
    // ACTION 0: SERVERLESS AI CHAT & DEMAND ASSIST (24/7 Mobile Access & 0 GitHub Leak)
    // -------------------------------------------------------------
    if (data.action === 'ai_chat' || data.action === 'ai_demand_assist') {
      return handleServerlessAiRequest(data);
    }

    // -------------------------------------------------------------
    // ACTION 0.1: SAVE GEMINI API KEY TO CLOUD (Available for all 57 schools & 25 PEEOs)
    // -------------------------------------------------------------
    if (data.action === 'saveGeminiKey') {
      var newKey = String(data.api_key || data.key || '').trim();
      if (!newKey) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "api_key is required."
        })).setMimeType(ContentService.MimeType.JSON);
      }
      // 1. Save in Script Properties (Never visible on GitHub, fast cloud access)
      PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY", newKey);

      // 2. Also save in a dedicated tab 'AI_Config' in Google Sheet
      var cfgSheet = ss.getSheetByName("AI_Config");
      if (!cfgSheet) {
        cfgSheet = ss.insertSheet("AI_Config");
        cfgSheet.appendRow(["Key_Name", "Key_Value", "Updated_At", "Updated_By"]);
      }
      var cfgData = cfgSheet.getDataRange().getValues();
      var found = false;
      for (var ci = 1; ci < cfgData.length; ci++) {
        if (String(cfgData[ci][0]).trim() === "GEMINI_API_KEY") {
          cfgSheet.getRange(ci + 1, 2).setValue(newKey);
          cfgSheet.getRange(ci + 1, 3).setValue(Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss"));
          cfgSheet.getRange(ci + 1, 4).setValue(data.updated_by || "Admin_Jitendra");
          found = true;
          break;
        }
      }
      if (!found) {
        cfgSheet.appendRow(["GEMINI_API_KEY", newKey, Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss"), data.updated_by || "Admin_Jitendra"]);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Gemini Key क्लाउड सर्वर पर सुरक्षित हो गई! अब भिनाय ब्लॉक के सभी 57 स्कूल व 25 PEEO किसी भी मोबाइल या कंप्यूटर से 24x7 AI का उपयोग कर सकेंगे।"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 0.2: SAVE GITHUB TOKEN TO CLOUD VAULT (Never visible in browser/Git)
    // -------------------------------------------------------------
    if (data.action === 'saveGitHubToken') {
      var ghToken = String(data.github_token || data.token || '').trim();
      if (!ghToken) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "github_token is required."
        })).setMimeType(ContentService.MimeType.JSON);
      }
      PropertiesService.getScriptProperties().setProperty("GITHUB_TOKEN", ghToken);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "✓ GitHub Token Google Apps Script के गुप्त क्लाउड वॉल्ट में सुरक्षित हो गया!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 0.3: CLOUD GITHUB SYNC (Direct GitHub Commit from Cloud)
    // -------------------------------------------------------------
    if (data.action === 'syncToGitHub') {
      var filePath = String(data.file_path || 'master_cbeo_data.json').trim();
      var fileContent = data.content;
      if (typeof fileContent !== 'string') {
        fileContent = JSON.stringify(fileContent, null, 2);
      }
      var commitMsg = data.message || ("auto(gas): cloud backup " + filePath);
      var ghRes = syncToGitHubViaApi(filePath, fileContent, commitMsg);
      return ContentService.createTextOutput(JSON.stringify(ghRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 1: UPDATE PASSWORD (Single Textbox Save)
    // -------------------------------------------------------------
    if (data.action === 'updatePassword') {
      var userId = String(data.user_id || '').trim();
      var newPass = String(data.new_password || '').trim();

      if (!userId || !newPass) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "user_id and new_password are required."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var authSheet = ss.getSheetByName("Auth_Passwords");
      if (!authSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Auth_Passwords sheet not found."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var authValues = authSheet.getDataRange().getValues();
      var updated = false;

      // Col D is index 3 (Login_Code)
      for (var r = 1; r < authValues.length; r++) {
        var code = String(authValues[r][3] || '').trim();
        if (code === userId) {
          authSheet.getRange(r + 1, 5).setValue(newPass); // Col E: Password
          authSheet.getRange(r + 1, 7).setValue(Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss")); // Col G: Last_Updated
          updated = true;
        }
      }

      if (updated) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "पासवर्ड Google Sheet में सफलतापूर्वक अपडेट हो गया!"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // If not found, append a new row
        authSheet.appendRow([
          authValues.length,
          data.role || "User",
          data.name || userId,
          userId,
          newPass,
          data.mobile || "",
          Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss")
        ]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "नया खाता व पासवर्ड Google Sheet में जोड़ दिया गया!"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // -------------------------------------------------------------
    // ACTION 1B: SAVE MASTER DATABASE / ALL SCHOOLS JSON
    // -------------------------------------------------------------
    if (data.action === 'saveMasterDatabase') {
      var masterSheet = ss.getSheetByName("Master_Schools_DB");
      if (!masterSheet) {
        masterSheet = ss.insertSheet("Master_Schools_DB");
        masterSheet.appendRow([
          "क्र.सं.", "शाला दर्पण/PSP कोड", "विद्यालय का नाम", "प्रकार", "श्रेणी",
          "संबंधित PEEO", "PEEO कोड", "ग्राम पंचायत", "गाँव", "डाइस कोड",
          "संस्था प्रधान", "मोबाइल", "ईमेल", "लॉगिन अनुमत", "पासवर्ड", "अंतिम अद्यतन", "Data_JSON"
        ]);
        var mHead = masterSheet.getRange(1, 1, 1, 17);
        mHead.setBackground("#1b365d").setFontColor("#ffffff").setFontWeight("bold");
      }

      var schoolsList = [];
      if (Array.isArray(data.schools)) {
        schoolsList = data.schools;
      } else if (typeof data.schools_json === 'string') {
        try { schoolsList = JSON.parse(data.schools_json); } catch(e){}
      }

      var authSheet2 = ss.getSheetByName("Auth_Passwords");

      if (schoolsList.length > 0) {
        // Clear old rows except header
        var lastR = masterSheet.getLastRow();
        if (lastR > 1) {
          masterSheet.getRange(2, 1, lastR - 1, 17).clearContent();
        }

        var rowsToAppend = [];
        for (var i = 0; i < schoolsList.length; i++) {
          var sc = schoolsList[i];
          rowsToAppend.push([
            i + 1,
            sc.shala_darpan_code || sc.code || '',
            sc.school_name || '',
            sc.type || 'Government',
            sc.category || '',
            sc.peeo_name || '',
            sc.peeo_code || '',
            sc.panchayat || '',
            sc.village || '',
            sc.dise_code || '',
            sc.principal_name || '',
            sc.principal_mobile || sc.mobile || '',
            sc.email || '',
            sc.login_allowed !== false ? "हाँ (Active)" : "नहीं (Disabled)",
            sc.password || sc.shala_darpan_code || '',
            Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss"),
            JSON.stringify(sc)
          ]);
        }

        if (rowsToAppend.length > 0) {
          masterSheet.getRange(2, 1, rowsToAppend.length, 17).setValues(rowsToAppend);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "मास्टर स्कूल डेटाबेस (" + schoolsList.length + " विद्यालय) Google Sheet में सफलतापूर्वक सहेज दिया गया!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 1C: UPDATE SCHOOL DETAILS
    // -------------------------------------------------------------
    if (data.action === 'updateSchoolDetails') {
      var sCode = String(data.school_code || '').trim();
      var mSheet = ss.getSheetByName("Master_Schools_DB");
      var updatedCount = 0;

      if (mSheet) {
        var mVals = mSheet.getDataRange().getValues();
        for (var mr = 1; mr < mVals.length; mr++) {
          if (String(mVals[mr][1]).trim() === sCode) {
            if (data.school_name) mSheet.getRange(mr + 1, 3).setValue(data.school_name);
            if (data.type) mSheet.getRange(mr + 1, 4).setValue(data.type);
            if (data.category) mSheet.getRange(mr + 1, 5).setValue(data.category);
            if (data.principal_name) mSheet.getRange(mr + 1, 11).setValue(data.principal_name);
            if (data.principal_mobile) mSheet.getRange(mr + 1, 12).setValue(data.principal_mobile);
            if (data.email) mSheet.getRange(mr + 1, 13).setValue(data.email);
            if (typeof data.login_allowed !== 'undefined') {
              mSheet.getRange(mr + 1, 14).setValue(data.login_allowed ? "हाँ (Active)" : "नहीं (Disabled)");
            }
            mSheet.getRange(mr + 1, 16).setValue(Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss"));
            updatedCount++;
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "विद्यालय विवरण Google Sheet में अपडेट हो गया!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 1D: TRANSFER SCHOOL BETWEEN PEEOS
    // -------------------------------------------------------------
    if (data.action === 'transferSchool') {
      var trCode = String(data.school_code || '').trim();
      var newPeeo = String(data.new_peeo_name || '').trim();
      var newPeeoCode = String(data.new_peeo_code || '').trim();
      var mSheetT = ss.getSheetByName("Master_Schools_DB");

      if (mSheetT) {
        var tVals = mSheetT.getDataRange().getValues();
        for (var tr = 1; tr < tVals.length; tr++) {
          if (String(tVals[tr][1]).trim() === trCode) {
            mSheetT.getRange(tr + 1, 6).setValue(newPeeo);
            mSheetT.getRange(tr + 1, 7).setValue(newPeeoCode);
            if (data.new_panchayat) mSheetT.getRange(tr + 1, 8).setValue(data.new_panchayat);
            mSheetT.getRange(tr + 1, 16).setValue(Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss"));
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "विद्यालय का PEEO स्थानांतरण Google Sheet में दर्ज हो गया!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 1E: ELECTION 2026 VERIFICATION SUBMISSION
    // -------------------------------------------------------------
    if (data.action === 'election_verification_submit') {
      var entry = data.entry || {};
      var eSchCode = String(entry.school_code || data.school_code || '').trim();
      var eSheet = ss.getSheetByName("Election_2026_Verification");
      if (!eSheet) {
        eSheet = ss.insertSheet("Election_2026_Verification");
        eSheet.appendRow([
          "क्र.सं.", "शाला_दर्पण_कोड", "विद्यालय_का_नाम", "ग्राम_पंचायत", "PEEO_नाम",
          "ईमेल_आईडी", "भवन_प्रकार", "भवन_स्थिति", "क्षेत्रफल_वर्गमी", "पहुंच_दूरी",
          "संस्था_प्रधान", "संस्था_प्रधान_मोबाइल", "मतदान_केंद्र_सुविधाएं_JSON", "बूथ_वार_P3_सुविधाएं_व_BLO_विवरण_JSON",
          "विशेष_टिप्पणी", "सबमिशन_दिनांक"
        ]);
      }
      var eVals = eSheet.getDataRange().getValues();
      var eRow = -1;
      for (var er = 1; er < eVals.length; er++) {
        if (String(eVals[er][1]).trim() === eSchCode) {
          eRow = er + 1;
          break;
        }
      }
      var rowData = [
        eRow > 0 ? (eRow - 1) : eVals.length,
        eSchCode,
        entry.school_name || '',
        entry.panchayat_name || '',
        entry.peeo_name || '',
        entry.school_email || '',
        entry.bldg_type || '',
        entry.bldg_condition || '',
        entry.bldg_area || '',
        entry.bldg_road_dist || '',
        (entry.principal && entry.principal.name) ? entry.principal.name : '',
        (entry.principal && entry.principal.mobile) ? entry.principal.mobile : '',
        JSON.stringify(entry.facilities || {}),
        JSON.stringify(entry.booth_details || entry.booth_facilities || {}),
        entry.remarks || '',
        entry.submitted_at || Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss")
      ];
      if (eRow > 0) {
        eSheet.getRange(eRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        eSheet.appendRow(rowData);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "पंचायती राज चुनाव 2026 भौतिक सत्यापन डेटा Google Sheet 'Election_2026_Verification' में सुरक्षित हो गया!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 2: SAVE UNIVERSAL DEMAND SUBMISSION (Data_JSON + PEEO Tab)
    // -------------------------------------------------------------
    var schoolCode = String(data.school_code || '').trim();
    if (!schoolCode) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "school_code is required."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var demandId = String(data.demand_id || 'saman_pariksha_2026_27').trim();
    var peeoName = String(data.peeo_name || '').trim();
    var schoolName = String(data.school_name || '').trim();
    var category = String(data.category || '').trim();
    var grandTotal = Number(data.grand_total) || 0;
    var submittedBy = String(data.submitted_by || data.principal_name || '').trim();
    var timestamp = String(data.timestamp || Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss"));

    var fullDataJson = typeof data.data_json === 'string' ? data.data_json : JSON.stringify(data);

    // Save to PEEO-wise tab
    var peeoTabName = sanitizeTabName(peeoName);
    var peeoSheet = ss.getSheetByName(peeoTabName);
    if (!peeoSheet) {
      // Try searching for any tab starting with PEEO_ that matches
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        var tName = sheets[s].getName();
        if (tName.indexOf("PEEO_") === 0 && peeoTabName.indexOf(tName.replace("PEEO_", "")) !== -1) {
          peeoSheet = sheets[s];
          break;
        }
      }
    }

    if (peeoSheet) {
      var peeoValues = peeoSheet.getDataRange().getValues();
      var foundRow = -1;
      // Col B: School_Code (idx 1), Col E: Demand_ID (idx 4)
      for (var pr = 1; pr < peeoValues.length; pr++) {
        var rowCode = String(peeoValues[pr][1] || '').trim();
        var rowDemand = String(peeoValues[pr][4] || '').trim();
        if (rowCode === schoolCode && (!rowDemand || rowDemand === demandId)) {
          foundRow = pr + 1;
          break;
        }
      }

      if (foundRow !== -1) {
        // Update existing row
        peeoSheet.getRange(foundRow, 5).setValue(demandId);
        peeoSheet.getRange(foundRow, 6).setValue("पूर्ण (Submitted)");
        peeoSheet.getRange(foundRow, 7).setValue(grandTotal);
        peeoSheet.getRange(foundRow, 8).setValue(submittedBy);
        peeoSheet.getRange(foundRow, 9).setValue(timestamp);
        peeoSheet.getRange(foundRow, 10).setValue(fullDataJson);
      } else {
        // Append new row
        peeoSheet.appendRow([
          peeoValues.length,
          schoolCode,
          schoolName,
          category,
          demandId,
          "पूर्ण (Submitted)",
          grandTotal,
          submittedBy,
          timestamp,
          fullDataJson
        ]);
      }
    }

    // -------------------------------------------------------------
    // BACKWARD COMPATIBILITY: Update Sheet1 for Saman Pariksha
    // -------------------------------------------------------------
    var sheet1 = ss.getSheetByName("Sheet1");
    if (sheet1 && (demandId === 'saman_pariksha_2026_27' || data.c9_total !== undefined)) {
      var values1 = sheet1.getDataRange().getValues();
      var targetRow = -1;
      for (var r1 = 1; r1 < values1.length; r1++) {
        if (String(values1[r1][3] || '').trim() === schoolCode) {
          targetRow = r1 + 1;
          break;
        }
      }

      if (targetRow !== -1) {
        var c11FacStr = Array.isArray(data.c11_faculties) ? data.c11_faculties.join(', ') : (data.c11_faculties || '');
        var c12FacStr = Array.isArray(data.c12_faculties) ? data.c12_faculties.join(', ') : (data.c12_faculties || '');
        var c11Opt = data.c11_optional || {};
        var c12Opt = data.c12_optional || {};

        var rowUpdates = [
          data.exam_code || '',
          data.principal_name || '',
          data.principal_mobile || '',
          data.incharge_name || '',
          data.incharge_mobile || '',
          Number(data.c9_total) || 0,
          Number(data.c9_sanskrit) || 0,
          Number(data.c9_urdu) || 0,
          Number(data.c10_total) || 0,
          Number(data.c10_sanskrit) || 0,
          Number(data.c10_urdu) || 0,
          c11FacStr,
          Number(data.c11_comp_hindi) || 0,
          Number(data.c11_comp_english) || 0
        ];

        OPTIONAL_KEYS.forEach(function(k) {
          rowUpdates.push(Number(c11Opt[k]) || 0);
        });
        rowUpdates.push(Number(data.c11_total) || 0);

        rowUpdates.push(
          c12FacStr,
          Number(data.c12_comp_hindi) || 0,
          Number(data.c12_comp_english) || 0
        );

        OPTIONAL_KEYS.forEach(function(k) {
          rowUpdates.push(Number(c12Opt[k]) || 0);
        });
        rowUpdates.push(Number(data.c12_total) || 0);

        rowUpdates.push(
          grandTotal,
          "पूर्ण (Submitted)",
          submittedBy,
          timestamp
        );

        sheet1.getRange(targetRow, 6, 1, rowUpdates.length).setValues([rowUpdates]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `डेटा Google Sheet (${peeoTabName}) में सफलतापूर्वक सुरक्षित हो गया!`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || '';

    // -------------------------------------------------------------
    // 0. AI CHAT & DEMAND ASSIST VIA GET (100% Mobile CORS Free & Serverless)
    // -------------------------------------------------------------
    if (action === 'ai_chat' || action === 'ai_demand_assist') {
      return handleServerlessAiRequest(params);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // -------------------------------------------------------------
    // 1. GET AUTH CREDENTIALS (Live Password Matching)
    // -------------------------------------------------------------
    if (action === 'getAuth') {
      var authSheet = ss.getSheetByName("Auth_Passwords");
      if (!authSheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Auth_Passwords sheet not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var authValues = authSheet.getDataRange().getValues();
      var users = {};
      for (var r = 1; r < authValues.length; r++) {
        var row = authValues[r];
        var code = String(row[3] || '').trim();
        if (code) {
          users[code] = {
            role: String(row[1] || '').trim(),
            name: String(row[2] || '').trim(),
            code: code,
            password: String(row[4] || '').trim(),
            mobile: String(row[5] || '').trim(),
            last_updated: String(row[6] || '').trim()
          };
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        count: Object.keys(users).length,
        users: users
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // 2. GET UNIVERSAL DEMAND SUBMISSIONS ACROSS ALL PEEOs
    // -------------------------------------------------------------
    if (action === 'getDemandSubmissions') {
      var reqDemandId = String(params.demand_id || 'saman_pariksha_2026_27').trim();
      var reqPeeo = params.peeo_name ? sanitizeTabName(params.peeo_name) : null;

      var allSheets = ss.getSheets();
      var results = {};

      for (var s = 0; s < allSheets.length; s++) {
        var curSheet = allSheets[s];
        var tName = curSheet.getName();

        if (tName.indexOf("PEEO_") !== 0) continue;
        if (reqPeeo && tName !== reqPeeo) continue;

        var v = curSheet.getDataRange().getValues();
        for (var r = 1; r < v.length; r++) {
          var row = v[r];
          var scCode = String(row[1] || '').trim();
          var demId = String(row[4] || '').trim();
          var stat = String(row[5] || '').trim();
          var jsonCell = String(row[9] || '').trim();

          if (scCode && demId === reqDemandId && (stat.indexOf('Submitted') !== -1 || stat.indexOf('पूर्ण') !== -1)) {
            try {
              results[scCode] = JSON.parse(jsonCell);
            } catch(e) {
              results[scCode] = {
                school_code: scCode,
                school_name: String(row[2] || ''),
                category: String(row[3] || ''),
                status: stat,
                grand_total: Number(row[6]) || 0,
                submitted_by: String(row[7] || ''),
                timestamp: String(row[8] || '')
              };
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        demand_id: reqDemandId,
        count: Object.keys(results).length,
        submissions: results
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // 3. GET ALL SAMAN PARIKSHA SUBMISSIONS & EXAM CODES (Sheet1)
    // -------------------------------------------------------------
    if (action === 'getAll') {
      var sheet1 = ss.getSheetByName("Sheet1") || ss.getActiveSheet();
      var values = sheet1.getDataRange().getValues();
      var allData = {};
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        var code = String(row[3] || '').trim();
        var examCode = String(row[5] || '').trim();
        var principalName = String(row[6] || '').trim();
        var inchargeName = String(row[8] || '').trim();
        var st = String(row[69] || '').trim();
        var isSub = (st.indexOf('Submitted') !== -1 || st.indexOf('पूर्ण') !== -1);
        
        // Return if submitted OR if exam code / staff details were pre-filled in Google Sheet!
        if (code && (isSub || examCode || principalName || inchargeName)) {
          allData[code] = rowToSubmission(row);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        count: Object.keys(allData).length,
        submissions: allData
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // 4. GET SINGLE SCHOOL SUBMISSION
    // -------------------------------------------------------------
    if (action === 'get' && params.school_code) {
      var targetCode = String(params.school_code).trim();
      var s1 = ss.getSheetByName("Sheet1") || ss.getActiveSheet();
      var v1 = s1.getDataRange().getValues();
      for (var r = 1; r < v1.length; r++) {
        var row = v1[r];
        if (String(row[3] || '').trim() === targetCode) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            submission: rowToSubmission(row)
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "School code " + targetCode + " not found in sheet"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Health check
    return ContentService.createTextOutput(JSON.stringify({
      status: "active",
      database: "CBEO Bhinai Universal Multi-Sheet Database",
      version: "2.0",
      tabs: ss.getSheets().map(function(s){ return s.getName(); }),
      timestamp: Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss")
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function rowToSubmission(row) {
  var schoolCode = String(row[3] || '').trim();
  var schoolName = String(row[1] || '').trim();
  var status = String(row[69] || '').trim();
  var isSubmitted = status.indexOf('Submitted') !== -1 || status.indexOf('पूर्ण') !== -1;
  
  var c11Opt = {};
  for (var i = 0; i < OPTIONAL_KEYS.length; i++) {
    c11Opt[OPTIONAL_KEYS[i]] = Number(row[19 + i]) || 0;
  }
  var c12Opt = {};
  for (var j = 0; j < OPTIONAL_KEYS.length; j++) {
    c12Opt[OPTIONAL_KEYS[j]] = Number(row[45 + j]) || 0;
  }
  
  var c11Fac = row[16] ? String(row[16]).split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
  var c12Fac = row[42] ? String(row[42]).split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];

  return {
    school_code: schoolCode,
    school_name: schoolName,
    category: String(row[2] || '').trim(),
    peeo_name: String(row[4] || '').trim(),
    exam_code: String(row[5] || '').trim(),
    principal_name: String(row[6] || '').trim(),
    principal_mobile: String(row[7] || '').trim(),
    incharge_name: String(row[8] || '').trim(),
    incharge_mobile: String(row[9] || '').trim(),
    c9_total: Number(row[10]) || 0,
    c9_sanskrit: Number(row[11]) || 0,
    c9_urdu: Number(row[12]) || 0,
    c10_total: Number(row[13]) || 0,
    c10_sanskrit: Number(row[14]) || 0,
    c10_urdu: Number(row[15]) || 0,
    c11_faculties: c11Fac,
    c11_comp_hindi: Number(row[17]) || 0,
    c11_comp_english: Number(row[18]) || 0,
    c11_optional: c11Opt,
    c11_total: Number(row[41]) || 0,
    c12_faculties: c12Fac,
    c12_comp_hindi: Number(row[43]) || 0,
    c12_comp_english: Number(row[44]) || 0,
    c12_optional: c12Opt,
    c12_total: Number(row[67]) || 0,
    grand_total: Number(row[68]) || 0,
    status: status,
    is_submitted: isSubmitted,
    submitted_by: String(row[70] || '').trim(),
    timestamp: String(row[71] || '').trim()
  };
}

/**
 * =========================================================================
 * SERVERLESS AI ASSISTANT & ZERO-LEAK PROXY ENGINE
 * Runs 24/7 on Google Cloud - Works for all mobile logins with 0 key exposure on GitHub
 * =========================================================================
 */
function handleServerlessAiRequest(data) {
  try {
    var query = String(data.query || '').trim();
    if (!query) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Query is required" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var isDemandAssist = (data.action === 'ai_demand_assist' || data.mode === 'demand');
    var cache = CacheService.getScriptCache();
    var cacheDigest = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, query + (isDemandAssist ? "_d" : "_c"))).substring(0, 30);
    var cacheKey = "ai_" + cacheDigest.replace(/[^a-zA-Z0-9_]/g, '');
    var cached = cache.get(cacheKey);
    if (cached) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        source: "gas_smart_cache",
        response: isDemandAssist ? JSON.parse(cached) : cached,
        saved_tokens: 300
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Load API Keys from Script Properties (Secure, never visible on GitHub)
    var sp = PropertiesService.getScriptProperties();
    var rawKeys = sp.getProperty("GEMINI_API_KEY") || "";
    
    // Fallback: check AI_Config sheet if ScriptProperties is empty
    if (!rawKeys) {
      var cfgSheet = ss.getSheetByName("AI_Config");
      if (cfgSheet) {
        var cfgData = cfgSheet.getDataRange().getValues();
        for (var ci = 1; ci < cfgData.length; ci++) {
          if (String(cfgData[ci][0]).trim() === "GEMINI_API_KEY") {
            rawKeys = String(cfgData[ci][1]).trim();
            break;
          }
        }
      }
    }

    var keyPool = rawKeys.split(/[,;\n]+/).map(function(k){ return k.trim(); }).filter(Boolean);
    
    // If not set in Script Properties or Sheet, check passed key parameter
    if (keyPool.length === 0 && data.key) {
      keyPool = [String(data.key).trim()];
    }

    var prompt = "";
    if (isDemandAssist) {
      prompt = "You are Educational Administration AI for CBEO Bhinai, District AJMER (अजमेर), Rajasthan. " +
        "Rule: District is strictly AJMER (अजमेर); never Kekri. " +
        "Topic for new demand/form: " + query + "\n" +
        "Generate a complete educational dynamic demand form. Output ONLY valid JSON with keys:\n" +
        "{\n" +
        "  \"title\": \"औपचारिक हिंदी शीर्षक\",\n" +
        "  \"description\": \"संक्षिप्त आधिकारिक निर्देश (2 वाक्य)\",\n" +
        "  \"columns\": [\"कॉलम 1\", \"कॉलम 2\", \"कॉलम 3\", \"कॉलम 4\", \"कॉलम 5\"],\n" +
        "  \"priority\": \"अति आवश्यक (Urgent)\",\n" +
        "  \"recommended_days\": 5\n" +
        "}";
    } else {
      // 25 PEEO Directory Lookup (Local RAG)
      var peeoDirectory = [
        {name: "PEEO BANDANWARA", aliases: ["बांदनवाड़ा", "bandanwara"], code: "221769", head: "BHANWAR LAL JAT", mobile: "9587293842", email: "gsssbandanwara3579@gmail.com"},
        {name: "PEEO BARGAON", aliases: ["बड़गांव", "bargaon"], code: "221764", head: "CHANDRA PRAKASH LADDHA", mobile: "9001450275", email: "bargaonschool@gmail.com"},
        {name: "PEEO BARLI", aliases: ["बड़ली", "barli"], code: "221755", head: "SHAILENDRA KUMAR PANDYA", mobile: "9950985201", email: "gsssbarliajm@gmail.com"},
        {name: "PEEO BHINAY", aliases: ["भिनाय", "bhinay"], code: "221780", head: "AJAY KUMAR DHABAI", mobile: "9549240545", email: "principalbhinai123@gmail.com"},
        {name: "PEEO BOOBKIYA", aliases: ["बूबकिया", "boobkiya"], code: "221763", head: "RAM CHANDRA GUJAR", mobile: "9252068645", email: "gssboobkiya@gmail.com"},
        {name: "PEEO CHAPANERI", aliases: ["चापानेरी", "chapaneri"], code: "221758", head: "LADURAM SHARMA", mobile: "9462507510", email: "chapanerischool@gmail.com"},
        {name: "PEEO CHHACHHUNDRA", aliases: ["छाछून्दरा", "chhachhundra"], code: "221787", head: "SITARAM DHOBI", mobile: "9413781124", email: "gsschhachhundrabhinai@gmail.com"},
        {name: "PEEO DEOLIYA KALAN", aliases: ["देवलिया", "deoliya", "devliya", "devlia"], code: "221754", head: "PURNIMA", mobile: "9414343109", email: "deoliakalan105@gmail.com"},
        {name: "PEEO DEVPURA", aliases: ["देवपुरा", "devpura"], code: "488941", head: "ANITA SHARMA", mobile: "9414550658", email: "devpuraschool@gmail.com"},
        {name: "PEEO DHANTOL", aliases: ["धांतोल", "dhantol"], code: "221783", head: "SURENDRA NAGORA", mobile: "9413695182", email: "gssdhantol2013@gmail.com"},
        {name: "PEEO EKALSEENGA", aliases: ["एकलसिंघा", "ekalsingha", "ekalseenga"], code: "221786", head: "VISHWASHWAR PRASAD SHARMA", mobile: "7728052397", email: "ekalseengaschool@gmail.com"},
        {name: "PEEO GURHA KHURD", aliases: ["गुढ़ा खुर्द", "gudda", "gurha"], code: "221762", head: "DEEPESH KUMAR SISODIA", mobile: "9414554344", email: "gurhakhurdschool@gmail.com"},
        {name: "PEEO KANAI KALAN", aliases: ["कनाई कलां", "kanai"], code: "221765", head: "NARESH KUMAR", mobile: "9166233899", email: "kanaikalanschool@gmail.com"},
        {name: "PEEO KARATI", aliases: ["कराटी", "karati"], code: "221773", head: "DEEPAK SANWARIYA", mobile: "9950736300", email: "karatischool@gmail.com"},
        {name: "PEEO KEROT", aliases: ["केरोट", "kerot"], code: "221767", head: "SOHANLAL SARAN", mobile: "9929526324", email: "kerotschool@gmail.com"},
        {name: "PEEO KUMHARIYA", aliases: ["कुम्हारिया", "kumhariya"], code: "221777", head: "JYOTI PRAKASH SHARMA", mobile: "9460690289", email: "Gssskumhariya108@gmail.com"},
        {name: "PEEO LAMGARA", aliases: ["लामगरा", "lamgara"], code: "221759", head: "RAJEEV KUMAR MANDOT", mobile: "9413134849", email: "gsslamgara@gmail.com"},
        {name: "PEEO NAGOLA", aliases: ["नागोला", "nagola"], code: "221772", head: "VINOD KUMAR RAO", mobile: "8955306674", email: "gsssnagola79@gmail.com"},
        {name: "PEEO NANDSI", aliases: ["नांदसी", "nandsi"], code: "221756", head: "OM PRAKASH VERMA", mobile: "9001637473", email: "pgsssnandsi@gmail.com"},
        {name: "PEEO PADALIYA", aliases: ["पाडलिया", "padaliya", "padliya"], code: "221766", head: "LAXMI POPTANI", mobile: "9549364023", email: "padaliyaschool@gmail.com"},
        {name: "PEEO PADANGA", aliases: ["पानांगा", "padanga", "pananga"], code: "221788", head: "SMT ASHA RAJ", mobile: "7877090975", email: "gssspadanga@gmail.com"},
        {name: "PEEO RAMMALIA", aliases: ["राममालिया", "rammalia", "rammaliya"], code: "221785", head: "LAL CHAND MUNOTH", mobile: "9928328808", email: "rammaliaschool@gmail.com"},
        {name: "PEEO RATAKOT", aliases: ["राताकोट", "ratakot"], code: "221775", head: "KUNJ BIHARI SHARMA", mobile: "9887753471", email: "gssratakot@gmail.com"},
        {name: "PEEO SINGAWAL", aliases: ["सिंगावल", "singawal"], code: "221781", head: "SEEMA SHARMA", mobile: "8290911983", email: "singawalschool1234@gmail.com"},
        {name: "PEEO SOBRI", aliases: ["सोबरी", "sobri"], code: "221782", head: "FAYYAZ MOHAMMED", mobile: "9829487158", email: "gsssobri@gmail.com"}
      ];

      var matchedRecord = "";
      var qLower = query.toLowerCase();
      for (var pi = 0; pi < peeoDirectory.length; pi++) {
        var rec = peeoDirectory[pi];
        var isMatch = (qLower.indexOf(rec.code) !== -1);
        if (!isMatch) {
          for (var ai = 0; ai < rec.aliases.length; ai++) {
            if (qLower.indexOf(rec.aliases[ai].toLowerCase()) !== -1) {
              isMatch = true;
              break;
            }
          }
        }
        if (isMatch) {
          matchedRecord = "• " + rec.name + " | शाला दर्पण कोड: " + rec.code + " | प्रधानाचार्य/PEEO: " + rec.head + " | मोबाइल: " + rec.mobile + " | ईमेल: " + rec.email;
          break;
        }
      }

      if (matchedRecord) {
        var directAns = "📍 **" + rec.name + "** (ब्लॉक भिनाय, जिला अजमेर)\n" +
          "• **शाला दर्पण कोड:** `" + rec.code + "`\n" +
          "• **प्रधानाचार्य / PEEO प्रभारी:** " + rec.head + "\n" +
          "• **आधिकारिक मोबाइल:** **" + rec.mobile + "**\n" +
          "• **ईमेल:** " + rec.email + "\n\n" +
          "*(अतिरिक्त तकनीकी सहायता हेतु CBEO भिनाय IT सेल प्रभारी श्री जितेन्द्र कुमार: **9928254317** पर संपर्क करें।)*";
        
        try {
          cacheSheet.appendRow([cacheKey, directAns, Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm:ss")]);
        } catch(ce){}

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          source: "cbeo_master_directory",
          response: directAns,
          saved_tokens: 350
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        prompt = "आप 'शिक्षा सेतु AI', CBEO भिनाय, जिला अजमेर (AJMER) के आधिकारिक सहायक हैं। " +
          "नियम: जिला केवल अजमेर (AJMER) है (केकड़ी कभी नहीं लिखना है)। " +
          "समान परीक्षा 2026-27 अंतिम तिथि: 05 अक्टूबर 2026। " +
          "प्रपत्र-1 (9वीं-10वीं नामांकन व संस्कृत/उर्दू) व प्रपत्र-2 (11वीं-12वीं संकाय व ऐच्छिक विषय) से जुड़े प्रश्नों के 2-3 संक्षिप्त, स्पष्ट व सटीक बिंदुवार उत्तर दें। " +
          "तकनीकी सहायता: IT सेल प्रभारी जितेन्द्र कुमार: 9928254317।\n\n" +
          "प्रश्न: " + query;
      }
    }

    var payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        topP: 0.8
      }
    });

    var models = ["gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];
    var successText = null;

    for (var k = 0; k < keyPool.length; k++) {
      var apiKey = keyPool[k];
      for (var m = 0; m < models.length; m++) {
        try {
          var url = "https://generativelanguage.googleapis.com/v1beta/models/" + models[m] + ":generateContent?key=" + apiKey;
          var resp = UrlFetchApp.fetch(url, {
            method: "post",
            contentType: "application/json",
            payload: payload,
            muteHttpExceptions: true
          });
          if (resp.getResponseCode() === 200) {
            var resJson = JSON.parse(resp.getContentText());
            if (resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content) {
              successText = resJson.candidates[0].content.parts[0].text;
              break;
            }
          }
        } catch (fetchErr) {
          // Try next
        }
      }
      if (successText) break;
    }

    if (!successText) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "AI सेवा वर्तमान में व्यस्त है। कृपया कुछ क्षण पश्चात पुनः प्रयास करें।"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var finalResult = successText;
    if (isDemandAssist) {
      try {
        var cleanJson = successText.replace(/```json/gi, '').replace(/```/g, '').trim();
        finalResult = JSON.parse(cleanJson);
      } catch (pe) {
        finalResult = {
          title: query + " विवरण प्रपत्र 2026",
          description: "उक्त विषय की अद्यतन स्थिति दर्ज कर प्रमाणित रिपोर्ट सबमिट करें।",
          columns: ["स्वीकृत विवरण", "वर्तमान स्थिति", "अनुमानित व्यय", "विशेष टीप"],
          priority: "अति आवश्यक (Urgent)",
          recommended_days: 5
        };
      }
    }

    // Cache result for 6 hours (21600 seconds) - 0 tokens for repeat queries!
    try {
      cache.put(cacheKey, isDemandAssist ? JSON.stringify(finalResult) : finalResult, 21600);
    } catch(ce){}

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      source: "gas_serverless_gemini",
      response: finalResult
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------
// HELPER: SECURE CLOUD GITHUB SYNC ENGINE (REST API v3)
// -------------------------------------------------------------
function syncToGitHubViaApi(filePath, fileContent, commitMessage) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
    if (!token) {
      return { success: false, message: "GitHub Token Google Apps Script ScriptProperties में सेट नहीं है।" };
    }

    var owner = "Jit9763";
    var repo = "cbeo-bhinai-portal";
    var cleanPath = String(filePath || 'master_cbeo_data.json').replace(/^\/+/, '');
    var url = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + cleanPath;

    // 1. Fetch current file SHA if file already exists on GitHub
    var sha = null;
    try {
      var getRes = UrlFetchApp.fetch(url + "?ref=main", {
        method: "get",
        headers: {
          "Authorization": "Bearer " + token,
          "User-Agent": "CBEO-Bhinai-GAS",
          "Accept": "application/vnd.github.v3+json"
        },
        muteHttpExceptions: true
      });
      if (getRes.getResponseCode() === 200) {
        var gData = JSON.parse(getRes.getContentText());
        sha = gData.sha;
      }
    } catch(ge) {}

    // 2. Base64 encode the content (UTF-8)
    var b64Content = Utilities.base64Encode(fileContent, Utilities.Charset.UTF_8);

    // 3. PUT request to GitHub API to commit directly
    var payload = {
      message: commitMessage || ("auto(gas): cloud sync " + cleanPath + " [" + Utilities.formatDate(new Date(), "GMT+5:30", "dd-MM-yyyy HH:mm") + "]"),
      content: b64Content,
      branch: "main"
    };
    if (sha) payload.sha = sha;

    var putRes = UrlFetchApp.fetch(url, {
      method: "put",
      headers: {
        "Authorization": "Bearer " + token,
        "User-Agent": "CBEO-Bhinai-GAS",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var pCode = putRes.getResponseCode();
    if (pCode === 200 || pCode === 201) {
      return { success: true, message: "✓ " + cleanPath + " सीधे GitHub पर सफलतापूर्वक अपडेट हो गई!", sha: sha };
    } else {
      return { success: false, message: "GitHub API Error (" + pCode + "): " + putRes.getContentText() };
    }
  } catch(err) {
    return { success: false, message: "GAS Exception: " + err.toString() };
  }
}


