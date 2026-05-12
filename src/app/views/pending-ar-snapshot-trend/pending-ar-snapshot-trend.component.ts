import {
  Component,
  Input,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

import {
  ButtonDirective
} from '@coreui/angular';

import { ChartjsModule } from '@coreui/angular-chartjs';
import {
  Chart,
  ChartDataset,
  ChartOptions,
  ChartType,
  registerables,
  TooltipLabelStyle
} from 'chart.js';
import { getStyle } from '@coreui/utils';

Chart.register(...registerables);

interface PendingArSnapshotTrendDto {
  snapshotRunId: number;
  companyId: number;
  sourceSystem: string;
  snapshotDate: string;
  status: string;
  runStartedAt: string | null;
  runCompletedAt: string | null;
  rowCount: number;
  insurancePendingAr: number;
  patientPendingAr: number;
  totalPendingAr: number;
}

export interface PendingArChartProps {
  type: ChartType;
  data?: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options?: ChartOptions;
  [key: string]: any;
}

@Component({
  selector: 'app-pending-ar-snapshot-trend',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    ChartjsModule,
    ButtonDirective
  ],
  templateUrl: './pending-ar-snapshot-trend.component.html',
  styleUrls: ['./pending-ar-snapshot-trend.component.scss']
})
export class PendingArSnapshotTrendComponent implements OnInit {
  @Input() companyId = 160088;

  isLoading = false;
  chartReady = false;
  errorMessage = '';

  fromDate = '';
  toDate = '';

  rows: PendingArSnapshotTrendDto[] = [];
  latestRow: PendingArSnapshotTrendDto | null = null;

  chart: PendingArChartProps = {
    type: 'line'
  };

  private loadSequence = 0;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  async loadReport(): Promise<void> {
    const currentLoadSequence = ++this.loadSequence;

    this.isLoading = true;
    this.errorMessage = '';
    this.chartReady = false;

    /*
     * Important:
     * Destroy/reset chart before loading.
     * This prevents CoreUI/Chart.js from rendering inside an unfinished dashboard layout.
     */
    this.chart = {
      type: 'line'
    };

    this.cdr.detectChanges();

    try {
      let params = new HttpParams()
        .set('companyId', String(this.companyId))
        .set('sourceSystem', 'AMD');

      if (this.fromDate) {
        params = params.set('fromDate', this.fromDate);
      }

      if (this.toDate) {
        params = params.set('toDate', this.toDate);
      }

      const url = `${environment.apiBaseUrl}/reports/pending-ar-snapshot-trend/daily`;

      const result = await firstValueFrom(
        this.http.get<PendingArSnapshotTrendDto[]>(url, { params })
      );

      /*
       * If another load started after this one, ignore this older response.
       */
      if (currentLoadSequence !== this.loadSequence) {
        return;
      }

      this.rows = result || [];
      this.latestRow = this.rows.length ? this.rows[this.rows.length - 1] : null;

      this.buildChart();

      /*
       * Let Angular finish DOM/card sizing before creating c-chart.
       * This fixes the slow/blank chart loading issue in dashboard cards.
       */
      setTimeout(() => {
        if (currentLoadSequence !== this.loadSequence) {
          return;
        }

        this.chartReady = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
    } catch (err) {
      if (currentLoadSequence !== this.loadSequence) {
        return;
      }

      console.error('Error loading pending AR snapshot trend:', err);

      this.errorMessage = 'Unable to load Pending AR Snapshot Trend.';
      this.rows = [];
      this.latestRow = null;
      this.chart = {
        type: 'line'
      };
      this.chartReady = false;
      this.isLoading = false;

      this.cdr.detectChanges();
    }
  }

  resetFilters(): void {
    this.fromDate = '';
    this.toDate = '';
    this.loadReport();
  }

  onDateChange(): void {
    if (this.fromDate && this.toDate) {
      this.loadReport();
    }
  }

  private buildChart(): void {
    const labels = this.rows.map(row => this.formatDateLabel(row.snapshotDate));

    const insurancePending = this.rows.map(row => this.num(row.insurancePendingAr));
    const patientPending = this.rows.map(row => this.num(row.patientPendingAr));
    const totalPending = this.rows.map(row => this.num(row.totalPendingAr));

    const borderCol = getStyle('--cui-border-color-translucent') || '#e5e7eb';
    const bodyCol = getStyle('--cui-body-color') || '#111827';

    const datasets: ChartDataset[] = [
      {
        data: insurancePending,
        label: 'Insurance Pending AR',
        borderColor: '#09090b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false
      },
      {
        data: patientPending,
        label: 'Patient Pending AR',
        borderColor: '#52525b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false
      },
      {
        data: totalPending,
        label: 'Total Pending AR',
        borderColor: '#a1a1aa',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        fill: false
      }
    ];

    const options: ChartOptions = {
      maintainAspectRatio: false,
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: bodyCol,
            boxWidth: 12,
            padding: 14
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: context => {
              const value = Number(context.parsed.y || 0);
              return `${context.dataset.label}: ${this.formatCurrency(value)}`;
            },
            labelColor: context => ({
              backgroundColor: context.dataset.borderColor
            } as TooltipLabelStyle)
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: borderCol,
            drawOnChartArea: false
          },
          ticks: {
            color: bodyCol,
            maxRotation: 0,
            autoSkip: true
          }
        },
y: {
  beginAtZero: false,
  min: 320000,
  max: 550000,
  grid: {
    color: borderCol
  },
  ticks: {
    color: bodyCol,
    stepSize: 5000,
    callback: value => this.compactCurrency(Number(value))
  }
}
      },
      elements: {
        line: {
          tension: 0.35
        },
        point: {
          radius: 3,
          hitRadius: 10,
          hoverRadius: 5
        }
      }
    };

    this.chart = {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options
    };
  }

  formatCurrency(value: number | null | undefined): string {
    const n = this.num(value);

    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    });
  }

  compactCurrency(value: number): string {
    const abs = Math.abs(value);

    if (abs >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }

    if (abs >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }

    return `$${value.toFixed(0)}`;
  }

  formatDateLabel(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const parts = value.split('-');

    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }

    return value;
  }

  private num(value: number | string | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
  }
}