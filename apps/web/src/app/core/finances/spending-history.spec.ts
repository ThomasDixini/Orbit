import { descriptionHistory, median, patternOf, spendingHistory } from './spending-history';
import { Transaction } from './transaction';

const NAMES = new Map([
  ['food', 'Food'],
  ['housing', 'Housing'],
  ['gifts', 'Gifts'],
]);

function expense(
  id: string,
  date: string,
  cents: number,
  categoryId = 'food',
  description = id,
): Transaction {
  return { id, date, description, categoryId, accountId: 'checking-account', amountCents: -cents };
}

function steadyMonths(): Transaction[][] {
  return [
    [
      expense('rent-jul', '2026-07-05', 100000, 'housing', 'Rent'),
      expense('f-jul', '2026-07-09', 30000),
    ],
    [
      expense('rent-aug', '2026-08-05', 100000, 'housing', 'Rent'),
      expense('f-aug', '2026-08-09', 31000),
    ],
    [
      expense('rent-sep', '2026-09-05', 100000, 'housing', 'Rent'),
      expense('f-sep', '2026-09-09', 29000),
    ],
    [
      expense('rent-oct', '2026-10-05', 100000, 'housing', 'Rent'),
      expense('f-oct', '2026-10-09', 30000),
    ],
  ];
}

const MONTHS = ['2026-07', '2026-08', '2026-09', '2026-10'];

describe('spendingHistory', () => {
  it('adds up the expenses of each category in each month, biggest category first', () => {
    const history = spendingHistory(MONTHS, steadyMonths(), NAMES, '2026-11');

    expect(history.categories.map((category) => [category.name, category.totalCents])).toEqual([
      ['Housing', 400000],
      ['Food', 120000],
    ]);
    expect(history.monthTotals).toEqual([130000, 131000, 129000, 130000]);
  });

  it('ignores income, even in a category that also has expenses', () => {
    const refund: Transaction = { ...expense('refund', '2026-10-12', 5000), amountCents: 5000 };
    const months = steadyMonths();
    months[3].push(refund);

    const food = spendingHistory(MONTHS, months, NAMES, '2026-11').categories.find(
      (category) => category.categoryId === 'food',
    );

    expect(food?.months[3].cents).toBe(30000);
  });

  it('calls a category that comes every month for the same amount fixed', () => {
    const history = spendingHistory(MONTHS, steadyMonths(), NAMES, '2026-11');

    expect(history.categories.find((c) => c.categoryId === 'housing')?.pattern).toBe('fixed');
    expect(history.categories.find((c) => c.categoryId === 'housing')?.averageCents).toBe(100000);
  });

  it('keeps the month still running out of the averages and the patterns', () => {
    const months = steadyMonths();
    months.push([expense('f-nov', '2026-11-02', 90000)]);

    const history = spendingHistory([...MONTHS, '2026-11'], months, NAMES, '2026-11');

    const food = history.categories.find((category) => category.categoryId === 'food');
    expect(food?.averageCents).toBe(30000);
    expect(food?.months[4].cents).toBe(90000);
    expect(food?.months[4].isUnusual).toBe(true);
  });

  it('flags a month far above what the category usually takes, and only that one', () => {
    const months = steadyMonths();
    months[2].push(expense('feast', '2026-09-20', 60000));

    const food = spendingHistory(MONTHS, months, NAMES, '2026-11').categories.find(
      (category) => category.categoryId === 'food',
    );

    expect(food?.months.map((month) => month.isUnusual)).toEqual([false, false, true, false]);
  });

  it('never flags a small amount, however much it grew', () => {
    const months = [
      [expense('a', '2026-07-01', 100)],
      [expense('b', '2026-08-01', 100)],
      [expense('c', '2026-09-01', 100)],
      [expense('d', '2026-10-01', 900)],
    ];

    const food = spendingHistory(MONTHS, months, NAMES, '2026-11').categories[0];

    expect(food.months.some((month) => month.isUnusual)).toBe(false);
  });

  it('does not count months with nothing spent at all against a category', () => {
    const months = [
      [],
      [],
      [expense('a', '2026-09-01', 5000), expense('x', '2026-09-02', 100, 'gifts')],
      [expense('b', '2026-10-01', 5000), expense('y', '2026-10-02', 100, 'gifts')],
    ];

    const history = spendingHistory(MONTHS, months, NAMES, '2026-11');

    expect(history.categories.find((c) => c.categoryId === 'food')?.averageCents).toBe(5000);
  });

  it('says a category has an unknown pattern while there is too little history', () => {
    const history = spendingHistory(
      ['2026-09', '2026-10'],
      [[expense('a', '2026-09-01', 5000)], [expense('b', '2026-10-01', 5000)]],
      NAMES,
      '2026-11',
    );

    expect(history.categories[0].pattern).toBe('unknown');
  });

  it('names a category the references no longer know', () => {
    const history = spendingHistory(
      ['2026-10'],
      [[expense('a', '2026-10-01', 5000, 'gone')]],
      NAMES,
      '2026-11',
    );

    expect(history.categories[0].name).toBe('Unknown category');
  });
});

describe('patternOf', () => {
  it('is fixed when it comes nearly every month with little spread', () => {
    expect(patternOf([10000, 10500, 9800, 10100], 4)).toBe('fixed');
  });

  it('is variable when it comes nearly every month but the amount moves a lot', () => {
    expect(patternOf([5000, 30000, 12000, 50000], 4)).toBe('variable');
  });

  it('is occasional when it comes in about half of the months', () => {
    expect(patternOf([8000, 9000], 4)).toBe('occasional');
  });

  it('is rare when it comes in very few months', () => {
    expect(patternOf([8000], 6)).toBe('rare');
  });

  it('is unknown with fewer than three closed months', () => {
    expect(patternOf([8000, 8000], 2)).toBe('unknown');
  });
});

describe('median', () => {
  it('takes the middle value, and the average of the two middle ones', () => {
    expect([median([100, 300, 200]), median([100, 200, 300, 400]), median([])]).toEqual([
      200, 250, 0,
    ]);
  });
});

describe('descriptionHistory', () => {
  it('groups installments of one purchase, biggest first, per month', () => {
    const months = ['2026-09', '2026-10'];
    const lines = descriptionHistory('food', months, [
      [
        expense('a', '2026-09-01', 1000, 'food', 'Shop - Parcela 1 de 3'),
        expense('b', '2026-09-02', 500, 'food', 'Bakery'),
      ],
      [
        expense('c', '2026-10-01', 1000, 'food', 'Shop - Parcela 2 de 3'),
        expense('d', '2026-10-03', 900, 'housing', 'Rent'),
      ],
    ]);

    expect(lines).toEqual([
      { description: 'Shop', cents: [1000, 1000], totalCents: 2000, count: 2 },
      { description: 'Bakery', cents: [500, 0], totalCents: 500, count: 1 },
    ]);
  });
});
