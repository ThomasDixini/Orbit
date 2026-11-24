import {
  closedMonths,
  closedRange,
  isValidCustomPeriod,
  lastClosedDay,
  monthKeys,
  monthsBetween,
  periodMonths,
  periodRange,
} from './period';

describe('periods', () => {
  it('lists the months ending at the current one, across a year change', () => {
    expect(monthKeys('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('covers a preset from the first day of its oldest month to today', () => {
    expect(periodRange({ kind: 'months', months: 3 }, '2026-11-03')).toEqual({
      from: '2026-09-01',
      to: '2026-11-03',
    });
  });

  it('covers a custom period from the first day to the last picked', () => {
    expect(
      periodRange({ kind: 'custom', from: '2026-08-15', to: '2026-10-02' }, '2026-11-03'),
    ).toEqual({
      from: '2026-08-15',
      to: '2026-10-02',
    });
  });

  it('lists the months a period touches, across a year change', () => {
    expect([
      periodMonths({ kind: 'custom', from: '2025-11-20', to: '2026-01-02' }, '2026-11-03'),
      periodMonths({ kind: 'months', months: 3 }, '2026-11-03'),
      monthsBetween('2026-03', '2026-01'),
    ]).toEqual([['2025-11', '2025-12', '2026-01'], ['2026-09', '2026-10', '2026-11'], []]);
  });

  it('accepts a start up to the end within ten years and refuses the rest', () => {
    expect([
      isValidCustomPeriod('2026-01-01', '2026-01-01'),
      isValidCustomPeriod('2026-02-01', '2026-01-01'),
      isValidCustomPeriod('2026-02-30', '2026-03-01'),
      isValidCustomPeriod('', '2026-03-01'),
      isValidCustomPeriod('2010-01-01', '2026-03-01'),
    ]).toEqual([true, false, false, false, false]);
  });
});

describe('the month still open', () => {
  it('ends the closed days at the last day of the month before', () => {
    expect([
      lastClosedDay('2026-11-03'),
      lastClosedDay('2026-01-15'),
      lastClosedDay('2024-03-01'),
    ]).toEqual(['2026-10-31', '2025-12-31', '2024-02-29']);
  });

  it('leaves the month of today out of the months', () => {
    expect(closedMonths(['2026-09', '2026-10', '2026-11'], '2026-11-03')).toEqual([
      '2026-09',
      '2026-10',
    ]);
  });

  it('caps a range at the last closed day but keeps one that ended before it', () => {
    expect([
      closedRange({ from: '2026-09-01', to: '2026-11-03' }, '2026-11-03'),
      closedRange({ from: '2026-08-01', to: '2026-09-10' }, '2026-11-03'),
    ]).toEqual([
      { from: '2026-09-01', to: '2026-10-31' },
      { from: '2026-08-01', to: '2026-09-10' },
    ]);
  });
});
