import { SAMPLE_OCTOBER } from './fake-finances-gateways';
import { Transaction } from './transaction';
import { countedByMonth, countedTransactions, isTransfer, transferCategoryIds } from './transfers';

const PIX_FROM_OWN_ACCOUNT: Transaction = {
  id: 'pix',
  date: '2026-10-21',
  description: 'Transferência recebida - Maria',
  categoryId: 'transfers',
  accountId: 'checking-account',
  amountCents: 100000,
};

describe('transfers', () => {
  it('lists the ids of the categories that only move money', () => {
    const ids = transferCategoryIds([
      { id: 'food', name: 'Food' },
      { id: 'salary', name: 'Salary', kind: 'regular' },
      { id: 'transfers', name: 'Transfers', kind: 'transfer' },
    ]);

    expect([...ids]).toEqual(['transfers']);
  });

  it('tells a transfer by its category', () => {
    const ids = new Set(['transfers']);

    expect([isTransfer(PIX_FROM_OWN_ACCOUNT, ids), isTransfer(SAMPLE_OCTOBER[0], ids)]).toEqual([
      true,
      false,
    ]);
  });

  it('leaves transfers out of what counts as income and expenses', () => {
    const counted = countedTransactions(
      [...SAMPLE_OCTOBER, PIX_FROM_OWN_ACCOUNT],
      new Set(['transfers']),
    );

    expect(counted.map((transaction) => transaction.id)).toEqual([
      'groceries',
      'pharmacy',
      'salary',
    ]);
  });

  it('leaves transfers out of every month, keeping the months in order', () => {
    const months = countedByMonth([[PIX_FROM_OWN_ACCOUNT], SAMPLE_OCTOBER], new Set(['transfers']));

    expect(months.map((month) => month.length)).toEqual([0, 3]);
  });
});
