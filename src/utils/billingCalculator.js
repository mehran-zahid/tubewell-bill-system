// Billing Calculator Utility

export function calculateBilling(members, entries, wapdaBill, fixedExpensesList) {
  const totalWapda = Math.max(0, parseFloat(wapdaBill) || 0);
  const totalFixed = fixedExpensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // 1. Map all members and tenants to a flat structure, calculating their effective hours
  const userStats = new Map();
  let totalEffectiveHours = 0;

  members.forEach(owner => {
    // Owner base hours
    const ownerDuration = (parseFloat(owner.durationHours) || 0) + ((parseFloat(owner.durationMinutes) || 0) / 60);
    
    // Sum leased hours
    let totalLeasedHours = 0;
    if (owner.isLeased && Array.isArray(owner.tenants)) {
      owner.tenants.forEach(tenant => {
        const leased = (parseFloat(tenant.tenantLeasedHours) || 0) + ((parseFloat(tenant.tenantLeasedMinutes) || 0) / 60);
        totalLeasedHours += leased;
        
        const uniqueTenantId = `tenant_${owner.id}_${tenant.id || tenant.tenantCode || Math.random().toString(36).substr(2, 9)}`;
        userStats.set(uniqueTenantId, {
          id: uniqueTenantId,
          code: tenant.tenantCode,
          name: tenant.tenantNameEn,
          type: 'tenant',
          ownerId: owner.id,
          effectiveHours: leased,
          consumedHours: 0,
          memberEntries: []
        });
        totalEffectiveHours += leased;
      });
    }

    // Owner's remaining hours (cannot be negative)
    const ownerEffectiveHours = Math.max(0, ownerDuration - totalLeasedHours);
    userStats.set(owner.id, {
      id: owner.id,
      code: owner.userCode,
      name: owner.nameEn,
      type: 'owner',
      effectiveHours: ownerEffectiveHours,
      consumedHours: 0,
      memberEntries: []
    });
    totalEffectiveHours += ownerEffectiveHours;
  });

  // 2. Aggregate consumed hours from entries (Meter difference / 100 = Hours)
  let totalConsumedHours = 0;
  entries.forEach(entry => {
    // 100 difference = 1 hour
    const rawDiff = Math.max(0, (parseFloat(entry.endReading) || 0) - (parseFloat(entry.startReading) || 0));
    const hoursFromMeter = rawDiff / 100;
    
    // Find who this entry belongs to
    // The entry.memberId could be the exact string ID, or the userCode/tenantCode
    let matchedId = null;
    for (const [id, stats] of userStats.entries()) {
      if (
        id === String(entry.memberId) ||
        String(stats.code) === String(entry.memberId) ||
        (parseInt(stats.code, 10) === parseInt(entry.memberId, 10) && !isNaN(parseInt(stats.code, 10)))
      ) {
        matchedId = id;
        break;
      }
    }

    if (matchedId) {
      const stats = userStats.get(matchedId);
      stats.consumedHours += hoursFromMeter;
      if (!stats.memberEntries) stats.memberEntries = [];
      stats.memberEntries.push(entry);
      totalConsumedHours += hoursFromMeter;
    }
  });

  // 3. Compute Shares
  const breakdowns = [];
  let grandTotalBilled = 0;

  // WAPDA Hourly Rate based purely on total consumed hours from the meter
  const wapdaHourlyRate = totalConsumedHours > 0 ? (totalWapda / totalConsumedHours) : 0;

  for (const [_id, stats] of userStats.entries()) {
    // Usage Bill (WAPDA) based strictly on consumed meter hours * hourly rate
    const usageShare = stats.consumedHours * wapdaHourlyRate;
    
    // Proportional Fixed Maintenance Bill
    const fixedShare = totalEffectiveHours > 0 ? (stats.effectiveHours / totalEffectiveHours) * totalFixed : 0;

    const totalBill = usageShare + fixedShare;
    
    breakdowns.push({
      ...stats,
      usageShare: Math.round(usageShare),
      fixedShare: Math.round(fixedShare),
      totalBill: Math.round(totalBill)
    });

    grandTotalBilled += Math.round(totalBill);
  }

  // Sort by Total Bill (Descending)
  breakdowns.sort((a, b) => b.totalBill - a.totalBill);

  // Total Hourly Rate including fixed expenses
  const totalHourlyRate = totalConsumedHours > 0 ? ((totalWapda + totalFixed) / totalConsumedHours) : 0;

  return {
    wapdaBill: totalWapda,
    totalFixedExpenses: totalFixed,
    grandTotalSystem: totalWapda + totalFixed,
    totalConsumedHours,
    wapdaHourlyRate,
    totalHourlyRate,
    totalEffectiveHours,
    grandTotalBilled,
    breakdowns
  };
}
