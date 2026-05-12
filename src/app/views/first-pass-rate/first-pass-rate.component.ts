import { Component, OnInit } from '@angular/core';
import { CommonModule }                   from '@angular/common';
import { HttpClient, HttpClientModule }   from '@angular/common/http';
import { ChartjsComponent }               from '@coreui/angular-chartjs';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import ChartDataLabels                   from 'chartjs-plugin-datalabels';
import { ColorService }                   from '../../services/color.service';
import { environment } from '../../../environments/environment';
// Register both the core chart types and the DataLabels plugin
Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-first-pass-rate',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ChartjsComponent
  ],
  templateUrl: './first-pass-rate.component.html',
  styleUrls: ['./first-pass-rate.component.scss']
})
export class FirstPassRateComponent implements OnInit {
  private apiUrl = `${environment.apiBaseUrl}/first-pass/rates`;
  public isChartReady = false;

  // Explicitly pass the plugin to the <c-chart> via [plugins]
  public chartPlugins = [ChartDataLabels];

  public chartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: []
  };

  // in first-pass-rate.component.ts

  public chartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 10, bottom: 0, left: 0, right: 0 }
    },
    plugins: {
      datalabels: {
        anchor: 'center',
        align: 'center',
        color: '#fff',
        font: { weight: 'bold', size: 12 },
        formatter: (value: number) => `${value}%`
      },
      legend: { display: false },
      title: {
        display: false,
        text: 'First Pass Rate by Payer'
        // ← removed font.size and padding here
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        grid:   { display: false },
        border: { display: false },
        ticks:  { padding: 0 }
      },
      y: {
        grid:   { display: false },
        border: { display: false },
        ticks:  { padding: 0 }
      }
    }
  };

  constructor(
    private http: HttpClient,
    private colorService: ColorService
  ) {}

  ngOnInit(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: data => {
        const sorted = data.sort((a, b) =>
          a.payerDescription === 'Total' ? -1 :
          b.payerDescription === 'Total' ? 1 :
          parseFloat(b.firstPassRatePercentage) - parseFloat(a.firstPassRatePercentage)
        );

        const labels = sorted.map(item => item.payerDescription);
        const values = sorted.map(item => {
          const v = parseFloat(item.firstPassRatePercentage.replace('%', ''));
          return isNaN(v) ? 0 : v;
        });
        const colors = sorted.map(item =>
          this.colorService.getColor(item.payerDescription)
        );

        this.chartData.labels = labels;
        this.chartData.datasets = [{
          label: 'First Pass Rate (%)',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
          borderRadius: 0
          // no per-dataset datalabels needed now
        }];

        setTimeout(() => this.isChartReady = true, 0);
      },
      error: err => console.error('API error', err)
    });
  }
}
