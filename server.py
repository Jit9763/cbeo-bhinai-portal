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
