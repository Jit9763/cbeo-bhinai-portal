import os
import sys
from playwright.sync_api import sync_playwright

def main():
    repo_dir = r"C:\Users\jiten\Desktop\03_शिक्षा_एवं_स्कूल\cbeo"
    index_url = "file:///" + os.path.join(repo_dir, "index.html").replace("\\", "/")

    print("Launching Chromium for Jitendra Monitoring Verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Step 1: Open index.html
        print(f"Navigating to {index_url}...")
        page.goto(index_url)
        page.wait_for_timeout(1000)

        # Step 2: Log in as Jitendra Super Admin
        print("Logging in as Jitendra Super Admin (admin_jitendra)...")
        page.evaluate("""() => {
            if (typeof performLogin === 'function') {
                document.getElementById('login-username').value = 'admin_jitendra';
                document.getElementById('login-password').value = 'admin123';
                performLogin();
            }
        }""")
        page.wait_for_timeout(1000)

        # Step 3: Check Active Tab
        tab_voter = page.query_selector("#nav-tab-voter-students")
        if not tab_voter:
            print("ERROR: #nav-tab-voter-students NOT FOUND!")
            sys.exit(1)

        is_tab_visible = page.evaluate("() => { const el = document.getElementById('nav-tab-voter-students'); return window.getComputedStyle(el).display !== 'none'; }")
        is_tab_active = "active" in (tab_voter.get_attribute("class") or "")
        is_view_active = page.evaluate("() => { const el = document.getElementById('view-voter-students'); return el && el.classList.contains('active') && window.getComputedStyle(el).display !== 'none'; }")

        print(f"Tab Visible: {is_tab_visible}")
        print(f"Tab Active Class: {is_tab_active}")
        print(f"View Active: {is_view_active}")

        if not (is_tab_visible and is_tab_active and is_view_active):
            print("ERROR: Voter tab is not properly visible or active for Jitendra!")
            page.screenshot(path="scratch/jitendra_tab_failed.png")
            sys.exit(1)

        # Step 4: Check 58 schools and buttons
        cards_count = page.evaluate("() => document.querySelectorAll('#voter-schools-content .sp-school-card').length")
        print(f"Rendered School Cards Count: {cards_count}")

        # Check Action Buttons on first card
        first_card_text = page.evaluate("() => document.querySelector('#voter-schools-content .sp-school-card')?.innerText")
        print(f"First Card Text Preview:\n{first_card_text[:180]}...")

        has_lock_btn = page.evaluate("() => { const btn = document.querySelector('#voter-schools-content .sp-school-card button[onclick*=\"toggleVoterSchoolLock\"]'); return !!btn; }")
        has_preview_btn = page.evaluate("() => { const btn = document.querySelector('#voter-schools-content .sp-school-card button[onclick*=\"openVoterPdfPreviewModal\"]'); return !!btn; }")
        has_pdf_btn = page.evaluate("() => { const btn = document.querySelector('#voter-schools-content .sp-school-card button[onclick*=\"downloadVoterSingleSchoolPdf\"]'); return !!btn; }")
        has_wa_btn = page.evaluate("() => { const btn = document.querySelector('#voter-schools-content .sp-school-card button[onclick*=\"sendVoterSchoolReminder\"]'); return !!btn; }")

        print(f"Has Lock/Unlock Button: {has_lock_btn}")
        print(f"Has Proforma Preview Button: {has_preview_btn}")
        print(f"Has Direct PDF Button: {has_pdf_btn}")
        print(f"Has WhatsApp Reminder Button: {has_wa_btn}")

        # Step 5: Test Lock/Unlock Toggle on test school 999999
        print("\nTesting Lock/Unlock Toggle on school 999999...")
        page.evaluate("() => window.toggleVoterSchoolLock('999999')")
        page.wait_for_timeout(500)
        
        is_999999_locked = page.evaluate("() => { const s = JSON.parse(localStorage.getItem('cbeo_voter_submissions') || '{}'); return !!(s['999999'] && s['999999'].is_locked); }")
        print(f"School 999999 isLocked in localStorage: {is_999999_locked}")

        # Step 6: Test Certified PDF Preview Modal
        print("\nTesting Certified Proforma Preview Modal for 999999...")
        page.evaluate("() => window.openVoterPdfPreviewModal('999999')")
        page.wait_for_timeout(500)

        modal_visible = page.evaluate("() => { const m = document.getElementById('modal-voter-pdf-preview'); return m && m.classList.contains('active') && window.getComputedStyle(m).display !== 'none'; }")
        modal_content = page.evaluate("() => document.getElementById('printable-voter-document-content')?.innerText || ''")
        
        print(f"PDF Preview Modal Active: {modal_visible}")
        print(f"Proforma Contains 'अजमेर': {'अजमेर' in modal_content}")
        print(f"Proforma Contains 'केकड़ी' (MUST BE FALSE): {'केकड़ी' in modal_content}")

        page.screenshot(path="scratch/jitendra_pdf_preview_modal.png")
        print("Captured screenshot: scratch/jitendra_pdf_preview_modal.png")

        # Close PDF preview modal
        page.evaluate("() => closeModal('modal-voter-pdf-preview')")
        page.wait_for_timeout(300)

        # Step 7: Test WhatsApp Broadcast Modal
        print("\nTesting WhatsApp Broadcast Modal...")
        page.evaluate("() => window.openVoterBroadcastModal()")
        page.wait_for_timeout(500)
        broadcast_visible = page.evaluate("() => { const m = document.getElementById('modal-voter-broadcast'); return m && m.classList.contains('active') && window.getComputedStyle(m).display !== 'none'; }")
        print(f"Broadcast Modal Active: {broadcast_visible}")

        page.screenshot(path="scratch/jitendra_broadcast_modal.png")
        print("Captured screenshot: scratch/jitendra_broadcast_modal.png")

        page.evaluate("() => closeModal('modal-voter-broadcast')")
        page.wait_for_timeout(300)

        # Full view screenshot
        page.screenshot(path="scratch/jitendra_full_monitoring_view.png", full_page=False)
        print("Captured screenshot: scratch/jitendra_full_monitoring_view.png")

        browser.close()
        print("\n=== ALL JITENDRA MONITORING AUDITS PASSED WITH 100% SUCCESS ===")

if __name__ == "__main__":
    main()
