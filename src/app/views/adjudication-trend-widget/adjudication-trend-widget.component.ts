import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { ChartjsComponent } from '@coreui/angular-chartjs';
// CoreUI widget and template directives
import { WidgetStatAComponent, TemplateIdDirective } from '@coreui/angular';
// Icon directive for cIcon
import { IconDirective } from '@coreui/icons-angular';
import { environment } from '../../../environments/environment';
interface TrendPoint {
  month: string;
  avgDaysToAdjudication: number;
}

@Component({
  selector: 'app-adjudication-trend-widget',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ChartjsComponent,
    WidgetStatAComponent,
    TemplateIdDirective,
    IconDirective
  ],
  templateUrl: './adjudication-trend-widget.component.html',
  styleUrls: ['./adjudication-trend-widget.component.scss']
})
export class AdjudicationTrendWidgetComponent implements OnInit {
  adjudicationChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  adjudicationChartOptions: ChartOptions<'bar'> = {};

  latestAvgDays = 0;
  previousAvgDays = 0;
  delta = 0;
 private apiUrl = `${environment.apiBaseUrl}/adjudication/trend-monthwise`;
  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<TrendPoint[]>(this.apiUrl).subscribe(data => {
      const labels = data.map(d => d.month);
      const values = data.map(d => +d.avgDaysToAdjudication.toFixed(2));

      this.adjudicationChartData = {
        labels,
        datasets: [{
          label: 'Avg Days to Adjudication',
          data: values
        }]
      };

      this.adjudicationChartOptions = {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Month' } },
          y: { beginAtZero: true, title: { display: true, text: 'Days' } }
        }
      };

      if (values.length) {
        this.latestAvgDays = values[values.length - 1];
        this.previousAvgDays = values.length > 1 ? values[values.length - 2] : this.latestAvgDays;
        this.delta = +(this.latestAvgDays - this.previousAvgDays).toFixed(2);
      }
    });
  }
}
