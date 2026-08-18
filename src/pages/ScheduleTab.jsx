import React, { useState, useEffect } from 'react';
import { Users } from '../components/Icons';
import { initFirebaseAsync } from '../config/firebase';
import { format12Hour, generateWhatsAppSchedule } from '../utils/scheduleLogic';
import { SkeletonScheduleTable } from '../components/Skeleton';
import { Share2 } from 'lucide-react';
import ShareScheduleModal from '../components/ShareScheduleModal';
import { useToast } from '../context/ToastContext';

const DAYS = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };

function timeToMinutes(day, time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return DAYS[day] * 24 * 60 + hours * 60 + minutes;
}

export default function ScheduleTab() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDayStr, setCurrentDayStr] = useState('');
  const [currentMinutes, setCurrentMinutes] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { showToast } = useToast();

  const handleCopySchedule = (language) => {
    // Sort members for schedule generation (same as state)
    const sortedMembers = [...members].sort((a, b) => {
      const orderA = a.turnOrder !== undefined ? a.turnOrder : parseInt(a.userCode);
      const orderB = b.turnOrder !== undefined ? b.turnOrder : parseInt(b.userCode);
      return orderA - orderB;
    });
    
    const text = generateWhatsAppSchedule(sortedMembers, language);
    navigator.clipboard.writeText(text).then(() => {
      showToast('Schedule copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy', err);
      showToast('Failed to copy schedule.', 'error');
    });
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setCurrentDayStr(days[now.getDay()]);
      setCurrentMinutes(now.getDay() * 24 * 60 + now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 60000); // check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let unsubscribe;
    
    const loadData = async () => {
      try {
        const { db, firebase } = await initFirebaseAsync();
        const membersRef = firebase.collection(db, 'members');
        
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

  if (loading) {
    return (
      <div style={{ padding: '0' }}>
        <SkeletonScheduleTable rows={7} />
      </div>
    );
  }

  // Find the active shift
  let activeIndex = -1;
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const start = timeToMinutes(member.startDay, member.startTime);
    const end = timeToMinutes(member.endDay, member.endTime);
    
    if (end < start) {
      if (currentMinutes >= start || currentMinutes < end) {
        activeIndex = i;
        break;
      }
    } else {
      if (currentMinutes >= start && currentMinutes < end) {
        activeIndex = i;
        break;
      }
    }
  }

  // Rotate array to put the active shift at the top
  const sortedMembers = activeIndex !== -1 
    ? [...members.slice(activeIndex), ...members.slice(0, activeIndex)]
    : members;

  // Calculate progress for active shift
  let progressPercentage = 0;
  let timeRemaining = "";
  if (activeIndex !== -1) {
    const activeMember = members[activeIndex];
    const start = timeToMinutes(activeMember.startDay, activeMember.startTime);
    const end = timeToMinutes(activeMember.endDay, activeMember.endTime);
    
    let totalMinutes = end - start;
    if (totalMinutes < 0) totalMinutes += 7 * 24 * 60;
    
    let elapsed = currentMinutes - start;
    if (elapsed < 0) elapsed += 7 * 24 * 60;
    
    progressPercentage = Math.min(100, Math.max(0, (elapsed / totalMinutes) * 100));
    
    const remainingMinutes = totalMinutes - elapsed;
    const remHours = Math.floor(remainingMinutes / 60);
    const remMins = remainingMinutes % 60;
    timeRemaining = `${remHours}h ${remMins}m remaining`;
  }

  // No search filter anymore
  const filteredSortedMembers = sortedMembers;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', margin: 0 }}>Weekly Schedule</h1>
          <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>
            Live tubewell rotation. Today is <strong style={{ color: 'var(--primary)' }}>{currentDayStr}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => setIsShareModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)' }}
          >
            <Share2 size={16} />
            Share Schedule
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px' }}>
        {filteredSortedMembers.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No members found.
          </div>
        ) : filteredSortedMembers.map((member, index) => {
          const isCurrentShift = activeIndex !== -1 && member.userCode === members[activeIndex].userCode;

          // Calculate exact dates for this shift
          const startMins = timeToMinutes(member.startDay, member.startTime);
          let diffStart = startMins - currentMinutes;
          
          if (index === 0 && isCurrentShift) {
            if (diffStart > 0) diffStart -= 7 * 24 * 60;
          } else {
            if (diffStart < 0) diffStart += 7 * 24 * 60;
          }

          let duration = timeToMinutes(member.endDay, member.endTime) - startMins;
          if (duration < 0) duration += 7 * 24 * 60;
          const diffEnd = diffStart + duration;

          const nowMs = Date.now();
          const startDate = new Date(nowMs + diffStart * 60000);
          const endDate = new Date(nowMs + diffEnd * 60000);
          
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const startDateStr = `${member.startDay.substring(0, 3)}, ${months[startDate.getMonth()]} ${startDate.getDate()}`;
          const endDateStr = `${member.endDay.substring(0, 3)}, ${months[endDate.getMonth()]} ${endDate.getDate()}`;

          return (
              <div 
              key={member.userCode} 
              className="card"
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                padding: '12px',
                background: isCurrentShift ? 'var(--success-light)' : 'var(--bg-surface)',
                borderColor: isCurrentShift ? 'var(--success)' : 'var(--border-default)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Progress Bar Background for Active Shift */}
              {isCurrentShift && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '4px',
                  background: 'var(--success)',
                  width: `${progressPercentage}%`,
                  transition: 'width 1s linear'
                }} />
              )}

              <div className="schedule-card-inner">
                <div className="schedule-info">
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
                    {startDateStr} {format12Hour(member.startTime)} <span style={{ opacity: 0.5 }}>→</span> {endDateStr} {format12Hour(member.endTime)}
                  </div>
                  
                  {/* Primary Name Display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {member.nameEn}
                    </span>
                    {member.isLeased && <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>Leased</span>}
                  </div>
                  
                  {/* Tenants Display (Chips) */}
                  {member.isLeased && Array.isArray(member.tenants) && member.tenants.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {member.tenants.map((t, tIdx) => {
                        const tNameEn = t.tenantNameEn || t.tenantName || '';
                        const tDisplayName = tNameEn || `Tenant #${tIdx + 1}`;
                        const h = t.tenantLeasedHours || 0;
                        const m = t.tenantLeasedMinutes || 0;
                        const acres = t.tenantLeasedAcres || 0;
                        
                        const timeParts = [];
                        if (h > 0) timeParts.push(`${h}h`);
                        if (m > 0) timeParts.push(`${m}m`);
                        const timeStr = timeParts.join(' ');
                        
                        const details = [];
                        if (timeStr) details.push(timeStr);
                        if (acres > 0) details.push(`${acres} acres`);
                        const detailsStr = details.length > 0 ? `(${details.join(' / ')})` : '';

                        return (
                          <div key={tIdx} style={{ 
                            fontSize: '10px', 
                            fontWeight: 500, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '3px',
                            background: isCurrentShift ? 'rgba(22, 163, 74, 0.15)' : 'var(--bg-muted)',
                            color: isCurrentShift ? 'var(--success)' : 'var(--text-secondary)',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            border: `1px solid ${isCurrentShift ? 'rgba(22, 163, 74, 0.3)' : 'var(--border-default)'}`
                          }}>
                            <Users size={11} />
                            <span>{tDisplayName} {detailsStr && <span style={{ opacity: 0.8 }}>{detailsStr}</span>}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="schedule-duration" style={{ 
                  color: isCurrentShift ? 'var(--success)' : 'var(--primary)',
                  fontSize: '14px',
                  fontWeight: 700
                }}>
                  <span>{member.durationHours}h {member.durationMinutes > 0 ? `${member.durationMinutes}m` : ''}</span>
                  {isCurrentShift && (
                    <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.8 }}>
                      {timeRemaining}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ShareScheduleModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        onCopyText={handleCopySchedule}
      />
    </div>
  );
}
