/** Which rate a typed value is: the Selic (per year), the IPCA (per month) or the income tax. */
export type PeriodRateKind = 'selic' | 'ipca' | 'incomeTax';

/** A rate the user typed for one month; 1300 basis points is 13%. */
export interface PeriodRate {
  readonly kind: PeriodRateKind;
  /** `YYYY-MM`. */
  readonly month: string;
  readonly basisPoints: number;
}

/** What the rate form fills in; kind and month identify the rate. */
export type PeriodRateDraft = Pick<PeriodRate, 'basisPoints'>;

/** Same range as the API: from -10% to 100%. */
export const MIN_BASIS_POINTS = -1000;
export const MAX_BASIS_POINTS = 10_000;

const MONTHS_PER_YEAR = 12;
const BASIS_POINTS_PER_UNIT = 10_000;
/** Typed rates: an optional minus sign, whole percent and up to 2 decimals after a comma or a dot. */
const RATE_PATTERN = /^(-?)(\d{1,3})(?:[.,](\d{1,2}))?$/;

export const PERIOD_RATE_KIND_OPTIONS: readonly { value: PeriodRateKind; label: string }[] = [
  { value: 'selic', label: 'Selic (per year)' },
  { value: 'ipca', label: 'IPCA (per month)' },
  { value: 'incomeTax', label: 'Income tax' },
];

/** The kinds drawn as a line on the return chart; the income tax is a rate to keep, not a return. */
const CHARTED_KINDS: readonly PeriodRateKind[] = ['selic', 'ipca'];

/** Short names used in the chart legend. */
const SERIES_NAMES: Readonly<Record<PeriodRateKind, string>> = {
  selic: 'Selic',
  ipca: 'IPCA',
  incomeTax: 'Income tax',
};

/**
 * The label of a rate kind.
 * @example periodRateKindLabel('ipca') // 'IPCA (per month)'
 */
export function periodRateKindLabel(kind: PeriodRateKind): string {
  return PERIOD_RATE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/**
 * Reads a rate typed as a percent, like `13` or `-0,25`, as basis points; undefined when it is not shaped
 * like that or is outside the API's range.
 * @example parseBasisPoints('13,5') // 1350
 */
export function parseBasisPoints(text: string): number | undefined {
  const match = RATE_PATTERN.exec(text.trim());
  if (match === null) return undefined;
  const fraction = (match[3] ?? '').padEnd(2, '0');
  const magnitude = Number(match[2]) * 100 + Number(fraction);
  const basisPoints = match[1] === '-' ? -magnitude : magnitude;
  return basisPoints >= MIN_BASIS_POINTS && basisPoints <= MAX_BASIS_POINTS
    ? basisPoints
    : undefined;
}

/**
 * A rate written the way it is read back: no trailing zeros.
 * @example basisPointsText(1350) // '13.5'
 */
export function basisPointsText(basisPoints: number): string {
  const sign = basisPoints < 0 ? '-' : '';
  const magnitude = Math.abs(basisPoints);
  const whole = Math.floor(magnitude / 100);
  const fraction = String(magnitude % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fraction === '' ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/** One line of the return chart: what a rate would have accumulated month by month. */
export interface RateSeries {
  readonly name: string;
  readonly values: readonly (number | undefined)[];
}

/**
 * The rates that can be compared with the portfolio, as accumulated percent per month of the chart: the
 * Selic (a yearly rate, spread over twelve months) and the IPCA (already monthly), compounded from the first
 * month. A month without a typed rate ends the line there (the value is not known, so none is invented).
 * A kind with no rate in the period gives no line.
 * @example rateSeries([{ kind: 'ipca', month: '2026-10', basisPoints: 100 }], ['2026-10', '2026-11'])
 * // [{ name: 'IPCA', values: [1, undefined] }]
 */
export function rateSeries(
  rates: readonly PeriodRate[],
  months: readonly string[],
): readonly RateSeries[] {
  return CHARTED_KINDS.map((kind) => ({
    name: SERIES_NAMES[kind],
    values: accumulate(rates, kind, months),
  })).filter((series) => series.values.some((value) => value !== undefined));
}

function accumulate(
  rates: readonly PeriodRate[],
  kind: PeriodRateKind,
  months: readonly string[],
): (number | undefined)[] {
  const byMonth = new Map(
    rates.filter((rate) => rate.kind === kind).map((rate) => [rate.month, rate.basisPoints]),
  );
  let factor = 1;
  let known = true;
  return months.map((month) => {
    const basisPoints = byMonth.get(month);
    known = known && basisPoints !== undefined;
    if (!known || basisPoints === undefined) return undefined;
    factor *= monthlyFactor(kind, basisPoints);
    return (factor - 1) * 100;
  });
}

function monthlyFactor(kind: PeriodRateKind, basisPoints: number): number {
  const rate = 1 + basisPoints / BASIS_POINTS_PER_UNIT;
  return kind === 'selic' ? Math.pow(rate, 1 / MONTHS_PER_YEAR) : rate;
}

/**
 * Rates newest month first; within a month the kinds keep the order of the options.
 * @example sortedRates([older, newer]) // [newer, older]
 */
export function sortedRates(rates: readonly PeriodRate[]): readonly PeriodRate[] {
  const order = PERIOD_RATE_KIND_OPTIONS.map((option) => option.value);
  return [...rates].sort(
    (first, second) =>
      second.month.localeCompare(first.month) ||
      order.indexOf(first.kind) - order.indexOf(second.kind),
  );
}
