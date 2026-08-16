import React from 'react';

export const SkeletonRow = ({ height = '40px', width = '100%', style = {} }) => (
  <div className="skeleton" style={{ height, width, marginBottom: '8px', ...style }}></div>
);

export const SkeletonCard = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card skeleton-card" style={{ marginBottom: '16px' }}>
          <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '16px' }}></div>
          <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: '12px' }}></div>
          <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '12px' }}></div>
          <div className="skeleton" style={{ height: '16px', width: '70%' }}></div>
        </div>
      ))}
    </>
  );
};

export const SkeletonTable = ({ rows = 5 }) => {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '16px' }}>
        <div className="skeleton" style={{ height: '20px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '20px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '20px', flex: 1 }}></div>
        <div className="skeleton" style={{ height: '20px', flex: 1 }}></div>
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} style={{ padding: '16px', borderBottom: idx < rows - 1 ? '1px solid var(--border-default)' : 'none', display: 'flex', gap: '16px' }}>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
          <div className="skeleton" style={{ height: '16px', flex: 1 }}></div>
        </div>
      ))}
    </div>
  );
};
