import { Injectable, signal } from '@angular/core';

/** How long the refresh button keeps spinning, so a quick refresh still shows that it did something. */
const SPIN_MILLISECONDS = 700;

/**
 * Fetches the data again without reloading the page. Stores that keep what they read for the whole
 * session register here and read it again on a refresh; the pages are opened afresh (a page keeps its
 * own stores), so everything on screen comes from the API once more.
 */
@Injectable({ providedIn: 'root' })
export class DataRefresh {
  private readonly count = signal(0);
  private readonly spinning = signal(false);
  private readonly listeners = new Set<() => void>();

  /** Changes on every refresh; a page is opened afresh when it changes. */
  readonly generation = this.count.asReadonly();
  /** Whether a refresh just happened, for the button to show it. */
  readonly isRefreshing = this.spinning.asReadonly();

  /**
   * Asks for `listener` to be called on every refresh. For stores that live as long as the app.
   * @example inject(DataRefresh).onRefresh(() => this.refresh())
   */
  onRefresh(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Reads everything again: the registered stores first, then the page on screen.
   * @example inject(DataRefresh).refresh()
   */
  refresh(): void {
    for (const listener of this.listeners) listener();
    this.count.update((count) => count + 1);
    this.spinning.set(true);
    setTimeout(() => this.spinning.set(false), SPIN_MILLISECONDS);
  }
}
