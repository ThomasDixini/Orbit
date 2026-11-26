import {
  afterIncomeTax,
  cdiSeries,
  comparisonOptions,
  latestIncomeTaxBasisPoints,
  sameRate,
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

describe('latestIncomeTaxBasisPoints', () => {
  it('takes the rate of the latest month that has one', () => {
    const rates = [rate('incomeTax', '2026-09', 2250), rate('incomeTax', '2026-10', 1500)];

    expect(latestIncomeTaxBasisPoints(rates, MONTHS)).toBe(1500);
  });

  it('ignores the other kinds of rate', () => {
    expect(latestIncomeTaxBasisPoints([rate('selic', '2026-10', 1500)], MONTHS)).toBeUndefined();
  });

  it('is undefined when no month of the period has a rate', () => {
    expect(
      latestIncomeTaxBasisPoints([rate('incomeTax', '2025-01', 1500)], MONTHS),
    ).toBeUndefined();
  });
});

describe('afterIncomeTax', () => {
  it('takes the tax from a gain', () => {
    expect(afterIncomeTax(10, 1500)).toBeCloseTo(8.5);
  });

  it('leaves a loss as it is', () => {
    expect(afterIncomeTax(-4, 1500)).toBe(-4);
  });
});

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

describe('cdiSeries', () => {
  it('accumulates the monthly CDI from the first month it is known for', () => {
    const series = cdiSeries(
      [
        { month: '2026-09', percent: 1 },
        { month: '2026-10', percent: 1 },
      ],
      ['2026-08', '2026-09', '2026-10', '2026-11'],
    );

    expect(series.values.map((value) => value?.toFixed(4))).toEqual([
      undefined,
      '1.0000',
      '2.0100',
      undefined,
    ]);
  });

  it('has no values when the CDI is not known', () => {
    expect(cdiSeries([], ['2026-10']).values).toEqual([undefined]);
  });
});

describe('custom rates', () => {
  const POUPANCA = (month: string, basisPoints: number): PeriodRate => ({
    kind: 'custom',
    name: 'Poupança',
    month,
    basisPoints,
  });

  it('draws a line for each custom rate, compounded like the IPCA', () => {
    const series = rateSeries([POUPANCA('2026-09', 100), POUPANCA('2026-10', 100)], MONTHS);

    expect([series[0].id, series[0].name, series[0].values[1]?.toFixed(2)]).toEqual([
      'custom:Poupança',
      'Poupança',
      '2.01',
    ]);
  });

  it('keeps two custom rates apart by name', () => {
    const other: PeriodRate = { ...POUPANCA('2026-09', 300), name: 'Fundo X' };

    expect(rateSeries([POUPANCA('2026-09', 100), other], MONTHS).map((line) => line.name)).toEqual([
      'Fundo X',
      'Poupança',
    ]);
  });

  it('offers a comparison chip for each custom rate after the usual ones', () => {
    expect(comparisonOptions([POUPANCA('2026-09', 100)]).map((option) => option.value)).toEqual([
      'moneyInCdi',
      'cdi',
      'selic',
      'ipca',
      'custom:Poupança',
    ]);
  });

  it('tells rates of the same kind apart by name', () => {
    expect([
      sameRate(POUPANCA('2026-09', 1), { ...POUPANCA('2026-09', 2) }),
      sameRate(POUPANCA('2026-09', 1), { ...POUPANCA('2026-09', 1), name: 'Fundo X' }),
    ]).toEqual([true, false]);
  });
});
