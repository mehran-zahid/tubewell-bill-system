const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert time string "HH:MM" to minutes
export function timeToMins(tStr) {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return (h * 60) + (m || 0);
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
