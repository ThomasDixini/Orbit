import { Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import {
  AccountMovement,
  moneyFlows,
  spendingByCategory,
} from '../../../../core/finances/account-activity';
import { AccountStatement, CardStatement } from '../../../../core/finances/account-statement';
import { Account, accountKindLabel } from '../../../../core/finances/finance-references';
import { InvoicePeriod } from '../../../../core/finances/invoice-cycle';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../../core/finances/money';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** Shown instead of a figure whose statement has not arrived yet. */
const PENDING_VALUE = '—';
const PERCENT = 100;

/** One figure of the stats row. */
interface AccountStat {
  readonly label: string;
  readonly value: string;
  readonly mark: 'income' | 'expense' | 'accent' | 'neutral';
}

/** One row of the spending breakdown, its bar as wide as its share of the largest row. */
interface SpendingRow {
  readonly name: string;
  readonly amount: string;
  readonly percent: number;
}

/**
 * The selected account in full: its figures, a card's limit use, the movements behind them and where
 * the money went by category. A bank account lists this month; a card lists its open invoice.
 */
@Component({
  selector: 'app-account-detail',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './account-detail.html',
  styleUrl: './account-detail.css',
})
export class AccountDetail {
  readonly account = input.required<Account>();
  readonly statement = input<AccountStatement | undefined>(undefined);
  readonly movements = input.required<readonly AccountMovement[]>();
  readonly categoryNames = input.required<ReadonlyMap<string, string>>();
  /** The month bank accounts list, spelled out (e.g. "October"). */
  readonly monthName = input.required<string>();
  /** Whether the month listed is the current one, which cannot be moved past. */
  readonly isCurrentMonth = input(true);
  /** The invoice a card lists: the open one or an earlier one. */
  readonly invoice = input<InvoicePeriod | undefined>(undefined);
  /** Whether the invoice listed is the open one, which cannot be moved past. */
  readonly isCurrentInvoice = input(true);
  /** Whether the month chosen is still being read. */
  readonly isLoadingMonth = input(false);
  /** Whether the card can be paid: there is a bank account to pay from. */
  readonly canPay = input(true);
  readonly edit = output();
  readonly pay = output();
  readonly previousMonth = output();
  readonly nextMonth = output();
  readonly removePayment = output<string>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly isCard = computed(() => this.account().kind === 'creditCard');
  protected readonly kindLabel = computed(() => accountKindLabel(this.account().kind));
  private readonly card = computed(() => this.statement()?.card);
  /** Whether the card lists an invoice that is not the open one. */
  private readonly isEarlierInvoice = computed(() => this.isCard() && !this.isCurrentInvoice());
  protected readonly stats = computed(() => {
    const card = this.card();
    if (!this.isCard()) return this.bankStats();
    if (card === undefined) return this.pendingCardStats();
    return this.isEarlierInvoice() ? this.earlierInvoiceStats() : this.cardStats(card);
  });
  protected readonly limitUse = computed(() => {
    const limitCents = this.account().card?.limitCents ?? 0;
    const card = this.card();
    if (card === undefined || limitCents <= 0 || this.isEarlierInvoice()) return undefined;
    const usedCents = Math.min(limitCents, Math.max(0, limitCents - card.availableLimitCents));
    const percent = Math.round((usedCents / limitCents) * PERCENT);
    const label = `${this.money(usedCents)} of ${this.money(limitCents)}`;
    return { percent, label };
  });
  protected readonly amountDue = computed(() => {
    const card = this.card();
    if (card === undefined || card.amountDueCents <= 0 || this.isEarlierInvoice()) return undefined;
    const closedOn = this.day(card.closedInvoice.closesOn);
    return `${this.money(card.amountDueCents)} is still due from the invoice that closed on ${closedOn} (due ${this.day(card.closedInvoice.dueOn)}).`;
  });
  protected readonly listTitle = computed(() => {
    if (!this.isCard()) return `Movements in ${this.monthName()}`;
    const invoice = this.invoice();
    if (this.isCurrentInvoice() || invoice === undefined) return 'Invoice items';
    return `Invoice closed on ${this.day(invoice.closesOn)}`;
  });
  protected readonly spendingTitle = computed(() =>
    this.isCard() ? 'Invoice spending by category' : 'Outflows by category',
  );
  protected readonly spending = computed(() => this.spendingRows());

  protected rowDetail(movement: AccountMovement): string {
    const category =
      movement.categoryId === undefined ? undefined : this.categoryNames().get(movement.categoryId);
    return [this.day(movement.date), category].filter((part) => part !== undefined).join(' · ');
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }

  private bankStats(): AccountStat[] {
    const balance = this.statement()?.balanceCents;
    const flows = moneyFlows(this.movements());
    const isCurrent = this.isCurrentMonth();
    return [
      { label: 'Balance', value: this.pendingOr(balance), mark: 'accent' },
      {
        label: isCurrent ? 'In this month' : `Received in ${this.monthName()}`,
        value: this.money(flows.inCents),
        mark: 'income',
      },
      {
        label: isCurrent ? 'Out this month' : `Spent in ${this.monthName()}`,
        value: this.money(flows.outCents),
        mark: 'expense',
      },
    ];
  }

  private cardStats(card: CardStatement): AccountStat[] {
    return [
      {
        label: 'Current invoice',
        value: this.pendingOr(card.openInvoice.amountCents),
        mark: 'expense',
      },
      { label: 'Closes on', value: this.day(card.openInvoice.closesOn), mark: 'neutral' },
      { label: 'Due on', value: this.day(card.openInvoice.dueOn), mark: 'neutral' },
      { label: 'Available limit', value: this.pendingOr(card.availableLimitCents), mark: 'accent' },
    ];
  }

  /** An earlier invoice has closed: what it came to is what its purchases add up to. */
  private earlierInvoiceStats(): AccountStat[] {
    const invoice = this.invoice();
    const totalCents = -this.movements().reduce((sum, movement) => sum + movement.amountCents, 0);
    return [
      { label: 'Invoice total', value: this.money(totalCents), mark: 'expense' },
      { label: 'Closed on', value: this.day(invoice?.closesOn ?? ''), mark: 'neutral' },
      { label: 'Due on', value: this.day(invoice?.dueOn ?? ''), mark: 'neutral' },
    ];
  }

  private pendingCardStats(): AccountStat[] {
    return ['Current invoice', 'Closes on', 'Due on', 'Available limit'].map((label) => ({
      label,
      value: PENDING_VALUE,
      mark: 'neutral',
    }));
  }

  private spendingRows(): SpendingRow[] {
    const totals = spendingByCategory(this.movements());
    const largest = totals[0]?.cents ?? 0;
    return totals.map((total) => ({
      name: this.categoryNames().get(total.categoryId) ?? 'Other',
      amount: this.money(total.cents),
      percent: Math.round((total.cents / largest) * PERCENT),
    }));
  }

  private pendingOr(cents: number | undefined): string {
    return cents === undefined ? PENDING_VALUE : formatBalance(cents, this.locale);
  }

  private money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  private day(isoDay: string): string {
    return shortDateLabel(isoDay, this.locale);
  }
}
