import { Income, MonthlyPoint } from './investments';
import { appreciationMonths } from './monthly-appreciation';

function point(month: string, valueCents: number, appliedCents: number): MonthlyPoint {
  return { month, valueCents, appliedCents, returnPercent: 0, cdiPercent: 0 };
}

describe('appreciationMonths', () => {
  it('takes out what was put in, so only what the value changed on its own is appreciation', () => {
    const months = appreciationMonths(
      [point('2026-09', 100_000, 100_000), point('2026-10', 111_000, 105_000)],
      [],
    );

    expect(months[1]).toEqual({
      month: '2026-10',
      openingCents: 100_000,
      contributedCents: 5_000,
      appreciationCents: 6_000,
      percent: 5.71,
      incomeCents: 0,
      closingCents: 111_000,
    });
  });

  it('opens the first month at zero and has no percentage when nothing was invested', () => {
    const [first, second] = appreciationMonths(
      [point('2026-10', 0, 0), point('2026-11', 0, 0)],
      [],
    );

    expect([first.appreciationCents, first.percent, second.appreciationCents]).toEqual([
      0,
      undefined,
      0,
    ]);
  });

  it('keeps the months of a sold investment and shows a loss as negative', () => {
    const months = appreciationMonths(
      [point('2026-06', 9_000, 10_000), point('2026-07', 0, 0)],
      [],
    );

    expect(months.map((month) => [month.appreciationCents, month.contributedCents])).toEqual([
      [-1_000, 10_000],
      [1_000, -10_000],
    ]);
  });

  it('adds the proventos received in each month, apart from the appreciation', () => {
    const incomes: Income[] = [
      { id: 'a', investmentId: 'x', date: '2026-07-10', kind: 'yield', amountCents: 879 },
      { id: 'b', investmentId: 'x', date: '2026-07-20', kind: 'yield', amountCents: 21 },
    ];

    const [june, july] = appreciationMonths(
      [point('2026-07', 0, 0), point('2026-06', 9_000, 9_000)],
      incomes,
    );

    expect([june.month, june.incomeCents, july.incomeCents]).toEqual(['2026-06', 0, 900]);
  });
});
