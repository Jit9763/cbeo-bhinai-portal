import os
import json
import urllib.request
import urllib.parse
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAS_URL = 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec'

def load_json(filename):
    p = os.path.join(ROOT_DIR, filename)
    if os.path.exists(p):
        try:
            with open(p, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning loading {filename}: {e}")
    return None

def sync_settings():
    print("=========================================================================")
    print("  CBEO Bhinai Portal - Master Cloud Settings Synchronizer")
    print("  कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)")
    print("=========================================================================")

    bundle = {}

    tab_vis = load_json('tab_visibility_6level.json') or load_json('tab_visibility_5level.json')
    if tab_vis:
        bundle['tab_visibility_6level'] = tab_vis
        bundle['tab_visibility_5level'] = tab_vis

    edit_perm = load_json('edit_permissions_6level.json') or load_json('staff_edit_permissions.json')
    if edit_perm:
        bundle['edit_permissions_6level'] = edit_perm
        bundle['staff_edit_permissions'] = edit_perm

    mismatch = load_json('saman_mismatch_settings.json')
    if mismatch:
        # Guarantee alert_active is False as requested by user
        mismatch['alert_active'] = False
        bundle['saman_mismatch_settings'] = mismatch

    portal_cfg = load_json('portal_settings.json')
    if portal_cfg:
        bundle['portal_settings'] = portal_cfg

    vm_cfg = load_json('cbeo_vm_settings.json')
    if vm_cfg:
        bundle['vm_settings'] = vm_cfg

    if not bundle:
        print("No settings found to sync.")
        return

    payload = {
        'action': 'savePortalSettings',
        'settings': bundle,
        'updated_by': 'Admin_Jitendra',
        'sync_timestamp': datetime.now().strftime('%d-%m-%Y %H:%M:%S')
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        GAS_URL,
        data=data,
        headers={'Content-Type': 'application/json', 'User-Agent': 'CBEO-Sync-Agent/1.0'}
    )

    try:
        print(f"Pushing {len(bundle)} settings categories to Google Apps Script Cloud...")
        with urllib.request.urlopen(req, timeout=15) as resp:
            res_data = resp.read().decode('utf-8')
            try:
                res_json = json.loads(res_data)
                print(f"✓ Cloud Response: {res_json.get('message', 'Settings successfully saved!')}")
            except Exception:
                print(f"✓ Server responded: {res_data[:120]}")
    except Exception as e:
        print(f"⚠️ Note: Cloud sync request error (offline or timeout): {e}")

if __name__ == '__main__':
    sync_settings()
