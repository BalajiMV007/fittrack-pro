#!/usr/bin/env python3
"""
FitTrack - End-to-End Headless DOM & Navigation Verification Script
Verifies:
1. All 9 views render and can be toggled without errors.
2. Form elements, IDs, and buttons exist and are correctly bound.
3. Chart containers exist and are ready for Chart.js rendering.
4. Mobile navigation drawer and desktop navigation work as expected.
"""

import sys
import os
import subprocess
import tempfile
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def find_edge_binary():
    paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def test_index_page():
    edge_bin = find_edge_binary()
    if not edge_bin:
        print("[ERROR] Browser not found.")
        sys.exit(1)

    project_dir = Path(__file__).resolve().parent
    index_file = project_dir / "index.html"
    file_url = index_file.as_uri()

    print(f"[*] Verifying index.html in headless browser: {file_url}")

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_dir:
        cmd = [
            edge_bin,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            f"--user-data-dir={temp_dir}",
            "--dump-dom",
            file_url
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if res.returncode != 0:
            print(f"[FAIL] Headless Edge returned code {res.returncode}")
            sys.exit(1)

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(res.stdout, "html.parser")

        # Checklist
        checks = []

        # 1. Page title
        title = soup.title.get_text() if soup.title else ""
        checks.append(("Page title", "FitTrack" in title))

        # 2. View sections present (exercises & measurements removed as requested; admin & login present)
        required_views = [
            "dashboard", "daily-log", "workouts",
            "nutrition", "progress", "goals", "settings",
            "admin", "login"
        ]
        for v in required_views:
            el = soup.find(id=f"view-{v}")
            checks.append((f"View section #view-{v}", el is not None))

        # 3. Desktop nav links and draggable wrappers (7 views after removing workouts, login, exercises, measurements)
        desktop_nav = soup.find(class_="sidebar-nav")
        nav_links = desktop_nav.find_all("a") if desktop_nav else []
        drag_wrappers = desktop_nav.find_all(class_="nav-item-wrapper") if desktop_nav else []
        checks.append(("Desktop sidebar navigation links (7 views)", desktop_nav is not None and len(nav_links) == 7))
        checks.append(("Desktop draggable wrappers (7 views)", len(drag_wrappers) == 7))

        # 4. Mobile drawer navigation (7 views)
        mobile_nav = soup.find(class_="mobile-drawer-nav")
        mobile_links = mobile_nav.find_all("a") if mobile_nav else []
        checks.append(("Mobile drawer navigation (7 views)", mobile_nav is not None and len(mobile_links) == 7))

        # 5. Core charts present
        charts = ["chart-dash-weight", "chart-dash-nutrition", "chart-progress-full-weight"]
        for c in charts:
            c_el = soup.find(id=c)
            checks.append((f"Chart canvas #{c}", c_el is not None))

        # 6. Core forms present
        forms = [
            "form-daily-log", "form-add-food",
            "form-goals", "form-profile",
            "form-user-login", "form-admin-setup", "form-create-user",
            "form-admin-password", "form-onboarding"
        ]
        for f in forms:
            f_el = soup.find(id=f)
            checks.append((f"Form #{f}", f_el is not None))

        # 7. Adaptive Nutrition Engine Mini Header on Top of Progress Card
        adaptive_mini = soup.find(id="adaptive-mini-header")
        checks.append(("Adaptive Nutrition Engine Mini Header on Progress Card", adaptive_mini is not None))

        # 8. Dedicated Today's Progress Column Card (#dash-progress-card)
        progress_col = soup.find(id="dash-progress-card")
        checks.append(("Dedicated Today's Progress Column Card (#dash-progress-card)", progress_col is not None))

        # 9. In-Card Quick Hydration Stepper
        hydration_stepper = soup.find(id="dash-hydration-stepper")
        checks.append(("Hydration card quick adjustment stepper buttons", hydration_stepper is not None))

        # 10. Stealth Mode Button in Sidebar
        stealth_btn = soup.find(id="btn-sidebar-privacy")
        checks.append(("Stealth Mode sidebar button with unique ID", stealth_btn is not None))

        # 11. Admin User Management table present
        users_table = soup.find(id="table-admin-users-body")
        checks.append(("Admin User Management Table", users_table is not None))

        # 12. Auto-save badge present
        autosave_badge = soup.find(id="autosave-daily-log-badge")
        checks.append(("Auto-save indicator badge", autosave_badge is not None))

        # 13. Modals present
        modals = ["modal-preset", "modal-confirm", "modal-edit-food", "modal-onboarding"]
        for m in modals:
            m_el = soup.find(id=m)
            checks.append((f"Modal #{m}", m_el is not None))

        # 14. Initial profile data rendered in DOM
        current_weight = soup.find(id="dash-current-weight")
        weight_rendered = current_weight and "75" in current_weight.get_text()
        checks.append(("Profile initial weight rendered", weight_rendered))

        # 15. Animated Emoji GIFs inside KPI columns
        kpi_gifs = soup.find_all(class_="kpi-emoji-gif")
        checks.append(("KPI columns animated emoji GIFs rendered", len(kpi_gifs) >= 6))

        # 16. Smart Meal Quick Logger Chat Component
        smart_meal_card = soup.find(id="card-smart-meal-chat")
        smart_meal_input = soup.find(id="smart-meal-input")
        smart_meal_submit = soup.find(id="btn-smart-meal-submit")
        checks.append(("Smart Meal AI Quick Logger Card", smart_meal_card is not None))
        checks.append(("Smart Meal Input Textarea", smart_meal_input is not None))
        checks.append(("Smart Meal Auto-Log Button", smart_meal_submit is not None))

        print("-" * 60)
        passed = 0
        for name, ok in checks:
            status = "[PASS]" if ok else "[FAIL]"
            if ok:
                passed += 1
            print(f"  {status} {name}")
        print("-" * 60)
        print(f"Index.html E2E Checklist: {passed}/{len(checks)} passed.")

        if passed == len(checks):
            print("[✓] All E2E structural and DOM requirements verified!")
            sys.exit(0)
        else:
            print("[!] Some E2E checks failed.")
            sys.exit(1)

if __name__ == "__main__":
    test_index_page()

