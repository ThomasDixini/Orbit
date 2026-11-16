import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { InvestmentAnalysis, InvestmentAnalysisDraft, sortedAnalyses } from './investment-analyses';
import { InvestmentAnalysesGateway } from './investment-analyses-gateway';

/**
 * The fundamental analyses written about investments. Provided by the component that shows them: it
 * reads the list when created and follows the API's answers (nothing is optimistic).
 */
@Injectable()
export class InvestmentAnalysesStore {
  private readonly gateway = inject(InvestmentAnalysesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly analysisList = signal<readonly InvestmentAnalysis[]>([]);
  private readonly loaded = signal(false);
  private readonly loadFailed = signal(false);
  private readonly actionFailed = signal(false);
  private readonly saves = signal(0);

  readonly analyses = this.analysisList.asReadonly();
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
   * Creates an analysis (a new id is generated when none is given) or replaces the one with that id.
   * @example store.save(emptyAnalysisDraft('totvs3', '2026-01-02'))
   */
  save(draft: InvestmentAnalysisDraft, id?: string): void {
    this.change(this.gateway.save(id ?? this.ids.next(), draft), (analysis) => {
      this.analysisList.update((analyses) =>
        sortedAnalyses([...analyses.filter((known) => known.id !== analysis.id), analysis]),
      );
      this.saves.update((count) => count + 1);
    });
  }

  /**
   * Deletes an analysis.
   * @example store.remove('analysis-1')
   */
  remove(id: string): void {
    this.change(this.gateway.delete(id), () =>
      this.analysisList.update((analyses) => analyses.filter((analysis) => analysis.id !== id)),
    );
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
      next: (analyses) => {
        this.analysisList.set(sortedAnalyses(analyses));
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
