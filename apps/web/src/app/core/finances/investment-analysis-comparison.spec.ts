import { InvestmentAnalysis } from './investment-analyses';
import { compareAnalyses, previousAnalysis } from './investment-analysis-comparison';

function analysis(
  id: string,
  date: string,
  change: Partial<InvestmentAnalysis> = {},
): InvestmentAnalysis {
  return {
    id,
    investmentId: 'totvs3',
    date,
    texts: {},
    metrics: {},
    peers: [],
    scenarios: [],
    ...change,
  };
}

const JANUARY = analysis('jan', '2026-01-02', {
  texts: { thesis: 'ERP leader', inflation: 'IPCA at 5%' },
  metrics: { roe: 18, netDebtToEbitda: 0.4 },
  peers: [{ name: 'SAP', metrics: { priceToEarnings: 30 } }],
  scenarios: [{ kind: 'base', texts: {}, metrics: { probability: 55, valuation: 40 } }],
});
const JUNE = analysis('jun', '2026-06-01', {
  texts: { thesis: 'ERP leader', inflation: 'IPCA at 4%', marketRisks: 'New entrant' },
  metrics: { roe: 21, priceToEarnings: 25 },
  peers: [{ name: 'sap ', metrics: { priceToEarnings: 28 } }],
  scenarios: [{ kind: 'base', texts: {}, metrics: { probability: 60, valuation: 44 } }],
});

describe('analysis comparison', () => {
  const sections = compareAnalyses(JANUARY, JUNE);
  const section = (id: string) => sections.find((candidate) => candidate.id === id)!;

  it('compares a number filled in both with how much it moved', () => {
    const roe = section('profitability').metrics.find((row) => row.key === 'roe');

    expect(roe).toMatchObject({ before: 18, after: 21, change: 3, unit: 'percent' });
  });

  it('shows a number filled in only one analysis without a change', () => {
    const debt = section('debt').metrics.find((row) => row.key === 'netDebtToEbitda');

    expect(debt).toMatchObject({ before: 0.4, after: undefined });
    expect(debt?.change).toBeUndefined();
  });

  it('tells which texts were rewritten', () => {
    const macro = section('macro').texts;
    const summary = section('summary').texts;
    const risks = section('risks').texts;

    expect(macro).toEqual([
      expect.objectContaining({
        key: 'inflation',
        before: 'IPCA at 5%',
        after: 'IPCA at 4%',
        changed: true,
      }),
    ]);
    expect(summary).toEqual([expect.objectContaining({ key: 'thesis', changed: false })]);
    expect(risks).toEqual([
      expect.objectContaining({ key: 'marketRisks', before: '', changed: true }),
    ]);
  });

  it('leaves out the blocks filled in neither analysis', () => {
    expect(sections.map((candidate) => candidate.id)).toEqual([
      'summary',
      'risks',
      'profitability',
      'debt',
      'multiples',
      'macro',
      'peer-sap ',
      'scenario-base',
    ]);
  });

  it('matches peers by name ignoring case and spaces', () => {
    const peer = section('peer-sap ');

    expect(peer.metrics).toEqual([
      expect.objectContaining({ key: 'priceToEarnings', before: 30, after: 28, change: -2 }),
    ]);
  });

  it('compares the scenarios of the same kind', () => {
    const valuation = section('scenario-base').metrics.find((row) => row.key === 'valuation');

    expect(valuation).toMatchObject({ before: 40, after: 44, change: 4 });
  });

  it('finds the analysis just before one of the same investment', () => {
    const other = { ...analysis('petr', '2026-03-01'), investmentId: 'petr4' };

    expect(previousAnalysis(JUNE, [JANUARY, JUNE, other])?.id).toBe('jan');
    expect(previousAnalysis(JANUARY, [JANUARY, JUNE])).toBeUndefined();
  });
});
