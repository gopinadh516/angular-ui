import { Routes } from '@angular/router';
import { DefaultLayoutComponent } from './layout';
import { AuthGuard } from './auth.guard';
import { AppRoleGuard } from './role.guard';
import {
  AR_LIST_ROLES,
  CLIENT_ROLES,
  DASHBOARD_ROLES,
  VIEW_AR_LIST_ROLES
} from './app-roles';

const CLAIMS_LIST_ROLES = [...new Set([
  ...DASHBOARD_ROLES,
  ...AR_LIST_ROLES,
  ...CLIENT_ROLES
])];
const currentRole = localStorage.getItem('currentUserRole');
const canViewArLists = VIEW_AR_LIST_ROLES.includes(currentRole as any);

const canViewProductivityReport =
  currentRole === 'ADMIN' ||
  currentRole === 'SUPER_ADMIN' ||
  currentRole === 'AR_MANAGER';
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '',
    component: DefaultLayoutComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Home'
    },
    children: [
      {
        path: '',
        redirectTo: 'claimstatus',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes),
        canActivate: [AppRoleGuard],
        data: {
          title: 'AR Center',
          roles: [...DASHBOARD_ROLES]
        }
      },
      {
        path: 'management-dashboard',
        loadComponent: () =>
          import('./views/management-dashboard/management-dashboard.component')
            .then(m => m.ManagementDashboardComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'Management Dashboard',
          roles: [...DASHBOARD_ROLES]
        }
      },
      {
        path: 'ar-lists/:listNumber',
        loadComponent: () =>
          import('./views/ar-followup-list-details/ar-followup-list-details.component')
            .then(m => m.ArFollowupListDetailsComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'AR List Details',
          roles: [...VIEW_AR_LIST_ROLES]
        }
      },
      {
        path: 'physician-daily-report',
        loadComponent: () =>
          import('./views/physician-daily-report/physician-daily-report.component')
            .then(m => m.PhysicianDailyReportComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'Daily Visit Report',
          roles: [...DASHBOARD_ROLES]
            }
      },
      {
        path: 'productivity-report',
        loadComponent: () =>
          import('./views/productivity-report/productivity-report.component') 
            .then(m => m.ProductivityReportComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'Productivity Report',
          roles: ['ADMIN', 'SUPER_ADMIN', 'AR_MANAGER']
        }
      },
      {
        path: 'resolution-report',
        loadComponent: () => import('./views/resolution-report/resolution-report.component')
          .then(m => m.ResolutionReportComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'Resolution Report',
          roles: ['SUPER_ADMIN', 'ADMIN', 'AR_MANAGER']
            }
      },
      {
        path: 'theme',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/theme/routes').then((m) => m.routes)
      },
      {
        path: 'base',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/base/routes').then((m) => m.routes)
      },
      {
        path: 'buttons',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/buttons/routes').then((m) => m.routes)
      },
      {
        path: 'forms',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/forms/routes').then((m) => m.routes)
      },
      {
        path: 'icons',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/icons/routes').then((m) => m.routes)
      },
      {
        path: 'notifications',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/notifications/routes').then((m) => m.routes)
      },
      {
        path: 'widgets',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/widgets/routes').then((m) => m.routes)
      },
      {
        path: 'charts',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/charts/routes').then((m) => m.routes)
      },
      {
        path: 'pages',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/pages/routes').then((m) => m.routes)
      },
      {
        path: 'upload',
        canLoad: [AuthGuard],
        loadChildren: () => import('./views/upload/routes').then((m) => m.routes)
      },
      {
        path: 'ar-aging',
        loadComponent: () =>
          import('./views/excel-ar-aging/excel-ar-aging.component')
            .then(m => m.ExcelArAgingComponent)
      },
      {
        path: 'ar-lists',
        loadComponent: () =>
          import('./views/ar-summary-list/ar-summary-list.component')
            .then(m => m.ArSummaryListComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'View AR Lists',
          roles: [...VIEW_AR_LIST_ROLES]
        }
      },
      {
  path: 'predicted-payer-followup-list',
  loadComponent: () =>
    import('./views/predicted-payer-followup-list/predicted-payer-followup-list.component')
      .then(m => m.PredictedPayerFollowupListComponent),
  canActivate: [AppRoleGuard],
  data: {
    title: 'Predicted Payer Follow-up List',
    roles: ['SUPER_ADMIN', 'ADMIN', 'AR_MANAGER', 'AR_AGENT']
  }
},
      {
        path: 'autocoding',
        loadChildren: () =>
          import('./views/autocoding/routes').then((m) => m.routes)
      },
      {
        path: 'lead-times',
        loadComponent: () =>
          import('./views/lead-times/lead-times.component')
            .then(m => m.LeadTimesComponent)
      },
      {
        path: 'claimstatus',
        loadComponent: () =>
          import('./views/claimstatus/claimstatus.component')
            .then((m) => m.ClaimstatusComponent),
        canActivate: [AppRoleGuard],
        data: {
          title: 'Claim Status',
          roles: [...CLAIMS_LIST_ROLES]
        }
      },
      {
        path: 'encounters',
        loadComponent: () =>
          import('./views/encounter-tracker/encounter-tracker.component')
            .then(m => m.EncounterTrackerComponent),
        data: {
          title: 'Encounter List'
        }
      }
    ]
  },
  {
    path: '404',
    loadComponent: () =>
      import('./views/pages/page404/page404.component').then(m => m.Page404Component),
    data: {
      title: 'Page 404'
    }
  },
  {
    path: '500',
    loadComponent: () =>
      import('./views/pages/page500/page500.component').then(m => m.Page500Component),
    data: {
      title: 'Page 500'
    }
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./views/pages/login/login.component').then(m => m.LoginComponent),
    data: {
      title: 'Login Page'
    }
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./views/pages/register/register.component').then(m => m.RegisterComponent),
    data: {
      title: 'Register Page'
    }
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];