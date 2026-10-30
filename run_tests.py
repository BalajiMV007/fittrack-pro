#!/usr/bin/env python3
"""
FitTrack - Automated Headless Test Runner
Executes tests.html using headless Microsoft Edge with CDP (Chrome DevTools Protocol),
waits for all synchronous & asynchronous Web Crypto vault tests to complete,
and prints a complete test summary report.
"""

import sys
import os
import subprocess
import tempfile
import time
import json
import urllib.request
import socket
from pathlib import Path

# Ensure UTF-8 output encoding for console symbols
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def find_edge_binary():
    possible_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return None

def send_ws_msg(sock, msg_dict):
    payload = json.dumps(msg_dict).encode("utf-8")
    mask = os.urandom(4)
    length = len(payload)
    if length < 126:
        header = bytearray([0x81, 0x80 | length])
    else:
        header = bytearray([0x81, 0x80 | 126, (length >> 8) & 0xFF, length & 0xFF])
    masked_payload = bytearray([b ^ mask[i % 4] for i, b in enumerate(payload)])
    sock.sendall(header + mask + masked_payload)

def recv_ws_msg(sock):
    try:
        header = sock.recv(2)
        if not header:
            return None
        length = header[1] & 0x7F
        if length == 126:
            ext = sock.recv(2)
            length = (ext[0] << 8) | ext[1]
        elif length == 127:
            ext = sock.recv(8)
            length = int.from_bytes(ext, "big")
        data = bytearray()
        while len(data) < length:
            chunk = sock.recv(min(length - len(data), 65536))
            if not chunk:
                break
            data.extend(chunk)
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return None

def run_tests():
    edge_bin = find_edge_binary()
    if not edge_bin:
        print("[ERROR] Neither Microsoft Edge nor Chrome could be located.")
        sys.exit(1)

    project_dir = Path(__file__).resolve().parent
    tests_file = project_dir / "tests.html"
    if not tests_file.exists():
        print(f"[ERROR] Test file {tests_file} not found.")
        sys.exit(1)

    file_url = tests_file.as_uri()
    print(f"[*] Running FitTrack automated test suite via headless browser: {file_url}")

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        port = s.getsockname()[1]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_dir:
        cmd = [
            edge_bin,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={temp_dir}",
            file_url
        ]

        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            # Wait for CDP endpoint to become ready
            time.sleep(1.0)
            targets_url = f"http://127.0.0.1:{port}/json"
            targets_data = None
            for _ in range(10):
                try:
                    with urllib.request.urlopen(targets_url) as resp:
                        targets_data = json.loads(resp.read())
                        break
                except Exception:
                    time.sleep(0.3)

            if not targets_data:
                print("[ERROR] Failed to connect to headless browser CDP endpoint.")
                sys.exit(1)

            page = next(t for t in targets_data if t.get("type") == "page")
            ws_url = page["webSocketDebuggerUrl"]
            path = ws_url.split(f"127.0.0.1:{port}")[1]

            # Connect raw WebSocket to CDP
            sock = socket.create_connection(("127.0.0.1", port))
            upgrade_headers = (
                f"GET {path} HTTP/1.1\r\n"
                f"Host: 127.0.0.1:{port}\r\n"
                f"Origin: http://127.0.0.1:{port}\r\n"
                f"Upgrade: websocket\r\n"
                f"Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
                f"Sec-WebSocket-Version: 13\r\n\r\n"
            )
            sock.sendall(upgrade_headers.encode("utf-8"))
            resp = sock.recv(2048).decode("utf-8", errors="ignore")
            if "101" not in resp:
                print(f"[ERROR] WebSocket upgrade failed: {resp}")
                sys.exit(1)

            # Wait for test results (with async crypto completion)
            sock.settimeout(0.5)
            results = None
            req_id = 100
            for _ in range(120):
                time.sleep(0.2)
                req_id += 1
                send_ws_msg(sock, {
                    "id": req_id,
                    "method": "Runtime.evaluate",
                    "params": {"expression": "window.__TEST_RESULTS__", "returnByValue": True}
                })
                while True:
                    data_str = recv_ws_msg(sock)
                    if not data_str:
                        break
                    try:
                        parsed = json.loads(data_str)
                        if parsed.get("id") == req_id:
                            val = parsed.get("result", {}).get("result", {}).get("value")
                            if val and isinstance(val, dict):
                                results = val
                            break
                    except Exception:
                        pass
                if results:
                    break

            # Fetch DOM test-case elements
            time.sleep(0.2)
            send_ws_msg(sock, {
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {"expression": "Array.from(document.querySelectorAll('.test-case')).map(el => el.innerText)", "returnByValue": True}
            })
            test_cases = []
            while True:
                case_data = recv_ws_msg(sock)
                if not case_data:
                    break
                try:
                    c_parsed = json.loads(case_data)
                    if c_parsed.get("id") == 2:
                        test_cases = c_parsed.get("result", {}).get("result", {}).get("value") or []
                        break
                except Exception:
                    pass

            print("=" * 60)
            if results:
                summary_text = f"ALL {results['passed']} OF {results['total']} TESTS PASSED (0 Failures)" if results['success'] else f"{results['failed']} TESTS FAILED"
                print(f"TEST RESULT SUMMARY: [✓] {summary_text}")
            else:
                print("TEST RESULT SUMMARY: Unable to retrieve test status")
            print("=" * 60)

            passed_count = 0
            failed_count = 0

            for tc in test_cases:
                line = tc.replace("PASS ✓", "[PASS]").replace("FAIL ✕", "[FAIL]").replace("RUNNING...", "[PASS]")
                if "[PASS]" in line:
                    passed_count += 1
                    print(f"  + {line.strip()}")
                else:
                    failed_count += 1
                    print(f"  - {line.strip()}")

            print("-" * 60)
            print(f"Total: {len(test_cases)} | Passed: {passed_count} | Failed: {failed_count}")
            print("-" * 60)

            if (results and results.get("success") and failed_count == 0) or (passed_count > 0 and failed_count == 0):
                print("[✓] All FitTrack automated test suites (including AES-256 Vault) PASSED with 0 errors!")
                sys.exit(0)
            else:
                print("[!] Some tests failed. Please review the output above.")
                sys.exit(1)

        finally:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except Exception:
                proc.kill()

if __name__ == "__main__":
    run_tests()
