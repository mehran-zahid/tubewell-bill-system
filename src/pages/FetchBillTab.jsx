import React, { useState } from 'react';

export default function FetchBillTab() {
  const [refno, setRefno] = useState('29153110982900');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [billData, setBillData] = useState(null);
  const [showHtml, setShowHtml] = useState(false);

  const fetchBill = async () => {
    setLoading(true);
    setError(null);
    setBillData(null);
    setShowHtml(false);

    try {
      const cleanRef = String(refno).replace(/\D/g, '');
      if (!cleanRef || cleanRef.length < 14) {
        throw new Error("Invalid Reference Number (must be at least 14 digits)");
      }

      const res = await fetch(`/api/fetch-bill?refno=${cleanRef}`);
      
      if (!res.ok) {
        let errMsg = 'Failed to fetch bill.';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch(_e) {}
        throw new Error(errMsg);
      }

      const html2 = await res.text();

      if (html2.includes('anti-forgery')) {
        throw new Error('PITC anti-forgery validation failed — token mismatch.');
      }
      
      if (html2.includes('Bill not found') || html2.includes('Invalid Reference Number')) {
         throw new Error('Bill not found for this reference number.');
      }

      // Parse details
      const amountMatch = html2.match(/payable-card-amount">\s*([\d,]+)\s*</i) || 
                          html2.match(/PAYABLE\s*WITHIN[\s\S]*?DUE\s*DATE[\s\S]*?payable-card-amount">\s*([\d,]+)/i) ||
                          html2.match(/DUE\s*DATE[\s\S]*?right-main-val[\s\S]*?>([\d,]+)</i) ||
                          html2.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                          html2.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                          html2.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                          html2.match(/Amount\s*Due[^\d]*([\d,]+)/i);
                          
      const monthMatch = html2.match(/BILL\s*MONTH[\s\S]*?right-main-val[^>]*>([^<]+)</i) ||
                         html2.match(/BILLING\s*MONTH[\s\S]*?>([^<]+)</i) || 
                         html2.match(/BILLING\s*MONTH[^>]*>[\s\S]*?>([^<]+)</i) ||
                         html2.match(/BILL\s*MONTH[\s\S]*?>([^<]+)</i);
                         
      const readDateMatch = html2.match(/READING\s*DATE[\s\S]*?right-panel-date-val[^>]*>([^<]+)</i) ||
                            html2.match(/READING\s*DATE[\s\S]*?>([^<]+)</i) || 
                            html2.match(/Reading\s*Date[^>]*>[\s\S]*?>([^<]+)</i);

      // Inject <base> tag to fix relative CSS and image links in the iframe
      const styledHtml = html2.replace('<head>', '<head><base href="https://bill.pitc.com.pk" />');

      setBillData({
        amount: amountMatch ? amountMatch[1] : 'Unknown',
        month: monthMatch ? monthMatch[1].trim() : 'Unknown',
        readDate: readDateMatch ? readDateMatch[1].trim() : 'Unknown',
        rawHtml: styledHtml
      });

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Fetch Bill</h1>
          <p style={{ fontFamily: 'Inter', fontSize: '15px', color: 'var(--text-secondary)' }}>Test the WAPDA bill fetching mechanism directly</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Enter Reference Number</h2>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <input 
              type="text" 
              className="input-field" 
              value={refno}
              onChange={(e) => setRefno(e.target.value)}
              placeholder="e.g. 29153110982900"
            />
          </div>
          <button 
            className="btn btn-primary" 
            onClick={fetchBill}
            disabled={loading || !refno}
          >
            {loading ? 'Fetching...' : 'Fetch Bill'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: '16px', color: 'var(--danger)', fontSize: '14px', background: 'var(--danger-light)', padding: '12px', borderRadius: '4px' }}>
            {error}
          </div>
        )}
      </div>

      {billData && (
        <div className="card">
          <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Extracted Details</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--bg-muted)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>BILLING MONTH</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{billData.month}</div>
            </div>
            <div style={{ background: 'var(--bg-muted)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>READING DATE</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{billData.readDate}</div>
            </div>
            <div style={{ background: 'var(--bg-muted)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL AMOUNT</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>Rs. {billData.amount}</div>
            </div>
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={() => setShowHtml(true)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            View Original HTML Bill
          </button>
        </div>
      )}

      {/* Raw HTML Modal */}
      {showHtml && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '8px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: 'Outfit' }}>Original MEPCO Bill</h3>
              <button 
                onClick={() => setShowHtml(false)}
                style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
            <iframe 
              srcDoc={billData?.rawHtml}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title="MEPCO Bill"
            />
          </div>
        </div>
      )}
    </div>
  );
}
