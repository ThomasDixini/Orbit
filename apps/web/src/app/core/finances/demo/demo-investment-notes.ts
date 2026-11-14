import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { InvestmentNote, InvestmentNoteDraft, sortedNotes } from '../investment-notes';
import { InvestmentNotesGateway } from '../investment-notes-gateway';

/** Investment notes kept in memory by the demo; they start empty and last until the page is reloaded. */
@Injectable()
export class DemoInvestmentNotesGateway extends InvestmentNotesGateway {
  private notes: readonly InvestmentNote[] = [];

  override list(): Observable<readonly InvestmentNote[]> {
    return of(sortedNotes(this.notes));
  }

  override save(id: string, draft: InvestmentNoteDraft): Observable<InvestmentNote> {
    const stored: InvestmentNote = { id, ...draft };
    this.notes = [...this.notes.filter((note) => note.id !== id), stored];
    return of(stored);
  }

  override delete(id: string): Observable<void> {
    this.notes = this.notes.filter((note) => note.id !== id);
    return of(undefined);
  }
}
