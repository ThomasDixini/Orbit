import {
  CardInvoice,
  canMarkPaid,
  invoiceStatusLabel,
  outsidePaymentDate,
  owedTotalCents,
  paymentSource,
} from './card-invoices';

const JUNE: CardInvoice = {
  startsOn: '2026-05-08',
  closesOn: '2026-06-08',
  dueOn: '2026-06-12',
  amountCents: 82359,
  paidCents: 0,
  remainingCents: 82359,
  creditCents: 0,
  status: 'unpaid',
  payments: [],
};

describe('card invoices', () => {
  it('spells out each status', () => {
    expect(invoiceStatusLabel('partlyPaid')).toBe('Partly paid');
  });

  it('lets a closed invoice that still owes be marked as paid', () => {
    expect([
      canMarkPaid(JUNE),
      canMarkPaid({ ...JUNE, status: 'partlyPaid', remainingCents: 100 }),
      canMarkPaid({ ...JUNE, status: 'open' }),
      canMarkPaid({ ...JUNE, status: 'paid', remainingCents: 0 }),
    ]).toEqual([true, true, false, false]);
  });

  it('names where a payment came from: who paid, the account, or a bank account', () => {
    const names = new Map([['bb', 'Banco do Brasil']]);

    expect([
      paymentSource({ paidBy: 'Sister' }, names),
      paymentSource({ fromAccountId: 'bb' }, names),
      paymentSource({ fromAccountId: 'gone' }, names),
    ]).toEqual(['Sister', 'Banco do Brasil', 'Bank account']);
  });

  it('adds up what the closed and open invoices still owe, leaving installments ahead out', () => {
    const owed = owedTotalCents([
      JUNE,
      { ...JUNE, status: 'open', remainingCents: 88034 },
      { ...JUNE, status: 'upcoming', remainingCents: 5000 },
    ]);

    expect(owed).toBe(82359 + 88034);
  });

  it('dates a payment by others on the due day, or today while that is still ahead', () => {
    expect([
      outsidePaymentDate(JUNE, '2026-11-24'),
      outsidePaymentDate({ ...JUNE, dueOn: '2026-12-12' }, '2026-11-24'),
    ]).toEqual(['2026-06-12', '2026-11-24']);
  });
});
