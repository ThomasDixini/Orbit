import {
  Income,
  InvestmentKind,
  MonthlyPoint,
  Portfolio,
  PortfolioLine,
  Trade,
  tradeTotalCents,
} from './investments';

import { DayRange, Period } from './period';

/** What the page narrows the portfolio to; an absent field means everything. */
export interface InvestmentFilters {
  readonly kind?: InvestmentKind;
  readonly investmentId?: string;
  readonly period: Period;
}

/** One class of investment and its share of the portfolio. */
export interface DistributionSlice {
  readonly kind: InvestmentKind;
  readonly valueCents: number;
  readonly percent: number;
}

/**
 * What a line is worth: its value, or what it cost while no price is known.
 * @example lineValueCents({ ...line, valueCents: undefined, costCents: 5000 }) // 5000
 */
export function lineValueCents(line: Pick<PortfolioLine, 'valueCents' | 'costCents'>): number {
  return line.valueCents ?? line.costCents;
}

/**
 * The lines of one kind and/or one investment; all of them when neither is given.
 * @example filterLines(lines, { kind: 'stock' }).length
 */
export function filterLines(
  lines: readonly PortfolioLine[],
  filters: Pick<InvestmentFilters, 'kind' | 'investmentId'>,
): PortfolioLine[] {
  return lines.filter(
    (line) =>
      (filters.kind === undefined || line.investment.kind === filters.kind) &&
      (filters.investmentId === undefined || line.investment.id === filters.investmentId),
  );
}

/**
 * Proventos received in each month, for the given investments; with a `range`, only the ones received
 * on its days count.
 * @example incomeByMonth(incomes, new Set(['petr4']), ['2026-10', '2026-11']) // [1500, 0]
 */
export function incomeByMonth(
  incomes: readonly Income[],
  investmentIds: ReadonlySet<string>,
  months: readonly string[],
  range?: DayRange,
): number[] {
  const mine = incomes.filter(
    (income) =>
      investmentIds.has(income.investmentId) &&
      (range === undefined || (income.date >= range.from && income.date <= range.to)),
  );
  return months.map((month) =>
    mine
      .filter((income) => income.date.slice(0, 7) === month)
      .reduce((total, income) => total + income.amountCents, 0),
  );
}

/**
 * What had been put in (purchases minus sales, at what they came to) by the end of each month.
 * @example appliedByMonth(trades, new Set(['petr4']), ['2026-10', '2026-11']) // [100000, 100000]
 */
export function appliedByMonth(
  trades: readonly Trade[],
  investmentIds: ReadonlySet<string>,
  months: readonly string[],
): number[] {
  const mine = trades.filter((trade) => investmentIds.has(trade.investmentId));
  return months.map((month) =>
    mine
      .filter((trade) => trade.date.slice(0, 7) <= month)
      .reduce((total, trade) => total + signedTradeCents(trade), 0),
  );
}

/**
 * How the portfolio splits between kinds of investment, biggest first; empty when it is worth nothing.
 * @example distribution(lines)[0] // { kind: 'fixedIncome', valueCents: 3491300, percent: 47 }
 */
export function distribution(lines: readonly PortfolioLine[]): DistributionSlice[] {
  const total = lines.reduce((sum, line) => sum + lineValueCents(line), 0);
  if (total <= 0) return [];
  const byKind = new Map<InvestmentKind, number>();
  for (const line of lines) {
    const kind = line.investment.kind;
    byKind.set(kind, (byKind.get(kind) ?? 0) + lineValueCents(line));
  }
  return [...byKind]
    .map(([kind, valueCents]) => ({ kind, valueCents, percent: (valueCents / total) * 100 }))
    .sort((first, second) => second.valueCents - first.valueCents);
}

function signedTradeCents(trade: Trade): number {
  const total = tradeTotalCents(trade.quantityThousandths, trade.unitPriceCents);
  return trade.kind === 'buy' ? total : -total;
}

/** How the portfolio and the CDI did between the first and the last month of a period, in percent. */
export interface PeriodPerformance {
  readonly returnPercent: number;
  readonly cdiPercent: number;
}

const PERCENT = 100;

