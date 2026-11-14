import { firstValueFrom } from 'rxjs';
import { DemoPeriodRatesGateway } from './demo-period-rates';

describe('DemoPeriodRatesGateway', () => {
  it('starts empty', async () => {
    expect(await firstValueFrom(new DemoPeriodRatesGateway().list())).toEqual([]);
  });

  it('keeps a saved rate, newest month first, and replaces the one of the same kind and month', async () => {
    const gateway = new DemoPeriodRatesGateway();

    await firstValueFrom(gateway.save('selic', '2026-09', { basisPoints: 1300 }));
    await firstValueFrom(gateway.save('selic', '2026-10', { basisPoints: 1300 }));
    await firstValueFrom(gateway.save('selic', '2026-10', { basisPoints: 1350 }));

    const rates = await firstValueFrom(gateway.list());
    expect(rates.map((rate) => [rate.month, rate.basisPoints])).toEqual([
      ['2026-10', 1350],
      ['2026-09', 1300],
    ]);
  });

  it('deletes only the kind and month given and ignores an unknown one', async () => {
    const gateway = new DemoPeriodRatesGateway();
    await firstValueFrom(gateway.save('selic', '2026-10', { basisPoints: 1300 }));
    await firstValueFrom(gateway.save('ipca', '2026-10', { basisPoints: 52 }));

    await firstValueFrom(gateway.delete('selic', '2026-10'));
    await firstValueFrom(gateway.delete('selic', '2026-01'));

    const rates = await firstValueFrom(gateway.list());
    expect(rates.map((rate) => rate.kind)).toEqual(['ipca']);
  });
});
