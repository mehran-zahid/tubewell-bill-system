
    (function() {
      'use strict';

      const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const DAY_NAMES_BILINGUAL = {
        'Sunday': 'Sunday (اتوار)',
        'Monday': 'Monday (پیر)',
        'Tuesday': 'Tuesday (منگل)',
        'Wednesday': 'Wednesday (بدھ)',
        'Thursday': 'Thursday (جمعرات)',
        'Friday': 'Friday (جمعہ)',
        'Saturday': 'Saturday (ہفتہ)'
      };

      const URDU_NAME_MAP = {
        'Zahid Javed': 'زاہد جاوید',
        'Amanat Ali': 'امانت علی',
        'Ramzan Anwar': 'رمضان انوار',
        'Muhammad Yasin': 'محمد یاسین',
        'Tariq Mehmood': 'طارق محمود',
        'Chaudhry Abdul Rasheed': 'چوہدری عبدالرشید'
      };

      console.log('%c⚡ TUBEWELL BILL SYSTEM | LIVE SYNC VERIFIED: 2026-08-12-v1.1.2', 'background: #059669; color: #ffffff; font-size: 14px; font-weight: bold; padding: 6px 14px; border-radius: 6px;');

      async function fetchProxyApi(endpoint, options = {}) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Only probe local ports if user is running locally on their PC
        if (isLocalhost) {
          const ports = [8997, 8998, 8999];
          for (const port of ports) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 1200);
              const res = await fetch(`http://localhost:${port}${endpoint}`, { ...options, signal: controller.signal });
              clearTimeout(timeoutId);
              if (res.ok) return await res.json();
            } catch (e) {}
          }
        }

        if (endpoint.includes('fetch_mepco')) {
          const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
          const refNo = urlParams.get('refno');
          if (refNo) {
            const cleanRef = refNo.replace(/\D/g, '');

            // 1. Try Vercel / Cloud Serverless Route /api/fetch_mepco with 20s timeout
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 20000);
              const res = await fetch(`/api/fetch_mepco?refno=${cleanRef}`, { signal: controller.signal });
              clearTimeout(timeoutId);
              if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'success' && data.bill && data.bill.totalAmount > 0) {
                  return data;
                }
              }
            } catch (e) {}

            // 2. Try Public CORS Proxies with 12s timeout
            const targetUrls = [
              `http://ebill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`,
              `http://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`
            ];

            for (const targetUrl of targetUrls) {
              try {
                const aoUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                const res = await fetch(aoUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                  const json = await res.json();
                  const htmlText = json.contents || '';
                  if (htmlText.length > 300) {
                    const amountMatch = htmlText.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                                        htmlText.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                                        htmlText.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                                        htmlText.match(/Rs\.?\s*([\d,]{4,})/i);
                    const dueDateMatch = htmlText.match(/DUE\s*DATE[:\s]*(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i) ||
                                         htmlText.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);
                    const nameMatch = htmlText.match(/NAME[:\s]*([A-Z\s]{4,30})/i);
                    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
                    if (amount > 0) {
                      return {
                        status: 'success',
                        bill: {
                          referenceNo: cleanRef,
                          name: nameMatch ? nameMatch[1].trim() : 'MEPCO Consumer',
                          totalAmount: amount,
                          amountWithinDueDate: amount,
                          dueDate: dueDateMatch ? dueDateMatch[1] : '—'
                        }
                      };
                    }
                  }
                }
              } catch (e) {}

              const corsProxies = [
                url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
              ];

              for (const makeProxyUrl of corsProxies) {
                try {
                  const proxyUrl = makeProxyUrl(targetUrl);
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 12000);
                  const res = await fetch(proxyUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  clearTimeout(timeoutId);

                  if (res.ok) {
                    const htmlText = await res.text();
                    if (htmlText.length > 500) {
                      const amountMatch = htmlText.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                                          htmlText.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                                          htmlText.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                                          htmlText.match(/Rs\.?\s*([\d,]{4,})/i);
                      const dueDateMatch = htmlText.match(/DUE\s*DATE[:\s]*(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i) ||
                                           htmlText.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);
                      const nameMatch = htmlText.match(/NAME[:\s]*([A-Z\s]{4,30})/i);
                      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
                      if (amount > 0) {
                        return {
                          status: 'success',
                          bill: {
                            referenceNo: cleanRef,
                            name: nameMatch ? nameMatch[1].trim() : 'MEPCO Consumer',
                            totalAmount: amount,
                            amountWithinDueDate: amount,
                            dueDate: dueDateMatch ? dueDateMatch[1] : '—'
                          }
                        };
                      }
                    }
                  }
                } catch (err) {}
              }
            }
          }
        }

        throw new Error('Could not automatically reach MEPCO PITC server online. Please enter your WAPDA bill amount manually.');
      }

      function getBilingualUserName(name) {
        if (!name) return '';
        if (name.includes('/') || name.includes('(')) return name;
        const urduName = URDU_NAME_MAP[name];
        if (urduName) return `${name} (${urduName})`;
        return name;
      }

      function sanitizePhoneForWa(phoneStr) {
        if (!phoneStr) return '';
        let clean = phoneStr.replace(/\D/g, '');
        if (clean.startsWith('0')) {
          clean = '92' + clean.substring(1);
        }
        return clean;
      }

      function parse24to12(time24) {
        if (!time24) return { hour12: 8, minute: '00', ampm: 'AM' };
        let [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        let hour12 = h % 12;
        hour12 = hour12 ? hour12 : 12;
        const minute = String(m || 0).padStart(2, '0');
        return { hour12, minute, ampm };
      }

      function convert12to24(hour12, minute, ampm) {
        let h = parseInt(hour12, 10);
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }

      function populate12HourOptions(hourSelect, minSelect) {
        if (hourSelect.options.length === 0) {
          for (let i = 1; i <= 12; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = String(i).padStart(2, '0');
            hourSelect.appendChild(opt);
          }
        }
        if (minSelect.options.length === 0) {
          for (let m = 0; m < 60; m += 5) {
            const opt = document.createElement('option');
            const valStr = String(m).padStart(2, '0');
            opt.value = valStr;
            opt.textContent = valStr;
            minSelect.appendChild(opt);
          }
        }
      }

      function create12HourPickerHTML(prefixId, current24Time) {
        const { hour12, minute, ampm } = parse24to12(current24Time);

        let hoursHtml = '';
        for (let i = 1; i <= 12; i++) {
          const val = String(i);
          hoursHtml += `<option value="${val}" ${i === hour12 ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`;
        }

        let minsHtml = '';
        for (let m = 0; m < 60; m += 5) {
          const mStr = String(m).padStart(2, '0');
          const isSelected = Math.abs(parseInt(minute, 10) - m) < 3;
          minsHtml += `<option value="${mStr}" ${isSelected ? 'selected' : ''}>${mStr}</option>`;
        }

        return `
          <div class="time-picker-12h-group">
            <select class="${prefixId}-hour" data-prefix="${prefixId}">${hoursHtml}</select>
            <span style="font-weight: 700; color: var(--text-secondary);">:</span>
            <select class="${prefixId}-min" data-prefix="${prefixId}">${minsHtml}</select>
            <select class="${prefixId}-ampm ampm-select" data-prefix="${prefixId}">
              <option value="AM" ${ampm === 'AM' ? 'selected' : ''}>AM</option>
              <option value="PM" ${ampm === 'PM' ? 'selected' : ''}>PM</option>
            </select>
          </div>
        `;
      }

      const defaultUsers = [];

      const defaultEntries = [];

      const defaultExpenses = {
        billingMonth: '2026-08',
        billingMonthLabel: 'August 2026',
        wapdaBill: 0,
        wapdaRefNo: '',
        ruCode: 'R',
        fixedExpenses: []
      };

      const STORAGE_KEY = 'turbine_bill_system_v36_clean_import_test';

      function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60) + (m || 0);
      }

      function minutesToTimeStr(mins) {
        let total = (mins + 1440 * 10) % 1440;
        let h = Math.floor(total / 60);
        let m = total % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }

      function getTimeOfDayUrdu(timeStr) {
        if (!timeStr) return '';
        const [h] = timeStr.split(':').map(Number);
        if (h >= 5 && h < 12) return 'صبح';
        if (h >= 12 && h < 16) return 'دوپہر';
        if (h >= 16 && h < 20) return 'شام';
        return 'رات';
      }

      function formatTime12h(timeStr) {
        if (!timeStr) return '';
        let [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const periodUrdu = getTimeOfDayUrdu(timeStr);
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${String(m).padStart(2, '0')} ${ampm} (${periodUrdu})`;
      }

      function getWeeklyMinuteOffset(dayStr, timeStr) {
        const dayIdx = DAYS_ORDER.indexOf(dayStr);
        const validDayIdx = dayIdx !== -1 ? dayIdx : 0;
        return (validDayIdx * 1440) + timeToMinutes(timeStr);
      }

      function calculateSlotDurationMinutes(startDay, startTime, endDay, endTime) {
        const startOffset = getWeeklyMinuteOffset(startDay, startTime);
        let endOffset = getWeeklyMinuteOffset(endDay, endTime);

        if (endOffset <= startOffset) {
          endOffset += (7 * 1440);
        }

        return endOffset - startOffset;
      }

      function formatDurationText(totalMins) {
        if (totalMins <= 0) return '0 Minutes';
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        if (m === 0) return `${h} Hours`;
        return `${h} Hours ${m} minutes`;
      }

      class Store {
        constructor() {
          this.listeners = [];
          this.sessionKey = '';
          this.sanitizeLocalStorage();
          this.state = this.loadState();
          this.saveState();
        }

        sanitizeLocalStorage() {
          try {
            localStorage.removeItem('gemini_api_key');
            sessionStorage.removeItem('gemini_api_key');

            const allKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k) allKeys.push(k);
            }

            for (const key of allKeys) {
              const raw = localStorage.getItem(key);
              if (raw && (raw.includes('geminiApiKey') || raw.includes('sessionOnlyKey'))) {
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed && typeof parsed === 'object') {
                    delete parsed.geminiApiKey;
                    delete parsed.sessionOnlyKey;
                    localStorage.setItem(key, JSON.stringify(parsed));
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
        }

        getDefaultState() {
          return {
            users: JSON.parse(JSON.stringify(defaultUsers)),
            entries: JSON.parse(JSON.stringify(defaultEntries)),
            expenses: JSON.parse(JSON.stringify(defaultExpenses)),
            activeTab: 'users',
            theme: 'light'
          };
        }

        loadState() {
          try {
            const keysToTry = [
              STORAGE_KEY,
              'turbine_bill_system_v36_clean_import_test',
              'tubewell_bill_system_v25_ai_vision_multiport',
              'tubewell_bill_system_v24_ai_ocr_only',
              'tubewell_bill_system_v23_dynamic_only',
              'tubewell_bill_system_v22_clean_readonly',
              'tubewell_bill_system_v21_12h_touch_picker',
              'tubewell_bill_system_v20_clean_modal',
              'tubewell_bill_system_v19_phone_number',
              'tubewell_bill_system_v18_bilingual_wa',
              'tubewell_bill_system_v17_bilingual_schedule'
            ];

            for (const key of keysToTry) {
              const saved = localStorage.getItem(key);
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
                  delete parsed.geminiApiKey;
                  delete parsed.sessionOnlyKey;
                  const loadedState = {
                    ...this.getDefaultState(),
                    ...parsed
                  };
                  delete loadedState.geminiApiKey;
                  delete loadedState.sessionOnlyKey;
                  if (!localStorage.getItem('user_explicit_theme_set')) {
                    loadedState.theme = 'light';
                  }
                  return loadedState;
                }
              }
            }
          } catch (e) {}
          return this.getDefaultState();
        }

        saveState() {
          try {
            const toSave = { ...this.state };
            delete toSave.geminiApiKey;
            delete toSave.sessionOnlyKey;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
          } catch (e) {}
          this.notify();
        }

        subscribe(listener) {
          this.listeners.push(listener);
        }

        async syncUsersWithServer() {
          try {
            const res = await fetch('/api/users');
            if (res.ok) {
              const data = await res.json();
              if (data && data.status === 'success' && Array.isArray(data.users) && data.users.length > 0) {
                this.state.users = data.users.map(u => ({
                  ...u,
                  userCode: u.userCode || u.code || '01',
                  nameEn: u.nameEn || u.name || 'Member',
                  nameUr: u.nameUr || u.nameUrdu || '',
                  phone: u.phone || '',
                  defaultHoursPerWeek: u.defaultHoursPerWeek !== undefined ? u.defaultHoursPerWeek : (u.durationHours || 12)
                }));
                this.autoRechainSchedule();
                this.saveState();
              }
            }
          } catch (e) {
            console.warn('Server users sync error:', e.message);
          }
        }

        async saveUsersToServer(adminPassword) {
          if (!adminPassword) return { success: false, error: 'Password required' };
          try {
            const res = await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                password: adminPassword,
                users: this.state.users
              })
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data && data.status === 'success') {
              return { success: true };
            } else {
              return { success: false, error: data?.error || `Server HTTP ${res.status}` };
            }
          } catch (e) {
            return { success: false, error: e.message };
          }
        }

        getUsers() { return this.state.users; }
        getUserById(id) { return this.state.users.find(u => u.id === id); }

        getNextUserCode() {
          const existingCodes = new Set(
            this.state.users.map(u => String(u.userCode || u.code || '').trim().padStart(2, '0'))
          );
          let num = 1;
          while (existingCodes.has(String(num).padStart(2, '0'))) {
            num++;
          }
          return String(num).padStart(2, '0');
        }

        isCodeDuplicate(code, excludeId = null) {
          const clean = String(code || '').trim().padStart(2, '0');
          return this.state.users.some(u => u.id !== excludeId && String(u.userCode || u.code || '').trim().padStart(2, '0') === clean);
        }

        autoRechainSchedule() {
          if (this.state.users.length === 0) return;
          const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

          for (let i = 0; i < this.state.users.length; i++) {
            const u = this.state.users[i];
            const dur = (parseInt(u.durationHours, 10) || 0) * 60 + (parseInt(u.durationMinutes, 10) || 0);
            const totalMins = dur > 0 ? dur : (u.totalMinutes || 600);

            if (i === 0) {
              const startOffset = (DAYS_ORDER.indexOf(u.startDay || 'Sunday') * 1440) + timeToMinutes(u.startTime || '08:00');
              const endOffset = startOffset + totalMins;
              const totalWeekly = (endOffset + (7 * 1440 * 10)) % (7 * 1440);
              const endDayIdx = Math.floor(totalWeekly / 1440);
              const minsInDay = totalWeekly % 1440;
              u.endDay = DAYS_ORDER[endDayIdx];
              u.endTime = minutesToTimeStr(minsInDay);
              u.totalMinutes = totalMins;
            } else {
              const prev = this.state.users[i - 1];
              u.startDay = prev.endDay;
              u.startTime = prev.endTime;

              const startOffset = (DAYS_ORDER.indexOf(u.startDay) * 1440) + timeToMinutes(u.startTime);
              const endOffset = startOffset + totalMins;
              const totalWeekly = (endOffset + (7 * 1440 * 10)) % (7 * 1440);
              const endDayIdx = Math.floor(totalWeekly / 1440);
              const minsInDay = totalWeekly % 1440;
              u.endDay = DAYS_ORDER[endDayIdx];
              u.endTime = minutesToTimeStr(minsInDay);
              u.totalMinutes = totalMins;
            }
          }
        }

        ensureUserExists(name) {
          let user = this.state.users.find(u => u.name.toLowerCase() === name.toLowerCase());
          if (!user) {
            const lastUser = this.state.users[this.state.users.length - 1];
            let startDay = 'Sunday', startTime = '08:00';
            if (lastUser) {
              startDay = lastUser.endDay;
              startTime = lastUser.endTime;
            }
            user = this.addUser({ nameEn: name, phone: '', startDay, startTime, durationHours: 4, durationMinutes: 0 });
          }
          return user;
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
          let totalMinutes = (durationHours * 60) + durationMinutes;
          if (totalMinutes <= 0 && user.totalMinutes) totalMinutes = user.totalMinutes;
          if (totalMinutes <= 0) totalMinutes = 600;

          const newUser = {
            id: 'usr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            userCode: userCode,
            code: userCode,
            nameEn: nameEn,
            nameUr: nameUr,
            name: fullName,
            fullName: fullName,
            phone: (user.phone || '').trim(),
            userType: user.userType || 'internal',
            startDay: user.startDay || 'Sunday',
            startTime: user.startTime || '08:00',
            endDay: 'Monday',
            endTime: '01:00',
            durationHours: durationHours || Math.floor(totalMinutes / 60),
            durationMinutes: durationMinutes || (totalMinutes % 60),
            totalMinutes: totalMinutes,
            assignedWeeklyHours: totalMinutes / 60
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
            if (totalMinutes <= 0) totalMinutes = current.totalMinutes || 600;

            this.state.users[index] = {
              ...current,
              ...updatedFields,
              userCode: userCode,
              code: userCode,
              nameEn: nameEn,
              nameUr: nameUr,
              name: fullName,
              fullName: fullName,
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

        deleteUser(id) {
          this.state.users = this.state.users.filter(u => u.id !== id);
          this.autoRechainSchedule();
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
            notes: entry.notes || ''
          };
          this.state.entries.push(newEntry);
          this.saveState();
          return newEntry;
        }

        updateEntry(id, updatedFields) {
          const index = this.state.entries.findIndex(e => e.id === id);
          if (index !== -1) {
            this.state.entries[index] = { ...this.state.entries[index], ...updatedFields };
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

        addBulkEntries(list) {
          const formatted = list.map(e => ({
            id: 'ent-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            date: e.date || new Date().toISOString().split('T')[0],
            userId: e.userId || '',
            startReading: parseFloat(e.startReading) || 0,
            endReading: parseFloat(e.endReading) || 0,
            transferToUserId: e.transferToUserId || null,
            confidence: e.confidence || 'high',
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

        updateWapdaRefDetails(refNo, ruCode = 'R') {
          this.state.expenses.wapdaRefNo = refNo;
          this.state.expenses.ruCode = ruCode;
          this.saveState();
        }

        updateBillingMonth(monthStr, labelStr) {
          this.state.expenses.billingMonth = monthStr;
          if (labelStr) this.state.expenses.billingMonthLabel = labelStr;
          this.saveState();
        }

        addFixedExpense(description, amount) {
          const item = { id: 'fix-' + Date.now(), description: description.trim() || 'General Expense', amount: Math.max(0, parseFloat(amount) || 0) };
          this.state.expenses.fixedExpenses.push(item);
          this.saveState();
        }

        deleteFixedExpense(id) {
          this.state.expenses.fixedExpenses = this.state.expenses.fixedExpenses.filter(f => f.id !== id);
          this.saveState();
        }

        setActiveTab(tab) {
          this.state.activeTab = tab;
          this.saveState();
        }

        setTheme(theme) {
          this.state.theme = theme;
          try {
            localStorage.setItem('user_explicit_theme_set', 'true');
          } catch (e) {}
          this.saveState();
        }

        resetToDefaults() {
          this.sessionKey = '';
          this.state = this.getDefaultState();
          this.saveState();
        }
      }

      const store = new Store();

      function generateBilingualWhatsAppSchedule(users) {
        let msg = `🗓️ *TUBEWELL BARI SCHEDULE / ٹیوب ویل باری شڈول* 🗓️\n====================================\n\n`;
        msg += `📋 *WEEKLY TURN TIME SLOTS (ہفتہ وار باری باری تفصیل):*\n\n`;

        users.forEach((u, idx) => {
          const biliName = getBilingualUserName(u.name);
          const startDayBili = DAY_NAMES_BILINGUAL[u.startDay] || u.startDay;
          const endDayBili = DAY_NAMES_BILINGUAL[u.endDay] || u.endDay;

          const mins = u.totalMinutes || calculateSlotDurationMinutes(u.startDay, u.startTime, u.endDay, u.endTime);
          const durationStr = formatDurationText(mins);

          msg += `👤 *${idx + 1}. ${biliName}*\n`;
          msg += `   🟢 چالو (Start): *${startDayBili}* — ${formatTime12h(u.startTime)}\n`;
          msg += `   🔴 بند (End): *${endDayBili}* — ${formatTime12h(u.endTime)}\n`;
          msg += `   ⏱️ کل دورانیہ (Duration): *${durationStr}*\n\n`;
        });

        msg += `====================================\n`;
        msg += `⚠️ *Note:* Meharbani farmakar apni bari par waqt ki pabandi karein.\n`;
        msg += `شکرگزار: ٹیوب ویل انتظامیہ 🙏\n`;

        return msg;
      }

      function calculateBilling(users, entries, expenses) {
        const wapdaBill = Math.max(0, parseFloat(expenses.wapdaBill) || 0);
        const fixedExpensesList = Array.isArray(expenses.fixedExpenses) ? expenses.fixedExpenses : [];
        const totalFixedExpenses = fixedExpensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        let totalInternalEffectiveHours = 0;
        const userHoursMap = new Map();

        users.forEach(user => {
          const isInternal = user.userType !== 'external';
          const mins = user.totalMinutes || calculateSlotDurationMinutes(user.startDay, user.startTime, user.endDay, user.endTime);
          const hours = mins / 60;
          userHoursMap.set(user.id, hours);
          if (isInternal) {
            totalInternalEffectiveHours += hours;
          }
        });

        const userUnitsMap = new Map();
        const userTransferredInCountMap = new Map();

        users.forEach(user => {
          userUnitsMap.set(user.id, 0);
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
            grandTotalUnits += units;
          }
        });

        const userBreakdowns = users.map(user => {
          const isInternal = user.userType !== 'external';
          const units = userUnitsMap.get(user.id) || 0;
          const hours = userHoursMap.get(user.id) || 0;
          const transferredIn = userTransferredInCountMap.get(user.id) || 0;

          const unitsPercentage = grandTotalUnits > 0 ? (units / grandTotalUnits) * 100 : 0;
          const usageBillShare = grandTotalUnits > 0 ? (units / grandTotalUnits) * wapdaBill : 0;

          let hoursPercentage = 0;
          let fixedBillShare = 0;

          if (isInternal) {
            hoursPercentage = totalInternalEffectiveHours > 0 ? (hours / totalInternalEffectiveHours) * 100 : 0;
            fixedBillShare = totalInternalEffectiveHours > 0 ? (hours / totalInternalEffectiveHours) * totalFixedExpenses : 0;
          }

          const grandTotalBill = usageBillShare + fixedBillShare;
          const mins = user.totalMinutes || calculateSlotDurationMinutes(user.startDay, user.startTime, user.endDay, user.endTime);

          const uCode = user.userCode || user.code || '01';
          const uNameEn = user.nameEn || user.name || '';
          const uNameUr = user.nameUr || '';
          let fullName = uNameEn && uNameUr ? `${uNameEn} (${uNameUr})` : (user.name || uNameEn || uNameUr || 'Member');

          return {
            userId: user.id,
            userCode: uCode,
            nameEn: uNameEn,
            nameUr: uNameUr,
            fullName: fullName,
            userType: user.userType || 'internal',
            phone: user.phone || '',
            startDay: user.startDay,
            startTime: user.startTime,
            endDay: user.endDay,
            endTime: user.endTime,
            formattedDuration: formatDurationText(mins),
            effectiveHours: Math.round(hours * 100) / 100,
            hoursPercentage: Math.round(hoursPercentage * 10) / 10,
            unitsConsumed: units,
            unitsPercentage: Math.round(unitsPercentage * 10) / 10,
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
          grandTotalBillSystem: wapdaBill + totalFixedExpenses,
          grandTotalUnits,
          totalEffectiveHours: Math.round(totalInternalEffectiveHours * 100) / 100,
          userBreakdowns
        };
      }

      function generateWhatsAppMessage(calculatedData, formatLang = 'roman') {
        const { billingMonthLabel, wapdaBill, totalFixedExpenses, grandTotalBillSystem, grandTotalUnits, userBreakdowns } = calculatedData;
        const expenses = store.getExpenses();
        const fixedExpensesList = Array.isArray(expenses.fixedExpenses) ? expenses.fixedExpenses : [];
        const dateHeader = billingMonthLabel || 'Current Month';

        if (formatLang === 'urdu') {
          let msg = `⚡ *ٹربائن بل خلاصہ — ${dateHeader}* ⚡\n`;
          msg += `====================================\n\n`;
          msg += `📊 *کل اخراجات کا خلاصہ:* \n`;
          msg += `• کل استعمال شدہ یونٹ: *${grandTotalUnits.toLocaleString()} یونٹ*\n`;
          msg += `• میپکو بجلی بل: *Rs. ${Math.round(wapdaBill).toLocaleString()}*\n`;

          if (fixedExpensesList.length > 0) {
            msg += `\n🔧 *تفصیل اضافی اخراجات:*\n`;
            fixedExpensesList.forEach(item => {
              msg += `  • ${item.description}: Rs. ${parseFloat(item.amount || 0).toLocaleString()}\n`;
            });
            msg += `  • *کل اضافی اخراجات:* *Rs. ${Math.round(totalFixedExpenses).toLocaleString()}*\n`;
          } else if (totalFixedExpenses > 0) {
            msg += `• کل اضافی اخراجات: *Rs. ${Math.round(totalFixedExpenses).toLocaleString()}*\n`;
          }

          msg += `💰 *کل واجب الادا رقم:* *Rs. ${Math.round(grandTotalBillSystem).toLocaleString()}*\n`;
          msg += `====================================\n\n`;
          msg += `📋 *تمام ممبران کے واجب الادا بل:* \n\n`;

          userBreakdowns.forEach((user, index) => {
            const typeLabel = user.userType === 'external' ? ' (خریدار)' : '';
            const displayName = user.nameUr || user.fullName || user.nameEn || 'ممبر';
            msg += `👤 *${index + 1}. ${displayName}${typeLabel}*\n`;
            msg += `   • باری وقت: ${user.effectiveHours} گھنٹے | یونٹ: ${user.unitsConsumed} (${user.unitsPercentage}%)\n`;
            msg += `   • بجلی بل: Rs. ${Math.round(user.usageBillShare).toLocaleString()} | اضافی اخراجات: Rs. ${Math.round(user.fixedBillShare).toLocaleString()}\n`;
            msg += `   👉 *کل واجب الادا بل: Rs. ${Math.round(user.grandTotalBill).toLocaleString()}*\n\n`;
          });

          msg += `------------------------------------\n`;
          msg += `⚠️ تمام ممبران سے گزارش ہے کہ اپنا بل بروقت جمع کروائیں۔\n`;
          msg += `شکریہ! — ٹربائن انتظامیہ 🙏\n`;
          return msg;
        } 
        
        if (formatLang === 'english') {
          let msg = `⚡ *TURBINE BILL SUMMARY — ${(dateHeader).toUpperCase()}* ⚡\n`;
          msg += `====================================\n\n`;
          msg += `📊 *OVERALL TOTALS:*\n`;
          msg += `• Total Electricity Consumed: *${grandTotalUnits.toLocaleString()} Units*\n`;
          msg += `• MEPCO Electricity Bill: *Rs. ${Math.round(wapdaBill).toLocaleString()}*\n`;

          if (fixedExpensesList.length > 0) {
            msg += `\n🔧 *Extra Maintenance Expenses Breakdown:*\n`;
            fixedExpensesList.forEach(item => {
              msg += `  • ${item.description}: Rs. ${parseFloat(item.amount || 0).toLocaleString()}\n`;
            });
            msg += `  • *Total Extra Expenses:* *Rs. ${Math.round(totalFixedExpenses).toLocaleString()}*\n`;
          } else if (totalFixedExpenses > 0) {
            msg += `• Total Extra Expenses: *Rs. ${Math.round(totalFixedExpenses).toLocaleString()}*\n`;
          }

          msg += `💰 *Grand Total Collection:* *Rs. ${Math.round(grandTotalBillSystem).toLocaleString()}*\n`;
          msg += `====================================\n\n`;
          msg += `📋 *INDIVIDUAL MEMBER SHARES:* \n\n`;

          userBreakdowns.forEach((user, index) => {
            const typeLabel = user.userType === 'external' ? ' (Customer)' : '';
            const displayName = user.nameEn || user.fullName || 'Member';
            msg += `👤 *${index + 1}. ${displayName}${typeLabel}*\n`;
            msg += `   • Bari Hours: ${user.effectiveHours} hrs | Units: ${user.unitsConsumed} (${user.unitsPercentage}%)\n`;
            msg += `   • Electricity Bill: Rs. ${Math.round(user.usageBillShare).toLocaleString()} | Extra Expenses: Rs. ${Math.round(user.fixedBillShare).toLocaleString()}\n`;
            msg += `   👉 *TOTAL DUE: Rs. ${Math.round(user.grandTotalBill).toLocaleString()}*\n\n`;
          });

          msg += `------------------------------------\n`;
          msg += `⚠️ Please submit your bill payment promptly.\n`;
          msg += `Thank you! — Turbine Management 🙏\n`;
          return msg;
        }

        let msg = `⚡ *TURBINE BILL SUMMARY (ٹربائن بل خلاصہ) — ${dateHeader}* ⚡\n`;
        msg += `====================================\n\n`;
        msg += `📊 *OVERALL TOTALS (کل اخراجات):*\n`;
        msg += `• Total Electricity Units: *${grandTotalUnits.toLocaleString()} Units*\n`;
        msg += `• MEPCO Electricity Bill: *Rs. ${Math.round(wapdaBill).toLocaleString()}*\n`;

        if (fixedExpensesList.length > 0) {
          msg += `\n🔧 *Extra Expenses Breakdown (تفصیل اضافی اخراجات):*\n`;
          fixedExpensesList.forEach(item => {
            msg += `  • ${item.description}: Rs. ${parseFloat(item.amount || 0).toLocaleString()}\n`;
          });
          msg += `  • *Total Extra Expenses:* *Rs. ${Math.round(totalFixedExpenses).toLocaleString()}*\n`;
        } else if (totalFixedExpenses > 0) {
          msg += `• Total Extra Expenses: *Rs. ${Math.round(totalFixedExpenses).toLocaleString()}*\n`;
        }

        msg += `💰 *Grand Total Bill:* *Rs. ${Math.round(grandTotalBillSystem).toLocaleString()}*\n`;
        msg += `====================================\n\n`;
        msg += `📋 *PER MEMBER BILL BREAKDOWN (تمام ممبران کے بل):*\n\n`;

        userBreakdowns.forEach((user, index) => {
          const typeLabel = user.userType === 'external' ? ' (External Customer/خریدار)' : '';
          const displayName = user.fullName || user.nameEn || user.nameUr || 'Member';
          msg += `👤 *${index + 1}. ${displayName}${typeLabel}*\n`;
          msg += `   • Allocated Slot: ${user.effectiveHours} hrs | Usage: ${user.unitsConsumed} Units (${user.unitsPercentage}%)\n`;
          msg += `   • Electricity Bill: Rs. ${Math.round(user.usageBillShare).toLocaleString()} | Extra Expenses: Rs. ${Math.round(user.fixedBillShare).toLocaleString()}\n`;
          msg += `   👉 *TOTAL DUE (کل واجب الادا): Rs. ${Math.round(user.grandTotalBill).toLocaleString()}*\n\n`;
        });

        msg += `------------------------------------\n`;
        msg += `⚠️ Meharbani farmakar apna bill waqt par jama karwayen.\n`;
        msg += `Shukriya! — Turbine Management 🙏\n`;

        return msg;
      }

      function generateSingleUserWhatsAppMessage(user, dateHeader, entries = []) {
        const displayName = user.fullName || user.nameUr || user.nameEn || 'Member';
        const isExternal = user.userType === 'external';

        const userEntries = entries.filter(e => {
          if (e.userId === user.userId) return true;
          if (!e.userId && user.nameUr && (e.rawName || '').includes(user.nameUr)) return true;
          return false;
        });

        let msg = `💧 *ٹربائن بل تفصیلات — ${displayName}* 💧\n`;
        msg += `📅 *بلنگ مہینہ:* ${dateHeader}\n`;
        msg += `====================================\n\n`;

        msg += `🕒 *باری کا وقت (Time Slot):*\n`;
        msg += `• 🟢 چالو: ${DAY_NAMES_BILINGUAL[user.startDay] || user.startDay} ${formatTime12h(user.startTime)}\n`;
        msg += `• 🔴 بند: ${DAY_NAMES_BILINGUAL[user.endDay] || user.endDay} ${formatTime12h(user.endTime)}\n`;
        msg += `• کل وقت: *${user.effectiveHours} گھنٹے*\n\n`;

        if (userEntries.length > 0) {
          msg += `📖 *میٹر ریڈنگ و یونٹ تفصیل:* \n`;
          userEntries.forEach(e => {
            const start = parseFloat(e.startReading) || 0;
            const end = parseFloat(e.endReading) || 0;
            const u = Math.max(0, end - start);
            msg += `• *${e.date}:* 🟢 چالو ${start} — 🔴 بند ${end} = *${u} یونٹ*\n`;
          });
          msg += `------------------------------------\n`;
          msg += `⚡ *کل استعمال شدہ یونٹ:* *${user.unitsConsumed} یونٹ (${user.unitsPercentage}%)*\n\n`;
        } else {
          msg += `⚡ *کل استعمال شدہ یونٹ:* *${user.unitsConsumed} یونٹ (${user.unitsPercentage}%)*\n\n`;
        }

        msg += `💰 *بل کی مکمل تفصیل:* \n`;
        msg += `• بجلی بل (MEPCO Share): *Rs. ${Math.round(user.usageBillShare).toLocaleString()}/-*\n`;
        msg += `• دیگر اخراجات (Repair Share): *Rs. ${Math.round(user.fixedBillShare).toLocaleString()}/-* ${isExternal ? '(مستثنیٰ)' : ''}\n`;
        msg += `====================================\n`;
        msg += `👉 *کل واجب الادا بل:* *Rs. ${Math.round(user.grandTotalBill).toLocaleString()}/-*\n`;
        msg += `====================================\n\n`;
        msg += `⚠️ *نوٹ:* مہر بانی فرما کر اپنا بل بروقت جمع کروائیں۔\n`;
        msg += `شکریہ! — ٹربائن انتظامیہ 🙏`;

        return msg;
      }

      function findGlobalUserMatch(searchStr, usersList = []) {
        if (!searchStr) return null;
        const allUsers = (usersList && usersList.length > 0) ? usersList : store.getUsers();
        if (!allUsers || !allUsers.length) return null;

        const sLower = searchStr.toLowerCase().trim();

        // 1. Match by code (e.g. "01", "07", "08")
        const codeMatch = allUsers.find(u => {
          const uCode = (u.userCode || u.code || '').toString().toLowerCase();
          return uCode && (sLower === uCode || sLower.includes(`[${uCode}]`) || sLower.includes(`code ${uCode}`));
        });
        if (codeMatch) return codeMatch;

        // 2. Match by Urdu or English name
        return allUsers.find(u => {
          const nameEn = (u.nameEn || u.name || u.fullName || '').toLowerCase();
          const nameUr = (u.nameUr || '').toLowerCase();
          return (nameEn && (sLower.includes(nameEn) || nameEn.includes(sLower))) ||
                 (nameUr && (sLower.includes(nameUr) || nameUr.includes(sLower)));
        });
      }

      function parseRegisterTextIntoEntries(rawText, registeredUsers = []) {
        if (!rawText || !rawText.trim()) return [];
        let list = [];
        const cleanStr = rawText.replace(/^```json\s*/m, '').replace(/```$/m, '').trim();

        const allUsers = (registeredUsers && registeredUsers.length > 0) ? registeredUsers : store.getUsers();

        function findMatchingUser(searchStr) {
          if (!searchStr || !allUsers.length) return null;
          const sLower = searchStr.toLowerCase().trim();

          // 1. Match by code (e.g. "01", "07", "08")
          const codeMatch = allUsers.find(u => {
            const uCode = (u.userCode || u.code || '').toString().toLowerCase();
            return uCode && (sLower === uCode || sLower.includes(`[${uCode}]`) || sLower.includes(`code ${uCode}`));
          });
          if (codeMatch) return codeMatch;

          // 2. Match by Urdu or English name
          return allUsers.find(u => {
            const nameEn = (u.nameEn || u.name || u.fullName || '').toLowerCase();
            const nameUr = (u.nameUr || '').toLowerCase();
            return (nameEn && (sLower.includes(nameEn) || nameEn.includes(sLower))) ||
                   (nameUr && (sLower.includes(nameUr) || nameUr.includes(sLower)));
          });
        }

        try {
          const parsed = JSON.parse(cleanStr);
          if (Array.isArray(parsed)) {
            list = parsed.map(item => ({
              date: item.date || item.Date || new Date().toISOString().split('T')[0],
              name: item.name || item.Name || item.userName || 'Register Member',
              startReading: parseFloat(item.startReading || item.start_reading || item.StartReading || 0),
              endReading: parseFloat(item.endReading || item.end_reading || item.EndReading || 0),
              notes: 'Parsed from AI JSON output'
            }));
          }
        } catch (e) {}

        if (list.length === 0) {
          const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
          lines.forEach(line => {
            const numbers = line.match(/\b\d{4,7}\b/g);
            if (numbers && numbers.length >= 2) {
              const startReading = parseFloat(numbers[0]);
              const endReading = parseFloat(numbers[1]);

              if (endReading >= startReading) {
                let extractedName = line.replace(/\b\d+\b/g, '').replace(/[->➔]/g, '').trim() || 'Register Member';

                list.push({
                  date: new Date().toISOString().split('T')[0],
                  name: extractedName,
                  startReading: startReading,
                  endReading: endReading,
                  notes: `Parsed line: "${line.substring(0, 30)}"`
                });
              }
            }
          });
        }

        const finalEntries = [];
        list.forEach(item => {
          if (item.startReading >= 0 && item.endReading > 0) {
            const matchedUser = findMatchingUser(item.name);
            finalEntries.push({
              date: item.date || new Date().toISOString().split('T')[0],
              userId: matchedUser ? matchedUser.id : '',
              rawName: item.name,
              startReading: item.startReading,
              endReading: item.endReading,
              transferToUserId: null,
              confidence: matchedUser ? 'high' : 'medium',
              isReviewed: matchedUser ? true : false,
              notes: item.notes || ''
            });
          }
        });

        return finalEntries;
      }

      class App {
        constructor() {
          this.adminSessionAuth = null;
          this.initElements();
          this.bindEvents();
          this.subscribeStore();
          this.render();
          store.syncUsersWithServer().then(() => this.render());
        }

        initElements() {
          this.navBtns = document.querySelectorAll('.step-btn');
          this.tabContents = document.querySelectorAll('.tab-content');

          this.usersTableBody = document.getElementById('usersTableBody');
          this.addUserBtn = document.getElementById('addUserBtn');
          this.importScheduleBtn = document.getElementById('importScheduleBtn');
          this.exportScheduleBtn = document.getElementById('exportScheduleBtn');
          this.importScheduleFileInput = document.getElementById('importScheduleFileInput');

          this.copyScheduleWaBtn = document.getElementById('copyScheduleWaBtn');
          this.sendScheduleWaBtn = document.getElementById('sendScheduleWaBtn');
          this.scheduleWhatsappPreviewBox = document.getElementById('scheduleWhatsappPreviewBox');

          this.userModal = document.getElementById('userModal');
          this.userForm = document.getElementById('userForm');
          this.userModalTitle = document.getElementById('userModalTitle');
          this.userIdInput = document.getElementById('userIdInput');
          this.userCodeInput = document.getElementById('userCodeInput');
          this.autoNextCodeBtn = document.getElementById('autoNextCodeBtn');
          this.userCodeValidationMsg = document.getElementById('userCodeValidationMsg');
          this.userTypeSelect = document.getElementById('userTypeSelect');
          this.userNameEnInput = document.getElementById('userNameEnInput');
          this.userNameUrInput = document.getElementById('userNameUrInput');
          this.userPhoneInput = document.getElementById('userPhoneInput');

          this.userStartDaySelect = document.getElementById('userStartDaySelect');
          this.userStartHourSelect = document.getElementById('userStartHourSelect');
          this.userStartMinSelect = document.getElementById('userStartMinSelect');
          this.userStartAmpmSelect = document.getElementById('userStartAmpmSelect');

          this.userDurationHoursInput = document.getElementById('userDurationHoursInput');
          this.userDurationMinutesInput = document.getElementById('userDurationMinutesInput');
          this.calculatedEndDayTimeBadge = document.getElementById('calculatedEndDayTimeBadge');

          populate12HourOptions(this.userStartHourSelect, this.userStartMinSelect);

          this.userCalculatedDurationDisplay = document.getElementById('userCalculatedDurationDisplay');
          this.validationBadge = document.getElementById('validationBadge');
          this.saveUserSubmitBtn = document.getElementById('saveUserSubmitBtn');

          this.stagedFiles = [];

          this.registerTableBody = document.getElementById('registerTableBody');
          this.triggerUploadBtn = document.getElementById('triggerUploadBtn');
          this.registerImageUpload = document.getElementById('registerImageUpload');
          this.dropzoneBox = document.getElementById('dropzoneBox');
          this.addEntryBtn = document.getElementById('addEntryBtn');
          this.clearEntriesBtn = document.getElementById('clearEntriesBtn');
          this.ocrProgressBox = document.getElementById('ocrProgressBox');
          this.ocrProgressText = document.getElementById('ocrProgressText');
          this.ocrProgressSub = document.getElementById('ocrProgressSub');
          this.batchProgressBar = document.getElementById('batchProgressBar');
          this.batchPercentBadge = document.getElementById('batchPercentBadge');
          this.pageSelectorTabs = document.getElementById('pageSelectorTabs');
          this.scannedPageResults = [];

          this.imageGalleryCard = document.getElementById('imageGalleryCard');
          this.saveWapdaBillBtn = document.getElementById('saveWapdaBillBtn');
          this.openOfficialMepcoPortalBtn = document.getElementById('openOfficialMepcoPortalBtn');
          this.wapdaBillInput = document.getElementById('wapdaBillInput');
          this.billingMonthInput = document.getElementById('billingMonthInput');
          this.fixedExpensesList = document.getElementById('fixedExpensesList');
          this.addFixedExpenseBtn = document.getElementById('addFixedExpenseBtn');
          this.fixedDescInput = document.getElementById('fixedDescInput');
          this.fixedAmountInput = document.getElementById('fixedAmountInput');
          this.entryStartInput = document.getElementById('entryStartInput');
          this.entryEndInput = document.getElementById('entryEndInput');
          this.entryModalErrorBox = document.getElementById('entryModalErrorBox');
          this.entryModalErrorText = document.getElementById('entryModalErrorText');
          this.entryTransferSelect = document.getElementById('entryTransferSelect');
          this.entryNotesInput = document.getElementById('entryNotesInput');

          this.stagedCountBadge = document.getElementById('stagedCountBadge');
          this.stagedThumbnailsGrid = document.getElementById('stagedThumbnailsGrid');
          this.addMorePhotosBtn = document.getElementById('addMorePhotosBtn');
          this.clearGalleryBtn = document.getElementById('clearGalleryBtn');
          this.startAiScanBtn = document.getElementById('startAiScanBtn');

          this.ocrPreviewCard = document.getElementById('ocrPreviewCard');
          this.uploadedImageDisplay = document.getElementById('uploadedImageDisplay');
          this.rawOcrTextarea = document.getElementById('rawOcrTextarea');
          this.reparseOcrBtn = document.getElementById('reparseOcrBtn');
          this.closePreviewBtn = document.getElementById('closePreviewBtn');

          this.entryModal = document.getElementById('entryModal');
          this.entryForm = document.getElementById('entryForm');
          this.entryIdInput = document.getElementById('entryIdInput');
          this.entryDateInput = document.getElementById('entryDateInput');
          this.entryUserSelect = document.getElementById('entryUserSelect');
          this.quickAddUserBtn = document.getElementById('quickAddUserBtn');

          this.saveWapdaBillBtn = document.getElementById('saveWapdaBillBtn');
          this.openOfficialMepcoPortalBtn = document.getElementById('openOfficialMepcoPortalBtn');
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

          this.resetSampleDataBtn = document.getElementById('resetSampleDataBtn');
          this.themeToggleBtn = document.getElementById('themeToggleBtn');
        }

        getModalStartTime24() {
          return convert12to24(this.userStartHourSelect.value, this.userStartMinSelect.value, this.userStartAmpmSelect.value);
        }

        setModalStartTime24(time24) {
          const { hour12, minute, ampm } = parse24to12(time24);
          this.userStartHourSelect.value = hour12;
          this.userStartMinSelect.value = minute;
          this.userStartAmpmSelect.value = ampm;
        }

        async requestAdminAuth() {
          if (this.adminSessionAuth) {
            return true;
          }

          const modal = document.getElementById('adminAuthModal');
          const form = document.getElementById('adminAuthForm');
          const passInput = document.getElementById('adminAuthPasswordInput');
          const errorBox = document.getElementById('adminAuthErrorBox');
          const submitBtn = document.getElementById('adminAuthSubmitBtn');

          if (!modal || !form || !passInput) return true;

          passInput.value = '';
          if (errorBox) {
            errorBox.textContent = '';
            errorBox.classList.add('hidden');
          }

          this.openModal(modal);
          setTimeout(() => passInput.focus(), 100);

          return new Promise((resolve) => {
            let handled = false;

            const cleanup = () => {
              form.removeEventListener('submit', onSubmit);
              const cancelBtns = modal.querySelectorAll('.modal-close, .modal-cancel');
              cancelBtns.forEach(btn => btn.removeEventListener('click', onCancel));
            };

            const onCancel = () => {
              if (handled) return;
              handled = true;
              cleanup();
              this.closeModal(modal);
              resolve(false);
            };

            const onSubmit = async (e) => {
              e.preventDefault();
              const pwd = passInput.value.trim();
              if (!pwd) return;

              if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⏳ Verifying...';
              }

              try {
                const res = await fetch('/api/admin_auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: pwd })
                });

                const data = await res.json().catch(() => null);

                if (res.ok && data && data.status === 'success') {
                  this.adminSessionAuth = pwd;
                  handled = true;
                  cleanup();
                  this.closeModal(modal);
                  this.showToast('🔓 Admin Authorized!');
                  resolve(true);
                } else {
                  if (errorBox) {
                    errorBox.textContent = data?.error || 'Invalid Admin Password';
                    errorBox.classList.remove('hidden');
                  }
                  passInput.select();
                }
              } catch (err) {
                if (errorBox) {
                  errorBox.textContent = 'Server verification failed: ' + err.message;
                  errorBox.classList.remove('hidden');
                }
              } finally {
                if (submitBtn) {
                  submitBtn.disabled = false;
                  submitBtn.innerHTML = '🔓 Verify & Continue';
                }
              }
            };

            form.addEventListener('submit', onSubmit);
            const cancelBtns = modal.querySelectorAll('.modal-close, .modal-cancel');
            cancelBtns.forEach(btn => btn.addEventListener('click', onCancel));
          });
        }

        bindEvents() {
          if (this.navBtns) {
            this.navBtns.forEach(btn => {
              btn.addEventListener('click', () => {
                store.setActiveTab(btn.dataset.tab);
              });
            });
          }

          if (this.addUserBtn) {
            this.addUserBtn.addEventListener('click', async () => {
              if (await this.requestAdminAuth()) {
                this.openUserModal();
              }
            });
          }

          if (this.exportScheduleBtn) {
            this.exportScheduleBtn.addEventListener('click', () => this.exportSchedule());
          }
          if (this.importScheduleBtn && this.importScheduleFileInput) {
            this.importScheduleBtn.addEventListener('click', () => this.importScheduleFileInput.click());
            this.importScheduleFileInput.addEventListener('change', (e) => this.handleScheduleImportFile(e));
          }
          if (this.autoNextCodeBtn) {
            this.autoNextCodeBtn.addEventListener('click', () => {
              if (this.userCodeInput) {
                this.userCodeInput.value = store.getNextUserCode();
                this.validateUserCodeInput();
              }
            });
          }

          if (this.userCodeInput) {
            ['input', 'change', 'keyup'].forEach(evt => {
              this.userCodeInput.addEventListener(evt, () => this.validateUserCodeInput());
            });
          }

          if (this.userForm) {
            this.userForm.addEventListener('submit', (e) => this.handleUserFormSubmit(e));
          }

          if (this.quickAddUserBtn) {
            this.quickAddUserBtn.addEventListener('click', () => {
              this.pendingQuickUserSelect = true;
              this.openUserModal();
            });
          }

          if (this.copyScheduleWaBtn) {
            this.copyScheduleWaBtn.addEventListener('click', () => {
              const txt = this.scheduleWhatsappPreviewBox ? this.scheduleWhatsappPreviewBox.textContent : '';
              navigator.clipboard.writeText(txt).then(() => {
                this.showToast('Schedule copied to clipboard!');
              }).catch(() => {
                alert('Copied to clipboard');
              });
            });
          }

          if (this.sendScheduleWaBtn) {
            this.sendScheduleWaBtn.addEventListener('click', () => {
              const txt = encodeURIComponent(this.scheduleWhatsappPreviewBox ? this.scheduleWhatsappPreviewBox.textContent : '');
              window.open(`https://api.whatsapp.com/send?text=${txt}`, '_blank');
            });
          }

          const updateModalDurationAndEndTimeCalc = () => {
            if (!this.userStartDaySelect || !this.userDurationHoursInput) return;
            const sd = this.userStartDaySelect.value;
            const st = this.getModalStartTime24();
            const h = parseInt(this.userDurationHoursInput.value, 10) || 0;
            const m = parseInt(this.userDurationMinutesInput.value, 10) || 0;
            const totalMins = (h * 60) + m;

            if (totalMins <= 0) {
              if (this.userCalculatedDurationDisplay) this.userCalculatedDurationDisplay.textContent = '0 Minutes';
              if (this.calculatedEndDayTimeBadge) this.calculatedEndDayTimeBadge.textContent = 'Invalid Duration';
              if (this.validationBadge) {
                this.validationBadge.className = 'badge badge-danger';
                this.validationBadge.textContent = '❌ Duration Must Be > 0 Mins';
              }
              if (this.saveUserSubmitBtn) this.saveUserSubmitBtn.disabled = true;
              return;
            }

            if (this.userCalculatedDurationDisplay) this.userCalculatedDurationDisplay.textContent = formatDurationText(totalMins);

            const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const startOffset = (DAYS_ORDER.indexOf(sd) * 1440) + timeToMinutes(st);
            const endOffset = startOffset + totalMins;

            const totalWeekly = (endOffset + (7 * 1440 * 10)) % (7 * 1440);
            const endDayIdx = Math.floor(totalWeekly / 1440);
            const minsInDay = totalWeekly % 1440;
            const endDayName = DAYS_ORDER[endDayIdx];
            const endTimeStr = minutesToTimeStr(minsInDay);

            const endDayBili = DAY_NAMES_BILINGUAL[endDayName] || endDayName;
            if (this.calculatedEndDayTimeBadge) this.calculatedEndDayTimeBadge.textContent = `${endDayBili} ${formatTime12h(endTimeStr)}`;

            if (this.validationBadge) {
              this.validationBadge.className = 'badge badge-success';
              this.validationBadge.textContent = '✅ Valid Time Slot';
            }
            if (this.saveUserSubmitBtn) this.saveUserSubmitBtn.disabled = false;
          };

          ['change', 'input'].forEach(evt => {
            if (this.userStartDaySelect) this.userStartDaySelect.addEventListener(evt, updateModalDurationAndEndTimeCalc);
            if (this.userStartHourSelect) this.userStartHourSelect.addEventListener(evt, updateModalDurationAndEndTimeCalc);
            if (this.userStartMinSelect) this.userStartMinSelect.addEventListener(evt, updateModalDurationAndEndTimeCalc);
            if (this.userStartAmpmSelect) this.userStartAmpmSelect.addEventListener(evt, updateModalDurationAndEndTimeCalc);
            if (this.userDurationHoursInput) this.userDurationHoursInput.addEventListener(evt, updateModalDurationAndEndTimeCalc);
            if (this.userDurationMinutesInput) this.userDurationMinutesInput.addEventListener(evt, updateModalDurationAndEndTimeCalc);
          });

          if (this.addEntryBtn) this.addEntryBtn.addEventListener('click', () => this.openEntryModal());
          if (this.entryForm) this.entryForm.addEventListener('submit', (e) => this.handleEntryFormSubmit(e));
          if (this.clearEntriesBtn) {
            this.clearEntriesBtn.addEventListener('click', () => {
              if (confirm('Clear all register entries?')) {
                store.clearAllEntries();
                this.showToast('All register entries cleared.');
              }
            });
          }

          const validateEntryModalReadings = () => {
            if (!this.entryStartInput || !this.entryEndInput) return;
            const startVal = parseFloat(this.entryStartInput.value) || 0;
            const endVal = parseFloat(this.entryEndInput.value) || 0;

            if (endVal > 0 && endVal < startVal) {
              if (this.entryModalErrorBox) this.entryModalErrorBox.classList.remove('hidden');
              if (this.entryModalErrorText) this.entryModalErrorText.innerHTML = `⚠️ <strong>Reading Error:</strong> End reading (${endVal}) is less than start reading (${startVal})!<br><span style="font-family: var(--font-urdu);">غلط ریڈنگ: آخری ریڈنگ پچھلی ریڈنگ سے کم نہیں ہو سکتی۔</span>`;
            } else {
              if (this.entryModalErrorBox) this.entryModalErrorBox.classList.add('hidden');
            }
          };

          ['input', 'change'].forEach(evt => {
            if (this.entryStartInput) this.entryStartInput.addEventListener(evt, validateEntryModalReadings);
            if (this.entryEndInput) this.entryEndInput.addEventListener(evt, validateEntryModalReadings);
          });

          if (this.triggerUploadBtn && this.registerImageUpload) this.triggerUploadBtn.addEventListener('click', () => this.registerImageUpload.click());
          if (this.addMorePhotosBtn && this.registerImageUpload) this.addMorePhotosBtn.addEventListener('click', () => this.registerImageUpload.click());
          if (this.dropzoneBox && this.registerImageUpload) this.dropzoneBox.addEventListener('click', () => this.registerImageUpload.click());

          if (this.dropzoneBox) {
            ['dragenter', 'dragover'].forEach(eventName => {
              this.dropzoneBox.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); this.dropzoneBox.style.borderColor = 'var(--accent-green)'; }, false);
            });
            ['dragleave', 'drop'].forEach(eventName => {
              this.dropzoneBox.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); this.dropzoneBox.style.borderColor = 'var(--accent-blue)'; }, false);
            });

            this.dropzoneBox.addEventListener('drop', (e) => {
              const dt = e.dataTransfer;
              const files = dt.files;
              if (files && files.length > 0) {
                this.addFilesToStaging(files);
              }
            });
          }

          if (this.registerImageUpload) {
            this.registerImageUpload.addEventListener('change', (e) => {
              if (e.target.files && e.target.files.length > 0) {
                this.addFilesToStaging(e.target.files);
                this.registerImageUpload.value = '';
              }
            });
          }

          if (this.clearGalleryBtn) {
            this.clearGalleryBtn.addEventListener('click', () => {
              this.stagedFiles = [];
              this.renderStagedGallery();
              this.showToast('Cleared all staged photos.');
            });
          }

          if (this.startAiScanBtn) {
            this.startAiScanBtn.addEventListener('click', () => {
              if (this.stagedFiles.length === 0) {
                alert('Please select at least one register photo first.');
                return;
              }
              this.processStagedAiScan();
            });
          }

          if (this.closePreviewBtn && this.ocrPreviewCard) {
            this.closePreviewBtn.addEventListener('click', () => this.ocrPreviewCard.classList.add('hidden'));
          }

          if (this.reparseOcrBtn) {
            this.reparseOcrBtn.addEventListener('click', () => {
              this.showToast(`Reparsing not fully implemented for manual text; please use AI scanner.`);
            });
          }

          if (this.wapdaBillInput) {
            this.wapdaBillInput.addEventListener('input', (e) => {
              store.updateWapdaBill(e.target.value);
              this.renderSummaryTab();
            });
          }

          if (this.billingMonthInput) {
            this.billingMonthInput.addEventListener('change', (e) => {
              const dateVal = e.target.value;
              if (dateVal) {
                const [year, month] = dateVal.split('-');
                const dateObj = new Date(year, parseInt(month) - 1, 1);
                const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                store.updateBillingMonth(dateVal, monthLabel);
                this.renderSummaryTab();
              }
            });
          }

          if (this.saveWapdaBillBtn) {
            this.saveWapdaBillBtn.addEventListener('click', () => {
              const amt = parseFloat(this.wapdaBillInput ? this.wapdaBillInput.value : 0) || 0;
              const dateVal = this.billingMonthInput ? this.billingMonthInput.value : '';
              store.updateWapdaBill(amt);
              if (dateVal) {
                const [year, month] = dateVal.split('-');
                const dateObj = new Date(year, parseInt(month) - 1, 1);
                const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                store.updateBillingMonth(dateVal, monthLabel);
              }
              this.renderSummaryTab();
              this.showToast(`✅ WAPDA Bill of Rs. ${Math.round(amt).toLocaleString()} saved successfully!`);
            });
          }

          if (this.openOfficialMepcoPortalBtn) {
            this.openOfficialMepcoPortalBtn.addEventListener('click', () => {
              window.open('http://bill.pitc.com.pk/mepcobill', '_blank');
            });
          }

          if (this.addFixedExpenseBtn) {
            this.addFixedExpenseBtn.addEventListener('click', () => {
              const desc = this.fixedDescInput ? this.fixedDescInput.value : '';
              const amt = this.fixedAmountInput ? this.fixedAmountInput.value : '';
              if (desc && amt) {
                store.addFixedExpense(desc, amt);
                if (this.fixedDescInput) this.fixedDescInput.value = '';
                if (this.fixedAmountInput) this.fixedAmountInput.value = '';
                this.showToast('Fixed maintenance expense added');
              } else {
                alert('Please enter description and amount.');
              }
            });
          }

          if (this.whatsappLangSelect) {
            this.whatsappLangSelect.addEventListener('change', () => this.renderWhatsAppPreview());
          }
          if (this.copyWhatsappBtn) {
            this.copyWhatsappBtn.addEventListener('click', () => this.copyWhatsAppToClipboard());
          }
          if (this.sendWhatsappBtn) {
            this.sendWhatsappBtn.addEventListener('click', () => this.openWhatsAppDirect());
          }
          if (this.printReportBtn) {
            this.printReportBtn.addEventListener('click', () => this.generatePdfReport());
          }

          if (this.resetSampleDataBtn) {
            this.resetSampleDataBtn.addEventListener('click', () => {
              if (confirm('Are you sure you want to reset all system data to defaults?')) {
                store.resetToDefaults();
                if (this.wapdaBillInput) this.wapdaBillInput.value = '';
                this.showToast('Cleared all data. Ready for fresh inputs!');
              }
            });
          }

          if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => {
              const current = store.state.theme;
              const next = current === 'dark' ? 'light' : 'dark';
              store.setTheme(next);
              this.applyTheme(next);
            });
          }

          document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
              if (e.target === overlay) {
                this.closeModal(overlay);
              }
            });
          });

          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                this.closeModal(modal);
              });
            }
          });
        }EventListener('click', () => {
            const desc = this.fixedDescInput.value;
            const amt = this.fixedAmountInput.value;
            if (desc && amt) {
              store.addFixedExpense(desc, amt);
              this.fixedDescInput.value = '';
              this.fixedAmountInput.value = '';
              this.showToast('Fixed maintenance expense added');
            } else {
              alert('Please enter description and amount.');
            }
          });

          this.whatsappLangSelect.addEventListener('change', () => this.renderWhatsAppPreview());
          this.copyWhatsappBtn.addEventListener('click', () => this.copyWhatsAppToClipboard());
          this.sendWhatsappBtn.addEventListener('click', () => this.openWhatsAppDirect());
          this.printReportBtn.addEventListener('click', () => this.generatePdfReport());

          if (this.resetSampleDataBtn) {
            this.resetSampleDataBtn.addEventListener('click', () => {
              if (confirm('Are you sure you want to reset all system data to defaults?')) {
                store.resetToDefaults();
                if (this.wapdaBillInput) this.wapdaBillInput.value = '';
                this.showToast('Cleared all data. Ready for fresh inputs!');
              }
            });
          }

          this.themeToggleBtn.addEventListener('click', () => {
            const current = store.state.theme;
            const next = current === 'dark' ? 'light' : 'dark';
            store.setTheme(next);
            this.applyTheme(next);
          });

          document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
              if (e.target === overlay) {
                this.closeModal(overlay);
              }
            });
          });

          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                this.closeModal(modal);
              });
            }
          });

          document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const modal = btn.closest('.modal-overlay');
              if (modal) this.closeModal(modal);
            });
          });
        }

        addFilesToStaging(fileList) {
          const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
          if (newFiles.length === 0) {
            this.showToast('⚠️ Please select valid image files!');
            return;
          }
          newFiles.forEach(f => {
            f.scanStatus = f.scanStatus || 'pending';
            f.rowsCount = f.rowsCount || 0;
            f.statusText = f.statusText || '⏳ Pending';
            f.statusClass = f.statusClass || 'badge-secondary';
          });
          this.stagedFiles.push(...newFiles);
          this.renderStagedGallery();
          this.showToast(`📸 ${newFiles.length} photo(s) added! Total: ${this.stagedFiles.length}`);
        }

        removeStagedFile(index) {
          if (index >= 0 && index < this.stagedFiles.length) {
            const removed = this.stagedFiles.splice(index, 1);
            this.renderStagedGallery();
            this.showToast(`🗑️ Removed "${removed[0]?.name || 'Photo'}"`);
          }
        }

        async scanSingleStagedFile(index) {
          if (index < 0 || index >= this.stagedFiles.length) return;
          const file = this.stagedFiles[index];
          file.scanStatus = 'pending';
          file.statusText = '⏳ Pending';
          file.statusClass = 'badge-secondary';
          this.renderStagedGallery();
          await this.processStagedAiScan([index]);
        }

        renderStagedGallery() {
          if (this.stagedFiles.length === 0) {
            this.imageGalleryCard.classList.add('hidden');
            return;
          }

          this.imageGalleryCard.classList.remove('hidden');
          this.stagedCountBadge.textContent = `${this.stagedFiles.length} Photo${this.stagedFiles.length > 1 ? 's' : ''}`;
          this.stagedThumbnailsGrid.innerHTML = '';

          this.stagedFiles.forEach((file, index) => {
            const card = document.createElement('div');
            card.id = `thumb-card-${index}`;
            card.style.position = 'relative';
            card.style.background = 'var(--bg-card)';
            card.style.border = file.scanStatus === 'success' ? '2px solid #10b981' : (file.scanStatus === 'failed' ? '2px solid #ef4444' : '1px solid var(--border-glass)');
            card.style.borderRadius = 'var(--radius-md)';
            card.style.padding = '0.5rem';
            card.style.textAlign = 'center';
            card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';

            const statusText = file.statusText || (file.scanStatus === 'success' ? `✅ ${file.rowsCount || 0} Rows` : (file.scanStatus === 'failed' ? '❌ Failed' : '⏳ Pending'));
            const statusClass = file.statusClass || (file.scanStatus === 'success' ? 'badge-success' : (file.scanStatus === 'failed' ? 'badge-danger' : 'badge-secondary'));
            const isFailed = file.scanStatus === 'failed';

            const reader = new FileReader();
            reader.onload = (e) => {
              card.innerHTML = `
                <button class="remove-thumb-btn" data-index="${index}" title="Remove photo" style="position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; border: 2px solid #fff; border-radius: 50%; width: 24px; height: 24px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; z-index: 10;">&times;</button>
                <img src="${e.target.result}" style="width: 100%; height: 110px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-glass); margin-bottom: 0.3rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.2rem;" title="${file.name}">Page ${index + 1}</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem; flex-wrap: wrap;">
                  <span id="thumb-status-${index}" class="badge ${statusClass}" style="font-size: 0.68rem; padding: 0.2rem 0.4rem;">${statusText}</span>
                  ${isFailed ? `<button class="retry-thumb-btn" data-index="${index}" title="Retry scan for this photo" style="background: #3b82f6; color: white; border: none; border-radius: 4px; padding: 0.15rem 0.4rem; font-size: 0.65rem; font-weight: 600; cursor: pointer;">🔄 Retry</button>` : ''}
                </div>
              `;

              const removeBtn = card.querySelector('.remove-thumb-btn');
              if (removeBtn) {
                removeBtn.addEventListener('click', (evt) => {
                  evt.stopPropagation();
                  this.removeStagedFile(index);
                });
              }

              const retryBtn = card.querySelector('.retry-thumb-btn');
              if (retryBtn) {
                retryBtn.addEventListener('click', (evt) => {
                  evt.stopPropagation();
                  this.scanSingleStagedFile(index);
                });
              }
            };
            reader.readAsDataURL(file);
            this.stagedThumbnailsGrid.appendChild(card);
          });
        }

        async compressImageForOcr(file, maxDim = 1200, quality = 0.80) {
          return new Promise((resolve) => {
            if (!file) return resolve('');

            const timer = setTimeout(() => {
              const r = new FileReader();
              r.onload = (e) => resolve(e.target.result);
              r.onerror = () => resolve('');
              r.readAsDataURL(file);
            }, 3000);

            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                clearTimeout(timer);
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                  if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                  } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                  }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
              };
              img.onerror = () => {
                clearTimeout(timer);
                resolve(e.target.result);
              };
              img.src = e.target.result;
            };
            reader.onerror = () => {
              clearTimeout(timer);
              resolve('');
            };
            reader.readAsDataURL(file);
          });
        }

        async processStagedAiScan(targetIndices = null) {
          if (this.stagedFiles.length === 0) return;

          let indicesToScan = [];
          if (Array.isArray(targetIndices)) {
            indicesToScan = targetIndices;
          } else {
            this.stagedFiles.forEach((file, idx) => {
              if (file.scanStatus !== 'success') {
                indicesToScan.push(idx);
              }
            });
          }

          if (indicesToScan.length === 0) {
            this.showToast('✅ All photos in gallery have already been scanned!');
            return;
          }

          if (this.startAiScanBtn) {
            this.startAiScanBtn.disabled = true;
            this.startAiScanBtn.innerHTML = '⏳ Extracting Readings...';
          }

          this.ocrProgressBox.classList.remove('hidden');
          this.ocrPreviewCard.classList.remove('hidden');
          this.batchProgressBar.style.width = '0%';
          this.batchPercentBadge.textContent = '0%';
          if (!this.scannedPageResults) this.scannedPageResults = [];

          let totalUploadedRows = 0;

          try {
            for (let step = 0; step < indicesToScan.length; step++) {
              const i = indicesToScan[step];
              const file = this.stagedFiles[i];

              const currentPct = Math.round((step / indicesToScan.length) * 100);
              this.batchProgressBar.style.width = `${currentPct}%`;
              this.batchPercentBadge.textContent = `${currentPct}%`;

              const currentCard = document.getElementById(`thumb-card-${i}`);
              const currentStatus = document.getElementById(`thumb-status-${i}`);
              if (currentCard) currentCard.style.borderColor = '#3b82f6';
              if (currentStatus) {
                currentStatus.className = 'badge badge-info';
                currentStatus.textContent = '🔄 Reading...';
              }

              file.scanStatus = 'scanning';
              file.statusText = '🔄 Reading...';
              file.statusClass = 'badge-info';

              if (step > 0) {
                this.ocrProgressSub.textContent = `Processing pages...`;
                await new Promise(r => setTimeout(r, 1000));
              }

              this.ocrProgressText.textContent = `Scanning Page ${i + 1} of ${this.stagedFiles.length}: "${file.name}"...`;

              const imageBase64 = await this.compressImageForOcr(file, 1600, 0.85);
              if (!imageBase64) {
                file.scanStatus = 'failed';
                file.statusText = '❌ Invalid Image';
                file.statusClass = 'badge-danger';
                this.renderStagedGallery();
                continue;
              }

              this.uploadedImageDisplay.src = imageBase64;

              let aiRows = null;
              let rawOutput = '';
              let errorMessage = '';

              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 35000);

                const response = await fetch('/api/gemini_ocr', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageB64: imageBase64,
                    mimeType: 'image/jpeg'
                  }),
                  signal: controller.signal
                });
                clearTimeout(timeoutId);

                const ocrRes = await response.json().catch(() => null);

                if (response.ok && ocrRes && ocrRes.status === 'success') {
                  aiRows = ocrRes.rows || [];
                  rawOutput = ocrRes.rawText || '';
                } else {
                  errorMessage = (ocrRes && ocrRes.error) ? ocrRes.error : `Server HTTP ${response.status}`;
                }
              } catch (e) {
                errorMessage = e.name === 'AbortError' ? 'Network timeout after 35s. Please retry.' : e.message;
              }

              if (aiRows && Array.isArray(aiRows) && aiRows.length > 0) {
                const entriesToInsert = [];
                const currentUsers = store.getUsers();

                aiRows.forEach(row => {
                  const nameStr = row.nameEn || row.name || row.userName || 'Register Member';
                  const matchedUser = findGlobalUserMatch(nameStr, currentUsers);
                  const confScore = row.confidenceScore !== undefined ? parseFloat(row.confidenceScore) : (matchedUser ? 0.95 : 0.60);
                  const confLabel = matchedUser ? (confScore >= 0.85 ? 'high' : 'medium') : 'medium';

                  entriesToInsert.push({
                    date: row.date || new Date().toISOString().split('T')[0],
                    userId: matchedUser ? matchedUser.id : '',
                    rawName: nameStr,
                    startReading: parseFloat(row.startReading) || 0,
                    endReading: parseFloat(row.endReading) || 0,
                    transferToUserId: null,
                    confidence: confLabel,
                    confidenceScore: confScore,
                    isReviewed: matchedUser ? true : false,
                    notes: `Extracted from ${file.name}`
                  });
                });

                store.addBulkEntries(entriesToInsert);
                totalUploadedRows += entriesToInsert.length;

                file.scanStatus = 'success';
                file.rowsCount = entriesToInsert.length;
                file.statusText = `✅ ${entriesToInsert.length} Rows`;
                file.statusClass = 'badge-success';

                this.scannedPageResults.push({
                  pageIndex: i,
                  fileName: file.name,
                  imageB64: imageBase64,
                  rowsCount: entriesToInsert.length,
                  rawText: rawOutput || JSON.stringify(aiRows, null, 2)
                });

                this.rawOcrTextarea.value += (this.rawOcrTextarea.value ? '\n\n' : '') + `// Page ${i + 1} ("${file.name}"): ✅ Extracted ${entriesToInsert.length} entries\n` + (rawOutput || JSON.stringify(aiRows, null, 2));
                this.showToast(`📷 Page ${i + 1} scanned: +${entriesToInsert.length} entries`);
              } else {
                file.scanStatus = 'failed';
                file.statusText = `❌ Failed`;
                file.statusClass = 'badge-danger';
                this.rawOcrTextarea.value += (this.rawOcrTextarea.value ? '\n\n' : '') + `// Page ${i + 1} ("${file.name}"): ❌ Error: ${errorMessage || 'Could not extract rows'}`;
              }
              this.renderStagedGallery();
            }
          } catch (globalErr) {
            console.error('OCR Process Error:', globalErr);
            this.showToast(`❌ Scan Error: ${globalErr.message}`);
          } finally {
            this.batchProgressBar.style.width = '100%';
            this.batchPercentBadge.textContent = '100%';
            this.renderPageSelectorTabs();
            this.ocrProgressBox.classList.add('hidden');

            if (this.startAiScanBtn) {
              this.startAiScanBtn.disabled = false;
              this.startAiScanBtn.innerHTML = '⚡ Start AI Reading Extraction';
            }

            if (totalUploadedRows > 0) {
              this.showToast(`🎉 Added ${totalUploadedRows} new entries!`);
            }
          }
        }

        renderPageSelectorTabs() {
          if (!this.scannedPageResults || this.scannedPageResults.length === 0) {
            this.pageSelectorTabs.innerHTML = '';
            return;
          }

          this.pageSelectorTabs.innerHTML = `<span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin-right: 0.5rem;">Select Page View:</span>`;
          this.scannedPageResults.forEach((res, idx) => {
            const btn = document.createElement('button');
            btn.className = `btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-secondary'}`;
            btn.textContent = `Page ${res.pageIndex + 1} (${res.rowsCount} Rows)`;
            btn.addEventListener('click', () => {
              this.pageSelectorTabs.querySelectorAll('button').forEach(b => {
                b.className = 'btn btn-sm btn-secondary';
              });
              btn.className = 'btn btn-sm btn-primary';
              this.uploadedImageDisplay.src = res.imageB64;
              this.rawOcrTextarea.value = `// Page ${res.pageIndex + 1} ("${res.fileName}"): Extracted ${res.rowsCount} rows\n` + res.rawText;
            });
            this.pageSelectorTabs.appendChild(btn);
          });
        }

        subscribeStore() {
          store.subscribe(() => this.render());
        }

        applyTheme(theme) {
          document.documentElement.setAttribute('data-theme', theme);
          this.themeToggleBtn.innerHTML = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
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

        exportSchedule() {
          const users = store.getUsers();
          if (!users || users.length === 0) {
            return alert('No schedule members to export.');
          }

          const exportPayload = {
            appName: "Turbine Bill & Schedule Manager",
            exportDate: new Date().toISOString(),
            version: "1.0",
            totalMembers: users.length,
            users: users.map(u => ({
              userCode: u.userCode || u.code || '01',
              nameEn: u.nameEn || u.name || '',
              nameUr: u.nameUr || '',
              phone: u.phone || '',
              userType: u.userType || 'internal',
              startDay: u.startDay || 'Sunday',
              startTime: u.startTime || '08:00',
              endDay: u.endDay || 'Monday',
              endTime: u.endTime || '01:00',
              durationHours: u.durationHours !== undefined ? u.durationHours : Math.floor((u.totalMinutes || 600) / 60),
              durationMinutes: u.durationMinutes !== undefined ? u.durationMinutes : ((u.totalMinutes || 600) % 60),
              totalMinutes: u.totalMinutes || 600
            }))
          };

          const jsonStr = JSON.stringify(exportPayload, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = `turbine_schedule_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          this.showToast('Schedule exported successfully!');
        }

        handleScheduleImportFile(e) {
          const file = e.target.files && e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const text = event.target.result;
              let importedUsers = [];

              if (file.name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
                const parsed = JSON.parse(text);
                const rawList = Array.isArray(parsed) ? parsed : (parsed.users || parsed.schedule || []);

                if (!Array.isArray(rawList) || rawList.length === 0) {
                  throw new Error('JSON file does not contain a valid users list.');
                }

                importedUsers = rawList.map((u, idx) => {
                  const nameEn = (u.nameEn || u.name || '').trim();
                  const nameUr = (u.nameUr || '').trim();
                  const fullName = nameEn && nameUr ? `${nameEn} (${nameUr})` : (nameEn || nameUr || 'Member');
                  const uCode = String(u.userCode || u.code || (idx + 1)).padStart(2, '0');

                  const h = parseInt(u.durationHours, 10) || 0;
                  const m = parseInt(u.durationMinutes, 10) || 0;
                  let totMins = (h * 60) + m;
                  if (totMins <= 0 && u.totalMinutes) totMins = u.totalMinutes;
                  if (totMins <= 0) totMins = 600;

                  return {
                    id: 'usr-' + Date.now() + '-' + idx,
                    userCode: uCode,
                    code: uCode,
                    nameEn: nameEn,
                    nameUr: nameUr,
                    name: fullName,
                    fullName: fullName,
                    phone: (u.phone || '').trim(),
                    userType: u.userType || 'internal',
                    startDay: u.startDay || 'Sunday',
                    startTime: u.startTime || '08:00',
                    endDay: u.endDay || 'Monday',
                    endTime: u.endTime || '01:00',
                    durationHours: h || Math.floor(totMins / 60),
                    durationMinutes: m || (totMins % 60),
                    totalMinutes: totMins
                  };
                });
              } else {
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length <= 1) throw new Error('CSV file is empty or missing data.');

                const dataLines = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('code')) ? lines.slice(1) : lines;

                importedUsers = dataLines.map((line, idx) => {
                  const parts = line.split(',').map(p => p.trim().replace(/^"/, '').replace(/"$/, ''));
                  const uCode = String(parts[0] || (idx + 1)).padStart(2, '0');
                  const nameEn = parts[1] || `Member ${idx + 1}`;
                  const nameUr = parts[2] || '';
                  const fullName = nameEn && nameUr ? `${nameEn} (${nameUr})` : nameEn;
                  const phone = parts[3] || '';
                  const startDay = parts[4] || 'Sunday';
                  const startTime = parts[5] || '08:00';
                  const h = parseInt(parts[6], 10) || 10;
                  const m = parseInt(parts[7], 10) || 0;
                  const totMins = (h * 60) + m;

                  return {
                    id: 'usr-' + Date.now() + '-' + idx,
                    userCode: uCode,
                    code: uCode,
                    nameEn: nameEn,
                    nameUr: nameUr,
                    name: fullName,
                    fullName: fullName,
                    phone: phone,
                    userType: 'internal',
                    startDay: startDay,
                    startTime: startTime,
                    endDay: 'Monday',
                    endTime: '01:00',
                    durationHours: h,
                    durationMinutes: m,
                    totalMinutes: totMins
                  };
                });
              }

              if (importedUsers.length > 0) {
                store.state.users = importedUsers;
                store.autoRechainSchedule();
                store.saveState();
                this.showToast(`✅ Imported schedule with ${importedUsers.length} members!`);
              }
            } catch (err) {
              alert(`Import failed: ${err.message}`);
            } finally {
              if (this.importScheduleFileInput) this.importScheduleFileInput.value = '';
            }
          };

          reader.readAsText(file);
        }

        renderUsersTab() {
          const users = store.getUsers();
          if (this.usersTableBody) this.usersTableBody.innerHTML = '';

          const waScheduleText = generateBilingualWhatsAppSchedule(users);
          if (this.scheduleWhatsappPreviewBox) this.scheduleWhatsappPreviewBox.textContent = waScheduleText;

          if (users.length === 0) {
            if (this.usersTableBody) this.usersTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No registered members yet. Click "+ Add New Member & Slot".</td></tr>`;
            return;
          }

          users.forEach((user, idx) => {
            const tr = document.createElement('tr');
            const totalMins = user.totalMinutes || ((parseInt(user.durationHours, 10) || 0) * 60 + (parseInt(user.durationMinutes, 10) || 0)) || 600;

            const biliName = user.fullName || `${user.nameEn || user.name} (${user.nameUr || ''})`;
            const uCode = user.userCode || user.code || String(idx + 1).padStart(2, '0');

            const hVal = user.durationHours !== undefined ? user.durationHours : Math.floor(totalMins / 60);
            const mVal = user.durationMinutes !== undefined ? user.durationMinutes : (totalMins % 60);

            tr.innerHTML = `
              <td style="text-align: center;"><strong>${idx + 1}</strong></td>
              <td style="text-align: center;">
                <span class="badge badge-info" style="font-weight: 800; font-size: 0.95rem; padding: 0.35rem 0.65rem;">${uCode}</span>
              </td>
              <td>
                <div style="font-weight: 700; font-size: 0.95rem; line-height: 1.3;">${biliName}</div>
                ${user.phone ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">📱 ${user.phone}</div>` : ''}
              </td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <select class="tbl-select-day tbl-start-day" data-id="${user.id}">
                    <option value="Sunday" ${user.startDay === 'Sunday' ? 'selected' : ''}>Sunday (اتوار)</option>
                    <option value="Monday" ${user.startDay === 'Monday' ? 'selected' : ''}>Monday (پیر)</option>
                    <option value="Tuesday" ${user.startDay === 'Tuesday' ? 'selected' : ''}>Tuesday (منگل)</option>
                    <option value="Wednesday" ${user.startDay === 'Wednesday' ? 'selected' : ''}>Wednesday (بدھ)</option>
                    <option value="Thursday" ${user.startDay === 'Thursday' ? 'selected' : ''}>Thursday (جمعرات)</option>
                    <option value="Friday" ${user.startDay === 'Friday' ? 'selected' : ''}>Friday (جمعہ)</option>
                    <option value="Saturday" ${user.startDay === 'Saturday' ? 'selected' : ''}>Saturday (ہفتہ)</option>
                  </select>
                  <input type="time" class="tbl-time-pick tbl-start-time" data-id="${user.id}" value="${user.startTime}">
                </div>
              </td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <select class="tbl-select-day tbl-end-day" data-id="${user.id}">
                    <option value="Sunday" ${user.endDay === 'Sunday' ? 'selected' : ''}>Sunday (اتوار)</option>
                    <option value="Monday" ${user.endDay === 'Monday' ? 'selected' : ''}>Monday (پیر)</option>
                    <option value="Tuesday" ${user.endDay === 'Tuesday' ? 'selected' : ''}>Tuesday (منگل)</option>
                    <option value="Wednesday" ${user.endDay === 'Wednesday' ? 'selected' : ''}>Wednesday (بدھ)</option>
                    <option value="Thursday" ${user.endDay === 'Thursday' ? 'selected' : ''}>Thursday (جمعرات)</option>
                    <option value="Friday" ${user.endDay === 'Friday' ? 'selected' : ''}>Friday (جمعہ)</option>
                    <option value="Saturday" ${user.endDay === 'Saturday' ? 'selected' : ''}>Saturday (ہفتہ)</option>
                  </select>
                  <input type="time" class="tbl-time-pick tbl-end-time" data-id="${user.id}" value="${user.endTime}">
                </div>
              </td>
              <td>
                <div class="duration-input-group">
                  <input type="number" min="0" max="168" class="tbl-input-num tbl-dur-hours" data-id="${user.id}" value="${hVal}" title="Hours">
                  <span class="duration-unit-label">Hrs</span>
                  <input type="number" min="0" max="59" class="tbl-input-num tbl-dur-mins" data-id="${user.id}" value="${mVal}" title="Minutes">
                  <span class="duration-unit-label">Mins</span>
                </div>
              </td>
              <td style="text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                  <button class="btn btn-secondary btn-sm edit-user-btn" data-id="${user.id}" title="Edit Full Details">✏️ Edit</button>
                  <button class="btn btn-danger btn-sm delete-user-btn" data-id="${user.id}" title="Delete Member">🗑️</button>
                </div>
              </td>
            `;
            if (this.usersTableBody) this.usersTableBody.appendChild(tr);
          });

          if (this.usersTableBody) {
            this.usersTableBody.querySelectorAll('.tbl-start-day, .tbl-start-time, .tbl-end-day, .tbl-end-time, .tbl-dur-hours, .tbl-dur-mins').forEach(input => {
              input.addEventListener('change', async () => {
                const userId = input.dataset.id;
                const row = input.closest('tr');
                if (!userId || !row) return;

                if (!(await this.requestAdminAuth())) {
                  this.renderUsersTab();
                  return;
                }

                const startDay = row.querySelector('.tbl-start-day')?.value;
                const startTime = row.querySelector('.tbl-start-time')?.value;
                const endDay = row.querySelector('.tbl-end-day')?.value;
                const endTime = row.querySelector('.tbl-end-time')?.value;
                const durHours = parseInt(row.querySelector('.tbl-dur-hours')?.value, 10) || 0;
                const durMins = parseInt(row.querySelector('.tbl-dur-mins')?.value, 10) || 0;

                let updatedFields = {
                  startDay: startDay,
                  startTime: startTime,
                  durationHours: durHours,
                  durationMinutes: durMins
                };

                if (input.classList.contains('tbl-end-day') || input.classList.contains('tbl-end-time')) {
                  const calcMins = calculateSlotDurationMinutes(startDay, startTime, endDay, endTime);
                  updatedFields.durationHours = Math.floor(calcMins / 60);
                  updatedFields.durationMinutes = calcMins % 60;
                  updatedFields.totalMinutes = calcMins;
                }

                try {
                  store.updateUser(userId, updatedFields);
                  await store.saveUsersToServer(this.adminSessionAuth);
                  this.showToast('Schedule updated & synced to server ✅');
                } catch (err) {
                  console.error('Failed to update user schedule:', err);
                }
              });
            });

            this.usersTableBody.querySelectorAll('.edit-user-btn').forEach(btn => {
              btn.addEventListener('click', async () => {
                const user = store.getUserById(btn.dataset.id);
                if (user && (await this.requestAdminAuth())) {
                  this.openUserModal(user);
                }
              });
            });

            this.usersTableBody.querySelectorAll('.delete-user-btn').forEach(btn => {
              btn.addEventListener('click', async () => {
                const user = store.getUserById(btn.dataset.id);
                if (user && (await this.requestAdminAuth())) {
                  if (confirm(`Delete member "${user.name}"?`)) {
                    store.deleteUser(user.id);
                    await store.saveUsersToServer(this.adminSessionAuth);
                    this.showToast(`Member ${user.name} deleted & synced to server.`);
                  }
                }
              });
            });
          }
        }

        validateUserCodeInput() {
          if (!this.userCodeInput || !this.userCodeValidationMsg) return true;
          const rawCode = (this.userCodeInput.value || '').trim();
          if (!rawCode) {
            this.userCodeValidationMsg.style.color = '#ef4444';
            this.userCodeValidationMsg.textContent = '⚠️ User ID is required';
            this.userCodeInput.style.borderColor = '#ef4444';
            if (this.saveUserSubmitBtn) this.saveUserSubmitBtn.disabled = true;
            return false;
          }

          const cleanCode = String(rawCode).padStart(2, '0');
          const isDuplicate = store.isCodeDuplicate(cleanCode, this.currentEditingUserId);

          if (isDuplicate) {
            const dupUser = store.state.users.find(u => u.id !== this.currentEditingUserId && String(u.userCode || u.code || '').trim().padStart(2, '0') === cleanCode);
            const dupName = dupUser ? (dupUser.fullName || dupUser.nameEn || dupUser.name || 'Existing Member') : 'another member';
            const nextFree = store.getNextUserCode();

            this.userCodeValidationMsg.style.color = '#ef4444';
            this.userCodeValidationMsg.innerHTML = `❌ ID "${cleanCode}" is taken by <strong>${dupName}</strong>. Click "⚡ Auto ID" for next free ID (<strong>${nextFree}</strong>).`;
            this.userCodeInput.style.borderColor = '#ef4444';
            if (this.saveUserSubmitBtn) this.saveUserSubmitBtn.disabled = true;
            return false;
          } else {
            this.userCodeValidationMsg.style.color = '#10b981';
            this.userCodeValidationMsg.textContent = `✅ User ID "${cleanCode}" Available`;
            this.userCodeInput.style.borderColor = '#10b981';
            if (this.saveUserSubmitBtn) this.saveUserSubmitBtn.disabled = false;
            return true;
          }
        }

        openUserModal(user = null) {
          this.currentEditingUserId = user ? user.id : null;
          if (user) {
            this.userModalTitle.textContent = 'Edit Member & Time Slot / ممبر میں تبدیلی';
            this.userIdInput.value = user.id;
            this.userCodeInput.value = user.userCode || user.code || '01';
            this.userTypeSelect.value = user.userType || 'internal';
            this.userNameEnInput.value = user.nameEn || user.name || '';
            this.userNameUrInput.value = user.nameUr || '';
            this.userPhoneInput.value = user.phone || '';
            this.userStartDaySelect.value = user.startDay || 'Sunday';
            this.setModalStartTime24(user.startTime || '08:00');

            const h = user.durationHours !== undefined ? user.durationHours : Math.floor((user.totalMinutes || 600) / 60);
            const m = user.durationMinutes !== undefined ? user.durationMinutes : ((user.totalMinutes || 600) % 60);
            this.userDurationHoursInput.value = h;
            this.userDurationMinutesInput.value = m;
          } else {
            this.userModalTitle.textContent = 'Add New Member & Time Slot / نیا ممبر شامل کریں';
            this.userIdInput.value = '';
            this.userCodeInput.value = store.getNextUserCode();
            this.userTypeSelect.value = 'internal';
            this.userNameEnInput.value = '';
            this.userNameUrInput.value = '';
            this.userPhoneInput.value = '';

            const users = store.getUsers();
            if (users.length > 0) {
              const lastUser = users[users.length - 1];
              this.userStartDaySelect.value = lastUser.endDay;
              this.setModalStartTime24(lastUser.endTime);
              this.userDurationHoursInput.value = 10;
              this.userDurationMinutesInput.value = 0;
            } else {
              this.userStartDaySelect.value = 'Sunday';
              this.setModalStartTime24('08:00');
              this.userDurationHoursInput.value = 17;
              this.userDurationMinutesInput.value = 0;
            }
          }

          const sd = this.userStartDaySelect.value;
          const st = this.getModalStartTime24();
          const h = parseInt(this.userDurationHoursInput.value, 10) || 0;
          const m = parseInt(this.userDurationMinutesInput.value, 10) || 0;
          const totalMins = (h * 60) + m;

          this.userCalculatedDurationDisplay.textContent = formatDurationText(totalMins);

          const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const startOffset = (DAYS_ORDER.indexOf(sd) * 1440) + timeToMinutes(st);
          const endOffset = startOffset + totalMins;
          const totalWeekly = (endOffset + (7 * 1440 * 10)) % (7 * 1440);
          const endDayIdx = Math.floor(totalWeekly / 1440);
          const minsInDay = totalWeekly % 1440;
          const endDayName = DAYS_ORDER[endDayIdx];
          const endTimeStr = minutesToTimeStr(minsInDay);
          const endDayBili = DAY_NAMES_BILINGUAL[endDayName] || endDayName;

          this.calculatedEndDayTimeBadge.textContent = `${endDayBili} ${formatTime12h(endTimeStr)}`;
          this.validationBadge.className = 'badge badge-success';
          this.validationBadge.textContent = '✅ Valid Time Slot';

          this.validateUserCodeInput();
          this.openModal(this.userModal);
        }

        handleUserFormSubmit(e) {
          e.preventDefault();
          const id = this.userIdInput.value;
          let userCode = (this.userCodeInput.value || '').trim().padStart(2, '0');
          const userType = this.userTypeSelect.value;
          const nameEn = (this.userNameEnInput.value || '').trim();
          const nameUr = (this.userNameUrInput.value || '').trim();
          const phone = (this.userPhoneInput.value || '').trim();
          const startDay = this.userStartDaySelect.value;
          const startTime = this.getModalStartTime24();
          const durationHours = parseInt(this.userDurationHoursInput.value, 10) || 0;
          const durationMinutes = parseInt(this.userDurationMinutesInput.value, 10) || 0;

          if (!nameEn && !nameUr) {
            return alert('Please enter at least one name (English or Urdu).');
          }

          if (store.isCodeDuplicate(userCode, id)) {
            const nextFree = store.getNextUserCode();
            this.userCodeInput.value = nextFree;
            this.validateUserCodeInput();
            return alert(`User ID "${userCode}" is already assigned to another member. User ID has automatically been updated to the next available ID "${nextFree}". Click Save again!`);
          }

          try {
            if (id) {
              store.updateUser(id, { userCode, userType, nameEn, nameUr, phone, startDay, startTime, durationHours, durationMinutes });
            } else {
              const newUser = store.addUser({ userCode, userType, nameEn, nameUr, phone, startDay, startTime, durationHours, durationMinutes });

              if (this.pendingQuickUserSelectForEntry) {
                store.updateEntry(this.pendingQuickUserSelectForEntry, { userId: newUser.id, isReviewed: true });
                this.pendingQuickUserSelectForEntry = null;
              } else if (this.pendingQuickUserSelect) {
                this.pendingQuickUserSelect = false;
                this.openEntryModal();
                this.entryUserSelect.value = newUser.id;
              }
            }

            if (this.adminSessionAuth) {
              store.saveUsersToServer(this.adminSessionAuth).then((res) => {
                if (res.success) {
                  this.showToast(`Member saved & synchronized to server ✅`);
                } else {
                  this.showToast(`Saved locally (Server sync warning: ${res.error}) ⚠️`);
                }
              });
            } else {
              this.showToast(`Member saved ✅`);
            }

            this.closeModal(this.userModal);
          } catch (err) {
            alert(err.message);
          }
        }

        renderRegisterTab() {
          const entries = store.getEntries();
          const users = store.getUsers();

          const userOptionsHtml = users.map(u => {
            const uCode = u.userCode || u.code || '01';
            const nameStr = u.fullName || `${u.nameEn || u.name} (${u.nameUr || ''})`;
            return `<option value="${u.id}">[${uCode}] ${nameStr}</option>`;
          }).join('');

          if (this.entryUserSelect) {
            this.entryUserSelect.innerHTML = `<option value="">-- Select Registered Member --</option>` + userOptionsHtml;
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

              const scannedHint = (!entry.userId && entry.rawName)
                ? `<div style="font-size: 0.73rem; color: var(--accent-amber); font-weight: 700; margin-top: 3px;">🔍 Scanned: "${entry.rawName}"</div>`
                : '';

              const memberDropdownHtml = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <select class="tbl-member-select" data-id="${entry.id}">
                      <option value="">-- Select Member / نام منتخب کریں --</option>
                      ${users.map(u => {
                        const uCode = u.userCode || u.code || '01';
                        const nameStr = u.fullName || `${u.nameEn || u.name} (${u.nameUr || ''})`;
                        const isSel = u.id === entry.userId ? 'selected' : '';
                        return `<option value="${u.id}" ${isSel}>[${uCode}] ${nameStr}</option>`;
                      }).join('')}
                    </select>
                    ${!entry.userId && entry.rawName ? `<button type="button" class="btn btn-secondary btn-sm quick-reg-btn" data-id="${entry.id}" data-name="${(entry.rawName || '').replace(/"/g, '&quot;')}" title="Register this scanned person as a new member" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; white-space: nowrap;">+ Register</button>` : ''}
                  </div>
                  ${scannedHint}
                </div>
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

            this.registerTableBody.querySelectorAll('.quick-reg-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                const rawName = btn.dataset.name;
                const entryId = btn.dataset.id;
                this.pendingQuickUserSelectForEntry = entryId;
                this.openUserModal();
                this.userNameUrInput.value = rawName;
                this.userNameEnInput.value = rawName;
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

          this.entryModalErrorBox.classList.add('hidden');
          this.openModal(this.entryModal);
        }

        handleEntryFormSubmit(e) {
          e.preventDefault();
          const id = this.entryIdInput.value;
          const startReading = parseFloat(this.entryStartInput.value) || 0;
          const endReading = parseFloat(this.entryEndInput.value) || 0;

          const entryData = {
            date: this.entryDateInput.value,
            userId: this.entryUserSelect.value,
            startReading: startReading,
            endReading: endReading,
            transferToUserId: this.entryTransferSelect ? (this.entryTransferSelect.value || null) : null,
            notes: this.entryNotesInput.value,
            confidence: 'high',
            isReviewed: true
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

        renderExpensesTab() {
          const expenses = store.getExpenses();
          this.wapdaBillInput.value = expenses.wapdaBill || '';
          if (expenses.billingMonth) this.billingMonthInput.value = expenses.billingMonth;
          if (expenses.wapdaRefNo) this.wapdaRefNoInput.value = expenses.wapdaRefNo;

          this.fixedExpensesList.innerHTML = '';
          const list = expenses.fixedExpenses || [];

          if (list.length === 0) {
            this.fixedExpensesList.innerHTML = `<div class="text-muted text-center" style="padding: 1rem;">No fixed repair expenses.</div>`;
            return;
          }

          list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex-between mb-1';
            div.style.padding = '0.6rem 0.8rem';
            div.style.background = 'var(--bg-glass)';
            div.style.borderRadius = 'var(--radius-sm)';
            div.style.border = '1px solid var(--border-glass)';
            div.innerHTML = `
              <div><strong>${item.description}</strong></div>
              <div class="flex-center gap-2">
                <strong style="color: var(--accent-green);">Rs. ${parseFloat(item.amount).toLocaleString()}</strong>
                <button class="btn btn-danger btn-sm delete-fixed-btn" data-id="${item.id}">🗑️</button>
              </div>
            `;
            if (this.fixedExpensesList) this.fixedExpensesList.appendChild(div);
          });

          if (this.fixedExpensesList) {
            this.fixedExpensesList.querySelectorAll('.delete-fixed-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                store.deleteFixedExpense(btn.dataset.id);
                this.showToast('Expense removed');
              });
            });
          }
        }

        renderSummaryTab() {
          const users = store.getUsers();
          const entries = store.getEntries();
          const expenses = store.getExpenses();

          const calc = calculateBilling(users, entries, expenses);

          if (this.summaryTotalUnits) this.summaryTotalUnits.textContent = `${calc.grandTotalUnits.toLocaleString()} Units`;
          if (this.summaryWapdaBill) this.summaryWapdaBill.textContent = `Rs. ${Math.round(calc.wapdaBill).toLocaleString()}`;
          if (this.summaryFixedExpenses) this.summaryFixedExpenses.textContent = `Rs. ${Math.round(calc.totalFixedExpenses).toLocaleString()}`;
          if (this.summaryGrandTotal) this.summaryGrandTotal.textContent = `Rs. ${Math.round(calc.grandTotalBillSystem).toLocaleString()}`;

          const screenshotMonthBadge = document.getElementById('screenshotMonthBadge');
          if (screenshotMonthBadge) screenshotMonthBadge.textContent = calc.billingMonthLabel || 'Current Month';

          const screenshotContainer = document.getElementById('screenshotListContainer');
          if (screenshotContainer) {
            screenshotContainer.innerHTML = '';
            calc.userBreakdowns.forEach((user, idx) => {
              const tr = document.createElement('tr');
              tr.style.borderBottom = '1px solid var(--border-glass)';

              const displayName = user.fullName || user.nameUr || user.nameEn || 'Member';
              const isExternal = user.userType === 'external';

              tr.innerHTML = `
                <td style="text-align: center; font-weight: 800; color: var(--accent-blue); padding: 0.75rem 0.5rem;">${idx + 1}</td>
                <td style="padding: 0.75rem 0.5rem;">
                  <strong style="font-size: 1.05rem; color: var(--text-primary);">${displayName}</strong>
                  ${isExternal ? `<div style="font-size: 0.72rem; color: var(--accent-amber); font-weight: 700;">(External Customer/خریدار)</div>` : ''}
                </td>
                <td style="text-align: center; font-weight: 700; color: var(--accent-amber); padding: 0.75rem 0.5rem;">
                  ${user.unitsConsumed.toLocaleString()} Units
                </td>
                <td style="text-align: right; font-weight: 800; font-size: 1.15rem; color: var(--accent-green); padding: 0.75rem 0.5rem;">
                  Rs. ${Math.round(user.grandTotalBill).toLocaleString()}
                </td>
              `;
              screenshotContainer.appendChild(tr);
            });
          }

          if (this.summaryTableBody) this.summaryTableBody.innerHTML = '';

          if (calc.userBreakdowns.length === 0) {
            if (this.summaryTableBody) this.summaryTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No registered members to display.</td></tr>`;
            return;
          }

          calc.userBreakdowns.forEach((user, idx) => {
            const tr = document.createElement('tr');
            const isExternal = user.userType === 'external';
            const displayName = user.fullName || user.nameEn || user.nameUr || 'Member';

            tr.innerHTML = `
              <td style="text-align: center;"><strong>${idx + 1}</strong></td>
              <td>
                <strong>${displayName}</strong>
                ${isExternal ? `<div style="font-size: 0.72rem; color: var(--accent-amber); font-weight: 700;">(External Customer/خریدار)</div>` : ''}
              </td>
              <td><strong>${user.effectiveHours} hrs</strong></td>
              <td><strong>${user.unitsConsumed} Units</strong> (${user.unitsPercentage}%)</td>
              <td>Rs. ${Math.round(user.usageBillShare).toLocaleString()}</td>
              <td>Rs. ${Math.round(user.fixedBillShare).toLocaleString()} ${isExternal ? `<span style="font-size: 0.75rem; color: var(--text-muted);">(Exempt)</span>` : ''}</td>
              <td style="text-align: right;"><strong style="color: var(--accent-green); font-size: 1.05rem;">Rs. ${Math.round(user.grandTotalBill).toLocaleString()}</strong></td>
            `;
            if (this.summaryTableBody) this.summaryTableBody.appendChild(tr);
          });

          if (this.userCardsContainer) this.userCardsContainer.innerHTML = '';
          calc.userBreakdowns.forEach(user => {
            const card = document.createElement('div');
            card.className = 'card';
            const cleanPhone = sanitizePhoneForWa(user.phone);
            const isExternal = user.userType === 'external';
            const displayName = user.fullName || user.nameEn || user.nameUr || 'Member';

            card.innerHTML = `
              <div class="card-header">
                <div>
                  <div class="card-title">
                    ${displayName}
                  </div>
                  <div class="card-subtitle">
                    ${isExternal ? 'Category: External Customer (بیرونی خریدار)' : 'Category: Internal Shareholder (شریک مالک)'}
                  </div>
                </div>
                <span class="badge badge-success" style="font-size: 1.05rem; padding: 0.4rem 0.85rem; font-weight: 800;">
                  Rs. ${Math.round(user.grandTotalBill).toLocaleString()}
                </span>
              </div>
              <div class="grid-2 gap-1 mb-2" style="font-size: 0.9rem;">
                <div>⏱️ <strong>Allocated Slot:</strong> ${user.effectiveHours} hrs</div>
                <div>⚡ <strong>Units Used:</strong> ${user.unitsConsumed} (${user.unitsPercentage}%)</div>
                <div>💡 <strong>Electricity Bill:</strong> Rs. ${Math.round(user.usageBillShare).toLocaleString()}</div>
                <div>🔧 <strong>Extra Expenses:</strong> Rs. ${Math.round(user.fixedBillShare).toLocaleString()} ${isExternal ? '(Exempt)' : ''}</div>
              </div>
              <div class="flex-between">
                <button class="btn btn-secondary btn-sm copy-single-wa" data-id="${user.userId}">
                  📋 Copy Bill Text
                </button>
                ${cleanPhone 
                  ? `<button class="btn btn-primary btn-sm send-direct-wa" data-phone="${cleanPhone}" data-id="${user.userId}" style="background: #25d366; border: none; color: #fff;">💬 Send via WhatsApp</button>`
                  : `<span class="badge badge-warning">No WhatsApp Saved</span>`}
              </div>
            `;
            if (this.userCardsContainer) this.userCardsContainer.appendChild(card);
          });

          if (this.userCardsContainer) {
            this.userCardsContainer.querySelectorAll('.copy-single-wa').forEach(btn => {
              btn.addEventListener('click', () => {
                const uId = btn.dataset.id;
                const uData = calc.userBreakdowns.find(u => u.userId === uId);
                if (uData) {
                  const singleMsg = generateSingleUserWhatsAppMessage(uData, calc.billingMonthLabel, entries);
                  navigator.clipboard.writeText(singleMsg);
                  this.showToast(`Copied WhatsApp bill for ${uData.fullName || uData.nameEn}!`);
                }
              });
            });

            this.userCardsContainer.querySelectorAll('.send-direct-wa').forEach(btn => {
              btn.addEventListener('click', () => {
                const phoneNum = btn.dataset.phone;
                const uId = btn.dataset.id;
                const uData = calc.userBreakdowns.find(u => u.userId === uId);
                if (uData && phoneNum) {
                  const singleMsg = encodeURIComponent(generateSingleUserWhatsAppMessage(uData, calc.billingMonthLabel, entries));
                  window.open(`https://api.whatsapp.com/send?phone=${phoneNum}&text=${singleMsg}`, '_blank');
                }
              });
            });
          }

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

        async generatePdfReport() {
          const users = store.getUsers();
          const entries = store.getEntries();
          const expenses = store.getExpenses();
          const calc = calculateBilling(users, entries, expenses);

          const template = document.getElementById('pdfReportTemplate');
          if (!template) {
            window.print();
            return;
          }

          // 1. Populate Headers & Banner
          const monthLabel = calc.billingMonthLabel || 'August 2026';
          const monthElem = document.getElementById('pdfBillingMonth');
          const dateElem = document.getElementById('pdfGenDate');
          const totalUnitsElem = document.getElementById('pdfTotalUnits');
          const wapdaBillElem = document.getElementById('pdfWapdaBill');
          const fixedExpensesElem = document.getElementById('pdfFixedExpenses');
          const grandTotalElem = document.getElementById('pdfGrandTotal');

          if (monthElem) monthElem.textContent = monthLabel;
          if (dateElem) dateElem.textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          if (totalUnitsElem) totalUnitsElem.textContent = `${calc.totalUnits.toLocaleString()} Units`;
          if (wapdaBillElem) wapdaBillElem.textContent = `Rs. ${Math.round(calc.wapdaBill).toLocaleString()}`;
          if (fixedExpensesElem) fixedExpensesElem.textContent = `Rs. ${Math.round(calc.totalFixedExpenses).toLocaleString()}`;
          if (grandTotalElem) grandTotalElem.textContent = `Rs. ${Math.round(calc.grandTotal).toLocaleString()}`;

          // 2. Populate Member Table
          const tbody = document.getElementById('pdfTableBody');
          const tfoot = document.getElementById('pdfTableFoot');
          if (tbody) tbody.innerHTML = '';
          if (tfoot) tfoot.innerHTML = '';

          if (tbody) {
            if (calc.userBreakdowns.length === 0) {
              tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem; color: #64748b;">No registered members to display.</td></tr>`;
            } else {
              calc.userBreakdowns.forEach((u, idx) => {
                const tr = document.createElement('tr');
                tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                tr.innerHTML = `
                  <td style="padding: 0.45rem; text-align: center; border: 1px solid #e2e8f0; font-weight: 700;">${idx + 1}</td>
                  <td style="padding: 0.45rem; border: 1px solid #e2e8f0;">
                    <div style="font-weight: 700; color: #0f172a;">${u.fullName || u.nameEn}</div>
                  </td>
                  <td style="padding: 0.45rem; text-align: center; border: 1px solid #e2e8f0;">${u.weeklyHours ? u.weeklyHours.toFixed(1) : 0} hrs</td>
                  <td style="padding: 0.45rem; text-align: center; border: 1px solid #e2e8f0; font-weight: 700; color: #0284c7;">${u.unitsConsumed}</td>
                  <td style="padding: 0.45rem; text-align: right; border: 1px solid #e2e8f0;">Rs. ${Math.round(u.wapdaShare).toLocaleString()}</td>
                  <td style="padding: 0.45rem; text-align: right; border: 1px solid #e2e8f0;">Rs. ${Math.round(u.fixedShare).toLocaleString()}</td>
                  <td style="padding: 0.45rem; text-align: right; border: 1px solid #e2e8f0; font-weight: 800; color: #047857; background: #ecfdf5;">Rs. ${Math.round(u.totalPayable).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
              });

              if (tfoot) {
                const footTr = document.createElement('tr');
                footTr.style.background = '#f1f5f9';
                footTr.style.fontWeight = '800';
                footTr.innerHTML = `
                  <td colspan="2" style="padding: 0.5rem; text-align: right; border: 1px solid #cbd5e1;">TOTAL (کل توثیق):</td>
                  <td style="padding: 0.5rem; text-align: center; border: 1px solid #cbd5e1;">${calc.totalWeeklyHours ? calc.totalWeeklyHours.toFixed(1) : 0} hrs</td>
                  <td style="padding: 0.5rem; text-align: center; border: 1px solid #cbd5e1; color: #0284c7;">${calc.totalUnits.toLocaleString()}</td>
                  <td style="padding: 0.5rem; text-align: right; border: 1px solid #cbd5e1;">Rs. ${Math.round(calc.wapdaBill).toLocaleString()}</td>
                  <td style="padding: 0.5rem; text-align: right; border: 1px solid #cbd5e1;">Rs. ${Math.round(calc.totalFixedExpenses).toLocaleString()}</td>
                  <td style="padding: 0.5rem; text-align: right; border: 1px solid #cbd5e1; color: #059669; background: #d1fae5; font-size: 0.95rem;">Rs. ${Math.round(calc.grandTotal).toLocaleString()}</td>
                `;
                tfoot.appendChild(footTr);
              }
            }
          }

          // 3. Populate Itemized Expenses
          const itemizedSec = document.getElementById('pdfItemizedExpensesSection');
          const itemizedBody = document.getElementById('pdfItemizedTableBody');
          if (itemizedBody) itemizedBody.innerHTML = '';

          if (expenses.fixedExpenses && expenses.fixedExpenses.length > 0 && itemizedSec && itemizedBody) {
            itemizedSec.style.display = 'block';
            expenses.fixedExpenses.forEach((exp, idx) => {
              const tr = document.createElement('tr');
              tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              tr.innerHTML = `
                <td style="padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0; font-weight: 600;">${exp.description}</td>
                <td style="padding: 0.4rem 0.6rem; text-align: right; border: 1px solid #e2e8f0; font-weight: 700; color: #dc2626;">Rs. ${Math.round(exp.amount).toLocaleString()}</td>
              `;
              itemizedBody.appendChild(tr);
            });
          } else if (itemizedSec) {
            itemizedSec.style.display = 'none';
          }

          // 4. Generate PDF Report via html2pdf or Native Print Engine
          const pdfBtn = document.getElementById('printReportBtn') || document.getElementById('downloadPdfBtn');
          const originalBtnHtml = pdfBtn ? pdfBtn.innerHTML : '📄 Download PDF Report';
          if (pdfBtn) {
            pdfBtn.disabled = true;
            pdfBtn.innerHTML = '⏳ Generating PDF...';
          }
          this.showToast('📄 Preparing A4 PDF report...');

          try {
            if (window.html2pdf) {
              const cleanMonthName = (monthLabel || 'August_2026').replace(/\s+/g, '_');
              const opt = {
                margin: [5, 5, 5, 5],
                filename: `Tubewell_Bill_${cleanMonthName}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };

              // Make template visible temporarily
              template.style.display = 'block';
              template.style.position = 'fixed';
              template.style.left = '0';
              template.style.top = '0';
              template.style.width = '800px';
              template.style.background = '#ffffff';
              template.style.zIndex = '999999';

              await window.html2pdf().set(opt).from(template).save();
              template.style.display = 'none';
              this.showToast('✅ PDF Report downloaded successfully!');
            } else {
              window.print();
            }
          } catch (err) {
            console.error('html2pdf Export Error, using native print:', err);
            if (template) template.style.display = 'none';
            this.showToast('📄 Opening Save as PDF dialog...');
            window.print();
          } finally {
            if (template) template.style.display = 'none';
            if (pdfBtn) {
              pdfBtn.disabled = false;
              pdfBtn.innerHTML = originalBtnHtml;
            }
          }
        }

        openModal(modal) { modal.classList.add('active'); }
        closeModal(modal) { modal.classList.remove('active'); }

        showToast(message) {
          const container = document.getElementById('toastContainer');
          let toastBox = document.getElementById('toastBox');
          if (!toastBox) {
            toastBox = document.createElement('div');
            toastBox.id = 'toastBox';
            toastBox.className = 'toast-container';
            document.body.appendChild(toastBox);
          }
          const toast = document.createElement('div');
          toast.className = 'toast';
          toast.innerHTML = `<span>✅</span> <div>${message}</div>`;
          toastBox.appendChild(toast);

          setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
          }, 2800);
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          window.app = new App();
        });
      } else {
        window.app = new App();
      }
    })();
  