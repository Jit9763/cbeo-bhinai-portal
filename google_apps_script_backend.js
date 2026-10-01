/**
 * CBEO Bhinai - Saman Pariksha Live Sync Backend
 * Target Sheet ID: 1tVP7gbIuUP576E2a1Qk6TadXUSP7a5c7ah8HzKeTk4k
 * Supports:
 * 1. doPost(e) - Saves or updates any school's form submission into Google Sheet
 * 2. doGet(e) - Reads and returns submission(s) directly from Google Sheet:
 *    - ?action=get&school_code=P55700 -> Returns data for that school
 *    - ?action=getAll -> Returns all submitted schools data
 */

const OPTIONAL_KEYS = [
  "pol_sci", "history", "geography", "hindi_lit", "eng_lit", "sanskrit_lit",
  "urdu_lit", "economics", "sociology", "home_sci", "drawing", "physics",
  "chemistry", "biology", "maths", "comp_sci", "accountancy", "business_studies",
  "economics_comm", "agri_sci", "agri_bio", "agri_chem"
];

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

function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    if (!data || !data.school_code) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "school_code missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Sheet1") || ss.getActiveSheet();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // Col D is index 3 (शाला दर्पण / PSP कोड)
    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][3]).trim() === String(data.school_code).trim()) {
        targetRow = i + 1; // 1-based row index
        break;
      }
    }

    if (targetRow === -1) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "School code not found in sheet" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const c11FacStr = Array.isArray(data.c11_faculties) ? data.c11_faculties.join(', ') : (data.c11_faculties || '');
    const c12FacStr = Array.isArray(data.c12_faculties) ? data.c12_faculties.join(', ') : (data.c12_faculties || '');
    const c11Opt = data.c11_optional || {};
    const c12Opt = data.c12_optional || {};

    // Build row values matching Col F to Col BT (Columns 6 to 72)
    const rowUpdates = [
      data.exam_code || '',
      data.principal_name || '',
      data.principal_mobile || '',
      data.incharge_name || '',
      data.incharge_mobile || '',
      
      // Class 9 (K, L, M)
      Number(data.c9_total) || 0,
      Number(data.c9_sanskrit) || 0,
      Number(data.c9_urdu) || 0,
      
      // Class 10 (N, O, P)
      Number(data.c10_total) || 0,
      Number(data.c10_sanskrit) || 0,
      Number(data.c10_urdu) || 0,
      
      // Class 11 Compulsory & Faculties (Q, R, S)
      c11FacStr,
      Number(data.c11_comp_hindi) || 0,
      Number(data.c11_comp_english) || 0
    ];

    // Class 11 Optionals (T to AO - 22 cols)
    OPTIONAL_KEYS.forEach(k => {
      rowUpdates.push(Number(c11Opt[k]) || 0);
    });
    // Class 11 Total (AP)
    rowUpdates.push(Number(data.c11_total) || 0);

    // Class 12 Compulsory & Faculties (AQ, AR, AS)
    rowUpdates.push(
      c12FacStr,
      Number(data.c12_comp_hindi) || 0,
      Number(data.c12_comp_english) || 0
    );

    // Class 12 Optionals (AT to BO - 22 cols)
    OPTIONAL_KEYS.forEach(k => {
      rowUpdates.push(Number(c12Opt[k]) || 0);
    });
    // Class 12 Total (BP)
    rowUpdates.push(Number(data.c12_total) || 0);

    // Grand Total & Meta (BQ, BR, BS, BT)
    rowUpdates.push(
      Number(data.grand_total) || 0,
      "पूर्ण (Submitted)",
      data.submitted_by || data.principal_name || '',
      data.timestamp || new Date().toLocaleString('hi-IN')
    );

    // Write starting from Column F (Col index 6) to Column BT
    sheet.getRange(targetRow, 6, 1, rowUpdates.length).setValues([rowUpdates]);

    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: `विद्यालय ${data.school_name || data.school_code} का डेटा गूगल शीट में पंक्ति ${targetRow} पर सफलतापूर्वक अपडेट हो गया!` 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || '';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1") || ss.getActiveSheet();
    var values = sheet.getDataRange().getValues();

    // 1. Get ALL submissions from Google Sheet
    if (action === 'getAll') {
      var allData = {};
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        var code = String(row[3] || '').trim();
        var st = String(row[69] || '').trim();
        if (code && (st.indexOf('Submitted') !== -1 || st.indexOf('पूर्ण') !== -1)) {
          allData[code] = rowToSubmission(row);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        count: Object.keys(allData).length, 
        submissions: allData 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Get Single School submission by school_code
    if (action === 'get' && params.school_code) {
      var targetCode = String(params.school_code).trim();
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
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

    // Default Health Check response
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "active", 
      service: "CBEO Bhinai Saman Pariksha Live Sync Webhook",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
