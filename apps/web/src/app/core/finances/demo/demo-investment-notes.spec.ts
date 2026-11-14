import { firstValueFrom } from 'rxjs';
import { InvestmentNoteDraft } from '../investment-notes';
import { DemoInvestmentNotesGateway } from './demo-investment-notes';

const DRAFT: InvestmentNoteDraft = {
  investmentId: 'petr4',
  kind: 'event',
  date: '2026-11-03',
  text: 'Dividend cut',
};

describe('DemoInvestmentNotesGateway', () => {
  it('starts empty', async () => {
    expect(await firstValueFrom(new DemoInvestmentNotesGateway().list())).toEqual([]);
  });

  it('keeps a saved note, newest day first, and replaces it on the next save', async () => {
    const gateway = new DemoInvestmentNotesGateway();

    await firstValueFrom(gateway.save('old', { ...DRAFT, date: '2026-10-01' }));
    await firstValueFrom(gateway.save('new', DRAFT));
    await firstValueFrom(gateway.save('new', { ...DRAFT, text: 'Dividend restored' }));

    const notes = await firstValueFrom(gateway.list());
    expect(notes.map((note) => [note.id, note.text])).toEqual([
      ['new', 'Dividend restored'],
      ['old', 'Dividend cut'],
    ]);
  });

  it('deletes a note and ignores an unknown id', async () => {
    const gateway = new DemoInvestmentNotesGateway();
    await firstValueFrom(gateway.save('n1', DRAFT));

    await firstValueFrom(gateway.delete('n1'));
    await firstValueFrom(gateway.delete('missing'));

    expect(await firstValueFrom(gateway.list())).toEqual([]);
  });
});
