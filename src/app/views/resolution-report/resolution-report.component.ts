import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import {
  ResolutionReportDashboardResponse,
  ResolutionReportDetailRow,
  ResolutionReportRequest,
  ResolutionReportSummaryRow
} from './resolution-report.model';
import { ResolutionReportService } from './resolution-report.service';

@Component({
  selector: 'app-resolution-report',
  standalone: true,
  imports: [CommonModule,FormsModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './resolution-report.component.html',
  styleUrls: ['./resolution-report.component.scss']
})
export class ResolutionReportComponent implements OnInit {
  filterForm!: FormGroup;

  summaryRows: ResolutionReportSummaryRow[] = [];
  detailRows: ResolutionReportDetailRow[] = [];

  selectedUser = 'ALL';
  searchText = '';
  loading = false;
  errorMessage = '';
  showDetails = true;

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ResolutionReportService
  ) {}

  ngOnInit(): void {
    const range = this.getPreviousQuarterRange();

    this.filterForm = this.fb.group({
      licenseKey: [160088, [Validators.required, Validators.min(1)]],
      fromDate: [range.fromDate, Validators.required],
      toDate: [range.toDate, Validators.required],
      claimId: [''],
      visitFid: [''],
      appType: ['AMD']
    });

    this.loadReport();
  }

  loadReport(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const request = this.buildRequest();
    if (request.fromDate > request.toDate) {
      this.errorMessage = 'From Date cannot be greater than To Date.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.reportService.getDashboard(request)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: ResolutionReportDashboardResponse) => {
          this.summaryRows = response?.summary || [];
          this.detailRows = response?.details || [];
          this.selectedUser = 'ALL';
          this.searchText = '';
        },
        error: (error) => {
          console.error('Resolution report load failed', error);
          this.summaryRows = [];
          this.detailRows = [];
          this.errorMessage = 'Unable to load the resolution report. Please check the filters and try again.';
        }
      });
  }

  resetFilters(): void {
    const range = this.getPreviousQuarterRange();
    this.filterForm.reset({
      licenseKey: 160088,
      fromDate: range.fromDate,
      toDate: range.toDate,
      claimId: '',
      visitFid: '',
      appType: 'AMD'
    });
    this.selectedUser = 'ALL';
    this.searchText = '';
    this.loadReport();
  }

  selectUser(userName: string): void {
    this.selectedUser = userName || 'ALL';
  }

  clearUserFilter(): void {
    this.selectedUser = 'ALL';
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  exportDetailsCsv(): void {
    const rows = this.filteredDetails;
    if (!rows.length) {
      return;
    }

    const headers = [
      'User Name',
      'User Login',
      'Visit ID',
      'Claim ID',
      'Claim Suffix',
      'Carrier',
      'Patient',
      'First DOS',
      'Last DOS',
      'Touch #',
      'Touch Date Time',
      'Next Touch Date Time',
      'Days In Window',
      'Touch Action',
      'Worked AR Base',
      'Resolved $',
      'Payments Posted',
      'Insurance Writeoffs',
      'Pending AR At Next Touch',
      'Touch Note'
    ];

    const body = rows.map((row) => [
      row.userName,
      row.userLogin,
      row.visitId,
      row.claimId,
      row.claimSuffix,
      row.carrierCode,
      row.patientName,
      row.firstDos,
      row.lastDos,
      row.touchNumber,
      row.touchDateTime,
      row.nextTouchDateTime,
      row.daysInWindow,
      row.touchAction,
      this.numberValue(row.workedArBase),
      this.numberValue(row.resolvedDollars),
      this.numberValue(row.paymentsPosted),
      this.numberValue(row.insuranceWriteoffs),
      this.numberValue(row.pendingArAtNextTouch),
      row.touchNote
    ]);

    const csv = [headers, ...body]
      .map((line) => line.map((value) => this.csvValue(value)).join(','))
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resolution-report-${this.filterForm.value.fromDate}-to-${this.filterForm.value.toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  get userOptions(): string[] {
    return this.summaryRows
      .map((row) => row.userName)
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b));
  }

  get filteredDetails(): ResolutionReportDetailRow[] {
    const search = this.searchText.trim().toLowerCase();

    return this.detailRows.filter((row) => {
      const userMatches = this.selectedUser === 'ALL' || row.userName === this.selectedUser;
      if (!userMatches) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        row.userName,
        row.userLogin,
        row.visitId,
        row.claimId,
        row.claimSuffix,
        row.carrierCode,
        row.patientName,
        row.touchAction,
        row.touchNote
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }

  get totalWorkedAr(): number {
    return this.summaryRows.reduce((sum, row) => sum + this.numberValue(row.workedArDollars), 0);
  }

  get totalResolved(): number {
    return this.summaryRows.reduce((sum, row) => sum + this.numberValue(row.resolvedDollars), 0);
  }

  get totalPayments(): number {
    return this.summaryRows.reduce((sum, row) => sum + this.numberValue(row.paymentsPosted), 0);
  }

  get totalTouches(): number {
    return this.summaryRows.reduce((sum, row) => sum + this.numberValue(row.touchCount), 0);
  }

  get selectedUserLabel(): string {
    return this.selectedUser === 'ALL' ? 'All users' : this.selectedUser;
  }

  trackByUserName(_: number, row: ResolutionReportSummaryRow): string {
    return row.userName;
  }

  trackByDetail(_: number, row: ResolutionReportDetailRow): string {
    return `${row.visitId}-${row.touchNumber}-${row.touchDateTime || ''}-${row.userLogin || ''}`;
  }

  private buildRequest(): ResolutionReportRequest {
    const raw = this.filterForm.getRawValue();
    const visitFidText = String(raw.visitFid || '').trim();

    return {
      licenseKey: Number(raw.licenseKey || 160088),
      fromDate: raw.fromDate,
      toDate: raw.toDate,
      claimId: String(raw.claimId || '').trim() || null,
      visitFid: visitFidText ? Number(visitFidText) : null,
      appType: raw.appType || 'AMD'
    };
  }

  private getPreviousQuarterRange(): { fromDate: string; toDate: string } {
    const today = new Date();
    const currentQuarter = Math.floor(today.getMonth() / 3);
    const previousQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const year = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();

    const startMonth = previousQuarter * 3;
    const from = new Date(year, startMonth, 1);
    const to = new Date(year, startMonth + 3, 0);

    return {
      fromDate: this.toInputDate(from),
      toDate: this.toInputDate(to)
    };
  }

  private toInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private csvValue(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  private numberValue(value: unknown): number {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  }
}
