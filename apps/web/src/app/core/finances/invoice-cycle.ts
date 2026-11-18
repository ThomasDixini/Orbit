import { isoDate, parseIsoDate } from '../calendar/date-label';
import { CardTerms } from './finance-references';

/** The days an invoice covers and is due on; what the invoice came to is worked out from its purchases. */
export interface InvoicePeriod {
  /** Local calendar days, `YYYY-MM-DD`. Purchases from `startsOn` up to the day before `closesOn`. */
  readonly startsOn: string;
  readonly closesOn: string;
  readonly dueOn: string;
}

type BillingDays = Pick<CardTerms, 'closingDay' | 'dueDay'>;

/**
 * The invoice that closed when the given one started. It follows the same rules as the API: a day past a
 * short month's end falls on its last day, and the invoice is due in the closing month when the due day
 * comes after the closing day, else in the month after.
 * @example invoiceBefore({ startsOn: '2026-10-03', closesOn: '2026-11-03', dueOn: '2026-11-10' }, { closingDay: 3, dueDay: 10 }).closesOn // '2026-10-03'
 */
export function invoiceBefore(period: InvoicePeriod, terms: BillingDays): InvoicePeriod {
  const closesOn = parseIsoDate(period.startsOn);
  const startsOn = dayIn(closesOn.getFullYear(), closesOn.getMonth() - 1, terms.closingDay);
  const dueMonthShift = terms.dueDay > terms.closingDay ? 0 : 1;
  const dueOn = dayIn(closesOn.getFullYear(), closesOn.getMonth() + dueMonthShift, terms.dueDay);
  return { startsOn: isoDate(startsOn), closesOn: period.startsOn, dueOn: isoDate(dueOn) };
}

/**
 * The invoice `steps` invoices before the given one (0 is the given one).
 * @example invoicesBack(openInvoice, card.card, 2) // two invoices before the open one
 */
export function invoicesBack(
  period: InvoicePeriod,
  terms: BillingDays,
  steps: number,
): InvoicePeriod {
  let current = period;
  for (let step = 0; step < steps; step++) current = invoiceBefore(current, terms);
  return current;
}

/** `monthIndex` may be out of 0-11: the date wraps into the neighbouring year, as `Date` does. */
function dayIn(year: number, monthIndex: number, day: number): Date {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, daysInMonth));
}
