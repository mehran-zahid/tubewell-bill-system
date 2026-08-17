import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import MainLayout from './components/MainLayout';
import ScheduleTab from './pages/ScheduleTab';
import MembersTab from './pages/MembersTab';
import RegisterTab from './pages/RegisterTab';
import BillingTab from './pages/BillingTab';
import OCRTab from './pages/OCRTab';
import ConfirmModal from './components/ConfirmModal';
import { ToastProvider, useToast } from './context/ToastContext';
import { OCRProvider } from './context/OCRContext';
import { initFirebaseAsync } from './config/firebase';

function AppContent() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { showToast } = useToast();
  // undefined = initial load (not yet determined), null = explicitly logged out
  const prevUserRef = useRef(undefined);

  useEffect(() => {
    let unsubscribe;
    const initAuth = async () => {
      const { auth, db, firebase } = await initFirebaseAsync();
      unsubscribe = firebase.onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          try {
            const adminRef = firebase.doc(db, 'admins', currentUser.email);
            const adminSnap = await firebase.getDoc(adminRef);
            
            if (adminSnap.exists()) {
              // Only toast on genuine login (prev was null), not on page reload (prev was undefined)
              if (prevUserRef.current === null) {
                showToast(`Welcome back, ${currentUser.displayName || currentUser.email.split('@')[0]}!`, 'success');
              }
              prevUserRef.current = currentUser;
              setUser(currentUser);
              setIsAdmin(true);
            } else {
              // Sign out immediately if not found in admins collection
              console.warn("Unauthorized login attempt:", currentUser.email);
              showToast(`Access Denied: ${currentUser.email} does not have admin privileges.`, 'error');
              await firebase.signOut(auth);
              prevUserRef.current = null;
              setUser(null);
              setIsAdmin(false);
            }
          } catch (error) {
            console.error("Error verifying admin status:", error);
            await firebase.signOut(auth);
            prevUserRef.current = null;
            setUser(null);
            setIsAdmin(false);
          }
        } else {
          prevUserRef.current = null;
          setUser(null);
          setIsAdmin(false);
        }
      });
    };
    initAuth();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const { auth, firebase } = await initFirebaseAsync();
      const provider = new firebase.GoogleAuthProvider();
      await firebase.signInWithPopup(auth, provider);
      // Success toast fires in onAuthStateChanged after admin check passes
    } catch (error) {
      console.error("Login failed:", error);
      showToast("Login failed. Please try again.", "error");
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = async () => {
    try {
      const { auth, firebase } = await initFirebaseAsync();
      await firebase.signOut(auth);
      setShowLogoutConfirm(false);
      showToast("Signed out successfully", "info");
    } catch (error) {
      console.error("Logout failed:", error);
      showToast("Logout failed.", "error");
    }
  };

  return (
    <>
      <MainLayout 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        user={user}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
      >
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'members' && <MembersTab isAdmin={isAdmin} />}
        {activeTab === 'register' && <RegisterTab isAdmin={isAdmin} />}
        {activeTab === 'billing' && <BillingTab isAdmin={isAdmin} />}
        {activeTab === 'ocr' && isAdmin && <OCRTab />}
      </MainLayout>

      <ConfirmModal 
        isOpen={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        onConfirm={executeLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        confirmText="Sign Out"
      />
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <OCRProvider>
        <AppContent />
      </OCRProvider>
    </ToastProvider>
  );
}

export default App;
