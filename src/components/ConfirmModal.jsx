import React, { useState } from 'react';
import { X } from './Icons';
import { Loader2 } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <button 
          onClick={onCancel}
          disabled={isConfirming}
          style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          <X size={24} />
        </button>
        
        <h2 style={{ margin: '0 0 16px 0' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.5' }}>{message}</p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={isConfirming} className="btn" style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}>
            {cancelText}
          </button>
          <button onClick={handleConfirm} disabled={isConfirming} className="btn" style={{ background: 'var(--danger)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isConfirming && <Loader2 className="spinner" size={16} />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
