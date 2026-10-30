/**
 * FitTrack - Personal Fitness Tracker & Architecture
 * Core Application Logic & Modular Engine
 * Version 1.0.0
 */

// Strict mode for cleaner code and safety
'use strict';

/**
 * 1. CALCULATOR MODULE (FitTrackCalc)
 * Pure functions for energy expenditure, 1RM, streak calculation, and data aggregation.
 */
const FitTrackCalc = {
  /**
   * Calculate Basal Metabolic Rate using the Mifflin-St Jeor Equation
   * @param {number} weightKg
   * @param {number} heightCm
   * @param {number} age
   * @param {'male'|'female'} sex
   * @returns {number} BMR in kcal
   */
  calculateBMR(weightKg, heightCm, age, sex = 'male') {
    if (!weightKg || !heightCm || !age) return 0;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    const s = String(sex || 'male').toLowerCase();
    return Math.round(s === 'female' ? base - 161 : base + 5);
  },

  /**
   * Calculate Total Daily Energy Expenditure (TDEE)
   * @param {number} bmr
   * @param {number} activityMultiplier - e.g. 1.2 to 1.725
   * @returns {number} TDEE in kcal
   */
  calculateTDEE(bmr, activityMultiplier = 1.6) {
    if (!bmr) return 0;
    return Math.round(bmr * activityMultiplier);
  },

  /**
   * Scientific Lean Body Mass & Target Weight Recomposition Calculator
   * @param {number} weight Current weight in kg
   * @param {number} currentBF Current body fat percentage
   * @param {number} targetBF Achievable goal body fat percentage
   * @returns {Object|null}
   */
  calculateBodyRecomposition(weight, currentBF, targetBF) {
    const w = parseFloat(weight) || 75;
    const cbf = Math.max(5, parseFloat(currentBF) || 22);
    const tbf = Math.max(5, Math.min(30, parseFloat(targetBF) || 10));

    const currentFatMass = Math.round((w * (cbf / 100)) * 10) / 10;
    const leanBodyMass = Math.round((w - currentFatMass) * 10) / 10;

    if (cbf <= tbf) {
      return {
        currentWeight: w,
        currentBF: cbf,
        targetBF: tbf,
        currentFatMass,
        leanBodyMass,
        targetWeight: w,
        fatToLose: 0,
        fatMassToLose: 0,
        estimatedWeeks: 0,
        progressPercent: 100
      };
    }

    // Goal Weight = Lean Body Mass / (1 - Target BF/100)
    const targetWeight = Math.round((leanBodyMass / (1 - (tbf / 100))) * 10) / 10;
    const fatToLose = Math.max(0, Math.round((w - targetWeight) * 10) / 10);
    const estimatedWeeks = Math.max(1, Math.round(fatToLose / 0.5)); // 0.5 kg/week safe fat loss rate
    const progressPercent = Math.min(100, Math.max(0, Math.round(((35 - cbf) / (35 - tbf)) * 100)));
    return {
      currentWeight: w,
      currentBF: cbf,
      targetBF: tbf,
      currentFatMass,
      leanBodyMass,
      targetWeight,
      fatToLose,
      fatMassToLose: fatToLose,
      estimatedWeeks,
      progressPercent
    };
  },

  /**
   * Calculate evidence-based targets for fat loss with muscle retention
   * @param {Object} profile
   * @returns {Object} targets { bmr, tdee, targetCalories, proteinGrams, carbsGrams, fatGrams, proteinRangeMin, proteinRangeMax, deficitKcal, recomp }
   */
  calculateTargets(profile = {}) {
    const weight = parseFloat(profile.weight) || 75;
    const height = parseFloat(profile.height) || 169;
    const age = parseInt(profile.age, 10) || 24;
    const sex = String(profile.sex || 'male').toLowerCase();
    const activityLevel = profile.activityLevel || '1.6';
    const goal = profile.goal || 'fat_loss';
    const bodyFat = profile.bodyFat ?? null;
    const targetBodyFat = profile.targetBodyFat ?? null;
    const bmr = this.calculateBMR(weight, height, age, sex);
    const multiplier = parseFloat(activityLevel) || 1.6;
    const tdee = this.calculateTDEE(bmr, multiplier);

    // Protein range: 1.6 - 2.2 g/kg (evidence-based range for strength retention during fat loss)
    const proteinMin = Math.round(weight * 1.6);
    const proteinMax = Math.round(weight * 2.2);
    const proteinMultiplier = (goal === 'fat_loss') ? 2.0 : (goal === 'muscle_gain' ? 1.9 : 1.6);
    const recommendedProtein = Math.round(weight * proteinMultiplier);

    let targetCalories = tdee;
    let deficitKcal = 0;
    const minFloor = 1500;

    if (goal === 'fat_loss') {
      // Moderate ~18% deficit (approx 350-500 kcal) to protect lean muscle mass and lifting performance
      deficitKcal = Math.min(500, Math.max(300, Math.round(tdee * 0.18)));
      targetCalories = Math.max(minFloor, tdee - deficitKcal); // Never drop below safe dieting floor of 1500 kcal
    } else if (goal === 'muscle_gain') {
      // Small 8-10% surplus
      targetCalories = tdee + Math.round(tdee * 0.08);
      deficitKcal = -Math.round(tdee * 0.08);
    } else {
      // Maintenance
      targetCalories = tdee;
      deficitKcal = 0;
    }

    // Fat: ~0.85g/kg body weight for hormonal balance
    const fatGrams = Math.round(weight * 0.85);

    // Carbs: Remainder of daily calories
    const proteinCalories = recommendedProtein * 4;
    const fatCalories = fatGrams * 9;
    const remainingCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
    const carbsGrams = Math.round(remainingCalories / 4);
    const waterTarget = Math.round(weight * 35);

    const currentBF = parseFloat(bodyFat) || 22;
    const targetBF = parseFloat(targetBodyFat) || 10;
    const recomp = this.calculateBodyRecomposition(weight, currentBF, targetBF);

    return {
      bmr,
      tdee,
      targetCalories,
      proteinGrams: recommendedProtein,
      carbsGrams,
      fatGrams,
      waterTarget,
      proteinRangeMin: proteinMin,
      proteinRangeMax: proteinMax,
      deficitKcal,
      targetWeight: recomp ? recomp.targetWeight : Math.round(weight * 0.9),
      fatToLose: recomp ? recomp.fatToLose : 0,
      leanBodyMass: recomp ? recomp.leanBodyMass : Math.round(weight * 0.78),
      estimatedWeeks: recomp ? recomp.estimatedWeeks : 0,
      recomp
    };
  },

  /**
   * Adaptive Morning Weight Target Optimization:
   * Dynamically calibrates daily calorie and macronutrient targets based on daily morning weigh-ins.
   * - If weight is reducing as expected (<= 0 kg delta): maintain current diet calories.
   * - If weight goes out of expectation (> +0.2 kg spike on fat loss): tighten target calories by -75 kcal (floor 1500 kcal).
   * - If weight drops excessively fast (< -1.0 kg drop): ease up by +75 kcal to protect lean muscle tissue.
   * - For muscle gain: maintain surplus if gaining 0-0.4 kg; increase +75 kcal if stalled/dropping; tighten -75 kcal if gaining > 0.6 kg.
   * - For maintenance: hold steady if within +/- 0.3 kg; adjust +/- 50 kcal if drifting.
   * 
   * @param {number} currentCalTarget - Current active calorie target
   * @param {number} prevWeight - Previous recorded weight (kg)
   * @param {number} newWeight - Current morning weigh-in (kg)
   * @param {string} goal - 'fat_loss' | 'muscle_gain' | 'maintenance'
   * @param {string} sex - 'male' | 'female'
   * @returns {Object} { targetCalories, proteinGrams, carbsGrams, fatGrams, waterTarget, delta, adjustment, feedback }
   */
  calculateAdaptiveMorningTarget(currentCalTarget, prevWeight, newWeight, goal = 'fat_loss', sex = 'male') {
    const curCal = parseInt(currentCalTarget, 10) || 2200;
    const prevW = parseFloat(prevWeight) || parseFloat(newWeight) || 75;
    const newW = parseFloat(newWeight) || 75;
    const delta = Math.round((newW - prevW) * 10) / 10;
    let adjustment = 0;
    let feedback = '';

    if (goal === 'fat_loss') {
      if (delta <= 0) {
        adjustment = 0;
        feedback = delta < 0
          ? `Weight reducing as expected (${delta} kg). Diet maintained on track!`
          : 'Weight stable. Diet maintained on track!';
      } else if (delta > 0.2) {
        adjustment = -75;
        feedback = `Weight trend above expectation (+${delta} kg). Calorie target tightened by -75 kcal to restore fat loss.`;
      } else {
        adjustment = 0;
        feedback = `Minor normal fluid variation (+${delta} kg). Diet maintained on track!`;
      }

      if (delta < -1.0) {
        adjustment = 75;
        feedback = `Rapid weight drop detected (${delta} kg). Calorie target eased by +75 kcal to protect lean muscle mass.`;
      }
    } else if (goal === 'muscle_gain') {
      if (delta >= 0 && delta <= 0.4) {
        adjustment = 0;
        feedback = 'Weight gain on track for lean hypertrophy. Surplus maintained!';
      } else if (delta < -0.2) {
        adjustment = 75;
        feedback = `Weight dropped (${delta} kg). Calorie target increased by +75 kcal to stimulate hypertrophy.`;
      } else if (delta > 0.6) {
        adjustment = -75;
        feedback = `Weight gained rapidly (+${delta} kg). Calorie target adjusted by -75 kcal to minimize fat gain.`;
      } else {
        adjustment = 0;
        feedback = 'Weight progress steady. Surplus maintained!';
      }
    } else {
      if (Math.abs(delta) <= 0.3) {
        adjustment = 0;
        feedback = 'Weight stable. Maintenance calories maintained!';
      } else if (delta > 0.3) {
        adjustment = -50;
        feedback = `Weight trending up (+${delta} kg). Calorie target adjusted by -50 kcal for weight stability.`;
      } else {
        adjustment = 50;
        feedback = `Weight trending down (${delta} kg). Calorie target adjusted by +50 kcal for weight stability.`;
      }
    }

    const s = String(sex || 'male').toLowerCase();
    const minFloor = (s === 'female') ? 1200 : 1500;
    const targetCalories = Math.max(minFloor, Math.round(curCal + adjustment));

    // Protein: 2.0g/kg for fat loss, 1.9 for muscle gain, 1.6 for maintenance
    const proteinMultiplier = (goal === 'fat_loss') ? 2.0 : (goal === 'muscle_gain' ? 1.9 : 1.6);
    const proteinGrams = Math.round(newW * proteinMultiplier);
    const fatGrams = Math.round(newW * 0.85);
    const proteinCalories = proteinGrams * 4;
    const fatCalories = fatGrams * 9;
    const carbsGrams = Math.max(0, Math.round((targetCalories - (proteinCalories + fatCalories)) / 4));
    const waterTarget = Math.round(newW * 35);

    return {
      targetCalories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      waterTarget,
      delta,
      adjustment,
      feedback
    };
  },

  /**
   * Epley 1RM formula: 1RM = Weight * (1 + Reps / 30)
   * For reps === 1, 1RM is the exact weight lifted (actual 1RM).
   * @param {number} weight
   * @param {number} reps
   * @returns {{ estimated1RM: number, isActual1RM: boolean }}
   */
  calculate1RM(weight, reps) {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps, 10) || 0;
    if (w <= 0 || r <= 0) {
      return { estimated1RM: 0, isActual1RM: false };
    }
    if (r === 1) {
      return { estimated1RM: w, isActual1RM: true };
    }
    // Epley formula rounded to 1 decimal
    const est = Math.round(w * (1 + r / 30) * 10) / 10;
    return { estimated1RM: est, isActual1RM: false };
  },

  /**
   * Format date as YYYY-MM-DD in local time
   * @param {Date} [date]
   * @returns {string} YYYY-MM-DD
   */
  formatDateLocal(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Parse YYYY-MM-DD to UTC date timestamp for boundary-safe date comparisons
   * @param {string} dateStr
   * @returns {number} timestamp in ms
   */
  parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 0;
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
  },

  /**
   * Recalculate streak from daily logs.
   * Rule: A day counts as complete when daily fitness log is finished and saved (completed: true).
   * Rest days count as completed when the log is saved.
   * Consecutive days increase streak; missing calendar day breaks streak.
   * @param {Array<Object>} logs
   * @param {string} [todayStr]
   * @returns {{ currentStreak: number, longestStreak: number, todayCompleted: boolean }}
   */
  calculateStreaks(logs, todayStr = this.formatDateLocal()) {
    if (!Array.isArray(logs) || logs.length === 0) {
      return { currentStreak: 0, longestStreak: 0, todayCompleted: false };
    }

    // Filter to only completed logs and map to unique sorted dates
    const completedDates = Array.from(
      new Set(
        logs
          .filter(log => log && log.completed && log.date)
          .map(log => log.date)
      )
    ).sort();

    if (completedDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, todayCompleted: false };
    }

    const todayMs = this.parseLocalDate(todayStr);
    const msInDay = 86400000;
    const todayCompleted = completedDates.includes(todayStr);

    // Calculate all consecutive runs to find longestStreak
    let longestStreak = 0;
    let currentRun = 0;
    let prevMs = null;

    for (const dStr of completedDates) {
      const currentMs = this.parseLocalDate(dStr);
      if (prevMs === null) {
        currentRun = 1;
      } else {
        const diffDays = Math.round((currentMs - prevMs) / msInDay);
        if (diffDays === 1) {
          currentRun += 1;
        } else if (diffDays > 1) {
          currentRun = 1;
        }
      }
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
      prevMs = currentMs;
    }

    // Calculate current active streak ending today or yesterday
    let currentStreak = 0;
    // Check backwards from today
    let checkMs = todayCompleted ? todayMs : todayMs - msInDay;
    const completedSet = new Set(completedDates);

    // If today is NOT completed, check if yesterday was completed.
    // If neither today nor yesterday is completed, current streak is 0.
    const checkStr = this.formatDateLocal(new Date(checkMs));
    if (completedSet.has(checkStr)) {
      while (completedSet.has(this.formatDateLocal(new Date(checkMs)))) {
        currentStreak += 1;
        checkMs -= msInDay;
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      todayCompleted
    };
  },

  /**
   * Calculate rolling 7-day or weekly average weights without fabricating missing values
   * @param {Array<Object>} measurements
   * @returns {Array<{ date: string, avgWeight: number, count: number }>}
   */
  calculateWeeklyAverageWeight(measurements) {
    if (!Array.isArray(measurements) || measurements.length === 0) return [];
    
    // Sort ascending by date
    const valid = measurements
      .filter(m => m && m.date && typeof m.weight === 'number' && m.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (valid.length === 0) return [];

    // Group measurements into ISO calendar weeks or 7-day buckets
    const result = [];
    for (let i = 0; i < valid.length; i++) {
      const current = valid[i];
      const currentMs = this.parseLocalDate(current.date);
      const sevenDaysAgoMs = currentMs - 6 * 86400000;

      // Window of available measurements within the last 7 calendar days
      const windowMeasurements = valid.filter(m => {
        const mMs = this.parseLocalDate(m.date);
        return mMs >= sevenDaysAgoMs && mMs <= currentMs;
      });

      const sum = windowMeasurements.reduce((acc, m) => acc + m.weight, 0);
      const avg = Math.round((sum / windowMeasurements.length) * 10) / 10;

      result.push({
        date: current.date,
        avgWeight: avg,
        count: windowMeasurements.length
      });
    }

    return result;
  }
};

/**
 * 2. CLIENT-SIDE CRYPTOGRAPHIC VAULT (FitTrackVault)
 * Implements native Web Crypto API (AES-256-GCM + PBKDF2 with 100,000 iterations).
 * Ensures zero-knowledge client encryption: all personal logs, weights, and progress
 * are encrypted at rest. When hosted on GitHub Pages, visitors without the master
 * passphrase cannot read any private data.
 */
const FitTrackVault = {
  VAULT_CONFIG_KEY: 'fittrack_vault_config_v1',
  sessionKey: null,
  isUnlocked: false,
  autoLockMinutes: 15,
  autoLockTimer: null,
  privacyMode: false,

  bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  hexToBuffer(hex) {
    if (!hex || hex.length % 2 !== 0) return new ArrayBuffer(0);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  },

  isVaultConfigured() {
    return !!localStorage.getItem(this.VAULT_CONFIG_KEY);
  },

  getVaultConfig() {
    try {
      const raw = localStorage.getItem(this.VAULT_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async deriveKey(password, saltBuffer) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async setupMasterPassword(password) {
    if (!password || password.length < 6) {
      return { success: false, message: 'Master passphrase must be at least 6 characters long.' };
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await this.deriveKey(password, salt);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const testPlain = 'FITTRACK_VAULT_OK';
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      enc.encode(testPlain)
    );

    const config = {
      version: 1,
      createdAt: new Date().toISOString(),
      salt: this.bufferToHex(salt),
      iv: this.bufferToHex(iv),
      testToken: this.bufferToHex(ciphertext),
      autoLockMinutes: 15
    };

    localStorage.setItem(this.VAULT_CONFIG_KEY, JSON.stringify(config));
    this.sessionKey = derivedKey;
    this.isUnlocked = true;
    this.resetAutoLockTimer();
    return { success: true };
  },

  async unlock(password) {
    const config = this.getVaultConfig();
    if (!config) {
      this.isUnlocked = true;
      return { success: true };
    }

    try {
      const saltBuffer = this.hexToBuffer(config.salt);
      const derivedKey = await this.deriveKey(password, saltBuffer);

      const iv = this.hexToBuffer(config.iv);
      const testCipher = this.hexToBuffer(config.testToken);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        testCipher
      );

      const dec = new TextDecoder();
      if (dec.decode(decrypted) === 'FITTRACK_VAULT_OK') {
        this.sessionKey = derivedKey;
        this.isUnlocked = true;
        this.resetAutoLockTimer();
        return { success: true };
      }
      return { success: false, message: 'Incorrect Master Passphrase. Access denied.' };
    } catch (err) {
      return { success: false, message: 'Incorrect Master Passphrase. Access denied.' };
    }
  },

  lock() {
    this.sessionKey = null;
    this.isUnlocked = false;
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  },

  async encrypt(plainText) {
    if (!this.sessionKey) {
      throw new Error('Vault is locked. Cannot encrypt.');
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.sessionKey,
      enc.encode(plainText)
    );
    return {
      encrypted: true,
      iv: this.bufferToHex(iv),
      ciphertext: this.bufferToHex(cipher)
    };
  },

  async decrypt(payload) {
    if (!this.sessionKey) {
      throw new Error('Vault is locked. Cannot decrypt.');
    }
    const iv = this.hexToBuffer(payload.iv);
    const cipher = this.hexToBuffer(payload.ciphertext);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.sessionKey,
      cipher
    );
    const dec = new TextDecoder();
    return dec.decode(plainBuf);
  },

  resetAutoLockTimer() {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    if (!this.isUnlocked) return;
    const ms = (this.autoLockMinutes || 15) * 60 * 1000;
    this.autoLockTimer = setTimeout(() => {
      if (window.app && typeof window.app.lockSession === 'function') {
        window.app.lockSession('Session auto-locked due to inactivity.');
      }
    }, ms);
  }
};

/**
 * 2B. AUTHENTICATION & MULTI-USER ROLES ENGINE (FitTrackAuth)
 * Handles client-side salted PBKDF2 authentication, session validation,
 * role-based access control, and user provisioning. Public registration is locked
 * by default; only administrators can create new user accounts.
 */
const FitTrackAuth = {
  USERS_STORAGE_KEY: 'fittrack_users_v1',
  SESSION_STORAGE_KEY: 'fittrack_session_v1',

  DEFAULT_ADMIN: {
    username: 'admin',
    displayName: 'Administrator',
    role: 'admin',
    salt: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    passwordHash: '44138abc921d1c95bb573a09516cd4c82e8271fc3d9604b7c5f7f1bf26b6292d',
    createdAt: '2026-01-01T00:00:00.000Z'
  },

  getUsers() {
    try {
      const raw = localStorage.getItem(this.USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback below
    }
    const defaultUsers = [{ ...this.DEFAULT_ADMIN }];
    try {
      localStorage.setItem(this.USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
    } catch {
      // Storage restricted / private mode
    }
    return defaultUsers;
  },

  hasAdminUser() {
    const users = this.getUsers();
    return users.some(u => u.role === 'admin');
  },

  saveUsers(users) {
    localStorage.setItem(this.USERS_STORAGE_KEY, JSON.stringify(users));
  },

  async hashPassword(password, saltHex) {
    const enc = new TextEncoder();
    const saltBuf = FitTrackVault.hexToBuffer(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuf,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    return FitTrackVault.bufferToHex(bits);
  },

  async createAdminAccount(username, password) {
    username = (username || '').trim().toLowerCase();
    if (!username || username.length < 3) {
      return { success: false, message: 'Admin username must be at least 3 characters.' };
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const salt = FitTrackVault.bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await this.hashPassword(password, salt);

    const adminUser = {
      id: 'usr_admin_' + Date.now(),
      username,
      role: 'admin',
      displayName: 'Primary Administrator',
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    const users = [adminUser];
    this.saveUsers(users);

    // Initialize vault encryption with master password
    await FitTrackVault.setupMasterPassword(password);

    return this.createSession(adminUser);
  },

  async login(username, password) {
    username = (username || '').trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username);
    if (!user) {
      return { success: false, message: 'Invalid username or password.' };
    }

    const hash = await this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return { success: false, message: 'Invalid username or password.' };
    }

    if (user.role === 'admin' && FitTrackVault.isVaultConfigured()) {
      try {
        await FitTrackVault.unlock(password);
      } catch (err) {
        console.warn('[FitTrackAuth] Vault auto-unlock skipped:', err);
      }
    }

    return this.createSession(user);
  },

  createSession(user) {
    const token = 'sess_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
    const session = {
      userId: user.id,
      username: user.username,
      role: user.role,
      token,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(session));
    return { success: true, session, user };
  },

  getSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getSession();
  },

  isAdmin() {
    const sess = this.getSession();
    return sess && sess.role === 'admin';
  },

  getCurrentUser() {
    const sess = this.getSession();
    if (!sess) return null;
    const users = this.getUsers();
    return users.find(u => u.id === sess.userId) || { id: sess.userId, username: sess.username, role: sess.role, displayName: sess.username };
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
    FitTrackVault.lock();
  },

  async createUserByAdmin(username, password, role = 'user') {
    if (!this.isAdmin()) {
      return { success: false, message: 'Permission denied: Only administrators can create users.' };
    }
    username = (username || '').trim().toLowerCase();
    if (!username || username.length < 3) {
      return { success: false, message: 'Username must be at least 3 characters.' };
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === username)) {
      return { success: false, message: `Username "${username}" already exists.` };
    }

    const salt = FitTrackVault.bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await this.hashPassword(password, salt);

    const newUser = {
      id: 'usr_' + Date.now(),
      username,
      role: role === 'admin' ? 'admin' : 'user',
      displayName: username,
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    return { success: true, user: newUser };
  },

  deleteUserByAdmin(userId) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Permission denied.' };
    }
    const current = this.getSession();
    if (current && current.userId === userId) {
      return { success: false, message: 'Cannot delete the currently logged-in administrator.' };
    }
    let users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) {
      return { success: false, message: 'User not found.' };
    }
    if (target.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      return { success: false, message: 'Cannot delete the only administrator account.' };
    }
    users = users.filter(u => u.id !== userId);
    this.saveUsers(users);
    return { success: true };
  }
};

/**
 * 2C. MOTIVATIONAL EMOJIS & REWARDS SYSTEM (FitTrackMotivation)
 * Calculates achievement tiers, motivational feedback, and celebratory states
 * across calories, protein, hydration, training, and overall daily completion.
 */
