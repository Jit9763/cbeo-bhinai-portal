import sys
import time
from playwright.sync_api import sync_playwright

def verify_jitendra_admin_control():
    print("Launching Chromium to test Jitendra Login & Admin Control Updates...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        file_url = "file:///C:/Users/jiten/Desktop/03_शिक्षा_एवं_स्कूल/cbeo/index.html"
        page.goto(file_url, wait_until="networkidle")
        time.sleep(1)

        # Clear any old localStorage and reload
        page.evaluate("""() => {
            localStorage.removeItem('cbeo_tab_visibility_6level');
            localStorage.removeItem('cbeo_edit_permissions_6level');
            localStorage.removeItem('cbeo_tab_visibility_5level');
            localStorage.removeItem('cbeo_edit_permissions_5level');
            localStorage.removeItem('cbeo_demands');
            localStorage.removeItem('cbeo_logged_user');
            localStorage.removeItem('cbeo_user');
        }""")
        page.reload(wait_until="networkidle")
        time.sleep(1)

        # Log in as Jitendra Super Admin
        print("Logging in as Jitendra Super Admin...")
        page.evaluate("""() => {
            document.getElementById('login-username').value = 'admin_jitendra';
            document.getElementById('login-password').value = 'admin123';
            performLogin();
        }""")
        page.wait_for_timeout(1500)

        # Verify Nav Tabs
        voter_disp = page.evaluate("() => window.getComputedStyle(document.getElementById('nav-tab-voter-students')).display")
        admin_disp = page.evaluate("() => window.getComputedStyle(document.getElementById('nav-tab-admin')).display")
        
        print(f"Navbar Tabs Status: voter-students display={voter_disp}, admin-control display={admin_disp}")
        assert voter_disp in ["flex", "inline-flex"], f"Expected voter-students visible, got {voter_disp}"
        assert admin_disp in ["flex", "inline-flex"], f"Expected admin-control visible, got {admin_disp}"

        # Switch to Admin Control
        print("Switching to Admin Control Tab...")
        page.evaluate("() => switchTab('admin-control')")
        page.wait_for_timeout(1200)

        # 1. Check Cloud VM Status Card
        vm_voter_card = page.query_selector("#vm-widget-voter-pending")
        print(f"Cloud VM Hub Voter Widget present: {vm_voter_card is not None}")
        assert vm_voter_card is not None, "Voter widget not found in Cloud VM Hub!"

        # 2. Check Executive Demands Summary Table
        exec_rows = page.evaluate("""() => {
            const rows = Array.from(document.querySelectorAll('#cbeo-demands-summary-tbody tr'));
            return rows.map(r => {
                const cols = r.querySelectorAll('td');
                return {
                    title: cols[1] ? cols[1].innerText.trim() : '',
                    target: cols[3] ? cols[3].innerText.trim() : '',
                    received: cols[4] ? cols[4].innerText.trim() : '',
                    pending: cols[5] ? cols[5].innerText.trim() : '',
                    actions: cols[7] ? cols[7].innerText.trim() : ''
                };
            });
        }""")
        print(f"Executive Demands Table has {len(exec_rows)} demands:")
        for r in exec_rows:
            print(f"  - {r['title']} | Target: {r['target']} | Received: {r['received']} | Pending: {r['pending']}")

        assert any("18+" in r['title'] for r in exec_rows), "Voter Students demand missing in Executive Table!"

        # 3. Check 6-Level Tab Visibility Matrix
        matrix_states = page.evaluate("""() => {
            const voterCbeo = document.getElementById('vis_voter-students_cbeo')?.checked;
            const voterPeeo = document.getElementById('vis_voter-students_peeo')?.checked;
            const voterGovtSec = document.getElementById('vis_voter-students_govt_sec')?.checked;
            const voterPvtSec = document.getElementById('vis_voter-students_pvt_sec')?.checked;
            const voterAllGovt = document.getElementById('vis_voter-students_all_govt')?.checked;
            const voterAllSchools = document.getElementById('vis_voter-students_all_schools')?.checked;

            const spGovtSec = document.getElementById('vis_saman-pariksha_govt_sec')?.checked;
            const spPvtSec = document.getElementById('vis_saman-pariksha_pvt_sec')?.checked;

            const dashGovtSec = document.getElementById('vis_dashboard_govt_sec')?.checked;

            return {
                voter: { cbeo: voterCbeo, peeo: voterPeeo, govt_sec: voterGovtSec, pvt_sec: voterPvtSec, all_govt: voterAllGovt, all_schools: voterAllSchools },
                sp: { govt_sec: spGovtSec, pvt_sec: spPvtSec },
                dashboard: { govt_sec: dashGovtSec }
            };
        }""")
        print("6-Level Matrix Checkbox States:")
        print(f"  Voter Demand: {matrix_states['voter']}")
        print(f"  Saman Pariksha (schools): {matrix_states['sp']}")
        print(f"  Dashboard (schools): {matrix_states['dashboard']}")

        assert matrix_states['voter']['cbeo'] == True
        assert matrix_states['voter']['peeo'] == True
        assert matrix_states['voter']['govt_sec'] == True
        assert matrix_states['voter']['pvt_sec'] == True
        assert matrix_states['voter']['all_govt'] == False
        assert matrix_states['voter']['all_schools'] == False

        assert matrix_states['sp']['govt_sec'] == False
        assert matrix_states['sp']['pvt_sec'] == False
        assert matrix_states['dashboard']['govt_sec'] == False

        # Capture Screenshot of Admin Control Room
        page.screenshot(path="scratch/jitendra_admin_control_updated.png", full_page=False)
        print("Saved screenshot: scratch/jitendra_admin_control_updated.png")

        # Now click voter-students tab
        page.evaluate("() => switchTab('voter-students')")
        page.wait_for_timeout(1200)
        page.screenshot(path="scratch/jitendra_voter_tab_active.png", full_page=False)
        print("Saved screenshot: scratch/jitendra_voter_tab_active.png")

        browser.close()
        print("=== ALL ADMIN CONTROL CHECKS PASSED WITH 100% SUCCESS ===")

if __name__ == "__main__":
    verify_jitendra_admin_control()
