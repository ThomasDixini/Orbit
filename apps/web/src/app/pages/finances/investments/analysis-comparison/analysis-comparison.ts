import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import {
  InvestmentAnalysis,
  recommendationLabel,
} from '../../../../core/finances/investment-analyses';
import {
  MetricComparison,
  compareAnalyses,
} from '../../../../core/finances/investment-analysis-comparison';
import {
  formatMetric,
  formatMetricChange,
} from '../../../../core/finances/investment-analysis-numbers';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/**
 * Two analyses of the same investment side by side: each number with how much it moved, each text with
 * whether it was rewritten. By default the latest analysis is compared with the one before it.
 * @example <app-analysis-comparison [analyses]="analysesOfTotvs" investmentName="TOTS3" />
 */
@Component({
  selector: 'app-analysis-comparison',
  imports: [TranslatePipe],
  templateUrl: './analysis-comparison.html',
  styleUrl: './analysis-comparison.css',
})
export class InvestmentAnalysisComparison {
  /** The analyses of one investment, newest day first; at least two. */
  readonly analyses = input.required<readonly InvestmentAnalysis[]>();
  readonly investmentName = input.required<string>();
  readonly dismiss = output<void>();

  private readonly locale = inject(LOCALE_ID);
  private readonly pickedBefore = signal<string | undefined>(undefined);
  private readonly pickedAfter = signal<string | undefined>(undefined);

  protected readonly after = computed(() => this.find(this.pickedAfter()) ?? this.analyses()[0]);
  protected readonly before = computed(
    () => this.find(this.pickedBefore()) ?? this.analyses()[1] ?? this.analyses()[0],
  );
  /** Older first, whichever way round the two were picked. */
  private readonly ordered = computed(() => {
    const [first, second] = [this.before(), this.after()];
    return first.date <= second.date
      ? { older: first, newer: second }
      : { older: second, newer: first };
  });
  protected readonly olderLabel = computed(() => this.dateLabel(this.ordered().older));
  protected readonly newerLabel = computed(() => this.dateLabel(this.ordered().newer));
  protected readonly recommendations = computed(() => ({
    older: this.recommendationText(this.ordered().older),
    newer: this.recommendationText(this.ordered().newer),
  }));
  protected readonly sections = computed(() =>
    compareAnalyses(this.ordered().older, this.ordered().newer),
  );

  protected pickBefore(event: Event): void {
    this.pickedBefore.set(fieldValue(event));
  }

  protected pickAfter(event: Event): void {
    this.pickedAfter.set(fieldValue(event));
  }

  protected dateLabel(analysis: InvestmentAnalysis): string {
    return shortDateLabel(analysis.date, this.locale);
  }

  protected valueText(row: MetricComparison, value: number | undefined): string {
    return value === undefined ? '—' : formatMetric(value, row.unit, this.locale);
  }

  protected changeText(row: MetricComparison): string {
    if (row.before === undefined || row.after === undefined) return '';
    return formatMetricChange(row.before, row.after, row.unit, this.locale);
  }

  private recommendationText(analysis: InvestmentAnalysis): string {
    return analysis.recommendation === undefined
      ? '—'
      : recommendationLabel(analysis.recommendation);
  }

  private find(id: string | undefined): InvestmentAnalysis | undefined {
    return this.analyses().find((analysis) => analysis.id === id);
  }
}
