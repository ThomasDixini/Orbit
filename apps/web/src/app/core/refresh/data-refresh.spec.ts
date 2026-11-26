import { AccountStatementsGateway } from '../finances/account-statements-gateway';
import { FakeAccountStatementsGateway } from '../finances/fake-account-statements-gateway';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
} from '../finances/fake-finances-gateways';
import { FinanceReferencesStore } from '../finances/finance-references-store';
import { TransactionsStore } from '../finances/transactions-store';
import { FinanceReferencesGateway, TransactionsGateway } from '../finances/transactions-gateway';
import { FakeGoalsGateway, provideFakeRoutinesGateways } from '../routines/fake-routines-gateways';
import { FakeTasksGateway } from '../routines/fake-tasks-gateway';
import { RoutinesStore } from '../routines/routines-store';
import { Task } from '../routines/task';
import { TasksStore } from '../routines/tasks-store';
import { DataRefresh } from './data-refresh';

/** Monday, October 26, 2026. */
const MONDAY = new Date(2026, 9, 26, 9, 0);

/** Counts the lists it serves, so a test can tell that something was read again. */
class CountingReferencesGateway extends FakeFinanceReferencesGateway {
  accountReads = 0;

  override accounts(): ReturnType<FakeFinanceReferencesGateway['accounts']> {
    this.accountReads++;
    return super.accounts();
  }
}

class CountingTasksGateway extends FakeTasksGateway {
  reads = 0;

  override list(): Observable<readonly Task[]> {
    this.reads++;
    return super.list();
  }
}

describe('DataRefresh', () => {
  afterEach(() => vi.useRealTimers());

  it('calls every registered listener and moves to a new generation', () => {
    const refresh = TestBed.inject(DataRefresh);
    const calls: string[] = [];
    refresh.onRefresh(() => calls.push('first'));
    refresh.onRefresh(() => calls.push('second'));

    refresh.refresh();

    expect([calls, refresh.generation()]).toEqual([['first', 'second'], 1]);
  });

  it('shows that it refreshed for a moment, then stops', () => {
    vi.useFakeTimers();
    const refresh = TestBed.inject(DataRefresh);

    refresh.refresh();
    const justAfter = refresh.isRefreshing();
    vi.advanceTimersByTime(1000);

    expect([justAfter, refresh.isRefreshing()]).toEqual([true, false]);
  });
});

describe('what a refresh reads again', () => {
  function configure(providers: object[]): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: Clock, useValue: new FixedClock(MONDAY) },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
        ...providers,
      ],
    });
  }

  it('the finance accounts and categories', () => {
    const gateway = new CountingReferencesGateway();
    configure([{ provide: FinanceReferencesGateway, useValue: gateway }]);
    TestBed.inject(FinanceReferencesStore);

    TestBed.inject(DataRefresh).refresh();

    expect(gateway.accountReads).toBe(2);
  });

  it('the month of transactions on screen', () => {
    const gateway = new FakeTransactionsGateway();
    configure([
      { provide: TransactionsGateway, useValue: gateway },
      { provide: AccountStatementsGateway, useValue: new FakeAccountStatementsGateway() },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
    ]);
    TestBed.inject(TransactionsStore);

    TestBed.inject(DataRefresh).refresh();

    expect(gateway.askedMonths).toEqual(['2026-10', '2026-10']);
  });

  it('the tasks', () => {
    const gateway = new CountingTasksGateway();
    configure([...provideFakeRoutinesGateways(undefined, undefined, undefined, gateway)]);
    TestBed.inject(TasksStore);

    TestBed.inject(DataRefresh).refresh();

    expect(gateway.reads).toBe(2);
  });

  it('the goals, categories and routines', () => {
    const goals = new FakeGoalsGateway();
    configure([...provideFakeRoutinesGateways(undefined, goals)]);
    TestBed.inject(RoutinesStore);

    TestBed.inject(DataRefresh).refresh();

    expect(goals.listedDays).toEqual(['2026-10-26', '2026-10-26']);
  });
});
