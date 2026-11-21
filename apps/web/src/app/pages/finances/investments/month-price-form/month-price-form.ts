import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** What the month price form fills in; the page adds the investment. */
export interface MonthPriceFields {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly cents: number;
}

const MONTH_LENGTH = 7;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The `YYYY-MM` month before the one of a `YYYY-MM-DD` day. */
function previousMonth(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, MONTH_LENGTH));
  const date = new Date(year, month - 2, 1);
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Inline form, opened from the row of an investment, to type what one unit of it was worth at the end of a
 * month, for the months the market source has no price for or gets wrong. A price already typed for the
 * same month is replaced.
 */
@Component({
  selector: 'app-month-price-form',
  imports: [TranslatePipe],
  templateUrl: './month-price-form.html',
  styleUrl: './month-price-form.css',
})
export class MonthPriceForm {
  readonly investmentName = input.required<string>();
  /** Today, `YYYY-MM-DD`: a month that has not started cannot be priced. */
  readonly today = input.required<string>();
  readonly saving = input(false);
  readonly save = output<MonthPriceFields>();
  readonly dismiss = output();

  protected readonly price = signal('');
  /** The month before the current one at first, the latest that is already closed. */
  protected readonly month = linkedSignal(() => previousMonth(this.today()));
  protected readonly lastMonth = computed(() => this.today().slice(0, MONTH_LENGTH));

  private readonly priceCents = computed(() => parseAmountCents(this.price()));
  protected readonly priceError = computed(() =>
    this.price().trim() !== '' && !isValidAmount(this.priceCents())
      ? 'Enter a price above zero, like 31.00.'
      : undefined,
  );
  protected readonly canSave = computed(
    () =>
      isValidAmount(this.priceCents()) &&
      MONTH_PATTERN.test(this.month()) &&
      this.month() <= this.lastMonth() &&
      !this.saving(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.priceCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.save.emit({ month: this.month(), cents });
    // The form stays open to type the next month; saving the same month twice only replaces its price.
    this.price.set('');
  }

  protected readonly valueOf = fieldValue;
}
