import { Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { LoadFailed } from '../../../../components/load-failed/load-failed';
import {
  MAX_RATE_NAME_LENGTH,
  PERIOD_RATE_KIND_OPTIONS,
  PeriodRate,
  PeriodRateKind,
  basisPointsText,
  customRateNames,
  parseBasisPoints,
  periodRateKindLabel,
} from '../../../../core/finances/period-rates';
import { PeriodRatesStore } from '../../../../core/finances/period-rates-store';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

const MONTH_LENGTH = 7;

/**
 * Where the user types the rate of each month (Selic, IPCA, income tax), so the return chart can compare
 * the portfolio with them. Reads and writes through the page's {@link PeriodRatesStore}; saving a kind and
 * month that already has a rate replaces it.
 * @example <app-period-rates [today]="today" />
 */
@Component({
  selector: 'app-period-rates',
  imports: [TranslatePipe, LoadFailed],
  templateUrl: './period-rates.html',
  styleUrl: './period-rates.css',
})
export class PeriodRates {
  /** Today, `YYYY-MM-DD`: the month a new rate is for until changed. */
  readonly today = input.required<string>();

  private readonly store = inject(PeriodRatesStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly savesAtSubmit = signal(0);

  protected readonly rates = this.store.rates;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly hasActionFailed = this.store.hasActionFailed;
  protected readonly kindOptions = PERIOD_RATE_KIND_OPTIONS;
  protected readonly kind = signal<PeriodRateKind>('selic');
  protected readonly name = signal('');
  protected readonly maxNameLength = MAX_RATE_NAME_LENGTH;
  protected readonly customNames = computed(() => customRateNames(this.rates()));
  protected readonly isCustom = computed(() => this.kind() === 'custom');
  protected readonly month = signal('');
  protected readonly value = signal('');

  private readonly basisPoints = computed(() => parseBasisPoints(this.value()));
  protected readonly valueError = computed(() =>
    this.value().trim() !== '' && this.basisPoints() === undefined
      ? 'Enter a rate between -10 and 100, like 13 or 0,52.'
      : undefined,
  );
  protected readonly canSave = computed(
    () =>
      this.month().length === MONTH_LENGTH &&
      this.basisPoints() !== undefined &&
      (!this.isCustom() || this.name().trim() !== ''),
  );

  constructor() {
    effect(() =>
      this.month.update((month) => (month === '' ? this.today().slice(0, MONTH_LENGTH) : month)),
    );
    // The value is cleared once the API has accepted the save, so the next rate can be typed.
    effect(() => {
      if (this.store.savedCount() > this.savesAtSubmit()) this.value.set('');
    });
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const basisPoints = this.basisPoints();
    if (basisPoints === undefined || !this.canSave()) return;
    this.savesAtSubmit.set(this.store.savedCount());
    this.store.save(this.kind(), this.month(), {
      basisPoints,
      ...(this.isCustom() ? { name: this.name().trim() } : {}),
    });
  }

  protected edit(rate: PeriodRate): void {
    this.kind.set(rate.kind);
    this.name.set(rate.name ?? '');
    this.month.set(rate.month);
    this.value.set(basisPointsText(rate.basisPoints));
  }

  protected remove(rate: PeriodRate): void {
    this.store.remove(rate.kind, rate.month, rate.name);
  }

  protected reload(): void {
    this.store.reload();
  }

  protected kindLabel(rate: PeriodRate): string {
    return rate.kind === 'custom' && rate.name ? rate.name : periodRateKindLabel(rate.kind);
  }

  protected rateText(rate: PeriodRate): string {
    return `${basisPointsText(rate.basisPoints)}%`;
  }

  protected monthLabel(rate: PeriodRate): string {
    const [year, month] = rate.month.split('-').map(Number);
    return new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );
  }

  protected readonly valueOf = fieldValue;
}
