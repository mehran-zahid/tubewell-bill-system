const formatUrduDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date)) return dateString;
  const day = date.getDate();
  const months = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
  return `${day} ${months[date.getMonth()]}`;
};

const formatUrduMonthYear = (title) => {
  if (!title) return '';
  const parts = title.split(' ');
  if (parts.length < 2) return title;
  const monthsMap = {
    'january': 'جنوری', 'february': 'فروری', 'march': 'مارچ', 'april': 'اپریل', 'may': 'مئی', 'june': 'جون', 
    'july': 'جولائی', 'august': 'اگست', 'september': 'ستمبر', 'october': 'اکتوبر', 'november': 'نومبر', 'december': 'دسمبر'
  };
  const urduMonth = monthsMap[parts[0].toLowerCase()] || parts[0];
  return `${urduMonth} ${parts[1]}`;
};

const formatUrduTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parts[1];
  let period = 'صبح';
  if (hours === 12) period = 'دوپہر';
  else if (hours > 12 && hours < 17) period = 'سہ پہر';
  else if (hours >= 17 && hours <= 19) period = 'شام';
  else if (hours > 19 || hours < 4) period = 'رات';
  
  const h12 = hours % 12 || 12;
  return `${period} ${h12.toString().padStart(2, '0')}:${minutes}`;
};

const formatEnglishTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return timeStr;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

export const generateWhatsAppText = (member, billingResult, billTitle, fixedExpenses, language, membersList = []) => {
  if (language === 'urdu') {
    return generateUrduText(member, billingResult, billTitle, fixedExpenses, membersList);
  } else {
    return generateEnglishText(member, billingResult, billTitle, fixedExpenses, membersList);
  }
};

