import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardPaymentDraft } from '../../../../core/finances/account-statement';
import { SAMPLE_ACCOUNTS } from '../../../../core/finances/fake-finances-gateways';
import { Account } from '../../../../core/finances/finance-references';
import { PaymentForm } from './payment-form';

const [CHECKING, CARD] = SAMPLE_ACCOUNTS;
const SAVINGS: Account = {
  id: 'savings',
  name: 'Savings',
  kind: 'bankAccount',
  openingBalanceCents: 0,
};

interface FormHarness {
  readonly fixture: ComponentFixture<PaymentForm>;
  readonly saved: CardPaymentDraft[];
}

function createForm(bankAccounts: readonly Account[], suggestedCents = 28640): FormHarness {
  const fixture = TestBed.createComponent(PaymentForm);
  fixture.componentRef.setInput('card', CARD);
  fixture.componentRef.setInput('bankAccounts', bankAccounts);
  fixture.componentRef.setInput('suggestedCents', suggestedCents);
  fixture.componentRef.setInput('today', '2026-10-31');
  const harness: FormHarness = { fixture, saved: [] };
  fixture.componentInstance.save.subscribe((draft) => harness.saved.push(draft));
  fixture.detectChanges();
  return harness;
}

function element(fixture: ComponentFixture<PaymentForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function submitButton(fixture: ComponentFixture<PaymentForm>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!;
}

describe('PaymentForm', () => {
  it('pays the suggested amount today from the first bank account', () => {
    const { fixture, saved } = createForm([CHECKING, SAVINGS]);

    submitButton(fixture).click();

    expect(saved).toEqual([
      {
        cardId: 'credit-card',
        fromAccountId: 'checking-account',
        date: '2026-10-31',
        amountCents: 28640,
      },
    ]);
  });

  it('pays from the account chosen', () => {
    const { fixture, saved } = createForm([CHECKING, SAVINGS]);
    const select = element(fixture).querySelector('select')!;
    select.value = 'savings';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    submitButton(fixture).click();

    expect(saved[0].fromAccountId).toBe('savings');
  });

  it('starts blank when there is nothing to suggest', () => {
    const { fixture } = createForm([CHECKING], 0);
    const amount = element(fixture).querySelector<HTMLInputElement>('input[name="amount"]')!;

    expect([amount.value, submitButton(fixture).disabled]).toEqual(['', true]);
  });

  it('asks who paid when there is no bank account, and waits for a name', () => {
    const { fixture } = createForm([]);

    expect([
      element(fixture).querySelector('input[name="paidBy"]') !== null,
      submitButton(fixture).disabled,
    ]).toEqual([true, true]);
  });

  it('records a payment someone else made, with who paid it and no account', () => {
    const { fixture, saved } = createForm([CHECKING]);
    const select = element(fixture).querySelector<HTMLSelectElement>('select[name="paidFrom"]')!;
    select.value = 'paid-by-others';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const paidBy = element(fixture).querySelector<HTMLInputElement>('input[name="paidBy"]')!;
    paidBy.value = ' Sister ';
    paidBy.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submitButton(fixture).click();

    expect(saved).toEqual([
      { cardId: 'credit-card', paidBy: 'Sister', date: '2026-10-31', amountCents: 28640 },
    ]);
  });
});
