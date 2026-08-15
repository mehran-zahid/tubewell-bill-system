import { initFirebaseAsync } from '../config/firebase';

const COLLECTION_NAME = 'register_entries';

export async function addRegisterEntry(entryData) {
  const { db, firebase } = await initFirebaseAsync();
  
  // ensure start and end are numbers
  const startReading = parseFloat(entryData.startReading);
  const endReading = parseFloat(entryData.endReading);
  const unitsConsumed = endReading - startReading;

  const newEntry = {
    ...entryData,
    startReading,
    endReading,
    unitsConsumed,
    createdAt: firebase.serverTimestamp(),
  };

  const docRef = await firebase.addDoc(firebase.collection(db, COLLECTION_NAME), newEntry);
  return { ...newEntry, id: docRef.id };
}

export async function getRegisterEntries(startDate = null, endDate = null) {
  const { db, firebase } = await initFirebaseAsync();
  
  const constraints = [firebase.orderBy('date', 'desc')];
  
  if (startDate) {
    constraints.push(firebase.where('date', '>=', startDate));
  }
  
  if (endDate) {
    constraints.push(firebase.where('date', '<=', endDate));
  }

  const q = firebase.query(
    firebase.collection(db, COLLECTION_NAME),
    ...constraints
  );
  
  const querySnapshot = await firebase.getDocs(q);
  const entries = [];
  querySnapshot.forEach((doc) => {
    entries.push({ id: doc.id, ...doc.data() });
  });
  
  // Sort in memory by createdAt as a secondary sort if needed
  entries.sort((a, b) => {
    if (a.date === b.date) {
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
      return bTime - aTime;
    }
    return new Date(b.date) - new Date(a.date);
  });
  
  return entries;
}

// Function to fetch just the absolute latest entry's end reading
export async function getLatestEndReading() {
  const { db, firebase } = await initFirebaseAsync();
  const q = firebase.query(
    firebase.collection(db, COLLECTION_NAME),
    firebase.orderBy('date', 'desc'),
    firebase.limit(5)
  );
  
  const querySnapshot = await firebase.getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  
  const docs = querySnapshot.docs.map(d => d.data());
  docs.sort((a, b) => {
    if (a.date === b.date) {
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
      return bTime - aTime;
    }
    return new Date(b.date) - new Date(a.date);
  });
  
  return docs[0].endReading;
}

export async function updateRegisterEntries(updatedEntries) {
  const { db, firebase } = await initFirebaseAsync();
  const batch = firebase.writeBatch(db);
  
  updatedEntries.forEach(entry => {
    const docRef = firebase.doc(db, COLLECTION_NAME, entry.id);
    const updates = { ...entry };
    delete updates.id; // Don't write the ID field to the document itself
    
    // Ensure numbers
    if (updates.startReading) updates.startReading = parseFloat(updates.startReading);
    if (updates.endReading) updates.endReading = parseFloat(updates.endReading);
    if (updates.unitsConsumed) updates.unitsConsumed = parseFloat(updates.unitsConsumed);
    
    batch.update(docRef, updates);
  });
  
  await batch.commit();
}

export async function deleteRegisterEntry(id) {
  const { db, firebase } = await initFirebaseAsync();
  const docRef = firebase.doc(db, COLLECTION_NAME, id);
  await firebase.deleteDoc(docRef);
}
