import { BalanceEntry, Investment, Portfolio } from '../investments';
import { portfolioAt, withBalanceEntries } from './demo-portfolio';

const RDB: Investment = { id: 'rdb', name: 'RDB', kind: 'fixedIncome', tracking: 'balance' };
const STOCK: Investment = { id: 'a', name: 'AAAA3', kind: 'stock' };

const ENTRIES: BalanceEntry[] = [
  { id: '1', investmentId: 'rdb', date: '2026-09-01', kind: 'opening', amountCents: 100_000 },
  { id: '2', investmentId: 'rdb', date: '2026-09-30', kind: 'yield', amountCents: 1_000 },
  { id: '3', investmentId: 'rdb', date: '2026-09-30', kind: 'incomeTax', amountCents: 150 },
  { id: '4', investmentId: 'rdb', date: '2026-12-01', kind: 'deposit', amountCents: 5_000 },
];

function build(investments: Investment[], asOf = '2026-11-04'): Portfolio {
  const portfolio = portfolioAt({
    investments,
    trades: [],
    incomes: [],
    priceOn: () => undefined,
    asOf,
  });
  return withBalanceEntries(portfolio, investments, ENTRIES, asOf);
}

describe('withBalanceEntries', () => {
  it('values a balance-tracked investment at its balance on the day and costs it what was put in', () => {
    const [line] = build([RDB]).lines;

    expect([line.costCents, line.valueCents, line.gainCents, line.quantityThousandths]).toEqual([
      100_000, 100_850, 850, 1000,
    ]);
  });

  it('leaves out what is dated after the day', () => {
    const [line] = build([RDB], '2026-10-15').lines;

    expect(line.valueCents).toBe(100_850);
  });

  it('adds its cost and value to the totals and hands over the entries', () => {
    const portfolio = build([STOCK, RDB]);

    expect([
      portfolio.totals.costCents,
      portfolio.totals.valueCents,
      portfolio.balanceEntries?.length,
    ]).toEqual([100_000, 100_850, 4]);
  });

  it('only hands over the entries when nothing is followed by balance', () => {
    const portfolio = build([STOCK]);

    expect([portfolio.lines.length, portfolio.balanceEntries?.length]).toEqual([1, 4]);
  });
});
