import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const icons = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const iconStyles = {
  success: { bg: 'var(--success-light)', color: 'var(--success)' },
  error: { bg: 'var(--danger-light)', color: 'var(--danger)' },
  warning: { bg: 'var(--warning-light)', color: 'var(--warning)' },
  info: { bg: 'var(--primary-light)', color: 'var(--primary)' },
};

const Toast = ({ message, type = 'info', onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Matches the CSS transition duration
  };

  const style = iconStyles[type] || iconStyles.info;

  return (
    <div className={`toast toast-${type} ${isClosing ? 'toast-closing' : ''}`}>
      <div 
        className="toast-icon-wrapper" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: style.bg,
          color: style.color,
          flexShrink: 0
        }}
      >
        {icons[type]}
      </div>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={handleClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
