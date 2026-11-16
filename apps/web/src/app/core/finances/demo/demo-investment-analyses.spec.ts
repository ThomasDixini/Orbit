import { firstValueFrom } from 'rxjs';
import { InvestmentAnalysisDraft, emptyAnalysisDraft } from '../investment-analyses';
import { DemoInvestmentAnalysesGateway } from './demo-investment-analyses';

const DRAFT: InvestmentAnalysisDraft = {
  ...emptyAnalysisDraft('totvs3', '2026-06-01'),
  texts: { thesis: 'ERP leader' },
};

describe('DemoInvestmentAnalysesGateway', () => {
  it('starts empty', async () => {
    expect(await firstValueFrom(new DemoInvestmentAnalysesGateway().list())).toEqual([]);
  });

  it('keeps a saved analysis, newest day first, and replaces it on the next save', async () => {
    const gateway = new DemoInvestmentAnalysesGateway();

    await firstValueFrom(gateway.save('jan', { ...DRAFT, date: '2026-01-02' }));
    await firstValueFrom(gateway.save('jun', DRAFT));
    await firstValueFrom(gateway.save('jun', { ...DRAFT, texts: { thesis: 'Margins down' } }));

    const analyses = await firstValueFrom(gateway.list());
    expect(analyses.map((analysis) => [analysis.id, analysis.texts['thesis']])).toEqual([
      ['jun', 'Margins down'],
      ['jan', 'ERP leader'],
    ]);
  });

  it('deletes an analysis and ignores an unknown id', async () => {
    const gateway = new DemoInvestmentAnalysesGateway();
    await firstValueFrom(gateway.save('a1', DRAFT));

    await firstValueFrom(gateway.delete('a1'));
    await firstValueFrom(gateway.delete('missing'));

    expect(await firstValueFrom(gateway.list())).toEqual([]);
  });
});
