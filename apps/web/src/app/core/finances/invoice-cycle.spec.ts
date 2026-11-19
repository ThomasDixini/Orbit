import { InvoicePeriod, invoiceBefore, invoicesBack } from './invoice-cycle';

const OPEN: InvoicePeriod = { startsOn: '2026-10-03', closesOn: '2026-11-03', dueOn: '2026-11-10' };

describe('invoiceBefore', () => {
  it('ends where the given invoice starts and starts a closing day earlier', () => {
    expect(invoiceBefore(OPEN, { closingDay: 3, dueDay: 10 })).toEqual({
      startsOn: '2026-09-03',
      closesOn: '2026-10-03',
      dueOn: '2026-10-10',
    });
  });

  it('is due in the month after closing when the due day is not after the closing day', () => {
    const open = { startsOn: '2026-10-25', closesOn: '2026-11-25', dueOn: '2026-12-05' };

    expect(invoiceBefore(open, { closingDay: 25, dueDay: 5 })).toEqual({
      startsOn: '2026-09-25',
      closesOn: '2026-10-25',
      dueOn: '2026-11-05',
    });
  });

  it('puts a closing day past a short month on its last day', () => {
    const open = { startsOn: '2027-02-28', closesOn: '2027-03-31', dueOn: '2027-04-10' };

    expect(invoiceBefore(open, { closingDay: 31, dueDay: 10 })).toEqual({
      startsOn: '2027-01-31',
      closesOn: '2027-02-28',
      dueOn: '2027-03-10',
    });
  });

  it('crosses the end of the year', () => {
    const open = { startsOn: '2027-01-10', closesOn: '2027-02-10', dueOn: '2027-02-17' };

    expect(invoiceBefore(open, { closingDay: 10, dueDay: 17 })).toEqual({
      startsOn: '2026-12-10',
      closesOn: '2027-01-10',
      dueOn: '2027-01-17',
    });
  });
});

describe('invoicesBack', () => {
  it('is the same invoice at zero steps and walks back one closing at a time', () => {
    const terms = { closingDay: 3, dueDay: 10 };

    expect([invoicesBack(OPEN, terms, 0), invoicesBack(OPEN, terms, 3).closesOn]).toEqual([
      OPEN,
      '2026-08-03',
    ]);
  });
});
