import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ARTableService } from './excel-ar-table.service';
import { ARData } from './excel-ar-table.model';
import { TableModule } from '@coreui/angular'; 
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexPlotOptions,
  ApexLegend,
  ApexDataLabels,
  ApexYAxis,
} from 'ng-apexcharts';

@Component({
  selector: 'app-excel-ar-aging',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TableModule],
  templateUrl: './excel-ar-aging.component.html',
   styleUrls: ['./excel-ar-aging.component.scss'],
})
export class ExcelArAgingComponent implements OnInit {
  
  public claimData: ARData | null = null;
  public dollarData: ARData | null = null;

  // ✅ Chart Series for Claims & Dollar Value
  public chartSeriesClaims: ApexAxisChartSeries = [];
  public chartSeriesDollar: ApexAxisChartSeries = [];
  public chartXAxisClaims!: ApexXAxis;
  public chartXAxisDollar!: ApexXAxis;
  public chartYAxisClaims!: ApexYAxis;
  public chartYAxisDollar!: ApexYAxis;

  public chartDetails: ApexChart = { type: 'bar', height: 270, background: '#ffffff' };
  // Matches CLASS_TO_HEX in claimstatus: greenc | amberc | light-redc | mid-redc | redc
  public chartColors: string[] = ['#059669', '#059669', '#d97706', '#dc2626', '#b91c1c'];
  public chartLegend: ApexLegend = { position: 'top' };
  public chartPlotOptions: ApexPlotOptions = { bar: { columnWidth: '75%', barHeight: '95%', distributed: false } };
  public chartDataLabels: ApexDataLabels = { enabled: false };

  // ✅ Totals for Claim Count & Dollar Value
  public rowTotalsClaims: number[] = [];
  public columnTotalsClaims: number[] = [];
  public rTotalsClaims: number[] = [];
  public subtotalRowClaims: number[] = [];
  public rSubtotalClaims: number = 0;
  public grandTotalClaims: number = 0;

  public rowTotalsDollar: number[] = [];
  public columnTotalsDollar: number[] = [];
  public rTotalsDollar: number[] = [];
  public subtotalRowDollar: number[] = [];
  public rSubtotalDollar: number = 0;
  public grandTotalDollar: number = 0;

  
  constructor(private arTableService: ARTableService) {}

  ngOnInit(): void {
    this.fetchARData();
  }

  fetchARData(): void {
    this.arTableService.getARData().subscribe({
      next: (response: any) => {
        if (response && response.claims && response.dollars) {
          this.updateChartData(response.claims, response.dollars);
        } else {
          console.error("Error: API response does not have 'claims' or 'dollars' data.");
        }
      },
      error: (error) => console.error('Error fetching AR Data', error),
    });
  }

  updateChartData(claimData: ARData, dollarData: ARData): void {
    this.claimData = claimData;
    this.dollarData = dollarData;

    //console.log("Updating MultiBarChart with Data:", claimData, dollarData);

    // ✅ Update Chart Data for Claims
    this.chartSeriesClaims = claimData.agingLabels.map((label, index) => ({
      name: label,
      data: claimData.data.map((row) => row[index]),
    }));

    // ✅ Update Chart Data for Dollar Value (Second Chart)
    this.chartSeriesDollar = dollarData.agingLabels.map((label, index) => ({
      name: label,
      data: dollarData.data.map((row) => row[index]),
    }));

    // ✅ Update X-Axis Labels for both charts
    this.chartXAxisClaims = { categories: claimData.amountLabels, labels: { style: { fontSize: '10px' } } };
    this.chartXAxisDollar = { categories: dollarData.amountLabels, labels: { style: { fontSize: '10px' } } };

    // ✅ Set Y-Axis properties
    this.chartYAxisClaims = { labels: { style: { fontSize: '10px' }, offsetX: -5 } };
    this.chartYAxisDollar = { labels: { style: { fontSize: '10px' }, offsetX: -5 } };

    // ✅ Compute Totals
    this.computeClaimTotals(claimData);
    this.computeDollarTotals(dollarData);
  }

