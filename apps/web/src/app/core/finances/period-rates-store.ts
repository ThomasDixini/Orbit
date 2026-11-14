import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PeriodRate, PeriodRateDraft, PeriodRateKind, sortedRates } from './period-rates';
import { PeriodRatesGateway } from './period-rates-gateway';

/**
 * The rates typed for each month, shared by the Investments page (which draws them on the return chart)
 * and the rates section (which edits them). Provided by the page; it reads the list when created and
 * follows the API's answers (nothing is optimistic).
 */
@Injectable()
export class PeriodRatesStore {
  private readonly gateway = inject(PeriodRatesGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly rateList = signal<readonly PeriodRate[]>([]);
  private readonly loaded = signal(false);
  private readonly loadFailed = signal(false);
  private readonly actionFailed = signal(false);
  private readonly saves = signal(0);

  readonly rates = this.rateList.asReadonly();
  readonly isLoaded = this.loaded.asReadonly();
  readonly hasLoadFailed = this.loadFailed.asReadonly();
  readonly hasActionFailed = this.actionFailed.asReadonly();
  /** How many saves the API has accepted; a form waits for it to grow to know its save went through. */
  readonly savedCount = this.saves.asReadonly();

  constructor() {
    this.load();
  }

  /**
   * Loads again after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    this.load();
  }

  /**
   * Saves the rate of a kind for a month, replacing the one already there.
   * @example store.save('selic', '2026-10', { basisPoints: 1300 })
   */
  save(kind: PeriodRateKind, month: string, draft: PeriodRateDraft): void {
    this.change(this.gateway.save(kind, month, draft), (rate) => {
      this.rateList.update((rates) => sortedRates([...this.without(rates, kind, month), rate]));
      this.saves.update((count) => count + 1);
    });
  }

  /**
   * Deletes the rate of a kind for a month.
   * @example store.remove('selic', '2026-10')
   */
  remove(kind: PeriodRateKind, month: string): void {
    this.change(this.gateway.delete(kind, month), () =>
      this.rateList.update((rates) => this.without(rates, kind, month)),
    );
  }

  private without(
    rates: readonly PeriodRate[],
    kind: PeriodRateKind,
    month: string,
  ): readonly PeriodRate[] {
    return rates.filter((rate) => rate.kind !== kind || rate.month !== month);
  }

  private change<TAnswer>(
    request: Observable<TAnswer>,
    onAccepted: (answer: TAnswer) => void,
  ): void {
    this.actionFailed.set(false);
    request.subscribe({
      next: onAccepted,
      error: (error: unknown) => {
        this.actionFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }

  private load(): void {
    this.gateway.list().subscribe({
      next: (rates) => {
        this.rateList.set(sortedRates(rates));
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
