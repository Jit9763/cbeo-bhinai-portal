import os
import sys
import json
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from sync_admin_access_sheet import update_single_password, sync_full_admin_sheet
from sync_saman_pariksha_to_sheet import sync_submissions
from manage_contacts_and_staff import (
    update_sanstha_pradhan_in_all_files,
    save_or_update_staff_member,
    relieve_or_delete_staff_member
)

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

        # Fallback to default
        super().do_POST()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/health':
            self.send_json_response({'status': 'ok', 'server': 'CBEO Portal Backend', 'port': PORT})
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
