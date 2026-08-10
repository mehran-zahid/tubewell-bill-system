/**
 * Tubewell Bill Management System - Calculation Engine
 * Implements strict proportional math rules according to specification.
 */

export function calculateBilling(users, entries, expenses) {
  const wapdaBill = Math.max(0, parseFloat(expenses.wapdaBill) || 0);
  const fixedExpensesList = Array.isArray(expenses.fixedExpenses) ? expenses.fixedExpenses : [];
  const totalFixedExpenses = fixedExpensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // 1. Calculate per-user effective hours
  let totalEffectiveHours = 0;
  const userHoursMap = new Map();

  users.forEach(user => {
    const effectiveHours = (user.overrideHours !== null && user.overrideHours !== undefined) 
      ? Math.max(0, parseFloat(user.overrideHours) || 0)
      : Math.max(0, parseFloat(user.assignedWeeklyHours) || 0);
    
    userHoursMap.set(user.id, effectiveHours);
    totalEffectiveHours += effectiveHours;
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

    // Determine who gets billed for this session
    // Rule: If transferToUserId is set to a valid registered user, bill goes to transferToUserId
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
    const units = userUnitsMap.get(user.id) || 0;
    const hours = userHoursMap.get(user.id) || 0;
    const sessions = userSessionsCountMap.get(user.id) || 0;
    const transferredIn = userTransferredInCountMap.get(user.id) || 0;
    const transferredOut = userTransferredOutCountMap.get(user.id) || 0;

    // Proportional Usage Bill
    const unitsPercentage = grandTotalUnits > 0 ? (units / grandTotalUnits) * 100 : 0;
    const usageBillShare = grandTotalUnits > 0 ? (units / grandTotalUnits) * wapdaBill : 0;

    // Proportional Fixed Bill
    const hoursPercentage = totalEffectiveHours > 0 ? (hours / totalEffectiveHours) * 100 : 0;
    const fixedBillShare = totalEffectiveHours > 0 ? (hours / totalEffectiveHours) * totalFixedExpenses : 0;

    // Total Bill
    const grandTotalBill = usageBillShare + fixedBillShare;

    return {
      userId: user.id,
      name: user.name,
      code: user.code || '',
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
    totalEffectiveHours,
    grandTotalBilledAmount,
    userBreakdowns
  };
}
