import React, { useState, useRef, useEffect } from 'react';
import { Camera, UploadCloud, Loader2, FileText, CheckCircle2, AlertTriangle, Save, Trash2, X, Plus, ImagePlus } from 'lucide-react';
import { extractRegisterData } from '../services/ocrService';
import { addRegisterEntries } from '../services/registerService';
import { useToast } from '../context/ToastContext';
import { initFirebaseAsync } from '../config/firebase';
import { useOCR } from '../context/OCRContext';
import CustomDropdown from '../components/CustomDropdown';
import ConfirmModal from '../components/ConfirmModal';

export default function OCRTab() {
  const { showToast } = useToast();
  const { images, setImages, extractedData, setExtractedData, scanError, setScanError, clearOCRState } = useOCR();
  const [isProcessing, setIsProcessing] = useState(false);
  const [members, setMembers] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const { db, firebase } = await initFirebaseAsync();
        const membersSnapshot = await firebase.getDocs(firebase.collection(db, 'members'));
        const membersData = [];
        membersSnapshot.forEach(doc => {
          const m = { id: doc.id, ...doc.data() };
          membersData.push(m);
          if (m.tenants && Array.isArray(m.tenants)) {
            m.tenants.forEach(t => {
              if (t.tenantCode) {
                membersData.push({
                  id: `tenant_${doc.id}_${t.tenantCode}`,
                  userCode: t.tenantCode.toString(),
                  nameEn: t.tenantNameEn || `Tenant ${t.tenantCode}`,
                  isTenant: true,
                  ownerId: doc.id
                });
              }
            });
          }
        });
        // Inject the System Adjustment Member
        membersData.push({
          id: '404',
          userCode: '404',
          nameEn: 'Faulty Meter / Adjustment',
          isSystem: true
        });

        // Sort members alphabetically, but keep the System member at the top
        membersData.sort((a, b) => {
          if (a.isSystem) return -1;
          if (b.isSystem) return 1;
          return a.nameEn.localeCompare(b.nameEn);
        });

        setMembers(membersData);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };
    loadMembers();
  }, []);

  const resizeImage = (file, maxWidth = 1500, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      showToast('Please select valid image files', 'error');
      return;
    }

    // Filter out duplicates
    const uniqueFiles = imageFiles.filter(file => {
      // Check if we already have this file by name and size
      // Alternatively we can use file.lastModified, but name + size is usually enough for local UI checks
      const isDuplicate = images.some(existing => existing.name === file.name && existing.size === file.size);
      if (isDuplicate) {
        showToast(`Skipped duplicate: ${file.name}`, 'warning');
      }
      return !isDuplicate;
    });

    if (uniqueFiles.length === 0) return;

    let filesToProcess = uniqueFiles;
    if (images.length + uniqueFiles.length > 8) {
      showToast('Maximum 8 images allowed. Only adding what fits.', 'warning');
      const spaceLeft = Math.max(0, 8 - images.length);
      filesToProcess = uniqueFiles.slice(0, spaceLeft);
      if (filesToProcess.length === 0) return;
    }

    // Set processing state early so user knows we are working on it
    setIsProcessing(true);

    const newImages = await Promise.all(filesToProcess.map(file => {
      return new Promise(async (resolve) => {
        try {
          const compressedDataUrl = await resizeImage(file);
          resolve({
            preview: compressedDataUrl,
            base64Data: compressedDataUrl,
            name: file.name,
            size: file.size
          });
        } catch (e) {
          console.error('Error resizing image', e);
          // Fallback to original
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              preview: e.target.result,
              base64Data: e.target.result,
              name: file.name,
              size: file.size
            });
          };
          reader.readAsDataURL(file);
        }
      });
    }));

    setImages(prev => [...prev, ...newImages]);
    setScanError(null);
    setIsProcessing(false);
  };

  const handleFileChange = (e) => {
    handleFiles(Array.from(e.target.files || []));
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleRemoveImage = (e, index) => {
    e.stopPropagation();
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleScan = async () => {
    const unprocessedImages = images.filter(img => !img.processed);

    if (images.length === 0) {
      showToast('Please select at least one image first', 'warning');
      return;
    }
    if (unprocessedImages.length === 0) {
      showToast('All images have already been extracted.', 'info');
      return;
    }

    setIsProcessing(true);
    setScanProgress({ current: 0, total: unprocessedImages.length });
    setScanError(null);
    try {
      const base64Array = unprocessedImages.map(img => img.base64Data);
      const data = await extractRegisterData(base64Array, (current, total) => {
        setScanProgress({ current, total });
      });
      
      const startIndex = extractedData ? extractedData.length : 0;
      
      const mappedData = data.map((row, idx) => {
        let formattedDate = row.date;
        if (formattedDate) {
          const match = formattedDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (match) {
            const d = match[1].padStart(2, '0');
            const m = match[2].padStart(2, '0');
            const y = match[3];
            formattedDate = `${y}-${m}-${d}`;
          }
        }
        return {
          id: `ocr_row_${startIndex + idx}_${Date.now()}`,
          ...row,
          date: formattedDate
        };
      });
      
      setExtractedData(prev => {
        // Strip out any previously auto-generated gaps so we can recalculate from a clean slate
        const previousCleanData = prev ? prev.filter(row => !row.isAutoGenerated) : [];
        const combined = [...previousCleanData, ...mappedData];
        
        const sortedData = [...combined].sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          const dateDiff = dateA.localeCompare(dateB);
          if (dateDiff !== 0) return dateDiff;
          const startA = parseFloat(a.startReading) || 0;
          const startB = parseFloat(b.startReading) || 0;
          return startA - startB;
        });

        const finalData = [];
        for (let i = 0; i < sortedData.length; i++) {
          const currentRow = sortedData[i];
          if (finalData.length > 0) {
            const prevRow = finalData[finalData.length - 1];
            const prevEnd = parseFloat(prevRow.endReading);
            const currStart = parseFloat(currentRow.startReading);
            
            if (!isNaN(prevEnd) && !isNaN(currStart) && currStart > prevEnd) {
              finalData.push({
                id: `auto_gap_${Date.now()}_${i}`,
                date: currentRow.date || prevRow.date,
                memberId: '404',
                startReading: prevEnd,
                endReading: currStart,
                isAutoGenerated: true
              });
            }
          }
          finalData.push(currentRow);
        }
        return finalData;
      });
      
      setImages(prev => prev.map(img => 
        unprocessedImages.some(ui => ui.name === img.name && ui.size === img.size) 
          ? { ...img, processed: true } 
          : img
      ));
      
      showToast(`Successfully extracted ${mappedData.length} new entries.`, 'success');
    } catch (error) {
      console.error('Scan Error:', error);
      const errMsg = error.message || 'Unknown error';
      setScanError(errMsg);
      showToast(`Failed to extract data`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCellChange = (id, field, value) => {
    setExtractedData(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleRemoveRow = (id) => {
    setExtractedData(prev => prev.filter(row => row.id !== id));
  };

  const handleSave = async () => {
    if (!extractedData || extractedData.length === 0) {
      showToast('No data to save', 'warning');
      return;
    }

    const invalidRows = extractedData.filter(row => {
      const start = parseFloat(row.startReading);
      const end = parseFloat(row.endReading);
      return !row.date || !row.memberId || isNaN(start) || isNaN(end) || start > end;
    });

    if (invalidRows.length > 0) {
      showToast('Please fix errors in the extracted data before saving.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const entriesToSave = extractedData.map(row => {
        return {
          memberId: row.memberId,
          date: row.date,
          startReading: row.startReading,
          endReading: row.endReading
        };
      });

      await addRegisterEntries(entriesToSave);
      showToast(`Successfully saved ${entriesToSave.length} records!`, 'success');
      
      setExtractedData(null);
      setImages([]);
    } catch (error) {
      console.error('Error saving records:', error);
      showToast('Failed to save records', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getMemberDetails = (idStr) => {
    if (!idStr) return null;
    const num = Number(idStr);
    const paddedCode = String(isNaN(num) ? idStr : num).padStart(2, '0');
    return members.find(m => m.userCode === paddedCode || m.userCode === idStr || m.id === idStr);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Scan Register
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="card">
            <h2 style={{ fontFamily: 'Outfit', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={20} style={{ color: 'var(--primary)' }} /> Image Capture
            </h2>
            
            <div 
              className={`dropzone ${isDragging ? 'active' : ''} ${images.length > 0 ? 'has-image' : ''}`}
              onClick={() => !isProcessing && images.length === 0 && fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input 
                type="file" 
                multiple
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={isProcessing}
              />
              
              {isProcessing ? (
                <div className="loading-overlay" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div className="loading-spinner-wrapper" style={{ marginBottom: '24px' }}>
                    <Loader2 className="spinner" size={48} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Processing Images
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Extracting meter readings using AI...
                  </p>
                  
                  <div className="progress-bar-container" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-default)' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        height: '8px', 
                        background: 'linear-gradient(90deg, var(--primary), var(--primary-light))', 
                        borderRadius: '4px', 
                        width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%`,
                        transition: 'width 0.4s ease-out'
                      }}
                    ></div>
                  </div>
                  
                  <div style={{ marginTop: '16px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {scanProgress.current > 0 ? (
                      <span>Image {scanProgress.current} of {scanProgress.total}</span>
                    ) : (
                      <span>Initializing...</span>
                    )}
                  </div>
                </div>
              ) : images.length > 0 ? (
                <div className="upload-preview" onClick={(e) => e.stopPropagation()}>
                  <div className="image-grid">
                    {images.map((img, i) => (
                      <div key={i} className="preview-container">
                        <img src={img.preview} alt={`Register Preview ${i + 1}`} />
                        <button 
                          className="remove-image-btn"
                          onClick={(e) => handleRemoveImage(e, i)}
                          title="Remove image"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div 
                      className="preview-container add-more" 
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        border: '2px dashed var(--border-default)', 
                        borderRadius: '12px', 
                        cursor: 'pointer', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        minHeight: '120px' 
                      }}
                    >
                        <Plus size={24} color="var(--text-secondary)" />
                        <span style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Add more</span>
                    </div>
                  </div>
                  <div className="dropzone-hint">
                    <ImagePlus size={16} /> Selected {images.length} image{images.length > 1 ? 's' : ''}. Use 'Add more' to append.
                  </div>
                </div>
              ) : (
                <div className="dropzone-empty">
                  <div className="dropzone-icon-wrapper">
                    <ImagePlus size={28} strokeWidth={2} />
                  </div>
                  <p className="dropzone-title">Drop your images here</p>
                  <p className="dropzone-subtitle">or click to browse from your device</p>
                </div>
              )}
            </div>

            {images.length > 0 && (
              <button 
                className="btn btn-primary" 
                onClick={handleScan}
                disabled={isProcessing || images.filter(img => !img.processed).length === 0}
                style={{ width: '100%', marginTop: '20px', padding: '14px', fontSize: '16px' }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="spinner" size={20} />
                    Extracting... ({scanProgress.current}/{scanProgress.total})
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    {images.filter(img => !img.processed).length === 0 
                      ? 'All Images Processed' 
                      : `Extract Data from ${images.filter(img => !img.processed).length} Image${images.filter(img => !img.processed).length > 1 ? 's' : ''}`}
                  </>
                )}
              </button>
            )}

            {scanError && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '4px' }}>
                  <AlertTriangle size={18} /> Extraction Failed
                </div>
                <div style={{ fontSize: '14px', wordBreak: 'break-word', lineHeight: '1.5' }}>
                  {scanError}
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    (The AI model might be temporarily overloaded. Please wait a few seconds and try clicking 'Extract Data' again.)
                  </div>
                </div>
              </div>
            )}
          </div>

          {extractedData && (
            <div className="card results-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--success-light)' }}>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '16px', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <CheckCircle2 size={20} />
                  Extraction Results ({extractedData.length} entries)
                </h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => setIsClearModalOpen(true)}
                    className="btn btn-secondary ocr-action-btn"
                    disabled={isSaving}
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={handleSave}
                    className="btn btn-primary ocr-action-btn"
                    style={{ background: 'var(--success)', border: 'none', color: 'white' }}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <><Loader2 className="spinner" size={16} /> Saving...</>
                    ) : (
                      <><Save size={16} /> Approve & Save</>
                    )}
                  </button>
                </div>
              </div>

              <div className="desktop-table-view" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase' }}>Member</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase' }}>Start</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase' }}>End</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase', width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.map((row, index) => {
                      const start = parseFloat(row.startReading);
                      const end = parseFloat(row.endReading);
                      const hasReadingError = !isNaN(start) && !isNaN(end) && start > end;
                      const isContinuation = index > 0 && 
                                            !isNaN(start) && 
                                            !isNaN(parseFloat(extractedData[index - 1].endReading)) &&
                                            start === parseFloat(extractedData[index - 1].endReading);
                      const mem = getMemberDetails(row.memberId);
                      
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border-default)', background: hasReadingError ? 'var(--danger-light)' : row.isAutoGenerated ? 'var(--warning-light)' : 'transparent' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <input 
                              type="date"
                              value={row.date || ''}
                              onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                              className="input-field"
                              style={{ padding: '8px', minWidth: '130px', borderColor: !row.date ? 'var(--danger)' : 'var(--border-default)' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <CustomDropdown 
                              value={mem ? mem.id : row.memberId || ''} 
                              onChange={(val) => handleCellChange(row.id, 'memberId', val)} 
                              options={[
                                { value: '', label: 'Select Member' },
                                ...members.map(m => ({ value: m.id, label: `${m.nameEn} - ${m.userCode}` }))
                              ]}
                              style={{ minWidth: '180px' }}
                              error={!mem}
                            />
                            {!mem && row.memberId && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>Extracted: "{row.memberId}"</div>}
                            {row.isAutoGenerated && (
                              <div style={{ fontSize: '11px', color: 'var(--warning-dark)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Auto-inserted to bridge missing units">
                                <AlertTriangle size={12} strokeWidth={2.5} />
                                <span>Auto-generated Gap Fix</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input 
                              type="text"
                              inputMode="decimal"
                              value={row.startReading ?? ''}
                              onChange={(e) => handleCellChange(row.id, 'startReading', e.target.value)}
                              className="input-field"
                              style={{ padding: '8px', width: '90px', textAlign: 'center', borderColor: hasReadingError ? 'var(--danger)' : 'var(--border-default)' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                              <input 
                                type="text"
                                inputMode="decimal"
                                value={row.endReading ?? ''}
                                onChange={(e) => handleCellChange(row.id, 'endReading', e.target.value)}
                                className="input-field"
                                style={{ padding: '8px', width: '90px', textAlign: 'center', borderColor: hasReadingError ? 'var(--danger)' : 'var(--border-default)' }}
                              />
                              {isContinuation && (
                                <div style={{ position: 'absolute', right: '-24px', color: 'var(--success)', display: 'flex' }} title="Continuous reading (Matches previous row)">
                                  <CheckCircle2 size={16} strokeWidth={2.5} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button onClick={() => handleRemoveRow(row.id)} className="btn-icon btn-icon-danger">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mobile-list-view" style={{ padding: '16px', gap: '16px' }}>
                {extractedData.map((row, index) => {
                  const start = parseFloat(row.startReading);
                  const end = parseFloat(row.endReading);
                  const hasReadingError = !isNaN(start) && !isNaN(end) && start > end;
                  const isContinuation = index > 0 && 
                                        !isNaN(start) && 
                                        !isNaN(parseFloat(extractedData[index - 1].endReading)) &&
                                        start === parseFloat(extractedData[index - 1].endReading);
                  const mem = getMemberDetails(row.memberId);

                  return (
                    <div key={row.id} className="mobile-entry-card" style={{ borderColor: hasReadingError ? 'var(--danger)' : 'var(--border-default)', background: hasReadingError ? 'var(--danger-light)' : row.isAutoGenerated ? 'var(--warning-light)' : 'var(--bg-surface)' }}>
                      <div className="mobile-entry-header" style={{ borderBottom: 'none', paddingBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Row #{index + 1}</span>
                        <button onClick={() => handleRemoveRow(row.id)} className="btn-icon btn-icon-danger" style={{ padding: '4px' }}>
                          <X size={16} />
                        </button>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Member</label>
                          <CustomDropdown 
                            value={mem ? mem.id : row.memberId || ''} 
                            onChange={(val) => handleCellChange(row.id, 'memberId', val)} 
                            options={[
                              { value: '', label: 'Select Member' },
                              ...members.map(m => ({ value: m.id, label: `${m.nameEn} - ${m.userCode}` }))
                            ]}
                            style={{ width: '100%' }}
                            error={!mem}
                          />
                          {row.isAutoGenerated && (
                            <div style={{ fontSize: '11px', color: 'var(--warning-dark)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} strokeWidth={2.5} />
                              <span>Auto-generated Gap Fix</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date</label>
                          <input 
                            type="date"
                            value={row.date || ''}
                            onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                            className="input-field"
                            style={{ padding: '8px', borderColor: !row.date ? 'var(--danger)' : 'var(--border-default)' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Start Reading</label>
                            <input 
                              type="text"
                              inputMode="decimal"
                              value={row.startReading ?? ''}
                              onChange={(e) => handleCellChange(row.id, 'startReading', e.target.value)}
                              className="input-field"
                              style={{ padding: '8px', borderColor: hasReadingError ? 'var(--danger)' : 'var(--border-default)' }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>End Reading</label>
                            <input 
                              type="text"
                              inputMode="decimal"
                              value={row.endReading ?? ''}
                              onChange={(e) => handleCellChange(row.id, 'endReading', e.target.value)}
                              className="input-field"
                              style={{ padding: '8px', borderColor: hasReadingError ? 'var(--danger)' : 'var(--border-default)' }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {hasReadingError && (
                        <div style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <AlertTriangle size={14} /> Start reading &gt; End reading
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Clear Extraction Results"
        message="Are you sure you want to clear all extracted data? This action cannot be undone."
        onConfirm={() => {
          clearOCRState();
          setIsClearModalOpen(false);
        }}
        onCancel={() => setIsClearModalOpen(false)}
        confirmText="Clear All"
      />
    </div>
  );
}
