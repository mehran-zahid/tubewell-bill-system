import React, { useState, useEffect, useMemo } from 'react';
import { BookText, Plus, Filter } from '../components/Icons';
import { addRegisterEntry, getRegisterEntries, getLatestEndReading } from '../services/registerService';
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
          membersSnapshot.forEach(doc => membersData.push({ id: doc.id, ...doc.data() }));
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
    return entries.filter(entry => entry.memberId === selectedMember);
  }, [entries, selectedMember]);

  // Max date for non-admins to prevent picking a start date older than 6 months
  const maxAllowedDate = useMemo(() => {
    if (isAdmin) return undefined;
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  }, [isAdmin]);

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
        )}
      </div>

      {/* FILTER BAR */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', 
        padding: '16px', background: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-default)', alignItems: 'flex-end', flexShrink: 0
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
                {filteredEntries.map((entry, idx) => (
                  <tr key={entry.id} style={{ background: 'var(--bg-surface)', transition: 'background 0.2s', ':hover': { background: 'var(--bg-surface-hover)' } }}>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                          {entry.userCode || entry.memberName.charAt(0)}
                        </div>
                        {entry.memberName}
                      </div>
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {entry.startReading}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {entry.endReading}
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-default)', padding: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'Outfit' }}>
                      {entry.unitsConsumed}
                    </td>
                  </tr>
                ))}
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
