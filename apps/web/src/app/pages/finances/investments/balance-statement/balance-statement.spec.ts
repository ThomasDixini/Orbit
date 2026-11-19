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

function render(entries: readonly BalanceEntry[] = ENTRIES): ComponentFixture<BalanceStatement> {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }] });
  const fixture = TestBed.createComponent(BalanceStatement);
  fixture.componentRef.setInput('investments', INVESTMENTS);
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

  it('narrows to one investment', () => {
    const fixture = render();
    const picker = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      'select',
    )!;

    picker.value = 'rdb';
    picker.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(rows(fixture).map((row) => [row[0], row[5]])).toEqual([['November 2026', 'R$500.00']]);
  });

  it('lists the picker with every balance investment', () => {
    const options = [...(render().nativeElement as HTMLElement).querySelectorAll('option')].map(
      (option) => option.textContent?.trim(),
    );

    expect(options).toEqual(['All balance investments', 'RDB Nubank', 'Caixinha Nubank']);
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
