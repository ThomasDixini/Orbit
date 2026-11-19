import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SAMPLE_ACCOUNTS,
  SAMPLE_FINANCE_CATEGORIES,
  SAMPLE_OCTOBER,
} from '../../../../core/finances/fake-finances-gateways';
import { Bill, BillDraft } from '../../../../core/finances/bills';
import { Transaction, TransactionDraft } from '../../../../core/finances/transaction';
import { BillLink, TransactionForm } from './transaction-form';

const [GROCERIES, , SALARY] = SAMPLE_OCTOBER;

interface FormHarness {
  readonly fixture: ComponentFixture<TransactionForm>;
  readonly saved: TransactionDraft[];
  readonly removed: number[];
  readonly dismissed: number[];
}

function createForm(transaction?: Transaction): FormHarness {
  const fixture = TestBed.createComponent(TransactionForm);
  fixture.componentRef.setInput('categories', SAMPLE_FINANCE_CATEGORIES);
  fixture.componentRef.setInput('accounts', SAMPLE_ACCOUNTS);
  fixture.componentRef.setInput('defaultDate', '2026-10-31');
  fixture.componentRef.setInput('defaultAccountId', 'credit-card');
  if (transaction !== undefined) fixture.componentRef.setInput('transaction', transaction);
  const harness: FormHarness = { fixture, saved: [], removed: [], dismissed: [] };
  fixture.componentInstance.save.subscribe((draft) => harness.saved.push(draft));
  fixture.componentInstance.remove.subscribe(() => harness.removed.push(1));
  fixture.componentInstance.dismiss.subscribe(() => harness.dismissed.push(1));
  fixture.detectChanges();
  return harness;
}

function element(fixture: ComponentFixture<TransactionForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function fill(fixture: ComponentFixture<TransactionForm>, selector: string, value: string): void {
  const field = element(fixture).querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  fixture.detectChanges();
}

function fillExpense(fixture: ComponentFixture<TransactionForm>, amount: string): void {
  fill(fixture, 'input[name="amount"]', amount);
  fill(fixture, 'input[maxlength="80"]', '  Groceries ');
  fill(fixture, 'select', 'food');
}

function clickButton(fixture: ComponentFixture<TransactionForm>, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>('button')];
  buttons.find((button) => button.textContent?.trim() === label)!.click();
  fixture.detectChanges();
}

function submitButton(fixture: ComponentFixture<TransactionForm>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!;
}

describe('TransactionForm', () => {
  it('records an expense with a negative amount on the default day and account', () => {
    const { fixture, saved } = createForm();
    fillExpense(fixture, '286,4');

    submitButton(fixture).click();

    expect(saved).toEqual([
      {
        date: '2026-10-31',
        description: 'Groceries',
        categoryId: 'food',
        accountId: 'credit-card',
        amountCents: -28640,
      },
    ]);
  });

  it('records income with a positive amount', () => {
    const { fixture, saved } = createForm();
    clickButton(fixture, 'Income');
    fillExpense(fixture, '9500');

    submitButton(fixture).click();

    expect(saved[0].amountCents).toBe(950000);
  });

  it('cannot save until amount, description and category are given', () => {
    const { fixture } = createForm();
    fill(fixture, 'input[name="amount"]', '10');

    expect(submitButton(fixture).disabled).toBe(true);
  });

  it('says what is wrong with an amount it cannot read', () => {
    const { fixture } = createForm();

    fill(fixture, 'input[name="amount"]', '1.234,56');

    expect(element(fixture).querySelector('.error')?.textContent).toContain('above zero');
  });

  it('opens on the transaction being edited', () => {
    const { fixture } = createForm(SALARY);

    const amount = element(fixture).querySelector<HTMLInputElement>('input[name="amount"]')!;
    const pressed = element(fixture).querySelector('[aria-pressed="true"]')?.textContent?.trim();
    expect([amount.value, pressed, submitButton(fixture).textContent?.trim()]).toEqual([
      '9500.00',
      'Income',
      'Save transaction',
    ]);
  });

  it('saves an edit with the fields changed', () => {
    const { fixture, saved } = createForm(GROCERIES);
    fill(fixture, 'input[name="amount"]', '300');

    submitButton(fixture).click();

    const { id, ...draft } = GROCERIES;
    expect([saved, id]).toEqual([[{ ...draft, amountCents: -30000 }], 'groceries']);
  });

  it('offers to delete only while editing', () => {
    const editing = createForm(GROCERIES);
    clickButton(editing.fixture, 'Delete');

    const creating = createForm();
    const labels = [...element(creating.fixture).querySelectorAll('button')].map((button) =>
      button.textContent?.trim(),
    );
    expect([editing.removed.length, labels.includes('Delete')]).toEqual([1, false]);
  });

  it('closes on Escape', () => {
    const { fixture, dismissed } = createForm();

    element(fixture)
      .querySelector('form')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dismissed.length).toBe(1);
  });
});

