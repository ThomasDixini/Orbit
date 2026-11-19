import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { BarChart } from '../../../components/bar-chart/bar-chart';
import { ChartSeries, LineChart } from '../../../components/line-chart/line-chart';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { parseIsoDate, shortDateLabel } from '../../../core/calendar/date-label';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../core/finances/money';
import {
  BalanceEntryKind,
  INVESTMENT_KIND_OPTIONS,
  Investment,
  InvestmentDraft,
  InvestmentKind,
  Movement,
  MonthlyPoint,
  PortfolioLine,
  averagePriceCents,
  formatPercent,
  investmentKindLabel,
  investmentRiskLabel,
  isBalanceTracked,
  quantityText,
} from '../../../core/finances/investments';
import {
  InvestmentFilters,
  appliedByMonth,
  combineHistories,
  closedInvestmentIds,
  distribution,
  filterLines,
  incomeByMonth,
  lineValueCents,
  periodPerformance,
} from '../../../core/finances/investments-analytics';
import { InvestmentsStore } from '../../../core/finances/investments-store';
import { rateSeries } from '../../../core/finances/period-rates';
import { PeriodRatesStore } from '../../../core/finances/period-rates-store';
import { Period, periodMonths, periodRange } from '../../../core/finances/period';
import { PeriodFilter } from '../../../components/period-filter/period-filter';
import {
  INVESTMENTS_SECTION_OPTIONS,
  InvestmentsSection,
} from '../../../core/finances/investments-section';
import { BalanceEntryFields, BalanceEntryForm } from './balance-entry-form/balance-entry-form';
import { BalanceHistory } from './balance-history/balance-history';
import { BalanceStatement } from './balance-statement/balance-statement';
import { IncomeFields, IncomeForm } from './income-form/income-form';
import { MovementImport, MovementImportResult } from './movement-import/movement-import';
import { InvestmentForm } from './investment-form/investment-form';
import { InvestmentAnalyses } from './investment-analyses/investment-analyses';
import { InvestmentNotes } from './investment-notes/investment-notes';
import { PeriodRates } from './period-rates/period-rates';
import { PortfolioDistribution } from './portfolio-distribution/portfolio-distribution';
import { TradeFields, TradeForm } from './trade-form/trade-form';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** The inline form open above the lists, if any. */
type Panel =
  | { readonly kind: 'closed' }
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly investmentId: string }
  | { readonly kind: 'trade'; readonly investmentId: string }
  | { readonly kind: 'income'; readonly investmentId: string }
  | { readonly kind: 'balance'; readonly investmentId: string };

