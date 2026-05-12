export interface ResolutionReportRequest {
  licenseKey?: number;
  fromDate: string; // yyyy-MM-dd
  toDate: string;   // yyyy-MM-dd, inclusive on backend
  visitFid?: number | null;
  claimId?: string | null;
  appType?: 'AMD' | 'EDI' | string;
  clientCode?: string | null;
}

export interface ResolutionReportSummaryRow {
  userName: string;
  workedArDollars: number;
  resolvedDollars: number;
  paymentsPosted: number;
  touchCount: number;
}

export interface ResolutionReportDetailRow {
  userName: string;
  userLogin: string;
  visitId: number;
  claimId: string | null;
  claimSuffix: string | null;
  carrierCode: string | null;
  patientName: string | null;
  firstDos: string | null;
  lastDos: string | null;
  touchNumber: number;
  touchDateTime: string | null;
  nextTouchDateTime: string | null;
  windowEndDateTime: string | null;
  daysInWindow: number | null;
  touchAction: string | null;
  touchNote: string | null;
  workedArBase: number;
  resolvedDollars: number;
  paymentsPosted: number;
  insuranceWriteoffs: number;
  pendingArAtNextTouch: number;
}

export interface ResolutionReportDashboardResponse {
  summary: ResolutionReportSummaryRow[];
  details: ResolutionReportDetailRow[];
}
