import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeInvestmentsGateway } from './fake-investments-gateway';
import { BalanceEntryDraft } from './investments';
import { InvestmentsGateway } from './investments-gateway';
import { InvestmentsStore } from './investments-store';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

const DEPOSIT: BalanceEntryDraft = {
  investmentId: 'rdb',
  date: '2026-11-03',
  kind: 'deposit',
  amountCents: 88_400,
};

class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(gateway = new FakeInvestmentsGateway()) {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      InvestmentsStore,
      { provide: InvestmentsGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(InvestmentsStore), gateway, errors };
}

describe('InvestmentsStore balance entries', () => {
  it('saves an entry under a new id and reads the portfolio again', async () => {
    const { store, gateway } = createStore();

    const isDone = await store.addBalanceEntry(DEPOSIT);

    expect([isDone, gateway.savedBalanceEntries, gateway.askedDays.length]).toEqual([
      true,
      [{ id: 'id-1', draft: DEPOSIT }],
      2,
    ]);
  });

  it('deletes an entry through the gateway and reads the portfolio again', async () => {
    const { store, gateway } = createStore();

    const isDone = await store.deleteBalanceEntry('deposit-rdb');

    expect([isDone, gateway.deletedBalanceEntries, gateway.askedDays.length]).toEqual([
      true,
      ['deposit-rdb'],
      2,
    ]);
  });

  it('reports a refusal and says the entry was not stored', async () => {
    const gateway = new FakeInvestmentsGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('refused');

    const isDone = await store.addBalanceEntry(DEPOSIT);

    expect([isDone, errors.errors.length > 0]).toEqual([false, true]);
  });
});
