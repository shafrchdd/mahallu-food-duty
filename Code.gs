const SPREADSHEET_ID = '1oAfB8ocXOXprf11ww8mrBdi1ND2fBttigwAl13qLjWs';
const SHEET_NAME = 'AppData';
function doGet(e) {
  const key = String((e && e.parameter && e.parameter.key) || '');
  if (!authorized_(key)) return jsonp_(e, { ok: false, error: 'Access denied' });
  const callback = String((e && e.parameter && e.parameter.prefix) || '');
  if (!/^[$A-Z_a-z][$\\w]*$/.test(callback)) return json_({ ok: false, error: 'Invalid callback' });
  const result = readState_();
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e) {
  let result;
  try {
    const payload = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
    if (!authorized_(payload.key)) throw new Error('Access denied');
    result = writeState_(payload);
  } catch (err) {
    result = { ok: false, error: String(err && err.message || err) };
  }
  const safe = JSON.stringify(result).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>parent.postMessage({type:"mahallu-sheet-result",data:' +
    safe + '}, "*");</script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function authorized_(key) {
  const saved = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  return !!saved && String(key || '') === saved;
}
function jsonp_(e, value) {
  const callback = String((e && e.parameter && e.parameter.prefix) || '');
  if (!/^[$A-Z_a-z][$\\w]*$/.test(callback)) return json_(value);
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(value) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function readState_() {
  const sheet = getSheet_();
  const raw = sheet.getRange('A2').getValue();
  const version = Number(sheet.getRange('B2').getValue()) || 0;
  let state = null;
  if (raw) { try { state = JSON.parse(String(raw)); } catch (_) {} }
  return { ok: true, exists: !!state, state: state, version: version, updatedAt: sheet.getRange('C2').getDisplayValue() || '' };
}
function writeState_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();
    const currentVersion = Number(sheet.getRange('B2').getValue()) || 0;
    const expected = Number(payload.expectedVersion);
    if (expected !== currentVersion) return { ok: false, conflict: true, version: currentVersion, message: 'മറ്റൊരു ഫോണിൽ ഡാറ്റ മാറിയിട്ടുണ്ട്. ആദ്യം Sync ചെയ്യുക.' };
    if (!payload.state || !Array.isArray(payload.state.people) || !payload.state.days || !payload.state.rotation) throw new Error('Invalid app data');
    const nextVersion = currentVersion + 1;
    sheet.getRange('A2:C2').setValues([[JSON.stringify(payload.state), nextVersion, new Date()]]);
    return { ok: true, version: nextVersion, updatedAt: new Date().toISOString() };
  } finally { lock.releaseLock(); }
}
function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange('A1:C1').setValues([['state_json', 'version', 'updated_at']]);
    sheet.setFrozenRows(1); sheet.setColumnWidth(1, 500);
  }
  return sheet;
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}