import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Filter, Trash2, MoreVertical } from '../components/Icons';
import { addRegisterEntry, getRegisterEntries, getLatestEndReading, updateRegisterEntries, deleteRegisterEntry } from '../services/registerService';
import { initFirebaseAsync } from '../config/firebase';
import NewRegisterEntryModal from '../components/NewRegisterEntryModal';
import RegisterStats from '../components/RegisterStats';
import CustomDropdown from '../components/CustomDropdown';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { SkeletonLogbookTable } from '../components/Skeleton';

export default function RegisterTab({ isAdmin }) {
  const { showToast } = useToast();
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

  // Confirm Modals
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Calculate Date Ranges
  const getCalculatedDateRange = useCallback(() => {
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
  }, [timeframe, customStartDate, customEndDate, isAdmin]);

  // Effect 1: Load members & latest reading once on mount only
  useEffect(() => {
    const loadStaticData = async () => {
      try {
        const { db, firebase } = await initFirebaseAsync();
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
                  id: `tenant_${doc.id}_${t.tenantCode}`,
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
      } catch (error) {
        console.error("Error fetching members:", error);
      }

      try {
        const latest = await getLatestEndReading();
        setLatestEndReading(latest);
      } catch (error) {
        console.error("Error fetching latest reading:", error);
      }
    };
    loadStaticData();
  }, []); // runs once on mount

  // Effect 2: Fetch logbook entries whenever filters change
  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getCalculatedDateRange();
        const fetchedEntries = await getRegisterEntries(startDate, endDate);
        setEntries(fetchedEntries);
      } catch (error) {
        console.error("Error fetching register data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [timeframe, customStartDate, customEndDate, isAdmin, getCalculatedDateRange]);

  const handleAddEntry = async (data) => {
    try {
      const newEntry = await addRegisterEntry(data);
      // Let the useEffect refetch to handle date filtering properly, or inject locally
      setEntries([newEntry, ...entries].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLatestEndReading(newEntry.endReading);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding entry:", error);
      showToast("Failed to add entry. See console.", "error");
    }
  };

  // Client-side Member Filter and Sort
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (selectedMember !== 'all') {
      const mem = members.find(m => m.id === selectedMember);
      if (mem) {
        result = entries.filter(entry => 
          String(entry.memberId) === String(mem.id) || 
          String(entry.memberId) === String(mem.userCode) ||
          (parseInt(entry.memberId, 10) === parseInt(mem.userCode, 10) && !isNaN(parseInt(mem.userCode, 10)))
        );
      } else {
        result = [];
      }
    }

    // Sort logically: Newest Date first. If same date, Highest Reading first (most recent on top)
    return [...result].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateB - dateA; // Descending by date
      }
      return (parseFloat(b.startReading) || 0) - (parseFloat(a.startReading) || 0); // Descending by meter reading
    });
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

  const handleDeleteSelected = () => {
    if (selectedRows.length === 0) return;
    setConfirmDeleteOpen(true);
  };

  const executeDeleteSelected = async () => {
    setConfirmDeleteOpen(false);
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
      showToast("Selected entries deleted.", "success");
    } catch (e) {
      console.error("Failed to delete selected:", e);
      showToast("Failed to delete selected entries.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- EDIT MODE LOGIC ---
  const toggleEditMode = () => {
    if (isEditMode) {
      setConfirmDiscardOpen(true);
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
        showToast("Changes saved successfully!", "success");
      } catch (e) {
        console.error("Save failed:", e);
        showToast("Failed to save changes.", "error");
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Register Readings
        </h1>
        
        {isAdmin && (
          <div className="header-actions" style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            {selectedRows.length > 0 && (
              <button 
                onClick={handleDeleteSelected}
                className="btn btn-secondary"
                disabled={isSaving}
                style={{ 
                  borderRadius: 'var(--radius-md)', padding: '8px 12px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px',
                  color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Trash2 size={16} />
                Delete ({selectedRows.length})
              </button>
            )}
            
            {isEditMode ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={toggleEditMode}
                  className="btn btn-secondary"
                  disabled={isSaving}
                  style={{ borderRadius: 'var(--radius-md)', padding: '8px 16px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveChanges}
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ borderRadius: 'var(--radius-md)', padding: '8px 16px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px', background: 'var(--success)', border: 'none' }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            ) : (
              <>
                <div className="desktop-actions" style={{ display: 'flex', gap: '12px' }}>
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
                </div>
                
                {/* Mobile Dropdown Actions */}
                <div className="mobile-actions" style={{ position: 'relative' }}>
                  <button 
                    className="btn-icon" 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    style={{ padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  >
                    <MoreVertical size={20} />
                  </button>
                  
                  {isMobileMenuOpen && (
                    <div className="dropdown-menu" style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 2px)',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      minWidth: '180px', zIndex: 50, padding: '8px'
                    }}>
                      <button 
                        onClick={() => { setIsMobileMenuOpen(false); toggleEditMode(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontFamily: 'Inter', fontWeight: 500, color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      >
                        Edit Mode
                      </button>
                      <button 
                        onClick={() => { setIsMobileMenuOpen(false); setIsModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontFamily: 'Inter', fontWeight: 500, color: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}
                      >
                        <Plus size={16} />
                        Add Entry
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* FILTER BAR */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', 
        padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-default)', alignItems: 'flex-end', flexShrink: 0,
        opacity: isEditMode ? 0.5 : 1, pointerEvents: isEditMode ? 'none' : 'auto', transition: 'opacity 0.2s'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 130px' }}>
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
          />
        </div>

        {timeframe === 'custom' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 130px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 130px' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 130px' }}>
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
          />
        </div>
      </div>

      {/* STATS */}
      {!loading && <RegisterStats entries={filteredEntries} memberName={selectedMember === 'all' ? 'all' : members.find(m => m.id === selectedMember)?.nameEn} />}

      {loading ? (
        <div style={{ padding: '0' }}>
          <SkeletonLogbookTable rows={5} />
        </div>
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
          {/* Desktop Table View */}
          <div className="desktop-table-view" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table className="responsive-table" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center', width: '48px' }}>
                      <div style={{ padding: '8px', display: 'flex', justifyContent: 'center' }}>
                        <input 
                          type="checkbox" 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRows(filteredEntries.map(entry => entry.id));
                            else setSelectedRows([]);
                          }}
                          checked={filteredEntries.length > 0 && selectedRows.length === filteredEntries.length}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        />
                      </div>
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
                    Hours Consumed
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
                      <td data-label="SELECT" style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', textAlign: 'center' }}>
                        <div style={{ padding: '8px', display: 'flex', justifyContent: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleSelectRow(entry.id)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </div>
                      </td>
                    )}
                    <td data-label="DATE" style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
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
                    <td data-label="MEMBER" style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                      {isEditMode ? (
                        <select
                          value={
                            (() => {
                              const mem = members.find(m => 
                                m.id === String(draft.memberId) || 
                                String(m.userCode) === String(draft.memberId) ||
                                (parseInt(m.userCode, 10) === parseInt(draft.memberId, 10) && !isNaN(parseInt(m.userCode, 10)))
                              );
                              return mem ? mem.id : draft.memberId;
                            })()
                          }
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
                              <div style={{ 
                                width: '28px', height: '28px', borderRadius: '50%', 
                                background: mem?.isTenant ? 'var(--warning-light)' : 'var(--primary-light)', 
                                color: mem?.isTenant ? 'var(--warning)' : 'var(--primary)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                fontSize: '12px', fontWeight: 700 
                              }}>
                                {safeCode}
                              </div>
                              {safeName}
                            </div>
                          );
                        })()
                      )}
                    </td>
                    <td data-label="START" style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {isEditMode ? (
                        <input 
                          type="text"
                          inputMode="decimal"
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
                    <td data-label="END" style={{ borderBottom: '1px solid var(--border-default)', padding: isEditMode ? '8px' : '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {isEditMode ? (
                        <input 
                          type="text"
                          inputMode="decimal"
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
                    <td data-label="HOURS" style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'Outfit', background: isEditMode ? 'var(--bg-muted)' : 'transparent' }}>
                      {((parseFloat(draft.unitsConsumed) || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Mobile Compact List View */}
          <div className="mobile-list-view" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {filteredEntries.map((entry) => {
              const draft = isEditMode ? draftEntries[entry.id] : entry;
              if (!draft) return null;
              const isSelected = selectedRows.includes(entry.id);
              
              const mem = members.find(m => 
                m.id === String(draft.memberId) || 
                String(m.userCode) === String(draft.memberId) ||
                (parseInt(m.userCode, 10) === parseInt(draft.memberId, 10) && !isNaN(parseInt(m.userCode, 10)))
              );
              const safeName = entry.memberName || mem?.nameEn || 'Unknown';
              const safeCode = entry.userCode || mem?.userCode || (safeName !== 'Unknown' ? safeName.charAt(0) : 'U');

              return (
                <div 
                  key={`mob-${entry.id}`} 
                  className="mobile-entry-card" 
                  onClick={() => { if(isAdmin && !isEditMode) handleSelectRow(entry.id) }} 
                  style={{ 
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                    cursor: isAdmin && !isEditMode ? 'pointer' : 'default'
                  }}
                >
                  <div className="mobile-entry-header">
                    <div className="mobile-entry-member">
                      {isAdmin && !isEditMode && (
                        <div style={{ padding: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => handleSelectRow(entry.id)} 
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }} 
                          />
                        </div>
                      )}
                      {isEditMode ? (
                        <select 
                          value={mem ? mem.id : draft.memberId} 
                          onChange={(e) => handleCellChange(entry.id, 'memberId', e.target.value)} 
                          className="input-field" 
                          style={{ padding: '8px', minWidth: '140px' }}
                        >
                          {members.map(m => <option key={m.id} value={m.id}>{m.nameEn} - {m.userCode}</option>)}
                        </select>
                      ) : (
                        <>
                          <div className="mobile-entry-avatar" style={{ background: mem?.isTenant ? 'var(--warning-light)' : 'var(--primary-light)', color: mem?.isTenant ? 'var(--warning)' : 'var(--primary)' }}>
                            {safeCode}
                          </div>
                          <span className="mobile-entry-name">{safeName}</span>
                        </>
                      )}
                    </div>
                    <div className="mobile-entry-hours">
                      <span className="mobile-entry-hours-value">{((parseFloat(draft.unitsConsumed) || 0) / 100).toFixed(2)}</span>
                      <span className="mobile-entry-hours-label">hrs</span>
                    </div>
                  </div>

                  <div className="mobile-entry-details">
                    <div className="mobile-detail-group">
                      <span className="mobile-detail-label">Date</span>
                      {isEditMode ? (
                        <input 
                          type="date" 
                          value={draft.date} 
                          onChange={(e) => handleCellChange(entry.id, 'date', e.target.value)} 
                          className="input-field" 
                          style={{ padding: '8px', maxWidth: '140px' }} 
                        />
                      ) : (
                        <span className="mobile-detail-value">{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>
                    <div className="mobile-detail-group" style={{ alignItems: 'flex-end' }}>
                      <span className="mobile-detail-label">Readings (Start &rarr; End)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isEditMode ? (
                          <>
                            <input 
                              type="text" 
                              inputMode="decimal" 
                              value={draft.startReading} 
                              onChange={(e) => handleCellChange(entry.id, 'startReading', e.target.value)} 
                              className="input-field" 
                              style={{ width: '70px', padding: '8px', textAlign: 'center' }} 
                            />
                            <span style={{ color: 'var(--text-tertiary)' }}>&rarr;</span>
                            <input 
                              type="text" 
                              inputMode="decimal" 
                              value={draft.endReading} 
                              onChange={(e) => handleCellChange(entry.id, 'endReading', e.target.value)} 
                              className="input-field" 
                              style={{ width: '70px', padding: '8px', textAlign: 'center' }} 
                            />
                          </>
                        ) : (
                          <span className="mobile-detail-value">{entry.startReading} <span style={{color:'var(--text-tertiary)', margin:'0 4px'}}>&rarr;</span> {entry.endReading}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
