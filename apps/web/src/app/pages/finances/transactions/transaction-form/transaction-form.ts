import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import { Account, FinanceCategory } from '../../../../core/finances/finance-references';
import { amountText, isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import {
  TRANSACTION_TYPE_OPTIONS,
  Transaction,
  TransactionDraft,
  TransactionType,
  signedCents,
  typeOf,
} from '../../../../core/finances/transaction';
import {
  Bill,
  BillDraft,
  BillSettlement,
  MAX_REPEAT_COUNT,
  MIN_REPEAT_COUNT,
} from '../../../../core/finances/bills';
import {
  billKindOf,
  installmentBills,
  isValidInstallmentCount,
  monthAfter,
} from '../../../../core/finances/installment-purchase';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** The bill a new transaction pays or receives, and when and through which account. */
export interface BillLink {
  readonly billId: string;
  readonly settlement: BillSettlement;
}

type EntryMode = 'single' | 'installments';

/**
 * Inline form above the transactions list: expense or income, amount, description, category,
 * account and day. Records a new transaction, or edits (and deletes) the one given in `transaction`.
 * A new one can also be paid in installments (it becomes one bill to pay or receive per month) or be
 * linked to an open bill, which it then settles.
 */
@Component({
  selector: 'app-transaction-form',
  imports: [TranslatePipe],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.css',
})
export class TransactionForm {
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly accounts = input.required<readonly Account[]>();
  /** The day a new transaction starts on. */
  readonly defaultDate = input.required<string>();
  /** The account a new transaction starts on, usually the last one used. */
  readonly defaultAccountId = input<string>();
  /** The transaction being edited; leave unset to record a new one. */
  readonly transaction = input<Transaction | undefined>(undefined);
  /** The open bills a new transaction can be linked to. */
  readonly openBills = input<readonly Bill[]>([]);
  readonly save = output<TransactionDraft>();
  readonly saveInstallments = output<BillDraft>();
  readonly settleBill = output<BillLink>();
  readonly dismiss = output();
  readonly remove = output();
  /** The edited expense was really the payment of this card's invoice. */
  readonly convertToCardPayment = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The form opens at the top of the page, which can be far from the row that opened it: put the
    // cursor in the amount, the field typed first, so the user lands on it.
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="amount"]')?.focus(),
    );
  }

  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;
  protected readonly minCount = MIN_REPEAT_COUNT;
  protected readonly maxCount = MAX_REPEAT_COUNT;
  protected readonly mode = signal<EntryMode>('single');
  protected readonly installmentCount = signal('6');
  protected readonly firstDueDate = linkedSignal(() => monthAfter(this.date()));
  protected readonly billId = signal('');
  protected readonly isEditing = computed(() => this.transaction() !== undefined);
  // Linked to the transaction so the fields refill when the form is pointed at another one.
  protected readonly type = linkedSignal<TransactionType>(() => {
    const transaction = this.transaction();
    return transaction === undefined ? 'expense' : typeOf(transaction);
  });
  protected readonly amount = linkedSignal(() => {
    const transaction = this.transaction();
    return transaction === undefined ? '' : amountText(transaction.amountCents);
  });
  protected readonly description = linkedSignal(() => this.transaction()?.description ?? '');
  protected readonly categoryId = linkedSignal(() => this.transaction()?.categoryId ?? '');
  protected readonly accountId = linkedSignal(
    () => this.transaction()?.accountId ?? this.defaultAccountId() ?? '',
  );
  protected readonly date = linkedSignal(() => this.transaction()?.date ?? this.defaultDate());

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  /** Said only once something was typed, so an empty new form does not open on an error. */
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 286.40.'
      : undefined,
  );
  protected readonly isInstallments = computed(() => this.mode() === 'installments');
  protected readonly linkableBills = computed(() =>
    this.openBills().filter((bill) => bill.kind === billKindOf(this.type())),
  );
  protected readonly linkedBill = computed(() =>
    this.linkableBills().find((bill) => bill.id === this.billId()),
  );
  protected readonly countError = computed(() =>
    this.isInstallments() && !isValidInstallmentCount(this.installmentCount())
      ? `Enter a whole number from ${MIN_REPEAT_COUNT} to ${MAX_REPEAT_COUNT}.`
      : undefined,
  );
  protected readonly canSave = computed(() => this.hasDetails() && this.hasPlace());
  protected readonly cards = computed(() =>
    this.accounts().filter((account) => account.kind === 'creditCard'),
  );
  /** An expense stored on a bank account can turn out to be a card invoice payment. */
  protected readonly canBeInvoicePayment = computed(() => {
    const stored = this.transaction();
    const account = this.accounts().find((current) => current.id === stored?.accountId);
    const isBankExpense = stored !== undefined && stored.amountCents < 0;
    return isBankExpense && account?.kind === 'bankAccount' && this.cards().length > 0;
  });
  protected readonly isPickingCard = signal(false);
  protected readonly paidCardId = linkedSignal(() => this.cards()[0]?.id ?? '');

  protected confirmCardPayment(): void {
    if (this.paidCardId() === '') return;
    this.convertToCardPayment.emit(this.paidCardId());
  }
  protected readonly submitLabel = computed(() => {
    if (this.isEditing()) return 'Save transaction';
    if (this.isInstallments()) return 'Add installments';
    return this.linkedBill() === undefined ? 'Add transaction' : 'Settle the bill';
  });

  private hasDetails(): boolean {
    return (
      this.countError() === undefined &&
      isValidAmount(this.amountCents()) &&
      this.description().trim() !== '' &&
      this.categoryId() !== ''
    );
  }

  // Installments are bills, which have no account until they are paid; the rest needs one and a day.
  private hasPlace(): boolean {
    if (this.isInstallments()) return this.firstDueDate() !== '';
    return this.accountId() !== '' && this.date() !== '';
  }

  protected pickType(type: TransactionType): void {
    this.type.set(type);
    this.billId.set('');
  }

  protected pickMode(mode: EntryMode): void {
    this.mode.set(mode);
    this.billId.set('');
  }

  /** Takes the amount, description and category from the bill, which is what gets paid or received. */
  protected pickBill(billId: string): void {
    this.billId.set(billId);
    const bill = this.linkedBill();
    if (bill === undefined) return;
    this.amount.set(amountText(bill.amountCents));
    this.description.set(bill.description);
    this.categoryId.set(bill.categoryId);
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    if (this.isInstallments()) this.emitInstallments(cents);
    else if (this.linkedBill() !== undefined) this.emitLink();
    else this.emitTransaction(cents);
  }

  private emitInstallments(totalCents: number): void {
    this.saveInstallments.emit(
      installmentBills({
        type: this.type(),
        description: this.description().trim(),
        categoryId: this.categoryId(),
        totalCents,
        count: Number(this.installmentCount()),
        firstDueDate: this.firstDueDate(),
      }),
    );
  }

  private emitLink(): void {
    this.settleBill.emit({
      billId: this.billId(),
      settlement: { date: this.date(), accountId: this.accountId() },
    });
  }

  private emitTransaction(cents: number): void {
    this.save.emit({
      date: this.date(),
      description: this.description().trim(),
      categoryId: this.categoryId(),
      accountId: this.accountId(),
      amountCents: signedCents(cents, this.type()),
    });
  }

  protected readonly valueOf = fieldValue;
}
