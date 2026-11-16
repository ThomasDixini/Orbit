import { Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { LoadFailed } from '../../../../components/load-failed/load-failed';
import {
  InvestmentAnalysis,
  InvestmentAnalysisDraft,
  analysesOf,
  nextAnalysisDraft,
  recommendationLabel,
  upsidePercent,
} from '../../../../core/finances/investment-analyses';
import { previousAnalysis } from '../../../../core/finances/investment-analysis-comparison';
import { formatMetric } from '../../../../core/finances/investment-analysis-numbers';
import { InvestmentAnalysesStore } from '../../../../core/finances/investment-analyses-store';
import { PortfolioLine } from '../../../../core/finances/investments';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { InvestmentAnalysisComparison } from '../analysis-comparison/analysis-comparison';
import { InvestmentAnalysisDetail } from '../analysis-detail/analysis-detail';
import { InvestmentAnalysisForm } from '../analysis-form/analysis-form';

/** What is open under the list: a form (new or editing), one analysis to read, the comparison, or nothing. */
type Panel =
  | { readonly kind: 'none' }
  | { readonly kind: 'form'; readonly draft: InvestmentAnalysisDraft; readonly editingId?: string }
  | { readonly kind: 'view'; readonly analysisId: string }
  | { readonly kind: 'compare' };

/**
 * The fundamental analyses of one investment at a time, newest first: a new one starts as a copy of the
 * latest, so only what changed has to be typed, and any two can be compared. Provides its own store, so
 * it loads when it is shown.
 * @example <app-investment-analyses [lines]="lines()" [today]="today" />
 */
@Component({
  selector: 'app-investment-analyses',
  imports: [
    TranslatePipe,
    LoadFailed,
    InvestmentAnalysisForm,
    InvestmentAnalysisDetail,
    InvestmentAnalysisComparison,
  ],
  providers: [InvestmentAnalysesStore],
  templateUrl: './investment-analyses.html',
  styleUrl: './investment-analyses.css',
})
export class InvestmentAnalyses {
  readonly lines = input.required<readonly PortfolioLine[]>();
  /** Today, `YYYY-MM-DD`: the day a new analysis is dated until changed. */
  readonly today = input.required<string>();

  private readonly store = inject(InvestmentAnalysesStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly pickedInvestment = signal('');
  private readonly savesAtOpen = signal(0);

  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly hasActionFailed = this.store.hasActionFailed;
  protected readonly panel = signal<Panel>({ kind: 'none' });

  protected readonly investments = computed(() =>
    this.lines().map((line) => ({ id: line.investment.id, name: line.investment.name })),
  );
  protected readonly investmentId = computed(() => {
    const picked = this.pickedInvestment();
    const known = this.investments().some((item) => item.id === picked);
    return known ? picked : (this.investments()[0]?.id ?? '');
  });
  protected readonly investmentName = computed(
    () => this.investments().find((item) => item.id === this.investmentId())?.name ?? '',
  );
  protected readonly analyses = computed(() =>
    analysesOf(this.store.analyses(), this.investmentId()),
  );
  protected readonly viewed = computed(() => {
    const panel = this.panel();
    if (panel.kind !== 'view') return undefined;
    return this.analyses().find((analysis) => analysis.id === panel.analysisId);
  });
  protected readonly formPanel = computed(() => {
    const panel = this.panel();
    return panel.kind === 'form' ? panel : undefined;
  });
  /** The analysis the open form reviews: the one before the edited one, or the latest for a new one. */
  protected readonly reviewedAnalysis = computed(() => {
    const panel = this.formPanel();
    if (panel === undefined) return undefined;
    const edited = this.analyses().find((analysis) => analysis.id === panel.editingId);
    return edited === undefined ? this.analyses()[0] : previousAnalysis(edited, this.analyses());
  });

  constructor() {
    // A form closes once the API has accepted its save.
    effect(() => {
      if (this.panel().kind === 'form' && this.store.savedCount() > this.savesAtOpen()) {
        this.panel.set({ kind: 'none' });
      }
    });
  }

  protected pickInvestment(event: Event): void {
    this.pickedInvestment.set(fieldValue(event));
    this.panel.set({ kind: 'none' });
  }

  protected openNew(): void {
    this.openForm(nextAnalysisDraft(this.analyses()[0], this.investmentId(), this.today()));
  }

  protected openEdit(analysis: InvestmentAnalysis): void {
    const { id, ...draft } = analysis;
    this.openForm(draft, id);
  }

  protected openView(analysis: InvestmentAnalysis): void {
    this.panel.set({ kind: 'view', analysisId: analysis.id });
  }

  protected openCompare(): void {
    this.panel.set({ kind: 'compare' });
  }

  protected close(): void {
    this.panel.set({ kind: 'none' });
  }

  protected save(draft: InvestmentAnalysisDraft): void {
    this.savesAtOpen.set(this.store.savedCount());
    this.store.save(draft, this.formPanel()?.editingId);
  }

  protected remove(analysis: InvestmentAnalysis): void {
    if (this.viewed()?.id === analysis.id) this.close();
    this.store.remove(analysis.id);
  }

  protected reload(): void {
    this.store.reload();
  }

  protected dateLabel(analysis: InvestmentAnalysis): string {
    return shortDateLabel(analysis.date, this.locale);
  }

  protected recommendation(analysis: InvestmentAnalysis): string {
    return analysis.recommendation === undefined
      ? ''
      : recommendationLabel(analysis.recommendation);
  }

  /** Price, target and upside in one line, as far as they were filled in. */
  protected priceLine(analysis: InvestmentAnalysis): string {
    const price = analysis.metrics['price'];
    const target = analysis.metrics['targetPrice'];
    const upside = upsidePercent(analysis.metrics);
    return [
      price === undefined ? '' : formatMetric(price, 'money', this.locale),
      target === undefined ? '' : `→ ${formatMetric(target, 'money', this.locale)}`,
      upside === undefined ? '' : `(${formatMetric(upside, 'percent', this.locale)})`,
    ]
      .filter((piece) => piece !== '')
      .join(' ');
  }

  protected thesis(analysis: InvestmentAnalysis): string {
    return analysis.texts['thesis'] ?? '';
  }

  private openForm(draft: InvestmentAnalysisDraft, editingId?: string): void {
    this.savesAtOpen.set(this.store.savedCount());
    this.panel.set({ kind: 'form', draft, editingId });
  }
}
