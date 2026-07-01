// ============================================
// Google Apps Script — Compounding Calculator Backend
// Paste this code in your Google Apps Script editor
// Deploy as Web App (Execute as: Me, Access: Anyone)
// ============================================

const SHEET_NAME_SETTINGS = 'settings';
const SHEET_NAME_RESULTS = 'daily_results';

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === SHEET_NAME_SETTINGS) {
      sheet.appendRow(['key', 'value']);
    } else if (name === SHEET_NAME_RESULTS) {
      sheet.appendRow(['date', 'actual_profit', 'checked']);
    }
  }
  return sheet;
}

// ---- SETTINGS ----
function getSettings() {
  const sheet = getOrCreateSheet(SHEET_NAME_SETTINGS);
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function saveSettings(payload) {
  const sheet = getOrCreateSheet(SHEET_NAME_SETTINGS);
  sheet.clear();
  sheet.appendRow(['key', 'value']);
  const keys = Object.keys(payload);
  for (const key of keys) {
    sheet.appendRow([key, payload[key]]);
  }
  return { success: true };
}

// ---- DAILY RESULTS ----
function getDailyResults() {
  const sheet = getOrCreateSheet(SHEET_NAME_RESULTS);
  const data = sheet.getDataRange().getValues();
  const results = {};
  for (let i = 1; i < data.length; i++) {
    results[data[i][0]] = {
      actual: Number(data[i][1]),
      checked: data[i][2] === true || data[i][2] === 'TRUE'
    };
  }
  return results;
}

function saveDailyResult(dateStr, actualProfit, checked) {
  const sheet = getOrCreateSheet(SHEET_NAME_RESULTS);
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === dateStr) {
      sheet.getRange(i + 1, 2).setValue(actualProfit);
      sheet.getRange(i + 1, 3).setValue(checked);
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow([dateStr, actualProfit, checked]);
  }
  return { success: true };
}

// ---- WEB APP HANDLERS ----
function doGet(e) {
  const action = e.parameter.action;
  let result = {};

  if (action === 'getSettings') {
    result = getSettings();
  } else if (action === 'getDailyResults') {
    result = getDailyResults();
  } else {
    result = { error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;
  let result = {};

  if (action === 'saveSettings') {
    result = saveSettings(payload.data);
  } else if (action === 'saveDailyResult') {
    result = saveDailyResult(payload.date, payload.actual, payload.checked);
  } else {
    result = { error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
