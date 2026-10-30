import sys
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class RobustNoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Concise logging to keep server console clean and responsive
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stderr.flush()

class RobustServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    # Ensure current working directory is the project directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    PORT = 8000
    server_address = ('0.0.0.0', PORT)
    httpd = RobustServer(server_address, RobustNoCacheHandler)
    print(f"FitTrack Robust Server active at http://localhost:{PORT} and http://127.0.0.1:{PORT}")
    sys.stdout.flush()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()
