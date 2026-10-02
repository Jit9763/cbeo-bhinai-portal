/**
 * ==============================================================================================
 * कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय, जिला - अजमेर (AJMER)
 * MASTER BACKUP & DUMMY SANDBOX GOOGLE APPS SCRIPT (V2.0 OFFICIAL)
 * ==============================================================================================
 * MANDATORY RULE: जिला सदैव अजमेर (AJMER) रहेगा। केकड़ी (KEKRI) कदापि प्रयोग न करें।
 * 
 * संबद्ध गूगल स्प्रेडशीट:
 * नाम: 7_CBEO_Master_Backup_And_Dummy_Sandbox_Sheet
 * ID: 1sBtbb-uWHxaI7nbrkEbyAZs8CwMYuWE4fmwJhHN2FQU
 * URL: https://docs.google.com/spreadsheets/d/1sBtbb-uWHxaI7nbrkEbyAZs8CwMYuWE4fmwJhHN2FQU/edit
 * 
 * 🚀 इंस्टॉलेशन निर्देश (2 आसान स्टेप):
 * 1. अपनी गूगल शीट (7_CBEO_Master_Backup_And_Dummy_Sandbox_Sheet) खोलें।
 * 2. Extensions > Apps Script पर क्लिक करें।
 * 3. यह सम्पूर्ण कोड पेस्ट करें और Ctrl+S (Save) दबाएं।
 * 4. Deploy > New Deployment > Web app चुनें।
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Deploy दबाएं और प्राप्त Web App URL को कॉपी कर लें।
 * ==============================================================================================
 */

var BACKUP_SPREADSHEET_ID = "1sBtbb-uWHxaI7nbrkEbyAZs8CwMYuWE4fmwJhHN2FQU";

/**
 * ⚡ केवल 1 बार इस फंक्शन को रन करें (ऊपर Run बटन दबाकर):
 * इससे Google ईमेल भेजने की परमिशन (Authorization) मांगकर सक्रिय कर देगा!
 */
function testAuthorizePermissions() {
  var quota = MailApp.getRemainingDailyQuota();
  Logger.log("सफलता! दैनिक ईमेल कोटा उपलब्ध: " + quota);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "CBEO Bhinai Email Test", "कार्यालय CBEO भिनाय: ईमेल सेवा सक्रिय हो गई है!");
}

function getTargetSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID);
  }
}

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var output = { 
    success: false, 
    district: "AJMER (अजमेर)", 
    office: "CBEO BHINAI (AJMER)",
    spreadsheet_id: BACKUP_SPREADSHEET_ID
  };
  
  try {
    var params = {};
    if (method === 'GET' && e && e.parameter) {
      params = e.parameter;
    } else if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    var action = String(params.action || 'health_check').trim().toLowerCase();
    var ss = getTargetSpreadsheet();

    // 1. Health Check
    if (action === 'health_check' || action === 'ping') {
      output.success = true;
      output.message = "CBEO Bhinai Master Backup Web App Active & Ready (District: AJMER)";
      output.timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      output.sheets_available = ss.getSheets().map(function(s) { return s.getName(); });
    }

    // 2. 🧪 Sandbox Test Entry (डमी स्टोरेज / टेस्ट मोड)
    else if (action === 'sandbox_test_entry' || action === 'save_dummy_submission') {
      var entry = params.test_entry || params;
      var dummySheet = getOrCreateSheet(ss, "DUMMY_SANDBOX_STORAGE", [
        "क्र.सं.", "टेस्ट सबमिशन ID", "मांग ID", "मांग शीर्षक", "विद्यालय SD कोड", 
        "विद्यालय का नाम", "संबंधित PEEO", "प्रस्तुतकर्ता अधिकारी", "मोबाइल नंबर", 
        "टेस्ट सबमिशन दिनांक", "डेटा प्रविष्टियां (JSON)", "डिजिटल हस्ताक्षर (Base64)"
      ], false, "#059669");

      var nextRow = dummySheet.getLastRow() + 1;
      var testId = "TEST_" + Date.now();

      dummySheet.appendRow([
        nextRow - 1,
        testId,
        entry.demand_id || '',
        entry.demand_title || 'टेस्ट मांग',
        entry.school_code || '',
        entry.school_name || '',
        entry.peeo_name || '',
        entry.submitted_by || 'टेस्ट संस्था प्रधान',
        entry.submitter_mobile || '',
        new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        JSON.stringify(entry.data || {}),
        entry.signature_data ? "हस्ताक्षर सुरक्षित (Base64)" : "हस्ताक्षर नहीं"
      ]);

      logAudit(ss, entry.submitted_by || 'Admin', "डमी टेस्ट सबमिशन (Sandbox)", entry.school_name || '', "टेस्ट डेटा सैंडबॉक्स स्टोरेज में सुरक्षित");

      output.success = true;
      output.test_id = testId;
      output.message = "डमी टेस्ट डेटा सफलतापूर्वक 'DUMMY_SANDBOX_STORAGE' टैब में सुरक्षित हो गया!";
    }

    // 3. 📦 Archive Demand & Submissions Backup (आर्काइव बैकअप)
    else if (action === 'archive_demand' || action === 'backup_demand') {
      var demandId = params.demand_id || ('DEMAND_' + Date.now());
      var demandTitle = params.demand_title || 'अनाम मांग';
      var demandData = params.demand_data || {};
      var submissions = params.submissions || [];
      var archivedBy = params.archived_by || 'जितेन्द्र कुमार (सुपर एडमिन)';

      // Save Demand Registry
      var regSheet = getOrCreateSheet(ss, "मांग_आर्काइव_रजिस्ट्री", [
        "क्र.सं.", "मांग ID", "मांग शीर्षक", "संग्रह स्तर", "कॉलम संख्या", 
        "कुल सबमिशन", "आर्काइव दिनांक", "आर्काइवकर्ता", "मांग कॉन्फ़िगरेशन (JSON)"
      ], false, "#1e3a8a");
      
      var nextRow = regSheet.getLastRow() + 1;
      regSheet.appendRow([
        nextRow - 1,
        demandId,
        demandTitle,
        demandData.collectionLevel || 'peeo',
        (demandData.columns ? demandData.columns.length : 0),
        (Array.isArray(submissions) ? submissions.length : Object.keys(submissions).length),
        new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        archivedBy,
        JSON.stringify(demandData)
      ]);

      // Save Detailed Submissions Data in dedicated tab
      var subSheetName = "आर्काइव_" + sanitizeSheetName(demandTitle).substring(0, 20);
      var subSheet = getOrCreateSheet(ss, subSheetName, [
        "क्र.सं.", "मांग ID", "इकाई कोड / SD Code", "इकाई नाम / विद्यालय", "PEEO परिक्षेत्र", 
        "सत्यापन स्थिति", "प्रविष्टि दिनांक", "सबमिशन डेटा (JSON)"
      ], false, "#0369a1");

      var subList = Array.isArray(submissions) ? submissions : Object.values(submissions);
      subList.forEach(function(sub, idx) {
        subSheet.appendRow([
          idx + 1,
          demandId,
          sub.school_code || sub.peeo_id || sub.shala_darpan_code || '',
          sub.school_name || sub.peeo_name || '',
          sub.peeo_name || '',
          sub.verified ? "सत्यापित" : "प्राप्त",
          sub.submittedAt || new Date().toISOString(),
          JSON.stringify(sub.data || sub)
        ]);
      });

      logAudit(ss, archivedBy, "मांग आर्काइव व बैकअप", demandTitle, "सफल बैकअप: " + subList.length + " सबमिशन");

      output.success = true;
      output.message = "मांग '" + demandTitle + "' का सम्पूर्ण डेटा बैकअप शीट में सुरक्षित कर लिया गया!";
      output.demand_id = demandId;
      output.backup_sheet_name = subSheetName;
    }

    // 4. 🔄 Live Dynamic Demand Submission Backup (लाइव सबमिशन सिंक)
    else if (action === 'save_live_submission') {
      var liveSheet = getOrCreateSheet(ss, "लाइव_मांग_सबमिशन_बैकअप", [
        "क्र.सं.", "सबमिशन ID", "मांग ID", "मांग शीर्षक", "विद्यालय SD कोड",
        "विद्यालय का नाम", "संबंधित PEEO", "प्रस्तुतकर्ता", "मोबाइल नंबर",
        "सबमिशन दिनांक व समय", "डेटा प्रविष्टियां (JSON)", "सत्यापन स्थिति"
      ], false, "#b45309");

      var subRow = [
        liveSheet.getLastRow(),
        "SUB_" + Date.now(),
        params.demand_id || '',
        params.demand_title || '',
        params.school_code || '',
        params.school_name || '',
        params.peeo_name || '',
        params.submitted_by || '',
        params.submitter_mobile || '',
        new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        JSON.stringify(params.data || {}),
        "सत्यापित (Verified)"
      ];

      liveSheet.appendRow(subRow);

      output.success = true;
      output.message = "लाइव सबमिशन बैकअप शीट में सुरक्षित हुआ!";
    }

    // 5. Restore Archived Demand
    else if (action === 'restore_demand') {
      var resDemandId = params.demand_id;
      var restoredBy = params.restored_by || 'जितेन्द्र कुमार (सुपर एडमिन)';
      var regSheet = ss.getSheetByName("मांग_आर्काइव_रजिस्ट्री");
      var restoredDemand = null;

      if (regSheet) {
        var data = regSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === String(resDemandId).trim()) {
            try {
              restoredDemand = JSON.parse(data[i][8]);
              restoredDemand.archived = false;
            } catch(e) {}
            break;
          }
        }
      }

      logAudit(ss, restoredBy, "मांग पुनर्बहाली (Restore)", resDemandId, "आर्काइव से लाइव पोर्टल पर पुनर्बहाल");

      output.success = true;
      output.message = "मांग सफलतापूर्वक पुनर्बहाल कर दी गई!";
      output.demand = restoredDemand;
    }

    // 6. Universal Audit Log
    else if (action === 'log_audit') {
      logAudit(ss, params.user || 'Unknown', params.action_name || 'Action', params.target || '', params.details || '');
      output.success = true;
      output.message = "ऑडिट लॉग सुरक्षित हुआ!";
    }

    // 7. Automated Email Alert Dispatch (Uses Google account native MailApp - Zero SMTP setup needed!)
    else if (action === 'send_email' || action === 'dispatch_compliance_email') {
      var emailTo = (params.to || params.email_to || Session.getEffectiveUser().getEmail()).trim();
      var subject = params.subject || ("कार्यालय CBEO भिनाय (अजमेर) - दैनिक लंबित रिपोर्ट");
      var body = params.body || "CBEO Bhinai Automated Compliance Report";
      var htmlBody = params.html_body || null;

      if (emailTo) {
        if (htmlBody) {
          MailApp.sendEmail({
            to: emailTo,
            subject: subject,
            body: body,
            htmlBody: htmlBody
          });
        } else {
          MailApp.sendEmail(emailTo, subject, body);
        }
        output.success = true;
        output.message = "ईमेल सफलतापूर्वक प्रेषित: " + emailTo;
        logAudit(ss, "Google Apps Script Engine", "ईमेल प्रेषण", emailTo, subject);
      } else {
        output.success = false;
        output.message = "प्राप्तकर्ता ईमेल पता अनुपलब्ध है।";
      }
    }

    else {
      output.success = false;
      output.message = "अमान्य एक्शन: " + action;
    }

  } catch (error) {
    output.success = false;
    output.error = error.toString();
    output.stack = error.stack;
  }

  var jsonStr = JSON.stringify(output);
  return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
}

// --- HELPER FUNCTIONS ---
function getOrCreateSheet(ss, sheetName, headers, clearExisting, headerBgColor) {
  var sheet = ss.getSheetByName(sheetName);
  var bg = headerBgColor || "#1e293b";

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground(bg);
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }
  } else if (clearExisting) {
    sheet.clearContents();
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground(bg);
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }
  }
  return sheet;
}

function sanitizeSheetName(name) {
  return String(name || 'Sheet').replace(/[\\/?*[\]:]/g, '_').trim();
}

function logAudit(ss, user, action, target, details) {
  try {
    var auditSheet = getOrCreateSheet(ss, "पोर्टल_ऑडिट_ट्रेल", [
      "समय मोहर", "उपयोगकर्ता (User)", "कार्यवाही (Action)", "लक्षित विषय (Target)", "विस्तृत विवरण (Details)", "जिला"
    ], false, "#475569");
    auditSheet.appendRow([
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      user,
      action,
      target,
      details,
      "अजमेर (AJMER)"
    ]);
  } catch(e) {}
}
