Physician Daily Report Package
================================

Files included
--------------
1. physician-daily-report.models.ts
2. physician-daily-report.service.ts
3. physician-daily-report.component.ts
4. physician-daily-report.component.html
5. physician-daily-report.component.scss
6. physician-daily-report.module.ts

Backend endpoints used
----------------------
POST /api/reports/physician-daily/physicians
POST /api/reports/physician-daily/facts

Headers
-------
X-Selected-Client (optional)

Default behavior
----------------
- From Date = 30 days before today
- To Date = today
- Physician = All
- Summary is aggregated client-side from fact rows
- Expand button shows visit-level details for the day

Dashboard usage
---------------
Place this selector in your dashboard HTML:

<app-physician-daily-report
  [licenseKey]="160088"
  [columnHeadingFid]="159"
  [selectedClient]="selectedClient">
</app-physician-daily-report>

Notes
-----
- Physician dropdown includes a built-in All option in the component HTML.
- The component assumes your backend returns PhysicianDailyFactDTO rows exactly as in the current controller.
- If your project already imports HttpClientModule or FormsModule globally, keep only one effective import path.
