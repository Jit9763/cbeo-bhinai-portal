import json
import os

with open('saman_syllabus_submissions.json', 'r', encoding='utf-8') as f:
    subs = json.load(f)

with open('schools_56_master.json', 'r', encoding='utf-8') as f:
    schools_master = {str(s.get('shala_darpan_code')): s for s in json.load(f)}

comparison_schools = [
    {
        "code": "221764",
        "name": "रा.उ.मा.वि. बड़गांव (सूरखण्ड)",
        "images": [
            {"label": "प्रपत्र फोटो 1", "src": "images/syllabus_previews/page_221764_रा.उ.मा.वि._बड़गांव_सूरखण्ड_Syllabus.png"},
            {"label": "प्रपत्र फोटो 2 (क्लोज-अप)", "src": "images/syllabus_previews/page_221764_part2.jpeg"}
        ],
        "pdf_name": "221764_रा.उ.मा.वि._बड़गांव_सूरखण्ड_Syllabus.pdf"
    },
    {
        "code": "221765",
        "name": "रा.उ.मा.वि. कनाई कलां",
        "images": [
            {"label": "प्रपत्र फोटो 1", "src": "images/syllabus_previews/page_221765_रा.उ.मा.वि._कनाई_कलां_Syllabus.png"}
        ],
        "pdf_name": "221765_रा.उ.मा.वि._कनाई_कलां_Syllabus.pdf"
    },
    {
        "code": "221770",
        "name": "महात्मा गांधी राजकीय विद्यालय, बांदनवाड़ा",
        "images": [
            {"label": "प्रपत्र पृष्ठ 1", "src": "images/syllabus_previews/page_221770_MGGS_बांदनवाड़ा_Syllabus.png"}
        ],
        "pdf_name": "221770_MGGS_बांदनवाड़ा_Syllabus.pdf"
    },
    {
        "code": "410632",
        "name": "रा.बा.उ.मा.वि. नांदसी",
        "images": [
            {"label": "प्रपत्र पृष्ठ 1", "src": "images/syllabus_previews/page_410632_रा.बा.उ.मा.वि._नांदसी_Syllabus.png"}
        ],
        "pdf_name": "410632_रा.बा.उ.मा.वि._नांदसी_Syllabus.pdf"
    },
    {
        "code": "488791",
        "name": "रा.बा.उ.मा.वि. खेड़ी",
        "images": [
            {"label": "प्रपत्र पृष्ठ 1", "src": "images/syllabus_previews/page_488791_रा.बा.उ.मा.वि._खेड़ी_Syllabus.png"}
        ],
        "pdf_name": "488791_रा.बा.उ.मा.वि._खेड़ी_Syllabus.pdf"
    },
    {
        "code": "488897",
        "name": "रा.उ.मा.वि. घणा",
        "images": [
            {"label": "प्रपत्र पृष्ठ 1", "src": "images/syllabus_previews/page_488897_रा.उ.मा.वि._घणा_Syllabus.png"}
        ],
        "pdf_name": "488897_रा.उ.मा.वि._घणा_Syllabus.pdf"
    },
    {
        "code": "488947",
        "name": "रा.उ.मा.वि. हियालिया",
        "images": [
            {"label": "प्रपत्र पृष्ठ 1 (शून्य नामांकन)", "src": "images/syllabus_previews/page_488947_रा.उ.मा.वि._हियालिया_Syllabus.png"}
        ],
        "pdf_name": "488947_रा.उ.मा.वि._हियालिया_Syllabus.pdf"
    }
]

# Build school data dict
school_data_json = {}
for s in comparison_schools:
    code = s["code"]
    sub = subs.get(code, {})
    master = schools_master.get(code, {})
    school_data_json[code] = {
        "meta": s,
        "submission": sub,
        "master": master
    }

