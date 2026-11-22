import { getMonthRange } from './month-range';

describe('getMonthRange', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns UTC-midnight bounds for an explicit month', () => {
    const { start, end, month } = getMonthRange('2026-02');
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(month).toBe('2026-02');
  });

  it('rolls the end bound into the next year for December', () => {
    const { start, end } = getMonthRange('2026-12');
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('covers 29 February in a leap year', () => {
    const { start, end } = getMonthRange('2028-02');
    expect(end.getTime() - start.getTime()).toBe(29 * 24 * 60 * 60 * 1000);
  });

  it('covers 28 days in February of a non-leap year', () => {
    const { start, end } = getMonthRange('2026-02');
    expect(end.getTime() - start.getTime()).toBe(28 * 24 * 60 * 60 * 1000);
  });

  it('defaults to the current UTC month when no month is given', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-15T10:00:00Z'));
    const { start, end, month } = getMonthRange();
    expect(month).toBe('2026-11');
    expect(start.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('uses the UTC month at the boundary, not the local one', () => {
    // 23:30 UTC on 31 Jan is already 1 Feb in UTC+3 (Riyadh); the range must stay in January.
    jest.useFakeTimers().setSystemTime(new Date('2026-01-31T23:30:00Z'));
    expect(getMonthRange().month).toBe('2026-01');
  });

  it.each(['2026-13', '2026-00', '2026-1', '26-01', '2026/01', '2026-01-01', 'January 2026'])(
    'rejects malformed month %p',
    (input) => {
      expect(() => getMonthRange(input)).toThrow('month must be in YYYY-MM format');
    },
  );
});
