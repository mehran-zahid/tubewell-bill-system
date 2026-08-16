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

export async function fetchBillFromAPI(refNo) {
  const cleanRef = String(refNo).replace(/\D/g, '');
  if (!cleanRef || cleanRef.length < 14) {
    throw new Error("Invalid Reference Number (must be at least 14 digits)");
  }

  const res = await fetch(`/api/fetch-bill?refno=${cleanRef}&t=${Date.now()}`);
  
  if (!res.ok) {
    let errMsg = 'Failed to fetch bill.';
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch(_e) {}
    throw new Error(errMsg);
  }

  const html = await res.text();

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

  const styledHtml = html.replace('<head>', '<head><base href="http://bill.pitc.com.pk/mepcobill/" /><meta name="referrer" content="no-referrer" />');

  return {
    amount,
    month,
    readDate,
    rawHtml: styledHtml
  };
}
