import React, { useState, useEffect } from 'react';
import { initFirebaseAsync } from '../config/firebase';
import { getRegisterEntries } from '../services/registerService';
import { calculateBilling } from '../utils/billingCalculator';
import { Calculator } from '../components/Icons';
import { RefreshCw, CheckCircle2, Edit3, Save, Trash2, Plus, Calendar, Gauge, Receipt, LayoutGrid, List, Lightbulb, Wrench, Coins, Tag, Download, Copy } from 'lucide-react';
import { getWapdaSettings, updateWapdaSettings, getWapdaBillByMonth, saveWapdaBill, fetchBillFromAPI } from '../services/wapdaService';
import { saveGeneratedBill, getAllGeneratedBills, deleteGeneratedBill } from '../services/billingService';
import CustomDropdown from '../components/CustomDropdown';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { SkeletonBillingList } from '../components/Skeleton';

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

  const [wapdaBill, setWapdaBill] = useState(() => loadStored('wapdaBill', ''));
  const [wapdaRefNo, setWapdaRefNo] = useState('');
  const [isWapdaManualMode, setIsWapdaManualMode] = useState(false);
  const [isFetchingWapda, setIsFetchingWapda] = useState(false);
  const [wapdaBillDetails, setWapdaBillDetails] = useState(null);
  const [showWapdaHtml, setShowWapdaHtml] = useState(false);

  // Helper to load from localStorage
  function loadStored(key, defaultVal) {
    try {
      const stored = localStorage.getItem(`billing_${key}`);
      return stored ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  // Inputs
  const [billingTitle, setBillingTitle] = useState(() => {
    return loadStored('billingTitle', (() => {
      const d = new Date();
      return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
    })());
  });
  const [startDate, setStartDate] = useState(() => loadStored('startDate', ''));
  const [endDate, setEndDate] = useState(() => loadStored('endDate', ''));
  const [cycleStartReading, setCycleStartReading] = useState(() => loadStored('cycleStartReading', ''));
  const [cycleEndReading, setCycleEndReading] = useState(() => loadStored('cycleEndReading', ''));
  const [fixedExpenses, setFixedExpenses] = useState(() => loadStored('fixedExpenses', [{ id: 1, title: 'Operator Salary', amount: '' }]));

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('billing_billingTitle', JSON.stringify(billingTitle));
    localStorage.setItem('billing_startDate', JSON.stringify(startDate));
    localStorage.setItem('billing_endDate', JSON.stringify(endDate));
    localStorage.setItem('billing_cycleStartReading', JSON.stringify(cycleStartReading));
    localStorage.setItem('billing_cycleEndReading', JSON.stringify(cycleEndReading));
    localStorage.setItem('billing_wapdaBill', JSON.stringify(wapdaBill));
    localStorage.setItem('billing_fixedExpenses', JSON.stringify(fixedExpenses));
  }, [billingTitle, startDate, endDate, cycleStartReading, cycleEndReading, wapdaBill, fixedExpenses]);

  // Clears all form inputs and localStorage after a bill is published
  const resetForm = () => {
    const d = new Date();
    const defaultTitle = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
    setBillingTitle(defaultTitle);
    setStartDate('');
    setEndDate('');
    setCycleStartReading('');
    setCycleEndReading('');
    setWapdaBill('');
    setWapdaRefNo('');
    setWapdaBillDetails(null);
    setFixedExpenses([{ id: 1, title: 'Operator Salary', amount: '' }]);
    setBillingResult(null);
    setIsResultStale(false);
    // Clear localStorage so the next new bill is always blank
    ['billingTitle','startDate','endDate','cycleStartReading','cycleEndReading','wapdaBill','fixedExpenses']
      .forEach(k => localStorage.removeItem(`billing_${k}`));
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

  // Load Bill for Selected Month
  useEffect(() => {
    const loadBillForMonth = async () => {
      if (!billingTitle || viewMode !== 'create') return;
      try {
        const bill = await getWapdaBillByMonth(billingTitle);
        if (bill) {
          setWapdaBillDetails(bill);
          setWapdaBill(bill.amount);
          setIsWapdaManualMode(false);
        } else {
          setWapdaBillDetails(null);
        }
      } catch (e) {
        console.error("Error loading WAPDA bill for month", e);
      }
    };
    loadBillForMonth();
  }, [billingTitle, viewMode]);

  const handleFetchWapdaBill = async () => {
    if (!wapdaRefNo) {
      showToast("Please enter a Reference Number in the Settings or below first.", "warning");
      setIsWapdaManualMode(true);
      return;
    }
    
    setIsFetchingWapda(true);
    try {
      await updateWapdaSettings(wapdaRefNo);
      const fetched = await fetchBillFromAPI(wapdaRefNo);
      
      const billData = {
        amount: fetched.amount,
        month: fetched.month,
        readingDate: fetched.readDate || 'Unknown',
        rawHtml: fetched.rawHtml,
        isManualOverride: false
      };
      
      setBillingTitle(fetched.month);
      await saveWapdaBill(fetched.month, billData);
      
      setWapdaBillDetails(billData);
      setWapdaBill(billData.amount);
      setIsWapdaManualMode(false);
      showToast("Bill fetched successfully from WAPDA API.", "success");
    } catch (e) {
      console.error("Fetch bill error:", e);
      showToast("Error fetching bill: " + e.message, "error");
      setIsWapdaManualMode(true);
    } finally {
      setIsFetchingWapda(false);
    }
  };

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

  const handleCopyGlobalWhatsApp = () => {
    if (!billingResult) return;
    const title = getBillTitle();
    let text = `${title}\n-------------------------\n`;
    text += `WAPDA Bill: Rs. ${billingResult.wapdaBill.toLocaleString()}\n`;
    text += `Fixed Expenses: Rs. ${billingResult.totalFixedExpenses.toLocaleString()}\n`;
    text += `Total Billed: Rs. ${billingResult.grandTotalBilled.toLocaleString()}\n\n`;
    text += `Electricity Rate: Rs. ${billingResult.wapdaHourlyRate.toLocaleString(undefined, {minimumFractionDigits: 2})} / hr\n`;
    text += `Total Rate: Rs. ${billingResult.totalHourlyRate.toLocaleString(undefined, {minimumFractionDigits: 2})} / hr\n\n`;
    text += `--- Breakdown ---\n`;
    billingResult.breakdowns.forEach((m, idx) => {
      text += `${idx + 1}. ${m.name}: Rs. ${m.totalBill.toLocaleString()}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, global: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, global: false })), 2000);
    });
  };

  const handleCopyMemberWhatsApp = (member) => {
    if (!billingResult) return;
    const title = getBillTitle();
    let text = `${title}\nMember: ${member.name}\n-------------------------\n`;
    text += `Total Bill: Rs. ${member.totalBill.toLocaleString()}\n\n`;
    text += `Meter Hours: ${member.consumedHours ? member.consumedHours.toFixed(1) : '0.0'}h\n`;
    text += `WAPDA Share: Rs. ${member.usageShare.toLocaleString()}\n`;
    text += `Fixed Share: Rs. ${member.fixedShare.toLocaleString()}\n`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, [member.id]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [member.id]: false })), 2000);
    });
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, margin: 0 }}>Select Billing Month</h2>
              <CustomDropdown
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
                <div style={{ display: 'flex', gap: '8px' }}>
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
              <button className="btn btn-primary" onClick={startCreateMode}>
                <Plus size={18} /> Create New Month Bill
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Input Panel (Create Mode) */
        <div className="card print-hidden" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
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
                <div className="form-group" style={{ flex: 1 }}>
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
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gauge size={14} color="var(--text-secondary)" /> Cycle Start Reading
                  </label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={cycleStartReading}
                    onChange={(e) => setCycleStartReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gauge size={14} color="var(--text-secondary)" /> Cycle End Reading
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Receipt size={16} color="var(--text-secondary)" /> WAPDA Bill
                  </label>
                  <button 
                    onClick={() => setIsWapdaManualMode(!isWapdaManualMode)}
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                  >
                    <Edit3 size={14} />
                    {isWapdaManualMode ? 'Cancel Edit' : 'Edit Manually'}
                  </button>
                </div>

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Rs. {parseFloat(wapdaBillDetails.amount).toLocaleString()}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {wapdaBillDetails.isManualOverride ? 'Manually Entered' : `Fetched: ${wapdaBillDetails.month} (${wapdaBillDetails.readingDate})`}
                          </div>
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
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic', background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)', textAlign: 'center' }}>No bill loaded for this month.</div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Reference Number</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={wapdaRefNo}
                          onChange={(e) => setWapdaRefNo(e.target.value)}
                          placeholder="14-digit Ref No"
                          style={{ padding: '8px 12px', fontSize: '13px', background: 'var(--bg-surface)' }}
                        />
                      </div>
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleFetchWapdaBill}
                        disabled={isFetchingWapda || !wapdaRefNo}
                        style={{ padding: '8px 16px', height: '37px', background: 'var(--bg-surface)' }}
                      >
                        <RefreshCw size={14} className={isFetchingWapda ? "spin" : ""} />
                        <span style={{ fontSize: '13px' }}>{isFetchingWapda ? 'Fetching...' : (wapdaBillDetails ? 'Refetch' : 'Fetch Bill')}</span>
                      </button>
                    </div>
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
                    <div key={expense.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Title (e.g. Salary)"
                        style={{ flex: 1, background: 'var(--bg-surface)' }}
                        value={expense.title}
                        onChange={(e) => handleExpenseChange(expense.id, 'title', e.target.value)}
                      />
                      <div style={{ position: 'relative', width: '130px' }}>
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
                        style={{ background: 'var(--danger-light)', border: '1px solid transparent', color: 'var(--danger)', cursor: 'pointer', padding: '8px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                    <div style={{ fontSize: '12px', color: 'var(--warning-dark)', background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', textAlign: 'center' }}>
                      ⚠️ Inputs changed — regenerate the bill before saving.
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
        <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
          {/* Action Bar for PDF Generation */}
          <div className="print-hidden" style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '24px' }}>
            <button 
              onClick={handleCopyGlobalWhatsApp}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', color: copiedStates.global ? 'var(--success)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, fontFamily: 'Inter', transition: 'color 0.2s' }}
            >
              {copiedStates.global ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copiedStates.global ? 'Copied!' : 'Copy WhatsApp Summary'}
            </button>
            <button 
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, fontFamily: 'Inter', transition: 'color 0.2s' }}
            >
              <Download size={16} />
              Download PDF Report
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

          {/* Section 1: The Overall Bill Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Lightbulb size={16} /> WAPDA Electricity Bill
              </div>
              <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rs. {billingResult.wapdaBill ? billingResult.wapdaBill.toLocaleString() : '0'}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Wrench size={16} /> Fixed / Repair Expenses
              </div>
              <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rs. {billingResult.totalFixedExpenses ? billingResult.totalFixedExpenses.toLocaleString() : '0'}
              </div>
              {(() => {
                const currentBill = viewMode === 'list' && selectedBillId ? savedBills.find(b => b.id === selectedBillId) : null;
                const expensesToShow = currentBill ? (currentBill.fixedExpenses || []) : (viewMode === 'create' ? fixedExpenses : []);
                if (expensesToShow.length > 0) {
                  return (
                    <div style={{ 
                      marginTop: '16px', 
                      background: 'var(--bg-muted)', 
                      borderRadius: '8px', 
                      padding: '12px 16px',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      border: '1px solid var(--border-default)'
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

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Coins size={16} /> Total Collection Amount
              </div>
              <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rs. {billingResult.grandTotalBilled ? billingResult.grandTotalBilled.toLocaleString() : '0'}
              </div>
            </div>
          </div>

          <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid var(--border-default)' }} />

          {/* Section 2: The "Per Hour" Rate Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Tag size={16} /> Electricity Rate Per Hour
              </div>
              <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rs. {billingResult.wapdaHourlyRate ? billingResult.wapdaHourlyRate.toFixed(2) : '0.00'} <span style={{ fontFamily: 'Inter', fontSize: '16px', fontWeight: 500, color: 'var(--text-tertiary)' }}>/ hr</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Coins size={16} /> Total Cost Per Hour Incl. Repairs
              </div>
              <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rs. {(billingResult.totalHourlyRate || (billingResult.totalConsumedHours > 0 ? (billingResult.wapdaBill + billingResult.totalFixedExpenses) / billingResult.totalConsumedHours : 0)).toFixed(2)} <span style={{ fontFamily: 'Inter', fontSize: '16px', fontWeight: 500, color: 'var(--text-tertiary)' }}>/ hr</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {billingResult && (
        <div>
          {/* Layout Toggle */}
          <div className="print-hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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

          {layoutMode === 'table' ? (
            /* Breakdown Table */
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
          ) : (
            /* Breakdown Cards */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {billingResult.breakdowns.map((b) => (
                <div key={b.id} className="card" style={{ padding: '24px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                      <div style={{ minWidth: '48px', width: '48px', height: '48px', borderRadius: '50%', background: b.type === 'tenant' ? 'var(--warning-light)' : 'var(--primary-light)', color: b.type === 'tenant' ? 'var(--warning-dark)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700 }}>
                        {b.code}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Outfit', fontSize: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name || 'Unknown'}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{b.type === 'tenant' ? 'Tenant' : 'Owner'}</div>
                      </div>
                    </div>
                    <button 
                      className="print-hidden"
                      onClick={() => handleCopyMemberWhatsApp(b)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedStates[b.id] ? 'var(--success)' : 'var(--text-tertiary)', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                      title="Copy WhatsApp Summary"
                    >
                      {copiedStates[b.id] ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-muted)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
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
                    <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--primary)', fontSize: '24px' }}>Rs. {b.totalBill.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}

          {/* Raw HTML Modal */}
          {showWapdaHtml && wapdaBillDetails?.rawHtml && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '24px' }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: '8px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Outfit', color: 'var(--text-primary)' }}>Original MEPCO Bill</h3>
                  <button 
                    onClick={() => setShowWapdaHtml(false)}
                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Close
                  </button>
                </div>
                <iframe 
                  srcDoc={wapdaBillDetails.rawHtml}
                  style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#fff' }}
                  title="MEPCO Bill"
                />
              </div>
            </div>
          )}

          <ConfirmModal
            isOpen={!!billToDelete}
            title="Delete Bill"
            message="Are you sure you want to delete this bill? This cannot be undone."
            onConfirm={executeDeleteBill}
            onCancel={() => setBillToDelete(null)}
            confirmText="Delete"
          />
        </div>
  );
}
