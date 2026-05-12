import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

interface MonthOption {
  key: string;
  label: string;
  fromDate: string;
  toDate: string;
}

interface CleanClaimSummaryRow {
  month: string;
  eligibleFirstAttemptSubmittedClaims: number;
  clearinghouseRejectedClaims: number;
  firstPassClaims: number;
  paidFirstAttemptClaims: number;
  cleanClaims: number;
  submittedCharges: number;
  rejectedCharges: number;
  firstPassCharges: number;
  paidFirstAttemptCharges: number;
  cleanClaimCharges: number;
firstPassRatePercent: number;
cleanClaimRatePercent: number;
}

interface CleanClaimDetailRow {
  month: string;
  chargeEntryDate: string | null;
  firstSubmittedDateTime: string | null;
  firstPaidDateTime: string | null;
  visitFID: number | string;
  claimId: string | null;
  claimSuffix: string | null;
  carrierFID: number | string | null;
  carrierName: string | null;
  cnsCarrierChargeMode: string | null;
  firstAttemptStatus: string | null;
  charges: number;
  isClearinghouseRejected: number | boolean;
  isFirstPass: number | boolean;
  isPaidOnFirstAttempt: number | boolean;
  preSubmissionEditCount: number;
  firstEditDateTime: string | null;
  editMessages: string | null;
  isCleanClaim: number | boolean;
  cleanClaimAmount: number;
}

interface SummaryTotals {
  eligibleFirstAttemptSubmittedClaims: number;
  clearinghouseRejectedClaims: number;
  firstPassClaims: number;
  paidFirstAttemptClaims: number;
  cleanClaims: number;
  submittedCharges: number;
  cleanClaimCharges: number;
  firstPassRatePct: number;
  cleanClaimRatePct: number;
}

interface CleanClaimReportRequestPayload {
  licenseKey: number;
  selectedClient: string;
  startDate: string;
  endDate: string;
  monthKey: string | null;
}

