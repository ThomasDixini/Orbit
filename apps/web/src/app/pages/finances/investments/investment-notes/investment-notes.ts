import { Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { LoadFailed } from '../../../../components/load-failed/load-failed';
import {
  INVESTMENT_NOTE_KIND_OPTIONS,
  INVESTMENT_NOTE_TEXT_MAX,
  InvestmentNote,
  InvestmentNoteKind,
  investmentNoteKindLabel,
} from '../../../../core/finances/investment-notes';
import { InvestmentNotesStore } from '../../../../core/finances/investment-notes-store';
import { PortfolioLine } from '../../../../core/finances/investments';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** The form open above the list: a new note, the note being edited, or none. */
type Editing = InvestmentNote | 'new' | null;

const TEXT_ROWS = 6;

/**
 * The notes the user wrote about their investments (analyses, events, macro facts), newest day first, with
 * an inline form to write or edit one. Provides its own store, so it loads when it is shown.
 * @example <app-investment-notes [lines]="lines()" [today]="today" />
 */
@Component({
  selector: 'app-investment-notes',
  imports: [TranslatePipe, LoadFailed],
  providers: [InvestmentNotesStore],
  templateUrl: './investment-notes.html',
  styleUrl: './investment-notes.css',
})
export class InvestmentNotes {
  readonly lines = input.required<readonly PortfolioLine[]>();
  /** Today, `YYYY-MM-DD`: the day a new note refers to until changed. */
  readonly today = input.required<string>();

  private readonly store = inject(InvestmentNotesStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly notes = this.store.notes;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly hasActionFailed = this.store.hasActionFailed;
  protected readonly kindOptions = INVESTMENT_NOTE_KIND_OPTIONS;
  protected readonly maxLength = INVESTMENT_NOTE_TEXT_MAX;
  protected readonly textRows = TEXT_ROWS;
  protected readonly editing = signal<Editing>(null);
  protected readonly investmentId = signal('');
  protected readonly kind = signal<InvestmentNoteKind>('analysis');
  protected readonly date = signal('');
  protected readonly text = signal('');

  protected readonly investments = computed(() =>
    this.lines().map((line) => ({ id: line.investment.id, name: line.investment.name })),
  );
  protected readonly isOpen = computed(() => this.editing() !== null);
  protected readonly isEditing = computed(() => typeof this.editing() === 'object');
  protected readonly canSave = computed(
    () =>
      this.investmentId() !== '' &&
      this.date() !== '' &&
      this.text().trim() !== '' &&
      this.text().length <= INVESTMENT_NOTE_TEXT_MAX,
  );

  private readonly savesAtOpen = signal(0);

  constructor() {
    // A form closes once the API has accepted its save.
    effect(() => {
      if (this.store.savedCount() > this.savesAtOpen()) this.editing.set(null);
    });
  }

  protected openNew(): void {
    this.fill('', 'analysis', this.today(), '');
    this.editing.set('new');
  }

  protected openEdit(note: InvestmentNote): void {
    this.fill(note.investmentId, note.kind, note.date, note.text);
    this.editing.set(note);
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canSave()) return;
    const editing = this.editing();
    this.savesAtOpen.set(this.store.savedCount());
    this.store.save(
      {
        investmentId: this.investmentId(),
        kind: this.kind(),
        date: this.date(),
        text: this.text(),
      },
      typeof editing === 'object' ? editing?.id : undefined,
    );
  }

  protected remove(note: InvestmentNote): void {
    this.store.remove(note.id);
  }

  protected reload(): void {
    this.store.reload();
  }

  protected investmentName(note: InvestmentNote): string {
    return (
      this.investments().find((item) => item.id === note.investmentId)?.name ?? note.investmentId
    );
  }

  protected kindLabel(note: InvestmentNote): string {
    return investmentNoteKindLabel(note.kind);
  }

  protected dateLabel(note: InvestmentNote): string {
    return shortDateLabel(note.date, this.locale);
  }

  protected readonly valueOf = fieldValue;

  private fill(investmentId: string, kind: InvestmentNoteKind, date: string, text: string): void {
    this.investmentId.set(investmentId === '' ? (this.investments()[0]?.id ?? '') : investmentId);
    this.kind.set(kind);
    this.date.set(date);
    this.text.set(text);
  }
}
