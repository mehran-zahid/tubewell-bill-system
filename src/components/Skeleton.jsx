import React from 'react';

export const SkeletonRow = ({ height = '40px', width = '100%', style = {} }) => (
  <div className="skeleton" style={{ height, width, marginBottom: '8px', ...style }}></div>
);

export const SkeletonMemberCard = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card skeleton-card" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Card Header with Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-4)' }}>
            <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }}></div>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '20px', width: '60%', marginBottom: '6px' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '30%' }}></div>
            </div>
          </div>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-muted)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
            <div>
              <div className="skeleton" style={{ height: '12px', width: '70%', marginBottom: '6px' }}></div>
              <div className="skeleton" style={{ height: '16px', width: '50%' }}></div>
            </div>
            <div>
              <div className="skeleton" style={{ height: '12px', width: '70%', marginBottom: '6px' }}></div>
              <div className="skeleton" style={{ height: '16px', width: '50%' }}></div>
            </div>
          </div>
          {/* Tenant Block */}
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
             <div className="skeleton" style={{ height: '16px', width: '40%' }}></div>
          </div>
        </div>
      ))}
    </>
  );
};

export const SkeletonMembersTable = ({ rows = 5 }) => {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '16px', background: 'var(--bg-surface)' }}>
        <div className="skeleton" style={{ height: '16px', width: '30%' }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} style={{ padding: '16px 24px', borderBottom: idx < rows - 1 ? '1px solid var(--border-default)' : 'none', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '30%' }}>
            <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }}></div>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '16px', width: '70%', marginBottom: '4px' }}></div>
              <div className="skeleton" style={{ height: '12px', width: '40%' }}></div>
            </div>
          </div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonLogbookTable = ({ rows = 5 }) => {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '16px', background: 'var(--bg-surface)' }}>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} style={{ padding: '16px', borderBottom: idx < rows - 1 ? '1px solid var(--border-default)' : 'none', display: 'flex', gap: '16px' }}>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonScheduleTable = ({ rows = 7 }) => {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '16px', background: 'var(--bg-surface)' }}>
        <div className="skeleton" style={{ height: '16px', width: '80px' }}></div>
        <div className="skeleton" style={{ height: '16px', width: '120px' }}></div>
        <div className="skeleton" style={{ height: '16px', width: '80px' }}></div>
        <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '16px', width: '100px' }}></div>
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} style={{ padding: '16px 24px', borderBottom: idx < rows - 1 ? '1px solid var(--border-default)' : 'none', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="skeleton" style={{ height: '24px', width: '30px', borderRadius: '4px' }}></div>
          <div className="skeleton" style={{ height: '16px', width: '120px' }}></div>
          <div className="skeleton" style={{ height: '16px', width: '40px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '120px' }}></div>
          </div>
          <div className="skeleton" style={{ height: '16px', width: '100px' }}></div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonBillingList = () => {
  return (
    <div className="card print-hidden" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton" style={{ height: '22px', width: '180px' }}></div>
          <div className="skeleton" style={{ height: '40px', width: '250px', borderRadius: 'var(--radius-md)' }}></div>
        </div>
        <div className="skeleton" style={{ height: '40px', width: '180px', borderRadius: 'var(--radius-md)' }}></div>
      </div>
    </div>
  );
};
