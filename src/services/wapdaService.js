import { initFirebaseAsync } from '../config/firebase';

const SETTINGS_COLLECTION = 'settings';
const BILLS_COLLECTION = 'wapda_bills';

export async function getWapdaSettings() {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, SETTINGS_COLLECTION, 'wapda_config');
  const docSnap = await firebase.getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return { refNo: '' };
}

export async function updateWapdaSettings(refNo) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, SETTINGS_COLLECTION, 'wapda_config');
  await firebase.setDoc(docRef, { refNo }, { merge: true });
}

export async function getWapdaBillByMonth(monthId) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, BILLS_COLLECTION, monthId);
  const docSnap = await firebase.getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

export async function saveWapdaBill(monthId, billData) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, BILLS_COLLECTION, monthId);
  const dataToSave = {
    ...billData,
    updatedAt: firebase.serverTimestamp()
  };
  await firebase.setDoc(docRef, dataToSave, { merge: true });
  return dataToSave;
}

/**
 * Normalizes PITC's month string (e.g. "JUL 26", "JULY 2026", "Jul-26")
 * into a consistent Firestore key: "July-2026"
 */
export function normalizeWapdaMonth(rawMonth) {
  if (!rawMonth || rawMonth === 'Unknown') return null;

  // Map short and full month names to full names
  const monthMap = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December'
  };

  const cleaned = rawMonth.trim().replace(/[-_]/g, ' ');
  const parts = cleaned.split(/\s+/);

  // Try to find month name part and year part
  let monthName = null;
  let year = null;

  for (const part of parts) {
    const lower = part.toLowerCase().substring(0, 3);
    if (monthMap[lower]) {
      monthName = monthMap[lower];
    }
    // Year: handle "26" → "2026", or "2026" as-is
    const num = parseInt(part, 10);
    if (!isNaN(num)) {
      year = num < 100 ? 2000 + num : num;
    }
  }

  if (!monthName || !year) return rawMonth; // fallback: return as-is
  return `${monthName}-${year}`; // e.g. "July-2026"
}

/**
 * Sends a fetch request via the Chrome Extension bridge (postMessage).
 * Returns raw HTML string from PITC.
 */
function fetchBillViaExtension(refNo) {
  return new Promise((resolve, reject) => {
    const reqId = Date.now().toString();

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Extension fetch timed out after 30 seconds.'));
    }, 30000);

    const handler = (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'WAPDA_EXT_RESULT') return;
      if (event.data.reqId !== reqId) return;

      clearTimeout(timeout);
      window.removeEventListener('message', handler);

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else if (event.data.payload && event.data.payload.success) {
        resolve(event.data.payload.html);
      } else {
        reject(new Error((event.data.payload && event.data.payload.error) || 'Unknown extension error'));
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ type: 'FETCH_WAPDA_EXT', refNo, reqId }, '*');
  });
}

export async function fetchBillFromAPI(refNo) {
  const cleanRef = String(refNo).replace(/\D/g, '');
  if (!cleanRef || cleanRef.length < 14) {
    throw new Error("Invalid Reference Number (must be at least 14 digits)");
  }

  if (!window.__TUBEWELL_EXT_INSTALLED__) {
    throw new Error("AquaBill Extension is required to fetch bills. Please install the extension first.");
  }

  // Use Chrome Extension (fast, Pakistani IP, no CORS)
  const html = await fetchBillViaExtension(cleanRef);

  if (html.includes('anti-forgery')) {
    throw new Error('PITC anti-forgery validation failed — token mismatch.');
  }
  
  if (html.includes('Bill not found') || html.includes('Invalid Reference Number')) {
    throw new Error('Bill not found for this reference number.');
  }

  // Parse details
  const amountMatch = html.match(/payable-card-amount">\s*([\d,]+)\s*</i) || 
                      html.match(/PAYABLE\s*WITHIN[\s\S]*?DUE\s*DATE[\s\S]*?payable-card-amount">\s*([\d,]+)/i) ||
                      html.match(/DUE\s*DATE[\s\S]*?right-main-val[\s\S]*?>([\d,]+)</i) ||
                      html.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                      html.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                      html.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                      html.match(/Amount\s*Due[^\d]*([\d,]+)/i);
                      
  const monthMatch = html.match(/BILL\s*MONTH[\s\S]*?right-main-val[^>]*>([^<]+)</i) ||
                     html.match(/BILLING\s*MONTH[\s\S]*?>([^<]+)</i) || 
                     html.match(/BILLING\s*MONTH[^>]*>[\s\S]*?>([^<]+)</i) ||
                     html.match(/BILL\s*MONTH[\s\S]*?>([^<]+)</i);
                     
  const readDateMatch = html.match(/READING\s*DATE[\s\S]*?right-panel-date-val[^>]*>([^<]+)</i) ||
                        html.match(/READING\s*DATE[\s\S]*?>([^<]+)</i) || 
                        html.match(/Reading\s*Date[^>]*>[\s\S]*?>([^<]+)</i);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  const month = monthMatch ? monthMatch[1].trim() : 'Unknown';
  const readDate = readDateMatch ? readDateMatch[1].trim() : 'Unknown';
  const normalizedMonthKey = normalizeWapdaMonth(month);

  const styledHtml = html.replace('<head>', '<head><base href="http://bill.pitc.com.pk/mepcobill/" /><meta name="referrer" content="no-referrer" /><style>#loader-container { display: none !important; }</style>');

  return {
    amount,
    month,
    readDate,
    normalizedMonthKey,
    rawHtml: styledHtml
  };
}

