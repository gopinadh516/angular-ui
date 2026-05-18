import { CommonModule } from '@angular/common';
import { MgmtNcrService, MgmtNcrRow } from '../ncrreport/mgmt-ncr.service';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';

import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { MgmtNcrByDoeService, MgmtNcrByDoeRow } from './mgmt-ncr-by-doe.service';

export type NcrByDoeChartOptions = {
  colors: string[];
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
  selector: 'app-ncrreport-by-doe',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './ncrreport-by-doe.component.html',
  styleUrls: ['./ncrreport-by-doe.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NcrreportByDoeComponent implements OnInit, OnChanges {
  @Input() licenseKey = 160088;
  @Input() showChart = true;

  isLoading = false;
  error: string | null = null;

  rows: MgmtNcrByDoeRow[] = [];

  totals = {
    visits: 0,
    charges: 0,
    insPay: 0,
    insAdj: 0,
    patPay: 0,
    totalPay: 0,
    gcrPct: 0,
    ncrPct: 0,
  };

  chartOptions: NcrByDoeChartOptions | null = null;

  constructor(private svc: MgmtNcrByDoeService, private cdr: ChangeDetectorRef) {}

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

  this.svc.getReport(this.licenseKey).subscribe({
    next: (data) => {
      const raw = Array.isArray(data) ? data : [];

      // ✅ normalize/override % from the real amounts (same as SQL formulas)
      this.rows = raw.map((r) => {
        const row: MgmtNcrByDoeRow = { ...r };

        row.gcrPercent = this.calcGcrPercent(row);
        row.ncrPercent = this.calcNcrPercent(row);

        return row;
      });

      this.computeTotals();
      this.buildChart();
      this.isLoading = false;
      this.cdr.markForCheck();
    },
    error: (err) => {
      this.isLoading = false;
      this.error =
        err?.error?.message ||
        err?.message ||
        'Failed to load NCR (Date of Entry) report.';
      this.rows = [];
      this.chartOptions = null;
      this.cdr.markForCheck();
    },
  });
}

// ✅ GCR% = 100 * TotalPayments / Charges
private calcGcrPercent(r: MgmtNcrByDoeRow): number {
  const charges = Number(r.charges) || 0;

  // prefer totalPayments; else derive from ins+pat
  const totalPayments =
    (Number(r.totalPayments) || 0) ||
    ((Number(r.totalInsurancePayments) || 0) + (Number(r.totalPatientPayments) || 0));

  if (charges === 0) return 0;
  return Math.round(((100.0 * totalPayments) / charges) * 10) / 10; // 1 decimal
}

// ✅ NCR% = 100 * TotalPayments / (Charges - InsuranceAdjustments)
private calcNcrPercent(r: MgmtNcrByDoeRow): number {
  const charges = Number(r.charges) || 0;
  const insAdj = Number(r.totalInsuranceAdjustments) || 0;

  const totalPayments =
    (Number(r.totalPayments) || 0) ||
    ((Number(r.totalInsurancePayments) || 0) + (Number(r.totalPatientPayments) || 0));

  const denom = charges - insAdj;
  if (denom === 0) return 0;
  return Math.round(((100.0 * totalPayments) / denom) * 10) / 10; // 1 decimal
}
monthLabel(row: MgmtNcrByDoeRow): string {
  const s = (row.monthStart || '').trim();
  if (!s) return '';

  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;

  const mon = d.toLocaleString('en-US', { month: 'short' });
  const yr = d.getFullYear();
  return `${mon}-${yr}`;
}

  private computeTotals(): void {
    const sum = (fn: (r: MgmtNcrByDoeRow) => number) =>
      this.rows.reduce((a, r) => a + (Number(fn(r)) || 0), 0);

    const visits = sum((r) => r.visits);
    const charges = sum((r) => r.charges);
    const insPay = sum((r) => r.totalInsurancePayments);
    const insAdj = sum((r) => r.totalInsuranceAdjustments);
    const patPay = sum((r) => r.totalPatientPayments);
    const totalPay = sum((r) => r.totalPayments);

    // Overall GCR/NCR as percentages (percent values, not ratios)
    const gcrPct = charges !== 0 ? (100.0 * totalPay) / charges : 0;
    const denom = charges - insAdj;
    const ncrPct = denom !== 0 ? (100.0 * totalPay) / denom : 0;

    this.totals = {
      visits,
      charges,
      insPay,
      insAdj,
      patPay,
      totalPay,
      gcrPct,
      ncrPct,
    };
  }

private buildChart(): void {
  if (!this.showChart || !this.rows?.length) {
    this.chartOptions = null;
    return;
  }

  const categories = this.rows.map((r) => this.monthLabel(r));

  // ✅ clamp negatives to 0 (no negative bars)
  const gcr = this.rows.map((r) => Math.max(0, Number(r.gcrPercent ?? 0)));
  const ncr = this.rows.map((r) => Math.max(0, Number(r.ncrPercent ?? 0)));

  const maxVal = Math.max(0, ...gcr, ...ncr);
  const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.1) : 100; // fallback

  const fmtPct = (v: number) => `${(Number(v) || 0).toFixed(1)}%`;

  this.chartOptions = {
    colors: ['#6366f1', '#059669'],
    series: [
      { name: 'GCR %', data: gcr },
      { name: 'NCR %', data: ncr },
    ],
    chart: {
      type: 'bar',
      height: 429,
      toolbar: { show: false },
      animations: { enabled: true },
    },
    
    plotOptions: {
      bar: {
        columnWidth: '55%',
        borderRadius: 2,
        distributed: false,
      },
    },
    grid: { padding: { left: 0, right: 0 } },
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
    // ✅ baseline is 0 and no negative scale
    yaxis: {
      min: 0,
      max: yMax,
      tickAmount: 6,
      labels: { formatter: (v: number) => fmtPct(v) },
    },
    tooltip: {
      y: { formatter: (v: number | string) => fmtPct(Number(v)) },
    },
  };
}
}