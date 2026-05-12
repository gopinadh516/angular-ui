import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type SourceType = '835' | '837' | '277';
type PstCode = 'P' | 'S' | 'T';
export type PstType = PstCode | null;
type PatArStatusCode = 'FULL_PAID' | 'PENDING' | 'PART_PAID';
export type PatArStatusType = PatArStatusCode | null;

export interface ClaimStatusManualUpdateRequest {
  claimNumber: string;
  status: string;
  nextStep: string;
}

// -----------------------------
// AR Follow-up History (Status History modal)
// -----------------------------
export interface ArStatusLookupDTO {
  statusId: number;
  statusLabel: string;
}

export interface ArActionLookupDTO {
  actId: number;
  actionLabel: string;
  // Provided by backend action lookup (optional but useful for insert)
  responsibleParty?: string | null;
  category?: string | null;
}

export interface ArFollowupHistoryCreateRequest {
  actionDate?: string | null;
  actionTime?: string | null;
  statusId?: number | null;
  actId?: number | null;
  responsibleParty?: string | null;
  category?: string | null;
  userId?: string | null;
  listId?: number | null;
  listNumber?: number | null;
  claimId?: number | null;
  claimNumber?: string | null;
  clientId?: number | null;
  notes?: string | null;
  remainderDate?: string | null;
}

export interface ArFollowupHistoryRowDTO {
  followupId: number;
  actionDate: string; // YYYY-MM-DD
  actionTime: string; // HH:mm:ss
  statusId: number;
  statusLabel: string;
  actId: number;
  actionLabel: string;
  responsibleParty: string;
  category: string;
  userId: string;
  listId: number | null;
  claimId: number | null;
  claimNumber: string;
  clientId: number | null;
  created?: string;
  // Optional if backend provides
  notes?: string | null;
}

// -----------------------------
// AR Follow-up Attachments
// -----------------------------
// Mirrors backend DTO: com.surescripts.dto.ArFollowupAttachmentRowDTO
export interface ArFollowupAttachmentRowDTO {
  attachmentId: number;
  followupId: number;
  attachPath: string | null;
  originalName: string | null;
  storedName: string | null;
  contentType: string | null;
  fileSize: number;
}

// -----------------------------
// Add existing claims to existing AR Follow-up List
// -----------------------------
export interface ArFollowupListOptionDTO {
  listNumber: number;
  listName: string | null;
  currentOwner?: string | null;
  assignedTo?: string | null;
  totalClaimCount?: number | null;
  visibleClaimCount?: number | null;
}

export interface ClaimStatusReport {
  id: number;

  claimNumber: string;
  source: SourceType;
  lineIndex: string;

  procedureCode: string | null;

  serviceDate: string | null;
  serviceEndDate: string | null;

  payerName: string | null;
  paymentDate: string | null;
  filename: string;

  patientFirstName: string | null;
  patientLastName: string | null;

  totalClaimAmount: number | null;
  adjustedAmount: number | null;
  patientResponsibility: number | null;
  insuranceResponsibility: number | null;
  paidAmount: number | null;
  pendingAmount: number | null;

  insurancePending: number | null;
  patientPendingAr: number | null;
  totalPendingAr: number | null;

  agingDays: number;
  agingBucket: string;

  denialCode: string | null;
  adjustmentInfoCo: string | null;
  adjustmentInfoPr: string | null;
  denialReasonText: string | null;
  denialOwner: string | null;
  transmissionDate: string | null;

  paymentStatus: string;
  payerSeq: number | null;
  pst: PstType;
  patArStatus: PatArStatusType;

  // Prediction follow-up fields
  predictionWorkStatusAtRun?: string | null;
  predictionPriorityAtRun?: string | null;
  predictionMessage?: string | null;

  // AR Follow-up enrichment fields
  listId?: number | null;
  listNumber?: number | null;
  listName?: string | null;
  currentOwner?: string | null;
  assignedTo?: string | null;
  listAction?: string | null;
  filterSummary?: string | null;

