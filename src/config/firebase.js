// We are using Firebase from the CDN to bypass all NPM network issues!
// The CDN scripts are injected in index.html, exposing window.firebase.

const firebaseConfig = {
  apiKey: "AIzaSyA16P703ShYweehGI3Apu1REltXhObDo_c",
  authDomain: "tubewell-react-system-2026.firebaseapp.com",
  projectId: "tubewell-react-system-2026",
  storageBucket: "tubewell-react-system-2026.firebasestorage.app",
  messagingSenderId: "435450271889",
  appId: "1:435450271889:web:9c84927c662db392b5c730"
};

// Polling function to wait for the CDN to load asynchronously
// Rejects after 10 seconds if Firebase never loads (CDN blocked, offline, etc.)
export const waitForFirebase = () => {
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 10000;
    let elapsed = 0;

    const check = () => {
      if (window.firebase) {
        resolve(window.firebase);
      } else if (elapsed >= TIMEOUT_MS) {
        reject(new Error(
          'Firebase failed to load. Please check your internet connection and reload the page.'
        ));
      } else {
        elapsed += 100;
        setTimeout(check, 100);
      }
    };
    check();
  });
};

let app = null;
export let db = null;
export let auth = null;

export const initFirebaseAsync = async () => {
  if (!app) {
    const fb = await waitForFirebase();
    app = fb.initializeApp(firebaseConfig);
    db = fb.getFirestore(app);
    auth = fb.getAuth(app);
  }
  return { db, auth, firebase: window.firebase };
};
