const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert time string "HH:MM" to minutes
export function timeToMins(tStr) {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return (h * 60) + (m || 0);
}

// Convert "HH:MM" to "hh:mm AM/PM"
export function format12Hour(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  if (!timeStr.includes(':')) return timeStr; // Return as-is if not in HH:MM format
  
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

// Convert absolute minute offset back to Day and "HH:MM"
export function offsetToDayTime(offsetMins) {
  // Normalize offset to 1 week (10080 minutes)
  const normalized = offsetMins % 10080;
  const dayIndex = Math.floor(normalized / 1440);
  const remainder = normalized % 1440;
  const hours = Math.floor(remainder / 60);
  const mins = remainder % 60;
  
  return {
    day: DAYS_ORDER[dayIndex],
    time: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  };
}

/**
 * Recalculates the start and end times for all members in the array.
 * This function expects the members array to be sorted in the desired chronological order.
 * It mutates the member objects by setting `startDay`, `startTime`, `endDay`, `endTime`.
 * @param {Array} members - The sorted array of member objects.
 * @param {Object} cycleStart - Optional { day, time } to define when the whole cycle starts.
 *                              If not provided, uses the first member's existing start or Sunday 06:00.
 * @returns {Array} The updated members array.
 */
export function autoRechainSchedule(members, cycleStart = null) {
  if (!members || members.length === 0) return members;

  for (let i = 0; i < members.length; i++) {
    const u = members[i];
    const totalMinutes = (Number(u.durationHours || 0) * 60) + Number(u.durationMinutes || 0);

    if (i === 0) {
      // First user: start of the cycle
      u.startDay = cycleStart?.day || u.startDay || 'Sunday';
      u.startTime = cycleStart?.time || u.startTime || '06:00';
      
      const startOffset = (DAYS_ORDER.indexOf(u.startDay) * 1440) + timeToMins(u.startTime);
      const endOffset = startOffset + totalMinutes;
      const { day, time } = offsetToDayTime(endOffset);
      
      u.endDay = day;
      u.endTime = time;
    } else {
      // Chain from previous user
      const prev = members[i - 1];
      u.startDay = prev.endDay;
      u.startTime = prev.endTime;

      const startOffset = (DAYS_ORDER.indexOf(u.startDay) * 1440) + timeToMins(u.startTime);
      const endOffset = startOffset + totalMinutes;
      const { day, time } = offsetToDayTime(endOffset);
      
      u.endDay = day;
      u.endTime = time;
    }
  }

  return members;
}

const DAY_NAMES_URDU = {
  'Sunday': 'اتوار',
  'Monday': 'پیر',
  'Tuesday': 'منگل',
  'Wednesday': 'بدھ',
  'Thursday': 'جمعرات',
  'Friday': 'جمعہ',
  'Saturday': 'ہفتہ'
};

export function formatUrduTime(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  
  let period = '';
  if (h >= 0 && h < 5) period = 'رات';
  else if (h >= 5 && h < 12) period = 'صبح';
  else if (h >= 12 && h < 15) period = 'دوپہر'; 
  else if (h >= 15 && h < 19) period = 'شام'; 
  else period = 'رات'; 
  
  const hour12 = h % 12 || 12;
  return `${hour12}:${mStr} ${period}`;
}

export function generateWhatsAppSchedule(members, language = 'urdu') {
  const isUrdu = language === 'urdu';
  
  let msg = isUrdu 
    ? `ٹیوب ویل باری شیڈول\n\nہفتہ وار ترتیب:\n—————————————\n`
    : `TUBEWELL SCHEDULE\n\nWEEKLY TURN TIME SLOTS:\n-------------\n`;

  members.forEach((u, idx) => {
    const biliName = isUrdu ? (u.nameUr || u.nameEn) : u.nameEn;
    
    const startDay = isUrdu ? (DAY_NAMES_URDU[u.startDay] || u.startDay) : u.startDay;
    const endDay = isUrdu ? (DAY_NAMES_URDU[u.endDay] || u.endDay) : u.endDay;

    const h = parseInt(u.durationHours, 10) || 0;
    const m = parseInt(u.durationMinutes, 10) || 0;
    
    const durationStr = isUrdu
      ? (m > 0 ? `${h} گھنٹے ${m} منٹ` : `${h} گھنٹے`)
      : (m > 0 ? `${h}h ${m}m` : `${h}h`);

    msg += isUrdu
      ? `${idx + 1}. ${biliName} (کوڈ: ${u.userCode})\n`
      : `${idx + 1}. ${biliName} (Code: ${u.userCode})\n`;
      
    msg += isUrdu 
      ? `   ${startDay} ${formatUrduTime(u.startTime)} – ${endDay} ${formatUrduTime(u.endTime)} (${durationStr})\n`
      : `   ${startDay} ${format12Hour(u.startTime)} – ${endDay} ${format12Hour(u.endTime)} (${durationStr})\n`;

    msg += `\n`;
  });

  if (isUrdu) {
    msg += `—————————————\n`;
    msg += `نوٹ: مہربانی فرما کر اپنی باری پر وقت کی پابندی کریں۔\n`;
    msg += `ٹیوب ویل انتظامیہ\n`;
  } else {
    msg += `-------------\n`;
    msg += `Note: Please strictly follow your scheduled turn times.\n`;
    msg += `Tubewell Management\n`;
  }

  return msg;
}
