import React, { useState, useEffect, useRef } from 'react';
import { Share2, CheckCircle2, TerminalSquare, Save, Image as ImageIcon, Send, X, Phone, Settings2 } from 'lucide-react';
import { FileText, Smartphone, Languages, Play, CheckCircle, AlertTriangle, Info, Clock, Download } from 'lucide-react';
import { initFirebaseAsync } from '../config/firebase';
import { getAllGeneratedBills } from '../services/billingService';
import { useToast } from '../context/ToastContext';
import GraphicReceipt from '../components/GraphicReceipt';
import CustomDropdown from '../components/CustomDropdown';
import { toJpeg } from 'html-to-image';
import { generateWhatsAppText } from '../utils/billingTextGenerator';
import { generateWhatsAppSchedule } from '../utils/scheduleLogic';
import { SkeletonBulkShare } from '../components/Skeleton';

// Formats a local Pakistani number (03XX) to international format for wa.me (923XX)
const formatPhoneForWhatsApp = (num) => {
  let clean = num.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    return '92' + clean.substring(1);
  }
  return clean;
};

export default function BulkShareTab() {
  const { showToast } = useToast();
  
  // Data
  const [savedBills, setSavedBills] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState('');
  const [members, setMembers] = useState([]);
  
  // State
  const [phoneNumbers, setPhoneNumbers] = useState({});
  const [memberSettings, setMemberSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [billingData, setBillingData] = useState([]);
  const [generatedMembersCount, setGeneratedMembersCount] = useState(0);
  const [currentRenderMember, setCurrentRenderMember] = useState(null);
  const offScreenReceiptRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const bills = await getAllGeneratedBills();
        setSavedBills(bills);
        if (bills.length > 0) {
          setSelectedBillId(bills[0].id);
        }

        const { db, firebase } = await initFirebaseAsync();
        const snapshot = await firebase.getDocs(firebase.collection(db, 'members'));
        const mList = [];
        const phones = {};
        const settings = {};
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const m = { id: doc.id, ...data, type: 'owner', ownerId: doc.id };
          mList.push(m);
          phones[m.id] = m.phone || '';
          settings[m.id] = {
            sendText: true,
            sendImage: true,
            sendSchedule: false,
            language: 'urdu'
          };
          
          if (data.tenants && Array.isArray(data.tenants)) {
            data.tenants.forEach(t => {
              const tId = `tenant_${m.id}_${t.tenantCode}`;
              const tEntity = {
                ...t,
                id: tId,
                ownerId: m.id,
                type: 'tenant',
                nameEn: t.tenantNameEn || t.tenantName || 'Tenant',
                nameUr: t.tenantNameUr || ''
              };
              mList.push(tEntity);
              phones[tId] = t.tenantPhone || '';
              settings[tId] = {
                sendText: true,
                sendImage: true,
                sendSchedule: false,
                language: 'urdu'
              };
            });
          }
        });
        
        mList.sort((a, b) => {
          const getOrder = (item) => {
            if (item.turnOrder !== undefined) return item.turnOrder;
            if (item.type === 'tenant') return parseInt(item.tenantCode) || 9999;
            return parseInt(item.userCode) || 9999;
          };
          return getOrder(a) - getOrder(b);
        });

        setMembers(mList);
        setPhoneNumbers(phones);
        setMemberSettings(settings);
      } catch (e) {
        console.error("Error loading data", e);
        showToast("Error loading data", "error");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [showToast]);

  const handlePhoneChange = (id, val) => {
    setPhoneNumbers(prev => ({ ...prev, [id]: val }));
  };

  const handleSavePhone = async (memberId) => {
    try {
      const { db, firebase } = await initFirebaseAsync();
      const newPhone = phoneNumbers[memberId];
      const member = members.find(m => m.id === memberId);
      
      if (!member) {
        showToast("Member not found", "error");
        return;
      }
      
      if (member.type === 'owner') {
        await firebase.setDoc(firebase.doc(db, 'members', memberId), { phone: newPhone }, { merge: true });
      } else if (member.type === 'tenant') {
        const ownerDoc = await firebase.getDoc(firebase.doc(db, 'members', member.ownerId));
        if (ownerDoc.exists()) {
          const data = ownerDoc.data();
          if (data.tenants) {
            const updatedTenants = data.tenants.map(t => {
              if (t.tenantCode === member.tenantCode) {
                return { ...t, tenantPhone: newPhone };
              }
              return t;
            });
            await firebase.setDoc(firebase.doc(db, 'members', member.ownerId), { tenants: updatedTenants }, { merge: true });
          }
        }
      }
      
      showToast("Phone updated!", "success");
    } catch(e) {
      console.error(e);
      showToast("Error saving phone number", "error");
    }
  };

  const toggleSetting = (memberId, key) => {
    setMemberSettings(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [key]: !prev[memberId][key]
      }
    }));
  };

  const setLanguage = (memberId, lang) => {
    setMemberSettings(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        language: lang
      }
    }));
  };

  const generatePayload = async () => {
    setIsGenerating(true);
    setBillingData([]); // clear previous
    
    try {
      const bill = savedBills.find(b => b.id === selectedBillId);
      if (!bill || !bill.billingResult) {
        showToast("Selected bill has no billing data.", "warning");
        setIsGenerating(false);
        return;
      }
      
      const { billingResult } = bill;
      const payload = [];
      let processedCount = 0;
      
      for (const member of members) {
        const settings = memberSettings[member.id];
        if (!settings.sendText && !settings.sendImage && !settings.sendSchedule) continue;
        
        const phone = phoneNumbers[member.id];
        if (!phone || phone.trim() === '') continue;
        
        const breakdown = billingResult.breakdowns.find(b => {
          if (member.type === 'tenant') {
            return b.type === 'tenant' && b.ownerId === member.ownerId && b.code === member.tenantCode;
          }
          return b.id === member.id;
        });
        
        if (!breakdown) continue; // Skip if they aren't part of this bill
        
        let text = '';
        if (settings.sendText) {
          const enrichedMember = { ...member, ...breakdown };
          text = generateWhatsAppText(enrichedMember, billingResult, bill.billingTitle, bill.fixedExpenses, settings.language, members);
        }
        
        let imageBase64 = null;
        if (settings.sendImage) {
          const enrichedMember = { ...member, ...breakdown };
          setCurrentRenderMember({
            member: enrichedMember,
            language: settings.language,
            billingResult: billingResult,
            billTitle: bill.billingTitle
          });
          
          // Wait a moment for React to render the off-screen component
          await new Promise(r => setTimeout(r, 300));
          
          if (offScreenReceiptRef.current) {
            imageBase64 = await toJpeg(offScreenReceiptRef.current, { quality: 0.8, pixelRatio: 1.5 });
          }
        }
        
        // Push Billing Text + Image Payload
        if (text || imageBase64) {
          payload.push({
            phone: formatPhoneForWhatsApp(phone),
            text: text,
            image: imageBase64
          });
        }
        
        // Push Schedule as a completely separate Payload message
        if (settings.sendSchedule) {
          const membersForSchedule = members
            .filter(m => m.type === 'owner')
            .sort((a, b) => {
              const orderA = a.turnOrder !== undefined ? a.turnOrder : parseInt(a.userCode) || 9999;
              const orderB = b.turnOrder !== undefined ? b.turnOrder : parseInt(b.userCode) || 9999;
              return orderA - orderB;
            });
          const scheduleText = generateWhatsAppSchedule(membersForSchedule, settings.language);
          
          payload.push({
            phone: formatPhoneForWhatsApp(phone),
            text: scheduleText,
            image: null
          });
        }
        
        if (text || imageBase64 || settings.sendSchedule) {
          processedCount++;
        }
      }
      
      setBillingData(payload);
      setGeneratedMembersCount(processedCount);
      showToast(`Payload generated for ${processedCount} members. Start the extension!`, "success");
    } catch (e) {
      console.error(e);
      showToast("Error generating payload", "error");
    } finally {
      setCurrentRenderMember(null);
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <SkeletonBulkShare rows={5} />;
  }

  const selectedBill = savedBills.find(b => b.id === selectedBillId);
  const displayMembers = members.filter(member => {
    if (!selectedBill) return true;
    return selectedBill.billingResult.breakdowns.some(b => {
      if (member.type === 'tenant') {
        return b.type === 'tenant' && b.ownerId === member.ownerId && b.code === member.tenantCode;
      }
      return b.id === member.id;
    });
  });

  const isAllTextSelected = displayMembers.length > 0 && displayMembers.every(m => memberSettings[m.id]?.sendText);
  const isAllImageSelected = displayMembers.length > 0 && displayMembers.every(m => memberSettings[m.id]?.sendImage);
  const isAllScheduleSelected = displayMembers.length > 0 && displayMembers.every(m => memberSettings[m.id]?.sendSchedule);

  const toggleAllText = () => {
    const newValue = !isAllTextSelected;
    setMemberSettings(prev => {
      const updated = { ...prev };
      displayMembers.forEach(m => {
        if (updated[m.id]) {
          updated[m.id] = { ...updated[m.id], sendText: newValue };
        }
      });
      return updated;
    });
  };

  const toggleAllImage = () => {
    const newValue = !isAllImageSelected;
    setMemberSettings(prev => {
      const updated = { ...prev };
      displayMembers.forEach(m => {
        if (updated[m.id]) {
          updated[m.id] = { ...updated[m.id], sendImage: newValue };
        }
      });
      return updated;
    });
  };

  const toggleAllSchedule = () => {
    const newValue = !isAllScheduleSelected;
    setMemberSettings(prev => {
      const updated = { ...prev };
      displayMembers.forEach(m => {
        if (updated[m.id]) {
          updated[m.id] = { ...updated[m.id], sendSchedule: newValue };
        }
      });
      return updated;
    });
  };

  return (
    <div className="tab-pane active" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 700 }}>WhatsApp Bulk Sender</h2>

        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Select Generated Bill
          </label>
          <CustomDropdown 
            value={selectedBillId}
            onChange={(val) => setSelectedBillId(val)}
            options={savedBills.map(b => ({
              value: b.id,
              label: `${b.billingTitle} (Total: Rs. ${b.billingResult?.grandTotalBilled?.toLocaleString()})`
            }))}
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-active)', borderBottom: '2px solid var(--border-default)' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>Member</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>Phone Number</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span>Options</span>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', textTransform: 'none', fontWeight: 500 }}>
                        <input 
                          type="checkbox" 
                          checked={isAllTextSelected}
                          onChange={toggleAllText}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        All Text
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', textTransform: 'none', fontWeight: 500 }}>
                        <input 
                          type="checkbox" 
                          checked={isAllImageSelected}
                          onChange={toggleAllImage}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        All Image
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', textTransform: 'none', fontWeight: 500 }}>
                        <input 
                          type="checkbox" 
                          checked={isAllScheduleSelected}
                          onChange={toggleAllSchedule}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        All Schedule
                      </label>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayMembers.map((member) => {
                const isTenant = member.type === 'tenant';
                const safeCode = isTenant ? member.tenantCode : member.userCode;
                return (
                <tr 
                  key={member.id} 
                  style={{ borderBottom: '1px solid var(--border-default)', transition: 'background-color 0.2s ease', cursor: 'default' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ minWidth: '40px', width: '40px', height: '40px', borderRadius: '50%', background: isTenant ? 'var(--warning-light)' : 'var(--primary-light)', color: isTenant ? 'var(--warning-dark)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}>
                        {safeCode}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Outfit', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {member.nameEn || member.name}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 500 }}>{isTenant ? 'Tenant' : 'Owner'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={phoneNumbers[member.id]} 
                        onChange={(e) => handlePhoneChange(member.id, e.target.value)}
                        className="input-field"
                        placeholder="03XXXXXXXXX"
                        style={{ width: '160px', padding: '8px 14px', fontSize: '14px' }}
                      />
                      <button 
                        className="btn-icon" 
                        onClick={() => handleSavePhone(member.id)}
                        title="Save Phone to Database"
                        style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '10px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      >
                        <Save size={18} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={memberSettings[member.id]?.sendText || false} 
                            onChange={() => toggleSetting(member.id, 'sendText')}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          Text
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={memberSettings[member.id]?.sendImage || false} 
                            onChange={() => toggleSetting(member.id, 'sendImage')}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          Image
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={memberSettings[member.id]?.sendSchedule || false} 
                            onChange={() => toggleSetting(member.id, 'sendSchedule')}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          Schedule
                        </label>
                      </div>
                      
                      <div style={{ display: 'flex', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', padding: '3px' }}>
                        <button 
                          onClick={() => setLanguage(member.id, 'urdu')}
                          style={{
                            padding: '4px 14px',
                            fontSize: '14px',
                            fontFamily: "'Noto Nastaliq Urdu', serif",
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            background: memberSettings[member.id]?.language === 'urdu' ? 'var(--bg-surface)' : 'transparent',
                            color: memberSettings[member.id]?.language === 'urdu' ? 'var(--primary)' : 'var(--text-secondary)',
                            borderRadius: '4px',
                            boxShadow: memberSettings[member.id]?.language === 'urdu' ? 'var(--shadow-sm)' : 'none',
                            fontWeight: memberSettings[member.id]?.language === 'urdu' ? 700 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ transform: 'translateY(-4px)' }}>اردو</span>
                        </button>
                        <button 
                          onClick={() => setLanguage(member.id, 'english')}
                          style={{
                            padding: '4px 14px',
                            fontSize: '13px',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            background: memberSettings[member.id]?.language === 'english' ? 'var(--bg-surface)' : 'transparent',
                            color: memberSettings[member.id]?.language === 'english' ? 'var(--primary)' : 'var(--text-secondary)',
                            borderRadius: '4px',
                            boxShadow: memberSettings[member.id]?.language === 'english' ? 'var(--shadow-sm)' : 'none',
                            fontWeight: memberSettings[member.id]?.language === 'english' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          ENG
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="btn-primary" 
          onClick={generatePayload}
          disabled={isGenerating}
          style={{ padding: '12px 24px', fontSize: '15px' }}
        >
          {isGenerating ? 'Generating...' : 'Generate & Prepare Extension Payload'}
        </button>
      </div>

      {billingData.length > 0 && (
        <div className="card" style={{ marginTop: '24px', background: 'var(--success-light)', border: '1px solid #bbf7d0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> Ready to Send!
          </h3>
          <p style={{ margin: 0, color: '#14532d', fontSize: '14px', lineHeight: 1.5 }}>
            Generated data for <strong>{generatedMembersCount}</strong> members. 
            Click the WhatsApp extension icon in your browser toolbar and click <strong>"Start Bulk Send"</strong>.
          </p>
        </div>
      )}

      {/* HIDDEN DATA BRIDGE FOR CHROME EXTENSION */}
      <div 
        id="tubewell-billing-data" 
        data-bills={JSON.stringify(billingData)}
        style={{ display: 'none' }}
      ></div>

      {/* OFF-SCREEN RENDER CONTAINER FOR IMAGES */}
      {currentRenderMember && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <GraphicReceipt 
            ref={offScreenReceiptRef}
            member={currentRenderMember.member}
            billingResult={currentRenderMember.billingResult}
            billTitle={currentRenderMember.billTitle}
            language={currentRenderMember.language}
            // we assume fixedExpenses are global from bill, but GraphicReceipt falls back gracefully
            savedFixedExpenses={savedBills.find(b => b.id === selectedBillId)?.fixedExpenses}
            viewMode="list" 
          />
        </div>
      )}
    </div>
  );
}
