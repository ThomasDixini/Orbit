import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModuleFrame } from '../../../components/module-frame/module-frame';
import { DataRefresh } from '../../../core/refresh/data-refresh';
import { FINANCES_SECTIONS } from '../../../core/finances/finances-section';
import { APP_MODULES } from '../../../core/modules/module-catalog';

/** Frame shared by every Finances page: header with section tabs, routed page, module dock. */
@Component({
  selector: 'app-finances-shell',
  imports: [RouterOutlet, ModuleFrame],
  template: `<app-module-frame [module]="financesModule" [sections]="sections">
    <!-- A new generation opens the page afresh, so it reads its data again. -->
    @for (generation of [refresh.generation()]; track generation) {
      <router-outlet />
    }
  </app-module-frame>`,
  styles: ':host { display: block; }',
})
export class FinancesShell {
  protected readonly refresh = inject(DataRefresh);
  protected readonly financesModule = APP_MODULES[1];
  protected readonly sections = FINANCES_SECTIONS;
}
