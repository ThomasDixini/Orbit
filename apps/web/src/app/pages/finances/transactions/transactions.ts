import { Component, ErrorHandler, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { Clock } from '../../../core/calendar/clock';
import { isoDate } from '../../../core/calendar/date-label';
import { Bill, BillDraft } from '../../../core/finances/bills';
import { BillsGateway } from '../../../core/finances/bills-gateway';
import { namesById } from '../../../core/finances/finance-references';
import { IdGenerator } from '../../../core/ids/id-generator';
import { Transaction, TransactionDraft } from '../../../core/finances/transaction';
import { groupByDay } from '../../../core/finances/transaction-days';
import {
  NO_FILTERS,
  TransactionFilters,
  filterTransactions,
} from '../../../core/finances/transaction-filters';
import {
  defaultDayIn,
  monthLabel,
  monthOfDay,
  shiftMonth,
} from '../../../core/finances/transaction-month';
import { summarize } from '../../../core/finances/transaction-summary';
import { TransactionsStore } from '../../../core/finances/transactions-store';
import { FiltersBar } from './filters-bar/filters-bar';
import { MonthSummary } from './month-summary/month-summary';
import { ImportResult, StatementImport } from './statement-import/statement-import';
import { BillLink, TransactionForm } from './transaction-form/transaction-form';
import { TransactionHistory } from './transaction-history/transaction-history';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Finances landing page: the month's totals and transactions, with filters and a quick-entry form. */
@Component({
  selector: 'app-finances-transactions',
  imports: [
    RouterLink,
    TranslatePipe,
    PageHeading,
    LoadFailed,
    MonthSummary,
    FiltersBar,
    TransactionHistory,
    TransactionForm,
    StatementImport,
  ],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css',
})
export class Transactions {
  private readonly store = inject(TransactionsStore);
  private readonly clock = inject(Clock);
  private readonly locale = inject(LOCALE_ID);
  private readonly billsGateway = inject(BillsGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);

  protected readonly categories = this.store.categories;
  protected readonly accounts = this.store.accounts;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly filters = signal<TransactionFilters>(NO_FILTERS);
  protected readonly isFormOpen = signal(false);
  protected readonly isImportOpen = signal(false);
  /** What the last import came to, shown until the person moves on. */
  protected readonly importResult = signal<ImportResult | undefined>(undefined);
  /** The transaction open in the form; none while recording a new one. */
  protected readonly editing = signal<Transaction | undefined>(undefined);
  /** The open bills a new transaction can be linked to, read when the form opens. */
  protected readonly openBills = signal<readonly Bill[]>([]);
  /** What the last installment purchase or settled bill came to, shown until the person moves on. */
  protected readonly billsNotice = signal<{ text: string; count?: number } | undefined>(undefined);
  /** Says where a transaction dated in another month went, since it does not show in this one. */
  protected readonly savedElsewhere = signal<string | undefined>(undefined);

  protected readonly monthTitle = computed(() => monthLabel(this.store.month(), this.locale));
  protected readonly categoryNames = computed(() => namesById(this.categories()));
  protected readonly accountNames = computed(() => namesById(this.accounts()));
  private readonly shown = computed(() =>
    filterTransactions(this.store.transactions(), this.filters(), this.categoryNames()),
  );
  protected readonly summary = computed(() => summarize(this.shown()));
  protected readonly days = computed(() => groupByDay(this.shown()));
  protected readonly isFiltered = computed(() => {
    const filters = this.filters();
    return filters.type !== 'all' || filters.accountId !== undefined || filters.query.trim() !== '';
  });
  /** A transaction needs a category and an account, so the form waits until both lists arrived. */
  protected readonly canRecord = computed(
    () => this.categories().length > 0 && this.accounts().length > 0,
  );
  protected readonly defaultDate = computed(() =>
    defaultDayIn(this.store.month(), isoDate(this.clock.now())),
  );
  protected readonly defaultAccountId = computed(
    () => this.store.lastAccountId() ?? this.accounts()[0]?.id,
  );

  /**
   * Moves the list one month back (-1) or forward (1); the filters stay as they are.
   * @example this.showMonth(-1)
   */
  protected showMonth(step: number): void {
    this.closeForm();
    this.savedElsewhere.set(undefined);
    this.billsNotice.set(undefined);
    this.store.showMonth(shiftMonth(this.store.month(), step));
  }

  protected openImport(): void {
    this.closeForm();
    this.importResult.set(undefined);
    this.isImportOpen.set(true);
  }

  /** Closes the panel and shows the month the lines went to, where they can be checked. */
  protected finishImport(result: ImportResult): void {
    this.isImportOpen.set(false);
    this.importResult.set(result);
    if (result.month !== '') this.store.showMonth(result.month);
  }

  protected openNew(): void {
    this.isImportOpen.set(false);
    this.editing.set(undefined);
    this.isFormOpen.set(true);
    this.loadOpenBills();
  }

  protected openEdit(transaction: Transaction): void {
    this.editing.set(transaction);
    this.isFormOpen.set(true);
  }

  protected closeForm(): void {
    this.isFormOpen.set(false);
    this.editing.set(undefined);
  }

  /**
   * Records the form's transaction, or saves the edit of the one open in it.
   * @example this.save({ date: '2026-10-31', description: 'Groceries', categoryId: 'food', accountId: 'credit-card', amountCents: -28640 })
   */
  protected save(draft: TransactionDraft): void {
    const editing = this.editing();
    if (editing === undefined) this.store.add(draft);
    else this.store.update(editing.id, draft);
    this.closeForm();
    this.announceIfElsewhere(draft.date);
  }

  /**
   * Adds the bills of a purchase paid in installments, one to pay (or receive) for each month.
   * @example this.saveInstallments({ kind: 'payable', description: 'TV', categoryId: 'home', amountCents: 50000, dueDate: '2026-12-03', repeat: { kind: 'installments', count: 6, amountIsTotal: true } })
   */
  protected saveInstallments(draft: BillDraft): void {
    this.closeForm();
    this.billsGateway.save(this.ids.next(), draft).subscribe({
      next: () =>
        this.billsNotice.set({
          text: '{count} installments added to To pay & receive.',
          count: draft.repeat?.count,
        }),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Settles the open bill the form was linked to, which records its transaction and marks it paid or received.
   * @example this.settleBill({ billId: 'rent', settlement: { date: '2026-11-05', accountId: 'checking-account' } })
   */
  protected settleBill(link: BillLink): void {
    this.closeForm();
    this.billsGateway.settle(link.billId, link.settlement).subscribe({
      next: () => {
        this.billsNotice.set({ text: 'Bill settled in To pay & receive.' });
        this.store.refresh();
        this.announceIfElsewhere(link.settlement.date);
      },
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  protected remove(): void {
    const editing = this.editing();
    if (editing !== undefined) this.store.delete(editing.id);
    this.closeForm();
  }

  protected reload(): void {
    this.store.reload();
  }

  private loadOpenBills(): void {
    this.billsGateway.agenda(isoDate(this.clock.now())).subscribe({
      next: (agenda) => this.openBills.set(agenda.bills.filter((bill) => !bill.settlement)),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  private announceIfElsewhere(isoDay: string): void {
    const month = monthOfDay(isoDay);
    this.savedElsewhere.set(
      month === this.store.month() ? undefined : `Saved to ${monthLabel(month, this.locale)}.`,
    );
  }
}
