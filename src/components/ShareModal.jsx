import React, { useState } from 'react';
import { X, Copy, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function ShareModal({ isOpen, onClose, onCopyText, onCopyImage, isGenerating }) {
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
        <div style={{ display: 'flex', position: 'relative', background: 'var(--bg-muted)', padding: '4px', borderRadius: '10px', marginBottom: '24px' }}>
          <div style={{
            position: 'absolute',
            top: '4px',
            bottom: '4px',
            left: language === 'urdu' ? '4px' : '50%',
            width: 'calc(50% - 4px)',
            background: 'var(--primary)',
            borderRadius: '8px',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
            transition: 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 0
          }} />
          <button 
            onClick={() => setLanguage('urdu')}
            style={{ 
              flex: 1, 
              padding: '8px 0', 
              border: 'none', 
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
              fontSize: '16px',
              color: language === 'urdu' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'color 0.3s ease-in-out',
              position: 'relative',
              zIndex: 1
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
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              color: language === 'english' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'color 0.3s ease-in-out',
              position: 'relative',
              zIndex: 1
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
              if (isGenerating) return;
              onCopyImage(language);
            }} 
            disabled={isGenerating}
            className="btn btn-outline" 
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
              width: '100%', background: 'transparent', 
              border: '1px solid var(--border-default)', 
              color: 'var(--text-primary)',
              opacity: isGenerating ? 0.7 : 1,
              cursor: isGenerating ? 'not-allowed' : 'pointer'
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="spinner" />
                Processing...
              </>
            ) : (
              <>
                <ImageIcon size={20} />
                Copy as Image
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
