import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { formatPercent } from '../../../../core/finances/investments';
import { afterIncomeTax } from '../../../../core/finances/period-rates';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

const BASIS_POINTS_PER_PERCENT = 100;

/**
 * The return of the period before and after the income tax, next to the CDI after the same tax, so a net
 * balance can be told from a gross rate. Without a tax rate typed it only says the figures are gross.
 * @example <app-return-after-tax [returnPercent]="9" [cdiPercent]="8" [taxBasisPoints]="1500" />
 */
@Component({
  selector: 'app-return-after-tax',
  imports: [TranslatePipe],
  templateUrl: './return-after-tax.html',
  styleUrl: './return-after-tax.css',
})
export class ReturnAfterTax {
  private readonly locale = inject(LOCALE_ID);

  readonly returnPercent = input.required<number>();
  /** The CDI over the same money and period; absent when it is not known. */
  readonly cdiPercent = input<number | undefined>(undefined);
  /** The income tax rate typed, in basis points; absent when none was typed. */
  readonly taxBasisPoints = input<number | undefined>(undefined);

  protected readonly figures = computed(() => this.describe());

  private describe(): Record<string, string> | undefined {
    const tax = this.taxBasisPoints();
    if (tax === undefined) return undefined;
    const cdi = this.cdiPercent();
    return {
      rate: `${tax / BASIS_POINTS_PER_PERCENT}%`,
      gross: formatPercent(this.returnPercent(), this.locale),
      net: formatPercent(afterIncomeTax(this.returnPercent(), tax), this.locale),
      cdiNet: cdi === undefined ? '—' : formatPercent(afterIncomeTax(cdi, tax), this.locale),
    };
  }
}
