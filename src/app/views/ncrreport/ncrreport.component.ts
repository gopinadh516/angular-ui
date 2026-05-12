import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';

import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { MgmtNcrService, MgmtNcrRow } from './mgmt-ncr.service';

export type NcrChartOptions = {
  colors: string[];          // ✅ NOT optional
  legend: ApexLegend;        // ✅ NOT optional
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  grid: ApexGrid;
};

@Component({
  selector: 'app-ncrreport',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './ncrreport.component.html',
  styleUrls: ['./ncrreport.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NcrreportComponent implements OnInit, OnChanges {
  @Input() licenseKey = 160088;
  @Input() showChart = true;

  isLoading = false;
  error: string | null = null;

  rows: MgmtNcrRow[] = [];

  totals = {
    visits: 0,
    charges: 0,
    insPay: 0,
    insAdj: 0,
    patPay: 0,
    totalPay: 0,
    gcrPct: 0, // 0–100
    ncrPct: 0, // 0–100
  };

  chartOptions: NcrChartOptions | null = null;

  constructor(
    private ncrService: MgmtNcrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['licenseKey'] && !changes['licenseKey'].firstChange) {
      this.load();
    }
    if (changes['showChart'] && !changes['showChart'].firstChange) {
      this.buildChart();
      this.cdr.markForCheck();
    }
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.ncrService.getNcrReport(this.licenseKey).subscribe({
      next: (data) => {
        this.rows = Array.isArray(data) ? data : [];
        this.computeTotals();
        this.buildChart();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.error =
          err?.error?.message || err?.message || 'Failed to load NCR GCR report by DOS.';
        this.rows = [];
        this.chartOptions = null;
        this.cdr.markForCheck();
      },
    });
  }

monthLabel(row: MgmtNcrRow): string {
  const d = new Date(`${row.monthStart}T00:00:00`);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const yr = d.getFullYear();
  return `${mon}-${yr}`;
}
  /** Convert backend value to display percent (0–100).
   *  If value looks like ratio (<= 1.5) → multiply by 100.
   *  If already percent (e.g., 95.2) → keep as-is.
   */
  asPercent(v: unknown): number {
    const n = Number(v);
    if (!isFinite(n)) return 0;
    return n <= 1.5 ? n * 100 : n;
  }

  private computeTotals(): void {
    const sum = (fn: (r: MgmtNcrRow) => number) =>
      this.rows.reduce((a, r) => a + (Number(fn(r)) || 0), 0);

    const visits = sum((r) => r.visits);
    const charges = sum((r) => r.charges);
    const insPay = sum((r) => r.totalInsurancePayments);
    const insAdj = sum((r) => r.totalInsuranceAdjustments);
    const patPay = sum((r) => r.totalPatientPayments);
    const totalPay = sum((r) => r.totalPayments);

    // Overall rates must be based on totals (not average of monthly %)
    const gcrDen = charges;
    const ncrDen = charges - insAdj;

    const gcrPct = gcrDen !== 0 ? (totalPay / gcrDen) * 100 : 0;
    const ncrPct = ncrDen !== 0 ? (totalPay / ncrDen) * 100 : 0;

    this.totals = { visits, charges, insPay, insAdj, patPay, totalPay, gcrPct, ncrPct };
  }

  private buildChart(): void {
    if (!this.showChart || !this.rows?.length) {
      this.chartOptions = null;
      return;
    }

    const categories = this.rows.map((r) => this.monthLabel(r));
    const gcr = this.rows.map((r) => this.asPercent(r.gcrPercent));
    const ncr = this.rows.map((r) => this.asPercent(r.ncrPercent));

    const maxVal = Math.max(100, ...gcr, ...ncr);
    const maxY = Math.ceil(maxVal / 10) * 10;

    this.chartOptions = {
      colors: ['#2563EB', '#F97316'], // GCR, NCR
      legend: {
        show: true,
        position: 'bottom',
        horizontalAlign: 'center',
      },
      series: [
        { name: 'GCR%', data: gcr },
        { name: 'NCR%', data: ncr },
      ],
      chart: {
        type: 'bar',
        height: 400,
        toolbar: { show: false },
        animations: { enabled: true },
      },
      plotOptions: {
        bar: {
          columnWidth: '65%',
          borderRadius: 2,
          distributed: false,
        },
      },
      grid: {
        padding: { left: 0, right: 0 },
      },
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        tickPlacement: 'between',
        labels: {
          rotate: -65,
          rotateAlways: true,
          trim: true,
          hideOverlappingLabels: true,
          style: { fontSize: '11px' },
        },
      },
      yaxis: {
        min: 0,
        max: maxY,
        tickAmount: 5,
        labels: {
          formatter: (v: number) => `${Number(v).toFixed(0)}%`,
        },
      },
      tooltip: {
        y: {
          formatter: (v: number | string) => `${Number(v).toFixed(2)}%`,
        },
      },
    };
  }
}