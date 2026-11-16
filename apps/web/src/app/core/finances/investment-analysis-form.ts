import {
  ANALYSIS_PEERS_MAX,
  AnalysisMetrics,
  AnalysisRecommendation,
  AnalysisScenario,
  AnalysisTexts,
  InvestmentAnalysisDraft,
  PeerComparison,
  SCENARIO_OPTIONS,
  ScenarioKind,
} from './investment-analyses';
import { metricInputText, parseAnalysisNumber } from './investment-analysis-numbers';

/** Texts and numbers as typed: numbers stay text until saved, so `18,` can be half typed. */
export interface EntriesForm {
  readonly texts: Readonly<Record<string, string>>;
  readonly metrics: Readonly<Record<string, string>>;
}

export interface PeerForm {
  readonly name: string;
  readonly metrics: Readonly<Record<string, string>>;
}

/** Everything the analysis form holds while it is being filled in. */
export interface AnalysisForm {
  readonly date: string;
  readonly recommendation: AnalysisRecommendation | '';
  readonly company: EntriesForm;
  readonly peers: readonly PeerForm[];
  readonly scenarios: Readonly<Record<ScenarioKind, EntriesForm>>;
}

/** What reading the form gives: the draft to save, or the fields that cannot be read. */
export type AnalysisFormReading =
  | { readonly kind: 'valid'; readonly draft: InvestmentAnalysisDraft }
  | { readonly kind: 'invalid'; readonly fields: ReadonlySet<string> };

const MAX_PROBABILITY = 100;
const EMPTY_ENTRIES: EntriesForm = { texts: {}, metrics: {} };

/**
 * The id the form gives a field, so the invalid ones can be marked: `company.roe`, `peer.0.name`,
 * `scenario.base.probability`.
 * @example fieldId('scenario', 'base', 'probability') // 'scenario.base.probability'
 */
export function fieldId(...parts: readonly (string | number)[]): string {
  return parts.join('.');
}

/**
 * The form filled with a draft, numbers written the way the reader types them.
 * @example toAnalysisForm(emptyAnalysisDraft('totvs3', '2026-01-02'), 'pt-BR').date // '2026-01-02'
 */
export function toAnalysisForm(draft: InvestmentAnalysisDraft, locale: string): AnalysisForm {
  const scenarioOf = (kind: ScenarioKind): EntriesForm => {
    const scenario = draft.scenarios.find((candidate) => candidate.kind === kind);
    return scenario === undefined
      ? EMPTY_ENTRIES
      : toEntriesForm(scenario.texts, scenario.metrics, locale);
  };
  return {
    date: draft.date,
    recommendation: draft.recommendation ?? '',
    company: toEntriesForm(draft.texts, draft.metrics, locale),
    peers: draft.peers.map((peer) => ({
      name: peer.name,
      metrics: metricTexts(peer.metrics, locale),
    })),
    scenarios: {
      base: scenarioOf('base'),
      optimistic: scenarioOf('optimistic'),
      pessimistic: scenarioOf('pessimistic'),
    },
  };
}

/**
 * Reads the form into a draft; numbers that cannot be read (and probabilities over 100) make it invalid.
 * Blank texts, untouched scenarios and unnamed empty peers are left out.
 * @example readAnalysisForm(form, 'totvs3').kind // 'valid'
 */
export function readAnalysisForm(form: AnalysisForm, investmentId: string): AnalysisFormReading {
  const invalid = new Set<string>();
  const company = readMetrics(form.company.metrics, invalid, 'company');
  const peers = readPeers(form.peers, invalid);
  const scenarios = readScenarios(form.scenarios, invalid);
  if (invalid.size > 0 || form.date === '') return { kind: 'invalid', fields: invalid };
  const draft: InvestmentAnalysisDraft = {
    investmentId,
    date: form.date,
    texts: filledTexts(form.company.texts),
    metrics: company,
    peers,
    scenarios,
  };
  return {
    kind: 'valid',
    draft: form.recommendation === '' ? draft : { ...draft, recommendation: form.recommendation },
  };
}

/**
 * The form with one more, empty, peer; unchanged once the API's limit is reached.
 * @example withPeerAdded(form).peers.length // form.peers.length + 1
 */
export function withPeerAdded(form: AnalysisForm): AnalysisForm {
  if (form.peers.length >= ANALYSIS_PEERS_MAX) return form;
  return { ...form, peers: [...form.peers, { name: '', metrics: {} }] };
}

function toEntriesForm(
  texts: AnalysisTexts,
  metrics: AnalysisMetrics,
  locale: string,
): EntriesForm {
  return { texts: { ...texts }, metrics: metricTexts(metrics, locale) };
}

function metricTexts(metrics: AnalysisMetrics, locale: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [key, metricInputText(value, locale)]),
  );
}

function filledTexts(texts: Readonly<Record<string, string>>): AnalysisTexts {
  return Object.fromEntries(Object.entries(texts).filter(([, value]) => value.trim() !== ''));
}

function readMetrics(
  typed: Readonly<Record<string, string>>,
  invalid: Set<string>,
  ...owner: readonly (string | number)[]
): AnalysisMetrics {
  const metrics: Record<string, number> = {};
  for (const [key, text] of Object.entries(typed)) {
    if (text.trim() === '') continue;
    const value = parseAnalysisNumber(text);
    if (value === undefined) invalid.add(fieldId(...owner, key));
    else metrics[key] = value;
  }
  return metrics;
}

function readPeers(peers: readonly PeerForm[], invalid: Set<string>): readonly PeerComparison[] {
  return peers.flatMap((peer, index) => {
    const metrics = readMetrics(peer.metrics, invalid, 'peer', index);
    const name = peer.name.trim();
    if (name !== '') return [{ name, metrics }];
    if (Object.values(peer.metrics).some((text) => text.trim() !== '')) {
      invalid.add(fieldId('peer', index, 'name'));
    }
    return [];
  });
}

function readScenarios(
  scenarios: Readonly<Record<ScenarioKind, EntriesForm>>,
  invalid: Set<string>,
): readonly AnalysisScenario[] {
  return SCENARIO_OPTIONS.flatMap(({ value: kind }) => {
    const typed = scenarios[kind];
    const metrics = readMetrics(typed.metrics, invalid, 'scenario', kind);
    const probability = metrics['probability'];
    if (probability !== undefined && (probability < 0 || probability > MAX_PROBABILITY)) {
      invalid.add(fieldId('scenario', kind, 'probability'));
    }
    const texts = filledTexts(typed.texts);
    const isFilled = Object.keys(texts).length > 0 || Object.keys(metrics).length > 0;
    return isFilled ? [{ kind, texts, metrics }] : [];
  });
}
