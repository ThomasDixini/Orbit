import { Observable } from 'rxjs';
import { InvestmentAnalysis, InvestmentAnalysisDraft } from './investment-analyses';

/** Port to the fundamental analyses written about investments. */
export abstract class InvestmentAnalysesGateway {
  /** Every analysis, newest day first. */
  abstract list(): Observable<readonly InvestmentAnalysis[]>;

  /** Creates the analysis or replaces the one with that id; answers the stored analysis. */
  abstract save(id: string, draft: InvestmentAnalysisDraft): Observable<InvestmentAnalysis>;

  /** Removes the analysis; an unknown id is ignored. */
  abstract delete(id: string): Observable<void>;
}
