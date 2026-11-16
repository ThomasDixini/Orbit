import {
  AnalysisMetrics,
  AnalysisTexts,
  InvestmentAnalysis,
  SCENARIO_OPTIONS,
  ScenarioKind,
} from './investment-analyses';
import {
  AnalysisSection,
  COMPANY_SECTIONS,
  MetricField,
  MetricUnit,
  PEER_METRICS,
  SCENARIO_SECTION,
} from './investment-analysis-fields';

/** A number of two analyses side by side; `change` only when both have it. */
export interface MetricComparison {
  readonly key: string;
  readonly label: string;
  readonly unit: MetricUnit;
  readonly before?: number;
  readonly after?: number;
  readonly change?: number;
}

/** A text of two analyses side by side, and whether it was rewritten. */
export interface TextComparison {
  readonly key: string;
  readonly label: string;
  readonly before: string;
  readonly after: string;
  readonly changed: boolean;
}

/** One block of the comparison; only fields filled in either analysis are kept. */
export interface SectionComparison {
  readonly id: string;
  readonly title: string;
  readonly metrics: readonly MetricComparison[];
  readonly texts: readonly TextComparison[];
}

/**
 * The company blocks then one block per scenario, comparing an older analysis with a newer one. A block
 * with nothing filled in either analysis is left out.
 * @example compareAnalyses(january, june)[0].title // 'Summary'
 */
export function compareAnalyses(
  before: InvestmentAnalysis,
  after: InvestmentAnalysis,
): readonly SectionComparison[] {
  const company = COMPANY_SECTIONS.map((section) =>
    compareSection(section, section.id, section.title, entriesOf(before), entriesOf(after)),
  );
  const peers = peerNames(before, after).map((name) =>
    compareSection(
      PEER_SECTION,
      `peer-${name}`,
      name,
      peerEntries(before, name),
      peerEntries(after, name),
    ),
  );
  const scenarios = SCENARIO_OPTIONS.map((option) =>
    compareSection(
      SCENARIO_SECTION,
      `scenario-${option.value}`,
      option.label,
      scenarioEntries(before, option.value),
      scenarioEntries(after, option.value),
    ),
  );
  return [...company, ...peers, ...scenarios].filter(
    (section) => section.metrics.length > 0 || section.texts.length > 0,
  );
}

/**
 * The analysis just before this one of the same investment, if any.
 * @example previousAnalysis(june, all)?.id // 'january'
 */
export function previousAnalysis(
  analysis: InvestmentAnalysis,
  analyses: readonly InvestmentAnalysis[],
): InvestmentAnalysis | undefined {
  return analyses
    .filter(
      (candidate) =>
        candidate.investmentId === analysis.investmentId &&
        candidate.id !== analysis.id &&
        candidate.date <= analysis.date,
    )
    .sort((first, second) => second.date.localeCompare(first.date))[0];
}

interface Entries {
  readonly texts: AnalysisTexts;
  readonly metrics: AnalysisMetrics;
}

const NO_ENTRIES: Entries = { texts: {}, metrics: {} };

const PEER_SECTION: AnalysisSection = {
  id: 'peer',
  title: 'Peer',
  texts: [],
  metrics: PEER_METRICS,
};

function entriesOf(analysis: InvestmentAnalysis): Entries {
  return { texts: analysis.texts, metrics: analysis.metrics };
}

function scenarioEntries(analysis: InvestmentAnalysis, kind: ScenarioKind): Entries {
  return analysis.scenarios.find((scenario) => scenario.kind === kind) ?? NO_ENTRIES;
}

/** Peers are matched by name, ignoring case, in the newer analysis' order and then the older one's. */
function peerNames(before: InvestmentAnalysis, after: InvestmentAnalysis): readonly string[] {
  const names = [...after.peers, ...before.peers].map((peer) => peer.name);
  return names.filter((name, index) => names.findIndex((other) => sameName(other, name)) === index);
}

function peerEntries(analysis: InvestmentAnalysis, name: string): Entries {
  const peer = analysis.peers.find((candidate) => sameName(candidate.name, name));
  return peer === undefined ? NO_ENTRIES : { texts: {}, metrics: peer.metrics };
}

function sameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

function compareSection(
  section: AnalysisSection,
  id: string,
  title: string,
  before: Entries,
  after: Entries,
): SectionComparison {
  return {
    id,
    title,
    metrics: section.metrics
      .map((field) => compareMetric(field, before.metrics, after.metrics))
      .filter((row) => row.before !== undefined || row.after !== undefined),
    texts: section.texts
      .map((field) => {
        const older = before.texts[field.key] ?? '';
        const newer = after.texts[field.key] ?? '';
        return { ...field, before: older, after: newer, changed: older.trim() !== newer.trim() };
      })
      .filter((row) => row.before !== '' || row.after !== ''),
  };
}

function compareMetric(
  field: MetricField,
  before: AnalysisMetrics,
  after: AnalysisMetrics,
): MetricComparison {
  const older = before[field.key];
  const newer = after[field.key];
  const row: MetricComparison = { ...field, before: older, after: newer };
  return older !== undefined && newer !== undefined ? { ...row, change: newer - older } : row;
}
