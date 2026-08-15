import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA16P703ShYweehGI3Apu1REltXhObDo_c",
  authDomain: "tubewell-react-system-2026.firebaseapp.com",
  projectId: "tubewell-react-system-2026",
  storageBucket: "tubewell-react-system-2026.firebasestorage.app",
  messagingSenderId: "435450271889",
  appId: "1:435450271889:web:9c84927c662db392b5c730"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
