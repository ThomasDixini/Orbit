import { Transaction } from './transaction';
import { sum } from './transaction-summary';

/**
 * How the spending of a category behaves over the months that already closed: `fixed` comes almost
 * every month for about the same amount, `variable` comes almost every month but the amount moves,
 * `occasional` comes now and then, `rare` comes in very few months, and `unknown` is a category (or a
 * period) with too little history to say.
 */
export type SpendingPattern = 'fixed' | 'variable' | 'occasional' | 'rare' | 'unknown';

/** Months with spending needed before a pattern is claimed. */
export const MIN_MONTHS_FOR_PATTERN = 3;
/** Share of the months a category must show up in to be `fixed` or `variable`. */
export const REGULAR_PRESENCE = 0.75;
/** Share of the months at or below which a category is `rare`. */
export const RARE_PRESENCE = 0.25;
/** Largest spread (standard deviation over the average) of a `fixed` category. */
export const MAX_FIXED_VARIATION = 0.25;
/** How many times the usual amount a month must reach to be called unusual. */
export const UNUSUAL_FACTOR = 1.5;
/** The least a month must exceed the usual amount by, in cents, so small sums are never unusual. */
export const MIN_UNUSUAL_EXCESS_CENTS = 5000;

/** What a category took in one `YYYY-MM` month. */
export interface MonthSpending {
  readonly month: string;
  readonly cents: number;
  /** Well above what the category usually takes. */
  readonly isUnusual: boolean;
}

/** The months of one category, its totals and how it behaves. */
export interface CategoryHistory {
  readonly categoryId: string;
  readonly name: string;
  /** One entry per month of the period, oldest first. */
  readonly months: readonly MonthSpending[];
  readonly totalCents: number;
  /** Per closed month that had any spending at all, zeros included. */
  readonly averageCents: number;
  readonly pattern: SpendingPattern;
}

/** Spending by category over a stretch of months. */
export interface SpendingHistory {
  readonly months: readonly string[];
  /** Biggest total first. */
  readonly categories: readonly CategoryHistory[];
  readonly monthTotals: readonly number[];
}

/** What one description (an establishment or a bill) took in each month of a category. */
export interface DescriptionHistory {
  readonly description: string;
  readonly cents: readonly number[];
  readonly totalCents: number;
  readonly count: number;
}

/** The numbering the importer appends to an installment, which is not part of what was bought. */
const INSTALLMENT_SUFFIX = / - (?:Parcela|Installment) \d+ (?:de|of) \d+$/i;
const MIN_MONTHS_FOR_UNUSUAL = 3;

/**
 * Spending of each category in each month, with how each category behaves. Only expenses count. The
 * current month is still running, so it is shown but left out of every average and pattern, and so are
 * months with nothing spent at all (before the data begins).
 * @example spendingHistory(['2026-09', '2026-10'], [sept, oct], names, '2026-10').categories[0].name // 'Food'
 */
export function spendingHistory(
  months: readonly string[],
  transactionsByMonth: readonly (readonly Transaction[])[],
  categoryNames: ReadonlyMap<string, string>,
  currentMonth: string,
): SpendingHistory {
  const byCategory = expensesByCategory(months, transactionsByMonth);
  const monthTotals = months.map((_, index) =>
    sum([...byCategory.values()].map((cents) => cents[index])),
  );
  const closed = months
    .map((month, index) => ({ month, index }))
    .filter(({ month, index }) => month < currentMonth && monthTotals[index] > 0)
    .map(({ index }) => index);
  const categories = [...byCategory]
    .map(([categoryId, cents]) =>
      describeCategory(categoryId, categoryNames, months, cents, closed),
    )
    .sort((first, second) => second.totalCents - first.totalCents);
  return { months, categories, monthTotals };
}

/**
 * The spending of one category by description, biggest first, installments of the same purchase
 * counted together.
 * @example descriptionHistory('food', months, byMonth)[0].description // 'Supermarket'
 */
