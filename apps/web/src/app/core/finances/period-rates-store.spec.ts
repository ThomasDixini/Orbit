import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakePeriodRatesGateway } from './fake-period-rates-gateway';
import { PeriodRate } from './period-rates';
import { PeriodRatesGateway } from './period-rates-gateway';
import { PeriodRatesStore } from './period-rates-store';

const SELIC: PeriodRate = { kind: 'selic', month: '2026-10', basisPoints: 1300 };
const IPCA: PeriodRate = { kind: 'ipca', month: '2026-09', basisPoints: 52 };

class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(gateway: FakePeriodRatesGateway): {
  store: PeriodRatesStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      PeriodRatesStore,
      { provide: PeriodRatesGateway, useValue: gateway },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(PeriodRatesStore), errors };
}

describe('PeriodRatesStore', () => {
  it('loads the rates newest month first', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [IPCA, SELIC];

    const { store } = createStore(gateway);

    expect(store.isLoaded()).toBe(true);
    expect(store.rates().map((rate) => rate.month)).toEqual(['2026-10', '2026-09']);
  });

  it('reports a failed load and reads again on reload', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);

    gateway.failure = undefined;
    store.reload();

    expect(errors.errors).toHaveLength(1);
    expect(store.hasLoadFailed()).toBe(false);
    expect(store.isLoaded()).toBe(true);
  });

  it('adds a saved rate and counts the save', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [IPCA];
    const { store } = createStore(gateway);

    store.save('selic', '2026-10', { basisPoints: 1300 });

    expect(gateway.saved).toEqual([SELIC]);
    expect(store.rates()).toEqual([SELIC, IPCA]);
    expect(store.savedCount()).toBe(1);
  });

  it('replaces the rate of the same kind and month', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [SELIC];
    const { store } = createStore(gateway);

    store.save('selic', '2026-10', { basisPoints: 1375 });

    expect(store.rates()).toEqual([{ ...SELIC, basisPoints: 1375 }]);
  });

  it('removes a deleted rate and only that kind', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [SELIC, { ...SELIC, kind: 'ipca' }];
    const { store } = createStore(gateway);

    store.remove('selic', '2026-10');

    expect(gateway.deleted).toEqual([{ kind: 'selic', month: '2026-10' }]);
    expect(store.rates().map((rate) => rate.kind)).toEqual(['ipca']);
  });

  it('keeps the list and flags the failure when a save is refused', () => {
    const gateway = new FakePeriodRatesGateway();
    gateway.ratesToServe = [IPCA];
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('refused');

    store.save('selic', '2026-10', { basisPoints: 1300 });

    expect(store.hasActionFailed()).toBe(true);
    expect(store.savedCount()).toBe(0);
    expect(store.rates()).toEqual([IPCA]);
    expect(errors.errors).toHaveLength(1);
  });
});