/**
 * The return and the CDI inside the period, from the accumulated figures at its first and last month.
 * Undefined when fewer than two months are known, since one point cannot show a change.
 * @example periodPerformance([may, june, july])?.returnPercent // 4.5
 */
export function periodPerformance(
  months: readonly (MonthlyPoint | undefined)[],
): PeriodPerformance | undefined {
  const known = months.filter((point): point is MonthlyPoint => point !== undefined);
  if (known.length < 2) return undefined;
  const first = known[0];
  const last = known[known.length - 1];
  return {
    returnPercent: growthBetween(first.returnPercent, last.returnPercent),
    cdiPercent: growthBetween(first.cdiPercent, last.cdiPercent),
  };
}

/**
 * Accumulated percentages shown from the first known month of a period: that month becomes 0% and the
 * others the growth since it, so the end of a line agrees with the return of the period.
 * @example rebaseToFirst([10, undefined, 21]) // [0, undefined, 10]
 */
export function rebaseToFirst(percents: readonly (number | undefined)[]): (number | undefined)[] {
  const first = percents.find((percent) => percent !== undefined);
  if (first === undefined) return [...percents];
  return percents.map((percent) =>
    percent === undefined ? undefined : growthBetween(first, percent),
  );
}

function growthBetween(startPercent: number, endPercent: number): number {
  return ((1 + endPercent / PERCENT) / (1 + startPercent / PERCENT) - 1) * PERCENT;
}

/**
 * The investments that were held and are not any more: they have trades or statement lines, and nothing
 * left (proventos alone do not count: the investment may only have had its purchases deleted). They leave the list of assets but stay in the histories and the charts.
 * @example closedInvestmentIds(portfolio).has('cdb') // true after the last unit was sold
 */
export function closedInvestmentIds(
  portfolio: Pick<Portfolio, 'lines' | 'trades' | 'balanceEntries'>,
): Set<string> {
  const withActivity = new Set([
    ...portfolio.trades.map((trade) => trade.investmentId),
    ...(portfolio.balanceEntries ?? []).map((entry) => entry.investmentId),
  ]);
  return new Set(
    portfolio.lines
      .filter((line) => line.quantityThousandths === 0 && withActivity.has(line.investment.id))
      .map((line) => line.investment.id),
  );
}

/**
 * The month-end figures of several investments added up, one entry per month; a month none of them has a
 * figure for is undefined. The percentages are worked out again from the added amounts, since percentages
 * of different investments cannot be summed.
 * @example combineHistories([rdb, tesouro], ['2026-10'])[0]?.valueCents
 */
export function combineHistories(
  histories: readonly (readonly MonthlyPoint[] | undefined)[],
  months: readonly string[],
): (MonthlyPoint | undefined)[] {
  return months.map((month) => {
    const points = histories
      .map((history) => history?.find((point) => point.month === month))
      .filter((point): point is MonthlyPoint => point !== undefined);
    return points.length === 0 ? undefined : addUp(month, points);
  });
}

function addUp(month: string, points: readonly MonthlyPoint[]): MonthlyPoint {
  const sum = (amountOf: (point: MonthlyPoint) => number): number =>
    points.reduce((total, point) => total + amountOf(point), 0);
  const value = sum((point) => point.valueCents);
  const applied = sum((point) => point.appliedCents);
  const received = sum((point) => point.receivedCents ?? 0);
  const cdiGain = sum((point) => point.cdiGainCents ?? 0);
  const bought = sum((point) => point.boughtCents ?? 0);
  // Once nothing is left applied (everything redeemed), the return rests on what was put in.
  const basis = applied > 0 ? applied : bought;
  return {
    month,
    valueCents: value,
    appliedCents: applied,
    returnPercent: percentOf(value + received - applied, basis),
    cdiPercent: percentOf(cdiGain, basis),
    receivedCents: received,
    cdiGainCents: cdiGain,
    boughtCents: bought,
  };
}

function percentOf(cents: number, appliedCents: number): number {
  if (appliedCents <= 0) return 0;
  return Math.round((cents * PERCENT * PERCENT) / appliedCents) / PERCENT;
}
