import React, { useState } from 'react';
import './App.css';
import MainLayout from './components/MainLayout';
import ScheduleTab from './pages/ScheduleTab';
import MembersTab from './pages/MembersTab';

function App() {
  const [activeTab, setActiveTab] = useState('schedule');

  return (
    <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'schedule' ? <ScheduleTab /> : <MembersTab />}
    </MainLayout>
  );
}

export default App;
