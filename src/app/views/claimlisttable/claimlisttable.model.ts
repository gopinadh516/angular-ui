export interface ClaimsTableData {
  claimId: string;
  encId: string;
  billedTo: string;
  patient: string;
  procedureCode: string;
  status: string;
  asOfToday: string;
  location: string;
  expectedPayment: string;
  paymentReceived: string;
  createdDate: string;
  currentStatus: string;
  payment_status?: string;          // e.g. 'F-PAID', 'PENDING_ACK', 'MIS-DATA'
  pat_ar_status?: string;          // 'F-Paid' | 'PENDING' | 'Part_Paid'
  insurance_pending_ar?: number;
  patient_pending_ar?: number;
  claimQueue?: string;            // 'PENDING' | 'DENIAL' | 'PATIENT' | 'PAID'
}
