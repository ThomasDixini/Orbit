import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { PeriodRate, PeriodRateDraft, PeriodRateKind, sortedRates } from '../period-rates';
import { PeriodRatesGateway } from '../period-rates-gateway';

/** Period rates kept in memory by the demo; they start empty and last until the page is reloaded. */
@Injectable()
export class DemoPeriodRatesGateway extends PeriodRatesGateway {
  private rates: readonly PeriodRate[] = [];

  override list(): Observable<readonly PeriodRate[]> {
    return of(sortedRates(this.rates));
  }

  override save(
    kind: PeriodRateKind,
    month: string,
    draft: PeriodRateDraft,
  ): Observable<PeriodRate> {
    const stored: PeriodRate = { kind, month, ...draft };
    this.rates = [...this.without(kind, month), stored];
    return of(stored);
  }

  override delete(kind: PeriodRateKind, month: string): Observable<void> {
    this.rates = this.without(kind, month);
    return of(undefined);
  }

  private without(kind: PeriodRateKind, month: string): readonly PeriodRate[] {
    return this.rates.filter((rate) => rate.kind !== kind || rate.month !== month);
  }
}
