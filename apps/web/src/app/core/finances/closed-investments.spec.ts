import { closedInvestmentIds } from './investments-analytics';
import { Portfolio, PortfolioLine } from './investments';

function line(id: string, quantityThousandths: number): PortfolioLine {
  return {
    investment: { id, name: id.toUpperCase(), kind: 'fixedIncome' },
    quantityThousandths,
    costCents: 0,
    incomeCents: 0,
  };
}

const PORTFOLIO: Pick<Portfolio, 'lines' | 'trades' | 'incomes' | 'balanceEntries'> = {
  lines: [line('held', 1000), line('sold', 0), line('new', 0), line('rdb', 0)],
  trades: [
    {
      id: 't1',
      investmentId: 'held',
      date: '2026-01-01',
      kind: 'buy',
      quantityThousandths: 1000,
      unitPriceCents: 100,
    },
    {
      id: 't2',
      investmentId: 'sold',
      date: '2026-01-01',
      kind: 'buy',
      quantityThousandths: 1000,
      unitPriceCents: 100,
    },
    {
      id: 't3',
      investmentId: 'sold',
      date: '2026-02-01',
      kind: 'sell',
      quantityThousandths: 1000,
      unitPriceCents: 100,
    },
  ],
  incomes: [],
  balanceEntries: [
    { id: 'b1', investmentId: 'rdb', date: '2026-01-01', kind: 'deposit', amountCents: 100 },
  ],
};

describe('closedInvestmentIds', () => {
  it('names the investments that were held and have nothing left, by trades or by balance', () => {
    expect([...closedInvestmentIds(PORTFOLIO)].sort()).toEqual(['rdb', 'sold']);
  });

  it('does not count one just created, with no activity yet', () => {
    expect(closedInvestmentIds(PORTFOLIO).has('new')).toBe(false);
  });

  it('does not count one still held', () => {
    expect(closedInvestmentIds(PORTFOLIO).has('held')).toBe(false);
  });

  it('counts one whose proventos are all that is left of it', () => {
    const portfolio = {
      ...PORTFOLIO,
      incomes: [
        {
          id: 'i1',
          investmentId: 'new',
          date: '2026-03-01',
          kind: 'dividend' as const,
          amountCents: 10,
        },
      ],
    };

    expect(closedInvestmentIds(portfolio).has('new')).toBe(true);
  });
});
