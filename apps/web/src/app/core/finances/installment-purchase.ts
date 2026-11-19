import { isoDate, parseIsoDate } from '../calendar/date-label';
import { BillDraft, BillKind, MAX_REPEAT_COUNT, MIN_REPEAT_COUNT } from './bills';
import { TransactionType } from './transaction';

/** What the transaction form collects for a purchase paid in installments. */
export interface InstallmentPurchase {
  readonly type: TransactionType;
  readonly description: string;
  readonly categoryId: string;
  readonly totalCents: number;
  readonly count: number;
  /** Due day of the first installment, `YYYY-MM-DD`; the others follow month by month. */
  readonly firstDueDate: string;
}

/**
 * The bill an expense settles (a payable) or an income settles (a receivable).
 * @example billKindOf('expense') // 'payable'
 */
export function billKindOf(type: TransactionType): BillKind {
  return type === 'expense' ? 'payable' : 'receivable';
}

/**
 * Whether the text is a whole number of installments the API accepts.
 * @example isValidInstallmentCount('6') // true
 */
export function isValidInstallmentCount(text: string): boolean {
  const count = Number(text);
  return Number.isInteger(count) && count >= MIN_REPEAT_COUNT && count <= MAX_REPEAT_COUNT;
}

/**
 * The same day of the next month, or its last day when that month is shorter.
 * @example monthAfter('2026-01-31') // '2026-02-28'
 */
export function monthAfter(isoDay: string): string {
  const day = parseIsoDate(isoDay);
  const next = new Date(day.getFullYear(), day.getMonth() + 1, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day.getDate(), lastDay));
  return isoDate(next);
}

/**
 * The bills of an installment purchase: one bill for the total, which the API splits into one per month.
 * @example installmentBills({ type: 'expense', description: 'TV', categoryId: 'home', totalCents: 50000, count: 6, firstDueDate: '2026-12-03' }).repeat?.count // 6
 */
export function installmentBills(purchase: InstallmentPurchase): BillDraft {
  return {
    kind: billKindOf(purchase.type),
    description: purchase.description,
    categoryId: purchase.categoryId,
    amountCents: purchase.totalCents,
    dueDate: purchase.firstDueDate,
    repeat: { kind: 'installments', count: purchase.count, amountIsTotal: true },
  };
}
