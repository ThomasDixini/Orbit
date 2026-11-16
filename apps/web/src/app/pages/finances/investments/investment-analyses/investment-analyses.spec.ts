import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeInvestmentAnalysesGateway } from '../../../../core/finances/fake-investment-analyses-gateway';
import { InvestmentAnalysis } from '../../../../core/finances/investment-analyses';
import { InvestmentAnalysesGateway } from '../../../../core/finances/investment-analyses-gateway';
import { PortfolioLine } from '../../../../core/finances/investments';
import { IdGenerator } from '../../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../../core/ids/sequential-id-generator';
import { InvestmentAnalyses } from './investment-analyses';

const LINE: PortfolioLine = {
  investment: { id: 'totvs3', name: 'TOTS3', kind: 'stock' },
  quantityThousandths: 1000,
  costCents: 1000,
  incomeCents: 0,
};
const OTHER_LINE: PortfolioLine = {
  ...LINE,
  investment: { id: 'petr4', name: 'PETR4', kind: 'stock' },
};
const JANUARY: InvestmentAnalysis = {
  id: 'jan',
  investmentId: 'totvs3',
  date: '2026-01-02',
  recommendation: 'buy',
  texts: { thesis: 'ERP leader', marketRisks: 'A new entrant', previousReview: 'Old review' },
  metrics: { roe: 18, price: 20, targetPrice: 25 },
  peers: [],
  scenarios: [],
};
const JUNE: InvestmentAnalysis = {
  ...JANUARY,
  id: 'jun',
  date: '2026-06-01',
  recommendation: 'hold',
  texts: { thesis: 'ERP leader, slower growth' },
  metrics: { roe: 21 },
};

