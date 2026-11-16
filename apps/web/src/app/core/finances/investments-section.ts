/**
 * The parts of the Investments page: the portfolio itself, the rates and notes written around it, and the
 * fundamental analyses of each investment.
 */
export type InvestmentsSection = 'portfolio' | 'analysis' | 'fundamentals';

/** The switcher's tabs, in order; the portfolio opens first. */
export const INVESTMENTS_SECTION_OPTIONS: readonly { value: InvestmentsSection; label: string }[] =
  [
    { value: 'portfolio', label: 'Portfolio' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'fundamentals', label: 'Fundamentals' },
  ];
