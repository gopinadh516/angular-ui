import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

interface CptChargePaymentReportRequest {
  licenseKey: number;
  fromDate: string;
  toDate: string;
  selectedClient?: string | null;
  appType?: string | null;
}

interface CptChargePaymentDetailDTO {
  dosDate?: string | null;
  dosMonth?: string | null;
  postingDate?: string | null;
  firstPaymentDate?: string | null;
  lastPaymentDate?: string | null;
  paymentMonth?: string | null;
  visitId?: number | null;
  cptCode?: string | null;
  cptDescription?: string | null;
  units?: number | null;
  feePerUnit?: number | null;
  chargeValue?: number | null;
  paymentReceivedTotal?: number | null;
  paymentReceivedInsurance?: number | null;
  paymentReceivedPatient?: number | null;
  allowedAmount?: number | null;
  expectedAmount?: number | null;
  insuranceBalance?: number | null;
  patientBalance?: number | null;
  chargeDetailUid?: number | null;
}

interface CptChargePaymentSummaryDTO {
  rowLabel?: string | null;
  chargeValue?: number | null;
  paymentReceived?: number | null;
  grandTotal?: boolean | null;
}

interface CptChargePaymentReportResponseDTO {
  detailRows: CptChargePaymentDetailDTO[];
  summaryRows: CptChargePaymentSummaryDTO[];
  grandTotalCharge?: number | null;
  grandTotalPaymentReceived?: number | null;
}

