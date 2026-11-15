/** The parts of the Investments page: the portfolio itself, and the analysis written around it. */
export type InvestmentsSection = 'portfolio' | 'analysis';

/** The switcher's tabs, in order; the portfolio opens first. */
export const INVESTMENTS_SECTION_OPTIONS: readonly { value: InvestmentsSection; label: string }[] =
  [
    { value: 'portfolio', label: 'Portfolio' },
    { value: 'analysis', label: 'Analysis' },
  ];
