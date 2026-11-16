import {
  formatMetric,
  formatMetricChange,
  metricInputText,
  parseAnalysisNumber,
} from './investment-analysis-numbers';

describe('analysis numbers', () => {
  it.each([
    ['18,5', 18.5],
    ['18.5', 18.5],
    ['-0,3', -0.3],
    ['−0,3', -0.3],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234.567', 1234567],
    ['12%', 12],
    ['R$ 31,90', 31.9],
    ['8,5x', 8.5],
    ['0', 0],
  ])('reads %s as %d', (typed, expected) => {
    expect(parseAnalysisNumber(typed)).toBe(expected);
  });

  it.each(['', 'abc', '1,2,3', '12..5', '--1', '1000000000001'])('refuses %s', (typed) => {
    expect(parseAnalysisNumber(typed)).toBeUndefined();
  });

  it('writes a stored number back the way the reader types it', () => {
    expect(metricInputText(1234.5, 'pt-BR')).toBe('1234,5');
    expect(metricInputText(1234.5, 'en-US')).toBe('1234.5');
    expect(metricInputText(undefined, 'pt-BR')).toBe('');
  });

  it('shows each unit', () => {
    expect(formatMetric(18.5, 'percent', 'en-US')).toBe('18.5%');
    expect(formatMetric(-0.35, 'multiple', 'en-US')).toBe('−0.35x');
    expect(formatMetric(45, 'days', 'en-US')).toBe('45');
    expect(formatMetric(31.9, 'money', 'en-US')).toBe('R$31.90');
    expect(formatMetric(1234.4, 'millions', 'en-US')).toBe('R$1,234 MM');
  });

  it('shows percentages moving in percentage points and other numbers in their unit', () => {
    expect(formatMetricChange(18, 21, 'percent', 'en-US')).toBe('+3 p.p.');
    expect(formatMetricChange(2, 1.5, 'multiple', 'en-US')).toBe('−0.5x');
    expect(formatMetricChange(30, 30, 'money', 'en-US')).toBe('+R$0.00');
  });
});
