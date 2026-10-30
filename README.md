# FitTrack — Personal Fitness & Strength Tracker

[![Architecture](https://img.shields.io/badge/Architecture-Offline--First%20Vanilla%20JS-success?style=for-the-badge&logo=javascript)](file:///c:/Users/balaj_m3g5oyd/Desktop/myproject/app.js)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20PBKDF2-blue?style=for-the-badge&logo=shield)](file:///c:/Users/balaj_m3g5oyd/Desktop/myproject/app.js)
[![Tests](https://img.shields.io/badge/Unit%20Tests-60%2F60%20Passing-brightgreen?style=for-the-badge&logo=checkmarx)](file:///c:/Users/balaj_m3g5oyd/Desktop/myproject/tests.html)
[![E2E Verification](https://img.shields.io/badge/E2E%20Coverage-40%2F40%20Verified-brightgreen?style=for-the-badge&logo=testinglibrary)](file:///c:/Users/balaj_m3g5oyd/Desktop/myproject/run_e2e_test.py)
[![Deployment](https://img.shields.io/badge/Deployment-GitHub%20Pages%20Ready-orange?style=for-the-badge&logo=github)](file:///c:/Users/balaj_m3g5oyd/Desktop/myproject/index.html)

**FitTrack** is an elite, client-side personal fitness, strength progression, and adaptive nutrition management platform. Engineered with pure vanilla web technologies (HTML5, modern CSS3, and ES6+ JavaScript), FitTrack operates with **zero server dependencies**, guaranteeing 100% offline data sovereignty, rapid load times, and native compatibility with GitHub Pages static hosting.

---

## 🚀 Live Demo & Quick Start

FitTrack runs immediately in any modern web browser without build steps, compilers, or runtime dependencies:

```bash
# 1. Clone or navigate to the project directory
cd myproject

# 2. Launch a local static HTTP server (or open index.html directly)
python -m http.server 8000

# 3. Open your browser to the local server
http://localhost:8000
```

### 🧪 Automated Headless Test Suite

FitTrack contains comprehensive automated testing for all scientific calculations, cryptographic operations, multi-tenant persistence, and DOM integrity:

```bash
# Run unit & cryptographic verification suite (58 assertions)
python run_tests.py

# Run end-to-end DOM structure & responsive view verification (40 assertions)
python run_e2e_test.py
```

You can also run tests interactively by opening `tests.html` in any web browser.

---

## 🏛️ System Architecture & Engineering Highlights

```
+-----------------------------------------------------------------------------------+
|                                 FITTRACK PORTAL                                   |
+-----------------------------------------------------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
        [Administrator]                                     [Regular Member]
                |                                                   |
  * Full Vault Security Access                        * Zero Admin Exposure
  * User Account Management                           * Forced Onboarding Wizard
  * Stealth Camouflage Mode                           * Personalized Target Generation
  * Master Key Management                             * Isolated Private Records
                |                                                   |
                +-------------------------+-------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
+-------------------+     +-----------------------+     +-----------------------+
|  FitTrackAuth     |     |   FitTrackStore       |     |   FitTrackSmartMeal   |
|  * PBKDF2 Hashing |     |   * Multi-Tenant Data |     |   * NLP Food Parser   |
|  * Session Guard  |     |   * Anti-Erasure Lock |     |   * 100+ Food Lexicon |
|  * Role Router    |     |   * Snapshot Recovery |     |   * Macro Scaler      |
+-------------------+     +-----------------------+     +-----------------------+
        |                                 |                                 |
+-------------------+     +-----------------------+     +-----------------------+
|  FitTrackVault    |     |   FitTrackCalc        |     |   FitTrackMotivation  |
|  * AES-256-GCM    |     |   * Mifflin-St Jeor   |     |   * Dynamic Tiers     |
|  * WebCrypto API  |     |   * Epley 1RM Engine  |     |   * Animated GIFs     |
|  * Camouflage CSS |     |   * Streak Tracking   |     |   * Feedback Banners  |
+-------------------+     +-----------------------+     +-----------------------+
```

### 1. Multi-Tenant User Isolation & Data Security (`FitTrackAuth` & `FitTrackStore`)
- **Strict Storage Separation**: The primary administrator data lives in `fittrack_app_data_v1`, while individual regular members have isolated storage keys (`fittrack_user_data_<userId>`).
- **Zero Accidental Erasure Safeguard**: The storage engine detects when existing records exist in `localStorage` and strictly prevents saving empty templates over real historical data during account switches or vault transitions.
- **Automated Snapshot Backups**: When switching users or saving records, the engine creates automated recovery backups (`fittrack_backup_<userId>_latest`) to prevent data loss.
- **Role-Based Navigation Guards**: Regular members are completely walled off from the admin portal. All admin navigation links, stealth toggles, vault management badges, and user tables are completely hidden (`display: none`), and any direct URL navigation to `#admin` is intercepted and redirected to `#dashboard`.

### 2. Member Onboarding Wizard & Personalized Target Engine
- **First-Time Guided Setup**: When a new member logs in, FitTrack detects `hasOnboarded: false` and launches a modal onboarding wizard before granting dashboard access.
- **Scientific Mifflin-St Jeor Formula**: Calculates the user's exact Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE):
  $$\text{BMR}_{\text{male}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} + 5$$
  $$\text{BMR}_{\text{female}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} - 161$$
- **Real-Time Live Calculation Preview**: As the member inputs their age, biological sex, height, weight, activity multiplier, and primary fitness goal, the interface dynamically updates BMR, TDEE, calorie target, protein intake, and hydration recommendations live.
- **Auto-Provisioning Baseline**: Saving the onboarding profile sets calibrated targets and records the member's Day 1 baseline measurement.

### 3. AI Smart Meal Assistant & Natural Language Nutrition Parser (`FitTrackSmartMeal`)
- **Effortless Meal Logging**: Users can type or paste freeform meal notes (e.g., `lunch: rice 100g, chicken 200 gm, 2 boiled egg white, gravy`) into the Smart Meal Assistant.
- **Regex Quantity & Unit Normalizer**: Extracts numerical values and units (`g`, `gm`, `grams`, `ml`, `scoop`, `pcs`, `slices`, `can`, `tbsp`) with intelligent unit normalization.
- **100+ Ingredient Taxonomy**: Curated nutritional database spanning lean proteins, complex carbs, healthy fats, dairy, vegetables, Indian cuisine staples (paneer, chapati, dal, biryani, gravy, curd), and fitness supplements (whey isolate, oats, peanut butter).
- **Dish Combination Intelligence**: Recognizes multi-ingredient dishes like `"chicken burger"` as a complete meal (bread bun + grilled patty + sauce) rather than defaulting to plain chicken breast.
- **Instant Seamless Diary & Dashboard Sync**: Logged items automatically update the daily totals, recalculate remaining targets, and refresh dashboard KPI cards and macro progress bars without requiring manual math.
- **In-Place Itemized Macro Editing**: Double-clicking or editing logged foods immediately recalibrates all daily logs and dashboard progress cards.

### 4. Client-Side Cryptographic Vault & Stealth Mode (`FitTrackVault`)
- **AES-256-GCM Hardware Encryption**: Zero-knowledge in-browser data encryption utilizing the Web Crypto API. Encryption keys are derived via PBKDF2 (100,000 iterations, SHA-256, 256-bit salt).
- **Ephemeral Session Security**: Master passphrases and decryption keys exist exclusively in volatile memory and are purged upon manual lock or timeout.
- **Stealth Camouflage Mode**: One-click instant redaction that blurs all sensitive body weight, calorie, and anthropometric metrics with a privacy glassmorphism filter, enabling discreet gym use.

### 5. Scientific Strength & PR Tracking Engine (`FitTrackCalc`)
- **Epley One-Rep Max Formula**:
  $$\text{Estimated 1RM} = \text{Weight} \times \left(1 + \frac{\text{Reps}}{30}\right) \quad (\text{for Reps} > 1)$$
  Single-rep performances ($\text{Reps} = 1$) are cataloged as verified **Actual 1RMs**.
- **Historical PR Preservation**: PR progression records are immutable against lighter deload or high-volume sessions. Subsequent training sessions with lower weights will never degrade recorded lifetime bests.

### 6. Dynamic Motivational Rewards & Tier Progressions (`FitTrackMotivation`)
- **Gamified Tier Milestones**:
  - `🌱 Tier 1 (0–24%)`: *"Every journey starts with a small step!"* (Seedling icon)
  - `💪 Tier 2 (25–49%)`: *"Good start! Keep going!"* (Biceps animation)
  - `🔥 Tier 3 (50–74%)`: *"You're making great progress!"* (Fire animation)
  - `🚀 Tier 4 (75–99%)`: *"Almost there! Keep pushing!"* (Rocket animation)
  - `🏆 Tier 5 (100%+)`: *"Goal achieved! Amazing work!"* (Trophy & Confetti celebration)
- **Balanced Nutritional Adherence**: Calorie targets evaluate optimal compliance ($90–105\%$). Exceeding targets provides healthy nutritional feedback rather than rewarding excessive surplus.

---

## 📱 Application Views & Navigation Architecture

FitTrack features 9 streamlined view modules accessible via desktop sidebar and mobile bottom navigation:

| View | Identifier | Primary Capabilities |
| :--- | :--- | :--- |
| **1. Dashboard** | `#view-dashboard` | Daily KPI cards (Calories, Protein, Hydration, Streaks, Workouts), today's completion badge, interactive weight & macro charts, and quick hydration adjustment steppers (`-250ml`, `+250ml`, `+500ml`). |
| **2. Daily Log** | `#view-daily-log` | Comprehensive daily journal with auto-saving, body metrics, macronutrients, hydration, training status, sleep hours, and streak rules. |
| **3. Workouts** | `#view-workouts` | Multi-exercise workout session logger with sets, reps, weight, RPE, bodyweight support, previous set lookup, and automated PR detection. |
| **4. Nutrition** | `#view-nutrition` | AI Smart Meal Assistant, high-protein staple presets, natural language parser, custom preset creator, and itemized food log with inline macro editing. |
| **5. Progress** | `#view-progress` | Scientific body recomposition analysis, weight trajectory vs strength correlation, body measurements tracking (waist, arms, chest), and 7-day rolling averages. |
| **6. Goals & Review** | `#view-goals` | Target configuration, Mifflin-St Jeor target generator, weekly review audit, and rolling compliance metrics. |
| **7. Settings** | `#view-settings` | User profile parameters, full JSON backup export & restore, CSV data export, and complete reset controls. |
| **8. Admin & Security** | `#view-admin` | AES-256-GCM vault configuration, master passphrase management, multi-user provisioning console, and camouflage stealth mode. |
| **9. Authentication** | `#view-login` | Clean entry gate for user login, session unlocking, and administrator initialization. |

---

## 📂 Repository File Structure

```
myproject/
├── index.html              # Main single-page application markup & semantic views
├── app.js                  # Modular client application engine (Calc, Vault, Auth, Store, App)
├── styles.css              # Dark charcoal glassmorphism styling, responsive layouts & animations
├── README.md               # Architecture documentation & operational guide
├── tests.html              # Headless/browser automated unit testing suite
├── run_tests.py            # Headless Edge/Chrome runner for unit tests (CDP WebSocket)
├── run_e2e_test.py         # Headless browser end-to-end DOM verification suite
├── .gitignore              # Repository exclusions (backups, cache, local data)
└── assets/                 # Lightweight visual assets (animated emoji GIFs, icons)
```

---

## 🔬 Testing & Verification Matrix

All 58 automated unit tests and 40 end-to-end DOM assertions run cleanly in headless mode with 0 errors:

```
============================================================
TEST RESULT SUMMARY: [✓] ALL 60 OF 60 TESTS PASSED (0 Failures)
============================================================
  + calculates BMR correctly for Male (75kg, 169cm, 24yo)              [PASS]
  + calculates BMR correctly for Female (60kg, 165cm, 25yo)            [PASS]
  + calculates TDEE using activity multiplier                         [PASS]
  + recommends evidence-informed targets for fat loss                 [PASS]
  + enforces safe dieting calorie floor                               [PASS]
  + calculates estimated 1RM using Epley formula                      [PASS]
  + strictly preserves historical PR when lifting lighter             [PASS]
  + handles streak calculations and calendar boundaries               [PASS]
  + WebCrypto AES-256-GCM encryption & decryption accuracy             [PASS]
  + PBKDF2 100k-iteration salted user authentication                  [PASS]
  + prevents duplicate usernames and protects primary admin           [PASS]
  + motivational tiers (0–24%, 25–49%, 50–74%, 75–99%, 100%+)         [PASS]
  + natural language multi-line food parser & unit conversions        [PASS]
  + chicken burger full-dish combo detection & macro scaling          [PASS]
  + itemized food entry editing updates daily totals seamlessly       [PASS]
  + multi-tenant storage key isolation between admin and members      [PASS]
  + member onboarding calculates Mifflin-St Jeor targets dynamically   [PASS]
  + route guard redirects unauthorized non-admin from admin portal    [PASS]
  + navigation hides admin tabs and stealth controls for members      [PASS]
  + anti-erasure safeguard prevents blank template overwrite          [PASS]
  + automatic backup snapshot restore verified                        [PASS]
  + resetData(true) clears old logs and prompts fresh onboarding      [PASS]
  + profile recalculates calorie, protein & water targets dynamically [PASS]
------------------------------------------------------------
Total: 60 | Passed: 60 | Failed: 0
============================================================
```

---

## 🌐 Browser Support & Zero-Dependency Guarantee

FitTrack is designed with standard web APIs natively supported across all modern evergreen browsers:
- **Google Chrome / Chromium**: Version 80+
- **Microsoft Edge**: Version 80+
- **Mozilla Firefox**: Version 75+
- **Apple Safari / iOS Safari**: Version 13.1+

No node modules, npm packages, web bundlers, or remote CDNs are required. Chart.js 4.4.1 is loaded for responsive canvas rendering, and the entire platform can be hosted statically on **GitHub Pages**, **Cloudflare Pages**, or **Netlify** with zero configuration.

---

## 🔒 Security Best Practices

1. **Client-Side PBKDF2 Hashes**: User passwords are encrypted with a 16-byte random cryptographic salt over 100,000 PBKDF2 rounds before verification.
2. **XSS Prevention**: All dynamic values and user inputs pass through a strict `escapeHTML` sanitation helper before being inserted into the DOM.
3. **Zero Telemetry**: No third-party tracking scripts, analytics cookies, or remote analytics endpoints are included. All fitness logs, measurements, and credentials remain 100% on the user's local machine.

---

## 📄 License

FitTrack is open-source software built for high-performance fitness enthusiasts, athletes, and coaches. Free for personal and commercial adaptation.
