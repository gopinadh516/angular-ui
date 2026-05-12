import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
// CoreUI components
import {
  RowComponent,
  ColComponent,
  ButtonGroupComponent,
  ButtonDirective,
  FormCheckLabelDirective,
  CardComponent,
  CardBodyComponent
} from '@coreui/angular';
import { ChartjsModule } from '@coreui/angular-chartjs';
import {
  Chart,
  ChartDataset,
  ChartOptions,
  ChartType,
  registerables,
  TooltipLabelStyle,
  ScaleOptions
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import 'chartjs-adapter-date-fns'; // ensure date adapter is loaded
import { getStyle } from '@coreui/utils';

interface CollectionTrendDto {
  month: string;
  totalCharges: number;
  totalCollected: number;
}

export interface IChartProps {
  type: ChartType;
  data?: { labels: string[]; datasets: ChartDataset[] };
  options?: ChartOptions;
  [key: string]: any;
}

Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-collection-trend',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ChartjsModule,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    ButtonGroupComponent,
    ButtonDirective,
    FormCheckLabelDirective
  ],
  templateUrl: './collection-trend.component.html',
  styleUrls: ['./collection-trend.component.scss']
})
export class CollectionTrendComponent implements OnInit, OnChanges {
  @Input() period: 'Day' | 'Month' | 'Year' = 'Month';
  public chart: IChartProps = { type: 'line' };
  public rangeStart!: Date;
  public rangeEnd!: Date;
  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.reloadChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['period'] && !changes['period'].isFirstChange()) {
      this.reloadChart();
    }
  }

  public async changePeriod(value: 'Day'|'Month'|'Year'): Promise<void> {
    this.period = value;
    await this.reloadChart();
  }

  public async reloadChart(): Promise<void> {
    const url = `${environment.apiBaseUrl}/collectionTrend/${this.period.toLowerCase()}`;
    let rows: CollectionTrendDto[] = [];
    try {
      rows = await firstValueFrom(this.http.get<CollectionTrendDto[]>(url));
      if (rows.length) {
      // Attempt safe parsing — fall back to current date on failure
      const tryParse = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? new Date() : d; };
      this.rangeStart = tryParse(rows[0].month);
      this.rangeEnd   = tryParse(rows[rows.length - 1].month);
    }
    } catch (err) {
      console.error('Error loading trend:', err);
      return;
    }

    const labels    = rows.map(r => r.month);
    const projected = rows.map(r => r.totalCharges);
    const actual    = rows.map(r => r.totalCollected);
    const variance  = actual.map((a,i) => a - projected[i]);

    // store for scale calcs
    this.chart['D1'] = projected;
    this.chart['D2'] = actual;

    // theme colors
    const borderCol = getStyle('--cui-border-color-translucent');
    const bodyCol   = getStyle('--cui-body-color');

    const colors = [
      { backgroundColor: 'rgba(9,9,11,0.06)', borderColor: '#09090b', fill: true,  borderWidth: 2 },
      { backgroundColor: 'transparent',        borderColor: '#52525b', borderWidth: 2 },
      { backgroundColor: 'transparent',        borderColor: '#a1a1aa', borderDash: [8, 5] }
    ];

    const datasets: ChartDataset[] = [
      { data: projected, label:'Total Billed',       ...colors[0] },
      { data: actual,    label:'Total Collected',    ...colors[1] },
      { data: variance,  label:'Charge–Payment Gap', ...colors[2] }
    ];

    const plugins: Partial<ChartOptions['plugins']> = {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 16,
          color: bodyCol,
          usePointStyle: true,
          pointStyle: 'line'
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          labelColor: ctx => ({ backgroundColor: ctx.dataset.borderColor } as TooltipLabelStyle),
          label: ctx => {
            const v = ctx.parsed.y;
            const formatted = v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'K' : '$' + v;
            return ` ${ctx.dataset.label}: ${formatted}`;
          }
        }
      },
      datalabels: { display: false }
    };

    // compute y-axis limits (include variance which can be negative)
    const allValues = [...projected, ...actual, ...variance];
    const minY = Math.min(0, ...allValues);
    const maxY = Math.max(...allValues, 0);
    const range = maxY - minY;
    const step  = range / 5;

    const fmtY = (v: number) => {
      const abs = Math.abs(v);
      const sign = v < 0 ? '-' : '';
      if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
      if (abs >= 1_000)     return sign + '$' + (abs / 1_000).toFixed(0) + 'K';
      return sign + '$' + abs;
    };

    const xScale: any = this.period === 'Day'
      ? {
          type: 'time',
          time: { unit: 'week', tooltipFormat: 'yyyy-MM-dd' },
          ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0, minRotation: 0, color: bodyCol },
          grid:  { color: borderCol, drawOnChartArea: false }
        }
      : {
          grid:  { color: borderCol, drawOnChartArea: false },
          ticks: { color: bodyCol, maxRotation: 0, minRotation: 0 }
        };

    const yScale: any = {
      grid:        { color: borderCol },
      min:          minY,
      max:          maxY,
      beginAtZero: minY >= 0,
      ticks:       { color: bodyCol, stepSize: Math.ceil(step), callback: (v: number) => fmtY(v) }
    };

    const options: ChartOptions = {
      maintainAspectRatio: false,
      layout: { padding:0 },
      interaction: { mode:'index', intersect:false },
      plugins,
      scales: { x: xScale, y: yScale },
      elements:{ line:{ tension:0.4 }, point:{ radius:0, hitRadius:10, hoverRadius:4 } }
    };

    this.chart = { type:'line', data:{ labels, datasets }, options };
  }
}
