import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BalanceEntry, Investment } from '../../../../core/finances/investments';
import { BalanceStatement } from './balance-statement';

const INVESTMENTS: readonly Investment[] = [
  { id: 'rdb', name: 'RDB Nubank', kind: 'fixedIncome', tracking: 'balance' },
  { id: 'caixinha', name: 'Caixinha Nubank', kind: 'fixedIncome', tracking: 'balance' },
];

const ENTRIES: readonly BalanceEntry[] = [
  { id: 'a', investmentId: 'caixinha', date: '2026-10-01', kind: 'opening', amountCents: 100_000 },
  { id: 'b', investmentId: 'caixinha', date: '2026-10-31', kind: 'yield', amountCents: 1_000 },
  { id: 'c', investmentId: 'caixinha', date: '2026-10-31', kind: 'incomeTax', amountCents: 150 },
  { id: 'd', investmentId: 'rdb', date: '2026-11-05', kind: 'opening', amountCents: 50_000 },
];

function render(
  entries: readonly BalanceEntry[] = ENTRIES,
  investments: readonly Investment[] = INVESTMENTS,
  months?: readonly string[],
): ComponentFixture<BalanceStatement> {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }] });
  const fixture = TestBed.createComponent(BalanceStatement);
  fixture.componentRef.setInput('investments', investments);
  fixture.componentRef.setInput('months', months);
  fixture.componentRef.setInput('entries', entries);
  fixture.componentRef.setInput('today', '2026-11-18');
  fixture.detectChanges();
  return fixture;
}

function rows(fixture: ComponentFixture<BalanceStatement>): string[][] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim() ?? ''),
  );
}

describe('BalanceStatement', () => {
  it('shows the months of all the balance investments together, newest first, like a bank statement', () => {
    expect(rows(render())).toEqual([
      ['November 2026', 'R$1,508.50', 'R$0.00', 'R$0.00', 'R$0.00', 'R$1,508.50'],
      ['October 2026', 'R$1,000.00', 'R$0.00', 'R$1.50', 'R$10.00', 'R$1,008.50'],
    ]);
  });

  it('narrows to the investments the page filter leaves in', () => {
    const fixture = render(ENTRIES, [INVESTMENTS[0]]);

    expect(rows(fixture).map((row) => [row[0], row[5]])).toEqual([['November 2026', 'R$500.00']]);
  });

  it('keeps only the months of the page filter, with the balance they opened with', () => {
    const fixture = render(ENTRIES, INVESTMENTS, ['2026-11']);

    expect(rows(fixture).map((row) => [row[0], row[1]])).toEqual([['November 2026', 'R$1,508.50']]);
  });

  it('has no picker of its own', () => {
    expect((render().nativeElement as HTMLElement).querySelector('select')).toBeNull();
  });

  it('says what to do when there are no lines yet', () => {
    const fixture = render([]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.empty')?.textContent?.trim(),
    ).toBe('No statement lines yet. Add the opening balance and the first deposit.');
  });
});

describe('BalanceStatement: taxes and fees', () => {
  it('has no columns for them and says how much was recorded in total', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    expect([
      [...element.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim()),
      [...element.querySelectorAll('.note')].at(-1)?.textContent?.trim(),
    ]).toEqual([
      ['Month', 'Opening balance', 'Deposits', 'Withdrawals and taxes', 'Yield', 'Closing balance'],
      'Income tax, IOF and fees recorded in total: R$1.50',
    ]);
  });
});
