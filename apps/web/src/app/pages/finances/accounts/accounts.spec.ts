import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { AccountStatementsGateway } from '../../../core/finances/account-statements-gateway';
import {
  FakeAccountStatementsGateway,
  SAMPLE_STATEMENTS,
} from '../../../core/finances/fake-account-statements-gateway';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
  SAMPLE_OCTOBER,
} from '../../../core/finances/fake-finances-gateways';
import { Transaction } from '../../../core/finances/transaction';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from '../../../core/finances/transactions-gateway';
import { IdGenerator } from '../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../core/ids/sequential-id-generator';
import { Accounts } from './accounts';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function render(
  statements = new FakeAccountStatementsGateway(),
  references = new FakeFinanceReferencesGateway(),
  transactions = new FakeTransactionsGateway(),
): ComponentFixture<Accounts> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AccountStatementsGateway, useValue: statements },
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: references },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(Accounts);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<Accounts>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function texts(fixture: ComponentFixture<Accounts>, selector: string): string[] {
  return [...element(fixture).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

function click(fixture: ComponentFixture<Accounts>, selector: string, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>(selector)];
  buttons.find((button) => button.textContent?.includes(label))!.click();
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<Accounts>, formLabel: string): void {
  element(fixture)
    .querySelector<HTMLButtonElement>(`form[aria-label="${formLabel}"] [type="submit"]`)!
    .click();
  fixture.detectChanges();
}

describe('Banks & Cards page', () => {
  it('sums up the accounts and the cards in the heading', () => {
    const fixture = render();

    expect(texts(fixture, 'app-page-heading .description')).toEqual([
      'In accounts: R$10,028.60 · Open invoices: R$286.40',
    ]);
  });

  it('shows each balance and the card invoice on the tiles', () => {
    const fixture = render();

    expect(texts(fixture, '.tile .figure span')).toEqual([
      'Balance',
      'R$10,028.60',
      'Current invoice · due Nov 10',
      'R$286.40',
    ]);
  });

  it('leads a card tile with what is still due from a closed invoice', () => {
    const statements = new FakeAccountStatementsGateway();
    const [checking, card] = SAMPLE_STATEMENTS;
    statements.statementsToServe = [
      checking,
      { ...card, card: { ...card.card!, amountDueCents: 41250 } },
    ];
    const fixture = render(statements);

    expect(texts(fixture, '.tile.card .figure span')).toEqual(['To pay · due Oct 10', 'R$412.50']);
  });

  it("details the first bank account with this month's movements and outflows", () => {
    const fixture = render();

    expect([
      texts(fixture, '.stat-value'),
      texts(fixture, '.row .description'),
      texts(fixture, '.spending-text span'),
    ]).toEqual([
      ['R$10,028.60', 'R$9,500.00', 'R$471.40'],
      ['Farmácia', 'Invoice payment · Credit card', 'Salary'],
      ['Health', 'R$58.90'],
    ]);
  });

  it("details a card's open invoice, its items and how much of the limit is used", () => {
    const fixture = render();

    click(fixture, '.tile', 'Credit card');

    expect([
      texts(fixture, '.stat-value'),
      texts(fixture, '.row .description'),
      texts(fixture, '.limit-text span'),
    ]).toEqual([
      ['R$286.40', 'Nov 3', 'Nov 10', 'R$4,713.60'],
      ['Groceries'],
      ['Limit used', 'R$286.40 of R$5,000.00'],
    ]);
  });

  it('adds a bank account, selects it and asks for the balances again', () => {
    const statements = new FakeAccountStatementsGateway();
    const fixture = render(statements);
    click(fixture, '.ui-button-ghost', 'Add account or card');
    const name = element(fixture).querySelector<HTMLInputElement>('input[name="name"]')!;
    name.value = 'Nubank';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submit(fixture, 'New account');

    expect([texts(fixture, '#account-detail-title'), statements.askedStatements.length]).toEqual([
      ['Nubank'],
      2,
    ]);
  });

  it('pays the card invoice with the suggested amount', () => {
    const statements = new FakeAccountStatementsGateway();
    const fixture = render(statements);
    click(fixture, '.tile', 'Credit card');
    click(fixture, '.ui-button-primary', 'Pay invoice');

    submit(fixture, 'Pay Credit card');

    expect(statements.savedPayments).toEqual([
      {
        id: 'id-1',
        cardId: 'credit-card',
        fromAccountId: 'checking-account',
        date: '2026-10-31',
        amountCents: 28640,
      },
    ]);
  });

  it('deletes a card payment from the bank account it was paid from', () => {
    const statements = new FakeAccountStatementsGateway();
    const fixture = render(statements);

    element(fixture)
      .querySelector<HTMLButtonElement>('[aria-label^="Delete Invoice payment"]')!
      .click();
    fixture.detectChanges();

    expect([statements.deletedPayments, texts(fixture, '.row .description')]).toEqual([
      ['september-invoice'],
      ['Farmácia', 'Salary'],
    ]);
  });

  it('offers to try again when the balances could not load', () => {
    const statements = new FakeAccountStatementsGateway();
    statements.failure = new Error('offline');
    const fixture = render(statements);

    expect(texts(fixture, 'app-load-failed p')).toEqual(["Couldn't load your accounts."]);
  });
});

const SEPTEMBER_LUNCH: Transaction = {
  id: 'september-lunch',
  date: '2026-09-12',
  description: 'Lunch',
  categoryId: 'food',
  accountId: 'checking-account',
  amountCents: -4200,
};

function renderWithSeptember(): ComponentFixture<Accounts> {
  const transactions = new FakeTransactionsGateway(
    new Map([
      ['2026-10', SAMPLE_OCTOBER],
      ['2026-09', [SEPTEMBER_LUNCH]],
    ]),
  );
  return render(
    new FakeAccountStatementsGateway(),
    new FakeFinanceReferencesGateway(),
    transactions,
  );
}

function clickByLabel(fixture: ComponentFixture<Accounts>, label: string): void {
  element(fixture).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
  fixture.detectChanges();
}

describe('Banks & Cards page month switch', () => {
  it('goes back a month and lists what that month had, with its own totals', () => {
    const fixture = renderWithSeptember();

    clickByLabel(fixture, 'Previous month');

    expect([
      texts(fixture, '.column-title')[0],
      texts(fixture, '.row .description'),
      texts(fixture, '.stat-label'),
      texts(fixture, '.stat-value').slice(1),
    ]).toEqual([
      'Movements in September',
      ['Lunch'],
      ['Balance', 'Received in September', 'Spent in September'],
      ['R$0.00', 'R$42.00'],
    ]);
  });

  it('cannot go past the current month, and comes back to it', () => {
    const fixture = renderWithSeptember();
    const nextIsDisabled = (): boolean =>
      element(fixture).querySelector<HTMLButtonElement>('button[aria-label="Next month"]')!
        .disabled;
    const states = [nextIsDisabled()];

    clickByLabel(fixture, 'Previous month');
    states.push(nextIsDisabled());
    clickByLabel(fixture, 'Next month');
    states.push(nextIsDisabled());

    expect([states, texts(fixture, '.column-title')[0]]).toEqual([
      [true, false, true],
      'Movements in October',
    ]);
  });

  it('switches invoices, not months, on a card', () => {
    const fixture = renderWithSeptember();

    click(fixture, '.tile', 'Credit card');

    expect([
      element(fixture).querySelector('button[aria-label="Previous invoice"]') === null,
      element(fixture).querySelector('button[aria-label="Previous month"]') === null,
    ]).toEqual([false, true]);
  });
});

const SEPTEMBER_DINNER: Transaction = {
  id: 'september-dinner',
  date: '2026-09-12',
  description: 'Dinner',
  categoryId: 'food',
  accountId: 'credit-card',
  amountCents: -9000,
};

function renderCardWithSeptember(): ComponentFixture<Accounts> {
  const fixture = render(
    new FakeAccountStatementsGateway(),
    new FakeFinanceReferencesGateway(),
    new FakeTransactionsGateway(
      new Map([
        ['2026-10', SAMPLE_OCTOBER],
        ['2026-09', [SEPTEMBER_DINNER]],
      ]),
    ),
  );
  click(fixture, '.tile', 'Credit card');
  return fixture;
}

describe('Banks & Cards page invoice switch', () => {
  it('goes back an invoice and lists its purchases with the total it came to', () => {
    const fixture = renderCardWithSeptember();

    clickByLabel(fixture, 'Previous invoice');

    expect([
      texts(fixture, '.column-title')[0],
      texts(fixture, '.row .description'),
      texts(fixture, '.stat-label'),
      texts(fixture, '.stat-value'),
      element(fixture).querySelector('.limit'),
    ]).toEqual([
      'Invoice closed on Oct 3',
      ['Dinner'],
      ['Invoice total', 'Closed on', 'Due on'],
      ['R$90.00', 'Oct 3', 'Oct 10'],
      null,
    ]);
  });

  it('cannot go past the open invoice, and comes back to it', () => {
    const fixture = renderCardWithSeptember();
    const nextIsDisabled = (): boolean =>
      element(fixture).querySelector<HTMLButtonElement>('button[aria-label="Next invoice"]')!
        .disabled;
    const states = [nextIsDisabled()];

    clickByLabel(fixture, 'Previous invoice');
    states.push(nextIsDisabled());
    clickByLabel(fixture, 'Next invoice');
    states.push(nextIsDisabled());

    expect([
      states,
      texts(fixture, '.column-title')[0],
      texts(fixture, '.row .description'),
    ]).toEqual([[true, false, true], 'Invoice items', ['Groceries']]);
  });
});