  showAra?: number | boolean | null;
  showPaya?: number | boolean | null;
  showCha?: number | boolean | null;
  showCag?: number | boolean | null;
  showClient?: number | boolean | null;
  showFrom?: string | null;

  claimId?: number | null;
  clientId?: number | null;

  latestFollowupId?: number | null;
  latestActionDate?: string | null;
  latestActionTime?: string | null;
  latestStatusId?: number | null;
  latestActId?: number | null;
  latestStatusLabel?: string | null;
  latestActionLabel?: string | null;
  latestResponsibleParty?: string | null;
  latestCategory?: string | null;
  latestUserId?: string | null;
  latestFollowupCreated?: string | null;
  latestNotes?: string | null;
  followupCount?: number | null;
  lastFollowupCreated?: string | null;

  colorFlag?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  inArWorkQueue?: boolean | null;
  workedLast30Days?: boolean | null;
}

export interface AddClaimsToExistingArListRequest {
  listNumber: number;
  requestedBy?: string | null;
  claims: Partial<ClaimStatusReport>[];
}

export interface RemoveClaimsFromExistingArListRequest {
  listNumber: number;
  claimNumbers: string[];
}
@Injectable({ providedIn: 'root' })
export class ClaimstatusService {
  private readonly apiUrl = `${environment.apiBaseUrl}/claim-status/all`;
  private readonly cellClickUrl = `${environment.apiBaseUrl}/ar-aging/cell-click`;
  private readonly manualUpdateUrl = `${environment.apiBaseUrl}/claim-status/manual-update`;

  // AR follow-up history endpoints
  private readonly arBaseUrl = `${environment.apiBaseUrl}/ar`;
  private readonly followupHistoryUrl = `${this.arBaseUrl}/followup-history`;
  // NOTE: These lookup endpoints must exist on backend. If you already have different URLs,
  // change them here only.
  private readonly statusLookupUrl = `${this.arBaseUrl}/status-lookup`;
 private readonly actionByStatusUrl = `${this.arBaseUrl}/action-lookup/by-status`;
 private readonly arAttachmentUrl = `${environment.apiBaseUrl}/arattachement/saveARattach`;
  private readonly followupAttachmentsUrl = `${this.arBaseUrl}/followup-attachments`;
  private readonly visibleArListsUrl = `${this.arBaseUrl}/showVisibleListsForRole`;
  private readonly addClaimsToExistingArListUrl = `${this.arBaseUrl}/add-claims-to-existing-list`;
  private readonly removeClaimsFromExistingArListUrl = `${this.arBaseUrl}/remove-claims-from-existing-list`;

  // Prediction follow-up list endpoints
  private readonly predictedPayerFollowupListUrl = `${environment.apiBaseUrl}/predicted-payer-followup-list`;

  constructor(private http: HttpClient) {}

  normalizeClaimStatusRow(raw: any): ClaimStatusReport {
    return this.normalizeRow(raw);
  }

  getClaimStatuses(): Observable<ClaimStatusReport[]> {
    return this.http.get<ClaimStatusReport[]>(this.apiUrl).pipe(
      map(rows => (Array.isArray(rows) ? rows : [])),
      map(rows => rows.map(r => this.normalizeRow(r)))
    );
  }

  getLatestPredictedPayerFollowupList(companyId = 160088): Observable<ClaimStatusReport[]> {
    const params = new HttpParams().set('companyId', String(companyId));

    return this.http.get<ClaimStatusReport[]>(this.predictedPayerFollowupListUrl, { params }).pipe(
      map(rows => (Array.isArray(rows) ? rows : [])),
      map(rows => rows.map(r => this.normalizeRow(r)))
    );
  }