export function descriptionHistory(
  categoryId: string,
  months: readonly string[],
  transactionsByMonth: readonly (readonly Transaction[])[],
): DescriptionHistory[] {
  const lines = new Map<string, { cents: number[]; count: number }>();
  months.forEach((_, index) => {
    for (const transaction of expensesOf(categoryId, transactionsByMonth[index] ?? [])) {
      const key = transaction.description.replace(INSTALLMENT_SUFFIX, '');
      const line = lines.get(key) ?? { cents: months.map(() => 0), count: 0 };
      line.cents[index] -= transaction.amountCents;
      line.count++;
      lines.set(key, line);
    }
  });
  return [...lines]
    .map(([description, { cents, count }]) => ({
      description,
      cents,
      totalCents: sum(cents),
      count,
    }))
    .sort((first, second) => second.totalCents - first.totalCents);
}

/**
 * How a category behaves, from what it took in each closed month it was spent in.
 * @example patternOf([5000, 5000, 5000, 5000], 4) // 'fixed'
 */
export function patternOf(
  spentMonths: readonly number[],
  closedMonthCount: number,
): SpendingPattern {
  if (closedMonthCount < MIN_MONTHS_FOR_PATTERN) return 'unknown';
  const presence = spentMonths.length / closedMonthCount;
  if (presence <= RARE_PRESENCE) return 'rare';
  if (presence < REGULAR_PRESENCE) return 'occasional';
  return variation(spentMonths) <= MAX_FIXED_VARIATION ? 'fixed' : 'variable';
}

/**
 * The middle value of the amounts (the average of the two middle ones when there is an even number).
 * @example median([100, 300, 200]) // 200
 */
export function median(amounts: readonly number[]): number {
  if (amounts.length === 0) return 0;
  const sorted = [...amounts].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function expensesOf(categoryId: string, transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter(
    (transaction) => transaction.categoryId === categoryId && transaction.amountCents < 0,
  );
}

function expensesByCategory(
  months: readonly string[],
  transactionsByMonth: readonly (readonly Transaction[])[],
): Map<string, number[]> {
  const byCategory = new Map<string, number[]>();
  months.forEach((_, index) => {
    for (const transaction of (transactionsByMonth[index] ?? []).filter(
      (current) => current.amountCents < 0,
    )) {
      const cents = byCategory.get(transaction.categoryId) ?? months.map(() => 0);
      cents[index] -= transaction.amountCents;
      byCategory.set(transaction.categoryId, cents);
    }
  });
  return byCategory;
}

function describeCategory(
  categoryId: string,
  categoryNames: ReadonlyMap<string, string>,
  months: readonly string[],
  cents: readonly number[],
  closed: readonly number[],
): CategoryHistory {
  const closedCents = closed.map((index) => cents[index]);
  const spentMonths = closedCents.filter((amount) => amount > 0);
  return {
    categoryId,
    name: categoryNames.get(categoryId) ?? 'Unknown category',
    months: months.map((month, index) => ({
      month,
      cents: cents[index],
      isUnusual: isUnusual(cents, index, closed),
    })),
    totalCents: sum(cents),
    averageCents: closed.length === 0 ? 0 : Math.round(sum(closedCents) / closed.length),
    pattern: patternOf(spentMonths, closed.length),
  };
}

/** Compared with the other closed months the category was spent in, never with itself. */
function isUnusual(cents: readonly number[], index: number, closed: readonly number[]): boolean {
  const others = closed
    .filter((other) => other !== index && cents[other] > 0)
    .map((other) => cents[other]);
  if (others.length < MIN_MONTHS_FOR_UNUSUAL || cents[index] <= 0) return false;
  const usual = median(others);
  return cents[index] >= usual * UNUSUAL_FACTOR && cents[index] - usual >= MIN_UNUSUAL_EXCESS_CENTS;
}

function variation(amounts: readonly number[]): number {
  const average = sum(amounts) / amounts.length;
  const squares = sum(amounts.map((amount) => (amount - average) ** 2));
  return Math.sqrt(squares / amounts.length) / average;
}
