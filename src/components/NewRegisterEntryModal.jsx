import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';

export default function NewRegisterEntryModal({ isOpen, onClose, onSubmit, members, latestEndReading }) {
  const { showToast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [memberId, setMemberId] = useState('');
  const [startReading, setStartReading] = useState('');
  const [endReading, setEndReading] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fill start reading when modal opens or latestEndReading changes
  useEffect(() => {
    if (isOpen) {
      setStartReading(latestEndReading !== null ? latestEndReading.toString() : '');
      setDate(new Date().toISOString().split('T')[0]); // Reset date to today
      setMemberId('');
      setEndReading('');
      setIsSaving(false);
    }
  }, [isOpen, latestEndReading]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !memberId || !startReading || !endReading) {
      showToast("Please fill all fields.", "warning");
      return;
    }
    
    if (parseFloat(endReading) <= parseFloat(startReading)) {
      showToast("End reading must be greater than start reading.", "error");
      return;
    }

    const selectedMember = members.find(m => m.id === memberId);

    setIsSaving(true);
    try {
      await onSubmit({
        date,
        memberId,
        memberName: selectedMember ? selectedMember.nameEn : 'Unknown',
        userCode: selectedMember ? selectedMember.userCode : '',
        startReading,
        endReading
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
        padding: '32px', width: '100%', maxWidth: '400px',
        boxShadow: 'var(--shadow-xl)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Add Logbook Entry
          </h2>
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Date
            </label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
              disabled={isSaving}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Member
            </label>
            <select 
              value={memberId} 
              onChange={(e) => setMemberId(e.target.value)}
              className="input-field"
              disabled={isSaving}
              required
            >
              <option value="" disabled>Select Member</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.nameEn} - {m.userCode}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 140px' }}>
              <label style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Start Reading
              </label>
              <input 
                type="text" 
                inputMode="decimal"
                value={startReading} 
                onChange={(e) => setStartReading(e.target.value)}
                className="input-field"
                placeholder="e.g. 10240"
                disabled={isSaving}
                required
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 140px' }}>
              <label style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                End Reading
              </label>
              <input 
                type="text" 
                inputMode="decimal"
                value={endReading} 
                onChange={(e) => setEndReading(e.target.value)}
                className="input-field"
                placeholder="e.g. 10255"
                disabled={isSaving}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button 
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '10px 20px', background: 'var(--bg-muted)', color: 'var(--text-secondary)',
                border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'Inter', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{
                padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-inverse)',
                border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'Inter', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {isSaving && <Loader2 className="spinner" size={16} />}
              {isSaving ? 'Adding...' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
