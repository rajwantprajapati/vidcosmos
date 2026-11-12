// India Standard Time helpers. Usage limits reset on IST calendar boundaries (DB §4), whatever
// the user's own time zone. IST is UTC+5:30 all year (no daylight saving).

const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** The IST calendar month and day of an instant, and when that month started (in UTC). */
export function istPeriod(now: Date): { periodKey: string; periodStart: Date; dayKey: string } {
  const ist = new Date(now.getTime() + istOffsetMs);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  return {
    periodKey: `${year}-${pad(month + 1)}`,
    periodStart: new Date(Date.UTC(year, month, 1) - istOffsetMs),
    dayKey: `${year}-${pad(month + 1)}-${pad(ist.getUTCDate())}`,
  };
}

/** The first instant of the next IST month: when the monthly video count resets. */
export function nextIstMonthStart(now: Date): Date {
  const ist = new Date(now.getTime() + istOffsetMs);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - istOffsetMs);
}

/** The next IST midnight: when the daily export count resets. */
export function nextIstMidnight(now: Date): Date {
  const ist = new Date(now.getTime() + istOffsetMs);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) - istOffsetMs,
  );
}
