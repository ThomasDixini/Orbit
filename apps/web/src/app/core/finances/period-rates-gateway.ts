import { Observable } from 'rxjs';
import { PeriodRate, PeriodRateDraft, PeriodRateKind } from './period-rates';

/** Port to the monthly rates (Selic, IPCA, income tax) the user typed. */
export abstract class PeriodRatesGateway {
  /** Every rate, newest month first. */
  abstract list(): Observable<readonly PeriodRate[]>;

  /** Creates the rate of this kind and month, or replaces it; answers the stored rate. */
  abstract save(
    kind: PeriodRateKind,
    month: string,
    draft: PeriodRateDraft,
  ): Observable<PeriodRate>;

  /** Removes the rate of this kind and month; one that is not there is ignored. */
  abstract delete(kind: PeriodRateKind, month: string): Observable<void>;
}
