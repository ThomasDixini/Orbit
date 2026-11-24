import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { parseIsoDate, shortDateLabel } from '../../../core/calendar/date-label';
import { AgendaItem, dueLabel } from '../../../core/finances/bills';
import { MonthFlow } from '../../../core/finances/overview';
import { OverviewStore } from '../../../core/finances/overview-store';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../core/finances/money';
import { Transaction } from '../../../core/finances/transaction';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** One month of the chart with the bar heights worked out. */
interface FlowColumn {
  readonly label: string;
  readonly description: string;
  readonly incomeHeight: number;
  readonly expenseHeight: number;
  readonly isSelected: boolean;
  /** Another month is picked, so this one steps back. */
  readonly isDimmed: boolean;
}

/** The figures of the month picked on the chart. */
interface MonthDetail {
  readonly title: string;
  readonly received: string;
  readonly spent: string;
  readonly net: string;
  readonly netCents: number;
}

/**
 * Finances overview: where the money stands (balances, open invoices, this month), received against
 * spent over six months, spending by category, the latest transactions and what is due next. A month
 * of the chart can be picked, as on the investments charts: its figures show under the chart and the
 * spending by category follows it.
 */
@Component({
  selector: 'app-finances-overview',
  imports: [TranslatePipe, PageHeading, LoadFailed, RouterLink],
  providers: [OverviewStore],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
  private readonly store = inject(OverviewStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly latest = this.store.latest;
  protected readonly dues = this.store.dues;
  protected readonly categoryNames = this.store.categoryNames;
  protected readonly accountNames = this.store.accountNames;
  /** The `YYYY-MM` month picked on the chart; none shows the current month. */
  private readonly pickedMonth = signal<string | undefined>(undefined);
  protected readonly pickedIndex = computed(() => {
    const index = this.store.months.indexOf(this.pickedMonth() ?? '');
    return index < 0 ? undefined : index;
  });
  protected readonly columns = computed(() =>
    this.store.flow().map((month, index) => this.column(month, index)),
  );
  protected readonly monthDetail = computed(() => this.describePickedMonth());
  /** The month the spending by category shows: the one picked, or the current one. */
  private readonly spendingIndex = computed(
    () => this.pickedIndex() ?? this.store.months.length - 1,
  );
  protected readonly spending = computed(
    () => this.store.spendingByMonth()[this.spendingIndex()] ?? [],
  );
  protected readonly spendingMonthName = computed(() =>
    this.monthName(this.store.months[this.spendingIndex()], 'MMMM'),
  );
  protected readonly isCurrentSpending = computed(
    () => this.spendingIndex() === this.store.months.length - 1,
  );
  protected readonly inAccounts = computed(() =>
    this.show(formatBalance(this.store.totals().bankBalanceCents, this.locale)),
  );
  protected readonly openInvoices = computed(() =>
    this.show(formatMoney(this.store.totals().cardOwedCents, this.locale)),
  );
  protected readonly received = computed(() =>
    this.show(formatMoney(this.store.thisMonth().incomeCents, this.locale)),
  );
  protected readonly spent = computed(() =>
    this.show(formatMoney(this.store.thisMonth().expenseCents, this.locale)),
  );
  protected readonly monthName = (month: string, format: string): string =>
    formatDate(parseIsoDate(`${month}-01`), format, this.locale);
  protected readonly currentMonthName = this.monthName(this.store.month, 'MMMM');

  /** Picks the month of a column, or clears the choice when it is the month already picked. */
  protected pickMonth(index: number): void {
    const month = this.store.months[index];
    this.pickedMonth.update((current) => (current === month ? undefined : month));
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }

  protected day(isoDay: string): string {
    return shortDateLabel(isoDay, this.locale);
  }

  protected dueText(item: AgendaItem): string {
    return `${dueLabel(item.dueDate, this.today)} (${this.day(item.dueDate)})`;
  }

  protected dueAmount(item: AgendaItem): string {
    return formatSignedMoney(
      item.kind === 'payable' ? -item.amountCents : item.amountCents,
      this.locale,
    );
  }

  protected transactionDetail(transaction: Transaction): string {
    const category = this.categoryNames().get(transaction.categoryId);
    const account = this.accountNames().get(transaction.accountId);
    return [this.day(transaction.date), category, account].filter(Boolean).join(' · ');
  }

  protected reload(): void {
    this.store.reload();
  }

  // Figures stay blank until everything has arrived, so a partial sum is never read as the total.
  private show(text: string): string {
    return this.isLoaded() ? text : '—';
  }

  private describePickedMonth(): MonthDetail | undefined {
    const index = this.pickedIndex();
    const month = index === undefined ? undefined : this.store.flow()[index];
    if (month === undefined) return undefined;
    const netCents = month.incomeCents - month.expenseCents;
    return {
      title: this.monthName(month.month, 'MMMM y'),
      received: this.money(month.incomeCents),
      spent: this.money(month.expenseCents),
      net: this.signed(netCents),
      netCents,
    };
  }

  private column(month: MonthFlow, index: number): FlowColumn {
    const peak = this.store.flowPeak();
    const label = this.monthName(month.month, 'MMM');
    const picked = this.pickedIndex();
    return {
      label,
      description: `${label}: received ${this.money(month.incomeCents)}, spent ${this.money(month.expenseCents)}`,
      incomeHeight: (month.incomeCents / peak) * 100,
      expenseHeight: (month.expenseCents / peak) * 100,
      isSelected: picked === index,
      isDimmed: picked !== undefined && picked !== index,
    };
  }
}
