/**
 * Given a "YYYY-MM" string (or none, defaulting to the current month),
 * returns the inclusive start / exclusive end Date bounds for that month in
 * UTC. Throws if the format is invalid.
 */
export function getMonthRange(month?: string): { start: Date; end: Date; month: string } {
  let year: number;
  let monthIndex: number; // 0-based

  if (month) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) {
      throw new Error('month must be in YYYY-MM format');
    }
    year = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    monthIndex = now.getUTCMonth();
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  const normalizedMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  return { start, end, month: normalizedMonth };
}