html_content = f"""<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>समान परीक्षा 2026-27 | पाठ्यक्रम डाटा व इमेज सत्यापन (Side-by-Side Comparison)</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Tiro+Devanagari+Hindi:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        :root {{
            --primary: #1e3a8a;
            --primary-light: #3b82f6;
            --primary-dark: #0f172a;
            --accent: #f59e0b;
            --accent-green: #10b981;
            --bg-main: #f8fafc;
            --bg-card: #ffffff;
            --text-dark: #0f172a;
            --text-muted: #64748b;
            --border-color: #e2e8f0;
            --shadow: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
            --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: 'Plus Jakarta Sans', 'Tiro Devanagari Hindi', sans-serif;
            background-color: var(--bg-main);
            color: var(--text-dark);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }}

        /* Header */
        header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%);
            color: white;
            padding: 10px 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 20;
            flex-shrink: 0;
        }}

        .brand {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .brand-icon {{
            width: 42px;
            height: 42px;
            background: rgba(255,255,255,0.15);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: #fbbf24;
            backdrop-filter: blur(4px);
        }}

        .brand-text h1 {{
            font-size: 16px;
            font-weight: 700;
            letter-spacing: -0.3px;
        }}

        .brand-text p {{
            font-size: 11px;
            color: #cbd5e1;
            font-weight: 500;
        }}

        .header-actions {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .portal-btn {{
            background: rgba(255,255,255,0.12);
            color: white;
            border: 1px solid rgba(255,255,255,0.25);
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }}

        .portal-btn:hover {{
            background: white;
            color: var(--primary);
        }}

        /* School Selector Tabs */
        .tabs-bar {{
            background: #ffffff;
            border-bottom: 1px solid var(--border-color);
            padding: 8px 16px;
            display: flex;
            gap: 8px;
            overflow-x: auto;
            flex-shrink: 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }}

        .tab-btn {{
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            color: #475569;
            padding: 8px 16px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }}

        .tab-btn:hover {{
            background: #e2e8f0;
            color: var(--primary);
        }}

        .tab-btn.active {{
            background: #1e3a8a;
            color: white;
            border-color: #1e3a8a;
            box-shadow: 0 4px 8px rgba(30, 58, 138, 0.25);
        }}

        .tab-btn .badge-pill {{
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
        }}

        .tab-btn.active .badge-pill {{
            background: #fbbf24;
            color: #0f172a;
            font-weight: 700;
        }}

        /* Main Workspace: Split View */
        .workspace {{
            display: flex;
            flex: 1;
            height: calc(100vh - 115px);
            overflow: hidden;
            background: #f1f5f9;
        }}

        /* Left Pane: Image Viewer */
        .pane-image {{
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #0f172a;
            border-right: 1px solid #cbd5e1;
            position: relative;
            overflow: hidden;
        }}

        .image-toolbar {{
            background: rgba(15, 23, 42, 0.95);
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #1e293b;
            z-index: 10;
        }}

        .toolbar-title {{
            color: #f8fafc;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        .toolbar-controls {{
            display: flex;
            align-items: center;
            gap: 6px;
        }}

        .ctrl-btn {{
            background: #1e293b;
            color: #e2e8f0;
            border: 1px solid #334155;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }}

        .ctrl-btn:hover {{
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }}

        .image-canvas-container {{
            flex: 1;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            cursor: grab;
            background: radial-gradient(circle, #1e293b 10%, #0f172a 90%);
        }}

        .image-canvas-container:active {{
            cursor: grabbing;
        }}

        .doc-preview-img {{
            max-width: 95%;
            height: auto;
            box-shadow: 0 12px 32px rgba(0,0,0,0.5);
            border-radius: 4px;
            transition: transform 0.15s ease-out;
            transform-origin: center center;
            background: white;
        }}

        /* Right Pane: Entered Data */
        .pane-data {{
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #ffffff;
            overflow-y: auto;
        }}

        .data-header {{
            background: #f8fafc;
            border-bottom: 1px solid var(--border-color);
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 10;
        }}

        .data-title h2 {{
            font-size: 18px;
            font-weight: 700;
            color: var(--primary);
        }}

        .data-title p {{
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 2px;
        }}

        .status-badge {{
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
        }}

        .data-body {{
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }}

        /* Proforma Cards */
        .proforma-card {{
            background: #ffffff;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: var(--shadow);
        }}

        .card-header {{
            background: #f1f5f9;
            padding: 10px 16px;
            font-weight: 700;
            font-size: 13px;
            color: #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
        }}

        .info-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            padding: 16px;
        }}

        .info-item {{
            background: #f8fafc;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }}

        .info-item .label {{
            font-size: 11px;
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
        }}

        .info-item .value {{
            font-size: 14px;
            color: #0f172a;
            font-weight: 700;
            margin-top: 3px;
        }}

        .avg-banner {{
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 14px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }}

        .avg-banner .avg-text {{
            font-size: 14px;
            font-weight: 600;
        }}

        .avg-banner .avg-val {{
            font-size: 26px;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
        }}

        /* Comparison Data Table */
        .data-table {{
            width: 100%;
            border-collapse: collapse;
            text-align: center;
        }}

        .data-table th {{
            background: #f8fafc;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
            padding: 10px 8px;
            border-bottom: 2px solid var(--border-color);
            border-right: 1px solid var(--border-color);
        }}

        .data-table td {{
            padding: 10px 8px;
            border-bottom: 1px solid var(--border-color);
            border-right: 1px solid var(--border-color);
            font-size: 13px;
            font-weight: 600;
        }}

        .data-table tr:hover {{
            background: #f8fafc;
        }}

        .pct-badge {{
            display: inline-block;
            background: #eff6ff;
            color: #1d4ed8;
            padding: 4px 8px;
            border-radius: 6px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            border: 1px solid #bfdbfe;
        }}

        .pct-badge.high {{
            background: #ecfdf5;
            color: #047857;
            border-color: #a7f3d0;
        }}

        .pct-badge.na {{
            background: #f1f5f9;
            color: #64748b;
            border-color: #cbd5e1;
        }}

        .elective-chip {{
            display: inline-block;
            background: #fdf2f8;
            color: #be185d;
            border: 1px solid #fbcfe8;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            margin: 2px;
        }}

        /* Verification Controls Footer */
        .data-footer {{
            background: #f8fafc;
            padding: 16px 20px;
            border-top: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            bottom: 0;
            box-shadow: 0 -4px 10px rgba(0,0,0,0.03);
        }}

        .verify-checkbox {{
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
            color: #1e293b;
            cursor: pointer;
        }}

        .verify-checkbox input {{
            width: 18px;
            height: 18px;
            accent-color: var(--primary);
            cursor: pointer;
        }}

        .btn-action {{
            background: #1e3a8a;
            color: white;
            border: none;
            padding: 8px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }}

        .btn-action:hover {{
            background: #1e40af;
        }}
    </style>
</head>
<body>

    <header>
        <div class="brand">
            <div class="brand-icon">
                <i class="fa-solid fa-code-compare"></i>
            </div>
            <div class="brand-text">
                <h1>समान परीक्षा 2026-27 : पाठ्यक्रम प्रपत्र एवं पोर्टल डाटा तुलनात्मक सत्यापन</h1>
                <p>कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर) | Live Side-by-Side Verification</p>
            </div>
        </div>
        <div class="header-actions">
            <a href="index.html" class="portal-btn">
                <i class="fa-solid fa-arrow-left"></i> मुख्य पोर्टल पर लौटें
            </a>
        </div>
    </header>

    <!-- School Switcher Bar -->
    <div class="tabs-bar" id="tabsBar">
        <!-- Rendered dynamically -->
    </div>

    <!-- Main Workspace -->
    <div class="workspace">
        <!-- Left: Image Viewer -->
        <div class="pane-image">
            <div class="image-toolbar">
                <div class="toolbar-title">
                    <i class="fa-solid fa-file-invoice text-amber-400"></i>
                    <span id="imgTitle">विद्यालय द्वारा प्रेषित मूल प्रपत्र</span>
                </div>
                <div class="toolbar-controls">
                    <div id="multiImageControls" style="display: none; margin-right: 8px;">
                        <!-- Multi-image buttons -->
                    </div>
                    <button class="ctrl-btn" onclick="zoomIn()" title="ज़ूम इन"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                    <button class="ctrl-btn" onclick="zoomOut()" title="ज़ूम आउट"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                    <button class="ctrl-btn" onclick="resetZoom()" title="रीसेट"><i class="fa-solid fa-arrows-rotate"></i></button>
                    <button class="ctrl-btn" onclick="rotateImage()" title="घुमाएँ"><i class="fa-solid fa-rotate-right"></i></button>
                    <a id="openPdfBtn" href="#" target="_blank" class="ctrl-btn" title="मूल PDF खोलें"><i class="fa-solid fa-file-pdf"></i></a>
                </div>
            </div>
            <div class="image-canvas-container" id="canvasContainer">
                <img id="previewImg" src="" alt="Syllabus Document" class="doc-preview-img">
            </div>
        </div>

        <!-- Right: Live Entered Data -->
        <div class="pane-data">
            <div class="data-header">
                <div class="data-title">
                    <h2 id="dispSchoolName">-</h2>
                    <p id="dispMeta">कोड: - | PEEO: -</p>
                </div>
                <div class="status-badge">
                    <i class="fa-solid fa-circle-check"></i> पोर्टल पर दर्ज (Live)
                </div>
            </div>

            <div class="data-body">
                <!-- Average Banner -->
                <div class="avg-banner">
                    <div>
                        <div class="avg-text">औसत पाठ्यक्रम पूर्णता दर (Average Syllabus Completion)</div>
                        <div style="font-size: 11px; opacity: 0.9;">पोर्टल पर आधिकारिक रूप से दर्ज</div>
                    </div>
                    <div class="avg-val" id="dispAvgPct">-%</div>
                </div>

                <!-- Info Grid -->
                <div class="proforma-card">
                    <div class="card-header">
                        <span><i class="fa-solid fa-school text-blue-600"></i> संस्थागत विवरण</span>
                    </div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="label">संस्था प्रधान (Principal)</div>
                            <div class="value" id="dispPrincipal">-</div>
                        </div>
                        <div class="info-item">
                            <div class="label">मोबाइल नंबर (Principal Mobile)</div>
                            <div class="value" id="dispPrincipalMob">-</div>
                        </div>
                        <div class="info-item">
                            <div class="label">परीक्षा प्रभारी (Exam Incharge)</div>
                            <div class="value" id="dispIncharge">-</div>
                        </div>
                        <div class="info-item">
                            <div class="label">मोबाइल नंबर (Incharge Mobile)</div>
                            <div class="value" id="dispInchargeMob">-</div>
                        </div>
                    </div>
                </div>

                <!-- Section 1: Class 9 & 10 Table -->
                <div class="proforma-card">
                    <div class="card-header">
                        <span><i class="fa-solid fa-table-list text-blue-600"></i> 1. कक्षा 9वीं एवं 10वीं पाठ्यक्रम पूर्णता प्रतिशत विवरण</span>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>कक्षा</th>
                                <th>हिन्दी</th>
                                <th>अंग्रेजी</th>
                                <th>गणित</th>
                                <th>विज्ञान</th>
                                <th>सा. विज्ञान</th>
                                <th>संस्कृत</th>
                                <th>उर्दू</th>
                            </tr>
                        </thead>
                        <tbody id="tbody910">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>

                <!-- Section 2: Class 11 & 12 Table -->
                <div class="proforma-card">
                    <div class="card-header">
                        <span><i class="fa-solid fa-graduation-cap text-blue-600"></i> 2. कक्षा 11वीं एवं 12वीं पाठ्यक्रम पूर्णता प्रतिशत विवरण</span>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 15%;">कक्षा</th>
                                <th style="width: 20%;">अनिवार्य हिन्दी</th>
                                <th style="width: 20%;">अनिवार्य अंग्रेजी</th>
                                <th style="width: 45%;">संचालित ऐच्छिक विषय एवं पूर्णता %</th>
                            </tr>
                        </thead>
                        <tbody id="tbody1112">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="data-footer">
                <label class="verify-checkbox">
                    <input type="checkbox" id="verifyCheck" onchange="toggleVerified(this.checked)">
                    <span>✓ मैंने इमेज से मिलान कर लिया है (डाटा शत-प्रतिशत सही है)</span>
                </label>
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
                    समान परीक्षा 2026-27 | जिला: अजमेर | ब्लॉक: भिनाय
                </div>
            </div>
        </div>
    </div>

    <script>
        const SCHOOLS_DATA = {json.dumps(school_data_json, ensure_ascii=False, indent=2)};
        let currentCode = "{comparison_schools[0]['code']}";
        let currentScale = 1.0;
        let currentRotation = 0;

        function initTabs() {{
            const tabsBar = document.getElementById('tabsBar');
            tabsBar.innerHTML = '';
            
            Object.keys(SCHOOLS_DATA).forEach((code, idx) => {{
                const item = SCHOOLS_DATA[code];
                const btn = document.createElement('button');
                btn.className = `tab-btn ${{code === currentCode ? 'active' : ''}}`;
                btn.onclick = () => selectSchool(code);
                
                const avg = item.submission.average_pct !== undefined ? item.submission.average_pct + '%' : 'N/A';
                btn.innerHTML = `
                    <span>${{item.meta.name}}</span>
                    <span class="badge-pill">${{avg}}</span>
                `;
                tabsBar.appendChild(btn);
            }});
        }}

        function selectSchool(code) {{
            currentCode = code;
            currentScale = 1.0;
            currentRotation = 0;
            initTabs();
            renderSchoolDetails();
        }}

        function renderSchoolDetails() {{
            const item = SCHOOLS_DATA[currentCode];
            const sub = item.submission;
            const meta = item.meta;

            // Header Meta
            document.getElementById('dispSchoolName').innerText = meta.name;
            document.getElementById('dispMeta').innerText = `शाला दर्पण कोड: ${{currentCode}} | परीक्षा कोड: ${{sub.exam_code || 'AJM04G' + currentCode}} | PEEO: ${{sub.peeo_name || ''}}`;
            document.getElementById('dispAvgPct').innerText = (sub.average_pct !== undefined) ? sub.average_pct + '%' : '-';

            // Staff Details
            document.getElementById('dispPrincipal').innerText = sub.principal_name || '-';
            document.getElementById('dispPrincipalMob').innerText = sub.principal_mobile || '-';
            document.getElementById('dispIncharge').innerText = sub.incharge_name || '-';
            document.getElementById('dispInchargeMob').innerText = sub.incharge_mobile || '-';

            // Image handling
            const img = document.getElementById('previewImg');
            const defaultImg = meta.images[0].src;
            img.src = defaultImg;
            applyTransform();

            // Multi image controls
            const multiCtrls = document.getElementById('multiImageControls');
            if (meta.images.length > 1) {{
                multiCtrls.style.display = 'inline-flex';
                multiCtrls.innerHTML = meta.images.map((im, i) => `
                    <button class="ctrl-btn" style="width: auto; padding: 0 8px; font-size: 11px; font-weight: 600;" onclick="switchImage('${{im.src}}')">${{im.label}}</button>
                `).join('');
            }} else {{
                multiCtrls.style.display = 'none';
            }}

            // PDF button
            document.getElementById('openPdfBtn').href = `syllbus/लंबित_पोर्टल_पर_नहीं_आए/${{meta.pdf_name}}`;

            // Render Class 9 & 10
            const c9 = sub.c9 || {{}};
            const c10 = sub.c10 || {{}};
            const tbody910 = document.getElementById('tbody910');

            if (c9.zero_enrolment && c10.zero_enrolment) {{
                tbody910.innerHTML = `
                    <tr>
                        <td colspan="8" style="padding: 16px; color: #64748b; font-weight: 700;">लागू नहीं (शून्य नामांकन)</td>
                    </tr>
                `;
            }} else {{
                tbody910.innerHTML = `
                    <tr>
                        <td><strong>कक्षा 9वीं</strong></td>
                        <td>${{getBadge(c9.hindi)}}</td>
                        <td>${{getBadge(c9.english)}}</td>
                        <td>${{getBadge(c9.maths)}}</td>
                        <td>${{getBadge(c9.science)}}</td>
                        <td>${{getBadge(c9.sst)}}</td>
                        <td>${{getBadge(c9.sanskrit)}}</td>
                        <td>${{getBadge(c9.urdu)}}</td>
                    </tr>
                    <tr>
                        <td><strong>कक्षा 10वीं</strong></td>
                        <td>${{getBadge(c10.hindi)}}</td>
                        <td>${{getBadge(c10.english)}}</td>
                        <td>${{getBadge(c10.maths)}}</td>
                        <td>${{getBadge(c10.science)}}</td>
                        <td>${{getBadge(c10.sst)}}</td>
                        <td>${{getBadge(c10.sanskrit)}}</td>
                        <td>${{getBadge(c10.urdu)}}</td>
                    </tr>
                `;
            }}

            // Render Class 11 & 12
            const c11 = sub.c11 || {{}};
            const c12 = sub.c12 || {{}};
            const tbody1112 = document.getElementById('tbody1112');

            let html11 = '';
            if (c11.zero_enrolment) {{
                html11 = `
                    <tr>
                        <td><strong>कक्षा 11वीं</strong></td>
                        <td colspan="3" style="color: #64748b; font-style: italic;">लागू नहीं (शून्य नामांकन)</td>
                    </tr>
                `;
            }} else {{
                const electives11 = (c11.electives || []).map(e => `<span class="elective-chip">${{e.name}}: ${{e.pct}}%</span>`).join(' ') || '<span style="color:#64748b;">-</span>';
                html11 = `
                    <tr>
                        <td><strong>कक्षा 11वीं</strong></td>
                        <td>${{getBadge(c11.comp_hindi)}}</td>
                        <td>${{getBadge(c11.comp_english)}}</td>
                        <td style="text-align: left; padding-left: 14px;">${{electives11}}</td>
                    </tr>
                `;
            }}

            let html12 = '';
            if (c12.zero_enrolment) {{
                html12 = `
                    <tr>
                        <td><strong>कक्षा 12वीं</strong></td>
                        <td colspan="3" style="color: #64748b; font-style: italic;">लागू नहीं (शून्य नामांकन)</td>
                    </tr>
                `;
            }} else {{
                const electives12 = (c12.electives || []).map(e => `<span class="elective-chip">${{e.name}}: ${{e.pct}}%</span>`).join(' ') || '<span style="color:#64748b;">-</span>';
                html12 = `
                    <tr>
                        <td><strong>कक्षा 12वीं</strong></td>
                        <td>${{getBadge(c12.comp_hindi)}}</td>
                        <td>${{getBadge(c12.comp_english)}}</td>
                        <td style="text-align: left; padding-left: 14px;">${{electives12}}</td>
                    </tr>
                `;
            }}

            tbody1112.innerHTML = html11 + html12;

            // Load verification status from localStorage
            const savedVerify = localStorage.getItem(`saman_verify_${{currentCode}}`) === 'true';
            document.getElementById('verifyCheck').checked = savedVerify;
        }}

        function getBadge(val) {{
            if (val === undefined || val === null) return '<span class="pct-badge na">-</span>';
            const num = Number(val);
            if (num === 0) return '<span class="pct-badge na">0%</span>';
            const cls = num >= 80 ? 'high' : '';
            return `<span class="pct-badge ${{cls}}">${{num}}%</span>`;
        }}

        function switchImage(src) {{
            const img = document.getElementById('previewImg');
            img.src = src;
            currentScale = 1.0;
            currentRotation = 0;
            applyTransform();
        }}

        function zoomIn() {{
            currentScale = Math.min(3.0, currentScale + 0.2);
            applyTransform();
        }}

        function zoomOut() {{
            currentScale = Math.max(0.4, currentScale - 0.2);
            applyTransform();
        }}

        function resetZoom() {{
            currentScale = 1.0;
            currentRotation = 0;
            applyTransform();
        }}

        function rotateImage() {{
            currentRotation = (currentRotation + 90) % 360;
            applyTransform();
        }}

        function applyTransform() {{
            const img = document.getElementById('previewImg');
            img.style.transform = `scale(${{currentScale}}) rotate(${{currentRotation}}deg)`;
        }}

        function toggleVerified(isChecked) {{
            localStorage.setItem(`saman_verify_${{currentCode}}`, isChecked ? 'true' : 'false');
        }}

        // Initialize on load
        window.onload = () => {{
            initTabs();
            renderSchoolDetails();
        }};
    </script>
</body>
</html>
"""

with open('compare_syllabus.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("Generated compare_syllabus.html successfully!")
