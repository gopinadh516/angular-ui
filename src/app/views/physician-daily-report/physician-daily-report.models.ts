export interface PhysicianDailyReportRequest {
  fromDate: string;
  toDate: string;
  licenseKey: number;
  columnHeadingFid: number;
  physicianProfileFid: number | null;
  selectedClient?: string | null;
}

export interface PhysicianOptionDTO {
  physicianProfileFid: number;
  physicianName: string;
}

export interface PhysicianDailyFactDTO {
  apptDate: string;
  apptTime: string;
  appointmentUid: number;
  patientFid: number;

  physicianProfileFid: number;
  physicianName: string;

  bucket: string;
  claimEditStatusFid: number | null;
  claimEditStatus: string | null;

  isDeleted: number;
  isNoShowCancelled: number;
  isNoAction: number;
  isArrived: number;
  isSeen: number;

  isChartSigned: number;
  chartSignedSource: string | null;

  isCodingCompleted: number;
  isCodingPending: number;

  isChargeEntryCompleted: number;
  isChargeEntryPending: number;

  isPatientPaidVisit: number;
  isClaimTransmitted: number;
  isClaimNotTransmitted: number;

  transmittedValueInDollar: number | null;

  isClearingHouseAccepted: number;
  isClearingHouseRejected: number;

  currentChStatus: string | null;
  carrierBilledDate: string | null;
}

export interface PhysicianDailySummaryRow {
  apptDate: string;

  appointmentsScheduled: number;
  deleted: number;
  noShowCancelled: number;
  noAction: number;
  arrived: number;
  seen: number;

  chartsNotSigned: number;
  chartsSigned: number;

  codingCompleted: number;
  codingPending: number;
  chargeEntryCompleted: number;
  chargeEntryPending: number;

  claimsNotTransmitted: number;
  patientPaidVisits: number;
  claimsTransmitted: number;
  transmittedValueInDollar: number;
  clearingHouseAccepted: number;
  clearingHouseRejected: number;

  ruleAOk: boolean;
  ruleBOk: boolean;
  ruleCOk: boolean;
  highlightColor: 'OK' | 'RED';

  expanded: boolean;
  details: PhysicianDailyFactDTO[];
}

export interface PhysicianDailyFooterTotals {
  rowCount: number;

  appointmentsScheduled: number;
  deleted: number;
  noShowCancelled: number;
  noAction: number;
  arrived: number;
  seen: number;

  chartsNotSigned: number;
  chartsSigned: number;

  codingCompleted: number;
  codingPending: number;
  chargeEntryCompleted: number;
  chargeEntryPending: number;

  claimsNotTransmitted: number;
  patientPaidVisits: number;
  claimsTransmitted: number;
  transmittedValueInDollar: number;
  clearingHouseAccepted: number;
  clearingHouseRejected: number;

  ruleAOkCount: number;
  ruleBOkCount: number;
  ruleCOkCount: number;
}