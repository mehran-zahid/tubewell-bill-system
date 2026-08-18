import React, { forwardRef } from 'react';
import './GraphicReceipt.css';

const GraphicReceipt = forwardRef(({ member, billingResult, savedFixedExpenses, globalFixedExpenses, viewMode, language }, ref) => {
  if (!member || !billingResult) return null;

  const isUrdu = language === 'urdu';
  
  // Format data
  const startDayUrdu = member.startDay ? getUrduDay(member.startDay) : '';
  const endDayUrdu = member.endDay ? getUrduDay(member.endDay) : '';
  const sTime = member.startTime ? formatUrduTime(member.startTime) : '';
  const eTime = member.endTime ? formatUrduTime(member.endTime) : '';
  const totalEffectiveHours = member.effectiveHours ? Number(Number(member.effectiveHours).toFixed(2)) : 0;
  
  let scheduleTextUrdu = '';
  if (member.startDay) {
    if (member.startDay === member.endDay || !member.endDay) {
      scheduleTextUrdu = `${startDayUrdu}، ${sTime} تا ${eTime}`;
    } else {
      scheduleTextUrdu = `${startDayUrdu} ${sTime} تا ${endDayUrdu} ${eTime}`;
    }
  }

  const sTimeEng = member.startTime ? formatEnglishTime(member.startTime) : '';
  const eTimeEng = member.endTime ? formatEnglishTime(member.endTime) : '';
  let scheduleTextEng = '';
  if (member.startDay) {
    if (member.startDay === member.endDay || !member.endDay) {
      scheduleTextEng = `${member.startDay}, ${sTimeEng} to ${eTimeEng}`;
    } else {
      scheduleTextEng = `${member.startDay} ${sTimeEng} to ${member.endDay} ${eTimeEng}`;
    }
  }

  let currentFixedExpenses = [];
  if (viewMode === 'list' && savedFixedExpenses) {
    currentFixedExpenses = savedFixedExpenses;
  } else {
    currentFixedExpenses = globalFixedExpenses || [];
  }
  const fraction = billingResult.totalFixedExpenses > 0 ? (member.fixedShare / billingResult.totalFixedExpenses) : 0;

  const sortedEntries = member.memberEntries && member.memberEntries.length > 0 
    ? [...member.memberEntries].sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  return (
    <div className={`graphic-receipt ${isUrdu ? 'urdu' : ''}`} ref={ref}>
      <div className="graphic-receipt-header">
        <h3 className="graphic-receipt-title">
          {isUrdu ? `ٹربائن کا بل — ${getBillTitle()}` : `Tubewell Bill — ${getBillTitle()}`}
        </h3>
        <p className="graphic-receipt-name">
          {isUrdu 
            ? ((member.urduName || member.nameUr) ? `${member.urduName || member.nameUr} (${member.nameEn || member.name})` : (member.nameEn || member.name)) 
            : (member.nameEn || member.name)}
        </p>
      </div>
      
      <div className="graphic-receipt-body">
        <div className="graphic-receipt-total">
          <div className="graphic-receipt-total-label">
            {isUrdu ? 'کل واجب الادا بل' : 'Total Bill'}
          </div>
          <div className="graphic-receipt-total-amount">
            {isUrdu ? `${member.totalBill.toLocaleString()} روپے` : `Rs. ${member.totalBill.toLocaleString()}`}
          </div>
        </div>

        <div className="graphic-receipt-section">
          <div className="graphic-receipt-section-title">
            {isUrdu ? 'باری کا وقت' : 'Schedule'}
          </div>
          <div className="graphic-receipt-row">
            <span>{isUrdu ? scheduleTextUrdu : scheduleTextEng}</span>
            <span className="graphic-receipt-row-value">
              {isUrdu ? `(${totalEffectiveHours} گھنٹے)` : `(${totalEffectiveHours} Hours)`}
            </span>
          </div>
        </div>

        <div className="graphic-receipt-section">
          <div className="graphic-receipt-section-title">
            {isUrdu ? 'اخراجات کی معلومات' : 'Expenses Breakdown'}
          </div>
          <div className="graphic-receipt-row">
            <span className="graphic-receipt-row-label">
              {isUrdu ? 'بجلی کا بل' : 'Electricity Bill'}
            </span>
            <span className="graphic-receipt-row-value">
              {isUrdu ? `${member.usageShare.toLocaleString()} روپے` : `Rs. ${member.usageShare.toLocaleString()}`}
            </span>
          </div>
          <div className="graphic-receipt-row">
            <span className="graphic-receipt-row-label">
              {isUrdu ? 'دیگر اخراجات' : 'Other Expenses'}
            </span>
            <span className="graphic-receipt-row-value">
              {isUrdu ? `${member.fixedShare.toLocaleString()} روپے` : `Rs. ${member.fixedShare.toLocaleString()}`}
            </span>
          </div>
        </div>

        {currentFixedExpenses.length > 0 && (
          <div className="graphic-receipt-section">
            <div className="graphic-receipt-section-title">
              {isUrdu ? 'مرمت و دیگر اخراجات میں آپ کے حصے کی تفصیلات' : 'Your details of Share in Maintenance & Other Expenses'}
            </div>
            <ul className="graphic-receipt-list">
              {currentFixedExpenses.map((ex, i) => {
                const myShare = Math.round(parseFloat(ex.amount || 0) * fraction);
                const exTitle = ex.title || (isUrdu ? 'اخراجات' : 'Expense');
                return (
                  <li key={i}>
                    <span className="graphic-receipt-row-label">{exTitle}</span>
                    <span className="graphic-receipt-row-value">
                      {isUrdu 
                        ? `${myShare.toLocaleString()} روپے`
                        : `Rs. ${myShare.toLocaleString()}`
                      }
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="graphic-receipt-section">
          <div className="graphic-receipt-section-title">
            {isUrdu ? 'میٹر ریڈنگ کی تفصیل' : 'Meter Reading Details'}
          </div>
          {sortedEntries.length > 0 ? sortedEntries.map((entry, i) => {
            const start = Number(entry.startReading);
            const end = Number(entry.endReading);
            const diff = Number(Math.max(0, (entry.endReading - entry.startReading) / 100).toFixed(2));
            return (
              <div className="graphic-receipt-row" key={i} style={{marginBottom: '0.75rem'}}>
                <span className="graphic-receipt-row-label">
                  {isUrdu ? `${formatUrduDate(entry.date)} — (${diff} گھنٹے)` : `${formatEnglishDate(entry.date)} — (${diff} Hours)`}
                </span>
                <span className="graphic-receipt-row-value">
                  {isUrdu ? `${end} تا ${start}` : `${start} to ${end}`}
                </span>
              </div>
            );
          }) : (
            <div className="graphic-receipt-row">
              <span>{isUrdu ? 'کوئی ریڈنگ موجود نہیں' : 'No readings available'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default GraphicReceipt;

// --- Helper Functions ---
function getBillTitle() {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getUrduDay(englishDay) {
  const map = {
    'Monday': 'پیر',
    'Tuesday': 'منگل',
    'Wednesday': 'بدھ',
    'Thursday': 'جمعرات',
    'Friday': 'جمعہ',
    'Saturday': 'ہفتہ',
    'Sunday': 'اتوار'
  };
  return map[englishDay] || englishDay;
}

function formatUrduTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parts[1];
  
  let ampm = 'صبح';
  if (hours >= 12 && hours < 16) {
    ampm = 'دوپہر'; // 12 PM - 3:59 PM
  } else if (hours >= 16 && hours < 20) {
    ampm = 'شام'; // 4 PM - 7:59 PM
  } else if (hours >= 20 || hours < 4) {
    ampm = 'رات'; // 8 PM - 3:59 AM
  } else {
    ampm = 'صبح'; // 4 AM - 11:59 AM
  }

  const h12 = hours % 12 || 12;
  return `${ampm} ${h12.toString().padStart(2, '0')}:${minutes}`;
}

function formatEnglishTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

function formatUrduDate(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  const monthNamesUrdu = ['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'];
  return `${dateObj.getDate()} ${monthNamesUrdu[dateObj.getMonth()]}`;
}

function formatEnglishDate(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
}
