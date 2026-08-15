import { defaultUsers, defaultEntries, defaultExpenses } from './sampleData.js';

const STORAGE_KEY = 'turbine_bill_system_v27_final';

class Store {
  constructor() {
    this.listeners = [];
    this.state = this.loadState();
  }

  getDefaultState() {
    return {
      users: JSON.parse(JSON.stringify(defaultUsers)),
      entries: JSON.parse(JSON.stringify(defaultEntries)),
      expenses: JSON.parse(JSON.stringify(defaultExpenses)),
      geminiApiKey: '',
      activeTab: 'users',
      theme: 'light',
      ocrMode: 'auto'
    };
  }

  loadState() {
    try {
      const keysToTry = [
        STORAGE_KEY,
        'tubewell_bill_system_v26_secure_key',
        'tubewell_bill_system_v1'
      ];
      for (const key of keysToTry) {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
            return {
              ...this.getDefaultState(),
              ...parsed
            };
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
    return this.getDefaultState();
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // --- Users Actions ---
  getUsers() {
    return this.state.users;
  }

  getUserById(id) {
    return this.state.users.find(u => u.id === id);
  }

  getNextUserCode() {
    const codes = this.state.users.map(u => parseInt(u.userCode || u.code || '0', 10)).filter(n => !isNaN(n));
    const max = codes.length > 0 ? Math.max(...codes) : 0;
    return String(max + 1).padStart(2, '0');
  }

  isCodeDuplicate(code, excludeId = null) {
    const clean = String(code || '').trim().padStart(2, '0');
    return this.state.users.some(u => u.id !== excludeId && String(u.userCode || u.code || '').trim().padStart(2, '0') === clean);
  }

  addUser(user) {
    const userCode = String(user.userCode || user.code || this.getNextUserCode()).trim().padStart(2, '0');
    if (this.isCodeDuplicate(userCode)) {
      throw new Error(`User ID "${userCode}" already exists! Please use a unique User ID.`);
    }

    const nameEn = (user.nameEn || user.name || '').trim();
    const nameUr = (user.nameUr || '').trim();
    const fullName = nameEn && nameUr ? `${nameEn} (${nameUr})` : (nameEn || nameUr || 'Member');

    const durationHours = parseInt(user.durationHours, 10) || 0;
    const durationMinutes = parseInt(user.durationMinutes, 10) || 0;
    const totalMinutes = (durationHours * 60) + durationMinutes;

    const newUser = {
      id: 'usr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userCode: userCode,
      code: userCode,
      nameEn: nameEn,
      nameUr: nameUr,
      name: fullName,
      phone: (user.phone || '').trim(),
      userType: user.userType || 'internal', // 'internal' shareholder or 'external' customer
      startDay: user.startDay || 'Sunday',
      startTime: user.startTime || '08:00',
      endDay: user.endDay || 'Monday',
      endTime: user.endTime || '01:00',
      durationHours: durationHours,
      durationMinutes: durationMinutes,
      totalMinutes: totalMinutes > 0 ? totalMinutes : 600,
      assignedWeeklyHours: totalMinutes > 0 ? totalMinutes / 60 : 10,
      overrideHours: null
    };

    this.state.users.push(newUser);
    this.autoRechainSchedule();
    this.saveState();
    return newUser;
  }

  updateUser(id, updatedFields) {
    const index = this.state.users.findIndex(u => u.id === id);
    if (index !== -1) {
      const current = this.state.users[index];
      const userCode = updatedFields.userCode !== undefined ? String(updatedFields.userCode).trim().padStart(2, '0') : current.userCode;

      if (this.isCodeDuplicate(userCode, id)) {
        throw new Error(`User ID "${userCode}" already exists! Duplicate IDs are not allowed.`);
      }

      const nameEn = updatedFields.nameEn !== undefined ? updatedFields.nameEn.trim() : (current.nameEn || current.name || '');
      const nameUr = updatedFields.nameUr !== undefined ? updatedFields.nameUr.trim() : (current.nameUr || '');
      const fullName = nameEn && nameUr ? `${nameEn} (${nameUr})` : (nameEn || nameUr || current.name || 'Member');

      let durationHours = updatedFields.durationHours !== undefined ? parseInt(updatedFields.durationHours, 10) || 0 : current.durationHours;
      let durationMinutes = updatedFields.durationMinutes !== undefined ? parseInt(updatedFields.durationMinutes, 10) || 0 : current.durationMinutes;
      let totalMinutes = (durationHours * 60) + durationMinutes;
      if (totalMinutes <= 0 && updatedFields.totalMinutes) {
        totalMinutes = updatedFields.totalMinutes;
      }

      this.state.users[index] = {
        ...current,
        ...updatedFields,
        userCode: userCode,
        code: userCode,
        nameEn: nameEn,
        nameUr: nameUr,
        name: fullName,
        userType: updatedFields.userType || current.userType || 'internal',
        durationHours: durationHours,
        durationMinutes: durationMinutes,
        totalMinutes: totalMinutes,
        assignedWeeklyHours: totalMinutes / 60
      };

      this.autoRechainSchedule();
      this.saveState();
    }
  }

  autoRechainSchedule() {
    if (this.state.users.length === 0) return;
    const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < this.state.users.length; i++) {
      const u = this.state.users[i];
      if (i === 0) {
        // Compute end time based on user 0 duration
        const startOffset = (DAYS_ORDER.indexOf(u.startDay || 'Sunday') * 1440) + this.timeToMins(u.startTime || '08:00');
        const endOffset = startOffset + (u.totalMinutes || 600);
        const { day, time } = this.offsetToDayTime(endOffset);
        u.endDay = day;
        u.endTime = time;
      } else {
        // Chain from previous user's end day and end time!
        const prev = this.state.users[i - 1];
        u.startDay = prev.endDay;
        u.startTime = prev.endTime;

        const startOffset = (DAYS_ORDER.indexOf(u.startDay) * 1440) + this.timeToMins(u.startTime);
        const endOffset = startOffset + (u.totalMinutes || 600);
        const { day, time } = this.offsetToDayTime(endOffset);
        u.endDay = day;
        u.endTime = time;
      }
    }
  }

  timeToMins(tStr) {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return (h * 60) + (m || 0);
  }

  offsetToDayTime(offset) {
    const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const totalWeekly = (offset + (7 * 1440 * 10)) % (7 * 1440);
    const dayIdx = Math.floor(totalWeekly / 1440);
    const minsInDay = totalWeekly % 1440;
    const h = Math.floor(minsInDay / 60);
    const m = minsInDay % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { day: DAYS_ORDER[dayIdx], time: timeStr };
  }

  deleteUser(id) {
    this.state.users = this.state.users.filter(u => u.id !== id);
    this.autoRechainSchedule();
    this.saveState();
  }

  // --- Register Entries Actions ---
  getEntries() {
    return this.state.entries;
  }

  addEntry(entry) {
    const newEntry = {
      id: 'ent-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: entry.date || new Date().toISOString().split('T')[0],
      userId: entry.userId || '',
      startReading: parseFloat(entry.startReading) || 0,
      endReading: parseFloat(entry.endReading) || 0,
      transferToUserId: entry.transferToUserId || null,
      confidence: entry.confidence || 'high',
      confidenceScore: entry.confidenceScore || 0.95,
      notes: entry.notes || ''
    };
    this.state.entries.push(newEntry);
    this.saveState();
    return newEntry;
  }

  updateEntry(id, updatedFields) {
    const index = this.state.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      this.state.entries[index] = {
        ...this.state.entries[index],
        ...updatedFields,
        startReading: updatedFields.startReading !== undefined ? parseFloat(updatedFields.startReading) || 0 : this.state.entries[index].startReading,
        endReading: updatedFields.endReading !== undefined ? parseFloat(updatedFields.endReading) || 0 : this.state.entries[index].endReading
      };
      this.saveState();
    }
  }

  deleteEntry(id) {
    this.state.entries = this.state.entries.filter(e => e.id !== id);
    this.saveState();
  }

  clearAllEntries() {
    this.state.entries = [];
    this.saveState();
  }

  addBulkEntries(entriesList) {
    const formatted = entriesList.map(e => ({
      id: 'ent-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      date: e.date || new Date().toISOString().split('T')[0],
      userId: e.userId || '',
      startReading: parseFloat(e.startReading) || 0,
      endReading: parseFloat(e.endReading) || 0,
      transferToUserId: e.transferToUserId || null,
      confidence: e.confidence || 'high',
      confidenceScore: e.confidenceScore || 0.95,
      notes: e.notes || ''
    }));
    this.state.entries = [...this.state.entries, ...formatted];
    this.saveState();
  }

  // --- Expenses Actions ---
  getExpenses() {
    return this.state.expenses;
  }

  updateWapdaBill(amount) {
    this.state.expenses.wapdaBill = Math.max(0, parseFloat(amount) || 0);
    this.saveState();
  }

  updateBillingMonth(monthStr, labelStr) {
    this.state.expenses.billingMonth = monthStr;
    if (labelStr) this.state.expenses.billingMonthLabel = labelStr;
    this.saveState();
  }

  addFixedExpense(description, amount) {
    const item = {
      id: 'fix-' + Date.now(),
      description: description.trim() || 'General Expense',
      amount: Math.max(0, parseFloat(amount) || 0)
    };
    this.state.expenses.fixedExpenses.push(item);
    this.saveState();
  }

  deleteFixedExpense(id) {
    this.state.expenses.fixedExpenses = this.state.expenses.fixedExpenses.filter(f => f.id !== id);
    this.saveState();
  }

  // --- Settings Actions ---
  setGeminiApiKey(key) {
    this.state.geminiApiKey = key.trim();
    this.saveState();
  }

  setActiveTab(tab) {
    this.state.activeTab = tab;
    this.saveState();
  }

  setTheme(theme) {
    this.state.theme = theme;
    this.saveState();
  }

  setOcrMode(mode) {
    this.state.ocrMode = mode;
    this.saveState();
  }

  resetToDefaults() {
    const existingKey = this.state ? this.state.geminiApiKey : '';
    const existingSessionFlag = this.state ? this.state.sessionOnlyKey : false;
    this.state = this.getDefaultState();
    if (existingKey) {
      this.state.geminiApiKey = existingKey;
      this.state.sessionOnlyKey = existingSessionFlag;
    }
    this.saveState();
  }
}

export const store = new Store();

