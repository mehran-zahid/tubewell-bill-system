import React from 'react';

export default function RegisterStats({ entries, memberName }) {
  const totalRuns = entries.length;
  const totalUnits = entries.reduce((sum, entry) => sum + (parseFloat(entry.unitsConsumed) || 0), 0);
  const avgUnits = totalRuns > 0 ? (totalUnits / totalRuns).toFixed(1) : 0;

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
      gap: '16px', 
      marginBottom: '24px' 
    }}>
      {/* Total Units Card */}
      <div style={{
        background: 'var(--surface-color)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ 
            width: '32px', height: '32px', borderRadius: '8px', 
            background: 'var(--primary-light)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Total Units {memberName === 'all' ? '(All)' : ''}
          </span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {totalUnits.toLocaleString()}
        </span>
      </div>

      {/* Total Runs Card */}
      <div style={{
        background: 'var(--surface-color)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ 
            width: '32px', height: '32px', borderRadius: '8px', 
            background: '#e0f2fe', color: '#0284c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Tubewell Runs
          </span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {totalRuns} <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 400 }}>times</span>
        </span>
      </div>

      {/* Average Card */}
      <div style={{
        background: 'var(--surface-color)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ 
            width: '32px', height: '32px', borderRadius: '8px', 
            background: '#dcfce7', color: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Avg. Units / Run
          </span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {avgUnits}
        </span>
      </div>
    </div>
  );
}
