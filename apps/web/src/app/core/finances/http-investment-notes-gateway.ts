import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { InvestmentNote, InvestmentNoteDraft } from './investment-notes';
import { InvestmentNotesGateway } from './investment-notes-gateway';

const NOTES_URL = '/api/investment-notes';

/** Investment notes stored by the Orbit API. */
@Injectable()
export class HttpInvestmentNotesGateway extends InvestmentNotesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly InvestmentNote[]> {
    return this.httpClient.get<readonly InvestmentNote[]>(NOTES_URL);
  }

  override save(id: string, draft: InvestmentNoteDraft): Observable<InvestmentNote> {
    return this.httpClient.put<InvestmentNote>(noteUrl(id), draft);
  }

  override delete(id: string): Observable<void> {
    return this.httpClient.delete<void>(noteUrl(id));
  }
}

function noteUrl(id: string): string {
  return `${NOTES_URL}/${encodeURIComponent(id)}`;
}
