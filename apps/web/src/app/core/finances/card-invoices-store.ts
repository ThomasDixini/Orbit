import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { CardPayment } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { CardInvoice, canMarkPaid, outsidePaymentDate } from './card-invoices';
import { OnStored } from './finance-references-store';

/**
 * The invoice history of the card shown on Banks & Cards: every invoice with what paid it, newest first,
 * read from the API, which settles the oldest invoice first. Marks an invoice as paid by someone else
 * (a relative who paid it), for payments no statement will ever show. Provided by the page.
 */
@Injectable()
export class CardInvoicesStore {
  private readonly gateway = inject(AccountStatementsGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly shownCardId = signal<string | undefined>(undefined);
  private readonly invoiceList = signal<readonly CardInvoice[]>([]);
  private readonly loading = signal(false);
  private readonly loadFailed = signal(false);
  /** Counts requests, so the answer for a card no longer shown is dropped. */
  private request = 0;

  /** Today, `YYYY-MM-DD`: the open invoice is the one it falls in. */
  readonly today = isoDate(inject(Clock).now());
  /** The card's invoices, newest first. */
  readonly invoices = computed(() => [...this.invoiceList()].reverse());
  readonly isLoading = this.loading.asReadonly();
  readonly hasLoadFailed = this.loadFailed.asReadonly();

  /**
   * Shows the card's invoices; asking for the card already shown reads them again.
   * @example store.show('santander')
   */
  show(cardId: string): void {
    this.shownCardId.set(cardId);
    this.invoiceList.set([]);
    this.load();
  }

  /**
   * Reads the shown card's invoices again (after a payment was recorded or deleted elsewhere).
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    this.load();
  }

  /**
   * Records that someone else paid what is left of a closed invoice, dated on its due day; the list and
   * whatever `onStored` refreshes follow once it is stored. Does nothing for an invoice with nothing
   * left to pay.
   * @example store.markPaidByOthers(invoice, 'Sister', refreshBalances)
   */
  markPaidByOthers(invoice: CardInvoice, paidBy: string, onStored: OnStored): void {
    const cardId = this.shownCardId();
    if (cardId === undefined || !canMarkPaid(invoice) || paidBy.trim() === '') return;
    const payment: CardPayment = {
      id: this.ids.next(),
      cardId,
      paidBy: paidBy.trim(),
      date: outsidePaymentDate(invoice, this.today),
      amountCents: invoice.remainingCents,
    };
    this.gateway.savePayment(payment).subscribe({
      next: () => {
        this.load();
        onStored();
      },
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  private load(): void {
    const cardId = this.shownCardId();
    if (cardId === undefined) return;
    const request = ++this.request;
    this.loading.set(true);
    this.gateway.invoices(cardId, this.today).subscribe({
      next: (invoices) => this.arrived(request, invoices),
      error: (error: unknown) => this.failed(request, error),
    });
  }

  private arrived(request: number, invoices: readonly CardInvoice[]): void {
    if (request !== this.request) return;
    this.invoiceList.set(invoices);
    this.loading.set(false);
  }

  private failed(request: number, error: unknown): void {
    if (request !== this.request) return;
    this.loading.set(false);
    this.loadFailed.set(true);
    this.errorHandler.handleError(error);
  }
}
