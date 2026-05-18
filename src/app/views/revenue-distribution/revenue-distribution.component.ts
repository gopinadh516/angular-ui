// revenue-distribution.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule }               from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChartjsComponent }           from '@coreui/angular-chartjs';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import ChartDataLabels               from 'chartjs-plugin-datalabels';
import { ColorService }               from '../../services/color.service';
import { environment } from '../../../environments/environment';
// Register core chart types + the DataLabels plugin
Chart.register(...registerables);
Chart.register(ChartDataLabels);
(function reduceLegendFont() {
  // Ensure plugins exists
  if (!Chart.defaults.plugins) {
    Chart.defaults.plugins = {} as any;
  }

  // Ensure legend defaults exist
  if (!Chart.defaults.plugins.legend) {
    Chart.defaults.plugins.legend = {} as any;
  }

  // Ensure labels defaults exist
  if (!Chart.defaults.plugins.legend.labels) {
    Chart.defaults.plugins.legend.labels = {} as any;
  }

  // Now create or overwrite the font object
  Chart.defaults.plugins.legend.labels.font = { size: 10 };
})();
interface RevenueDistribution {
  payerDescription: string;
  totalRevenue: number;
  revenuePercentage: number;
}

@Component({
  selector: 'app-revenue-distribution',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ChartjsComponent
  ],
  templateUrl: './revenue-distribution.component.html',
  styleUrls: ['./revenue-distribution.component.scss']
})
export class RevenueDistributionComponent implements OnInit {
  private apiUrl = `${environment.apiBaseUrl}/revenue-distribution/rates`;
  public isChartReady = false;

  public chartData: ChartConfiguration<'pie'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [] }]
  };

  public chartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,      // allow custom sizing via wrapper
    layout: {
      padding: { top: 10, bottom: 0, left: 0, right: 0 }
    },
    plugins: {
      // DataLabels plugin config
      datalabels: {
        formatter: (value: number) => `${value}%`,
        color: (ctx: any) => {
          const bgs = ctx.dataset.backgroundColor;
          const bg = Array.isArray(bgs) ? bgs[ctx.dataIndex] : bgs;
          if (!bg || typeof bg !== 'string' || !bg.startsWith('#')) return '#ffffff';
          const r = parseInt(bg.slice(1, 3), 16);
          const g = parseInt(bg.slice(3, 5), 16);
          const b = parseInt(bg.slice(5, 7), 16);
          return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#09090b' : '#ffffff';
        },
        font: { weight: 'bold', size: 12 },
        anchor: 'center',
        align: 'center'
      },
      legend: {
        position: 'right',
        labels: { boxWidth: 12, padding: 12 }
      },
      title: {
        display: false,
        text: 'Revenue Distribution by Payer'
      }
    }
  };

  constructor(
    private http: HttpClient,
    private colorService: ColorService
  ) {}

  ngOnInit(): void {
    this.http.get<RevenueDistribution[]>(this.apiUrl).subscribe({
      next: data => {
        const sorted = data.sort((a, b) =>
          a.payerDescription === 'Total' ? -1 :
          b.payerDescription === 'Total' ? 1 :
          b.revenuePercentage - a.revenuePercentage
        );
        this.chartData.labels = sorted.map(r => r.payerDescription);
        this.chartData.datasets[0].data = sorted.map(r => r.revenuePercentage);
        this.chartData.datasets[0].backgroundColor =
          sorted.map(r => this.colorService.getColor(r.payerDescription));
        // trigger render
        setTimeout(() => this.isChartReady = true, 0);
      },
      error: err => console.error('API error', err)
    });
  }
} 
