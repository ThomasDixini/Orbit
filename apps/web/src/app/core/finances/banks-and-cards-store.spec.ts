import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { AccountStatement, CardPaymentDraft } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { BanksAndCardsStore } from './banks-and-cards-store';
import {
  FakeAccountStatementsGateway,
  SAMPLE_PAYMENT,
  SAMPLE_STATEMENTS,
} from './fake-account-statements-gateway';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
  SAMPLE_OCTOBER,
} from './fake-finances-gateways';
import { Transaction } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

const PAY_OCTOBER_INVOICE: CardPaymentDraft = {
  cardId: 'credit-card',
  fromAccountId: 'checking-account',
  date: '2026-10-31',
  amountCents: 28640,
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Statement requests that stay open until a test answers them, to play out reordered replies. */
class ControlledStatementsGateway extends FakeAccountStatementsGateway {
  readonly pendingStatements: Subject<readonly AccountStatement[]>[] = [];

  override statements(asOf: string): Observable<readonly AccountStatement[]> {
    this.askedStatements.push(asOf);
    const reply = new Subject<readonly AccountStatement[]>();
    this.pendingStatements.push(reply);
    return reply;
  }
}

function createStore(
  gateway: FakeAccountStatementsGateway = new FakeAccountStatementsGateway(),
  transactions: TransactionsGateway = new FakeTransactionsGateway(),
): { store: BanksAndCardsStore; errors: RecordingErrorHandler } {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      BanksAndCardsStore,
      { provide: AccountStatementsGateway, useValue: gateway },
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(BanksAndCardsStore), errors };
}

describe('BanksAndCardsStore loading', () => {
  it("loads today's statements, the months around this one and this month's payments", () => {
    const gateway = new FakeAccountStatementsGateway();
    const transactions = new FakeTransactionsGateway();
    const { store } = createStore(gateway, transactions);

    expect([
      gateway.askedStatements,
      transactions.askedMonths,
      store.transactions().length,
      store.payments(),
      store.statements().get('checking-account')?.balanceCents,
      store.isLoaded(),
    ]).toEqual([
      ['2026-10-31'],
      ['2026-09', '2026-10', '2026-11'],
      3,
      [SAMPLE_PAYMENT],
      1002860,
      true,
    ]);
  });

  it('offers to try again after a failed load, then loads what was missing', () => {
    const gateway = new FakeAccountStatementsGateway();
    gateway.failure = new Error('offline');
    const { store } = createStore(gateway);
    const failed = store.hasLoadFailed();

    gateway.failure = undefined;
    store.reload();

    expect([failed, store.hasLoadFailed(), store.isLoaded()]).toEqual([true, false, true]);
  });
});

describe('BanksAndCardsStore payments', () => {
  it('lists a payment at once and asks for the balances again once it is stored', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);

    store.payInvoice(PAY_OCTOBER_INVOICE);

    expect([store.payments().map((payment) => payment.id), gateway.askedStatements.length]).toEqual(
      [['id-1', SAMPLE_PAYMENT.id], 2],
    );
  });

  it('does not list a payment dated in another month', () => {
    const { store } = createStore();

    store.payInvoice({ ...PAY_OCTOBER_INVOICE, date: '2026-11-10' });

    expect(store.payments()).toEqual([SAMPLE_PAYMENT]);
  });

  it('drops a payment the gateway rejects and reports it', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('offline');

    store.payInvoice(PAY_OCTOBER_INVOICE);

    expect([store.payments(), errors.errors.length]).toEqual([[SAMPLE_PAYMENT], 1]);
  });

  it('deletes a payment and puts it back if the gateway rejects it', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('offline');

    store.deletePayment(SAMPLE_PAYMENT.id);

    expect([store.payments(), gateway.deletedPayments]).toEqual([
      [SAMPLE_PAYMENT],
      [SAMPLE_PAYMENT.id],
    ]);
  });
});

describe('BanksAndCardsStore balances', () => {
  it('asks for the balances again once an account change is stored', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);

    store.addAccount({ name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 0 });

    expect([store.accounts().length, gateway.askedStatements.length]).toEqual([3, 2]);
  });

  it('keeps the newest balances when an older answer comes late', () => {
    const gateway = new ControlledStatementsGateway();
    const { store } = createStore(gateway);
    store.deletePayment(SAMPLE_PAYMENT.id);
    const newer = [{ accountId: 'checking-account', balanceCents: 1 }];

    gateway.pendingStatements[1].next(newer);
    gateway.pendingStatements[0].next(SAMPLE_STATEMENTS);

    expect(store.statements().get('checking-account')?.balanceCents).toBe(1);
  });
});

