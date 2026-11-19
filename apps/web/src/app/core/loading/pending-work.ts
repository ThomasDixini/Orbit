import { Injectable, computed, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * What the app is waiting for: calls to the API that have not answered and a page that is still being
 * opened (its code, guards and data). The loading bar shows while anything is pending, so the person
 * never looks at a page that seems stuck.
 */
@Injectable({ providedIn: 'root' })
export class PendingWork {
  private readonly requests = signal(0);
  private readonly navigations = signal(0);

  /** Whether anything is being waited for. */
  readonly isBusy = computed(() => this.requests() > 0 || this.navigations() > 0);

  constructor() {
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) this.navigations.update((count) => count + 1);
      else if (isNavigationOver(event)) this.navigations.update((count) => Math.max(0, count - 1));
    });
  }

  /**
   * Counts a call to the API that was sent.
   * @example pending.requestStarted()
   */
  requestStarted(): void {
    this.requests.update((count) => count + 1);
  }

  /**
   * Counts a call to the API as answered (or failed, or cancelled).
   * @example pending.requestFinished()
   */
  requestFinished(): void {
    this.requests.update((count) => Math.max(0, count - 1));
  }
}

function isNavigationOver(event: unknown): boolean {
  return (
    event instanceof NavigationEnd ||
    event instanceof NavigationCancel ||
    event instanceof NavigationError ||
    event instanceof NavigationSkipped
  );
}
