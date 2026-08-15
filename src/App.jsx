import React, { useState, useEffect } from 'react';
import './App.css';
import MainLayout from './components/MainLayout';
import ScheduleTab from './pages/ScheduleTab';
import MembersTab from './pages/MembersTab';
import RegisterTab from './pages/RegisterTab';
import ConfirmModal from './components/ConfirmModal';
import { initFirebaseAsync } from './config/firebase';

function App() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
              setUser(currentUser);
              setIsAdmin(true);
            } else {
              // Sign out immediately if not found in admins collection
              console.warn("Unauthorized login attempt:", currentUser.email);
              alert(`Access Denied: ${currentUser.email} does not have admin privileges.`);
              await firebase.signOut(auth);
              setUser(null);
              setIsAdmin(false);
            }
          } catch (error) {
            console.error("Error verifying admin status:", error);
            await firebase.signOut(auth);
            setUser(null);
            setIsAdmin(false);
          }
        } else {
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
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
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
    } catch (error) {
      console.error("Logout failed:", error);
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
        {activeTab === 'schedule' && <ScheduleTab isAdmin={isAdmin} />}
        {activeTab === 'members' && <MembersTab isAdmin={isAdmin} />}
        {activeTab === 'register' && <RegisterTab isAdmin={isAdmin} />}
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

export default App;
