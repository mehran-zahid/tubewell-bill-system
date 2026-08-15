import React, { useState, useEffect } from 'react';
import { initFirebaseAsync } from '../config/firebase';

export default function MembersTab() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

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
          
          // Sort by user code numeric value just to keep them in order
          membersData.sort((a, b) => parseInt(a.userCode) - parseInt(b.userCode));
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

  // Helper to get initials from a name
  const getInitials = (name) => {
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
      <div className="page-header">
        <div>
          <h1>Members Directory</h1>
          <p>Manage the {members.length} active tubewell share members</p>
        </div>
      </div>

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
        {members.map(member => {
          const avatar = getAvatarColor(member.userCode);
          return (
            <div key={member.userCode} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              
              {/* Card Header with Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-4)' }}>
                
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
                  fontSize: '16px'
                }}>
                  {getInitials(member.nameEn)}
                </div>

                {/* Name & ID */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.nameEn}</h3>
                    {member.isLeased && (
                      <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 6px' }}>Leased</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {member.userCode}</span>
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

              {/* Tenants Section */}
              {member.tenants && member.tenants.length > 0 && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    TENANTS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {member.tenants.map((tenant, tIdx) => {
                      const tNameEn = tenant.tenantNameEn || tenant.tenantName || '';
                      const tNameUr = tenant.tenantNameUr || '';
                      const tDisplayName = tNameEn || tNameUr || `Thekedar #${tIdx + 1}`;
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
    </div>
  );
}
