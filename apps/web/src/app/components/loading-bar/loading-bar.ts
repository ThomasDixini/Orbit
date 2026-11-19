import { Component, inject } from '@angular/core';
import { PendingWork } from '../../core/loading/pending-work';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * A thin bar over the top of every screen that runs while the app waits for the API or opens a page.
 * It only appears after a short moment, so quick answers do not make it flicker.
 */
@Component({
  selector: 'app-loading-bar',
  imports: [TranslatePipe],
  template: `@if (pending.isBusy()) {
    <div class="bar" role="progressbar" [attr.aria-label]="'Loading…' | t" aria-busy="true">
      <span class="runner"></span>
    </div>
  }`,
  styleUrl: './loading-bar.css',
})
export class LoadingBar {
  protected readonly pending = inject(PendingWork);
}
