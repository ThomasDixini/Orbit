import { CHART_WIDTH, labelStep, tooltipBox } from './chart-tooltip';

describe('tooltipBox', () => {
  it('sits above the point and is centered on it', () => {
    const box = tooltipBox(200, 100, ['Jul 2025', 'R$ 955,34'], 190);

    expect([box.y < 100, Math.round(box.x + box.width / 2)]).toEqual([true, 200]);
  });

  it('stays inside the chart at the edges', () => {
    const left = tooltipBox(0, 100, ['Jul 2025', 'R$ 955,34'], 190);
    const right = tooltipBox(CHART_WIDTH, 100, ['Jul 2025', 'R$ 955,34'], 190);

    expect([left.x >= 0, right.x + right.width <= CHART_WIDTH]).toEqual([true, true]);
  });

  it('goes below the point when there is no room above', () => {
    const box = tooltipBox(200, 5, ['Jul 2025', 'R$ 955,34'], 190);

    expect(box.y).toBeGreaterThan(5);
  });
});

describe('labelStep', () => {
  it('shows every label while they fit', () => {
    expect(labelStep(['jun.', 'jul.', 'ago.'], 364, 3)).toBe(1);
  });

  it('skips labels when there are many long ones', () => {
    const labels = Array.from({ length: 24 }, () => 'jan. de 25');

    expect(labelStep(labels, 364, 24)).toBeGreaterThan(2);
  });
});
