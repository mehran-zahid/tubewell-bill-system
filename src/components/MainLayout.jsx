import React from 'react';
import { CalendarClock, Users, LogIn } from './Icons';
import Logo from './Logo';

export default function MainLayout({ children, activeTab, onTabChange }) {
  const navItems = [
    { id: 'schedule', label: 'Weekly Schedule', icon: CalendarClock },
    { id: 'members', label: 'Members Directory', icon: Users }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      {/* Left Sidebar */}
      <aside style={{ 
        width: '240px', 
        background: 'var(--bg-surface)', 
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 10
      }}>
        {/* Logo Area */}
        <div style={{ height: '60px', padding: '0 var(--space-4)', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-default)' }}>
          <Logo size="small" />
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: 'var(--space-4)', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            const IconComponent = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: isActive ? 'var(--primary-light)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <IconComponent size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer / Login Area */}
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} />
            Admin Login
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div className="app-container" style={{ padding: 'var(--space-8)' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