const generateUrduText = (member, billingResult, billTitle, fixedExpenses, membersList) => {
  const urduTitleMonth = formatUrduMonthYear(billTitle);
  
  let text = `ٹربائن کا بل — ${urduTitleMonth}\n`;
  text += `${member.name}\n\n`;
  text += `*کل بل: ${member.totalBill.toLocaleString()} روپے*\n\n`;
  text += `—————————————\n`;
  
  const totalEffectiveHours = member.effectiveHours ? Number(Number(member.effectiveHours).toFixed(2)) : 0;
  let scheduleText = `${totalEffectiveHours} گھنٹے`;
  
  const sourceMember = membersList.find(m => m.id === member.ownerId || m.id === member.id);

  if (sourceMember && sourceMember.startDay) {
    const daysUrdu = {
      'Sunday': 'اتوار', 'Monday': 'پیر', 'Tuesday': 'منگل', 'Wednesday': 'بدھ',
      'Thursday': 'جمعرات', 'Friday': 'جمعہ', 'Saturday': 'ہفتہ'
    };
    const startDayUrdu = daysUrdu[sourceMember.startDay] || sourceMember.startDay;
    const endDayUrdu = daysUrdu[sourceMember.endDay] || sourceMember.endDay || '';
    
    const sTime = formatUrduTime(sourceMember.startTime);
    const eTime = formatUrduTime(sourceMember.endTime);
    
    if (sourceMember.startDay === sourceMember.endDay || !sourceMember.endDay) {
      scheduleText = `${startDayUrdu}، ${sTime} تا ${eTime} (${totalEffectiveHours} گھنٹے)`;
    } else {
      scheduleText = `${startDayUrdu} ${sTime} تا ${endDayUrdu} ${eTime} (${totalEffectiveHours} گھنٹے)`;
    }
  }
  
  text += `باری کا وقت: ${scheduleText}\n`;
  text += `—————————————\n`;
  text += `اخراجات کی معلومات:\n`;
  text += `بجلی کا بل: ${member.usageShare.toLocaleString()} روپے\n`;
  text += `دیگر اخراجات: ${member.fixedShare.toLocaleString()} روپے\n`;
  text += `—————————————\n`;
  
  if (fixedExpenses && fixedExpenses.length > 0) {
    text += `مرمت و دیگر اخراجات میں آپ کے حصے کی تفصیلات:\n`;
    const fraction = billingResult.totalFixedExpenses > 0 ? (member.fixedShare / billingResult.totalFixedExpenses) : 0;
    fixedExpenses.forEach(ex => {
      const myShare = Math.round(parseFloat(ex.amount || 0) * fraction);
      const exTitle = ex.title || 'اخراجات';
      const formattedAmount = /[a-zA-Z]/.test(exTitle) 
        ? `\u200Eروپے\u200E ${myShare.toLocaleString()}` 
        : `${myShare.toLocaleString()} روپے`;
      text += `• ${exTitle} : ${formattedAmount}\n`;
    });
    text += `—————————————\n\n`;
  } else {
    text += `\n`;
  }
  
  text += `میٹر ریڈنگ کی تفصیل:\n\n`;
  
  if (member.memberEntries && member.memberEntries.length > 0) {
    const sortedEntries = [...member.memberEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedEntries.forEach(entry => {
      const uDate = formatUrduDate(entry.date);
      const start = Number(entry.startReading);
      const end = Number(entry.endReading);
      const diff = Number(Math.max(0, (entry.endReading - entry.startReading) / 100).toFixed(2));
      
      text += `${uDate} — (*${diff} گھنٹے*)\n`;
      text += `ریڈنگ: ${end} تا ${start}\n\n`;
    });
  } else {
    text += `کوئی ریڈنگ موجود نہیں\n`;
  }
  
  return text.trimEnd();
};

const generateEnglishText = (member, billingResult, billTitle, fixedExpenses, membersList) => {
  let text = `Tubewell Bill — ${billTitle}\n`;
  text += `${member.name}\n\n`;
  text += `*Total Bill: Rs. ${member.totalBill.toLocaleString()}*\n\n`;
  text += `—————————————\n`;
  
  const totalEffectiveHours = member.effectiveHours ? Number(Number(member.effectiveHours).toFixed(2)) : 0;
  let scheduleText = `${totalEffectiveHours} Hours`;
  
  const sourceMember = membersList.find(m => m.id === member.ownerId || m.id === member.id);
  
  if (sourceMember && sourceMember.startDay) {
    const sTime = formatEnglishTime(sourceMember.startTime);
    const eTime = formatEnglishTime(sourceMember.endTime);
    
    if (sourceMember.startDay === sourceMember.endDay || !sourceMember.endDay) {
      scheduleText = `${sourceMember.startDay}, ${sTime} to ${eTime} (${totalEffectiveHours} Hours)`;
    } else {
      scheduleText = `${sourceMember.startDay} ${sTime} to ${sourceMember.endDay} ${eTime} (${totalEffectiveHours} Hours)`;
    }
  }
  
  text += `Turn Schedule: ${scheduleText}\n`;
  text += `—————————————\n`;
  text += `Expense Details:\n`;
  text += `Electricity Bill: Rs. ${member.usageShare.toLocaleString()}\n`;
  text += `Other Expenses: Rs. ${member.fixedShare.toLocaleString()}\n`;
  text += `—————————————\n`;
  
  if (fixedExpenses && fixedExpenses.length > 0) {
    text += `Your details of Share in Maintenance & Other Expenses:\n`;
    const fraction = billingResult.totalFixedExpenses > 0 ? (member.fixedShare / billingResult.totalFixedExpenses) : 0;
    fixedExpenses.forEach(ex => {
      const myShare = Math.round(parseFloat(ex.amount || 0) * fraction);
      const exTitle = ex.title || 'Expense';
      text += `• ${exTitle} : Rs. ${myShare.toLocaleString()}\n`;
    });
    text += `—————————————\n\n`;
  } else {
    text += `\n`;
  }
  
  text += `Meter Reading Details:\n\n`;
  
  if (member.memberEntries && member.memberEntries.length > 0) {
    const sortedEntries = [...member.memberEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedEntries.forEach(entry => {
      const dateObj = new Date(entry.date);
      const dateStr = !isNaN(dateObj) ? `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'long' })}` : entry.date;
      const start = Number(entry.startReading);
      const end = Number(entry.endReading);
      const diff = Number(Math.max(0, (entry.endReading - entry.startReading) / 100).toFixed(2));
      
      text += `${dateStr} — (*${diff} Hours*)\n`;
      text += `Reading: ${start} to ${end}\n\n`;
    });
  } else {
    text += `No readings found\n`;
  }
  
  return text.trimEnd();
};
