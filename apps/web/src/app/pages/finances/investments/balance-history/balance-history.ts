import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { BalanceHistoryItem, balanceHistory } from '../../../../core/finances/balance-statement';
import { BalanceEntry, BalanceEntryKind } from '../../../../core/finances/investments';
import { formatSignedMoney } from '../../../../core/finances/money';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** How many lines the list shows at first, and how many more each press of its arrow adds. */
const PAGE_SIZE = 10;

/**
 * A list of the statement lines of the balance-tracked investments of some kinds (deposits and withdrawals,
 * or the yield and what is taken out of it), newest day first, each with a button to delete it.
 */
@Component({
  selector: 'app-balance-history',
  imports: [TranslatePipe],
  templateUrl: './balance-history.html',
  styleUrl: './balance-history.css',
})
export class BalanceHistory {
  readonly title = input.required<string>();
  readonly kinds = input.required<readonly BalanceEntryKind[]>();
  readonly entries = input.required<readonly BalanceEntry[]>();
  readonly investmentNames = input.required<ReadonlyMap<string, string>>();
  readonly remove = output<string>();

  private readonly locale = inject(LOCALE_ID);
  private readonly shown = signal(PAGE_SIZE);

  private readonly items = computed(() =>
    balanceHistory(this.entries(), this.kinds(), this.investmentNames()),
  );
  protected readonly visible = computed(() => this.items().slice(0, this.shown()));
  protected readonly hasMore = computed(() => this.items().length > this.shown());
  protected readonly isEmpty = computed(() => this.items().length === 0);

  protected showMore(): void {
    this.shown.update((count) => count + PAGE_SIZE);
  }

  protected detail(item: BalanceHistoryItem): string {
    return `${shortDateLabel(item.date, this.locale)} · ${item.investmentName} · ${item.label}`;
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }
}
