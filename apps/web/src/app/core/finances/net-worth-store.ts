import { ErrorHandler, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { AccountStatement } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { FinanceReferencesStore } from './finance-references-store';
import { Portfolio } from './investments';
import { InvestmentsGateway } from './investments-gateway';
import { NetWorthPoint, monthEnds, netWorth, netWorthHistory } from './net-worth';

/** How many months back the history reaches; each one asks the API for the balances of its last day. */
const HISTORY_MONTHS = 24;

/**
 * Where the net worth of each month comes from when something other than the API keeps it (the demo does);
 * without it the history is worked out from the balances of the last day of each month.
 */
export const NET_WORTH_HISTORY = new InjectionToken<() => readonly NetWorthPoint[]>(
  'NET_WORTH_HISTORY',
);

/**
 * What the Net worth page shows, put together from data that already exists: today's balances and the
 * investments held. Provided by the page, so each visit loads fresh data; nothing is changed from here.
 */
@Injectable()
export class NetWorthStore {
  private readonly references = inject(FinanceReferencesStore);
  private readonly statementsGateway = inject(AccountStatementsGateway);
  private readonly investmentsGateway = inject(InvestmentsGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly historySource = inject(NET_WORTH_HISTORY, { optional: true });
  private readonly statementList = signal<readonly AccountStatement[]>([]);
  private readonly portfolio = signal<Portfolio | undefined>(undefined);
  private readonly accountsByMonth = signal<ReadonlyMap<string, number>>(new Map());
  private readonly loadFailed = signal(false);

  /** Today, `YYYY-MM-DD`. */
  readonly today = isoDate(inject(Clock).now());
  readonly isLoaded = computed(() => this.portfolio() !== undefined && this.references.isLoaded());
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());
  /** How many held investments are valued at cost for lack of a price. */
  readonly unpricedCount = computed(() => this.portfolio()?.totals.unpricedCount ?? 0);
  /** The net worth at the end of each month, from the balances that day and the portfolio's history. */
  readonly history = computed<readonly NetWorthPoint[]>(
    () => this.historySource?.() ?? this.describeHistory(),
  );
  readonly netWorth = computed(() => {
    const balances = new Map(
      this.statementList().map((statement) => [statement.accountId, statement.balanceCents]),
    );
    const held = (this.portfolio()?.lines ?? []).map((line) => ({
      id: line.investment.id,
      name: line.investment.name,
      valueCents: line.valueCents ?? line.costCents,
    }));
    return netWorth(this.references.accounts(), balances, held);
  });

  constructor() {
    this.load();
  }

  /**
   * Loads everything again, after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.loadFailed.set(false);
    if (!this.isLoaded()) this.load();
  }

  private describeHistory(): NetWorthPoint[] {
    const invested = new Map(
      (this.portfolio()?.history ?? []).map((point) => [point.month, point.valueCents]),
    );
    return netWorthHistory(this.accountsByMonth(), invested);
  }

  private load(): void {
    const ends = monthEnds(this.today, HISTORY_MONTHS);
    forkJoin({
      statements: this.statementsGateway.statements(this.today),
      portfolio: this.investmentsGateway.portfolio(this.today),
      past: forkJoin(ends.map((end) => this.statementsGateway.statements(end.day))),
    }).subscribe({
      next: ({ statements, portfolio, past }) => {
        this.statementList.set(statements);
        this.portfolio.set(portfolio);
        this.accountsByMonth.set(
          new Map(
            ends.map((end, index) => [
              end.month,
              past[index].reduce((total, statement) => total + statement.balanceCents, 0),
            ]),
          ),
        );
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
