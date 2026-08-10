export const defaultUsers = [
  { id: 'usr-1', name: 'Ali Khan', code: 'AK01', assignedWeeklyHours: 12, overrideHours: null },
  { id: 'usr-2', name: 'Chaudhry Ahmad', code: 'CA02', assignedWeeklyHours: 18, overrideHours: null },
  { id: 'usr-3', name: 'Muhammad Tariq', code: 'MT03', assignedWeeklyHours: 6, overrideHours: null },
  { id: 'usr-4', name: 'Haji Rashid', code: 'HR04', assignedWeeklyHours: 12, overrideHours: null },
  { id: 'usr-5', name: 'Bilal Hussain', code: 'BH05', assignedWeeklyHours: 24, overrideHours: null }
];

export const defaultEntries = [
  {
    id: 'ent-1',
    date: '2026-08-01',
    userId: 'usr-1', // Ali Khan
    startReading: 12450,
    endReading: 12495,
    transferToUserId: null,
    confidence: 'high',
    confidenceScore: 0.98,
    notes: 'Normal session'
  },
  {
    id: 'ent-2',
    date: '2026-08-03',
    userId: 'usr-2', // Chaudhry Ahmad
    startReading: 12495,
    endReading: 12580,
    transferToUserId: null,
    confidence: 'high',
    confidenceScore: 0.95,
    notes: 'Paddy field watering'
  },
  {
    id: 'ent-3',
    date: '2026-08-06',
    userId: 'usr-1', // Ali Khan turn
    startReading: 12580,
    endReading: 12620,
    transferToUserId: 'usr-3', // Transferred to Muhammad Tariq!
    confidence: 'medium',
    confidenceScore: 0.82,
    notes: 'Bari transferred to M. Tariq'
  },
  {
    id: 'ent-4',
    date: '2026-08-10',
    userId: 'usr-4', // Haji Rashid
    startReading: 12620,
    endReading: 12675,
    transferToUserId: null,
    confidence: 'high',
    confidenceScore: 0.96,
    notes: 'Wheat crop preparation'
  },
  {
    id: 'ent-5',
    date: '2026-08-14',
    userId: 'usr-5', // Bilal Hussain
    startReading: 12675,
    endReading: 12795,
    transferToUserId: null,
    confidence: 'high',
    confidenceScore: 0.99,
    notes: 'Long session'
  },
  {
    id: 'ent-6',
    date: '2026-08-18',
    userId: 'usr-2', // Chaudhry Ahmad
    startReading: 12795,
    endReading: 12860,
    transferToUserId: null,
    confidence: 'low',
    confidenceScore: 0.65,
    notes: 'Handwriting was slightly smudged'
  }
];

export const defaultExpenses = {
  billingMonth: '2026-08',
  billingMonthLabel: 'August 2026',
  wapdaBill: 38500,
  fixedExpenses: [
    { id: 'fix-1', description: 'Motor Rewinding & Bearing Service', amount: 6500 },
    { id: 'fix-2', description: 'Transformer Maintenance & Oil Fund', amount: 3500 },
    { id: 'fix-3', description: 'Greasing & Gland Packing', amount: 1000 }
  ]
};

export const sampleRegisterImageBase64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%23fdfbf7"/><path d="M0,40 L600,40 M0,80 L600,80 M0,120 L600,120 M0,160 L600,160 M0,200 L600,200 M0,240 L600,240 M0,280 L600,280 M0,320 L600,320 M0,360 L600,360" stroke="%23cbd5e1" stroke-width="1"/><line x1="120" y1="0" x2="120" y2="400" stroke="%23f87171" stroke-width="2"/><text x="150" y="30" font-family="serif" font-size="18" fill="%231e293b" font-weight="bold">ٹیوب ویل رجسٹر - اگست 2026</text><text x="450" y="70" font-family="sans-serif" font-size="14" fill="%23334155">علی خان (AK01) | 01-08 | 12450 - 12495</text><text x="450" y="110" font-family="sans-serif" font-size="14" fill="%23334155">چوہدری احمد (CA02) | 03-08 | 12495 - 12580</text><text x="450" y="150" font-family="sans-serif" font-size="14" fill="%23334155">علی خان (بری -> طارق) | 06-08 | 12580 - 12620</text><text x="450" y="190" font-family="sans-serif" font-size="14" fill="%23334155">حاجی راشد (HR04) | 10-08 | 12620 - 12675</text><text x="450" y="230" font-family="sans-serif" font-size="14" fill="%23334155">بلال حسین (BH05) | 14-08 | 12675 - 12795</text><text x="450" y="270" font-family="sans-serif" font-size="14" fill="%23334155">چوہدری احمد (CA02) | 18-08 | 12795 - 12860</text></svg>`;
