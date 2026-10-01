/**
 * Google Apps Script for CBEO Bhinai - Saman Pariksha 2026-27 (56 Schools)
 * ------------------------------------------------------------------------
 * यह स्क्रिप्ट अपनी Google Sheet में पेस्ट करें:
 * 1. अपनी Google Sheet "5_CBEO_Saman_Pariksha_56_Schools_Data" खोलें:
 *    https://docs.google.com/spreadsheets/d/1tVP7gbIuUP576E2a1Qk6TadXUSP7a5c7ah8HzKeTk4k/edit
 * 2. ऊपर मेनू में जाएं: Extensions (एक्सटेंशन) -> Apps Script
 * 3. वहाँ पहले से मौजूद कोड को मिटाकर यह पूरा कोड पेस्ट करें।
 * 4. ऊपर "Deploy" (तैनात करें) बटन दबाएं -> "New deployment" (नई तैनाती)
 * 5. Type (प्रकार): "Web app" (वेब ऐप) चुनें।
 *    - Description: "Saman Pariksha Live Sync"
 *    - Execute as: "Me" (मेरा खाता)
 *    - Who has access (किसके पास पहुंच है): "Anyone" (कोई भी) <-- यह बहुत ज़रूरी है!
 * 6. "Deploy" दबाएं और जो Web App URL मिले, उसे कॉपी कर लें।
 */

const OPTIONAL_KEYS = [
  "pol_sci", "history", "geography", "hindi_lit", "eng_lit", "sanskrit_lit",
  "urdu_lit", "economics", "sociology", "home_sci", "drawing", "physics",
  "chemistry", "biology", "maths", "comp_sci", "accountancy", "business_studies",
  "economics_comm", "agri_sci", "agri_bio", "agri_chem"
];

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

    // Col D is index 3 (शाला दर्पण कोड)
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

    // Build row values matching Col F to Col BT (indices 5 to 71, length = 67 columns)
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

    // Write starting from Column F (col index 6)
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
  return ContentService.createTextOutput(JSON.stringify({ status: "active", service: "CBEO Bhinai Saman Pariksha Live Sync Webhook" }))
    .setMimeType(ContentService.MimeType.JSON);
}
