import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
} from '../../../core/finances/fake-finances-gateways';
import { Transaction } from '../../../core/finances/transaction';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from '../../../core/finances/transactions-gateway';
import { SpendingHistoryPage } from './spending-history';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function expense(id: string, date: string, cents: number, description: string): Transaction {
  return {
    id,
    date,
    description,
    categoryId: 'food',
    accountId: 'checking-account',
    amountCents: -cents,
  };
}

/** Food every month from June to October; October is far above the rest. */
function foodMonths(): ReadonlyMap<string, readonly Transaction[]> {
  return new Map([
    ['2026-06', [expense('jun', '2026-06-05', 30000, 'Supermarket')]],
    ['2026-07', [expense('jul', '2026-07-05', 31000, 'Supermarket')]],
    ['2026-08', [expense('aug', '2026-08-05', 29000, 'Supermarket')]],
    ['2026-09', [expense('sep', '2026-09-05', 30000, 'Supermarket')]],
    [
      '2026-10',
      [
        expense('oct', '2026-10-05', 30000, 'Supermarket'),
        expense('feast', '2026-10-20', 60000, 'Barbecue - Parcela 1 de 2'),
      ],
    ],
  ]);
}

function render(
  transactions = new FakeTransactionsGateway(foodMonths()),
): ComponentFixture<SpendingHistoryPage> {
  TestBed.configureTestingModule({
    providers: [
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(SpendingHistoryPage);
  fixture.detectChanges();
  return fixture;
}

function texts(fixture: ComponentFixture<SpendingHistoryPage>, selector: string): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

describe('Spending history page', () => {
  it('lists each category with its pattern, average and a column for every month', () => {
    const fixture = render();

    expect(texts(fixture, 'tbody th .name')).toEqual(['Food']);
    expect(texts(fixture, 'thead th').length).toBe(1 + 12 + 2);
    expect(texts(fixture, 'tbody .ui-tag')).toEqual(['Variable']);
  });

  it('highlights the month far above what the category usually takes', () => {
    const fixture = render();

    expect(texts(fixture, 'tbody td.unusual')).toEqual(['R$900.00']);
  });

  it('totals every month', () => {
    const fixture = render();

    expect(texts(fixture, 'tfoot td.number').filter((total) => total !== '—')).toEqual([
      'R$300.00',
      'R$310.00',
      'R$290.00',
      'R$300.00',
      'R$900.00',
    ]);
  });

  it('shows what a category is made of when it is chosen, and hides it when chosen again', () => {
    const fixture = render();
    const choose = (): void => {
      ((fixture.nativeElement as HTMLElement).querySelector('tbody .name') as HTMLElement).click();
      fixture.detectChanges();
    };

    choose();
    const opened = texts(fixture, '[aria-label="What the category is made of"] tbody th');
    choose();

    expect([opened, texts(fixture, '[aria-label="What the category is made of"]')]).toEqual([
      ['Supermarket', 'Barbecue'],
      [],
    ]);
  });

  it('says so when nothing was spent in the period', () => {
    const fixture = render(new FakeTransactionsGateway(new Map()));

    expect(texts(fixture, '.empty')).toEqual(['Nothing spent in this period.']);
  });

  it('offers to try again when the history does not load', () => {
    const gateway = new FakeTransactionsGateway();
    gateway.failure = new Error('offline');
    const fixture = render(gateway);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining("Couldn't load your spending history."),
    ]);
  });
});
