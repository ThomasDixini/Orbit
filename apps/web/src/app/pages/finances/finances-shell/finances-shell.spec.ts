import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideFakeBackupGateway } from '../../../core/backups/fake-backup-gateway';
import { DataRefresh } from '../../../core/refresh/data-refresh';
import { FinancesShell } from './finances-shell';

let opened = 0;

@Component({ template: '<p>page</p>' })
class CountedPage {
  constructor() {
    opened++;
  }
}

describe('FinancesShell', () => {
  beforeEach(() => {
    opened = 0;
    TestBed.configureTestingModule({
      providers: [
        provideFakeBackupGateway(),
        provideRouter([
          {
            path: 'finances',
            component: FinancesShell,
            children: [{ path: '', component: CountedPage }],
          },
        ]),
      ],
    });
  });

  it('opens the routed page afresh on a refresh, so it reads its data again', async () => {
    const harness = await RouterTestingHarness.create('/finances');
    const openedBefore = opened;

    TestBed.inject(DataRefresh).refresh();
    harness.detectChanges();

    expect([openedBefore, opened, TestBed.inject(Router).url]).toEqual([1, 2, '/finances']);
  });
});
