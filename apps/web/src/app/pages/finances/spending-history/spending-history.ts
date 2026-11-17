import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { PeriodFilter } from '../../../components/period-filter/period-filter';
import { parseIsoDate } from '../../../core/calendar/date-label';
import { formatMoney } from '../../../core/finances/money';
import { Period, periodMonths } from '../../../core/finances/period';
import { CategoryHistory, SpendingPattern } from '../../../core/finances/spending-history';
import { SpendingHistoryStore } from '../../../core/finances/spending-history-store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** One month of the table header. */
interface MonthColumn {
  readonly month: string;
  readonly label: string;
  /** The month is still running, so its figures are not final. */
  readonly isRunning: boolean;
}

/** One amount of the table, written out. */
interface Cell {
  readonly text: string;
  readonly isUnusual: boolean;
}

/** One category of the table. */
interface CategoryRow {
  readonly categoryId: string;
  readonly name: string;
  readonly cells: readonly Cell[];
  readonly average: string;
  readonly pattern: SpendingPattern;
}

/** One description of the category chosen. */
interface DescriptionRow {
  readonly description: string;
  readonly cells: readonly string[];
  readonly total: string;
  readonly count: number;
}

const PATTERN_LABELS: Readonly<Record<SpendingPattern, string>> = {
  fixed: 'Fixed',
  variable: 'Variable',
  occasional: 'Occasional',
  rare: 'Rare',
  unknown: 'Not enough history',
};

const PATTERN_HINTS: Readonly<Record<SpendingPattern, string>> = {
  fixed: 'Comes nearly every month, for about the same amount.',
  variable: 'Comes nearly every month, but the amount moves a lot.',
  occasional: 'Comes in some months, not in others.',
  rare: 'Came in very few months.',
  unknown: 'Too few closed months to tell.',
};

const NO_SPENDING = '—';

/**
 * Spending history: what each category took in each month of the chosen period, which categories are
 * fixed, variable, occasional or rare, the months well above what a category usually takes, and (by
 * choosing a category) what it is made of. The month still running is shown but left out of averages.
 */
@Component({
  selector: 'app-finances-spending-history',
  imports: [TranslatePipe, PageHeading, LoadFailed, PeriodFilter],
  providers: [SpendingHistoryStore],
  templateUrl: './spending-history.html',
  styleUrl: './spending-history.css',
})
export class SpendingHistoryPage {
  private readonly store = inject(SpendingHistoryStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly period = signal<Period>({ kind: 'months', months: 12 });
  protected readonly selectedId = signal<string | undefined>(undefined);
  protected readonly columns = computed(() =>
    this.store.months().map((month) => this.column(month)),
  );
  protected readonly rows = computed(() =>
    this.store.history().categories.map((category) => this.categoryRow(category)),
  );
  protected readonly totals = computed(() =>
    this.store.history().monthTotals.map((cents) => this.amount(cents)),
  );
  protected readonly selected = computed(() =>
    this.rows().find((row) => row.categoryId === this.selectedId()),
  );
  protected readonly detail = computed(() => this.describeDetail());

  constructor() {
    this.store.show(this.monthsOf(this.period()));
  }

  protected changePeriod(period: Period): void {
    this.period.set(period);
    this.selectedId.set(undefined);
    this.store.show(this.monthsOf(period));
  }

  /** Choosing the category already chosen closes what it is made of. */
  protected select(categoryId: string): void {
    this.selectedId.update((current) => (current === categoryId ? undefined : categoryId));
  }

  protected patternLabel(pattern: SpendingPattern): string {
    return PATTERN_LABELS[pattern];
  }

  protected patternHint(pattern: SpendingPattern): string {
    return PATTERN_HINTS[pattern];
  }

  protected reload(): void {
    this.store.reload();
  }

  private monthsOf(period: Period): string[] {
    return periodMonths(period, this.store.today);
  }

  private column(month: string): MonthColumn {
    return {
      month,
      label: formatDate(parseIsoDate(`${month}-01`), 'MMM yy', this.locale),
      isRunning: month === this.store.currentMonth,
    };
  }

  private categoryRow(category: CategoryHistory): CategoryRow {
    return {
      categoryId: category.categoryId,
      name: category.name,
      cells: category.months.map((month) => ({
        text: this.amount(month.cents),
        isUnusual: month.isUnusual,
      })),
      average: this.amount(category.averageCents),
      pattern: category.pattern,
    };
  }

  private describeDetail(): DescriptionRow[] {
    const id = this.selectedId();
    if (id === undefined) return [];
    return this.store.descriptions(id).map((line) => ({
      description: line.description,
      cells: line.cents.map((cents) => this.amount(cents)),
      total: this.amount(line.totalCents),
      count: line.count,
    }));
  }

  private amount(cents: number): string {
    return cents === 0 ? NO_SPENDING : formatMoney(cents, this.locale);
  }
}
