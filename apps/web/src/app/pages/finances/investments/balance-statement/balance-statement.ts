import { Component, LOCALE_ID, computed, inject, input, signal } from '@angular/core';
import { monthLabel } from '../../../../core/finances/transaction-month';
import { monthlyStatement } from '../../../../core/finances/balance-statement';
import { BalanceEntry, Investment } from '../../../../core/finances/investments';
import { formatMoney } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** The value of the investment picker that means "all the balance-tracked investments". */
const ALL = '';

/** One row of the statement table, its figures already written as money. */
interface StatementRow {
  readonly month: string;
  readonly label: string;
  readonly opening: string;
  readonly inflows: string;
  readonly outflows: string;
  readonly yielded: string;
  readonly taxes: string;
  readonly fees: string;
  readonly closing: string;
  readonly net: string;
}

/**
 * The statement of the balance-tracked investments month by month, the way a bank shows it: the balance
 * the month opened with, what came in and went out, the yield, what was taken out of it (income tax, IOF)
 * and fees, and the balance it closed with. It can be narrowed to one investment.
 */
@Component({
  selector: 'app-balance-statement',
  imports: [TranslatePipe],
  templateUrl: './balance-statement.html',
  styleUrl: './balance-statement.css',
})
export class BalanceStatement {
  readonly investments = input.required<readonly Investment[]>();
  readonly entries = input.required<readonly BalanceEntry[]>();
  readonly today = input.required<string>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly all = ALL;
  protected readonly picked = signal(ALL);
  protected readonly rows = computed(() => this.describeRows());

  protected pick(event: Event): void {
    this.picked.set(fieldValue(event));
  }

  private describeRows(): StatementRow[] {
    const picked = this.picked();
    const own =
      picked === ALL
        ? this.entries()
        : this.entries().filter((entry) => entry.investmentId === picked);
    return monthlyStatement(own, this.today()).map((month) => ({
      month: month.month,
      label: monthLabel(month.month, this.locale),
      opening: this.money(month.openingCents),
      inflows: this.money(month.inflowsCents),
      outflows: this.money(month.outflowsCents),
      yielded: this.money(month.yieldCents),
      taxes: this.money(month.taxesCents),
      fees: this.money(month.feesCents),
      closing: this.money(month.closingCents),
      net: this.money(month.yieldCents - month.taxesCents - month.feesCents),
    }));
  }

  private money(cents: number): string {
    return formatMoney(cents, this.locale);
  }
}