@Component({
  selector: 'app-clean-claim-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clean-claim-report.component.html',
  styleUrls: ['./clean-claim-report.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CleanClaimReportComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly summaryUrl = '/api/reports/clean-claim/summary';
  protected readonly detailUrl = '/api/reports/clean-claim/detail';
  protected readonly selectedClient = localStorage.getItem('selectedClient') ?? 'SALEM';

  @Input() licenseKey = 160088;

  protected readonly monthOptions: MonthOption[] = this.buildMonthOptions();

  protected readonly filterForm = this.fb.group({
    monthKey: [''],
    fromDate: [''],
    toDate: [''],
  });

  protected reportExpanded = true;
  protected detailExpanded = false;
  protected loadingSummary = false;
  protected loadingDetail = false;
  protected errorMessage = '';

  protected summaryRows: CleanClaimSummaryRow[] = [];
  protected detailRows: CleanClaimDetailRow[] = [];
  protected filteredDetailRows: CleanClaimDetailRow[] = [];

  private lastSummaryRequestKey = '';
  private lastDetailRequestKey = '';
  private summaryRequestCounter = 0;
  private detailRequestCounter = 0;

  protected totals: SummaryTotals = {
    eligibleFirstAttemptSubmittedClaims: 0,
    clearinghouseRejectedClaims: 0,
    firstPassClaims: 0,
    paidFirstAttemptClaims: 0,
    cleanClaims: 0,
    submittedCharges: 0,
    cleanClaimCharges: 0,
    firstPassRatePct: 0,
    cleanClaimRatePct: 0,
  };

  constructor() {
    const defaultMonth = this.monthOptions[0];
    if (defaultMonth) {
      this.filterForm.patchValue(
        {
          monthKey: defaultMonth.key,
          fromDate: defaultMonth.fromDate,
          toDate: defaultMonth.toDate,
        },
        { emitEvent: false },
      );
    }
  }

  protected get loading(): boolean {
    return this.loadingSummary || this.loadingDetail;
  }

  protected get canLoadDetail(): boolean {
    const fromDate = this.filterForm.controls.fromDate.value ?? '';
    const toDate = this.filterForm.controls.toDate.value ?? '';
    return this.isRangeWithinMonths(fromDate, toDate, 6);
  }

  protected toggleReportExpanded(): void {
    this.reportExpanded = !this.reportExpanded;
    this.cdr.markForCheck();
  }

  protected onMonthChange(): void {
    const monthKey = this.filterForm.controls.monthKey.value ?? '';
    if (!monthKey) {
      return;
    }

    const selectedOption = this.monthOptions.find((option) => option.key === monthKey);
    if (!selectedOption) {
      return;
    }

    this.filterForm.patchValue(
      {
        fromDate: selectedOption.fromDate,
        toDate: selectedOption.toDate,
      },
      { emitEvent: false },
    );

    this.clearDetailState();
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  protected onDateRangeChange(): void {
    const fromDate = this.filterForm.controls.fromDate.value ?? '';
    const toDate = this.filterForm.controls.toDate.value ?? '';

    if (!fromDate || !toDate) {
      return;
    }

    this.filterForm.patchValue({ monthKey: '' }, { emitEvent: false });
    this.clearDetailState();
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  protected resetFilters(): void {
    const defaultMonth = this.monthOptions[0];

    this.filterForm.reset(
      {
        monthKey: defaultMonth?.key ?? '',
        fromDate: defaultMonth?.fromDate ?? '',
        toDate: defaultMonth?.toDate ?? '',
      },
      { emitEvent: false },
    );

    this.errorMessage = '';
    this.summaryRows = [];
    this.recalculateTotals();
    this.lastSummaryRequestKey = '';
    this.clearDetailState();
    this.cdr.markForCheck();
  }

  protected loadReport(): void {
    const requestBody = this.buildRequestBody();
    if (!requestBody) {
      this.errorMessage = 'Please select both From and To dates.';
      this.summaryRows = [];
      this.recalculateTotals();
      this.clearDetailState();
      this.cdr.markForCheck();
      return;
    }

    if (!this.isRangeWithinMonths(requestBody.startDate, requestBody.endDate, 6)) {
      this.errorMessage = 'Please select a summary date range of 6 months or less.';
      this.summaryRows = [];
      this.recalculateTotals();
      this.clearDetailState();
      this.cdr.markForCheck();
      return;
    }

    const requestKey = this.buildRequestKey();
    const requestId = ++this.summaryRequestCounter;

    this.loadingSummary = true;
    this.errorMessage = '';
    this.lastSummaryRequestKey = requestKey;
    this.clearDetailState();
    this.cdr.markForCheck();

    this.http.post<CleanClaimSummaryRow[]>(this.summaryUrl, requestBody).subscribe({
      next: (rows) => {
        if (requestId !== this.summaryRequestCounter) {
          return;
        }
        this.summaryRows = rows ?? [];
        this.recalculateTotals();
        this.loadingSummary = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (requestId !== this.summaryRequestCounter) {
          return;
        }
        console.error('Failed to load clean claim summary', error);
        this.summaryRows = [];
        this.recalculateTotals();
        this.errorMessage =
          error?.error?.message || 'Unable to load the Clean Claim summary.';
        this.loadingSummary = false;
        this.cdr.markForCheck();
      },
    });
  }

  protected onDetailButtonClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.detailExpanded) {
      this.detailExpanded = false;
      this.errorMessage = '';
      this.cdr.markForCheck();
      return;
    }

    if (!this.summaryRows.length) {
      this.errorMessage = 'Run the report first to view claim-level details.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.canLoadDetail) {
      this.errorMessage = 'Detailed Claims can be viewed only for a date range of 6 months or less.';
      this.detailExpanded = false;
      this.cdr.markForCheck();
      return;
    }

    const currentSummaryKey = this.buildRequestKey();
    if (this.lastSummaryRequestKey !== currentSummaryKey) {
      this.errorMessage = 'Click Load Report to refresh summary for the selected filter before expanding details.';
      this.detailExpanded = false;
      this.cdr.markForCheck();
      return;
    }

    this.detailExpanded = true;
    this.errorMessage = '';

    if (this.lastDetailRequestKey !== currentSummaryKey) {
      this.loadDetail();
    } else {
      this.cdr.markForCheck();
    }
  }

  private loadDetail(): void {
    const requestBody = this.buildRequestBody();
    if (!requestBody || !this.summaryRows.length) {
      return;
    }

    if (!this.isRangeWithinMonths(requestBody.startDate, requestBody.endDate, 6)) {
      this.errorMessage = 'Detailed Claims can be viewed only for a date range of 6 months or less.';
      this.detailExpanded = false;
      this.loadingDetail = false;
      this.cdr.markForCheck();
      return;
    }

    const requestKey = this.buildRequestKey();
    const requestId = ++this.detailRequestCounter;

    this.loadingDetail = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.http.post<CleanClaimDetailRow[]>(this.detailUrl, requestBody).subscribe({
      next: (rows) => {
        if (requestId !== this.detailRequestCounter) {
          return;
        }
        this.detailRows = rows ?? [];
        this.filteredDetailRows = [...this.detailRows];
        this.lastDetailRequestKey = requestKey;
        this.loadingDetail = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (requestId !== this.detailRequestCounter) {
          return;
        }
        console.error('Failed to load clean claim detail', error);
        this.detailRows = [];
        this.filteredDetailRows = [];
        this.detailExpanded = false;
        this.errorMessage =
          error?.error?.message || 'Unable to load the Clean Claim detail.';
        this.loadingDetail = false;
        this.cdr.markForCheck();
      },
    });
  }

  private clearDetailState(): void {
    this.detailExpanded = false;
    this.detailRows = [];
    this.filteredDetailRows = [];
    this.lastDetailRequestKey = '';
    this.loadingDetail = false;
  }

  private buildRequestBody(): CleanClaimReportRequestPayload | null {
    const fromDate = this.filterForm.controls.fromDate.value ?? '';
    const toDate = this.filterForm.controls.toDate.value ?? '';

    if (!fromDate || !toDate) {
      return null;
    }

    return {
      licenseKey: this.licenseKey,
      selectedClient: this.selectedClient,
      startDate: fromDate,
      endDate: toDate,
      monthKey: this.filterForm.controls.monthKey.value || null,
    };
  }

  private buildRequestKey(): string {
    const monthKey = this.filterForm.controls.monthKey.value ?? '';
    const fromDate = this.filterForm.controls.fromDate.value ?? '';
    const toDate = this.filterForm.controls.toDate.value ?? '';
    return `${this.licenseKey}|${this.selectedClient}|${monthKey}|${fromDate}|${toDate}`;
  }

  private isRangeWithinMonths(fromDate: string, toDate: string, maxMonths: number): boolean {
    if (!fromDate || !toDate) {
      return false;
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return false;
    }

    const months =
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth()) + 1;

    return months <= maxMonths;
  }

  protected trackSummary(index: number, row: CleanClaimSummaryRow): string {
    return `${index}-${row.month}`;
  }

  protected trackDetail(index: number, row: CleanClaimDetailRow): string {
    return `${index}-${row.visitFID}-${row.claimId ?? ''}`;
  }

  protected formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
  }

  protected formatPercent(value: number | null | undefined): string {
    return `${Number(value ?? 0).toFixed(2)}%`;
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleDateString('en-US');
  }

  protected formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleString('en-US');
  }

  protected toBoolean(value: number | boolean | null | undefined): boolean {
    return value === true || value === 1;
  }

  protected get detailPlaceholderText(): string {
    if (this.loadingDetail) {
      return 'Loading claim-level rows...';
    }

    if (!this.summaryRows.length) {
      return 'Run the report to view claim-level rows.';
    }

    if (!this.detailExpanded) {
      return 'Click Expand Details to view the claim-level rows.';
    }

    if (!this.filteredDetailRows.length) {
      return 'No claim-level rows found for the selected filter.';
    }

    return '';
  }

  private recalculateTotals(): void {
    const totals = this.summaryRows.reduce<SummaryTotals>(
      (acc, row) => {
        acc.eligibleFirstAttemptSubmittedClaims += Number(row.eligibleFirstAttemptSubmittedClaims ?? 0);
        acc.clearinghouseRejectedClaims += Number(row.clearinghouseRejectedClaims ?? 0);
        acc.firstPassClaims += Number(row.firstPassClaims ?? 0);
        acc.paidFirstAttemptClaims += Number(row.paidFirstAttemptClaims ?? 0);
        acc.cleanClaims += Number(row.cleanClaims ?? 0);
        acc.submittedCharges += Number(row.submittedCharges ?? 0);
        acc.cleanClaimCharges += Number(row.cleanClaimCharges ?? 0);
        return acc;
      },
      {
        eligibleFirstAttemptSubmittedClaims: 0,
        clearinghouseRejectedClaims: 0,
        firstPassClaims: 0,
        paidFirstAttemptClaims: 0,
        cleanClaims: 0,
        submittedCharges: 0,
        cleanClaimCharges: 0,
        firstPassRatePct: 0,
        cleanClaimRatePct: 0,
      },
    );

    totals.firstPassRatePct = totals.eligibleFirstAttemptSubmittedClaims
      ? (totals.firstPassClaims / totals.eligibleFirstAttemptSubmittedClaims) * 100
      : 0;

    totals.cleanClaimRatePct = totals.firstPassClaims
      ? (totals.cleanClaims / totals.firstPassClaims) * 100
      : 0;

    this.totals = totals;
  }

  private buildMonthOptions(): MonthOption[] {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const usedKeys = new Set<string>();
    const options: MonthOption[] = [];

    const pushMonth = (year: number, monthIndex: number): void => {
      if (monthIndex < 0) {
        year -= 1;
        monthIndex = 11;
      }

      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      if (usedKeys.has(key)) {
        return;
      }

      usedKeys.add(key);

      const fromDate = new Date(year, monthIndex, 1);
      const toDate = new Date(year, monthIndex + 1, 0);

      options.push({
        key,
        label: fromDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        fromDate: this.toIsoDate(fromDate),
        toDate: this.toIsoDate(toDate),
      });
    };

    pushMonth(currentYear, currentMonthIndex);
    pushMonth(currentYear, currentMonthIndex - 1);

    for (let monthIndex = currentMonthIndex; monthIndex >= 0; monthIndex -= 1) {
      pushMonth(currentYear, monthIndex);
    }

    return options;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
