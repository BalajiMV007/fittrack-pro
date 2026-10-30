import sys
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stderr.flush()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    PORT = 8000
    server_address = ('127.0.0.1', PORT)
    try:
        httpd = ThreadingHTTPServer(server_address, NoCacheHandler)
        httpd.daemon_threads = True
        print(f"FitTrack Server active at http://localhost:{PORT} and http://127.0.0.1:{PORT}")
        sys.stdout.flush()
        httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
        sys.exit(1)
