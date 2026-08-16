import React from 'react';

export default function RegisterStats({ entries, memberName }) {
  const totalRuns = entries.length;
  const totalHours = entries.reduce((sum, entry) => sum + (parseFloat(entry.unitsConsumed) || 0), 0) / 100;
  const avgHours = totalRuns > 0 ? (totalHours / totalRuns).toFixed(2) : 0;

  return (
    <div className="stat-card-grid" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
      gap: '8px', 
      marginBottom: '20px' 
    }}>
      {/* Total Hours Card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{ 
            width: '24px', height: '24px', borderRadius: '6px', 
            background: 'var(--primary-light)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Total Hours {memberName === 'all' ? '(All)' : ''}
          </span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {totalHours.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Total Runs Card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{ 
            width: '24px', height: '24px', borderRadius: '6px', 
            background: '#e0f2fe', color: '#0284c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Tubewell Runs
          </span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {totalRuns} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>times</span>
        </span>
      </div>

      {/* Average Card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{ 
            width: '24px', height: '24px', borderRadius: '6px', 
            background: '#dcfce7', color: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Avg. Hours / Run
          </span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {avgHours}
        </span>
      </div>
    </div>
  );
}
