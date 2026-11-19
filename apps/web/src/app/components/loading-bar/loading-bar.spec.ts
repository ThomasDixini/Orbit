import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PendingWork } from '../../core/loading/pending-work';
import { LoadingBar } from './loading-bar';

function render(): { fixture: ComponentFixture<LoadingBar>; pending: PendingWork } {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LoadingBar);
  fixture.detectChanges();
  return { fixture, pending: TestBed.inject(PendingWork) };
}

function bar(fixture: ComponentFixture<LoadingBar>): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector('[role="progressbar"]');
}

describe('LoadingBar', () => {
  it('shows nothing while nothing is loading', () => {
    const { fixture } = render();

    expect(bar(fixture)).toBeNull();
  });

  it('shows a labelled progress bar while a call is pending, and takes it away after', () => {
    const { fixture, pending } = render();

    pending.requestStarted();
    fixture.detectChanges();
    const whileLoading = bar(fixture)?.getAttribute('aria-label');
    pending.requestFinished();
    fixture.detectChanges();

    expect([whileLoading, bar(fixture)]).toEqual(['Loading…', null]);
  });
});
