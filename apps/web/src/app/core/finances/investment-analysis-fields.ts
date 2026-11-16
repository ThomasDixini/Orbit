/**
 * The fields of a fundamental analysis, grouped as the stock template groups them. The keys are the API's
 * (see `AnalysisFields.cs`); a key missing there is refused when saved.
 */

/** How a number reads: a percentage, a multiple, reais per share, days, or millions of reais. */
export type MetricUnit = 'percent' | 'multiple' | 'money' | 'days' | 'millions';

export interface AnalysisField {
  readonly key: string;
  readonly label: string;
}

export interface MetricField extends AnalysisField {
  readonly unit: MetricUnit;
}

/** One block of the form, of the read-only view and of the comparison. */
export interface AnalysisSection {
  readonly id: string;
  readonly title: string;
  readonly texts: readonly AnalysisField[];
  readonly metrics: readonly MetricField[];
}

/** Field names and their labels, written as a map (like the translations) to keep the catalog short. */
type Labels = Readonly<Record<string, string>>;

function fields(labels: Labels): readonly AnalysisField[] {
  return Object.entries(labels).map(([key, label]) => ({ key, label }));
}

function numbers(unit: MetricUnit, labels: Labels): readonly MetricField[] {
  return fields(labels).map((field) => ({ ...field, unit }));
}

function section(
  id: string,
  title: string,
  texts: Labels,
  metrics: readonly MetricField[] = [],
): AnalysisSection {
  return { id, title, texts: fields(texts), metrics };
}

const NO_TEXTS: Labels = {};

/** The company part: everything but the peers and the scenarios, in the order the form shows it. */
export const COMPANY_SECTIONS: readonly AnalysisSection[] = [
  section(
    'summary',
    'Summary',
    {
      thesis: 'Thesis summary',
      sector: 'Sector',
      segment: 'Segment',
      country: 'Country',
      businessDescription: 'Business description',
    },
    numbers('money', { price: 'Current price', targetPrice: 'Target price' }),
  ),
  section('business', 'Business model', {
    revenueSources: 'Revenue sources',
    moat: 'Competitive advantages (moat)',
    marketPosition: 'Market positioning',
    whyItCaughtAttention: 'Why this company caught my attention',
    predictability: 'Is the business predictable?',
  }),
  section('management', 'Management', {
    managementQuality: 'Quality of management',
    executiveHistory: 'Track record of the executives',
    shareholderAlignment: 'Alignment with shareholders',
    sectorLeader: 'Sector leader?',
  }),
  section('market', 'Market and competition', {
    marketSize: 'Market size and growth',
    competitors: 'Main competitors',
    marketShare: 'Market share',
    entryBarriers: 'Barriers to entry',
  }),
  section('risks', 'Risks', {
    operationalRisks: 'Operational risks',
    regulatoryRisks: 'Regulatory risks',
    marketRisks: 'Market risks',
    financialRisks: 'Financial risks',
    companyRisks: 'Company-specific risks',
  }),
  section('outlook', 'Outlook and catalysts', {
    growthExpectations: 'Growth expectations',
    newProducts: 'New products and expansions',
    sectorTrends: 'Sector trends',
    corporateEvents: 'Relevant corporate events',
  }),
  section(
    'profitability',
    'Profitability',
    NO_TEXTS,
    numbers('percent', {
      roe: 'ROE',
      roa: 'ROA',
      roic: 'ROIC',
      grossMargin: 'Gross margin',
      ebitdaMargin: 'EBITDA margin',
      netMargin: 'Net margin',
    }),
  ),
  section('efficiency', 'Efficiency', NO_TEXTS, [
    ...numbers('multiple', {
      assetTurnover: 'Asset turnover',
      inventoryTurnover: 'Inventory turnover',
    }),
    ...numbers('days', {
      receivableDays: 'Days sales outstanding',
      payableDays: 'Days payable outstanding',
    }),
  ]),
  section(
    'debt',
    'Debt',
    NO_TEXTS,
    numbers('multiple', {
      netDebtToEbitda: 'Net debt / EBITDA',
      netDebtToEquity: 'Net debt / equity',
      currentRatio: 'Current ratio',
      interestCoverage: 'Interest coverage',
    }),
  ),
  section(
    'growth',
    'Growth',
    NO_TEXTS,
    numbers('percent', {
      revenueCagr: 'Revenue CAGR 5y',
      earningsCagr: 'Earnings CAGR 5y',
      ebitdaGrowth: 'EBITDA growth',
    }),
  ),
  section('multiples', 'Multiples', NO_TEXTS, [
    ...numbers('multiple', {
      priceToEarnings: 'P/E',
      priceToBook: 'P/B',
      evToEbitda: 'EV/EBITDA',
      priceToSales: 'P/S',
    }),
    ...numbers('percent', { dividendYield: 'Dividend yield' }),
    ...numbers('money', { earningsPerShare: 'Earnings per share' }),
  ]),
  section(
    'cashFlow',
    'Cash flow',
    NO_TEXTS,
    numbers('millions', {
      operatingCashFlow: 'Operating cash flow',
      freeCashFlow: 'Free cash flow',
      capex: 'CAPEX',
    }),
  ),
  section('valuation', 'Valuation (DCF)', NO_TEXTS, [
    ...numbers('percent', { wacc: 'WACC', perpetualGrowth: 'Perpetual growth (g)' }),
    ...numbers('money', { estimatedEps: 'Estimated EPS', intrinsicValue: 'Intrinsic value' }),
  ]),
  section('macro', 'Macroeconomic context', {
    interestRates: 'Interest rates (Selic / Fed)',
    exchangeRate: 'Exchange rate',
    inflation: 'Inflation',
    economicGrowth: 'GDP and economic growth',
    unemployment: 'Unemployment',
    cycleExposure: 'Exposure to economic cycles',
    monetaryPolicy: 'Impact of monetary policy',
    fiscalPolicy: 'Impact of fiscal policy',
    internationalExposure: 'International exposure',
    macroRisks: 'Macro risks (description, probability, impact)',
    riskMitigation: 'How the company mitigates them',
    diversification: 'Diversification of revenue, clients and suppliers',
    hedges: 'Hedges and financial protections',
  }),
  section('sector', 'Sector', {
    sectorOverview: 'Current situation and main trends',
    sectorGrowth: 'Historical growth',
    sectorDrivers: 'Growth drivers',
    sectorChallenges: 'Sector challenges',
    sectorRegulation: 'Regulation',
    sectorInnovation: 'Innovations and disruptions',
    peerAdvantages: 'Advantages over competitors',
    peerDisadvantages: 'Disadvantages against competitors',
  }),
  section('review', 'Since the previous analysis', {
    previousReview: 'What came true of the previous risks and catalysts',
  }),
];