class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function render(
  gateway: FakeInvestmentAnalysesGateway,
  lines: readonly PortfolioLine[] = [LINE],
): ComponentFixture<InvestmentAnalyses> {
  TestBed.configureTestingModule({
    providers: [
      { provide: InvestmentAnalysesGateway, useValue: gateway },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(InvestmentAnalyses);
  fixture.componentRef.setInput('lines', lines);
  fixture.componentRef.setInput('today', '2026-11-05');
  fixture.detectChanges();
  return fixture;
}

function root(fixture: ComponentFixture<InvestmentAnalyses>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<InvestmentAnalyses>, label: string): HTMLButtonElement {
  return [...root(fixture).querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
  )!;
}

function click(fixture: ComponentFixture<InvestmentAnalyses>, label: string): void {
  button(fixture, label).click();
  fixture.detectChanges();
}

function field<TField extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
  fixture: ComponentFixture<InvestmentAnalyses>,
  name: string,
): TField {
  return root(fixture).querySelector<TField>(`[name="${name}"]`)!;
}

function type(fixture: ComponentFixture<InvestmentAnalyses>, name: string, value: string): void {
  const input = field<HTMLInputElement>(fixture, name);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<InvestmentAnalyses>): void {
  click(fixture, 'Save analysis');
}

describe('InvestmentAnalyses', () => {
  it('asks for an investment first when there is none', () => {
    const fixture = render(new FakeInvestmentAnalysesGateway(), []);

    expect(root(fixture).textContent).toContain('Add an investment to analyse it.');
    expect(root(fixture).querySelector('button')).toBeNull();
  });

  it('shows an empty timeline with the button to start the first analysis', () => {
    const fixture = render(new FakeInvestmentAnalysesGateway());

    expect(root(fixture).textContent).toContain('No analysis of TOTS3 yet.');
    expect(button(fixture, 'New analysis')).toBeTruthy();
    expect(button(fixture, 'Compare analyses')).toBeUndefined();
  });

  it('saves a new analysis dated today with the typed texts and numbers', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    const fixture = render(gateway);

    click(fixture, 'New analysis');
    type(fixture, 'company.thesis', 'ERP leader');
    type(fixture, 'company.price', '31,90');
    type(fixture, 'company.roe', '18,5');
    type(fixture, 'scenario.base.probability', '55');
    submit(fixture);

    expect(gateway.saved[0].draft).toEqual({
      investmentId: 'totvs3',
      date: '2026-11-05',
      texts: { thesis: 'ERP leader' },
      metrics: { price: 31.9, roe: 18.5 },
      peers: [],
      scenarios: [{ kind: 'base', texts: {}, metrics: { probability: 55 } }],
    });
    expect(root(fixture).querySelector('form')).toBeNull();
    expect(root(fixture).querySelector('.timeline')?.textContent).toContain('ERP leader');
  });

  it('starts a new analysis as a copy of the latest and shows its risks to review', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const fixture = render(gateway);

    click(fixture, 'New analysis');

    expect(field<HTMLInputElement>(fixture, 'date').value).toBe('2026-11-05');
    expect(field<HTMLTextAreaElement>(fixture, 'company.thesis').value).toBe('ERP leader');
    expect(field<HTMLInputElement>(fixture, 'company.roe').value).toBe('18');
    expect(field<HTMLTextAreaElement>(fixture, 'company.previousReview').value).toBe('');
    expect(root(fixture).querySelector('.previous')?.textContent).toContain('A new entrant');
  });

  it('works out the upside while the prices are typed', () => {
    const fixture = render(new FakeInvestmentAnalysesGateway());

    click(fixture, 'New analysis');
    type(fixture, 'company.price', '20');
    type(fixture, 'company.targetPrice', '25');

    expect(root(fixture).querySelector('.derived')?.textContent).toContain('Upside to target: 25%');
  });

  it('does not save while a number cannot be read and marks it', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    const fixture = render(gateway);

    click(fixture, 'New analysis');
    type(fixture, 'company.roe', 'abc');
    submit(fixture);

    expect(gateway.saved).toEqual([]);
    expect(field(fixture, 'company.roe').getAttribute('aria-invalid')).toBe('true');
    expect(root(fixture).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('adds a peer and saves it with its numbers', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    const fixture = render(gateway);

    click(fixture, 'New analysis');
    click(fixture, 'Add peer');
    type(fixture, 'peer.0.name', 'SAP');
    type(fixture, 'peer.0.priceToEarnings', '32,1');
    submit(fixture);

    expect(gateway.saved[0].draft.peers).toEqual([
      { name: 'SAP', metrics: { priceToEarnings: 32.1 } },
    ]);
  });

  it('edits an analysis under its own id', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const fixture = render(gateway);

    click(fixture, `Edit analysis of ${dateOf(fixture)}`);
    type(fixture, 'company.thesis', 'Margins under pressure');
    submit(fixture);

    expect(gateway.saved[0].id).toBe('jan');
    expect(gateway.saved[0].draft.texts['previousReview']).toBe('Old review');
    expect(gateway.saved[0].draft.date).toBe('2026-01-02');
  });

  it('shows one analysis with only what was filled in', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const fixture = render(gateway);

    click(fixture, `View analysis of ${dateOf(fixture)}`);

    const detail = root(fixture).querySelector('app-analysis-detail')!;
    expect(detail.textContent).toContain('A new entrant');
    expect(detail.textContent).toContain('Upside to target');
    expect(detail.textContent).not.toContain('Cash flow');
  });

  it('compares the latest analysis with the one before it', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY, JUNE];
    const fixture = render(gateway);

    click(fixture, 'Compare analyses');

    const roe = root(fixture).querySelector('tr.metric[data-key="roe"]')!;
    expect(roe.textContent).toContain('18%');
    expect(roe.textContent).toContain('21%');
    expect(roe.textContent).toContain('+3 p.p.');
    const thesis = root(fixture).querySelector('.text-row[data-key="thesis"]')!;
    expect(thesis.textContent).toContain('Changed');
  });

  it('lists only the analyses of the picked investment', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const fixture = render(gateway, [LINE, OTHER_LINE]);

    const picker = field<HTMLSelectElement>(fixture, 'analysed-investment');
    picker.value = 'petr4';
    picker.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(root(fixture).textContent).toContain('No analysis of PETR4 yet.');
  });

  it('deletes an analysis', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const fixture = render(gateway);

    click(fixture, `Delete analysis of ${dateOf(fixture)}`);

    expect(gateway.deleted).toEqual(['jan']);
    expect(root(fixture).textContent).toContain('No analysis of TOTS3 yet.');
  });

  it('keeps the form open and shows an alert when the save is refused', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    const fixture = render(gateway);
    click(fixture, 'New analysis');
    type(fixture, 'company.thesis', 'Something');
    gateway.failure = new Error('refused');

    submit(fixture);

    expect(root(fixture).querySelector('[role="alert"]')?.textContent).toContain("Couldn't save");
    expect(field<HTMLTextAreaElement>(fixture, 'company.thesis').value).toBe('Something');
  });
});

/** The date as the timeline shows it, read from the first entry. */
function dateOf(fixture: ComponentFixture<InvestmentAnalyses>): string {
  return root(fixture).querySelector('.timeline .date')!.textContent!.trim();
}
