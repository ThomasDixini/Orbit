import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
  SAMPLE_OCTOBER,
} from './fake-finances-gateways';
import { SpendingHistoryStore } from './spending-history-store';
import { Transaction } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Answers each month only when the test says so, to play out slow and out-of-order answers. */
class ManualTransactionsGateway extends TransactionsGateway {
  readonly pending = new Map<string, Subject<readonly Transaction[]>>();

  override listMonth(month: string): Observable<readonly Transaction[]> {
    const subject = new Subject<readonly Transaction[]>();
    this.pending.set(month, subject);
    return subject;
  }

  override save(): Observable<Transaction> {
    throw new Error('not used');
  }

  override delete(): Observable<void> {
    throw new Error('not used');
  }
}

/** A month's answer arrives and completes, as an HTTP call does. */
function answer(
  subject: Subject<readonly Transaction[]> | undefined,
  transactions: readonly Transaction[],
): void {
  subject?.next(transactions);
  subject?.complete();
}

function setUp(transactions: TransactionsGateway): {
  store: SpendingHistoryStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      SpendingHistoryStore,
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(SpendingHistoryStore), errors };
}

describe('SpendingHistoryStore', () => {
  it('reads the transactions of every month shown and works out the history', () => {
    const { store } = setUp(new FakeTransactionsGateway());

    store.show(['2026-09', '2026-10']);

    expect(store.isLoaded()).toBe(true);
    expect(
      store.history().categories.map((category) => [category.name, category.totalCents]),
    ).toEqual([
      ['Food', 28640],
      ['Health', 5890],
    ]);
  });

  it('knows the month still running and offers what a category is made of', () => {
    const { store } = setUp(new FakeTransactionsGateway());

    store.show(['2026-10']);

    expect(store.currentMonth).toBe('2026-11');
    expect(store.descriptions('food')).toEqual([
      { description: 'Groceries', cents: [28640], totalCents: 28640, count: 1 },
    ]);
  });

  it('shows nothing, but loaded, for a period with no months', () => {
    const { store } = setUp(new FakeTransactionsGateway());

    store.show([]);

    expect([store.isLoaded(), store.history().categories]).toEqual([true, []]);
  });

  it('reports a failed load and loads again when asked', () => {
    const gateway = new FakeTransactionsGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = setUp(gateway);

    store.show(['2026-10']);
    gateway.failure = undefined;
    store.reload();

    expect([errors.errors.length, store.hasLoadFailed(), store.isLoaded()]).toEqual([
      1,
      false,
      true,
    ]);
  });

  it('drops the answer of a period that is no longer on screen', () => {
    const gateway = new ManualTransactionsGateway();
    const { store } = setUp(gateway);

    store.show(['2026-09']);
    const slow = gateway.pending.get('2026-09');
    store.show(['2026-10']);
    answer(gateway.pending.get('2026-10'), SAMPLE_OCTOBER);
    answer(slow, []);

    expect(store.history().categories.length).toBe(2);
  });
});
