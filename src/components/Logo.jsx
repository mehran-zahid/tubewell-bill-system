import React from 'react';

export default function Logo({ className = '', size = 'medium' }) {
  const sizes = {
    small: { height: 24, fontSize: '18px' },
    medium: { height: 32, fontSize: '24px' },
    large: { height: 48, fontSize: '36px' },
  };

  const { height, fontSize } = sizes[size] || sizes.medium;

  return (
    <div 
      className={`logo-container ${className}`} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px', 
        userSelect: 'none' 
      }}
    >
      <svg 
        width={height} 
        height={height} 
        viewBox="0 0 40 40" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle background glow/circle */}
        <circle cx="20" cy="20" r="20" fill="var(--primary-light)" />
        
        {/* Geometric Droplet SVG */}
        <path 
          d="M20 8C20 8 10 18.5 10 24.5C10 30.299 14.4772 35 20 35C25.5228 35 30 30.299 30 24.5C30 18.5 20 8 20 8Z" 
          fill="var(--primary)"
        />
        <path 
          d="M20 12C20 12 14 20 14 24.5C14 27.8137 16.6863 30.5 20 30.5C23.3137 30.5 26 27.8137 26 24.5C26 20 20 12 20 12Z" 
          fill="var(--bg-surface)"
        />
        <circle cx="20" cy="26" r="2.5" fill="var(--primary)" />
      </svg>

      <span 
        style={{ 
          fontFamily: 'var(--font-heading)', 
          fontSize: fontSize,
          letterSpacing: '-0.5px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <span style={{ 
          fontWeight: 800, 
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--info) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          paddingRight: '1px' // Prevent clipping of italic/bold text in webkit
        }}>
          Aqua
        </span>
        <span style={{ 
          fontWeight: 400, 
          color: 'var(--text-secondary)' 
        }}>
          Bill
        </span>
      </span>
    </div>
  );
}
