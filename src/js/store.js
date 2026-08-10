import { defaultUsers, defaultEntries, defaultExpenses } from './sampleData.js';

const STORAGE_KEY = 'tubewell_bill_system_v1';

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
      theme: 'dark',
      ocrMode: 'auto' // 'auto', 'cloud', 'local'
    };
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...this.getDefaultState(),
          ...parsed
        };
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

  addUser(user) {
    const newUser = {
      id: 'usr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: user.name.trim(),
      code: (user.code || '').trim().toUpperCase(),
      assignedWeeklyHours: parseFloat(user.assignedWeeklyHours) || 0,
      overrideHours: user.overrideHours !== null && user.overrideHours !== undefined && user.overrideHours !== '' 
        ? parseFloat(user.overrideHours) 
        : null
    };
    this.state.users.push(newUser);
    this.saveState();
    return newUser;
  }

  updateUser(id, updatedFields) {
    const index = this.state.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.state.users[index] = {
        ...this.state.users[index],
        ...updatedFields,
        name: updatedFields.name ? updatedFields.name.trim() : this.state.users[index].name,
        code: updatedFields.code !== undefined ? updatedFields.code.trim().toUpperCase() : this.state.users[index].code,
        assignedWeeklyHours: updatedFields.assignedWeeklyHours !== undefined ? parseFloat(updatedFields.assignedWeeklyHours) || 0 : this.state.users[index].assignedWeeklyHours,
        overrideHours: updatedFields.overrideHours === '' || updatedFields.overrideHours === null ? null : parseFloat(updatedFields.overrideHours)
      };
      this.saveState();
    }
  }

  deleteUser(id) {
    this.state.users = this.state.users.filter(u => u.id !== id);
    // Also clean up any entries or transfers associated with this user
    this.state.entries = this.state.entries.map(e => {
      let updated = { ...e };
      if (updated.userId === id) updated.userId = '';
      if (updated.transferToUserId === id) updated.transferToUserId = null;
      return updated;
    });
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
      confidenceScore: entry.confidenceScore || 1.0,
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
      confidenceScore: e.confidenceScore || 0.9,
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
    this.state = this.getDefaultState();
    this.saveState();
  }

  exportDataAsJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  importDataFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data && Array.isArray(data.users) && Array.isArray(data.entries)) {
        this.state = {
          ...this.getDefaultState(),
          ...data
        };
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    return false;
  }
}

export const store = new Store();
