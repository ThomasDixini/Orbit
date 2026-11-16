/** What the analysis concluded to do with the investment. */
export type AnalysisRecommendation = 'buy' | 'hold' | 'sell';

/** Which of the three futures a scenario describes. */
export type ScenarioKind = 'base' | 'optimistic' | 'pessimistic';

/** Texts and numbers keyed by the field names of `investment-analysis-fields.ts`. */
export type AnalysisTexts = Readonly<Record<string, string>>;
export type AnalysisMetrics = Readonly<Record<string, number>>;

/** A competitor (or the sector average) and the numbers the company is compared with. */
export interface PeerComparison {
  readonly name: string;
  readonly metrics: AnalysisMetrics;
}

/** One possible future: how likely it is, its premises and the value per share they lead to. */
export interface AnalysisScenario {
  readonly kind: ScenarioKind;
  readonly texts: AnalysisTexts;
  readonly metrics: AnalysisMetrics;
}

/** A fundamental analysis of one investment as it stood on a day; each one is kept apart. */
export interface InvestmentAnalysis {
  readonly id: string;
  readonly investmentId: string;
  /** The day the analysis was made, `YYYY-MM-DD`. */
  readonly date: string;
  readonly recommendation?: AnalysisRecommendation;
  readonly texts: AnalysisTexts;
  readonly metrics: AnalysisMetrics;
  readonly peers: readonly PeerComparison[];
  readonly scenarios: readonly AnalysisScenario[];
}

/** What the analysis form fills in; the id is given by the store. */
export type InvestmentAnalysisDraft = Omit<InvestmentAnalysis, 'id'>;

/** Same limits as the API. */
export const ANALYSIS_TEXT_MAX = 2000;
export const ANALYSIS_PEER_NAME_MAX = 80;
export const ANALYSIS_PEERS_MAX = 5;
export const ANALYSIS_METRIC_MAGNITUDE_MAX = 1_000_000_000_000;

export const RECOMMENDATION_OPTIONS: readonly { value: AnalysisRecommendation; label: string }[] = [
  // Not plain "Buy"/"Sell": those already translate as the trade kinds (a purchase, a sale).
  { value: 'buy', label: 'Buy rating' },
  { value: 'hold', label: 'Hold rating' },
  { value: 'sell', label: 'Sell rating' },
];

export const SCENARIO_OPTIONS: readonly { value: ScenarioKind; label: string }[] = [
  { value: 'base', label: 'Base scenario' },
  { value: 'optimistic', label: 'Optimistic scenario' },
  { value: 'pessimistic', label: 'Pessimistic scenario' },
];

/** The text where a new analysis tells what came true of the previous one. */
export const PREVIOUS_REVIEW_KEY = 'previousReview';

const PERCENT = 100;

/**
 * The label of a recommendation.
 * @example recommendationLabel('hold') // 'Hold'
 */
export function recommendationLabel(recommendation: AnalysisRecommendation): string {
  return RECOMMENDATION_OPTIONS.find((option) => option.value === recommendation)?.label ?? '';
}

/**
 * Analyses newest day first; analyses of the same day keep the order given.
 * @example sortedAnalyses([january, june]) // [june, january]
 */
export function sortedAnalyses(
  analyses: readonly InvestmentAnalysis[],
): readonly InvestmentAnalysis[] {
  return [...analyses].sort((first, second) => second.date.localeCompare(first.date));
}

/**
 * The analyses of one investment, newest day first.
 * @example analysesOf(all, 'totvs3') // [june, january]
 */
export function analysesOf(
  analyses: readonly InvestmentAnalysis[],
  investmentId: string,
): readonly InvestmentAnalysis[] {
  return sortedAnalyses(analyses.filter((analysis) => analysis.investmentId === investmentId));
}

/**
 * The starting point of a new analysis: a copy of the latest one dated today, so only what changed has to
 * be typed again. The review of the previous analysis starts blank, since it is about this new one.
 * @example nextAnalysisDraft(january, '2026-06-01').date // '2026-06-01'
 */
export function nextAnalysisDraft(
  latest: InvestmentAnalysis | undefined,
  investmentId: string,
  today: string,
): InvestmentAnalysisDraft {
  if (latest === undefined) return emptyAnalysisDraft(investmentId, today);
  const texts = Object.fromEntries(
    Object.entries(latest.texts).filter(([key]) => key !== PREVIOUS_REVIEW_KEY),
  );
  return {
    investmentId: latest.investmentId,
    date: today,
    recommendation: latest.recommendation,
    texts,
    metrics: latest.metrics,
    peers: latest.peers,
    scenarios: latest.scenarios,
  };
}

/**
 * An analysis with nothing filled in yet.
 * @example emptyAnalysisDraft('totvs3', '2026-01-02').scenarios // []
 */
export function emptyAnalysisDraft(investmentId: string, today: string): InvestmentAnalysisDraft {
  return { investmentId, date: today, texts: {}, metrics: {}, peers: [], scenarios: [] };
}

/**
 * How far the target price is above (or below) today's price, in percent.
 * @example upsidePercent({ price: 20, targetPrice: 25 }) // 25
 */
export function upsidePercent(metrics: AnalysisMetrics): number | undefined {
  return gapPercent(metrics['targetPrice'], metrics['price'], metrics['price']);
}

/**
 * How much cheaper than its intrinsic value the share is, in percent of that value.
 * @example marginOfSafetyPercent({ price: 30, intrinsicValue: 40 }) // 25
 */
export function marginOfSafetyPercent(metrics: AnalysisMetrics): number | undefined {
  return gapPercent(metrics['intrinsicValue'], metrics['price'], metrics['intrinsicValue']);
}

/**
 * How much the scenario's value per share is above today's price, in percent.
 * @example scenarioReturnPercent({ valuation: 36 }, { price: 30 }) // 20
 */
export function scenarioReturnPercent(
  scenario: AnalysisMetrics,
  company: AnalysisMetrics,
): number | undefined {
  return gapPercent(scenario['valuation'], company['price'], company['price']);
}

/**
 * The value per share the three scenarios point to, weighed by their probabilities; undefined unless
 * some scenario has both a probability and a valuation.
 * @example weightedValuation([{ kind: 'base', texts: {}, metrics: { probability: 50, valuation: 40 } }]) // 40
 */
export function weightedValuation(scenarios: readonly AnalysisScenario[]): number | undefined {
  const weighed = scenarios.filter(
    (scenario) =>
      scenario.metrics['probability'] !== undefined && scenario.metrics['valuation'] !== undefined,
  );
  const totalWeight = weighed.reduce((sum, scenario) => sum + scenario.metrics['probability'], 0);
  if (totalWeight === 0) return undefined;
  const weightedSum = weighed.reduce(
    (sum, scenario) => sum + scenario.metrics['probability'] * scenario.metrics['valuation'],
    0,
  );
  return weightedSum / totalWeight;
}

function gapPercent(
  value: number | undefined,
  reference: number | undefined,
  base: number | undefined,
): number | undefined {
  if (value === undefined || reference === undefined || base === undefined || base === 0) {
    return undefined;
  }
  return ((value - reference) / base) * PERCENT;
}
