import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface LiquidationRateSummary {
  cohortCount: number;
  rowCount: number;
  totalCharges: number;
  totalLiquidated: number;
  endingBalance: number;
}

interface LiquidationRateReportRow {
  cohortMonth: string | null;
  monthLabel: string | null;
  charges: number;
  paymentMonth: string | null;
  paymentMonthLabel: string | null;
  insPayment: number;
  insAdjust: number;
  patientPayment: number;
  liquidatedAmount: number;
  balance: number;
  liquidationBucket: string;
  liquidationPct: number;
}

interface LiquidationRateReportResponse {
  summary: LiquidationRateSummary;
  rows: LiquidationRateReportRow[];
}

@Component({
  selector: 'app-liquidation-rate-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liquidation-rate-report.component.html',
  styleUrls: ['./liquidation-rate-report.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidationRateReportComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly apiUrl = '/api/reports/liquidation-rate';

  @Input() licenseKey = 160088;

  selectedClient = localStorage.getItem('selectedClient') || 'SALEM';
  appType = this.selectedClient?.toUpperCase() === 'PALMERI' ? 'EDI' : 'AMD';

  monthBasis: 'DOE' | 'DOS' = 'DOE';
  maxLagMonths = 3;

  fromMonth = this.getDefaultFromMonth();
  toMonth = this.getDefaultToMonth();

  expanded = true;
  loading = false;
  errorMessage = '';

  summary: LiquidationRateSummary = this.emptySummary();
  rows: LiquidationRateReportRow[] = [];

  ngOnInit(): void {
    setTimeout(() => this.loadReport());
  }

  loadReport(): void {
    this.loading = true;
    this.errorMessage = '';
    this.rows = [];
    this.summary = this.emptySummary();
    this.cdr.markForCheck();

    const payload = {
      licenseKey: this.licenseKey,
      selectedClient: this.selectedClient,
      appType: this.appType,
      fromMonth: this.normalizeMonthValue(this.fromMonth),
      toMonth: this.normalizeMonthValue(this.toMonth),
      monthBasis: this.monthBasis,
      maxLagMonths: this.maxLagMonths,
    };

    this.http.post<LiquidationRateReportResponse>(this.apiUrl, payload).subscribe({
      next: (response) => {
        this.summary = response?.summary || this.emptySummary();
        this.rows = [...(response?.rows || [])];
        this.loading = false;
        this.errorMessage = '';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load liquidation rate report.';
        this.rows = [];
        this.summary = this.emptySummary();
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  resetFilters(): void {
    this.selectedClient = localStorage.getItem('selectedClient') || 'SALEM';
    this.appType = this.selectedClient?.toUpperCase() === 'PALMERI' ? 'EDI' : 'AMD';
    this.monthBasis = 'DOE';
    this.maxLagMonths = 3;
    this.fromMonth = this.getDefaultFromMonth();
    this.toMonth = this.getDefaultToMonth();
    this.loadReport();
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.cdr.markForCheck();
  }

  onSelectedClientChange(): void {
    this.appType = this.selectedClient?.toUpperCase() === 'PALMERI' ? 'EDI' : 'AMD';
    this.cdr.markForCheck();
  }

  isFirstRowOfCohort(index: number): boolean {
    if (index === 0) {
      return true;
    }
    return this.rows[index - 1]?.monthLabel !== this.rows[index]?.monthLabel;
  }

  trackRow(index: number, row: LiquidationRateReportRow): string {
    return `${row.monthLabel || 'NA'}-${row.liquidationBucket || 'NA'}-${row.paymentMonthLabel || 'NA'}-${index}`;
  }

  private emptySummary(): LiquidationRateSummary {
    return {
      cohortCount: 0,
      rowCount: 0,
      totalCharges: 0,
      totalLiquidated: 0,
      endingBalance: 0,
    };
  }

  private normalizeMonthValue(value: string): string {
    return value ? `${value}-01` : '';
  }

  private getDefaultFromMonth(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    return this.toMonthInputValue(date);
  }

  private getDefaultToMonth(): string {
    return this.toMonthInputValue(new Date());
  }

  private toMonthInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }
}