import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from './Icons';

export default function CustomDropdown({ value, onChange, options, style = {}, disabled = false, className = '', error = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={`custom-dropdown ${className}`} ref={dropdownRef} style={{ position: 'relative', ...style }}>
      <button 
        type="button"
        className="input-field" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'var(--bg-surface)',
          padding: '10px 16px',
          width: '100%',
          textAlign: 'left',
          borderColor: error ? 'var(--danger)' : 'var(--border-default)'
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
          {selectedOption?.label}
        </span>
        <div style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
          transition: 'transform 0.2s ease',
          display: 'flex',
          alignItems: 'center'
        }}>
          <ChevronDown size={16} />
        </div>
      </button>

      {isOpen && (
        <div className="dropdown-menu-list" style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
          maxHeight: '260px',
          overflowY: 'auto',
          padding: '6px 0',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          {options.map((opt) => (
            <div 
              key={opt.value}
              className={`dropdown-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: value === opt.value ? '600' : '500',
                color: value === opt.value ? 'var(--primary)' : 'var(--text-secondary)',
                background: value === opt.value ? 'var(--primary-light)' : 'transparent',
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
