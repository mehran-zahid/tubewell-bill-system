import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookText, Plus, Filter, AlertTriangle, Trash2 } from '../components/Icons';
import { addRegisterEntry, getRegisterEntries, getLatestEndReading, updateRegisterEntries, deleteRegisterEntry } from '../services/registerService';
import { initFirebaseAsync } from '../config/firebase';
import NewRegisterEntryModal from '../components/NewRegisterEntryModal';
import RegisterStats from '../components/RegisterStats';
import CustomDropdown from '../components/CustomDropdown';

export default function RegisterTab({ isAdmin }) {
  const [entries, setEntries] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [latestEndReading, setLatestEndReading] = useState(null);

  // Filter States
  const [timeframe, setTimeframe] = useState('30_days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedMember, setSelectedMember] = useState('all');

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftEntries, setDraftEntries] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const inputRefs = useRef({});

  // Calculate Date Ranges
  const getCalculatedDateRange = () => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    if (timeframe === '30_days') start.setDate(today.getDate() - 30);
    else if (timeframe === '60_days') start.setDate(today.getDate() - 60);
    else if (timeframe === '90_days') start.setDate(today.getDate() - 90);
    else if (timeframe === 'custom') {
        start = customStartDate ? new Date(customStartDate) : new Date(today.getFullYear(), 0, 1);
        end = customEndDate ? new Date(customEndDate) : today;
    }

    // Role Restriction: non-admins max 6 months
    if (!isAdmin) {
       const sixMonthsAgo = new Date();
       sixMonthsAgo.setMonth(today.getMonth() - 6);
       if (start < sixMonthsAgo) {
           start = sixMonthsAgo;
       }
    }

    // Fix end date to include full day
    end.setHours(23, 59, 59, 999);

    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { db, firebase } = await initFirebaseAsync();
        
        // Fetch Members for the dropdown (only fetch once if empty)
        if (members.length === 0) {
          const membersSnapshot = await firebase.getDocs(firebase.collection(db, 'members'));
          const membersData = [];
          membersSnapshot.forEach(doc => {
            const m = { id: doc.id, ...doc.data() };
            membersData.push(m);
            // Also push tenants with a tenantCode as unified members
            if (m.tenants && Array.isArray(m.tenants)) {
              m.tenants.forEach(t => {
                if (t.tenantCode) {
                  membersData.push({
                    id: t.id || `tenant_${doc.id}_${t.tenantCode}`,
                    userCode: t.tenantCode.toString(),
                    nameEn: t.tenantNameEn || `Tenant ${t.tenantCode}`,
                    isTenant: true,
                    ownerId: doc.id
                  });
                }
              });
            }
          });
          
          membersData.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
          setMembers(membersData);
        }

        // Calculate constrained dates based on filters
        const { startDate, endDate } = getCalculatedDateRange();

        // Fetch Logbook Entries
        const fetchedEntries = await getRegisterEntries(startDate, endDate);
        setEntries(fetchedEntries);

        // Fetch latest end reading for auto-fill (unfiltered)
        if (latestEndReading === null) {
          const latest = await getLatestEndReading();
          setLatestEndReading(latest);
        }

      } catch (error) {
        console.error("Error fetching register data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeframe, customStartDate, customEndDate, isAdmin]);

  const handleAddEntry = async (data) => {
    try {
      const newEntry = await addRegisterEntry(data);
      // Let the useEffect refetch to handle date filtering properly, or inject locally
      setEntries([newEntry, ...entries].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLatestEndReading(newEntry.endReading);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding entry:", error);
      alert("Failed to add entry.");
    }
  };

  // Client-side Member Filter
  const filteredEntries = useMemo(() => {
    if (selectedMember === 'all') return entries;
    const mem = members.find(m => m.id === selectedMember);
    if (!mem) return [];
    
    return entries.filter(entry => 
      String(entry.memberId) === String(mem.id) || 
      String(entry.memberId) === String(mem.userCode) ||
      (parseInt(entry.memberId, 10) === parseInt(mem.userCode, 10) && !isNaN(parseInt(mem.userCode, 10)))
    );
  }, [entries, selectedMember, members]);

  // Max date for non-admins to prevent picking a start date older than 6 months
  const maxAllowedDate = useMemo(() => {
    if (isAdmin) return undefined;
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  }, [isAdmin]);

  const handleSelectRow = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedRows.length} selected readings?`)) return;
    try {
      setIsSaving(true);
      for (const id of selectedRows) {
        await deleteRegisterEntry(id);
      }
      setEntries(prev => prev.filter(e => !selectedRows.includes(e.id)));
      setSelectedRows([]);
      // Clean up drafts if they are in edit mode
      setDraftEntries(prev => {
        const newDrafts = { ...prev };
        selectedRows.forEach(id => delete newDrafts[id]);
        return newDrafts;
      });
    } catch (e) {
      console.error("Failed to delete selected:", e);
      alert("Failed to delete selected entries.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- EDIT MODE LOGIC ---
  const toggleEditMode = () => {
    if (isEditMode) {
      if (window.confirm("Discard unsaved changes?")) setIsEditMode(false);
    } else {
      const drafts = {};
      filteredEntries.forEach(entry => drafts[entry.id] = { ...entry });
      setDraftEntries(drafts);
      setIsEditMode(true);
    }
  };

  const handleCellChange = (id, field, value) => {
    setDraftEntries(prev => {
      const newDraft = { ...prev[id], [field]: value };
      if (field === 'startReading' || field === 'endReading') {
        const s = parseFloat(newDraft.startReading) || 0;
        const e = parseFloat(newDraft.endReading) || 0;
        newDraft.unitsConsumed = e - s;
      }
      return { ...prev, [id]: newDraft };
    });
  };

  const handleKeyDown = (e, rowIndex, colIndex) => {
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (e.key === 'ArrowUp') nextRow = rowIndex - 1;
    else if (e.key === 'ArrowDown') nextRow = rowIndex + 1;
    else if (e.key === 'ArrowLeft') nextCol = colIndex - 1;
    else if (e.key === 'ArrowRight') nextCol = colIndex + 1;
    else return;

    const nextRef = inputRefs.current[`${nextRow}-${nextCol}`];
    if (nextRef) {
      e.preventDefault();
      nextRef.focus();
      if (typeof nextRef.select === 'function') nextRef.select();
    }
  };

  const handleSaveChanges = async () => {
    const updates = [];
    filteredEntries.forEach(original => {
      const draft = draftEntries[original.id];
      if (
        draft.date !== original.date ||
        draft.memberId !== original.memberId ||
        parseFloat(draft.startReading) !== parseFloat(original.startReading) ||
        parseFloat(draft.endReading) !== parseFloat(original.endReading)
      ) {
        if (draft.memberId !== original.memberId) {
          const mem = members.find(m => m.id === draft.memberId);
          if (mem) {
             draft.memberName = mem.nameEn;
             draft.userCode = mem.userCode;
          }
        }
        updates.push(draft);
      }
    });

    if (updates.length > 0) {
      setIsSaving(true);
      try {
        await updateRegisterEntries(updates);
        setEntries(prev => {
          let newArr = prev.map(p => {
            const up = updates.find(u => u.id === p.id);
            return up ? up : p;
          });
          // re-sort if date changed
          newArr.sort((a, b) => new Date(b.date) - new Date(a.date));
          return newArr;
        });
        setIsEditMode(false);
      } catch (e) {
        console.error("Save failed:", e);
        alert("Failed to save changes.");
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditMode(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Tubewell Logbook
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Chronological record of tubewell runs. Start and end readings for each member.
          </p>
        </div>
        
        {isAdmin && (
          <div style={{ display: 'flex', gap: '12px' }}>
            {selectedRows.length > 0 && (
              <button 
                onClick={handleDeleteSelected}
                className="btn btn-secondary"
                disabled={isSaving}
                style={{ 
                  borderRadius: 'var(--radius-md)', padding: '12px 24px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px',
                  color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <Trash2 size={16} />
                Delete Selected ({selectedRows.length})
              </button>
            )}
            
            {isEditMode ? (
              <>
                <button 
                  onClick={toggleEditMode}
                  className="btn btn-secondary"
                  disabled={isSaving}
                  style={{ borderRadius: 'var(--radius-md)', padding: '12px 24px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveChanges}
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ borderRadius: 'var(--radius-md)', padding: '12px 24px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px', background: 'var(--success)', border: 'none' }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={toggleEditMode}
                  className="btn btn-secondary"
                  style={{ borderRadius: 'var(--radius-md)', padding: '12px 24px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px' }}
                >
                  Edit Mode
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="btn btn-primary"
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                    background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none',
                    borderRadius: 'var(--radius-md)', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px',
                    cursor: 'pointer', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Plus size={16} />
                  Add Entry
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* FILTER BAR */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', 
        padding: '16px', background: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-default)', alignItems: 'flex-end', flexShrink: 0,
        opacity: isEditMode ? 0.5 : 1, pointerEvents: isEditMode ? 'none' : 'auto', transition: 'opacity 0.2s'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Timeframe</label>
          <CustomDropdown 
            value={timeframe} 
            onChange={(val) => setTimeframe(val)}
            options={[
              { value: '30_days', label: 'Last 30 Days' },
              { value: '60_days', label: 'Last 60 Days' },
              { value: '90_days', label: 'Last 90 Days' },
              { value: 'custom', label: 'Custom Range' }
            ]}
            style={{ width: '160px' }}
          />
        </div>

        {timeframe === 'custom' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Start Date {!isAdmin && '(Max 6mo)'}
              </label>
              <input 
                type="date" 
                className="input-field" 
                value={customStartDate} 
                min={maxAllowedDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: '8px 12px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>End Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={customEndDate} 
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: '8px 12px' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: 'auto' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Member</label>
          <CustomDropdown 
            value={selectedMember} 
            onChange={(val) => setSelectedMember(val)}
            options={[
              { value: 'all', label: 'All Members' },
              ...members.map(m => ({
                value: m.id,
                label: `${m.nameEn} - ${m.userCode}`
              }))
            ]}
            style={{ minWidth: '200px' }}
          />
        </div>
      </div>

      {/* STATS */}
      {!loading && <RegisterStats entries={filteredEntries} memberName={selectedMember === 'all' ? 'all' : members.find(m => m.id === selectedMember)?.nameEn} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading Logbook...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', textAlign: 'center', flex: 1 }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            <Filter size={32} />
          </div>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Readings Found
          </h3>
          <p style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>
            Try adjusting your filters to see more history.
          </p>
        </div>
      ) : (
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: '800px', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', width: '48px' }}>
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedRows(filteredEntries.map(entry => entry.id));
                          else setSelectedRows([]);
                        }}
                        checked={filteredEntries.length > 0 && selectedRows.length === filteredEntries.length}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </th>
                  )}
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>
                    Date
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '31%' }}>
                    Member
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '18%' }}>
                    Start Reading
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '18%' }}>
                    End Reading
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', fontFamily: 'Inter', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '18%' }}>
                    Units Consumed
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, rowIndex) => {
                  const draft = isEditMode ? draftEntries[entry.id] : entry;
                  if (!draft) return null; // safety check
                  const isSelected = selectedRows.includes(entry.id);
                  return (
                  <tr key={entry.id} style={{ background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)', transition: 'background 0.2s', ':hover': { background: 'var(--bg-surface-hover)' } }}>
                    {isAdmin && (
                      <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => handleSelectRow(entry.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                    )}
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {isEditMode ? (
                        <input 
                          type="date"
                          value={draft.date}
                          onChange={(e) => handleCellChange(entry.id, 'date', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                          ref={el => inputRefs.current[`${rowIndex}-0`] = el}
                          className="input-field"
                          style={{ padding: '8px', textAlign: 'center' }}
                        />
                      ) : (
                        new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                      {isEditMode ? (
                        <select
                          value={draft.memberId}
                          onChange={(e) => handleCellChange(entry.id, 'memberId', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                          ref={el => inputRefs.current[`${rowIndex}-1`] = el}
                          className="input-field"
                          style={{ padding: '8px' }}
                        >
                          {members.map(m => (
                            <option key={m.id} value={m.id}>{m.nameEn} - {m.userCode}</option>
                          ))}
                        </select>
                      ) : (
                        (() => {
                          const mem = members.find(m => 
                            m.id === String(entry.memberId) || 
                            String(m.userCode) === String(entry.memberId) ||
                            (parseInt(m.userCode, 10) === parseInt(entry.memberId, 10) && !isNaN(parseInt(m.userCode, 10)))
                          );
                          const safeName = entry.memberName || mem?.nameEn || 'Unknown';
                          const safeCode = entry.userCode || mem?.userCode || (safeName !== 'Unknown' ? safeName.charAt(0) : 'U');
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                                {safeCode}
                              </div>
                              {safeName}
                            </div>
                          );
                        })()
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {isEditMode ? (
                        <input 
                          type="number"
                          value={draft.startReading}
                          onChange={(e) => handleCellChange(entry.id, 'startReading', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                          ref={el => inputRefs.current[`${rowIndex}-2`] = el}
                          className="input-field"
                          style={{ padding: '8px', textAlign: 'center' }}
                        />
                      ) : (
                        entry.startReading
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {isEditMode ? (
                        <input 
                          type="number"
                          value={draft.endReading}
                          onChange={(e) => handleCellChange(entry.id, 'endReading', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                          ref={el => inputRefs.current[`${rowIndex}-3`] = el}
                          className="input-field"
                          style={{ padding: '8px', textAlign: 'center' }}
                        />
                      ) : (
                        entry.endReading
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'Outfit', background: isEditMode ? 'var(--bg-muted)' : 'transparent' }}>
                      {draft.unitsConsumed}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewRegisterEntryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEntry}
        members={members}
        latestEndReading={latestEndReading}
      />
    </div>
  );
}