  getPredictedPayerFollowupListByRunId(
    predictionRunId: number,
    companyId = 160088
  ): Observable<ClaimStatusReport[]> {
    const params = new HttpParams().set('companyId', String(companyId));
    const url = `${this.predictedPayerFollowupListUrl}/run/${predictionRunId}`;

    return this.http.get<ClaimStatusReport[]>(url, { params }).pipe(
      map(rows => (Array.isArray(rows) ? rows : [])),
      map(rows => rows.map(r => this.normalizeRow(r)))
    );
  }

  fetchByCellClick(range: string, bucket: string, value: number): Observable<ClaimStatusReport[]> {
    return this.http
      .post<ClaimStatusReport[]>(this.cellClickUrl, { range, bucket, value })
      .pipe(
        tap(data => console.log('fetchByCellClick →', data)),
        map(rows => (Array.isArray(rows) ? rows : [])),
        map(rows => rows.map(r => this.normalizeRow(r)))
      );
  }

  manualUpdateStatus(req: ClaimStatusManualUpdateRequest): Observable<any> {
    return this.http.post(this.manualUpdateUrl, req);
  }

  // -----------------------------
  // Existing AR Follow-up List APIs
  // -----------------------------
  getVisibleArFollowupListsForRole(): Observable<ArFollowupListOptionDTO[]> {
    return this.http.get<any[]>(this.visibleArListsUrl).pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      map((rows) =>
        rows
          .map((r) => {
            const listNumber = Number(r?.listNumber ?? r?.list_number ?? r?.id);
            return {
              listNumber: Number.isFinite(listNumber) ? listNumber : 0,
              listName: String(r?.listName ?? r?.list_name ?? '').trim() || null,
              currentOwner: String(r?.currentOwner ?? r?.current_owner ?? '').trim() || null,
              assignedTo: String(r?.assignedTo ?? r?.assigned_to ?? '').trim() || null,
              totalClaimCount: this.coerceNumber(r?.totalClaimCount ?? r?.total_claim_count),
              visibleClaimCount: this.coerceNumber(r?.visibleClaimCount ?? r?.visible_claim_count),
            } as ArFollowupListOptionDTO;
          })
          .filter((r) => r.listNumber > 0)
      )
    );
  }

  addClaimsToExistingArList(req: AddClaimsToExistingArListRequest): Observable<any> {
    return this.http.post<any>(this.addClaimsToExistingArListUrl, req);
  }

  removeClaimsFromExistingArList(req: RemoveClaimsFromExistingArListRequest): Observable<any> {
    return this.http.post<any>(this.removeClaimsFromExistingArListUrl, req);
  }

  // -----------------------------
  // AR Follow-up History APIs
  // -----------------------------
  saveFollowupHistory(req: ArFollowupHistoryCreateRequest): Observable<{ followupId: number }> {
    return this.http.post<{ followupId: number }>(`${this.followupHistoryUrl}/save`, req);
  }

  getFollowupHistoryByClaim(claimNumber: string, limit = 50): Observable<ArFollowupHistoryRowDTO[]> {
    const url = `${this.followupHistoryUrl}/by-claim/${encodeURIComponent(claimNumber)}?limit=${limit}`;
    return this.http.get<ArFollowupHistoryRowDTO[]>(url).pipe(
      map(rows => (Array.isArray(rows) ? rows : []))
    );
  }

  // -----------------------------
  // AR Follow-up Attachments APIs
  // -----------------------------
  /**
   * Fetch attachments for ALL follow-ups for a claim.
   * Backend: GET /api/ar/followup-attachments/by-claim/{claimNumber}
   */
  getFollowupAttachmentsByClaim(claimNumber: string): Observable<ArFollowupAttachmentRowDTO[]> {
    const url = `${this.followupAttachmentsUrl}/by-claim/${encodeURIComponent(claimNumber)}`;
    return this.http.get<ArFollowupAttachmentRowDTO[]>(url).pipe(
      map(rows => (Array.isArray(rows) ? rows : []))
    );
  }

  /**
   * Fetch attachments for a single followupId.
   * Backend: GET /api/ar/followup-attachments/by-followup/{followupId}
   */
  getFollowupAttachmentsByFollowup(followupId: number): Observable<ArFollowupAttachmentRowDTO[]> {
    const url = `${this.followupAttachmentsUrl}/by-followup/${followupId}`;
    return this.http.get<ArFollowupAttachmentRowDTO[]>(url).pipe(
      map(rows => (Array.isArray(rows) ? rows : []))
    );
  }

  /**
   * Upload ONE attachment for a followupId.
   * Backend: POST /api/arattachement/saveARattach (multipart/form-data)
   */
  uploadArAttachment(file: File, followupId: number, folderName: string): Observable<any> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('followupId', String(followupId));
    fd.append('folderName', String(folderName));
    return this.http.post<any>(this.arAttachmentUrl, fd);
  }
    /** Lookup list for Status dropdown.
   * Backend may return {statusId,statusLabel} or a generic LookupOption like {id,label}.
   */
  getArStatusLookup(): Observable<ArStatusLookupDTO[]> {
    return this.http.get<any[]>(this.statusLookupUrl).pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      map((rows) =>
        rows
          .map((r) => {
            const statusId = Number(r?.statusId ?? r?.id ?? r?.value ?? r?.key);
            const statusLabel = String(r?.statusLabel ?? r?.label ?? r?.name ?? r?.text ?? '').trim();
            return {
              statusId: Number.isFinite(statusId) ? statusId : 0,
              statusLabel,
            } as ArStatusLookupDTO;
          })
          .filter((r) => r.statusId > 0 && !!r.statusLabel)
      )
    );
  }

