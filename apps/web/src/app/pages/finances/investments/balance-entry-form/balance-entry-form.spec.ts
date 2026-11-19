import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BalanceEntryFields, BalanceEntryForm } from './balance-entry-form';

function render(saving = false): {
  fixture: ComponentFixture<BalanceEntryForm>;
  saved: BalanceEntryFields[];
} {
  const fixture = TestBed.createComponent(BalanceEntryForm);
  fixture.componentRef.setInput('investmentName', 'RDB Nubank');
  fixture.componentRef.setInput('today', '2026-11-18');
  fixture.componentRef.setInput('saving', saving);
  const saved: BalanceEntryFields[] = [];
  fixture.componentInstance.save.subscribe((fields) => saved.push(fields));
  fixture.detectChanges();
  return { fixture, saved };
}

function type(fixture: ComponentFixture<BalanceEntryForm>, selector: string, value: string): void {
  const field = (fixture.nativeElement as HTMLElement).querySelector<
    HTMLInputElement | HTMLSelectElement
  >(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  field.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<BalanceEntryForm>): void {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>('[type="submit"]')!
    .click();
  fixture.detectChanges();
}

describe('BalanceEntryForm', () => {
  it('offers every kind of line of a statement, starting with a deposit', () => {
    const { fixture } = render();

    const options = [...(fixture.nativeElement as HTMLElement).querySelectorAll('option')];

    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Deposit',
      'Withdrawal',
      'Yield',
      'Income tax (IR)',
      'IOF',
      'Fee',
      'Opening balance',
    ]);
  });

  it('sends the kind, the amount in cents and the day, which starts as today', () => {
    const { fixture, saved } = render();

    type(fixture, 'select[name="kind"]', 'yield');
    type(fixture, 'input[name="amount"]', '40,24');
    submit(fixture);

    expect(saved).toEqual([{ date: '2026-11-18', kind: 'yield', amountCents: 4024 }]);
  });

  it('sends the day the person picked', () => {
    const { fixture, saved } = render();

    type(fixture, 'input[name="amount"]', '884');
    type(fixture, 'input[name="date"]', '2025-12-09');
    submit(fixture);

    expect(saved).toEqual([{ date: '2025-12-09', kind: 'deposit', amountCents: 88400 }]);
  });

  it('cannot be sent without an amount above zero, and says what is wrong with one that is typed', () => {
    const { fixture, saved } = render();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[type="submit"]',
    )!;
    const emptyIsDisabled = button.disabled;

    type(fixture, 'input[name="amount"]', 'abc');
    const error = (fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent;

    expect([emptyIsDisabled, button.disabled, error?.trim(), saved]).toEqual([
      true,
      true,
      'Enter an amount above zero, like 884.00.',
      [],
    ]);
  });

  it('cannot be sent again while it is being saved', () => {
    const { fixture } = render(true);
    type(fixture, 'input[name="amount"]', '10');

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[type="submit"]',
    )!;

    expect(button.disabled).toBe(true);
  });
});
