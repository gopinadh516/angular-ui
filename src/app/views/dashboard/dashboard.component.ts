import { environment } from '../../../environments/environment';
import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  ViewChild,
  Renderer2,
  signal,
  WritableSignal
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChartOptions } from 'chart.js';

// CoreUI
import { ChartjsModule } from '@coreui/angular-chartjs';
import {
  ButtonDirective,
  ButtonGroupComponent,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormCheckLabelDirective,
  GutterDirective,
  ProgressBarDirective,
  ProgressComponent,
  RowComponent,
  TextColorDirective
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';

// Your feature components & services
import { WidgetsDropdownComponent } from '../widgets/widgets-dropdown/widgets-dropdown.component';
import { ARData } from '../ar-aging-table/ar-table.model';
import { ClaimlisttableComponent } from '../claimlisttable/claimlisttable.component';
import { ClaimstatusComponent } from '../claimstatus/claimstatus.component';
import {
  ClaimstatusService,
  ClaimStatusReport
} from '../claimstatus/claimstatus.service';
import { FirstPassRateComponent } from '../first-pass-rate/first-pass-rate.component';
import { RevenueDistributionComponent } from '../revenue-distribution/revenue-distribution.component';
import { ArAgingTableComponent } from '../ar-aging-table/ar-aging-table.component';
import { ParetoChartComponent } from '../pareto-chart/pareto-chart.component';
import { TopProcedureBarChartComponent } from '../top-procedure-bar-chart/top-procedure-bar-chart.component';
import { CollectionTrendComponent } from '../collection-trend/collection-trend.component';

import { DashboardChartsData, IChartProps } from './dashboard-charts-data';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    ChartjsModule,

    // CoreUI pieces
    WidgetsDropdownComponent,
    TextColorDirective,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    IconModule,

    // Feature comps
    ClaimstatusComponent,
    FirstPassRateComponent,
    RevenueDistributionComponent,
    ArAgingTableComponent,
    ParetoChartComponent,
    TopProcedureBarChartComponent,
    CollectionTrendComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #document: Document = inject(DOCUMENT);
  readonly #renderer: Renderer2 = inject(Renderer2);
  readonly #chartsData: DashboardChartsData = inject(DashboardChartsData);
  private http: HttpClient = inject(HttpClient);
  private csSvc: ClaimstatusService = inject(ClaimstatusService);

  // AR Data
  public claimData: ARData | null = null;
  public dollarData: ARData | null = null;
  
  // Claim status table
  public claimStatusData: ClaimStatusReport[] = [];

  // Traffic radio form
  public trafficRadioGroup = new FormGroup({
    trafficRadio: new FormControl<'Day' | 'Month' | 'Year'>('Month')
  });

  // Main trend chart
  public mainChart: IChartProps = { type: 'line' };
  public mainChartRef: WritableSignal<any> = signal(undefined);
  #mainChartRefEffect = effect(() => {
    if (this.mainChartRef()) {
      this.setChartStyles();
    }
  });

  @ViewChild(ClaimlisttableComponent)
  claimlisttableComponent!: ClaimlisttableComponent;

  ngOnInit(): void {
    this.initCharts();
    this.updateChartOnColorModeChange();
    this.fetchARData();
    this.fetchClaimStatusData();
  }

  /** Fetch AR aging data */
  fetchARData(): void {
    this.http
      .get<{ claims: ARData; dollars: ARData }>(
        `${environment.apiBaseUrl}/ar-aging/byClaimsAndDollar`
      )
      .subscribe({
        next: (resp) => {
          this.claimData = resp.claims;
          this.dollarData = resp.dollars;
        },
        error: (err) => console.error('Error fetching AR Data:', err)
      });
  }

  /** Fetch claim status table data */
  fetchClaimStatusData(): void {
    this.http
      .get<ClaimStatusReport[]>(`${environment.apiBaseUrl}/claim-status/all`)
      .subscribe({
        next: (resp) => (this.claimStatusData = resp),
        error: (err) => console.error('Error fetching Claim Status:', err)
      });
  }

  /** Handle clicks from the AR Aging table cells */
  onARCellClick(evt: { range: string; bucket: string; value: number }): void {
    this.csSvc
      .fetchByCellClick(evt.range, evt.bucket, evt.value)
      .subscribe((reports) => (this.claimStatusData = reports));
  }

  /** Initialize the main trend chart from the service */
  initCharts(): void {
    this.mainChart = this.#chartsData.mainChart;
  }

  /** Capture chart instance for live updates */
  handleChartRef($chartRef: any) {
    if ($chartRef) {
      this.mainChartRef.set($chartRef);
    }
  }

  /** Watch for color‐scheme changes */
  updateChartOnColorModeChange() {
    const unListen = this.#renderer.listen(
      this.#document.documentElement,
      'ColorSchemeChange',
      () => this.setChartStyles()
    );
    this.#destroyRef.onDestroy(unListen);
  }

  /** Re‐apply axis styles on theme change */
  setChartStyles() {
    if (!this.mainChartRef()) return;
    setTimeout(() => {
      const opts: ChartOptions = { ...this.mainChart.options };
      const scales = this.#chartsData.getScales();
      this.mainChartRef().options.scales = {
        ...opts.scales,
        ...scales
      };
      this.mainChartRef().update();
    });
  }

  /** Change period and redraw chart */
  setTrafficPeriod(value: 'Day' | 'Month' | 'Year'): void {
    this.trafficRadioGroup.setValue({ trafficRadio: value });
    this.#chartsData.initMainChart(value);
    this.initCharts();
  }

  /** Always returns valid period */
  get selectedPeriod(): 'Day' | 'Month' | 'Year' {
    const v = this.trafficRadioGroup.get('trafficRadio')?.value;
    return v === 'Day' || v === 'Month' || v === 'Year'
      ? v
      : 'Month';
  }
}
