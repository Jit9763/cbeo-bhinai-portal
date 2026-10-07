/**
 * =========================================================================
 * CBEO Bhinai Portal - Master Node.js & SQLite Universal Dynamic Server
 * कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
 * 
 * Multi-Tier Resilient Architecture:
 * Tier 1: Local / VM SQLite Database (cbeo_data.sqlite)
 * Tier 2: Google Apps Script Web App (Live Cloud Sync to Google Sheets)
 * Tier 3: Local JSON Snapshots & Cached State
 * =========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec, spawn } = require('child_process');

const PORT = process.env.PORT || 8089;
const ROOT_DIR = __dirname;
const SQLITE_FILE = path.join(ROOT_DIR, 'cbeo_data.sqlite');
const GAS_URL = 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

// -------------------------------------------------------------------------
// 1. SQLite Database Layer (Built-in node:sqlite with JSON Fallback)
// -------------------------------------------------------------------------
let db = null;
let sqliteAvailable = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(SQLITE_FILE);
  sqliteAvailable = true;
  console.log(`[CBEO-NODE] ✓ Native SQLite engine active: ${SQLITE_FILE}`);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saman_submissions (
      school_code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saman_syllabus_submissions (
      school_code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_users (
      user_id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      role TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      user_name TEXT,
      action TEXT,
      details TEXT
    );
  `);

  // Auto-seed default settings into SQLite if empty
  try {
    const tabFile6 = path.join(ROOT_DIR, 'tab_visibility_6level.json');
    if (fs.existsSync(tabFile6)) {
      const data = fs.readFileSync(tabFile6, 'utf8');
      db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('__TAB_VISIBILITY_6LEVEL__', data, new Date().toISOString());
    }
    const tabFile = path.join(ROOT_DIR, 'tab_visibility_5level.json');
    if (fs.existsSync(tabFile)) {
      const data = fs.readFileSync(tabFile, 'utf8');
      db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('__TAB_VISIBILITY_5LEVEL__', data, new Date().toISOString());
    }
    const permsFile6 = path.join(ROOT_DIR, 'edit_permissions_6level.json');
    if (fs.existsSync(permsFile6)) {
      const data = fs.readFileSync(permsFile6, 'utf8');
      db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('__EDIT_PERMISSIONS_6LEVEL__', data, new Date().toISOString());
    }
    const permsFile = path.join(ROOT_DIR, 'staff_edit_permissions.json');
    if (fs.existsSync(permsFile)) {
      const data = fs.readFileSync(permsFile, 'utf8');
      db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('__STAFF_EDIT_PERMISSIONS__', data, new Date().toISOString());
    }
    const vmFile = path.join(ROOT_DIR, 'cbeo_vm_settings.json');
    if (fs.existsSync(vmFile)) {
      const data = fs.readFileSync(vmFile, 'utf8');
      db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('__PORTAL_SETTINGS__', data, new Date().toISOString());
    }
    const mismatchFile = path.join(ROOT_DIR, 'saman_mismatch_settings.json');
    if (fs.existsSync(mismatchFile)) {
      const data = fs.readFileSync(mismatchFile, 'utf8');
      db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('__SAMAN_MISMATCH_SETTINGS__', data, new Date().toISOString());
    }
    const subsFile = path.join(ROOT_DIR, 'saman_pariksha_submissions.json');
    if (fs.existsSync(subsFile)) {
      const subs = JSON.parse(fs.readFileSync(subsFile, 'utf8'));
      const insStmt = db.prepare('INSERT OR IGNORE INTO saman_submissions (school_code, data, updated_at) VALUES (?, ?, ?)');
      Object.entries(subs).forEach(([code, payload]) => {
        insStmt.run(String(code), JSON.stringify(payload), new Date().toISOString());
      });
    }
    const sylFile = path.join(ROOT_DIR, 'saman_syllabus_submissions.json');
    if (fs.existsSync(sylFile)) {
      const sylSubs = JSON.parse(fs.readFileSync(sylFile, 'utf8'));
      const insSylStmt = db.prepare('INSERT OR IGNORE INTO saman_syllabus_submissions (school_code, data, updated_at) VALUES (?, ?, ?)');
      Object.entries(sylSubs).forEach(([code, payload]) => {
        insSylStmt.run(String(code), JSON.stringify(payload), new Date().toISOString());
      });
    }
    console.log('[CBEO-NODE] ✓ Initial SQLite database seeded from master records.');
  } catch (seedErr) {
    console.warn('[CBEO-NODE] Seed note:', seedErr.message);
  }
} catch (e) {
  console.warn('[CBEO-NODE] Native node:sqlite not loaded, using persistent JSON engine:', e.message);
  sqliteAvailable = false;
}

// Helper methods for DB operations
const DB = {
  getSetting(key) {
    if (sqliteAvailable && db) {
      try {
        const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get(key);
        if (row && row.value) return JSON.parse(row.value);
      } catch (err) {
        console.warn('DB getSetting error:', err);
      }
    }
    // Fallback: check json files
    if (key === '__TAB_VISIBILITY_6LEVEL__' && fs.existsSync(path.join(ROOT_DIR, 'tab_visibility_6level.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'tab_visibility_6level.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__EDIT_PERMISSIONS_6LEVEL__' && fs.existsSync(path.join(ROOT_DIR, 'edit_permissions_6level.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'edit_permissions_6level.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__CBEO_DEMANDS__' && fs.existsSync(path.join(ROOT_DIR, 'cbeo_demands.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'cbeo_demands.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__CBEO_DEMAND_SUBMISSIONS__' && fs.existsSync(path.join(ROOT_DIR, 'cbeo_demand_submissions.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'cbeo_demand_submissions.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__SAMAN_SYLLABUS_SUBMISSIONS__' && fs.existsSync(path.join(ROOT_DIR, 'saman_syllabus_submissions.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'saman_syllabus_submissions.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__TAB_VISIBILITY_5LEVEL__' && fs.existsSync(path.join(ROOT_DIR, 'tab_visibility_5level.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'tab_visibility_5level.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__STAFF_EDIT_PERMISSIONS__' && fs.existsSync(path.join(ROOT_DIR, 'staff_edit_permissions.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'staff_edit_permissions.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__SAMAN_MISMATCH_SETTINGS__' && fs.existsSync(path.join(ROOT_DIR, 'saman_mismatch_settings.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'saman_mismatch_settings.json'), 'utf8')); } catch(e) {}
    }
    if (key === '__PORTAL_SETTINGS__' && fs.existsSync(path.join(ROOT_DIR, 'cbeo_vm_settings.json'))) {
      try { return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'cbeo_vm_settings.json'), 'utf8')); } catch(e) {}
    }
    return null;
  },

  setSetting(key, val) {
    const jsonStr = JSON.stringify(val);
    const now = new Date().toISOString();
    if (sqliteAvailable && db) {
      try {
        const stmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
        stmt.run(key, jsonStr, now);
      } catch (err) {
        console.warn('DB setSetting error:', err);
      }
    }
    // Also sync to corresponding json file for compatibility
    try {
      if (key === '__TAB_VISIBILITY_6LEVEL__') fs.writeFileSync(path.join(ROOT_DIR, 'tab_visibility_6level.json'), jsonStr, 'utf8');
      if (key === '__EDIT_PERMISSIONS_6LEVEL__') fs.writeFileSync(path.join(ROOT_DIR, 'edit_permissions_6level.json'), jsonStr, 'utf8');
      if (key === '__CBEO_DEMANDS__') fs.writeFileSync(path.join(ROOT_DIR, 'cbeo_demands.json'), jsonStr, 'utf8');
      if (key === '__CBEO_DEMAND_SUBMISSIONS__') fs.writeFileSync(path.join(ROOT_DIR, 'cbeo_demand_submissions.json'), jsonStr, 'utf8');
      if (key === '__SAMAN_SYLLABUS_SUBMISSIONS__') fs.writeFileSync(path.join(ROOT_DIR, 'saman_syllabus_submissions.json'), jsonStr, 'utf8');
      if (key === '__TAB_VISIBILITY_5LEVEL__') fs.writeFileSync(path.join(ROOT_DIR, 'tab_visibility_5level.json'), jsonStr, 'utf8');
      if (key === '__STAFF_EDIT_PERMISSIONS__') fs.writeFileSync(path.join(ROOT_DIR, 'staff_edit_permissions.json'), jsonStr, 'utf8');
      if (key === '__SAMAN_MISMATCH_SETTINGS__') fs.writeFileSync(path.join(ROOT_DIR, 'saman_mismatch_settings.json'), jsonStr, 'utf8');
      if (key === '__PORTAL_SETTINGS__') {
        const existing = fs.existsSync(path.join(ROOT_DIR, 'cbeo_vm_settings.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'cbeo_vm_settings.json'), 'utf8')) : {};
        Object.assign(existing, val);
        fs.writeFileSync(path.join(ROOT_DIR, 'cbeo_vm_settings.json'), JSON.stringify(existing, null, 2), 'utf8');
      }
    } catch(e) {}
  },

  getAllSubmissions() {
    const result = {};
    if (sqliteAvailable && db) {
      try {
        const rows = db.prepare('SELECT school_code, data FROM saman_submissions').all();
        rows.forEach(r => {
          try { result[r.school_code] = JSON.parse(r.data); } catch(e) {}
        });
      } catch (err) {
        console.warn('DB getAllSubmissions error:', err);
      }
    }
    // Merge from JSON file
    const subFile = path.join(ROOT_DIR, 'saman_pariksha_submissions.json');
    if (fs.existsSync(subFile)) {
      try {
        const fileSubs = JSON.parse(fs.readFileSync(subFile, 'utf8'));
        Object.assign(result, fileSubs);
      } catch(e) {}
    }
    return result;
  },

  saveSubmission(schoolCode, data) {
    const jsonStr = JSON.stringify(data);
    const now = new Date().toISOString();
    if (sqliteAvailable && db) {
      try {
        const stmt = db.prepare('INSERT INTO saman_submissions (school_code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(school_code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
        stmt.run(String(schoolCode), jsonStr, now);
      } catch (err) {
        console.warn('DB saveSubmission error:', err);
      }
    }
    // Update local JSON file
    const subFile = path.join(ROOT_DIR, 'saman_pariksha_submissions.json');
    try {
      let cur = {};
      if (fs.existsSync(subFile)) {
        cur = JSON.parse(fs.readFileSync(subFile, 'utf8'));
      }
      cur[String(schoolCode)] = data;
      fs.writeFileSync(subFile, JSON.stringify(cur, null, 2), 'utf8');
    } catch(e) {}
  },

  getAllSyllabusSubmissions() {
    const result = {};
    if (sqliteAvailable && db) {
      try {
        const rows = db.prepare('SELECT school_code, data FROM saman_syllabus_submissions').all();
        rows.forEach(r => {
          try { result[r.school_code] = JSON.parse(r.data); } catch(e) {}
        });
      } catch (err) {
        console.warn('DB getAllSyllabusSubmissions error:', err);
      }
    }
    // Merge from JSON file
    const sylFile = path.join(ROOT_DIR, 'saman_syllabus_submissions.json');
    if (fs.existsSync(sylFile)) {
      try {
        const fileSubs = JSON.parse(fs.readFileSync(sylFile, 'utf8'));
        Object.assign(result, fileSubs);
      } catch(e) {}
    }
    return result;
  },

  saveSyllabusSubmission(schoolCode, data) {
    const jsonStr = JSON.stringify(data);
    const now = new Date().toISOString();
    if (sqliteAvailable && db) {
      try {
        const stmt = db.prepare('INSERT INTO saman_syllabus_submissions (school_code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(school_code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
        stmt.run(String(schoolCode), jsonStr, now);
      } catch (err) {
        console.warn('DB saveSyllabusSubmission error:', err);
      }
    }
    // Update local JSON file
    const sylFile = path.join(ROOT_DIR, 'saman_syllabus_submissions.json');
    try {
      let cur = {};
      if (fs.existsSync(sylFile)) {
        cur = JSON.parse(fs.readFileSync(sylFile, 'utf8'));
      }
      cur[String(schoolCode)] = data;
      fs.writeFileSync(sylFile, JSON.stringify(cur, null, 2), 'utf8');

      // Also sync to master_cbeo_data.json
      const masterFile = path.join(ROOT_DIR, 'master_cbeo_data.json');
      if (fs.existsSync(masterFile)) {
        const mData = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
        mData.saman_syllabus_submissions = cur;
        fs.writeFileSync(masterFile, JSON.stringify(mData, null, 2), 'utf8');
        fs.writeFileSync(path.join(ROOT_DIR, 'master_cbeo_data.js'), 'const MASTER_CBEO_DATA = ' + JSON.stringify(mData, null, 2) + ';\n', 'utf8');
      }
    } catch(e) {}
  }
};

// Asynchronously forward to Google Apps Script Web App without blocking local response
function forwardToGoogleSheet(payload) {
  if (!GAS_URL) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).then(() => clearTimeout(timeoutId))
    .catch(err => {
      clearTimeout(timeoutId);
      console.warn('[CBEO-NODE] Google Sheet background sync note (offline/delayed):', err.message);
    });
}

// Background Cloud Sync Engine (Periodically synchronizes from Google Apps Script)
let isSyncingCloud = false;
async function syncFromGoogleAppsScript() {
  if (isSyncingCloud) return;
  isSyncingCloud = true;
  let newlySyncedCount = 0;
  try {
    const url = `${GAS_URL}?action=getDemandSubmissions&demand_id=DEMAND_SAMAN_SYLLABUS_2026&_t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.success && data.submissions) {
        const existing = DB.getAllSyllabusSubmissions();
        Object.keys(data.submissions).forEach(code => {
          let s = data.submissions[code];
          if (typeof s === 'string') {
            try { s = JSON.parse(s); } catch(e) {}
          }
          if (s && s.data_json) {
            try {
              const dj = typeof s.data_json === 'string' ? JSON.parse(s.data_json) : s.data_json;
              s = Object.assign({}, s, dj);
            } catch(e) {}
          }
          if (s) {
            s.is_submitted = true;
            existing[code] = Object.assign({}, existing[code] || {}, s);
            DB.saveSyllabusSubmission(code, existing[code]);
            newlySyncedCount++;
          }
        });
        console.log(`[CBEO-NODE] ✓ Cloud Sync: ${Object.keys(existing).length} syllabus submissions active in SQLite.`);
      }
    }
  } catch (err) {
    // Cloud timeout or offline note
  } finally {
    isSyncingCloud = false;
  }
  return newlySyncedCount;
}

// Auto-sync every 20 seconds, plus initial sync after startup
setInterval(syncFromGoogleAppsScript, 20000);
setTimeout(syncFromGoogleAppsScript, 1000);

// -------------------------------------------------------------------------
// 2. MIME Types & Static File Handler
// -------------------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------------------
// 3. HTTP Request Listener & Router
// -------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Read POST JSON helper
  function readBody(callback) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        callback(parsed);
      } catch (err) {
        callback(null, err);
      }
    });
  }

  // -----------------------------------------------------------------------
  // API Routes
  // -----------------------------------------------------------------------
  if (pathname === '/api/health') {
    sendJSON(res, 200, {
      status: 'ok',
      engine: 'CBEO Node.js + SQLite Universal Engine',
      sqlite_active: sqliteAvailable,
      district: 'अजमेर (AJMER)',
      block: 'भिनाय (BHINAI)',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (pathname === '/api/get_tab_visibility_6level') {
    let vis = DB.getSetting('__TAB_VISIBILITY_6LEVEL__');
    if (!vis) vis = DB.getSetting('__TAB_VISIBILITY_5LEVEL__');
    sendJSON(res, 200, { success: true, visibility: vis });
    return;
  }

  if (pathname === '/api/save_tab_visibility_6level' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const vis = data.visibility || data;
      DB.setSetting('__TAB_VISIBILITY_6LEVEL__', vis);
      DB.setSetting('__TAB_VISIBILITY_5LEVEL__', vis); // backward compat
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__TAB_VISIBILITY_6LEVEL__',
        new_password: JSON.stringify(vis)
      });
      sendJSON(res, 200, { success: true, message: '6-स्तरीय दृश्यता अनुमतियां SQLite व क्लाउड में सुरक्षित हो गईं!' });
    });
    return;
  }

  if (pathname === '/api/get_edit_permissions_6level') {
    const perms = DB.getSetting('__EDIT_PERMISSIONS_6LEVEL__') || DB.getSetting('__STAFF_EDIT_PERMISSIONS__');
    sendJSON(res, 200, { success: true, permissions: perms });
    return;
  }

  if (pathname === '/api/save_edit_permissions_6level' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const perms = data.permissions || data;
      DB.setSetting('__EDIT_PERMISSIONS_6LEVEL__', perms);
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__EDIT_PERMISSIONS_6LEVEL__',
        new_password: JSON.stringify(perms)
      });
      sendJSON(res, 200, { success: true, message: '6-स्तरीय संपादन अनुमतियां सुरक्षित हो गईं!' });
    });
    return;
  }

  if (pathname === '/api/get_saman_mismatch_settings') {
    const settings = DB.getSetting('__SAMAN_MISMATCH_SETTINGS__');
    sendJSON(res, 200, { success: true, settings: settings });
    return;
  }

  if (pathname === '/api/save_saman_mismatch_settings' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const settings = data.settings || data;
      DB.setSetting('__SAMAN_MISMATCH_SETTINGS__', settings);
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__SAMAN_MISMATCH_SETTINGS__',
        new_password: JSON.stringify(settings)
      });
      sendJSON(res, 200, { success: true, message: 'समान परीक्षा मिसमैच व कस्टम एडिट सेटिंग्स सुरक्षित हो गईं!' });
    });
    return;
  }

  if (pathname === '/api/send_mismatch_alert' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const scriptPath = path.join(ROOT_DIR, 'scripts', 'send_mismatch_alert_service.py');
      const child = spawn('python', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdoutData = '';
      let stderrData = '';
      child.stdout.on('data', chunk => { stdoutData += chunk.toString('utf8'); });
      child.stderr.on('data', chunk => { stderrData += chunk.toString('utf8'); });
      child.on('close', code => {
        try {
          const result = JSON.parse(stdoutData.trim());
          sendJSON(res, 200, result);
        } catch (e) {
          sendJSON(res, 200, {
            success: code === 0,
            stdout: stdoutData,
            stderr: stderrData,
            error: code !== 0 ? stderrData : 'Response parse error'
          });
        }
      });
      child.stdin.write(JSON.stringify(data));
      child.stdin.end();
    });
    return;
  }

  if (pathname === '/api/broadcast_demand_email' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const scriptPath = path.join(ROOT_DIR, 'broadcast_email_service.py');
      const child = spawn('python', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdoutData = '';
      let stderrData = '';
      child.stdout.on('data', chunk => { stdoutData += chunk.toString('utf8'); });
      child.stderr.on('data', chunk => { stderrData += chunk.toString('utf8'); });
      child.on('close', code => {
        try {
          const result = JSON.parse(stdoutData.trim());
          sendJSON(res, 200, result);
        } catch (e) {
          sendJSON(res, 200, {
            success: code === 0,
            stdout: stdoutData,
            stderr: stderrData,
            error: code !== 0 ? stderrData : 'Response parse error'
          });
        }
      });
      child.stdin.write(JSON.stringify(data));
      child.stdin.end();
    });
    return;
  }

  if (pathname === '/api/send_demand_telegram' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      let cfg = {};
      try {
        cfg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'cbeo_telegram_config.json'), 'utf8'));
      } catch (e) {}
      const token = cfg.bot_token || '8815110844:AAFsMJHFepKpk83Wtm-JGqn8REV8XUQLgGY';
      const chatId = data.chat_id || cfg.authorized_chat_id || '579780800';
      const postData = JSON.stringify({
        chat_id: chatId,
        text: data.text || '',
        parse_mode: data.parse_mode || 'HTML',
        disable_web_page_preview: false
      });

      const https = require('https');
      const reqTg = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (resTg) => {
        let respData = '';
        resTg.on('data', d => { respData += d; });
        resTg.on('end', () => {
          try {
            const parsed = JSON.parse(respData);
            sendJSON(res, 200, { success: parsed.ok, message_id: parsed.result && parsed.result.message_id, result: parsed.result });
          } catch(e) {
            sendJSON(res, 200, { success: false, raw: respData });
          }
        });
      });
      reqTg.on('error', (e) => {
        sendJSON(res, 500, { success: false, error: e.message });
      });
      reqTg.write(postData);
      reqTg.end();
    });
    return;
  }

  if (pathname === '/api/get_demands') {
    const demands = DB.getSetting('__CBEO_DEMANDS__') || [];
    sendJSON(res, 200, { success: true, demands: demands });
    return;
  }

  if (pathname === '/api/save_demands' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const demands = data.demands || data;
      DB.setSetting('__CBEO_DEMANDS__', demands);
      sendJSON(res, 200, { success: true, message: 'मांग प्रपत्र सुरक्षित हो गए!' });
    });
    return;
  }

  if (pathname === '/api/get_demand_submissions') {
    const subs = DB.getSetting('__CBEO_DEMAND_SUBMISSIONS__') || {};
    sendJSON(res, 200, { success: true, submissions: subs });
    return;
  }

  if (pathname === '/api/save_demand_submissions' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const subs = data.submissions || data;
      DB.setSetting('__CBEO_DEMAND_SUBMISSIONS__', subs);
      sendJSON(res, 200, { success: true, message: 'मांग सबमिशन सुरक्षित हो गए!' });
    });
    return;
  }

  if (pathname === '/api/sync_cloud_now') {
    syncFromGoogleAppsScript().then(synced => {
      const allSyl = DB.getAllSyllabusSubmissions();
      sendJSON(res, 200, {
        success: true,
        message: 'Google Sheet से लाइव डेटा सफलतापूर्वक सिंक हुआ!',
        count: Object.keys(allSyl).length,
        submissions: allSyl
      });
    }).catch(err => {
      sendJSON(res, 200, {
        success: false,
        message: 'Cloud sync note: ' + err.message,
        count: Object.keys(DB.getAllSyllabusSubmissions()).length,
        submissions: DB.getAllSyllabusSubmissions()
      });
    });
    return;
  }

  if (pathname === '/api/get_saman_syllabus') {
    const subs = DB.getAllSyllabusSubmissions();
    sendJSON(res, 200, { success: true, count: Object.keys(subs).length, submissions: subs });
    return;
  }

  if (pathname === '/api/save_saman_syllabus' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      if (data.clear) {
        if (sqliteAvailable && db) {
          try { db.exec('DELETE FROM saman_syllabus_submissions'); } catch(e) {}
        }
        DB.setSetting('__SAMAN_SYLLABUS_SUBMISSIONS__', {});
        return sendJSON(res, 200, { success: true, message: 'समान परीक्षा पाठ्यक्रम पूर्णता डेटा रिक्त (Clean) कर दिया गया!' });
      }
      const schoolCode = String(data.school_code || data.shala_darpan_code || '').trim();
      const payload = data.data || data.submission || data;
      payload.is_submitted = true;
      if (schoolCode) {
        DB.saveSyllabusSubmission(schoolCode, payload);
      } else if (data.submissions) {
        Object.entries(data.submissions).forEach(([sc, p]) => {
          DB.saveSyllabusSubmission(sc, p);
        });
      }

      // Asynchronously forward to Google Sheet without blocking local response
      forwardToGoogleSheet({
        action: 'saveDemandSubmission',
        demand_id: 'DEMAND_SAMAN_SYLLABUS_2026',
        school_code: schoolCode,
        school_name: payload.school_name || '',
        peeo_name: payload.peeo_name || '',
        peeo_code: payload.peeo_code || '',
        submitted_by: payload.submitted_by || payload.principal_name || 'संस्था प्रधान',
        submitter_mobile: payload.submitter_mobile || payload.principal_mobile || '',
        data_json: JSON.stringify(payload)
      });

      const updatedAll = DB.getAllSyllabusSubmissions();
      sendJSON(res, 200, { success: true, count: Object.keys(updatedAll).length, message: 'समान परीक्षा पाठ्यक्रम पूर्णता डेटा सुरक्षित हो गया!' });
    });
    return;
  }

  if (pathname === '/api/get_tab_visibility_5level') {
    const vis = DB.getSetting('__TAB_VISIBILITY_6LEVEL__') || DB.getSetting('__TAB_VISIBILITY_5LEVEL__');
    sendJSON(res, 200, { success: true, visibility: vis });
    return;
  }

  if (pathname === '/api/save_tab_visibility_5level' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const vis = data.visibility || data;
      DB.setSetting('__TAB_VISIBILITY_5LEVEL__', vis);
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__TAB_VISIBILITY_5LEVEL__',
        new_password: JSON.stringify(vis)
      });
      sendJSON(res, 200, { success: true, message: 'सेटिंग्स SQLite व क्लाउड में सुरक्षित हो गई!' });
    });
    return;
  }

  if (pathname === '/api/get_staff_permissions') {
    const perms = DB.getSetting('__STAFF_EDIT_PERMISSIONS__');
    sendJSON(res, 200, { success: true, permissions: perms });
    return;
  }

  if (pathname === '/api/save_staff_permissions' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const perms = data.permissions || data;
      DB.setSetting('__STAFF_EDIT_PERMISSIONS__', perms);
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__STAFF_EDIT_PERMISSIONS__',
        new_password: JSON.stringify(perms)
      });
      sendJSON(res, 200, { success: true, message: 'कार्मिक संपादन अनुमतियां सुरक्षित हो गई!' });
    });
    return;
  }

  if (pathname === '/api/get_portal_settings') {
    const ps = DB.getSetting('__PORTAL_SETTINGS__');
    sendJSON(res, 200, { success: true, settings: ps });
    return;
  }

  if (pathname === '/api/save_portal_settings' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const ps = data.settings || data;
      DB.setSetting('__PORTAL_SETTINGS__', ps);
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__PORTAL_SETTINGS__',
        new_password: JSON.stringify(ps)
      });
      sendJSON(res, 200, { success: true, message: 'पोर्टल सेटिंग्स सुरक्षित हो गई!' });
    });
    return;
  }

  if (pathname === '/api/get_saman_mismatch_settings') {
    const settings = DB.getSetting('__SAMAN_MISMATCH_SETTINGS__');
    sendJSON(res, 200, { success: true, settings: settings });
    return;
  }

  if (pathname === '/api/save_saman_mismatch_settings' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const settings = data.settings || data;
      DB.setSetting('__SAMAN_MISMATCH_SETTINGS__', settings);
      forwardToGoogleSheet({
        action: 'updatePassword',
        user_id: '__SAMAN_MISMATCH_SETTINGS__',
        new_password: JSON.stringify(settings)
      });
      sendJSON(res, 200, { success: true, message: 'समान परीक्षा मिसमैच सेटिंग्स सुरक्षित हो गई!' });
    });
    return;
  }


  if (pathname === '/api/get_saman_pariksha') {
    const subs = DB.getAllSubmissions();
    sendJSON(res, 200, { success: true, submissions: subs });
    return;
  }

  if (pathname === '/api/save_saman_pariksha' && req.method === 'POST') {
    readBody((data, err) => {
      if (err || !data) return sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      const code = data.school_code || data.shala_darpan_code;
      if (!code) return sendJSON(res, 400, { success: false, error: 'School code required' });

      DB.saveSubmission(code, data);
      forwardToGoogleSheet(data);
      sendJSON(res, 200, { success: true, synced_to_sqlite: true, message: 'प्रपत्र डेटा सुरक्षित हो गया!' });
    });
    return;
  }

  if (pathname === '/api/trigger_vm_report' && req.method === 'POST') {
    const scriptPath = path.join(ROOT_DIR, 'scripts', 'cbeo_vm_notifier.py');
    exec(`python "${scriptPath}" --force`, (error, stdout, stderr) => {
      if (error) {
        console.warn('VM report execution note:', stderr || error.message);
        sendJSON(res, 200, { success: false, error: error.message, output: stdout });
      } else {
        sendJSON(res, 200, { success: true, message: 'VM रिपोर्ट इंजन सफलतापूर्वक निष्पादित!', output: stdout });
      }
    });
    return;
  }

  // -----------------------------------------------------------------------
  // Static File Serving
  // -----------------------------------------------------------------------
  let safePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  const filePath = path.join(ROOT_DIR, path.normalize(safePath).replace(/^(\.\.[\/\\])+/, ''));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found - CBEO Bhinai Portal');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)`);
  console.log(`  Universal Node.js + SQLite Server Online: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
