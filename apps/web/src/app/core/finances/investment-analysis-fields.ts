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

function text(key: string, label: string): AnalysisField {
  return { key, label };
}

function metric(key: string, label: string, unit: MetricUnit): MetricField {
  return { key, label, unit };
}

/** The company part: everything but the peers and the scenarios, in the order the form shows it. */
export const COMPANY_SECTIONS: readonly AnalysisSection[] = [
  {
    id: 'summary',
    title: 'Summary',
    texts: [
      text('thesis', 'Thesis summary'),
      text('sector', 'Sector'),
      text('segment', 'Segment'),
      text('country', 'Country'),
      text('businessDescription', 'Business description'),
    ],
    metrics: [
      metric('price', 'Current price', 'money'),
      metric('targetPrice', 'Target price', 'money'),
    ],
  },
  {
    id: 'business',
    title: 'Business model',
    texts: [
      text('revenueSources', 'Revenue sources'),
      text('moat', 'Competitive advantages (moat)'),
      text('marketPosition', 'Market positioning'),
      text('whyItCaughtAttention', 'Why this company caught my attention'),
      text('predictability', 'Is the business predictable?'),
    ],
    metrics: [],
  },
  {
    id: 'management',
    title: 'Management',
    texts: [
      text('managementQuality', 'Quality of management'),
      text('executiveHistory', 'Track record of the executives'),
      text('shareholderAlignment', 'Alignment with shareholders'),
      text('sectorLeader', 'Sector leader?'),
    ],
    metrics: [],
  },
  {
    id: 'market',
    title: 'Market and competition',
    texts: [
      text('marketSize', 'Market size and growth'),
      text('competitors', 'Main competitors'),
      text('marketShare', 'Market share'),
      text('entryBarriers', 'Barriers to entry'),
    ],
    metrics: [],
  },
  {
    id: 'risks',
    title: 'Risks',
    texts: [
      text('operationalRisks', 'Operational risks'),
      text('regulatoryRisks', 'Regulatory risks'),
      text('marketRisks', 'Market risks'),
      text('financialRisks', 'Financial risks'),
      text('companyRisks', 'Company-specific risks'),
    ],
    metrics: [],
  },
  {
    id: 'outlook',
    title: 'Outlook and catalysts',
    texts: [
      text('growthExpectations', 'Growth expectations'),
      text('newProducts', 'New products and expansions'),
      text('sectorTrends', 'Sector trends'),
      text('corporateEvents', 'Relevant corporate events'),
    ],
    metrics: [],
  },
  {
    id: 'profitability',
    title: 'Profitability',
    texts: [],
    metrics: [
      metric('roe', 'ROE', 'percent'),
      metric('roa', 'ROA', 'percent'),
      metric('roic', 'ROIC', 'percent'),
      metric('grossMargin', 'Gross margin', 'percent'),
      metric('ebitdaMargin', 'EBITDA margin', 'percent'),
      metric('netMargin', 'Net margin', 'percent'),
    ],
  },
  {
    id: 'efficiency',
    title: 'Efficiency',
    texts: [],
    metrics: [
      metric('assetTurnover', 'Asset turnover', 'multiple'),
      metric('receivableDays', 'Days sales outstanding', 'days'),
      metric('payableDays', 'Days payable outstanding', 'days'),
      metric('inventoryTurnover', 'Inventory turnover', 'multiple'),
    ],
  },
  {
    id: 'debt',
    title: 'Debt',
    texts: [],
    metrics: [
      metric('netDebtToEbitda', 'Net debt / EBITDA', 'multiple'),
      metric('netDebtToEquity', 'Net debt / equity', 'multiple'),
      metric('currentRatio', 'Current ratio', 'multiple'),
      metric('interestCoverage', 'Interest coverage', 'multiple'),
    ],
  },
  {
    id: 'growth',
    title: 'Growth',
    texts: [],
    metrics: [
      metric('revenueCagr', 'Revenue CAGR 5y', 'percent'),
      metric('earningsCagr', 'Earnings CAGR 5y', 'percent'),
      metric('ebitdaGrowth', 'EBITDA growth', 'percent'),
    ],
  },
  {
    id: 'multiples',
    title: 'Multiples',
    texts: [],
    metrics: [
      metric('priceToEarnings', 'P/E', 'multiple'),
      metric('priceToBook', 'P/B', 'multiple'),
      metric('evToEbitda', 'EV/EBITDA', 'multiple'),
      metric('priceToSales', 'P/S', 'multiple'),
      metric('dividendYield', 'Dividend yield', 'percent'),
      metric('earningsPerShare', 'Earnings per share', 'money'),
    ],
  },
  {
    id: 'cashFlow',
    title: 'Cash flow',
    texts: [],
    metrics: [
      metric('operatingCashFlow', 'Operating cash flow', 'millions'),
      metric('freeCashFlow', 'Free cash flow', 'millions'),
      metric('capex', 'CAPEX', 'millions'),
    ],
  },
  {
    id: 'valuation',
    title: 'Valuation (DCF)',
    texts: [],
    metrics: [
      metric('wacc', 'WACC', 'percent'),
      metric('perpetualGrowth', 'Perpetual growth (g)', 'percent'),
      metric('estimatedEps', 'Estimated EPS', 'money'),
      metric('intrinsicValue', 'Intrinsic value', 'money'),
    ],
  },
  {
    id: 'macro',
    title: 'Macroeconomic context',
    texts: [
      text('interestRates', 'Interest rates (Selic / Fed)'),
      text('exchangeRate', 'Exchange rate'),
      text('inflation', 'Inflation'),
      text('economicGrowth', 'GDP and economic growth'),
      text('unemployment', 'Unemployment'),
      text('cycleExposure', 'Exposure to economic cycles'),
      text('monetaryPolicy', 'Impact of monetary policy'),
      text('fiscalPolicy', 'Impact of fiscal policy'),
      text('internationalExposure', 'International exposure'),
      text('macroRisks', 'Macro risks (description, probability, impact)'),
      text('riskMitigation', 'How the company mitigates them'),
      text('diversification', 'Diversification of revenue, clients and suppliers'),
      text('hedges', 'Hedges and financial protections'),
    ],
    metrics: [],
  },
  {
    id: 'sector',
    title: 'Sector',
    texts: [
      text('sectorOverview', 'Current situation and main trends'),
      text('sectorGrowth', 'Historical growth'),
      text('sectorDrivers', 'Growth drivers'),
      text('sectorChallenges', 'Sector challenges'),
      text('sectorRegulation', 'Regulation'),
      text('sectorInnovation', 'Innovations and disruptions'),
      text('peerAdvantages', 'Advantages over competitors'),
      text('peerDisadvantages', 'Disadvantages against competitors'),
    ],
    metrics: [],
  },
  {
    id: 'review',
    title: 'Since the previous analysis',
    texts: [text('previousReview', 'What came true of the previous risks and catalysts')],
    metrics: [],
  },
];

