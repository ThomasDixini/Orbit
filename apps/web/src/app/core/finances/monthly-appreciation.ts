import { Income, MonthlyPoint } from './investments';

const PERCENT = 100;

/** One month of an investment (or of several added up), seen as how much it appreciated. */
export interface AppreciationMonth {
  /** `YYYY-MM`. */
  readonly month: string;
  /** What it was worth when the month began. */
  readonly openingCents: number;
  /** What was put in minus what was taken out during the month. */
  readonly contributedCents: number;
  /** What its value changed beyond the money put in or taken out. */
  readonly appreciationCents: number;
  /** The appreciation over what was invested during the month; undefined when nothing was invested. */
  readonly percent: number | undefined;
  /** Proventos received in the month; they leave the investment, so they are not part of its value. */
  readonly incomeCents: number;
  /** What it was worth when the month ended. */
  readonly closingCents: number;
}

/**
 * The appreciation of each month of a month-end history, oldest first. The first month opens at zero, so
 * whatever it is worth beyond what was put in counts as its appreciation. A sold investment keeps its
 * months, and the month it was sold in shows what it gained up to the sale.
 * @example appreciationMonths(history, incomes)[0].appreciationCents
 */
export function appreciationMonths(
  history: readonly MonthlyPoint[],
  incomes: readonly Income[],
): AppreciationMonth[] {
  const ordered = [...history].sort((first, second) => first.month.localeCompare(second.month));
  return ordered.map((point, index) => {
    const previous = ordered[index - 1];
    const opening = previous?.valueCents ?? 0;
    const contributed = point.appliedCents - (previous?.appliedCents ?? 0);
    const appreciation = point.valueCents - opening - contributed;
    return {
      month: point.month,
      openingCents: opening,
      contributedCents: contributed,
      appreciationCents: appreciation,
      percent: percentOf(appreciation, opening + Math.max(contributed, 0)),
      incomeCents: incomeInMonth(incomes, point.month),
      closingCents: point.valueCents,
    };
  });
}

function percentOf(cents: number, baseCents: number): number | undefined {
  if (baseCents <= 0) return undefined;
  return Math.round((cents * PERCENT * PERCENT) / baseCents) / PERCENT;
}

function incomeInMonth(incomes: readonly Income[], month: string): number {
  return incomes
    .filter((income) => income.date.startsWith(month))
    .reduce((total, income) => total + income.amountCents, 0);
}