/** Peer numbers kept by the company under another name. */
const COMPANY_KEY_OF_PEER: Labels = { revenueGrowth: 'revenueCagr' };

/** What a peer is compared on; `companyKey` is the company's own number shown beside it. */
export const PEER_METRICS: readonly (MetricField & { readonly companyKey: string })[] = [
  ...numbers('multiple', { priceToEarnings: 'P/E', priceToBook: 'P/B', evToEbitda: 'EV/EBITDA' }),
  ...numbers('percent', {
    dividendYield: 'Dividend yield',
    roe: 'ROE',
    roic: 'ROIC',
    ebitdaMargin: 'EBITDA margin',
    netMargin: 'Net margin',
  }),
  ...numbers('multiple', { netDebtToEbitda: 'Net debt / EBITDA' }),
  ...numbers('percent', { revenueGrowth: 'Revenue growth' }),
].map((field) => ({ ...field, companyKey: COMPANY_KEY_OF_PEER[field.key] ?? field.key }));

/** The part every scenario has. */
export const SCENARIO_SECTION: AnalysisSection = section(
  'scenario',
  'Scenario',
  {
    thesis: 'Thesis for this scenario',
    growthAssumptions: 'Growth premises',
    marginAssumptions: 'Margin premises',
    risks: 'Risks of this scenario',
    triggers: 'Triggers',
    notes: 'Additional notes',
  },
  [
    ...numbers('percent', {
      probability: 'Probability',
      revenueGrowth: 'Revenue growth (per year)',
      ebitdaMargin: 'EBITDA margin',
      capexShare: 'CAPEX (% of revenue)',
      netMargin: 'Net margin',
      wacc: 'WACC',
      perpetualGrowth: 'Perpetual growth (g)',
    }),
    ...numbers('money', { valuation: 'Value per share' }),
  ],
);

/** The previous analysis' texts a new one is reviewed against. */
export const REVIEWED_TEXT_KEYS: readonly string[] = [
  'operationalRisks',
  'regulatoryRisks',
  'marketRisks',
  'financialRisks',
  'companyRisks',
  'growthExpectations',
  'newProducts',
  'corporateEvents',
];

/**
 * The label of a company text field.
 * @example companyTextLabel('moat') // 'Competitive advantages (moat)'
 */
export function companyTextLabel(key: string): string {
  return (
    COMPANY_SECTIONS.flatMap((section) => section.texts).find((field) => field.key === key)
      ?.label ?? key
  );
}