getArActionLookup(statusId: number): Observable<ArActionLookupDTO[]> {
  const url = `${this.actionByStatusUrl}/${statusId}`;
  return this.http.get<ArActionLookupDTO[]>(url).pipe(
    map(rows => (Array.isArray(rows) ? rows : []))
  );
}
  /** Lookup list for Action dropdown (expects rows with actId + actionLabel). */


  // ---------- Normalization helpers ----------
  private coerceNumber(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (!s) return null;
    // Strip currency, commas, spaces
    const n = Number(s.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  private coerceString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  private coerceEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().toUpperCase() as T;
    return (allowed as readonly string[]).includes(s) ? (s as T) : null;
  }
  private coerceBoolean(v: unknown): boolean | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;

    const s = String(v).trim().toLowerCase();
    if (!s) return null;

    if (['true', 't', '1', 'y', 'yes'].includes(s)) return true;
    if (['false', 'f', '0', 'n', 'no'].includes(s)) return false;

    return null;
  }
  // Accept FULL_PAID/PENDING/PART_PAID and common variants (e.g., "FULL PAID", "part-paid")
  private normalizePatArStatus(v: unknown): PatArStatusType {
    if (v == null) return null;
    const s = String(v).trim().toUpperCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    const map: Record<string, PatArStatusCode> = {
      'FULL_PAID': 'FULL_PAID',
      'FULLPAID': 'FULL_PAID',
      'FULL_PAID_STATUS': 'FULL_PAID',
      'PENDING': 'PENDING',
      'PART_PAID': 'PART_PAID',
      'PARTPAID': 'PART_PAID',
      'PART_PAID_STATUS': 'PART_PAID'
    };
    return (map[s] ?? this.coerceEnum<PatArStatusCode>(s, ['FULL_PAID','PENDING','PART_PAID'])) ?? null;
  }

  // Accept pst as 1/2/3, 'P'/'S'/'T', or "PST 1" → P/S/T
  private normalizePst(v: unknown): PstType {
    if (v == null) return null;
    // If number-like, map 1→P, 2→S, 3→T
    const num = this.coerceNumber(v);
    if (num != null) {
      if (num === 1) return 'P';
      if (num === 2) return 'S';
      if (num === 3) return 'T';
    }
    // If string, try to extract digit; else accept letter codes
    const s = String(v).trim().toUpperCase();
    const m = s.match(/(\d)/);
    if (m) {
      const d = Number(m[1]);
      if (d === 1) return 'P';
      if (d === 2) return 'S';
      if (d === 3) return 'T';
    }
    return this.coerceEnum<PstCode>(s, ['P','S','T']);
  }

  // Copy snake_case field -> camelCase if camelCase missing
  private aliasIfMissing(o: any, from: string, to: string): void {
    if (o[to] == null && o[from] != null) o[to] = o[from];
  }

  private normalizeRow(raw: any): ClaimStatusReport {
    const o: any = { ...raw };
    // --- snake_case fallbacks (backend aliases) ---
    this.aliasIfMissing(o, 'service_start_date', 'serviceDate');
    this.aliasIfMissing(o, 'service_end_date', 'serviceEndDate');
    this.aliasIfMissing(o, 'payer_name', 'payerName');
    this.aliasIfMissing(o, 'payment_date', 'paymentDate');
    this.aliasIfMissing(o, 'first_name', 'patientFirstName');
    this.aliasIfMissing(o, 'last_name', 'patientLastName');
    this.aliasIfMissing(o, 'total_claim_charge', 'totalClaimAmount');
    this.aliasIfMissing(o, 'insurance_pending_ar', 'insurancePending');
    this.aliasIfMissing(o, 'patient_pending_ar', 'patientPendingAr');
    this.aliasIfMissing(o, 'total_pending_ar', 'totalPendingAr');
    this.aliasIfMissing(o, 'adjustment_info_co', 'adjustmentInfoCo');
    this.aliasIfMissing(o, 'adjustment_info_pr', 'adjustmentInfoPr');
    this.aliasIfMissing(o, 'payment_status', 'paymentStatus');
    this.aliasIfMissing(o, 'pat_ar_status', 'patArStatus');
    this.aliasIfMissing(o, 'payer_seq', 'payerSeq');
    this.aliasIfMissing(o, 'denial_reason_text', 'denialReasonText');
    this.aliasIfMissing(o, 'denial_owner', 'denialOwner');
    this.aliasIfMissing(o, 'latest_followup_id', 'latestFollowupId');
    this.aliasIfMissing(o, 'latest_action_date', 'latestActionDate');
    this.aliasIfMissing(o, 'latest_action_time', 'latestActionTime');
    this.aliasIfMissing(o, 'latest_status_id', 'latestStatusId');
    this.aliasIfMissing(o, 'latest_act_id', 'latestActId');
    this.aliasIfMissing(o, 'latest_status_label', 'latestStatusLabel');
    this.aliasIfMissing(o, 'latest_action_label', 'latestActionLabel');
    this.aliasIfMissing(o, 'latest_responsible_party', 'latestResponsibleParty');
    this.aliasIfMissing(o, 'latest_category', 'latestCategory');
    this.aliasIfMissing(o, 'latest_user_id', 'latestUserId');
    this.aliasIfMissing(o, 'latest_followup_created', 'latestFollowupCreated');
    this.aliasIfMissing(o, 'latest_notes', 'latestNotes');
    this.aliasIfMissing(o, 'followup_count', 'followupCount');
    this.aliasIfMissing(o, 'last_followup_created', 'lastFollowupCreated');
this.aliasIfMissing(o, 'list_id', 'listId');
this.aliasIfMissing(o, 'list_number', 'listNumber');
this.aliasIfMissing(o, 'claim_id', 'claimId');
this.aliasIfMissing(o, 'client_id', 'clientId');
this.aliasIfMissing(o, 'list_name', 'listName');
this.aliasIfMissing(o, 'current_owner', 'currentOwner');
this.aliasIfMissing(o, 'assigned_to', 'assignedTo');
this.aliasIfMissing(o, 'list_action', 'listAction');
this.aliasIfMissing(o, 'filter_summary', 'filterSummary');
this.aliasIfMissing(o, 'color_flag', 'colorFlag');
this.aliasIfMissing(o, 'created_at', 'createdAt');
this.aliasIfMissing(o, 'updated_at', 'updatedAt');
this.aliasIfMissing(o, 'show_ara', 'showAra');
this.aliasIfMissing(o, 'show_paya', 'showPaya');
this.aliasIfMissing(o, 'show_cha', 'showCha');
this.aliasIfMissing(o, 'show_cag', 'showCag');
this.aliasIfMissing(o, 'show_client', 'showClient');
this.aliasIfMissing(o, 'in_ar_work_queue', 'inArWorkQueue');
this.aliasIfMissing(o, 'worked_last_30_days', 'workedLast30Days');

// Prediction follow-up fields from backend
this.aliasIfMissing(o, 'prediction_work_status_at_run', 'predictionWorkStatusAtRun');
this.aliasIfMissing(o, 'prediction_priority_at_run', 'predictionPriorityAtRun');
this.aliasIfMissing(o, 'prediction_message', 'predictionMessage');
    // Required strings (empty => '')
    o.claimNumber = this.coerceString(o.claimNumber) ?? '';
    o.filename    = this.coerceString(o.filename)    ?? '';

    // Nullable strings
  ([
  'procedureCode','serviceDate','serviceEndDate','payerName','paymentDate',
  'patientFirstName','patientLastName',
  'denialCode','denialReasonText','denialOwner',
  'adjustmentInfoCo','adjustmentInfoPr','agingBucket','paymentStatus',
  'latestStatusLabel','latestActionLabel','latestResponsibleParty',
  'latestCategory','latestUserId','latestNotes','latestActionDate',
  'latestActionTime','latestFollowupCreated','lastFollowupCreated',
  'listName','currentOwner','assignedTo','listAction','filterSummary',
  'createdAt','updatedAt',
  'colorFlag',
  'predictionWorkStatusAtRun','predictionPriorityAtRun','predictionMessage'
] as const).forEach(k => { o[k] = this.coerceString(o[k]); });

    // Nullable numbers
    ([
      'totalClaimAmount','adjustedAmount','patientResponsibility',
  'insuranceResponsibility','paidAmount','pendingAmount',
  'insurancePending','patientPendingAr','totalPendingAr','payerSeq',
  'listId','listNumber','claimId','clientId',
  'latestFollowupId','latestStatusId','latestActId','followupCount'
    ] as const).forEach(k => { o[k] = this.coerceNumber(o[k]); });

    // agingDays (default 0)
   o.agingDays = this.coerceNumber(o.agingDays);
    // id & lineIndex
    o.id = Number.isFinite(o.id) ? Number(o.id) : 0;
    o.lineIndex = this.coerceString(o.lineIndex) ?? '';
    o.showAra = this.coerceBoolean(o.showAra);
    o.showPaya = this.coerceBoolean(o.showPaya);
    o.showCha = this.coerceBoolean(o.showCha);
    o.showCag = this.coerceBoolean(o.showCag);
    o.showClient = this.coerceBoolean(o.showClient);
    o.inArWorkQueue = this.coerceBoolean(o.inArWorkQueue);
    o.workedLast30Days = this.coerceBoolean(o.workedLast30Days);
    // Enums
    const src = this.coerceEnum<'835'|'837'|'277'>(o.source, ['835','837','277']) ?? '835';
    o.source = src as SourceType;

    // PST normalization (P|S|T or null) from various inputs
    o.pst = this.normalizePst(o.pst);

    // Pat AR Status normalization (strict to FULL_PAID|PENDING|PART_PAID or null)
    o.patArStatus = this.normalizePatArStatus(o.patArStatus);

    // paymentStatus ensure not null
    o.paymentStatus = o.paymentStatus ?? '';

    return o as ClaimStatusReport;
  }
  downloadFollowupAttachment(attachmentId: number) {
  return this.http.get(
    `${this.arBaseUrl}/followup-attachments/getfile/${attachmentId}`,
    { responseType: 'blob', withCredentials: true }
  );
}
}
