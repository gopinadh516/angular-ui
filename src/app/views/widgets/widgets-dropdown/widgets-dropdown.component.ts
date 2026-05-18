// widgets-dropdown.component.ts (with adjudication import)
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';
import { getStyle } from '@coreui/utils';
import { TooltipItem } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { environment } from '../../../../environments/environment';
import {
  RowComponent,
  ColComponent,
  WidgetStatAComponent,
  TemplateIdDirective,
  ThemeDirective,
  DropdownComponent,
  ButtonDirective,
  DropdownToggleDirective,
  DropdownMenuDirective,
  DropdownItemDirective
} from '@coreui/angular';
import { FirstPassRateComponent } from '../../first-pass-rate/first-pass-rate.component';
import { CleanPassWidgetComponent } from '../../clean-pass-widget/clean-pass-widget.component';
import { AdjudicationTrendWidgetComponent } from '../../adjudication-trend-widget/adjudication-trend-widget.component';

interface MonthWiseData {
  month: string;
  firstPassRatePct: number;
}
interface AdjudicationPoint {
  month: string;
  avgDaysToAdjudication: number;
}

@Component({
  selector: 'app-widgets-dropdown',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    RowComponent,
    ColComponent,
    WidgetStatAComponent,
    TemplateIdDirective,
    IconDirective,
    ThemeDirective,
    DropdownComponent,
    ButtonDirective,
    DropdownToggleDirective,
    DropdownMenuDirective,
    DropdownItemDirective,
    RouterLink,
    ChartjsComponent
  ],
  templateUrl: './widgets-dropdown.component.html',
  styleUrls: ['./widgets-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class WidgetsDropdownComponent implements OnInit, AfterContentInit {
  // First Pass chart fields
  public firstPassChartData: any;
  public firstPassChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: false, grid: { display: false }, ticks: { display: false } },
      y: { display: false, grid: { display: false }, min: 0, max: 100 }
    },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: { enabled: true, callbacks: { label: (ctx: TooltipItem<'line'>) => `First Pass: ${ctx.parsed.y ?? ctx.parsed}%` } }
    }
  };
  public firstPassRate = 0;
  public firstPassDelta = 0;

  // Clean Pass chart fields
  public cleanPassChartData: any;
  public cleanPassChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: false, grid: { display: false }, ticks: { display: false } },
      y: { display: false, grid: { display: false }, min: 0, max: 100 }
    },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: { enabled: true, callbacks: { label: (ctx: TooltipItem<'line'>) => `Clean Pass: ${ctx.parsed.y ?? ctx.parsed}%` } }
    }
  };
  public cleanPassRate = 0;
  public cleanPassDelta = 0;

  // Monthly Claims Volume placeholders (for c-chart index 3)
  public data: any[] = [];
  public options: any[] = [];

  // Adjudication trend fields
  public adjudicationChartData: any;
  public adjudicationChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: true, grid: { display: false }, title: { display: true, text: 'Month' } },
      y: { display: true, grid: { display: false }, beginAtZero: true, title: { display: true, text: 'Days' } }
    },
    plugins: { legend: { display: false } }
  };
  public latestAvgDays = 0;
  public previousAvgDays = 0;
  public deltaAvgDays = 0;

  constructor(
    private http: HttpClient,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFirstPassData();
    this.loadCleanPassData();
    this.loadAdjudicationTrend();
  }

  ngAfterContentInit(): void {
    this.changeDetectorRef.detectChanges();
  }

  private loadFirstPassData() {
    this.http.get<MonthWiseData[]>(`${environment.apiBaseUrl}/first-pass-widget/monthWiseData`)
      .subscribe(data => {
        const labels = data.map(d => d.month);
        const percentages = data.map(d => d.firstPassRatePct);
        this.firstPassChartData = { labels, datasets: [{ label: 'First Pass %', backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, pointBackgroundColor: '#ffffff', pointRadius: 2, pointHoverRadius: 4, data: percentages }] };
        const last = percentages.slice(-1)[0] || 0;
        const prev = percentages.slice(-2)[0] ?? last;
        this.firstPassRate = last;
        this.firstPassDelta = last - prev;
        this.changeDetectorRef.detectChanges();
      });
  }

  private loadCleanPassData() {
    this.http.get<MonthWiseData[]>(`${environment.apiBaseUrl}/clean-pass/rates`)
      .subscribe(data => {
        const labels = data.map(d => d.month);
        const percentages = data.map(d => d.firstPassRatePct);
        this.cleanPassChartData = { labels, datasets: [{ label: 'Clean Pass %', backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, pointBackgroundColor: '#ffffff', pointRadius: 2, pointHoverRadius: 4, data: percentages }] };
        const last = percentages.slice(-1)[0] || 0;
        const prev = percentages.slice(-2)[0] ?? last;
        this.cleanPassRate = last;
        this.cleanPassDelta = last - prev;
        this.changeDetectorRef.detectChanges();
      });
  }

  private loadAdjudicationTrend() {
  this.http
    .get<AdjudicationPoint[]>(`${environment.apiBaseUrl}/adjudication/trend-monthwise`)
    .subscribe(data => {
      const labels = data.map(d => d.month);
      const values = data.map(d => +d.avgDaysToAdjudication.toFixed(2));

      // Mirror static Monthly Volume styling:
      this.adjudicationChartData = {
        labels,
        datasets: [{
          label: 'Avg Days to Adjudication',
          data: values,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderColor: 'rgba(255,255,255,0.9)',
          borderWidth: 1,
          barPercentage: 0.7
        }]
      };

      this.adjudicationChartOptions = {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false }  // hide data labels on bars
        },
        scales: {
          x: {
            border: { display: false },
            grid: { display: false, drawTicks: false, drawBorder: false },
            ticks: { display: false }
          },
          y: {
            display: false
          }
        },
        elements: {}
      };

      // header values
      const last = values.slice(-1)[0] || 0;
      const prev = values.slice(-2)[0] ?? last;
      this.latestAvgDays = last;
      this.previousAvgDays = prev;
      this.deltaAvgDays = parseFloat((last - prev).toFixed(1));
      this.changeDetectorRef.detectChanges();
    });
}
}
