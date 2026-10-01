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
          break;
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
