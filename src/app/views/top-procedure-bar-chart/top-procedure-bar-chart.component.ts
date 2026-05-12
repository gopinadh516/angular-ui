import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
Chart.register(...registerables);

interface DenialParetoBean {
  reasonCodes: string[];
  values: number[]; // assuming the backend returns numeric counts
  cumulativePercentages?: number[];   // unused here
  reasonDescriptions?: string[];      // unused here
  remediationActions?: string[];      // unused here
}

@Component({
  selector: 'app-top-procedure-bar-chart',
  templateUrl: './top-procedure-bar-chart.component.html',
  styleUrls: ['./top-procedure-bar-chart.component.scss']
})
export class TopProcedureBarChartComponent implements OnInit, AfterViewInit {
  @ViewChild('barChart') barChart!: ElementRef<HTMLCanvasElement>;
  private chart!: Chart;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    // nothing needed here for now
  }

  ngAfterViewInit(): void {
    this.fetchAndRenderChart();
  }
 private apiUrl = `${environment.apiBaseUrl}/top/top10PCs`;

private fetchAndRenderChart(): void {
  this.http.get<DenialParetoBean>(this.apiUrl).subscribe(bean => {
    const labels = bean.reasonCodes;    // ["99213", "45378", …]
    const dataValues = bean.values;     // [120, 95, 80, …]
    this.createChart(labels, dataValues);
  });
}
private createChart(labels: string[], dataValues: number[]): void {
  // Destroy existing chart (if any)
  if (this.chart) {
    this.chart.destroy();
  }

  const themeScale = [
    '#09090b', '#27272a', '#3f3f46', '#52525b', '#71717a',
    '#334155', '#475569', '#64748b', '#374151', '#4b5563'
  ];
  const backgroundColors = dataValues.map((_, i) => themeScale[i % themeScale.length]);

  const config: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Count',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors,
          borderWidth: 1,
          // ← These two lines force each bar to occupy its entire category,
          //     removing any spacing between bars:
          barPercentage: 1.0,
          categoryPercentage: 1.0
        }
      ]
    },
    options: {
      indexAxis: 'y',       // horizontal bars
      responsive: true,
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Occurrence Count'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Procedure Code'
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x}`
          }
        }
      }
    }
  };

  this.chart = new Chart(this.barChart.nativeElement, config);
}



 
}
