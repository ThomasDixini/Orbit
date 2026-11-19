import { BalanceEntry, BalanceEntryKind, balanceEntryKindLabel } from './investments';

/** One month of the statement of balance-tracked investments, as a bank shows it. */
export interface StatementMonth {
  /** `YYYY-MM`. */
  readonly month: string;
  /** What the investments held when the month began (an opening balance dated in it counts here). */
  readonly openingCents: number;
  /** Deposits made in the month. */
  readonly inflowsCents: number;
  /**
   * What left the investments in the month: the withdrawals plus the income tax, IOF and fees held back,
   * which are charged when the money is redeemed or sold, not month by month.
   */
  readonly outflowsCents: number;
  /** What the investments yielded, before what was taken out of it. */
  readonly yieldCents: number;
  /** What the investments held when the month ended. */
  readonly closingCents: number;
}

/** One line of a list of entries: what happened, to which investment, and what it did to the balance. */
export interface BalanceHistoryItem {
  readonly key: string;
  readonly id: string;
  readonly date: string;
  readonly investmentName: string;
  readonly label: string;
  /** Positive added to the balance, negative took from it. */
  readonly cents: number;
}

const TAX_KINDS: readonly BalanceEntryKind[] = ['incomeTax', 'iof'];

/**
 * What was held back as income tax, IOF and fees, in total.
 * @example withheldCents(entries) // 750
 */
export function withheldCents(entries: readonly BalanceEntry[]): number {
  return entries
    .filter((entry) => entry.kind === 'fee' || TAX_KINDS.includes(entry.kind))
    .reduce((sum, entry) => sum + entry.amountCents, 0);
}
const ADDING_KINDS: readonly BalanceEntryKind[] = ['opening', 'deposit', 'yield'];

/**
 * What an entry does to the balance: positive adds to it, negative takes from it.
 * @example balanceEffectCents({ kind: 'withdrawal', amountCents: 5000 }) // -5000
 */
export function balanceEffectCents(entry: Pick<BalanceEntry, 'kind' | 'amountCents'>): number {
  return ADDING_KINDS.includes(entry.kind) ? entry.amountCents : -entry.amountCents;
}

/**
 * The statement month by month, from the month of the first entry up to the month of `today`, newest
 * first. Each month opens with what the previous one closed with.
 * @example monthlyStatement(entries, '2026-11-18')[0].closingCents
 */
export function monthlyStatement(
  entries: readonly BalanceEntry[],
  today: string,
): StatementMonth[] {
  if (entries.length === 0) return [];
  const firstMonth = entries
    .map((entry) => entry.date.slice(0, 7))
    .sort((first, second) => first.localeCompare(second))[0];
  const months: StatementMonth[] = [];
  let closing = 0;
  for (const month of monthRange(firstMonth, today.slice(0, 7))) {
    const row = statementMonth(
      month,
      closing,
      entries.filter((entry) => entry.date.startsWith(month)),
    );
    months.push(row);
    closing = row.closingCents;
  }
  return months.reverse();
}

/**
 * The entries of the given kinds as a list, newest day first (the order given is kept within a day).
 * @example balanceHistory(entries, ['deposit', 'withdrawal'], names)[0].label // 'Deposit'
 */
export function balanceHistory(
  entries: readonly BalanceEntry[],
  kinds: readonly BalanceEntryKind[],
  investmentNames: ReadonlyMap<string, string>,
): BalanceHistoryItem[] {
  return entries
    .filter((entry) => kinds.includes(entry.kind))
    .map((entry): BalanceHistoryItem => ({
      key: `balance:${entry.id}`,
      id: entry.id,
      date: entry.date,
      investmentName: investmentNames.get(entry.investmentId) ?? 'Unknown investment',
      label: balanceEntryKindLabel(entry.kind),
      cents: balanceEffectCents(entry),
    }))
    .sort((first, second) => second.date.localeCompare(first.date));
}

function statementMonth(
  month: string,
  previousClosingCents: number,
  entries: readonly BalanceEntry[],
): StatementMonth {
  const sumOf = (...kinds: BalanceEntryKind[]): number =>
    entries
      .filter((entry) => kinds.includes(entry.kind))
      .reduce((sum, entry) => sum + entry.amountCents, 0);
  const openingCents = previousClosingCents + sumOf('opening');
  const inflowsCents = sumOf('deposit');
  const outflowsCents = sumOf('withdrawal', ...TAX_KINDS, 'fee');
  const yieldCents = sumOf('yield');
  return {
    month,
    openingCents,
    inflowsCents,
    outflowsCents,
    yieldCents,
    closingCents: openingCents + inflowsCents - outflowsCents + yieldCents,
  };
}

function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split('-').map(Number);
  const [lastYear, lastMonth] = to.split('-').map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}
