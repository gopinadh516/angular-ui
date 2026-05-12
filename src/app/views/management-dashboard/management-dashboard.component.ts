import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NcrreportByDoeComponent } from '../ncrreport-by-doe/ncrreport-by-doe.component';
import { CptChargePaymentReportComponent } from '../reports/cpt-charge-payment-report/cpt-charge-payment-report.component';
import { CleanClaimReportComponent } from '../reports/clean-claim-report/clean-claim-report.component';
import { LiquidationRateReportComponent } from '../reports/liquidation-rate-report/liquidation-rate-report.component';
import { PendingArSnapshotTrendComponent } from '../pending-ar-snapshot-trend/pending-ar-snapshot-trend.component';
@Component({
  selector: 'app-management-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NcrreportByDoeComponent,
    CptChargePaymentReportComponent,
    CleanClaimReportComponent,
    LiquidationRateReportComponent,
     PendingArSnapshotTrendComponent
  ],
  templateUrl: './management-dashboard.component.html',
  styleUrls: ['./management-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagementDashboardComponent {
  licenseKey = 160088;
  columnHeadingFid = 159;
  selectedClient: string | null = localStorage.getItem('selectedClient');

  showNcrChartInTile = false;
  showNcrDoeChartInTile = false;

  showDoeReport = false;
  showCptReport = false;
  showCleanClaimReport = false;
  showLiquidationRateReport = false;
showPendingArSnapshotTrendReport = true;
  toggleDoeReport(): void {
    this.showDoeReport = !this.showDoeReport;
  }

  toggleCptReport(): void {
    this.showCptReport = !this.showCptReport;
  }

  toggleCleanClaimReport(): void {
    this.showCleanClaimReport = !this.showCleanClaimReport;
  }

  toggleLiquidationRateReport(): void {
    this.showLiquidationRateReport = !this.showLiquidationRateReport;
  }
  togglePendingArSnapshotTrendReport(): void {
  this.showPendingArSnapshotTrendReport = !this.showPendingArSnapshotTrendReport;
}
}