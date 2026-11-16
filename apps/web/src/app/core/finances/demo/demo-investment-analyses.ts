import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  InvestmentAnalysis,
  InvestmentAnalysisDraft,
  sortedAnalyses,
} from '../investment-analyses';
import { InvestmentAnalysesGateway } from '../investment-analyses-gateway';

/** Fundamental analyses kept in memory by the demo; they start empty and last until the page is reloaded. */
@Injectable()
export class DemoInvestmentAnalysesGateway extends InvestmentAnalysesGateway {
  private analyses: readonly InvestmentAnalysis[] = [];

  override list(): Observable<readonly InvestmentAnalysis[]> {
    return of(sortedAnalyses(this.analyses));
  }

  override save(id: string, draft: InvestmentAnalysisDraft): Observable<InvestmentAnalysis> {
    const stored: InvestmentAnalysis = { id, ...draft };
    this.analyses = [...this.analyses.filter((analysis) => analysis.id !== id), stored];
    return of(stored);
  }

  override delete(id: string): Observable<void> {
    this.analyses = this.analyses.filter((analysis) => analysis.id !== id);
    return of(undefined);
  }
}
