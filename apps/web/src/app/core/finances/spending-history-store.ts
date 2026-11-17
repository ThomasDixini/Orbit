import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { namesById } from './finance-references';
import { FinanceReferencesStore } from './finance-references-store';
import { DescriptionHistory, descriptionHistory, spendingHistory } from './spending-history';
import { Transaction } from './transaction';
import { monthOfDay } from './transaction-month';
import { TransactionsGateway } from './transactions-gateway';

/**
 * What the Spending history page shows: the expenses of every category in each month of the period
 * chosen, read from the stored transactions. Provided by the page, so each visit loads fresh data;
 * nothing is changed from here. An answer for a period that is no longer on screen is dropped.
 */
@Injectable()
export class SpendingHistoryStore {
  private readonly references = inject(FinanceReferencesStore);
  private readonly gateway = inject(TransactionsGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly shownMonths = signal<readonly string[]>([]);
  private readonly monthTransactions = signal<readonly (readonly Transaction[])[]>([]);
  private readonly dataLoaded = signal(false);
  private readonly loadFailed = signal(false);
  private lastRequest = 0;

  /** Today, `YYYY-MM-DD`. */
  readonly today = isoDate(inject(Clock).now());
  /** The month still running, whose spending is incomplete. */
  readonly currentMonth = monthOfDay(this.today);
  readonly months = this.shownMonths.asReadonly();
  readonly isLoaded = computed(() => this.dataLoaded() && this.references.isLoaded());
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());
  readonly history = computed(() =>
    spendingHistory(
      this.shownMonths(),
      this.monthTransactions(),
      namesById(this.references.categories()),
      this.currentMonth,
    ),
  );

  /**
   * Shows the given `YYYY-MM` months, oldest first: their transactions replace the figures once they
   * arrive.
   * @example store.show(['2026-09', '2026-10'])
   */
  show(months: readonly string[]): void {
    this.shownMonths.set(months);
    this.monthTransactions.set([]);
    this.dataLoaded.set(false);
    this.loadFailed.set(false);
    this.load(months);
  }

  /**
   * Loads again after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.loadFailed.set(false);
    if (!this.dataLoaded()) this.load(this.shownMonths());
  }

  /**
   * What a category is made of, by description, over the months shown.
   * @example store.descriptions('food')[0].description // 'Supermarket'
   */
  descriptions(categoryId: string): DescriptionHistory[] {
    return descriptionHistory(categoryId, this.shownMonths(), this.monthTransactions());
  }

  private load(months: readonly string[]): void {
    const request = ++this.lastRequest;
    if (months.length === 0) {
      this.dataLoaded.set(true);
      return;
    }
    forkJoin(months.map((month) => this.gateway.listMonth(month))).subscribe({
      next: (transactions) => {
        if (request !== this.lastRequest) return;
        this.monthTransactions.set(transactions);
        this.dataLoaded.set(true);
      },
      error: (error: unknown) => {
        if (request !== this.lastRequest) return;
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
