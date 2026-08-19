import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { initFirebaseAsync } from '../config/firebase';
import { getRegisterEntries } from '../services/registerService';
import { calculateBilling } from '../utils/billingCalculator';
import { Calculator } from '../components/Icons';
import { RefreshCw, CheckCircle2, Edit3, Save, Trash2, Plus, Calendar, Gauge, Receipt, LayoutGrid, List, Lightbulb, Wrench, Coins, Tag, Download, Copy, Share2, ExternalLink, Zap, ShieldAlert, AlertTriangle } from 'lucide-react';
import { getWapdaSettings, updateWapdaSettings, getWapdaBillByMonth, saveWapdaBill, fetchBillFromAPI, normalizeWapdaMonth } from '../services/wapdaService';
import { saveGeneratedBill, getAllGeneratedBills, deleteGeneratedBill } from '../services/billingService';
import CustomDropdown from '../components/CustomDropdown';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';
import PdfDownloadModal from '../components/PdfDownloadModal';
import { useToast } from '../context/ToastContext';
import { SkeletonBillingList } from '../components/Skeleton';
import { toBlob } from 'html-to-image';
import GraphicReceipt from '../components/GraphicReceipt';
import GraphicOverallBill from '../components/GraphicOverallBill';
import { translateToUrdu } from '../utils/translate';

