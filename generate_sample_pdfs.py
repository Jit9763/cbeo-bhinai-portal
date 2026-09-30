import os
import json
import time
from playwright.sync_api import sync_playwright
import pypdf

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generated_pdfs')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Laser-Printer Friendly CSS for Single-Page A4 Landscape Rendering
A4_LANDSCAPE_CSS = """
@page {
  size: A4 landscape;
  margin: 5mm 8mm;
}
* {
  box-sizing: border-box;
}
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #000000;
  background: #ffffff;
  margin: 0;
  padding: 0;
  line-height: 1.25;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.rectangular-stamp {
  border: 2px solid #003399;
  border-radius: 4px;
  padding: 3px 8px;
  display: inline-block;
  text-align: center;
  color: #003399;
  background: #ffffff;
}
.stamp-top-line {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  line-height: 1.1;
}
.stamp-mid-line {
  font-size: 0.78rem;
  font-weight: 900;
  margin: 1px 0;
  color: #002266;
  line-height: 1.1;
}
.stamp-bottom-line {
  font-size: 0.60rem;
  font-weight: 700;
  border-top: 1px dashed #003399;
  padding-top: 2px;
  margin-top: 1px;
  line-height: 1.1;
}
"""

def generate_all_pdfs():
    print(f"Generating Laser-Friendly PDFs in {OUTPUT_DIR}...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        # 1. Navigate to the local portal
        page.goto("http://localhost:8089/")
        page.wait_for_load_state("networkidle")
        
        # 2. Inject rich test submissions into localStorage
        test_submissions = {
            # Standard High School (Full Classes 9 to 12)
            "221753": {
                "school_code": "221753",
                "school_name": "MAHATMA GANDHI GOVT. SCHOOL DEOLIYA KALAN",
                "category": "MGGS",
                "type": "Government",
                "peeo_name": "PEEO DEOLIYA KALAN",
                "peeo_code": "221754",
                "exam_code": "5201",
                "principal_name": "डॉ. हरीश कुमार जांगिड़",
                "principal_mobile": "9876543210",
                "incharge_name": "सुरेश चंद्र शर्मा",
                "incharge_mobile": "9123456780",
                "c9_total": 45,
                "c9_sanskrit": 40,
                "c9_urdu": 5,
                "c10_total": 42,
                "c10_sanskrit": 38,
                "c10_urdu": 4,
                "c11_faculties": ["arts", "science"],
                "c11_comp_hindi": 35,
                "c11_comp_english": 35,
                "c11_optional": {
                    "pol_sci": 20, "history": 20, "geography": 15,
                    "physics": 10, "chemistry": 10, "maths": 5, "biology": 5
                },
                "c11_total": 35,
                "c12_faculties": ["arts"],
                "c12_comp_hindi": 32,
                "c12_comp_english": 32,
                "c12_optional": {
                    "pol_sci": 32, "history": 28, "geography": 22
                },
                "c12_total": 32,
                "grand_total": 154,
                "signature_data": None,
                "has_digital_signature": False,
                "submitted_by": "डॉ. हरीश कुमार जांगिड़",
                "timestamp": "01/10/2026, 10:30:00 am"
            },
            # Upgraded Secondary School (Only 9th & 10th - 11th & 12th are NIL / Not Operating)
            "221764": {
                "school_code": "221764",
                "school_name": "GOVT. SECONDARY SCHOOL BADGAON (UPGRADED)",
                "category": "Secondary",
                "type": "Government",
                "peeo_name": "PEEO DEOLIYA KALAN",
                "peeo_code": "221754",
                "exam_code": "5209",
                "principal_name": "श्री मदन लाल शर्मा",
                "principal_mobile": "9829012345",
                "incharge_name": "श्री रमेश कुमार वर्मा",
                "incharge_mobile": "9414056789",
                "c9_total": 24,
                "c9_sanskrit": 24,
                "c9_urdu": 0,
                "c10_total": 21,
                "c10_sanskrit": 21,
                "c10_urdu": 0,
                "c11_faculties": [],
                "c11_comp_hindi": 0,
                "c11_comp_english": 0,
                "c11_optional": {},
                "c11_total": 0,
                "c12_faculties": [],
                "c12_comp_hindi": 0,
                "c12_comp_english": 0,
                "c12_optional": {},
                "c12_total": 0,
                "grand_total": 45,
                "signature_data": None,
                "has_digital_signature": False,
                "submitted_by": "श्री मदन लाल शर्मा",
                "timestamp": "01/10/2026, 11:15:00 am"
            },
            # Complete Zero NIL School (No 9th to 12th enrollment / Zero Demands)
            "506830": {
                "school_code": "506830",
                "school_name": "GOVT. NEW UPGRADED SCHOOL SAMPLE (NIL ENROLLMENT)",
                "category": "Secondary",
                "type": "Government",
                "peeo_name": "PEEO DEOLIYA KALAN",
                "peeo_code": "221754",
                "exam_code": "5215",
                "principal_name": "सुश्री सुनीता चौधरी",
                "principal_mobile": "9460011223",
                "incharge_name": "श्री दिनेश कुमार पारीक",
                "incharge_mobile": "9828877665",
                "c9_total": 0,
                "c9_sanskrit": 0,
                "c9_urdu": 0,
                "c10_total": 0,
                "c10_sanskrit": 0,
                "c10_urdu": 0,
                "c11_faculties": [],
                "c11_comp_hindi": 0,
                "c11_comp_english": 0,
                "c11_optional": {},
                "c11_total": 0,
                "c12_faculties": [],
                "c12_comp_hindi": 0,
                "c12_comp_english": 0,
                "c12_optional": {},
                "c12_total": 0,
                "grand_total": 0,
                "signature_data": None,
                "has_digital_signature": False,
                "submitted_by": "सुश्री सुनीता चौधरी",
                "timestamp": "01/10/2026, 11:45:00 am"
            }
        }
        
        # Inject into browser's STATE and localStorage
        page.evaluate("""(subs) => {
            Object.assign(STATE.samanParikshaSubmissions, subs);
            localStorage.setItem('cbeo_saman_pariksha_submissions', JSON.stringify(STATE.samanParikshaSubmissions));
        }""", test_submissions)
        
        # Helper to render HTML into a standalone page and generate PDF
        def render_and_save_pdf(html_content, output_filename):
            full_html = f"""<!DOCTYPE html>
            <html lang="hi">
            <head>
              <meta charset="UTF-8">
              <title>{output_filename}</title>
              <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
              <style>
                {A4_LANDSCAPE_CSS}
              </style>
            </head>
            <body>
              <div style="padding: 0; margin: 0;">
                {html_content}
              </div>
            </body>
            </html>"""
            
            pdf_page = browser.new_page()
            pdf_page.set_content(full_html, wait_until="networkidle")
            out_path = os.path.join(OUTPUT_DIR, output_filename)
            pdf_page.pdf(
                path=out_path,
                format="A4",
                landscape=True,
                print_background=True,
                margin={"top": "5mm", "bottom": "5mm", "left": "8mm", "right": "8mm"}
            )
            pdf_page.close()
            
            # Check page count
            reader = pypdf.PdfReader(out_path)
            num_pages = len(reader.pages)
            print(f"✓ Saved: {output_filename} ({os.path.getsize(out_path):,} bytes, Pages: {num_pages})")

        # 1. School Standard PDF (221753)
        html_221753 = page.evaluate("""() => {
            openExamPdfPreview('221753');
            return document.getElementById('printable-exam-document-content').innerHTML;
        }""")
        render_and_save_pdf(html_221753, "School_221753_Deoliya_Kalan_Exam_Demand.pdf")
        
        # 2. School Upgraded NIL 11th & 12th PDF (221764)
        html_nil_upgraded = page.evaluate("""() => {
            openExamPdfPreview('221764');
            return document.getElementById('printable-exam-document-content').innerHTML;
        }""")
        render_and_save_pdf(html_nil_upgraded, "School_NIL_Upgraded_9_10_Only_Exam_Demand.pdf")

        # 3. School Complete Zero NIL PDF (506830)
        html_complete_nil = page.evaluate("""() => {
            openExamPdfPreview('506830');
            return document.getElementById('printable-exam-document-content').innerHTML;
        }""")
        render_and_save_pdf(html_complete_nil, "School_Complete_NIL_Zero_Students_Exam_Demand.pdf")
        
        # 4. PEEO Consolidated PDF (PEEO DEOLIYA KALAN)
        html_peeo = page.evaluate("""() => {
            openPeeoConsolidatedPdfPreview('PEEO DEOLIYA KALAN');
            return document.getElementById('printable-peeo-consolidated-content').innerHTML;
        }""")
        render_and_save_pdf(html_peeo, "PEEO_Deoliya_Kalan_Consolidated_Exam_Report.pdf")
        
        browser.close()
        print("All Laser-Friendly PDFs successfully generated!")

if __name__ == "__main__":
    generate_all_pdfs()
