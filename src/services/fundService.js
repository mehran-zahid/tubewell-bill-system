import { initFirebaseAsync } from '../config/firebase';

const FUND_EXPENSES_COLLECTION = 'fund_expenses';

export async function addFundExpense(expenseData) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(firebase.collection(db, FUND_EXPENSES_COLLECTION));
  
  const dataToSave = {
    id: docRef.id,
    ...expenseData,
    amount: parseFloat(expenseData.amount) || 0,
    createdAt: firebase.serverTimestamp()
  };
  
  await firebase.setDoc(docRef, dataToSave);
  return dataToSave;
}

export async function getAllFundExpenses() {
  const { db, firebase } = await initFirebaseAsync();
  const q = firebase.query(
    firebase.collection(db, FUND_EXPENSES_COLLECTION),
    firebase.orderBy('date', 'desc')
  );
  
  const querySnapshot = await firebase.getDocs(q);
  const expenses = [];
  querySnapshot.forEach((doc) => {
    expenses.push({ id: doc.id, ...doc.data() });
  });
  
  return expenses;
}

export async function deleteFundExpense(id) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, FUND_EXPENSES_COLLECTION, id);
  await firebase.deleteDoc(docRef);
}
