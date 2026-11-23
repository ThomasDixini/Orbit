import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { monthLabel } from '../../../../core/finances/transaction-month';
import { monthlyStatement, withheldCents } from '../../../../core/finances/balance-statement';
import { BalanceEntry, Investment } from '../../../../core/finances/investments';
import { formatMoney } from '../../../../core/finances/money';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** One row of the statement table, its figures already written as money. */
interface StatementRow {
  readonly month: string;
  readonly label: string;
  readonly opening: string;
  readonly inflows: string;
  readonly outflows: string;
  readonly yielded: string;
  readonly closing: string;
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
  /** The months the page filter keeps (`YYYY-MM`); every month of the entries when absent. */
  readonly months = input<readonly string[] | undefined>(undefined);

  private readonly locale = inject(LOCALE_ID);

  protected readonly rows = computed(() => this.describeRows());
  protected readonly withheld = computed(() => this.money(withheldCents(this.pickedEntries())));
  protected readonly hasWithheld = computed(() => withheldCents(this.pickedEntries()) > 0);

  private isShown(month: string): boolean {
    const shown = this.months();
    return shown === undefined || shown.includes(month);
  }

  private ownEntries(): readonly BalanceEntry[] {
    const ids = new Set(this.investments().map((investment) => investment.id));
    return this.entries().filter((entry) => ids.has(entry.investmentId));
  }

  private pickedEntries(): readonly BalanceEntry[] {
    return this.ownEntries().filter((entry) => this.isShown(entry.date.slice(0, 7)));
  }

  // Every month is worked out first because a month opens with the balance the one before it closed with.
  private describeRows(): StatementRow[] {
    return monthlyStatement(this.ownEntries(), this.today())
      .filter((month) => this.isShown(month.month))
      .map((month) => ({
        month: month.month,
        label: monthLabel(month.month, this.locale),
        opening: this.money(month.openingCents),
        inflows: this.money(month.inflowsCents),
        outflows: this.money(month.outflowsCents),
        yielded: this.money(month.yieldCents),
        closing: this.money(month.closingCents),
      }));
  }

  private money(cents: number): string {
    return formatMoney(cents, this.locale);
  }
}
