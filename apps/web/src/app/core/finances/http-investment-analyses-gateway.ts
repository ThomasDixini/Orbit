import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { InvestmentAnalysis, InvestmentAnalysisDraft } from './investment-analyses';
import { InvestmentAnalysesGateway } from './investment-analyses-gateway';

const ANALYSES_URL = '/api/investment-analyses';

/** Fundamental analyses stored by the Orbit API. */
@Injectable()
export class HttpInvestmentAnalysesGateway extends InvestmentAnalysesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly InvestmentAnalysis[]> {
    return this.httpClient.get<readonly InvestmentAnalysis[]>(ANALYSES_URL);
  }

  override save(id: string, draft: InvestmentAnalysisDraft): Observable<InvestmentAnalysis> {
    return this.httpClient.put<InvestmentAnalysis>(analysisUrl(id), draft);
  }

  override delete(id: string): Observable<void> {
    return this.httpClient.delete<void>(analysisUrl(id));
  }
}

function analysisUrl(id: string): string {
  return `${ANALYSES_URL}/${encodeURIComponent(id)}`;
}
