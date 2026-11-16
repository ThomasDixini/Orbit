import { InvestmentAnalysisDraft, emptyAnalysisDraft } from './investment-analyses';
import {
  AnalysisForm,
  readAnalysisForm,
  toAnalysisForm,
  withPeerAdded,
} from './investment-analysis-form';

function form(change: Partial<AnalysisForm> = {}): AnalysisForm {
  return { ...toAnalysisForm(emptyAnalysisDraft('totvs3', '2026-01-02'), 'pt-BR'), ...change };
}

function validDraft(typed: AnalysisForm): InvestmentAnalysisDraft {
  const reading = readAnalysisForm(typed, 'totvs3');
  if (reading.kind !== 'valid')
    throw new Error(`Expected a valid form, got ${[...reading.fields]}`);
  return reading.draft;
}

function invalidFields(typed: AnalysisForm): readonly string[] {
  const reading = readAnalysisForm(typed, 'totvs3');
  return reading.kind === 'invalid' ? [...reading.fields] : [];
}

describe('analysis form', () => {
  it('writes the numbers of a draft the way the reader types them', () => {
    const draft: InvestmentAnalysisDraft = {
      ...emptyAnalysisDraft('totvs3', '2026-01-02'),
      metrics: { roe: 18.5 },
      peers: [{ name: 'SAP', metrics: { priceToEarnings: 32.1 } }],
      scenarios: [
        { kind: 'pessimistic', texts: { triggers: 'Recession' }, metrics: { probability: 20 } },
      ],
    };

    const typed = toAnalysisForm(draft, 'pt-BR');

    expect(typed.company.metrics).toEqual({ roe: '18,5' });
    expect(typed.peers[0].metrics).toEqual({ priceToEarnings: '32,1' });
    expect(typed.scenarios.pessimistic.texts).toEqual({ triggers: 'Recession' });
    expect(typed.scenarios.base).toEqual({ texts: {}, metrics: {} });
  });

  it('reads typed numbers and leaves out blank texts and numbers', () => {
    const draft = validDraft(
      form({
        recommendation: 'buy',
        company: { texts: { thesis: 'ERP leader', moat: '  ' }, metrics: { roe: '18,5', roa: '' } },
      }),
    );

    expect(draft).toEqual({
      investmentId: 'totvs3',
      date: '2026-01-02',
      recommendation: 'buy',
      texts: { thesis: 'ERP leader' },
      metrics: { roe: 18.5 },
      peers: [],
      scenarios: [],
    });
  });

  it('leaves the recommendation out when none was chosen', () => {
    expect('recommendation' in validDraft(form())).toBe(false);
  });

  it('marks every number it cannot read', () => {
    const typed = form({
      company: { texts: {}, metrics: { roe: 'abc' } },
      peers: [{ name: 'SAP', metrics: { roic: '1,2,3' } }],
    });

    expect(invalidFields(typed)).toEqual(['company.roe', 'peer.0.roic']);
  });

  it('keeps only the scenarios that have something and refuses a probability over 100', () => {
    const typed = form({
      scenarios: {
        base: { texts: { triggers: 'Stable macro' }, metrics: {} },
        optimistic: { texts: {}, metrics: { probability: '120' } },
        pessimistic: { texts: {}, metrics: {} },
      },
    });

    expect(invalidFields(typed)).toEqual(['scenario.optimistic.probability']);
    const fixed = validDraft({
      ...typed,
      scenarios: { ...typed.scenarios, optimistic: { texts: {}, metrics: {} } },
    });
    expect(fixed.scenarios).toEqual([
      { kind: 'base', texts: { triggers: 'Stable macro' }, metrics: {} },
    ]);
  });

  it('drops an empty unnamed peer but asks for the name of one with numbers', () => {
    const empty = form({ peers: [{ name: '  ', metrics: { roe: '' } }] });
    const unnamed = form({ peers: [{ name: '', metrics: { roe: '15' } }] });

    expect(validDraft(empty).peers).toEqual([]);
    expect(invalidFields(unnamed)).toEqual(['peer.0.name']);
  });

  it('trims peer names', () => {
    const draft = validDraft(form({ peers: [{ name: ' SAP ', metrics: { roe: '20' } }] }));

    expect(draft.peers).toEqual([{ name: 'SAP', metrics: { roe: 20 } }]);
  });

  it('adds peers up to five', () => {
    let typed = form();
    for (let added = 0; added < 7; added += 1) typed = withPeerAdded(typed);

    expect(typed.peers).toHaveLength(5);
  });

  it('is invalid without a date', () => {
    expect(readAnalysisForm(form({ date: '' }), 'totvs3').kind).toBe('invalid');
  });
});
