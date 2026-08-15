import React from 'react';
import './App.css';
import Logo from './components/Logo';

function ColorSwatch({ name, hex, varName }) {
  return (
    <div className="color-swatch">
      <div className="color-box" style={{ backgroundColor: `var(${varName})` }}></div>
      <div className="color-info">
        <span>{name}</span>
        <div className="hex">{hex}</div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="app-container">
      <header className="showcase-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Logo size="large" />
        <p style={{ marginTop: '16px' }}>Tubewell Bill System - Premium Light Theme</p>
      </header>

      <section className="section">
        <h2>Brand & Primary Colors</h2>
        <div className="color-grid">
          <ColorSwatch name="Primary" hex="#2563EB" varName="--primary" />
          <ColorSwatch name="Primary Hover" hex="#1D4ED8" varName="--primary-hover" />
          <ColorSwatch name="Primary Light" hex="#EFF6FF" varName="--primary-light" />
          <ColorSwatch name="Secondary" hex="#6366F1" varName="--secondary" />
        </div>
      </section>

      <section className="section">
        <h2>Surface & Background Colors</h2>
        <div className="color-grid">
          <ColorSwatch name="Canvas (Bg)" hex="#F4F6F9" varName="--bg-canvas" />
          <ColorSwatch name="Surface (Card)" hex="#FFFFFF" varName="--bg-surface" />
          <ColorSwatch name="Muted" hex="#E8ECF1" varName="--bg-muted" />
          <ColorSwatch name="Border" hex="#E5E7EB" varName="--border-default" />
        </div>
      </section>

      <section className="section">
        <h2>Semantic Status Colors</h2>
        <div className="color-grid">
          <ColorSwatch name="Success" hex="#16A34A" varName="--success" />
          <ColorSwatch name="Warning" hex="#D97706" varName="--warning" />
          <ColorSwatch name="Danger" hex="#DC2626" varName="--danger" />
          <ColorSwatch name="Info" hex="#0EA5E9" varName="--info" />
        </div>
      </section>

      <section className="section">
        <h2>UI Components</h2>
        <div className="components-grid">
          
          <div className="card">
            <h3>Interactive Elements</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Hover over these buttons to see the subtle lift and shadow physics described in the design doc.
            </p>
            <div className="btn-group">
              <button className="btn btn-primary">Primary Action</button>
              <button className="btn btn-secondary">Secondary</button>
              <button className="btn btn-danger">Delete</button>
            </div>

            <div style={{ marginTop: '30px' }}>
              <h4 style={{ marginBottom: '10px' }}>Status Badges</h4>
              <div className="badge-group">
                <span className="badge badge-success">PAID</span>
                <span className="badge badge-warning">PENDING</span>
                <span className="badge badge-danger">OVERDUE</span>
                <span className="badge badge-info">NEW</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Typography Hierarchy</h3>
            <div className="type-sample">
              <span>Display (Outfit, 32px)</span>
              <h1 style={{ fontSize: '32px' }}>Dashboard Overview</h1>
            </div>
            <div className="type-sample">
              <span>Card Title (Outfit, 20px)</span>
              <h2 style={{ fontSize: '20px' }}>Recent Bills</h2>
            </div>
            <div className="type-sample">
              <span>Body Text (Inter, 14px)</span>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                This is standard body text. It uses Inter, which is highly readable for dense data tables and interfaces.
              </p>
            </div>
            <div className="type-sample" style={{ marginTop: '20px' }}>
              <span>Amount Display (Outfit)</span>
              <div className="amount-text">₨ 12,500</div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}

export default App;
