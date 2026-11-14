import { Observable, of, throwError } from 'rxjs';
import { PeriodRate, PeriodRateDraft, PeriodRateKind } from './period-rates';
import { PeriodRatesGateway } from './period-rates-gateway';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakePeriodRatesGateway extends PeriodRatesGateway {
  failure: Error | undefined;
  ratesToServe: readonly PeriodRate[] = [];
  readonly saved: PeriodRate[] = [];
  readonly deleted: { kind: PeriodRateKind; month: string }[] = [];
  listCalls = 0;

  override list(): Observable<readonly PeriodRate[]> {
    this.listCalls += 1;
    return this.answer(this.ratesToServe);
  }

  override save(
    kind: PeriodRateKind,
    month: string,
    draft: PeriodRateDraft,
  ): Observable<PeriodRate> {
    const rate: PeriodRate = { kind, month, ...draft };
    this.saved.push(rate);
    return this.answer(rate);
  }

  override delete(kind: PeriodRateKind, month: string): Observable<void> {
    this.deleted.push({ kind, month });
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