/** Month reads that stay open until a test answers them, to play out slow replies. */
class ManualTransactionsGateway extends TransactionsGateway {
  readonly pending = new Map<string, Subject<readonly Transaction[]>>();

  override listMonth(month: string): Observable<readonly Transaction[]> {
    const reply = new Subject<readonly Transaction[]>();
    this.pending.set(month, reply);
    return reply;
  }

  override save(): Observable<Transaction> {
    throw new Error('not used');
  }

  override delete(): Observable<void> {
    throw new Error('not used');
  }
}

const AUGUST_LUNCH: Transaction = {
  id: 'august-lunch',
  date: '2026-08-12',
  description: 'Lunch',
  categoryId: 'food',
  accountId: 'checking-account',
  amountCents: -4200,
};

const AUGUST_PAYMENT = { ...SAMPLE_PAYMENT, id: 'august-invoice', date: '2026-08-10' };

function createStoreWithAugust(): {
  store: BanksAndCardsStore;
  transactions: FakeTransactionsGateway;
  errors: RecordingErrorHandler;
} {
  const transactions = new FakeTransactionsGateway(
    new Map([
      ['2026-10', SAMPLE_OCTOBER],
      ['2026-08', [AUGUST_LUNCH]],
    ]),
  );
  const gateway = new FakeAccountStatementsGateway(
    new Map([
      ['2026-10', [SAMPLE_PAYMENT]],
      ['2026-08', [AUGUST_PAYMENT]],
    ]),
  );
  return { ...createStore(gateway, transactions), transactions };
}

describe('BanksAndCardsStore month shown', () => {
  it('starts on the current month', () => {
    const { store } = createStore();

    expect([store.month(), store.isMonthLoading()]).toEqual(['2026-10', false]);
  });

  it('shows another month with its transactions and card payments, keeping what the cards need', () => {
    const { store, transactions } = createStoreWithAugust();

    store.showMonth('2026-08');

    expect([
      store.month(),
      transactions.askedMonths.slice(3),
      store.payments().map((payment) => payment.id),
      store.transactions().some((transaction) => transaction.id === 'august-lunch'),
      store.transactions().some((transaction) => transaction.id === 'groceries'),
      store.isMonthLoading(),
    ]).toEqual(['2026-08', ['2026-08'], ['august-invoice'], true, true, false]);
  });

  it('does not read a month again once it was read', () => {
    const { store, transactions } = createStoreWithAugust();

    store.showMonth('2026-08');
    store.showMonth('2026-09');
    store.showMonth('2026-08');

    expect(transactions.askedMonths).toEqual(['2026-09', '2026-10', '2026-11', '2026-08']);
  });

  it('lists a payment only when it is dated in the month shown', () => {
    const { store } = createStoreWithAugust();
    store.showMonth('2026-08');

    store.payInvoice({ ...PAY_OCTOBER_INVOICE, date: '2026-10-31' });
    store.payInvoice({ ...PAY_OCTOBER_INVOICE, date: '2026-08-20' });

    expect(store.payments().map((payment) => payment.date)).toEqual(['2026-08-20', '2026-08-10']);
  });

  it('drops the answer of a month that is no longer shown', () => {
    const transactions = new ManualTransactionsGateway();
    const { store } = createStore(new FakeAccountStatementsGateway(), transactions);
    for (const month of ['2026-09', '2026-10', '2026-11']) answer(transactions, month, []);

    store.showMonth('2026-08');
    const slow = transactions.pending.get('2026-08');
    store.showMonth('2026-07');
    answer(transactions, '2026-07', [{ ...AUGUST_LUNCH, id: 'july-lunch', date: '2026-07-03' }]);
    slow?.next([AUGUST_LUNCH]);
    slow?.complete();

    expect(store.transactions().map((transaction) => transaction.id)).toEqual(['july-lunch']);
  });

  it('reports a failed month, offers to try again and reads it then', () => {
    const { store, errors } = createStoreWithAugust();
    const gateway = TestBed.inject(AccountStatementsGateway) as FakeAccountStatementsGateway;
    gateway.failure = new Error('offline');

    store.showMonth('2026-08');
    const failed = [store.hasLoadFailed(), store.isMonthLoading(), errors.errors.length];
    gateway.failure = undefined;
    store.reload();

    expect([failed, store.hasLoadFailed(), store.isLoaded()]).toEqual([
      [true, false, 1],
      false,
      true,
    ]);
  });
});

function answer(
  transactions: ManualTransactionsGateway,
  month: string,
  list: readonly Transaction[],
): void {
  const reply = transactions.pending.get(month);
  reply?.next(list);
  reply?.complete();
}
