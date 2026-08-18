import React, { forwardRef, useState, useEffect } from 'react';
import { translateToUrdu } from '../utils/translate';
import './GraphicOverallBill.css';

const GraphicOverallBill = forwardRef(({ billingResult, fixedExpenses, language }, ref) => {
  const [translatedNames, setTranslatedNames] = useState({});

  useEffect(() => {
    let isMounted = true;
    if (language === 'urdu' && billingResult?.breakdowns) {
      const translateAll = async () => {
        const translations = {};
        const promises = billingResult.breakdowns.map(async (m) => {
          if (m.urduName || m.nameUr) {
            translations[m.name] = m.urduName || m.nameUr;
          } else {
            try {
              translations[m.name] = await translateToUrdu(m.name);
            } catch (e) {
              translations[m.name] = m.name;
            }
          }
        });
        await Promise.all(promises);
        if (isMounted) {
          setTranslatedNames(translations);
        }
      };
      translateAll();
    }
    return () => { isMounted = false; };
  }, [billingResult, language]);

  if (!billingResult) return null;

  const isUrdu = language === 'urdu';
  
  const title = billingResult.billingTitle || 'Tubewell Bill';
  
  const formatUrduMonthYear = (title) => {
    if (!title) return '';
    const parts = title.split(' ');
    if (parts.length < 2) return title;
    const monthsMap = {
      'january': 'جنوری', 'february': 'فروری', 'march': 'مارچ', 'april': 'اپریل', 'may': 'مئی', 'june': 'جون', 
      'july': 'جولائی', 'august': 'اگست', 'september': 'ستمبر', 'october': 'اکتوبر', 'november': 'نومبر', 'december': 'دسمبر'
    };
    const urduMonth = monthsMap[parts[0].toLowerCase()] || parts[0];
    return `${urduMonth} ${parts[1]}`;
  };

  const displayTitle = isUrdu ? formatUrduMonthYear(title) : title;
  
  return (
    <div className={`graphic-overall-bill ${isUrdu ? 'urdu' : ''}`} ref={ref}>
      <div className="graphic-overall-header">
        <h3 className="graphic-overall-title">
          {isUrdu ? `ٹربائن بل خلاصہ — ${displayTitle}` : `Turbine Bill Summary — ${displayTitle}`}
        </h3>
      </div>
      
      <div className="graphic-overall-body">
        <div className="graphic-overall-totals">
          <div className="graphic-overall-row">
            <span>{isUrdu ? 'کل ٹیوب ویل استعمال' : 'Total Tubewell Usage'}</span>
            <span>{isUrdu ? `${billingResult.totalConsumedHours.toFixed(1)} گھنٹے` : `${billingResult.totalConsumedHours.toFixed(1)} Hours`}</span>
          </div>
          <div className="graphic-overall-row">
            <span>{isUrdu ? 'میپکو بجلی بل' : 'MEPCO Electricity Bill'}</span>
            <span>{isUrdu ? `${billingResult.wapdaBill.toLocaleString()} روپے` : `Rs. ${billingResult.wapdaBill.toLocaleString()}`}</span>
          </div>
          
          {fixedExpenses && fixedExpenses.length > 0 && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px dashed #bfdbfe' }}>
              <div style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '2.2rem' }}>{isUrdu ? 'تفصیل اضافی اخراجات:' : 'Extra Expenses:'}</div>
              {fixedExpenses.map((ex, i) => (
                <div className="graphic-overall-row" key={i} style={{ fontSize: '1.8rem' }}>
                  <span>{ex.title || (isUrdu ? 'اخراجات' : 'Expense')}</span>
                  <span>{isUrdu ? `${parseFloat(ex.amount || 0).toLocaleString()} روپے` : `Rs. ${parseFloat(ex.amount || 0).toLocaleString()}`}</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="graphic-overall-row bold">
            <span>{isUrdu ? 'کل واجب الادا رقم' : 'Grand Total Bill'}</span>
            <span>{isUrdu ? `${billingResult.grandTotalBilled.toLocaleString()} روپے` : `Rs. ${billingResult.grandTotalBilled.toLocaleString()}`}</span>
          </div>
        </div>

        <div className="graphic-overall-table-container">
          <div className="graphic-overall-table-title">
            {isUrdu ? 'تمام ممبران کے بل' : 'Per Member Bill Breakdown'}
          </div>
          <table className="graphic-overall-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{isUrdu ? 'ممبر' : 'Member'}</th>
                <th>{isUrdu ? 'استعمال' : 'Usage'}</th>
                <th>{isUrdu ? 'بجلی حصہ' : 'Elec. Share'}</th>
                <th>{isUrdu ? 'اضافی اخراجات' : 'Extra Expenses'}</th>
                <th>{isUrdu ? 'کل بل' : 'Total Due'}</th>
              </tr>
            </thead>
            <tbody>
              {billingResult.breakdowns.map((m, idx) => {
                const pct = billingResult.totalConsumedHours > 0 
                  ? ((m.consumedHours / billingResult.totalConsumedHours) * 100).toFixed(1) 
                  : 0;
                
                return (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{isUrdu ? (translatedNames[m.name] || m.name) : (m.nameEn || m.name)}</td>
                    <td style={{direction: 'ltr', textAlign: isUrdu ? 'right' : 'left'}}>
                      {m.consumedHours.toFixed(1)}h
                    </td>
                    <td>{m.usageShare.toLocaleString()}</td>
                    <td>{m.fixedShare.toLocaleString()}</td>
                    <td style={{fontWeight: '700'}}>{m.totalBill.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
});

export default GraphicOverallBill;
