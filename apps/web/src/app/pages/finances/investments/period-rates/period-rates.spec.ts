import { ErrorHandler, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakePeriodRatesGateway } from '../../../../core/finances/fake-period-rates-gateway';
import { PeriodRate } from '../../../../core/finances/period-rates';
import { PeriodRatesGateway } from '../../../../core/finances/period-rates-gateway';
import { PeriodRatesStore } from '../../../../core/finances/period-rates-store';
import { PeriodRates } from './period-rates';

const SELIC: PeriodRate = { kind: 'selic', month: '2026-10', basisPoints: 1300 };

class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function render(gateway: FakePeriodRatesGateway): ComponentFixture<PeriodRates> {
  TestBed.configureTestingModule({
    providers: [
      PeriodRatesStore,
      { provide: PeriodRatesGateway, useValue: gateway },
      { provide: LOCALE_ID, useValue: 'en-US' },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(PeriodRates);
  fixture.componentRef.setInput('today', '2026-11-05');
  fixture.detectChanges();
  return fixture;
}

function root(fixture: ComponentFixture<PeriodRates>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<PeriodRates>, label: string): HTMLButtonElement {
  return [...root(fixture).querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
  )!;
}

function type(fixture: ComponentFixture<PeriodRates>, selector: string, value: string): void {
  const field = root(fixture).querySelector<HTMLInputElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('PeriodRates', () => {
  it('lists the rates with their month, kind and value', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [SELIC];

    const fixture = render(gateway);

    const row = root(fixture).querySelector('.rate')!.textContent!.replaceAll(/\s+/g, ' ');
    expect(row).toContain('October 2026');
    expect(row).toContain('Selic (per year)');
    expect(row).toContain('13%');
  });

  it('shows an empty message while there are no rates', () => {
    const fixture = render(new FakePeriodRatesGateway());

    expect(root(fixture).textContent).toContain('No rates yet.');
  });

  it('saves the typed rate for the month, which starts as the current one', () => {
    const gateway = new FakePeriodRatesGateway();
    const fixture = render(gateway);

    type(fixture, 'input[name="value"]', '13,5');
    button(fixture, 'Save rate').click();
    fixture.detectChanges();

    expect(gateway.saved).toEqual([{ kind: 'selic', month: '2026-11', basisPoints: 1350 }]);
    expect(root(fixture).querySelector<HTMLInputElement>('input[name="value"]')!.value).toBe('');
  });

  it('refuses a value that is not a rate', () => {
    const fixture = render(new FakePeriodRatesGateway());

    type(fixture, 'input[name="value"]', 'abc');

    expect(button(fixture, 'Save rate').disabled).toBe(true);
    expect(root(fixture).querySelector('.error')?.textContent).toContain('between -10 and 100');
  });

  it('loads a rate into the form to edit it, and replaces it on save', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [SELIC];
    const fixture = render(gateway);

    button(fixture, 'Edit Selic (per year) of October 2026').click();
    fixture.detectChanges();
    type(fixture, 'input[name="value"]', '13,75');
    button(fixture, 'Save rate').click();

    expect(gateway.saved).toEqual([{ kind: 'selic', month: '2026-10', basisPoints: 1375 }]);
  });

  it('deletes a rate', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [SELIC];
    const fixture = render(gateway);

    button(fixture, 'Delete Selic (per year) of October 2026').click();
    fixture.detectChanges();

    expect(gateway.deleted).toEqual([{ kind: 'selic', month: '2026-10' }]);
    expect(root(fixture).textContent).toContain('No rates yet.');
  });

  it('keeps what was typed and shows an alert when the save is refused', () => {
    const gateway = new FakePeriodRatesGateway();
    const fixture = render(gateway);
    type(fixture, 'input[name="value"]', '13');
    gateway.failure = new Error('refused');

    button(fixture, 'Save rate').click();
    fixture.detectChanges();

    expect(root(fixture).querySelector('[role="alert"]')).not.toBeNull();
    expect(root(fixture).querySelector<HTMLInputElement>('input[name="value"]')!.value).toBe('13');
  });
});
