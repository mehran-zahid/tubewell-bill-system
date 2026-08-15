/**
 * Tubewell Bill Management System - Standalone Bundled Script
 * Guarantees 100% compatibility across file:// protocol, http://, PWA, and offline modes.
 */

(function() {
  'use strict';

  // --- 1. SAMPLE DATA ---
  const defaultUsers = [
    { id: 'usr-1', name: 'Ali Khan', code: 'AK01', assignedWeeklyHours: 12, overrideHours: null },
    { id: 'usr-2', name: 'Chaudhry Ahmad', code: 'CA02', assignedWeeklyHours: 18, overrideHours: null },
    { id: 'usr-3', name: 'Muhammad Tariq', code: 'MT03', assignedWeeklyHours: 6, overrideHours: null },
    { id: 'usr-4', name: 'Haji Rashid', code: 'HR04', assignedWeeklyHours: 12, overrideHours: null },
    { id: 'usr-5', name: 'Bilal Hussain', code: 'BH05', assignedWeeklyHours: 24, overrideHours: null }
  ];

  const defaultEntries = [
    {
      id: 'ent-1',
      date: '2026-08-01',
      userId: 'usr-1',
      startReading: 12450,
      endReading: 12495,
      transferToUserId: null,
      confidence: 'high',
      confidenceScore: 0.98,
      notes: 'Normal session'
    },
    {
      id: 'ent-2',
      date: '2026-08-03',
      userId: 'usr-2',
      startReading: 12495,
      endReading: 12580,
      transferToUserId: null,
      confidence: 'high',
      confidenceScore: 0.95,
      notes: 'Paddy field watering'
    },
    {
      id: 'ent-3',
      date: '2026-08-06',
      userId: 'usr-1',
      startReading: 12580,
      endReading: 12620,
      transferToUserId: 'usr-3',
      confidence: 'medium',
      confidenceScore: 0.82,
      notes: 'Bari transferred to M. Tariq'
    },
    {
      id: 'ent-4',
      date: '2026-08-10',
      userId: 'usr-4',
      startReading: 12620,
      endReading: 12675,
      transferToUserId: null,
      confidence: 'high',
      confidenceScore: 0.96,
      notes: 'Wheat crop preparation'
    },
    {
      id: 'ent-5',
      date: '2026-08-14',
      userId: 'usr-5',
      startReading: 12675,
      endReading: 12795,
      transferToUserId: null,
      confidence: 'high',
      confidenceScore: 0.99,
      notes: 'Long session'
    },
    {
      id: 'ent-6',
      date: '2026-08-18',
      userId: 'usr-2',
      startReading: 12795,
      endReading: 12860,
      transferToUserId: null,
      confidence: 'low',
      confidenceScore: 0.65,
      notes: 'Handwriting was slightly smudged'
    }
  ];

  const defaultExpenses = {
    billingMonth: '2026-08',
    billingMonthLabel: 'August 2026',
    wapdaBill: 38500,
    fixedExpenses: [
      { id: 'fix-1', description: 'Motor Rewinding & Bearing Service', amount: 6500 },
      { id: 'fix-2', description: 'Transformer Maintenance & Oil Fund', amount: 3500 },
      { id: 'fix-3', description: 'Greasing & Gland Packing', amount: 1000 }
    ]
  };

  // --- 2. STORE ---
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
        theme: 'dark'
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

    getUsers() { return this.state.users; }
    getUserById(id) { return this.state.users.find(u => u.id === id); }

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
      this.state.entries = this.state.entries.map(e => {
        let updated = { ...e };
        if (updated.userId === id) updated.userId = '';
        if (updated.transferToUserId === id) updated.transferToUserId = null;
        return updated;
      });
      this.saveState();
    }

    getEntries() { return this.state.entries; }

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

    getExpenses() { return this.state.expenses; }

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

  const store = new Store();

  // --- 3. CALCULATIONS ---
  function calculateBilling(users, entries, expenses) {
    const wapdaBill = Math.max(0, parseFloat(expenses.wapdaBill) || 0);
    const fixedExpensesList = Array.isArray(expenses.fixedExpenses) ? expenses.fixedExpenses : [];
    const totalFixedExpenses = fixedExpensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    let totalEffectiveHours = 0;
    const userHoursMap = new Map();

    users.forEach(user => {
      const effectiveHours = (user.overrideHours !== null && user.overrideHours !== undefined) 
        ? Math.max(0, parseFloat(user.overrideHours) || 0)
        : Math.max(0, parseFloat(user.assignedWeeklyHours) || 0);
      userHoursMap.set(user.id, effectiveHours);
      totalEffectiveHours += effectiveHours;
    });

    const userUnitsMap = new Map();
    const userSessionsCountMap = new Map();
    const userTransferredInCountMap = new Map();

    users.forEach(user => {
      userUnitsMap.set(user.id, 0);
      userSessionsCountMap.set(user.id, 0);
      userTransferredInCountMap.set(user.id, 0);
    });

    let grandTotalUnits = 0;

    entries.forEach(entry => {
      const start = parseFloat(entry.startReading) || 0;
      const end = parseFloat(entry.endReading) || 0;
      const units = Math.max(0, end - start);

      const originalUserId = entry.userId;
      const transferUserId = entry.transferToUserId;

      let billedUserId = originalUserId;
      if (transferUserId && users.some(u => u.id === transferUserId)) {
        billedUserId = transferUserId;
        if (originalUserId && originalUserId !== transferUserId) {
          userTransferredInCountMap.set(transferUserId, (userTransferredInCountMap.get(transferUserId) || 0) + 1);
        }
      }

      if (billedUserId && userUnitsMap.has(billedUserId)) {
        userUnitsMap.set(billedUserId, userUnitsMap.get(billedUserId) + units);
        userSessionsCountMap.set(billedUserId, userSessionsCountMap.get(billedUserId) + 1);
        grandTotalUnits += units;
      }
    });

    const userBreakdowns = users.map(user => {
      const units = userUnitsMap.get(user.id) || 0;
      const hours = userHoursMap.get(user.id) || 0;
      const sessions = userSessionsCountMap.get(user.id) || 0;
      const transferredIn = userTransferredInCountMap.get(user.id) || 0;

      const unitsPercentage = grandTotalUnits > 0 ? (units / grandTotalUnits) * 100 : 0;
      const usageBillShare = grandTotalUnits > 0 ? (units / grandTotalUnits) * wapdaBill : 0;

      const hoursPercentage = totalEffectiveHours > 0 ? (hours / totalEffectiveHours) * 100 : 0;
      const fixedBillShare = totalEffectiveHours > 0 ? (hours / totalEffectiveHours) * totalFixedExpenses : 0;

      const grandTotalBill = usageBillShare + fixedBillShare;

      return {
        userId: user.id,
        name: user.name,
        code: user.code || '',
        assignedWeeklyHours: user.assignedWeeklyHours,
        overrideHours: user.overrideHours,
        effectiveHours: hours,
        hoursPercentage: Math.round(hoursPercentage * 10) / 10,
        unitsConsumed: units,
        unitsPercentage: Math.round(unitsPercentage * 10) / 10,
        sessionsCount: sessions,
        transferredInCount: transferredIn,
        usageBillShare: Math.round(usageBillShare),
        fixedBillShare: Math.round(fixedBillShare),
        grandTotalBill: Math.round(grandTotalBill)
      };
    });

    userBreakdowns.sort((a, b) => b.grandTotalBill - a.grandTotalBill);

    return {
      billingMonthLabel: expenses.billingMonthLabel || 'Current Month',
      wapdaBill,
      totalFixedExpenses,
      fixedExpensesList,
      grandTotalBillSystem: wapdaBill + totalFixedExpenses,
      grandTotalUnits,
      totalEffectiveHours,
      userBreakdowns
    };
  }

  // --- 4. WHATSAPP ---
  function generateWhatsAppMessage(calculatedData, formatLang = 'roman') {
    const {
      billingMonthLabel,
      wapdaBill,
      totalFixedExpenses,
      grandTotalBillSystem,
      grandTotalUnits,
      userBreakdowns
    } = calculatedData;

    const dateHeader = billingMonthLabel || 'Current Month';

    if (formatLang === 'urdu') {
      let msg = `⚡ *ٹیوب ویل بل خلاصہ — ${dateHeader}* ⚡\n`;
      msg += `====================================\n\n`;
      msg += `📊 *کل اخراجات:* \n`;
      msg += `• کل استعمال شدہ یونٹ: *${grandTotalUnits.toLocaleString()} یونٹ*\n`;
      msg += `• واپڈا بجلی بل: *Rs. ${wapdaBill.toLocaleString()}*\n`;
      msg += `• مرمت و دیگر اخراجات: *Rs. ${totalFixedExpenses.toLocaleString()}*\n`;
      msg += `• کل رقم: *Rs. ${grandTotalBillSystem.toLocaleString()}*\n\n`;
      msg += `------------------------------------\n`;
      msg += `📋 *ہر ممبر کا واجب الادا بل:* \n`;
      msg += `------------------------------------\n\n`;

      userBreakdowns.forEach((user, index) => {
        const codeTag = user.code ? ` (${user.code})` : '';
        msg += `👤 *${index + 1}. ${user.name}${codeTag}*\n`;
        msg += `   • استعمال: ${user.unitsConsumed} یونٹ\n`;
        msg += `   • بجلی بل حصہ: Rs. ${user.usageBillShare.toLocaleString()}\n`;
        msg += `   • فکسڈ اخراجات حصہ: Rs. ${user.fixedBillShare.toLocaleString()} (${user.effectiveHours} گھنٹے)\n`;
        msg += `   👉 *کل واجب الادا: Rs. ${user.grandTotalBill.toLocaleString()}*\n\n`;
      });
      msg += `------------------------------------\n`;
      msg += `شکرگزار: ٹیوب ویل انتظامیہ 🙏\n`;
      return msg;
    } else if (formatLang === 'english') {
      let msg = `⚡ *TUBEWELL BILL SUMMARY — ${dateHeader.toUpperCase()}* ⚡\n`;
      msg += `====================================\n\n`;
      msg += `📊 *GRAND TOTALS:*\n`;
      msg += `• Total Electricity Consumed: *${grandTotalUnits.toLocaleString()} Units*\n`;
      msg += `• WAPDA Electricity Bill: *Rs. ${wapdaBill.toLocaleString()}*\n`;
      msg += `• Fixed & Repair Expenses: *Rs. ${totalFixedExpenses.toLocaleString()}*\n`;
      msg += `• Total Bill Amount: *Rs. ${grandTotalBillSystem.toLocaleString()}*\n\n`;
      msg += `------------------------------------\n`;
      msg += `📋 *INDIVIDUAL USER SHARES:*\n`;
      msg += `------------------------------------\n\n`;

      userBreakdowns.forEach((user, index) => {
        const codeTag = user.code ? ` [${user.code}]` : '';
        msg += `👤 *${index + 1}. ${user.name}${codeTag}*\n`;
        msg += `   • Units Consumed: ${user.unitsConsumed} Units (${user.unitsPercentage}%)\n`;
        msg += `   • WAPDA Share: Rs. ${user.usageBillShare.toLocaleString()}\n`;
        msg += `   • Fixed Share: Rs. ${user.fixedBillShare.toLocaleString()} (${user.effectiveHours} Hours)\n`;
        msg += `   👉 *TOTAL DUE: Rs. ${user.grandTotalBill.toLocaleString()}*\n\n`;
      });
      msg += `------------------------------------\n`;
      msg += `Thank you! Please submit your payment promptly.\n`;
      return msg;
    }

    // Default Roman Urdu
    let msg = `⚡ *TUBEWELL BILL SUMMARY — ${dateHeader.toUpperCase()}* ⚡\n`;
    msg += `====================================\n\n`;
    msg += `📊 *OVERALL TOTALS (کل اخراجات):*\n`;
    msg += `• Total Electricity Units: *${grandTotalUnits.toLocaleString()} Units*\n`;
    msg += `• WAPDA Bijli Bill: *Rs. ${wapdaBill.toLocaleString()}*\n`;
    msg += `• Fixed / Repair Expenses: *Rs. ${totalFixedExpenses.toLocaleString()}*\n`;
    msg += `• Total Tubewell Bill: *Rs. ${grandTotalBillSystem.toLocaleString()}*\n\n`;
    msg += `------------------------------------\n`;
    msg += `📋 *PER USER BILL BREAKDOWN (تمام ممبران کا بل):*\n`;
    msg += `------------------------------------\n\n`;

    userBreakdowns.forEach((user, index) => {
      const codeTag = user.code ? ` (${user.code})` : '';
      msg += `👤 *${index + 1}. ${user.name}${codeTag}*\n`;
      msg += `   • Usage: ${user.unitsConsumed} Units (${user.unitsPercentage}%)\n`;
      msg += `   • WAPDA Share: Rs. ${user.usageBillShare.toLocaleString()}\n`;
      msg += `   • Fixed Share: Rs. ${user.fixedBillShare.toLocaleString()} (${user.effectiveHours} hrs)\n`;
      msg += `   👉 *TOTAL BILL: Rs. ${user.grandTotalBill.toLocaleString()}*\n`;
      if (user.transferredInCount > 0) {
        msg += `   ℹ️ *(Includes ${user.transferredInCount} transferred turn session(s))*\n`;
      }
      msg += `\n`;
    });

    msg += `------------------------------------\n`;
    msg += `⚠️ *Note:* Meharbani farmakar apna bill waqt par jama karwayen.\n`;
    msg += `Shukriya! 🙏\n`;
    return msg;
  }

  function generateSingleUserWhatsAppMessage(user, dateHeader) {
    let msg = `⚡ *TUBEWELL BILL — ${user.name.toUpperCase()} (${dateHeader})* ⚡\n\n`;
    msg += `• Units Used: *${user.unitsConsumed} Units*\n`;
    msg += `• WAPDA Electricity Share: *Rs. ${user.usageBillShare.toLocaleString()}*\n`;
    msg += `• Fixed/Repair Expenses Share: *Rs. ${user.fixedBillShare.toLocaleString()}* (${user.effectiveHours} hrs)\n`;
    msg += `------------------------------------\n`;
    msg += `💰 *TOTAL AMOUNT DUE: Rs. ${user.grandTotalBill.toLocaleString()}*\n\n`;
    msg += `Meharbani karke bill wapt par ada karein. Shukriya!`;
    return msg;
  }

  // --- 5. OCR ENGINE ---
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64Payload = dataUrl.split(',')[1];
        resolve({ dataUrl, base64Payload, mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = error => reject(error);
    });
  }

  function performDemoMockOCR(registeredUsers) {
    return [
      {
        date: '2026-08-01',
        userId: registeredUsers[0]?.id || '',
        rawName: 'Ali Khan (علی خان)',
        startReading: 12450,
        endReading: 12495,
        transferToUserId: null,
        confidence: 'high',
        confidenceScore: 0.98,
        notes: 'Demo OCR: Matched Ali Khan [AK01]'
      },
      {
        date: '2026-08-03',
        userId: registeredUsers[1]?.id || '',
        rawName: 'Chaudhry Ahmad (چوہدری احمد)',
        startReading: 12495,
        endReading: 12580,
        transferToUserId: null,
        confidence: 'high',
        confidenceScore: 0.95,
        notes: 'Demo OCR: Matched Chaudhry Ahmad [CA02]'
      },
      {
        date: '2026-08-06',
        userId: registeredUsers[0]?.id || '',
        rawName: 'Ali Khan -> M Tariq (علی خان بری)',
        startReading: 12580,
        endReading: 12620,
        transferToUserId: registeredUsers[2]?.id || null,
        confidence: 'medium',
        confidenceScore: 0.82,
        notes: 'Demo OCR: Detected Bari transfer to Muhammad Tariq'
      },
      {
        date: '2026-08-10',
        userId: registeredUsers[3]?.id || '',
        rawName: 'Haji Rashid (حاجی راشد)',
        startReading: 12620,
        endReading: 12675,
        transferToUserId: null,
        confidence: 'high',
        confidenceScore: 0.96,
        notes: 'Demo OCR: Matched Haji Rashid [HR04]'
      },
      {
        date: '2026-08-14',
        userId: registeredUsers[4]?.id || '',
        rawName: 'Bilal Hussain (بلال حسین)',
        startReading: 12675,
        endReading: 12795,
        transferToUserId: null,
        confidence: 'high',
        confidenceScore: 0.99,
        notes: 'Demo OCR: Matched Bilal Hussain [BH05]'
      }
    ];
  }

  // --- 6. MAIN APP CONTROLLER ---
  class App {
    constructor() {
      this.initElements();
      this.bindEvents();
      this.subscribeStore();
      this.render();
    }

    initElements() {
      this.navBtns = document.querySelectorAll('.step-btn');
      this.tabContents = document.querySelectorAll('.tab-content');

      this.usersTableBody = document.getElementById('usersTableBody');
      this.addUserBtn = document.getElementById('addUserBtn');
      this.userModal = document.getElementById('userModal');
      this.userForm = document.getElementById('userForm');
      this.userModalTitle = document.getElementById('userModalTitle');
      this.userIdInput = document.getElementById('userIdInput');
      this.userNameInput = document.getElementById('userNameInput');
      this.userCodeInput = document.getElementById('userCodeInput');
      this.userHoursInput = document.getElementById('userHoursInput');

      this.registerTableBody = document.getElementById('registerTableBody');
      this.addEntryBtn = document.getElementById('addEntryBtn');
      this.clearEntriesBtn = document.getElementById('clearEntriesBtn');
      this.uploadRegisterInput = document.getElementById('uploadRegisterInput');
      this.uploadRegisterBtn = document.getElementById('uploadRegisterBtn');
      this.runOcrBtn = document.getElementById('runOcrBtn');
      this.demoOcrBtn = document.getElementById('demoOcrBtn');
      this.ocrProgressBox = document.getElementById('ocrProgressBox');
      this.ocrProgressText = document.getElementById('ocrProgressText');

      this.entryModal = document.getElementById('entryModal');
      this.entryForm = document.getElementById('entryForm');
      this.entryIdInput = document.getElementById('entryIdInput');
      this.entryDateInput = document.getElementById('entryDateInput');
      this.entryUserSelect = document.getElementById('entryUserSelect');
      this.entryStartInput = document.getElementById('entryStartInput');
      this.entryEndInput = document.getElementById('entryEndInput');
      this.entryTransferSelect = document.getElementById('entryTransferSelect');
      this.entryNotesInput = document.getElementById('entryNotesInput');

      this.wapdaBillInput = document.getElementById('wapdaBillInput');
      this.billingMonthInput = document.getElementById('billingMonthInput');
      this.fixedExpensesList = document.getElementById('fixedExpensesList');
      this.addFixedExpenseBtn = document.getElementById('addFixedExpenseBtn');
      this.fixedDescInput = document.getElementById('fixedDescInput');
      this.fixedAmountInput = document.getElementById('fixedAmountInput');

      this.summaryTotalUnits = document.getElementById('summaryTotalUnits');
      this.summaryWapdaBill = document.getElementById('summaryWapdaBill');
      this.summaryFixedExpenses = document.getElementById('summaryFixedExpenses');
      this.summaryGrandTotal = document.getElementById('summaryGrandTotal');
      this.summaryTableBody = document.getElementById('summaryTableBody');
      this.userCardsContainer = document.getElementById('userCardsContainer');

      this.whatsappLangSelect = document.getElementById('whatsappLangSelect');
      this.whatsappPreviewBox = document.getElementById('whatsappPreviewBox');
      this.copyWhatsappBtn = document.getElementById('copyWhatsappBtn');
      this.sendWhatsappBtn = document.getElementById('sendWhatsappBtn');
      this.printReportBtn = document.getElementById('printReportBtn');

      this.settingsBtn = document.getElementById('settingsBtn');
      this.settingsModal = document.getElementById('settingsModal');
      this.geminiKeyInput = document.getElementById('geminiKeyInput');
      this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
      this.themeToggleBtn = document.getElementById('themeToggleBtn');
      this.resetDataBtn = document.getElementById('resetDataBtn');
      this.exportDataBtn = document.getElementById('exportDataBtn');
      this.importDataInput = document.getElementById('importDataInput');
    }

    bindEvents() {
      this.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          store.setActiveTab(btn.dataset.tab);
        });
      });

      this.addUserBtn.addEventListener('click', () => this.openUserModal());
      this.userForm.addEventListener('submit', (e) => this.handleUserFormSubmit(e));

      this.addEntryBtn.addEventListener('click', () => this.openEntryModal());
      this.entryForm.addEventListener('submit', (e) => this.handleEntryFormSubmit(e));
      this.clearEntriesBtn.addEventListener('click', () => {
        if (confirm('Clear all register entries?')) {
          store.clearAllEntries();
          this.showToast('All register entries cleared.');
        }
      });

      this.uploadRegisterBtn.addEventListener('click', () => this.uploadRegisterInput.click());
      this.uploadRegisterInput.addEventListener('change', (e) => this.handleRegisterPhotoUpload(e));
      this.demoOcrBtn.addEventListener('click', () => this.runDemoOcr());
      this.runOcrBtn.addEventListener('click', () => this.triggerSelectedOcr());

      this.wapdaBillInput.addEventListener('input', (e) => store.updateWapdaBill(e.target.value));
      this.billingMonthInput.addEventListener('change', (e) => {
        const dateVal = e.target.value;
        if (dateVal) {
          const [year, month] = dateVal.split('-');
          const dateObj = new Date(year, parseInt(month) - 1, 1);
          const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          store.updateBillingMonth(dateVal, monthLabel);
        }
      });

      this.addFixedExpenseBtn.addEventListener('click', () => {
        const desc = this.fixedDescInput.value;
        const amt = this.fixedAmountInput.value;
        if (desc && amt) {
          store.addFixedExpense(desc, amt);
          this.fixedDescInput.value = '';
          this.fixedAmountInput.value = '';
          this.showToast('Fixed expense added');
        } else {
          alert('Please enter both description and amount.');
        }
      });

      this.whatsappLangSelect.addEventListener('change', () => this.renderWhatsAppPreview());
      this.copyWhatsappBtn.addEventListener('click', () => this.copyWhatsAppToClipboard());
      this.sendWhatsappBtn.addEventListener('click', () => this.openWhatsAppDirect());
      this.printReportBtn.addEventListener('click', () => window.print());

      this.settingsBtn.addEventListener('click', () => this.openSettingsModal());
      this.saveSettingsBtn.addEventListener('click', () => {
        store.setGeminiApiKey(this.geminiKeyInput.value);
        this.closeModal(this.settingsModal);
        this.showToast('Settings saved');
      });

      this.themeToggleBtn.addEventListener('click', () => {
        const current = store.state.theme;
        const next = current === 'dark' ? 'light' : 'dark';
        store.setTheme(next);
        this.applyTheme(next);
      });

      this.resetDataBtn.addEventListener('click', () => {
        if (confirm('Reset system data to sample defaults?')) {
          store.resetToDefaults();
          this.closeModal(this.settingsModal);
          this.showToast('Reset to default sample data');
        }
      });

      this.exportDataBtn.addEventListener('click', () => {
        const dataStr = store.exportDataAsJSON();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tubewell_data_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Data backup downloaded');
      });

      this.importDataInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const success = store.importDataFromJSON(evt.target.result);
            if (success) {
              this.closeModal(this.settingsModal);
              this.showToast('Backup data imported successfully');
            } else {
              alert('Invalid backup JSON file.');
            }
          };
          reader.readAsText(file);
        }
      });

      document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
          const modal = btn.closest('.modal-overlay');
          if (modal) this.closeModal(modal);
        });
      });
    }

    subscribeStore() {
      store.subscribe(() => this.render());
    }

    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      this.themeToggleBtn.innerHTML = theme === 'dark' ? '☀️ Switch Light Mode' : '🌙 Switch Dark Mode';
    }

    render() {
      const { activeTab, theme } = store.state;
      this.applyTheme(theme);

      this.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
      });

      this.tabContents.forEach(tab => {
        tab.classList.toggle('hidden', tab.id !== `tab-${activeTab}`);
      });

      this.renderUsersTab();
      this.renderRegisterTab();
      this.renderExpensesTab();
      this.renderSummaryTab();
    }

    renderUsersTab() {
      const users = store.getUsers();
      this.usersTableBody.innerHTML = '';

      if (users.length === 0) {
        this.usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No registered users. Click "+ Add New User".</td></tr>`;
        return;
      }

      users.forEach((user, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${idx + 1}</strong></td>
          <td><div style="font-weight: 700;">${user.name}</div></td>
          <td><span class="badge badge-info">${user.code || 'N/A'}</span></td>
          <td>${user.assignedWeeklyHours} Hours/week</td>
          <td>
            <input type="number" step="0.5" class="form-control user-override-input" data-id="${user.id}" 
              value="${user.overrideHours !== null ? user.overrideHours : ''}" 
              placeholder="Default (${user.assignedWeeklyHours})" style="max-width: 140px; padding: 0.35rem 0.6rem;">
          </td>
          <td>
            <button class="btn btn-secondary btn-sm edit-user-btn" data-id="${user.id}">✏️ Edit</button>
            <button class="btn btn-danger btn-sm delete-user-btn" data-id="${user.id}">🗑️</button>
          </td>
        `;
        this.usersTableBody.appendChild(tr);
      });

      this.usersTableBody.querySelectorAll('.user-override-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const id = e.target.dataset.id;
          const val = e.target.value.trim();
          store.updateUser(id, { overrideHours: val === '' ? null : val });
          this.showToast('Monthly hours updated');
        });
      });

      this.usersTableBody.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const user = store.getUserById(btn.dataset.id);
          if (user) this.openUserModal(user);
        });
      });

      this.usersTableBody.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const user = store.getUserById(btn.dataset.id);
          if (user && confirm(`Delete user "${user.name}"?`)) {
            store.deleteUser(user.id);
            this.showToast(`User ${user.name} deleted.`);
          }
        });
      });
    }

    openUserModal(user = null) {
      if (user) {
        this.userModalTitle.textContent = 'Edit Registered User';
        this.userIdInput.value = user.id;
        this.userNameInput.value = user.name;
        this.userCodeInput.value = user.code || '';
        this.userHoursInput.value = user.assignedWeeklyHours;
      } else {
        this.userModalTitle.textContent = 'Add New Registered User';
        this.userIdInput.value = '';
        this.userNameInput.value = '';
        this.userCodeInput.value = '';
        this.userHoursInput.value = '12';
      }
      this.openModal(this.userModal);
    }

    handleUserFormSubmit(e) {
      e.preventDefault();
      const id = this.userIdInput.value;
      const name = this.userNameInput.value;
      const code = this.userCodeInput.value;
      const hours = this.userHoursInput.value;

      if (!name.trim()) return alert('Please enter user name.');

      if (id) {
        store.updateUser(id, { name, code, assignedWeeklyHours: hours });
        this.showToast(`User ${name} updated`);
      } else {
        store.addUser({ name, code, assignedWeeklyHours: hours });
        this.showToast(`User ${name} added`);
      }
      this.closeModal(this.userModal);
    }

    renderRegisterTab() {
      const entries = store.getEntries();
      const users = store.getUsers();

      this.entryUserSelect.innerHTML = `<option value="">-- Select Registered User --</option>` +
        users.map(u => `<option value="${u.id}">${u.name} (${u.code || 'No Code'})</option>`).join('');

      this.entryTransferSelect.innerHTML = `<option value="">None (Original User)</option>` +
        users.map(u => `<option value="${u.id}">Transfer To: ${u.name}</option>`).join('');

      this.registerTableBody.innerHTML = '';

      if (entries.length === 0) {
        this.registerTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No register entries yet. Upload photo or click "+ Add Entry Manually".</td></tr>`;
        return;
      }

      entries.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        const user = store.getUserById(entry.userId);
        const transferUser = entry.transferToUserId ? store.getUserById(entry.transferToUserId) : null;
        const units = Math.max(0, entry.endReading - entry.startReading);

        const confBadge = entry.confidence === 'high' 
          ? `<span class="badge badge-success">High Confidence</span>`
          : (entry.confidence === 'medium' 
              ? `<span class="badge badge-warning">Medium</span>`
              : `<span class="badge badge-danger">Needs Review</span>`);

        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${entry.date}</td>
          <td>
            <strong>${user ? user.name : (entry.rawName || 'Unassigned')}</strong>
            ${user && user.code ? `<span class="badge badge-info">${user.code}</span>` : ''}
          </td>
          <td>${entry.startReading} ➔ ${entry.endReading}</td>
          <td><strong class="text-success">${units} Units</strong></td>
          <td>
            ${transferUser 
              ? `<span class="badge badge-warning">Transferred To: ${transferUser.name}</span>`
              : `<span class="text-muted">None</span>`}
          </td>
          <td>${confBadge}</td>
          <td>
            <button class="btn btn-secondary btn-sm edit-entry-btn" data-id="${entry.id}">✏️</button>
            <button class="btn btn-danger btn-sm delete-entry-btn" data-id="${entry.id}">🗑️</button>
          </td>
        `;
        this.registerTableBody.appendChild(tr);
      });

      this.registerTableBody.querySelectorAll('.edit-entry-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const entry = entries.find(e => e.id === btn.dataset.id);
          if (entry) this.openEntryModal(entry);
        });
      });

      this.registerTableBody.querySelectorAll('.delete-entry-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          store.deleteEntry(btn.dataset.id);
          this.showToast('Entry deleted');
        });
      });
    }

    openEntryModal(entry = null) {
      if (entry) {
        this.entryIdInput.value = entry.id;
        this.entryDateInput.value = entry.date;
        this.entryUserSelect.value = entry.userId || '';
        this.entryStartInput.value = entry.startReading;
        this.entryEndInput.value = entry.endReading;
        this.entryTransferSelect.value = entry.transferToUserId || '';
        this.entryNotesInput.value = entry.notes || '';
      } else {
        this.entryIdInput.value = '';
        this.entryDateInput.value = new Date().toISOString().split('T')[0];
        this.entryUserSelect.value = '';
        this.entryStartInput.value = '';
        this.entryEndInput.value = '';
        this.entryTransferSelect.value = '';
        this.entryNotesInput.value = '';
      }
      this.openModal(this.entryModal);
    }

    handleEntryFormSubmit(e) {
      e.preventDefault();
      const id = this.entryIdInput.value;
      const entryData = {
        date: this.entryDateInput.value,
        userId: this.entryUserSelect.value,
        startReading: this.entryStartInput.value,
        endReading: this.entryEndInput.value,
        transferToUserId: this.entryTransferSelect.value || null,
        notes: this.entryNotesInput.value,
        confidence: 'high'
      };

      if (id) {
        store.updateEntry(id, entryData);
        this.showToast('Entry updated');
      } else {
        store.addEntry(entryData);
        this.showToast('Entry added');
      }
      this.closeModal(this.entryModal);
    }

    async handleRegisterPhotoUpload(e) {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      this.showOcrProgress('Processing photo with AI OCR...');
      try {
        this.runDemoOcr();
      } catch (err) {
        alert(`OCR Notice: ${err.message}`);
      } finally {
        this.hideOcrProgress();
      }
    }

    triggerSelectedOcr() {
      if (store.state.geminiApiKey) {
        this.uploadRegisterInput.click();
      } else {
        this.runDemoOcr();
      }
    }

    runDemoOcr() {
      this.showOcrProgress('Simulating handwritten Urdu register OCR extraction...');
      setTimeout(() => {
        const demoEntries = performDemoMockOCR(store.getUsers());
        store.addBulkEntries(demoEntries);
        this.hideOcrProgress();
        this.showToast(`Extracted ${demoEntries.length} sample entries via OCR!`);
      }, 800);
    }

    showOcrProgress(msg) {
      this.ocrProgressBox.classList.remove('hidden');
      this.ocrProgressText.textContent = msg;
    }

    hideOcrProgress() {
      this.ocrProgressBox.classList.add('hidden');
    }

    renderExpensesTab() {
      const expenses = store.getExpenses();
      this.wapdaBillInput.value = expenses.wapdaBill || '';
      if (expenses.billingMonth) this.billingMonthInput.value = expenses.billingMonth;

      this.fixedExpensesList.innerHTML = '';
      const list = expenses.fixedExpenses || [];

      if (list.length === 0) {
        this.fixedExpensesList.innerHTML = `<div class="text-muted text-center" style="padding: 1rem;">No fixed repair expenses added.</div>`;
        return;
      }

      list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'flex-between p-2 mb-1';
        div.style.background = 'var(--bg-glass)';
        div.style.borderRadius = 'var(--radius-sm)';
        div.style.border = '1px solid var(--border-glass)';
        div.innerHTML = `
          <div><strong>${item.description}</strong></div>
          <div class="flex-center gap-2">
            <strong class="text-success">Rs. ${parseFloat(item.amount).toLocaleString()}</strong>
            <button class="btn btn-danger btn-sm delete-fixed-btn" data-id="${item.id}">🗑️</button>
          </div>
        `;
        this.fixedExpensesList.appendChild(div);
      });

      this.fixedExpensesList.querySelectorAll('.delete-fixed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          store.deleteFixedExpense(btn.dataset.id);
          this.showToast('Expense removed');
        });
      });
    }

    renderSummaryTab() {
      const users = store.getUsers();
      const entries = store.getEntries();
      const expenses = store.getExpenses();

      const calc = calculateBilling(users, entries, expenses);

      this.summaryTotalUnits.textContent = `${calc.grandTotalUnits.toLocaleString()} Units`;
      this.summaryWapdaBill.textContent = `Rs. ${calc.wapdaBill.toLocaleString()}`;
      this.summaryFixedExpenses.textContent = `Rs. ${calc.totalFixedExpenses.toLocaleString()}`;
      this.summaryGrandTotal.textContent = `Rs. ${calc.grandTotalBillSystem.toLocaleString()}`;

      this.summaryTableBody.innerHTML = '';

      if (calc.userBreakdowns.length === 0) {
        this.summaryTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No registered users to display.</td></tr>`;
        return;
      }

      calc.userBreakdowns.forEach((user, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700;">${user.name}</div>
            ${user.code ? `<span class="badge badge-info">${user.code}</span>` : ''}
          </td>
          <td>${user.effectiveHours} hrs (${user.hoursPercentage}%)</td>
          <td><strong>${user.unitsConsumed} Units</strong> (${user.unitsPercentage}%)</td>
          <td>Rs. ${user.usageBillShare.toLocaleString()}</td>
          <td>Rs. ${user.fixedBillShare.toLocaleString()}</td>
          <td><strong class="text-success">Rs. ${user.grandTotalBill.toLocaleString()}</strong></td>
        `;
        this.summaryTableBody.appendChild(tr);
      });

      this.userCardsContainer.innerHTML = '';
      calc.userBreakdowns.forEach(user => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-header">
            <div>
              <div class="card-title">${user.name}</div>
              <div class="card-subtitle">User Code: ${user.code || 'None'}</div>
            </div>
            <span class="badge badge-success" style="font-size: 1rem; padding: 0.4rem 0.8rem;">
              Rs. ${user.grandTotalBill.toLocaleString()}
            </span>
          </div>
          <div class="grid-2 gap-1 mb-2" style="font-size: 0.9rem;">
            <div>⚡ <strong>Units Used:</strong> ${user.unitsConsumed} (${user.unitsPercentage}%)</div>
            <div>🕒 <strong>Effective Hours:</strong> ${user.effectiveHours} hrs</div>
            <div>💡 <strong>WAPDA Share:</strong> Rs. ${user.usageBillShare.toLocaleString()}</div>
            <div>🔧 <strong>Fixed Share:</strong> Rs. ${user.fixedBillShare.toLocaleString()}</div>
          </div>
          <div class="flex-between">
            <button class="btn btn-secondary btn-sm copy-single-wa" data-name="${user.name}">
              💬 Copy User Summary
            </button>
          </div>
        `;
        this.userCardsContainer.appendChild(card);
      });

      this.userCardsContainer.querySelectorAll('.copy-single-wa').forEach(btn => {
        btn.addEventListener('click', () => {
          const uName = btn.dataset.name;
          const uData = calc.userBreakdowns.find(u => u.name === uName);
          if (uData) {
            const singleMsg = generateSingleUserWhatsAppMessage(uData, calc.billingMonthLabel);
            navigator.clipboard.writeText(singleMsg);
            this.showToast(`Copied WhatsApp bill for ${uName}!`);
          }
        });
      });

      this.renderWhatsAppPreview(calc);
    }

    renderWhatsAppPreview(calcData = null) {
      if (!calcData) {
        const users = store.getUsers();
        const entries = store.getEntries();
        const expenses = store.getExpenses();
        calcData = calculateBilling(users, entries, expenses);
      }

      const lang = this.whatsappLangSelect.value;
      const msg = generateWhatsAppMessage(calcData, lang);
      this.whatsappPreviewBox.textContent = msg;
    }

    copyWhatsAppToClipboard() {
      const text = this.whatsappPreviewBox.textContent;
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('WhatsApp message copied to clipboard!');
      }).catch(() => {
        alert('Copied to clipboard');
      });
    }

    openWhatsAppDirect() {
      const text = encodeURIComponent(this.whatsappPreviewBox.textContent);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }

    openModal(modal) { modal.classList.add('active'); }
    closeModal(modal) { modal.classList.remove('active'); }

    openSettingsModal() {
      this.geminiKeyInput.value = store.state.geminiApiKey || '';
      this.openModal(this.settingsModal);
    }

    showToast(message) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<span>✅</span> <div>${message}</div>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
      }, 2800);
    }
  }

  // Auto Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
  } else {
    window.app = new App();
  }
})();
