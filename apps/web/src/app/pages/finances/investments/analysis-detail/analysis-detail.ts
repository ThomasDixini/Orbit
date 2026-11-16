import { Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import {
  AnalysisMetrics,
  AnalysisTexts,
  InvestmentAnalysis,
  SCENARIO_OPTIONS,
  marginOfSafetyPercent,
  recommendationLabel,
  scenarioReturnPercent,
  upsidePercent,
  weightedValuation,
} from '../../../../core/finances/investment-analyses';
import {
  AnalysisSection,
  COMPANY_SECTIONS,
  MetricField,
  PEER_METRICS,
  SCENARIO_SECTION,
} from '../../../../core/finances/investment-analysis-fields';
import { formatMetric } from '../../../../core/finances/investment-analysis-numbers';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** A filled block of the analysis, ready to read. */
interface ShownSection {
  readonly id: string;
  readonly title: string;
  readonly numbers: readonly { readonly label: string; readonly value: string }[];
  readonly texts: readonly { readonly label: string; readonly text: string }[];
}

/**
 * One fundamental analysis to read: only the parts that were filled in, the peers side by side with the
 * company, and the three scenarios with the return each one points to.
 * @example <app-analysis-detail [analysis]="analysis" [investmentName]="'TOTS3'" (dismiss)="close()" />
 */
@Component({
  selector: 'app-analysis-detail',
  imports: [TranslatePipe],
  templateUrl: './analysis-detail.html',
  styleUrl: './analysis-detail.css',
})
export class InvestmentAnalysisDetail {
  readonly analysis = input.required<InvestmentAnalysis>();
  readonly investmentName = input.required<string>();
  readonly dismiss = output<void>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly peerMetrics = PEER_METRICS;
  protected readonly title = computed(() => shortDateLabel(this.analysis().date, this.locale));
  protected readonly recommendation = computed(() => {
    const recommendation = this.analysis().recommendation;
    return recommendation === undefined ? '' : recommendationLabel(recommendation);
  });
  protected readonly derived = computed(() => {
    const metrics = this.analysis().metrics;
    return [
      { label: 'Upside to target', value: this.percent(upsidePercent(metrics)) },
      { label: 'Margin of safety', value: this.percent(marginOfSafetyPercent(metrics)) },
      {
        label: 'Value weighed by the scenarios',
        value: this.money(weightedValuation(this.analysis().scenarios)),
      },
    ].filter((item) => item.value !== '');
  });
  protected readonly sections = computed(() =>
    COMPANY_SECTIONS.map((section) =>
      this.shown(
        section,
        section.id,
        section.title,
        this.analysis().texts,
        this.analysis().metrics,
      ),
    ).filter(isFilled),
  );
  protected readonly scenarios = computed(() =>
    SCENARIO_OPTIONS.flatMap((option) => {
      const scenario = this.analysis().scenarios.find(
        (candidate) => candidate.kind === option.value,
      );
      if (scenario === undefined) return [];
      const shown = this.shown(
        SCENARIO_SECTION,
        option.value,
        option.label,
        scenario.texts,
        scenario.metrics,
      );
      const ret = this.percent(scenarioReturnPercent(scenario.metrics, this.analysis().metrics));
      return [{ ...shown, ret }];
    }),
  );

  protected metricText(metrics: AnalysisMetrics, field: MetricField): string {
    const value = metrics[field.key];
    return value === undefined ? '—' : formatMetric(value, field.unit, this.locale);
  }

  /** The company's own number in the peers table, which may sit under another key (revenue CAGR). */
  protected companyPeerText(field: (typeof PEER_METRICS)[number]): string {
    return this.metricText(this.analysis().metrics, { ...field, key: field.companyKey });
  }

  private shown(
    section: AnalysisSection,
    id: string,
    title: string,
    texts: AnalysisTexts,
    metrics: AnalysisMetrics,
  ): ShownSection {
    return {
      id,
      title,
      numbers: section.metrics
        .filter((field) => metrics[field.key] !== undefined)
        .map((field) => ({
          label: field.label,
          value: formatMetric(metrics[field.key], field.unit, this.locale),
        })),
      texts: section.texts
        .filter((field) => (texts[field.key] ?? '') !== '')
        .map((field) => ({ label: field.label, text: texts[field.key] })),
    };
  }

  private percent(value: number | undefined): string {
    return value === undefined ? '' : formatMetric(value, 'percent', this.locale);
  }

  private money(value: number | undefined): string {
    return value === undefined ? '' : formatMetric(value, 'money', this.locale);
  }
}

function isFilled(section: ShownSection): boolean {
  return section.numbers.length > 0 || section.texts.length > 0;
}
