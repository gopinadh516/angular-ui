import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgApexchartsModule } from "ng-apexcharts";
import { ChartComponent } from 'ng-apexcharts';
import { environment } from '../../../environments/environment';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexDataLabels,
  ApexTitleSubtitle,
  ApexPlotOptions,
  ApexLegend,
  ApexGrid
} from 'ng-apexcharts';

import {
  CardComponent,
  CardHeaderComponent,
  CardBodyComponent,
  SpinnerComponent
} from '@coreui/angular';

/** Response shape returned from the backend Pareto endpoints. */
interface DenialParetoBean {
  reasonCodes: string[];
  values: number[];
  cumulativePercentages: number[];
}

export type ParetoChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis | ApexYAxis[];
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  title: ApexTitleSubtitle;
  plotOptions?: ApexPlotOptions; // ← add this property
  legend?: ApexLegend;           // ← optional
  grid?: ApexGrid;               // ← optional
};

@Component({
  selector: 'app-pareto-chart',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    NgApexchartsModule,
    CardComponent,
    CardBodyComponent,
    SpinnerComponent,
    NgApexchartsModule,
  ],
  templateUrl: './pareto-chart.component.html',
  styleUrls: ['./pareto-chart.component.scss']
})
export class ParetoChartComponent implements OnInit {
  @ViewChild('chart', { static: true }) public chart!: ChartComponent;
  public chartOptions: Partial<ParetoChartOptions> = {};
  public isLoaded = false;
  public displayDetails: { code: string; description: string; remediation: string }[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadPareto('count');
  }

  loadPareto(type: 'count' | 'dollar'): void {
    this.isLoaded = false;
this.http.get<DenialParetoBean>(`${environment.apiBaseUrl}/denials/pareto/${type}`).subscribe({
      next: (data) => {
        // console.log('Pareto API Response:', data);  // Debugging API Response

        const filteredIndices = data.reasonCodes
          .map((code, idx) => ({ code, idx }))
          .filter(item => item.code !== 'Other')
          .map(item => item.idx);

        // Safely build filtered data
        const filteredData = {
          reasonCodes: filteredIndices.map(i => data.reasonCodes[i]),
          values: filteredIndices.map(i => data.values[i]),
          cumulativePercentages: filteredIndices.map(i => data.cumulativePercentages[i]),
          reasonDescriptions: filteredIndices.map(i =>
            data.reasonDescriptions?.[i] ?? 'Description not available'
          ),
          remediationActions: filteredIndices.map(i =>
            data.remediationActions?.[i] ?? 'Remediation steps not available'
          )
        };

        // Build the Pareto chart with filtered data
        this.buildChart(filteredData, type === 'count' ? 'Count' : 'Dollar');

        // Prepare details section for descriptions and remediation actions
        this.displayDetails = filteredData.reasonCodes.map((code, idx) => ({
          code,
          description: filteredData.reasonDescriptions[idx],
          remediation: filteredData.remediationActions[idx]
        }));

        this.isLoaded = true;
      },
      error: (err) => {
        console.error('Error fetching Pareto data:', err);
        this.isLoaded = true;  // Stop spinner even on error
      }
    });
  }


  private buildChart(data: DenialParetoBean, label: string): void {
    this.chartOptions = {
      series: [
        {
          name: label,
          type: 'column',
          data: data.values,
          color: '#6366f1'
        },
        {
          name: 'Cumulative %',
          type: 'line',
          data: data.cumulativePercentages,
          color: '#d97706'
        }
      ],
      chart: {
        height: 280, // Reduced height to make the chart compact
        type: 'line',
        toolbar: { show: false } // Removes toolbar for additional space
      },
      plotOptions: {
        bar: {
          columnWidth: '50%', // Narrower bars for compactness
        }
      },
      title: {
        text: '',
        style: { fontSize: '0px' }
      },
      xaxis: {
        categories: data.reasonCodes,
        labels: {
          rotate: -45, // Tilted labels for compactness
          style: { fontSize: '10px' }
        },
        title: { text: 'Denial Code', style: { fontSize: '12px' } }
      },
      yaxis: [
        {
          seriesName: label,
          title: { text: label, style: { fontSize: '12px' } },
          labels: { style: { fontSize: '10px' } }
        },
        {
          opposite: true,
          seriesName: 'Cumulative %',
          max: 100,
          title: { text: 'Cumulative %', style: { fontSize: '12px' } },
          labels: { style: { fontSize: '10px' } }
        }
      ],
      stroke: { width: [0, 3] }, // slightly thinner cumulative line
      dataLabels: {
        enabled: true,
        enabledOnSeries: [1],
        formatter: v => `${v}%`,
        style: { fontSize: '10px' } // smaller data labels
      },
      legend: {
        fontSize: '10px',
        offsetY: 0,
        height: 20
      },
      grid: {
        padding: {
          top: 0,
          bottom: 0,
          left: 10,
          right: 10
        }
      }
    };
  }

  currentMode = 'By Count';

  togglePareto(event: any) {
    this.currentMode = event.target.checked ? 'By Dollar' : 'By Count';
    this.loadPareto(event.target.checked ? 'dollar' : 'count');
  }

}
interface DenialParetoBean {
  reasonCodes: string[];
  values: number[];
  cumulativePercentages: number[];
  reasonDescriptions: string[];      // New Field
  remediationActions: string[];      // New Field
}