interface Stat {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

const CLOSED: Panel = { kind: 'closed' };
const DEFAULT_FILTERS: InvestmentFilters = { period: { kind: 'months', months: 12 } };
/** How many movements the list shows at first, and how many more each press of its arrow adds. */
const MOVEMENTS_PAGE_SIZE = 10;

/**
 * Investments: the portfolio (what is held, what it cost, what it is worth) narrowed by kind, asset and
 * period, with charts, how it splits between kinds, the table of assets, and the purchases, sales and
 * proventos behind it. Prices are typed by hand; the CDI comes from the Central Bank through the API.
 * Charts that need month-end history stay empty until the API sends it.
 */
@Component({
  selector: 'app-finances-investments',
  imports: [
    TranslatePipe,
    PageHeading,
    LoadFailed,
    InvestmentForm,
    TradeForm,
    IncomeForm,
    BalanceEntryForm,
    BalanceStatement,
    BalanceHistory,
    LineChart,
    BarChart,
    PortfolioDistribution,
    MovementImport,
    PeriodFilter,
    InvestmentNotes,
    InvestmentAnalyses,
    PeriodRates,
  ],
  providers: [InvestmentsStore, PeriodRatesStore],
  templateUrl: './investments.html',
  styleUrl: './investments.css',
})
export class Investments {
  private readonly store = inject(InvestmentsStore);
  private readonly periodRates = inject(PeriodRatesStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly isSaving = this.store.isSaving;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly sectionOptions = INVESTMENTS_SECTION_OPTIONS;
  protected readonly section = signal<InvestmentsSection>('portfolio');
  private readonly shownMovements = signal(MOVEMENTS_PAGE_SIZE);
  protected readonly visibleMovements = computed(() =>
    this.store.movements().slice(0, this.shownMovements()),
  );
  protected readonly hasMoreMovements = computed(
    () => this.store.movements().length > this.shownMovements(),
  );
  protected readonly movements = this.store.movements;
  protected readonly panel = signal<Panel>(CLOSED);
  protected readonly isImportOpen = signal(false);
  /** What the last import came to, shown until the person moves on. */
  protected readonly importResult = signal<MovementImportResult | undefined>(undefined);
  protected readonly filters = signal<InvestmentFilters>(DEFAULT_FILTERS);
  protected readonly kindOptions = INVESTMENT_KIND_OPTIONS;
  protected readonly riskLabel = investmentRiskLabel;
  protected readonly range = computed(() => periodRange(this.filters().period, this.today));
  protected readonly lines = computed(() => this.store.portfolio()?.lines ?? []);
  protected readonly tableLines = computed(() => this.visibleTableLines());
  /** The investments that were held and are gone; hidden from the assets, kept in the histories. */
  private readonly closedIds = computed(() => {
    const portfolio = this.store.portfolio();
    return portfolio === undefined ? new Set<string>() : closedInvestmentIds(portfolio);
  });
  protected readonly closedCount = computed(
    () => this.sortedTableLines().filter((line) => this.closedIds().has(line.investment.id)).length,
  );
  protected readonly showClosed = signal(false);
  protected readonly balanceEntries = computed(() => this.store.portfolio()?.balanceEntries ?? []);
  protected readonly balanceInvestments = computed(() =>
    this.lines()
      .map((line) => line.investment)
      .filter(isBalanceTracked),
  );
  protected readonly investmentNames = computed(
    () => new Map(this.lines().map((line) => [line.investment.id, line.investment.name])),
  );
  protected readonly depositKinds: readonly BalanceEntryKind[] = [
    'opening',
    'deposit',
    'withdrawal',
  ];
  protected readonly yieldKinds: readonly BalanceEntryKind[] = ['yield', 'incomeTax', 'iof', 'fee'];
  protected readonly selected = computed(() => filterLines(this.lines(), this.filters()));
  protected readonly panelInvestment = computed(() => this.investmentOfPanel());
  protected readonly summary = computed(() => this.describeSummary());
  protected readonly stats = computed(() => this.describeStats());
  protected readonly cdiNote = computed(() => this.describeCdiNote());
  protected readonly slices = computed(() => distribution(this.lines()));
  protected readonly monthLabels = computed(() => this.months().map((key) => this.monthName(key)));
  protected readonly valueSeries = computed(() => this.describeValueSeries());
  protected readonly returnSeries = computed(() => this.describeReturnSeries());
  protected readonly monthlyGains = computed(() => this.describeMonthlyGains());
  /** The month picked on the gains chart, `YYYY-MM`; it is forgotten once the period no longer holds it. */
  private readonly pickedMonth = signal<string | undefined>(undefined);
  protected readonly selectedMonthIndex = computed(() => {
    const index = this.months().indexOf(this.pickedMonth() ?? '');
    return index < 0 ? undefined : index;
  });
  protected readonly monthDetail = computed(() => this.describeMonthDetail());
  protected readonly monthlyIncome = computed(() => this.describeMonthlyIncome());
  protected readonly incomeNote = computed(() => this.describeIncomeNote());
  protected readonly formatAxisMoney = (reais: number): string => this.compact(reais);
  protected readonly formatAxisPercent = (percent: number): string => `${Math.round(percent)}%`;
  protected readonly formatCentsAxis = (cents: number): string => this.compact(cents / 100);

  private readonly months = computed(() => periodMonths(this.filters().period, this.today));

  protected open(panel: Panel): void {
    this.isImportOpen.set(false);
    this.panel.set(panel);
  }

  protected openImport(): void {
    this.panel.set(CLOSED);
    this.importResult.set(undefined);
    this.isImportOpen.set(true);
  }

  protected finishImport(result: MovementImportResult): void {
    this.isImportOpen.set(false);
    this.importResult.set(result);
  }

  protected close(): void {
    this.panel.set(CLOSED);
  }

  /** Picks the month of a bar, or clears the choice when it is the month already picked. */
  protected pickMonth(index: number): void {
    const month = this.months()[index];
    this.pickedMonth.update((current) => (current === month ? undefined : month));
  }

  protected pickKind(kind: InvestmentKind | undefined): void {
    this.filters.update((current) => ({ ...current, kind, investmentId: undefined }));
  }

  protected pickPeriod(period: Period): void {
    this.filters.update((current) => ({ ...current, period }));
  }

  protected pickAsset(investmentId: string | undefined): void {
    this.filters.update((current) => ({ ...current, investmentId }));
  }

  /** Clicking the asset already picked goes back to all of them. */
  protected toggleAsset(investmentId: string): void {
    this.pickAsset(this.filters().investmentId === investmentId ? undefined : investmentId);
  }

  protected async saveInvestment(draft: InvestmentDraft): Promise<void> {
    const panel = this.panel();
    const id = panel.kind === 'edit' ? panel.investmentId : undefined;
    if (await this.store.saveInvestment(id, draft)) this.close();
  }

  protected async deleteInvestment(): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'edit') return;
    if (await this.store.deleteInvestment(panel.investmentId)) this.close();
  }

