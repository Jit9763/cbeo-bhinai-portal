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
  if (!apiBase) {
    if (typeof showToast === 'function') {
      showToast('⚠️ स्थानीय सर्वर (Node.js) कनेक्ट नहीं है। GitHub बैकअप केवल सक्रिय सर्वर से ही सम्भव है।', 'warning');
    }
    return;
  }

  if (typeof showToast === 'function') {
    showToast('🚀 GitHub पर डेटा व सेटिंग्स का बैकअप भेजा जा रहा है...', 'info');
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
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('⚠️ सर्वर से संपर्क नहीं हो सका: ' + err.message, 'error');
    }
  }
}

// Global Exports
if (typeof window !== 'undefined') {
  window.getEffectiveApiBaseUrl = getEffectiveApiBaseUrl;
  window.triggerGitHubDataPush = triggerGitHubDataPush;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getEffectiveApiBaseUrl, triggerGitHubDataPush };
}
