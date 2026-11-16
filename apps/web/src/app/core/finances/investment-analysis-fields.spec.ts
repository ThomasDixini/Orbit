import {
  COMPANY_SECTIONS,
  PEER_METRICS,
  SCENARIO_SECTION,
  companyTextLabel,
} from './investment-analysis-fields';

describe('analysis fields', () => {
  it('names every company field once', () => {
    const keys = COMPANY_SECTIONS.flatMap((section) => [
      ...section.texts.map((field) => `text:${field.key}`),
      ...section.metrics.map((field) => `metric:${field.key}`),
    ]);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(81);
  });

  it('gives each number of a section its unit', () => {
    const multiples = COMPANY_SECTIONS.find((section) => section.id === 'multiples')!;

    expect(multiples.metrics.map((field) => [field.key, field.unit])).toEqual([
      ['priceToEarnings', 'multiple'],
      ['priceToBook', 'multiple'],
      ['evToEbitda', 'multiple'],
      ['priceToSales', 'multiple'],
      ['dividendYield', 'percent'],
      ['earningsPerShare', 'money'],
    ]);
  });

  it("shows a peer's revenue growth beside the company's revenue CAGR", () => {
    const companyKeys = Object.fromEntries(
      PEER_METRICS.map((field) => [field.key, field.companyKey]),
    );

    expect(companyKeys['revenueGrowth']).toBe('revenueCagr');
    expect(companyKeys['roe']).toBe('roe');
    expect(PEER_METRICS).toHaveLength(10);
  });

  it('gives every scenario six texts and eight numbers, ending with the value per share', () => {
    expect(SCENARIO_SECTION.texts).toHaveLength(6);
    expect(SCENARIO_SECTION.metrics.at(-1)).toEqual({
      key: 'valuation',
      label: 'Value per share',
      unit: 'money',
    });
  });

  it('labels a company text and falls back to its key', () => {
    expect(companyTextLabel('moat')).toBe('Competitive advantages (moat)');
    expect(companyTextLabel('unknown')).toBe('unknown');
  });
});
