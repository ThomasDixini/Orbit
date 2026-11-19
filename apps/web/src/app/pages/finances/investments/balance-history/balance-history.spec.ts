import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BalanceEntry, BalanceEntryKind } from '../../../../core/finances/investments';
import { BalanceHistory } from './balance-history';

function entry(
  id: string,
  date: string,
  kind: BalanceEntryKind,
  amountCents: number,
): BalanceEntry {
  return { id, investmentId: 'rdb', date, kind, amountCents };
}

function render(
  entries: readonly BalanceEntry[],
  kinds: readonly BalanceEntryKind[] = ['deposit', 'withdrawal'],
): { fixture: ComponentFixture<BalanceHistory>; removed: string[] } {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }] });
  const fixture = TestBed.createComponent(BalanceHistory);
  fixture.componentRef.setInput('title', 'Deposits and withdrawals');
  fixture.componentRef.setInput('kinds', kinds);
  fixture.componentRef.setInput('entries', entries);
  fixture.componentRef.setInput('investmentNames', new Map([['rdb', 'RDB Nubank']]));
  const removed: string[] = [];
  fixture.componentInstance.remove.subscribe((id) => removed.push(id));
  fixture.detectChanges();
  return { fixture, removed };
}

function texts(fixture: ComponentFixture<BalanceHistory>, selector: string): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

describe('BalanceHistory', () => {
  const entries = [
    entry('a', '2026-01-10', 'deposit', 88_400),
    entry('b', '2026-03-05', 'withdrawal', 20_000),
    entry('c', '2026-02-01', 'yield', 4_000),
  ];

  it('lists the kinds it was given, newest day first, with what each did to the balance', () => {
    const { fixture } = render(entries);

    expect([texts(fixture, '.name'), texts(fixture, '.amount')]).toEqual([
      ['Mar 5 · RDB Nubank · Withdrawal', 'Jan 10 · RDB Nubank · Deposit'],
      ['−R$200.00', '+R$884.00'],
    ]);
  });

  it('asks for a line to be deleted by its id', () => {
    const { fixture, removed } = render(entries);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="Delete Deposit of RDB Nubank"]')!
      .click();

    expect(removed).toEqual(['a']);
  });

  it('says so when there is nothing of those kinds', () => {
    const { fixture } = render(entries, ['iof']);

    expect(texts(fixture, '.empty')).toEqual(['Nothing recorded yet.']);
  });

  it('shows the first ten and reveals ten more on the arrow', () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      entry(`e${index}`, `2026-01-${String(index + 1).padStart(2, '0')}`, 'deposit', 100),
    );
    const { fixture } = render(many);
    const counts = [texts(fixture, '.entry').length];

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.more')!.click();
    fixture.detectChanges();
    counts.push(texts(fixture, '.entry').length);

    expect(counts).toEqual([10, 20]);
  });
});
