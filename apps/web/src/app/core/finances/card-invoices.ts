/** Where one invoice of a card stands, as the API works it out. */
export type InvoiceStatus = 'paid' | 'partlyPaid' | 'unpaid' | 'open' | 'upcoming';

/** The part of a payment that went to one invoice, with where the payment came from. */
export interface InvoicePaymentShare {
  readonly paymentId: string;
  /** Local calendar day the payment was made, `YYYY-MM-DD`. */
  readonly date: string;
  /** What of the payment went to this invoice, in cents. */
  readonly amountCents: number;
  /** The whole payment, in cents; more than `amountCents` when it also paid another invoice. */
  readonly paymentAmountCents: number;
  readonly fromAccountId?: string;
  readonly paidBy?: string;
}

/**
 * One invoice of a card: what was spent on it, what paid it and what is still owed. Payments settle the
 * oldest invoice first.
 */
export interface CardInvoice {
  /** Local calendar days, `YYYY-MM-DD`: purchases from `startsOn` up to the day before `closesOn`. */
  readonly startsOn: string;
  readonly closesOn: string;
  readonly dueOn: string;
  readonly amountCents: number;
  readonly paidCents: number;
  readonly remainingCents: number;
  /** What refunds left over on earlier invoices covered of it. */
  readonly creditCents: number;
  readonly status: InvoiceStatus;
  readonly payments: readonly InvoicePaymentShare[];
}

/** The longest "paid by" note the API accepts. */
export const MAX_PAID_BY_LENGTH = 40;

// Own words, not "Paid" or "Upcoming": those already mean something else on the bills and overview.
const STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = {
  paid: 'Settled',
  partlyPaid: 'Partly paid',
  unpaid: 'Unpaid',
  open: 'Open',
  upcoming: 'Coming up',
};

/**
 * The status spelled out for a tag.
 * @example invoiceStatusLabel('partlyPaid') // 'Partly paid'
 */
export function invoiceStatusLabel(status: InvoiceStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Whether the invoice closed with something still to pay, so it can be marked as paid.
 * @example canMarkPaid({ ...invoice, status: 'unpaid', remainingCents: 82359 }) // true
 */
export function canMarkPaid(invoice: Pick<CardInvoice, 'status' | 'remainingCents'>): boolean {
  const isClosed = invoice.status === 'unpaid' || invoice.status === 'partlyPaid';
  return isClosed && invoice.remainingCents > 0;
}

/**
 * Where a payment came from, for a line under its invoice: the bank account's name or who paid it.
 * @example paymentSource({ ...share, paidBy: 'Sister' }, names) // 'Sister'
 */
export function paymentSource(
  share: Pick<InvoicePaymentShare, 'fromAccountId' | 'paidBy'>,
  accountNames: ReadonlyMap<string, string>,
): string {
  if (share.paidBy !== undefined) return share.paidBy;
  const name =
    share.fromAccountId === undefined ? undefined : accountNames.get(share.fromAccountId);
  return name ?? 'Bank account';
}

/**
 * What the closed and open invoices still owe in all; upcoming installments are not owed yet.
 * @example owedTotalCents(invoices) // 88034
 */
export function owedTotalCents(invoices: readonly CardInvoice[]): number {
  return invoices
    .filter((invoice) => invoice.status !== 'upcoming')
    .reduce((total, invoice) => total + invoice.remainingCents, 0);
}

/**
 * The day a "paid by someone else" payment of the invoice is dated: its due day, or today when that is
 * still ahead.
 * @example outsidePaymentDate({ ...invoice, dueOn: '2026-06-12' }, '2026-11-24') // '2026-06-12'
 */
export function outsidePaymentDate(invoice: Pick<CardInvoice, 'dueOn'>, today: string): string {
  return invoice.dueOn < today ? invoice.dueOn : today;
}
