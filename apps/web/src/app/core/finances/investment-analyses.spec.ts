import {
  InvestmentAnalysis,
  analysesOf,
  emptyAnalysisDraft,
  marginOfSafetyPercent,
  nextAnalysisDraft,
  recommendationLabel,
  scenarioReturnPercent,
  sortedAnalyses,
  upsidePercent,
  weightedValuation,
} from './investment-analyses';

function analysis(id: string, date: string, investmentId = 'totvs3'): InvestmentAnalysis {
  return { id, investmentId, date, texts: {}, metrics: {}, peers: [], scenarios: [] };
}

describe('investment analyses', () => {
  it('sorts analyses newest day first', () => {
    const sorted = sortedAnalyses([analysis('jan', '2026-01-02'), analysis('jun', '2026-06-01')]);

    expect(sorted.map((item) => item.id)).toEqual(['jun', 'jan']);
  });

  it('keeps only the analyses of one investment', () => {
    const all = [analysis('a', '2026-01-02'), analysis('b', '2026-02-02', 'petr4')];

    expect(analysesOf(all, 'totvs3').map((item) => item.id)).toEqual(['a']);
  });

  it('starts a new analysis blank when there is none before it', () => {
    expect(nextAnalysisDraft(undefined, 'totvs3', '2026-06-01')).toEqual(
      emptyAnalysisDraft('totvs3', '2026-06-01'),
    );
  });

  it('starts a new analysis as a copy of the latest, dated today and with a blank review', () => {
    const latest: InvestmentAnalysis = {
      ...analysis('jan', '2026-01-02'),
      recommendation: 'buy',
      texts: { thesis: 'ERP leader', previousReview: 'Old review' },
      metrics: { roe: 18 },
      scenarios: [{ kind: 'base', texts: {}, metrics: { probability: 55 } }],
    };

    const draft = nextAnalysisDraft(latest, 'totvs3', '2026-06-01');

    expect(draft).toEqual({
      investmentId: 'totvs3',
      date: '2026-06-01',
      recommendation: 'buy',
      texts: { thesis: 'ERP leader' },
      metrics: { roe: 18 },
      peers: [],
      scenarios: [{ kind: 'base', texts: {}, metrics: { probability: 55 } }],
    });
    expect('id' in draft).toBe(false);
  });

  it('works out the upside to the target price', () => {
    expect(upsidePercent({ price: 20, targetPrice: 25 })).toBe(25);
    expect(upsidePercent({ price: 20 })).toBeUndefined();
    expect(upsidePercent({ price: 0, targetPrice: 25 })).toBeUndefined();
  });

  it('works out the margin of safety over the intrinsic value', () => {
    expect(marginOfSafetyPercent({ price: 30, intrinsicValue: 40 })).toBe(25);
    expect(marginOfSafetyPercent({ price: 50, intrinsicValue: 40 })).toBe(-25);
  });

  it("works out a scenario's return from the company's price", () => {
    expect(scenarioReturnPercent({ valuation: 36 }, { price: 30 })).toBeCloseTo(20);
    expect(scenarioReturnPercent({ valuation: 36 }, {})).toBeUndefined();
  });

  it('weighs the valuations by the probabilities of the scenarios that have both', () => {
    const weighted = weightedValuation([
      { kind: 'base', texts: {}, metrics: { probability: 60, valuation: 40 } },
      { kind: 'optimistic', texts: {}, metrics: { probability: 20, valuation: 60 } },
      { kind: 'pessimistic', texts: {}, metrics: { probability: 20, valuation: 20 } },
      { kind: 'base', texts: {}, metrics: { valuation: 1000 } },
    ]);

    expect(weighted).toBe(40);
    expect(weightedValuation([])).toBeUndefined();
  });

  it('names the recommendation', () => {
    expect(recommendationLabel('hold')).toBe('Hold rating');
  });
});
