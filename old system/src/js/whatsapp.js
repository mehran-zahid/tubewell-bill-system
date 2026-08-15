/**
 * Turbine Bill Management System - WhatsApp Message Generator
 * Creates clean, formatted WhatsApp messages in Roman Urdu, Urdu Script, or English.
 */

export function generateWhatsAppMessage(calculatedData, formatLang = 'roman') {
  const {
    billingMonthLabel,
    wapdaBill,
    totalFixedExpenses,
    grandTotalBillSystem,
    grandTotalUnits,
    userBreakdowns
  } = calculatedData;

  const dateHeader = billingMonthLabel || 'Current Month';

  if (formatLang === 'urdu') {
    return generateUrduScriptMessage(dateHeader, wapdaBill, totalFixedExpenses, grandTotalBillSystem, grandTotalUnits, userBreakdowns);
  } else if (formatLang === 'english') {
    return generateEnglishMessage(dateHeader, wapdaBill, totalFixedExpenses, grandTotalBillSystem, grandTotalUnits, userBreakdowns);
  }

  // Default: Roman Urdu
  let msg = `⚡ *TURBINE BILL SUMMARY — ${dateHeader.toUpperCase()}* ⚡\n`;
  msg += `====================================\n\n`;
  msg += `📊 *OVERALL TOTALS (کل اخراجات):*\n`;
  msg += `• Total Electricity Units: *${grandTotalUnits.toLocaleString()} Units*\n`;
  msg += `• WAPDA Bijli Bill: *Rs. ${wapdaBill.toLocaleString()}*\n`;
  msg += `• Fixed / Maintenance Expenses: *Rs. ${totalFixedExpenses.toLocaleString()}*\n`;
  msg += `• Total Turbine Bill: *Rs. ${grandTotalBillSystem.toLocaleString()}*\n\n`;
  msg += `------------------------------------\n`;
  msg += `📋 *PER MEMBER BILL BREAKDOWN (تمام ممبران کا بل):*\n`;
  msg += `------------------------------------\n\n`;

  userBreakdowns.forEach((user, index) => {
    const uCode = user.userCode ? ` [${user.userCode}]` : ` [0${index + 1}]`;
    const typeLabel = user.userType === 'external' ? ' (Customer/خریدار)' : ' (Shareholder/شریک مالک)';
    msg += `👤 *${index + 1}.${uCode} ${user.fullName || user.name}${typeLabel}*\n`;
    msg += `   • Usage: ${user.unitsConsumed} Units (${user.unitsPercentage}%)\n`;
    msg += `   • WAPDA Share: Rs. ${user.usageBillShare.toLocaleString()}\n`;
    msg += `   • Fixed Share: Rs. ${user.fixedBillShare.toLocaleString()} ${user.userType === 'external' ? '(N/A)' : `(${user.effectiveHours} hrs)`}\n`;
    msg += `   👉 *TOTAL BILL: Rs. ${user.grandTotalBill.toLocaleString()}*\n`;
    if (user.transferredInCount > 0) {
      msg += `   ℹ️ *(Includes ${user.transferredInCount} transferred turn session(s))*\n`;
    }
    msg += `\n`;
  });

  msg += `------------------------------------\n`;
  msg += `⚠️ *Note:* Meharbani farmakar apna bill waqt par jama karwayen.\n`;
  msg += `Shukriya! 🙏\n`;

  return msg;
}

