import { Observable, of, throwError } from 'rxjs';
import { InvestmentAnalysis, InvestmentAnalysisDraft } from './investment-analyses';
import { InvestmentAnalysesGateway } from './investment-analyses-gateway';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeInvestmentAnalysesGateway extends InvestmentAnalysesGateway {
  failure: Error | undefined;
  analysesToServe: readonly InvestmentAnalysis[] = [];
  readonly saved: { id: string; draft: InvestmentAnalysisDraft }[] = [];
  readonly deleted: string[] = [];
  listCalls = 0;

  override list(): Observable<readonly InvestmentAnalysis[]> {
    this.listCalls += 1;
    return this.answer(this.analysesToServe);
  }

  override save(id: string, draft: InvestmentAnalysisDraft): Observable<InvestmentAnalysis> {
    this.saved.push({ id, draft });
    return this.answer({ id, ...draft });
  }

  override delete(id: string): Observable<void> {
    this.deleted.push(id);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