export default function BillingTab({ isAdmin }) {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [billingResult, setBillingResult] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // New State for Role-Based Views
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create'
  const [layoutMode, setLayoutMode] = useState('table'); // 'table' | 'card'
  const [savedBills, setSavedBills] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState('');
  const [editingBillId, setEditingBillId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [isResultStale, setIsResultStale] = useState(false);
  const [shareModalData, setShareModalData] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [generatingPdfLanguage, setGeneratingPdfLanguage] = useState(null);
  const offScreenReceiptRef = useRef(null);
  const offScreenOverallReceiptRef = useRef(null);

  const [wapdaBill, setWapdaBill] = useState('');
  const [wapdaRefNo, setWapdaRefNo] = useState('');
  const [isWapdaManualMode, setIsWapdaManualMode] = useState(false);
  const [isFetchingWapda, setIsFetchingWapda] = useState(false);
  const [wapdaBillDetails, setWapdaBillDetails] = useState(null);
  const [showWapdaHtml, setShowWapdaHtml] = useState(false);
  const [isExtInstalled, setIsExtInstalled] = useState(false);
  const [wapdaMonthSuggestion, setWapdaMonthSuggestion] = useState(null);
  const [wapdaViewModalHtml, setWapdaViewModalHtml] = useState(null); // for published bill modal

  // Helper to load from localStorage
  // Inputs
  const [billingTitle, setBillingTitle] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cycleStartReading, setCycleStartReading] = useState('');
  const [cycleEndReading, setCycleEndReading] = useState('');
  const [fixedExpenses, setFixedExpenses] = useState([]);

  // Clears all form inputs and localStorage after a bill is published
  const resetForm = (latestBills = savedBills) => {
    const d = new Date();
    const defaultTitle = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
    setBillingTitle(defaultTitle);
    
    let defaultStartDate = '';
    let defaultCycleStartReading = '';
    if (latestBills && latestBills.length > 0) {
      const lastBill = latestBills[0];
      if (lastBill.endDate) {
        const nextDate = new Date(lastBill.endDate);
        nextDate.setDate(nextDate.getDate() + 1);
        defaultStartDate = nextDate.toISOString().split('T')[0];
      }
      if (lastBill.cycleEndReading) {
        defaultCycleStartReading = lastBill.cycleEndReading.toString();
      }
    }
    
    setStartDate(defaultStartDate);
    setEndDate('');
    setCycleStartReading(defaultCycleStartReading);
    setCycleEndReading('');
    setWapdaBill('');
    setWapdaRefNo('');
    setWapdaBillDetails(null);
    setFixedExpenses([]);
    setBillingResult(null);
    setIsResultStale(false);
  };

  const [liveWarnings, setLiveWarnings] = useState([]);

  // Mark result as stale when any calculation input changes after a result exists
  useEffect(() => {
    if (billingResult && viewMode === 'create') {
      setIsResultStale(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wapdaBill, fixedExpenses, startDate, endDate, cycleStartReading, cycleEndReading]);

  // Load Saved Bills on Mount
  useEffect(() => {
    const loadBills = async () => {
      try {
        const bills = await getAllGeneratedBills();
        setSavedBills(bills);
        if (bills.length > 0) {
          setSelectedBillId(bills[0].id);
          
          const lastBill = bills[0];
          setStartDate(prev => {
            if (prev) return prev;
            if (lastBill.endDate) {
              const nextDate = new Date(lastBill.endDate);
              nextDate.setDate(nextDate.getDate() + 1);
              return nextDate.toISOString().split('T')[0];
            }
            return '';
          });
          
          setCycleStartReading(prev => {
            if (prev) return prev;
            return lastBill.cycleEndReading ? lastBill.cycleEndReading.toString() : '';
          });
        }
      } catch (e) {
        console.error("Error loading bills", e);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadBills();
  }, []);

  // Update Displayed Results when Selection Changes in List Mode
  useEffect(() => {
    if (viewMode === 'list') {
      if (selectedBillId) {
        const bill = savedBills.find(b => b.id === selectedBillId);
        if (bill) {
          setBillingResult(bill.billingResult);
          setWapdaBillDetails(bill.wapdaBillDetails || null);
          // Don't overwrite the localStorage inputs with the viewed bill, 
          // just display its results.
        }
      } else {
        setBillingResult(null);
        setWapdaBillDetails(null);
      }
    }
  }, [selectedBillId, savedBills, viewMode]);

  // Load WAPDA Settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getWapdaSettings();
        if (settings && settings.refNo) {
          setWapdaRefNo(settings.refNo);
        }
      } catch (e) {
        console.error("Error loading WAPDA settings", e);
      }
    };
    loadSettings();
  }, []);

  // Detect extension on mount
  useEffect(() => {
    const check = () => setIsExtInstalled(!!window.__TUBEWELL_EXT_INSTALLED__);
    check();
    const t = setTimeout(check, 800);
    return () => clearTimeout(t);
  }, []);

  // Auto-fetch WAPDA bill when create mode opens
  useEffect(() => {
    if (viewMode !== 'create') return;
    if (!isExtInstalled) return;
    if (wapdaBillDetails) return; // already loaded

    const autoFetch = async () => {
      const settings = await getWapdaSettings();
      const refNo = settings?.refNo;
      if (!refNo) return;
      setWapdaRefNo(refNo);
      setIsFetchingWapda(true);
      try {
        const fetched = await fetchBillFromAPI(refNo);
        const normalizedKey = fetched.normalizedMonthKey || normalizeWapdaMonth(fetched.month);

        const billData = {
          amount: fetched.amount,
          month: fetched.month,
          readingDate: fetched.readDate || 'Unknown',
          rawHtml: fetched.rawHtml,
          normalizedMonthKey: normalizedKey,
          isManualOverride: false
        };

        // Save to Firestore using the normalized WAPDA month key
        if (normalizedKey) await saveWapdaBill(normalizedKey, billData);

        setWapdaBillDetails(billData);
        setWapdaBill(billData.amount);
        setIsWapdaManualMode(false);

        // Suggest the WAPDA billing month to the user
        if (normalizedKey) {
          setWapdaMonthSuggestion({ raw: fetched.month, normalized: normalizedKey });
        }

        showToast('WAPDA bill auto-fetched ✓', 'success');
      } catch (e) {
        console.error('Auto-fetch WAPDA error:', e);
        // Silent fail — user can still enter manually
      } finally {
        setIsFetchingWapda(false);
      }
    };

    autoFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isExtInstalled]);

  const handleManualWapdaSave = async () => {
    const amountNum = parseFloat(wapdaBill);
    if (isNaN(amountNum) || amountNum < 0) {
      showToast("Please enter a valid number for the WAPDA bill.", "error");
      return;
    }
    
    const billData = {
      amount: amountNum,
      month: billingTitle,
      readingDate: 'Manual Entry',
      rawHtml: null,
      isManualOverride: true
    };
    
    try {
      await saveWapdaBill(billingTitle, billData);
      setWapdaBillDetails(billData);
      setIsWapdaManualMode(false);
      showToast("Manual bill saved.", "success");
    } catch(e) {
      console.error("Save manual bill error:", e);
      showToast("Error saving manual bill", "error");
    }
  };

  // Load Members on mount
  useEffect(() => {
    let unsubscribe;
    const loadMembers = async () => {
      try {
        const { db, firebase } = await initFirebaseAsync();
        unsubscribe = firebase.onSnapshot(firebase.collection(db, 'members'), (snapshot) => {
          const m = [];
          snapshot.forEach(doc => m.push({ id: doc.id, ...doc.data() }));
          setMembers(m);
        });
      } catch (e) {
        console.error("Error loading members", e);
      }
    };
    loadMembers();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch entries in real-time when dates change (Only in create mode)
  useEffect(() => {
    const fetchEntries = async () => {
      if (viewMode !== 'create') return;
      if (startDate && endDate) {
        try {
          const fetchedEntries = await getRegisterEntries(startDate, endDate);
          setEntries(fetchedEntries);
          
          if (fetchedEntries.length > 0) {
            let minStart = Infinity;
            let maxEnd = -Infinity;
            fetchedEntries.forEach(entry => {
              const start = parseFloat(entry.startReading);
              const end = parseFloat(entry.endReading);
              if (!isNaN(start) && start < minStart) minStart = start;
              if (!isNaN(end) && end > maxEnd) maxEnd = end;
            });
            
            if (minStart !== Infinity) setCycleStartReading(minStart.toString());
            if (maxEnd !== -Infinity) setCycleEndReading(maxEnd.toString());
          } else {
            setCycleStartReading('');
            setCycleEndReading('');
          }
        } catch (e) {
          console.error("Error fetching entries for validation", e);
        }
      } else {
        setEntries([]);
        setCycleStartReading('');
        setCycleEndReading('');
      }
    };
    fetchEntries();
  }, [startDate, endDate, viewMode]);

  // Real-time validation
  useEffect(() => {
    if (viewMode !== 'create') return;
    const warnings = [];
    const cStart = parseFloat(cycleStartReading);
    const cEnd = parseFloat(cycleEndReading);

    if (entries.length > 0 && !isNaN(cStart) && !isNaN(cEnd)) {
      // Strictly filter entries to only those that fall within the meter bounds
      const filteredEntries = entries.filter(e => {
        const eStart = parseFloat(e.startReading);
        const eEnd = parseFloat(e.endReading);
        return eStart >= cStart && eEnd <= cEnd;
      });

      const startExists = entries.some(e => parseFloat(e.startReading) === cStart);
      const endExists = entries.some(e => parseFloat(e.endReading) === cEnd);
      
      if (!startExists) {
        warnings.push(`Cycle Start Reading (${cStart}) is not found in the logbook for this date range.`);
      }
      if (!endExists) {
        warnings.push(`Cycle End Reading (${cEnd}) is not found in the logbook for this date range.`);
      }
      
      const expectedHours = Math.max(0, (cEnd - cStart) / 100);
      const logbookHours = filteredEntries.reduce((acc, curr) => {
        const start = parseFloat(curr.startReading) || 0;
        const end = parseFloat(curr.endReading) || 0;
        return acc + Math.max(0, (end - start) / 100);
      }, 0);
      const diff = Math.abs(expectedHours - logbookHours);
      
      if (diff > 0.05) {
        warnings.push(`Mismatch! Global Meter Hours (${expectedHours.toFixed(2)}h) != Logbook Hours (${logbookHours.toFixed(2)}h). Difference: ${diff.toFixed(2)}h`);
      }
    }
    setLiveWarnings(warnings);
  }, [entries, cycleStartReading, cycleEndReading, viewMode]);

  const handleAddExpense = () => {
    setFixedExpenses([...fixedExpenses, { id: Date.now(), title: '', amount: '' }]);
  };

  const handleExpenseChange = (id, field, value) => {
    setFixedExpenses(fixedExpenses.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const handleRemoveExpense = (id) => {
    setFixedExpenses(fixedExpenses.filter(ex => ex.id !== id));
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      if (!startDate || !endDate) {
        showToast("Please select a Start Date and End Date.", "warning");
        setLoading(false);
        return;
      }

      let fetchedEntries = await getRegisterEntries(startDate, endDate);

      const cStart = parseFloat(cycleStartReading);
      const cEnd = parseFloat(cycleEndReading);
      if (!isNaN(cStart) && !isNaN(cEnd)) {
        fetchedEntries = fetchedEntries.filter(entry => {
          const entryStart = parseFloat(entry.startReading);
          const entryEnd = parseFloat(entry.endReading);
          return entryStart >= cStart && entryEnd <= cEnd;
        });
      }

      setEntries(fetchedEntries);

      const result = calculateBilling(members, fetchedEntries, wapdaBill, fixedExpenses);
      
      let discrepancyWarnings = [];

      if (fetchedEntries.length > 0 && !isNaN(cStart) && !isNaN(cEnd)) {
        const startExists = fetchedEntries.some(e => parseFloat(e.startReading) === cStart);
        const endExists = fetchedEntries.some(e => parseFloat(e.endReading) === cEnd);
        
        if (!startExists) {
          discrepancyWarnings.push(`The Cycle Start Reading (${cStart}) was not found in any of the fetched logbook entries.`);
        }
        if (!endExists) {
          discrepancyWarnings.push(`The Cycle End Reading (${cEnd}) was not found in any of the fetched logbook entries.`);
        }
      }

      const expectedHours = !isNaN(cStart) && !isNaN(cEnd) 
        ? Math.max(0, (cEnd - cStart) / 100)
        : null;
        
      if (expectedHours !== null) {
        const diff = Math.abs(expectedHours - result.totalConsumedHours);
        if (diff > 0.05) { 
          discrepancyWarnings.push(`Logbook missing hours. Global meter hours (${expectedHours.toFixed(2)}h) does not match the sum of logbook entries (${result.totalConsumedHours.toFixed(2)}h). Difference: ${diff.toFixed(2)}h`);
        }
      }
      
      const discrepancyWarning = discrepancyWarnings.length > 0 ? discrepancyWarnings.join(" | ") : null;
      
      setBillingResult({
        ...result,
        billingTitle,
        startDate,
        endDate,
        cycleStartReading,
        cycleEndReading,
        expectedHours,
        discrepancyWarning
      });
      setIsResultStale(false);
      
    } catch (error) {
      console.error("Billing error:", error);
      showToast("Failed to calculate bill.", "error");
    } finally {
      setLoading(false);
    }
  };

  const getBillTitle = () => {
    return viewMode === 'list' && selectedBillId 
      ? (savedBills.find(b => b.id === selectedBillId)?.billingTitle || 'Tubewell Bill')
      : (billingTitle || 'Tubewell Bill');
  };

  const [copiedStates, setCopiedStates] = useState({});

  const formatUrduDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    const day = date.getDate();
    const months = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
    return `${day} ${months[date.getMonth()]}`;
  };

  const formatUrduMonthYear = (title) => {
    if (!title) return '';
    const parts = title.split(' ');
    if (parts.length < 2) return title;
    const monthsMap = {
      'january': 'جنوری', 'february': 'فروری', 'march': 'مارچ', 'april': 'اپریل', 'may': 'مئی', 'june': 'جون', 
      'july': 'جولائی', 'august': 'اگست', 'september': 'ستمبر', 'october': 'اکتوبر', 'november': 'نومبر', 'december': 'دسمبر'
    };
    const urduMonth = monthsMap[parts[0].toLowerCase()] || parts[0];
    return `${urduMonth} ${parts[1]}`;
  };

  const handleCopyMemberWhatsApp = (member) => {
    if (!billingResult) return;
    const title = getBillTitle();
    const urduTitleMonth = formatUrduMonthYear(title);
    
    let text = `ٹربائن کا بل — ${urduTitleMonth}\n`;
    text += `${member.name}\n\n`;
    text += `*کل بل: ${member.totalBill.toLocaleString()} روپے*\n\n`;
    text += `—————————————\n`;
    
    const totalEffectiveHours = member.effectiveHours ? Number(Number(member.effectiveHours).toFixed(2)) : 0;
    let scheduleText = `${totalEffectiveHours} گھنٹے`;
    
    // Try to find the scheduled day for both owners and tenants
    const sourceMember = members.find(m => m.id === member.ownerId || m.id === member.id);
    
    const formatUrduTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parts[1];
      let period = 'صبح';
      if (hours === 12) period = 'دوپہر';
      else if (hours > 12 && hours < 17) period = 'سہ پہر';
      else if (hours >= 17 && hours <= 19) period = 'شام';
      else if (hours > 19 || hours < 4) period = 'رات';
      
      const h12 = hours % 12 || 12;
      return `${period} ${h12.toString().padStart(2, '0')}:${minutes}`;
    };

    if (sourceMember && sourceMember.startDay) {
      const daysUrdu = {
        'Sunday': 'اتوار', 'Monday': 'پیر', 'Tuesday': 'منگل', 'Wednesday': 'بدھ',
        'Thursday': 'جمعرات', 'Friday': 'جمعہ', 'Saturday': 'ہفتہ'
      };
      const startDayUrdu = daysUrdu[sourceMember.startDay] || sourceMember.startDay;
      const endDayUrdu = daysUrdu[sourceMember.endDay] || sourceMember.endDay || '';
      
      const sTime = formatUrduTime(sourceMember.startTime);
      const eTime = formatUrduTime(sourceMember.endTime);
      
      if (sourceMember.startDay === sourceMember.endDay || !sourceMember.endDay) {
        scheduleText = `${startDayUrdu}، ${sTime} تا ${eTime} (${totalEffectiveHours} گھنٹے)`;
      } else {
        scheduleText = `${startDayUrdu} ${sTime} تا ${endDayUrdu} ${eTime} (${totalEffectiveHours} گھنٹے)`;
      }
    }
    
    text += `باری کا وقت: ${scheduleText}\n`;
    text += `—————————————\n`;
    text += `اخراجات کی معلومات:\n`;
    text += `بجلی کا بل: ${member.usageShare.toLocaleString()} روپے\n`;
    text += `دیگر اخراجات: ${member.fixedShare.toLocaleString()} روپے\n`;
    text += `—————————————\n`;
    
    let currentFixedExpenses = [];
    if (viewMode === 'list' && selectedBillId) {
      const b = savedBills.find(b => b.id === selectedBillId);
      if (b) currentFixedExpenses = b.fixedExpenses || [];
    } else {
      currentFixedExpenses = fixedExpenses;
    }

    if (currentFixedExpenses.length > 0) {
      text += `مرمت و دیگر اخراجات میں آپ کے حصے کی تفصیلات:\n`;
      const fraction = billingResult.totalFixedExpenses > 0 ? (member.fixedShare / billingResult.totalFixedExpenses) : 0;
      currentFixedExpenses.forEach(ex => {
        const myShare = Math.round(parseFloat(ex.amount || 0) * fraction);
        const exTitle = ex.title || 'اخراجات';
        const formattedAmount = /[a-zA-Z]/.test(exTitle) 
          ? `\u200Eروپے\u200E ${myShare.toLocaleString()}` 
          : `${myShare.toLocaleString()} روپے`;
        text += `• ${exTitle} : ${formattedAmount}\n`;
      });
      text += `—————————————\n\n`;
    } else {
      text += `\n`;
    }
    
    text += `میٹر ریڈنگ کی تفصیل:\n\n`;
    
    if (member.memberEntries && member.memberEntries.length > 0) {
      // Sort entries by date ascending
      const sortedEntries = [...member.memberEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
      sortedEntries.forEach(entry => {
        const uDate = formatUrduDate(entry.date);
        const start = Number(entry.startReading);
        const end = Number(entry.endReading);
        const diff = Number(Math.max(0, (entry.endReading - entry.startReading) / 100).toFixed(2));
        
        text += `${uDate} — (*${diff} گھنٹے*)\n`;
        text += `ریڈنگ: ${end} تا ${start}\n\n`;
      });
    } else {
      text += `کوئی ریڈنگ موجود نہیں\n`;
    }
    
    // Add a dot at the end with spacing to prevent WhatsApp RTL layout issues on the last line
    text = text.trimEnd() + '\n\n\n.\n';
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, [member.id]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [member.id]: false })), 2000);
      showToast("Copied to clipboard!", "success");
    });
  };

  const handleCopyMemberEnglish = (member) => {
    if (!billingResult) return;
    const title = getBillTitle();
    
    let text = `Tubewell Bill — ${title}\n`;
    text += `${member.name}\n\n`;
    text += `*Total Bill: Rs. ${member.totalBill.toLocaleString()}*\n\n`;
    text += `—————————————\n`;
    
    const totalEffectiveHours = member.effectiveHours ? Number(Number(member.effectiveHours).toFixed(2)) : 0;
    let scheduleText = `${totalEffectiveHours} Hours`;
    
    const sourceMember = members.find(m => m.id === member.ownerId || m.id === member.id);
    
    const formatEnglishTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    };

    if (sourceMember && sourceMember.startDay) {
      const sTime = formatEnglishTime(sourceMember.startTime);
      const eTime = formatEnglishTime(sourceMember.endTime);
      
      if (sourceMember.startDay === sourceMember.endDay || !sourceMember.endDay) {
        scheduleText = `${sourceMember.startDay}, ${sTime} to ${eTime} (${totalEffectiveHours} Hours)`;
      } else {
        scheduleText = `${sourceMember.startDay} ${sTime} to ${sourceMember.endDay} ${eTime} (${totalEffectiveHours} Hours)`;
      }
    }
    
    text += `Turn Schedule: ${scheduleText}\n`;
    text += `—————————————\n`;
    text += `Expense Details:\n`;
    text += `Electricity Bill: Rs. ${member.usageShare.toLocaleString()}\n`;
    text += `Other Expenses: Rs. ${member.fixedShare.toLocaleString()}\n`;
    text += `—————————————\n`;
    
    let currentFixedExpenses = [];
    if (viewMode === 'list' && selectedBillId) {
      const b = savedBills.find(b => b.id === selectedBillId);
      if (b) currentFixedExpenses = b.fixedExpenses || [];
    } else {
      currentFixedExpenses = fixedExpenses;
    }

    if (currentFixedExpenses.length > 0) {
      text += `Your details of Share in Maintenance & Other Expenses:\n`;
      const fraction = billingResult.totalFixedExpenses > 0 ? (member.fixedShare / billingResult.totalFixedExpenses) : 0;
      currentFixedExpenses.forEach(ex => {
        const myShare = Math.round(parseFloat(ex.amount || 0) * fraction);
        const exTitle = ex.title || 'Expense';
        text += `• ${exTitle} : Rs. ${myShare.toLocaleString()}\n`;
      });
      text += `—————————————\n\n`;
    } else {
      text += `\n`;
    }
    
    text += `Meter Reading Details:\n\n`;
    
    if (member.memberEntries && member.memberEntries.length > 0) {
      const sortedEntries = [...member.memberEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
      sortedEntries.forEach(entry => {
        const dateObj = new Date(entry.date);
        const dateStr = !isNaN(dateObj) ? `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'long' })}` : entry.date;
        const start = Number(entry.startReading);
        const end = Number(entry.endReading);
        const diff = Number(Math.max(0, (entry.endReading - entry.startReading) / 100).toFixed(2));
        
        text += `${dateStr} — (*${diff} Hours*)\n`;
        text += `Reading: ${start} to ${end}\n\n`;
      });
    } else {
      text += `No readings found\n`;
    }
    
    text = text.trimEnd() + '\n\n\n.\n';
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, [member.id]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [member.id]: false })), 2000);
      showToast("Copied to clipboard!", "success");
    });
  };

  const handleShareText = (language, member) => {
    if (language === 'urdu') {
      handleCopyMemberWhatsApp(member);
    } else {
      handleCopyMemberEnglish(member);
    }
  };

  const handleShareImage = async (language, member) => {
    const sourceMember = members.find(m => m.id === member.id);
    const enrichedMember = { ...sourceMember, ...member };
    
    if (language === 'urdu' && !enrichedMember.urduName && !enrichedMember.nameUr) {
      const translated = await translateToUrdu(enrichedMember.nameEn || enrichedMember.name);
      enrichedMember.urduName = translated;
    }
    
    setGeneratingImage({ language, member: enrichedMember });
  };

  useEffect(() => {
    if (generatingImage && offScreenReceiptRef.current) {
      const { language, member } = generatingImage;
      // Allow a short tick for the DOM to render the off-screen GraphicReceipt properly
      setTimeout(() => {
        if (!offScreenReceiptRef.current) {
          setGeneratingImage(null);
          return;
        }
        toBlob(offScreenReceiptRef.current, {
          quality: 1.0,
          pixelRatio: 2,
          skipFonts: false,
          cacheBust: true,
        })
          .then(async (blob) => {
            if (!blob) throw new Error("Failed to generate blob");
            try {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              showToast("Receipt copied to clipboard!", "success");
            } catch (clipboardErr) {
              console.warn('Clipboard copy failed, falling back to download:', clipboardErr);
              const dataUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = `Bill_${member.name.replace(/\\s+/g, '_')}_${language}.png`;
              link.href = dataUrl;
              link.click();
              URL.revokeObjectURL(dataUrl);
              showToast("Receipt image downloaded successfully!", "success");
            }
          })
          .catch((err) => {
            console.error('Error generating image:', err);
            showToast("Failed to generate image.", "error");
          })
          .finally(() => {
            setGeneratingImage(null);
            setShareModalData(null);
          });
      }, 500); // give DOM a moment
    }
  }, [generatingImage, showToast]);

  const handleDownloadPdfSummary = (language) => {
    setGeneratingPdfLanguage(language);
  };

  useEffect(() => {
    if (generatingPdfLanguage && billingResult) {
      // Delay to let React render GraphicOverallBill in the DOM, then wait for fonts
      setTimeout(() => {
        document.fonts.ready.then(() => {
          window.print();
        });
        
        // Use an event listener to close the modal and reset state after print dialog closes
        const afterPrint = () => {
          setGeneratingPdfLanguage(null);
          setIsPdfModalOpen(false);
          window.removeEventListener('afterprint', afterPrint);
        };
        window.addEventListener('afterprint', afterPrint);
        
        // Fallback for browsers that don't fire afterprint reliably
        setTimeout(() => {
          setGeneratingPdfLanguage(null);
          setIsPdfModalOpen(false);
          window.removeEventListener('afterprint', afterPrint);
        }, 6000); // Increased timeout to account for font loading
      }, generatingPdfLanguage === 'urdu' ? 1500 : 300); 
    }
  }, [generatingPdfLanguage, billingResult, fixedExpenses]);

  const handleSaveAndPublish = async () => {
    setIsSaving(true);
    try {
      const billData = {
        billingTitle,
        startDate,
        endDate,
        cycleStartReading: parseFloat(cycleStartReading) || 0,
        cycleEndReading: parseFloat(cycleEndReading) || 0,
        wapdaBill: parseFloat(wapdaBill) || 0,
        wapdaRefNo,
        wapdaBillDetails,
        fixedExpenses,
        billingResult
      };
      
      if (editingBillId) {
        billData.id = editingBillId;
      }
      
      const saved = await saveGeneratedBill(billData);
      
      // Refresh list
      const bills = await getAllGeneratedBills();
      setSavedBills(bills);
      setSelectedBillId(saved.id);
      resetForm();
      setViewMode('list');
      setEditingBillId(null);
      showToast("Bill saved and published successfully!", "success");
    } catch(e) {
      console.error("Failed to save bill:", e);
      showToast("Failed to save bill: " + e.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBill = (id) => {
    setBillToDelete(id);
  };

  const executeDeleteBill = async () => {
    if (!billToDelete) return;
    try {
      await deleteGeneratedBill(billToDelete);
      const remaining = savedBills.filter(b => b.id !== billToDelete);
      setSavedBills(remaining);
      setSelectedBillId(remaining.length > 0 ? remaining[0].id : '');
      showToast("Bill deleted.", "success");
    } catch (e) {
      console.error("Failed to delete bill:", e);
      showToast("Failed to delete: " + e.message, "error");
    } finally {
      setBillToDelete(null);
    }
  };

  const handleEditBill = (id) => {
    const billToEdit = savedBills.find(b => b.id === id);
    if (!billToEdit) return;
    
    setEditingBillId(id);
    setBillingTitle(billToEdit.billingTitle);
    setStartDate(billToEdit.startDate);
    setEndDate(billToEdit.endDate);
    setCycleStartReading(billToEdit.cycleStartReading || '');
    setCycleEndReading(billToEdit.cycleEndReading || '');
    setWapdaBill(billToEdit.wapdaBill || '');
    setWapdaRefNo(billToEdit.wapdaRefNo || '');
    setWapdaBillDetails(billToEdit.wapdaBillDetails || null);
    setFixedExpenses(billToEdit.fixedExpenses || []);
    setBillingResult(billToEdit.billingResult);
    setIsResultStale(false); // loaded result matches loaded inputs
    
    setViewMode('create');
  };

  const startCreateMode = () => {
    setViewMode('create');
    setEditingBillId(null);
    setBillingResult(null);
    setWapdaBillDetails(null);
    setIsResultStale(false);
  };

  const handleCancelCreateMode = () => {
    setViewMode('list');
    setEditingBillId(null);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="billing-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Billing System</h1>
          <p style={{ fontFamily: 'Inter', fontSize: '15px', color: 'var(--text-secondary)' }}>View and manage monthly bills</p>
        </div>
      </div>

      {isInitialLoading ? (
        <SkeletonBillingList />
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="card print-hidden" style={{ marginBottom: '24px' }}>
          <div className="billing-list-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, margin: 0 }}>Select Billing Month</h2>
              <CustomDropdown
                className="billing-list-dropdown"
                value={selectedBillId}
                onChange={(val) => setSelectedBillId(val)}
                options={
                  savedBills.length === 0 
                    ? [{ value: '', label: 'No bills published yet' }]
                    : savedBills.map(b => ({ value: b.id, label: b.billingTitle }))
                }
                style={{ width: '250px' }}
                disabled={savedBills.length === 0}
              />
              
              {isAdmin && selectedBillId && (
                <div className="billing-list-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleEditBill(selectedBillId)}
                    style={{ padding: '8px 12px' }}
                    title="Edit this bill"
                  >
                    <Edit3 size={16} /> Edit
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleDeleteBill(selectedBillId)}
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)', padding: '8px 12px' }}
                    title="Delete this bill"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
            
            {isAdmin && (
              <button className="btn btn-primary billing-create-btn" onClick={startCreateMode}>
                <Plus size={18} /> Create New Month Bill
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Input Panel (Create Mode) */
        <div className="card print-hidden billing-create-card" style={{ marginBottom: '24px' }}>
          <div className="billing-create-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, margin: 0 }}>
              {editingBillId ? 'Edit Bill Details' : 'Create New Bill Details'}
            </h2>
            <button className="btn btn-secondary" onClick={handleCancelCreateMode}>
              Cancel
            </button>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
            {/* Left Column - Form */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px', minWidth: '0' }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} color="var(--text-secondary)" /> Billing Month
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={billingTitle}
                  onChange={(e) => setBillingTitle(e.target.value)}
                  placeholder="e.g. August 2026"
                />
              </div>

              <div className="billing-form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--text-secondary)" /> Start Date
                  </label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--text-secondary)" /> End Date
                  </label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              
              {startDate && endDate && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => window.open(`/?tab=register&start=${startDate}&end=${endDate}`, '_blank')}
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent' }}
                  >
                    View Readings for this Range <ExternalLink size={14} />
                  </button>
                </div>
              )}
              
              <div className="billing-form-row" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <Gauge size={14} color="var(--text-secondary)" /> Start Reading
                  </label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={cycleStartReading}
                    onChange={(e) => setCycleStartReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <Gauge size={14} color="var(--text-secondary)" /> End Reading
                  </label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={cycleEndReading}
                    onChange={(e) => setCycleEndReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {liveWarnings.length > 0 && (
                <div style={{ background: 'var(--danger-light)', borderLeft: '3px solid var(--danger)', padding: '12px', borderRadius: '4px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger-dark)', textTransform: 'uppercase', marginBottom: '8px' }}>Pre-generation Warnings</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--danger-dark)', fontSize: '13px' }}>
                    {liveWarnings.map((warning, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginBottom: '24px', background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Receipt size={16} color="var(--text-secondary)" /> WAPDA Bill
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Extension status badge */}
                    <span style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: isExtInstalled ? 'var(--success-dark)' : 'var(--warning-dark)', background: isExtInstalled ? 'var(--success-light)' : 'var(--warning-light)', padding: '2px 8px', borderRadius: '999px' }}>
                      {isExtInstalled ? <Zap size={11} /> : <ShieldAlert size={11} />}
                      {isExtInstalled ? 'Extension Active' : 'Extension Not Found'}
                    </span>
                    <button
                      onClick={() => setIsWapdaManualMode(!isWapdaManualMode)}
                      style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                    >
                      <Edit3 size={14} />
                      {isWapdaManualMode ? 'Cancel Edit' : 'Edit Manually'}
                    </button>
                  </div>
                </div>

                {/* Extension not installed warning */}
                {!isExtInstalled && !isWapdaManualMode && (
                  <div style={{ fontSize: '12px', color: 'var(--warning-dark)', background: 'var(--warning-light)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--warning)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> Chrome Extension required to auto-fetch WAPDA bills. Install it from <code>chrome://extensions</code> then reload this page, or use <strong>Edit Manually</strong> to enter the bill amount.
                  </div>
                )}

                {/* Auto-fetch loading state */}
                {isFetchingWapda && !isWapdaManualMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', marginBottom: '12px' }}>
                    <RefreshCw size={16} className="spin" color="var(--primary)" />
                    <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>Fetching WAPDA bill automatically...</span>
                  </div>
                )}

                {isWapdaManualMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="Total WAPDA Bill (Rs.)"
                      style={{ background: 'var(--bg-surface)' }}
                      value={wapdaBill}
                      onChange={(e) => setWapdaBill(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsWapdaManualMode(false)}>Cancel</button>
                      <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleManualWapdaSave}>
                        <Save size={16} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {wapdaBillDetails ? (
                      <div className="billing-wapda-detail" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Rs. {parseFloat(wapdaBillDetails.amount).toLocaleString()}</div>
                          {wapdaBillDetails.isManualOverride ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manually Entered</div>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>{wapdaBillDetails.month}</span>
                              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Reading Date: {wapdaBillDetails.readingDate}</span>
                            </div>
                          )}
                        </div>
                        {wapdaBillDetails.isManualOverride ? null : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {wapdaBillDetails.rawHtml && (
                              <button
                                className="btn btn-secondary"
                                onClick={() => setShowWapdaHtml(true)}
                                style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
                              >
                                View Full Bill
                              </button>
                            )}
                            <CheckCircle2 size={24} color="var(--success)" />
                          </div>
                        )}
                      </div>
                    ) : !isFetchingWapda ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic', background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)', textAlign: 'center' }}>
                        {isExtInstalled ? 'Auto-fetching bill...' : 'No bill loaded for this month.'}
                      </div>
                    ) : null}

                    {/* Month suggestion banner */}
                    {wapdaMonthSuggestion && !wapdaBillDetails?.isManualOverride && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', gap: '12px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Lightbulb size={14} /> WAPDA billing month is <strong>{wapdaMonthSuggestion.normalized}</strong> — use this as your billing title?
                        </span>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: '12px', flexShrink: 0 }}
                          onClick={() => {
                            setBillingTitle(wapdaMonthSuggestion.normalized);
                            setWapdaMonthSuggestion(null);
                          }}
                        >
                          Use This
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Fixed Expenses */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px', minWidth: '0' }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', flex: 1, marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Fixed Expenses</label>
                  <button 
                    onClick={handleAddExpense}
                    style={{ fontSize: '13px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add Expense
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {fixedExpenses.map((expense, _i) => (
                    <div key={expense.id} className="billing-expense-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Title (e.g. Salary)"
                        style={{ flex: 1, background: 'var(--bg-surface)' }}
                        value={expense.title}
                        onChange={(e) => handleExpenseChange(expense.id, 'title', e.target.value)}
                      />
                      <div className="billing-expense-amount" style={{ position: 'relative', width: '130px' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: 500 }}>Rs.</span>
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="0"
                          style={{ width: '100%', paddingLeft: '36px', background: 'var(--bg-surface)' }}
                          value={expense.amount}
                          onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={() => handleRemoveExpense(expense.id)}
                        style={{ background: 'var(--danger-light)', border: '1px solid transparent', color: 'var(--danger)', cursor: 'pointer', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {fixedExpenses.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic' }}>
                      No fixed expenses added.
                    </div>
                  )}
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                onClick={handleCalculate}
                disabled={loading}
              >
                <Calculator size={18} />
                {loading ? 'Calculating...' : 'Generate Bills'}
              </button>
              
              {billingResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {isResultStale && (
                    <div style={{ fontSize: '12px', color: 'var(--warning-dark)', background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={13} /> Inputs changed — regenerate the bill before saving.
                    </div>
                  )}
                  <button 
                    className="btn btn-success" 
                    style={{ width: '100%', justifyContent: 'center', marginTop: '4px', background: isResultStale ? 'var(--text-tertiary)' : 'var(--success)', color: 'white', border: 'none', cursor: isResultStale ? 'not-allowed' : 'pointer' }}
                    onClick={handleSaveAndPublish}
                    disabled={isSaving || isResultStale}
                    title={isResultStale ? 'Please click Generate Bills first' : ''}
                  >
                    <CheckCircle2 size={18} />
                    {isSaving ? 'Saving...' : 'Save & Publish Bill'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {!billingResult ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            <Calculator size={32} />
          </div>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Bill Selected
          </h3>
          <p style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
            {viewMode === 'create' 
              ? "Enter the details above and click Generate to see the calculation."
              : "Select a published bill to view its details."}
          </p>
        </div>
      ) : (
          <div className="card billing-results-card" style={{ padding: '20px', marginBottom: '24px' }}>
            {/* Action Bar for PDF Generation */}
            <div className="print-hidden billing-action-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {/* View WAPDA Bill button - only when bill has rawHtml */}
              {(() => {
                const activeBill = viewMode === 'list'
                  ? savedBills.find(b => b.id === selectedBillId)
                  : null;
                const rawHtml = activeBill?.wapdaBillDetails?.rawHtml || wapdaBillDetails?.rawHtml;
                if (!rawHtml) return null;
                return (
                  <button
                    onClick={() => setWapdaViewModalHtml(rawHtml)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter', transition: 'all 0.2s' }}
                  >
                    <Receipt size={16} />
                    View WAPDA Bill
                  </button>
                );
              })()}
              <button
                onClick={() => setIsPdfModalOpen(true)}
                className="billing-pdf-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
              >
                <Download size={16} />
                Download PDF Summary
              </button>
            </div>

            {/* Print-Only Title */}
            <div className="print-only" style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {viewMode === 'list' && selectedBillId 
                  ? (savedBills.find(b => b.id === selectedBillId)?.billingTitle || 'Tubewell Bill')
                  : (billingTitle || 'Tubewell Bill')}
              </h1>
              <p style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Generated on {new Date().toLocaleDateString('en-GB')}
              </p>
            </div>

            {/* Overall Bill Totals Master Grid */}
            <div className="billing-stats-master-grid">
              
              {/* Stat 1: WAPDA */}
              <div className="billing-stat-item billing-stat-wapda">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ marginTop: '1px' }}><Lightbulb size={16} /></div> 
                  <div>WAPDA Electricity<br/>Bill</div>
                </div>
                <div className="billing-stat-value" style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rs. {billingResult.wapdaBill ? billingResult.wapdaBill.toLocaleString() : '0'}
                </div>
              </div>
              
              {/* Stat 2: Fixed Expenses & Breakdown (The '1' spanning full width) */}
              <div className="billing-stat-item billing-stat-fixed">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ marginTop: '1px' }}><Wrench size={16} /></div> 
                  <div>Fixed / Repair<br/>Expenses</div>
                </div>
                <div className="billing-stat-value" style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rs. {billingResult.totalFixedExpenses ? billingResult.totalFixedExpenses.toLocaleString() : '0'}
                </div>
                {/* Breakdown */}
                {(() => {
                  const currentBill = viewMode === 'list' && selectedBillId ? savedBills.find(b => b.id === selectedBillId) : null;
                  const expensesToShow = currentBill ? (currentBill.fixedExpenses || []) : (viewMode === 'create' ? fixedExpenses : []);
                  if (expensesToShow.length > 0) {
                    return (
                      <div className="billing-stat-breakdown" style={{ 
                        background: 'var(--bg-muted)', 
                        borderRadius: '8px', 
                        padding: '12px 16px',
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px',
                        border: '1px solid var(--border-default)',
                        marginTop: '16px'
                      }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '2px' }}>
                          Breakdown
                        </div>
                        {expensesToShow.map(expense => (
                          <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{expense.title || 'Unnamed Expense'}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>Rs. {parseFloat(expense.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Stat 3: Total Collection */}
              <div className="billing-stat-item billing-stat-collection">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ marginTop: '1px' }}><Coins size={16} /></div> 
                  <div>Total Collection<br/>Amount</div>
                </div>
                <div className="billing-stat-value" style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rs. {billingResult.grandTotalBilled ? billingResult.grandTotalBilled.toLocaleString() : '0'}
                </div>
              </div>

              {/* Stat 4: Electricity Rate */}
              <div className="billing-stat-item billing-stat-rate">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ marginTop: '1px' }}><Tag size={16} /></div> 
                  <div>Electricity Rate<br/>Per Hour</div>
                </div>
                <div className="billing-stat-value" style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rs. {billingResult.wapdaHourlyRate ? billingResult.wapdaHourlyRate.toFixed(2) : '0.00'} <span className="billing-rate-suffix" style={{ fontFamily: 'Inter', fontSize: '16px', fontWeight: 500, color: 'var(--text-tertiary)' }}>/ hr</span>
                </div>
              </div>

              {/* Stat 5: Total Cost Per Hour */}
              <div className="billing-stat-item billing-stat-total-cost">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ marginTop: '1px' }}><Coins size={16} /></div> 
                  <div>Total Cost Per<br/>Hour Incl. Repairs</div>
                </div>
                <div className="billing-stat-value" style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rs. {(billingResult.totalHourlyRate || (billingResult.totalConsumedHours > 0 ? (billingResult.wapdaBill + billingResult.totalFixedExpenses) / billingResult.totalConsumedHours : 0)).toFixed(2)} <span className="billing-rate-suffix" style={{ fontFamily: 'Inter', fontSize: '16px', fontWeight: 500, color: 'var(--text-tertiary)' }}>/ hr</span>
                </div>
              </div>
            </div>
        </div>
      )}

      {billingResult && (
        <div>
          {/* Layout Toggle — hidden on mobile */}
          <div className="print-hidden billing-layout-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Breakdown by Member</h3>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-muted)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setLayoutMode('table')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '6px',
                  border: 'none',
                  background: layoutMode === 'table' ? 'var(--bg-surface)' : 'transparent',
                  color: layoutMode === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  boxShadow: layoutMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <List size={16} /> Table
              </button>
              <button 
                onClick={() => setLayoutMode('card')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '6px',
                  border: 'none',
                  background: layoutMode === 'card' ? 'var(--bg-surface)' : 'transparent',
                  color: layoutMode === 'card' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  boxShadow: layoutMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <LayoutGrid size={16} /> Cards
              </button>
            </div>
          </div>

          {/* Table View — hidden on mobile via CSS */}
          {layoutMode === 'table' && (
            <div className="card billing-table-desktop" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '30%', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'left', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member / Tenant</th>
                        <th style={{ width: '14%', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>METER (H)</th>
                        <th style={{ width: '14%', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WEEKLY (H)</th>
                        <th style={{ width: '14%', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WAPDA (Rs.)</th>
                        <th style={{ width: '14%', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FIXED (Rs.)</th>
                        <th style={{ width: '14%', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px 24px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingResult.breakdowns.map((b, idx) => (
                        <tr key={b.id} style={{ borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none' }}>
                          <td style={{ padding: '16px 24px', borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ minWidth: '32px', width: '32px', height: '32px', borderRadius: '50%', background: b.type === 'tenant' ? 'var(--warning-light)' : 'var(--primary-light)', color: b.type === 'tenant' ? 'var(--warning-dark)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                                {b.code}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Outfit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name || 'Unknown'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{b.type === 'tenant' ? 'Tenant' : 'Owner'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontFamily: 'Outfit', color: 'var(--text-secondary)', borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none', whiteSpace: 'nowrap' }}>
                            {b.consumedHours ? b.consumedHours.toFixed(2) : '0.00'}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontFamily: 'Outfit', color: 'var(--text-secondary)', borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none', whiteSpace: 'nowrap' }}>
                            {b.effectiveHours.toFixed(1)}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontFamily: 'Outfit', color: 'var(--text-secondary)', borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none', whiteSpace: 'nowrap' }}>
                            {b.usageShare.toLocaleString()}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontFamily: 'Outfit', color: 'var(--text-secondary)', borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none', whiteSpace: 'nowrap' }}>
                            {b.fixedShare.toLocaleString()}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontFamily: 'Outfit', fontWeight: 700, color: 'var(--text-primary)', borderBottom: idx !== billingResult.breakdowns.length - 1 ? '1px solid var(--border-default)' : 'none', whiteSpace: 'nowrap' }}>
                            {b.totalBill.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          )}

          {/* Card View — always shown on mobile, toggle-controlled on desktop */}
          <div className="billing-card-grid" style={{ display: layoutMode === 'card' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {billingResult.breakdowns.map((b) => (
                <div key={b.id} className="card billing-breakdown-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                      <div className="billing-breakdown-avatar" style={{ borderRadius: '50%', background: b.type === 'tenant' ? 'var(--warning-light)' : 'var(--primary-light)', color: b.type === 'tenant' ? 'var(--warning-dark)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {b.code}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="billing-breakdown-title" style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Outfit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name || 'Unknown'}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{b.type === 'tenant' ? 'Tenant' : 'Owner'}</div>
                      </div>
                    </div>
                    <button 
                      className="print-hidden"
                      onClick={() => setShareModalData(b)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedStates[b.id] ? 'var(--success)' : 'var(--text-tertiary)', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                      title="Share Receipt"
                    >
                      {copiedStates[b.id] ? <CheckCircle2 size={18} /> : <Share2 size={18} />}
                    </button>
                  </div>
                  
                  <div className="billing-breakdown-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontWeight: 600 }}>Meter (H)</div>
                      <div style={{ fontFamily: 'Outfit', color: 'var(--text-primary)', fontWeight: 600, fontSize: '16px' }}>{b.consumedHours ? b.consumedHours.toFixed(2) : '0.00'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontWeight: 600 }}>Weekly (H)</div>
                      <div style={{ fontFamily: 'Outfit', color: 'var(--text-primary)', fontWeight: 600, fontSize: '16px' }}>{b.effectiveHours.toFixed(1)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>WAPDA Share</span>
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-primary)' }}>Rs. {b.usageShare.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Fixed Share</span>
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-primary)' }}>Rs. {b.fixedShare.toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ paddingTop: '16px', borderTop: '1px dashed var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>Total Bill</span>
                    <span className="billing-breakdown-total" style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--primary)' }}>Rs. {b.totalBill.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
        </div>
      )}
        </>
      )}

          {/* Clean Bill Modal — used from create mode & published bill "View WAPDA Bill" */}
          {(showWapdaHtml || wapdaViewModalHtml) && (() => {
            const rawHtml = wapdaViewModalHtml || wapdaBillDetails?.rawHtml;
            const closeModal = () => { setShowWapdaHtml(false); setWapdaViewModalHtml(null); };
            if (!rawHtml) return null;

            // Build clean bill HTML with DOMParser extraction
            let cleanSrc = rawHtml;
            try {
              const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

              // Strategy 1: known class/id selectors
              let billContainer =
                doc.querySelector('.duplicate-bill') ||
                doc.querySelector('#duplicateBill') ||
                doc.querySelector('.bill-content') ||
                doc.querySelector('#billContent') ||
                doc.querySelector('.main-bill') ||
                doc.querySelector('.bill-wrapper') ||
                doc.querySelector('#billWrapper') ||
                doc.querySelector('.print-area') ||
                doc.querySelector('#printArea') ||
                doc.querySelector('.tab-pane.active') ||
                doc.querySelector('.tab-pane:first-child');

              // Strategy 2: smallest div containing bill header + payable amount
              if (!billContainer) {
                const allDivs = Array.from(doc.querySelectorAll('div'));
                let bestContainer = null;
                let bestSize = Infinity;
                for (const div of allDivs) {
                  const hasBillHeader = div.textContent.includes('ELECTRICITY CONSUMER BILL') ||
                                        div.textContent.includes('CONSUMER BILL') ||
                                        div.textContent.includes('MULTAN ELECTRIC POWER');
                  const hasAmount = div.querySelector('.payable-card-amount') ||
                                    div.textContent.includes('PAYABLE WITHIN DUE DATE');
                  if (hasBillHeader && hasAmount) {
                    const size = div.outerHTML.length;
                    if (size < bestSize) { bestSize = size; bestContainer = div; }
                  }
                }
                billContainer = bestContainer;
              }

              const container = billContainer || doc.body;
              const styleBlocks = Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('\n');
              const scriptBlocks = Array.from(doc.querySelectorAll('script')).map(s => s.outerHTML).join('\n');
              cleanSrc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="http://bill.pitc.com.pk/mepcobill/" /><meta name="referrer" content="no-referrer" />${styleBlocks}<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0!important;padding:0!important;background:#fff!important;overflow-x:hidden!important}body{display:flex;justify-content:center}body>*{flex-shrink:0}#loader-container{display:none!important}</style></head><body>${container.outerHTML}${scriptBlocks}<script>window.addEventListener('load',function(){var b=document.body.firstElementChild;if(!b)return;var bw=b.scrollWidth,vw=window.innerWidth;if(bw>vw)document.body.style.zoom=vw/bw;});<\/script></body></html>`;
            } catch(e) { /* use rawHtml as fallback */ }

            return (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: '12px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontFamily: 'Outfit', color: 'var(--text-primary)', fontSize: '16px' }}>MEPCO Bill</h3>
                    <button
                      onClick={closeModal}
                      style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      Close
                    </button>
                  </div>
                  <iframe
                    srcDoc={cleanSrc}
                    style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#fff' }}
                    title="MEPCO Bill"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            );
          })()}

          <ConfirmModal
            isOpen={!!billToDelete}
            title="Delete Bill"
            message="Are you sure you want to delete this bill? This cannot be undone."
            onConfirm={executeDeleteBill}
            onCancel={() => setBillToDelete(null)}
            confirmText="Delete"
          />

          <ShareModal 
            isOpen={!!shareModalData}
            onClose={() => setShareModalData(null)}
            onCopyText={(lang) => handleShareText(lang, shareModalData)}
            onCopyImage={(lang) => handleShareImage(lang, shareModalData)}
            isGenerating={!!generatingImage}
          />

          <PdfDownloadModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            onDownloadPdf={handleDownloadPdfSummary}
            isGenerating={!!generatingPdfLanguage}
          />

          {/* Off-screen container for rendering the image receipt */}
          <div className="offscreen-container">
            {generatingImage && (
              <GraphicReceipt
                ref={offScreenReceiptRef}
                member={generatingImage.member}
                billingResult={billingResult}
                savedFixedExpenses={
                  viewMode === 'list' && selectedBillId
                    ? savedBills.find(b => b.id === selectedBillId)?.fixedExpenses
                    : null
                }
                globalFixedExpenses={fixedExpenses}
                viewMode={viewMode}
                language={generatingImage.language}
              />
            )}
          </div>
            
          {generatingPdfLanguage && createPortal(
            <div className="print-only-container">
              <GraphicOverallBill
                billingResult={billingResult}
                fixedExpenses={
                  viewMode === 'list' && selectedBillId
                    ? savedBills.find(b => b.id === selectedBillId)?.fixedExpenses
                    : fixedExpenses
                }
                viewMode={viewMode}
                language={generatingPdfLanguage}
              />
            </div>,
            document.body
          )}
        </div>
  );
}
