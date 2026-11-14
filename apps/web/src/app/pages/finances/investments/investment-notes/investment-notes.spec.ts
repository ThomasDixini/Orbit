import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeInvestmentNotesGateway } from '../../../../core/finances/fake-investment-notes-gateway';
import { InvestmentNote } from '../../../../core/finances/investment-notes';
import { InvestmentNotesGateway } from '../../../../core/finances/investment-notes-gateway';
import { PortfolioLine } from '../../../../core/finances/investments';
import { IdGenerator } from '../../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../../core/ids/sequential-id-generator';
import { InvestmentNotes } from './investment-notes';

const LINE: PortfolioLine = {
  investment: { id: 'petr4', name: 'PETR4', kind: 'stock' },
  quantityThousandths: 1000,
  costCents: 1000,
  incomeCents: 0,
};
const NOTE: InvestmentNote = {
  id: 'n1',
  investmentId: 'petr4',
  kind: 'event',
  date: '2026-11-03',
  text: 'Dividend cut\n<script>alert(1)</script>',
};

class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function render(
  gateway: FakeInvestmentNotesGateway,
  lines: readonly PortfolioLine[] = [LINE],
): ComponentFixture<InvestmentNotes> {
  TestBed.configureTestingModule({
    providers: [
      { provide: InvestmentNotesGateway, useValue: gateway },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(InvestmentNotes);
  fixture.componentRef.setInput('lines', lines);
  fixture.componentRef.setInput('today', '2026-11-05');
  fixture.detectChanges();
  return fixture;
}

function root(fixture: ComponentFixture<InvestmentNotes>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<InvestmentNotes>, label: string): HTMLButtonElement {
  return [...root(fixture).querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )!;
}

function type(fixture: ComponentFixture<InvestmentNotes>, selector: string, value: string): void {
  const field = root(fixture).querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('InvestmentNotes', () => {
  it('shows an empty message and no button while there are no investments', () => {
    const fixture = render(new FakeInvestmentNotesGateway(), []);

    expect(root(fixture).textContent).toContain('Add an investment to write notes about it.');
    expect(root(fixture).querySelector('button')).toBeNull();
  });

  it('shows an empty message with the button when there are investments but no notes', () => {
    const fixture = render(new FakeInvestmentNotesGateway());

    expect(root(fixture).textContent).toContain('No notes yet.');
    expect(button(fixture, 'New note')).toBeTruthy();
  });

  it('lists a note with its investment, keeping line breaks and showing markup as text', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [NOTE];

    const fixture = render(gateway);

    expect(root(fixture).querySelector('.meta')?.textContent).toContain('PETR4');
    expect(root(fixture).querySelector('.body')?.textContent).toBe(NOTE.text);
    expect(root(fixture).querySelector('.body script')).toBeNull();
  });

  it('saves a new note for the chosen investment, dated today by default, and closes the form', () => {
    const gateway = new FakeInvestmentNotesGateway();
    const fixture = render(gateway);

    button(fixture, 'New note').click();
    fixture.detectChanges();
    type(fixture, 'textarea[name="text"]', 'Solid balance sheet');
    button(fixture, 'Save').click();
    fixture.detectChanges();

    expect(gateway.saved[0].draft).toEqual({
      investmentId: 'petr4',
      kind: 'analysis',
      date: '2026-11-05',
      text: 'Solid balance sheet',
    });
    expect(root(fixture).querySelector('form')).toBeNull();
    expect(root(fixture).textContent).toContain('Solid balance sheet');
  });

  it('does not save a blank text', () => {
    const fixture = render(new FakeInvestmentNotesGateway());

    button(fixture, 'New note').click();
    fixture.detectChanges();
    type(fixture, 'textarea[name="text"]', '   ');

    expect(button(fixture, 'Save').disabled).toBe(true);
  });

  it('edits a note in place and deletes it', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [NOTE];
    const fixture = render(gateway);

    root(fixture)
      .querySelector<HTMLButtonElement>('button[aria-label="Edit note on PETR4"]')!
      .click();
    fixture.detectChanges();
    type(fixture, 'textarea[name="text"]', 'Dividend restored');
    button(fixture, 'Save').click();
    fixture.detectChanges();
    root(fixture)
      .querySelector<HTMLButtonElement>('button[aria-label="Delete note on PETR4"]')!
      .click();
    fixture.detectChanges();

    expect(gateway.saved[0].id).toBe('n1');
    expect(gateway.deleted).toEqual(['n1']);
    expect(root(fixture).textContent).toContain('No notes yet.');
  });

  it('keeps the form open and shows an alert when the save is refused', () => {
    const gateway = new FakeInvestmentNotesGateway();
    const fixture = render(gateway);
    button(fixture, 'New note').click();
    fixture.detectChanges();
    type(fixture, 'textarea[name="text"]', 'Something');
    gateway.failure = new Error('refused');

    button(fixture, 'Save').click();
    fixture.detectChanges();

    expect(root(fixture).querySelector('[role="alert"]')).not.toBeNull();
    expect(root(fixture).querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Something');
  });
});
