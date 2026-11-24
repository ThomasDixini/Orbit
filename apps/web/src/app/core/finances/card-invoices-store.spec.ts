import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { AccountStatementsGateway } from './account-statements-gateway';
import { CardInvoice } from './card-invoices';
import { CardInvoicesStore } from './card-invoices-store';
import { FakeAccountStatementsGateway, SAMPLE_INVOICE } from './fake-account-statements-gateway';

/** Tuesday, November 24, 2026. */
const TODAY = new Date(2026, 10, 24, 20, 0);

const JUNE_UNPAID: CardInvoice = {
  ...SAMPLE_INVOICE,
  startsOn: '2026-05-08',
  closesOn: '2026-06-08',
  dueOn: '2026-06-12',
  amountCents: 82359,
  paidCents: 0,
  remainingCents: 82359,
  status: 'unpaid',
  payments: [],
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(gateway = new FakeAccountStatementsGateway()): {
  store: CardInvoicesStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      CardInvoicesStore,
      { provide: AccountStatementsGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(TODAY) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(CardInvoicesStore), errors };
}

describe('CardInvoicesStore', () => {
  it("reads the card's invoices as of today and lists them newest first", () => {
    const gateway = new FakeAccountStatementsGateway();
    gateway.invoicesToServe = [JUNE_UNPAID, SAMPLE_INVOICE];
    const { store } = createStore(gateway);

    store.show('credit-card');

    expect([gateway.askedInvoices, store.invoices().map((invoice) => invoice.closesOn)]).toEqual([
      [{ cardId: 'credit-card', asOf: '2026-11-24' }],
      ['2026-10-03', '2026-06-08'],
    ]);
  });

  it('records what is left of an invoice as paid by someone else, on its due day', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);
    store.show('credit-card');
    let stored = false;

    store.markPaidByOthers(JUNE_UNPAID, ' Sister ', () => (stored = true));

    expect([gateway.savedPayments, stored, gateway.askedInvoices.length]).toEqual([
      [
        {
          id: 'id-1',
          cardId: 'credit-card',
          paidBy: 'Sister',
          date: '2026-06-12',
          amountCents: 82359,
        },
      ],
      true,
      2,
    ]);
  });

  it('records nothing for an invoice already paid or without who paid', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);
    store.show('credit-card');

    store.markPaidByOthers(SAMPLE_INVOICE, 'Sister', () => undefined);
    store.markPaidByOthers(JUNE_UNPAID, '  ', () => undefined);

    expect(gateway.savedPayments).toEqual([]);
  });

  it('says the invoices could not be read, then reads them again', () => {
    const gateway = new FakeAccountStatementsGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);
    store.show('credit-card');
    const failed = store.hasLoadFailed();

    gateway.failure = undefined;
    store.reload();

    expect([failed, errors.errors.length, store.hasLoadFailed(), store.invoices().length]).toEqual([
      true,
      1,
      false,
      1,
    ]);
  });
});
