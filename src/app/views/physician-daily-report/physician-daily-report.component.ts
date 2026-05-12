import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  PhysicianDailyFactDTO,
  PhysicianDailyFooterTotals,
  PhysicianDailyReportRequest,
  PhysicianDailySummaryRow,
  PhysicianOptionDTO
} from './physician-daily-report.models';
import { PhysicianDailyReportService } from './physician-daily-report.service';

@Component({
  selector: 'app-physician-daily-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './physician-daily-report.component.html',
  styleUrls: ['./physician-daily-report.component.scss']
})
export class PhysicianDailyReportComponent implements OnInit {
  @Input() licenseKey = 160088;
  @Input() columnHeadingFid = 159;
  @Input() selectedClient: string | null = localStorage.getItem('selectedClient');

  loading = false;
  loadingPhysicians = false;
  errorMessage = '';

  fromDate = '';
  toDate = '';
  selectedPhysicianProfileFid: number | null = null;

  physicians: PhysicianOptionDTO[] = [];
  facts: PhysicianDailyFactDTO[] = [];
  summaryRows: PhysicianDailySummaryRow[] = [];
  footerTotals: PhysicianDailyFooterTotals = this.createEmptyFooterTotals();

  constructor(private reportService: PhysicianDailyReportService) {}

  ngOnInit(): void {
    this.setDefaultDates();
    this.loadPhysicians();
    this.loadFacts();
  }

  setDefaultDates(): void {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);

