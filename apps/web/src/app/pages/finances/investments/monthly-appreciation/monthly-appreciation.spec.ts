import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Income, Investment, MonthlyPoint } from '../../../../core/finances/investments';
import { MonthlyAppreciation } from './monthly-appreciation';

const INVESTMENTS: readonly Investment[] = [
  { id: 'cdb', name: 'CDB', kind: 'fixedIncome' },
  { id: 'rdb', name: 'RDB', kind: 'fixedIncome', tracking: 'balance' },
];

function point(month: string, valueCents: number, appliedCents: number): MonthlyPoint {
  return { month, valueCents, appliedCents, returnPercent: 0, cdiPercent: 0 };
}

const HISTORIES: Record<string, readonly MonthlyPoint[]> = {
  cdb: [point('2026-06', 10_500, 10_000), point('2026-07', 0, 0)],
  rdb: [point('2026-06', 51_000, 50_000), point('2026-07', 52_000, 50_000)],
};

const INCOMES: readonly Income[] = [
  { id: 'i1', investmentId: 'cdb', date: '2026-07-10', kind: 'yield', amountCents: 879 },
];

function render(): ComponentFixture<MonthlyAppreciation> {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }] });
  const fixture = TestBed.createComponent(MonthlyAppreciation);
  fixture.componentRef.setInput('investments', INVESTMENTS);
  fixture.componentRef.setInput('histories', HISTORIES);
  fixture.componentRef.setInput('incomes', INCOMES);
  fixture.detectChanges();
  return fixture;
}

function rows(fixture: ComponentFixture<MonthlyAppreciation>): string[][] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim() ?? ''),
  );
}

describe('MonthlyAppreciation', () => {
  it('adds all the investments up, the sold one included, newest month first', () => {
    expect(rows(render()).map((row) => [row[0], row[3], row[5]])).toEqual([
      ['July 2026', '+R$5.00', 'R$8.79'],
      ['June 2026', '+R$15.00', 'R$0.00'],
    ]);
  });

  it('narrows to one investment, such as the sold one', () => {
    const fixture = render();
    const picker = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      'select',
    )!;

    picker.value = 'cdb';
    picker.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(rows(fixture).map((row) => [row[0], row[1], row[3], row[4]])).toEqual([
      ['July 2026', 'R$105.00', '−R$5.00', '-4.76%'],
      ['June 2026', 'R$0.00', '+R$5.00', '+5.00%'],
    ]);
  });

  it('draws one line per investment to compare them', () => {
    const fixture = render();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-line-chart .legend li').length,
    ).toBe(2);
  });
});
