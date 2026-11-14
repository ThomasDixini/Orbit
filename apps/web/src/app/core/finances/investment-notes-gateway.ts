import { Observable } from 'rxjs';
import { InvestmentNote, InvestmentNoteDraft } from './investment-notes';

/** Port to the notes written about investments. */
export abstract class InvestmentNotesGateway {
  /** Every note, newest day first. */
  abstract list(): Observable<readonly InvestmentNote[]>;

  /** Creates the note or replaces the one with that id; answers the stored note. */
  abstract save(id: string, draft: InvestmentNoteDraft): Observable<InvestmentNote>;

  /** Removes the note; an unknown id is ignored. */
  abstract delete(id: string): Observable<void>;
}
