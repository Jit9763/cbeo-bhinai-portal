import os
import sys
from playwright.sync_api import sync_playwright

def main():
    repo_dir = r"C:\Users\jiten\Desktop\03_शिक्षा_एवं_स्कूल\cbeo"
    index_url = "file:///" + os.path.join(repo_dir, "index.html").replace("\\", "/")

    print("Launching Chromium for 6-Level School Control Verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 950})
        page = context.new_page()

        # Step 1: Open index.html and clear any old session / cached permissions in localStorage
        print(f"Navigating to {index_url}...")
        page.goto(index_url)
        page.wait_for_timeout(1000)

        page.evaluate("""() => {
            localStorage.removeItem('cbeo_tab_visibility_6level');
            localStorage.removeItem('cbeo_tab_visibility_5level');
            localStorage.removeItem('cbeo_edit_permissions_6level');
            localStorage.removeItem('cbeo_edit_permissions_5level');
            localStorage.removeItem('cbeo_logged_user');
            localStorage.removeItem('cbeo_user');
        }""")
        page.reload()
        page.wait_for_timeout(1000)

        # Step 2: Log in as Jitendra Super Admin
        print("Logging in as Jitendra Super Admin...")
        page.evaluate("""() => {
            document.getElementById('login-username').value = 'admin_jitendra';
            document.getElementById('login-password').value = 'admin123';
            performLogin();
        }""")
        page.wait_for_timeout(1000)

        # Step 3: Switch to Admin Control
        print("Navigating to Admin Control Tab...")
        page.evaluate("() => switchTab('admin-control')")
        page.wait_for_timeout(1000)

        # Step 4: Verify 6-Level Tab Visibility Checkboxes
        print("\nVerifying 6-Level Tab Visibility Checkbox States:")
        voter_cbeo = page.evaluate("() => document.getElementById('vis_voter-students_cbeo')?.checked")
        voter_peeo = page.evaluate("() => document.getElementById('vis_voter-students_peeo')?.checked")
        voter_govt = page.evaluate("() => document.getElementById('vis_voter-students_govt_sec')?.checked")
        voter_pvt = page.evaluate("() => document.getElementById('vis_voter-students_pvt_sec')?.checked")
        voter_all_govt = page.evaluate("() => document.getElementById('vis_voter-students_all_govt')?.checked")
        voter_all_sch = page.evaluate("() => document.getElementById('vis_voter-students_all_schools')?.checked")

        print(f"voter-students -> CBEO: {voter_cbeo}, PEEO: {voter_peeo}, GovtSec(49): {voter_govt}, PvtSec(8): {voter_pvt}, AllGovt: {voter_all_govt}, AllSchools: {voter_all_sch}")

        # Check that voter-students has 58 schools checked, but all_govt & all_schools UNCHECKED
        assert voter_cbeo is True, "voter-students CBEO must be True"
        assert voter_peeo is True, "voter-students PEEO must be True"
        assert voter_govt is True, "voter-students Govt Sec must be True"
        assert voter_pvt is True, "voter-students Pvt Sec must be True"
        assert voter_all_govt is False, "voter-students All Govt must be False (Unchecked)"
        assert voter_all_sch is False, "voter-students All Schools must be False (Unchecked)"

        # Check other tabs (saman-pariksha, database-hub, dashboard, directory, staff, school-management, demands, archive)
        other_tabs = ['saman-pariksha', 'database-hub', 'dashboard', 'directory', 'staff', 'school-management', 'demands', 'archive']
        for t in other_tabs:
            g_checked = page.evaluate(f"() => document.getElementById('vis_{t}_govt_sec')?.checked")
            p_checked = page.evaluate(f"() => document.getElementById('vis_{t}_pvt_sec')?.checked")
            ag_checked = page.evaluate(f"() => document.getElementById('vis_{t}_all_govt')?.checked")
            as_checked = page.evaluate(f"() => document.getElementById('vis_{t}_all_schools')?.checked")
            print(f"Tab '{t}' -> GovtSec: {g_checked}, PvtSec: {p_checked}, AllGovt: {ag_checked}, AllSchools: {as_checked}")
            assert not (g_checked or p_checked or ag_checked or as_checked), f"Tab {t} should have all school checkboxes unchecked!"

        # Step 5: Verify 6-Level Edit Permissions Checkboxes
        print("\nVerifying 6-Level Edit Permissions Checkbox States:")
        edit_voter_govt = page.evaluate("() => document.getElementById('edit_voter_students_govt_sec')?.checked")
        edit_voter_pvt = page.evaluate("() => document.getElementById('edit_voter_students_pvt_sec')?.checked")
        edit_voter_all_govt = page.evaluate("() => document.getElementById('edit_voter_students_all_govt')?.checked")
        edit_voter_all_sch = page.evaluate("() => document.getElementById('edit_voter_students_all_schools')?.checked")

        print(f"Edit voter_students -> GovtSec: {edit_voter_govt}, PvtSec: {edit_voter_pvt}, AllGovt: {edit_voter_all_govt}, AllSchools: {edit_voter_all_sch}")
        assert edit_voter_govt is True, "Edit voter_students Govt Sec must be True"
        assert edit_voter_pvt is True, "Edit voter_students Pvt Sec must be True"
        assert edit_voter_all_govt is False, "Edit voter_students All Govt must be False"
        assert edit_voter_all_sch is False, "Edit voter_students All Schools must be False"

        # Check other modules (staff, school_head, saman_pariksha, database_hub, demands, directory)
        other_modules = ['staff', 'school_head', 'saman_pariksha', 'database_hub', 'demands', 'directory']
        for m in other_modules:
            mg_checked = page.evaluate(f"() => document.getElementById('edit_{m}_govt_sec')?.checked")
            mp_checked = page.evaluate(f"() => document.getElementById('edit_{m}_pvt_sec')?.checked")
            mag_checked = page.evaluate(f"() => document.getElementById('edit_{m}_all_govt')?.checked")
            mas_checked = page.evaluate(f"() => document.getElementById('edit_{m}_all_schools')?.checked")
            print(f"Edit Module '{m}' -> GovtSec: {mg_checked}, PvtSec: {mp_checked}, AllGovt: {mag_checked}, AllSchools: {mas_checked}")
            assert not (mg_checked or mp_checked or mag_checked or mas_checked), f"Edit module {m} should have all school checkboxes unchecked!"

        # Screenshot of Admin Control Matrix
        page.evaluate("() => document.getElementById('tbody-5level-visibility-matrix').scrollIntoView()")
        page.wait_for_timeout(500)
        page.screenshot(path="scratch/admin_control_6level_matrix.png")
        print("Captured screenshot: scratch/admin_control_6level_matrix.png")

        # Step 6: Test School Login (Authorized School: 221764)
        print("\nTesting School Login for Authorized School 221764 (बड़गांव)...")
        page.evaluate("""() => {
            if (typeof performLogout === 'function') performLogout();
            document.getElementById('login-username').value = '221764';
            document.getElementById('login-password').value = '221764';
            performLogin();
        }""")
        page.wait_for_timeout(1000)

        # Verify only voter tab is visible to school
        voter_tab_disp = page.evaluate("() => window.getComputedStyle(document.getElementById('nav-tab-voter-students')).display")
        sp_tab_disp = page.evaluate("() => window.getComputedStyle(document.getElementById('nav-tab-saman-pariksha')).display")
        dash_tab_disp = page.evaluate("() => window.getComputedStyle(document.getElementById('nav-tab-dashboard')).display")
        admin_tab_disp = page.evaluate("() => window.getComputedStyle(document.getElementById('nav-tab-admin')).display")

        print(f"School View Tabs -> voter-students: {voter_tab_disp}, saman-pariksha: {sp_tab_disp}, dashboard: {dash_tab_disp}, admin-control: {admin_tab_disp}")

        assert voter_tab_disp != "none", "voter-students tab MUST be visible to school 221764"
        assert sp_tab_disp == "none", "saman-pariksha tab MUST be hidden for school"
        assert dash_tab_disp == "none", "dashboard tab MUST be hidden for school"
        assert admin_tab_disp == "none", "admin tab MUST be hidden for school"

        page.screenshot(path="scratch/school_login_isolated_voter_view.png")
        print("Captured screenshot: scratch/school_login_isolated_voter_view.png")

        browser.close()
        print("\n=== ALL 6-LEVEL CONTROLS AND SCHOOL ISOLATION AUDITS PASSED WITH 100% SUCCESS ===")

if __name__ == "__main__":
    main()
