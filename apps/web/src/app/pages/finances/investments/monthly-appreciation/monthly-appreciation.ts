import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { ChartSeries, LineChart } from '../../../../components/line-chart/line-chart';
import { combineHistories } from '../../../../core/finances/investments-analytics';
import {
  Income,
  Investment,
  MonthPrice,
  MonthlyPoint,
  formatPercent,
  isBalanceTracked,
} from '../../../../core/finances/investments';
import { formatMoney, formatSignedMoney } from '../../../../core/finances/money';
import {
  AppreciationMonth,
  appreciationMonths,
} from '../../../../core/finances/monthly-appreciation';
import { monthLabel } from '../../../../core/finances/transaction-month';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { MonthPriceFields, MonthPriceForm } from '../month-price-form/month-price-form';

/** The value of the investment picker that means "all the investments". */
const ALL = '';

/** How many of the latest months the chart draws; the table keeps every month. */
const CHART_MONTHS = 12;

/** One row of the table, its figures already written. */
interface AppreciationRow {
  readonly month: string;
  readonly label: string;
  readonly opening: string;
  readonly contributed: string;
  readonly appreciation: string;
  readonly isLoss: boolean;
  readonly percent: string;
  readonly income: string;
  readonly closing: string;
}

/** One month price the user typed, ready to be listed and removed. */
interface TypedPriceRow {
  readonly key: string;
  readonly price: MonthPrice;
  readonly investmentName: string;
  readonly label: string;
  readonly value: string;
}

/**
 * How much each investment appreciated in each month, sold ones included: a table for one investment or
 * all of them added up, and a chart that sets the investments' monthly appreciation side by side. The
 * month-end prices behind it can be typed here for the months the market source misses.
 */
@Component({
  selector: 'app-monthly-appreciation',
  imports: [TranslatePipe, LineChart, MonthPriceForm],
  templateUrl: './monthly-appreciation.html',
  styleUrl: './monthly-appreciation.css',
})
export class MonthlyAppreciation {
  readonly investments = input.required<readonly Investment[]>();
  readonly histories = input.required<Readonly<Record<string, readonly MonthlyPoint[]>>>();
  readonly incomes = input.required<readonly Income[]>();
  /** The month-end prices typed so far. */
  readonly monthPrices = input<readonly MonthPrice[]>([]);
  /** Today, `YYYY-MM-DD`; the month price form does not take a month that has not started. */
  readonly today = input.required<string>();
  readonly saving = input(false);
  readonly savePrice = output<MonthPriceFields>();
  readonly removePrice = output<MonthPrice>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly all = ALL;
  protected readonly picked = signal(ALL);
  protected readonly isFormOpen = signal(false);
  /** The investments with a price per unit; one followed by its balance has none to type. */
  protected readonly priceable = computed(() =>
    this.investments().filter((investment) => !isBalanceTracked(investment)),
  );
  protected readonly typedPrices = computed(() => this.describeTypedPrices());
  protected readonly rows = computed(() => this.describeRows());
  protected readonly labels = computed(() =>
    this.chartMonths().map((month) => this.shortMonth(month)),
  );
  protected readonly series = computed(() => this.describeSeries());
  protected readonly formatDetail = (percent: number): string =>
    formatPercent(percent, this.locale);
  protected readonly formatAxis = (percent: number): string => `${Math.round(percent)}%`;

  protected pick(event: Event): void {
    this.picked.set(fieldValue(event));
  }

  protected remove(row: TypedPriceRow): void {
    this.removePrice.emit(row.price);
  }

  // Newest month first, for the investment picked or for all of them.
  private describeTypedPrices(): TypedPriceRow[] {
    const names = new Map(
      this.pickedInvestments().map((investment) => [investment.id, investment.name]),
    );
    return this.monthPrices()
      .filter((price) => names.has(price.investmentId))
      .sort((first, second) => second.month.localeCompare(first.month))
      .map((price) => ({
        key: `${price.investmentId}-${price.month}`,
        price,
        investmentName: names.get(price.investmentId) ?? '',
        label: monthLabel(price.month, this.locale),
        value: formatMoney(price.cents, this.locale),
      }));
  }

  private pickedInvestments(): readonly Investment[] {
    const picked = this.picked();
    return picked === ALL
      ? this.investments()
      : this.investments().filter((investment) => investment.id === picked);
  }

  private monthsOfPicked(): AppreciationMonth[] {
    const investments = this.pickedInvestments();
    const histories = investments.map((investment) => this.histories()[investment.id]);
    const months = this.sortedMonths(investments);
    const points = combineHistories(histories, months).filter(
      (point): point is MonthlyPoint => point !== undefined,
    );
    const ids = new Set(investments.map((investment) => investment.id));
    return appreciationMonths(
      points,
      this.incomes().filter((income) => ids.has(income.investmentId)),
    );
  }

  private sortedMonths(investments: readonly Investment[]): string[] {
    const keys = new Set(
      investments.flatMap((investment) =>
        (this.histories()[investment.id] ?? []).map((point) => point.month),
      ),
    );
    return [...keys].sort((first, second) => first.localeCompare(second));
  }

  private describeRows(): AppreciationRow[] {
    return this.monthsOfPicked()
      .map((month) => this.rowOf(month))
      .reverse();
  }

  private rowOf(month: AppreciationMonth): AppreciationRow {
    return {
      month: month.month,
      label: monthLabel(month.month, this.locale),
      opening: formatMoney(month.openingCents, this.locale),
      contributed: formatSignedMoney(month.contributedCents, this.locale),
      appreciation: formatSignedMoney(month.appreciationCents, this.locale),
      isLoss: month.appreciationCents < 0,
      percent: month.percent === undefined ? '—' : formatPercent(month.percent, this.locale),
      income: formatMoney(month.incomeCents, this.locale),
      closing: formatMoney(month.closingCents, this.locale),
    };
  }

  private chartMonths(): string[] {
    return this.sortedMonths(this.pickedInvestments()).slice(-CHART_MONTHS);
  }

  private describeSeries(): ChartSeries[] {
    const months = this.chartMonths();
    return this.pickedInvestments()
      .map((investment) => ({
        name: investment.name,
        values: this.percentsOf(investment.id, months),
      }))
      .filter((line) => line.values.some((value) => value !== undefined));
  }

  private percentsOf(investmentId: string, months: readonly string[]): (number | undefined)[] {
    const own = appreciationMonths(this.histories()[investmentId] ?? [], []);
    return months.map((month) => own.find((item) => item.month === month)?.percent);
  }

  private shortMonth(month: string): string {
    const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
    return new Intl.DateTimeFormat(this.locale, { month: 'short', year: '2-digit' }).format(date);
  }
}
