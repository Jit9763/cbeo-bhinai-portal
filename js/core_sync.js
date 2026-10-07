/**
 * CBEO Bhinai Portal - Core API & Universal Sync Engine
 * Block: Bhinai | District: AJMER (अजमेर)
 * Handles Local Node.js Backend, SQLite DB, VM Tunnel, and GitHub Push operations safely.
 */

function getEffectiveApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  
  // 1. Direct local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8089';
  }
  
  // 2. Explicitly saved VM Tunnel or Backend URL in LocalStorage
  const savedBackend = localStorage.getItem('cbeo_backend_api_url') || localStorage.getItem('cbeo_vm_tunnel_url');
  if (savedBackend && savedBackend.startsWith('http')) {
    return savedBackend.replace(/\/$/, '');
  }

  // 3. Fallback from master config if defined
  if (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.backend_api_url) {
    return MASTER_CBEO_DATA.admin_config.backend_api_url.replace(/\/$/, '');
  }

  return '';
}

async function triggerGitHubDataPush() {
  const apiBase = getEffectiveApiBaseUrl();

  // Mode 1: Local Node.js / VM Tunnel Backend
  if (apiBase) {
    if (typeof showToast === 'function') {
      showToast('🚀 स्थानीय Node.js से GitHub पर बैकअप भेजा जा रहा है...', 'info');
    }

    try {
      const res = await fetch(`${apiBase}/api/git_backup_push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: new Date().toISOString() })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof showToast === 'function') {
          showToast('✓ ' + (data.message || 'डेटा व सेटिंग्स सुरक्षित रूप से GitHub पर पुश हो गईं!'), 'success');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('⚠️ बैकअप में समस्या: ' + (data.error || 'अज्ञात त्रुटि'), 'error');
        }
      }
      return;
    } catch (err) {
      console.warn('Local Node.js git push error, falling back to Cloud GAS:', err);
    }
  }

  // Mode 2: Cloud Google Apps Script Direct GitHub Sync (24/7 Mobile / Static GitHub Pages)
  await triggerCloudGitHubSync();
}

async function triggerCloudGitHubSync(filePath = 'saman_pariksha_submissions.json', customContent = null) {
  const gasUrl = localStorage.getItem('cbeo_google_apps_script_url') 
    || (typeof MASTER_CBEO_DATA !== 'undefined' && MASTER_CBEO_DATA.admin_config && MASTER_CBEO_DATA.admin_config.google_apps_script_url) 
    || 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec';

  if (!gasUrl) {
    if (typeof showToast === 'function') {
      showToast('⚠️ न तो स्थानीय सर्वर मिला और न ही Google Apps Script URL उपलब्ध है।', 'warning');
    }
    return;
  }

  if (typeof showToast === 'function') {
    showToast('☁️ Google Apps Script (क्लाउड) द्वारा सीधे GitHub पर डेटा सुरक्षित किया जा रहा है...', 'info');
  }

  try {
    let contentToPush = customContent;
    if (!contentToPush) {
      if (typeof STATE !== 'undefined' && STATE.samanParikshaSubmissions) {
        contentToPush = STATE.samanParikshaSubmissions;
      } else if (typeof MASTER_CBEO_DATA !== 'undefined') {
        contentToPush = MASTER_CBEO_DATA.saman_pariksha_submissions || {};
      } else {
        contentToPush = {};
      }
    }

    const payload = {
      action: 'syncToGitHub',
      file_path: filePath,
      content: contentToPush,
      message: `auto(cloud-gas): sync ${filePath} from CBEO Portal [${new Date().toLocaleString('en-IN')}]`
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (data && data.success) {
      if (typeof showToast === 'function') {
        showToast('✓ ' + (data.message || 'क्लाउड सर्वर से GitHub पर फाइल अपडेट हो गई!'), 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast('⚠️ क्लाउड सिंक नोट: ' + ((data && data.message) || 'अनुरोध भेजा गया (Google Apps Script)'), 'info');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Google Apps Script क्लाउड सिंक में त्रुटि: ' + err.message, 'warning');
    }
  }
}

// Global Exports
if (typeof window !== 'undefined') {
  window.getEffectiveApiBaseUrl = getEffectiveApiBaseUrl;
  window.triggerGitHubDataPush = triggerGitHubDataPush;
  window.triggerCloudGitHubSync = triggerCloudGitHubSync;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getEffectiveApiBaseUrl, triggerGitHubDataPush, triggerCloudGitHubSync };
}
