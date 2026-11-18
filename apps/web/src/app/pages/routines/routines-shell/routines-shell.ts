import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModuleFrame } from '../../../components/module-frame/module-frame';
import { DataRefresh } from '../../../core/refresh/data-refresh';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { ROUTINES_SECTIONS } from '../../../core/routines/routines-section';

/** Frame shared by every Routines & Goals page: header with section tabs, routed page, module dock. */
@Component({
  selector: 'app-routines-shell',
  imports: [RouterOutlet, ModuleFrame],
  template: `<app-module-frame [module]="routinesModule" [sections]="sections">
    <!-- A new generation opens the page afresh, so it reads its data again. -->
    @for (generation of [refresh.generation()]; track generation) {
      <router-outlet />
    }
  </app-module-frame>`,
  styles: ':host { display: block; }',
})
export class RoutinesShell {
  protected readonly refresh = inject(DataRefresh);
  protected readonly routinesModule = APP_MODULES[0];
  protected readonly sections = ROUTINES_SECTIONS;
}
