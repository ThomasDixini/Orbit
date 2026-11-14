import {
  PeriodRate,
  basisPointsText,
  parseBasisPoints,
  rateSeries,
  sortedRates,
} from './period-rates';

const MONTHS = ['2026-09', '2026-10', '2026-11'];

function rate(kind: PeriodRate['kind'], month: string, basisPoints: number): PeriodRate {
  return { kind, month, basisPoints };
}

describe('parseBasisPoints', () => {
  it.each([
    ['13', 1300],
    ['13,5', 1350],
    ['0.52', 52],
    ['-0,25', -25],
    ['100', 10_000],
    ['-10', -1000],
  ])('reads %s as %i basis points', (text, expected) => {
    expect(parseBasisPoints(text)).toBe(expected);
  });

  it.each(['', 'abc', '1,234', '101', '-11', '1.', '--1', '12%'])('refuses %j', (text) => {
    expect(parseBasisPoints(text)).toBeUndefined();
  });
});

describe('basisPointsText', () => {
  it.each([
    [1300, '13'],
    [1350, '13.5'],
    [52, '0.52'],
    [-25, '-0.25'],
    [0, '0'],
  ])('writes %i as %s', (basisPoints, expected) => {
    expect(basisPointsText(basisPoints)).toBe(expected);
  });
});

describe('rateSeries', () => {
  it('compounds the IPCA month by month', () => {
    const series = rateSeries([rate('ipca', '2026-09', 100), rate('ipca', '2026-10', 100)], MONTHS);

    expect(series).toHaveLength(1);
    expect(series[0].name).toBe('IPCA');
    expect(series[0].values[0]).toBeCloseTo(1, 6);
    expect(series[0].values[1]).toBeCloseTo(2.01, 6);
    expect(series[0].values[2]).toBeUndefined();
  });

  it('spreads a yearly Selic over twelve months', () => {
    const rates = MONTHS.map((month) => rate('selic', month, 1200));

    const values = rateSeries(rates, MONTHS)[0].values;

    expect(values[0]).toBeCloseTo((Math.pow(1.12, 1 / 12) - 1) * 100, 6);
    expect(values[2]).toBeCloseTo((Math.pow(1.12, 3 / 12) - 1) * 100, 6);
  });

  it('ends the line at the first month without a rate', () => {
    const values = rateSeries([rate('ipca', '2026-09', 50), rate('ipca', '2026-11', 50)], MONTHS)[0]
      .values;

    expect(values.map((value) => value !== undefined)).toEqual([true, false, false]);
  });

  it('gives no line for a kind without any rate in the period, nor for the income tax', () => {
    expect(rateSeries([rate('incomeTax', '2026-09', 1500)], MONTHS)).toEqual([]);
    expect(rateSeries([rate('ipca', '2025-01', 50)], MONTHS)).toEqual([]);
  });

  it('follows a negative rate', () => {
    const values = rateSeries([rate('ipca', '2026-09', -50)], MONTHS)[0].values;

    expect(values[0]).toBeCloseTo(-0.5, 6);
  });
});

describe('sortedRates', () => {
  it('puts the newest month first and keeps the kind order within a month', () => {
    const sorted = sortedRates([
      rate('ipca', '2026-10', 1),
      rate('selic', '2026-09', 1),
      rate('selic', '2026-10', 1),
    ]);

    expect(sorted.map((item) => `${item.month} ${item.kind}`)).toEqual([
      '2026-10 selic',
      '2026-10 ipca',
      '2026-09 selic',
    ]);
  });
});
