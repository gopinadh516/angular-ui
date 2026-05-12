Resolution Report UI

Folder name:
resolution-report

Files:
- resolution-report.component.ts
- resolution-report.component.html
- resolution-report.component.scss
- resolution-report.service.ts
- resolution-report.model.ts

Backend endpoint expected from generated Java classes:
GET /api/ar/payment-resolution/dashboard?licenseKey=160088&fromDate=2026-01-01&toDate=2026-03-31

Route example for standalone routing:
{
  path: 'resolution-report',
  loadComponent: () => import('./views/resolution-report/resolution-report.component')
    .then(m => m.ResolutionReportComponent),
  data: {
    title: 'Resolution Report',
    roles: ['SUPER_ADMIN', 'ADMIN', 'AR_MANAGER']
  }
}

Nav example:
{
  name: 'Resolution Report',
  url: '/resolution-report',
  iconComponent: { name: 'cil-dollar' }
}

Notes:
- The component defaults to the previous quarter date range.
- For April 2026, default range will be 2026-01-01 to 2026-03-31.
- The UI uses the same compact card/table styling pattern as productivity-report.component.scss.
- Detail rows can be filtered by user or searched by claim, visit, patient, action, or note.
- Export CSV exports the currently filtered detail rows.
