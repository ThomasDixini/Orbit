import { Income, MonthlyPoint, PortfolioLine, Trade } from './investments';
import {
  appliedByMonth,
  combineHistories,
  rebaseToFirst,
  distribution,
  filterLines,
  incomeByMonth,
  lineValueCents,
  periodPerformance,
} from './investments-analytics';

function line(
  id: string,
  kind: PortfolioLine['investment']['kind'],
  cost: number,
  value?: number,
): PortfolioLine {
  return {
    investment: { id, name: id.toUpperCase(), kind },
    quantityThousandths: 1000,
    costCents: cost,
    valueCents: value,
    incomeCents: 0,
  };
}

describe('investments analytics', () => {
  it('values a line at cost while it has no price', () => {
    expect(lineValueCents(line('a', 'stock', 500))).toBe(500);
  });

  it('filters lines by kind and by investment', () => {
    const lines = [line('a', 'stock', 1), line('b', 'fund', 1), line('c', 'stock', 1)];

    expect([
      filterLines(lines, {}).length,
      filterLines(lines, { kind: 'stock' }).map((item) => item.investment.id),
      filterLines(lines, { kind: 'stock', investmentId: 'c' }).map((item) => item.investment.id),
    ]).toEqual([3, ['a', 'c'], ['c']]);
  });

  it('adds up proventos of the chosen investments by month', () => {
    const incomes: Income[] = [
      { id: '1', investmentId: 'a', date: '2026-10-28', kind: 'dividend', amountCents: 1500 },
      { id: '2', investmentId: 'a', date: '2026-11-02', kind: 'yield', amountCents: 500 },
      { id: '3', investmentId: 'b', date: '2026-11-03', kind: 'yield', amountCents: 900 },
    ];

    expect(incomeByMonth(incomes, new Set(['a']), ['2026-09', '2026-10', '2026-11'])).toEqual([
      0, 1500, 500,
    ]);
  });

  it('accumulates what was put in, taking sales out', () => {
    const trades: Trade[] = [
      {
        id: '1',
        investmentId: 'a',
        date: '2026-09-05',
        kind: 'buy',
        quantityThousandths: 10000,
        unitPriceCents: 1000,
      },
      {
        id: '2',
        investmentId: 'a',
        date: '2026-10-05',
        kind: 'sell',
        quantityThousandths: 5000,
        unitPriceCents: 1000,
      },
    ];

    expect(appliedByMonth(trades, new Set(['a']), ['2026-08', '2026-09', '2026-10'])).toEqual([
      0, 10000, 5000,
    ]);
  });

  it('splits the value between kinds, biggest first', () => {
    const slices = distribution([
      line('a', 'stock', 100, 300),
      line('b', 'fund', 100),
      line('c', 'stock', 100, 100),
    ]);

    expect(slices).toEqual([
      { kind: 'stock', valueCents: 400, percent: 80 },
      { kind: 'fund', valueCents: 100, percent: 20 },
    ]);
  });

  it('has no slices for a portfolio worth nothing', () => {
    expect(distribution([])).toEqual([]);
  });
});

describe('income in a range', () => {
  it('counts only the proventos received on the days of a range', () => {
    const incomes: Income[] = [
      { id: '1', investmentId: 'a', date: '2026-10-05', kind: 'yield', amountCents: 100 },
      { id: '2', investmentId: 'a', date: '2026-10-20', kind: 'yield', amountCents: 200 },
    ];

    expect(
      incomeByMonth(incomes, new Set(['a']), ['2026-10'], { from: '2026-10-10', to: '2026-10-31' }),
    ).toEqual([200]);
  });
});

function point(month: string, returnPercent: number, cdiPercent: number): MonthlyPoint {
  return { month, valueCents: 0, appliedCents: 0, returnPercent, cdiPercent };
}

describe('period performance', () => {
  it('takes the change between the first and the last month, not the total since purchase', () => {
    const result = periodPerformance([
      point('2026-08', 10, 2),
      point('2026-09', 12, 3),
      point('2026-10', 21, 4.04),
    ]);

    expect(result?.returnPercent).toBeCloseTo(10, 5);
    expect(result?.cdiPercent).toBeCloseTo(2, 5);
  });

  it('skips the months with no figures', () => {
    const result = periodPerformance([undefined, point('2026-09', 0, 0), point('2026-10', 5, 1)]);

    expect(result?.returnPercent).toBeCloseTo(5, 5);
  });

  it('is unknown with fewer than two months', () => {
    expect([periodPerformance([]), periodPerformance([point('2026-10', 5, 1)])]).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('combineHistories', () => {
  const rdb: MonthlyPoint[] = [
    {
      month: '2026-09',
      valueCents: 1100,
      appliedCents: 1000,
      returnPercent: 10,
      cdiPercent: 1,
      receivedCents: 0,
      cdiGainCents: 10,
    },
  ];
  const tesouro: MonthlyPoint[] = [
    {
      month: '2026-08',
      valueCents: 500,
      appliedCents: 500,
      returnPercent: 0,
      cdiPercent: 0,
      receivedCents: 0,
      cdiGainCents: 0,
    },
    {
      month: '2026-09',
      valueCents: 900,
      appliedCents: 1000,
      returnPercent: -10,
      cdiPercent: 3,
      receivedCents: 0,
      cdiGainCents: 30,
    },
  ];

  it('adds the investments up and works the percentages out again from the sums', () => {
    const [august, september] = combineHistories([rdb, tesouro], ['2026-08', '2026-09']);

    expect([august?.valueCents, september?.valueCents, september?.appliedCents]).toEqual([
      500, 2000, 2000,
    ]);
    expect([september?.returnPercent, september?.cdiPercent]).toEqual([0, 2]);
  });

  it('rests the percentages on what was put in once everything was redeemed', () => {
    const redeemed: MonthlyPoint[] = [
      {
        month: '2026-07',
        valueCents: 0,
        appliedCents: -879,
        returnPercent: 5.86,
        cdiPercent: 14,
        receivedCents: 0,
        cdiGainCents: 2100,
        boughtCents: 15000,
      },
    ];

    const [july] = combineHistories([redeemed], ['2026-07']);

    expect([july?.returnPercent, july?.cdiPercent]).toEqual([5.86, 14]);
  });

  it('leaves a month with no figures undefined', () => {
    expect(combineHistories([rdb, undefined], ['2026-07'])).toEqual([undefined]);
  });
});

describe('rebaseToFirst', () => {
  it('starts the line at 0% and shows the growth since the first known month', () => {
    const [first, second, third, fourth] = rebaseToFirst([undefined, 10, undefined, 21]);

    expect([first, second, third]).toEqual([undefined, 0, undefined]);
    expect(fourth).toBeCloseTo(10, 6);
  });

  it('leaves a line with no known month as it is', () => {
    expect(rebaseToFirst([undefined, undefined])).toEqual([undefined, undefined]);
  });
});
