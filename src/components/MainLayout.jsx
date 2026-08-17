import React from 'react';
import { CalendarClock, Users, LogOut, Shield, BookText, Calculator } from './Icons';
import { Camera } from 'lucide-react';
import Logo from './Logo';

export default function MainLayout({ 
  children, 
  activeTab, 
  onTabChange,
  isAdmin,
  user,
  handleLogin,
  handleLogout
}) {
  const navItems = [
    { id: 'schedule', label: 'Schedule', icon: CalendarClock },
    { id: 'members', label: 'Directory', icon: Users },
    { id: 'register', label: 'Readings', icon: BookText },
    { id: 'billing', label: 'Billing', icon: Calculator },
    ...(isAdmin ? [{ id: 'ocr', label: 'Scan Register', icon: Camera }] : [])
  ];


  return (
    <div className="app-layout">
      {/* Mobile Header (Visible only on small screens) */}
      <div className="mobile-header">
        <Logo size="small" />
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                ) : (
                  user.email.charAt(0).toUpperCase()
                )}
              </div>
              <button 
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleLogin}
                style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
              >
                <Shield size={14} />
                Admin
              </button>
              {/* Removed dev button to fix ReferenceError */}
            </div>
          )}
        </div>
      </div>

      {/* Left Sidebar (Desktop) */}
      <aside className="sidebar">
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
          {user ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '12px',
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)'
            }}>
              {/* Avatar */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '16px',
                flexShrink: 0
              }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                ) : (
                  user.email.charAt(0).toUpperCase()
                )}
              </div>
              
              {/* User Info */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-primary)', 
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user.displayName || user.email.split('@')[0]}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {isAdmin ? (
                    <span style={{ 
                      color: 'var(--primary)', 
                      fontWeight: 600,
                      background: 'var(--primary-light)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px'
                    }}>
                      Admin
                    </span>
                  ) : (
                    <span>Member</span>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button 
                onClick={handleLogout}
                title="Sign Out"
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s ease, color 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleLogin}
                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}
              >
                <Shield size={18} />
                <span style={{ fontWeight: 500 }}>Get Admin Access</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
        <div className="app-container">
          {children}
        </div>
      </main>

      {/* Bottom Navbar (Mobile) */}
      <nav className="bottom-nav">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <IconComponent size={20} />
              <span className={item.id === 'ocr' ? 'ocr-label' : ''}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
