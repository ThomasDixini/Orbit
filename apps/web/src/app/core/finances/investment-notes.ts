/** What a note about an investment is: its fundamental analysis, an event, or a macroeconomic fact. */
export type InvestmentNoteKind = 'analysis' | 'event' | 'macro';

/** Free text the user wrote about one investment, dated by the day it refers to. */
export interface InvestmentNote {
  readonly id: string;
  readonly investmentId: string;
  readonly kind: InvestmentNoteKind;
  /** The day the note refers to, `YYYY-MM-DD`. */
  readonly date: string;
  readonly text: string;
}

/** What the note form fills in; the id is given by the store. */
export type InvestmentNoteDraft = Omit<InvestmentNote, 'id'>;

/** Same limit as the API. */
export const INVESTMENT_NOTE_TEXT_MAX = 4000;

export const INVESTMENT_NOTE_KIND_OPTIONS: readonly { value: InvestmentNoteKind; label: string }[] =
  [
    { value: 'analysis', label: 'Analysis' },
    { value: 'event', label: 'Event' },
    { value: 'macro', label: 'Macro' },
  ];

/**
 * The label of a note kind.
 * @example investmentNoteKindLabel('macro') // 'Macro'
 */
export function investmentNoteKindLabel(kind: InvestmentNoteKind): string {
  return INVESTMENT_NOTE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/**
 * Notes newest day first; notes of the same day keep the order given.
 * @example sortedNotes([older, newer]) // [newer, older]
 */
export function sortedNotes(notes: readonly InvestmentNote[]): readonly InvestmentNote[] {
  return [...notes].sort((first, second) => second.date.localeCompare(first.date));
}
