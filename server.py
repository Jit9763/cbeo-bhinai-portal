import os
import sys
import json
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from sync_admin_access_sheet import update_single_password, sync_full_admin_sheet
from sync_saman_pariksha_to_sheet import sync_submissions

PORT = 8089

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

        if parsed_url.path == '/api/update_password':
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