    this.fromDate = this.toLocalDateString(from);
    this.toDate = this.toLocalDateString(today);
  }

  loadPhysicians(): void {
    this.loadingPhysicians = true;

    const request = this.buildRequest(null);

    this.reportService.fetchPhysicians(request, this.selectedClient).subscribe({
      next: (rows) => {
        this.physicians = rows ?? [];
        this.loadingPhysicians = false;
      },
      error: () => {
        this.loadingPhysicians = false;
      }
    });
  }

  loadFacts(): void {
    this.loading = true;
    this.errorMessage = '';

    const request = this.buildRequest(this.selectedPhysicianProfileFid);

    this.reportService.fetchFacts(request, this.selectedClient).subscribe({
      next: (rows) => {
        this.facts = rows ?? [];

        const builtRows = this.buildSummaryRows(this.facts);
        this.summaryRows = builtRows;
        this.footerTotals = this.buildFooterTotals(builtRows);

        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load report data.';
        this.summaryRows = [];
        this.footerTotals = this.createEmptyFooterTotals();
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.loadFacts();
  }

  onReset(): void {
    this.setDefaultDates();
    this.selectedPhysicianProfileFid = null;
    this.loadFacts();
  }

  toggleRow(row: PhysicianDailySummaryRow): void {
    row.expanded = !row.expanded;
  }

  trackBySummary(_: number, row: PhysicianDailySummaryRow): string {
    return row.apptDate;
  }

  trackByDetail(_: number, row: PhysicianDailyFactDTO): number {
    return row.appointmentUid;
  }

  getBadgeClass(ok: boolean): string {
    return ok ? 'bg-success' : 'bg-danger';
  }

  getStatusClass(status: string | null): string {
    switch ((status || '').toUpperCase()) {
      case 'ACCEPTED':
        return 'badge bg-success-subtle text-success-emphasis';
      case 'REJECTED':
        return 'badge bg-danger-subtle text-danger-emphasis';
      case 'UNKNOWN':
        return 'badge bg-warning-subtle text-warning-emphasis';
      default:
        return 'badge bg-secondary-subtle text-secondary-emphasis';
    }
  }

  private buildRequest(physicianProfileFid: number | null): PhysicianDailyReportRequest {
    return {
      fromDate: this.fromDate,
      toDate: this.toDate,
      licenseKey: this.licenseKey,
      columnHeadingFid: this.columnHeadingFid,
      physicianProfileFid,
      selectedClient: this.selectedClient
    };
  }

  private buildSummaryRows(facts: PhysicianDailyFactDTO[]): PhysicianDailySummaryRow[] {
    const grouped = new Map<string, PhysicianDailySummaryRow>();

    for (const fact of facts) {
      const key = fact.apptDate;

      if (!grouped.has(key)) {
        grouped.set(key, {
          apptDate: fact.apptDate,
          appointmentsScheduled: 0,
          deleted: 0,
          noShowCancelled: 0,
          noAction: 0,
          arrived: 0,
          seen: 0,
          chartsNotSigned: 0,
          chartsSigned: 0,
          codingCompleted: 0,
          codingPending: 0,
          chargeEntryCompleted: 0,
          chargeEntryPending: 0,
          claimsNotTransmitted: 0,
          patientPaidVisits: 0,
          claimsTransmitted: 0,
          transmittedValueInDollar: 0,
          clearingHouseAccepted: 0,
          clearingHouseRejected: 0,
          ruleAOk: true,
          ruleBOk: true,
          ruleCOk: true,
          highlightColor: 'OK',
          expanded: false,
          details: []
        });
      }

      const row = grouped.get(key)!;

      row.appointmentsScheduled += 1;
      row.deleted += Number(fact.isDeleted || 0);
      row.noShowCancelled += Number(fact.isNoShowCancelled || 0);
      row.noAction += Number(fact.isNoAction || 0);
      row.arrived += Number(fact.isArrived || 0);
      row.seen += Number(fact.isSeen || 0);

      row.chartsSigned += Number(fact.isChartSigned || 0);
      row.chartsNotSigned += Number(fact.isSeen || 0) - Number(fact.isChartSigned || 0);

      row.codingCompleted += Number(fact.isCodingCompleted || 0);
      row.codingPending += Number(fact.isCodingPending || 0);

      row.chargeEntryCompleted += Number(fact.isChargeEntryCompleted || 0);
      row.chargeEntryPending += Number(fact.isChargeEntryPending || 0);

      row.claimsNotTransmitted += Number(fact.isClaimNotTransmitted || 0);
      row.patientPaidVisits += Number(fact.isPatientPaidVisit || 0);
      row.claimsTransmitted += Number(fact.isClaimTransmitted || 0);

      row.transmittedValueInDollar += Number(fact.transmittedValueInDollar || 0);
      row.clearingHouseAccepted += Number(fact.isClearingHouseAccepted || 0);
      row.clearingHouseRejected += Number(fact.isClearingHouseRejected || 0);

      row.details.push(fact);
    }

    const rows = Array.from(grouped.values());

    for (const row of rows) {
      row.ruleAOk =
        row.codingCompleted + row.codingPending ===
        row.chargeEntryCompleted + row.chargeEntryPending;

      row.ruleBOk =
        row.chargeEntryCompleted + row.chargeEntryPending ===
        row.claimsNotTransmitted + row.patientPaidVisits + row.claimsTransmitted;

      row.ruleCOk =
        row.claimsTransmitted ===
        row.clearingHouseAccepted + row.clearingHouseRejected;

      row.highlightColor = row.ruleAOk && row.ruleBOk && row.ruleCOk ? 'OK' : 'RED';
    }

    return rows.sort(
      (a, b) => this.parseUsDate(b.apptDate).getTime() - this.parseUsDate(a.apptDate).getTime()
    );
  }

  private buildFooterTotals(rows: PhysicianDailySummaryRow[]): PhysicianDailyFooterTotals {
    const totals = this.createEmptyFooterTotals();
    totals.rowCount = rows.length;

    for (const row of rows) {
      totals.appointmentsScheduled += row.appointmentsScheduled;
      totals.deleted += row.deleted;
      totals.noShowCancelled += row.noShowCancelled;
      totals.noAction += row.noAction;
      totals.arrived += row.arrived;
      totals.seen += row.seen;

      totals.chartsNotSigned += row.chartsNotSigned;
      totals.chartsSigned += row.chartsSigned;

      totals.codingCompleted += row.codingCompleted;
      totals.codingPending += row.codingPending;
      totals.chargeEntryCompleted += row.chargeEntryCompleted;
      totals.chargeEntryPending += row.chargeEntryPending;

      totals.claimsNotTransmitted += row.claimsNotTransmitted;
      totals.patientPaidVisits += row.patientPaidVisits;
      totals.claimsTransmitted += row.claimsTransmitted;
      totals.transmittedValueInDollar += Number(row.transmittedValueInDollar || 0);
      totals.clearingHouseAccepted += row.clearingHouseAccepted;
      totals.clearingHouseRejected += row.clearingHouseRejected;

      totals.ruleAOkCount += row.ruleAOk ? 1 : 0;
      totals.ruleBOkCount += row.ruleBOk ? 1 : 0;
      totals.ruleCOkCount += row.ruleCOk ? 1 : 0;
    }

    return totals;
  }

  private createEmptyFooterTotals(): PhysicianDailyFooterTotals {
    return {
      rowCount: 0,

      appointmentsScheduled: 0,
      deleted: 0,
      noShowCancelled: 0,
      noAction: 0,
      arrived: 0,
      seen: 0,

      chartsNotSigned: 0,
      chartsSigned: 0,

      codingCompleted: 0,
      codingPending: 0,
      chargeEntryCompleted: 0,
      chargeEntryPending: 0,

      claimsNotTransmitted: 0,
      patientPaidVisits: 0,
      claimsTransmitted: 0,
      transmittedValueInDollar: 0,
      clearingHouseAccepted: 0,
      clearingHouseRejected: 0,

      ruleAOkCount: 0,
      ruleBOkCount: 0,
      ruleCOkCount: 0
    };
  }

  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseUsDate(dateText: string): Date {
    const [month, day, year] = dateText.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
}