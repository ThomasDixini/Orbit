import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeInvestmentAnalysesGateway } from './fake-investment-analyses-gateway';
import { InvestmentAnalysis, emptyAnalysisDraft } from './investment-analyses';
import { InvestmentAnalysesGateway } from './investment-analyses-gateway';
import { InvestmentAnalysesStore } from './investment-analyses-store';

const JANUARY: InvestmentAnalysis = { id: 'jan', ...emptyAnalysisDraft('totvs3', '2026-01-02') };
const JUNE: InvestmentAnalysis = { id: 'jun', ...emptyAnalysisDraft('totvs3', '2026-06-01') };

class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(gateway: FakeInvestmentAnalysesGateway): {
  store: InvestmentAnalysesStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      InvestmentAnalysesStore,
      { provide: InvestmentAnalysesGateway, useValue: gateway },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(InvestmentAnalysesStore), errors };
}

describe('InvestmentAnalysesStore', () => {
  it('loads the analyses newest day first', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY, JUNE];

    const { store } = createStore(gateway);

    expect(store.isLoaded()).toBe(true);
    expect(store.analyses().map((analysis) => analysis.id)).toEqual(['jun', 'jan']);
  });

  it('reports a failed load and reads again on reload', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);

    gateway.failure = undefined;
    store.reload();

    expect(errors.errors).toHaveLength(1);
    expect(store.hasLoadFailed()).toBe(false);
    expect(store.isLoaded()).toBe(true);
  });

  it('adds a saved analysis in its place and counts the save', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const { store } = createStore(gateway);

    store.save(emptyAnalysisDraft('totvs3', '2026-03-01'));

    expect(gateway.saved).toHaveLength(1);
    expect(store.analyses().map((analysis) => analysis.date)).toEqual(['2026-03-01', '2026-01-02']);
    expect(store.savedCount()).toBe(1);
  });

  it('replaces an analysis when saving an existing id', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const { store } = createStore(gateway);

    store.save({ ...JANUARY, texts: { thesis: 'Margins under pressure' } }, 'jan');

    expect(store.analyses()).toHaveLength(1);
    expect(store.analyses()[0].texts['thesis']).toBe('Margins under pressure');
  });

  it('removes a deleted analysis', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY, JUNE];
    const { store } = createStore(gateway);

    store.remove('jan');

    expect(gateway.deleted).toEqual(['jan']);
    expect(store.analyses().map((analysis) => analysis.id)).toEqual(['jun']);
  });

  it('keeps the list and flags the failure when a save is refused', () => {
    const gateway = new FakeInvestmentAnalysesGateway();
    gateway.analysesToServe = [JANUARY];
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('refused');

    store.save(emptyAnalysisDraft('totvs3', '2026-03-01'));

    expect(store.hasActionFailed()).toBe(true);
    expect(store.savedCount()).toBe(0);
    expect(store.analyses()).toEqual([JANUARY]);
    expect(errors.errors).toHaveLength(1);
  });
});
