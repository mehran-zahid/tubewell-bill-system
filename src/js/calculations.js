/**
 * Turbine Bill Management System - Calculation Engine
 * Implements strict proportional math rules according to specification.
 */

export function calculateBilling(users, entries, expenses) {
  const wapdaBill = Math.max(0, parseFloat(expenses.wapdaBill) || 0);
  const fixedExpensesList = Array.isArray(expenses.fixedExpenses) ? expenses.fixedExpenses : [];
  const totalFixedExpenses = fixedExpensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // Separate internal members vs external buyers
  // Default userType is 'internal' if not specified
  const internalUsers = users.filter(u => u.userType !== 'external');

  // 1. Calculate per-user effective hours for internal members
  let totalInternalEffectiveHours = 0;
  const userHoursMap = new Map();

  users.forEach(user => {
    const isInternal = user.userType !== 'external';
    const effectiveHours = (user.overrideHours !== null && user.overrideHours !== undefined) 
      ? Math.max(0, parseFloat(user.overrideHours) || 0)
      : Math.max(0, parseFloat(user.totalMinutes ? (user.totalMinutes / 60) : user.assignedWeeklyHours) || 0);
    
    userHoursMap.set(user.id, effectiveHours);
    if (isInternal) {
      totalInternalEffectiveHours += effectiveHours;
    }
  });

  // 2. Calculate per-user units consumed (handling Bari transfers)
  const userUnitsMap = new Map();
  const userSessionsCountMap = new Map();
  const userTransferredInCountMap = new Map();
  const userTransferredOutCountMap = new Map();

  users.forEach(user => {
    userUnitsMap.set(user.id, 0);
    userSessionsCountMap.set(user.id, 0);
    userTransferredInCountMap.set(user.id, 0);
    userTransferredOutCountMap.set(user.id, 0);
  });

  let grandTotalUnits = 0;

  entries.forEach(entry => {
    const start = parseFloat(entry.startReading) || 0;
    const end = parseFloat(entry.endReading) || 0;
    const units = Math.max(0, end - start);

    const originalUserId = entry.userId;
    const transferUserId = entry.transferToUserId;

    let billedUserId = originalUserId;
    if (transferUserId && users.some(u => u.id === transferUserId)) {
      billedUserId = transferUserId;
      if (originalUserId && originalUserId !== transferUserId) {
        userTransferredOutCountMap.set(originalUserId, (userTransferredOutCountMap.get(originalUserId) || 0) + 1);
        userTransferredInCountMap.set(transferUserId, (userTransferredInCountMap.get(transferUserId) || 0) + 1);
      }
    }

    if (billedUserId && userUnitsMap.has(billedUserId)) {
      userUnitsMap.set(billedUserId, userUnitsMap.get(billedUserId) + units);
      userSessionsCountMap.set(billedUserId, userSessionsCountMap.get(billedUserId) + 1);
      grandTotalUnits += units;
    }
  });

  // 3. Compute final per-user bill shares
  const userBreakdowns = users.map(user => {
    const isInternal = user.userType !== 'external';
    const units = userUnitsMap.get(user.id) || 0;
    const hours = userHoursMap.get(user.id) || 0;
    const sessions = userSessionsCountMap.get(user.id) || 0;
    const transferredIn = userTransferredInCountMap.get(user.id) || 0;
    const transferredOut = userTransferredOutCountMap.get(user.id) || 0;

    // Proportional Usage Bill (WAPDA electricity) for ALL users
    const unitsPercentage = grandTotalUnits > 0 ? (units / grandTotalUnits) * 100 : 0;
    const usageBillShare = grandTotalUnits > 0 ? (units / grandTotalUnits) * wapdaBill : 0;

    // Proportional Fixed Maintenance Bill ONLY for internal members
    let hoursPercentage = 0;
    let fixedBillShare = 0;

    if (isInternal) {
      hoursPercentage = totalInternalEffectiveHours > 0 ? (hours / totalInternalEffectiveHours) * 100 : 0;
      fixedBillShare = totalInternalEffectiveHours > 0 ? (hours / totalInternalEffectiveHours) * totalFixedExpenses : 0;
    }

    // Total Bill
    const grandTotalBill = usageBillShare + fixedBillShare;

    const uCode = user.userCode || user.code || '01';
    const uNameEn = user.nameEn || user.name || '';
    const uNameUr = user.nameUr || '';
    let fullName = uNameEn && uNameUr ? `${uNameEn} (${uNameUr})` : (user.name || uNameEn || uNameUr || 'Member');

    return {
      userId: user.id,
      userCode: uCode,
      nameEn: uNameEn,
      nameUr: uNameUr,
      fullName: fullName,
      userType: user.userType || 'internal',
      assignedWeeklyHours: user.assignedWeeklyHours,
      overrideHours: user.overrideHours,
      effectiveHours: hours,
      hoursPercentage: Math.round(hoursPercentage * 10) / 10,
      unitsConsumed: units,
      unitsPercentage: Math.round(unitsPercentage * 10) / 10,
      sessionsCount: sessions,
      transferredInCount: transferredIn,
      transferredOutCount: transferredOut,
      usageBillShare: Math.round(usageBillShare),
      fixedBillShare: Math.round(fixedBillShare),
      grandTotalBill: Math.round(grandTotalBill)
    };
  });

  // Sort breakdown by Grand Total descending
  userBreakdowns.sort((a, b) => b.grandTotalBill - a.grandTotalBill);

  const grandTotalBilledAmount = userBreakdowns.reduce((sum, u) => sum + u.grandTotalBill, 0);

  return {
    billingMonthLabel: expenses.billingMonthLabel || 'Current Month',
    wapdaBill,
    totalFixedExpenses,
    fixedExpensesList,
    grandTotalBillSystem: wapdaBill + totalFixedExpenses,
    grandTotalUnits,
    totalEffectiveHours: totalInternalEffectiveHours,
    grandTotalBilledAmount,
    userBreakdowns
  };
}

