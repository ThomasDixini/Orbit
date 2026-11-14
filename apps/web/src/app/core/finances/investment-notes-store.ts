import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { InvestmentNote, InvestmentNoteDraft, sortedNotes } from './investment-notes';
import { InvestmentNotesGateway } from './investment-notes-gateway';

/**
 * The notes written about investments, shown on the Investments page. Provided by the component that
 * shows them: it reads the list when created and follows the API's answers (nothing is optimistic).
 */
@Injectable()
export class InvestmentNotesStore {
  private readonly gateway = inject(InvestmentNotesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly noteList = signal<readonly InvestmentNote[]>([]);
  private readonly loaded = signal(false);
  private readonly loadFailed = signal(false);
  private readonly actionFailed = signal(false);
  private readonly saves = signal(0);

  readonly notes = this.noteList.asReadonly();
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
   * Creates a note (a new id is generated when none is given) or replaces the one with that id.
   * @example store.save({ investmentId: 'petr4', kind: 'event', date: '2026-11-03', text: 'Dividend cut' })
   */
  save(draft: InvestmentNoteDraft, id?: string): void {
    this.change(this.gateway.save(id ?? this.ids.next(), draft), (note) => {
      this.noteList.update((notes) =>
        sortedNotes([...notes.filter((known) => known.id !== note.id), note]),
      );
      this.saves.update((count) => count + 1);
    });
  }

  /**
   * Deletes a note.
   * @example store.remove('note-1')
   */
  remove(id: string): void {
    this.change(this.gateway.delete(id), () =>
      this.noteList.update((notes) => notes.filter((note) => note.id !== id)),
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
      next: (notes) => {
        this.noteList.set(sortedNotes(notes));
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