/** What a peer is compared on; `companyKey` is the company's own number shown beside it. */
export const PEER_METRICS: readonly (MetricField & { readonly companyKey: string })[] = [
  { ...metric('priceToEarnings', 'P/E', 'multiple'), companyKey: 'priceToEarnings' },
  { ...metric('priceToBook', 'P/B', 'multiple'), companyKey: 'priceToBook' },
  { ...metric('evToEbitda', 'EV/EBITDA', 'multiple'), companyKey: 'evToEbitda' },
  { ...metric('dividendYield', 'Dividend yield', 'percent'), companyKey: 'dividendYield' },
  { ...metric('roe', 'ROE', 'percent'), companyKey: 'roe' },
  { ...metric('roic', 'ROIC', 'percent'), companyKey: 'roic' },
  { ...metric('ebitdaMargin', 'EBITDA margin', 'percent'), companyKey: 'ebitdaMargin' },
  { ...metric('netMargin', 'Net margin', 'percent'), companyKey: 'netMargin' },
  { ...metric('netDebtToEbitda', 'Net debt / EBITDA', 'multiple'), companyKey: 'netDebtToEbitda' },
  { ...metric('revenueGrowth', 'Revenue growth', 'percent'), companyKey: 'revenueCagr' },
];

/** The part every scenario has. */
export const SCENARIO_SECTION: AnalysisSection = {
  id: 'scenario',
  title: 'Scenario',
  texts: [
    text('thesis', 'Thesis for this scenario'),
    text('growthAssumptions', 'Growth premises'),
    text('marginAssumptions', 'Margin premises'),
    text('risks', 'Risks of this scenario'),
    text('triggers', 'Triggers'),
    text('notes', 'Additional notes'),
  ],
  metrics: [
    metric('probability', 'Probability', 'percent'),
    metric('revenueGrowth', 'Revenue growth (per year)', 'percent'),
    metric('ebitdaMargin', 'EBITDA margin', 'percent'),
    metric('capexShare', 'CAPEX (% of revenue)', 'percent'),
    metric('netMargin', 'Net margin', 'percent'),
    metric('wacc', 'WACC', 'percent'),
    metric('perpetualGrowth', 'Perpetual growth (g)', 'percent'),
    metric('valuation', 'Value per share', 'money'),
  ],
};

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
