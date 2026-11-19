import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { isDemoMode } from '../../core/finances/demo/demo-mode';
import { DataRefresh } from '../../core/refresh/data-refresh';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BackupMenu } from '../backup-menu/backup-menu';
import { DemoSwitch } from '../demo-switch/demo-switch';
import { LanguageSwitcher } from '../language-switcher/language-switcher';

/** Top bar shared by every screen: brand on the left, sign out on the right. */
@Component({
  selector: 'app-header',
  imports: [RouterLink, TranslatePipe, LanguageSwitcher, DemoSwitch, BackupMenu],
  template: `<header class="app-header">
    <a class="brand" routerLink="/">Orbit</a>
    <ng-content />
    <div class="end">
      <button
        class="refresh"
        type="button"
        [class.spinning]="dataRefresh.isRefreshing()"
        [attr.aria-label]="'Refresh data' | t"
        [title]="'Refresh data' | t"
        (click)="dataRefresh.refresh()"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M20 11a8 8 0 0 0-14.9-3M4 5v3.5h3.5"></path>
          <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-3.5h-3.5"></path>
        </svg>
      </button>
      <!-- The demo shows made-up data, while a backup always holds the person's own: kept apart. -->
      @if (!isDemo) {
        <app-backup-menu />
      }
      <app-demo-switch />
      <app-language-switcher />
      @if (session.isSignedIn()) {
        <button
          class="profile"
          type="button"
          [attr.aria-label]="'Sign out' | t"
          [title]="(session.user()?.name ?? '') + ' · ' + ('Sign out' | t)"
          (click)="signOut()"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <path d="M16 17l5-5-5-5M21 12H9"></path>
          </svg>
        </button>
      }
    </div>
  </header>`,
  styleUrl: './app-header.css',
})
export class AppHeader {
  protected readonly session = inject(SessionStore);
  protected readonly dataRefresh = inject(DataRefresh);
  private readonly router = inject(Router);
  protected readonly isDemo = isDemoMode();

  /** Forgets the session and goes back to the landing page. */
  protected signOut(): void {
    this.session.end();
    void this.router.navigateByUrl('/');
  }
}
