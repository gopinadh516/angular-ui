// src/app/views/ar-aging-table/ar-aging-table.component.ts

import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ARData } from './ar-table.model';
import { ClaimStatusReport } from '../claimstatus/claimstatus.service';
import { ClaimstatusComponent }     from '../claimstatus/claimstatus.component';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexPlotOptions,
  ApexLegend,
  ApexDataLabels,
} from 'ng-apexcharts';

@Component({
  selector: 'app-ar-aging-table',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule ],
  templateUrl: './ar-aging-table.component.html',
  styleUrls: ['./ar-aging-table.component.scss']
})
export class ArAgingTableComponent implements OnChanges {
  @Input() title!: string;       // e.g. "Number of Claims"
  @Input() data!: ARData;        // the matrix bean
   @Output() cellClicked = new EventEmitter<{
    range: string;
    bucket: string;
    value: number;
  }>();
  claimStatuses: ClaimStatusReport[] = [];

  public chartSeries: ApexAxisChartSeries = [];
  public chartOptions: ApexChart = { type: 'bar', height: 300, background: '#fff' };
  public chartXAxis!: ApexXAxis;
  public chartPlotOptions: ApexPlotOptions = { bar: { columnWidth: '60%' } };
  public chartDataLabels: ApexDataLabels = { enabled: false };
  public chartLegend: ApexLegend = { position: 'top' };
  // Matches CLASS_TO_HEX in claimstatus: greenc | amberc | light-redc | mid-redc | redc
  public chartColors: string[] = ['#059669', '#059669', '#d97706', '#dc2626', '#b91c1c'];
  public loaded = false;
  constructor(private http: HttpClient) { }
  ngOnChanges(changes: SimpleChanges) {
    // Only proceed when “data” has actually changed and is defined
    if (changes['data'] && this.data) {
      // Guard that data.data is a real array before slicing/indexing
      const rawRows = Array.isArray(this.data.data) ? this.data.data : [];
      const rows = rawRows.slice(0, -1);

      // Similarly guard the labels arrays
      const categories = Array.isArray(this.data.amountLabels)
        ? this.data.amountLabels.slice(0, -1)
        : [];
      const buckets = Array.isArray(this.data.agingLabels)
        ? this.data.agingLabels.slice(0, 5)
        : [];

      // Build the chart series
      this.chartSeries = buckets.map((label, idx) => ({
        name: label,
        data: rows.map(r => (Array.isArray(r) ? r[idx] ?? 0 : 0))
      }));

      // Set up the x-axis
      this.chartXAxis = {
        categories,
        labels: { style: { fontSize: '10px' } }
      };
      this.loaded = true;
    }
  }
  onCellClick(range: string, bucket: string, value: number) {
    // just emit—no HTTP here
    this.cellClicked.emit({ range, bucket, value });
  }

  columnClass(i: number) {
    return ['greenc', 'amberc', 'light-redc', 'mid-redc', 'redc', 'maroonc', 'bluec'][i] || '';
  }
}
