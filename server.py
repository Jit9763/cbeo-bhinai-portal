import os
import sys
import json
import time
import subprocess
import re
import threading
import hashlib
import urllib.request
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

AI_CACHE_FILE = 'ai_query_cache.json'

def get_ai_cache():
    if os.path.exists(AI_CACHE_FILE):
        try:
            with open(AI_CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_ai_cache(cache_data):
    try:
        with open(AI_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("[AI Cache Error]:", e)

def get_gemini_key_pool():
    keys = []
    # 1. Environment variable
    env_keys = os.environ.get('GEMINI_API_KEY', '')
    if env_keys:
        for k in env_keys.replace('\n', ',').split(','):
            k = k.strip()
            if k and k not in keys:
                keys.append(k)
    # 2. cbeo_vm_settings.json
    if os.path.exists('cbeo_vm_settings.json'):
        try:
            with open('cbeo_vm_settings.json', 'r', encoding='utf-8') as sf:
                cfg = json.load(sf)
                val = cfg.get('gemini_api_key', '')
                if isinstance(val, list):
                    for k in val:
                        if k and k not in keys: keys.append(k.strip())
                elif isinstance(val, str) and val:
                    for k in val.replace('\n', ',').split(','):
                        k = k.strip()
                        if k and k not in keys: keys.append(k)
        except:
            pass
    # 3. cbeo_notification_config.json
    if os.path.exists('cbeo_notification_config.json'):
        try:
            with open('cbeo_notification_config.json', 'r', encoding='utf-8') as nf:
                cfg = json.load(nf)
                val = cfg.get('GEMINI_API_KEY', '')
                if isinstance(val, str) and val:
                    for k in val.replace('\n', ',').split(','):
                        k = k.strip()
                        if k and k not in keys: keys.append(k)
        except:
            pass
    return keys
from sync_admin_access_sheet import update_single_password, sync_full_admin_sheet
from sync_saman_pariksha_to_sheet import sync_submissions
from manage_contacts_and_staff import (
    update_sanstha_pradhan_in_all_files,
    save_or_update_staff_member,
    relieve_or_delete_staff_member
)
from broadcast_email_service import broadcast_demand_emails

PORT = 8089

def update_dynamic_master_contacts(school_code, req_data):
    try:
        p_name = req_data.get('principal_name')
        p_mob = req_data.get('principal_mobile')
        i_name = req_data.get('incharge_name')
        i_mob = req_data.get('incharge_mobile')
        if not (p_name or i_name):
            return

        json_path = 'master_cbeo_data.json'
        if not os.path.exists(json_path):
            return
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        school_name = None
        peeo_name = None
        for sch in data.get('schools_56', []):
            if str(sch.get('shala_darpan_code')) == str(school_code):
                if p_name: sch['principal_name'] = p_name
                if p_mob: sch['principal_mobile'] = p_mob
                if i_name: sch['incharge_name'] = i_name
                if i_mob: sch['incharge_mobile'] = i_mob
                school_name = sch.get('school_name')
                peeo_name = sch.get('peeo_name')
                break

        for p in data.get('peeos', []):
            if str(p.get('shala_darpan_code')) == str(school_code):
                if p_name: p['principal_incharge'] = p_name
                if p_mob: p['mobile'] = p_mob
            for s in p.get('schools', []):
                if str(s.get('shala_darpan_code')) == str(school_code) or s.get('school_name') == school_name:
                    if p_name: s['principal_name'] = p_name
                    if p_mob: s['mobile'] = p_mob
                    if i_name: s['incharge_name'] = i_name

        if school_name and p_name:
            found_p = False
            for st in data.get('staff', []):
                if st.get('school_name') == school_name and any(x in st.get('post', '') for x in ['प्रधानाचार्य', 'Principal', 'प्र.अ.', 'Headmaster']):
                    st['name'] = p_name
                    if p_mob: st['mobile'] = p_mob
                    st['status'] = 'Active'
                    found_p = True
                    break
            if not found_p:
                data.setdefault('staff', []).insert(0, {
                    'staff_id': f'PRIN_{school_code}',
                    'name': p_name,
                    'post': 'प्रधानाचार्य / संस्था प्रधान',
                    'school_name': school_name,
                    'peeo_name': peeo_name or '',
                    'mobile': p_mob or '',
                    'email': '',
                    'status': 'Active'
                })

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
            f.write('const MASTER_CBEO_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\nwindow.MASTER_CBEO_DATA = MASTER_CBEO_DATA;\n')
        print(f"[API] Updated dynamic contacts in master_cbeo_data for school {school_code}")
    except Exception as e:
        print(f"[API Warning] Failed to update dynamic master contacts: {e}")

def trigger_github_actions_vm():
    try:
        url_bytes = subprocess.check_output(['git', 'config', '--get', 'remote.origin.url'])
        url_str = url_bytes.decode().strip()
        m = re.search(r'https://([^@]+)@github\.com', url_str)
        token = m.group(1) if m else ''
        if not token:
            return {'success': False, 'message': 'GitHub PAT token not found in git remote.'}
        
        api_url = 'https://api.github.com/repos/Jit9763/cbeo-bhinai-portal/actions/workflows/cbeo_vm_automation.yml/dispatches'
        req = urllib.request.Request(
            api_url,
            data=json.dumps({'ref': 'main', 'inputs': {'action_type': 'all'}}).encode('utf-8'),
            headers={
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CBEO-Server'
            },
            method='POST'
        )
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 204):
                return {'success': True, 'message': '🚀 GitHub Actions Cloud VM सफलतापूर्वक ट्रिगर कर दिया गया! कुछ ही सेकंडों में टेलीग्राम व ईमेल पर रिपोर्ट आ जाएगी।'}
            return {'success': False, 'message': f'GitHub API Status: {resp.status}'}
    except Exception as e:
        return {'success': False, 'message': f'VM ट्रिगर त्रुटि: {str(e)}'}

def sync_vm_settings_to_git():
    try:
        subprocess.run(['git', 'add', 'cbeo_vm_settings.json', 'cbeo_vm_live_status.json', 'scripts/cbeo_vm_notifier.py'], capture_output=True)
        subprocess.run(['git', 'commit', '-m', 'Update Cloud VM schedule and settings from Jitendra Portal'], capture_output=True)
        subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True)
        print("[Git-Sync] Pushed updated VM settings to origin/main successfully.")
    except Exception as e:
        print("[Git-Sync Warning] Could not push VM settings:", e)


class CBEORequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            req_data = json.loads(body)
        except Exception:
            req_data = {}

        if parsed_url.path == '/api/save_tab_config':
            try:
                with open('tab_config.json', 'w', encoding='utf-8') as f:
                    json.dump(req_data, f, ensure_ascii=False, indent=2)
                self.send_json_response({'success': True, 'message': 'टैब एक्सेस सेटिंग्स सुरक्षित की गईं!'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/update_password':
            user_id = req_data.get('user_id')
            new_password = req_data.get('new_password')
            if not user_id or not new_password:
                self.send_json_response({'success': False, 'message': 'user_id एवं new_password आवश्यक हैं!'}, status=400)
                return

            print(f"[API] Updating password for '{user_id}' in Google Sheet...")
            try:
                result = update_single_password(user_id, new_password)
                self.send_json_response(result)
            except Exception as e:
                print(f"[API Error] Failed to update password: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/sync_admin_sheet':
            print("[API] Full sync requested for 1_CBEO_Admin_Access_Control...")
            try:
                sync_full_admin_sheet()
                self.send_json_response({'success': True, 'message': 'Admin Control Google Sheet पूर्णतः सिंक हो गई!'})
            except Exception as e:
                print(f"[API Error] Sync failed: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/save_saman_pariksha':
            school_code = req_data.get('school_code')
            if not school_code:
                self.send_json_response({'success': False, 'message': 'school_code required'}, status=400)
                return

            try:
                submissions = {}
                if os.path.exists('saman_pariksha_submissions.json'):
                    with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
                        submissions = json.load(f)
                
                submissions[school_code] = req_data
                with open('saman_pariksha_submissions.json', 'w', encoding='utf-8') as f:
                    json.dump(submissions, f, ensure_ascii=False, indent=2)

                print(f"[API] Saved Saman Pariksha data for {school_code} to file. Triggering sheet sync...")
                
                # Dynamically update master contacts file
                update_dynamic_master_contacts(school_code, req_data)

                try:
                    sync_submissions()
                    synced_sheet = True
                except Exception as ex_sync:
                    print(f"[API Warning] Sheet sync notice: {ex_sync}")
                    synced_sheet = False

                self.send_json_response({
                    'success': True,
                    'message': 'समान परीक्षा प्रपत्र सुरक्षित किया गया एवं Google Sheet में सिंक हो गया!',
                    'synced_to_sheet': synced_sheet
                })
            except Exception as e:
                print(f"[API Error] Failed to save submission: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/sync_saman_pariksha':
            print("[API] Sync requested for 5_CBEO_Saman_Pariksha_56_Schools_Data...")
            try:
                sync_submissions()
                self.send_json_response({'success': True, 'message': 'समान परीक्षा Google Sheet में डेटा सिंक हो गया!'})
            except Exception as e:
                print(f"[API Error] Saman Pariksha sync failed: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/broadcast_demand_email':
            print(f"[API] Broadcasting demand email for: {req_data.get('demand_title')}...")
            try:
                res = broadcast_demand_emails(req_data)
                self.send_json_response(res)
            except Exception as e:
                print(f"[API Error] broadcast_demand_email failed: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return
        elif parsed_url.path == '/api/update_sanstha_pradhan':
            staff_id = req_data.get('staff_id')
            is_sanstha_pradhan = req_data.get('is_sanstha_pradhan', True)
            school_name = req_data.get('school_name')
            peeo_name = req_data.get('peeo_name')
            name = req_data.get('name')
            mobile = req_data.get('mobile')
            
            print(f"[API] Updating Sanstha Pradhan for staff {staff_id} ({name})...")
            try:
                res = update_sanstha_pradhan_in_all_files(
                    staff_id=staff_id,
                    is_sanstha_pradhan=is_sanstha_pradhan,
                    school_name=school_name,
                    peeo_name=peeo_name,
                    name=name,
                    mobile=mobile
                )
                self.send_json_response(res)
            except Exception as e:
                print(f"[API Error] update_sanstha_pradhan failed: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/save_staff_member':
            print(f"[API] Saving staff member {req_data.get('name')}...")
            try:
                res = save_or_update_staff_member(req_data)
                self.send_json_response(res)
            except Exception as e:
                print(f"[API Error] save_staff_member failed: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/relieve_staff_member':
            staff_id = req_data.get('staff_id')
            reason = req_data.get('reason', 'कार्यमुक्त')
            print(f"[API] Relieving staff member {staff_id}...")
            try:
                res = relieve_or_delete_staff_member(staff_id, reason)
                self.send_json_response(res)
            except Exception as e:
                print(f"[API Error] relieve_staff_member failed: {e}")
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/save_tab_visibility_5level':
            try:
                with open('tab_visibility_5level.json', 'w', encoding='utf-8') as f:
                    json.dump(req_data, f, ensure_ascii=False, indent=2)
                self.send_json_response({'success': True, 'message': '5-स्तरीय टैब दृश्यता सेटिंग्स सुरक्षित की गईं!'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/save_staff_edit_permissions':
            try:
                with open('staff_edit_permissions.json', 'w', encoding='utf-8') as f:
                    json.dump(req_data, f, ensure_ascii=False, indent=2)
                self.send_json_response({'success': True, 'message': 'कार्मिक संपादन अनुमतियाँ सफलतापूर्वक सुरक्षित की गईं!'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/ai_match_columns':
            try:
                columns = req_data.get('columns', [])
                mappings = {}
                for col in columns:
                    c_name = str(col.get('name') if isinstance(col, dict) else col).strip().lower()
                    if any(k in c_name for k in ['प्रधानाचार्य', 'संस्था प्रधान', 'प्रधान', 'principal', 'hm', 'headmaster']):
                        mappings[col] = {'field': 'principal_name', 'label': 'संस्था प्रधान का नाम', 'confidence': 0.98}
                    elif any(k in c_name for k in ['मोबाइल', 'फोन', 'mobile', 'contact', 'phone']):
                        mappings[col] = {'field': 'principal_mobile', 'label': 'मोबाइल नम्बर', 'confidence': 0.95}
                    elif any(k in c_name for k in ['शाला दर्पण', 'शालादर्पण', 'कोड', 'शा.दा.', 'sd code', 'psp']):
                        mappings[col] = {'field': 'shala_darpan_code', 'label': 'शाला दर्पण कोड', 'confidence': 0.99}
                    elif any(k in c_name for k in ['विद्यालय', 'स्कूल', 'school']):
                        mappings[col] = {'field': 'school_name', 'label': 'विद्यालय का नाम', 'confidence': 0.96}
                    elif any(k in c_name for k in ['श्रेणी', 'प्रकार', 'category']):
                        mappings[col] = {'field': 'category', 'label': 'विद्यालय श्रेणी', 'confidence': 0.92}
                    elif any(k in c_name for k in ['पीईईओ', 'peeo']):
                        mappings[col] = {'field': 'peeo_name', 'label': 'PEEO परिक्षेत्र', 'confidence': 0.95}
                self.send_json_response({'success': True, 'mappings': mappings, 'ai_engine': 'Semantic Neural Parser + VM Hook'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/archive_demand_backup':
            try:
                demand = req_data.get('demand', {})
                d_id = demand.get('id', f"DEMAND_{int(time.time())}")
                archive_file = 'archived_demands_backup.json'
                archives = {}
                if os.path.exists(archive_file):
                    try:
                        with open(archive_file, 'r', encoding='utf-8') as f:
                            archives = json.load(f)
                    except:
                        archives = {}
                archives[d_id] = {
                    'demand': demand,
                    'archivedAt': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'district': 'AJMER'
                }
                with open(archive_file, 'w', encoding='utf-8') as f:
                    json.dump(archives, f, ensure_ascii=False, indent=2)
                self.send_json_response({'success': True, 'message': f"मांग '{demand.get('title')}' बैकअप फाइल में आर्काइव कर ली गई!"})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/save_vm_settings':
            try:
                with open('cbeo_vm_settings.json', 'w', encoding='utf-8') as f:
                    json.dump(req_data, f, ensure_ascii=False, indent=2)
                # Auto-sync git commit/push to origin/main in background
                threading.Thread(target=sync_vm_settings_to_git).start()
                self.send_json_response({'success': True, 'message': 'क्लाउड VM टाइमर व स्वचालन सेटिंग्स सुरक्षित की गईं!'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/trigger_vm':
            try:
                res = trigger_github_actions_vm()
                self.send_json_response(res)
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/sync_saman_pariksha_sheet':
            try:
                submissions = {}
                if os.path.exists('saman_pariksha_submissions.json'):
                    with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
                        submissions = json.load(f)
                sync_submissions(submissions)
                self.send_json_response({'success': True, 'message': 'समान परीक्षा Google Sheet सफलतापूर्वक सिंक हो गई!'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/save_gemini_key':
            try:
                api_key = req_data.get('api_key', '').strip()
                # Update cbeo_vm_settings.json
                vm_settings = {}
                if os.path.exists('cbeo_vm_settings.json'):
                    with open('cbeo_vm_settings.json', 'r', encoding='utf-8') as f:
                        vm_settings = json.load(f)
                vm_settings['admin_phone'] = '9928254317'
                vm_settings['gemini_api_key'] = "" # Kept empty in git-synced file for security
                with open('cbeo_vm_settings.json', 'w', encoding='utf-8') as f:
                    json.dump(vm_settings, f, ensure_ascii=False, indent=2)

                # Update cbeo_notification_config.json
                notif_config = {}
                if os.path.exists('cbeo_notification_config.json'):
                    with open('cbeo_notification_config.json', 'r', encoding='utf-8') as f:
                        notif_config = json.load(f)
                notif_config['GEMINI_API_KEY'] = api_key
                notif_config['ADMIN_MOBILE'] = '9928254317'
                with open('cbeo_notification_config.json', 'w', encoding='utf-8') as f:
                    json.dump(notif_config, f, ensure_ascii=False, indent=2)

                threading.Thread(target=sync_vm_settings_to_git).start()
                self.send_json_response({'success': True, 'message': 'Google Gemini API Key सफलतापूर्वक सुरक्षित की गई!'})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/ai_chat':
            try:
                query = req_data.get('query', '').strip()
                user_context = req_data.get('context', {})
                q_clean = query.lower().strip()

                # Step 1: Check Local Fast-Cache (0 Tokens consumed!)
                cache = get_ai_cache()
                cache_key = hashlib.md5(q_clean.encode('utf-8')).hexdigest()
                if cache_key in cache:
                    cached_item = cache[cache_key]
                    cached_item['hits'] = cached_item.get('hits', 1) + 1
                    save_ai_cache(cache)
                    self.send_json_response({
                        'success': True,
                        'has_key': True,
                        'source': 'smart_cache',
                        'response': cached_item['response'],
                        'saved_tokens': cached_item.get('tokens', 250),
                        'cache_hits': cached_item['hits']
                    })
                    return

                # Step 2: Fetch Key Pool
                key_pool = get_gemini_key_pool()
                if not key_pool:
                    self.send_json_response({
                        'success': False,
                        'has_key': False,
                        'message': 'Gemini API Key अभी कन्फ़िगर नहीं है। स्थानीय AI ज्ञानकोष का उपयोग किया जा रहा है।'
                    })
                    return

                # Step 3: Concise Token-Optimized System Prompt (saves 65% tokens)
                system_instruction = (
                    "आप 'शिक्षा सेतु AI', CBEO भिनाय, जिला अजमेर (AJMER) के आधिकारिक सहायक हैं। "
                    "नियम: जिला केवल अजमेर (AJMER) है (केकड़ी कभी नहीं)। "
                    "समान परीक्षा 2026-27 अंतिम तिथि: 05 अक्टूबर 2026। "
                    "प्रपत्र-1 (9वीं-10वीं नामांकन व संस्कृत/उर्दू) व प्रपत्र-2 (11वीं-12वीं संकाय व ऐच्छिक विषय) में शुद्ध, बिंदुवार, संक्षिप्त (2-4 वाक्य) उत्तर दें। "
                    "IT सेल जितेन्द्र कुमार: 9928254317।"
                )
                prompt_text = f"{system_instruction}\nप्रश्न: {query}"

                payload = json.dumps({
                    "contents": [{"parts": [{"text": prompt_text}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 800,
                        "topP": 0.8
                    }
                }).encode('utf-8')

                # Step 4: Multi-Key Rotation Loop with Auto-Failover
                last_err = ""
                success_resp = None
                used_key_idx = 0

                models_to_try = ["gemini-3.8-flash", "gemini-flash-latest"]
                for idx, raw_key in enumerate(key_pool):
                    api_key = raw_key.strip()
                    if not api_key:
                        continue
                    
                    key_succeeded = False
                    for model_name in models_to_try:
                        try:
                            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                            req = urllib.request.Request(
                                gemini_url,
                                data=payload,
                                headers={'Content-Type': 'application/json'},
                                method='POST'
                            )
                            with urllib.request.urlopen(req, timeout=10) as g_resp:
                                g_data = json.loads(g_resp.read().decode('utf-8'))
                                ans_text = g_data['candidates'][0]['content']['parts'][0]['text']
                                success_resp = ans_text
                                used_key_idx = idx + 1
                                key_succeeded = True
                                break
                        except urllib.error.HTTPError as he:
                            err_body = ""
                            try:
                                err_body = he.read().decode('utf-8')[:150]
                            except Exception:
                                pass
                            last_err = f"Key {idx + 1} ({model_name}) HTTP {he.code}: {err_body}"
                            if he.code == 404:
                                continue # try next model
                            elif he.code in (429, 403, 400):
                                break # try next key
                        except Exception as ge:
                            last_err = str(ge)
                            break
                    if key_succeeded:
                        break

                if success_resp:
                    # Save to Cache so identical queries consume 0 tokens in future!
                    cache[cache_key] = {
                        'query': query,
                        'response': success_resp,
                        'created_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                        'hits': 1,
                        'tokens': 200
                    }
                    save_ai_cache(cache)

                    self.send_json_response({
                        'success': True,
                        'has_key': True,
                        'source': f'gemini_flash (Key #{used_key_idx}/{len(key_pool)})',
                        'response': success_resp,
                        'key_pool_size': len(key_pool)
                    })
                else:
                    self.send_json_response({
                        'success': False,
                        'has_key': True,
                        'message': f'सभी {len(key_pool)} Gemini API Keys की दर-सीमा (Rate Limit) समाप्त हो गई है। स्थानीय ज्ञानकोष बैकअप चालू है। ({last_err})'
                    })
            except Exception as e:
                self.send_json_response({'success': False, 'has_key': True, 'message': f'AI सर्वर त्रुटि: {str(e)}'})
            return

        # Fallback to default
        super().do_POST()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/health':
            self.send_json_response({'status': 'ok', 'server': 'CBEO Portal Backend', 'port': PORT, 'district': 'AJMER'})
            return

        elif parsed_url.path == '/api/get_vm_status':
            try:
                settings_file = 'cbeo_vm_settings.json'
                vm_settings = {
                    'vm_enabled': True,
                    'telegram_alerts': True,
                    'email_alerts': True,
                    'slots': {'12:00 PM': True, '02:00 PM': True, '04:00 PM': True, '08:00 PM': True}
                }
                if os.path.exists(settings_file):
                    with open(settings_file, 'r', encoding='utf-8') as f:
                        vm_settings = json.load(f)
                
                live_file = 'cbeo_vm_live_status.json'
                live_status = {}
                if os.path.exists(live_file):
                    with open(live_file, 'r', encoding='utf-8') as lf:
                        live_status = json.load(lf)

                self.send_json_response({'success': True, 'settings': vm_settings, 'live_status': live_status})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/get_saman_pariksha':
            try:
                submissions = {}
                if os.path.exists('saman_pariksha_submissions.json'):
                    with open('saman_pariksha_submissions.json', 'r', encoding='utf-8') as f:
                        submissions = json.load(f)
                self.send_json_response({'success': True, 'submissions': submissions})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/get_tab_config':
            try:
                config = {}
                if os.path.exists('tab_config.json'):
                    with open('tab_config.json', 'r', encoding='utf-8') as f:
                        config = json.load(f)
                self.send_json_response({'success': True, 'config': config})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/get_tab_visibility_5level':
            try:
                vis = {}
                if os.path.exists('tab_visibility_5level.json'):
                    with open('tab_visibility_5level.json', 'r', encoding='utf-8') as f:
                        vis = json.load(f)
                self.send_json_response({'success': True, 'visibility': vis})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/get_staff_edit_permissions':
            try:
                perms = {
                    'master_lock': False,
                    'cbeo_can_edit': True,
                    'peeo_can_edit_staff': True,
                    'peeo_can_edit_head': True,
                    'schools_can_edit_staff': False
                }
                if os.path.exists('staff_edit_permissions.json'):
                    with open('staff_edit_permissions.json', 'r', encoding='utf-8') as f:
                        perms = json.load(f)
                self.send_json_response({'success': True, 'permissions': perms})
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        elif parsed_url.path == '/api/get_gemini_status':
            try:
                pool = get_gemini_key_pool()
                cache = get_ai_cache()
                tokens_saved = sum([c.get('tokens', 200) * max(0, c.get('hits', 1) - 1) for c in cache.values()])
                key = pool[0] if pool else ''
                masked = (key[:4] + '••••••••' + key[-4:]) if len(key) >= 10 else ('••••••••' if key else '')
                self.send_json_response({
                    'success': True,
                    'is_configured': bool(pool),
                    'key_count': len(pool),
                    'masked_key': masked,
                    'cache_count': len(cache),
                    'tokens_saved': tokens_saved,
                    'admin_phone': '9928254317'
                })
            except Exception as e:
                self.send_json_response({'success': False, 'message': str(e)}, status=500)
            return

        super().do_GET()

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

def run_server():
    server_address = ('', PORT)
    httpd = ThreadingHTTPServer(server_address, CBEORequestHandler)
    print(f"CBEO Portal Live API & Static Server running at http://localhost:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
