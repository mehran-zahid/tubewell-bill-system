import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const icons = {
  success: <CheckCircle size={18} style={{ color: 'var(--success)' }} />,
  error: <XCircle size={18} style={{ color: 'var(--danger)' }} />,
  warning: <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />,
  info: <Info size={18} style={{ color: 'var(--info)' }} />,
};

const Toast = ({ message, type = 'info', onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Matches the CSS transition duration
  };

  return (
    <div className={`toast toast-${type} ${isClosing ? 'toast-closing' : ''}`}>
      <div className="toast-icon-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
        {icons[type]}
      </div>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={handleClose} aria-label="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
