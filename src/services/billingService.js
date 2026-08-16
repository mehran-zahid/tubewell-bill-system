import { initFirebaseAsync } from '../config/firebase';

const GENERATED_BILLS_COLLECTION = 'generated_bills';

export async function saveGeneratedBill(billData) {
  const { db, firebase } = await initFirebaseAsync();
  let docRef;
  
  if (billData.id) {
    docRef = firebase.doc(db, GENERATED_BILLS_COLLECTION, billData.id);
  } else {
    docRef = firebase.doc(firebase.collection(db, GENERATED_BILLS_COLLECTION));
    billData.id = docRef.id;
  }
  
  const dataToSave = {
    ...billData,
    updatedAt: firebase.serverTimestamp(),
    createdAt: billData.createdAt || firebase.serverTimestamp()
  };
  
  await firebase.setDoc(docRef, dataToSave, { merge: true });
  return dataToSave;
}

export async function getAllGeneratedBills() {
  const { db, firebase } = await initFirebaseAsync();
  const q = firebase.query(
    firebase.collection(db, GENERATED_BILLS_COLLECTION),
    firebase.orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await firebase.getDocs(q);
  const bills = [];
  querySnapshot.forEach((doc) => {
    bills.push({ id: doc.id, ...doc.data() });
  });
  
  return bills;
}

export async function getGeneratedBill(id) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, GENERATED_BILLS_COLLECTION, id);
  const docSnap = await firebase.getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function deleteGeneratedBill(id) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, GENERATED_BILLS_COLLECTION, id);
  await firebase.deleteDoc(docRef);
}
