import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { PendingWork } from './pending-work';

@Component({ template: '' })
class BlankPage {}

describe('PendingWork', () => {
  it('is idle until something is waited for', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    expect(TestBed.inject(PendingWork).isBusy()).toBe(false);
  });

  it('is busy while a call is in flight, and idle once every call is over', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const pending = TestBed.inject(PendingWork);

    pending.requestStarted();
    pending.requestStarted();
    pending.requestFinished();
    const whileOneIsOpen = pending.isBusy();
    pending.requestFinished();

    expect([whileOneIsOpen, pending.isBusy()]).toEqual([true, false]);
  });

  it('never counts below zero', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const pending = TestBed.inject(PendingWork);

    pending.requestFinished();
    pending.requestStarted();

    expect(pending.isBusy()).toBe(true);
  });

  it('is busy while a page is being opened and idle once it is open', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'goals', component: BlankPage }])],
    });
    const pending = TestBed.inject(PendingWork);
    const router = TestBed.inject(Router);

    const navigation = router.navigateByUrl('/goals');
    const whileOpening = pending.isBusy();
    await navigation;

    expect([whileOpening, pending.isBusy()]).toEqual([true, false]);
  });

  it('is idle again when a page cannot be opened', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const pending = TestBed.inject(PendingWork);

    await TestBed.inject(Router)
      .navigateByUrl('/nowhere')
      .catch(() => false);

    expect(pending.isBusy()).toBe(false);
  });
});
