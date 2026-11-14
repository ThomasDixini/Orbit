import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PeriodRate, PeriodRateDraft, PeriodRateKind } from './period-rates';
import { PeriodRatesGateway } from './period-rates-gateway';

const RATES_URL = '/api/period-rates';

/** Period rates stored by the Orbit API. */
@Injectable()
export class HttpPeriodRatesGateway extends PeriodRatesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly PeriodRate[]> {
    return this.httpClient.get<readonly PeriodRate[]>(RATES_URL);
  }

  override save(
    kind: PeriodRateKind,
    month: string,
    draft: PeriodRateDraft,
  ): Observable<PeriodRate> {
    return this.httpClient.put<PeriodRate>(rateUrl(kind, month), draft);
  }

  override delete(kind: PeriodRateKind, month: string): Observable<void> {
    return this.httpClient.delete<void>(rateUrl(kind, month));
  }
}

function rateUrl(kind: PeriodRateKind, month: string): string {
  return `${RATES_URL}/${kind}/${encodeURIComponent(month)}`;
}
