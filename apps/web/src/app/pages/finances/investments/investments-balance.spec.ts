import { ErrorHandler, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { FakeInvestmentAnalysesGateway } from '../../../core/finances/fake-investment-analyses-gateway';
import { FakeInvestmentNotesGateway } from '../../../core/finances/fake-investment-notes-gateway';
import {
  FakeInvestmentsGateway,
  SAMPLE_PORTFOLIO,
} from '../../../core/finances/fake-investments-gateway';
import { FakePeriodRatesGateway } from '../../../core/finances/fake-period-rates-gateway';
import { InvestmentAnalysesGateway } from '../../../core/finances/investment-analyses-gateway';
import { InvestmentNotesGateway } from '../../../core/finances/investment-notes-gateway';
import { Portfolio } from '../../../core/finances/investments';
import { InvestmentsGateway } from '../../../core/finances/investments-gateway';
import { PeriodRatesGateway } from '../../../core/finances/period-rates-gateway';
import { IdGenerator } from '../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../core/ids/sequential-id-generator';
import { Investments } from './investments';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

/** Lets the store's promises settle (they are not tracked by the fixture), then redraws. */
async function flush(fixture: ComponentFixture<Investments>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

async function render(portfolio: Portfolio): Promise<{
  fixture: ComponentFixture<Investments>;
  gateway: FakeInvestmentsGateway;
}> {
  const gateway = new FakeInvestmentsGateway();
  gateway.portfolioToServe = portfolio;
  TestBed.configureTestingModule({
    providers: [
      { provide: InvestmentsGateway, useValue: gateway },
      { provide: InvestmentNotesGateway, useValue: new FakeInvestmentNotesGateway() },
      { provide: InvestmentAnalysesGateway, useValue: new FakeInvestmentAnalysesGateway() },
      { provide: PeriodRatesGateway, useValue: new FakePeriodRatesGateway() },
      { provide: LOCALE_ID, useValue: 'en-US' },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(Investments);
  fixture.detectChanges();
  await flush(fixture);
  return { fixture, gateway };
}

function texts(fixture: ComponentFixture<Investments>, selector: string): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

async function clickButton(fixture: ComponentFixture<Investments>, label: string): Promise<void> {
  const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  buttons
    .find(
      (button) =>
        button.getAttribute('aria-label') === label || button.textContent?.trim() === label,
    )!
    .click();
  fixture.detectChanges();
  await flush(fixture);
}

function fill(fixture: ComponentFixture<Investments>, selector: string, value: string): void {
  const field = (fixture.nativeElement as HTMLElement).querySelector<
    HTMLInputElement | HTMLSelectElement
  >(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  field.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

async function submit(fixture: ComponentFixture<Investments>, formLabel: string): Promise<void> {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>(`form[aria-label="${formLabel}"] [type="submit"]`)!
    .click();
  fixture.detectChanges();
  await flush(fixture);
}

const CDB = { id: 'cdb', name: 'CDB Demo', kind: 'fixedIncome' as const };
const CAIXINHA = {
  id: 'caixinha',
  name: 'Caixinha Nubank',
  kind: 'fixedIncome' as const,
  tracking: 'balance' as const,
};

const WITH_SOLD_CDB: Portfolio = {
  ...SAMPLE_PORTFOLIO,
  lines: [
    ...SAMPLE_PORTFOLIO.lines,
    { investment: CDB, quantityThousandths: 0, costCents: 0, valueCents: 0, incomeCents: 879 },
  ],
  trades: [
    ...SAMPLE_PORTFOLIO.trades,
    {
      id: 'buy-cdb',
      investmentId: 'cdb',
      date: '2025-01-08',
      kind: 'buy',
      quantityThousandths: 15_000_000,
      unitPriceCents: 1,
    },
    {
      id: 'sell-cdb',
      investmentId: 'cdb',
      date: '2026-07-10',
      kind: 'sell',
      quantityThousandths: 15_000_000,
      unitPriceCents: 1,
    },
  ],
};

const WITH_CAIXINHA: Portfolio = {
  ...SAMPLE_PORTFOLIO,
  lines: [
    ...SAMPLE_PORTFOLIO.lines,
    {
      investment: CAIXINHA,
      quantityThousandths: 1000,
      costCents: 325_751,
      valueCents: 333_807,
      gainCents: 8_056,
      incomeCents: 0,
    },
  ],
  balanceEntries: [
    {
      id: 'opening',
      investmentId: 'caixinha',
      date: '2025-12-01',
      kind: 'opening',
      amountCents: 237_351,
    },
    {
      id: 'deposit',
      investmentId: 'caixinha',
      date: '2025-12-09',
      kind: 'deposit',
      amountCents: 88_400,
    },
    {
      id: 'yield',
      investmentId: 'caixinha',
      date: '2025-12-31',
      kind: 'yield',
      amountCents: 4_024,
    },
    {
      id: 'tax',
      investmentId: 'caixinha',
      date: '2025-12-31',
      kind: 'incomeTax',
      amountCents: 600,
    },
  ],
};

describe('Investments page: sold investments', () => {
  it('leaves an investment that was sold out of the assets and keeps its movements', async () => {
    const { fixture } = await render(WITH_SOLD_CDB);

    expect(texts(fixture, 'tr.holding .name')).toEqual(['PETR4', 'XPML11']);
    expect(texts(fixture, '.movement .name').filter((text) => text.includes('CDB Demo'))).toEqual([
      expect.stringContaining('Sell 15000'),
      expect.stringContaining('Buy 15000'),
    ]);
  });

  it('offers to show the sold ones, and hides them again', async () => {
    const { fixture } = await render(WITH_SOLD_CDB);

    await clickButton(fixture, 'Show closed investments (1)');
    const shown = texts(fixture, 'tr.holding .name');
    await clickButton(fixture, 'Hide closed investments');

    expect([shown, texts(fixture, 'tr.holding .name')]).toEqual([
      ['PETR4', 'XPML11', 'CDB Demo'],
      ['PETR4', 'XPML11'],
    ]);
  });

  it('has no such button when nothing was sold', async () => {
    const { fixture } = await render(SAMPLE_PORTFOLIO);

    expect(texts(fixture, '.closed-toggle')).toEqual([]);
  });
});

describe('Investments page: investments followed by balance', () => {
  it('shows an investment followed by balance without units or price, and with a statement line button', async () => {
    const { fixture } = await render(WITH_CAIXINHA);

    const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'tr.holding[data-kind="fixedIncome"]',
    )!;

    expect([
      row.querySelector('.name')?.textContent?.trim(),
      row.querySelector('td[colspan="3"]')?.textContent?.trim(),
      [...row.querySelectorAll('.actions button')].map((button) => button.textContent?.trim()),
    ]).toEqual(['Caixinha Nubank', 'Followed by balance', ['Statement line', 'Edit']]);
  });

  it('shows the monthly statement and the two histories', async () => {
    const { fixture } = await render(WITH_CAIXINHA);

    expect([
      texts(fixture, 'app-balance-statement tbody tr th').filter(
        (month) => month === 'December 2025',
      ),
      texts(fixture, 'app-balance-history .card-title'),
      texts(fixture, 'app-balance-history .name'),
    ]).toEqual([
      ['December 2025'],
      ['Deposits and withdrawals', 'Yield and what is taken out of it'],
      [
        'Dec 9 · Caixinha Nubank · Deposit',
        'Dec 1 · Caixinha Nubank · Opening balance',
        'Dec 31 · Caixinha Nubank · Yield',
        'Dec 31 · Caixinha Nubank · Income tax (IR)',
      ],
    ]);
  });

  it('shows no statement when no investment is followed by balance', async () => {
    const { fixture } = await render(SAMPLE_PORTFOLIO);

    expect(texts(fixture, 'app-balance-statement, app-balance-history')).toEqual([]);
  });

  it('records a statement line for the investment and reads the portfolio again', async () => {
    const { fixture, gateway } = await render(WITH_CAIXINHA);

    await clickButton(fixture, 'Add a statement line to Caixinha Nubank');
    fill(fixture, 'select[name="kind"]', 'yield');
    fill(fixture, 'input[name="amount"]', '46,32');
    fill(fixture, 'input[name="date"]', '2026-01-31');
    await submit(fixture, 'Statement line of Caixinha Nubank');

    expect([gateway.savedBalanceEntries, gateway.askedDays.length]).toEqual([
      [
        {
          id: 'id-1',
          draft: {
            investmentId: 'caixinha',
            date: '2026-01-31',
            kind: 'yield',
            amountCents: 4632,
          },
        },
      ],
      2,
    ]);
  });

  it('deletes a statement line', async () => {
    const { fixture, gateway } = await render(WITH_CAIXINHA);

    await clickButton(fixture, 'Delete Yield of Caixinha Nubank');

    expect(gateway.deletedBalanceEntries).toEqual(['yield']);
  });

  it('adds an investment followed by balance, with no price to type', async () => {
    const { fixture, gateway } = await render(SAMPLE_PORTFOLIO);

    await clickButton(fixture, 'Add investment');
    fill(fixture, 'input[name="name"]', 'RDB Nubank');
    fill(fixture, 'select[name="kind"]', 'fixedIncome');
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[name="tracking"]',
    )!;
    checkbox.click();
    fixture.detectChanges();
    const priceHidden =
      (fixture.nativeElement as HTMLElement).querySelector('input[name="price"]') === null;
    await submit(fixture, 'New investment');

    expect(priceHidden).toBe(true);
    expect(gateway.savedInvestments).toEqual([
      {
        id: 'id-1',
        draft: expect.objectContaining({
          name: 'RDB Nubank',
          kind: 'fixedIncome',
          price: undefined,
          tracking: 'balance',
        }),
      },
    ]);
  });
});

describe('Investments page: charts of one investment', () => {
  const WITH_HISTORY: Portfolio = {
    ...WITH_CAIXINHA,
    investmentHistories: {
      caixinha: [
        {
          month: '2026-10',
          valueCents: 1000,
          appliedCents: 900,
          returnPercent: 11.11,
          cdiPercent: 1,
        },
        {
          month: '2026-11',
          valueCents: 1100,
          appliedCents: 900,
          returnPercent: 22.22,
          cdiPercent: 2,
        },
      ],
    },
  };

  it('draws the charts of the investment picked from its own history', async () => {
    const { fixture } = await render(WITH_HISTORY);
    const before = texts(fixture, 'app-line-chart:nth-of-type(2) .empty');

    fill(fixture, 'select[name="asset"]', 'caixinha');
    await flush(fixture);

    expect([before, texts(fixture, 'app-line-chart:nth-of-type(2) .empty')]).toEqual([
      ['No history yet.'],
      [],
    ]);
  });
});
