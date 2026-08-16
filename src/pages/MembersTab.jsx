import React, { useState, useEffect } from 'react';
import { initFirebaseAsync } from '../config/firebase';
import { autoRechainSchedule, format12Hour } from '../utils/scheduleLogic';
import { Edit2, Trash2, Plus, X, MoreVertical, ChevronDown, Download, Upload, GripVertical, CalendarClock } from '../components/Icons';
import { Settings2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { SkeletonMemberCard, SkeletonMembersTable } from '../components/Skeleton';

export default function MembersTab({ isAdmin }) {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [formData, setFormData] = useState(getEmptyForm());
  
  // Confirm Delete Modal State
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [importConfirmData, setImportConfirmData] = useState(null);
  
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
        { tenantNameEn: '', tenantCode: '', tenantLeasedHours: 0, tenantLeasedMinutes: 0, tenantLeasedAcres: 0, id: Date.now().toString() }
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

  const handleSaveMember = async () => {
    if (!formData.nameEn.trim() || !formData.userCode.trim()) {
      showToast("Name and User Code are required.", "warning");
      return;
    }

    // --- Uniqueness Validation ---
    const allExistingCodes = new Set();
    const codes = [];
    const allOtherCodes = new Set();
    
    members.forEach(m => {
      if (m.id !== editingMemberId) {
        if (m.userCode) {
          const num = parseInt(m.userCode, 10);
          if (!isNaN(num)) allOtherCodes.add(num);
        }
        if (m.tenants && Array.isArray(m.tenants)) {
          m.tenants.forEach(t => {
            if (t.tenantCode) {
              const num = parseInt(t.tenantCode, 10);
              if (!isNaN(num)) allOtherCodes.add(num);
            }
          });
        }
      }
    });

    const mainNum = parseInt(formData.userCode, 10);
    if (!isNaN(mainNum)) codes.push(mainNum);

    if (formData.isLeased && formData.tenants) {
      formData.tenants.forEach(t => {
        if (t.tenantCode) {
          const tNum = parseInt(t.tenantCode, 10);
          if (!isNaN(tNum)) codes.push(tNum);
        }
      });
    }

    // Check for duplicates within the submitted form itself
    const duplicatesInForm = codes.filter((item, index) => codes.indexOf(item) !== index);
    if (duplicatesInForm.length > 0) {
      showToast("You have entered duplicate codes within this member's form. Each owner and tenant must have a strictly unique code.", "error");
      return;
    }

    // Check against other members/tenants in the database
    for (const code of codes) {
      if (allOtherCodes.has(code)) {
        showToast(`The code '${code}' (or its 0-padded equivalent) is already in use by another owner or tenant. Please use a unique code.`, "error");
        return;
      }
    }
    // -------------------------------

    try {
      const { db, firebase } = await initFirebaseAsync();
      
      const newMemberData = {
        ...formData,
        userCode: formData.userCode.toString(),
        durationHours: parseInt(formData.durationHours) || 0,
        durationMinutes: parseInt(formData.durationMinutes) || 0,
        totalLandAcres: parseFloat(formData.totalLandAcres) || 0,
        tenants: formData.tenants.map(t => ({
          ...t,
          tenantCode: t.tenantCode ? t.tenantCode.toString() : '',
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
        updatedMembers.push({ id: `temp_${Date.now()}`, ...newMemberData });
      }

      updatedMembers.sort((a, b) => parseInt(a.userCode) - parseInt(b.userCode));
      updatedMembers = autoRechainSchedule(updatedMembers);

      const batch = firebase.writeBatch(db);
      
      updatedMembers.forEach(member => {
        let docRef;
        if (member.id && !member.id.startsWith('temp_')) {
          docRef = firebase.doc(db, 'members', member.id);
        } else {
          docRef = firebase.doc(firebase.collection(db, 'members'));
          delete member.id;
        }
        batch.set(docRef, member, { merge: true });
      });

      await batch.commit();
      setFormData(getEmptyForm());
      setEditingMemberId(null);
      setIsModalOpen(false);
      showToast("Member saved successfully", "success");
    } catch (e) {
      console.error("Error saving member", e);
      showToast("Failed to save member.", "error");
    }
  };

  const openAnchorModal = () => {
    if (members.length > 0) {
      setAnchorData({ startDay: members[0].startDay || 'Sunday', startTime: members[0].startTime || '06:00' });
    }
    setIsAnchorModalOpen(true);
  };

  const handleSaveAnchor = async (anchorDate) => {
    try {
      const { db, firebase } = await initFirebaseAsync();
      const metaRef = firebase.doc(db, 'metadata', 'scheduleAnchor');
      await firebase.setDoc(metaRef, { date: anchorDate });
      setScheduleAnchor(anchorDate);
      setIsAnchorModalOpen(false);
      showToast("Schedule anchor saved", "success");
    } catch (e) {
      console.error("Error saving schedule anchor", e);
      showToast("Failed to save schedule anchor.", "error");
    }
  };

  const handleDragStart = (e, index) => {
    setDragItemIndex(index);
    if (members.length > 0) {
      setScheduleAnchor({ day: members[0].startDay, time: members[0].startTime });
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
  };

  const handleDragEnter = (e, index) => {
    setDragOverItemIndex(index);
    if (dragItemIndex !== null && dragItemIndex !== index) {
      const newMembers = [...members];
      const draggedItem = newMembers.splice(dragItemIndex, 1)[0];
      newMembers.splice(index, 0, draggedItem);
      setMembers(newMembers);
      setDragItemIndex(index);
    }
  };

  const handleDrop = async (newOrder) => {
    try {
      const { db, firebase } = await initFirebaseAsync();
      const batch = firebase.writeBatch(db);
      
      newOrder.forEach((member, idx) => {
        const docRef = firebase.doc(db, 'members', member.id);
        batch.update(docRef, { turnOrder: idx + 1 });
      });
      await batch.commit();
      
      setMembers(newOrder);
      showToast("Schedule order saved", "success");
    } catch (e) {
      console.error("Error saving schedule order", e);
      showToast("Failed to save new schedule order.", "error");
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
      
      let updatedMembers = members.filter(m => m.id !== memberId);
      updatedMembers = autoRechainSchedule(updatedMembers);

      const batch = firebase.writeBatch(db);
      
      updatedMembers.forEach(member => {
        const docRef = firebase.doc(db, 'members', member.id);
        batch.set(docRef, member, { merge: true });
      });

      const deleteRef = firebase.doc(db, 'members', memberId);
      batch.delete(deleteRef);

      await batch.commit();
      setMemberToDelete(null);
      showToast("Member deleted", "success");
    } catch (error) {
      console.error("Error deleting member:", error);
      showToast("Failed to delete member.", "error");
    }
  };

  const handleExportSchedule = () => {
    if (!members || members.length === 0) {
      return showToast('No schedule members to export.', "warning");
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
                  tenantCode: u.tenantCode || '',
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
    showToast("Schedule exported", "success");
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
                      tenantCode: (u.tenantCode || '').trim(),
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
                tenantCode: (t.tenantCode || '').trim(),
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
        
        importedUsers.sort((a, b) => parseInt(a.userCode) - parseInt(b.userCode));
        importedUsers = autoRechainSchedule(importedUsers);

        const batch = firebase.writeBatch(db);

        const snapshot = await firebase.getDocs(firebase.collection(db, 'members'));
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        importedUsers.forEach(member => {
          const docRef = firebase.doc(db, 'members', member.id);
          batch.set(docRef, member);
        });

        await batch.commit();
        showToast('Schedule imported successfully!', "success");
      } catch (err) {
        console.error("Import error:", err);
        showToast('Failed to import schedule: ' + err.message, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setIsAddMenuOpen(false);
  };

  // Removed unused getInitials



  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        {viewMode === 'grid' ? (
          <div className="members-grid">
            <SkeletonMemberCard count={4} />
          </div>
        ) : (
          <SkeletonMembersTable rows={5} />
        )}
      </div>
    );
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', margin: 0 }}>Members Directory</h1>
        </div>
        {isAdmin && (
          <div className="add-menu-container" style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              className="btn-icon" 
              onClick={(e) => { e.stopPropagation(); setIsAddMenuOpen(!isAddMenuOpen); }}
              style={{ padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              <MoreVertical size={20} />
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportSchedule}
            />
          </div>
        )}
      </div>

      {/* Stats Cards ... */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        {/* TOTAL MEMBERS */}
        <div className="card" style={{ flex: '1 1 130px', padding: '12px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>TOTAL MEMBERS</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{totalMembers}</div>
        </div>

        {/* TOTAL TENANTS */}
        <div className="card" style={{ flex: '1 1 130px', padding: '12px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>TOTAL TENANTS</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{totalTenants}</div>
        </div>

        {/* TENANT LEASED HOURS */}
        <div className="card" style={{ flex: '1 1 130px', padding: '12px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>TENANT HOURS</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {tenantLeasedHours.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>hrs</span>
          </div>
        </div>

        {/* TOTAL ASSIGNED HOURS */}
        <div className="card" style={{ flex: '1 1 130px', padding: '12px', background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>ASSIGNED HOURS</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '4px', flexWrap: 'wrap' }}>
            {totalAssignedHours.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>/ 168 hrs</span>
          </div>
        </div>

        {/* REMAINING WEEKLY HOURS */}
        <div className="card" style={{ flex: '1 1 130px', padding: '12px', background: remainingWeeklyHours < 0 ? 'var(--danger-light)' : 'var(--bg-surface)', borderColor: remainingWeeklyHours < 0 ? 'var(--danger)' : 'var(--border-default)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>REMAINING HOURS</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: remainingWeeklyHours < 0 ? 'var(--danger)' : 'var(--warning)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {remainingWeeklyHours < 0 ? `+${Math.abs(remainingWeeklyHours).toFixed(1)}` : remainingWeeklyHours.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 600, color: remainingWeeklyHours < 0 ? 'var(--danger)' : 'var(--text-tertiary)', opacity: remainingWeeklyHours < 0 ? 0.8 : 1 }}>hrs</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {members.map((member, index) => {
          const avatar = { bg: 'var(--primary-light)', text: 'var(--primary)' };
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
                setDragItemIndex(null);
                setDragOverItemIndex(null);
                handleDrop(members);
              }}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                position: 'relative',
                padding: '12px',
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
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  background: avatar.bg,
                  color: avatar.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '12px',
                  flexShrink: 0
                }}>
                  {member.userCode || '?'}
                </div>

                {/* Name & ID */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.nameEn}</h3>
                    {member.isLeased && (
                      <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>Leased</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Code: {member.userCode}</span>
                </div>
              </div>

              {/* Stats (Share & Land) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: 'var(--space-3)' }}>
                <div style={{ background: 'var(--bg-canvas)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: 500 }}>Weekly Share</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                    {member.durationHours}h {member.durationMinutes > 0 ? `${member.durationMinutes}m` : ''}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-canvas)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: 500 }}>Total Land</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--success-dark)' }}>
                    {member.totalLandAcres || 0} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>acres</span>
                  </div>
                </div>
              </div>

              {/* Time Window (Weekly Schedule) */}
              <div style={{ background: 'var(--bg-canvas)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Start Time</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.startDay ? member.startDay.substring(0,3) : ''} {format12Hour(member.startTime)}</div>
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>End Time</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.endDay ? member.endDay.substring(0,3) : ''} {format12Hour(member.endTime)}</div>
                </div>
              </div>

              {/* Tenants Section */}
              {member.tenants && member.tenants.length > 0 && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.5px' }}>
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
                      
                      const tAvatar = { bg: 'var(--warning-light)', text: 'var(--warning)' };
                      
                      return (
                        <div key={tenant.id || tIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-canvas)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '28px', height: '28px', borderRadius: '50%', background: tAvatar.bg, color: tAvatar.text, 
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0 
                            }}>
                              {tenant.tenantCode || '?'}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{tDisplayName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{timeStr ? `Leased: ${timeStr}` : 'No specific time'}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success-dark)' }}>{acres > 0 ? `${acres} acres` : ''}</div>
                          </div>
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
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveMember(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Tenant Name</label>
                            <input type="text" placeholder="e.g. Ali Raza" className="input-field" style={{ padding: '6px 10px' }} value={t.tenantNameEn} onChange={e => handleTenantChange(idx, 'tenantNameEn', e.target.value)} required />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Tenant Code</label>
                            <input type="number" placeholder="e.g. 17" className="input-field" style={{ padding: '6px 10px' }} value={t.tenantCode} onChange={e => handleTenantChange(idx, 'tenantCode', e.target.value)} required />
                          </div>
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
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveAnchor(anchorData); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          {isAddMenuOpen && (
            <div className="modal-overlay" onClick={() => setIsAddMenuOpen(false)} style={{ zIndex: 60 }}>
              <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '400px' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>Admin Actions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    className="btn btn-primary"
                    style={{ justifyContent: 'flex-start', padding: '16px' }}
                    onClick={() => { openAddModal(); setIsAddMenuOpen(false); }}
                  >
                    <Plus size={20} style={{ marginRight: '12px' }} /> Add New Member
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '16px' }}
                    onClick={() => { openAnchorModal(); setIsAddMenuOpen(false); }}
                  >
                    <CalendarClock size={20} style={{ marginRight: '12px' }} /> Change Start Time
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '16px' }}
                    onClick={() => { handleExportSchedule(); setIsAddMenuOpen(false); }}
                  >
                    <Download size={20} style={{ marginRight: '12px' }} /> Export Schedule
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '16px' }}
                    onClick={() => { fileInputRef.current.click(); setIsAddMenuOpen(false); }}
                  >
                    <Upload size={20} style={{ marginRight: '12px' }} /> Import Schedule
                  </button>
                </div>
                <button className="btn btn-tertiary" style={{ width: '100%', marginTop: '16px' }} onClick={() => setIsAddMenuOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
    </div>
  );
}
