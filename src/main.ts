import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideRouter } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './app/app.interceptor';
import { MockApiInterceptor } from './app/mock/mock-api.interceptor';
import { SidebarNavHelper } from '@coreui/angular';
import { provideAnimations } from '@angular/platform-browser/animations';

import { importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { cilCompass } from '@coreui/icons';

// ✅ tiny init function to load your icons
function initIcons(iconSet: IconSetService) {
  return () => {
    iconSet.icons = {
      cilCompass,
      // add more icons here (e.g., cilUser, cilSettings, ...)
    };
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: MockApiInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    SidebarNavHelper,
    provideAnimations(),

    // ✅ make CoreUI IconModule available app-wide
    importProvidersFrom(IconModule),

    // ✅ provide the IconSetService
    IconSetService,

    // ✅ register your icons at startup
    { provide: APP_INITIALIZER, useFactory: initIcons, deps: [IconSetService], multi: true },
  ]
});
