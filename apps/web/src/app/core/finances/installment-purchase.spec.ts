import {
  billKindOf,
  installmentBills,
  isValidInstallmentCount,
  monthAfter,
} from './installment-purchase';

describe('installment purchase', () => {
  it('turns an expense into payable bills and an income into receivable ones', () => {
    expect([billKindOf('expense'), billKindOf('income')]).toEqual(['payable', 'receivable']);
  });

  it('accepts whole numbers of installments the API takes', () => {
    expect(['1', '2', '6', '60', '61', '2.5', '', 'x'].map(isValidInstallmentCount)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('puts the first installment a month after, on the last day when the month is shorter', () => {
    expect([monthAfter('2026-11-03'), monthAfter('2026-01-31'), monthAfter('2026-12-15')]).toEqual([
      '2026-12-03',
      '2026-02-28',
      '2027-01-15',
    ]);
  });

  it('asks for one bill with the total, split by the API', () => {
    const draft = installmentBills({
      type: 'expense',
      description: 'TV',
      categoryId: 'home',
      totalCents: 50_000,
      count: 6,
      firstDueDate: '2026-12-03',
    });

    expect(draft).toEqual({
      kind: 'payable',
      description: 'TV',
      categoryId: 'home',
      amountCents: 50_000,
      dueDate: '2026-12-03',
      repeat: { kind: 'installments', count: 6, amountIsTotal: true },
    });
  });
});