interface MonthOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-cpt-charge-payment-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cpt-charge-payment-report.component.html',
  styleUrls: ['./cpt-charge-payment-report.component.scss'],
})
export class CptChargePaymentReportComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  @Input() licenseKey = 160088;

  private readonly reportUrl = '/api/reports/cpt-charge-payment';
  private readonly detailUrl = '/api/reports/cpt-charge-payment/detail';
  private readonly summaryUrl = '/api/reports/cpt-charge-payment/summary';

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly report = signal<CptChargePaymentReportResponseDTO | null>(null);
  readonly expanded = signal(false);

  monthOptions: MonthOption[] = [];
  topCptOptions: number[] = Array.from({ length: 20 }, (_, i) => i + 1);
  private syncingFilters = false;

  readonly summaryRows = computed<CptChargePaymentSummaryDTO[]>(() => {
    const rows = this.report()?.summaryRows ?? [];
    return rows.filter((row) => !row.grandTotal && (row.rowLabel ?? '').trim().toUpperCase() !== 'GRAND TOTAL');
  });

  readonly grandTotalRow = computed<CptChargePaymentSummaryDTO | null>(() => {
    const rows = this.report()?.summaryRows ?? [];
    return rows.find((row) => row.grandTotal || (row.rowLabel ?? '').trim().toUpperCase() === 'GRAND TOTAL') ?? null;
  });

  readonly detailRows = computed<CptChargePaymentDetailDTO[]>(() => this.report()?.detailRows ?? []);

  readonly filterForm = this.fb.nonNullable.group({
    licenseKey: [160088, [Validators.required]],
    reportMonth: [''],
    fromDate: [this.getDefaultFromDate(), [Validators.required]],
    toDate: [this.getToday(), [Validators.required]],
    topCptCount: [''],
    selectedClient: [this.getStoredValue('selectedClient', 'SALEM')],
    appType: [this.getStoredValue('selectedAppType', 'AMD')],
  });

  ngOnInit(): void {
    this.filterForm.patchValue({
      licenseKey: this.licenseKey ?? 160088,
      selectedClient: 'SALEM',
      appType: 'AMD',
    }, { emitEvent: false });

    this.buildMonthOptions();
    this.setDefaultMonth();
    this.loadReport();
  }

  loadReport(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.http
      .post<CptChargePaymentReportResponseDTO>(this.reportUrl, this.buildRequest())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.report.set({
            detailRows: response.detailRows ?? [],
            summaryRows: response.summaryRows ?? [],
            grandTotalCharge: Number(response.grandTotalCharge ?? 0),
            grandTotalPaymentReceived: Number(response.grandTotalPaymentReceived ?? 0),
          });
          this.expanded.set(false);
        },
        error: (error) => {
          const message = error?.error?.message || error?.error || error?.message || 'Unable to load CPT Charge vs Payment report.';
          this.errorMessage.set(message);
          this.report.set(null);
        },
      });
  }

  loadDetailOnly(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.http
      .post<CptChargePaymentDetailDTO[]>(this.detailUrl, this.buildRequest())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => {
          this.report.set({
            detailRows: rows ?? [],
            summaryRows: this.report()?.summaryRows ?? [],
            grandTotalCharge: this.report()?.grandTotalCharge ?? 0,
            grandTotalPaymentReceived: this.report()?.grandTotalPaymentReceived ?? 0,
          });
        },
        error: (error) => {
          const message = error?.error?.message || error?.error || error?.message || 'Unable to load CPT detail report.';
          this.errorMessage.set(message);
        },
      });
  }

  loadSummaryOnly(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.http
      .post<CptChargePaymentSummaryDTO[]>(this.summaryUrl, this.buildRequest())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => {
          const grandTotal = rows?.find((row) => row.grandTotal || (row.rowLabel ?? '').trim().toUpperCase() === 'GRAND TOTAL');
          this.report.set({
            detailRows: this.report()?.detailRows ?? [],
            summaryRows: rows ?? [],
            grandTotalCharge: Number(grandTotal?.chargeValue ?? 0),
            grandTotalPaymentReceived: Number(grandTotal?.paymentReceived ?? 0),
          });
        },
        error: (error) => {
          const message = error?.error?.message || error?.error || error?.message || 'Unable to load CPT summary report.';
          this.errorMessage.set(message);
        },
      });
  }

  resetFilters(): void {
    this.buildMonthOptions();
    this.filterForm.reset({
      licenseKey: this.licenseKey ?? 160088,
      reportMonth: '',
      fromDate: this.getDefaultFromDate(),
      toDate: this.getToday(),
      topCptCount: '',
      selectedClient: 'SALEM',
      appType: 'AMD',
    }, { emitEvent: false });

    this.setDefaultMonth();
    this.errorMessage.set('');
    this.report.set(null);
    this.expanded.set(false);
    this.loadReport();
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  onMonthChange(): void {
    if (this.syncingFilters) {
      return;
    }

    const monthValue = this.filterForm.get('reportMonth')?.value;
    if (!monthValue) {
      return;
    }

    this.syncingFilters = true;
    this.applyMonthToDates(monthValue);
    this.syncingFilters = false;
    this.loadReport();
  }

  onDateRangeChange(): void {
    if (this.syncingFilters) {
      return;
    }

    const fromDate = this.filterForm.get('fromDate')?.value;
    const toDate = this.filterForm.get('toDate')?.value;

    this.syncingFilters = true;
    this.filterForm.patchValue({ reportMonth: '' }, { emitEvent: false });
    this.syncingFilters = false;

    if (fromDate && toDate) {
      this.loadReport();
    }
  }

  onTopCptChange(): void {
    // UI-only filtering of the currently loaded result set.
  }

  filteredSummaryRows(): CptChargePaymentSummaryDTO[] {
    const rows = this.summaryRows();
    const topN = this.selectedTopCptCount();
    if (!topN || topN <= 0) {
      return rows;
    }
    return rows.slice(0, topN);
  }

  filteredGrandTotalRow(): CptChargePaymentSummaryDTO {
    const rows = this.filteredSummaryRows();
    return {
      rowLabel: 'Grand Total',
      chargeValue: rows.reduce((sum, row) => sum + Number(row.chargeValue ?? 0), 0),
      paymentReceived: rows.reduce((sum, row) => sum + Number(row.paymentReceived ?? 0), 0),
      grandTotal: true,
    };
  }

  filteredDetailRows(): CptChargePaymentDetailDTO[] {
    const rows = this.detailRows();
    const cptSet = this.selectedCptSet();
    if (!cptSet) {
      return rows;
    }
    return rows.filter((row) => cptSet.has((row.cptCode ?? '').trim()));
  }

  filteredTotalCharge(): number {
    return this.filteredSummaryRows().reduce((sum, row) => sum + Number(row.chargeValue ?? 0), 0);
  }

  filteredTotalPayment(): number {
    return this.filteredSummaryRows().reduce((sum, row) => sum + Number(row.paymentReceived ?? 0), 0);
  }

  filteredTotalVariance(): number {
    return this.filteredTotalCharge() - this.filteredTotalPayment();
  }

  trackSummary(_: number, row: CptChargePaymentSummaryDTO): string {
    return `${row.rowLabel ?? ''}`;
  }

  trackDetail(_: number, row: CptChargePaymentDetailDTO): string {
    return `${row.chargeDetailUid ?? ''}-${row.cptCode ?? ''}-${row.dosDate ?? ''}`;
  }

  private buildRequest(): CptChargePaymentReportRequest {
    const raw = this.filterForm.getRawValue();
    return {
      licenseKey: raw.licenseKey,
      fromDate: raw.fromDate,
      toDate: raw.toDate,
      selectedClient: raw.selectedClient || 'SALEM',
      appType: raw.appType || 'AMD',
    };
  }

  private buildMonthOptions(): void {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    this.monthOptions = [];
    for (let month = currentMonth; month >= 0; month--) {
      const dt = new Date(currentYear, month, 1);
      this.monthOptions.push({
        label: dt.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        value: `${currentYear}-${String(month + 1).padStart(2, '0')}`,
      });
    }
  }

  private setDefaultMonth(): void {
    if (!this.monthOptions.length) {
      return;
    }

    const defaultMonth = this.monthOptions[0].value;
    this.syncingFilters = true;
    this.filterForm.patchValue({
      reportMonth: defaultMonth,
      topCptCount: '',
    }, { emitEvent: false });
    this.applyMonthToDates(defaultMonth);
    this.syncingFilters = false;
  }

  private applyMonthToDates(monthValue: string): void {
    const [yearStr, monthStr] = monthValue.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

    const fromDate = new Date(year, monthIndex, 1);
    const toDate = isCurrentMonth ? today : new Date(year, monthIndex + 1, 0);

    this.filterForm.patchValue({
      fromDate: this.formatDateForInput(fromDate),
      toDate: this.formatDateForInput(toDate),
    }, { emitEvent: false });
  }

  private selectedTopCptCount(): number | null {
    const raw = this.filterForm.get('topCptCount')?.value;
    if (raw === '' || raw === null || raw === undefined) {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private selectedCptSet(): Set<string> | null {
    const topN = this.selectedTopCptCount();
    if (!topN || topN <= 0) {
      return null;
    }

    return new Set(
      this.filteredSummaryRows()
        .map((row) => (row.rowLabel ?? '').trim())
        .filter((rowLabel) => !!rowLabel)
    );
  }

  private getStoredValue(key: string, fallback: string): string {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  private getToday(): string {
    return this.formatDateForInput(new Date());
  }

  private getDefaultFromDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
