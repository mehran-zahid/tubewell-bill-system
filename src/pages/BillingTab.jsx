import React, { useState, useEffect } from 'react';
import { initFirebaseAsync } from '../config/firebase';
import { getRegisterEntries } from '../services/registerService';
import { calculateBilling } from '../utils/billingCalculator';
import { Calculator, Download } from '../components/Icons';

export default function BillingTab({ isAdmin }) {
  const [members, setMembers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [billingResult, setBillingResult] = useState(null);

  // Helper to load from localStorage
  const loadStored = (key, defaultVal) => {
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
  const [wapdaBill, setWapdaBill] = useState(() => loadStored('wapdaBill', ''));
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

  const [liveWarnings, setLiveWarnings] = useState([]);

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

  // Fetch entries in real-time when dates change
  useEffect(() => {
    const fetchEntries = async () => {
      if (startDate && endDate) {
        try {
          const fetchedEntries = await getRegisterEntries(startDate, endDate);
          setEntries(fetchedEntries);
        } catch (e) {
          console.error("Error fetching entries for validation", e);
        }
      } else {
        setEntries([]);
      }
    };
    fetchEntries();
  }, [startDate, endDate]);

  // Real-time validation
  useEffect(() => {
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
  }, [entries, cycleStartReading, cycleEndReading]);

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
        alert("Please select a Start Date and End Date.");
        setLoading(false);
        return;
      }

      // 1. Fetch logbook entries for the date range
      let fetchedEntries = await getRegisterEntries(startDate, endDate);

      // 1b. If cycle readings are provided, strictly filter out entries that fall outside this meter window
      // This prevents pulling in entries from the same calendar day that actually belong to the previous/next billing cycle!
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

      // 2. Calculate
      const result = calculateBilling(members, fetchedEntries, wapdaBill, fixedExpenses);
      
      // 3. Verification
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
        if (diff > 0.05) { // Floating point tolerance
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
      
    } catch (error) {
      console.error("Error calculating bill", error);
      alert("Failed to calculate bill.");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Billing System</h1>
          <p style={{ fontFamily: 'Inter', fontSize: '15px', color: 'var(--text-secondary)' }}>Calculate and generate monthly bills</p>
        </div>
      </div>

      {/* Input Panel */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Bill Details</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Left Column - General Info */}
          <div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Billing Title</label>
              <input 
                type="text" 
                className="input-field" 
                value={billingTitle}
                onChange={(e) => setBillingTitle(e.target.value)}
                placeholder="e.g. August 2026"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Start Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">End Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Cycle Start Reading</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={cycleStartReading}
                  onChange={(e) => setCycleStartReading(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Cycle End Reading</label>
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

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Total WAPDA Bill (Rs.)</label>
              <input 
                type="number" 
                className="input-field" 
                placeholder="e.g. 50000"
                value={wapdaBill}
                onChange={(e) => setWapdaBill(e.target.value)}
              />
            </div>
          </div>

          {/* Right Column - Fixed Expenses */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Fixed Expenses</label>
              <button 
                onClick={handleAddExpense}
                style={{ fontSize: '13px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                + Add Item
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', flex: 1 }}>
              {fixedExpenses.map((expense, i) => (
                <div key={expense.id} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Title (e.g. Salary)"
                    style={{ flex: 1 }}
                    value={expense.title}
                    onChange={(e) => handleExpenseChange(expense.id, 'title', e.target.value)}
                  />
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Rs."
                    style={{ width: '100px' }}
                    value={expense.amount}
                    onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)}
                  />
                  <button 
                    onClick={() => handleRemoveExpense(expense.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 4px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
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
          </div>
        </div>
      </div>

      {/* Results Panel */}
      {!billingResult ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            <Calculator size={32} />
          </div>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Bill Generated
          </h3>
          <p style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
            Enter the WAPDA bill and click Generate to see the calculated breakdown for each member and tenant.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>WAPDA HOURLY RATE</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>
              Rs. {billingResult.wapdaHourlyRate ? billingResult.wapdaHourlyRate.toFixed(2) : '0.00'} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-tertiary)' }}>/ hr</span>
            </div>
          </div>
          <div className="card" style={{ padding: '20px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL METER HOURS</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {billingResult.totalConsumedHours.toFixed(2)}h
            </div>
          </div>
          <div className="card" style={{ padding: '20px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 600 }}>Total Fixed</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>Rs. {billingResult.totalFixedExpenses.toLocaleString()}</div>
          </div>
        </div>
      )}

      {billingResult && (
        <div>
          {/* Breakdown Table */}
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
            </div>
          )}
        </div>
  );
}
