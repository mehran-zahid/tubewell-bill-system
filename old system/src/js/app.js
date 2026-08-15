import { store } from './store.js';
import { calculateBilling } from './calculations.js';
import { generateWhatsAppMessage, generateSingleUserWhatsAppMessage } from './whatsapp.js';
import { performGeminiVisionOCR, performLocalOfflineOCR, performDemoMockOCR, fileToBase64 } from './ocr.js';
import { sampleRegisterImageBase64 } from './sampleData.js';

// Register Service Worker for PWA Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service Worker registration skipped/failed:', err);
    });
  });
}

class App {
  constructor() {
    this.initElements();
    this.bindEvents();
    this.subscribeStore();
    this.render();
  }

  initElements() {
    // Nav Step Tabs
    this.navBtns = document.querySelectorAll('.step-btn');
    this.tabContents = document.querySelectorAll('.tab-content');

    // Users Tab Elements
    this.usersTableBody = document.getElementById('usersTableBody');
    this.addUserBtn = document.getElementById('addUserBtn');
    this.userModal = document.getElementById('userModal');
    this.userForm = document.getElementById('userForm');
    this.userModalTitle = document.getElementById('userModalTitle');
    this.userIdInput = document.getElementById('userIdInput');
    this.userNameInput = document.getElementById('userNameInput');
    this.userCodeInput = document.getElementById('userCodeInput');
    this.userHoursInput = document.getElementById('userHoursInput');

    // Register Tab Elements
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

    // Expenses Tab Elements
    this.wapdaBillInput = document.getElementById('wapdaBillInput');
    this.billingMonthInput = document.getElementById('billingMonthInput');
    this.fixedExpensesList = document.getElementById('fixedExpensesList');
    this.addFixedExpenseBtn = document.getElementById('addFixedExpenseBtn');
    this.fixedDescInput = document.getElementById('fixedDescInput');
    this.fixedAmountInput = document.getElementById('fixedAmountInput');

    // Summary & WhatsApp Tab Elements
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

    // Settings Modal Elements
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
    // Tab Navigation
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        store.setActiveTab(tab);
      });
    });

    // Users Actions
    this.addUserBtn.addEventListener('click', () => this.openUserModal());
    this.userForm.addEventListener('submit', (e) => this.handleUserFormSubmit(e));

    // Entry Actions
    this.addEntryBtn.addEventListener('click', () => this.openEntryModal());
    this.entryForm.addEventListener('submit', (e) => this.handleEntryFormSubmit(e));
    this.clearEntriesBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all register entries?')) {
        store.clearAllEntries();
        this.showToast('All register entries cleared.');
      }
    });

    // Register Upload & OCR
    this.uploadRegisterBtn.addEventListener('click', () => this.uploadRegisterInput.click());
    this.uploadRegisterInput.addEventListener('change', (e) => this.handleRegisterPhotoUpload(e));
    this.demoOcrBtn.addEventListener('click', () => this.runDemoOcr());
    this.runOcrBtn.addEventListener('click', () => this.triggerSelectedOcr());

    // Expenses Actions
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

    // WhatsApp & Export Actions
    this.whatsappLangSelect.addEventListener('change', () => this.renderWhatsAppPreview());
    this.copyWhatsappBtn.addEventListener('click', () => this.copyWhatsAppToClipboard());
    this.sendWhatsappBtn.addEventListener('click', () => this.openWhatsAppDirect());
    this.printReportBtn.addEventListener('click', () => window.print());

    // Settings Modal
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
      if (confirm('Reset system data to sample default values? Custom changes will be replaced.')) {
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

    // Close Modals on Overlay Click or X
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
    const { activeTab, theme, geminiApiKey } = store.state;
    this.applyTheme(theme);

    // Update active tab buttons & contents
    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });

    this.tabContents.forEach(tab => {
      tab.classList.toggle('hidden', tab.id !== `tab-${activeTab}`);
    });

    // Render tab views
    this.renderUsersTab();
    this.renderRegisterTab();
    this.renderExpensesTab();
    this.renderSummaryTab();
  }

  // --- Users Tab Rendering & Logic ---
  renderUsersTab() {
    const users = store.getUsers();
    this.usersTableBody.innerHTML = '';

    if (users.length === 0) {
      this.usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No registered users found. Click "+ Add User" to get started.</td></tr>`;
      return;
    }

    users.forEach((user, idx) => {
      const tr = document.createElement('tr');
      const effectiveHours = user.overrideHours !== null ? user.overrideHours : user.assignedWeeklyHours;

      tr.innerHTML = `
        <td><strong>${idx + 1}</strong></td>
        <td>
          <div style="font-weight: 700;">${user.name}</div>
        </td>
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

    // Bind inline user override inputs & buttons
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
        const id = btn.dataset.id;
        const user = store.getUserById(id);
        if (user) this.openUserModal(user);
      });
    });

    this.usersTableBody.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const user = store.getUserById(id);
        if (user && confirm(`Delete user "${user.name}"?`)) {
          store.deleteUser(id);
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

  // --- Register Tab Rendering & Logic ---
  renderRegisterTab() {
    const entries = store.getEntries();
    const users = store.getUsers();

    if (this.entryUserSelect) {
      this.entryUserSelect.innerHTML = `<option value="">-- Select Registered Member --</option>` +
        users.map(u => `<option value="${u.id}">${u.name} (${u.code || 'No Code'})</option>`).join('');
    }

    if (this.registerTableBody) {
      this.registerTableBody.innerHTML = '';

      if (entries.length === 0) {
        this.registerTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No register entries yet. Upload register photo or add a manual entry.</td></tr>`;
        return;
      }

      entries.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        const startVal = parseFloat(entry.startReading) || 0;
        const endVal = parseFloat(entry.endReading) || 0;
        const units = Math.max(0, endVal - startVal);

        const isError = endVal > 0 && endVal < startVal;
        let isSeqDiscrepancy = false;
        if (idx > 0) {
          const prev = entries[idx - 1];
          const prevEndVal = parseFloat(prev.endReading) || 0;
          if (prevEndVal > 0 && startVal > 0 && startVal < prevEndVal) {
            isSeqDiscrepancy = true;
          }
        }

        let rowClass = 'row-verified';
        if (isError) {
          rowClass = 'row-error';
        } else if (!entry.isReviewed && (!entry.userId || entry.confidence === 'low' || entry.confidence === 'medium' || isSeqDiscrepancy)) {
          rowClass = 'row-warning';
        }

        tr.className = rowClass;

        const memberDropdownHtml = `
          <select class="tbl-member-select" data-id="${entry.id}">
            <option value="">-- Select Member / نام منتخب کریں --</option>
            ${users.map(u => {
              const uCode = u.userCode || u.code || '01';
              const nameStr = u.fullName || `${u.nameEn || u.name} (${u.nameUr || ''})`;
              const isSel = u.id === entry.userId ? 'selected' : '';
              return `<option value="${u.id}" ${isSel}>[${uCode}] ${nameStr}</option>`;
            }).join('')}
          </select>
        `;

        tr.innerHTML = `
          <td style="text-align: center;"><strong>${idx + 1}</strong></td>
          <td>
            <input type="date" class="tbl-date-input" data-id="${entry.id}" value="${entry.date}">
          </td>
          <td>${memberDropdownHtml}</td>
          <td>
            <input type="number" class="tbl-reading-input tbl-start-reading" data-id="${entry.id}" value="${startVal}" placeholder="Start">
          </td>
          <td>
            <input type="number" class="tbl-reading-input tbl-end-reading" data-id="${entry.id}" value="${endVal}" placeholder="End">
          </td>
          <td>
            <strong style="color: ${isError ? 'var(--accent-red)' : 'var(--accent-green)'}; font-size: 1rem;">${units} Units</strong>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm edit-entry-btn" data-id="${entry.id}" title="Edit Full Entry">✏️ Edit</button>
              <button class="btn btn-danger btn-sm delete-entry-btn" data-id="${entry.id}" title="Delete Entry">🗑️</button>
            </div>
          </td>
        `;

        this.registerTableBody.appendChild(tr);
      });

      this.registerTableBody.querySelectorAll('.tbl-date-input').forEach(input => {
        input.addEventListener('change', () => {
          const id = input.dataset.id;
          const val = input.value;
          if (id && val) {
            store.updateEntry(id, { date: val, isReviewed: true });
            this.showToast('Date updated & row verified ✅');
          }
        });
      });

      this.registerTableBody.querySelectorAll('.tbl-member-select').forEach(sel => {
        sel.addEventListener('change', () => {
          const id = sel.dataset.id;
          const val = sel.value;
          store.updateEntry(id, { userId: val, isReviewed: true });
          this.showToast('Member updated & row verified ✅');
        });
      });

      this.registerTableBody.querySelectorAll('.tbl-start-reading, .tbl-end-reading').forEach(input => {
        input.addEventListener('change', () => {
          const id = input.dataset.id;
          const row = input.closest('tr');
          if (!id || !row) return;

          const startVal = parseFloat(row.querySelector('.tbl-start-reading')?.value) || 0;
          const endVal = parseFloat(row.querySelector('.tbl-end-reading')?.value) || 0;

          store.updateEntry(id, { startReading: startVal, endReading: endVal, isReviewed: true });
          this.showToast('Readings updated & row verified ✅');
        });
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
  }

  openEntryModal(entry = null) {
    if (entry) {
      this.entryIdInput.value = entry.id;
      this.entryDateInput.value = entry.date;
      this.entryUserSelect.value = entry.userId || '';
      this.entryStartInput.value = entry.startReading;
      this.entryEndInput.value = entry.endReading;
      if (this.entryTransferSelect) this.entryTransferSelect.value = entry.transferToUserId || '';
      this.entryNotesInput.value = entry.notes || '';
    } else {
      this.entryIdInput.value = '';
      this.entryDateInput.value = new Date().toISOString().split('T')[0];

      const entries = store.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        this.entryStartInput.value = lastEntry.endReading;
      } else {
        this.entryStartInput.value = '';
      }

      this.entryUserSelect.value = '';
      this.entryEndInput.value = '';
      if (this.entryTransferSelect) this.entryTransferSelect.value = '';
      this.entryNotesInput.value = '';
    }

    if (this.entryModalErrorBox) this.entryModalErrorBox.classList.add('hidden');
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
      const file = files[0];
      const { base64Payload, mimeType } = await fileToBase64(file);
      const apiKey = store.state.geminiApiKey;
      const registeredUsers = store.getUsers();

      let extractedEntries = [];
      if (apiKey && navigator.onLine) {
        this.showOcrProgress('Scanning handwritten Urdu text with Gemini Vision AI...');
        extractedEntries = await performGeminiVisionOCR(base64Payload, mimeType, apiKey, registeredUsers);
      } else {
        this.showOcrProgress('Processing via Local Offline Browser OCR...');
        extractedEntries = await performLocalOfflineOCR(null, registeredUsers);
      }

      if (extractedEntries.length > 0) {
        store.addBulkEntries(extractedEntries);
        this.showToast(`OCR Success! Extracted ${extractedEntries.length} entries.`);
      }
    } catch (err) {
      alert(`OCR Extraction Notice: ${err.message}. Switching to Offline Demo Mode.`);
      this.runDemoOcr();
    } finally {
      this.hideOcrProgress();
    }
  }

  triggerSelectedOcr() {
    if (store.state.geminiApiKey) {
      this.uploadRegisterInput.click();
    } else {
      if (confirm('No Gemini API Key found. Would you like to add an API key in Settings, or use Offline Demo OCR? (OK = Add Key, Cancel = Use Demo OCR)')) {
        this.openSettingsModal();
      } else {
        this.runDemoOcr();
      }
    }
  }

  runDemoOcr() {
    this.showOcrProgress('Simulating handwritten Urdu register OCR extraction...');
    setTimeout(() => {
      const demoEntries = performDemoMockOCR(store.getUsers());
      store.addBulkEntries(demoEntries);
      this.hideOcrProgress();
      this.showToast(`Extracted ${demoEntries.length} sample entries via OCR demo!`);
    }, 1000);
  }

  showOcrProgress(msg) {
    this.ocrProgressBox.classList.remove('hidden');
    this.ocrProgressText.textContent = msg;
  }

  hideOcrProgress() {
    this.ocrProgressBox.classList.add('hidden');
  }

  // --- Expenses Tab Rendering & Logic ---
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
        <div>
          <strong>${item.description}</strong>
        </div>
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

  // --- Summary & WhatsApp Tab Rendering & Logic ---
  renderSummaryTab() {
    const users = store.getUsers();
    const entries = store.getEntries();
    const expenses = store.getExpenses();

    const calc = calculateBilling(users, entries, expenses);

    // Update Summary Header Cards
    this.summaryTotalUnits.textContent = `${calc.grandTotalUnits.toLocaleString()} Units`;
    this.summaryWapdaBill.textContent = `Rs. ${calc.wapdaBill.toLocaleString()}`;
    this.summaryFixedExpenses.textContent = `Rs. ${calc.totalFixedExpenses.toLocaleString()}`;
    this.summaryGrandTotal.textContent = `Rs. ${calc.grandTotalBillSystem.toLocaleString()}`;

    // Render Summary Table
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
        <td><strong class="text-success" font-size="1.1rem">Rs. ${user.grandTotalBill.toLocaleString()}</strong></td>
      `;
      this.summaryTableBody.appendChild(tr);
    });

    // Render Per-User Breakdown Cards
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
    }).catch(err => {
      alert('Could not copy automatically. Please select text manually.');
    });
  }

  openWhatsAppDirect() {
    const text = encodeURIComponent(this.whatsappPreviewBox.textContent);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  // --- Modals & Toasts Helpers ---
  openModal(modal) {
    modal.classList.add('active');
  }

  closeModal(modal) {
    modal.classList.remove('active');
  }

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

// Start Application Lifecycle
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
