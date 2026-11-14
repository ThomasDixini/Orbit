import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeInvestmentNotesGateway } from './fake-investment-notes-gateway';
import { InvestmentNote, InvestmentNoteDraft } from './investment-notes';
import { InvestmentNotesGateway } from './investment-notes-gateway';
import { InvestmentNotesStore } from './investment-notes-store';

const OLD: InvestmentNote = {
  id: 'old',
  investmentId: 'petr4',
  kind: 'analysis',
  date: '2026-10-01',
  text: 'Solid balance sheet',
};
const NEW: InvestmentNote = { ...OLD, id: 'new', kind: 'event', date: '2026-11-03' };
const DRAFT: InvestmentNoteDraft = {
  investmentId: 'petr4',
  kind: 'macro',
  date: '2026-11-05',
  text: 'Selic held',
};

class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(gateway: FakeInvestmentNotesGateway): {
  store: InvestmentNotesStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      InvestmentNotesStore,
      { provide: InvestmentNotesGateway, useValue: gateway },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(InvestmentNotesStore), errors };
}

describe('InvestmentNotesStore', () => {
  it('loads the notes newest day first', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [OLD, NEW];

    const { store } = createStore(gateway);

    expect(store.isLoaded()).toBe(true);
    expect(store.notes().map((note) => note.id)).toEqual(['new', 'old']);
  });

  it('reports a failed load and reads again on reload', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);

    gateway.failure = undefined;
    store.reload();

    expect(errors.errors).toHaveLength(1);
    expect(store.hasLoadFailed()).toBe(false);
    expect(store.isLoaded()).toBe(true);
  });

  it('adds a saved note in its place and counts the save', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [OLD, NEW];
    const { store } = createStore(gateway);

    store.save(DRAFT);

    expect(gateway.saved).toHaveLength(1);
    expect(store.notes()[0].text).toBe('Selic held');
    expect(store.savedCount()).toBe(1);
  });

  it('replaces a note when saving an existing id', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [OLD];
    const { store } = createStore(gateway);

    store.save({ ...DRAFT, text: 'Debt is growing' }, 'old');

    expect(store.notes().map((note) => note.text)).toEqual(['Debt is growing']);
  });

  it('removes a deleted note', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [OLD, NEW];
    const { store } = createStore(gateway);

    store.remove('old');

    expect(gateway.deleted).toEqual(['old']);
    expect(store.notes().map((note) => note.id)).toEqual(['new']);
  });

  it('keeps the list and flags the failure when a save is refused', () => {
    const gateway = new FakeInvestmentNotesGateway();
    gateway.notesToServe = [OLD];
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('refused');

    store.save(DRAFT);

    expect(store.hasActionFailed()).toBe(true);
    expect(store.savedCount()).toBe(0);
    expect(store.notes()).toEqual([OLD]);
    expect(errors.errors).toHaveLength(1);
  });
});
