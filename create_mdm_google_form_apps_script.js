/**
 * =========================================================================
 * राजस्थान सरकार - मिड डे मील योजनान्तर्गत निरीक्षण का विवरण (प्रपत्र-2)
 * CBEO भिनाय (अजमेर) - ऑटोमेटेड गूगल फॉर्म क्रिएटर एवं शीट लिंकर
 * =========================================================================
 */

// ब्लॉक भिनाय के सभी 25 PEEOs की मास्टर सूची
const BHINAI_PEEOS = [
  {"code": "221769", "name": "PEEO BANDANWARA"},
  {"code": "221764", "name": "PEEO BARGAON"},
  {"code": "221755", "name": "PEEO BARLI"},
  {"code": "221780", "name": "PEEO BHINAY"},
  {"code": "221763", "name": "PEEO BOOBKIYA"},
  {"code": "221758", "name": "PEEO CHAPANERI"},
  {"code": "221787", "name": "PEEO CHHACHHUNDRA"},
  {"code": "221754", "name": "PEEO DEOLIYA KALAN"},
  {"code": "488941", "name": "PEEO DEVPURA"},
  {"code": "221783", "name": "PEEO DHANTOL"},
  {"code": "221786", "name": "PEEO EKALSEENGA"},
  {"code": "221762", "name": "PEEO GURHA KHURD"},
  {"code": "221765", "name": "PEEO KANAI KALAN"},
  {"code": "221773", "name": "PEEO KARATI"},
  {"code": "221767", "name": "PEEO KEROT"},
  {"code": "221777", "name": "PEEO KUMHARIYA"},
  {"code": "221759", "name": "PEEO LAMGARA"},
  {"code": "221772", "name": "PEEO NAGOLA"},
  {"code": "221756", "name": "PEEO NANDSI"},
  {"code": "221766", "name": "PEEO PADALIYA"},
  {"code": "221788", "name": "PEEO PADANGA"},
  {"code": "221785", "name": "PEEO RAMMALIA"},
  {"code": "221775", "name": "PEEO RATAKOT"},
  {"code": "221781", "name": "PEEO SINGAWAL"},
  {"code": "221782", "name": "PEEO SOBRI"}
];

const FORM_ID = "1OjaB12HHdot3V60W6Tr_NeHi6fPmBu31dLY0Pxe3tsI";

/**
 * शीट खुलते ही मेन्यू बार में मेन्यू जोड़ें
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 MDM सघन निरीक्षण')
    .addItem('🔒 फॉर्म में संख्या (Number) रेस्ट्रिक्शन लगाएं', 'applyFormRestrictions')
    .addItem('🔄 प्रपत्र-2 समेकित रिपोर्ट रीफ्रेश करें', 'refreshConsolidatedReport')
    .addToUi();
}

/**
 * 🔒 लाइव Google Form में संख्या (Number Only) रेस्ट्रिक्शन लगाना
 * जिससे कोई भी शब्दों (Words) में उत्तर न लिख सके
 */
function applyFormRestrictions() {
  const form = FormApp.openById(FORM_ID);
  const items = form.getItems(FormApp.ItemType.TEXT);

  // 1. संख्या (Whole Number >= 0) सत्यापन
  const numberValidation = FormApp.createTextValidation()
    .requireWholeNumber()
    .setHelpText("⚠️ केवल संख्या (अंक) ही मान्य है। जैसे: 0, 1, 2, 3... (शब्दों में न लिखें)")
    .build();

  // 2. शाला दर्पण कोड (Whole number) सत्यापन
  const codeValidation = FormApp.createTextValidation()
    .requireWholeNumber()
    .setHelpText("⚠️ कृपया 6 अंकों का सही शाला दर्पण कोड (संख्या में) दर्ज करें।")
    .build();

  // 3. मोबाइल नंबर (Whole number) सत्यापन
  const mobileValidation = FormApp.createTextValidation()
    .requireWholeNumber()
    .setHelpText("⚠️ कृपया 10 अंकों का मोबाइल नंबर (संख्या में) दर्ज करें।")
    .build();

  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const textItem = items[i].asTextItem();
    const title = textItem.getTitle();

    if (title.indexOf("शाला दर्पण कोड") !== -1) {
      textItem.setValidation(codeValidation);
      count++;
    } else if (title.indexOf("मोबाइल नंबर") !== -1) {
      textItem.setValidation(mobileValidation);
      count++;
    } else if (
      title.indexOf("संख्या") !== -1 ||
      title.indexOf("दलों की संख्या") !== -1 ||
      title.indexOf("अधिकारियों की संख्या") !== -1 ||
      title.indexOf("विद्यालयों की कुल संख्या") !== -1 ||
      title.indexOf("सन्तोषप्रद") !== -1 ||
      title.indexOf("असन्तोषप्रद") !== -1
    ) {
      textItem.setValidation(numberValidation);
      count++;
    }
  }

  Logger.log("Applied number validation to " + count + " questions!");

  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      "सफलतापूर्वक रेस्ट्रिक्शन लागू!",
      "फॉर्म के सभी " + count + " संख्यात्मक प्रश्नों पर केवल संख्या (Number) का रेस्ट्रिक्शन लगा दिया गया है।\nअब कोई भी शब्दों (जैसे- 'एक', 'Nil', 'Zero') में उत्तर नहीं लिख सकेगा।",
      ui.ButtonSet.OK
    );
  } catch (e) {
    Logger.log("Done: " + e);
  }
}

/**
 * नया फॉर्म बनाने का मास्टर फंक्शन (नंबर वैलिडेशन सहित)
 */
function createAndLinkMDMForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const formTitle = "मिड डे मील योजनान्तर्गत निरीक्षण का विवरण (प्रपत्र-2) - ब्लॉक भिनाय";
  const form = FormApp.create(formTitle);
  
  form.setDescription(
    "कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)\n" +
    "मिड डे मील योजनान्तर्गत, क्रियान्वयन के सम्बन्ध में निरीक्षण का विवरण (प्रपत्र-2)\n\n" +
    "निर्देश: कृपया सभी PEEO साहिबान अपने अधीनस्थ विद्यालयों के सघन निरीक्षण की सूचना इस प्रपत्र में भरें।\n" +
    "ध्यान दें: संख्या वाले सभी कॉलम में केवल अंक (0, 1, 2, 3...) ही दर्ज करें।"
  );

  const numberValidation = FormApp.createTextValidation()
    .requireWholeNumber()
    .setHelpText("⚠️ केवल संख्या (अंक) ही दर्ज करें, जैसे: 0, 1, 2, 3...")
    .build();

  // प्रश्न 1: PEEO का चयन
  const peeoOptions = BHINAI_PEEOS.map(function(p) {
    return "[" + p.code + "] " + p.name;
  });
  
  const peeoItem = form.addListItem();
  peeoItem.setTitle("1. पीईईओ परिक्षेत्र का नाम एवं कोड (PEEO Name & Code)")
    .setChoiceValues(peeoOptions)
    .setRequired(true)
    .setHelpText("सूची में से अपने PEEO का चयन करें।");

  // प्रश्न 2: शाला दर्पण कोड
  const codeItem = form.addTextItem();
  codeItem.setTitle("2. पीईईओ शाला दर्पण कोड (PEEO Shala Darpan Code)")
    .setValidation(numberValidation)
    .setHelpText("6 अंकों का शाला दर्पण कोड दर्ज करें (जैसे- 221754)")
    .setRequired(true);

  // प्रश्न 3: निरीक्षण दिनांक
  const dateItem = form.addDateItem();
  dateItem.setTitle("3. निरीक्षण दिनांक (Inspection Date)")
    .setRequired(true);

  // प्रश्न 4: निरीक्षण दलों की संख्या
  const teamItem = form.addTextItem();
  teamItem.setTitle("4. निरीक्षण दलों की संख्या (प्रपत्र कॉलम 4)")
    .setValidation(numberValidation)
    .setRequired(true);

  // प्रश्न 5: निरीक्षण करने वाले अधिकारियों की संख्या
  const offItem = form.addTextItem();
  offItem.setTitle("5. निरीक्षण करने वाले अधिकारियों की संख्या (प्रपत्र कॉलम 5)")
    .setValidation(numberValidation)
    .setRequired(true);

  // प्रश्न 6: निरीक्षण दल द्वारा निरीक्षण किये गये विद्यालयों की कुल संख्या
  const totalSchItem = form.addTextItem();
  totalSchItem.setTitle("6. निरीक्षण दल द्वारा निरीक्षण किये गये विद्यालयों की कुल संख्या (प्रपत्र कॉलम 6)")
    .setValidation(numberValidation)
    .setRequired(true);

  // प्रश्न 7: कार्यक्रम क्रियान्वयन की स्थिति - सन्तोषप्रद विद्यालयों की संख्या
  const satItem = form.addTextItem();
  satItem.setTitle("7. निरीक्षण किए गये विद्यालयों में कार्यक्रम क्रियान्वयन की स्थिति - सन्तोषप्रद विद्यालयों की संख्या (प्रपत्र कॉलम 7)")
    .setValidation(numberValidation)
    .setRequired(true);

  // प्रश्न 8: कार्यक्रम क्रियान्वयन की स्थिति - असन्तोषप्रद विद्यालयों की संख्या
  const unsatItem = form.addTextItem();
  unsatItem.setTitle("8. निरीक्षण किए गये विद्यालयों में कार्यक्रम क्रियान्वयन की स्थिति - असन्तोषप्रद विद्यालयों की संख्या (प्रपत्र कॉलम 8)")
    .setValidation(numberValidation)
    .setRequired(true);

  // प्रश्न 9: असन्तोषप्रद होने के कारणों का स्पष्ट उल्लेख
  const reasonItem = form.addParagraphTextItem();
  reasonItem.setTitle("9. निरीक्षण किये गये विद्यालयों में कार्यक्रम क्रियान्वयन की स्थिति असन्तोषप्रद होने के कारणों का स्पष्ट उल्लेख (प्रपत्र कॉलम 9)")
    .setHelpText("यदि कोई असंतोषप्रद नहीं है तो 'निरंक' लिखें।")
    .setRequired(false);

  // प्रश्न 10: विशेष विवरण
  const remarksItem = form.addParagraphTextItem();
  remarksItem.setTitle("10. विशेष विवरण / की गई कार्यवाही का विवरण (प्रपत्र कॉलम 10)")
    .setHelpText("असंतोषप्रद होने पर की गई कार्यवाही का विवरण, अन्यथा 'निरंक'।")
    .setRequired(false);

  // प्रश्न 11: प्रविष्टि कर्ता
  const submitterItem = form.addTextItem();
  submitterItem.setTitle("11. सूचना भरने वाले अधिकारी / प्रभारी का नाम एवं पद")
    .setRequired(true);

  // प्रश्न 12: मोबाइल नंबर
  const mobItem = form.addTextItem();
  mobItem.setTitle("12. सम्पर्क मोबाइल नंबर (WhatsApp)")
    .setValidation(numberValidation)
    .setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const publishedUrl = form.getPublishedUrl();
  return publishedUrl;
}

function refreshConsolidatedReport() {
  SpreadsheetApp.flush();
  SpreadsheetApp.getActiveSpreadsheet().toast('समेकित रिपोर्ट रीफ्रेश हो गई है!', 'सफलता', 3);
}
