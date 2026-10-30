import sys
import os
import json
import socket
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

DEFAULT_USERS = [
    {
        "id": "usr_admin_default",
        "username": "admin",
        "displayName": "Administrator",
        "role": "admin",
        "salt": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
        "passwordHash": "44138abc921d1c95bb573a09516cd4c82e8271fc3d9604b7c5f7f1bf26b6292d",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }
]

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

class FitTrackServerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/users':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            users_file = os.path.join(DATA_DIR, 'users.json')
            if os.path.exists(users_file):
                try:
                    with open(users_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        self.wfile.write(json.dumps(data).encode('utf-8'))
                        return
                except Exception:
                    pass
            # Pre-seed default users if missing or empty
            with open(users_file, 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_USERS, f, indent=2)
            self.wfile.write(json.dumps(DEFAULT_USERS).encode('utf-8'))
            return

        if parsed.path == '/api/data':
            params = parse_qs(parsed.query)
            user = params.get('user', ['admin'])[0].lower()
            safe_user = "".join(c for c in user if c.isalnum() or c in ('_', '-'))
            user_data_file = os.path.join(DATA_DIR, f'data_{safe_user}.json')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if os.path.exists(user_data_file):
                with open(user_data_file, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'{}')
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else b''

        if parsed.path == '/api/users':
            users_file = os.path.join(DATA_DIR, 'users.json')
            try:
                incoming = json.loads(body.decode('utf-8'))
                if isinstance(incoming, list):
                    # Ensure admin is never lost
                    user_map = {}
                    for u in DEFAULT_USERS:
                        user_map[u['username'].lower()] = u
                    for u in incoming:
                        if isinstance(u, dict) and 'username' in u:
                            user_map[u['username'].lower()] = u
                    merged = list(user_map.values())
                    with open(users_file, 'w', encoding='utf-8') as f:
                        json.dump(merged, f, indent=2)
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"success": true}')
                else:
                    raise ValueError('Users payload must be an array')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        if parsed.path == '/api/data':
            params = parse_qs(parsed.query)
            user = params.get('user', ['admin'])[0].lower()
            safe_user = "".join(c for c in user if c.isalnum() or c in ('_', '-'))
            user_data_file = os.path.join(DATA_DIR, f'data_{safe_user}.json')
            try:
                # Validate JSON before saving
                json.loads(body.decode('utf-8'))
                with open(user_data_file, 'wb') as f:
                    f.write(body)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"success": true}')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stderr.flush()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    PORT = 8000
    lan_ip = get_lan_ip()
    server_address = ('0.0.0.0', PORT)
    try:
        httpd = ThreadingHTTPServer(server_address, FitTrackServerHandler)
        httpd.daemon_threads = True
        print("=" * 60)
        print(f"FitTrack Pro Multi-Device Server Active:")
        print(f"  Desktop Local: http://localhost:{PORT}")
        print(f"  Mobile Wi-Fi:  http://{lan_ip}:{PORT}")
        print("=" * 60)
        sys.stdout.flush()
        httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
        sys.exit(1)