const FitTrackMotivation = {
  GIFS: {
    seedling: 'assets/gifs/seedling.gif',
    biceps: 'assets/gifs/biceps.gif',
    fire: 'assets/gifs/fire.gif',
    rocket: 'assets/gifs/rocket.gif',
    trophy: 'assets/gifs/trophy.gif',
    celebration: 'assets/gifs/party_popper.gif',
    droplet: 'assets/gifs/droplet.gif',
    scale: 'assets/gifs/scale.gif',
    hourglass: 'assets/gifs/hourglass.gif',
    check: 'assets/gifs/check.gif',
    zap: 'assets/gifs/zap.gif',
    hundred: 'assets/gifs/hundred.gif'
  },

  getTier(percent) {
    const p = Math.max(0, Math.round(percent || 0));
    if (p >= 100) {
      return {
        emoji: '🏆',
        gif: this.GIFS.trophy,
        message: 'Goal achieved! Amazing work!',
        tierClass: 'tier-100',
        percent: p,
        celebration: '🎉',
        celebrationGif: this.GIFS.celebration,
        isComplete: true
      };
    } else if (p >= 75) {
      return {
        emoji: '🚀',
        gif: this.GIFS.rocket,
        message: 'Almost there! Keep pushing!',
        tierClass: 'tier-75',
        percent: p,
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    } else if (p >= 50) {
      return {
        emoji: '🔥',
        gif: this.GIFS.fire,
        message: 'You’re making great progress!',
        tierClass: 'tier-50',
        percent: p,
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    } else if (p >= 25) {
      return {
        emoji: '💪',
        gif: this.GIFS.biceps,
        message: 'Good start! Keep going!',
        tierClass: 'tier-25',
        percent: p,
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    } else {
      return {
        emoji: '🌱',
        gif: this.GIFS.seedling,
        message: 'Every journey starts with a small step!',
        tierClass: 'tier-0',
        percent: p,
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    }
  },

  getCalorieTier(consumed, target) {
    if (!target || target <= 0) return this.getTier(0);
    const ratio = (consumed / target) * 100;
    const rounded = Math.round(ratio);

    if (consumed === 0) {
      return {
        emoji: '🌱',
        gif: this.GIFS.seedling,
        message: 'Every journey starts with a small step!',
        tierClass: 'tier-0',
        percent: 0,
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    }

    // In fat loss or health tracking, hitting 90% - 105% of target is a victory!
    if (ratio >= 90 && ratio <= 105) {
      return {
        emoji: '🏆',
        gif: this.GIFS.trophy,
        message: 'Goal achieved! Amazing work! (Optimal calorie target met)',
        tierClass: 'tier-100',
        percent: Math.min(100, rounded),
        celebration: '🎉',
        celebrationGif: this.GIFS.celebration,
        isComplete: true
      };
    } else if (ratio > 105) {
      const surplus = Math.round(consumed - target);
      return {
        emoji: '⚖️',
        gif: this.GIFS.fire,
        message: `Exceeded target by ${surplus} kcal. Remember: consistency over perfection.`,
        tierClass: 'tier-warning',
        percent: 100,
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    } else {
      return this.getTier(ratio);
    }
  },

  getWaterTier(consumed, target = 2500) {
    const ratio = target > 0 ? (consumed / target) * 100 : 0;
    const t = this.getTier(ratio);
    if (consumed >= target && target > 0) {
      t.gif = this.GIFS.trophy;
    } else if (consumed > 0 && t.percent < 25) {
      t.gif = this.GIFS.droplet;
    }
    return t;
  },

  getWorkoutTier(hasWorkoutToday, isRestToday, weekWorkoutsCount = 0, targetWorkouts = 6) {
    if (typeof weekWorkoutsCount !== 'number') weekWorkoutsCount = 0;
    if (typeof targetWorkouts !== 'number' || targetWorkouts <= 0) targetWorkouts = 6;

    // 1. Weekly target reached
    if (weekWorkoutsCount >= targetWorkouts) {
      return {
        emoji: '🏆',
        gif: this.GIFS.trophy,
        message: `Weekly goal crushed! (${weekWorkoutsCount}/${targetWorkouts} sessions completed)`,
        tierClass: 'tier-100',
        percent: 100,
        celebration: '🎉',
        celebrationGif: this.GIFS.celebration,
        isComplete: true
      };
    }

    // 2. Today's workout completed
    if (hasWorkoutToday) {
      return {
        emoji: '🔥',
        gif: this.GIFS.fire,
        message: `Today's workout completed! (${weekWorkoutsCount} of ${targetWorkouts} this week)`,
        tierClass: 'tier-75',
        percent: Math.max(50, Math.round((weekWorkoutsCount / targetWorkouts) * 100)),
        celebration: '',
        celebrationGif: '',
        isComplete: true
      };
    }

    // 3. Today is a logged rest / recovery day
    if (isRestToday) {
      return {
        emoji: '🧘',
        gif: this.GIFS.check,
        message: 'Active recovery logged! Rest is essential for muscle gains.',
        tierClass: 'tier-50',
        percent: 50,
        celebration: '',
        celebrationGif: '',
        isComplete: true
      };
    }

    // 4. In progress during the week, but haven't worked out yet today
    if (weekWorkoutsCount > 0) {
      return {
        emoji: '💪',
        gif: this.GIFS.biceps,
        message: `${weekWorkoutsCount} of ${targetWorkouts} completed. Ready for today's workout!`,
        tierClass: 'tier-50',
        percent: Math.round((weekWorkoutsCount / targetWorkouts) * 100),
        celebration: '',
        celebrationGif: '',
        isComplete: false
      };
    }

    // 5. Zero workouts completed this week yet
    return {
      emoji: '⚡',
      gif: this.GIFS.zap,
      message: `0 of ${targetWorkouts} completed this week. Ready to crush workout #1!`,
      tierClass: 'tier-0',
      percent: 0,
      celebration: '',
      celebrationGif: '',
      isComplete: false
    };
  },

  getOverallDailyScore(metrics) {
    const c = Math.min(100, Math.max(0, metrics.calPercent || 0));
    const p = Math.min(100, Math.max(0, metrics.proPercent || 0));
    const w = Math.min(100, Math.max(0, metrics.waterPercent || 0));
    const wk = metrics.workoutComplete ? 100 : 0;

    const composite = Math.round((c * 0.3) + (p * 0.35) + (w * 0.15) + (wk * 0.2));
    return this.getTier(composite);
  }
};

/**
 * 2D. ADAPTIVE NUTRITION TARGET ADVISOR (FitTrackAdaptive)
 * Intelligently recommends personalized calorie and protein adjustments based on:
 * multi-week moving weight trends, activity level, and strength retention goals.
 */
const FitTrackAdaptive = {
  evaluateTargets(store) {
    const profile = store.data.profile || {};
    const measurements = [...(store.data.measurements || [])].sort((a, b) => b.date.localeCompare(a.date));
    const latestMeasurement = measurements[0] || null;

    const weight = parseFloat(latestMeasurement?.weight || profile.weight) || 75;
    const height = parseFloat(profile.height) || 169;
    const age = parseInt(profile.age, 10) || 24;
    const sex = profile.sex || 'male';
    const goal = profile.goal || 'fat_loss';
    const activityLevel = profile.activityLevel || '1.6';

    const baseline = FitTrackCalc.calculateTargets({
      weight,
      height,
      age,
      sex,
      activityLevel,
      goal,
      bodyFat: profile.bodyFat,
      targetBodyFat: profile.targetBodyFat
    });

    const currentCalTarget = store.data.goals.dailyCalories || baseline.targetCalories;
    const currentProTarget = store.data.goals.dailyProtein || baseline.proteinGrams;

    // 1. Protein recommendation based on body weight & objective
    let proteinMultiplier = 2.0;
    let proteinExplanation = '';

    if (goal === 'fat_loss') {
      proteinMultiplier = 2.0;
      proteinExplanation = `2.0 g/kg body weight recommended during fat loss to maximize lean muscle retention and satiety.`;
    } else if (goal === 'muscle_gain') {
      proteinMultiplier = 1.9;
      proteinExplanation = `1.9 g/kg body weight to support muscle protein synthesis during hypercaloric mass building.`;
    } else {
      proteinMultiplier = 1.6;
      proteinExplanation = `1.6 g/kg body weight for lean tissue maintenance and metabolic health.`;
    }

    const recommendedProtein = baseline.proteinGrams;
    const proteinDelta = recommendedProtein - currentProTarget;

    // 2. Base Mifflin-St Jeor TDEE
    const tdee = baseline.tdee;

    // 3. Weight trend analysis
    const logs = [...store.data.dailyLogs]
      .filter(l => l.weight && l.weight > 0)
      .sort((a, b) => b.date.localeCompare(a.date));

    let recommendedCalories = currentCalTarget;
    let adjustmentReason = '';
    let trendRatePerWeek = null;
    let confidence = 'baseline';

    if (logs.length < 5) {
      recommendedCalories = baseline.targetCalories;
      adjustmentReason = `Based on Mifflin–St Jeor TDEE (${tdee} kcal) and a moderate, muscle-sparing deficit. Log weights for 7+ days to unlock dynamic trend-based adjustments.`;
      confidence = 'baseline';
    } else {
      const recentLogs = logs.slice(0, 7);
      const priorLogs = logs.slice(7, 14);

      if (priorLogs.length >= 2) {
        const avgRecent = recentLogs.reduce((acc, l) => acc + l.weight, 0) / recentLogs.length;
        const avgPrior = priorLogs.reduce((acc, l) => acc + l.weight, 0) / priorLogs.length;
        trendRatePerWeek = Math.round((avgRecent - avgPrior) * 10) / 10;

        if (goal === 'fat_loss') {
          if (trendRatePerWeek > -0.1) {
            recommendedCalories = Math.max(1500, currentCalTarget - 100);
            adjustmentReason = `Weight trend has plateaued (${trendRatePerWeek > 0 ? '+' : ''}${trendRatePerWeek} kg/week vs target -0.5 kg/week). A gentle -100 kcal reduction is suggested while preserving your safe 1500 kcal floor.`;
            confidence = 'trend_plateau';
          } else if (trendRatePerWeek < -0.9) {
            recommendedCalories = currentCalTarget + 150;
            adjustmentReason = `Weight is dropping too quickly (${trendRatePerWeek} kg/week). Adding +150 kcal is recommended to protect lean muscle tissue and gym performance.`;
            confidence = 'trend_fast_loss';
          } else {
            recommendedCalories = currentCalTarget;
            adjustmentReason = `Weight loss trajectory is in the optimal sweet spot (${trendRatePerWeek} kg/week). Current calorie targets are working effectively!`;
            confidence = 'trend_optimal';
          }
        } else if (goal === 'muscle_gain') {
          if (trendRatePerWeek < 0.1) {
            recommendedCalories = currentCalTarget + 100;
            adjustmentReason = `Weight gain is slow (${trendRatePerWeek} kg/week). A mild +100 kcal surplus is suggested to fuel hypertrophic muscle growth.`;
            confidence = 'trend_slow_gain';
          } else if (trendRatePerWeek > 0.5) {
            recommendedCalories = Math.max(tdee, currentCalTarget - 100);
            adjustmentReason = `Weight is increasing quickly (${trendRatePerWeek} kg/week). Easing calories by -100 kcal will prevent unwanted excess fat gain.`;
            confidence = 'trend_fast_gain';
          } else {
            recommendedCalories = currentCalTarget;
            adjustmentReason = `Lean bulk pace is optimal (+${trendRatePerWeek} kg/week). Maintain current surplus.`;
            confidence = 'trend_optimal';
          }
        } else {
          if (Math.abs(trendRatePerWeek) > 0.3) {
            recommendedCalories = trendRatePerWeek > 0 ? currentCalTarget - 100 : currentCalTarget + 100;
            adjustmentReason = `Weight shifted by ${trendRatePerWeek} kg/week. Calorie target tuned by ±100 kcal to maintain equilibrium.`;
          } else {
            adjustmentReason = `Weight is completely stable. Maintenance targets are spot on.`;
          }
        }
      } else {
        const baseline = FitTrackCalc.calculateTargets(profile);
        recommendedCalories = baseline.targetCalories;
        adjustmentReason = `Initial Mifflin–St Jeor calibration active (${recommendedCalories} kcal). Continue logging daily to activate multi-week rolling adjustments.`;
      }
    }

    // Enforce safety limits
    if (sex === 'male') {
      recommendedCalories = Math.max(1500, recommendedCalories);
    } else {
      recommendedCalories = Math.max(1200, recommendedCalories);
    }

    return {
      currentCalTarget,
      currentProTarget,
      recommendedCalories,
      recommendedProtein,
      calorieDelta: recommendedCalories - currentCalTarget,
      proteinDelta,
      adjustmentReason,
      proteinExplanation,
      trendRatePerWeek,
      confidence,
      hasChange: (recommendedCalories !== currentCalTarget) || (recommendedProtein !== currentProTarget)
    };
  }
};

/**
 * FitTrackSmartMeal - Natural Language Meal AI Parser & Nutrition Knowledge Engine
 * Automatically parses freeform natural language meal logs (e.g. "lunch: rice 100g, chicken 200 gm, 2 boiled egg white, gravy")
 * into calibrated items with calories, protein, carbs, and fat without external paid APIs.
 */
const FitTrackSmartMeal = {
  FOOD_DB: [
    // Poultry & Meats
    {
      id: 'chicken_breast',
      name: 'Chicken Breast (Cooked)',
      keywords: ['chicken breast', 'chicken breasts', 'grilled chicken', 'boiled chicken', 'chicken'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 165,
      proPer100: 31.0,
      carbsPer100: 0,
      fatPer100: 3.6
    },
    {
      id: 'chicken_thigh',
      name: 'Chicken Thigh',
      keywords: ['chicken thigh', 'chicken thighs', 'chicken leg', 'chicken legs'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 209,
      proPer100: 26.0,
      carbsPer100: 0,
      fatPer100: 10.9
    },
    {
      id: 'egg_white',
      name: 'Boiled Egg White',
      keywords: ['boiled egg white', 'boiled egg whites', 'egg white', 'egg whites', 'white of egg', 'egg white boiled'],
      baseUnit: 'piece',
      unitGram: 33,
      calsPerUnit: 17,
      proPerUnit: 3.6,
      carbsPerUnit: 0.2,
      fatPerUnit: 0.05
    },
    {
      id: 'whole_egg',
      name: 'Whole Egg',
      keywords: ['boiled egg', 'boiled eggs', 'whole egg', 'whole eggs', 'fried egg', 'fried eggs', 'poached egg', 'scrambled egg', 'egg', 'eggs', 'anda'],
      baseUnit: 'piece',
      unitGram: 50,
      calsPerUnit: 74,
      proPerUnit: 6.3,
      carbsPerUnit: 0.4,
      fatPerUnit: 5.0
    },
    {
      id: 'whey_protein',
      name: 'Whey Protein',
      keywords: ['whey protein', 'whey', 'protein powder', 'protein shake', 'isopure'],
      baseUnit: 'scoop',
      unitGram: 30,
      calsPerUnit: 120,
      proPerUnit: 24.0,
      carbsPerUnit: 3.0,
      fatPerUnit: 1.5
    },
    {
      id: 'paneer',
      name: 'Paneer (Cottage Cheese)',
      keywords: ['paneer', 'cottage cheese', 'panir'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 265,
      proPer100: 18.3,
      carbsPer100: 3.8,
      fatPer100: 20.8
    },
    {
      id: 'tofu',
      name: 'Tofu',
      keywords: ['tofu', 'soy curd'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 76,
      proPer100: 8.0,
      carbsPer100: 1.9,
      fatPer100: 4.8
    },
    {
      id: 'soya_chunks',
      name: 'Soya Chunks',
      keywords: ['soya chunks', 'soy chunks', 'soya', 'meal maker'],
      baseUnit: 'g',
      defaultServing: 50,
      calsPer100: 345,
      proPer100: 52.0,
      carbsPer100: 33.0,
      fatPer100: 0.5
    },
    {
      id: 'fish_tilapia',
      name: 'White Fish (Tilapia/Cod)',
      keywords: ['white fish', 'tilapia', 'cod', 'meen', 'fish'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 128,
      proPer100: 26.0,
      carbsPer100: 0,
      fatPer100: 2.7
    },
    {
      id: 'salmon',
      name: 'Salmon Fillet',
      keywords: ['salmon', 'rawas'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 208,
      proPer100: 20.0,
      carbsPer100: 0,
      fatPer100: 13.0
    },
    {
      id: 'tuna',
      name: 'Canned Tuna / Fresh Tuna',
      keywords: ['canned tuna', 'tuna'],
      baseUnit: 'g',
      defaultServing: 120,
      calsPer100: 132,
      proPer100: 28.0,
      carbsPer100: 0,
      fatPer100: 1.3
    },
    {
      id: 'beef',
      name: 'Lean Beef / Steak',
      keywords: ['lean beef', 'ground beef', 'beef', 'steak'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 250,
      proPer100: 26.0,
      carbsPer100: 0,
      fatPer100: 15.0
    },
    {
      id: 'mutton',
      name: 'Mutton / Lamb',
      keywords: ['goat meat', 'mutton', 'lamb'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 294,
      proPer100: 25.0,
      carbsPer100: 0,
      fatPer100: 21.0
    },
    {
      id: 'prawns',
      name: 'Prawns / Shrimp',
      keywords: ['prawns', 'shrimp', 'prawn'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 99,
      proPer100: 24.0,
      carbsPer100: 0.2,
      fatPer100: 0.3
    },

    // Grains & Carbs
    {
      id: 'cooked_rice',
      name: 'Cooked Rice',
      keywords: ['cooked rice', 'white rice', 'basmati rice', 'basmati', 'steamed rice', 'chawal', 'rice'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 130,
      proPer100: 2.7,
      carbsPer100: 28.2,
      fatPer100: 0.3
    },
    {
      id: 'brown_rice',
      name: 'Brown Rice (Cooked)',
      keywords: ['brown rice'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 111,
      proPer100: 2.6,
      carbsPer100: 23.0,
      fatPer100: 0.9
    },
    {
      id: 'roti',
      name: 'Roti / Chapati',
      keywords: ['roti', 'rotis', 'chapati', 'chapatis', 'chapathi', 'chapathis', 'chapatchi', 'chapatchis', 'phulka', 'phulkas'],
      baseUnit: 'piece',
      unitGram: 40,
      calsPerUnit: 104,
      proPerUnit: 3.1,
      carbsPerUnit: 20.0,
      fatPerUnit: 1.4
    },
    {
      id: 'paratha',
      name: 'Paratha',
      keywords: ['paratha', 'parotta', 'aloo paratha'],
      baseUnit: 'piece',
      unitGram: 80,
      calsPerUnit: 250,
      proPerUnit: 4.5,
      carbsPerUnit: 32.0,
      fatPerUnit: 12.0
    },
    {
      id: 'bread',
      name: 'Bread / Toast',
      keywords: ['slices bread', 'slice bread', 'slices of bread', 'slice of bread', 'white bread', 'brown bread', 'bread', 'toast'],
      baseUnit: 'piece',
      unitGram: 30,
      calsPerUnit: 75,
      proPerUnit: 2.5,
      carbsPerUnit: 14.0,
      fatPerUnit: 1.0
    },
    {
      id: 'oats',
      name: 'Oats / Oatmeal',
      keywords: ['oats', 'oatmeal', 'rolled oats', 'quaker oats'],
      baseUnit: 'g',
      defaultServing: 50,
      calsPer100: 389,
      proPer100: 16.9,
      carbsPer100: 66.3,
      fatPer100: 6.9
    },
    {
      id: 'potato',
      name: 'Boiled Potato',
      keywords: ['boiled potato', 'potatoes', 'potato', 'aloo'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 87,
      proPer100: 1.9,
      carbsPer100: 20.1,
      fatPer100: 0.1
    },
    {
      id: 'sweet_potato',
      name: 'Sweet Potato',
      keywords: ['sweet potato', 'sweet potatoes', 'shakarkandi'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 86,
      proPer100: 1.6,
      carbsPer100: 20.1,
      fatPer100: 0.1
    },
    {
      id: 'pasta',
      name: 'Pasta / Macaroni (Cooked)',
      keywords: ['pasta', 'macaroni', 'noodles', 'spaghetti'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 131,
      proPer100: 5.0,
      carbsPer100: 25.0,
      fatPer100: 1.1
    },
    {
      id: 'idli',
      name: 'Idli',
      keywords: ['idli', 'idlis', 'idly'],
      baseUnit: 'piece',
      unitGram: 40,
      calsPerUnit: 58,
      proPerUnit: 2.0,
      carbsPerUnit: 12.0,
      fatPerUnit: 0.4
    },
    {
      id: 'dosa',
      name: 'Dosa',
      keywords: ['dosa', 'plain dosa', 'dosai'],
      baseUnit: 'piece',
      unitGram: 80,
      calsPerUnit: 168,
      proPerUnit: 3.9,
      carbsPerUnit: 28.0,
      fatPerUnit: 3.7
    },
    {
      id: 'biryani',
      name: 'Biryani',
      keywords: ['chicken biryani', 'mutton biryani', 'biryani'],
      baseUnit: 'g',
      defaultServing: 250,
      calsPer100: 160,
      proPer100: 6.5,
      carbsPer100: 22.0,
      fatPer100: 5.5
    },

    // Curries, Gravies & Lentils
    {
      id: 'gravy',
      name: 'Curry Gravy',
      keywords: ['chicken gravy', 'mutton gravy', 'gravy', 'curry', 'salna', 'sauce'],
      baseUnit: 'serving',
      unitGram: 100,
      calsPerUnit: 120,
      proPerUnit: 2.5,
      carbsPerUnit: 6.0,
      fatPerUnit: 9.5
    },
    {
      id: 'dal',
      name: 'Dal / Lentils (Cooked)',
      keywords: ['yellow dal', 'tadka dal', 'dal tadka', 'daal', 'dhal', 'dal', 'lentils'],
      baseUnit: 'serving',
      unitGram: 180,
      calsPerUnit: 180,
      proPerUnit: 11.0,
      carbsPerUnit: 24.0,
      fatPerUnit: 4.0
    },
    {
      id: 'sambar',
      name: 'Sambar',
      keywords: ['sambar', 'sambhar'],
      baseUnit: 'serving',
      unitGram: 180,
      calsPerUnit: 130,
      proPerUnit: 4.5,
      carbsPerUnit: 18.0,
      fatPerUnit: 3.5
    },
    {
      id: 'chana',
      name: 'Chana / Chickpeas (Cooked)',
      keywords: ['kabuli chana', 'chickpeas', 'chana', 'chole'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 164,
      proPer100: 8.9,
      carbsPer100: 27.4,
      fatPer100: 2.6
    },
    {
      id: 'rajma',
      name: 'Rajma / Kidney Beans (Cooked)',
      keywords: ['rajma', 'kidney beans'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 127,
      proPer100: 8.7,
      carbsPer100: 22.8,
      fatPer100: 0.5
    },

    // Dairy & Beverages
    {
      id: 'milk_whole',
      name: 'Milk (Cow / Whole)',
      keywords: ['whole milk', 'full cream milk', 'cow milk', 'milk'],
      baseUnit: 'ml',
      defaultServing: 250,
      calsPer100: 62,
      proPer100: 3.2,
      carbsPer100: 4.8,
      fatPer100: 3.5
    },
    {
      id: 'milk_skim',
      name: 'Skim / Low Fat Milk',
      keywords: ['skim milk', 'low fat milk', 'toned milk', 'double toned milk'],
      baseUnit: 'ml',
      defaultServing: 250,
      calsPer100: 35,
      proPer100: 3.4,
      carbsPer100: 5.0,
      fatPer100: 0.1
    },
    {
      id: 'curd',
      name: 'Curd / Yogurt (Dahi)',
      keywords: ['plain yogurt', 'curd', 'yogurt', 'dahi'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 61,
      proPer100: 3.5,
      carbsPer100: 4.7,
      fatPer100: 3.3
    },
    {
      id: 'greek_yogurt',
      name: 'Greek Yogurt',
      keywords: ['greek yogurt', 'hung curd'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 59,
      proPer100: 10.0,
      carbsPer100: 3.6,
      fatPer100: 0.4
    },
    {
      id: 'cheese',
      name: 'Cheese',
      keywords: ['cheddar', 'mozzarella', 'cheese'],
      baseUnit: 'g',
      defaultServing: 30,
      calsPer100: 402,
      proPer100: 25.0,
      carbsPer100: 1.3,
      fatPer100: 33.0
    },
    {
      id: 'butter_ghee',
      name: 'Ghee / Butter',
      keywords: ['desi ghee', 'ghee', 'butter'],
      baseUnit: 'tbsp',
      unitGram: 14,
      calsPerUnit: 110,
      proPerUnit: 0.1,
      carbsPerUnit: 0,
      fatPerUnit: 12.0
    },
    {
      id: 'oil',
      name: 'Cooking Oil (Olive / Coconut)',
      keywords: ['olive oil', 'coconut oil', 'mustard oil', 'oil'],
      baseUnit: 'tbsp',
      unitGram: 14,
      calsPerUnit: 120,
      proPerUnit: 0,
      carbsPerUnit: 0,
      fatPerUnit: 14.0
    },

    // Nuts, Spreads & Fruits
    {
      id: 'peanut_butter',
      name: 'Peanut Butter',
      keywords: ['peanut butter', 'pb'],
      baseUnit: 'tbsp',
      unitGram: 16,
      calsPerUnit: 95,
      proPerUnit: 4.0,
      carbsPerUnit: 3.5,
      fatPerUnit: 8.0
    },
    {
      id: 'almonds',
      name: 'Almonds',
      keywords: ['almonds', 'almond', 'badam'],
      baseUnit: 'g',
      defaultServing: 30,
      calsPer100: 579,
      proPer100: 21.0,
      carbsPer100: 22.0,
      fatPer100: 50.0
    },
    {
      id: 'peanuts',
      name: 'Peanuts',
      keywords: ['groundnuts', 'groundnut', 'peanuts', 'peanut'],
      baseUnit: 'g',
      defaultServing: 30,
      calsPer100: 567,
      proPer100: 25.8,
      carbsPer100: 16.1,
      fatPer100: 49.2
    },
    {
      id: 'banana',
      name: 'Banana',
      keywords: ['red banana', 'bananas', 'banana', 'kela'],
      baseUnit: 'piece',
      unitGram: 118,
      calsPerUnit: 105,
      proPerUnit: 1.3,
      carbsPerUnit: 27.0,
      fatPerUnit: 0.3
    },
    {
      id: 'apple',
      name: 'Apple',
      keywords: ['apples', 'apple', 'seb'],
      baseUnit: 'piece',
      unitGram: 182,
      calsPerUnit: 95,
      proPerUnit: 0.5,
      carbsPerUnit: 25.0,
      fatPerUnit: 0.3
    },
    {
      id: 'orange',
      name: 'Orange',
      keywords: ['oranges', 'orange', 'santra'],
      baseUnit: 'piece',
      unitGram: 130,
      calsPerUnit: 62,
      proPerUnit: 1.2,
      carbsPerUnit: 15.0,
      fatPerUnit: 0.2
    },

    // Vegetables
    {
      id: 'broccoli',
      name: 'Broccoli',
      keywords: ['broccoli'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 34,
      proPer100: 2.8,
      carbsPer100: 7.0,
      fatPer100: 0.4
    },
    {
      id: 'salad',
      name: 'Mixed Salad / Cucumber',
      keywords: ['mixed salad', 'cucumber', 'lettuce', 'salad'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 15,
      proPer100: 0.7,
      carbsPer100: 3.6,
      fatPer100: 0.1
    },

    // Fast Food, Burgers, Sandwiches, Wraps & Restaurant Dishes
    {
      id: 'chicken_burger',
      name: 'Chicken Burger',
      keywords: [
        'chicken burger', 'chicken burgers', 'crispy chicken burger', 'grilled chicken burger',
        'chicken zinger', 'zinger burger', 'mcchicken', 'burger with chicken', 'chicken sandwich burger',
        'burger chicken', 'chicken patty burger'
      ],
      baseUnit: 'piece',
      unitGram: 190,
      calsPerUnit: 440,
      proPerUnit: 26.0,
      carbsPerUnit: 42.0,
      fatPerUnit: 19.0
    },
    {
      id: 'burger',
      name: 'Burger / Cheeseburger',
      keywords: ['double cheeseburger', 'cheeseburger', 'hamburger', 'beef burger', 'mcdonalds burger', 'burger', 'burgers'],
      baseUnit: 'piece',
      unitGram: 180,
      calsPerUnit: 480,
      proPerUnit: 24.0,
      carbsPerUnit: 40.0,
      fatPerUnit: 25.0
    },
    {
      id: 'veggie_burger',
      name: 'Veggie Burger',
      keywords: ['veggie burger', 'veg burger', 'aloo tikki burger', 'bean burger', 'plant burger'],
      baseUnit: 'piece',
      unitGram: 180,
      calsPerUnit: 370,
      proPerUnit: 11.0,
      carbsPerUnit: 48.0,
      fatPerUnit: 15.0
    },
    {
      id: 'chicken_sandwich',
      name: 'Chicken Sandwich',
      keywords: ['chicken sandwich', 'chicken mayo sandwich', 'grilled chicken sandwich', 'club sandwich chicken'],
      baseUnit: 'piece',
      unitGram: 180,
      calsPerUnit: 380,
      proPerUnit: 28.0,
      carbsPerUnit: 34.0,
      fatPerUnit: 14.0
    },
    {
      id: 'sandwich',
      name: 'Sandwich (Veg / Cheese)',
      keywords: ['veg sandwich', 'vegetable sandwich', 'cheese sandwich', 'grilled cheese', 'grilled sandwich', 'sandwich', 'sandwiches'],
      baseUnit: 'piece',
      unitGram: 160,
      calsPerUnit: 310,
      proPerUnit: 10.0,
      carbsPerUnit: 36.0,
      fatPerUnit: 14.0
    },
    {
      id: 'egg_sandwich',
      name: 'Egg Sandwich',
      keywords: ['egg sandwich', 'egg mayo sandwich', 'boiled egg sandwich'],
      baseUnit: 'piece',
      unitGram: 170,
      calsPerUnit: 340,
      proPerUnit: 16.0,
      carbsPerUnit: 32.0,
      fatPerUnit: 16.0
    },
    {
      id: 'chicken_sub',
      name: 'Chicken Sub (6-inch)',
      keywords: ['chicken subway', 'subway chicken', 'chicken sub', '6 inch sub', 'subway sub'],
      baseUnit: 'piece',
      unitGram: 230,
      calsPerUnit: 390,
      proPerUnit: 27.0,
      carbsPerUnit: 46.0,
      fatPerUnit: 10.0
    },
    {
      id: 'chicken_wrap',
      name: 'Chicken Wrap / Roll',
      keywords: ['chicken wrap', 'chicken roll', 'kathi roll chicken', 'shawarma wrap', 'chicken shawarma'],
      baseUnit: 'piece',
      unitGram: 220,
      calsPerUnit: 420,
      proPerUnit: 28.0,
      carbsPerUnit: 44.0,
      fatPerUnit: 15.0
    },
    {
      id: 'paneer_wrap',
      name: 'Paneer Wrap / Roll',
      keywords: ['paneer wrap', 'paneer roll', 'veg roll', 'kathi roll paneer', 'veg wrap'],
      baseUnit: 'piece',
      unitGram: 220,
      calsPerUnit: 390,
      proPerUnit: 16.0,
      carbsPerUnit: 45.0,
      fatPerUnit: 16.0
    },
    {
      id: 'egg_roll',
      name: 'Egg Roll / Wrap',
      keywords: ['egg roll', 'egg wrap', 'double egg roll'],
      baseUnit: 'piece',
      unitGram: 200,
      calsPerUnit: 360,
      proPerUnit: 15.0,
      carbsPerUnit: 40.0,
      fatPerUnit: 16.0
    },
    {
      id: 'pizza_slice',
      name: 'Pizza (Slice)',
      keywords: ['slice of pizza', 'slices of pizza', 'chicken pizza', 'cheese pizza', 'pepperoni pizza', 'veg pizza', 'pizza slice', 'pizza', 'pizzas'],
      baseUnit: 'piece',
      unitGram: 110,
      calsPerUnit: 270,
      proPerUnit: 12.0,
      carbsPerUnit: 30.0,
      fatPerUnit: 11.0
    },
    {
      id: 'chicken_nuggets',
      name: 'Chicken Nuggets',
      keywords: ['chicken nuggets', 'nuggets', 'chicken tenders', 'chicken strips'],
      baseUnit: 'piece',
      unitGram: 20,
      calsPerUnit: 48,
      proPerUnit: 2.8,
      carbsPerUnit: 3.0,
      fatPerUnit: 2.8
    },
    {
      id: 'chicken_wings',
      name: 'Chicken Wings',
      keywords: ['chicken wings', 'hot wings', 'bbq wings', 'chicken wing'],
      baseUnit: 'piece',
      unitGram: 45,
      calsPerUnit: 105,
      proPerUnit: 8.5,
      carbsPerUnit: 1.5,
      fatPerUnit: 7.2
    },
    {
      id: 'french_fries',
      name: 'French Fries',
      keywords: ['french fries', 'fries', 'finger chips', 'potato fries'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 312,
      proPer100: 3.4,
      carbsPer100: 41.0,
      fatPer100: 15.0
    },
    {
      id: 'momos',
      name: 'Momos / Dumplings',
      keywords: ['chicken momos', 'chicken momo', 'steamed momos', 'veg momos', 'momos', 'dumplings'],
      baseUnit: 'piece',
      unitGram: 30,
      calsPerUnit: 45,
      proPerUnit: 3.0,
      carbsPerUnit: 5.5,
      fatPerUnit: 1.2
    },
    {
      id: 'samosa',
      name: 'Samosa',
      keywords: ['samosa', 'samosas'],
      baseUnit: 'piece',
      unitGram: 90,
      calsPerUnit: 260,
      proPerUnit: 4.0,
      carbsPerUnit: 32.0,
      fatPerUnit: 13.0
    },
    {
      id: 'tandoori_chicken',
      name: 'Tandoori Chicken / Tikka',
      keywords: ['tandoori chicken', 'chicken tikka', 'chicken kebab', 'chicken kabab', 'grilled chicken tikka'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 175,
      proPer100: 28.0,
      carbsPer100: 3.0,
      fatPer100: 5.5
    },
    {
      id: 'chicken_curry_dish',
      name: 'Chicken Curry / Butter Chicken',
      keywords: ['butter chicken', 'chicken curry', 'chicken tikka masala', 'murgh makhani'],
      baseUnit: 'g',
      defaultServing: 200,
      calsPer100: 160,
      proPer100: 14.0,
      carbsPer100: 5.0,
      fatPer100: 9.5
    },
    {
      id: 'chicken_soup',
      name: 'Chicken Soup',
      keywords: ['chicken soup', 'clear chicken soup', 'chicken broth'],
      baseUnit: 'ml',
      defaultServing: 250,
      calsPer100: 40,
      proPer100: 4.0,
      carbsPer100: 2.0,
      fatPer100: 1.5
    },
    {
      id: 'chicken_fried_rice',
      name: 'Chicken Fried Rice',
      keywords: ['chicken fried rice'],
      baseUnit: 'g',
      defaultServing: 250,
      calsPer100: 168,
      proPer100: 7.8,
      carbsPer100: 24.0,
      fatPer100: 4.5
    },
    {
      id: 'fried_rice',
      name: 'Fried Rice / Egg Fried Rice',
      keywords: ['egg fried rice', 'veg fried rice', 'fried rice'],
      baseUnit: 'g',
      defaultServing: 250,
      calsPer100: 155,
      proPer100: 4.8,
      carbsPer100: 26.0,
      fatPer100: 3.8
    },
    {
      id: 'chicken_noodles',
      name: 'Chicken Noodles',
      keywords: ['chicken noodles', 'chicken chow mein', 'chicken hakka noodles'],
      baseUnit: 'g',
      defaultServing: 250,
      calsPer100: 165,
      proPer100: 7.5,
      carbsPer100: 24.0,
      fatPer100: 4.5
    },
    {
      id: 'veg_noodles',
      name: 'Veg Noodles / Chow Mein',
      keywords: ['veg noodles', 'chow mein', 'hakka noodles', 'noodles', 'maggi', 'instant noodles'],
      baseUnit: 'g',
      defaultServing: 200,
      calsPer100: 150,
      proPer100: 3.5,
      carbsPer100: 26.0,
      fatPer100: 3.5
    },
    {
      id: 'poha',
      name: 'Poha',
      keywords: ['poha', 'flattened rice'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 130,
      proPer100: 2.5,
      carbsPer100: 25.0,
      fatPer100: 2.3
    },
    {
      id: 'upma',
      name: 'Upma',
      keywords: ['upma', 'rava upma'],
      baseUnit: 'g',
      defaultServing: 150,
      calsPer100: 125,
      proPer100: 3.0,
      carbsPer100: 22.0,
      fatPer100: 2.8
    },
    {
      id: 'protein_bar',
      name: 'Protein Bar',
      keywords: ['protein bar', 'energy bar', 'granola bar'],
      baseUnit: 'piece',
      unitGram: 60,
      calsPerUnit: 220,
      proPerUnit: 20.0,
      carbsPerUnit: 22.0,
      fatPerUnit: 6.0
    },
    {
      id: 'ice_cream',
      name: 'Ice Cream',
      keywords: ['ice cream', 'icecream', 'gelato'],
      baseUnit: 'g',
      defaultServing: 100,
      calsPer100: 207,
      proPer100: 3.5,
      carbsPer100: 24.0,
      fatPer100: 11.0
    }
  ],

  detectCategory(text, defaultCategory = 'auto') {
    const lower = text.toLowerCase();
    if (/\b(breakfast|nashta|morning)\b/.test(lower)) return 'breakfast';
    if (/\b(lunch|noon|midday)\b/.test(lower)) return 'lunch';
    if (/\b(dinner|raat|supper)\b/.test(lower)) return 'dinner';
    if (/\b(snack|snacks|pre\s*workout|post\s*workout|shake|tea)\b/.test(lower)) return 'snack';

    if (defaultCategory && defaultCategory !== 'auto') {
      return defaultCategory;
    }

    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return 'breakfast';
    if (hr >= 12 && hr < 17) return 'lunch';
    if (hr >= 17 && hr < 22) return 'dinner';
    return 'snack';
  },

  parseMealText(rawText, defaultCategory = 'auto') {
    if (!rawText || typeof rawText !== 'string') {
      return { category: 'snack', items: [], totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
    }

    const detectedCategory = this.detectCategory(rawText, defaultCategory);
    const rawLines = rawText.split('\n');
    const candidateLines = [];

    for (const rawLine of rawLines) {
      let trimmed = rawLine.trim();
      if (!trimmed) continue;

      const isHeaderOnly = /^(breakfast|lunch|dinner|snack|snacks|meal)\s*:?$/i.test(trimmed);
      if (isHeaderOnly) continue;

      trimmed = trimmed.replace(/^(breakfast|lunch|dinner|snack|snacks|meal)\s*:\s*/i, '');

      if (trimmed.includes(',')) {
        trimmed.split(',').forEach(part => {
          const p = part.trim();
          if (p) candidateLines.push(p);
        });
      } else {
        candidateLines.push(trimmed);
      }
    }

    const items = [];
    for (let line of candidateLines) {
      // Remove bullets, dashes, and numbered list prefixes like "1." or "1)", preserving quantity counts like "2 eggs"
      line = line.replace(/^[\s*\-•]+/, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (!line) continue;

      const parsed = this.parseSingleItem(line, detectedCategory);
      if (parsed) {
        items.push(parsed);
      }
    }

    const totalCalories = Math.round(items.reduce((sum, it) => sum + it.calories, 0));
    const totalProtein = Math.round(items.reduce((sum, it) => sum + it.protein, 0) * 10) / 10;
    const totalCarbs = Math.round(items.reduce((sum, it) => sum + it.carbs, 0) * 10) / 10;
    const totalFat = Math.round(items.reduce((sum, it) => sum + it.fat, 0) * 10) / 10;

    return {
      category: detectedCategory,
      items,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat
    };
  },

  parseSingleItem(line, category = 'snack') {
    // 1. Strip conversational leading phrases like "i ate", "i had", "consumed", etc.
    let cleaned = line
      .replace(/^(?:i\s+(?:ate|had|consumed|drank|took|am\s+having)|ate|had|having|eaten|drank|taking)\s+/i, '')
      .trim();

    const lower = cleaned.toLowerCase();
    let qty = null;
    let unit = null;

    // Unit regex matching numbers with units, including no, nos, no., nos., number, pcs, etc.
    const unitRegex = /(\d+(?:\.\d+)?)\s*(no\.?|nos\.?|numbers?|pcs?|pieces?|slices?|scoops?|g|gm|gms|grams?|kg|ml|l|liters?|litres?|cups?|bowls?|tbsp|tablespoons?|tsp)\b/i;
    const unitMatch = lower.match(unitRegex);

    if (unitMatch) {
      qty = parseFloat(unitMatch[1]);
      const rawUnit = unitMatch[2].toLowerCase().replace(/\.$/, '');
      if (['gm', 'gms', 'gram', 'grams'].includes(rawUnit)) unit = 'g';
      else if (rawUnit === 'kg') { qty = qty * 1000; unit = 'g'; }
      else if (['l', 'liter', 'litre'].includes(rawUnit)) { qty = qty * 1000; unit = 'ml'; }
      else if (['scoop', 'scoops'].includes(rawUnit)) unit = 'scoop';
      else if (['slice', 'slices'].includes(rawUnit)) unit = 'slice';
      else if (['no', 'nos', 'number', 'numbers', 'pc', 'pcs', 'piece', 'pieces'].includes(rawUnit)) unit = 'piece';
      else if (['cup', 'cups', 'bowl', 'bowls'].includes(rawUnit)) unit = 'cup';
      else if (['tbsp', 'tablespoon', 'tablespoons'].includes(rawUnit)) unit = 'tbsp';
      else unit = rawUnit;
    } else {
      const startNumMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:no\.?|nos\.?|pieces?|pcs?|servings?)?\s*(?:of\s+)?(?:boiled|whole|cooked|raw)?\s*(.*)$/);
      if (startNumMatch) {
        qty = parseFloat(startNumMatch[1]);
        unit = 'piece';
      } else {
        const endNumMatch = lower.match(/[-:]\s*(\d+(?:\.\d+)?)\s*(?:no\.?|nos\.?|pcs?|pieces?|g|gm)?$/);
        if (endNumMatch) {
          qty = parseFloat(endNumMatch[1]);
          unit = 'g';
        }
      }
    }

    let matchedFood = null;
    // Check longer, more specific keywords first (e.g. "peanut butter" before "butter", "boiled egg white" before "egg")
    const allCandidates = [];
    for (const food of this.FOOD_DB) {
      for (const kw of food.keywords) {
        allCandidates.push({ kw, food });
      }
    }
    allCandidates.sort((a, b) => b.kw.length - a.kw.length);

    for (const { kw, food } of allCandidates) {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        matchedFood = food;
        break;
      }
    }

    if (matchedFood) {
      let finalServing = '';
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;

      if (matchedFood.baseUnit === 'g') {
        let grams = matchedFood.defaultServing;
        if (qty !== null) {
          if (unit === 'g') {
            grams = qty;
          } else if (unit === 'cup') {
            grams = qty * 180;
          } else if (unit === 'bowl') {
            grams = qty * 200;
          } else if (unit === 'piece' || (unit === null && qty <= 5)) {
            // Count of portions/servings, e.g. "1 french fries", "1 salad", "2 rice"
            grams = qty * matchedFood.defaultServing;
          } else {
            grams = qty;
          }
        }
        const scale = grams / 100;
        calories = matchedFood.calsPer100 * scale;
        protein = matchedFood.proPer100 * scale;
        carbs = matchedFood.carbsPer100 * scale;
        fat = matchedFood.fatPer100 * scale;
        finalServing = `${Math.round(grams)}g`;
      } else if (matchedFood.baseUnit === 'ml') {
        const mls = qty !== null ? qty : matchedFood.defaultServing;
        const scale = mls / 100;
        calories = matchedFood.calsPer100 * scale;
        protein = matchedFood.proPer100 * scale;
        carbs = matchedFood.carbsPer100 * scale;
        fat = matchedFood.fatPer100 * scale;
        finalServing = `${Math.round(mls)}ml`;
      } else {
        let count = 1;
        if (qty !== null) {
          if (unit === 'g' && matchedFood.unitGram) {
            count = qty / matchedFood.unitGram;
          } else {
            count = qty;
          }
        }
        calories = matchedFood.calsPerUnit * count;
        protein = matchedFood.proPerUnit * count;
        carbs = matchedFood.carbsPerUnit * count;
        fat = matchedFood.fatPerUnit * count;
        const countDisplay = Math.round(count * 10) / 10;
        const unitName = matchedFood.baseUnit === 'piece' ? (countDisplay === 1 ? 'pc' : 'pcs') : matchedFood.baseUnit;
        finalServing = (unit === 'g') ? `${Math.round(qty)}g (${countDisplay} ${unitName})` : `${countDisplay} ${unitName}`;
      }

      return {
        name: matchedFood.name,
        serving: finalServing,
        calories: Math.round(calories * 10) / 10,
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fat: Math.round(fat * 10) / 10,
        category
      };
    }

    let cleanName = line
      .replace(/[-:]\s*\d+(\.\d+)?\s*(g|gm|ml|pcs|piece|scoop|no|nos)?/gi, '')
      .replace(/^\d+(\.\d+)?\s*(g|gm|ml|pcs|piece|scoop|no|nos)?\s*(?:of\s+)?/gi, '')
      .replace(/^(?:i\s+(?:ate|had|consumed|drank|took)|ate|had|having)\s+/i, '')
      .trim();
    if (!cleanName) cleanName = line.trim();

    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    // If unit is piece or count is <= 10, estimate as portion (e.g. 100g per piece/serving) rather than literal grams
    let estGrams;
    if (unit === 'piece' || (!unit && qty && qty <= 10)) {
      estGrams = (qty || 1) * 100;
    } else {
      estGrams = qty || 100;
    }
    const scale = estGrams / 100;

    return {
      name: `${cleanName} (Est.)`,
      serving: unit === 'piece' ? `${qty || 1} pcs (${estGrams}g)` : `${estGrams}g`,
      calories: Math.round(140 * scale),
      protein: Math.round(5.0 * scale * 10) / 10,
      carbs: Math.round(18.0 * scale * 10) / 10,
      fat: Math.round(5.0 * scale * 10) / 10,
      category
    };
  }
};

/**
 * 3. STORAGE ADAPTER & SERVICE (FitTrackStore)
 * Abstracted persistence layer with LocalStorage implementation, schema versioning,
 * validation, JSON & CSV import/export, and ready-to-plug Supabase/Firebase interfaces.
 */
class FitTrackStore {
  constructor() {
    this.STORAGE_KEY = 'fittrack_app_data_v1';
    this.SCHEMA_VERSION = 1;
    this.currentUser = null;
    this.defaultProfile = {
      name: 'User',
      hasOnboarded: false,
      age: null,
      sex: 'male',
      height: null,
      weight: null,
      bodyFat: null,
      targetBodyFat: 10,
      trainingFrequency: 4,
      activityLevel: '1.375',
      primaryGoal: '',
      goal: 'fat_loss',
      secondaryGoal: '',
      constraint: '',
      dietingFloor: 1500
    };

    this.defaultGoals = {
      dailyCalories: 2200,
      dailyProtein: 150,
      dailyCarbs: 230,
      dailyFat: 65,
      dailyWaterMl: 3000,
      dailySleepHours: 8,
      weeklyWorkouts: 6,
      targetWeight: null,
      targetBodyFat: 10,
      autoGoalAdjust: true
    };

    this.defaultPresets = [
      { id: 'fp-1', name: 'Chicken Breast (cooked)', serving: '200g', calories: 330, protein: 62, carbs: 0, fat: 7, category: 'lunch' },
      { id: 'fp-2', name: 'Whey Protein Isolate', serving: '1 scoop (32g)', calories: 120, protein: 25, carbs: 2, fat: 1, category: 'snack' },
      { id: 'fp-3', name: 'Whole Eggs (3 large)', serving: '3 eggs', calories: 215, protein: 19, carbs: 1, fat: 15, category: 'breakfast' },
      { id: 'fp-4', name: 'Rolled Oats with Water', serving: '80g dry', calories: 304, protein: 11, carbs: 54, fat: 5, category: 'breakfast' },
      { id: 'fp-5', name: 'Greek Yogurt 0%', serving: '200g', calories: 118, protein: 20, carbs: 8, fat: 0, category: 'snack' },
      { id: 'fp-6', name: 'White or Brown Rice (cooked)', serving: '200g', calories: 260, protein: 5, carbs: 57, fat: 1, category: 'dinner' },
      { id: 'fp-7', name: 'Extra Virgin Olive Oil', serving: '1 tbsp (14g)', calories: 119, protein: 0, carbs: 0, fat: 14, category: 'dinner' },
      { id: 'fp-8', name: 'Canned Tuna in Water', serving: '1 can (130g drained)', calories: 130, protein: 28, carbs: 0, fat: 1, category: 'lunch' }
    ];

    this.data = this.loadData();
  }

  /**
   * Switch the active user database context for complete multi-tenant user isolation.
   * Admin uses 'fittrack_app_data_v1'; regular members use 'fittrack_user_data_<userId>'.
   */
  switchUser(user) {
    // 1. Before switching away from the current user, save and backup current user's data
    if (this.data && this.STORAGE_KEY) {
      try {
        this.saveData();
        this.backupCurrentUserData();
      } catch (e) {}
    }

    // 2. Set new user context
    this.currentUser = user || null;
    if (user && user.role !== 'admin') {
      const uid = user.id || user.username || 'member';
      this.STORAGE_KEY = `fittrack_user_data_${uid}`;
    } else {
      this.STORAGE_KEY = 'fittrack_app_data_v1';
    }

    // 3. Load data for this user
    this.data = this.loadData();

    // 4. Admin auto-recovery if food logs or daily logs are missing and user has onboarded
    if ((!user || user.role === 'admin') && this.data?.profile?.hasOnboarded && (!this.data.foodEntries || this.data.foodEntries.length === 0)) {
      this.attemptAdminRecovery();
    }

    // 5. Write an immediate backup snapshot for the active user
    this.backupCurrentUserData();

    return this.data;
  }

  /**
   * Automated snapshot backup of the current user's database
   */
  backupCurrentUserData(data = this.data) {
    if (!data) return;
    try {
      const userKey = (this.currentUser && this.currentUser.role !== 'admin')
        ? (this.currentUser.id || this.currentUser.username)
        : 'admin';
      const backupKey = `fittrack_backup_${userKey}_latest`;
      localStorage.setItem(backupKey, JSON.stringify({
        userId: userKey,
        savedAt: new Date().toISOString(),
        data
      }));

      // Update multi-user database registry
      this.updateDatabaseRegistry(userKey, data);
    } catch (e) {
      console.warn('[FitTrackStore] Failed to write backup snapshot:', e);
    }
  }

  /**
   * Retrieve the latest automatic backup for a specific user
   */
  getLatestBackup(targetUserKey) {
    try {
      const userKey = targetUserKey || ((this.currentUser && this.currentUser.role !== 'admin')
        ? (this.currentUser.id || this.currentUser.username)
        : 'admin');
      const backupKey = `fittrack_backup_${userKey}_latest`;
      const raw = localStorage.getItem(backupKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) return parsed.data;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Maintain a multi-user database registry tracking all user data partitions and records
   */
  updateDatabaseRegistry(userKey, data) {
    try {
      const regKey = 'fittrack_database_registry_v1';
      let reg = {};
      try {
        const raw = localStorage.getItem(regKey);
        if (raw) reg = JSON.parse(raw);
      } catch {}

      reg[userKey] = {
        userKey,
        username: this.currentUser?.username || userKey,
        role: this.currentUser?.role || (userKey === 'admin' ? 'admin' : 'user'),
        storageKey: this.STORAGE_KEY,
        logsCount: data.dailyLogs?.length || 0,
        foodsCount: data.foodEntries?.length || 0,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(regKey, JSON.stringify(reg));
    } catch (e) {}
  }

  /**
   * Automatic recovery to restore admin logs and foods if emptied during user switching
   */
  attemptAdminRecovery() {
    try {
      // Do not recover if user has not completed onboarding or explicitly reset
      if (this.data?.profile?.hasOnboarded === false) {
        return false;
      }

      // 1. Check if an admin backup snapshot exists
      const backup = this.getLatestBackup('admin');
      if (backup && Array.isArray(backup.foodEntries) && backup.foodEntries.length > 0) {
        this.data = this.migrateAndValidate(backup);
        this.saveData(this.data);
        console.log('[FitTrackStore] Restored admin data and logs from backup snapshot.');
        return true;
      }

      return false;
    } catch (e) {
      console.warn('[FitTrackStore] Admin recovery error:', e);
      return false;
    }
  }

  /**
   * Clean starter profile for new non-admin members requiring first-time onboarding
   */
  getInitialMemberState(user) {
    const displayName = user?.displayName || user?.username || 'Member';
    return {
      version: this.SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      profile: {
        name: displayName,
        hasOnboarded: false,
        age: 25,
        sex: 'male',
        height: 170,
        weight: 70,
        bodyFat: 22,
        targetBodyFat: 10,
        trainingFrequency: 4,
        activityLevel: '1.375',
        primaryGoal: 'Lose body fat, build muscle, and tone up',
        goal: 'fat_loss',
        secondaryGoal: 'Improve energy and overall wellness',
        constraint: 'Evidence-based sustainable deficit without severe restriction',
        dietingFloor: 1500
      },
      goals: {
        dailyCalories: 2000,
        dailyProtein: 140,
        dailyCarbs: 220,
        dailyFat: 60,
        dailyWaterMl: 2500,
        dailySleepHours: 8,
        weeklyWorkouts: 4,
        targetWeight: null,
        targetBodyFat: 10,
        autoGoalAdjust: true
      },
      dailyLogs: [],
      workouts: [],
      measurements: [],
      foodPresets: [...this.defaultPresets],
      foodEntries: [],
      exercisePRs: {}
    };
  }

  /**
   * Initial default database schema
   */
  getInitialState() {
    return {
      version: this.SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      profile: { ...this.defaultProfile },
      goals: { ...this.defaultGoals },
      dailyLogs: [],
      workouts: [],
      measurements: [],
      foodPresets: [...this.defaultPresets],
      foodEntries: [],
      exercisePRs: {}
    };
  }

  /**
   * Load data from browser LocalStorage with multi-tenant backup fallback and validation
   */
  loadData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        // If primary key is empty, check if an auto-backup snapshot exists for this user
        const backup = this.getLatestBackup();
        if (backup) {
          this.saveData(backup);
          return backup;
        }

        const initial = (this.currentUser && this.currentUser.role !== 'admin')
          ? this.getInitialMemberState(this.currentUser)
          : this.getInitialState();
        this.saveData(initial);
        return initial;
      }

      let parsed = JSON.parse(raw);

      // If data is encrypted, check for plaintext backup
      if (parsed && parsed.encrypted) {
        const backup = this.getLatestBackup();
        if (backup) return this.migrateAndValidate(backup);

        return (this.currentUser && this.currentUser.role !== 'admin')
          ? this.getInitialMemberState(this.currentUser)
          : this.getInitialState();
      }

      return this.migrateAndValidate(parsed);
    } catch (err) {
      console.error('[FitTrackStore] Failed to load data from localStorage:', err);
      const backup = this.getLatestBackup();
      if (backup) return this.migrateAndValidate(backup);

      return (this.currentUser && this.currentUser.role !== 'admin')
        ? this.getInitialMemberState(this.currentUser)
        : this.getInitialState();
    }
  }

  /**
   * Decrypt and load data once master passphrase has been unlocked
   */
  async loadEncryptedData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return this.getInitialState();
      const parsed = JSON.parse(raw);
      if (parsed && parsed.encrypted) {
        if (!FitTrackVault.sessionKey) throw new Error('Vault is locked.');
        const plainStr = await FitTrackVault.decrypt(parsed);
        const data = JSON.parse(plainStr);
        this.data = this.migrateAndValidate(data);
        return this.data;
      } else {
        this.data = this.migrateAndValidate(parsed);
        return this.data;
      }
    } catch (err) {
      console.error('[FitTrackStore] Failed to decrypt data:', err);
      return this.getInitialState();
    }
  }

  /**
   * Validate and migrate stored data across schema versions
   */
  migrateAndValidate(stored) {
    if (!stored || typeof stored !== 'object') {
      return (this.currentUser && this.currentUser.role !== 'admin')
        ? this.getInitialMemberState(this.currentUser)
        : this.getInitialState();
    }
    const initial = (this.currentUser && this.currentUser.role !== 'admin')
      ? this.getInitialMemberState(this.currentUser)
      : this.getInitialState();
    const migrated = {
      version: this.SCHEMA_VERSION,
      updatedAt: stored.updatedAt || new Date().toISOString(),
      profile: { ...initial.profile, ...(stored.profile || {}) },
      goals: { ...initial.goals, ...(stored.goals || {}) },
      dailyLogs: Array.isArray(stored.dailyLogs) ? stored.dailyLogs : [],
      workouts: Array.isArray(stored.workouts) ? stored.workouts : [],
      measurements: Array.isArray(stored.measurements) ? stored.measurements : [],
      foodPresets: Array.isArray(stored.foodPresets) && stored.foodPresets.length > 0 ? stored.foodPresets : initial.foodPresets,
      foodEntries: Array.isArray(stored.foodEntries) ? stored.foodEntries : [],
      exercisePRs: stored.exercisePRs && typeof stored.exercisePRs === 'object' ? stored.exercisePRs : {}
    };

    if (!migrated.profile.primaryGoal && migrated.profile.goal) {
      migrated.profile.primaryGoal = migrated.profile.goal;
    }

    return migrated;
  }

  /**
   * Save current state to LocalStorage as permanent JSON per user with anti-erasure safeguards
   * @param {Object} [dataToSave]
   * @returns {{ success: boolean, error?: string }}
   */
  saveData(dataToSave = this.data, force = false) {
    try {
      if (!dataToSave || typeof dataToSave !== 'object') return { success: false };

      // Protection against accidental empty overwrite: preserve existing logs if dataToSave is empty and not an explicit reset
      if (!force) {
        const existingRaw = localStorage.getItem(this.STORAGE_KEY);
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw);
            if (existing && !existing.encrypted) {
              const hasExistingData = (existing.dailyLogs?.length > 0) || (existing.foodEntries?.length > 0);
              const isIncomingEmpty = (dataToSave.dailyLogs?.length === 0) && (dataToSave.foodEntries?.length === 0);
              if (hasExistingData && isIncomingEmpty && dataToSave.profile?.hasOnboarded !== false) {
                console.warn(`[FitTrackStore] Safeguard: Preserving existing records for ${this.STORAGE_KEY}`);
                dataToSave.dailyLogs = existing.dailyLogs;
                dataToSave.foodEntries = existing.foodEntries;
                if (existing.measurements?.length > 0 && (!dataToSave.measurements || dataToSave.measurements.length === 0)) {
                  dataToSave.measurements = existing.measurements;
                }
              }
            }
          } catch (e) {}
        }
      }

      dataToSave.updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(dataToSave);

      // Persist as standard, reliable JSON per user
      localStorage.setItem(this.STORAGE_KEY, serialized);

      // Write an automated backup snapshot
      this.backupCurrentUserData(dataToSave);

      this.data = dataToSave;
      return { success: true };
    } catch (err) {
      console.error('[FitTrackStore] Storage save error:', err);
      let errorMsg = 'Failed to save data.';
      if (err.name === 'QuotaExceededError' || err.code === 22) {
        errorMsg = 'Browser storage quota exceeded. Please export a backup and clear older logs.';
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Reset all data with clean state
   * Clears historical logs and resets profile so the user can enter fresh information.
   */
  resetData(force = true) {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(`${this.STORAGE_KEY}_backup`);
      localStorage.removeItem(`${this.STORAGE_KEY}_backup_latest`);
      const backupKeys = Object.keys(localStorage).filter(k => k.startsWith('fittrack_backup_'));
      backupKeys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}

    const fresh = this.getInitialState();
    this.saveData(fresh, true);
    return fresh;
  }

  /**
   * Export all user data as formatted JSON string
   * @returns {string}
   */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Import data from JSON string with strict validation
   * @param {string} jsonStr
   * @returns {{ success: boolean, message: string }}
   */
  importJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Invalid JSON format. Please provide a valid FitTrack backup file.' };
      }

      // Check required top-level collections
      if (!parsed.profile && !parsed.dailyLogs && !parsed.workouts) {
        return { success: false, message: 'The provided backup file does not appear to be a recognized FitTrack backup.' };
      }

      const migrated = this.migrateAndValidate(parsed);
      const saveRes = this.saveData(migrated);
      if (!saveRes.success) {
        return { success: false, message: saveRes.error || 'Failed to save imported data.' };
      }

      // Re-evaluate PRs and streak integrity after import
      this.recomputeAllPRs();
      return { success: true, message: 'Data imported successfully! All records, PRs, and logs have been restored.' };
    } catch (err) {
      return { success: false, message: `JSON parsing error: ${err.message}` };
    }
  }

  /**
   * Export historical collections as CSV strings
   * @param {'measurements'|'dailyLogs'|'workouts'} type
   * @returns {string} CSV text
   */
  exportCSV(type) {
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    if (type === 'measurements') {
      const headers = ['Date', 'Weight (kg)', 'Body Fat (%)', 'Waist (cm)', 'Chest (cm)', 'Arms (cm)', 'Hips (cm)', 'Thighs (cm)', 'Notes'];
      const rows = this.data.measurements.map(m => [
        escapeCSV(m.date),
        escapeCSV(m.weight ?? ''),
        escapeCSV(m.bodyFat ?? ''),
        escapeCSV(m.waist ?? ''),
        escapeCSV(m.chest ?? ''),
        escapeCSV(m.arms ?? ''),
        escapeCSV(m.hips ?? ''),
        escapeCSV(m.thighs ?? ''),
        escapeCSV(m.notes ?? '')
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    }

    if (type === 'dailyLogs') {
      const headers = ['Date', 'Completed', 'Weight (kg)', 'Body Fat (%)', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Workout Type', 'Water (ml)', 'Sleep (hrs)', 'Notes'];
      const rows = this.data.dailyLogs.map(l => [
        escapeCSV(l.date),
        escapeCSV(l.completed ? 'Yes' : 'No'),
        escapeCSV(l.weight ?? ''),
        escapeCSV(l.bodyFat ?? ''),
        escapeCSV(l.calories ?? ''),
        escapeCSV(l.protein ?? ''),
        escapeCSV(l.carbs ?? ''),
        escapeCSV(l.fat ?? ''),
        escapeCSV(l.workoutStatus ?? ''),
        escapeCSV(l.waterMl ?? ''),
        escapeCSV(l.sleepHours ?? ''),
        escapeCSV(l.notes ?? '')
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    }

    if (type === 'workouts') {
      const headers = ['Workout Date', 'Workout Name', 'Exercise Name', 'Muscle Group', 'Primary Lift', 'Set #', 'Weight (kg)', 'Reps', 'RPE', 'Est 1RM (kg)', 'Actual 1RM', 'Notes'];
      const rows = [];
      this.data.workouts.forEach(w => {
        (w.exercises || []).forEach(e => {
          (e.sets || []).forEach((s, idx) => {
            const calc = FitTrackCalc.calculate1RM(s.weight, s.reps);
            rows.push([
              escapeCSV(w.date),
              escapeCSV(w.name),
              escapeCSV(e.name),
              escapeCSV(e.muscleGroup || ''),
              escapeCSV(e.isPrimary ? 'Yes' : 'No'),
              escapeCSV(idx + 1),
              escapeCSV(s.weight),
              escapeCSV(s.reps),
              escapeCSV(s.rpe ?? ''),
              escapeCSV(calc.estimated1RM),
              escapeCSV(calc.isActual1RM ? 'Yes' : 'No'),
              escapeCSV(e.notes || s.notes || '')
            ]);
          });
        });
      });
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    }

    return '';
  }

  // --- CRUD HELPERS FOR COLLECTIONS ---

  /**
   * Save or update a daily log (prevents duplicates for the same date)
   * @param {Object} log
   */
  saveDailyLog(log) {
    if (!log || !log.date) return false;
    const existingIndex = this.data.dailyLogs.findIndex(l => l.date === log.date);
    if (existingIndex >= 0) {
      this.data.dailyLogs[existingIndex] = { ...this.data.dailyLogs[existingIndex], ...log, updatedAt: new Date().toISOString() };
    } else {
      this.data.dailyLogs.push({ ...log, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    // Also if weight is provided in daily log, record/update measurement for that date
    if (typeof log.weight === 'number' && log.weight > 0) {
      this.recordMeasurement({
        date: log.date,
        weight: log.weight,
        bodyFat: log.bodyFat ?? null,
        notes: log.notes ? `Daily log note: ${log.notes}` : ''
      });
    }
    this.saveData();
    return true;
  }

  getDailyLog(dateStr) {
    return this.data.dailyLogs.find(l => l.date === dateStr) || null;
  }

  getTodayString() {
    return FitTrackCalc.formatDateLocal();
  }

  deleteDailyLog(dateStr) {
    this.data.dailyLogs = this.data.dailyLogs.filter(l => l.date !== dateStr);
    this.saveData();
  }

  /**
   * Save or update a body measurement (prevents duplicates for same date)
   * @param {Object} measurement
   */
  recordMeasurement(measurement) {
    if (!measurement || !measurement.date) return false;
    const idx = this.data.measurements.findIndex(m => m.date === measurement.date);
    if (idx >= 0) {
      this.data.measurements[idx] = { ...this.data.measurements[idx], ...measurement, updatedAt: new Date().toISOString() };
    } else {
      this.data.measurements.push({ ...measurement, id: 'm-' + Date.now(), createdAt: new Date().toISOString() });
    }
    // Sort ascending by date
    this.data.measurements.sort((a, b) => a.date.localeCompare(b.date));
    this.saveData();
    return true;
  }

  deleteMeasurement(idOrDate) {
    this.data.measurements = this.data.measurements.filter(m => m.id !== idOrDate && m.date !== idOrDate);
    this.saveData();
  }

  /**
   * Workouts and PR Engine
   */
  saveWorkout(workout) {
    if (!workout || !workout.date) return false;
    if (!workout.id) workout.id = 'w-' + Date.now();
    
    const idx = this.data.workouts.findIndex(w => w.id === workout.id);
    if (idx >= 0) {
      this.data.workouts[idx] = { ...workout, updatedAt: new Date().toISOString() };
    } else {
      this.data.workouts.push({ ...workout, createdAt: new Date().toISOString() });
    }

    // Sort workouts descending by date
    this.data.workouts.sort((a, b) => b.date.localeCompare(a.date));
    
    // Check and update PRs for exercises in this workout
    this.updatePRsForWorkout(workout);

    this.saveData();
    return workout;
  }

  deleteWorkout(workoutId) {
    this.data.workouts = this.data.workouts.filter(w => w.id !== workoutId);
    this.recomputeAllPRs();
    this.saveData();
  }

  /**
   * Recompute PR records across all workout history
   * Ensures PRs are strictly maintained and never lost when lifting lighter in later workouts.
   */
  recomputeAllPRs() {
    this.data.exercisePRs = {};
    // Chronologically sort workouts ascending to build PR progression history
    const sorted = [...this.data.workouts].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(w => this.updatePRsForWorkout(w, false));
    this.saveData();
  }

  updatePRsForWorkout(workout, save = true) {
    if (!workout || !Array.isArray(workout.exercises)) return;

    workout.exercises.forEach(exercise => {
      if (!exercise.name || !Array.isArray(exercise.sets)) return;
      const exKey = exercise.name.trim().toLowerCase();
      if (!this.data.exercisePRs[exKey]) {
        this.data.exercisePRs[exKey] = {
          name: exercise.name.trim(),
          muscleGroup: exercise.muscleGroup || 'Other',
          isPrimary: !!exercise.isPrimary,
          bestWeight: 0,
          bestWeightReps: 0,
          bestWeightDate: '',
          bestEst1RM: 0,
          bestEst1RMWeight: 0,
          bestEst1RMReps: 0,
          bestEst1RMDate: '',
          bestEst1RMIsActual: false,
          history: [] // Historical PR events
        };
      }

      const pr = this.data.exercisePRs[exKey];
      if (exercise.isPrimary) pr.isPrimary = true;
      if (exercise.muscleGroup) pr.muscleGroup = exercise.muscleGroup;

      exercise.sets.forEach(set => {
        const weight = parseFloat(set.weight) || 0;
        const reps = parseInt(set.reps, 10) || 0;
        if (weight <= 0 || reps <= 0) return;

        const calc = FitTrackCalc.calculate1RM(weight, reps);
        let brokePR = false;

        // Check Best Absolute Weight Lifted
        if (weight > pr.bestWeight || (weight === pr.bestWeight && reps > pr.bestWeightReps)) {
          pr.bestWeight = weight;
          pr.bestWeightReps = reps;
          pr.bestWeightDate = workout.date;
          brokePR = true;
        }

        // Check Best Estimated or Actual 1RM
        if (calc.estimated1RM > pr.bestEst1RM) {
          pr.bestEst1RM = calc.estimated1RM;
          pr.bestEst1RMWeight = weight;
          pr.bestEst1RMReps = reps;
          pr.bestEst1RMDate = workout.date;
          pr.bestEst1RMIsActual = calc.isActual1RM;
          brokePR = true;
        }

        if (brokePR) {
          pr.history.push({
            date: workout.date,
            weight,
            reps,
            est1RM: calc.estimated1RM,
            isActual1RM: calc.isActual1RM
          });
        }
      });
    });

    if (save) {
      this.saveData();
    }
  }

  /**
   * Get previous performance for an exercise to show during logging
   * @param {string} exerciseName
   * @returns {Object|null}
   */
  getPreviousPerformance(exerciseName) {
    if (!exerciseName) return null;
    const target = exerciseName.trim().toLowerCase();
    
    // Search workouts in descending order
    for (const w of this.data.workouts) {
      if (Array.isArray(w.exercises)) {
        const ex = w.exercises.find(e => e.name && e.name.trim().toLowerCase() === target);
        if (ex && Array.isArray(ex.sets) && ex.sets.length > 0) {
          return {
            date: w.date,
            workoutName: w.name,
            sets: ex.sets,
            notes: ex.notes
          };
        }
      }
    }
    return null;
  }

  /**
   * Nutrition CRUD
   */
  addFoodEntry(entry) {
    if (!entry.id) entry.id = 'fe-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    entry.calories = Math.max(0, parseFloat(entry.calories) || 0);
    entry.protein = Math.max(0, parseFloat(entry.protein) || 0);
    entry.carbs = Math.max(0, parseFloat(entry.carbs) || 0);
    entry.fat = Math.max(0, parseFloat(entry.fat) || 0);
    this.data.foodEntries.push(entry);
    this.saveData();
    return entry;
  }

  deleteFoodEntry(id) {
    this.data.foodEntries = this.data.foodEntries.filter(f => f.id !== id);
    this.saveData();
  }

  updateFoodEntry(updated) {
    if (!updated || !updated.id) return false;
    const idx = this.data.foodEntries.findIndex(f => f.id === updated.id);
    if (idx < 0) return false;

    updated.calories = Math.max(0, parseFloat(updated.calories) || 0);
    updated.protein = Math.max(0, parseFloat(updated.protein) || 0);
    updated.carbs = Math.max(0, parseFloat(updated.carbs) || 0);
    updated.fat = Math.max(0, parseFloat(updated.fat) || 0);

    this.data.foodEntries[idx] = {
      ...this.data.foodEntries[idx],
      ...updated,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.foodEntries[idx];
  }

  getFoodEntry(id) {
    return this.data.foodEntries.find(f => f.id === id) || null;
  }

  saveFoodPreset(preset) {
    if (!preset.id) preset.id = 'fp-' + Date.now();
    const idx = this.data.foodPresets.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
      this.data.foodPresets[idx] = preset;
    } else {
      this.data.foodPresets.push(preset);
    }
    this.saveData();
    return preset;
  }

  deleteFoodPreset(id) {
    this.data.foodPresets = this.data.foodPresets.filter(p => p.id !== id);
    this.saveData();
  }

  getFoodEntriesForDate(dateStr) {
    return this.data.foodEntries.filter(f => f.date === dateStr);
  }

  getDailyNutritionTotals(dateStr) {
    const entries = this.getFoodEntriesForDate(dateStr);
    return entries.reduce(
      (acc, item) => ({
        calories: acc.calories + (parseFloat(item.calories) || 0),
        protein: acc.protein + (parseFloat(item.protein) || 0),
        carbs: acc.carbs + (parseFloat(item.carbs) || 0),
        fat: acc.fat + (parseFloat(item.fat) || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }
}

/**
 * 3. CHART CONTROLLER MODULE (FitTrackCharts)
 * Chart.js wrapper with dark charcoal theme styling, empty states, and responsive resizing.
 */
const FitTrackCharts = {
  instances: {},

  initThemeDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';
    Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(23, 25, 31, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.15)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
  },

  destroyChart(canvasId) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
      delete this.instances[canvasId];
    }
  },

  renderWeightTrendChart(canvasId, measurements, daysLimit = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    let data = measurements
      .filter(m => m && m.date && typeof m.weight === 'number' && m.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (daysLimit && daysLimit !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(daysLimit, 10));
      const cutoffStr = FitTrackCalc.formatDateLocal(cutoff);
      data = data.filter(d => d.date >= cutoffStr);
    }

    if (data.length === 0) {
      this.renderEmptyChartState(canvas, 'No weight data logged for this period yet.');
      return;
    }

    const labels = data.map(d => d.date);
    const weights = data.map(d => d.weight);

    // Compute moving weekly average for trendline
    const weeklyAvgData = FitTrackCalc.calculateWeeklyAverageWeight(data);
    const avgMap = new Map(weeklyAvgData.map(w => [w.date, w.avgWeight]));
    const avgWeights = data.map(d => avgMap.get(d.date) ?? d.weight);

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Logged Weight (kg)',
            data: weights,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            fill: true,
            tension: 0.2,
            pointBackgroundColor: '#38bdf8',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: '7-Day Moving Avg (kg)',
            data: avgWeights,
            borderColor: '#10b981',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 14, font: { size: 12 } }
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'kg' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  renderNutritionTrendChart(canvasId, dailyLogs, targetCalories, targetProtein, daysLimit = 7, store = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const logMap = new Map();
    (dailyLogs || []).forEach(l => {
      if (l && l.date) logMap.set(l.date, l);
    });

    let labels = [];
    let calories = [];

    if (daysLimit && daysLimit !== 'all') {
      const numDays = parseInt(daysLimit, 10) || 7;
      const today = new Date();
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = FitTrackCalc.formatDateLocal(d);
        labels.push(dateStr.slice(5)); // MM-DD
        const log = logMap.get(dateStr);
        let dayCal = 0;
        if (log && typeof log.calories === 'number' && log.calories > 0) {
          dayCal = Math.round(log.calories);
        } else if (store && typeof store.getDailyNutritionTotals === 'function') {
          const fTotals = store.getDailyNutritionTotals(dateStr);
          if (fTotals && fTotals.calories > 0) dayCal = Math.round(fTotals.calories);
        } else if (log && typeof log.calories === 'number') {
          dayCal = Math.round(log.calories);
        }
        calories.push(dayCal);
      }
    } else {
      let data = [...dailyLogs].sort((a, b) => a.date.localeCompare(b.date));
      if (data.length === 0) {
        this.renderEmptyChartState(canvas, 'No daily nutrition logs found for this period.');
        return;
      }
      labels = data.map(d => d.date.slice(5));
      calories = data.map(d => Math.round(d.calories || 0));
    }

    if (calories.length === 0) {
      this.renderEmptyChartState(canvas, 'No daily nutrition logs found for this period.');
      return;
    }

    const targetCalLine = Array(labels.length).fill(targetCalories);

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Calories (kcal)',
            data: calories,
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            type: 'line',
            label: `Target (${targetCalories} kcal)`,
            data: targetCalLine,
            borderColor: '#10b981',
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12 } }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Calories' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  },

  renderBodyFatAndWaistChart(canvasId, measurements) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const valid = measurements
      .filter(m => m && m.date && ((typeof m.waist === 'number' && m.waist > 0) || (typeof m.bodyFat === 'number' && m.bodyFat > 0)))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (valid.length === 0) {
      this.renderEmptyChartState(canvas, 'No waist circumference or body fat entries logged yet.');
      return;
    }

    const labels = valid.map(d => d.date);
    const waist = valid.map(d => (typeof d.waist === 'number' ? d.waist : null));
    const bf = valid.map(d => (typeof d.bodyFat === 'number' ? d.bodyFat : null));

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Waist Circumference (cm)',
            data: waist,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            yAxisID: 'yWaist',
            spanGaps: true,
            tension: 0.2
          },
          {
            label: 'Body Fat (%)',
            data: bf,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            yAxisID: 'yBf',
            spanGaps: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          yWaist: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Waist (cm)' }
          },
          yBf: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Body Fat (%)' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  },

  renderEmptyChartState(canvas, message) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
};

/**
 * 4. USER INTERFACE & APPLICATION CONTROLLER (FitTrackApp)
 * Handles view rendering, event wiring, form interactions, DOM sanitation, and toasts.
 */
class FitTrackApp {
  constructor() {
    this.store = new FitTrackStore();
    this.activeView = 'dashboard';
    this.filterDays = 30; // default period
    this.selectedLogDate = FitTrackCalc.formatDateLocal();

    // DOM Element cache
    this.viewContainers = {};
    this.navLinks = [];
    this.toastContainer = null;
  }

  init() {
    // Initialize chart defaults
    FitTrackCharts.initThemeDefaults();

    // Cache core containers
    this.cacheElements();

    // Setup navigation
    this.setupNavigation();

    // Setup draggable sidebar ordering
    this.setupDraggableSidebar();

    // Setup event listeners
    this.bindEvents();

    // Setup auto-save for daily logs
    this.setupAutoSaveDailyLog();

    // Activity tracking for auto-lock
    this.setupActivityListeners();

    // Restore stealth mode if saved
    if (localStorage.getItem('fittrack_stealth_mode') === 'true') {
      FitTrackVault.privacyMode = true;
      document.body.classList.add('privacy-camo-active');
      const sidebarBtn = document.getElementById('btn-sidebar-privacy');
      if (sidebarBtn) {
        sidebarBtn.innerHTML = '👁️ Exit Stealth';
        sidebarBtn.classList.add('btn-primary');
        sidebarBtn.classList.remove('btn-outline');
      }
    }

    // Contextual User Database Loading
    const currentUser = FitTrackAuth.getCurrentUser();
    if (currentUser) {
      this.store.switchUser(currentUser);
    }

    // Authentication Guard
    if (!FitTrackAuth.isAuthenticated()) {
      document.body.classList.add('auth-locked');
      this.navigate('login', false);
    } else {
      document.body.classList.remove('auth-locked');
      let initialHash = window.location.hash.replace('#', '') || 'dashboard';
      if (initialHash === 'login' || initialHash === 'workouts') initialHash = 'dashboard';
      if (initialHash === 'admin' && !FitTrackAuth.isAdmin()) initialHash = 'dashboard';
      this.navigate(initialHash, false);

      // Check if logged in user requires first-time onboarding or target calibration
      if (currentUser && !this.store.data.profile?.hasOnboarded) {
        this.openOnboardingModal();
      }
    }

    // Initial render
    this.render();

    console.log('[FitTrack] App initialized successfully with secure auth & adaptive goals.');
  }

  cacheElements() {
    this.navLinks = document.querySelectorAll('.nav-link');
    this.mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    this.toastContainer = document.getElementById('toast-container');
    
    // Core view sections (removed workouts & login from nav tabs)
    const views = [
      'dashboard', 'daily-log',
      'nutrition', 'progress', 'goals', 'settings',
      'admin', 'login', 'locked-gate'
    ];
    views.forEach(v => {
      this.viewContainers[v] = document.getElementById(`view-${v}`);
    });
  }

  setupDraggableSidebar() {
    const container = document.getElementById('sidebar-nav');
    if (!container) return;

    // Restore saved custom sidebar order from localStorage (excluding removed tabs)
    const savedOrder = localStorage.getItem('fittrack_sidebar_order');
    if (savedOrder) {
      try {
        let order = JSON.parse(savedOrder);
        if (Array.isArray(order) && order.length > 0) {
          order = order.filter(v => v !== 'workouts' && v !== 'login' && v !== 'exercises' && v !== 'measurements');
          localStorage.setItem('fittrack_sidebar_order', JSON.stringify(order));
          const map = new Map();
          Array.from(container.children).forEach(child => {
            const key = child.getAttribute('data-view');
            if (key) map.set(key, child);
          });
          order.forEach(viewKey => {
            const el = map.get(viewKey);
            if (el) container.appendChild(el);
          });
        }
      } catch (err) {
        console.warn('[FitTrack] Could not restore sidebar order:', err);
      }
    }

    let draggedEl = null;

    container.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.nav-item-wrapper');
      if (!item) return;
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.getAttribute('data-view') || '');
    });

    container.addEventListener('dragend', () => {
      if (draggedEl) {
        draggedEl.classList.remove('dragging');
        draggedEl = null;
      }
      container.querySelectorAll('.nav-item-wrapper').forEach(el => el.classList.remove('drag-over'));
      const newOrder = Array.from(container.children).map(c => c.getAttribute('data-view')).filter(Boolean);
      localStorage.setItem('fittrack_sidebar_order', JSON.stringify(newOrder));
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.nav-item-wrapper');
      if (!target || target === draggedEl) return;

      container.querySelectorAll('.nav-item-wrapper').forEach(el => el.classList.remove('drag-over'));
      target.classList.add('drag-over');

      const rect = target.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY > mid) {
        target.after(draggedEl);
      } else {
        target.before(draggedEl);
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.querySelectorAll('.nav-item-wrapper').forEach(el => el.classList.remove('drag-over'));
      const newOrder = Array.from(container.children).map(c => c.getAttribute('data-view')).filter(Boolean);
      localStorage.setItem('fittrack_sidebar_order', JSON.stringify(newOrder));
      this.showToast('Sidebar arrangement saved!', 'info');
    });
  }

  setupActivityListeners() {
    const resetTimer = () => {
      FitTrackVault.resetAutoLockTimer();
    };
    ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const lockOnHide = document.getElementById('check-lock-on-hide');
        if (lockOnHide && lockOnHide.checked && FitTrackVault.isVaultConfigured() && FitTrackVault.isUnlocked) {
          this.lockSession('Vault locked on tab minimize.');
        }
      }
    });
  }

  setupNavigation() {
    // Desktop and mobile navigation links
    const handleNavClick = (e) => {
      const link = e.target.closest('[data-view]');
      if (!link) return;
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      this.navigate(targetView);

      // Close mobile drawer if open
      const drawer = document.getElementById('mobile-drawer');
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
      }
    };

    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', handleNavClick);
    });

    // Mobile drawer toggle
    const menuBtn = document.getElementById('btn-mobile-menu');
    const drawer = document.getElementById('mobile-drawer');
    const closeDrawerBtn = document.getElementById('btn-close-drawer');

    if (menuBtn && drawer) {
      menuBtn.addEventListener('click', () => drawer.classList.toggle('open'));
    }
    if (closeDrawerBtn && drawer) {
      closeDrawerBtn.addEventListener('click', () => drawer.classList.remove('open'));
    }

    // Window popstate / hashchange
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (hash !== this.activeView) {
        this.navigate(hash, false);
      }
    });
  }

  navigate(viewName, updateHash = true) {
    if (!FitTrackAuth.isAuthenticated()) {
      document.body.classList.add('auth-locked');
      viewName = 'login';
    } else {
      document.body.classList.remove('auth-locked');
      if (viewName === 'admin' && !FitTrackAuth.isAdmin()) {
        this.showToast('Permission denied: Administrator role required.', 'error');
        viewName = 'dashboard';
      } else if (viewName === 'locked-gate') {
        viewName = 'login';
      }
    }

    if (!this.viewContainers[viewName]) {
      viewName = FitTrackAuth.isAuthenticated() ? 'dashboard' : 'login';
    }

    this.activeView = viewName;
    if (updateHash) {
      window.location.hash = viewName;
    }

    // Toggle active classes on view containers
    Object.keys(this.viewContainers).forEach(key => {
      if (this.viewContainers[key]) {
        if (key === viewName) {
          this.viewContainers[key].classList.add('active');
          this.viewContainers[key].removeAttribute('hidden');
        } else {
          this.viewContainers[key].classList.remove('active');
          this.viewContainers[key].setAttribute('hidden', 'true');
        }
      }
    });

    // Update active nav link classes
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    // Render the specific view content
    this.renderView(viewName);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  bindEvents() {
    // Quick Actions
    const quickLogBtn = document.getElementById('btn-quick-log-today');
    if (quickLogBtn) {
      quickLogBtn.addEventListener('click', () => {
        this.selectedLogDate = FitTrackCalc.formatDateLocal();
        this.navigate('daily-log');
        this.loadDailyLogIntoForm(this.selectedLogDate);
      });
    }

    // Dashboard period filter buttons (7d, 30d, 90d, all)
    document.querySelectorAll('.btn-period-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-period-filter').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const period = e.target.getAttribute('data-days');
        this.filterDays = period === 'all' ? 'all' : parseInt(period, 10);
        this.renderDashboard();
      });
    });

    // Dashboard Morning Weight Quick Logger & Auto-Calibration Form
    const morningWeightForm = document.getElementById('form-dash-morning-weight');
    if (morningWeightForm) {
      morningWeightForm.addEventListener('submit', (e) => this.handleMorningWeightSubmit(e));
    }
    const morningWeightBtn = document.getElementById('btn-dash-log-weight');
    if (morningWeightBtn) {
      morningWeightBtn.addEventListener('click', (e) => this.handleMorningWeightSubmit(e));
    }
    const morningWeightInput = document.getElementById('dash-morning-weight-input');
    if (morningWeightInput) {
      morningWeightInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleMorningWeightSubmit(e);
        }
      });
    }

    // Torso Comparison Chart Modal Openers
    document.querySelectorAll('.btn-open-bf-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = document.getElementById('modal-bf-chart');
        if (modal) {
          const id = e.currentTarget?.id;
          if (id === 'btn-view-bf-chart-settings') this._bfModalContext = 'settings';
          else if (id === 'btn-view-bf-chart') this._bfModalContext = 'onboard';
          else this._bfModalContext = 'dashboard';
          modal.classList.add('active');
        }
      });
    });

    // Close buttons for Torso Body Fat Chart modal
    const closeBfModal = () => {
      const modal = document.getElementById('modal-bf-chart');
      if (modal) {
        modal.classList.remove('active');
      }
    };
    const btnCloseBfChart = document.getElementById('btn-close-bf-chart');
    if (btnCloseBfChart) btnCloseBfChart.addEventListener('click', closeBfModal);
    const btnDoneBfChart = document.getElementById('btn-done-bf-chart');
    if (btnDoneBfChart) btnDoneBfChart.addEventListener('click', closeBfModal);
    const modalBfChart = document.getElementById('modal-bf-chart');
    if (modalBfChart) {
      modalBfChart.addEventListener('click', (e) => {
        if (e.target === modalBfChart || e.target.classList.contains('modal-backdrop')) closeBfModal();
      });
    }

    // Tier Details and Interactive Selection
    const bfTierDetails = {
      10: {
        title: '10% — Beach Lean',
        badge: 'Six-Pack Abs Target',
        desc: 'Clearly defined six-pack abs, vascularity across arms and lower abdomen, separated deltoids and chest. The classic fitness cover model physique.'
      },
      14: {
        title: '14% — Athletic & Fit',
        badge: 'Sustainable Year-Round Fit',
        desc: 'Upper abs visible, flat athletic midsection, clear shoulder and arm separation. Highly functional, energetic, and easily maintained long-term.'
      },
      18: {
        title: '18% — Healthy / Normal',
        badge: 'Healthy Baseline',
        desc: 'Flat stomach, faint outline of abs under good lighting. Optimal hormonal health and sustainable everyday vitality.'
      },
      22: {
        title: '22% — Moderate / Soft',
        badge: 'Typical Starting Point',
        desc: 'Softer midsection with subtle abdominal fat layer. Very common baseline before beginning a structured recomposition phase.'
      },
      26: {
        title: '26% — Overweight',
        badge: 'Fat Loss Recommended',
        desc: 'Noticeable belly fat layer and rounded waistline. Shedding pure adipose tissue will significantly boost gym endurance and cardiovascular health.'
      },
      30: {
        title: '30% — Heavy',
        badge: 'Cardio-Metabolic Priority',
        desc: 'Prominent abdominal fat and love handles. A steady 0.5 kg/week deficit with heavy lifting produces life-changing physique recomposition.'
      },
      35: {
        title: '35%+ — Very High',
        badge: 'Health Transformation',
        desc: 'Substantial excess visceral and subcutaneous abdominal fat. Prioritize a safe calorie deficit and consistent daily hydration.'
      }
    };

    let selectedTier = '10';

    const updateTierCardUI = (tier) => {
      selectedTier = tier;
      const info = bfTierDetails[tier] || bfTierDetails['10'];
      const titleEl = document.getElementById('bf-tier-title');
      const badgeEl = document.getElementById('bf-tier-badge');
      const descEl = document.getElementById('bf-tier-desc');
      const btnTarget = document.getElementById('btn-apply-as-target');
      const btnCurrent = document.getElementById('btn-apply-as-current');

      if (titleEl) titleEl.textContent = info.title;
      if (badgeEl) badgeEl.textContent = info.badge;
      if (descEl) descEl.textContent = info.desc;
      if (btnTarget) btnTarget.textContent = `🎯 Set as My Target Goal (${tier}%)`;
      if (btnCurrent) btnCurrent.textContent = `📍 Set as Current Body Fat (${tier}%)`;

      document.querySelectorAll('.btn-select-bf-tier').forEach(b => {
        if (b.getAttribute('data-tier') === String(tier)) {
          b.classList.add('active', 'btn-primary');
          b.classList.remove('btn-outline');
        } else {
          b.classList.remove('active', 'btn-primary');
          b.classList.add('btn-outline');
        }
      });
    };

    document.querySelectorAll('.btn-select-bf-tier').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tier = e.currentTarget.getAttribute('data-tier');
        if (tier) updateTierCardUI(tier);
      });
    });

    const applyTargetBf = (tier) => {
      const targetBf = parseFloat(tier) || 10;
      // Update form inputs if open
      const onboardTargetSelect = document.getElementById('onboard-target-bf-select');
      if (onboardTargetSelect) {
        onboardTargetSelect.value = String(targetBf);
        onboardTargetSelect.dispatchEvent(new Event('change'));
      }
      const profTargetSelect = document.getElementById('prof-target-bf-select');
      if (profTargetSelect) {
        profTargetSelect.value = String(targetBf);
        profTargetSelect.dispatchEvent(new Event('change'));
      }

      // Update store profile & goals directly
      this.store.data.profile.targetBodyFat = targetBf;
      this.store.data.goals.targetBodyFat = targetBf;
      const curBf = this.store.data.profile.bodyFat || 22;
      const weight = this.store.data.profile.weight || 75;
      const recomp = FitTrackCalc.calculateBodyRecomposition(weight, curBf, targetBf);
      this.store.data.profile.targetWeight = recomp.targetWeight;
      this.store.data.goals.targetWeight = recomp.targetWeight;
      this.store.saveData();

      closeBfModal();
      this.showToast(`🎯 Target set to ${targetBf}% Body Fat! Goal weight: ${recomp.targetWeight} kg`, 'success');
      this.render();
    };

    const applyCurrentBf = (tier) => {
      const curBf = parseFloat(tier) || 22;
      // Update form inputs if open
      const onboardBfSelect = document.getElementById('onboard-bf-select');
      if (onboardBfSelect) {
        onboardBfSelect.value = String(curBf);
        onboardBfSelect.dispatchEvent(new Event('change'));
      }
      const profBfSelect = document.getElementById('prof-bf-select');
      if (profBfSelect) {
        profBfSelect.value = String(curBf);
        profBfSelect.dispatchEvent(new Event('change'));
      }

      // Update store profile directly
      this.store.data.profile.bodyFat = curBf;
      const targetBf = this.store.data.profile.targetBodyFat || 10;
      const weight = this.store.data.profile.weight || 75;
      const recomp = FitTrackCalc.calculateBodyRecomposition(weight, curBf, targetBf);
      this.store.data.profile.targetWeight = recomp.targetWeight;
      this.store.data.goals.targetWeight = recomp.targetWeight;

      // Also record in measurements
      const todayStr = FitTrackCalc.formatDateLocal();
      this.store.recordMeasurement({
        date: todayStr,
        weight,
        bodyFat: curBf,
        notes: 'Updated via Torso Comparison Chart'
      });
      this.store.saveData();

      closeBfModal();
      this.showToast(`📍 Current Body Fat set to ${curBf}%! Roadmap recalculated.`, 'success');
      this.render();
    };

    const btnApplyTarget = document.getElementById('btn-apply-as-target');
    if (btnApplyTarget) btnApplyTarget.addEventListener('click', () => applyTargetBf(selectedTier));
    const btnApplyCurrent = document.getElementById('btn-apply-as-current');
    if (btnApplyCurrent) btnApplyCurrent.addEventListener('click', () => applyCurrentBf(selectedTier));

    // Adaptive Nutrition Engine Modal & Calibrator Bindings
    const openAdaptiveModal = () => {
      const modal = document.getElementById('modal-adaptive-engine');
      if (modal) {
        this.renderAdaptiveAdvisor();
        modal.classList.add('active');
      }
    };
    const closeAdaptiveModal = () => {
      const modal = document.getElementById('modal-adaptive-engine');
      if (modal) modal.classList.remove('active');
    };

    const adaptiveHeader = document.getElementById('adaptive-mini-header');
    if (adaptiveHeader) {
      adaptiveHeader.addEventListener('click', openAdaptiveModal);
      adaptiveHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAdaptiveModal();
        }
      });
    }

    const btnCloseAdaptive = document.getElementById('btn-close-adaptive-modal');
    if (btnCloseAdaptive) btnCloseAdaptive.addEventListener('click', closeAdaptiveModal);
    const btnDoneAdaptive = document.getElementById('btn-done-adaptive-modal');
    if (btnDoneAdaptive) btnDoneAdaptive.addEventListener('click', closeAdaptiveModal);

    const btnApplyAdaptive = document.getElementById('btn-apply-adaptive-targets');
    if (btnApplyAdaptive) {
      btnApplyAdaptive.addEventListener('click', () => {
        this.handleRecalibrateAdaptiveTargets(true);
      });
    }

    const modalAdaptive = document.getElementById('modal-adaptive-engine');
    if (modalAdaptive) {
      modalAdaptive.addEventListener('click', (e) => {
        if (e.target === modalAdaptive || e.target.classList.contains('modal-backdrop')) closeAdaptiveModal();
      });
    }

    // Settings Profile Body Fat Select Custom Toggles
    const profBfSelect = document.getElementById('prof-bf-select');
    const profBfInput = document.getElementById('prof-bf');
    if (profBfSelect && profBfInput) {
      profBfSelect.addEventListener('change', () => {
        if (profBfSelect.value === 'custom') {
          profBfInput.style.display = 'block';
          profBfInput.focus();
        } else {
          profBfInput.style.display = 'none';
          profBfInput.value = profBfSelect.value;
        }
      });
    }

    const profTargetBfSelect = document.getElementById('prof-target-bf-select');
    const profTargetBfInput = document.getElementById('prof-target-bf');
    if (profTargetBfSelect && profTargetBfInput) {
      profTargetBfSelect.addEventListener('change', () => {
        if (profTargetBfSelect.value === 'custom') {
          profTargetBfInput.style.display = 'block';
          profTargetBfInput.focus();
        } else {
          profTargetBfInput.style.display = 'none';
          profTargetBfInput.value = profTargetBfSelect.value;
        }
      });
    }

    // Nutrition Date picker change
    const nutritionDateInput = document.getElementById('nutrition-date');
    if (nutritionDateInput) {
      nutritionDateInput.addEventListener('change', () => {
        this.renderNutritionView();
      });
    }

    // Daily Log Form submission
    const dailyLogForm = document.getElementById('form-daily-log');
    if (dailyLogForm) {
      dailyLogForm.addEventListener('submit', (e) => this.handleDailyLogSubmit(e));
    }

    // Daily Log Date picker change
    const logDateInput = document.getElementById('log-date');
    if (logDateInput) {
      logDateInput.value = this.selectedLogDate;
      logDateInput.addEventListener('change', (e) => {
        this.selectedLogDate = e.target.value;
        this.loadDailyLogIntoForm(this.selectedLogDate);
      });
    }

    // Quick water intake increment buttons (+250ml, +500ml)
    document.querySelectorAll('.btn-add-water').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = parseInt(e.target.getAttribute('data-amount'), 10) || 250;
        const waterInput = document.getElementById('log-water');
        if (waterInput) {
          waterInput.value = (parseInt(waterInput.value, 10) || 0) + amount;
          this.saveDailyLogFromForm(true);
        }
      });
    });

    // Sync nutrition to daily log button
    const syncNutritionBtn = document.getElementById('btn-sync-nutrition-to-log');
    if (syncNutritionBtn) {
      syncNutritionBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('log-date');
        const dateStr = dateInput ? dateInput.value : this.selectedLogDate;
        const totals = this.store.getDailyNutritionTotals(dateStr);
        const caloriesInput = document.getElementById('log-calories');
        const proteinInput = document.getElementById('log-protein');
        const carbsInput = document.getElementById('log-carbs');
        const fatInput = document.getElementById('log-fat');
        if (caloriesInput) caloriesInput.value = Math.round(totals.calories);
        if (proteinInput) proteinInput.value = Math.round(totals.protein);
        if (carbsInput) carbsInput.value = Math.round(totals.carbs);
        if (fatInput) fatInput.value = Math.round(totals.fat);
        this.saveDailyLogFromForm(true);
        this.showToast(`Synced ${Math.round(totals.calories)} kcal & ${Math.round(totals.protein)}g protein from ${dateStr} food entries!`, 'info');
      });
    }

    // Profile Settings Form
    const profileForm = document.getElementById('form-profile');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));
    }

    // Goals Form
    const goalsForm = document.getElementById('form-goals');
    if (goalsForm) {
      goalsForm.addEventListener('submit', (e) => this.handleGoalsSubmit(e));
    }

    // Recalculate Suggested Targets Button
    const calcTargetsBtn = document.getElementById('btn-calc-suggested-targets');
    if (calcTargetsBtn) {
      calcTargetsBtn.addEventListener('click', () => this.applySuggestedTargets());
    }

    // Workout Logger Setup
    const addExerciseBtn = document.getElementById('btn-add-exercise-to-workout');
    if (addExerciseBtn) {
      addExerciseBtn.addEventListener('click', () => this.addExerciseToWorkoutForm());
    }

    const workoutForm = document.getElementById('form-workout');
    if (workoutForm) {
      workoutForm.addEventListener('submit', (e) => this.handleWorkoutSubmit(e));
    }

    // Body Measurement Form
    const measurementForm = document.getElementById('form-measurement');
    if (measurementForm) {
      measurementForm.addEventListener('submit', (e) => this.handleMeasurementSubmit(e));
    }

    // Nutrition Food Form
    const foodForm = document.getElementById('form-add-food');
    if (foodForm) {
      foodForm.addEventListener('submit', (e) => this.handleFoodSubmit(e));
    }

    // Smart Meal AI / Natural Language Quick Logger
    const smartMealForm = document.getElementById('form-smart-meal');
    if (smartMealForm) {
      smartMealForm.addEventListener('submit', (e) => this.handleSmartMealSubmit(e));
    }

    const btnSmartMealFill = document.getElementById('btn-smart-meal-fill-form');
    if (btnSmartMealFill) {
      btnSmartMealFill.addEventListener('click', () => this.handleSmartMealFillForm());
    }

    const toggleMealHelpBtn = document.getElementById('btn-toggle-meal-help');
    if (toggleMealHelpBtn) {
      toggleMealHelpBtn.addEventListener('click', () => {
        const guide = document.getElementById('smart-meal-guide');
        if (guide) {
          guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    // Ctrl+Enter / Cmd+Enter inside smart meal textarea submits
    const smartMealInput = document.getElementById('smart-meal-input');
    if (smartMealInput) {
      smartMealInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.handleSmartMealSubmit(e);
        }
      });
    }

    // Preset Food Modal Trigger & Preset Add
    const addPresetBtn = document.getElementById('btn-add-custom-preset');
    if (addPresetBtn) {
      addPresetBtn.addEventListener('click', () => this.openPresetModal());
    }

    const presetForm = document.getElementById('form-preset-modal');
    if (presetForm) {
      presetForm.addEventListener('submit', (e) => this.handlePresetModalSubmit(e));
    }

    // Edit Logged Food Modal Form
    const editFoodForm = document.getElementById('form-edit-food-modal');
    if (editFoodForm) {
      editFoodForm.addEventListener('submit', (e) => this.handleEditFoodSubmit(e));
    }

    // Backup & Restore
    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportBackupJSON());
    }

    const importFileInput = document.getElementById('input-import-json');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => this.handleJSONImport(e));
    }

    const exportCsvLogsBtn = document.getElementById('btn-export-csv-logs');
    if (exportCsvLogsBtn) {
      exportCsvLogsBtn.addEventListener('click', () => this.downloadCSV('dailyLogs', 'fittrack-daily-logs.csv'));
    }

    const exportCsvWorkoutsBtn = document.getElementById('btn-export-csv-workouts');
    if (exportCsvWorkoutsBtn) {
      exportCsvWorkoutsBtn.addEventListener('click', () => this.downloadCSV('workouts', 'fittrack-workouts.csv'));
    }

    const exportCsvMeasurementsBtn = document.getElementById('btn-export-csv-measurements');
    if (exportCsvMeasurementsBtn) {
      exportCsvMeasurementsBtn.addEventListener('click', () => this.downloadCSV('measurements', 'fittrack-measurements.csv'));
    }

    // Reset Data with Confirmation Modal
    const resetDataBtn = document.getElementById('btn-reset-data');
    if (resetDataBtn) {
      resetDataBtn.addEventListener('click', () => this.confirmResetData());
    }

    // Vault Unlock Form (Locked Gate)
    const unlockForm = document.getElementById('form-vault-unlock');
    if (unlockForm) {
      unlockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passInput = document.getElementById('vault-passphrase');
        const pass = passInput ? passInput.value : '';
        if (!FitTrackVault.isVaultConfigured()) {
          const res = await FitTrackVault.setupMasterPassword(pass);
          if (res.success) {
            this.store.saveData();
            this.showToast('Master passphrase created! All data is now AES-256-GCM encrypted.', 'success');
            this.navigate('dashboard');
            this.render();
          } else {
            this.showToast(res.message, 'error');
          }
        } else {
          await this.unlockSession(pass);
        }
        if (passInput) passInput.value = '';
      });
    }

    // Admin Passphrase Form
    const adminPassForm = document.getElementById('form-admin-password');
    if (adminPassForm) {
      adminPassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassEl = document.getElementById('admin-current-pass');
        const newPass = document.getElementById('admin-new-pass').value;
        const confirmPass = document.getElementById('admin-confirm-pass').value;

        if (newPass !== confirmPass) {
          this.showToast('New passphrases do not match.', 'error');
          return;
        }

        if (FitTrackVault.isVaultConfigured()) {
          const currentPass = currentPassEl ? currentPassEl.value : '';
          const unlockTest = await FitTrackVault.unlock(currentPass);
          if (!unlockTest.success) {
            this.showToast('Current passphrase incorrect.', 'error');
            return;
          }
        }

        const res = await FitTrackVault.setupMasterPassword(newPass);
        if (res.success) {
          this.store.saveData();
          this.showToast('Master passphrase updated successfully!', 'success');
          adminPassForm.reset();
          this.renderAdminView();
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }

    // Lock Session Buttons
    ['btn-header-lock', 'btn-admin-lock-now', 'btn-sidebar-lock', 'btn-login-page-lock'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this.lockSession('Vault locked.'));
    });

    // Toggle Passphrase Visibility
    const togglePwBtn = document.getElementById('btn-toggle-vault-pw');
    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', () => {
        const pwInput = document.getElementById('vault-passphrase');
        if (pwInput) {
          const isPw = pwInput.type === 'password';
          pwInput.type = isPw ? 'text' : 'password';
          togglePwBtn.textContent = isPw ? '🙈' : '👁️';
        }
      });
    }

    // Stealth / Privacy Camo Mode Buttons
    const stealthBtns = document.querySelectorAll('.btn-toggle-stealth, #btn-sidebar-privacy, #btn-header-privacy, #btn-admin-toggle-camo, #btn-toggle-privacy');
    stealthBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.togglePrivacyMode();
      });
    });

    // Quick Hydration Stepper Buttons & Smart Meal Chat Delegations
    document.addEventListener('click', (e) => {
      // Hydration buttons
      const btn = e.target.closest('.btn-quick-water');
      if (btn) {
        e.preventDefault();
        const delta = parseInt(btn.getAttribute('data-delta'), 10) || 0;
        if (delta !== 0) {
          this.adjustTodayWater(delta);
        }
        return;
      }

      // Meal chips
      const chip = e.target.closest('.meal-chip');
      if (chip) {
        e.preventDefault();
        const exampleText = chip.getAttribute('data-example');
        const mealInput = document.getElementById('smart-meal-input');
        if (mealInput && exampleText) {
          mealInput.value = exampleText;
          mealInput.focus();
          const catSelect = document.getElementById('smart-meal-category-select');
          if (catSelect) {
            const detected = FitTrackSmartMeal.detectCategory(exampleText);
            catSelect.value = detected || 'auto';
          }
        }
        return;
      }

      // Dismiss meal confirmation box
      const dismissBtn = e.target.closest('.btn-dismiss-chat');
      if (dismissBtn) {
        e.preventDefault();
        const chatBox = document.getElementById('smart-meal-chat-box');
        if (chatBox) {
          chatBox.style.display = 'none';
          chatBox.innerHTML = '';
        }
        return;
      }

      // Undo meal from chat
      const undoBtn = e.target.closest('.btn-undo-meal');
      if (undoBtn) {
        e.preventDefault();
        const idsStr = undoBtn.getAttribute('data-entry-ids');
        if (idsStr) {
          const ids = idsStr.split(',').filter(Boolean);
          ids.forEach(id => this.store.deleteFoodEntry(id));
          const chatBox = document.getElementById('smart-meal-chat-box');
          if (chatBox) {
            chatBox.style.display = 'none';
            chatBox.innerHTML = '';
          }
          const dateInput = document.getElementById('nutrition-date');
          const date = dateInput ? dateInput.value : FitTrackCalc.formatDateLocal();
          const remainingTotals = this.store.getDailyNutritionTotals(date);
          this.store.saveDailyLog({
            date,
            calories: Math.round(remainingTotals.calories),
            protein: Math.round(remainingTotals.protein * 10) / 10,
            carbs: Math.round(remainingTotals.carbs * 10) / 10,
            fat: Math.round(remainingTotals.fat * 10) / 10
          });
          this.renderNutritionView();
          if (date === FitTrackCalc.formatDateLocal()) {
            this.renderDashboard();
          }
          this.showToast('Meal log undone and entries removed.', 'info');
        }
        return;
      }

      // Populate manual form from chat
      const fillFromChatBtn = e.target.closest('.btn-fill-form-from-chat');
      if (fillFromChatBtn) {
        e.preventDefault();
        const name = fillFromChatBtn.getAttribute('data-name') || '';
        const category = fillFromChatBtn.getAttribute('data-category') || 'lunch';
        const cal = fillFromChatBtn.getAttribute('data-calories') || '0';
        const pro = fillFromChatBtn.getAttribute('data-protein') || '0';
        const carbs = fillFromChatBtn.getAttribute('data-carbs') || '0';
        const fat = fillFromChatBtn.getAttribute('data-fat') || '0';

        const nameEl = document.getElementById('food-name');
        const catEl = document.getElementById('food-category');
        const calEl = document.getElementById('food-calories');
        const proEl = document.getElementById('food-protein');
        const carbsEl = document.getElementById('food-carbs');
        const fatEl = document.getElementById('food-fat');

        if (nameEl) nameEl.value = name;
        if (catEl) catEl.value = category;
        if (calEl) calEl.value = cal;
        if (proEl) proEl.value = pro;
        if (carbsEl) carbsEl.value = carbs;
        if (fatEl) fatEl.value = fat;

        const formEl = document.getElementById('form-add-food');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.showToast('Manual form populated with meal details!', 'success');
      }
    });

    // Disable Vault Button
    const disableVaultBtn = document.getElementById('btn-disable-vault');
    if (disableVaultBtn) {
      disableVaultBtn.addEventListener('click', () => {
        this.confirmDialog('Disable client-side vault encryption? Data will be stored unencrypted in local storage.', () => {
          localStorage.removeItem(FitTrackVault.VAULT_CONFIG_KEY);
          FitTrackVault.lock();
          FitTrackVault.isUnlocked = true;
          this.store.saveData();
          this.showToast('Vault encryption disabled.', 'info');
          this.render();
        });
      });
    }

    // Auto-Lock Select
    const autoLockSelect = document.getElementById('select-auto-lock');
    if (autoLockSelect) {
      autoLockSelect.addEventListener('change', (e) => {
        FitTrackVault.autoLockMinutes = parseInt(e.target.value, 10) || 15;
        FitTrackVault.resetAutoLockTimer();
        this.showToast(`Auto-lock set to ${FitTrackVault.autoLockMinutes} minutes.`, 'info');
      });
    }

    // Standard User Login Form
    const userLoginForm = document.getElementById('form-user-login');
    if (userLoginForm) {
      userLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        const btn = document.getElementById('btn-submit-login');
        const alertBox = document.getElementById('login-feedback-alert');

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="btn-spinner"></span> Authenticating...';
        }
        if (alertBox) alertBox.style.display = 'none';

        try {
          const res = await FitTrackAuth.login(username, password);
          if (res.success) {
            document.body.classList.remove('auth-locked');
            this.store.switchUser(res.user);
            this.renderHeaderUserStatus();
            userLoginForm.reset();

            if (!this.store.data.profile?.hasOnboarded) {
              this.showToast(`Welcome, ${res.user.displayName || res.user.username}! Let's set up your personalized fitness targets.`, 'info');
              this.navigate('dashboard');
              this.render();
              this.openOnboardingModal();
            } else {
              this.showToast(`Welcome back, ${res.user.displayName || res.user.username}!`, 'success');
              this.navigate('dashboard');
              this.render();
            }
          } else {
            if (alertBox) {
              alertBox.textContent = res.message || 'Invalid username or password.';
              alertBox.style.display = 'block';
            } else {
              this.showToast(res.message || 'Invalid username or password.', 'error');
            }
          }
        } catch (err) {
          this.showToast('Authentication error: ' + err.message, 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span id="login-btn-text">🔐 Sign In to Dashboard</span>';
          }
        }
      });
    }

    // First-Time Administrator Setup Form
    const adminSetupForm = document.getElementById('form-admin-setup');
    if (adminSetupForm) {
      adminSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('setup-admin-username')?.value.trim();
        const password = document.getElementById('setup-admin-password')?.value;
        const confirm = document.getElementById('setup-admin-confirm')?.value;
        const alertBox = document.getElementById('login-feedback-alert');

        if (password !== confirm) {
          if (alertBox) {
            alertBox.textContent = 'Passwords do not match.';
            alertBox.style.display = 'block';
          } else {
            this.showToast('Passwords do not match.', 'error');
          }
          return;
        }

        const res = await FitTrackAuth.createAdminAccount(username, password);
        if (res.success) {
          document.body.classList.remove('auth-locked');
          this.showToast('Administrator account created! Welcome to FitTrack.', 'success');
          adminSetupForm.reset();
          this.navigate('dashboard');
          this.render();
        } else {
          if (alertBox) {
            alertBox.textContent = res.message;
            alertBox.style.display = 'block';
          } else {
            this.showToast(res.message, 'error');
          }
        }
      });
    }

    // Provision New User Form (Admin only)
    const createUserForm = document.getElementById('form-create-user');
    if (createUserForm) {
      createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-user-username')?.value.trim();
        const password = document.getElementById('new-user-password')?.value;
        const role = document.getElementById('new-user-role')?.value || 'user';

        const res = await FitTrackAuth.createUserByAdmin(username, password, role);
        if (res.success) {
          this.showToast(`User account "${res.user.username}" (${res.user.role}) created successfully!`, 'success');
          createUserForm.reset();
          this.renderAdminUsersTable();
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }

    // Member Onboarding Form Submit & Live Calculation Listeners
    const onboardingForm = document.getElementById('form-onboarding');
    if (onboardingForm) {
      onboardingForm.addEventListener('submit', (e) => this.handleOnboardingSubmit(e));
    }

    // Onboarding Body Fat Dropdown Custom Toggles
    const onboardBfSelect = document.getElementById('onboard-bf-select');
    const onboardBfInput = document.getElementById('onboard-bf');
    if (onboardBfSelect && onboardBfInput) {
      onboardBfSelect.addEventListener('change', () => {
        if (onboardBfSelect.value === 'custom') {
          onboardBfInput.style.display = 'block';
          onboardBfInput.focus();
        } else {
          onboardBfInput.style.display = 'none';
          onboardBfInput.value = onboardBfSelect.value;
        }
        this.updateOnboardingPreview();
      });
    }

    const onboardTargetBfSelect = document.getElementById('onboard-target-bf-select');
    const onboardTargetBfInput = document.getElementById('onboard-target-bf');
    if (onboardTargetBfSelect && onboardTargetBfInput) {
      onboardTargetBfSelect.addEventListener('change', () => {
        if (onboardTargetBfSelect.value === 'custom') {
          onboardTargetBfInput.style.display = 'block';
          onboardTargetBfInput.focus();
        } else {
          onboardTargetBfInput.style.display = 'none';
          onboardTargetBfInput.value = onboardTargetBfSelect.value;
        }
        this.updateOnboardingPreview();
      });
    }

    const onboardInputs = [
      'onboard-weight', 'onboard-height', 'onboard-age',
      'onboard-sex', 'onboard-goal', 'onboard-activity',
      'onboard-bf', 'onboard-bf-select', 'onboard-target-bf', 'onboard-target-bf-select'
    ];
    onboardInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateOnboardingPreview());
        el.addEventListener('change', () => this.updateOnboardingPreview());
      }
    });

    // Logout Action Buttons
    document.querySelectorAll('.btn-do-logout').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.store) {
          try {
            this.store.saveData();
            this.store.backupCurrentUserData();
          } catch (e) {}
        }
        FitTrackAuth.logout();
        this.store.switchUser(null);
        const modalOnboard = document.getElementById('modal-onboarding');
        if (modalOnboard) modalOnboard.classList.remove('active');
        document.body.classList.add('auth-locked');
        this.showToast('Logged out securely. Session ended.', 'info');
        this.navigate('login');
        this.renderHeaderUserStatus();
      });
    });

    // Apply Adaptive Targets Button
    const applyAdaptiveBtn = document.getElementById('btn-apply-adaptive-targets');
    if (applyAdaptiveBtn) {
      applyAdaptiveBtn.addEventListener('click', () => {
        const evalResult = FitTrackAdaptive.evaluateTargets(this.store);
        this.store.data.goals.dailyCalories = evalResult.recommendedCalories;
        this.store.data.goals.dailyProtein = evalResult.recommendedProtein;
        this.store.saveData();
        this.showToast(`Personalized targets applied: ${evalResult.recommendedCalories} kcal & ${evalResult.recommendedProtein}g protein!`, 'success');
        this.render();
      });
    }

    // Password Visibility Toggles
    ['btn-toggle-login-pw', 'btn-toggle-setup-pw'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          const input = e.currentTarget.parentElement.querySelector('input');
          if (input) {
            const isPw = input.type === 'password';
            input.type = isPw ? 'text' : 'password';
            e.currentTarget.textContent = isPw ? '🙈' : '👁️';
          }
        });
      }
    });

    // Auto-Goal Adjustment Setting Checkbox
    const autoGoalCheck = document.getElementById('check-auto-goal-adjust');
    if (autoGoalCheck) {
      autoGoalCheck.addEventListener('change', (e) => {
        this.store.data.goals.autoGoalAdjust = e.target.checked;
        this.store.saveData();
        this.showToast(e.target.checked ? 'Adaptive goal recommendations enabled.' : 'Adaptive goal recommendations disabled.', 'info');
      });
    }

    // Global Modal Dismissal (Escape key & backdrop clicks)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    document.querySelectorAll('.modal-backdrop, .modal-close').forEach(el => {
      el.addEventListener('click', () => this.closeAllModals());
    });
  }

  // --- RENDERING ROUTINES ---

  render() {
    this.renderHeaderUserStatus();
    this.renderView(this.activeView);
  }

  renderHeaderUserStatus() {
    const isAuth = FitTrackAuth.isAuthenticated();
    const currentUser = FitTrackAuth.getCurrentUser();
    const isAdmin = FitTrackAuth.isAdmin();
    const profile = this.store.data.profile || {};
    const streaks = FitTrackCalc.calculateStreaks(this.store.data.dailyLogs);

    // 1. Strictly hide/show Admin Navigation tabs across desktop and mobile
    document.querySelectorAll('[data-view="admin"]').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    // 2. Hide admin stealth mode controls for normal members
    const stealthBtns = document.querySelectorAll('#btn-sidebar-privacy, #btn-header-privacy, #btn-admin-toggle-camo');
    stealthBtns.forEach(btn => {
      btn.style.display = isAdmin ? '' : 'none';
    });

    // 3. Hide storage badge for normal members
    const storageBadges = document.querySelectorAll('.storage-badge');
    storageBadges.forEach(b => {
      b.style.display = isAdmin ? '' : 'none';
    });

    // 4. Toggle header lock button (only visible for administrator when vault is configured)
    const lockBtn = document.getElementById('btn-header-lock');
    if (lockBtn) {
      lockBtn.style.display = (isAdmin && FitTrackVault.isVaultConfigured()) ? 'inline-flex' : 'none';
    }

    // 5. Sidebar User Display Name & Avatar
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    if (sidebarName) {
      if (currentUser) {
        if (isAdmin) {
          sidebarName.textContent = `${currentUser.displayName || currentUser.username} (Admin)`;
        } else {
          sidebarName.textContent = `${currentUser.displayName || currentUser.username}`;
        }
      } else {
        sidebarName.textContent = 'FitTrack Portal';
      }
    }
    if (sidebarAvatar) {
      sidebarAvatar.textContent = isAdmin ? '👑' : '👤';
    }

    // 6. Streak Badge
    const streakBadge = document.getElementById('header-streak-badge');
    if (streakBadge) {
      if (!isAuth) {
        streakBadge.innerHTML = `<span class="streak-icon">🔒</span> <span class="streak-count">Locked</span>`;
      } else {
        streakBadge.innerHTML = `<span class="streak-icon">🔥</span> <span class="streak-count">${streaks.currentStreak}</span> <span class="streak-label">day streak</span>`;
      }
    }

    const sidebarStreak = document.getElementById('sidebar-streak-count');
    if (sidebarStreak) {
      sidebarStreak.textContent = !isAuth ? '🔒' : streaks.currentStreak;
    }

    // 7. Profile pill with safe guarding
    const profilePill = document.getElementById('header-profile-pill');
    if (profilePill) {
      if (!isAuth) {
        profilePill.textContent = '🔒 Portal Locked';
      } else {
        const pWeight = profile.weight ? `${profile.weight} kg` : '70 kg';
        const rawGoal = profile.primaryGoal || profile.goal || 'Fitness Journey';
        const cleanGoal = String(rawGoal).slice(0, 24);
        profilePill.textContent = `${pWeight} · ${cleanGoal}...`;
      }
    }

    // Toggle sidebar disabled states
    document.querySelectorAll('.auth-required-nav').forEach(el => {
      if (!isAuth) {
        el.classList.add('nav-locked');
      } else {
        el.classList.remove('nav-locked');
      }
    });
  }

  renderView(viewName) {
    this.renderHeaderUserStatus();

    switch (viewName) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'daily-log':
        this.renderDailyLogView();
        break;
      case 'workouts':
        this.renderWorkoutsView();
        break;
      case 'nutrition':
        this.renderNutritionView();
        break;
      case 'progress':
        this.renderProgressView();
        break;
      case 'goals':
        this.renderGoalsView();
        break;
      case 'settings':
        this.renderSettingsView();
        break;
      case 'admin':
        this.renderAdminView();
        break;
      case 'login':
      case 'locked-gate':
        this.renderLoginView();
        break;
    }
  }

  // --- 1. DASHBOARD ---

  renderDashboard() {
    const data = this.store.data;
    const todayStr = FitTrackCalc.formatDateLocal();
    let todayLog = this.store.getDailyLog(todayStr);

    // Reconcile and auto-sync today's nutrition if food entries exist
    const nutritionTotals = this.store.getDailyNutritionTotals(todayStr);
    const hasFoodEntries = this.store.getFoodEntriesForDate(todayStr).length > 0;
    if (hasFoodEntries || nutritionTotals.calories > 0 || nutritionTotals.protein > 0) {
      if (!todayLog || todayLog.calories === null || todayLog.calories === undefined || todayLog.calories === 0) {
        this.syncDailyLogNutrition(todayStr, true);
        todayLog = this.store.getDailyLog(todayStr);
      }
    }

    const streaks = FitTrackCalc.calculateStreaks(data.dailyLogs, todayStr);

    // 1. Current Weight & Latest Body Fat
    const measurements = [...data.measurements].sort((a, b) => b.date.localeCompare(a.date));
    const latestMeasurement = measurements[0] || null;
    const currentWeightEl = document.getElementById('dash-current-weight');
    const currentBfEl = document.getElementById('dash-current-bf');
    const weightChangeEl = document.getElementById('dash-weight-change');

    const curWeight = (todayLog && typeof todayLog.weight === 'number' && todayLog.weight > 0)
      ? todayLog.weight
      : (latestMeasurement && typeof latestMeasurement.weight === 'number' && latestMeasurement.weight > 0)
        ? latestMeasurement.weight
        : (parseFloat(data.profile.weight) || 75);
    data.profile.weight = curWeight;
    if (currentWeightEl) currentWeightEl.textContent = `${curWeight} kg`;

    const curBfVal = parseFloat(latestMeasurement?.bodyFat || data.profile.bodyFat || 22);
    const targetBfVal = parseFloat(data.profile.targetBodyFat || data.goals.targetBodyFat || 10);
    const recomp = FitTrackCalc.calculateBodyRecomposition(curWeight, curBfVal, targetBfVal);

    if (currentBfEl) {
      if (latestMeasurement && latestMeasurement.bodyFat) {
        currentBfEl.textContent = `${latestMeasurement.bodyFat}%`;
      } else if (data.profile.bodyFat) {
        currentBfEl.textContent = `${data.profile.bodyFat}%`;
      } else {
        currentBfEl.textContent = `${curBfVal}%`;
      }
    }

    // Populate Target Displays in Weight KPI Card
    const targetWeightDisp = document.getElementById('dash-target-weight-display');
    if (targetWeightDisp) targetWeightDisp.textContent = `${recomp.targetWeight} kg`;
    const targetBfDisp = document.getElementById('dash-target-bf-display');
    if (targetBfDisp) targetBfDisp.textContent = `${recomp.targetBF}% BF`;

    // Populate Morning Weight Input placeholder
    const morningWeightInput = document.getElementById('dash-morning-weight-input');
    if (morningWeightInput) {
      morningWeightInput.placeholder = todayLog?.weight ? `${todayLog.weight} kg` : `${curWeight} kg`;
    }

    // Populate Personalized Body Recomposition Roadmap Card
    const recompCard = document.getElementById('dash-recomp-card');
    if (recompCard) {
      recompCard.style.display = 'block';
      const tierNameEl = document.getElementById('recomp-target-tier-name');
      if (tierNameEl) {
        const tierDescriptions = {
          10: '10% Beach Lean & Six-Pack Abs',
          12: '12% Chiseled Athletic Definition',
          14: '14% Athletic & Sustainable Fit',
          16: '16% Lean, Trim & Healthy',
          18: '18% Healthy Lifestyle Maintenance'
        };
        tierNameEl.textContent = tierDescriptions[recomp.targetBF] || `${recomp.targetBF}% Achievable Body Fat Target`;
      }
      const curStat = document.getElementById('recomp-current-stat');
      if (curStat) curStat.textContent = `${recomp.currentWeight} kg (${recomp.currentBF}% BF)`;
      const targetStat = document.getElementById('recomp-target-stat');
      if (targetStat) targetStat.textContent = `${recomp.targetWeight} kg (${recomp.targetBF}% BF)`;
      const fatLoseStat = document.getElementById('recomp-fat-to-lose');
      if (fatLoseStat) fatLoseStat.textContent = `${recomp.fatMassToLose} kg fat`;
      const leanMassStat = document.getElementById('recomp-lean-mass');
      if (leanMassStat) leanMassStat.textContent = `${recomp.leanBodyMass} kg LBM`;
      const timelineStat = document.getElementById('recomp-timeline');
      if (timelineStat) timelineStat.textContent = `~${recomp.estimatedWeeks} weeks (@ 0.5 kg/wk)`;
      const progressPct = document.getElementById('recomp-progress-pct');
      if (progressPct) progressPct.textContent = `${recomp.progressPercent}%`;
      const progressFill = document.getElementById('recomp-progress-fill');
      if (progressFill) progressFill.style.width = `${recomp.progressPercent}%`;
    }

    // Weight change over selected period
    if (weightChangeEl) {
      if (measurements.length >= 2) {
        let periodMeasurements = [...measurements];
        if (this.filterDays !== 'all') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - this.filterDays);
          const cutoffStr = FitTrackCalc.formatDateLocal(cutoff);
          periodMeasurements = periodMeasurements.filter(m => m.date >= cutoffStr);
        }

        if (periodMeasurements.length >= 2) {
          const newest = periodMeasurements[0].weight;
          const oldest = periodMeasurements[periodMeasurements.length - 1].weight;
          const diff = Math.round((newest - oldest) * 10) / 10;
          const sign = diff > 0 ? '+' : '';
          weightChangeEl.textContent = `${sign}${diff} kg (${this.filterDays === 'all' ? 'All' : this.filterDays + 'd'})`;
          weightChangeEl.className = 'metric-delta ' + (diff <= 0 ? 'positive' : 'neutral');
        } else {
          weightChangeEl.textContent = 'Need more logs in period';
          weightChangeEl.className = 'metric-delta neutral';
        }
      } else {
        weightChangeEl.textContent = 'Add logs to track change';
        weightChangeEl.className = 'metric-delta neutral';
      }
    }

    // 2. Nutrition Summary (Today's calories & protein vs goals)
    this.renderAdaptiveAdvisor();
    
    // Food entries and explicit daily log values are unified with seamless synchronization
    let caloriesLogged = 0;
    let proteinLogged = 0;
    if (hasFoodEntries || nutritionTotals.calories > 0 || nutritionTotals.protein > 0) {
      caloriesLogged = Math.max(todayLog?.calories || 0, Math.round(nutritionTotals.calories));
      proteinLogged = Math.max(todayLog?.protein || 0, Math.round(nutritionTotals.protein * 10) / 10);
    } else if (todayLog && typeof todayLog.calories === 'number') {
      caloriesLogged = todayLog.calories || 0;
      proteinLogged = todayLog.protein || 0;
    }
    const waterLogged = (todayLog && todayLog.waterMl > 0) ? todayLog.waterMl : 0;

    const calTarget = data.goals.dailyCalories || 2200;
    const proTarget = data.goals.dailyProtein || 150;
    const waterTarget = data.goals.dailyWaterMl || 2500;

    // Motivational Tiers
    const calTier = FitTrackMotivation.getCalorieTier(caloriesLogged, calTarget);
    const proTier = FitTrackMotivation.getTier(proTarget > 0 ? (proteinLogged / proTarget) * 100 : 0);
    const waterTier = FitTrackMotivation.getWaterTier(waterLogged, waterTarget);
    const hasWorkoutToday = (data.workouts || []).some(w => w.date === todayStr) ||
      !!(todayLog && todayLog.workoutStatus === 'workout' && todayLog.completed);
    const isRestToday = !!(todayLog && todayLog.workoutStatus === 'rest' && todayLog.completed);
    const workoutDone = hasWorkoutToday || isRestToday;

    const weekWorkoutsCount = this.calculateWorkoutsThisWeek();
    const targetWorkouts = data.goals.weeklyWorkouts || 6;

    const workoutTier = FitTrackMotivation.getWorkoutTier(
      hasWorkoutToday,
      isRestToday,
      weekWorkoutsCount,
      targetWorkouts
    );

    // Overall Daily Composite Score
    const calPct = calTarget > 0 ? (caloriesLogged / calTarget) * 100 : 0;
    const proPct = proTarget > 0 ? (proteinLogged / proTarget) * 100 : 0;
    const waterPct = waterTarget > 0 ? (waterLogged / waterTarget) * 100 : 0;
    const overallScore = FitTrackMotivation.getOverallDailyScore({
      calPercent: Math.min(100, calPct),
      proPercent: Math.min(100, proPct),
      waterPercent: Math.min(100, waterPct),
      workoutComplete: workoutDone
    });

    // Render Motivational Banner
    const overallEmojiEl = document.getElementById('dash-overall-emoji');
    const overallHeadingEl = document.getElementById('dash-overall-heading');
    const overallBadgeEl = document.getElementById('dash-overall-tier-badge');
    const overallMsgEl = document.getElementById('dash-overall-message');
    const overallBarEl = document.getElementById('dash-overall-bar');
    const celebrationEl = document.getElementById('dash-celebration-container');

    if (overallEmojiEl) {
      overallEmojiEl.innerHTML = `<img src="${overallScore.gif}" alt="${overallScore.emoji}" class="motivational-gif-large" />`;
    }
    if (overallHeadingEl) overallHeadingEl.textContent = `Today's Progress: ${overallScore.percent}%`;
    if (overallBadgeEl) {
      overallBadgeEl.className = `badge-tier ${overallScore.tierClass}`;
      overallBadgeEl.innerHTML = `<img src="${overallScore.gif}" alt="${overallScore.emoji}" class="badge-tier-gif" /> <span>${overallScore.percent}% Completed</span>`;
    }
    if (overallMsgEl) overallMsgEl.textContent = overallScore.message;
    if (overallBarEl) overallBarEl.style.width = `${overallScore.percent}%`;
    if (celebrationEl) {
      celebrationEl.style.display = overallScore.percent >= 100 ? 'block' : 'none';
      if (overallScore.percent >= 100) {
        celebrationEl.innerHTML = `<span class="celebration-badge"><img src="assets/gifs/party_popper.gif" class="badge-tier-gif" alt="🎉" /> Daily Goals Completed! Amazing Work! <img src="assets/gifs/trophy.gif" class="badge-tier-gif" alt="🏆" /></span>`;
      }
    }

    // Dedicated Today's Progress Column Card (Inside KPI Grid)
    const colProgIcon = document.getElementById('dash-progress-col-icon');
    const colProgPercent = document.getElementById('dash-col-overall-percent');
    const colProgBar = document.getElementById('dash-col-overall-bar');
    const colProgMotiv = document.getElementById('dash-col-overall-motivation');

    if (colProgIcon) {
      colProgIcon.innerHTML = `<img src="${overallScore.gif}" alt="${overallScore.emoji}" class="kpi-emoji-gif" />`;
    }
    if (colProgPercent) {
      colProgPercent.textContent = `${overallScore.percent}%`;
    }
    if (colProgBar) {
      colProgBar.style.width = `${overallScore.percent}%`;
    }
    if (colProgMotiv) {
      colProgMotiv.innerHTML = `<span class="badge-tier ${overallScore.tierClass}"><img src="${overallScore.gif}" alt="${overallScore.emoji}" class="badge-tier-gif" /> <span>${overallScore.message}</span></span>`;
    }

    // Weight Card Icon
    const weightIcon = document.getElementById('dash-weight-icon');
    if (weightIcon) {
      weightIcon.innerHTML = `<img src="assets/gifs/scale.gif" alt="⚖️" class="kpi-emoji-gif" />`;
    }

    // Calories Card
    const calEl = document.getElementById('dash-calories');
    const calTargetEl = document.getElementById('dash-cal-target');
    const calBar = document.getElementById('dash-cal-bar');
    const calRemEl = document.getElementById('dash-cal-remaining');
    const calMotivEl = document.getElementById('dash-cal-motivation');
    const calIcon = document.getElementById('dash-cal-icon');

    if (calIcon) {
      calIcon.innerHTML = `<img src="assets/gifs/fire.gif" alt="🔥" class="kpi-emoji-gif" />`;
    }
    if (calEl) calEl.textContent = `${Math.round(caloriesLogged)} kcal`;
    if (calTargetEl) calTargetEl.textContent = `Target: ${calTarget} kcal`;
    if (calBar) calBar.style.width = `${Math.min(100, Math.round(calPct))}%`;
    if (calRemEl) {
      if (caloriesLogged <= calTarget) {
        calRemEl.textContent = `${Math.round(calTarget - caloriesLogged)} kcal remaining`;
      } else {
        calRemEl.textContent = `${Math.round(caloriesLogged - calTarget)} kcal over target`;
      }
    }
    if (calMotivEl) {
      calMotivEl.innerHTML = `<span class="badge-tier ${calTier.tierClass}"><img src="${calTier.gif}" alt="${calTier.emoji}" class="badge-tier-gif" /> <span>${calTier.message}</span></span>`;
    }

    // Protein Card
    const proEl = document.getElementById('dash-protein');
    const proTargetEl = document.getElementById('dash-pro-target');
    const proBar = document.getElementById('dash-pro-bar');
    const proRemEl = document.getElementById('dash-pro-remaining');
    const proMotivEl = document.getElementById('dash-pro-motivation');
    const proIcon = document.getElementById('dash-pro-icon');

    if (proIcon) {
      proIcon.innerHTML = `<img src="assets/gifs/biceps.gif" alt="💪" class="kpi-emoji-gif" />`;
    }
    if (proEl) proEl.textContent = `${Math.round(proteinLogged)}g`;
    if (proTargetEl) proTargetEl.textContent = `Target: ${proTarget}g`;
    if (proBar) proBar.style.width = `${Math.min(100, Math.round(proPct))}%`;
    if (proRemEl) {
      if (proteinLogged < proTarget) {
        proRemEl.textContent = `${Math.round(proTarget - proteinLogged)}g remaining`;
      } else {
        const over = Math.round(proteinLogged - proTarget);
        proRemEl.textContent = over > 0 ? `Target reached! ✓ (+${over}g)` : `Target reached! ✓`;
      }
    }
    if (proMotivEl) {
      proMotivEl.innerHTML = `<span class="badge-tier ${proTier.tierClass}"><img src="${proTier.gif}" alt="${proTier.emoji}" class="badge-tier-gif" /> <span>${proTier.message}</span></span>`;
    }

    // Water Card
    const waterEl = document.getElementById('dash-water');
    const waterTargetEl = document.getElementById('dash-water-target');
    const waterBar = document.getElementById('dash-water-bar');
    const waterRemEl = document.getElementById('dash-water-remaining');
    const waterMotivEl = document.getElementById('dash-water-motivation');
    const waterIcon = document.getElementById('dash-water-icon');

    if (waterIcon) {
      waterIcon.innerHTML = `<img src="assets/gifs/droplet.gif" alt="💧" class="kpi-emoji-gif" />`;
    }
    if (waterEl) waterEl.textContent = `${waterLogged} ml`;
    if (waterTargetEl) waterTargetEl.textContent = `Target: ${waterTarget} ml`;
    if (waterBar) waterBar.style.width = `${Math.min(100, Math.round(waterPct))}%`;
    if (waterRemEl) {
      waterRemEl.textContent = waterLogged <= waterTarget
        ? `${Math.round(waterTarget - waterLogged)} ml remaining`
        : 'Daily hydration achieved!';
    }
    if (waterMotivEl) {
      waterMotivEl.innerHTML = `<span class="badge-tier ${waterTier.tierClass}"><img src="${waterTier.gif}" alt="${waterTier.emoji}" class="badge-tier-gif" /> <span>${waterTier.message}</span></span>`;
    }

    // 3. Streak & Today Completion Status
    const curStreakEl = document.getElementById('dash-cur-streak');
    const longestStreakEl = document.getElementById('dash-longest-streak');
    const todayStatusBadge = document.getElementById('dash-today-status');
    const streakIcon = document.getElementById('dash-streak-icon');

    if (streakIcon) {
      streakIcon.innerHTML = `<img src="${streaks.todayCompleted ? 'assets/gifs/trophy.gif' : 'assets/gifs/hourglass.gif'}" alt="🏆" class="kpi-emoji-gif" />`;
    }
    if (curStreakEl) curStreakEl.textContent = `${streaks.currentStreak} days`;
    if (longestStreakEl) longestStreakEl.textContent = `Best: ${streaks.longestStreak} days`;
    if (todayStatusBadge) {
      if (streaks.todayCompleted) {
        todayStatusBadge.innerHTML = '<span class="status-badge success"><img src="assets/gifs/check.gif" alt="✓" class="status-badge-gif" /> Today\'s Log Completed</span>';
      } else {
        todayStatusBadge.innerHTML = '<span class="status-badge warning"><img src="assets/gifs/hourglass.gif" alt="⏳" class="status-badge-gif" /> Today Incomplete</span>';
      }
    }

    // 4. Weekly Workout Completion
    const weekWorkoutEl = document.getElementById('dash-weekly-workouts');
    const workoutMotivEl = document.getElementById('dash-workout-motivation');
    const workoutIcon = document.getElementById('dash-workout-icon');

    if (workoutIcon) {
      const iconGif = weekWorkoutsCount >= targetWorkouts 
        ? 'assets/gifs/trophy.gif'
        : (hasWorkoutToday ? 'assets/gifs/fire.gif' : (isRestToday ? 'assets/gifs/check.gif' : 'assets/gifs/zap.gif'));
      workoutIcon.innerHTML = `<img src="${iconGif}" alt="⚡" class="kpi-emoji-gif" />`;
    }
    if (weekWorkoutEl) {
      weekWorkoutEl.textContent = `${weekWorkoutsCount} of ${targetWorkouts} completed`;
    }
    if (workoutMotivEl) {
      workoutMotivEl.innerHTML = `<span class="badge-tier ${workoutTier.tierClass}"><img src="${workoutTier.gif}" alt="${workoutTier.emoji}" class="badge-tier-gif" /> <span>${workoutTier.message}</span></span>`;
    }

    // 5. Adaptive Nutrition Engine Advisor
    this.renderAdaptiveAdvisor();

    // 6. Recent PRs & Strength Highlights
    this.renderDashboardPRs();

    // 7. Charts
    FitTrackCharts.renderWeightTrendChart('chart-dash-weight', data.measurements, this.filterDays);
    FitTrackCharts.renderNutritionTrendChart('chart-dash-nutrition', data.dailyLogs, calTarget, proTarget, this.filterDays, this.store);
  }

  renderAdaptiveAdvisor() {
    const evalResult = FitTrackAdaptive.evaluateTargets(this.store);
    const goals = this.store.data.goals;
    const profile = this.store.data.profile || {};
    const curWeight = parseFloat(profile.weight) || 75;

    if (!goals.dailyCalories || !goals.dailyProtein) {
      goals.dailyCalories = evalResult.recommendedCalories;
      goals.dailyProtein = evalResult.recommendedProtein;
      this.store.saveData();
    }

    // Update the sleek mini header on top of the Daily Progress card
    const snippetStatus = document.getElementById('adaptive-snippet-status');
    const snippetText = document.getElementById('adaptive-auto-targets-text');

    if (snippetStatus) {
      snippetStatus.textContent = evalResult.trendRatePerWeek !== null ? 'Trend Auto-Calibrated' : 'Auto-Calibrated';
    }
    if (snippetText) {
      snippetText.innerHTML = `<span>🎯 Auto-Set Targets: <strong>${goals.dailyCalories} kcal</strong> · <strong>${goals.dailyProtein}g pro</strong></span>
      <button type="button" class="btn-recalibrate-pill" id="btn-quick-recalibrate" title="Instant Auto-Recalibration">⚡ Auto-Sync</button>`;

      const quickRecal = document.getElementById('btn-quick-recalibrate');
      if (quickRecal) {
        quickRecal.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleRecalibrateAdaptiveTargets(true);
        });
      }
    }

    // Update Adaptive Modal Elements if modal exists
    const modalWeight = document.getElementById('modal-adaptive-weight');
    const modalBmr = document.getElementById('modal-adaptive-bmr');
    const modalTdee = document.getElementById('modal-adaptive-tdee');
    const modalGoal = document.getElementById('modal-adaptive-goal');

    const bmr = FitTrackCalc.calculateBMR(curWeight, profile.height || 169, profile.age || 24, profile.sex || 'male');
    const tdee = FitTrackCalc.calculateTDEE(bmr, parseFloat(profile.activityLevel) || 1.6);

    if (modalWeight) modalWeight.textContent = `${curWeight} kg`;
    if (modalBmr) modalBmr.textContent = `${Math.round(bmr)} kcal`;
    if (modalTdee) modalTdee.textContent = `${Math.round(tdee)} kcal`;
    if (modalGoal) {
      modalGoal.textContent = (profile.goal === 'muscle_gain') ? 'Muscle Gain (+8% surplus)' : (profile.goal === 'maintenance' ? 'Maintenance' : 'Fat Loss (~18% deficit)');
    }

    const recCalEl = document.getElementById('adaptive-rec-calories');
    const deltaCalEl = document.getElementById('adaptive-delta-calories');
    const curCalEl = document.getElementById('adaptive-cur-calories');

    const recProEl = document.getElementById('adaptive-rec-protein');
    const deltaProEl = document.getElementById('adaptive-delta-protein');
    const curProEl = document.getElementById('adaptive-cur-protein');

    const trendRateEl = document.getElementById('adaptive-trend-rate');
    const reasonTextEl = document.getElementById('adaptive-reason-text');

    if (recCalEl) recCalEl.textContent = `${evalResult.recommendedCalories} kcal`;
    if (curCalEl) curCalEl.textContent = `Current target: ${goals.dailyCalories} kcal`;
    if (deltaCalEl) {
      const d = evalResult.recommendedCalories - goals.dailyCalories;
      deltaCalEl.textContent = d === 0 ? 'Optimal pace' : (d > 0 ? `+${d} kcal` : `${d} kcal`);
      deltaCalEl.className = 'delta-pill ' + (d === 0 ? 'positive' : (d > 0 ? 'positive' : 'negative'));
    }

    if (recProEl) recProEl.textContent = `${evalResult.recommendedProtein}g`;
    if (curProEl) curProEl.textContent = `Current target: ${goals.dailyProtein}g`;
    if (deltaProEl) {
      const dp = evalResult.recommendedProtein - goals.dailyProtein;
      deltaProEl.textContent = dp === 0 ? 'On target' : (dp > 0 ? `+${dp}g` : `${dp}g`);
      deltaProEl.className = 'delta-pill ' + (dp === 0 ? 'positive' : (dp > 0 ? 'positive' : 'negative'));
    }

    if (trendRateEl) {
      if (evalResult.trendRatePerWeek !== null) {
        const sign = evalResult.trendRatePerWeek > 0 ? '+' : '';
        trendRateEl.textContent = `${sign}${evalResult.trendRatePerWeek} kg/wk`;
      } else {
        trendRateEl.textContent = 'Baseline Active';
      }
    }

    if (reasonTextEl) {
      reasonTextEl.innerHTML = `${this.escapeHTML(evalResult.adjustmentReason)} <br><span class="text-accent-green">${this.escapeHTML(evalResult.proteinExplanation)}</span>`;
    }
  }

  handleRecalibrateAdaptiveTargets(showToastMessage = true) {
    const profile = this.store.data.profile || {};
    const curWeight = parseFloat(profile.weight) || 75;
    const curBf = profile.bodyFat || 22;
    const targetBf = profile.targetBodyFat || 10;

    const evalResult = FitTrackAdaptive.evaluateTargets(this.store);

    const recomp = FitTrackCalc.calculateBodyRecomposition(curWeight, curBf, targetBf);
    this.store.data.profile.targetWeight = recomp.targetWeight;
    this.store.data.goals.targetWeight = recomp.targetWeight;
    this.store.data.goals.targetBodyFat = targetBf;

    this.store.data.goals.dailyCalories = evalResult.recommendedCalories;
    this.store.data.goals.dailyProtein = evalResult.recommendedProtein;
    this.store.data.goals.dailyWaterMl = Math.round(curWeight * 35);

    const fatGrams = Math.round(curWeight * 0.85);
    const proCals = evalResult.recommendedProtein * 4;
    const fatCals = fatGrams * 9;
    const remCals = Math.max(0, evalResult.recommendedCalories - (proCals + fatCals));
    this.store.data.goals.dailyCarbs = Math.round(remCals / 4);
    this.store.data.goals.dailyFat = fatGrams;

    this.store.saveData();

    if (showToastMessage) {
      this.showToast(`🤖 Adaptive Nutrition Engine calibrated: ${evalResult.recommendedCalories} kcal · ${evalResult.recommendedProtein}g protein · ${this.store.data.goals.dailyWaterMl}ml water!`, 'success');
    }

    this.closeAllModals();
    this.render();
  }

  calculateWorkoutsThisWeek() {
    const today = new Date();
    // Monday of current week
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
    const diff = (dayOfWeek + 6) % 7; // days since Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    const mondayStr = FitTrackCalc.formatDateLocal(monday);

    const workoutDates = new Set();
    (this.store.data.workouts || []).forEach(w => {
      if (w.date >= mondayStr) workoutDates.add(w.date);
    });
    (this.store.data.dailyLogs || []).forEach(l => {
      if (l.date >= mondayStr && l.workoutStatus === 'workout' && l.completed) {
        workoutDates.add(l.date);
      }
    });
    return workoutDates.size;
  }

  renderDashboardPRs() {
    const container = document.getElementById('dash-prs-list');
    if (!container) return;

    const prs = Object.values(this.store.data.exercisePRs);
    if (prs.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <p>No Personal Records logged yet. Log your first workout session to record strength milestones!</p>
        </div>`;
      return;
    }

    // Sort to prioritize primary lifts first, then by best 1RM
    prs.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || b.bestEst1RM - a.bestEst1RM);

    const itemsHtml = prs.slice(0, 4).map(pr => {
      const formulaBadge = pr.bestEst1RMIsActual
        ? '<span class="tag-actual-1rm">Actual 1RM</span>'
        : '<span class="tag-est-1rm">Est. 1RM (Epley)</span>';

      return `
        <div class="pr-card ${pr.isPrimary ? 'primary-lift' : ''}">
          <div class="pr-header">
            <h4>${this.escapeHTML(pr.name)}</h4>
            ${pr.isPrimary ? '<span class="badge-primary-lift">Primary Lift</span>' : ''}
          </div>
          <div class="pr-stats">
            <div class="pr-stat">
              <span class="pr-num">${pr.bestEst1RM} kg</span>
              ${formulaBadge}
            </div>
            <div class="pr-sub">
              Best Set: <strong>${pr.bestWeight} kg × ${pr.bestWeightReps} reps</strong>
              <span class="pr-date">(${pr.bestEst1RMDate || pr.bestWeightDate})</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="pr-grid">${itemsHtml}</div>`;
  }

  // --- 2. DAILY FITNESS LOG ---

  renderDailyLogView() {
    const dateInput = document.getElementById('log-date');
    if (dateInput) {
      if (!dateInput.value) {
        dateInput.value = this.selectedLogDate;
      } else {
        this.selectedLogDate = dateInput.value;
      }
    }
    this.loadDailyLogIntoForm(this.selectedLogDate);
    this.renderDailyLogHistoryTable();
  }

  loadDailyLogIntoForm(dateStr) {
    const existing = this.store.getDailyLog(dateStr);
    const totals = this.store.getDailyNutritionTotals(dateStr);
    const hasFoodEntries = this.store.getFoodEntriesForDate(dateStr).length > 0;

    const completedCheck = document.getElementById('log-completed');
    const weightInput = document.getElementById('log-weight');
    const bfInput = document.getElementById('log-bf');
    const caloriesInput = document.getElementById('log-calories');
    const proteinInput = document.getElementById('log-protein');
    const carbsInput = document.getElementById('log-carbs');
    const fatInput = document.getElementById('log-fat');
    const workoutStatusSelect = document.getElementById('log-workout-status');
    const waterInput = document.getElementById('log-water');
    const sleepInput = document.getElementById('log-sleep');
    const notesInput = document.getElementById('log-notes');
    const logNotice = document.getElementById('log-form-notice');

    if (existing) {
      if (completedCheck) completedCheck.checked = !!existing.completed;
      if (weightInput) weightInput.value = existing.weight ?? '';
      if (bfInput) bfInput.value = existing.bodyFat ?? '';

      // If user has saved calories in the daily log, prioritize their explicit saved values
      const hasExplicitCalories = existing.calories !== null && existing.calories !== undefined && existing.calories !== '';
      if (hasExplicitCalories) {
        if (caloriesInput) caloriesInput.value = existing.calories;
        if (proteinInput) proteinInput.value = existing.protein ?? '';
        if (carbsInput) carbsInput.value = existing.carbs ?? '';
        if (fatInput) fatInput.value = existing.fat ?? '';
      } else if (hasFoodEntries || totals.calories > 0 || totals.protein > 0) {
        if (caloriesInput) caloriesInput.value = Math.round(totals.calories);
        if (proteinInput) proteinInput.value = Math.round(totals.protein * 10) / 10;
        if (carbsInput) carbsInput.value = Math.round(totals.carbs * 10) / 10;
        if (fatInput) fatInput.value = Math.round(totals.fat * 10) / 10;
      } else {
        if (caloriesInput) caloriesInput.value = '';
        if (proteinInput) proteinInput.value = '';
        if (carbsInput) carbsInput.value = '';
        if (fatInput) fatInput.value = '';
      }
      if (workoutStatusSelect) workoutStatusSelect.value = existing.workoutStatus || 'workout';
      if (waterInput) waterInput.value = existing.waterMl ?? '';
      if (sleepInput) sleepInput.value = existing.sleepHours ?? '';
      if (notesInput) notesInput.value = existing.notes ?? '';

      if (logNotice) {
        logNotice.innerHTML = hasExplicitCalories
          ? `<span class="text-info">ℹ️ Editing saved log for <strong>${dateStr}</strong> (${existing.completed ? 'Marked Complete ✓' : 'Incomplete'}).</span>`
          : (hasFoodEntries
            ? `<span class="text-info">ℹ️ Pre-filled from ${this.store.getFoodEntriesForDate(dateStr).length} food items. Save to confirm.</span>`
            : `<span class="text-info">ℹ️ Editing log for <strong>${dateStr}</strong>.</span>`);
      }
    } else {
      // New log: pre-fill calories and protein from nutrition food items if logged
      if (completedCheck) completedCheck.checked = false;
      if (weightInput) weightInput.value = '';
      if (bfInput) bfInput.value = '';
      if (caloriesInput) caloriesInput.value = totals.calories > 0 ? Math.round(totals.calories) : '';
      if (proteinInput) proteinInput.value = totals.protein > 0 ? Math.round(totals.protein * 10) / 10 : '';
      if (carbsInput) carbsInput.value = totals.carbs > 0 ? Math.round(totals.carbs * 10) / 10 : '';
      if (fatInput) fatInput.value = totals.fat > 0 ? Math.round(totals.fat * 10) / 10 : '';
      if (workoutStatusSelect) workoutStatusSelect.value = 'workout';
      if (waterInput) waterInput.value = '';
      if (sleepInput) sleepInput.value = '';
      if (notesInput) notesInput.value = '';

      if (logNotice) {
        logNotice.innerHTML = totals.calories > 0
          ? `<span class="text-muted">✨ Calories & protein auto-populated from today's ${Math.round(totals.calories)} kcal nutrition entries. Check "Mark Day as Complete" and save to increment your streak.</span>`
          : `<span class="text-muted">Create a log for <strong>${dateStr}</strong>. Remember: A day counts toward your streak when you mark it complete and save.</span>`;
      }
    }
  }

  setupAutoSaveDailyLog() {
    const dailyLogForm = document.getElementById('form-daily-log');
    if (!dailyLogForm) return;

    let debounceTimer = null;
    const badge = document.getElementById('autosave-daily-log-badge');

    const triggerAutoSave = () => {
      if (badge) {
        badge.innerHTML = '⏳ Saving...';
        badge.classList.add('saving');
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.saveDailyLogFromForm(true);
      }, 500);
    };

    dailyLogForm.addEventListener('input', triggerAutoSave);
    dailyLogForm.addEventListener('change', triggerAutoSave);
  }

  saveDailyLogFromForm(isSilent = false) {
    const dateInput = document.getElementById('log-date');
    const dateStr = dateInput ? dateInput.value : this.selectedLogDate;

    if (!dateStr) {
      if (!isSilent) this.showToast('Please select a valid date.', 'error');
      return false;
    }

    const completed = document.getElementById('log-completed')?.checked ?? false;
    const weightVal = parseFloat(document.getElementById('log-weight')?.value);
    const bfVal = parseFloat(document.getElementById('log-bf')?.value);
    const calVal = parseFloat(document.getElementById('log-calories')?.value);
    const proVal = parseFloat(document.getElementById('log-protein')?.value);
    const carbsVal = parseFloat(document.getElementById('log-carbs')?.value);
    const fatVal = parseFloat(document.getElementById('log-fat')?.value);
    const workoutStatus = document.getElementById('log-workout-status')?.value || 'workout';
    const waterVal = parseInt(document.getElementById('log-water')?.value, 10);
    const sleepVal = parseFloat(document.getElementById('log-sleep')?.value);
    const notesVal = (document.getElementById('log-notes')?.value || '').trim();

    // Validation
    if (calVal < 0 || proVal < 0 || carbsVal < 0 || fatVal < 0 || waterVal < 0 || sleepVal < 0) {
      if (!isSilent) this.showToast('Values cannot be negative.', 'error');
      return false;
    }

    const logObj = {
      date: dateStr,
      completed,
      weight: !isNaN(weightVal) && weightVal > 0 ? weightVal : null,
      bodyFat: !isNaN(bfVal) && bfVal > 0 ? bfVal : null,
      calories: !isNaN(calVal) && calVal >= 0 ? calVal : 0,
      protein: !isNaN(proVal) && proVal >= 0 ? proVal : 0,
      carbs: !isNaN(carbsVal) && carbsVal >= 0 ? carbsVal : null,
      fat: !isNaN(fatVal) && fatVal >= 0 ? fatVal : null,
      workoutStatus,
      waterMl: !isNaN(waterVal) && waterVal >= 0 ? waterVal : null,
      sleepHours: !isNaN(sleepVal) && sleepVal >= 0 ? sleepVal : null,
      notes: notesVal
    };

    const saved = this.store.saveDailyLog(logObj);
    const badge = document.getElementById('autosave-daily-log-badge');

    if (saved) {
      if (badge) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        badge.innerHTML = `🟢 Auto-saved at ${timeStr}`;
        badge.classList.remove('saving');
      }

      if (!isSilent) {
        const streaks = FitTrackCalc.calculateStreaks(this.store.data.dailyLogs);
        const streakMsg = completed
          ? `Daily log saved! Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? '' : 's'} 🔥`
          : 'Daily log updated (marked incomplete).';
        this.showToast(streakMsg, 'success');
        this.render();
      } else {
        this.renderDailyLogHistoryTable();
        this.renderHeaderUserStatus();
      }
      return true;
    } else {
      if (badge) {
        badge.innerHTML = `⚠️ Auto-save failed`;
        badge.classList.remove('saving');
      }
      if (!isSilent) this.showToast('Error saving daily log.', 'error');
      return false;
    }
  }

  handleDailyLogSubmit(e) {
    if (e) e.preventDefault();
    this.saveDailyLogFromForm(false);
  }

  /**
   * Automatically synchronize daily nutrition totals from itemized food logs into the daily log for that date.
   * Keeps Dashboard, Daily Log, History and Streaks in 100% real-time alignment.
   */
  syncDailyLogNutrition(dateStr, autoSave = true) {
    if (!dateStr) return null;
    const totals = this.store.getDailyNutritionTotals(dateStr);
    const entries = this.store.getFoodEntriesForDate(dateStr);
    const hasEntries = entries.length > 0;

    const roundedCal = Math.round(totals.calories);
    const roundedPro = Math.round(totals.protein * 10) / 10;
    const roundedCarbs = Math.round(totals.carbs * 10) / 10;
    const roundedFat = Math.round(totals.fat * 10) / 10;

    if (hasEntries || totals.calories > 0 || totals.protein > 0) {
      if (autoSave) {
        this.store.saveDailyLog({
          date: dateStr,
          calories: roundedCal,
          protein: roundedPro,
          carbs: roundedCarbs,
          fat: roundedFat
        });
      }

      // If the daily log form is currently viewing this date, update its inputs immediately
      const logDateInput = document.getElementById('log-date');
      if (logDateInput && logDateInput.value === dateStr) {
        const calInput = document.getElementById('log-calories');
        const proInput = document.getElementById('log-protein');
        const carbsInput = document.getElementById('log-carbs');
        const fatInput = document.getElementById('log-fat');
        if (calInput) calInput.value = roundedCal;
        if (proInput) proInput.value = roundedPro;
        if (carbsInput) carbsInput.value = roundedCarbs;
        if (fatInput) fatInput.value = roundedFat;
      }

      return { calories: roundedCal, protein: roundedPro, carbs: roundedCarbs, fat: roundedFat };
    }
    return null;
  }

  renderDailyLogHistoryTable() {
    const container = document.getElementById('table-daily-logs-body');
    if (!container) return;

    const logs = [...this.store.data.dailyLogs].sort((a, b) => b.date.localeCompare(a.date));
    if (logs.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No historical daily logs recorded yet.</td></tr>`;
      return;
    }

    container.innerHTML = logs.map(log => {
      const statusBadge = log.completed
        ? '<span class="status-badge success">Complete</span>'
        : '<span class="status-badge neutral">Incomplete</span>';

      const workoutBadge = log.workoutStatus === 'rest'
        ? '<span class="badge-rest">Rest Day</span>'
        : log.workoutStatus === 'skipped'
        ? '<span class="badge-skipped">Skipped</span>'
        : '<span class="badge-workout">Workout</span>';

      return `
        <tr>
          <td><strong>${log.date}</strong></td>
          <td>${statusBadge}</td>
          <td>${log.weight ? log.weight + ' kg' : '-'}</td>
          <td>${log.calories ? log.calories + ' kcal' : '-'}</td>
          <td>${log.protein ? log.protein + 'g' : '-'}</td>
          <td>${workoutBadge}</td>
          <td>
            <button class="btn-sm btn-outline btn-edit-log" data-date="${log.date}">Edit</button>
            <button class="btn-sm btn-danger btn-delete-log" data-date="${log.date}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire edit and delete handlers
    container.querySelectorAll('.btn-edit-log').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const date = e.target.getAttribute('data-date');
        this.selectedLogDate = date;
        const dateInput = document.getElementById('log-date');
        if (dateInput) dateInput.value = date;
        this.loadDailyLogIntoForm(date);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    container.querySelectorAll('.btn-delete-log').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const date = e.target.getAttribute('data-date');
        this.confirmDialog(`Delete daily log for ${date}? This will recalculate streaks.`, () => {
          this.store.deleteDailyLog(date);
          this.showToast(`Log for ${date} deleted.`, 'info');
          this.render();
        });
      });
    });
  }

  // --- 3. WORKOUT TRACKING (WORKOUTS & EXERCISE LOGGING) ---

  renderWorkoutsView() {
    const dateInput = document.getElementById('workout-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = FitTrackCalc.formatDateLocal();
    }
    const list = document.getElementById('workout-exercise-list');
    if (list && list.children.length === 0) {
      this.addExerciseToWorkoutForm();
    }
    this.renderWorkoutHistory();
  }

  addExerciseToWorkoutForm(exerciseData = null) {
    const list = document.getElementById('workout-exercise-list');
    if (!list) return;

    const exerciseId = 'ex-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const card = document.createElement('div');
    card.className = 'exercise-form-card';
    card.id = exerciseId;

    const initialName = exerciseData ? exerciseData.name : '';
    const initialMuscle = exerciseData ? exerciseData.muscleGroup : 'Chest';
    const isPrimary = exerciseData ? !!exerciseData.isPrimary : false;

    card.innerHTML = `
      <div class="exercise-card-header">
        <div class="exercise-header-inputs">
          <input type="text" class="input-text ex-name-input" placeholder="Exercise name (e.g. Barbell Bench Press)" value="${this.escapeHTML(initialName)}" required>
          <select class="input-select ex-muscle-select">
            <option value="Chest" ${initialMuscle === 'Chest' ? 'selected' : ''}>Chest</option>
            <option value="Back" ${initialMuscle === 'Back' ? 'selected' : ''}>Back</option>
            <option value="Legs" ${initialMuscle === 'Legs' ? 'selected' : ''}>Legs</option>
            <option value="Shoulders" ${initialMuscle === 'Shoulders' ? 'selected' : ''}>Shoulders</option>
            <option value="Arms" ${initialMuscle === 'Arms' ? 'selected' : ''}>Arms</option>
            <option value="Core" ${initialMuscle === 'Core' ? 'selected' : ''}>Core / Abs</option>
            <option value="Full Body" ${initialMuscle === 'Full Body' ? 'selected' : ''}>Full Body</option>
          </select>
          <label class="checkbox-label" title="Mark this exercise to track during fat loss">
            <input type="checkbox" class="ex-is-primary" ${isPrimary ? 'checked' : ''}> Primary Strength Lift
          </label>
        </div>
        <button type="button" class="btn-icon btn-remove-exercise" title="Remove exercise">✕</button>
      </div>

      <div class="prev-performance-box" id="prev-${exerciseId}">
        <!-- Populated dynamically when user types exercise name -->
      </div>

      <div class="sets-table-wrapper">
        <table class="sets-table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Weight (kg)</th>
              <th>Reps</th>
              <th>RPE (1-10)</th>
              <th>Est. 1RM (Epley)</th>
              <th></th>
            </tr>
          </thead>
          <tbody class="sets-tbody">
            <!-- Set rows added here -->
          </tbody>
        </table>
      </div>

      <div class="exercise-card-footer">
        <button type="button" class="btn-sm btn-outline btn-add-set">+ Add Set</button>
        <input type="text" class="input-text ex-notes-input" placeholder="Exercise notes (e.g. good tempo, pause at bottom)" value="${exerciseData && exerciseData.notes ? this.escapeHTML(exerciseData.notes) : ''}">
      </div>
    `;

    list.appendChild(card);

    // Wire remove exercise button
    card.querySelector('.btn-remove-exercise').addEventListener('click', () => {
      card.remove();
    });

    // Wire add set button
    const setsTbody = card.querySelector('.sets-tbody');
    const addSetBtn = card.querySelector('.btn-add-set');
    const addSetRow = (setWeight = '', setReps = '', setRpe = '') => {
      const setRow = document.createElement('tr');
      const setNum = setsTbody.children.length + 1;
      setRow.innerHTML = `
        <td class="set-num-cell">${setNum}</td>
        <td><input type="number" step="0.5" min="0" class="input-number set-weight" placeholder="kg" value="${setWeight}" required></td>
        <td><input type="number" min="1" class="input-number set-reps" placeholder="reps" value="${setReps}" required></td>
        <td><input type="number" min="1" max="10" step="0.5" class="input-number set-rpe" placeholder="e.g. 8" value="${setRpe}"></td>
        <td class="set-1rm-preview text-muted">-</td>
        <td><button type="button" class="btn-icon btn-remove-set" title="Remove set">✕</button></td>
      `;
      setsTbody.appendChild(setRow);

      const update1RM = () => {
        const w = parseFloat(setRow.querySelector('.set-weight').value) || 0;
        const r = parseInt(setRow.querySelector('.set-reps').value, 10) || 0;
        const calc = FitTrackCalc.calculate1RM(w, r);
        const cell = setRow.querySelector('.set-1rm-preview');
        if (calc.estimated1RM > 0) {
          cell.innerHTML = `<strong>${calc.estimated1RM} kg</strong> ${calc.isActual1RM ? '(Actual)' : '(Est)'}`;
        } else {
          cell.textContent = '-';
        }
      };

      setRow.querySelector('.set-weight').addEventListener('input', update1RM);
      setRow.querySelector('.set-reps').addEventListener('input', update1RM);
      setRow.querySelector('.btn-remove-set').addEventListener('click', () => {
        setRow.remove();
        // Renumber sets
        Array.from(setsTbody.children).forEach((r, idx) => {
          r.querySelector('.set-num-cell').textContent = idx + 1;
        });
      });

      update1RM();
    };

    addSetBtn.addEventListener('click', () => addSetRow());

    // Populate initial sets or default 3 sets
    if (exerciseData && Array.isArray(exerciseData.sets) && exerciseData.sets.length > 0) {
      exerciseData.sets.forEach(s => addSetRow(s.weight, s.reps, s.rpe || ''));
    } else {
      addSetRow();
      addSetRow();
      addSetRow();
    }

    // Previous performance dynamic lookup
    const nameInput = card.querySelector('.ex-name-input');
    const prevBox = card.querySelector(`#prev-${exerciseId}`);
    const checkPrev = () => {
      const name = nameInput.value.trim();
      if (!name) {
        prevBox.innerHTML = '';
        return;
      }
      const prev = this.store.getPreviousPerformance(name);
      if (prev) {
        const setsSummary = (prev.sets || []).map(s => `${s.weight}kg × ${s.reps}`).join(', ');
        prevBox.innerHTML = `
          <div class="prev-session-alert">
            <span class="prev-title">Previous Session (${prev.date}):</span>
            <span class="prev-details">${setsSummary}</span>
          </div>`;
      } else {
        prevBox.innerHTML = '';
      }
    };

    nameInput.addEventListener('blur', checkPrev);
    if (initialName) checkPrev();
  }

  handleWorkoutSubmit(e) {
    e.preventDefault();
    const dateInput = document.getElementById('workout-date');
    const nameInput = document.getElementById('workout-name');
    const notesInput = document.getElementById('workout-notes');
    const cards = document.querySelectorAll('.exercise-form-card');

    if (!dateInput || !nameInput) return;
    const date = dateInput.value;
    const name = nameInput.value.trim();

    if (!date || !name) {
      this.showToast('Please enter both a workout date and workout name.', 'error');
      return;
    }

    if (cards.length === 0) {
      this.showToast('Please add at least one exercise to the workout.', 'error');
      return;
    }

    const exercises = [];
    let hasValidationError = false;

    cards.forEach(card => {
      const exName = card.querySelector('.ex-name-input').value.trim();
      const muscleGroup = card.querySelector('.ex-muscle-select').value;
      const isPrimary = card.querySelector('.ex-is-primary').checked;
      const exNotes = card.querySelector('.ex-notes-input').value.trim();

      if (!exName) {
        hasValidationError = true;
        return;
      }

      const sets = [];
      const setRows = card.querySelectorAll('.sets-tbody tr');
      setRows.forEach(row => {
        const weight = parseFloat(row.querySelector('.set-weight').value) || 0;
        const reps = parseInt(row.querySelector('.set-reps').value, 10) || 0;
        const rpeVal = parseFloat(row.querySelector('.set-rpe').value);
        const rpe = !isNaN(rpeVal) ? rpeVal : null;

        if (weight > 0 && reps > 0) {
          sets.push({ weight, reps, rpe });
        }
      });

      if (sets.length > 0) {
        exercises.push({
          name: exName,
          muscleGroup,
          isPrimary,
          notes: exNotes,
          sets
        });
      }
    });

    if (hasValidationError || exercises.length === 0) {
      this.showToast('Please specify an exercise name and at least one set with weight and reps.', 'error');
      return;
    }

    const workout = {
      date,
      name,
      notes: notesInput ? notesInput.value.trim() : '',
      exercises
    };

    const saved = this.store.saveWorkout(workout);
    if (saved) {
      this.showToast('Workout saved successfully! PRs updated.', 'success');
      // Clear exercise list form
      document.getElementById('workout-exercise-list').innerHTML = '';
      nameInput.value = '';
      if (notesInput) notesInput.value = '';
      this.render();
    }
  }

  renderWorkoutHistory() {
    const container = document.getElementById('workouts-history-container');
    if (!container) return;

    const workouts = this.store.data.workouts;
    if (workouts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <p>No workouts recorded yet. Use the workout logger above to record your session!</p>
        </div>`;
      return;
    }

    container.innerHTML = workouts.map(w => {
      const exerciseRows = (w.exercises || []).map(e => {
        const setsFormatted = (e.sets || []).map((s, idx) => {
          const calc = FitTrackCalc.calculate1RM(s.weight, s.reps);
          return `<span class="set-pill">Set ${idx + 1}: <strong>${s.weight}kg × ${s.reps}</strong> ${s.rpe ? `(@${s.rpe})` : ''} <small class="text-muted">(1RM ~${calc.estimated1RM}kg)</small></span>`;
        }).join(' ');

        return `
          <div class="workout-history-exercise">
            <div class="exercise-hist-head">
              <strong>${this.escapeHTML(e.name)}</strong>
              <span class="badge-muscle">${this.escapeHTML(e.muscleGroup || '')}</span>
              ${e.isPrimary ? '<span class="badge-primary-lift">Primary Lift</span>' : ''}
            </div>
            <div class="sets-history-row">${setsFormatted}</div>
            ${e.notes ? `<div class="exercise-hist-notes">Note: ${this.escapeHTML(e.notes)}</div>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="workout-card">
          <div class="workout-card-top">
            <div>
              <h3 class="workout-title">${this.escapeHTML(w.name)}</h3>
              <div class="workout-date">📅 ${w.date}</div>
            </div>
            <div class="workout-actions">
              <button class="btn-sm btn-danger btn-delete-workout" data-id="${w.id}">Delete</button>
            </div>
          </div>
          ${w.notes ? `<div class="workout-desc">Notes: ${this.escapeHTML(w.notes)}</div>` : ''}
          <div class="workout-exercises-wrapper">${exerciseRows}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-delete-workout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        this.confirmDialog('Delete this workout and recompute strength personal records?', () => {
          this.store.deleteWorkout(id);
          this.showToast('Workout deleted.', 'info');
          this.render();
        });
      });
    });
  }

  // --- 3.1 EXERCISES & PERSONAL RECORDS SUB-VIEW ---

  renderExercisesView() {
    const container = document.getElementById('exercises-prs-container');
    if (!container) return;

    const prs = Object.values(this.store.data.exercisePRs);
    if (prs.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <h3>No Exercise PR Records Yet</h3>
          <p>Whenever you log sets in the Workouts section, FitTrack automatically scans and tracks all-time PRs for weight and estimated 1RM using the Epley formula.</p>
        </div>`;
      return;
    }

    prs.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.name.localeCompare(b.name));

    container.innerHTML = `
      <div class="pr-full-grid">
        ${prs.map(pr => {
          const formulaLabel = pr.bestEst1RMIsActual ? 'Actual 1-Rep Max' : 'Estimated 1RM (Epley: W × (1 + R/30))';
          const historyItems = (pr.history || []).slice(-3).reverse().map(h => `
            <li>${h.date}: ${h.weight}kg × ${h.reps} reps (1RM: ${h.est1RM}kg)</li>
          `).join('');

          return `
            <div class="pr-detail-card ${pr.isPrimary ? 'primary-lift' : ''}">
              <div class="pr-card-header">
                <div>
                  <h3 class="pr-exercise-name">${this.escapeHTML(pr.name)}</h3>
                  <span class="badge-muscle">${this.escapeHTML(pr.muscleGroup || '')}</span>
                </div>
                ${pr.isPrimary ? '<span class="badge-primary-lift">⭐ Monitored Strength Lift</span>' : ''}
              </div>

              <div class="pr-records-summary">
                <div class="pr-metric-box">
                  <div class="pr-metric-label">${formulaLabel}</div>
                  <div class="pr-metric-value text-accent-green">${pr.bestEst1RM} kg</div>
                  <div class="pr-metric-sub">Achieved on ${pr.bestEst1RMDate || '-'} (${pr.bestEst1RMWeight}kg × ${pr.bestEst1RMReps})</div>
                </div>

                <div class="pr-metric-box">
                  <div class="pr-metric-label">Heaviest Weight Lifted</div>
                  <div class="pr-metric-value text-accent-blue">${pr.bestWeight} kg</div>
                  <div class="pr-metric-sub">${pr.bestWeightReps} reps on ${pr.bestWeightDate || '-'}</div>
                </div>
              </div>

              ${historyItems ? `
                <div class="pr-history-section">
                  <span class="pr-hist-heading">Recent Milestone Progression:</span>
                  <ul class="pr-milestones-list">${historyItems}</ul>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- 4. NUTRITION TRACKING & SMART MEAL ASSISTANT ---

  renderNutritionView() {
    const todayStr = FitTrackCalc.formatDateLocal();
    const dateInput = document.getElementById('nutrition-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = todayStr;
    }
    const selectedDate = dateInput ? dateInput.value : todayStr;

    // Render Macro Breakdown & Target Bars
    this.renderNutritionTargetsCard(selectedDate);

    // Render Logged Foods Table for the Date
    this.renderFoodEntriesTable(selectedDate);
  }

  renderNutritionTargetsCard(dateStr) {
    const totals = this.store.getDailyNutritionTotals(dateStr);
    const goals = this.store.data.goals;

    const calTarget = goals.dailyCalories || 2200;
    const proTarget = goals.dailyProtein || 150;
    const carbsTarget = goals.dailyCarbs || 230;
    const fatTarget = goals.dailyFat || 65;

    const calRemain = calTarget - totals.calories;
    const proRemain = proTarget - totals.protein;

    const card = document.getElementById('nutrition-summary-card');
    if (!card) return;

    card.innerHTML = `
      <div class="nutrition-macro-grid">
        <div class="macro-stat-card">
          <span class="macro-label">Calories</span>
          <span class="macro-val text-accent-orange">${Math.round(totals.calories)} <small>/ ${calTarget} kcal</small></span>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-orange" style="width: ${Math.min(100, Math.round((totals.calories / calTarget) * 100))}%"></div>
          </div>
          <span class="macro-sub">${calRemain >= 0 ? `${Math.round(calRemain)} kcal remaining` : `${Math.abs(Math.round(calRemain))} kcal over target`}</span>
        </div>

        <div class="macro-stat-card">
          <span class="macro-label">Protein</span>
          <span class="macro-val text-accent-green">${Math.round(totals.protein)} <small>/ ${proTarget} g</small></span>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-green" style="width: ${Math.min(100, Math.round((totals.protein / proTarget) * 100))}%"></div>
          </div>
          <span class="macro-sub">${proRemain >= 0 ? `${Math.round(proRemain)}g remaining` : 'Target reached! ✓'}</span>
        </div>

        <div class="macro-stat-card">
          <span class="macro-label">Carbohydrates</span>
          <span class="macro-val text-accent-blue">${Math.round(totals.carbs)} <small>/ ${carbsTarget} g</small></span>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-blue" style="width: ${Math.min(100, Math.round((totals.carbs / carbsTarget) * 100))}%"></div>
          </div>
          <span class="macro-sub">${Math.max(0, Math.round(carbsTarget - totals.carbs))}g remaining</span>
        </div>

        <div class="macro-stat-card">
          <span class="macro-label">Fat</span>
          <span class="macro-val text-accent-purple">${Math.round(totals.fat)} <small>/ ${fatTarget} g</small></span>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-purple" style="width: ${Math.min(100, Math.round((totals.fat / fatTarget) * 100))}%"></div>
          </div>
          <span class="macro-sub">${Math.max(0, Math.round(fatTarget - totals.fat))}g remaining</span>
        </div>
      </div>
    `;
  }

  renderFoodPresets() {
    const container = document.getElementById('food-presets-container');
    if (!container) return;

    const presets = this.store.data.foodPresets;
    container.innerHTML = presets.map(p => `
      <div class="preset-pill">
        <div class="preset-info">
          <strong>${this.escapeHTML(p.name)}</strong>
          <small class="text-muted">${p.serving} · ${p.calories}kcal (${p.protein}g P)</small>
        </div>
        <button type="button" class="btn-sm btn-accent btn-quick-add-preset" data-id="${p.id}" title="Add to current date">+ Add</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-quick-add-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const preset = presets.find(p => p.id === id);
        if (preset) {
          const dateInput = document.getElementById('nutrition-date');
          const date = dateInput ? dateInput.value : FitTrackCalc.formatDateLocal();
          this.store.addFoodEntry({
            date,
            name: preset.name,
            serving: preset.serving,
            calories: preset.calories,
            protein: preset.protein,
            carbs: preset.carbs,
            fat: preset.fat,
            category: preset.category || 'snack'
          });
          this.syncDailyLogNutrition(date, true);
          this.showToast(`Added ${preset.name} to ${date}!`, 'success');
          this.renderNutritionView();
          if (date === FitTrackCalc.formatDateLocal()) {
            this.renderDashboard();
          }
        }
      });
    });
  }

  renderFoodEntriesTable(dateStr) {
    const container = document.getElementById('table-nutrition-body');
    if (!container) return;

    const entries = this.store.getFoodEntriesForDate(dateStr);
    if (entries.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No foods logged for ${dateStr} yet. Use the quick presets above or the form below.</td></tr>`;
      return;
    }

    container.innerHTML = entries.map(item => `
      <tr data-id="${item.id}" title="Click Edit or double-click row to modify macros">
        <td><strong>${this.escapeHTML(item.name)}</strong> <small class="text-muted">(${this.escapeHTML(item.serving || '')})</small></td>
        <td><span class="badge-category">${this.escapeHTML(item.category || 'snack')}</span></td>
        <td>${Math.round(item.calories)} kcal</td>
        <td>${Math.round(item.protein)}g</td>
        <td>${Math.round(item.carbs || 0)}g</td>
        <td>${Math.round(item.fat || 0)}g</td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-sm btn-edit-food" data-id="${item.id}" title="Edit food and macros">✏️ Edit</button>
          <button type="button" class="btn-sm btn-danger btn-delete-food" data-id="${item.id}" title="Delete food entry">✕</button>
        </td>
      </tr>
    `).join('');

    // Edit button handler
    container.querySelectorAll('.btn-edit-food').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        this.openEditFoodModal(id);
      });
    });

    // Double-click row handler
    container.querySelectorAll('tr[data-id]').forEach(row => {
      row.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        const id = row.getAttribute('data-id');
        this.openEditFoodModal(id);
      });
    });

    // Delete button handler
    container.querySelectorAll('.btn-delete-food').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.target.getAttribute('data-id');
        const dateInput = document.getElementById('nutrition-date');
        const date = dateInput ? dateInput.value : FitTrackCalc.formatDateLocal();
        this.store.deleteFoodEntry(id);
        const remainingTotals = this.store.getDailyNutritionTotals(date);
        this.store.saveDailyLog({
          date,
          calories: Math.round(remainingTotals.calories),
          protein: Math.round(remainingTotals.protein * 10) / 10,
          carbs: Math.round(remainingTotals.carbs * 10) / 10,
          fat: Math.round(remainingTotals.fat * 10) / 10
        });
        this.showToast('Food entry removed.', 'info');
        this.renderNutritionView();
        this.renderDashboard();
      });
    });
  }

  initSmartMealChat() {
    // Keep initial state clean and uncluttered without default greeting
  }

  handleSmartMealSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('smart-meal-input');
    const catSelect = document.getElementById('smart-meal-category-select');
    const chatBox = document.getElementById('smart-meal-chat-box');
    if (!input) return;

    const rawText = input.value.trim();
    if (!rawText) {
      this.showToast('Please type your meal details first.', 'warning');
      return;
    }

    const defaultCat = catSelect ? catSelect.value : 'auto';
    const parsedMeal = FitTrackSmartMeal.parseMealText(rawText, defaultCat);

    if (!parsedMeal.items || parsedMeal.items.length === 0) {
      this.showToast('Could not recognize food items. Please specify foods with quantity (e.g. "chicken 200g, rice 100g").', 'warning');
      return;
    }

    const dateInput = document.getElementById('nutrition-date');
    const date = dateInput ? dateInput.value : FitTrackCalc.formatDateLocal();

    // 1. Add each parsed food item to the store
    const createdEntries = [];
    for (const item of parsedMeal.items) {
      const entry = this.store.addFoodEntry({
        date,
        name: item.name,
        serving: item.serving,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        category: item.category || parsedMeal.category || 'snack'
      });
      createdEntries.push(entry);
    }

    // 2. Render clean confirmation & breakdown card in results container
    if (chatBox) {
      chatBox.style.display = 'flex';
      const entryIdsStr = createdEntries.map(e => e.id).join(',');
      const catCapitalized = parsedMeal.category.charAt(0).toUpperCase() + parsedMeal.category.slice(1);

      chatBox.innerHTML = `
        <div class="chat-msg chat-msg-bot" style="max-width: 100%;">
          <div class="chat-bubble">
            <div class="chat-bot-header">
              <span>✓ Meal Logged Successfully for ${date}</span>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="badge-meal-cat">${catCapitalized}</span>
                <button type="button" class="btn-chat-action btn-dismiss-chat" title="Dismiss">✕</button>
              </div>
            </div>
            <div class="chat-items-list">
              ${parsedMeal.items.map(it => `
                <div class="chat-item-row">
                  <div class="item-name-serving">
                    <strong>${this.escapeHTML(it.name)}</strong> <span class="text-muted">(${this.escapeHTML(it.serving)})</span>
                  </div>
                  <div class="item-macros">
                    <span class="m-cal" title="Calories">${Math.round(it.calories)} kcal</span>
                    <span class="m-pro" title="Protein">${it.protein}g P</span>
                    <span class="m-carb" title="Carbs">${it.carbs}g C</span>
                    <span class="m-fat" title="Fat">${it.fat}g F</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="chat-total-banner">
              <span class="total-title">Meal Total:</span>
              <div class="total-macros">
                <span class="badge-total cal">${parsedMeal.totalCalories} kcal</span>
                <span class="badge-total pro">${parsedMeal.totalProtein}g Protein</span>
                <span class="badge-total carb">${parsedMeal.totalCarbs}g Carbs</span>
                <span class="badge-total fat">${parsedMeal.totalFat}g Fat</span>
              </div>
            </div>
            <div class="chat-bot-actions">
              <button type="button" class="btn-chat-action btn-undo-meal" data-entry-ids="${entryIdsStr}">
                ↩️ Undo Meal
              </button>
              <button type="button" class="btn-chat-action btn-fill-form-from-chat" data-category="${parsedMeal.category}" data-calories="${parsedMeal.totalCalories}" data-protein="${parsedMeal.totalProtein}" data-carbs="${parsedMeal.totalCarbs}" data-fat="${parsedMeal.totalFat}" data-name="${this.escapeHTML(parsedMeal.items.map(i => i.name).join(' + '))}">
                📋 Load Total into Manual Form
              </button>
            </div>
          </div>
        </div>
      `;
      chatBox.scrollTop = 0;
    }

    // 3. Clear input
    input.value = '';

    // 4. Auto-sync daily log with new nutrition totals
    this.syncDailyLogNutrition(date, true);

    // 5. Update UI
    this.renderNutritionView();
    this.renderDashboard();

    this.showToast(`Logged ${parsedMeal.items.length} food items (${parsedMeal.totalCalories} kcal, ${parsedMeal.totalProtein}g protein)!`, 'success');
  }

  handleSmartMealFillForm() {
    const input = document.getElementById('smart-meal-input');
    const catSelect = document.getElementById('smart-meal-category-select');
    if (!input) return;

    const rawText = input.value.trim();
    if (!rawText) {
      this.showToast('Please type your meal details above first.', 'warning');
      return;
    }

    const defaultCat = catSelect ? catSelect.value : 'auto';
    const parsedMeal = FitTrackSmartMeal.parseMealText(rawText, defaultCat);

    if (!parsedMeal.items || parsedMeal.items.length === 0) {
      this.showToast('Could not recognize food items to populate form.', 'warning');
      return;
    }

    const nameEl = document.getElementById('food-name');
    const servingEl = document.getElementById('food-serving');
    const catEl = document.getElementById('food-category');
    const calEl = document.getElementById('food-calories');
    const proEl = document.getElementById('food-protein');
    const carbsEl = document.getElementById('food-carbs');
    const fatEl = document.getElementById('food-fat');

    if (nameEl) nameEl.value = parsedMeal.items.map(i => i.name).join(' + ');
    if (servingEl) servingEl.value = parsedMeal.items.map(i => i.serving).join(', ');
    if (catEl) catEl.value = parsedMeal.category || 'lunch';
    if (calEl) calEl.value = parsedMeal.totalCalories;
    if (proEl) proEl.value = parsedMeal.totalProtein;
    if (carbsEl) carbsEl.value = parsedMeal.totalCarbs;
    if (fatEl) fatEl.value = parsedMeal.totalFat;

    const formEl = document.getElementById('form-add-food');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    this.showToast(`Manual form populated below (${parsedMeal.totalCalories} kcal, ${parsedMeal.totalProtein}g P, ${parsedMeal.totalCarbs}g C, ${parsedMeal.totalFat}g F)!`, 'success');
  }

  handleFoodSubmit(e) {
    e.preventDefault();
    const dateInput = document.getElementById('nutrition-date');
    const nameInput = document.getElementById('food-name');
    const servingInput = document.getElementById('food-serving');
    const caloriesInput = document.getElementById('food-calories');
    const proteinInput = document.getElementById('food-protein');
    const carbsInput = document.getElementById('food-carbs');
    const fatInput = document.getElementById('food-fat');
    const categorySelect = document.getElementById('food-category');

    const date = dateInput ? dateInput.value : FitTrackCalc.formatDateLocal();
    const name = nameInput.value.trim();
    const calories = parseFloat(caloriesInput.value);
    const protein = parseFloat(proteinInput.value);

    if (!name || isNaN(calories) || isNaN(protein)) {
      this.showToast('Please enter a food name, calories, and protein.', 'error');
      return;
    }

    if (calories < 0 || protein < 0) {
      this.showToast('Calories and protein cannot be negative.', 'error');
      return;
    }

    this.store.addFoodEntry({
      date,
      name,
      serving: servingInput ? servingInput.value.trim() : '',
      calories,
      protein,
      carbs: parseFloat(carbsInput.value) || 0,
      fat: parseFloat(fatInput.value) || 0,
      category: categorySelect ? categorySelect.value : 'snack'
    });

    this.showToast(`Logged ${name}!`, 'success');
    nameInput.value = '';
    servingInput.value = '';
    caloriesInput.value = '';
    proteinInput.value = '';
    carbsInput.value = '';
    fatInput.value = '';
    this.syncDailyLogNutrition(date, true);
    this.renderNutritionView();
    this.renderDashboard();
  }

  openPresetModal() {
    const modal = document.getElementById('modal-preset');
    if (modal) modal.classList.add('active');
  }

  handlePresetModalSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('preset-name').value.trim();
    const serving = document.getElementById('preset-serving').value.trim();
    const calories = parseFloat(document.getElementById('preset-calories').value);
    const protein = parseFloat(document.getElementById('preset-protein').value);
    const carbs = parseFloat(document.getElementById('preset-carbs').value) || 0;
    const fat = parseFloat(document.getElementById('preset-fat').value) || 0;
    const category = document.getElementById('preset-category').value;

    if (!name || isNaN(calories) || isNaN(protein)) {
      this.showToast('Please provide name, calories, and protein for the preset.', 'error');
      return;
    }

    this.store.saveFoodPreset({ name, serving, calories, protein, carbs, fat, category });
    this.showToast(`Saved preset "${name}"!`, 'success');
    this.closeAllModals();
    document.getElementById('form-preset-modal').reset();
    this.renderNutritionView();
  }

  openEditFoodModal(id) {
    const entry = this.store.getFoodEntry(id);
    if (!entry) {
      this.showToast('Food entry not found.', 'error');
      return;
    }

    const modal = document.getElementById('modal-edit-food');
    const idInput = document.getElementById('edit-food-id');
    const dateInput = document.getElementById('edit-food-date');
    const nameInput = document.getElementById('edit-food-name');
    const servingInput = document.getElementById('edit-food-serving');
    const catInput = document.getElementById('edit-food-category');
    const calInput = document.getElementById('edit-food-calories');
    const proInput = document.getElementById('edit-food-protein');
    const carbsInput = document.getElementById('edit-food-carbs');
    const fatInput = document.getElementById('edit-food-fat');

    if (idInput) idInput.value = entry.id;
    if (dateInput) dateInput.value = entry.date;
    if (nameInput) nameInput.value = entry.name || '';
    if (servingInput) servingInput.value = entry.serving || '';
    if (catInput) catInput.value = entry.category || 'snack';
    if (calInput) calInput.value = entry.calories !== undefined ? entry.calories : '';
    if (proInput) proInput.value = entry.protein !== undefined ? entry.protein : '';
    if (carbsInput) carbsInput.value = entry.carbs !== undefined ? entry.carbs : '';
    if (fatInput) fatInput.value = entry.fat !== undefined ? entry.fat : '';

    if (modal) {
      modal.classList.add('active');
      setTimeout(() => {
        if (calInput) calInput.focus();
      }, 50);
    }
  }

  handleEditFoodSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-food-id')?.value;
    const date = document.getElementById('edit-food-date')?.value || FitTrackCalc.formatDateLocal();
    const name = document.getElementById('edit-food-name')?.value.trim();
    const serving = document.getElementById('edit-food-serving')?.value.trim();
    const category = document.getElementById('edit-food-category')?.value || 'snack';
    const calories = parseFloat(document.getElementById('edit-food-calories')?.value);
    const protein = parseFloat(document.getElementById('edit-food-protein')?.value);
    const carbs = parseFloat(document.getElementById('edit-food-carbs')?.value) || 0;
    const fat = parseFloat(document.getElementById('edit-food-fat')?.value) || 0;

    if (!id) {
      this.showToast('Missing entry identifier.', 'error');
      return;
    }

    if (!name || isNaN(calories) || isNaN(protein)) {
      this.showToast('Please provide food name, calories, and protein.', 'error');
      return;
    }

    if (calories < 0 || protein < 0 || carbs < 0 || fat < 0) {
      this.showToast('Nutritional values cannot be negative.', 'error');
      return;
    }

    const updated = this.store.updateFoodEntry({
      id,
      date,
      name,
      serving,
      category,
      calories,
      protein,
      carbs,
      fat
    });

    if (updated) {
      this.syncDailyLogNutrition(date, true);
      this.closeAllModals();
      this.renderNutritionView();
      this.renderDashboard();
      this.showToast(`Updated "${name}" (${Math.round(calories)} kcal, ${Math.round(protein)}g P)! Dashboard synchronized.`, 'success');
    } else {
      this.showToast('Failed to update food entry.', 'error');
    }
  }

  // --- 5.1 BODY MEASUREMENTS & ANTHROPOMETRICS SUB-VIEW ---

  renderMeasurementsView() {
    const dateInput = document.getElementById('measurement-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = FitTrackCalc.formatDateLocal();
    }

    this.renderMeasurementsHistoryTable();
    FitTrackCharts.renderBodyFatAndWaistChart('chart-measurements-trends', this.store.data.measurements);
  }

  handleMeasurementSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('measurement-date').value;
    const weight = parseFloat(document.getElementById('measurement-weight').value);
    const bodyFat = parseFloat(document.getElementById('measurement-bf').value);
    const waist = parseFloat(document.getElementById('measurement-waist').value);
    const chest = parseFloat(document.getElementById('measurement-chest').value);
    const arms = parseFloat(document.getElementById('measurement-arms').value);
    const hips = parseFloat(document.getElementById('measurement-hips').value);
    const thighs = parseFloat(document.getElementById('measurement-thighs').value);
    const notes = document.getElementById('measurement-notes').value.trim();

    if (!date) {
      this.showToast('Please enter a measurement date.', 'error');
      return;
    }

    if (isNaN(weight) && isNaN(waist) && isNaN(bodyFat)) {
      this.showToast('Please enter at least weight, body fat, or waist circumference.', 'error');
      return;
    }

    this.store.recordMeasurement({
      date,
      weight: !isNaN(weight) && weight > 0 ? weight : null,
      bodyFat: !isNaN(bodyFat) && bodyFat > 0 ? bodyFat : null,
      waist: !isNaN(waist) && waist > 0 ? waist : null,
      chest: !isNaN(chest) && chest > 0 ? chest : null,
      arms: !isNaN(arms) && arms > 0 ? arms : null,
      hips: !isNaN(hips) && hips > 0 ? hips : null,
      thighs: !isNaN(thighs) && thighs > 0 ? thighs : null,
      notes
    });

    this.showToast('Body measurement saved!', 'success');
    document.getElementById('form-measurement').reset();
    document.getElementById('measurement-date').value = FitTrackCalc.formatDateLocal();
    this.render();
  }

  renderMeasurementsHistoryTable() {
    const container = document.getElementById('table-measurements-body');
    if (!container) return;

    const measurements = [...this.store.data.measurements].sort((a, b) => b.date.localeCompare(a.date));
    if (measurements.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No measurements recorded yet.</td></tr>`;
      return;
    }

    container.innerHTML = measurements.map(m => `
      <tr>
        <td><strong>${m.date}</strong></td>
        <td>${m.weight ? m.weight + ' kg' : '-'}</td>
        <td>${m.bodyFat ? m.bodyFat + '%' : '-'}</td>
        <td>${m.waist ? m.waist + ' cm' : '-'}</td>
        <td>${m.chest ? m.chest + ' cm' : '-'}</td>
        <td>${m.arms ? m.arms + ' cm' : '-'}</td>
        <td>
          <button class="btn-sm btn-danger btn-delete-meas" data-id="${m.id || m.date}">✕</button>
        </td>
      </tr>
    `).join('');

    container.querySelectorAll('.btn-delete-meas').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        this.confirmDialog('Delete this measurement entry?', () => {
          this.store.deleteMeasurement(id);
          this.showToast('Measurement deleted.', 'info');
          this.render();
        });
      });
    });
  }

  // --- 5. PROGRESS & SCIENTIFIC BODY RECOMPOSITION ANALYSIS ---

  renderProgressView() {
    const container = document.getElementById('progress-analysis-container');
    if (!container) return;

    const data = this.store.data;
    const measurements = [...data.measurements].sort((a, b) => a.date.localeCompare(b.date));
    const profile = data.profile || {};
    const curWeight = measurements.length > 0 ? measurements[measurements.length - 1].weight : (profile.weight || 75);
    const startWeight = measurements.length > 0 ? measurements[0].weight : (profile.weight || 75);
    const weightDiff = Math.round((curWeight - startWeight) * 10) / 10;
    const curBf = profile.bodyFat || 22;
    const targetBf = profile.targetBodyFat || 10;
    const recomp = FitTrackCalc.calculateBodyRecomposition(curWeight, curBf, targetBf);
    const weekWorkoutsCount = this.calculateWorkoutsThisWeek();
    const streaks = FitTrackCalc.calculateStreaks(data.dailyLogs, FitTrackCalc.formatDateLocal());

    container.innerHTML = `
      <div class="card mb-4 recomp-roadmap-card">
        <div class="recomp-header">
          <div class="recomp-title-group">
            <span class="recomp-badge">📊 Body Recomposition Overview</span>
            <h3 class="recomp-title">${profile.primaryGoal || 'Fat Loss & Strength Retention'}</h3>
          </div>
          <button type="button" class="btn btn-sm btn-outline btn-open-bf-modal" id="btn-open-bf-modal-prog">
            📷 3D Torso Comparison Chart
          </button>
        </div>
        <div class="recomp-stats-grid">
          <div class="recomp-stat">
            <span class="recomp-stat-label">Current Weight</span>
            <span class="recomp-stat-val text-accent-blue">${curWeight} kg</span>
            <small class="text-muted">Start: ${startWeight} kg (${weightDiff > 0 ? '+' : ''}${weightDiff} kg)</small>
          </div>
          <div class="recomp-stat">
            <span class="recomp-stat-label">Target Goal Weight</span>
            <span class="recomp-stat-val text-accent-green">${recomp.targetWeight} kg</span>
            <small class="text-muted">At ${recomp.targetBF}% Target Body Fat</small>
          </div>
          <div class="recomp-stat">
            <span class="recomp-stat-label">Fat to Shed</span>
            <span class="recomp-stat-val text-accent-orange">${recomp.fatMassToLose} kg</span>
            <small class="text-muted">Pure adipose tissue</small>
          </div>
          <div class="recomp-stat">
            <span class="recomp-stat-label">Preserved Lean Mass</span>
            <span class="recomp-stat-val text-accent-purple">${recomp.leanBodyMass} kg LBM</span>
            <small class="text-muted">Muscle & skeletal tissue</small>
          </div>
          <div class="recomp-stat">
            <span class="recomp-stat-label">Est. Recomp Timeline</span>
            <span class="recomp-stat-val text-accent-cyan">~${recomp.estimatedWeeks} Weeks</span>
            <small class="text-muted">Safe rate: ~0.5 kg/week</small>
          </div>
          <div class="recomp-stat">
            <span class="recomp-stat-label">Current Consistency</span>
            <span class="recomp-stat-val text-accent-green">${streaks.currentStreak} Days</span>
            <small class="text-muted">${weekWorkoutsCount} workouts this week</small>
          </div>
        </div>
        <div class="recomp-progress-bar-wrap mt-3">
          <div class="recomp-progress-bar-labels">
            <span>Body Composition Goal Progress</span>
            <span>${recomp.progressPercent}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill progress-fill-lime" style="width: ${recomp.progressPercent}%;"></div>
          </div>
        </div>
      </div>

      <!-- Recent Measurement History Table -->
      <div class="card mb-4">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 class="card-title" style="margin: 0;">Recent Check-ins & Body Measurements</h3>
          <span class="text-sm text-secondary">${measurements.length} logged entries</span>
        </div>
        ${measurements.length === 0 ? `
          <div class="empty-state-card" style="padding: 1.5rem; text-align: center;">
            <p class="text-muted">No measurements logged yet. Use the morning weight check-in on the dashboard or log a check-in below!</p>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table-custom">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight (kg)</th>
                  <th>Body Fat %</th>
                  <th>Notes</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${measurements.slice(-10).reverse().map((m) => `
                  <tr>
                    <td><strong>${m.date}</strong></td>
                    <td class="text-accent-blue font-weight-bold">${m.weight} kg</td>
                    <td>${m.bodyFat ? m.bodyFat + '%' : '<span class="text-muted">--</span>'}</td>
                    <td class="text-sm text-secondary">${m.notes || 'Check-in'}</td>
                    <td style="text-align: right;">
                      <button type="button" class="btn-icon text-danger btn-delete-meas-entry" data-date="${m.date}" title="Delete this measurement entry">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    // Re-bind modal opener inside progress view
    const progBfBtn = document.getElementById('btn-open-bf-modal-prog');
    if (progBfBtn) {
      progBfBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-bf-chart');
        if (modal) {
          this._bfModalContext = 'dashboard';
          modal.classList.add('active');
        }
      });
    }

    // Bind delete buttons for measurement entries
    container.querySelectorAll('.btn-delete-meas-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dateToDelete = e.currentTarget.getAttribute('data-date');
        if (!dateToDelete) return;
        this.store.data.measurements = this.store.data.measurements.filter(m => m.date !== dateToDelete);
        this.store.saveData();
        this.showToast(`Deleted measurement record for ${dateToDelete}.`, 'info');
        this.renderProgressView();
      });
    });

    // Render Full History Progress Chart
    FitTrackCharts.renderWeightTrendChart('chart-progress-full-weight', measurements, 'all');
  }

  // --- 6. GOALS & WEEKLY REVIEW ---

  renderGoalsView() {
    const goals = this.store.data.goals;
    const profile = this.store.data.profile;

    // Populate inputs
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };

    setVal('goal-calories', goals.dailyCalories);
    setVal('goal-protein', goals.dailyProtein);
    setVal('goal-carbs', goals.dailyCarbs);
    setVal('goal-fat', goals.dailyFat);
    setVal('goal-water', goals.dailyWaterMl);
    setVal('goal-sleep', goals.dailySleepHours);
    setVal('goal-workouts', goals.weeklyWorkouts);

    // Render Weekly Review
    this.renderWeeklyReview();
  }

  handleGoalsSubmit(e) {
    e.preventDefault();
    const calories = parseInt(document.getElementById('goal-calories').value, 10);
    const protein = parseInt(document.getElementById('goal-protein').value, 10);
    const carbs = parseInt(document.getElementById('goal-carbs').value, 10);
    const fat = parseInt(document.getElementById('goal-fat').value, 10);
    const water = parseInt(document.getElementById('goal-water').value, 10);
    const sleep = parseFloat(document.getElementById('goal-sleep').value);
    const workouts = parseInt(document.getElementById('goal-workouts').value, 10);

    if (calories < 1200) {
      this.showToast('Daily calories cannot be set dangerously low (< 1200 kcal).', 'error');
      return;
    }

    this.store.data.goals = {
      dailyCalories: calories,
      dailyProtein: protein,
      dailyCarbs: carbs,
      dailyFat: fat,
      dailyWaterMl: water,
      dailySleepHours: sleep,
      weeklyWorkouts: workouts
    };

    this.store.saveData();
    this.showToast('Goals updated successfully!', 'success');
    this.render();
  }

  applySuggestedTargets() {
    const calculated = FitTrackCalc.calculateTargets(this.store.data.profile);
    
    document.getElementById('goal-calories').value = calculated.targetCalories;
    document.getElementById('goal-protein').value = calculated.proteinGrams;
    document.getElementById('goal-carbs').value = calculated.carbsGrams;
    document.getElementById('goal-fat').value = calculated.fatGrams;

    const explainer = document.getElementById('suggested-targets-explainer');
    if (explainer) {
      explainer.innerHTML = `
        <div class="alert-box info mt-3">
          <strong>Mifflin-St Jeor Formula Breakdown:</strong>
          <ul>
            <li>Calculated BMR: <strong>${calculated.bmr} kcal/day</strong></li>
            <li>Estimated TDEE (1.6x 6-day training multiplier): <strong>${calculated.tdee} kcal/day</strong></li>
            <li>Recommended Deficit: <strong>-${calculated.deficitKcal} kcal</strong> (~18% moderate cut for muscle retention)</li>
            <li>Recommended Calories: <strong>${calculated.targetCalories} kcal/day</strong></li>
            <li>Recommended Protein: <strong>${calculated.proteinGrams} g/day</strong> (Range: ${calculated.proteinRangeMin}g - ${calculated.proteinRangeMax}g)</li>
          </ul>
          <p class="text-sm">Click "Save Goals" to commit these science-backed numbers to your profile.</p>
        </div>
      `;
    }

    this.showToast('Evidence-informed targets applied to form. Click Save Goals to commit.', 'info');
  }

  renderWeeklyReview() {
    const container = document.getElementById('weekly-review-card');
    if (!container) return;

    // Calculate current week stats
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const mondayStr = FitTrackCalc.formatDateLocal(monday);

    // Prev week monday
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevMondayStr = FitTrackCalc.formatDateLocal(prevMonday);

    const thisWeekLogs = this.store.data.dailyLogs.filter(l => l.date >= mondayStr);
    const prevWeekLogs = this.store.data.dailyLogs.filter(l => l.date >= prevMondayStr && l.date < mondayStr);

    const thisWeekWeights = thisWeekLogs.filter(l => l.weight).map(l => l.weight);
    const prevWeekWeights = prevWeekLogs.filter(l => l.weight).map(l => l.weight);

    const avgWeightThisWeek = thisWeekWeights.length > 0 ? Math.round((thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length) * 10) / 10 : null;
    const avgWeightPrevWeek = prevWeekWeights.length > 0 ? Math.round((prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length) * 10) / 10 : null;

    const weightDeltaWeek = (avgWeightThisWeek && avgWeightPrevWeek) ? Math.round((avgWeightThisWeek - avgWeightPrevWeek) * 10) / 10 : null;

    const completedWorkoutsThisWeek = this.calculateWorkoutsThisWeek();
    const targetWorkouts = this.store.data.goals.weeklyWorkouts || 6;

    container.innerHTML = `
      <div class="weekly-review-content">
        <h3>Weekly Review (${mondayStr} to Today)</h3>
        <div class="weekly-metrics-grid">
          <div class="review-metric-box">
            <span class="rev-label">Average Weight This Week</span>
            <span class="rev-val">${avgWeightThisWeek ? avgWeightThisWeek + ' kg' : 'Need more logs'}</span>
            <small class="text-muted">${weightDeltaWeek !== null ? (weightDeltaWeek > 0 ? '+' : '') + weightDeltaWeek + ' kg vs last week' : 'No prev week baseline'}</small>
          </div>
          <div class="review-metric-box">
            <span class="rev-label">Workouts Completed</span>
            <span class="rev-val text-accent-green">${completedWorkoutsThisWeek} / ${targetWorkouts}</span>
            <small class="text-muted">${completedWorkoutsThisWeek >= targetWorkouts ? 'Goal achieved! 🎉' : `${targetWorkouts - completedWorkoutsThisWeek} remaining`}</small>
          </div>
          <div class="review-metric-box">
            <span class="rev-label">Logging Consistency</span>
            <span class="rev-val text-accent-blue">${thisWeekLogs.filter(l => l.completed).length} / 7 days</span>
            <small class="text-muted">Daily log streak check</small>
          </div>
        </div>
      </div>
    `;
  }

  // --- 7. PROFILE & SETTINGS ---

  renderSettingsView() {
    const profile = this.store.data.profile;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };

    setVal('prof-age', profile.age);
    setVal('prof-sex', profile.sex);
    setVal('prof-height', profile.height);
    setVal('prof-weight', profile.weight);
    setVal('prof-bf', profile.bodyFat);
    setVal('prof-training', profile.trainingFrequency);
    setVal('prof-activity', profile.activityLevel);
    setVal('prof-primary-goal', profile.primaryGoal);
    setVal('prof-secondary-goal', profile.secondaryGoal);
    setVal('prof-constraint', profile.constraint);

    // Current Body Fat % dropdown & custom input sync
    const curBf = profile.bodyFat;
    const targetBf = profile.targetBodyFat || 10;
    const bfSelect = document.getElementById('prof-bf-select');
    const bfInput = document.getElementById('prof-bf');
    if (bfSelect && bfInput) {
      if (curBf !== null && curBf !== undefined && curBf !== '') {
        const match = Array.from(bfSelect.options).some(o => o.value === String(curBf));
        if (match) {
          bfSelect.value = String(curBf);
          bfInput.style.display = 'none';
          bfInput.value = curBf;
        } else {
          bfSelect.value = 'custom';
          bfInput.style.display = 'block';
          bfInput.value = curBf;
        }
      } else {
        bfSelect.value = '22';
        bfInput.style.display = 'none';
        bfInput.value = 22;
      }
    }

    // Target Achievable Body Fat % dropdown & custom input sync
    const targetBfSelect = document.getElementById('prof-target-bf-select');
    const targetBfInput = document.getElementById('prof-target-bf');
    if (targetBfSelect && targetBfInput) {
      const match = Array.from(targetBfSelect.options).some(o => o.value === String(targetBf));
      if (match) {
        targetBfSelect.value = String(targetBf);
        targetBfInput.style.display = 'none';
        targetBfInput.value = targetBf;
      } else {
        targetBfSelect.value = 'custom';
        targetBfInput.style.display = 'block';
        targetBfInput.value = targetBf;
      }
    }
  }

  handleProfileSubmit(e) {
    e.preventDefault();
    const age = parseInt(document.getElementById('prof-age').value, 10);
    const sex = document.getElementById('prof-sex').value;
    const height = parseFloat(document.getElementById('prof-height').value);
    const weight = parseFloat(document.getElementById('prof-weight').value);
    
    const bfSelectVal = document.getElementById('prof-bf-select')?.value;
    const bfInputVal = parseFloat(document.getElementById('prof-bf')?.value);
    const bodyFat = bfSelectVal === 'custom' ? bfInputVal : parseFloat(bfSelectVal);

    const targetBfSelectVal = document.getElementById('prof-target-bf-select')?.value;
    const targetBfInputVal = parseFloat(document.getElementById('prof-target-bf')?.value);
    const targetBodyFat = targetBfSelectVal === 'custom' ? targetBfInputVal : parseFloat(targetBfSelectVal);

    const trainingFrequency = parseInt(document.getElementById('prof-training').value, 10) || 4;
    const activityLevel = document.getElementById('prof-activity').value || '1.375';
    const primaryGoal = document.getElementById('prof-primary-goal').value.trim();
    const secondaryGoal = document.getElementById('prof-secondary-goal').value.trim();
    const constraint = document.getElementById('prof-constraint').value.trim();

    if (!age || !height || !weight || isNaN(age) || isNaN(height) || isNaN(weight) || age <= 0 || height <= 0 || weight <= 0) {
      this.showToast('Please provide valid age, height, and weight numbers.', 'error');
      return;
    }

    // Determine goal key based on primary goal text
    let goalKey = 'fat_loss';
    const pLower = (primaryGoal || '').toLowerCase();
    if (pLower.includes('fat') || pLower.includes('cut') || pLower.includes('lose') || pLower.includes('lean') || pLower.includes('abs') || pLower.includes('six-pack')) {
      goalKey = 'fat_loss';
    } else if (pLower.includes('gain') || pLower.includes('hypertrophy') || pLower.includes('bulk')) {
      goalKey = 'muscle_gain';
    } else if (pLower.includes('maintain') || pLower.includes('recomp')) {
      goalKey = 'maintenance';
    }

    const curBfVal = !isNaN(bodyFat) && bodyFat > 0 ? bodyFat : 22;
    const targetBfVal = !isNaN(targetBodyFat) && targetBodyFat > 0 ? targetBodyFat : 10;
    const recomp = FitTrackCalc.calculateBodyRecomposition(weight, curBfVal, targetBfVal);

    this.store.data.profile = {
      ...this.store.data.profile,
      age,
      sex,
      height,
      weight,
      bodyFat: curBfVal,
      targetBodyFat: targetBfVal,
      targetWeight: recomp.targetWeight,
      trainingFrequency,
      activityLevel,
      primaryGoal: primaryGoal || 'Lose body fat and develop visible six-pack abs',
      goal: goalKey,
      secondaryGoal,
      constraint,
      hasOnboarded: true
    };

    // Recalculate personalized targets from fresh user information
    const targets = FitTrackCalc.calculateTargets(this.store.data.profile);
    const waterTarget = Math.round(weight * 35);

    this.store.data.goals = {
      ...this.store.data.goals,
      dailyCalories: targets.targetCalories,
      dailyProtein: targets.proteinGrams,
      dailyCarbs: targets.carbsGrams,
      dailyFat: targets.fatGrams,
      dailyWaterMl: waterTarget,
      weeklyWorkouts: trainingFrequency,
      targetBodyFat: targetBfVal,
      targetWeight: recomp.targetWeight
    };

    // Record or update today's measurement so latestMeasurement is synchronized
    const todayStr = FitTrackCalc.formatDateLocal();
    this.store.recordMeasurement({
      date: todayStr,
      weight,
      bodyFat: curBfVal,
      notes: 'Profile Update & Recalibration'
    });

    this.store.saveData();
    this.showToast(`🎉 Profile saved & goals recalculated! Targets: ${targets.targetCalories} kcal · ${targets.proteinGrams}g protein · ${waterTarget}ml water`, 'success');
    this.render();
  }

  // --- BACKUP, RESTORE & DATA MANAGEMENT ---

  exportBackupJSON() {
    const jsonStr = this.store.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittrack-backup-${FitTrackCalc.formatDateLocal()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('JSON Backup downloaded!', 'success');
  }

  handleJSONImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      this.confirmDialog('Importing backup will merge/replace your local data. Proceed?', () => {
        const result = this.store.importJSON(content);
        if (result.success) {
          this.showToast(result.message, 'success');
          this.render();
        } else {
          this.showToast(result.message, 'error');
        }
      });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  }

  downloadCSV(type, filename) {
    const csvContent = this.store.exportCSV(type);
    if (!csvContent) {
      this.showToast('No records available to export for ' + type, 'info');
      return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`${filename} exported successfully!`, 'success');
  }

  confirmResetData() {
    this.confirmDialog(
      'Are you sure you want to completely reset all FitTrack data? All historical logs, meals, workouts, and profile numbers will be cleared so you can enter fresh information and recalculate your personalized goals.',
      () => {
        this.store.resetData(true);
        this.showToast('All FitTrack data has been reset! Please enter your details below to set up your fresh goals.', 'info');
        this.render();
        this.openOnboardingModal();
      }
    );
  }

  // --- 8. ADMIN & SECURITY VAULT ---

  renderAdminView() {
    const isConfigured = FitTrackVault.isVaultConfigured();
    const statusBadge = document.getElementById('badge-vault-status');
    const groupCurrent = document.getElementById('group-current-password');
    const labelPass = document.getElementById('label-admin-pass');
    const disableBtn = document.getElementById('btn-disable-vault');
    const autoLockSelect = document.getElementById('select-auto-lock');
    const autoGoalCheck = document.getElementById('check-auto-goal-adjust');

    if (statusBadge) {
      if (isConfigured) {
        statusBadge.className = 'status-badge success';
        statusBadge.innerHTML = '● AES-256-GCM Active (PBKDF2 100k rounds)';
      } else {
        statusBadge.className = 'status-badge warning';
        statusBadge.innerHTML = '⚠️ Vault Unencrypted';
      }
    }

    if (groupCurrent) {
      groupCurrent.style.display = isConfigured ? 'block' : 'none';
    }

    if (labelPass) {
      labelPass.textContent = isConfigured ? 'New Master Passphrase' : 'Set Master Passphrase';
    }

    if (disableBtn) {
      disableBtn.style.display = isConfigured ? 'inline-flex' : 'none';
    }

    if (autoLockSelect) {
      autoLockSelect.value = String(FitTrackVault.autoLockMinutes || 15);
    }

    if (autoGoalCheck) {
      autoGoalCheck.checked = this.store.data.goals.autoGoalAdjust !== false;
    }

    // Render User Management Table
    this.renderAdminUsersTable();
  }

  renderAdminUsersTable() {
    const tbody = document.getElementById('table-admin-users-body');
    if (!tbody) return;

    const users = FitTrackAuth.getUsers();
    const current = FitTrackAuth.getSession();

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No users found. Administrator first-time setup pending.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isCurrent = current && current.userId === u.id;
      const roleBadge = u.role === 'admin'
        ? `<span class="role-pill admin">👑 Administrator</span>`
        : `<span class="role-pill user">👤 Member</span>`;
      const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Initial Setup';
      const deleteDisabled = isCurrent || (u.role === 'admin' && users.filter(x => x.role === 'admin').length <= 1);

      return `
        <tr>
          <td><strong>${this.escapeHTML(u.username)}</strong> ${isCurrent ? '<small class="text-muted">(You)</small>' : ''}</td>
          <td>${roleBadge}</td>
          <td><span class="status-badge success">Active</span></td>
          <td>${dateStr}</td>
          <td>
            <button type="button" class="btn-delete-user" data-user-id="${u.id}" ${deleteDisabled ? 'disabled title="Cannot delete current or primary administrator"' : ''}>
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire delete buttons
    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.currentTarget.getAttribute('data-user-id');
        this.confirmDialog('Are you sure you want to delete this user account? All access for this user will be revoked.', () => {
          const res = FitTrackAuth.deleteUserByAdmin(userId);
          if (res.success) {
            this.showToast('User account deleted successfully.', 'info');
            this.renderAdminUsersTable();
          } else {
            this.showToast(res.message, 'error');
          }
        });
      });
    });
  }

  // --- 9. LOGIN & AUTHENTICATION VIEW ---

  renderLoginView() {
    const isAuth = FitTrackAuth.isAuthenticated();
    const hasAdmin = FitTrackAuth.hasAdminUser();

    const standardCard = document.getElementById('card-standard-login');
    const setupCard = document.getElementById('card-first-time-setup');
    const activeBox = document.getElementById('login-active-session-box');
    const feedbackAlert = document.getElementById('login-feedback-alert');

    if (feedbackAlert) feedbackAlert.style.display = 'none';

    if (isAuth) {
      if (standardCard) standardCard.style.display = 'none';
      if (setupCard) setupCard.style.display = 'none';
      if (activeBox) {
        activeBox.style.display = 'block';
        const user = FitTrackAuth.getCurrentUser();
        const activeText = document.getElementById('active-user-session-text');
        if (activeText && user) {
          activeText.textContent = `✓ Signed in as ${user.username} (${user.role === 'admin' ? 'Administrator' : 'Member'})`;
        }
      }
    } else {
      if (activeBox) activeBox.style.display = 'none';
      // Security enforcement: Standard login is ALWAYS shown by default
      // First-time setup card is never exposed to unauthenticated visitors
      if (setupCard) setupCard.style.display = 'none';
      if (standardCard) standardCard.style.display = 'block';
    }
  }

  renderLockedGateView() {
    this.renderLoginView();
  }

  async unlockSession(password) {
    const res = await FitTrackVault.unlock(password);
    if (res.success) {
      await this.store.loadEncryptedData();
      this.showToast('Vault unlocked successfully! Welcome back.', 'success');
      this.navigate('dashboard');
      this.render();
      return true;
    } else {
      this.showToast(res.message || 'Incorrect Master Passphrase.', 'error');
      return false;
    }
  }

  lockSession(reason = 'Session locked.') {
    if (this.store) {
      try {
        this.store.saveData();
        this.store.backupCurrentUserData();
      } catch (e) {}
    }
    FitTrackAuth.logout();
    FitTrackVault.lock();
    this.store.switchUser(null);
    const modalOnboard = document.getElementById('modal-onboarding');
    if (modalOnboard) modalOnboard.classList.remove('active');
    document.body.classList.add('auth-locked');
    this.showToast(reason, 'info');
    this.navigate('login');
    this.renderHeaderUserStatus();
  }

  togglePrivacyMode() {
    FitTrackVault.privacyMode = !FitTrackVault.privacyMode;
    const isActive = !!FitTrackVault.privacyMode;
    localStorage.setItem('fittrack_stealth_mode', isActive ? 'true' : 'false');
    document.body.classList.toggle('privacy-camo-active', isActive);
    
    const stealthBtns = document.querySelectorAll('.btn-toggle-stealth, #btn-sidebar-privacy, #btn-header-privacy, #btn-admin-toggle-camo, #btn-toggle-privacy');
    stealthBtns.forEach(btn => {
      if (btn.id === 'btn-header-privacy') {
        btn.textContent = isActive ? '👁️' : '🕶️';
      } else {
        btn.innerHTML = isActive ? '👁️ Exit Stealth' : '🕶️ Stealth Mode';
        btn.classList.toggle('btn-primary', isActive);
        btn.classList.toggle('btn-outline', !isActive);
      }
    });

    this.showToast(isActive ? '🕶️ Stealth Mode Active: Sensitive health & weight numbers blurred.' : '👁️ Stealth Mode Disabled: Numbers visible.', 'info');
  }

  adjustTodayWater(deltaMl) {
    const todayStr = (this.store && typeof this.store.getTodayString === 'function')
      ? this.store.getTodayString()
      : FitTrackCalc.formatDateLocal();
    let todayLog = this.store.getDailyLog(todayStr);
    if (!todayLog) {
      todayLog = {
        date: todayStr,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        waterMl: 0,
        workoutStatus: 'rest',
        completed: false
      };
    }
    const current = parseInt(todayLog.waterMl, 10) || 0;
    const nextVal = Math.max(0, current + deltaMl);
    todayLog.waterMl = nextVal;
    this.store.saveDailyLog(todayLog);
    this.renderDashboard();

    const formWaterInput = document.getElementById('log-water');
    if (formWaterInput) {
      formWaterInput.value = nextVal;
    }

    const sign = deltaMl > 0 ? '+' : '';
    this.showToast(`Hydration: ${nextVal} ml (${sign}${deltaMl} ml)`, 'success');
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${this.escapeHTML(message)}</span>
      <button class="toast-close">✕</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  confirmDialog(message, onConfirm) {
    const modal = document.getElementById('modal-confirm');
    const msgEl = document.getElementById('modal-confirm-message');
    const okBtn = document.getElementById('btn-modal-confirm-ok');

    if (!modal || !msgEl || !okBtn) {
      if (window.confirm(message)) onConfirm();
      return;
    }

    msgEl.textContent = message;
    modal.classList.add('active');

    const handleOk = () => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', handleOk);
      onConfirm();
    };

    okBtn.addEventListener('click', handleOk);
  }

  // --- 10. ONBOARDING WIZARD & PERSONALIZED TARGET ENGINE ---

  openOnboardingModal() {
    const modal = document.getElementById('modal-onboarding');
    if (!modal) return;

    const currentUser = FitTrackAuth.getCurrentUser();
    const nameInput = document.getElementById('onboard-name');
    const ageInput = document.getElementById('onboard-age');
    const sexInput = document.getElementById('onboard-sex');
    const heightInput = document.getElementById('onboard-height');
    const weightInput = document.getElementById('onboard-weight');
    const bfSelect = document.getElementById('onboard-bf-select');
    const bfInput = document.getElementById('onboard-bf');
    const targetBfSelect = document.getElementById('onboard-target-bf-select');
    const targetBfInput = document.getElementById('onboard-target-bf');
    const goalInput = document.getElementById('onboard-goal');
    const actInput = document.getElementById('onboard-activity');

    const profile = this.store.data.profile || {};
    const isAlreadyOnboarded = !!profile.hasOnboarded;

    if (nameInput) nameInput.value = currentUser?.displayName || currentUser?.username || (isAlreadyOnboarded ? profile.name : '') || '';
    if (ageInput) ageInput.value = (isAlreadyOnboarded && profile.age) ? profile.age : '';
    if (sexInput) sexInput.value = profile.sex || 'male';
    if (heightInput) heightInput.value = (isAlreadyOnboarded && profile.height) ? profile.height : '';
    if (weightInput) weightInput.value = (isAlreadyOnboarded && profile.weight) ? profile.weight : '';
    
    // Sync Current Body Fat Select
    const curBf = profile.bodyFat;
    if (bfSelect && bfInput) {
      if (curBf !== null && curBf !== undefined && curBf !== '') {
        const match = Array.from(bfSelect.options).some(o => o.value === String(curBf));
        if (match) {
          bfSelect.value = String(curBf);
          bfInput.style.display = 'none';
          bfInput.value = curBf;
        } else {
          bfSelect.value = 'custom';
          bfInput.style.display = 'block';
          bfInput.value = curBf;
        }
      } else {
        bfSelect.value = '22';
        bfInput.style.display = 'none';
        bfInput.value = 22;
      }
    }

    // Sync Target Body Fat Select
    const targetBf = profile.targetBodyFat || 10;
    if (targetBfSelect && targetBfInput) {
      const match = Array.from(targetBfSelect.options).some(o => o.value === String(targetBf));
      if (match) {
        targetBfSelect.value = String(targetBf);
        targetBfInput.style.display = 'none';
        targetBfInput.value = targetBf;
      } else {
        targetBfSelect.value = 'custom';
        targetBfInput.style.display = 'block';
        targetBfInput.value = targetBf;
      }
    }

    if (goalInput) goalInput.value = profile.goal || 'fat_loss';
    if (actInput) actInput.value = profile.activityLevel || '1.375';

    this.updateOnboardingPreview();
    modal.classList.add('active');
  }

  updateOnboardingPreview() {
    const weight = parseFloat(document.getElementById('onboard-weight')?.value);
    const height = parseFloat(document.getElementById('onboard-height')?.value);
    const age = parseInt(document.getElementById('onboard-age')?.value, 10);
    const sex = document.getElementById('onboard-sex')?.value || 'male';
    const goal = document.getElementById('onboard-goal')?.value || 'fat_loss';
    const activity = parseFloat(document.getElementById('onboard-activity')?.value) || 1.375;

    const bfSelect = document.getElementById('onboard-bf-select')?.value;
    const bfInputVal = parseFloat(document.getElementById('onboard-bf')?.value);
    const currentBf = bfSelect === 'custom' ? bfInputVal : parseFloat(bfSelect);
    const validCurrentBf = (!isNaN(currentBf) && currentBf > 0) ? currentBf : 22;

    const targetBfSelect = document.getElementById('onboard-target-bf-select')?.value;
    const targetBfInputVal = parseFloat(document.getElementById('onboard-target-bf')?.value);
    const targetBf = targetBfSelect === 'custom' ? targetBfInputVal : parseFloat(targetBfSelect);
    const validTargetBf = (!isNaN(targetBf) && targetBf > 0) ? targetBf : 10;

    const bmrEl = document.getElementById('onboard-preview-bmr');
    const tdeeEl = document.getElementById('onboard-preview-tdee');
    const calEl = document.getElementById('onboard-preview-cal');
    const proEl = document.getElementById('onboard-preview-pro');
    const waterEl = document.getElementById('onboard-preview-water');
    const targetWeightEl = document.getElementById('onboard-preview-target-weight');
    const fatLossEl = document.getElementById('onboard-preview-fat-loss');
    const timelineEl = document.getElementById('onboard-preview-timeline');

    // If numbers are not entered yet, show clean placeholder dashes
    if (!weight || !height || !age || isNaN(weight) || isNaN(height) || isNaN(age) || weight <= 0 || height <= 0 || age <= 0) {
      if (bmrEl) bmrEl.textContent = '-- kcal';
      if (tdeeEl) tdeeEl.textContent = '-- kcal';
      if (calEl) calEl.textContent = '-- kcal';
      if (proEl) proEl.textContent = '-- g';
      if (waterEl) waterEl.textContent = '-- ml';
      if (targetWeightEl) targetWeightEl.textContent = '-- kg';
      if (fatLossEl) fatLossEl.textContent = '-- kg';
      if (timelineEl) timelineEl.textContent = '-- wks';
      return;
    }

    const bmr = FitTrackCalc.calculateBMR(weight, height, age, sex);
    const tdee = FitTrackCalc.calculateTDEE(bmr, activity);
    const targets = FitTrackCalc.calculateTargets({
      weight,
      height,
      age,
      sex,
      activityLevel: String(activity),
      goal
    });
    const waterTarget = Math.round(weight * 35);
    const recomp = FitTrackCalc.calculateBodyRecomposition(weight, validCurrentBf, validTargetBf);

    if (bmrEl) bmrEl.textContent = `${Math.round(bmr)} kcal`;
    if (tdeeEl) tdeeEl.textContent = `${tdee} kcal`;
    if (calEl) calEl.textContent = `${targets.targetCalories} kcal`;
    if (proEl) proEl.textContent = `${targets.proteinGrams} g`;
    if (waterEl) waterEl.textContent = `${waterTarget} ml`;
    if (targetWeightEl) targetWeightEl.textContent = `${recomp.targetWeight} kg`;
    if (fatLossEl) fatLossEl.textContent = `${recomp.fatMassToLose} kg`;
    if (timelineEl) timelineEl.textContent = `~${recomp.estimatedWeeks} wks`;
  }

  handleOnboardingSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const name = (document.getElementById('onboard-name')?.value || '').trim() || 'Member';
    const sex = document.getElementById('onboard-sex')?.value || 'male';
    const age = parseInt(document.getElementById('onboard-age')?.value, 10);
    const height = parseFloat(document.getElementById('onboard-height')?.value);
    const weight = parseFloat(document.getElementById('onboard-weight')?.value);
    
    const bfSelect = document.getElementById('onboard-bf-select')?.value;
    const bfInputVal = parseFloat(document.getElementById('onboard-bf')?.value);
    const currentBf = bfSelect === 'custom' ? bfInputVal : parseFloat(bfSelect);
    const validCurrentBf = (!isNaN(currentBf) && currentBf > 0) ? currentBf : 22;

    const targetBfSelect = document.getElementById('onboard-target-bf-select')?.value;
    const targetBfInputVal = parseFloat(document.getElementById('onboard-target-bf')?.value);
    const targetBf = targetBfSelect === 'custom' ? targetBfInputVal : parseFloat(targetBfSelect);
    const validTargetBf = (!isNaN(targetBf) && targetBf > 0) ? targetBf : 10;

    const goal = document.getElementById('onboard-goal')?.value || 'fat_loss';
    const activity = parseFloat(document.getElementById('onboard-activity')?.value) || 1.375;

    if (!name || isNaN(age) || isNaN(height) || isNaN(weight) || weight <= 0 || height <= 0 || age <= 0) {
      this.showToast('Please provide valid health measurements.', 'error');
      return;
    }

    const targets = FitTrackCalc.calculateTargets({
      weight,
      height,
      age,
      sex,
      activityLevel: String(activity),
      goal
    });
    const waterTarget = Math.round(weight * 35);
    const recomp = FitTrackCalc.calculateBodyRecomposition(weight, validCurrentBf, validTargetBf);
    const todayStr = FitTrackCalc.formatDateLocal();

    const goalDescriptions = {
      fat_loss: 'Lose body fat, build muscle, and tone up',
      muscle_gain: 'Build muscle and increase strength',
      maintenance: 'Maintain body weight and fitness'
    };

    // 1. Update Profile
    this.store.data.profile = {
      ...this.store.data.profile,
      name,
      sex,
      age,
      height,
      weight,
      bodyFat: validCurrentBf,
      targetBodyFat: validTargetBf,
      targetWeight: recomp.targetWeight,
      primaryGoal: goalDescriptions[goal] || goalDescriptions.fat_loss,
      goal,
      activityLevel: String(activity),
      hasOnboarded: true
    };

    // 2. Update Goals
    this.store.data.goals = {
      ...this.store.data.goals,
      dailyCalories: targets.targetCalories,
      dailyProtein: targets.proteinGrams,
      dailyCarbs: targets.carbsGrams,
      dailyFat: targets.fatGrams,
      dailyWaterMl: waterTarget,
      targetBodyFat: validTargetBf,
      targetWeight: recomp.targetWeight
    };

    // 3. Record baseline measurement
    this.store.recordMeasurement({
      date: todayStr,
      weight,
      bodyFat: validCurrentBf,
      notes: 'Initial Onboarding Baseline'
    });

    this.store.saveData();

    // Close modal
    const modal = document.getElementById('modal-onboarding');
    if (modal) modal.classList.remove('active');

    this.showToast(`🎉 Welcome, ${name}! Your personalized targets (${targets.targetCalories} kcal, ${targets.proteinGrams}g protein, ${recomp.targetWeight}kg goal) have been set. Let's begin!`, 'success');

    this.renderHeaderUserStatus();
    this.navigate('dashboard');
    this.render();
  }

  handleMorningWeightSubmit(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    try {
      const input = document.getElementById('dash-morning-weight-input');
      if (!input) return;
      const rawVal = String(input.value || '').trim();
      let weightVal = parseFloat(rawVal);
      if (!weightVal || isNaN(weightVal)) {
        // If left empty, calibrate using the user's current body weight
        weightVal = parseFloat(this.store.data.profile.weight) || 75;
      }
      if (weightVal < 30 || weightVal > 300) {
        this.showToast('Please enter a valid morning weight between 30 and 300 kg.', 'error');
        return;
      }

      const todayStr = FitTrackCalc.formatDateLocal();
      const roundedWeight = Math.round(weightVal * 10) / 10;

      // 1. Update daily log safely (create initial day object if null)
      let todayLog = this.store.getDailyLog(todayStr);
      if (!todayLog) {
        todayLog = {
          date: todayStr,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          waterMl: 0,
          workoutStatus: 'rest',
          completed: false
        };
      }
      todayLog.weight = roundedWeight;
      this.store.saveDailyLog(todayLog);

      const currentBf = this.store.data.profile.bodyFat || 22;
      const targetBf = this.store.data.profile.targetBodyFat || 10;
      this.store.data.profile.bodyFat = currentBf;
      this.store.data.profile.targetBodyFat = targetBf;

      // 2. Record new measurement
      this.store.recordMeasurement({
        date: todayStr,
        weight: roundedWeight,
        bodyFat: currentBf,
        notes: 'Morning Weight Check-in (Auto-Calibrated)'
      });

      // 3. Adaptive Calibration:
      // If weight is reducing as expected, maintain the diet.
      // If weight spikes / goes out of expectation, tighten the target (-75 kcal).
      const prevWeight = this.store.data.profile.weight;
      const currentGoal = this.store.data.profile.goal || 'fat_loss';
      const currentSex = this.store.data.profile.sex || 'male';
      const baseline = FitTrackCalc.calculateTargets({
        ...this.store.data.profile,
        weight: roundedWeight
      });

      let adaptive;
      if (!prevWeight || prevWeight === roundedWeight) {
        adaptive = {
          targetCalories: baseline.targetCalories,
          proteinGrams: baseline.proteinGrams,
          carbsGrams: baseline.carbsGrams,
          fatGrams: baseline.fatGrams,
          waterTarget: Math.round(roundedWeight * 35),
          delta: 0,
          adjustment: 0,
          feedback: `Calibrated to optimal target (${baseline.targetCalories} kcal) for ${roundedWeight} kg.`
        };
      } else {
        let currentCalTarget = this.store.data.goals.dailyCalories || baseline.targetCalories;
        if (currentGoal === 'fat_loss' && currentCalTarget > baseline.targetCalories) {
          currentCalTarget = baseline.targetCalories;
        }
        adaptive = FitTrackCalc.calculateAdaptiveMorningTarget(
          currentCalTarget,
          prevWeight,
          roundedWeight,
          currentGoal,
          currentSex
        );
      }

      // 4. Update profile weight & recomp roadmap
      this.store.data.profile.weight = roundedWeight;
      const recomp = FitTrackCalc.calculateBodyRecomposition(roundedWeight, currentBf, targetBf);
      this.store.data.profile.targetWeight = recomp.targetWeight;
      this.store.data.goals.targetWeight = recomp.targetWeight;
      this.store.data.goals.targetBodyFat = targetBf;

      // 5. Apply adaptive daily targets
      this.store.data.goals.dailyCalories = adaptive.targetCalories;
      this.store.data.goals.dailyProtein = adaptive.proteinGrams;
      this.store.data.goals.dailyCarbs = adaptive.carbsGrams;
      this.store.data.goals.dailyFat = adaptive.fatGrams;
      this.store.data.goals.dailyWaterMl = adaptive.waterTarget;

      this.store.saveData();

      // Clear input and update placeholder immediately
      input.value = '';
      input.placeholder = `${roundedWeight} kg`;
      input.blur();

      // Direct synchronous DOM update guarantees immediate visual feedback
      const currentWeightEl = document.getElementById('dash-current-weight');
      if (currentWeightEl) currentWeightEl.textContent = `${roundedWeight} kg`;
      const calTargetEl = document.getElementById('dash-cal-target');
      if (calTargetEl) calTargetEl.textContent = `Target: ${adaptive.targetCalories} kcal`;
      const proTargetEl = document.getElementById('dash-pro-target');
      if (proTargetEl) proTargetEl.textContent = `Target: ${adaptive.proteinGrams}g`;
      const autoCalDisp = document.getElementById('adaptive-cal-target-display');
      if (autoCalDisp) autoCalDisp.textContent = `${adaptive.targetCalories} kcal`;
      const autoProDisp = document.getElementById('adaptive-pro-target-display');
      if (autoProDisp) autoProDisp.textContent = `${adaptive.proteinGrams}g pro`;
      const targetWeightDisp = document.getElementById('dash-target-weight-display');
      if (targetWeightDisp) targetWeightDisp.textContent = `${recomp.targetWeight} kg`;

      this.showToast(`⚖️ Morning weight logged: ${roundedWeight} kg. ${adaptive.feedback} (Target: ${adaptive.targetCalories} kcal · ${adaptive.proteinGrams}g pro · ${adaptive.waterTarget}ml water)`, 'success');
      this.render();
    } catch (err) {
      console.error('[FitTrack] Morning weight calibration error:', err);
      this.showToast(`Calibration error: ${err.message || 'Unable to save weight'}`, 'error');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Instantiate and expose globally for tests and window execution
window.FitTrackCalc = FitTrackCalc;
window.FitTrackVault = FitTrackVault;
window.FitTrackAuth = FitTrackAuth;
window.FitTrackMotivation = FitTrackMotivation;
window.FitTrackAdaptive = FitTrackAdaptive;
window.FitTrackSmartMeal = FitTrackSmartMeal;
window.FitTrackStore = FitTrackStore;
window.FitTrackCharts = FitTrackCharts;
window.FitTrackApp = FitTrackApp;

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FitTrackApp();
  window.app.init();
});
