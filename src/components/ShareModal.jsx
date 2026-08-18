import React, { useState } from 'react';
import { X, Copy, Image as ImageIcon } from 'lucide-react';

export default function ShareModal({ isOpen, onClose, onCopyText, onCopyImage }) {
  const [language, setLanguage] = useState('urdu'); // 'urdu' | 'english'

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          <X size={24} />
        </button>
        
        <h2 style={{ margin: '0 0 24px 0' }}>Share Receipt</h2>
        
        {/* Language Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-muted)', padding: '4px', borderRadius: '8px', marginBottom: '24px' }}>
          <button 
            onClick={() => setLanguage('urdu')}
            style={{ 
              flex: 1, 
              padding: '8px 0', 
              border: 'none', 
              borderRadius: '6px', 
              background: language === 'urdu' ? 'var(--bg-card)' : 'transparent', 
              boxShadow: language === 'urdu' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              fontSize: '18px',
              color: language === 'urdu' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            اردو
          </button>
          <button 
            onClick={() => setLanguage('english')}
            style={{ 
              flex: 1, 
              padding: '8px 0', 
              border: 'none', 
              borderRadius: '6px', 
              background: language === 'english' ? 'var(--bg-card)' : 'transparent', 
              boxShadow: language === 'english' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              fontWeight: '500',
              color: language === 'english' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            English
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => {
              onCopyText(language);
              onClose();
            }} 
            className="btn" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
          >
            <Copy size={20} />
            Copy as Text
          </button>
          
          <button 
            onClick={() => {
              onCopyImage(language);
              onClose();
            }} 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <ImageIcon size={20} />
            Copy as Image
          </button>
        </div>
      </div>
    </div>
  );
}
