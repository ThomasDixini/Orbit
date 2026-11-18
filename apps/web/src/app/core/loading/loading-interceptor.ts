import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { PendingWork } from './pending-work';

/**
 * Tells {@link PendingWork} about every call that is in flight, so the loading bar shows while the app
 * waits for the API. A call that fails or is cancelled stops counting too.
 */
export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const pending = inject(PendingWork);
  pending.requestStarted();
  return next(request).pipe(finalize(() => pending.requestFinished()));
};