  computeClaimTotals(data: ARData): void {
    this.rowTotalsClaims = data.data.map(row => row.reduce((sum: number, num: number) => sum + (num || 0), 0));
    this.columnTotalsClaims = data.agingLabels.map((_, index) =>
      data.data.reduce((sum: number, row: number[]) => sum + (row[index] || 0), 0)
    );
    this.rTotalsClaims = data.data.map(row => row.slice(2).reduce((sum: number, num: number) => sum + (num || 0), 0));
    const lastRowIndex = data.amountLabels.indexOf("0-50 $");
    this.subtotalRowClaims = data.agingLabels.map((_, index) =>
      data.data.slice(0, lastRowIndex).reduce((sum: number, row: number[]) => sum + (row[index] || 0), 0)
    );
    this.rSubtotalClaims = this.subtotalRowClaims.slice(2).reduce((sum: number, num: number) => sum + (num || 0), 0);
    this.grandTotalClaims = this.rowTotalsClaims.reduce((sum: number, num: number) => sum + num, 0);
  }

  computeDollarTotals(data: ARData): void {
    this.rowTotalsDollar = data.data.map(row => row.reduce((sum: number, num: number) => sum + (num || 0), 0));
    this.columnTotalsDollar = data.agingLabels.map((_, index) =>
      data.data.reduce((sum: number, row: number[]) => sum + (row[index] || 0), 0)
    );
    this.rTotalsDollar = data.data.map(row => row.slice(2).reduce((sum: number, num: number) => sum + (num || 0), 0));
    const lastRowIndex = data.amountLabels.indexOf("0-50 $");
    this.subtotalRowDollar = data.agingLabels.map((_, index) =>
      data.data.slice(0, lastRowIndex).reduce((sum: number, row: number[]) => sum + (row[index] || 0), 0)
    );
    this.rSubtotalDollar = this.subtotalRowDollar.slice(2).reduce((sum: number, num: number) => sum + (num || 0), 0);
    this.grandTotalDollar = this.rowTotalsDollar.reduce((sum: number, num: number) => sum + num, 0);
  }

  trackByFunction(index: number, item: any): number {
    return index;
  }

  getSubtotalSum(type: 'claim' | 'dollar'): number {
    return type === 'claim'
      ? this.subtotalRowClaims.reduce((sum, num) => sum + (num || 0), 0)
      : this.subtotalRowDollar.reduce((sum, num) => sum + (num || 0), 0);
  }
  getRowTotal(row: number[]): number {
    return row?.reduce((sum, value) => sum + (value ?? 0), 0) ?? 0;
  }
  getGrandTotalClaims(): number {
    return this.claimData?.data?.reduce((sum, row) => sum + this.getRowTotal(row), 0) ?? 0;
  }
  getGrandTotalDollar(): number {
    return this.dollarData?.data?.reduce((sum, row) => sum + this.getRowTotal(row), 0) ?? 0;
  }
  getMaroonTotalClaims(): number {
    if (!this.claimData?.data || !this.claimData?.amountLabels) return 0;
  
    const lastRowIndex = this.claimData.amountLabels.indexOf("0-50 $");
    if (lastRowIndex === -1 || !this.claimData.data[lastRowIndex]) return 0;
  
    const subtotal = this.subtotalRowClaims.reduce((sum, num) => sum + (num || 0), 0);
    const lastRowTotal = this.claimData.data[lastRowIndex].reduce((sum, num) => sum + (num || 0), 0);
  
    return subtotal + lastRowTotal;
  }
  getMaroonTotalDollar(): number {
    if (!this.dollarData?.data || !this.dollarData?.amountLabels) return 0;

    // ✅ Step 1: Find index of "0-50 $" row
    const lastRowIndex = this.dollarData.amountLabels.indexOf("0-50 $");
    if (lastRowIndex === -1 || !this.rTotalsDollar || !this.rTotalsDollar[lastRowIndex]) return 0;

    // ✅ Step 2: Compute subtotal by summing R.Total values (excluding "0-50$" row)
    const subtotal = this.rTotalsDollar.slice(0, lastRowIndex)
        .reduce((sum: number, num: number) => sum + (num || 0), 0);

    // ✅ Step 3: Get R.Total value for "0-50 $" row
    const lastRowTotal = this.rTotalsDollar[lastRowIndex];

    // ✅ Step 4: Compute final Maroon Total (Total row's R.Total column)
    return subtotal + lastRowTotal;
}

  
}
