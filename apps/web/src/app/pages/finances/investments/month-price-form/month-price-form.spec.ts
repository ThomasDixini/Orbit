import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Investment } from '../../../../core/finances/investments';
import { MonthPriceFields, MonthPriceForm } from './month-price-form';

const INVESTMENTS: readonly Investment[] = [
  { id: 'tots3', name: 'TOTS3', kind: 'stock' },
  { id: 'petr4', name: 'PETR4', kind: 'stock' },
];

function render(today = '2026-11-03'): {
  fixture: ComponentFixture<MonthPriceForm>;
  sent: MonthPriceFields[];
} {
  const fixture = TestBed.createComponent(MonthPriceForm);
  fixture.componentRef.setInput('investments', INVESTMENTS);
  fixture.componentRef.setInput('today', today);
  const sent: MonthPriceFields[] = [];
  fixture.componentInstance.save.subscribe((fields) => sent.push(fields));
  fixture.detectChanges();
  return { fixture, sent };
}

function field<TField extends HTMLElement>(
  fixture: ComponentFixture<MonthPriceForm>,
  name: string,
): TField {
  return (fixture.nativeElement as HTMLElement).querySelector<TField>(`[name="${name}"]`)!;
}

function fill(
  fixture: ComponentFixture<MonthPriceForm>,
  name: string,
  value: string,
  eventName: 'input' | 'change',
): void {
  const element = field<HTMLInputElement | HTMLSelectElement>(fixture, name);
  element.value = value;
  element.dispatchEvent(new Event(eventName));
  fixture.detectChanges();
}

function submitButton(fixture: ComponentFixture<MonthPriceForm>): HTMLButtonElement {
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
}

describe('MonthPriceForm', () => {
  it('starts at the last finished month and the first investment', () => {
    const { fixture } = render('2026-11-03');

    expect(field<HTMLInputElement>(fixture, 'month-price-month').value).toBe('2026-10');
    expect(field<HTMLSelectElement>(fixture, 'month-price-investment').value).toBe('tots3');
  });

  it('starts at December of the year before when it is January', () => {
    const { fixture } = render('2026-01-15');

    expect(field<HTMLInputElement>(fixture, 'month-price-month').value).toBe('2025-12');
  });

  it('sends the investment, the month and the price in cents, then clears the price', () => {
    const { fixture, sent } = render();

    fill(fixture, 'month-price-investment', 'petr4', 'change');
    fill(fixture, 'month-price-month', '2026-02', 'change');
    fill(fixture, 'month-price-price', '31,50', 'input');
    submitButton(fixture).click();
    fixture.detectChanges();

    expect(sent).toEqual([{ investmentId: 'petr4', month: '2026-02', cents: 3150 }]);
    expect(field<HTMLInputElement>(fixture, 'month-price-price').value).toBe('');
  });

  it('does not send a price that is not above zero, and says why', () => {
    const { fixture, sent } = render();

    fill(fixture, 'month-price-price', '0', 'input');

    expect(submitButton(fixture).disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enter a price above zero',
    );
    expect(sent).toEqual([]);
  });

  it('does not take a month that has not started', () => {
    const { fixture } = render('2026-11-03');

    fill(fixture, 'month-price-month', '2026-12', 'change');
    fill(fixture, 'month-price-price', '31', 'input');

    expect(submitButton(fixture).disabled).toBe(true);
  });

  it('can be dismissed with Escape', () => {
    const { fixture } = render();
    let dismissed = 0;
    fixture.componentInstance.dismiss.subscribe(() => dismissed++);

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dismissed).toBe(1);
  });
});
