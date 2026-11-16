import {
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ANALYSIS_PEER_NAME_MAX,
  ANALYSIS_PEERS_MAX,
  ANALYSIS_TEXT_MAX,
  AnalysisRecommendation,
  InvestmentAnalysis,
  InvestmentAnalysisDraft,
  RECOMMENDATION_OPTIONS,
  SCENARIO_OPTIONS,
  ScenarioKind,
  emptyAnalysisDraft,
  marginOfSafetyPercent,
  scenarioReturnPercent,
  upsidePercent,
  weightedValuation,
} from '../../../../core/finances/investment-analyses';
import {
  COMPANY_SECTIONS,
  MetricField,
  PEER_METRICS,
  REVIEWED_TEXT_KEYS,
  SCENARIO_SECTION,
  companyTextLabel,
} from '../../../../core/finances/investment-analysis-fields';
import {
  AnalysisForm,
  EntriesForm,
  PeerForm,
  fieldId,
  readAnalysisForm,
  toAnalysisForm,
  withPeerAdded,
} from '../../../../core/finances/investment-analysis-form';
import {
  formatMetric,
  parseAnalysisNumber,
} from '../../../../core/finances/investment-analysis-numbers';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

const TEXT_ROWS = 3;

/**
 * The whole fundamental analysis of one investment as a form, one collapsible block per part of the stock
 * template. Numbers are typed in either decimal style; the upside, the margin of safety and each
 * scenario's return are worked out as they are typed.
 * @example <app-analysis-form [draft]="draft" [previous]="latest" (save)="store.save($event)" />
 */
@Component({
  selector: 'app-analysis-form',
  imports: [TranslatePipe],
  templateUrl: './analysis-form.html',
  styleUrl: './analysis-form.css',
})
export class InvestmentAnalysisForm {
  /** What the form starts with: a blank analysis, a copy of the latest one, or the one being edited. */
  readonly draft = input.required<InvestmentAnalysisDraft>();
  /** The analysis before this one, whose risks and catalysts this one reviews. */
  readonly previous = input<InvestmentAnalysis | undefined>(undefined);
  readonly isEditing = input(false);
  readonly hasFailed = input(false);
  readonly save = output<InvestmentAnalysisDraft>();
  readonly dismiss = output<void>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly sections = COMPANY_SECTIONS;
  protected readonly scenarioSection = SCENARIO_SECTION;
  protected readonly scenarioOptions = SCENARIO_OPTIONS;
  protected readonly recommendationOptions = RECOMMENDATION_OPTIONS;
  protected readonly peerMetrics = PEER_METRICS;
  protected readonly textMax = ANALYSIS_TEXT_MAX;
  protected readonly peerNameMax = ANALYSIS_PEER_NAME_MAX;
  protected readonly peersMax = ANALYSIS_PEERS_MAX;
  protected readonly textRows = TEXT_ROWS;
  protected readonly form = signal<AnalysisForm>(
    toAnalysisForm(emptyAnalysisDraft('', ''), this.locale),
  );
  protected readonly invalid = signal<ReadonlySet<string>>(new Set());

  protected readonly reviewed = computed(() => {
    const previous = this.previous();
    if (previous === undefined) return [];
    return REVIEWED_TEXT_KEYS.filter((key) => (previous.texts[key] ?? '') !== '').map((key) => ({
      label: companyTextLabel(key),
      text: previous.texts[key],
    }));
  });
  protected readonly companyNumbers = computed(() => this.numbers(this.form().company));
  protected readonly upside = computed(() =>
    this.percentText(upsidePercent(this.companyNumbers())),
  );
  protected readonly marginOfSafety = computed(() =>
    this.percentText(marginOfSafetyPercent(this.companyNumbers())),
  );
  protected readonly weighted = computed(() => {
    const scenarios = this.scenarioOptions.map((option) => ({
      kind: option.value,
      texts: {},
      metrics: this.numbers(this.form().scenarios[option.value]),
    }));
    const value = weightedValuation(scenarios);
    return value === undefined ? '' : formatMetric(value, 'money', this.locale);
  });

