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
import {
  BALANCE_ENTRY_KIND_OPTIONS,
  BalanceEntryDraft,
  BalanceEntryKind,
} from '../../../../core/finances/investments';
import { isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** What the balance entry form fills in; the page adds the investment. */
export type BalanceEntryFields = Omit<BalanceEntryDraft, 'investmentId'>;

/**
 * Inline form to add a line to the statement of a balance-tracked investment: a deposit, a withdrawal, the
 * yield, what was taken out of it (income tax, IOF, fees) or the opening balance, with its amount and day.
 */
@Component({
  selector: 'app-balance-entry-form',
  imports: [TranslatePipe],
  templateUrl: './balance-entry-form.html',
  styleUrl: './balance-entry-form.css',
})
export class BalanceEntryForm {
  readonly investmentName = input.required<string>();
  readonly today = input.required<string>();
  readonly saving = input(false);
  readonly save = output<BalanceEntryFields>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="amount"]')?.focus(),
    );
  }

  protected readonly kindOptions = BALANCE_ENTRY_KIND_OPTIONS;
  protected readonly kind = signal<BalanceEntryKind>('deposit');
  protected readonly amount = signal('');
  protected readonly date = linkedSignal(() => this.today());

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 884.00.'
      : undefined,
  );
  protected readonly canSave = computed(
    () => isValidAmount(this.amountCents()) && this.date() !== '' && !this.saving(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.save.emit({ date: this.date(), kind: this.kind(), amountCents: cents });
  }

  protected readonly valueOf = fieldValue;
}
