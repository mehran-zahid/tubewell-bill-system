import React, { useState, useEffect } from 'react';
import { initFirebaseAsync } from '../config/firebase';
import { autoRechainSchedule, format12Hour } from '../utils/scheduleLogic';
import { Edit2, Trash2, Plus, X, MoreVertical, ChevronDown, Download, Upload, GripVertical, CalendarClock } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';

export default function MembersTab({ isAdmin }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [formData, setFormData] = useState(getEmptyForm());
  
  // Confirm Delete Modal State
  const [memberToDelete, setMemberToDelete] = useState(null);
  
  // Context Menu State
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  
  // Add Menu State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const fileInputRef = React.useRef(null);
  
  // Anchor Modal State
  const [isAnchorModalOpen, setIsAnchorModalOpen] = useState(false);
  const [anchorData, setAnchorData] = useState({ startDay: 'Sunday', startTime: '06:00' });
  
  // Drag and Drop State
  const [dragItemIndex, setDragItemIndex] = useState(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null);
  const [scheduleAnchor, setScheduleAnchor] = useState(null);
  
  // Smooth scroll ref
  const scrollRAF = React.useRef(null);

  const startScrolling = (direction) => {
    if (scrollRAF.current) return;
    const scrollStep = () => {
      window.scrollBy(0, direction * 8); // Smooth 8px per frame
      scrollRAF.current = requestAnimationFrame(scrollStep);
    };
    scrollRAF.current = requestAnimationFrame(scrollStep);
  };

  const stopScrolling = () => {
    if (scrollRAF.current) {
      cancelAnimationFrame(scrollRAF.current);
      scrollRAF.current = null;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.context-menu-container')) {
        setActiveDropdownId(null);
      }
      if (!e.target.closest('.add-menu-container')) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  function getEmptyForm() {
    return {
      nameEn: '',
      userCode: '',
      durationHours: 0,
      durationMinutes: 0,
      totalLandAcres: 0,
      startDay: 'Sunday',
      startTime: '06:00',
      isLeased: false,
      tenants: []
    };
  }

  useEffect(() => {
    let unsubscribe;
    
    const loadData = async () => {
      try {
        const { db, firebase } = await initFirebaseAsync();
        const membersRef = firebase.collection(db, 'members');
        
        // Setup real-time listener
        unsubscribe = firebase.onSnapshot(membersRef, (snapshot) => {
          const membersData = [];
          snapshot.forEach((doc) => {
            membersData.push({ id: doc.id, ...doc.data() });
          });
          
          // Sort by turnOrder, fallback to userCode for old data
          membersData.sort((a, b) => {
            const orderA = a.turnOrder !== undefined ? a.turnOrder : parseInt(a.userCode);
            const orderB = b.turnOrder !== undefined ? b.turnOrder : parseInt(b.userCode);
            return orderA - orderB;
          });
          setMembers(membersData);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching live data: ", error);
          setLoading(false);
        });
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const openAddModal = () => {
    setFormData(getEmptyForm());
    setEditingMemberId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (member) => {
    setFormData({
      nameEn: member.nameEn || '',
      userCode: member.userCode || '',
      durationHours: member.durationHours || 0,
      durationMinutes: member.durationMinutes || 0,
      totalLandAcres: member.totalLandAcres || 0,
      isLeased: member.isLeased || false,
      tenants: member.tenants ? JSON.parse(JSON.stringify(member.tenants)) : []
    });
    setEditingMemberId(member.id);
    setIsModalOpen(true);
  };

  const handleAddTenant = () => {
    setFormData({
      ...formData,
      tenants: [
        ...formData.tenants,
        { tenantNameEn: '', tenantLeasedHours: 0, tenantLeasedMinutes: 0, tenantLeasedAcres: 0, id: Date.now().toString() }
      ]
    });
  };

  const handleRemoveTenant = (index) => {
    const newTenants = [...formData.tenants];
    newTenants.splice(index, 1);
    setFormData({ ...formData, tenants: newTenants });
  };

  const handleTenantChange = (index, field, value) => {
    const newTenants = [...formData.tenants];
    newTenants[index][field] = value;
    setFormData({ ...formData, tenants: newTenants });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nameEn || !formData.userCode) {
      alert("Name and User Code are required.");
      return;
    }

    try {
      const { db, firebase } = await initFirebaseAsync();
      
      // Parse numbers
      const newMemberData = {
        ...formData,
        userCode: formData.userCode.toString(),
        durationHours: parseInt(formData.durationHours) || 0,
        durationMinutes: parseInt(formData.durationMinutes) || 0,
        totalLandAcres: parseFloat(formData.totalLandAcres) || 0,
        tenants: formData.tenants.map(t => ({
          ...t,
          tenantLeasedHours: parseInt(t.tenantLeasedHours) || 0,
          tenantLeasedMinutes: parseInt(t.tenantLeasedMinutes) || 0,
          tenantLeasedAcres: parseFloat(t.tenantLeasedAcres) || 0
        }))
      };

      let updatedMembers = [...members];
      
      if (editingMemberId) {
        const index = updatedMembers.findIndex(m => m.id === editingMemberId);
        if (index > -1) {
          updatedMembers[index] = { ...updatedMembers[index], ...newMemberData };
        }
      } else {
        // Just push it, we don't have an ID yet, we'll let Firestore generate it later
        // But for sorting and auto-rechaining locally before batching, we generate a temp ID
        updatedMembers.push({ id: `temp_${Date.now()}`, ...newMemberData });
      }

      // Sort by user code
      updatedMembers.sort((a, b) => parseInt(a.userCode) - parseInt(b.userCode));
      
      // Apply Auto-Schedule Rechain
      updatedMembers = autoRechainSchedule(updatedMembers);

      // Batch write all members to update the schedule atomically
      const batch = firebase.writeBatch(db);
      
      updatedMembers.forEach(member => {
        let docRef;
        if (member.id && !member.id.startsWith('temp_')) {
          docRef = firebase.doc(db, 'members', member.id);
        } else {
          docRef = firebase.doc(firebase.collection(db, 'members'));
          // Remove temp id so it doesn't get saved
          delete member.id;
        }
        batch.set(docRef, member, { merge: true });
      });

      await batch.commit();
      setFormData(getEmptyForm());
      setEditingMemberId(null);
      setIsModalOpen(false);

    } catch (error) {
      console.error("Error saving member:", error);
      alert("Failed to save member.");
    }
  };

  const openAnchorModal = () => {
    if (members.length > 0) {
      setAnchorData({ startDay: members[0].startDay || 'Sunday', startTime: members[0].startTime || '06:00' });
    }
    setIsAnchorModalOpen(true);
  };

  const handleSaveAnchor = async (e) => {
    e.preventDefault();
    if (members.length === 0) {
      setIsAnchorModalOpen(false);
      return;
    }

    try {
      let updatedMembers = autoRechainSchedule([...members], { 
        day: anchorData.startDay, 
        time: anchorData.startTime 
      });
      setMembers(updatedMembers);
      setIsAnchorModalOpen(false);

      const { db, firebase } = await initFirebaseAsync();
      const batch = firebase.writeBatch(db);
      
      updatedMembers.forEach(member => {
        const docRef = firebase.doc(db, 'members', member.id);
        batch.update(docRef, {
          startDay: member.startDay,
          startTime: member.startTime,
          endDay: member.endDay,
          endTime: member.endTime
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error saving anchor:", error);
      alert("Failed to save schedule anchor.");
    }
  };

  const handleDragStart = (e, index) => {
    setDragItemIndex(index);
    if (members.length > 0) {
      setScheduleAnchor({ day: members[0].startDay, time: members[0].startTime });
    }
    // Needed for Firefox
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
  };

  const handleDragEnter = (e, index) => {
    setDragOverItemIndex(index);
    if (dragItemIndex !== null && dragItemIndex !== index) {
      // Instantly swap in local state for responsive UI
      const newMembers = [...members];
      const draggedItem = newMembers.splice(dragItemIndex, 1)[0];
      newMembers.splice(index, 0, draggedItem);
      setMembers(newMembers);
      setDragItemIndex(index);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    if (dragItemIndex === null) {
      setDragOverItemIndex(null);
      return;
    }

    // Since we updated array in handleDragEnter, we just use the current 'members'
    let updatedMembers = members.map((m, idx) => ({
      ...m,
      turnOrder: idx + 1
    }));

    // Recalculate schedule keeping original anchor
    updatedMembers = autoRechainSchedule(updatedMembers, scheduleAnchor);

    setMembers(updatedMembers); // Optimistic UI update
    setDragItemIndex(null);
    setDragOverItemIndex(null);

    try {
      const { db, firebase } = await initFirebaseAsync();
      const batch = firebase.writeBatch(db);
      
      updatedMembers.forEach(member => {
        const docRef = firebase.doc(db, 'members', member.id);
        batch.update(docRef, {
          turnOrder: member.turnOrder,
          startDay: member.startDay,
          startTime: member.startTime,
          endDay: member.endDay,
          endTime: member.endTime
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error saving reordered schedule:", error);
      alert("Failed to save new schedule order.");
    }
  };

  const handleDeleteClick = (member) => {
    setMemberToDelete(member.id);
  };

  const executeDelete = async () => {
    if (!memberToDelete) return;
    const memberId = memberToDelete;
    
    try {
      const { db, firebase } = await initFirebaseAsync();
      
      // Remove the member locally
      let updatedMembers = members.filter(m => m.id !== memberId);
      
      // Apply Auto-Schedule Rechain
      updatedMembers = autoRechainSchedule(updatedMembers);

      // Batch write to update the remaining members' schedule and delete the chosen one
      const batch = firebase.writeBatch(db);
      
      updatedMembers.forEach(member => {
        const docRef = firebase.doc(db, 'members', member.id);
        batch.set(docRef, member, { merge: true });
      });

      // Delete the chosen member
      const deleteRef = firebase.doc(db, 'members', memberId);
      batch.delete(deleteRef);

      await batch.commit();
      setMemberToDelete(null);

    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member.");
    }
  };

  const handleExportSchedule = () => {
    if (!members || members.length === 0) {
      return alert('No schedule members to export.');
    }

    const exportPayload = {
      appName: "Turbine Bill & Schedule Manager",
      exportDate: new Date().toISOString(),
      version: "1.0",
      totalMembers: members.length,
      users: members.map(u => {
        const h = u.durationHours !== undefined ? u.durationHours : Math.floor((u.totalMinutes || 600) / 60);
        const m = u.durationMinutes !== undefined ? u.durationMinutes : ((u.totalMinutes || 600) % 60);
        const totMins = u.totalMinutes || (h * 60 + m);

        const tenants = Array.isArray(u.tenants) && u.tenants.length > 0 
          ? u.tenants 
          : (u.isLeased && (u.tenantNameEn || u.tenantNameUr || u.tenantName || u.linkedMemberId)
              ? [{
                  id: 't-1',
                  tenantType: u.tenantType || 'external',
                  linkedMemberId: u.linkedMemberId || null,
                  tenantNameEn: u.tenantNameEn || u.tenantName || '',
                  tenantNameUr: u.tenantNameUr || '',
                  tenantPhone: u.tenantPhone || '',
                  tenantLeasedHours: u.tenantLeasedHours || 0,
                  tenantLeasedMinutes: u.tenantLeasedMinutes || 0,
                  tenantTotalLeasedMins: u.tenantTotalLeasedMins || 0,
                  tenantLeasedAcres: u.tenantLeasedAcres || 0
                }]
              : []);

        return {
          userCode: u.userCode || u.code || '01',
          nameEn: u.nameEn || u.name || '',
          nameUr: u.nameUr || '',
          phone: u.phone || '',
          userType: u.userType || 'internal',
          startDay: u.startDay || 'Sunday',
          startTime: u.startTime || '08:00',
          endDay: u.endDay || 'Monday',
          endTime: u.endTime || '01:00',
          durationHours: h,
          durationMinutes: m,
          totalMinutes: totMins,
          totalLandAcres: u.totalLandAcres || 0,
          isLeased: !!u.isLeased,
          tenants: tenants
        };
      })
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `turbine_schedule_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSchedule = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        let importedUsers = [];

        if (file.name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
          const parsed = JSON.parse(text);
          const rawList = Array.isArray(parsed) ? parsed : (parsed.users || parsed.schedule || []);

          if (!Array.isArray(rawList) || rawList.length === 0) {
            throw new Error('JSON file does not contain a valid users list.');
          }

          importedUsers = rawList.map((u, idx) => {
            const nameEn = (u.nameEn || u.name || '').trim();
            const uCode = String(u.userCode || u.code || (idx + 1)).padStart(2, '0');

            const h = parseInt(u.durationHours, 10) || 0;
            const m = parseInt(u.durationMinutes, 10) || 0;
            let totMins = (h * 60) + m;
            if (totMins <= 0 && u.totalMinutes) totMins = u.totalMinutes;
            if (totMins <= 0) totMins = 600;

            const rawTenants = Array.isArray(u.tenants) && u.tenants.length > 0
              ? u.tenants
              : (u.isLeased || u.tenantNameEn || u.tenantNameUr || u.tenantName
                  ? [{
                      id: 't-1',
                      tenantType: u.tenantType || 'external',
                      linkedMemberId: u.linkedMemberId || null,
                      tenantNameEn: (u.tenantNameEn || u.tenantName || '').trim(),
                      tenantNameUr: (u.tenantNameUr || '').trim(),
                      tenantPhone: (u.tenantPhone || '').trim(),
                      tenantLeasedHours: parseInt(u.tenantLeasedHours, 10) || 0,
                      tenantLeasedMinutes: parseInt(u.tenantLeasedMinutes, 10) || 0,
                      tenantTotalLeasedMins: u.tenantTotalLeasedMins || ((parseInt(u.tenantLeasedHours, 10) || 0) * 60 + (parseInt(u.tenantLeasedMinutes, 10) || 0)),
                      tenantLeasedAcres: parseFloat(u.tenantLeasedAcres) || 0
                    }]
                  : []);

            return {
              id: 'usr-' + Date.now() + '-' + idx,
              userCode: uCode,
              code: uCode,
              nameEn: nameEn,
              nameUr: (u.nameUr || '').trim(),
              name: nameEn,
              fullName: nameEn,
              phone: (u.phone || '').trim(),
              userType: u.userType || 'internal',
              startDay: u.startDay || 'Sunday',
              startTime: u.startTime || '08:00',
              endDay: u.endDay || 'Monday',
              endTime: u.endTime || '01:00',
              durationHours: h || Math.floor(totMins / 60),
              durationMinutes: m || (totMins % 60),
              totalMinutes: totMins,
              totalLandAcres: parseFloat(u.totalLandAcres) || 0,
              isLeased: !!u.isLeased || rawTenants.length > 0,
              tenants: rawTenants.map(t => ({
                id: t.id || `t-${Date.now()}-${Math.random()}`,
                tenantType: t.tenantType || 'external',
                linkedMemberId: t.linkedMemberId || null,
                tenantNameEn: (t.tenantNameEn || t.tenantName || '').trim(),
                tenantNameUr: (t.tenantNameUr || '').trim(),
                tenantPhone: (t.tenantPhone || '').trim(),
                tenantLeasedHours: parseInt(t.tenantLeasedHours, 10) || 0,
                tenantLeasedMinutes: parseInt(t.tenantLeasedMinutes, 10) || 0,
                tenantTotalLeasedMins: t.tenantTotalLeasedMins || ((parseInt(t.tenantLeasedHours, 10) || 0) * 60 + (parseInt(t.tenantLeasedMinutes, 10) || 0)),
                tenantLeasedAcres: parseFloat(t.tenantLeasedAcres) || 0
              }))
            };
          });
        }

        if (importedUsers.length === 0) throw new Error("No users found.");

        if (!window.confirm(`Found ${importedUsers.length} members. Importing will OVERWRITE the current schedule. Are you sure?`)) {
          return;
        }
        
        const { db, firebase } = await initFirebaseAsync();
        
        // Sort and rechain
        importedUsers.sort((a, b) => parseInt(a.userCode) - parseInt(b.userCode));
        importedUsers = autoRechainSchedule(importedUsers);

        const batch = firebase.writeBatch(db);

        // Delete all current members first
        const snapshot = await firebase.getDocs(firebase.collection(db, 'members'));
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Set all new imported members
        importedUsers.forEach(member => {
          const docRef = firebase.doc(db, 'members', member.id);
          batch.set(docRef, member);
        });

        await batch.commit();
        alert('Schedule imported successfully!');
      } catch (err) {
        console.error("Import error:", err);
        alert('Failed to import schedule: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setIsAddMenuOpen(false);
  };

  // Helper to get initials from a name
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Helper to generate a stable pastel color from user code
  const getAvatarColor = (code) => {
    const colors = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#E0E7FF', '#FFEDD5'];
    const textColors = ['#1E40AF', '#065F46', '#92400E', '#9D174D', '#3730A3', '#9A3412'];
    const num = parseInt(code, 10) || 0;
    const index = num % colors.length;
    return { bg: colors[index], text: textColors[index] };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Loading Live Members...</div>;
  }

  // Calculate Stats
  const totalMembers = members.length;
  let totalTenants = 0;
  let tenantLeasedHours = 0;
  let totalAssignedHours = 0;

  members.forEach(m => {
    // Total assigned hours
    totalAssignedHours += (m.durationHours || 0) + ((m.durationMinutes || 0) / 60);

    // Tenant stats
    if (m.isLeased && Array.isArray(m.tenants)) {
      totalTenants += m.tenants.length;
      m.tenants.forEach(t => {
        tenantLeasedHours += (t.tenantLeasedHours || 0) + ((t.tenantLeasedMinutes || 0) / 60);
      });
    }
  });

  const remainingWeeklyHours = 168 - totalAssignedHours;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Members Directory</h1>
          <p>Manage the {members.length} active tubewell share members</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn btn-tertiary" 
              onClick={openAnchorModal} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CalendarClock size={16} /> Change Start Time
            </button>
            <div className="add-menu-container" style={{ position: 'relative' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Add <ChevronDown size={16} />
            </button>
            
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportSchedule}
            />

            {isAddMenuOpen && (
              <div className="dropdown-menu">
                <button 
                  className="dropdown-item"
                  onClick={() => { openAddModal(); setIsAddMenuOpen(false); }}
                >
                  <Plus size={16} /> Add New Member
                </button>
                <div className="dropdown-divider"></div>
                <button 
                  className="dropdown-item"
                  onClick={() => { handleExportSchedule(); setIsAddMenuOpen(false); }}
                >
                  <Download size={16} /> Export Schedule
                </button>
                <button 
                  className="dropdown-item"
                  onClick={() => { fileInputRef.current.click(); }}
                >
                  <Upload size={16} /> Import Schedule
                </button>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Stats Cards ... */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* TOTAL MEMBERS */}
        <div className="card" style={{ padding: '16px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL MEMBERS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalMembers}</div>
        </div>

        {/* TOTAL TENANTS */}
        <div className="card" style={{ padding: '16px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL TENANTS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalTenants}</div>
        </div>

        {/* TENANT LEASED HOURS */}
        <div className="card" style={{ padding: '16px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TENANT LEASED HOURS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{tenantLeasedHours.toFixed(2)} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-tertiary)' }}>hrs</span></div>
        </div>

        {/* TOTAL ASSIGNED HOURS */}
        <div className="card" style={{ padding: '16px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TOTAL ASSIGNED HOURS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{totalAssignedHours.toFixed(2)} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-tertiary)' }}>/ 168.00 hrs</span></div>
        </div>

        {/* REMAINING WEEKLY HOURS */}
        <div className="card" style={{ padding: '16px', background: remainingWeeklyHours < 0 ? 'var(--danger-light)' : 'var(--bg-surface)', borderColor: remainingWeeklyHours < 0 ? 'var(--danger)' : 'var(--border-default)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>REMAINING WEEKLY HOURS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: remainingWeeklyHours < 0 ? 'var(--danger)' : 'var(--warning)' }}>
            {remainingWeeklyHours < 0 ? `Over by +${Math.abs(remainingWeeklyHours).toFixed(2)}` : remainingWeeklyHours.toFixed(2)} <span style={{ fontSize: '14px', fontWeight: 600, color: remainingWeeklyHours < 0 ? 'var(--danger)' : 'var(--text-tertiary)', opacity: remainingWeeklyHours < 0 ? 0.8 : 1 }}>hrs</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {members.map((member, index) => {
          const avatar = getAvatarColor(member.userCode);
          return (
            <div 
              key={member.id} 
              className="card"
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrag={(e) => {
                if (e.clientY === 0) return;
                const threshold = 100;
                if (e.clientY < threshold) {
                  startScrolling(-1);
                } else if (window.innerHeight - e.clientY < threshold) {
                  startScrolling(1);
                } else {
                  stopScrolling();
                }
              }}
              onDragEnd={(e) => {
                stopScrolling();
                handleDrop(e);
              }}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                position: 'relative',
                opacity: dragItemIndex === index ? 0.5 : 1,
                transform: dragOverItemIndex === index ? 'scale(1.02)' : 'scale(1)',
                border: dragOverItemIndex === index ? '2px dashed var(--primary)' : '1px solid var(--border-default)',
                transition: 'all 0.2s ease',
                cursor: isAdmin ? 'grab' : 'default'
              }}
            >
              
              {/* Admin Actions */}
              {isAdmin && (
                <div className="context-menu-container" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                  <button 
                    onClick={() => setActiveDropdownId(activeDropdownId === member.id ? null : member.id)}
                    className="btn-icon"
                    title="Options"
                  >
                    <MoreVertical size={18} />
                  </button>
                  
                  {activeDropdownId === member.id && (
                    <div className="dropdown-menu">
                      <button 
                        className="dropdown-item"
                        onClick={() => { openEditModal(member); setActiveDropdownId(null); }}
                      >
                        <Edit2 size={16} /> Edit Member
                      </button>
                      <div className="dropdown-divider"></div>
                      <button 
                        className="dropdown-item danger"
                        onClick={() => { handleDeleteClick(member); setActiveDropdownId(null); }}
                      >
                        <Trash2 size={16} /> Delete Member
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Card Header with Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-4)', paddingRight: isAdmin ? '40px' : '0' }}>
                {isAdmin && (
                  <div style={{ color: 'var(--text-tertiary)', cursor: 'grab', marginRight: '-8px' }}>
                    <GripVertical size={20} />
                  </div>
                )}
                
                {/* Avatar */}
                <div style={{ 
                  width: '44px', 
                  height: '44px', 
                  borderRadius: '50%', 
                  background: avatar.bg,
                  color: avatar.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  {getInitials(member.nameEn)}
                </div>

                {/* Name & ID */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.nameEn}</h3>
                    {member.isLeased && (
                      <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 6px' }}>Leased</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Code: {member.userCode}</span>
                </div>
              </div>

              {/* Stats (Share & Land) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Weekly Share</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>
                    {member.durationHours}h {member.durationMinutes > 0 ? `${member.durationMinutes}m` : ''}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Total Land</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--success-dark)' }}>
                    {member.totalLandAcres || 0} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>acres</span>
                  </div>
                </div>
              </div>

              {/* Time Window (Weekly Schedule) */}
              <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Start Time</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.startDay} {format12Hour(member.startTime)}</div>
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>End Time</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.endDay} {format12Hour(member.endTime)}</div>
                </div>
              </div>

              {/* Tenants Section */}
              {member.tenants && member.tenants.length > 0 && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    TENANTS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {member.tenants.map((tenant, tIdx) => {
                      const tDisplayName = tenant.tenantNameEn || `Tenant #${tIdx + 1}`;
                      const h = tenant.tenantLeasedHours || 0;
                      const m = tenant.tenantLeasedMinutes || 0;
                      const acres = tenant.tenantLeasedAcres || 0;
                      
                      const timeParts = [];
                      if (h > 0) timeParts.push(`${h}h`);
                      if (m > 0) timeParts.push(`${m}m`);
                      const timeStr = timeParts.join(' ');
                      
                      const details = [];
                      if (timeStr) details.push(timeStr);
                      if (acres > 0) details.push(`${acres} acres`);
                      const detailsStr = details.length > 0 ? `(${details.join(' / ')})` : '';

                      return (
                        <div key={tenant.id || tIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '14px', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-default)' }}></div>
                            <span style={{ fontWeight: 500 }}>{tDisplayName}</span>
                          </div>
                          {detailsStr && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{detailsStr}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <button className="modal-close" onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={24} />
            </button>
            
            <h2 style={{ margin: '0 0 24px 0' }}>{editingMemberId ? 'Edit Member' : 'Add New Member'}</h2>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Member Name (English)</label>
                  <input 
                    type="text" required 
                    className="input-field" 
                    value={formData.nameEn} 
                    onChange={e => setFormData({...formData, nameEn: e.target.value})} 
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>User Code</label>
                  <input 
                    type="number" required 
                    className="input-field" 
                    value={formData.userCode} 
                    onChange={e => setFormData({...formData, userCode: e.target.value})} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Weekly Hours</label>
                  <input 
                    type="number" min="0" required
                    className="input-field" 
                    value={formData.durationHours} 
                    onChange={e => setFormData({...formData, durationHours: e.target.value})} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Weekly Minutes</label>
                  <input 
                    type="number" min="0" max="59" required
                    className="input-field" 
                    value={formData.durationMinutes} 
                    onChange={e => setFormData({...formData, durationMinutes: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Land (Acres)</label>
                <input 
                  type="number" step="0.1" min="0" required
                  className="input-field" 
                  value={formData.totalLandAcres} 
                  onChange={e => setFormData({...formData, totalLandAcres: e.target.value})} 
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.isLeased} 
                  onChange={e => setFormData({...formData, isLeased: e.target.checked})} 
                />
                <span style={{ fontWeight: 500 }}>Is Leased to Tenants?</span>
              </label>

              {formData.isLeased && (
                <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0 }}>Tenants</h4>
                    <button type="button" onClick={handleAddTenant} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>+ Add Tenant</button>
                  </div>
                  
                  {formData.tenants.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '12px', background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Tenant Name</label>
                          <input type="text" placeholder="e.g. Ali Raza" className="input-field" style={{ padding: '6px 10px' }} value={t.tenantNameEn} onChange={e => handleTenantChange(idx, 'tenantNameEn', e.target.value)} required />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Hours</label>
                            <input type="number" min="0" className="input-field" style={{ padding: '6px 10px' }} value={t.tenantLeasedHours} onChange={e => handleTenantChange(idx, 'tenantLeasedHours', e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Minutes</label>
                            <input type="number" min="0" max="59" className="input-field" style={{ padding: '6px 10px' }} value={t.tenantLeasedMinutes} onChange={e => handleTenantChange(idx, 'tenantLeasedMinutes', e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Acres</label>
                            <input type="number" step="0.1" min="0" className="input-field" style={{ padding: '6px 10px' }} value={t.tenantLeasedAcres} onChange={e => handleTenantChange(idx, 'tenantLeasedAcres', e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveTenant(idx)} className="btn-icon btn-icon-danger" style={{ marginTop: '16px' }} title="Remove Tenant">
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  {formData.tenants.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No tenants added. Click '+ Add Tenant' to add one.</p>}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Member & Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!memberToDelete}
        title="Delete Member"
        message="Are you sure you want to delete this member? The entire weekly schedule will automatically re-chain to fill the gap."
        onConfirm={executeDelete}
        onCancel={() => setMemberToDelete(null)}
        confirmText="Delete Member"
      />

      {/* Schedule Anchor Modal */}
      {isAnchorModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px', maxWidth: '90vw', padding: '24px', overflow: 'visible' }}>
            <button className="modal-close" onClick={() => setIsAnchorModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={24} />
            </button>
            
            <h2 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarClock size={24} color="var(--primary)" /> Change Start Time
            </h2>
            
            <form onSubmit={handleSaveAnchor} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Start Day</label>
                    
                    {/* Custom Dropdown Trigger */}
                    <div 
                      className="input-field" 
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => document.getElementById('day-dropdown-menu').style.display = document.getElementById('day-dropdown-menu').style.display === 'none' ? 'block' : 'none'}
                    >
                      <span>{anchorData.startDay}</span>
                      <ChevronDown size={16} color="var(--text-secondary)" />
                    </div>

                    {/* Custom Dropdown Menu */}
                    <div 
                      id="day-dropdown-menu"
                      style={{ 
                        display: 'none',
                        position: 'absolute', 
                        top: '100%', 
                        left: 0, 
                        right: 0, 
                        marginTop: '4px',
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-default)', 
                        borderRadius: 'var(--radius-md)', 
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 100,
                        maxHeight: '150px',
                        overflowY: 'auto'
                      }}
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                        <div 
                          key={day}
                          onClick={() => {
                            setAnchorData({...anchorData, startDay: day});
                            document.getElementById('day-dropdown-menu').style.display = 'none';
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            background: anchorData.startDay === day ? 'var(--primary-light)' : 'transparent',
                            color: anchorData.startDay === day ? 'var(--primary)' : 'var(--text-primary)',
                            fontWeight: anchorData.startDay === day ? 600 : 400,
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (anchorData.startDay !== day) e.target.style.background = 'var(--bg-muted)';
                          }}
                          onMouseLeave={(e) => {
                            if (anchorData.startDay !== day) e.target.style.background = 'transparent';
                          }}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Start Time (24h)</label>
                    <input 
                      type="time" required 
                      className="input-field" 
                      value={anchorData.startTime} 
                      onChange={e => setAnchorData({...anchorData, startTime: e.target.value})} 
                    />
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.4 }}>
                  Setting this time anchors the entire schedule. Everyone else's time will automatically cascade sequentially after this.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAnchorModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Anchor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
