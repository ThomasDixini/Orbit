import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardInvoice } from '../../../../core/finances/card-invoices';
import { SAMPLE_INVOICE } from '../../../../core/finances/fake-account-statements-gateway';
import { CardInvoices, PaidByOthers } from './card-invoices';

const JUNE_UNPAID: CardInvoice = {
  ...SAMPLE_INVOICE,
  startsOn: '2026-05-08',
  closesOn: '2026-06-08',
  dueOn: '2026-06-12',
  amountCents: 82359,
  paidCents: 0,
  remainingCents: 82359,
  status: 'unpaid',
  payments: [],
};

interface Harness {
  readonly fixture: ComponentFixture<CardInvoices>;
  readonly marked: PaidByOthers[];
}

function render(invoices: readonly CardInvoice[]): Harness {
  const fixture = TestBed.createComponent(CardInvoices);
  fixture.componentRef.setInput('invoices', invoices);
  fixture.componentRef.setInput(
    'accountNames',
    new Map([['checking-account', 'Checking account']]),
  );
  const harness: Harness = { fixture, marked: [] };
  fixture.componentInstance.markPaid.subscribe((marked) => harness.marked.push(marked));
  fixture.detectChanges();
  return harness;
}

function element(fixture: ComponentFixture<CardInvoices>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function buttonNamed(fixture: ComponentFixture<CardInvoices>, text: string): HTMLButtonElement {
  return [...element(fixture).querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text,
  )!;
}

describe('CardInvoices', () => {
  it('shows what each invoice came to, its status and which payments paid it', () => {
    const { fixture } = render([SAMPLE_INVOICE]);
    const text = element(fixture).textContent ?? '';

    expect([
      text.includes('Settled'),
      text.includes('Checking account'),
      text.includes('412.50'),
    ]).toEqual([true, true, true]);
  });

  it('adds up what is still owed', () => {
    const { fixture } = render([JUNE_UNPAID, SAMPLE_INVOICE]);

    expect(element(fixture).querySelector('.owed')?.textContent).toContain('823.59');
  });

  it('marks an unpaid invoice as paid by the person named', () => {
    const { fixture, marked } = render([JUNE_UNPAID]);
    buttonNamed(fixture, 'Paid by someone else').click();
    fixture.detectChanges();
    const input = element(fixture).querySelector<HTMLInputElement>('input[name="paidBy"]')!;
    input.value = 'Sister';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    buttonNamed(fixture, 'Mark as paid').click();

    expect(marked).toEqual([{ invoice: JUNE_UNPAID, paidBy: 'Sister' }]);
  });

  it('offers no marking on an invoice already paid', () => {
    const { fixture } = render([SAMPLE_INVOICE]);

    expect(buttonNamed(fixture, 'Paid by someone else')).toBeUndefined();
  });
});