function generateUrduScriptMessage(dateHeader, wapdaBill, totalFixedExpenses, grandTotalBillSystem, grandTotalUnits, userBreakdowns) {
  let msg = `⚡ *ٹربائن بل خلاصہ — ${dateHeader}* ⚡\n`;
  msg += `====================================\n\n`;
  msg += `📊 *کل اخراجات:* \n`;
  msg += `• کل استعمال شدہ یونٹ: *${grandTotalUnits.toLocaleString()} یونٹ*\n`;
  msg += `• واپڈا بجلی بل: *Rs. ${wapdaBill.toLocaleString()}*\n`;
  msg += `• دیکھ بھال و دیگر اخراجات: *Rs. ${totalFixedExpenses.toLocaleString()}*\n`;
  msg += `• کل رقم: *Rs. ${grandTotalBillSystem.toLocaleString()}*\n\n`;
  msg += `------------------------------------\n`;
  msg += `📋 *ہر ممبر کا واجب الادا بل:* \n`;
  msg += `------------------------------------\n\n`;

  userBreakdowns.forEach((user, index) => {
    const uCode = user.userCode ? ` [${user.userCode}]` : ` [0${index + 1}]`;
    const typeLabel = user.userType === 'external' ? ' (خریدار)' : ' (شریک مالک)';
    msg += `👤 *${index + 1}.${uCode} ${user.fullName || user.name}${typeLabel}*\n`;
    msg += `   • استعمال: ${user.unitsConsumed} یونٹ\n`;
    msg += `   • بجلی بل حصہ: Rs. ${user.usageBillShare.toLocaleString()}\n`;
    msg += `   • فکسڈ اخراجات حصہ: Rs. ${user.fixedBillShare.toLocaleString()} ${user.userType === 'external' ? '(مستثنیٰ)' : `(${user.effectiveHours} گھنٹے)`}\n`;
    msg += `   👉 *کل واجب الادا: Rs. ${user.grandTotalBill.toLocaleString()}*\n\n`;
  });

  msg += `------------------------------------\n`;
  msg += `شکرگزار: ٹربائن انتظامیہ 🙏\n`;

  return msg;
}

function generateEnglishMessage(dateHeader, wapdaBill, totalFixedExpenses, grandTotalBillSystem, grandTotalUnits, userBreakdowns) {
  let msg = `⚡ *TURBINE BILL SUMMARY — ${dateHeader.toUpperCase()}* ⚡\n`;
  msg += `====================================\n\n`;
  msg += `📊 *GRAND TOTALS:*\n`;
  msg += `• Total Electricity Consumed: *${grandTotalUnits.toLocaleString()} Units*\n`;
  msg += `• WAPDA Electricity Bill: *Rs. ${wapdaBill.toLocaleString()}*\n`;
  msg += `• Fixed Maintenance Expenses: *Rs. ${totalFixedExpenses.toLocaleString()}*\n`;
  msg += `• Total Bill Amount: *Rs. ${grandTotalBillSystem.toLocaleString()}*\n\n`;
  msg += `------------------------------------\n`;
  msg += `📋 *INDIVIDUAL MEMBER SHARES:*\n`;
  msg += `------------------------------------\n\n`;

  userBreakdowns.forEach((user, index) => {
    const uCode = user.userCode ? ` [${user.userCode}]` : ` [0${index + 1}]`;
    const typeLabel = user.userType === 'external' ? ' (External Customer)' : ' (Internal Shareholder)';
    msg += `👤 *${index + 1}.${uCode} ${user.fullName || user.name}${typeLabel}*\n`;
    msg += `   • Units Consumed: ${user.unitsConsumed} Units (${user.unitsPercentage}%)\n`;
    msg += `   • WAPDA Share: Rs. ${user.usageBillShare.toLocaleString()}\n`;
    msg += `   • Fixed Maintenance Share: Rs. ${user.fixedBillShare.toLocaleString()} ${user.userType === 'external' ? '(Exempt)' : `(${user.effectiveHours} Hours)`}\n`;
    msg += `   👉 *TOTAL DUE: Rs. ${user.grandTotalBill.toLocaleString()}*\n\n`;
  });

  msg += `------------------------------------\n`;
  msg += `Thank you! Please submit your payment promptly.\n`;

  return msg;
}

export function generateSingleUserWhatsAppMessage(user, dateHeader) {
  const uCode = user.userCode ? ` [${user.userCode}]` : '';
  let msg = `⚡ *TURBINE BILL — ${uCode} ${(user.fullName || user.name).toUpperCase()} (${dateHeader})* ⚡\n\n`;
  msg += `• Units Used: *${user.unitsConsumed} Units*\n`;
  msg += `• WAPDA Electricity Share: *Rs. ${user.usageBillShare.toLocaleString()}*\n`;
  msg += `• Fixed Maintenance Share: *Rs. ${user.fixedBillShare.toLocaleString()}* ${user.userType === 'external' ? '(Exempt/بیرونی خریدار)' : `(${user.effectiveHours} hrs)`}\n`;
  msg += `------------------------------------\n`;
  msg += `💰 *TOTAL AMOUNT DUE: Rs. ${user.grandTotalBill.toLocaleString()}*\n\n`;
  msg += `Meharbani karke bill waqt par ada karein. Shukriya!`;

  return msg;
}

