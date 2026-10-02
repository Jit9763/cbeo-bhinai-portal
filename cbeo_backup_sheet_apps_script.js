/**
 * ==============================================================================================
 * कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय, जिला - अजमेर (AJMER)
 * MASTER BACKUP & ARCHIVE GOOGLE APPS SCRIPT (FULL POWER V1.0)
 * ==============================================================================================
 * MANDATORY RULE: जिला सदैव अजमेर (AJMER) रहेगा। केकड़ी (KEKRI) कदापि प्रयोग न करें।
 * 
 * निर्देश (DEPLOYMENT STEPS):
 * 1. अपनी नई "CBEO Bhinai Master Backup Sheet" Google Spreadsheet खोलें।
 * 2. Extensions > Apps Script पर क्लिक करें।
 * 3. यह सम्पूर्ण कोड पेस्ट करें और Ctrl+S दबाएं।
 * 4. Deploy > New Deployment > Web app चुनें।
 * 5. Execute as: "Me" | Who has access: "Anyone" चुनें।
 * 6. "Deploy" दबाएं और जनरेट हुआ Web App URL कॉपी कर लें।
 * ==============================================================================================
 */

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var output = { success: false, district: "AJMER (अजमेर)", office: "CBEO BHINAI (AJMER)" };
  
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Health Check
    if (action === 'health_check' || action === 'ping') {
      output.success = true;
      output.message = "CBEO Bhinai Backup Web App is Active & Ready (District: AJMER)";
      output.timestamp = new Date().toISOString();
      output.sheets_available = ss.getSheets().map(function(s) { return s.getName(); });
    }

    // 2. Archive Demand & Submissions Backup
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
      ]);
      
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

      // Save Detailed Submissions Data
      var subSheetName = "आर्काइव_" + sanitizeSheetName(demandTitle).substring(0, 20);
      var subSheet = getOrCreateSheet(ss, subSheetName, [
        "क्र.सं.", "मांग ID", "इकाई कोड / SD Code", "इकाई नाम / विद्यालय", "PEEO परिक्षेत्र", 
        "सत्यापन स्थिति", "प्रविष्टि दिनांक", "सबमिशन डेटा (JSON)"
      ]);

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

      // Audit Log
      logAudit(ss, archivedBy, "मांग आर्काइव व बैकअप", demandTitle, "सफल स्थानांतरण: " + subList.length + " सबमिशन");

      output.success = true;
      output.message = "मांग '" + demandTitle + "' का सम्पूर्ण डेटा बैकअप शीट में सुरक्षित कर लिया गया!";
      output.demand_id = demandId;
      output.backup_sheet_name = subSheetName;
    }

    // 3. Restore Archived Demand
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

    // 4. Staff Master Complete Backup
    else if (action === 'sync_staff_master_backup') {
      var staffList = params.staff || [];
      var syncBy = params.synced_by || 'जितेन्द्र कुमार (सुपर एडमिन)';
      var stSheet = getOrCreateSheet(ss, "कार्मिक_मास्टर_बैकअप", [
        "क्र.सं.", "Staff ID", "कार्मिक नाम (हिन्दी)", "लिंग", "पद", "पदस्थापन विद्यालय", 
        "PEEO परिक्षेत्र", "मोबाइल नम्बर", "SSO ID", "संस्था प्रधान स्थिति", "अपडेट दिनांक"
      ], true); // true = overwrite

      var rows = staffList.map(function(s, idx) {
        return [
          idx + 1,
          s.staff_id || '',
          s.name || '',
          s.gender || '',
          s.post || '',
          s.school_name || '',
          s.peeo_name || '',
          s.mobile || '',
          s.sso_id || '',
          s.is_sanstha_pradhan ? "👑 संस्था प्रधान" : "कार्मिक",
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        ];
      });

      if (rows.length > 0) {
        stSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      logAudit(ss, syncBy, "कार्मिक मास्टर बैकअप सिंक", staffList.length + " कार्मिक", "देवनागरी यूनिकोड डेटा बैकअप पूर्ण");

      output.success = true;
      output.message = staffList.length + " कार्मिकों का सम्पूर्ण बैकअप गूगल शीट में सुरक्षित हुआ!";
      output.total_staff_backed_up = staffList.length;
    }

    // 5. Schools & Contacts Complete Backup
    else if (action === 'sync_schools_master_backup') {
      var schools = params.schools || [];
      var peeos = params.peeos || [];
      var schSheet = getOrCreateSheet(ss, "विद्यालय_एवं_सम्पर्क_बैकअप", [
        "क्र.सं.", "शाला दर्पण कोड", "विद्यालय का नाम", "श्रेणी", "प्रकार", 
        "PEEO परिक्षेत्र", "संस्था प्रधान / संचालक", "मोबाइल नम्बर", "परीक्षा प्रभारी", "प्रभारी मोबाइल"
      ], true);

      var rows = schools.map(function(s, idx) {
        return [
          idx + 1,
          s.shala_darpan_code || '',
          s.school_name || '',
          s.category || '',
          s.type || '',
          s.peeo_name || '',
          s.principal_name || '',
          s.principal_mobile || '',
          s.incharge_name || '',
          s.incharge_mobile || ''
        ];
      });

      if (rows.length > 0) {
        schSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      output.success = true;
      output.message = schools.length + " विद्यालयों का मास्टर डेटा बैकअप सुरक्षित हुआ!";
    }

    // 6. Universal Audit Log
    else if (action === 'log_audit') {
      logAudit(ss, params.user || 'Unknown', params.action_name || 'Action', params.target || '', params.details || '');
      output.success = true;
      output.message = "ऑडिट लॉग सुरक्षित हुआ!";
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
function getOrCreateSheet(ss, sheetName, headers, clearExisting) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }
  } else if (clearExisting) {
    sheet.clearContents();
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#1e293b");
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
    ]);
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
