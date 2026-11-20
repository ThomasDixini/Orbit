import { balanceEffectCents, balanceHistory, monthlyStatement } from './balance-statement';
import { BalanceEntry, BalanceEntryKind } from './investments';

function entry(
  id: string,
  date: string,
  kind: BalanceEntryKind,
  amountCents: number,
): BalanceEntry {
  return { id, investmentId: 'caixinha', date, kind, amountCents };
}

const ENTRIES: readonly BalanceEntry[] = [
  entry('a', '2025-12-01', 'opening', 237_351),
  entry('b', '2025-12-09', 'deposit', 88_400),
  entry('c', '2025-12-31', 'yield', 4_024),
  entry('d', '2026-01-31', 'yield', 4_632),
  entry('e', '2026-01-31', 'incomeTax', 600),
  entry('f', '2026-01-31', 'fee', 100),
  entry('g', '2026-02-10', 'withdrawal', 50_000),
];

describe('balanceEffectCents', () => {
  it('adds an opening balance, a deposit and a yield, and takes the rest', () => {
    const kinds: BalanceEntryKind[] = [
      'opening',
      'deposit',
      'yield',
      'withdrawal',
      'incomeTax',
      'iof',
      'fee',
    ];

    expect(kinds.map((kind) => balanceEffectCents({ kind, amountCents: 100 }))).toEqual([
      100, 100, 100, -100, -100, -100, -100,
    ]);
  });
});

describe('monthlyStatement', () => {
  it('has nothing to show before the first entry', () => {
    expect(monthlyStatement([], '2026-11-18')).toEqual([]);
  });

  it('shows the month the opening balance is dated in as its opening and the deposit as an inflow', () => {
    const december = monthlyStatement(ENTRIES, '2026-02-18').at(-1)!;

    expect(december).toEqual({
      month: '2025-12',
      openingCents: 237_351,
      inflowsCents: 88_400,
      outflowsCents: 0,
      yieldCents: 4_024,
      closingCents: 329_775,
    });
  });

  it('opens each month with what the previous one closed with, newest month first', () => {
    const months = monthlyStatement(ENTRIES, '2026-02-18');

    expect(months.map((month) => [month.month, month.openingCents, month.closingCents])).toEqual([
      ['2026-02', 333_707, 283_707],
      ['2026-01', 329_775, 333_707],
      ['2025-12', 237_351, 329_775],
    ]);
  });

  it('counts income tax, IOF and fees as what left in the month, not as columns of their own', () => {
    const january = monthlyStatement(ENTRIES, '2026-02-18')[1];

    expect([january.yieldCents, january.outflowsCents, january.closingCents]).toEqual([
      4_632, 700, 333_707,
    ]);
  });

  it('keeps the months without entries, up to the month of the day', () => {
    const months = monthlyStatement([entry('a', '2026-08-02', 'opening', 10_000)], '2026-11-18');

    expect(months.map((month) => [month.month, month.closingCents])).toEqual([
      ['2026-11', 10_000],
      ['2026-10', 10_000],
      ['2026-09', 10_000],
      ['2026-08', 10_000],
    ]);
  });

  it('crosses the end of the year', () => {
    const months = monthlyStatement([entry('a', '2025-11-02', 'opening', 100)], '2026-01-05');

    expect(months.map((month) => month.month)).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});

describe('balanceHistory', () => {
  const names = new Map([['caixinha', 'Caixinha Nubank']]);

  it('lists only the kinds asked for, newest day first, with what each did to the balance', () => {
    const items = balanceHistory(ENTRIES, ['opening', 'deposit', 'withdrawal'], names);

    expect(items.map((item) => [item.date, item.label, item.cents, item.investmentName])).toEqual([
      ['2026-02-10', 'Withdrawal', -50_000, 'Caixinha Nubank'],
      ['2025-12-09', 'Deposit', 88_400, 'Caixinha Nubank'],
      ['2025-12-01', 'Opening balance', 237_351, 'Caixinha Nubank'],
    ]);
  });

  it('lists the yield and what is taken out of it together', () => {
    const items = balanceHistory(ENTRIES, ['yield', 'incomeTax', 'iof', 'fee'], names);

    expect(items.map((item) => [item.label, item.cents])).toEqual([
      ['Yield', 4_632],
      ['Income tax (IR)', -600],
      ['Fee', -100],
      ['Yield', 4_024],
    ]);
  });

  it('names an investment it does not know', () => {
    expect(balanceHistory(ENTRIES, ['deposit'], new Map())[0].investmentName).toBe(
      'Unknown investment',
    );
  });
});
