// src/app/views/clean-pass-widget/clean-pass-widget.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, Plugin } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { CardModule } from '@coreui/angular'; // CoreUI card components
import { ColorService } from '../../services/color.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-clean-pass-widget',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    BaseChartDirective, // ng2-charts standalone directive
    CardModule          // enables <c-card>, <c-card-header>, <c-card-body>
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './clean-pass-widget.component.html',
  styleUrls: ['./clean-pass-widget.component.scss']
})
export class CleanPassWidgetComponent implements OnInit {
  private apiUrl = `${environment.apiBaseUrl}/clean-pass/rates`;

  // plugins passed to [plugins]
  public chartPlugins: Plugin<'bar'>[] = [ChartDataLabels];

  public chartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: []
  };

  public chartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, bottom: 0, left: 0, right: 0 } },
    plugins: {
      datalabels: {
        anchor: 'center',
        align: 'center',
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
        formatter: (v: number) => `${v}%`
      },
      legend: { display: false },
      title: { display: false }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        grid: { display: false },
        border: { display: false },
        ticks: { padding: 0 }
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { padding: 0 }
      }
    }
  };

  constructor(private http: HttpClient, private colorService: ColorService) {}

  ngOnInit(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) =>
          a.payerDescription === 'Total' ? -1 :
          b.payerDescription === 'Total' ? 1 :
          parseFloat(b.cleanPassRatePercentage) - parseFloat(a.cleanPassRatePercentage)
        );

        const labels = sorted.map(i => i.payerDescription);
        const values = sorted.map(i => {
          const v = parseFloat(String(i.cleanPassRatePercentage).replace('%', ''));
          return Number.isFinite(v) ? v : 0;
        });
        const colors = sorted.map(i =>
          i.payerDescription === 'Total' ? 'green' : this.colorService.getColor(i.payerDescription)
        );

        this.chartData = {
          labels,
          datasets: [{
            label: 'Clean Claim Rate (%)',
            data: values,
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            borderRadius: 0
          }]
        };
      },
      error: (e) => console.error('API error', e)
    });
  }
}
