import { Observable, of, throwError } from 'rxjs';
import { InvestmentNote, InvestmentNoteDraft } from './investment-notes';
import { InvestmentNotesGateway } from './investment-notes-gateway';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeInvestmentNotesGateway extends InvestmentNotesGateway {
  failure: Error | undefined;
  notesToServe: readonly InvestmentNote[] = [];
  readonly saved: { id: string; draft: InvestmentNoteDraft }[] = [];
  readonly deleted: string[] = [];
  listCalls = 0;

  override list(): Observable<readonly InvestmentNote[]> {
    this.listCalls += 1;
    return this.answer(this.notesToServe);
  }

  override save(id: string, draft: InvestmentNoteDraft): Observable<InvestmentNote> {
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