  protected async addTrade(fields: TradeFields): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'trade') return;
    if (await this.store.addTrade({ ...fields, investmentId: panel.investmentId })) this.close();
  }

  protected async addBalanceEntry(fields: BalanceEntryFields): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'balance') return;
    if (await this.store.addBalanceEntry({ ...fields, investmentId: panel.investmentId })) {
      this.close();
    }
  }

  protected removeBalanceEntry(entryId: string): void {
    void this.store.deleteBalanceEntry(entryId);
  }

  protected isBalance(line: PortfolioLine): boolean {
    return isBalanceTracked(line.investment);
  }

  protected async addIncome(fields: IncomeFields): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'income') return;
    if (await this.store.addIncome({ ...fields, investmentId: panel.investmentId })) this.close();
  }

  /** Reveals the next page of the movements list, which starts with the newest ones. */
  protected showMoreMovements(): void {
    this.shownMovements.update((shown) => shown + MOVEMENTS_PAGE_SIZE);
  }

  protected async removeMovement(movement: Movement): Promise<void> {
    if (movement.type === 'trade') await this.store.deleteTrade(movement.id);
    else await this.store.deleteIncome(movement.id);
  }

  protected reload(): void {
    this.store.reload();
  }

  protected kindLabel(investment: Investment): string {
    return investmentKindLabel(investment.kind);
  }

  protected quantity(line: PortfolioLine): string {
    return quantityText(line.quantityThousandths);
  }

  protected average(line: PortfolioLine): string {
    return formatMoney(averagePriceCents(line), this.locale);
  }

  protected priceText(investment: Investment): string {
    if (investment.price === undefined) return 'No price yet';
    return formatMoney(investment.price.cents, this.locale);
  }

  protected priceDay(investment: Investment): string {
    return investment.price === undefined ? '' : shortDateLabel(investment.price.on, this.locale);
  }

  protected costText(line: PortfolioLine): string {
    return formatMoney(line.costCents, this.locale);
  }

  protected valueText(line: PortfolioLine): string {
    return line.valueCents === undefined ? 'At cost' : formatMoney(line.valueCents, this.locale);
  }

  protected gainText(line: PortfolioLine): string {
    if (line.gainCents === undefined) return '';
    return `${formatSignedMoney(line.gainCents, this.locale)} (${formatPercent(this.percentOf(line.gainCents, line.costCents), this.locale)})`;
  }

  protected movementDetail(movement: Movement): string {
    const day = shortDateLabel(movement.date, this.locale);
    return `${day} · ${movement.investmentName} · ${movement.label}`;
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }

  private visibleTableLines(): PortfolioLine[] {
    const lines = this.sortedTableLines();
    return this.showClosed()
      ? lines
      : lines.filter((line) => !this.closedIds().has(line.investment.id));
  }

  private sortedTableLines(): PortfolioLine[] {
    return filterLines(this.lines(), { kind: this.filters().kind }).sort(
      (first, second) => lineValueCents(second) - lineValueCents(first),
    );
  }

  private investmentOfPanel(): Investment | undefined {
    const panel = this.panel();
    if (panel.kind === 'closed' || panel.kind === 'new') return undefined;
    return this.lines().find((line) => line.investment.id === panel.investmentId)?.investment;
  }

  private describeSummary(): string {
    const portfolio = this.store.portfolio();
    if (portfolio === undefined) return 'Portfolio: —';
    return `Portfolio: ${formatMoney(portfolio.totals.valueCents, this.locale)}`;
  }

  private describeScope(): string {
    const { investmentId, kind } = this.filters();
    if (investmentId !== undefined) {
      return (
        this.lines().find((line) => line.investment.id === investmentId)?.investment.name ?? ''
      );
    }
    return kind === undefined ? 'whole portfolio' : investmentKindLabel(kind);
  }

  private describeStats(): Stat[] {
    if (!this.isLoaded()) return this.placeholderStats();
    const lines = this.selected();
    const value = lines.reduce((total, line) => total + lineValueCents(line), 0);
    const cost = lines.reduce((total, line) => total + line.costCents, 0);
    const gain = value - cost;
    return [
      {
        label: `Current value · ${this.describeScope()}`,
        value: formatMoney(value, this.locale),
        note: `${formatSignedMoney(gain, this.locale)} (${formatPercent(this.percentOf(gain, cost), this.locale)}) since purchase`,
      },
      { label: 'Invested', value: formatMoney(cost, this.locale), note: 'Sum at cost' },
      this.returnStat(this.percentOf(gain, cost)),
      {
        label: this.incomeLabel(),
        value: formatBalance(this.incomeInPeriod(), this.locale),
        note: 'Dividends and yields',
      },
    ];
  }

  /**
   * The return of the period when month-end figures cover it; otherwise the return since purchase, the
   * only one known for a single investment or class, since the history is the whole portfolio's.
   */
  private returnStat(sincePurchasePercent: number): Stat {
    const inPeriod = periodPerformance(this.selectedHistory());
    if (inPeriod === undefined) {
      return {
        label: 'Return',
        value: formatPercent(sincePurchasePercent, this.locale),
        note: this.describeCdiComparison(),
      };
    }
    return {
      label: 'Return',
      value: formatPercent(inPeriod.returnPercent, this.locale),
      note: `CDI in the period: ${formatPercent(inPeriod.cdiPercent, this.locale)}`,
    };
  }

  private placeholderStats(): Stat[] {
    return ['Current value', 'Invested', 'Return', 'Proventos'].map((label) => ({
      label,
      value: '—',
    }));
  }

  private describeCdiComparison(): string {
    const performance = this.store.portfolio()?.performance;
    const isWhole = this.filters().kind === undefined && this.filters().investmentId === undefined;
    if (performance === undefined || !isWhole) return 'Since purchase';
    return `CDI on the same money: ${formatPercent(performance.cdiPercent, this.locale)}`;
  }

  private incomeInPeriod(): number {
    return this.monthlyIncome().reduce((total, cents) => total + cents, 0);
  }

  private selectedIds(): Set<string> {
    return new Set(this.selected().map((line) => line.investment.id));
  }

  private describeMonthlyIncome(): number[] {
    const incomes = this.store.portfolio()?.incomes ?? [];
    return incomeByMonth(incomes, this.selectedIds(), this.months(), this.range());
  }

  private describeIncomeNote(): string {
    const average = Math.round(this.incomeInPeriod() / this.months().length);
    return `Average ${formatMoney(average, this.locale)} per month`;
  }

  /**
   * The history of the whole portfolio, or the ones of the investments the filters leave in, added up.
   * A source without per-investment histories (the demo) leaves a narrowed view blank.
   */
  private selectedHistory(): (MonthlyPoint | undefined)[] {
    const { kind, investmentId } = this.filters();
    const portfolio = this.store.portfolio();
    if (kind === undefined && investmentId === undefined) {
      const history = portfolio?.history ?? [];
      return this.months().map((month) => history.find((point) => point.month === month));
    }
    const histories = portfolio?.investmentHistories;
    if (histories === undefined) return this.months().map(() => undefined);
    const own = [...this.selectedIds()].map((id) => histories[id]);
    return combineHistories(own, this.months());
  }

  private describeValueSeries(): ChartSeries[] {
    const history = this.selectedHistory();
    const trades = this.store.portfolio()?.trades ?? [];
    // The history's applied money counts the deposits of balance-tracked investments, which trades do not.
    const applied = history.some((point) => point !== undefined)
      ? history.map((point) => point?.appliedCents)
      : appliedByMonth(trades, this.selectedIds(), this.months());
    return [
      { name: 'Current value', values: history.map((point) => point?.valueCents) },
      { name: 'Applied', values: applied, dashed: true },
    ].map((series) => ({ ...series, values: series.values.map(this.toReais) }));
  }

  private describeReturnSeries(): ChartSeries[] {
    const history = this.selectedHistory();
    return [
      { name: 'Your investments', values: history.map((point) => point?.returnPercent) },
      { name: 'CDI', values: history.map((point) => point?.cdiPercent), dashed: true },
      ...rateSeries(this.periodRates.rates(), this.months()).map((series) => ({
        ...series,
        dashed: true,
      })),
    ];
  }

  private describeMonthDetail():
    | {
        title: string;
        gainLabel: string;
        gainCents: number;
        gain: string;
        value: string;
        applied: string;
      }
    | undefined {
    const index = this.selectedMonthIndex();
    if (index === undefined) return undefined;
    const point = this.selectedHistory()[index];
    const gainCents = this.monthlyGains()[index];
    return {
      title: this.monthLong(this.months()[index]),
      gainLabel: gainCents < 0 ? 'Loss' : 'Gain',
      gainCents,
      gain: formatSignedMoney(gainCents, this.locale),
      value: point === undefined ? '—' : formatMoney(point.valueCents, this.locale),
      applied: point === undefined ? '—' : formatMoney(point.appliedCents, this.locale),
    };
  }

  private monthLong(key: string): string {
    const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
    return new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(date);
  }

  private describeMonthlyGains(): number[] {
    const history = this.selectedHistory();
    return history.map((point, index) => {
      const previous = history[index - 1];
      if (point === undefined || previous === undefined) return 0;
      const gain = point.valueCents - point.appliedCents;
      return gain - (previous.valueCents - previous.appliedCents);
    });
  }

  private describeCdiNote(): string | undefined {
    const portfolio = this.store.portfolio();
    const performance = portfolio?.performance;
    if (portfolio === undefined || performance === undefined) return undefined;
    const notes: string[] = [];
    if (performance.cdiThrough === undefined) notes.push('CDI rates could not be loaded.');
    else notes.push(`CDI rates through ${shortDateLabel(performance.cdiThrough, this.locale)}.`);
    if (portfolio.totals.unpricedCount > 0) {
      notes.push(`${portfolio.totals.unpricedCount} without a price are valued at cost.`);
    }
    return notes.join(' ');
  }

  private percentOf(part: number, whole: number): number {
    return whole === 0 ? 0 : (part / whole) * 100;
  }

  private readonly toReais = (cents: number | undefined): number | undefined =>
    cents === undefined ? undefined : cents / 100;

  private incomeLabel(): string {
    const period = this.filters().period;
    if (period.kind === 'months') return `Proventos · ${period.months} months`;
    const day = (isoDay: string): string =>
      new Intl.DateTimeFormat(this.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parseIsoDate(isoDay));
    return `Proventos · ${day(period.from)} – ${day(period.to)}`;
  }

  /** The month, with a short year once the chart reaches past a year so the same month is not read twice. */
  private monthName(key: string): string {
    const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
    const withYear = this.months().length > 12;
    return new Intl.DateTimeFormat(this.locale, {
      month: 'short',
      ...(withYear ? { year: '2-digit' as const } : {}),
    }).format(date);
  }

  private compact(reais: number): string {
    return new Intl.NumberFormat(this.locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(reais);
  }
}
