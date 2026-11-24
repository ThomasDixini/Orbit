import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import {
  CardInvoice,
  InvoicePaymentShare,
  MAX_PAID_BY_LENGTH,
  canMarkPaid,
  invoiceStatusLabel,
  owedTotalCents,
  paymentSource,
} from '../../../../core/finances/card-invoices';
import { fieldValue } from '../../../../core/forms/field-value';
import { formatMoney } from '../../../../core/finances/money';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** An invoice marked as paid by someone else, and who. */
export interface PaidByOthers {
  readonly invoice: CardInvoice;
  readonly paidBy: string;
}

/**
 * Every invoice of a card, newest first: what it came to, what paid it (and from where) and what is
 * still owed. A closed invoice still owing can be marked as paid by someone else, for a payment no
 * statement will show (a relative who paid it).
 */
@Component({
  selector: 'app-card-invoices',
  imports: [TranslatePipe],
  templateUrl: './card-invoices.html',
  styleUrl: './card-invoices.css',
})
export class CardInvoices {
  /** Newest first. */
  readonly invoices = input.required<readonly CardInvoice[]>();
  readonly accountNames = input.required<ReadonlyMap<string, string>>();
  readonly isLoading = input(false);
  readonly hasLoadFailed = input(false);
  readonly markPaid = output<PaidByOthers>();
  readonly retry = output();

  private readonly locale = inject(LOCALE_ID);

  protected readonly maxPaidByLength = MAX_PAID_BY_LENGTH;
  /** The `closesOn` of the invoice whose "who paid" field is open. */
  protected readonly markingCloses = signal<string | undefined>(undefined);
  protected readonly paidBy = signal('');
  protected readonly owedLine = computed(
    () => `Still owed: ${this.money(owedTotalCents(this.invoices()))}`,
  );

  protected readonly canMarkPaid = canMarkPaid;
  protected readonly statusLabel = invoiceStatusLabel;

  protected startMarking(invoice: CardInvoice): void {
    this.markingCloses.set(invoice.closesOn);
    this.paidBy.set('');
  }

  protected cancelMarking(): void {
    this.markingCloses.set(undefined);
  }

  protected confirmMarking(event: SubmitEvent, invoice: CardInvoice): void {
    event.preventDefault();
    const paidBy = this.paidBy().trim();
    if (paidBy === '') return;
    this.markPaid.emit({ invoice, paidBy });
    this.markingCloses.set(undefined);
  }

  protected period(invoice: CardInvoice): string {
    return `${this.day(invoice.startsOn)} – ${this.day(invoice.closesOn)}`;
  }

  protected source(share: InvoicePaymentShare): string {
    return paymentSource(share, this.accountNames());
  }

  /** "R$ 120,00", or "R$ 120,00 of a R$ 300,00 payment" when the payment also paid another invoice. */
  protected shareAmount(share: InvoicePaymentShare): string {
    const part = this.money(share.amountCents);
    if (share.amountCents === share.paymentAmountCents) return part;
    return `${part} of a ${this.money(share.paymentAmountCents)} payment`;
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  protected day(isoDay: string): string {
    return shortDateLabel(isoDay, this.locale);
  }

  protected readonly valueOf = fieldValue;
}