  constructor() {
    effect(() => {
      this.form.set(toAnalysisForm(this.draft(), this.locale));
      this.invalid.set(new Set());
    });
  }

  protected scenarioReturn(kind: ScenarioKind): string {
    const scenario = this.numbers(this.form().scenarios[kind]);
    return this.percentText(scenarioReturnPercent(scenario, this.companyNumbers()));
  }

  protected isInvalid(...parts: readonly (string | number)[]): boolean {
    return this.invalid().has(fieldId(...parts));
  }

  protected unitHint(field: MetricField): string {
    return { percent: '%', multiple: 'x', money: 'R$', days: 'days', millions: 'R$ MM' }[
      field.unit
    ];
  }

  protected setDate(event: Event): void {
    this.form.update((form) => ({ ...form, date: fieldValue(event) }));
  }

  protected setRecommendation(event: Event): void {
    const value = fieldValue(event) as AnalysisRecommendation | '';
    this.form.update((form) => ({ ...form, recommendation: value }));
  }

  protected setCompanyText(key: string, event: Event): void {
    this.form.update((form) => ({
      ...form,
      company: withText(form.company, key, fieldValue(event)),
    }));
  }

  protected setCompanyMetric(key: string, event: Event): void {
    this.form.update((form) => ({
      ...form,
      company: withMetric(form.company, key, fieldValue(event)),
    }));
  }

  protected setScenarioText(kind: ScenarioKind, key: string, event: Event): void {
    this.updateScenario(kind, (entries) => withText(entries, key, fieldValue(event)));
  }

  protected setScenarioMetric(kind: ScenarioKind, key: string, event: Event): void {
    this.updateScenario(kind, (entries) => withMetric(entries, key, fieldValue(event)));
  }

  protected setPeerName(index: number, event: Event): void {
    this.updatePeer(index, (peer) => ({ ...peer, name: fieldValue(event) }));
  }

  protected setPeerMetric(index: number, key: string, event: Event): void {
    this.updatePeer(index, (peer) => ({
      ...peer,
      metrics: { ...peer.metrics, [key]: fieldValue(event) },
    }));
  }

  protected addPeer(): void {
    this.form.update(withPeerAdded);
  }

  protected removePeer(index: number): void {
    this.form.update((form) => ({ ...form, peers: form.peers.filter((_, at) => at !== index) }));
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const reading = readAnalysisForm(this.form(), this.draft().investmentId);
    if (reading.kind === 'invalid') {
      this.invalid.set(reading.fields);
      return;
    }
    this.invalid.set(new Set());
    this.save.emit(reading.draft);
  }

  private updateScenario(kind: ScenarioKind, change: (entries: EntriesForm) => EntriesForm): void {
    this.form.update((form) => ({
      ...form,
      scenarios: { ...form.scenarios, [kind]: change(form.scenarios[kind]) },
    }));
  }

  private updatePeer(index: number, change: (peer: PeerForm) => PeerForm): void {
    this.form.update((form) => ({
      ...form,
      peers: form.peers.map((peer, at) => (at === index ? change(peer) : peer)),
    }));
  }

  private numbers(entries: EntriesForm): Record<string, number> {
    const numbers: Record<string, number> = {};
    for (const [key, text] of Object.entries(entries.metrics)) {
      const value = parseAnalysisNumber(text);
      if (value !== undefined && text.trim() !== '') numbers[key] = value;
    }
    return numbers;
  }

  private percentText(percent: number | undefined): string {
    return percent === undefined ? '' : formatMetric(percent, 'percent', this.locale);
  }
}

function withText(entries: EntriesForm, key: string, value: string): EntriesForm {
  return { ...entries, texts: { ...entries.texts, [key]: value } };
}

function withMetric(entries: EntriesForm, key: string, value: string): EntriesForm {
  return { ...entries, metrics: { ...entries.metrics, [key]: value } };
}