const RENT: Bill = {
  id: 'rent',
  kind: 'payable',
  description: 'Rent',
  categoryId: 'food',
  amountCents: 150_000,
  dueDate: '2026-11-05',
};
const FREELANCE: Bill = {
  id: 'freelance',
  kind: 'receivable',
  description: 'Freelance job',
  categoryId: 'salary',
  amountCents: 80_000,
  dueDate: '2026-11-05',
};

function createFormWithBills(): {
  fixture: ComponentFixture<TransactionForm>;
  installments: BillDraft[];
  links: BillLink[];
} {
  const harness = createForm();
  harness.fixture.componentRef.setInput('openBills', [RENT, FREELANCE]);
  const installments: BillDraft[] = [];
  const links: BillLink[] = [];
  harness.fixture.componentInstance.saveInstallments.subscribe((draft) => installments.push(draft));
  harness.fixture.componentInstance.settleBill.subscribe((link) => links.push(link));
  harness.fixture.detectChanges();
  return { fixture: harness.fixture, installments, links };
}

describe('TransactionForm: installments', () => {
  it('asks for bills to pay, with the total and the count, and a first due day a month after', () => {
    const { fixture, installments } = createFormWithBills();
    clickButton(fixture, 'In installments');
    fillExpense(fixture, '500');
    fill(fixture, 'input[name="count"]', '6');

    submitButton(fixture).click();

    expect(installments).toEqual([
      {
        kind: 'payable',
        description: 'Groceries',
        categoryId: 'food',
        amountCents: 50_000,
        dueDate: '2026-11-30',
        repeat: { kind: 'installments', count: 6, amountIsTotal: true },
      },
    ]);
  });

  it('asks for bills to receive when the type is income', () => {
    const { fixture, installments } = createFormWithBills();
    clickButton(fixture, 'In installments');
    clickButton(fixture, 'Income');
    fillExpense(fixture, '300');

    submitButton(fixture).click();

    expect(installments[0].kind).toBe('receivable');
  });

  it('cannot save with a count the API would refuse', () => {
    const { fixture } = createFormWithBills();
    clickButton(fixture, 'In installments');
    fillExpense(fixture, '500');
    fill(fixture, 'input[name="count"]', '1');

    expect(submitButton(fixture).disabled).toBe(true);
  });

  it('is not offered while editing', () => {
    const { fixture } = createForm(GROCERIES);

    expect(element(fixture).textContent).not.toContain('In installments');
  });
});

describe('TransactionForm: linking a bill', () => {
  it('lists only the open bills that move money the same way as the type', () => {
    const { fixture } = createFormWithBills();

    const expenseOptions = [...element(fixture).querySelectorAll('select[name="bill"] option')];
    clickButton(fixture, 'Income');
    const incomeOptions = [...element(fixture).querySelectorAll('select[name="bill"] option')];

    expect(
      [expenseOptions, incomeOptions].map((options) =>
        options.map((option) => option.textContent?.trim()),
      ),
    ).toEqual([
      ['No bill', 'Rent · 2026-11-05'],
      ['No bill', 'Freelance job · 2026-11-05'],
    ]);
  });

  it('takes the bill amount, description and category, and settles it on the day and account', () => {
    const { fixture, links } = createFormWithBills();

    fill(fixture, 'select[name="bill"]', 'rent');
    const amount = element(fixture).querySelector<HTMLInputElement>('input[name="amount"]')!;
    submitButton(fixture).click();

    expect([amount.value, amount.disabled, links]).toEqual([
      '1500.00',
      true,
      [
        {
          billId: 'rent',
          settlement: { date: '2026-10-31', accountId: 'credit-card' },
        },
      ],
    ]);
  });
});
