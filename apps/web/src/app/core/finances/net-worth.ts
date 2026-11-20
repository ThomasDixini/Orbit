import { Account } from './finance-references';

/** One thing that adds to or takes from the net worth, in cents. */
export interface NetWorthItem {
  readonly id: string;
  readonly name: string;
  readonly cents: number;
}

/** An investment as the net worth sees it: what it is worth today (its cost while it has no price). */
export interface HeldInvestment {
  readonly id: string;
  readonly name: string;
  readonly valueCents: number;
}

/** What is owned, what is owed, and what is left. */
export interface NetWorth {
  readonly bankAccounts: readonly NetWorthItem[];
  readonly investments: readonly NetWorthItem[];
  /** What is owed on each credit card, as positive cents; a card paid ahead owes nothing. */
  readonly cards: readonly NetWorthItem[];
  readonly bankCents: number;
  readonly investmentsCents: number;
  readonly cardsOwedCents: number;
  /** Bank balances plus investments. */
  readonly assetsCents: number;
  /** Assets minus what the cards owe; negative when more is owed than owned. */
  readonly totalCents: number;
  /** Share of the assets held in bank accounts, 0–100; 0 when the assets are not above zero. */
  readonly bankPercent: number;
  /** Share of the assets held in investments, 0–100; the two shares always add up to 100 or are both 0. */
  readonly investmentsPercent: number;
}

/**
 * Puts the net worth together from today's balances (bank accounts hold, cards owe) and the investments
 * held. An investment worth nothing (a closed position) is left out of the list.
 * @example netWorth(accounts, new Map([['checking-account', 100000]]), []).totalCents // 100000
 */
export function netWorth(
  accounts: readonly Account[],
  balances: ReadonlyMap<string, number>,
  held: readonly HeldInvestment[],
): NetWorth {
  const bankAccounts = accounts
    .filter((account) => account.kind === 'bankAccount')
    .map((account) => ({
      id: account.id,
      name: account.name,
      cents: balances.get(account.id) ?? 0,
    }));
  const investments = held
    .filter((investment) => investment.valueCents > 0)
    .map((investment) => ({
      id: investment.id,
      name: investment.name,
      cents: investment.valueCents,
    }));
  const cards = accounts
    .filter((account) => account.kind === 'creditCard')
    .map((account) => ({
      id: account.id,
      name: account.name,
      cents: Math.max(0, -(balances.get(account.id) ?? 0)),
    }));
  return summarize(bankAccounts, investments, cards);
}

function summarize(
  bankAccounts: readonly NetWorthItem[],
  investments: readonly NetWorthItem[],
  cards: readonly NetWorthItem[],
): NetWorth {
  const bankCents = sum(bankAccounts);
  const investmentsCents = sum(investments);
  const cardsOwedCents = sum(cards);
  const assetsCents = bankCents + investmentsCents;
  const bankPercent = shareOf(bankCents, assetsCents);
  return {
    bankAccounts,
    investments,
    cards,
    bankCents,
    investmentsCents,
    cardsOwedCents,
    assetsCents,
    totalCents: assetsCents - cardsOwedCents,
    bankPercent,
    investmentsPercent: assetsCents > 0 ? 100 - bankPercent : 0,
  };
}

function sum(items: readonly NetWorthItem[]): number {
  return items.reduce((total, item) => total + item.cents, 0);
}

// Clamped, so an overdrawn account beside investments never gives a share below 0 or above 100.
function shareOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

/** The net worth at the end of one month; what the evolution chart and the monthly table are drawn from. */
export interface NetWorthPoint {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly cents: number;
}

/** One row of the month-by-month table: the change against the month before. */
export interface NetWorthRow {
  readonly month: string;
  readonly cents: number;
  readonly changeCents: number;
  /** Change as a percent of the month before; 0 when that was zero. */
  readonly changePercent: number;
}

/** How the net worth moved over a run of months. */
export interface NetWorthGrowth {
  readonly growthCents: number;
  readonly growthPercent: number;
  /** Growth divided by the months between the first and the last point. */
  readonly averageCents: number;
  readonly best: NetWorthRow;
}

/**
 * Each month with its change against the month before; the first month has no row, as there is nothing to
 * compare it with. Oldest first.
 * @example netWorthRows([{ month: '2026-09', cents: 100 }, { month: '2026-10', cents: 110 }])[0].changeCents // 10
 */
export function netWorthRows(points: readonly NetWorthPoint[]): NetWorthRow[] {
  return points.slice(1).map((point, index) => {
    const previous = points[index].cents;
    const changeCents = point.cents - previous;
    const changePercent = previous === 0 ? 0 : (changeCents / Math.abs(previous)) * 100;
    return { month: point.month, cents: point.cents, changeCents, changePercent };
  });
}

/**
 * Growth, monthly average and best month; undefined with fewer than two months.
 * @example netWorthGrowth(points)?.best.month // '2026-10'
 */
export function netWorthGrowth(points: readonly NetWorthPoint[]): NetWorthGrowth | undefined {
  const rows = netWorthRows(points);
  if (rows.length === 0) return undefined;
  const first = points[0].cents;
  const growthCents = (points.at(-1)?.cents ?? first) - first;
  const best = rows.reduce((top, row) => (row.changeCents > top.changeCents ? row : top), rows[0]);
  return {
    growthCents,
    growthPercent: first === 0 ? 0 : (growthCents / Math.abs(first)) * 100,
    averageCents: Math.round(growthCents / rows.length),
    best,
  };
}

/**
 * The last day of each of the last `count` months up to the month of `today`, oldest first; the month of
 * `today` ends on `today`, since nothing after it is known.
 * @example monthEnds('2026-11-19', 2) // [{ month: '2026-10', day: '2026-10-31' }, { month: '2026-11', day: '2026-11-19' }]
 */
export function monthEnds(today: string, count: number): { month: string; day: string }[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return Array.from({ length: count }, (_, index) => {
    const first = new Date(year, month - 1 - (count - 1 - index), 1);
    const key = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const day =
      key === today.slice(0, 7) ? today : `${key}-${String(last.getDate()).padStart(2, '0')}`;
    return { month: key, day };
  });
}

/**
 * The net worth at the end of each month: the balances of the accounts that day (cards count what they owe
 * as negative) plus what the investments were worth. Months before anything existed are left out.
 * @example netWorthHistory(balancesByMonth, investedByMonth)[0].cents
 */
export function netWorthHistory(
  accountsCentsByMonth: ReadonlyMap<string, number>,
  investedCentsByMonth: ReadonlyMap<string, number>,
): NetWorthPoint[] {
  const points = [...accountsCentsByMonth.keys()]
    .sort((first, second) => first.localeCompare(second))
    .map((month) => ({
      month,
      cents: (accountsCentsByMonth.get(month) ?? 0) + (investedCentsByMonth.get(month) ?? 0),
    }));
  const firstWithMoney = points.findIndex((point) => point.cents !== 0);
  return firstWithMoney === -1 ? [] : points.slice(firstWithMoney);
}
