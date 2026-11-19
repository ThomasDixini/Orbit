import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { loadingInterceptor } from './loading-interceptor';
import { PendingWork } from './pending-work';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let pending: PendingWork;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    pending = TestBed.inject(PendingWork);
  });

  afterEach(() => backend.verify());

  it('is busy from the moment a call is sent until it is answered', () => {
    http.get('/api/goals').subscribe();
    const whileWaiting = pending.isBusy();

    backend.expectOne('/api/goals').flush([]);

    expect([whileWaiting, pending.isBusy()]).toEqual([true, false]);
  });

  it('stops being busy when a call fails', () => {
    http.get('/api/goals').subscribe({ error: () => undefined });

    backend.expectOne('/api/goals').flush('nope', { status: 500, statusText: 'Server Error' });

    expect(pending.isBusy()).toBe(false);
  });

  it('stops being busy when a call is cancelled', () => {
    const call = http.get('/api/goals').subscribe();

    call.unsubscribe();

    expect([pending.isBusy(), backend.expectOne('/api/goals').cancelled]).toEqual([false, true]);
  });

  it('stays busy until the last of several calls is answered', () => {
    http.get('/api/goals').subscribe();
    http.get('/api/tasks').subscribe();

    backend.expectOne('/api/goals').flush([]);
    const afterFirst = pending.isBusy();
    backend.expectOne('/api/tasks').flush([]);

    expect([afterFirst, pending.isBusy()]).toEqual([true, false]);
  });
});
