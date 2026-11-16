import { ANALYSIS_METRIC_MAGNITUDE_MAX } from './investment-analyses';
import { MetricUnit } from './investment-analysis-fields';

const MINUS_SIGN = '−';
const MAX_FRACTION_DIGITS = 2;
const MAX_TYPED_FRACTION_DIGITS = 6;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const GROUPED_THOUSANDS = /^-?\d{1,3}(\.\d{3}){2,}$/;

/**
 * Reads a number typed in either style (`18,5`, `1.234,56`, `1,234.56`, `-0.3`); symbols such as `%`,
 * `R$` or `x` are ignored. Undefined when it is not a number or is beyond a trillion.
 * @example parseAnalysisNumber('1.234,5') // 1234.5
 */
export function parseAnalysisNumber(text: string): number | undefined {
  const normalized = normalizeSeparators(
    text.replaceAll(/[\s%xR$]/gi, '').replace(MINUS_SIGN, '-'),
  );
  if (!NUMBER_PATTERN.test(normalized)) return undefined;
  const value = Number(normalized);
  return Math.abs(value) <= ANALYSIS_METRIC_MAGNITUDE_MAX ? value : undefined;
}

/**
 * A stored number as the form shows it for editing, in the reader's decimal style and without grouping.
 * @example metricInputText(18.5, 'pt-BR') // '18,5'
 */
export function metricInputText(value: number | undefined, locale: string): string {
  if (value === undefined) return '';
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: MAX_TYPED_FRACTION_DIGITS,
  }).format(value);
}

/**
 * A number with its unit, for reading.
 * @example formatMetric(18.5, 'percent', 'en-US') // '18.5%'
 */
export function formatMetric(value: number, unit: MetricUnit, locale: string): string {
  const sign = value < 0 ? MINUS_SIGN : '';
  return `${sign}${withUnit(Math.abs(value), unit, locale)}`;
}

/**
 * How much a number moved between two analyses, with its sign; percentages move in percentage points.
 * @example formatMetricChange(18, 21, 'percent', 'en-US') // '+3 p.p.'
 */
export function formatMetricChange(
  before: number,
  after: number,
  unit: MetricUnit,
  locale: string,
): string {
  const change = after - before;
  const sign = change < 0 ? MINUS_SIGN : '+';
  const magnitude = Math.abs(change);
  if (unit === 'percent') return `${sign}${plain(magnitude, locale)} p.p.`;
  return `${sign}${withUnit(magnitude, unit, locale)}`;
}

function withUnit(magnitude: number, unit: MetricUnit, locale: string): string {
  switch (unit) {
    case 'percent':
      return `${plain(magnitude, locale)}%`;
    case 'multiple':
      return `${plain(magnitude, locale)}x`;
    case 'days':
      return plain(magnitude, locale);
    case 'money':
      return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(
        magnitude,
      );
    case 'millions':
      return `${new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(magnitude)} MM`;
  }
}

function plain(magnitude: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: MAX_FRACTION_DIGITS }).format(
    magnitude,
  );
}

/** Leaves `.` as the only decimal separator: the last of `.` and `,` is the decimal one when both appear. */
function normalizeSeparators(text: string): string {
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma === -1) return GROUPED_THOUSANDS.test(text) ? text.replaceAll('.', '') : text;
  if (lastComma > lastDot) return text.replaceAll('.', '').replace(',', '.');
  return text.replaceAll(',', '');
}
