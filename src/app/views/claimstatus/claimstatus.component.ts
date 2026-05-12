import {
  Component,
  OnInit,
  Input,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, PlatformLocation } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ClaimstatusService,
  ClaimStatusReport,
  ArStatusLookupDTO,
  ArActionLookupDTO,
  ArFollowupHistoryCreateRequest,
  ArFollowupHistoryRowDTO,
  ArFollowupAttachmentRowDTO,
  ArFollowupListOptionDTO,
} from './claimstatus.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ArFollowupService, ArFollowupCreateRequest} from '../ar-followup/ar-followup.service';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpErrorResponse,  HttpHeaders,  HttpResponse} from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
type RangeBucket = { label: string; min: number; max: number };

/**
 * UI row after collapsing multiple service-lines into a single claim row.
 * Extends the backend DTO shape so existing helpers keep working.
 */
type ClaimStatusClaimRow = ClaimStatusReport & {
  /** Count of service-lines that were collapsed into this claim row */
  __lineCount: number;
  /** The original service-lines that were collapsed into this claim row (for hover detail) */
  __lines: ClaimStatusReport[];
  /** Distinct CPT/HCPCS codes seen on the claim (for search / debug) */
  __procedureCodes: string[];
  /** Insurance status display code: PAID_FULL => F-Paid, otherwise PEND */
  __insStatus: string;
  /** Insurance pending dollars (claim-level) */
  __pending: number;
  /** Aging days (claim-level) */
  __age: number;
    /** Optional: user-maintained workflow status (UI only) */
  __workStatus?: string;
  /** Optional: user-maintained next step (UI only) */
  __workNextStep?: string;

/** Searchable concatenation */
  __haystack: string;
};

@Component({
  selector: 'app-claimstatus',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './claimstatus.component.html',
  styleUrls: ['./claimstatus.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClaimstatusComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  @Input() claimStatuses: ClaimStatusReport[] = [];
  /** Optional: shown inline in the header when viewing a saved AR Follow-Up List */
  @Input() listName: string | null = null;
  @Input() listNumber: number | string | null = null;
  @Input() isArFollowupListView = false;
  @Input() isAssignedMode = false;
  @Input() isPredictionFollowupListView = false;
  @Input() headerTitle = 'Claims Lists';
  @Input() headerSubtitle = '';
@Output() listChanged = new EventEmitter<void>();
  /**
   * ✅ FIX for template regression:
   * Template binds to [(ngModel)]="includePatientAr"
   * false = Insurance-only (default)
   * true  = Insurance + Patient (Total AR) — used ONLY for aging grids/charts & max pending cache
   */
  includePatientAr = false;
readonly commentOnlyRoles = ['CODE_AGENT', 'CHARGE_AGENT', 'PAY_AGENT', 'CLIENT'];
currentUserRole = '';
selectedRow: any;
remainderDate: string = '';
todayDate: string = '';
  // ===== Modal bits =====
  @ViewChild('statusDialog') statusDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('updateStatusDialog') updateStatusDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('attachmentInput') attachmentInput!: ElementRef<HTMLInputElement>;
  @ViewChild('addToArListDialog') addToArListDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('removeFromArListDialog') removeFromArListDialog!: ElementRef<HTMLDialogElement>;
  statusUrl!: SafeResourceUrl;

  // ===== Update Status modal (two dropdowns) =====
  updateRow: ClaimStatusClaimRow | null = null;
  // (Legacy string fields kept for backward compatibility; UI now uses lookup objects)
  updateStatusValue: string = '';
  updateNextStepValue: string = '';

  // ===== Update Status modal (lookup-driven) =====
  arStatusLookup: ArStatusLookupDTO[] = [];
  updateStatusObj: ArStatusLookupDTO | null = null;

  updateActionOptions: ArActionLookupDTO[] = [];
  updateActionObj: ArActionLookupDTO | null = null;

  updateNotes: string = '';
  notesWordCount: number = 0;

  followupHistoryRows: ArFollowupHistoryRowDTO[] = [];
  followupAttachmentsById: Record<number, ArFollowupAttachmentRowDTO[]> = {};
  followupHistoryLoading = false;
  followupHistoryError: string = '';
  followupSaveBusy = false;

private followupContext: {
  listId: number | null;
  listNumber: number | null;
  claimId: number | null;
  claimNumber: string;
  clientId: number | null;
} = {
  listId: null,
  listNumber: null,
  claimId: null,
  claimNumber: '',
  clientId: null,
};

  // ===== Attachments (Update Status modal) =====
  selectedAttachments: File[] = [];
  attachmentUploadBusy = false;
  private arStatusLookupLoaded = false;
  private arStatusLookupLoading = false;

  // ===== Update Status modal (Status + Action) =====
  /**
   * Temporary (hard-coded) Status → Action matrix.
   * Source: "RevMax AR Standardization Matrix - My Change.xlsx"
   * Replace with DB-driven values later.
   */
  private readonly statusActionMatrix = {
    "Claim recently billed": ["Allowing time for follow-up"],
    "Claim rejected": ["Corrected and resubmitted", "Need client assistance", "Forwarded to internal review", "Forwarded to coding review"],
    "Claim not on file": ["Claim resubmitted", "Resubmitted to correct payer"],
    "Claim in process": ["Allowing time for follow-up"],
    "Claim reprocessed": ["Allowing time for follow-up"],
    "Claim approved to pay": ["Allowing time for follow-up"],
    "Claim recently paid": ["Allowing time for follow-up"],
    "Claim processed": ["Allowing time for follow-up", "Moved to next responsible party", "Billed to patient"],
    "Claim paid > 30 days": ["Requested EOB for posting", "Forwarded to internal review", "Need client assistance", "Requested for check tracer", "Requested stop and reissue check"],
    "Left voicemail": ["Allowing time for follow-up"],
    "Claim status inquiry": ["Allowing time for follow-up", "Inquired through fax request", "Inquired through e-mail"],
    "Claim denied": ["Forwarded to internal review", "Need client assistance", "Forwarded to coding review", "Corrected and resubmitted", "Moved to next responsible party", "Billed to patient", "Provider write-off", "Patient write-off", "Appeal packet prepared and submitted", "Appeal sent - allowing time for follow-up", "Appeal in process", "Appeal denied - need client assistance", "Appeal denied - sent for internal review", "Appeal dispute - written off", "Second level appeal submitted", "Reconsideration sent - allowing time for follow-up", "Reconsideration in process", "Reconsideration denied - need client assistance", "Reconsideration denied - sent for internal review", "Reconsideration denied - written off"],
    "Non-workable": ["Claim paid and closed", "Claim in patient responsibility", "Claim recently worked", "Patient account not found", "Visit not found"],
  } as const;

  /** First dropdown: Status */
  updateStatusOptions = Object.keys(this.statusActionMatrix).map((s) => ({
    value: s,
    label: s,
  }));

  /** Second dropdown: Action (depends on selected Status) */
  updateNextStepOptions: Array<{ value: string; label: string }> = [];

    /** Call whenever Status changes to refresh Action options (lookup-driven). */
 onUpdateStatusChange(): void {
  if (this.isCommentOnlyRole()) {
    // Comment-only roles cannot change status/action.
    // Keep any existing values intact.
    this.cdr.markForCheck();
    return;
  }

  this.updateActionObj = null;
  this.updateActionOptions = [];

  const sid = this.updateStatusObj?.statusId;
  if (!sid) {
    this.cdr.markForCheck();
    return;
  }

  this.claimService.getArActionLookup(sid).subscribe({
    next: (rows) => {
      this.updateActionOptions = Array.isArray(rows) ? rows : [];
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error('getArActionLookup failed:', err);
      this.updateActionOptions = [];
      this.cdr.markForCheck();
    },
  });
}


  /** ===== Debug (off) ===== */
  private DEBUG = false;
  private summaryLoggedOnce = false;
  private stats = {
    pending: { directHits: 0, directNonZero: 0, computedHits: 0 },
    aging: { directHits: 0, computedHits: 0 },
  };
  private dbg(label: string, payload?: any) {
    if (!this.DEBUG) return;
    console.log(`[Claimstatus] ${label}`, payload ?? '');
  }




  currentOwner: string = localStorage.getItem('currentUserId') || 'Unknown';

  /** Hover card (claim details on mouseover — excludes claim-number link). */
  hover = {
    visible: false,
    locked: false,
    x: 0,
    y: 0,
    item: null as ClaimStatusClaimRow | null,
  };

  onIncludePatientArChange(): void {
    // Only affects the $ Pending aging grid/chart (and max pending cache),
    // not the table’s “Ins Pend” column.
    this.currentPage = 0;
    this.recomputeBothGrids();
    this.cdr.markForCheck();
  }

  private hoverHideTimer: any = null;

  showClaimHover(ev: MouseEvent, item: ClaimStatusClaimRow): void {
    if (!item) return;
    this.cancelHoverHide();
    this.hover.visible = true;
    this.hover.locked = false;
    this.hover.item = item;
    this.positionHover(ev);
    this.cdr.markForCheck();
  }

  moveClaimHover(ev: MouseEvent): void {
    if (!this.hover.visible || !this.hover.item) return;
    this.positionHover(ev);
  }

  scheduleHideClaimHover(): void {
    if (this.hover.locked) return;
    this.cancelHoverHide();
    this.hoverHideTimer = setTimeout(() => {
      if (this.hover.locked) return;
      this.hover.visible = false;
      this.hover.item = null;
      this.cdr.markForCheck();
    }, 140);
  }

  setHoverLocked(lock: boolean): void {
    this.hover.locked = lock;
    if (lock) {
      this.cancelHoverHide();
    } else {
      this.scheduleHideClaimHover();
    }
    this.cdr.markForCheck();
  }

  private cancelHoverHide(): void {
    if (this.hoverHideTimer) {
      clearTimeout(this.hoverHideTimer);
      this.hoverHideTimer = null;
    }
  }

  private positionHover(ev: MouseEvent): void {
    const pad = 12;
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;

    // Approx dimensions of the hover card; used to clamp within viewport.
    // Keep this roughly in-sync with the hover card's CSS width.
    const estW = 800;
    const estH = 460;

    // Prefer opening to the LEFT of the cursor so content on the right side of
    // the card isn't pushed off-screen when hovering near the right edge.
    let x = (ev?.clientX ?? 0) - pad - estW;
    let y = (ev?.clientY ?? 0) + pad;

    // If there isn't enough room on the left, open to the right.
    if (x < 8) x = (ev?.clientX ?? 0) + pad;

    if (x + estW > vw - 8) x = Math.max(8, vw - estW - 8);
    if (y + estH > vh - 8) y = Math.max(8, vh - estH - 8);

    this.hover.x = x;
    this.hover.y = y;
  }

  /**
   * Compact one-line adjustment summary for inline display (no tooltip needed).
   * Input format examples: "CO-45:12.34,CO-97:5" or "PR-1:10".
   */
  formatAdjustmentSummary(raw?: string | null): string {
    if (!raw) return '';
    const denialCodeMap: Record<string, string> = this.denialCodeMap || {};
    const parts = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [codeRaw, amtRaw] = entry.split(':');
        const codeLabel = (codeRaw || '').trim();
        const reasonCode =
          codeLabel
            .split('-')
            .pop()
            ?.toUpperCase()
            .replace(/[^A-Z0-9]/g, '') || '';
        const desc = denialCodeMap[reasonCode] || 'Unknown Code';
        const amount = parseFloat((amtRaw || '').trim() || '0') || 0;
        // Example: "CO-45 Exceeds fee schedule (12.34)"
        return `${codeLabel} ${desc}${
          amount ? ` (${amount.toFixed(2)})` : ''
        }`;
      });

    // Keep it short but readable.
    return parts.join('; ');
  }

  /** Queue + search */
  queue: string = 'ALL';
  private _searchText = '';
  private searchDebounce: any = null;

  get searchText() {
    return this._searchText;
  }
  set searchText(v: string) {
    this._searchText = v ?? '';
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.currentPage = 0;
      this.recomputeFilters();
      this.recomputeBothGrids();
      this.cdr.markForCheck();
    }, 150);
  }

  // ===== AR Follow-up filters =====
  /** AR Days (agingDays / arDays) */
  arDaysFrom: number | null = null;
  arDaysTo: number | null = null;

  /** AR Amount (insurance pending) */
  amountFrom: number | null = null;
  amountTo: number | null = null;

  /**
   * Payer filter:
   *   'ALL'      → all payers
   *   1          → Top 1 payer by total Ins Paid
   *   2..10      → Top N payers by total Ins Paid
   */
  payerTopN: 'ALL' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 'ALL';

  /** Payer ranking by total Ins Paid (paidAmount) */
  payerRanking: string[] = [];

  // ===== Bulk selection & actions =====
  /** Tracks the claimNumbers that the user has checked in the table. */
  selectedClaimIds = new Set<string>();

  /** Actions available in the dropdown next to the search box. */
  bulkActions = [
    { value: 'FLAG_FOR_REVIEW', label: 'Flag for review' },
    { value: 'ASSIGN_TO_AGENT', label: 'Assign to agent' },
    { value: 'EXPORT_SELECTED', label: 'Export selected' },
  ];

  /** Currently selected bulk action. */
  selectedAction: string = '';

  // ===== Add selected claims to an existing AR Follow-up List =====
  arFollowupListOptions: ArFollowupListOptionDTO[] = [];
  selectedExistingListNumber: number | null = null;
  addToExistingListLoading = false;
  addToExistingListSaving = false;
  addToExistingListError = '';

  // ===== Remove selected claims from current AR Follow-up List =====
  removeFromListSaving = false;
  removeFromListError = '';

  /** Paging & sorting */
  currentPage = 0;
  pageSize = 20;
  sortKey: keyof ClaimStatusReport = 'claimNumber';
  sortAsc = true;

  private arListPopupWindow: Window | null = null;

  private numericSortKeys = new Set<string>([
    'agingDays',
    'aging_days',
    'arDays',
    'ar_days',
    'totalClaimAmount',
    'adjustedAmount',
    'patientResponsibility',
    'paidAmount',
    'pendingAmount',
    'insuranceResponsibility',
    'insurancePending',
    'insurance_pending_ar',
    'payerSeq',
    'patientPendingAr',
    'totalPendingAr',
  ]);

  private dateSortKeys = new Set<string>([
    'serviceDate',
    'serviceEndDate',
    'paymentDate',
    'transmissionDate',
  ]);

  /** custom orders */
  private patArOrder: Record<string, number> = {
    'F-PAID': 1,
    PART_PAID: 2,
    PENDING: 3,
  };
  private pstOrder: Record<string, number> = { P: 1, S: 2, T: 3 };

  /** Drilldown (applies to both grids) */
  selectedGridRange: string | null = null;
  selectedGridBucket: string | null = null;

  /** Apex chart options */
  chartOptions: any = { type: 'bar', height: 280 };
  chartLegend: any = { show: false };
  chartPlotOptions: any = {
    bar: {
      horizontal: false,
      columnWidth: '55%',
      distributed: true,
      borderRadius: 2,
    },
  };
  chartDataLabels: any = { enabled: false };

  // Make hovered bar darker (no fading)
  public chartStates = {
    normal: { filter: { type: 'none', value: 0 } },
    hover: { filter: { type: 'darken', value: 0.35 } },
    active: { filter: { type: 'darken', value: 0.55 } },
  };
  // Ensure bars don’t go translucent
  public chartFill = { opacity: 1 };

  // color arrays per chart — must stay in sync with SCSS class colors
  private readonly CLASS_TO_HEX: Record<string, string> = {
    greenc: '#059669',      // 0-30:   emerald green
    amberc: '#059669',      // 31-60:  same green (both bands are "good")
    'light-redc': '#d97706', // 61-90:  amber
    'mid-redc': '#dc2626',   // 91-120: red
    redc: '#b91c1c',         // >120:   dark red
    maroonc: '#b91c1c',      // >120 alias
    bluec: '#e7f1ff',
  };
  claimChartColors: string[] = [];
  dollarChartColors: string[] = [];

  // ====== 2-decimal formatting for charts & cells ======
  private static readonly nf2 = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  public yAxisInt = {
    labels: {
      formatter: (val: number) => ClaimstatusComponent.nf2.format(val),
    },
  };
  public chartTooltipInt = {
    y: { formatter: (val: number) => ClaimstatusComponent.nf2.format(val) },
  };

  private popupWindow: Window | null = null;

  // ====== Max metrics & highlight ======
  private maxPendingDollarCache = 0;
  private maxAgingDaysCache = 0;
  private maxPendingClaimNumber: string | null = null;
  private maxAgingClaimNumber: string | null = null;
  public highlightClaimNumber: string | null = null;

  constructor(
    private platformLocation: PlatformLocation,
    private claimService: ClaimstatusService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private arFollowupService: ArFollowupService,
    private http: HttpClient 
  ) {}

  /** Base-href aware asset URL builder */
  private assetUrl(file: string): string {
  const baseHref = this.platformLocation.getBaseHrefFromDOM() || '/';
  const base = new URL(baseHref, window.location.origin);
  return new URL(`assets/${file}`, base).toString();
}

ngOnInit(): void {
  this.currentUserRole = this.getStoredUserRole();
  this.todayDate = this.toDateInputValue(new Date());

  this.statusUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    this.assetUrl('status.html')
  );

  window.addEventListener('message', this.handleArListMessages);

  const hasInputRows =
    Array.isArray(this.claimStatuses) && this.claimStatuses.length > 0;

  const isInputBackedContext =
    this.isArFollowupListView === true ||
    this.isAssignedMode === true ||
    this.isPredictionFollowupListView === true ||
    !!this.listNumber ||
    !!this.listName;

  // Saved AR list / assigned claims / prediction list path:
  // parent already loads rows, so do not auto-hit /claim-status/all
  if (hasInputRows) {
    this.prepareRows();
    this.recomputeFilters();
    this.recomputeBothGrids();
    this.cdr.markForCheck();
    return;
  }

  if (isInputBackedContext) {
    return;
  }

  // Normal standalone Claim Status screen only
  this.claimService.getClaimStatuses().subscribe((data) => {
    this.claimStatuses = data || [];
    this.queue = 'ALL';
    this.currentPage = 0;
    this.prepareRows();
    this.recomputeFilters();
    this.recomputeBothGrids();
    this.cdr.markForCheck();
  });
}
  ngAfterViewInit(): void {
    this.refreshChartColors();
  }

ngOnChanges(changes: SimpleChanges): void {
  if (changes['claimStatuses']) {
    this.currentPage = 0;
    this.prepareRows();
    this.recomputeFilters();
    this.recomputeBothGrids();
    this.cdr.markForCheck();
  }
}

ngOnDestroy(): void {
  window.removeEventListener('message', this.handleArListMessages);
  if (this.toastTimer) clearTimeout(this.toastTimer);
  if (this.parentRefreshTimer) clearTimeout(this.parentRefreshTimer);
  this.cancelHoverHide();
}

  /** Status dropdown groups  */
  statusGroups = [
    {
      label: 'Submission & Acks (837/999/277CA)',
      options: [
        { value: 'SUBMITTED_837', label: '837 Submitted' },
        { value: 'REJECTED_999', label: '999 Rejected' },
        { value: 'PENDING_ACK', label: 'Pending Payer Response' },
        { value: 'REJECTED_277', label: '277CA Rejected' },
        { value: 'ACCEPTED_277', label: '277CA Accepted' },
        { value: 'PENDED_277', label: '277CA Pended' },
        { value: 'NOT_ACCEPTED_277', label: '277CA Not Accepted' },
      ],
    },
    {
      label: 'Adjudication (pre-835)',
      options: [
        { value: 'PENDING_ADJ', label: 'Pending Adjudication' },
        { value: 'MEDREC_REQUESTED', label: 'Medical Records Requested' },
        { value: 'COB_REQUIRED', label: 'COB Required' },
        { value: 'REPRICING', label: 'Repricing' },
        { value: 'INFO_REQ', label: 'Info Required' },
      ],
    },
    {
      label: 'Remittance / Payment (835 outcomes)',
      options: [
        { value: 'PAID_FULL', label: 'Paid in Full' },
        { value: 'UNDERPAID', label: 'Underpaid (no denials)' },
        { value: 'PARTIALLY_DENIED', label: 'Partially Denied' },
        { value: 'ZERO_PAY', label: 'Zero Paid' },
        { value: 'DENIED', label: 'Denied' },
        { value: 'DENIED_DUP', label: 'Denied – Duplicate' },
        { value: 'NO_COVR', label: 'Not Covered' },
        { value: 'SVR_NOT', label: 'Service Not Covered' },
        { value: 'BEN_MAX', label: 'Benefit Maxed Out' },
        { value: 'INFO_REQ', label: 'Info Required' },
        { value: 'MIS_DATA', label: 'Missing / Invalid Info' },
        { value: 'W_PYR', label: 'Wrong Payer / Submit to Correct Payer' },
        { value: 'BUNDLED', label: 'Bundled' },
        { value: 'REVERSED', label: 'Reversed/Void' },
        { value: 'PRE_AUT', label: 'Precert / Auth Required' },
        { value: 'OVERPAID_RECOUP', label: 'Overpaid / Recoup' },
      ],
    },
    {
      label: 'Secondary / Tertiary (COB)',
      options: [
        { value: 'SENT_SECONDARY', label: 'Sent to Secondary' },
        { value: 'PENDING_SECONDARY', label: 'Pending Secondary' },
        { value: 'PAID_SECONDARY', label: 'Secondary Paid' },
        { value: 'DENIED_SECONDARY', label: 'Secondary Denied' },
      ],
    },
    {
      label: 'Corrections & Voids',
      options: [
        { value: 'CORRECTED_SUBMITTED', label: 'Corrected Submitted' },
        { value: 'CORRECTED_ACCEPTED', label: 'Corrected Accepted' },
        { value: 'CORRECTED_REJECTED', label: 'Corrected Rejected' },
        { value: 'VOID_SUBMITTED', label: 'Void Submitted' },
        { value: 'VOID_ACCEPTED', label: 'Void Accepted' },
      ],
    },
    {
      label: 'Patient Responsibility / AR',
      options: [
        { value: 'PR_CREATED', label: 'PR Created' },
        { value: 'PR_BILLED', label: 'PR Billed' },
        { value: 'PR_PAYMENT_PLAN', label: 'PR Payment Plan' },
        { value: 'PR_PAID_FULL', label: 'PR Paid in Full' },
        { value: 'SMALL_BAL_WO', label: 'Small Balance Write-off' },
        { value: 'COLLECTIONS', label: 'Collections' },
      ],
    },
    {
      label: 'Appeals & Post-adjudication',
      options: [
        { value: 'APPEAL_SUBMITTED', label: 'Appeal Submitted' },
        { value: 'APPEAL_UPHELD', label: 'Appeal Upheld' },
        { value: 'APPEAL_OVERTURNED', label: 'Appeal Overturned' },
        { value: 'AUDIT_PIP', label: 'Audit / Post-Payment Review' },
      ],
    },
    {
      label: 'Closure',
      options: [
        { value: 'CLOSED_PAID', label: 'Closed — Paid Correctly' },
        {
          value: 'CLOSED_DENIED_NO_APPEAL',
          label: 'Closed — Denied (No Appeal)',
        },
        { value: 'CLOSED_WRITEOFF', label: 'Closed — Write-off' },
        { value: 'CLOSED_RECOUPED', label: 'Closed — Recouped' },
      ],
    },
  ];

  private statusLabelMap: Record<string, string> = {
    SUBMITTED_837: '837 Submitted',
    REJECTED_999: '999 Rejected',
    PENDING_ACK: 'Pending Acknowledgement',
    REJECTED_277: '277 Rejected',
    ACCEPTED_277: '277 A0',
    PENDED_277: '277 Pended',
    NOT_ACCEPTED_277: '277 Not Accepted',
    PENDING_ADJ: 'Pending Adjudication',
    PEND: 'Pending',
    MEDREC_REQUESTED: 'Medical Records Requested',
    COB_REQUIRED: 'COB Required',
    REPRICING: 'Repricing',
    PAID_FULL: 'Paid in Full',
    UNDERPAID: 'Underpaid',
    PARTIALLY_DENIED: 'Partially Denied',
    ZERO_PAY: 'Zero Paid',
    DENIED: 'Denied',
    BUNDLED: 'Bundled',
    REVERSED: 'Reversed',
    OVERPAID_RECOUP: 'Overpaid / Recoup',
    SENT_SECONDARY: 'Sent to Secondary',
    PENDING_SECONDARY: 'Pending Secondary',
    PAID_SECONDARY: 'Secondary Paid',
    DENIED_SECONDARY: 'Secondary Denied',
    CORRECTED_SUBMITTED: 'Corrected Submitted',
    CORRECTED_ACCEPTED: 'Corrected Accepted',
    CORRECTED_REJECTED: 'Corrected Rejected',
    VOID_SUBMITTED: 'Void Submitted',
    VOID_ACCEPTED: 'Void Accepted',
    PR_CREATED: 'PR Created',
    PR_BILLED: 'PR Billed',
    PR_PAYMENT_PLAN: 'PR Payment Plan',
    PR_PAID_FULL: 'PR Paid in Full',
    SMALL_BAL_WO: 'Small Balance WO',
    COLLECTIONS: 'Collections',
    APPEAL_SUBMITTED: 'Appeal Submitted',
    APPEAL_UPHELD: 'Appeal Upheld',
    APPEAL_OVERTURNED: 'Appeal Overturned',
    AUDIT_PIP: 'Audit / Post-Payment Review',
    CLOSED_PAID: 'Closed — Paid',
    CLOSED_DENIED_NO_APPEAL: 'Closed — Denied (No Appeal)',
    CLOSED_WRITEOFF: 'Closed — Write-off',
    CLOSED_RECOUPED: 'Closed — Recouped',

    // 835-specific
    INFO_REQ: 'Info Required',
    MIS_DATA: 'Missing / Invalid Info',
    PRE_AUT: 'Precert / Authorization Required',
    NO_COVR: 'Not Covered',
    SVR_NOT: 'Service Not Covered',
    W_PYR: 'Submit to Correct Payer',
    BEN_MAX: 'Benefit Maximum Reached',
    DENIED_DUP: 'Denied – Duplicate',
    ZERO_PAID: 'Zero Paid',
    ['0_PAID']: 'Zero Paid',
  };

  private statusShortMap: Record<string, string> = {
    SUBMITTED_837: '837 Subm',
    REJECTED_999: '999 Rej',
    PENDING_ACK: 'Pend-PR',
    REJECTED_277: '277 Rej',
    ACCEPTED_277: '277 A0',
    PENDED_277: '277 Pend',
    NOT_ACCEPTED_277: '277 N/A',
    PENDING_ADJ: 'P-Adj',
    PEND: 'PEND',
    MEDREC_REQUESTED: 'MedRec',
    COB_REQUIRED: 'COB',
    REPRICING: 'Reprice',
    PAID_FULL: 'F-Paid',
    UNDERPAID: 'Underpd',
    PARTIALLY_DENIED: 'Part-Den',
    ZERO_PAY: '0-Paid',
    DENIED: 'Denied',
    BUNDLED: 'Bundled',
    REVERSED: 'Reversed',
    OVERPAID_RECOUP: 'Recoup',
    SENT_SECONDARY: 'Sec Sent',
    PENDING_SECONDARY: 'Sec Pend',
    PAID_SECONDARY: 'Sec Paid',
    DENIED_SECONDARY: 'Sec Den',
    CORRECTED_SUBMITTED: 'Corr Sub',
    CORRECTED_ACCEPTED: 'Corr Acc',
    CORRECTED_REJECTED: 'Corr Rej',
    VOID_SUBMITTED: 'Void Sub',
    VOID_ACCEPTED: 'Void Acc',
    PR_CREATED: 'PR Created',
    PR_BILLED: 'PR Billed',
    PR_PAYMENT_PLAN: 'PR Plan',
    PR_PAID_FULL: 'PR Paid',
    SMALL_BAL_WO: 'Small WO',
    COLLECTIONS: 'Collections',
    APPEAL_SUBMITTED: 'Appeal Sub',
    APPEAL_UPHELD: 'Appeal Uph',
    APPEAL_OVERTURNED: 'Appeal Ovt',
    AUDIT_PIP: 'Audit',
    CLOSED_PAID: 'Closed Paid',
    CLOSED_DENIED_NO_APPEAL: 'Closed Den',
    CLOSED_WRITEOFF: 'Closed WO',
    CLOSED_RECOUPED: 'Closed Rcpt',

    // 835-specific
    INFO_REQ: 'Info Req',
    MIS_DATA: 'Miss Info',
    PRE_AUT: 'Pre-Auth',
    NO_COVR: 'No Cov',
    SVR_NOT: 'Svc Not',
    W_PYR: 'Wrng Payer',
    BEN_MAX: 'Ben Max',
    DENIED_DUP: 'Den Dup',
    ['0_PAID']: '0-Paid',
  };

  /** ==================== AR Aging buckets ==================== */
  private arAmountBands: readonly RangeBucket[] = [
    { label: '>200 $', min: 200.01, max: Number.POSITIVE_INFINITY },
    { label: '176-200 $', min: 176, max: 200 },
    { label: '151-175 $', min: 151, max: 175 },
    { label: '126-150 $', min: 126, max: 150 },
    { label: '101-125 $', min: 101, max: 125 },
    { label: '51-100 $', min: 51, max: 100 },
    { label: '26-50 $', min: 26, max: 50 },
    { label: '1-25 $', min: 1, max: 25 },
  ];

  private arAgeBands: readonly RangeBucket[] = [
    { label: '0–30', min: 0, max: 30 },
    { label: '31–60', min: 31, max: 60 },
    { label: '61–90', min: 61, max: 90 },
    { label: '91–120', min: 91, max: 120 },
    { label: '>120', min: 121, max: Number.POSITIVE_INFINITY },
  ];

  /** ---------- NUMERIC HELPERS ---------- */
  private toNumber(raw: any, decimals: number | null = null): number {
    if (raw === null || raw === undefined) return 0;
    const s = String(raw).replace(/[^0-9.\-]/g, '');
    let n = parseFloat(s);
    if (isNaN(n)) n = 0;
    if (decimals === null) return n;
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }
  private normDollars(raw: any): number {
    const v = this.toNumber(raw, 2);
    return v; // keep sign
  }
  private normDays(raw: any): number {
    const v = Math.trunc(this.toNumber(raw, 0));
    return v < 0 ? 0 : v;
  }

  /** ---------- BAND INDEXERS ---------- */
  private amountBandIndex(v: number): number {
  const a = Math.abs(v);

  // skip 0 and sub-$1 noise (same behavior as before, just ABS-based)
  if (a < 1) return -1;

  if (a > 200) return 0;
  if (a >= 176) return 1;
  if (a >= 151) return 2;
  if (a >= 126) return 3;
  if (a >= 101) return 4;
  if (a >= 51) return 5;
  if (a >= 26) return 6;
  return 7;
}

  private ageBandIndex(v: number): number {
    if (v > 120) return 4;
    if (v >= 91) return 3;
    if (v >= 61) return 2;
    if (v >= 31) return 1;
    return 0;
  }

  /** ---------- Robust field resolution ---------- */
  private pickFirst<T = any>(...vals: T[]): T | undefined {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const s = typeof v === 'string' ? v.trim() : v;
      if ((s as any) !== '') return v;
    }
    return undefined;
  }
  private toDate(raw: any): Date | null {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

/**
 * Pending ($) — insurance-only
 *
 * ✅ Robust rule:
 *   1) Prefer backend-calculated insurance_pending_ar (authoritative; units-safe)
 *   2) Only if missing, fall back to NET = charge - adj - paid - PR
 */
private getPendingDollars(r: any): number {
  const direct = this.pickFirst(
    // normalized by claimstatus.service.ts
    r?.insurancePending,
    // possible backend variants
    r?.insurancePendingAr,
    r?.insurance_pending_ar,
    r?.pendingAmount,
    r?.pending_amount
  );

  if (direct !== undefined) {
    return this.toNumber(direct, 2);
  }

  // Fallback only if backend did not provide a pending field
  const total = this.num(
    r?.totalClaimAmount ??
      r?.total_claim_charge ??
      r?.total_claim_charge_amount ??
      r?.total_claim_amount ??
      0
  );
  const adj  = this.num(r?.adjustedAmount ?? r?.adjusted_amount ?? 0);
  const paid = this.num(r?.paidAmount ?? r?.paid_amount ?? 0);
  const pr   = this.num(r?.patientResponsibility ?? r?.patient_responsibility ?? 0);

  return Math.round((total - adj - paid - pr) * 100) / 100;
}


 /** Pending ($) — total AR (insurance + patient), NET (can be negative) */
private getTotalPendingDollars(r: any): number {
  const direct = this.pickFirst<number>(r?.totalPendingAr);

  if (direct !== null && direct !== undefined && !Number.isNaN(Number(direct))) {
    return this.toNumber(direct, 2); // keep sign (no clamp)
  }

  const ins = this.getPendingDollars(r);          // can be negative
  const pat = this.num(r?.patientPendingAr);      // usually >= 0
  return this.toNumber(ins + pat, 2);             // keep sign (no clamp)
}


  /** ✅ What grids/charts/max-pending should use */
  private getPendingDollarsForAging(r: any): number {
    return this.includePatientAr
      ? this.getTotalPendingDollars(r)
      : this.getPendingDollars(r);
  }

  /** Aging days */
  private getAgingDays(r: any): number {
    const direct = this.pickFirst(
      r?.agingDays,
      r?.aging_days,
      r?.arDays,
      r?.ar_days,
      r?.aging,
      r?.ageDays,
      r?.age_days,
      r?.days,
      r?.s2p_days,
      r?.service_to_payment_days,
      r?.s2p
    );
    let days = this.normDays(direct);

    if (direct !== undefined && String(direct).trim() !== '') {
      this.stats.aging.directHits++;
    }

    if (days === 0) {
      const svc = this.toDate(
        this.pickFirst(r?.serviceDate, r?.dos, r?.dateOfService, r?.svc_date)
      );
      const pay = this.toDate(
        this.pickFirst(r?.paymentDate, r?.paidDate, r?.checkDate)
      );
      const asOf = this.toDate(this.pickFirst(r?.asOfDate)) || new Date();
      if (svc) {
        const end = pay || asOf;
        const ms = end.getTime() - svc.getTime();
        if (!isNaN(ms)) days = this.normDays(Math.floor(ms / (1000 * 60 * 60 * 24)));
      }
      this.stats.aging.computedHits++;
    }
    return days;
  }

  /** ---------- Data prep & caches ---------- */
  private preparedRows: ClaimStatusClaimRow[] = [];
  private filteredRowsCache: ClaimStatusClaimRow[] = [];

  // COUNT view caches
  private gridCountCache: any = null;
  private chartSeriesCountCache: any[] = [];
  private chartXAxisCountCache: any = {};

  // DOLLAR view caches
  private gridDollarCache: any = null;
  private chartSeriesDollarCache: any[] = [];
  private chartXAxisDollarCache: any = {};

  /** Build derived fields once per dataset change */
  private prepareRows(): void {
    this.stats = {
      pending: { directHits: 0, directNonZero: 0, computedHits: 0 },
      aging: { directHits: 0, computedHits: 0 },
    };
    this.summaryLoggedOnce = false;
    this.highlightClaimNumber = null;
    this.maxPendingDollarCache = 0;
    this.maxAgingDaysCache = 0;
    this.maxPendingClaimNumber = null;
    this.maxAgingClaimNumber = null;

    // Clear selection & actions when dataset changes
    this.selectedClaimIds.clear();
    this.selectedAction = '';

    const searchKeys = [
      'claimNumber',
      'patientName',
      'patientFirstName',
      'patientLastName',
      'payerName',
      'pst',
      'patArStatus',
      'pat_ar_status',
      'patientPendingAr',
      'status',
      'paymentStatus',
      'claimStatus',
      'procedureCode',
      'cpt',
      'icd',
      'filename',
      'clinic',
      'provider',
      // AR follow-up enrichment fields
      'listName',
      'listNumber',
      'currentOwner',
      'assignedTo',
      'latestStatusLabel',
      'latestActionLabel',
      'latestNotes',

      // Prediction follow-up fields
      'predictionWorkStatusAtRun',
      'predictionPriorityAtRun',
      'predictionMessage',
      'prediction_work_status_at_run',
      'prediction_priority_at_run',
      'prediction_message',
    ];

    // 1) Prepare each service-line row with derived fields (used for grouping + fallbacks)
    const preparedLines: Array<any> = (this.claimStatuses || []).map((r: any) => {
      let patArStatus = r.patArStatus ?? r.pat_ar_status ?? r.pat_ar ?? null;

      if (!patArStatus || String(patArStatus).trim() === '') {
        const prTotal = this.num(
          r.patientResponsibility ??
            r.patient_responsibility ??
            r.patRes ??
            r.pr ??
            0
        );

        const prPending = this.num(
          r.patientPendingAr ??
            r.patient_pending_ar ??
            r.patPending ??
            r.pat_pending ??
            0
        );

        const eps = 0.005;

        if (Math.abs(prPending) < eps) {
          patArStatus = 'F-PAID';
        } else if (prTotal > 0 && Math.abs(prPending - prTotal) < eps) {
          patArStatus = 'PENDING';
        } else if (prTotal > 0 && prPending > 0 && prPending < prTotal - eps) {
          patArStatus = 'PART_PAID';
        }
      }

      const __pending = this.getPendingDollars(r); // insurance-only cache
      const __age = this.getAgingDays(r);

      const parts: string[] = [];
      for (const k of searchKeys) {
        const v = k === 'patArStatus' ? patArStatus : (r as any)[k];
        if (v !== null && v !== undefined) parts.push(String(v));
      }
      const __haystack = parts.join(' | ').toLowerCase();

      return { ...r, patArStatus, __pending, __age, __haystack };
    });

    // 2) Group service-lines by claimNumber and collapse into a single claim-level row
    const groups = new Map<string, any[]>();
    for (let i = 0; i < preparedLines.length; i++) {
      const line = preparedLines[i];
      const cn = String(line?.claimNumber ?? '').trim();
      const key = cn ? cn : `__NO_CLAIM__${line?.id ?? i}`;
      const arr = groups.get(key) ?? [];
      arr.push(line);
      groups.set(key, arr);
    }

    const minDate = (vals: Array<Date | null>): Date | null => {
      const xs = vals.filter(Boolean) as Date[];
      if (!xs.length) return null;
      return new Date(Math.min(...xs.map((d) => d.getTime())));
    };
    const maxDate = (vals: Array<Date | null>): Date | null => {
      const xs = vals.filter(Boolean) as Date[];
      if (!xs.length) return null;
      return new Date(Math.max(...xs.map((d) => d.getTime())));
    };

    const sum2 = (lines: any[], getter: (r: any) => any): number => {
      let acc = 0;
      for (const l of lines) {
        acc = this.add2(acc, this.num(getter(l)));
      }
      return acc;
    };

    const collapsed: ClaimStatusClaimRow[] = [];
    for (const [, lines] of groups) {
      const base = this.pickBestArFollowupLine(lines) ?? lines[0] ?? {};

      // Dates: show a reasonable claim-level single value
      const serviceDate = minDate(lines.map((l) => this.toDate(l?.serviceDate)));
      const transmissionDate = minDate(
        lines.map((l) => this.toDate(l?.transmissionDate))
      );
      const paymentDate = maxDate(lines.map((l) => this.toDate(l?.paymentDate)));

      // Claim-level AR days: use the MAX (worst aging) across service lines
      const agingDays = Math.max(
        0,
        ...lines.map((l) => this.normDays(l?.agingDays ?? l?.__age ?? 0))
      );

      // CPT label (One/Many) + keep the real codes in a hidden list for search
      const procedureCodes = Array.from(
        new Set(
          lines
            .map((l) => String(l?.procedureCode ?? '').trim())
            .filter((s) => !!s)
        )
      );
      const cptLabel =
        lines.length > 1 || procedureCodes.length > 1 ? 'Many' : 'One';

      // Totals (sum across service lines)
      const totalClaimAmount = sum2(lines, (l) => l?.totalClaimAmount ?? 0);
      const adjustedAmount = sum2(lines, (l) => l?.adjustedAmount ?? 0);
      const patientResponsibility = sum2(lines, (l) => l?.patientResponsibility ?? 0);
      const patientPendingAr = sum2(lines, (l) => l?.patientPendingAr ?? 0);
      const paidAmount = sum2(lines, (l) => l?.paidAmount ?? 0);

      // Insurance totals — use the same formulas the UI already uses per line, then sum
      let insuranceResponsibility = 0;
      let insurancePending = 0;
      for (const l of lines) {
        insuranceResponsibility = this.add2(
          insuranceResponsibility,
          this.displayInsuranceResponsibility(l as any)
        );
        insurancePending = this.add2(
          insurancePending,
          this.displayPending(l as any)
        );
      }

      const totalPendingAr = this.add2(patientPendingAr, insurancePending);

      // Patient AR status: F-Paid if patient pending is 0; else PEND
      const eps = 0.005;
      const patArStatus = Math.abs(patientPendingAr) < eps ? 'F-PAID' : 'PENDING';

      // Insurance status display: if ANY line is not fully paid (F-Paid), show PEND
      const __insStatus = Math.abs(insurancePending) <= eps ? 'PAID_FULL' : 'PEND';

      // Keep paymentStatus for queue logic: collapse a mixed set into a sensible single code
      const paymentStatus = this.combinePaymentStatus(lines);

      // Build claim-level search haystack (include real CPT codes even if we show One/Many)
      const parts: string[] = [];
      for (const k of searchKeys) {
        if (k === 'patArStatus') {
          parts.push(String(patArStatus));
          continue;
        }
        if (k === 'procedureCode') {
          parts.push(cptLabel);
          if (procedureCodes.length) parts.push(procedureCodes.join(' '));
          continue;
        }
        const v = (base as any)[k];
        if (v !== null && v !== undefined) parts.push(String(v));
      }
      const __haystack = parts.join(' | ').toLowerCase();
const collapsedColorFlag =
  lines.find((l) => this.normalizeColorFlag(l?.colorFlag ?? l?.color_flag) === 'RETURNED_TO_AR_AGENT')
    ?.colorFlag
  ??
  lines.find((l) => !!String(l?.colorFlag ?? l?.color_flag ?? '').trim())
    ?.colorFlag
  ??
  null;
  const claimRow: ClaimStatusClaimRow = {
  ...(base as any),
  serviceDate: serviceDate ?? (base as any).serviceDate ?? null,
  transmissionDate: transmissionDate ?? (base as any).transmissionDate ?? null,
  paymentDate: paymentDate ?? (base as any).paymentDate ?? null,
  agingDays,
  procedureCode: cptLabel,
  totalClaimAmount,
  adjustedAmount,
  patientResponsibility,
  patientPendingAr,
  paidAmount,
  insuranceResponsibility,
  insurancePending,
  pendingAmount: insurancePending,
  totalPendingAr,
  patArStatus,
  paymentStatus,
  colorFlag: collapsedColorFlag,
  predictionWorkStatusAtRun:
    (base as any).predictionWorkStatusAtRun ??
    (base as any).prediction_work_status_at_run ??
    null,
  predictionPriorityAtRun:
    (base as any).predictionPriorityAtRun ??
    (base as any).prediction_priority_at_run ??
    null,
  predictionMessage:
    (base as any).predictionMessage ??
    (base as any).prediction_message ??
    null,
  adjustmentInfoCo: null,
  adjustmentInfoPr: null,
  __lineCount: lines.length,
  __lines: lines as any,
  __procedureCodes: procedureCodes,
  __insStatus,
  __pending: insurancePending,
  __age: agingDays,
  __haystack,
};
      collapsed.push(claimRow);
    }

    this.preparedRows = collapsed;

    // Build payer ranking by total Ins Paid (paidAmount)
    const payerTotals: Record<string, number> = {};
    for (const r of this.preparedRows) {
      const name = (r.payerName ?? '').trim();
      if (!name) continue;
      const paid = this.num(r.paidAmount ?? 0);
      if (paid <= 0) continue;
      payerTotals[name] = (payerTotals[name] ?? 0) + paid;
    }
    this.payerRanking = Object.entries(payerTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }

  /**
   * When service lines are collapsed to one claim row, keep the line that has
   * the richest/latest AR follow-up metadata as the base row. Without this,
   * the first service line can wipe out latestStatusLabel/latestActionLabel.
   */
  private pickBestArFollowupLine(lines: any[]): any | null {
    if (!Array.isArray(lines) || lines.length === 0) return null;

    const score = (l: any): number => {
      let s = 0;
      if (l?.latestStatusLabel || l?.latest_status_label) s += 1000;
      if (l?.latestActionLabel || l?.latest_action_label) s += 1000;
      if (l?.latestNotes || l?.latest_notes) s += 250;
      if (l?.latestFollowupId || l?.latest_followup_id) s += 100;
      if (l?.listId || l?.list_id) s += 50;
      if (l?.listNumber || l?.list_number) s += 25;

      // Keep prediction metadata when collapsing service lines.
      if (l?.predictionWorkStatusAtRun || l?.prediction_work_status_at_run) s += 100;
      if (l?.predictionPriorityAtRun || l?.prediction_priority_at_run) s += 100;
      if (l?.predictionMessage || l?.prediction_message) s += 100;

      const latest = this.toDate(
        l?.latestFollowupCreated ??
        l?.latest_followup_created ??
        l?.lastFollowupCreated ??
        l?.last_followup_created ??
        l?.updatedAt ??
        l?.updated_at ??
        l?.createdAt ??
        l?.created_at
      );

      if (latest) s += Math.floor(latest.getTime() / 1000000000);
      return s;
    };

    return [...lines].sort((a, b) => score(b) - score(a))[0] ?? null;
  }

/** Exclude rows already present in AR team's active work queue */
  excludeInArTeamQueue = false;
  /** Exclude rows worked recently (last 30 days) */
  excludeWorkedLast30Days = false;
  /** Normalize patient AR status */
  private normalizePatAr(code?: string | null): string {
    const raw = (code ?? '').trim().toUpperCase();
    if (!raw) return '';

    if (['FULL_PAID', 'F-PAID', 'F_PAID', 'FPAID'].includes(raw)) return 'F-PAID';
    if (['PART_PAID', 'PART-PAID', 'PARTPAID', 'P-PAID'].includes(raw))
      return 'PART_PAID';
    if (raw === 'PENDING' || raw === 'PEND') return 'PENDING';

    return raw;
  }
  private toBoolean(raw: unknown): boolean | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;

    const s = String(raw).trim().toLowerCase();
    if (!s) return null;

    if (['true', 't', '1', 'y', 'yes'].includes(s)) return true;
    if (['false', 'f', '0', 'n', 'no'].includes(s)) return false;

    return null;
  }

  private isClaimCurrentlyInArWorkQueue(row: any): boolean {
    const explicit = this.pickFirst(
      row?.inArWorkQueue,
      row?.in_ar_work_queue
    );
    const explicitBool = this.toBoolean(explicit);
    if (explicitBool !== null) return explicitBool;

    const showAra = this.pickFirst(
      row?.showAra,
      row?.show_ara
    );
    const showAraBool = this.toBoolean(showAra);
    if (showAraBool !== null) return showAraBool;

    return false;
  }

  private isClaimWorkedLast30Days(row: any): boolean {
    const explicit = this.pickFirst(
      row?.workedLast30Days,
      row?.worked_last_30_days
    );
    const explicitBool = this.toBoolean(explicit);
    if (explicitBool !== null) return explicitBool;

    const dt = this.toDate(
      this.pickFirst(
        row?.updatedAt,
        row?.updated_at,
        row?.latestFollowupCreated,
        row?.lastFollowupCreated
      )
    );

    if (!dt) return false;

    const now = new Date();
    const diffMs = now.getTime() - dt.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    return diffMs >= 0 && diffMs <= thirtyDaysMs;
  }
  /** Normalize statuses (map SQL/UI variants to UI canonical) */
  private normalizeStatus(code?: string | null): string {
    const raw = String(code ?? '').trim().toUpperCase();
    if (!raw) return '';

    const k = raw
      .normalize('NFKD')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const aliases: Record<string, string> = {
      F_PAID: 'PAID_FULL',
      FULL_PAID: 'PAID_FULL',
      PAID_IN_FULL: 'PAID_FULL',

      UNDERPD: 'UNDERPAID',
      U_PAID: 'UNDERPAID',
      UPAID: 'UNDERPAID',

      INFO_REQ: 'INFO_REQ',
      INFO_REQUIRED: 'INFO_REQ',
      INFO_REQD: 'INFO_REQ',
      INFORMATION_REQUIRED: 'INFO_REQ',

      MISSING_INFO: 'MIS_DATA',
      MISSING_INFORMATION: 'MIS_DATA',
      MISSING_DATA: 'MIS_DATA',
      INVALID_INFO: 'MIS_DATA',
      INVALID_INFORMATION: 'MIS_DATA',

      PRE_AUTH: 'PRE_AUT',
      PREAUTH: 'PRE_AUT',
      PRECERT_REQUIRED: 'PRE_AUT',
      PRECERT: 'PRE_AUT',

      WRONG_PAYER: 'W_PYR',
      W_PAYER: 'W_PYR',

      NO_COVERAGE: 'NO_COVR',
      NOT_COVERED: 'NO_COVR',

      SERVICE_NOT_COVERED: 'SVR_NOT',
      SVC_NOT: 'SVR_NOT',
      SVR_NOT: 'SVR_NOT',

      BENEFIT_MAX: 'BEN_MAX',
      BENEFIT_MAXIMUM: 'BEN_MAX',
      BENEFIT_MAX_REACHED: 'BEN_MAX',

      ZERO_PAID: '0_PAID',
      ZERO_PAY: '0_PAID',

      PENDING_ACK: 'PENDING_ACK',
      PEND_ACK: 'PENDING_ACK',
      PENDING_ACKNOWLEDGEMENT: 'PENDING_ACK',
    };

    const base = aliases[k] || k;

    const squashed = base.replace(/_/g, '');
    if (
      (squashed.includes('DENIED') || squashed.includes('DEN')) &&
      squashed.includes('DUP')
    ) {
      return 'DENIED_DUP';
    }

    return base;
  }

  /**
   * Collapse multiple service-line paymentStatus values into a single claim-level paymentStatus.
   * This is used for queue filtering and sorting (separate from the simplified Ins Sts display).
   */
  private combinePaymentStatus(lines: any[]): string {
    const norms = (lines || [])
      .map((l) => this.normalizeStatus(l?.paymentStatus))
      .filter((s) => !!s);

    if (!norms.length) return '';

    const uniq = Array.from(new Set(norms));
    if (uniq.length === 1) return uniq[0];

    if (uniq.every((s) => s === 'PAID_FULL' || s === 'CLOSED_PAID'))
      return 'PAID_FULL';

    const deniedLike = new Set([
      'DENIED',
      'DENIED_DUP',
      'NO_COVR',
      'SVR_NOT',
      'BEN_MAX',
      'MIS_DATA',
      'PRE_AUT',
      'W_PYR',
      'ZERO_PAY',
      '0_PAID',
      'ZERO_PAID',
    ]);
    const anyDenied = uniq.some((s) => deniedLike.has(s));
    const anyPaid = uniq.some((s) =>
      [
        'PAID_FULL',
        'CLOSED_PAID',
        'UNDERPAID',
        'PARTIALLY_DENIED',
        'OVERPAID_RECOUP',
        'PAID_SECONDARY',
      ].includes(s)
    );

    if (anyDenied && anyPaid) return 'PARTIALLY_DENIED';
    if (anyDenied) return 'DENIED';

    if (uniq.includes('UNDERPAID')) return 'UNDERPAID';
    if (uniq.includes('PENDING_ACK')) return 'PENDING_ACK';
    if (uniq.includes('REJECTED_999')) return 'REJECTED_999';
    if (uniq.includes('REJECTED_277')) return 'REJECTED_277';

    return uniq[0];
  }

  /** Queue matcher */
  private matchesQueue(r: any, qNorm: string): boolean {
    if (!qNorm) return true;

    const psNorm = this.normalizeStatus(r?.paymentStatus);
    const cqNorm = this.normalizeStatus(this.computeQueue(r as any));

    if (qNorm === 'PENDING_ACK') {
      return psNorm === 'PENDING_ACK';
    }

    const pst = String(
      r?.pst ??
        r?.payerTier ??
        r?.payer_tier ??
        r?.payerTierCode ??
        ''
    )
      .trim()
      .toUpperCase();

    const hasSecondary = pst === 'S';

    switch (qNorm) {
      case 'PAID_SECONDARY':
        return hasSecondary && psNorm === 'PAID_FULL';

      case 'PENDING_SECONDARY': {
        const pending = this.num(
          r?.insurancePending ??
            r?.insurance_pending_ar ??
            r?.pendingAmount ??
            r?.pending_amount ??
            r?.totalPendingAr ??
            0
        );
        return hasSecondary && pending > 0;
      }

      case 'DENIED_SECONDARY':
        return (
          hasSecondary &&
          (psNorm === 'DENIED' ||
            psNorm === 'DENIED_DUP' ||
            psNorm === 'NO_COVR' ||
            psNorm === 'SVR_NOT' ||
            psNorm === 'BEN_MAX' ||
            psNorm === 'MIS_DATA' ||
            psNorm === 'PRE_AUT' ||
            psNorm === 'W_PYR' ||
            psNorm === '0_PAID')
        );

      case 'SENT_SECONDARY':
        return hasSecondary && !r?.paymentDate;
    }

    if (qNorm && psNorm && psNorm === qNorm) return true;
    if (qNorm && cqNorm === qNorm) return true;

    return false;
  }

  /** AR Follow-up filter matcher */
  private matchesArFilters(row: any): boolean {
    const hasDayFrom =
      this.arDaysFrom !== null && !Number.isNaN(this.arDaysFrom as number);
    const hasDayTo =
      this.arDaysTo !== null && !Number.isNaN(this.arDaysTo as number);
    const hasAmtFrom =
      this.amountFrom !== null && !Number.isNaN(this.amountFrom as number);
    const hasAmtTo =
      this.amountTo !== null && !Number.isNaN(this.amountTo as number);
    const hasPayer = this.payerTopN !== 'ALL';
    const hasExcludeArQueue = this.excludeInArTeamQueue === true;
    const hasExcludeWorked30 = this.excludeWorkedLast30Days === true;

    if (!hasDayFrom && !hasDayTo && !hasAmtFrom && !hasAmtTo && !hasPayer
        && !hasExcludeArQueue && !hasExcludeWorked30) {
      return true;
    }

    const age = row.__age ?? this.getAgingDays(row);

    // IMPORTANT: AR amount filters remain insurance-only
    const pending = row.__pending ?? this.getPendingDollars(row);

    const payerName = (row.payerName ?? '').trim();

    if (hasDayFrom && age < (this.arDaysFrom as number)) return false;
    if (hasDayTo && age > (this.arDaysTo as number)) return false;

    if (hasAmtFrom && pending < (this.amountFrom as number)) return false;
    if (hasAmtTo && pending > (this.amountTo as number)) return false;

    if (hasPayer) {
      const n = this.payerTopN as number;
      const allowedPayers = this.payerRanking.slice(0, n);
      if (allowedPayers.length && payerName) {
        if (!allowedPayers.includes(payerName)) return false;
      }
    }

    if (hasExcludeArQueue && this.isClaimCurrentlyInArWorkQueue(row)) {
      return false;
    }

    if (hasExcludeWorked30 && this.isClaimWorkedLast30Days(row)) {
      return false;
    }

    return true;
  }
  /** Status + search + AR filters (no drilldown here) */
  private recomputeFilters(): void {
    let base = this.preparedRows || [];

    // Queue filter
    if (this.queue && this.queue !== 'ALL') {
      if (this.queue === 'INS_PEND_GT0') {
        // ✅ insurance-only pending
        base = base.filter((r: any) => {
          const pending = (r.__pending ?? this.getPendingDollars(r)) as number;
          return pending > 0;
        });
      } else {
        const qNorm = this.normalizeStatus(this.queue);
        base = base.filter((r: any) => this.matchesQueue(r, qNorm));
      }
    }

    // Search filter
    const raw = (this._searchText || '').toLowerCase().trim();
    const terms = raw.split(/\s+/).filter(Boolean);

    let afterSearch: any[];

    if (!terms.length) {
      afterSearch = base;
    } else {
      afterSearch = base.filter((row: any) => {
        const hay = (row.__haystack || '').toLowerCase();
        if (!hay) return false;
        const match = terms.every((t) => hay.includes(t));

        if (this.DEBUG && terms.length > 1) {
          console.log('[Claimstatus multi-word search]', {
            terms,
            claimNumber: row.claimNumber,
            haystack: hay,
            match,
          });
        }

        return match;
      });
    }

    // AR follow-up filters
    const afterAr = afterSearch.filter((row: any) => this.matchesArFilters(row));

    this.filteredRowsCache = afterAr;
    this.logSummaryIfHelpful('filters');
  }

  /** Drilldown (range × bucket) applied on top of status+search+AR filters */
  private applyDrilldown(rows: any[]): any[] {
    if (!this.selectedGridRange && !this.selectedGridBucket) return rows;

    const aMap = this.amountMap();
    const bMap = this.ageMap();

    const [amin, amax] = this.selectedGridRange
      ? aMap[this.selectedGridRange] || [
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ]
      : [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    const [gmin, gmax] = this.selectedGridBucket
      ? bMap[this.selectedGridBucket] || [
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ]
      : [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    return rows.filter((r: any) => {
      // ✅ Drilldown must follow the same amount mode as the grid (toggle)
      const pending = this.getPendingDollarsForAging(r);
      const ap = Math.abs(pending);
      const age = r?.__age ?? this.getAgingDays(r);
      return ap >= amin && ap <= amax && age >= gmin && age <= gmax;
    });
  }

  /** GRID BUILDERS */
  private makeGridByCount(rows: any[]) {
    const bands = this.arAmountBands;
    const cols = this.arAgeBands;

    const cells: number[][] = Array.from({ length: bands.length }, () =>
      Array(cols.length).fill(0)
    );
    const rowTotals: number[] = Array(bands.length).fill(0);
    const colTotals: number[] = Array(cols.length).fill(0);
    let grand = 0;

   for (const r of rows) {
  const pending = this.getPendingDollarsForAging(r);
  const i = this.amountBandIndex(pending);
  if (i < 0) continue; // skips 0 and abs(<1)

  const age = r?.__age ?? this.getAgingDays(r);
  const j = this.ageBandIndex(age);

  cells[i][j] += 1;
  rowTotals[i] += 1;
  colTotals[j] += 1;
  grand += 1;
}


    return { bands, columns: cols, cells, rowTotals, colTotals, grand };
  }

  private makeGridByDollars(rows: any[]) {
    const bands = this.arAmountBands;
    const cols = this.arAgeBands;

    const cells: number[][] = Array.from({ length: bands.length }, () =>
      Array(cols.length).fill(0)
    );
    const rowTotals: number[] = Array(bands.length).fill(0);
    const colTotals: number[] = Array(cols.length).fill(0);
    let grand = 0;

   for (const r of rows) {
  const pending = this.getPendingDollarsForAging(r);
  const i = this.amountBandIndex(pending);
  if (i < 0) continue; // skips 0 and abs(<1), keeps credits

  const age = r?.__age ?? this.getAgingDays(r);
  const j = this.ageBandIndex(age);

  const p = this.toNumber(pending, 2); // keep sign

  cells[i][j] = this.add2(cells[i][j], p);
  rowTotals[i] = this.add2(rowTotals[i], p);
  colTotals[j] = this.add2(colTotals[j], p);
  grand = this.add2(grand, p);
}

    return { bands, columns: cols, cells, rowTotals, colTotals, grand };
  }

  /** Recompute both grids + charts + max metrics */
  private recomputeBothGrids(): void {
    const base = this.applyDrilldown(this.filteredRowsCache);

    this.maxPendingDollarCache = 0;
    this.maxAgingDaysCache = 0;
    this.maxPendingClaimNumber = null;
    this.maxAgingClaimNumber = null;

    for (const r of base) {
      if (r.__pending == null) r.__pending = this.getPendingDollars(r); // insurance-only cache
      if (r.__age == null) r.__age = this.getAgingDays(r);

      const claimNo = r.claimNumber != null ? String(r.claimNumber) : null;
      if (!claimNo) continue;

      const ageDisplay =
        this.num((r as any).agingDays ?? (r as any).arDays ?? (r as any).ar_days) ||
        this.num(r.__age);

      // ✅ Max pending follows toggle (grid mode)
      const pendingDisplay = this.getPendingDollarsForAging(r);

      if (pendingDisplay > this.maxPendingDollarCache) {
        this.maxPendingDollarCache = pendingDisplay;
        this.maxPendingClaimNumber = claimNo;
      }
      if (ageDisplay > this.maxAgingDaysCache) {
        this.maxAgingDaysCache = ageDisplay;
        this.maxAgingClaimNumber = claimNo;
      }
    }

    // COUNT view
    this.gridCountCache = this.makeGridByCount(base);
    const totalsC = this.gridCountCache.colTotals;
    this.chartSeriesCountCache = [{ name: '# Claims', data: totalsC }];
    this.chartXAxisCountCache = {
      categories: this.gridCountCache.columns.map((c: any) => c.label),
    };

    // DOLLAR view
    this.gridDollarCache = this.makeGridByDollars(base);
    const totalsD = this.gridDollarCache.colTotals;
    this.chartSeriesDollarCache = [{ name: '$ Pending', data: totalsD }];
    this.chartXAxisDollarCache = {
      categories: this.gridDollarCache.columns.map((c: any) => c.label),
    };

    this.refreshChartColors();
    this.logSummaryIfHelpful('grids');
  }

  /** Exposed getters for template */
  get claimGrid() {
    return this.gridCountCache;
  }
  get claimChartSeries() {
    return this.chartSeriesCountCache;
  }
  get claimChartXAxis() {
    return this.chartXAxisCountCache;
  }

  get dollarGrid() {
    return this.gridDollarCache;
  }
  get dollarChartSeries() {
    return this.chartSeriesDollarCache;
  }
  get dollarChartXAxis() {
    return this.chartXAxisDollarCache;
  }

  /** Max metrics for headers */
  public maxPendingDollar(): number {
    return this.maxPendingDollarCache || 0;
  }
  public maxAgingDays(): number {
    return this.maxAgingDaysCache || 0;
  }

  /** Band maps */
  private amountMap(): Record<string, [number, number]> {
    const m: Record<string, [number, number]> = {};
    for (const b of this.arAmountBands) m[b.label] = [b.min, b.max];
    return m;
  }
  private ageMap(): Record<string, [number, number]> {
    const m: Record<string, [number, number]> = {};
    for (const b of this.arAgeBands) m[b.label] = [b.min, b.max];
    return m;
  }

  /** Grid cell click -> set drilldown and recompute */
  @Output() cellClicked = new EventEmitter<{
    range: string;
    bucket: string;
    value: number;
  }>();

  onCellClick(range: string, bucket: string, value: number) {
    this.cellClicked.emit({ range, bucket, value });
    if (!value) return;
    this.selectedGridRange = range;
    this.selectedGridBucket = bucket;
    this.currentPage = 0;
    this.highlightClaimNumber = null;

    this.selectedClaimIds.clear();
    this.selectedAction = '';

    this.recomputeBothGrids();
    this.cdr.markForCheck();
  }

  clearDrilldown() {
    this.selectedGridRange = null;
    this.selectedGridBucket = null;
    this.currentPage = 0;
    this.highlightClaimNumber = null;

    this.selectedClaimIds.clear();
    this.selectedAction = '';

    this.recomputeBothGrids();
    this.cdr.markForCheck();
  }

  /** Column color classes (CSS from your SCSS) */
  columnClass(i: number) {
    return (
      ['greenc', 'amberc', 'light-redc', 'mid-redc', 'redc', 'maroonc', 'bluec'][i] ||
      ''
    );
  }

  /** ==================== Claims table helpers ==================== */
  statusLabel(code?: string): string {
    if (!code) return '—';
    const key = this.normalizeStatus(code);
    return (
      this.statusLabelMap[key] ||
      key
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (m) => m.toUpperCase())
    );
  }

  statusShort(code?: string): string {
    const k = this.normalizeStatus(code);
    return this.statusShortMap[k] || this.statusLabel(k);
  }

  statusBadgeClass(code?: string | null): string {
    const k = this.normalizeStatus(code);

    if (k === 'DENIED_DUP') return 'bg-danger';
    if (['PAID_FULL', 'PR_PAID_FULL', 'CLOSED_PAID'].includes(k)) return 'bg-success';

    if (
      [
        'DENIED',
        'ZERO_PAY',
        '0_PAID',
        'NO_COVR',
        'SVR_NOT',
        'BEN_MAX',
        'REJECTED_277',
        'REJECTED_999',
        'CLOSED_DENIED_NO_APPEAL',
      ].includes(k)
    )
      return 'bg-danger';

    if (
      [
        'UNDERPAID',
        'PENDED_277',
        'PARTIALLY_DENIED',
        'OVERPAID_RECOUP',
        'INFO_REQ',
        'MIS_DATA',
        'PRE_AUT',
        'W_PYR',
      ].includes(k)
    )
      return 'bg-warning text-dark';

    if (
      [
        'PENDING_ACK',
        'ACCEPTED_277',
        'SENT_SECONDARY',
        'PAID_SECONDARY',
        'PENDING_ADJ',
        'PENDING_SECONDARY',
        'PEND',
      ].includes(k)
    )
      return 'bg-info text-dark';

    if (['BUNDLED', 'REPRICING', 'COB_REQUIRED', 'MEDREC_REQUESTED'].includes(k))
      return 'bg-primary';

    if (
      [
        'REVERSED',
        'PR_BILLED',
        'PR_CREATED',
        'PR_PAYMENT_PLAN',
        'SMALL_BAL_WO',
        'COLLECTIONS',
        'CLOSED_WRITEOFF',
        'CLOSED_RECOUPED',
      ].includes(k)
    )
      return 'bg-secondary';

    return 'bg-light text-dark';
  }

  onQueueChange(): void {
    this.currentPage = 0;
    this.clearDrilldown();
    this.recomputeFilters();
    this.recomputeBothGrids();
    this.highlightClaimNumber = null;
    this.cdr.markForCheck();
  }

  /** AR filter change handler */
  onArFilterChange(): void {
    this.currentPage = 0;
    this.highlightClaimNumber = null;

    this.selectedClaimIds.clear();
    this.selectedAction = '';

    this.recomputeFilters();
    this.recomputeBothGrids();
    this.cdr.markForCheck();
  }

  /** Reset AR filters back to "no filter" */
  resetArFilters(): void {
    this.arDaysFrom = null;
    this.arDaysTo = null;
    this.amountFrom = null;
    this.amountTo = null;
    this.payerTopN = 'ALL';
    this.excludeInArTeamQueue = false;
    this.excludeWorkedLast30Days = false;
    this.onArFilterChange();
  }

  /** Legacy fallback so old queue logic doesn’t break */
  private computeQueue(item: ClaimStatusReport): string {
    const anyItem = item as any;
    const norm = (v?: unknown) => String(v ?? '').trim().toLowerCase();
    const statusText =
      norm(anyItem.status) ||
      norm(anyItem.paymentStatus) ||
      norm(anyItem.claimStatus) ||
      '';

    const has277 =
      Boolean(anyItem.has277Ack) || Boolean(anyItem.has277) || Boolean(anyItem.received277);

    const paidAmount = Number(anyItem.paidAmount ?? 0);
    const totalAmount = Number(anyItem.amount ?? anyItem.totalAmount ?? 0);

    const isFullyPaid =
      ['paid in full', 'fully paid'].some((t) => statusText.includes(t)) ||
      (totalAmount > 0 && Math.abs(paidAmount - totalAmount) < 0.01);

    const isDenied = statusText.includes('denied');
    const isPartial = statusText.includes('partially') || statusText.includes('partial');

    if (!has277 && !statusText) return 'PENDING_ACK';
    if (isFullyPaid) return 'PAID_FULL';
    if (isDenied && !isPartial) return 'DENIED';
    if (isPartial || (isDenied && paidAmount > 0)) return 'PARTIALLY_DENIED';
    if (has277) return 'PENDING_ADJ';
    return has277 ? 'PENDING_ADJ' : 'PENDING_ACK';
  }

  /** FILTERED rows that drive the table (status + search + AR + drilldown) */
  get filteredResults(): ClaimStatusClaimRow[] {
    return this.applyDrilldown(this.filteredRowsCache);
  }

  /** Sorted results helper (used by pagination & focus helpers) */
  private getSortedResults(): ClaimStatusClaimRow[] {
    const key = this.sortKey as string;
    const isNumeric = this.numericSortKeys.has(key);
    const isDate = this.dateSortKeys.has(key);

    const sorted = [...this.filteredResults].sort((a: any, b: any) => {
      const aVal = a?.[key];
      const bVal = b?.[key];

      const aNull = aVal == null,
        bNull = bVal == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      let cmp = 0;

      if (key === 'patArStatus') {
        const ao = this.patArOrder[this.normalizePatAr(aVal)] ?? 999;
        const bo = this.patArOrder[this.normalizePatAr(bVal)] ?? 999;
        cmp = ao - bo;
      } else if (key === 'pst') {
        const ao = this.pstOrder[String(aVal).toUpperCase()] ?? 999;
        const bo = this.pstOrder[String(bVal).toUpperCase()] ?? 999;
        cmp = ao - bo;
      } else if (isNumeric) {
        cmp = Number(aVal ?? 0) - Number(bVal ?? 0);
      } else if (isDate) {
        const ad = aVal ? new Date(aVal).getTime() : 0;
        const bd = bVal ? new Date(bVal).getTime() : 0;
        cmp = ad - bd;
      } else {
        const as = (aVal ?? '').toString().toLowerCase();
        const bs = (bVal ?? '').toString().toLowerCase();
        cmp = as.localeCompare(bs);
      }

      return this.sortAsc ? cmp : -cmp;
    });

    return sorted;
  }

  /** Table paging/sorting (numeric & date aware + custom orders) */
  get totalPages(): number {
    return Math.ceil(this.filteredResults.length / this.pageSize) || 1;
  }

  paginatedResults(): ClaimStatusClaimRow[] {
    const sorted = this.getSortedResults();
    const start = this.currentPage * this.pageSize;
    return sorted.slice(start, start + this.pageSize);
  }

  sortTable(key: keyof ClaimStatusReport): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.currentPage = 0;
    this.highlightClaimNumber = null;
    this.cdr.markForCheck();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.highlightClaimNumber = null;
      this.cdr.markForCheck();
    }
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.highlightClaimNumber = null;
      this.cdr.markForCheck();
    }
  }

  /** Display helpers for AR grid cells / totals (2dp) */
  cellDisplayCount(v: number): string {
    return String(v || 0);
  }
  cellDisplayDollar(v: number): string {
    return ClaimstatusComponent.nf2.format(v || 0);
  }

  /** ===== Popup: opens assets/popup.html and posts filename/claimNumber/token ===== */
  encodeFileName(filename: string): string {
    return encodeURIComponent(filename);
  }

  public openPopup(event: MouseEvent, filename: string, claimNumber: string): void {
    event.preventDefault();

    const popupUrl = new URL('assets/popup.html', document.baseURI).toString();
    const width = Math.floor(window.screen.width * 0.3);
    const height = 412;

    const w = window.open(
      popupUrl,
      '_blank',
      `width=${width},height=${height},left=0,top=0,scrollbars=yes,resizable=yes`
    );

    if (!w) {
      console.error('Popup blocked by browser or failed to open.');
      return;
    }

    const targetOrigin = window.location.origin;

    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== targetOrigin) return;
      if (e.data?.type !== 'POPUP_READY') return;

      window.removeEventListener('message', onMsg);

      try {
        const url =
          `/api/claim-status/file` +
          `?ediFilename=${encodeURIComponent(filename)}` +
          `&claimNumber=${encodeURIComponent(claimNumber)}`;

        const token = localStorage.getItem('jwtToken') || '';
        const res = await fetch(url, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        const html = await res.text();
        w.postMessage({ type: 'POPUP_RESULT', html }, targetOrigin);
      } catch (err: any) {
        w.postMessage(
          { type: 'POPUP_ERROR', error: err?.message || String(err) },
          targetOrigin
        );
      }
    };

    window.addEventListener('message', onMsg);
    w.focus();
  }

  /** ===== Modal handlers ===== */
  openStatus(event?: Event) {
    event?.preventDefault();
    const dlg = this.statusDialog?.nativeElement;
    if (dlg && !dlg.open) dlg.showModal();
  }
  closeStatus() {
    const dlg = this.statusDialog?.nativeElement;
    if (dlg && dlg.open) dlg.close();
  }
  onBackdrop(ev: MouseEvent) {
    const dlg = this.statusDialog?.nativeElement;
    if (!dlg) return;
    const rect = dlg.getBoundingClientRect();
    const inside =
      ev.clientX >= rect.left &&
      ev.clientX <= rect.right &&
      ev.clientY >= rect.top &&
      ev.clientY <= rect.bottom;
    if (!inside) this.closeStatus();
  }

  // ===== Update Status modal handlers =====

  private ensureArStatusLookupLoaded(): void {
    if (this.arStatusLookupLoaded || this.arStatusLookupLoading) return;
    this.arStatusLookupLoading = true;

    this.claimService.getArStatusLookup().subscribe({
      next: (rows) => {
        this.arStatusLookup = Array.isArray(rows) ? rows : [];
        this.arStatusLookupLoaded = true;
        this.arStatusLookupLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('getArStatusLookup failed:', err);
        this.arStatusLookup = [];
        this.arStatusLookupLoaded = false;
        this.arStatusLookupLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

private loadFollowupHistory(claimNumber: string, limit = 50): void {
  const cn = String(claimNumber || '').trim();
  if (!cn) return;

  this.followupHistoryLoading = true;
  this.followupHistoryError = '';
  this.followupHistoryRows = [];
  this.followupAttachmentsById = {};

  this.claimService
    .getFollowupHistoryByClaim(cn, limit)
    .pipe(
      switchMap((rows) =>
        this.claimService.getFollowupAttachmentsByClaim(cn).pipe(
          catchError((err) => {
            console.warn('getFollowupAttachmentsByClaim failed:', err);
            return of([] as ArFollowupAttachmentRowDTO[]);
          }),
          map((atts) => ({
            rows: Array.isArray(rows) ? rows : [],
            atts: Array.isArray(atts) ? atts : [],
          }))
        )
      ),
      finalize(() => {
        this.followupHistoryLoading = false;
        this.cdr.markForCheck();
      })
    )
    .subscribe({
      next: ({ rows, atts }) => {
        const byId: Record<number, ArFollowupAttachmentRowDTO[]> = {};

        for (const a of atts || []) {
          const fid = Number((a as any)?.followupId);
          if (!Number.isFinite(fid)) continue;
          (byId[fid] ||= []).push(a);
        }

        this.followupAttachmentsById = byId;

        this.followupHistoryRows = (rows || []).map((h: any) => ({
          followupId: h.followupId,
          actionDate: h.actionDate,
          actionTime: h.actionTime,
          statusId: h.statusId,
          statusLabel: h.statusLabel,
          actId: h.actId,
          actionLabel: h.actionLabel,
          responsibleParty: h.responsibleParty,
          category: h.category,
          userId: h.userId,
          listId: h.listId,
          claimId: h.claimId,
          claimNumber: h.claimNumber,
          clientId: h.clientId,
          notes: h.notes,
          created: h.created,
          attachments: byId[Number(h.followupId)] || [],
        }));

        // For comment-only roles, seed the disabled values from latest DB history if missing
        if (this.isCommentOnlyRole()) {
          this.seedExistingStatusActionFromHistory();
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('getFollowupHistoryByClaim failed:', err);
        this.followupHistoryError = 'Failed to load history.';
        this.followupHistoryRows = [];
        this.followupAttachmentsById = {};
      },
    });
}


updateStatus(row: ClaimStatusClaimRow): void {
  this.updateRow = row;
const r: any = row;
this.followupContext = {
  listId: this.toNullableLong(r?.listId ?? r?.list_id ?? null),
  listNumber: this.toNullableLong(r?.listNumber ?? r?.list_number ?? this.listNumber ?? null),
  claimId: this.toNullableLong(r?.claimId ?? r?.claim_id ?? null),
  claimNumber: String(r?.claimNumber ?? r?.claim_number ?? '').trim(),
  clientId: this.toNullableLong(r?.clientId ?? r?.client_id ?? null),
};

  this.updateStatusObj = null;
  this.updateActionObj = null;
  this.updateActionOptions = [];

  this.updateNotes = '';
  this.notesWordCount = 0;

  this.clearAttachments();
  this.attachmentUploadBusy = false;
  this.followupHistoryRows = [];
  this.followupAttachmentsById = {};
  this.followupHistoryError = '';
  this.followupHistoryLoading = false;

  this.ensureArStatusLookupLoaded();

  // For comment-only roles, pre-seed from the row itself so save can still work
  if (this.isCommentOnlyRole()) {
    this.seedExistingStatusActionFromRow(row);
  }

  this.loadFollowupHistory(row.claimNumber, 50);
  this.applyRoleBasedFollowupAccess();

  const dlg = this.updateStatusDialog?.nativeElement;
  if (dlg && !dlg.open) dlg.showModal();

  this.cdr.markForCheck();
}

  closeUpdateStatus(): void {
    const dlg = this.updateStatusDialog?.nativeElement;
    if (dlg && dlg.open) dlg.close();

    this.updateRow = null;
    this.updateStatusObj = null;
    this.updateActionObj = null;
    this.updateActionOptions = [];

    this.updateNotes = '';
    this.notesWordCount = 0;


    this.clearAttachments();
    this.attachmentUploadBusy = false;
        this.followupHistoryRows = [];
    this.followupAttachmentsById = {};
    this.followupHistoryLoading = false;
    this.followupHistoryError = '';

    this.followupSaveBusy = false;
    this.cdr.markForCheck();
  }

  // Keep the modal open until user explicitly clicks Close/Cancel.
  onUpdateBackdrop(_ev: MouseEvent): void {
    // no-op
  }

  onUpdateCancel(ev: Event): void {
    // Prevent ESC from closing the dialog.
    ev.preventDefault();
  }



  // -----------------------------
  // Attachments (Update Status modal)
  // -----------------------------
  openAttachmentPicker(): void {
    const el = this.attachmentInput?.nativeElement;
    if (el) el.click();
  }

  onAttachmentsSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement | null;
    if (!input || !input.files) return;

    const files = Array.from(input.files);
    for (const f of files) {
      // avoid exact duplicates (name+size+lastModified)
      const exists = this.selectedAttachments.some(
        (x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified
      );
      if (!exists) this.selectedAttachments.push(f);
    }

    // allow selecting the same file again later if removed
    input.value = '';
    this.cdr.markForCheck();
  }

  removeAttachment(index: number): void {
    if (index < 0 || index >= this.selectedAttachments.length) return;
    this.selectedAttachments.splice(index, 1);
    this.cdr.markForCheck();
  }

  clearAttachments(): void {
    this.selectedAttachments = [];
    const el = this.attachmentInput?.nativeElement;
    if (el) el.value = '';
  }

  formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v = v / 1024;
      i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  private getAttachmentFolderName(): string {
    // As requested: folderName must be passed as a parameter (example: 160088)
    // If you later want to derive it from clientId, replace this with (this.updateRow as any).clientId, etc.
    return '160088';
  }

private notifyParentListChanged(): void {
  // Do not restrict this to saved-list mode only.
  // Any parent hosting this component should be allowed to refresh its rows.
  this.listChanged.emit();
}

private applyPostSaveUiChange(
  claimNumber: string,
  filename?: string | null
): void {
  const cn = String(claimNumber || '').trim();

  // Strongest no-regression behavior for this queue/worklist screen:
  // if we know the claim number that was just saved, remove it immediately
  // from the current local dataset regardless of input flags.
  if (cn) {
    this.removeClaimFromCurrentView(cn, filename);
    return;
  }

  this.refreshAfterFollowupChange();
}

private scheduleParentListRefresh(delayMs = 300): void {
  if (this.parentRefreshTimer) {
    clearTimeout(this.parentRefreshTimer);
  }

  this.parentRefreshTimer = setTimeout(() => {
    this.listChanged.emit();
    this.parentRefreshTimer = null;
  }, delayMs);
}

private uploadAttachmentsSequentially(followupId: number): void {
  const files = [...this.selectedAttachments];
  if (!files.length) return;

  const folderName = this.getAttachmentFolderName();
  let ok = 0;
  const failed: File[] = [];

  const run = (i: number) => {
    if (i >= files.length) {
      this.attachmentUploadBusy = false;

      this.selectedAttachments = failed;

      if (failed.length === 0) {
       
        this.clearAttachments();
      } else {
        this.showToast(`Uploaded ${ok}/${files.length}. ${failed.length} failed.`, 'danger');
      }

      const savedClaimNo = String(this.updateRow?.claimNumber || '').trim();
      const savedFilename = String(this.updateRow?.filename || '').trim();

      if (savedClaimNo) {
        this.loadFollowupHistory(savedClaimNo, 50);
      }

      // Remove immediately from current screen
      this.applyPostSaveUiChange(savedClaimNo, savedFilename);

      // Ask parent to refresh as well
      this.scheduleParentListRefresh();

      // Close dialog after upload flow finishes
      this.closeUpdateStatus();

      return;
    }

    this.claimService.uploadArAttachment(files[i], followupId, folderName).subscribe({
      next: () => {
        ok++;
        run(i + 1);
      },
      error: (err) => {
        console.error('uploadArAttachment failed:', err);
        failed.push(files[i]);
        run(i + 1);
      },
    });
  };

  run(0);
}
saveUpdateStatus(): void {
  console.log('[Claimstatus] saveUpdateStatus ENTER', {
    currentUserRole: this.currentUserRole,
    isCommentOnlyRole: this.isCommentOnlyRole?.() ?? false,
    updateRow: this.updateRow,
    followupSaveBusy: this.followupSaveBusy,
    attachmentUploadBusy: this.attachmentUploadBusy,
    followupContext: (this as any).followupContext ?? null,
    updateStatusObj: this.updateStatusObj,
    updateActionObj: this.updateActionObj,
    selectedAttachmentsCount: this.selectedAttachments?.length ?? 0,
    updateNotes: this.updateNotes,
    remainderDate: this.remainderDate,
  });

  if (!this.updateRow) {
    console.warn('[Claimstatus] saveUpdateStatus EXIT -> updateRow is missing');
    return;
  }

  if (this.followupSaveBusy || this.attachmentUploadBusy) {
    console.warn('[Claimstatus] saveUpdateStatus EXIT -> busy flag active', {
      followupSaveBusy: this.followupSaveBusy,
      attachmentUploadBusy: this.attachmentUploadBusy,
    });
    return;
  }

  const now = new Date();
  const today = this.nowLocalDateYYYYMMDD(now);
  const trimmedRemainderDate = (this.remainderDate || '').trim();
  const hasRemainderDate = !!trimmedRemainderDate;

  if (trimmedRemainderDate && trimmedRemainderDate < today) {
    this.showToast('Remainder date cannot be in the past.', 'warn');
    return;
  }

  let effectiveStatusObj = this.getEffectiveStatusObj();
  let effectiveActionObj = this.getEffectiveActionObj();

  console.log('[Claimstatus] effective status/action resolved (initial)', {
    effectiveStatusObj,
    effectiveActionObj,
    hasRemainderDate,
  });

  if (hasRemainderDate && (!effectiveStatusObj || !effectiveActionObj)) {
    const anyRow: any = this.updateRow || {};

    const fallbackStatusId = this.toNullableLong(
      anyRow?.latestStatusId ??
      anyRow?.statusId ??
      anyRow?.latest_status_id ??
      null
    );

    const fallbackActId = this.toNullableLong(
      anyRow?.latestActId ??
      anyRow?.actId ??
      anyRow?.latest_act_id ??
      null
    );

    if (!effectiveStatusObj && fallbackStatusId) {
      effectiveStatusObj = {
        statusId: fallbackStatusId,
        statusLabel: String(
          anyRow?.latestStatusLabel ??
          anyRow?.statusLabel ??
          `Status #${fallbackStatusId}`
        ),
      } as ArStatusLookupDTO;
    }

    if (!effectiveActionObj && fallbackActId) {
      effectiveActionObj = {
        actId: fallbackActId,
        actionLabel: String(
          anyRow?.latestActionLabel ??
          anyRow?.actionLabel ??
          `Action #${fallbackActId}`
        ),
        responsibleParty:
          anyRow?.latestResponsibleParty ??
          anyRow?.responsibleParty ??
          null,
        category:
          anyRow?.latestCategory ??
          anyRow?.category ??
          null,
      } as ArActionLookupDTO;
    }
  }

  if (hasRemainderDate && (!effectiveStatusObj || !effectiveActionObj)) {
    this.seedExistingStatusActionFromHistory();
    effectiveStatusObj = effectiveStatusObj || this.updateStatusObj;
    effectiveActionObj = effectiveActionObj || this.updateActionObj;
  }

  const hasStatusAndAction = !!effectiveStatusObj && !!effectiveActionObj;

  console.log('[Claimstatus] effective status/action resolved (final)', {
    effectiveStatusObj,
    effectiveActionObj,
    hasRemainderDate,
    hasStatusAndAction,
  });

  if (!hasRemainderDate && !hasStatusAndAction) {
    console.warn('[Claimstatus] saveUpdateStatus EXIT -> no valid save input', {
      hasRemainderDate,
      hasStatusAndAction,
      updateStatusObj: this.updateStatusObj,
      updateActionObj: this.updateActionObj,
    });
    this.showToast('Please select both Status and Action, or choose a Remainder Date.', 'warn');
    return;
  }

  const ctx: any = (this as any).followupContext || {};
  const row: any = this.updateRow || {};

  console.log('[Claimstatus] raw ctx/row before resolving ids', {
    ctx,
    row,
    listNumberFromComponent: this.listNumber,
  });

  const resolvedListId = this.toNullableLong(
    ctx?.listId ??
    row?.listId ??
    row?.list_id ??
    null
  );

  const resolvedListNumber = this.toNullableLong(
    ctx?.listNumber ??
    row?.listNumber ??
    row?.list_number ??
    this.listNumber ??
    null
  );

  const resolvedClaimId = this.toNullableLong(
    ctx?.claimId ??
    row?.claimId ??
    row?.claim_id ??
    null
  );

  const resolvedClaimNumber = String(
    ctx?.claimNumber ??
    row?.claimNumber ??
    row?.claim_number ??
    ''
  ).trim();

  const resolvedClientId = this.toNullableLong(
    ctx?.clientId ??
    row?.clientId ??
    row?.client_id ??
    null
  );

  console.log('[Claimstatus] resolved identifiers', {
    resolvedListId,
    resolvedListNumber,
    resolvedClaimId,
    resolvedClaimNumber,
    resolvedClientId,
  });

  if (!resolvedListId) {
    console.error('[Claimstatus] saveUpdateStatus EXIT -> listId missing at save time', {
      role: this.currentUserRole,
      updateRow: this.updateRow,
      followupContext: ctx,
      resolvedListNumber,
      resolvedClaimId,
      resolvedClaimNumber,
      resolvedClientId
    });
    this.showToast('List ID is missing. Unable to save follow-up.', 'danger');
    return;
  }

  const req: ArFollowupHistoryCreateRequest = {
    actionDate: this.nowLocalDateYYYYMMDD(now),
    actionTime: this.nowLocalTimeHHMMSS(now),
    statusId: effectiveStatusObj?.statusId ?? null,
    actId: effectiveActionObj?.actId ?? null,
    responsibleParty: effectiveActionObj?.responsibleParty ?? null,
    category: effectiveActionObj?.category ?? null,
    userId: (this.currentOwner || '').trim() || null,
    listId: resolvedListId,
    listNumber: resolvedListNumber,
    claimId: resolvedClaimId,
    claimNumber: resolvedClaimNumber,
    clientId: resolvedClientId,
    notes: (this.updateNotes || '').trim() || null,
    remainderDate: trimmedRemainderDate || null
  };

  console.log('[Claimstatus] ABOUT TO POST saveFollowupHistory', {
    endpointHint: '/ar/followup-history/save',
    req,
  });

  this.followupSaveBusy = true;

  this.claimService.saveFollowupHistory(req).subscribe({
    next: (res) => {
      console.log('[Claimstatus] saveFollowupHistory SUCCESS', {
        response: res,
        request: req,
      });

      const followupId = Number(res?.followupId ?? 0);

      const savedNotes = (req.notes ?? '') || '';
      const savedStatusId = effectiveStatusObj?.statusId ?? null;
      const savedActId = effectiveActionObj?.actId ?? null;
      const savedStatusLabel = effectiveStatusObj?.statusLabel ?? '';
      const savedActionLabel = effectiveActionObj?.actionLabel ?? '';

      this.followupSaveBusy = false;
     

      const claimNo = String(req.claimNumber || '').trim();
      const filename = String(this.updateRow?.filename || '').trim();

      const matchesRow = (r: any) => {
        const rClaim = String(r?.claimNumber || '').trim();
        const rFile = String(r?.filename || '').trim();

        if (rClaim !== claimNo) return false;
        if (filename && rFile) return rFile === filename;

        return true;
      };

      (this.claimStatuses || []).forEach((r: any) => {
        if (!matchesRow(r)) return;

        r.latestFollowupId = followupId > 0 ? followupId : (r.latestFollowupId ?? null);
        r.latestActionDate = req.actionDate ?? null;
        r.latestActionTime = req.actionTime ?? null;
        r.latestStatusId = savedStatusId;
        r.latestActId = savedActId;
        r.latestStatusLabel = savedStatusLabel;
        r.latestActionLabel = savedActionLabel;
        r.latestResponsibleParty = req.responsibleParty ?? null;
        r.latestCategory = req.category ?? null;
        r.latestUserId = req.userId ?? null;
        r.latestFollowupCreated = new Date().toISOString();
        r.latestNotes = savedNotes;
        r.remainderDate = req.remainderDate ?? null;
        r.followupCount = Number(r.followupCount ?? 0) + 1;
        r.lastFollowupCreated = new Date().toISOString();
      });

      if (this.updateRow) {
        (this.updateRow as any).latestFollowupId =
          followupId > 0 ? followupId : ((this.updateRow as any).latestFollowupId ?? null);
        (this.updateRow as any).latestActionDate = req.actionDate ?? null;
        (this.updateRow as any).latestActionTime = req.actionTime ?? null;
        (this.updateRow as any).latestStatusId = savedStatusId;
        (this.updateRow as any).latestActId = savedActId;
        (this.updateRow as any).latestStatusLabel = savedStatusLabel;
        (this.updateRow as any).latestActionLabel = savedActionLabel;
        (this.updateRow as any).latestResponsibleParty = req.responsibleParty ?? null;
        (this.updateRow as any).latestCategory = req.category ?? null;
        (this.updateRow as any).latestUserId = req.userId ?? null;
        (this.updateRow as any).latestFollowupCreated = new Date().toISOString();
        (this.updateRow as any).latestNotes = savedNotes;
        (this.updateRow as any).remainderDate = req.remainderDate ?? null;
        (this.updateRow as any).followupCount =
          Number((this.updateRow as any).followupCount ?? 0) + 1;
        (this.updateRow as any).lastFollowupCreated = new Date().toISOString();
      }

      this.updateNotes = '';
      this.notesWordCount = 0;
      this.remainderDate = this.todayDate;

      if (claimNo) {
        console.log('[Claimstatus] reloading followup history after save', { claimNo });
        this.loadFollowupHistory(claimNo, 50);
      }

      if (followupId > 0 && this.selectedAttachments.length > 0) {
        console.log('[Claimstatus] starting attachment upload', {
          followupId,
          attachmentCount: this.selectedAttachments.length,
        });
        this.attachmentUploadBusy = true;
        this.cdr.markForCheck();
        this.uploadAttachmentsSequentially(followupId);
        return;
      }

      // Always remove immediately from current screen if claimNo is known
      this.applyPostSaveUiChange(claimNo, filename);

      // Always notify parent
      this.notifyParentListChanged();

      // Close the drawer after successful no-attachment save
      this.closeUpdateStatus();

      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error('[Claimstatus] saveFollowupHistory ERROR', {
        err,
        request: req,
      });
      this.followupSaveBusy = false;
      this.showToast('Failed to save follow-up', 'danger');
      this.cdr.markForCheck();
    },
  });
}
  /** ===== Denial tooltip helpers ===== */
  denialCodeMap: { [code: string]: string } = {
    '1': 'Deductible amount',
    '2': 'Coinsurance amount',
    '3': 'Co-payment amount',
    '16': 'Claim/service lacks info or submission error',
    '18': 'Exact duplicate claim/service',
    '22': 'May be covered by another payer (COB)',
    '45': 'Exceeds fee schedule / max allowable',
    '97': 'Included in allowance for another service (bundled)',
    '109': 'Claim not covered by this payer/contractor',
    '119': 'Benefit maximum reached',
    '151': 'Info does not support this level of service',
    '170': 'Denied for provider type',
    '204': 'Not covered under current benefit plan',
    '253': 'Sequestration – federal reduction',
    '260': 'Not covered under current benefit plan',
    B9: 'Patient is enrolled in a Hospice',
  };

  getFormattedAdjustmentInfo(raw?: string | null): string {
    if (!raw) return '';
    let total = 0;
    const lines = raw.split(',').map((entry) => {
      const [codeRaw, amtRaw] = entry.trim().split(':');
      const reasonCode =
        codeRaw
          ?.trim()
          .split('-')
          .pop()
          ?.toUpperCase()
          .replace(/[^A-Z0-9]/g, '') || '';
      const amount = parseFloat(amtRaw || '0') || 0;
      total += amount;
      const denialCodeMap: Record<string, string> = this.denialCodeMap || {};
      const desc = denialCodeMap[reasonCode] || 'Unknown Code';
      return `${amount.toFixed(2)} ${desc} Code: ${reasonCode}`;
    });
    lines.push(`Total: ${total.toFixed(2)}`);
    return lines.join('\n');
  }

  /** ===== Template helpers ===== */
  get totalCount(): number {
    return this.filteredResults.length;
  }
  trackByClaim = (_: number, r: any) => r?.claimNumber ?? r?.id ?? _;
  trackByIdx = (i: number, _row: any) => i;

  /** ======= Debug summary ======= */
  private logSummaryIfHelpful(context: 'filters' | 'grids') {
    if (!this.DEBUG) return;
    if (this.summaryLoggedOnce && context === 'filters') return;

    const rows = this.filteredRowsCache;
    const n = rows.length;
    if (!n) {
      this.dbg('SUMMARY: 0 rows after filters');
      this.summaryLoggedOnce = true;
      return;
    }

    const bandCounts = Array(this.arAmountBands.length).fill(0);
    const agesCounts = Array(this.arAgeBands.length).fill(0);
    const pendings: number[] = new Array(n);
    let subDollar = 0;

    for (let i = 0; i < n; i++) {
      const p = rows[i].__pending;
      const a = rows[i].__age;
      const bi = this.amountBandIndex(p);
      if (bi >= 0) bandCounts[bi]++;
      else subDollar++;
      agesCounts[this.ageBandIndex(a)]++;
      pendings[i] = p;
    }

    const counted = bandCounts.reduce((acc, v) => acc + v, 0);
    const pSorted = [...pendings].sort((x, y) => x - y);
    const q = (k: number) =>
      pSorted[Math.min(n - 1, Math.max(0, Math.floor(k * (n - 1))))];
    const share1to25 = counted ? bandCounts[7] / counted : 0;

    const msg =
      `SUMMARY rows=${n} | pending[ min=${q(0).toFixed(2)}, q1=${q(0.25).toFixed(
        2
      )}, median=${q(0.5).toFixed(2)}, q3=${q(0.75).toFixed(
        2
      )}, max=${q(1).toFixed(2)} ] ` +
      `| < $1 excluded=${subDollar} | 1–25$ share among counted=${(
        share1to25 * 100
      ).toFixed(1)}% ` +
      `| directPendingHits=${this.stats.pending.directHits} (nonZero=${this.stats.pending.directNonZero}) ` +
      `computedPendingHits=${this.stats.pending.computedHits} | agingDirect=${this.stats.aging.directHits} agingComputed=${this.stats.aging.computedHits}`;

    this.dbg(msg);
    console.table(
      this.arAmountBands.map((b, i) => ({
        band: b.label,
        count: bandCounts[i],
      }))
    );

    this.summaryLoggedOnce = true;
  }

  /** ===== Colors builder ===== */
  private buildChartColorsFromGrid(grid: { columns: any[] } | undefined): string[] {
    if (!grid?.columns?.length) return [];
    return grid.columns.map((_, idx) => {
      const cls = String(this.columnClass(idx));
      const key = Object.keys(this.CLASS_TO_HEX).find((k) => cls.includes(k));
      return key ? this.CLASS_TO_HEX[key] : '#d9d9d9';
    });
  }

  private refreshChartColors(): void {
    this.claimChartColors = this.buildChartColorsFromGrid(this.claimGrid);
    this.dollarChartColors = this.buildChartColorsFromGrid(this.dollarGrid);
  }

  private add2(a: number, b: number): number {
    return Math.round((a + b) * 100) / 100;
  }

  private num(v: unknown): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  public displayInsuranceResponsibility(item: ClaimStatusReport): number {
    const incResField = this.num(item.insuranceResponsibility);
    if (incResField > 0) return incResField;

    const paid = this.num(item.paidAmount);
    const adj = this.num(item.adjustedAmount);
    const pr = this.num(item.patientResponsibility);
    const tot = this.num(item.totalClaimAmount);

    const pendRaw = this.num(
      (item as any).insurancePending ??
        (item as any).pendingAmount ??
        (item as any).totalPendingAr
    );

    if (adj > 0 && pr >= 0) {
      const incRes = paid + Math.max(adj - pr, 0);
      if (incRes >= 0) return incRes;
    }

    if (tot > 0 && pr >= 0) {
      const incRes = Math.max(tot - pr - pendRaw, 0);
      return incRes;
    }

    return Math.max(paid + adj, 0);
  }

  public displayPending(item: ClaimStatusReport): number {
    // Table column “Ins Pend” must stay insurance-only
    return this.getPendingDollars(item as any);
  }

  patArBadgeClass(code?: string | null): string {
    const k = this.normalizePatAr(code);
    if (k === 'F-PAID') return 'badge bg-success';
    if (k === 'PENDING') return 'badge bg-danger';
    if (k === 'PART_PAID') return 'badge bg-warning text-dark';
    return 'badge bg-secondary';
  }

  patArLabel(code?: string | null): string {
    const k = this.normalizePatAr(code);
    if (!k) return '—';
    if (k === 'F-PAID') return 'F-Paid';
    if (k === 'PART_PAID') return 'P-Paid';
    if (k === 'PENDING') return 'PEND';
    return (code ?? '').replace(/_/g, ' ');
  }

  patArBadge(status?: string | null): string {
    return this.patArBadgeClass(status);
  }
  patArText(status?: string | null): string {
    return this.patArLabel(status);
  }

  /** ===== Bulk selection helpers ===== */
  isClaimSelected(claimNumber: string | number | null | undefined): boolean {
    if (claimNumber == null) return false;
    return this.selectedClaimIds.has(String(claimNumber));
  }

  onClaimToggle(
    checked: boolean,
    claimNumber: string | number | null | undefined,
    row?: ClaimStatusClaimRow | null
  ): void {
    if (claimNumber == null) return;

    if (checked && row && !this.canSelectClaimForCurrentBulkAction(row)) {
      return;
    }

    const id = String(claimNumber);
    if (checked) this.selectedClaimIds.add(id);
    else this.selectedClaimIds.delete(id);

    this.cdr.markForCheck();
  }

  applyBulkAction(): void {
    if (!this.selectedAction) {
      console.log('[Claimstatus] No bulk action selected.');
      return;
    }
    if (!this.selectedClaimIds.size) {
      console.log(
        '[Claimstatus] No claims selected for bulk action:',
        this.selectedAction
      );
      return;
    }

    const ids = Array.from(this.selectedClaimIds);
    console.log('[Claimstatus] Bulk action selected:', this.selectedAction);
    console.log('[Claimstatus] Claim IDs selected:', ids);
  }

  /** ====== Focus helpers for max claim ====== */
  private focusRowByClaimNumber(claimNumber: string): void {
    if (!claimNumber) return;

    const sorted = this.getSortedResults();
    const idx = sorted.findIndex(
      (r: any) => String(r.claimNumber) === String(claimNumber)
    );
    if (idx === -1) return;

    const newPage = Math.floor(idx / this.pageSize);
    this.currentPage = newPage;
    this.highlightClaimNumber = String(claimNumber);
    this.cdr.markForCheck();

    setTimeout(() => {
      const el = document.getElementById(`claim-${claimNumber}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  public focusMaxPendingClaim(): void {
    if (!this.maxPendingClaimNumber) return;
    this.focusRowByClaimNumber(this.maxPendingClaimNumber);
  }

  public focusMaxAgingClaim(): void {
    if (!this.maxAgingClaimNumber) return;
    this.focusRowByClaimNumber(this.maxAgingClaimNumber);
  }

  selectablePageItems(): ClaimStatusClaimRow[] {
    return this.paginatedResults().filter((item) => this.canSelectClaimForCurrentBulkAction(item));
  }

  isPageFullySelected(): boolean {
    const pageItems = this.selectablePageItems();
    if (!pageItems.length) return false;
    return pageItems.every((item) => this.isClaimSelected(item.claimNumber));
  }

  isPagePartiallySelected(): boolean {
    const pageItems = this.selectablePageItems();
    if (!pageItems.length) return false;
    const selectedCount = pageItems.filter((item) => this.isClaimSelected(item.claimNumber)).length;
    return selectedCount > 0 && selectedCount < pageItems.length;
  }

  onTogglePageSelection(checked: boolean): void {
    const pageItems = this.selectablePageItems();

    for (const item of pageItems) {
      const claimNumber = item.claimNumber;
      if (claimNumber == null) continue;

      const id = String(claimNumber);
      if (checked) this.selectedClaimIds.add(id);
      else this.selectedClaimIds.delete(id);
    }

    this.cdr.markForCheck();
  }

  get selectedClaimCount(): number {
    return this.selectedClaimIds.size;
  }

  canUseClaimSelection(): boolean {
    return this.canUseAddToExistingArList() || this.canUseRemoveFromExistingArList();
  }

  canUseAddToExistingArList(): boolean {
    const role = (this.currentUserRole || this.getStoredUserRole()).toUpperCase().trim();
    const allowedRole = ['SUPER_ADMIN', 'ADMIN', 'AR_MANAGER'].includes(role);

    // Add-to-existing-list is meant for the main claim status list only.
    return allowedRole && !this.isArFollowupListView && !this.isAssignedMode && !this.listNumber;
  }

  canUseRemoveFromExistingArList(): boolean {
    const role = (this.currentUserRole || this.getStoredUserRole()).toUpperCase().trim();
    const allowedRole = ['SUPER_ADMIN', 'ADMIN', 'AR_MANAGER'].includes(role);

    // Remove-from-list is meant only inside a saved AR follow-up list details view.
    return allowedRole && this.isArFollowupListView && !this.isAssignedMode && !!this.getCurrentListNumberForUpdate();
  }

  isClaimInAnyArFollowupList(row: any): boolean {
    const listName = String(row?.listName ?? row?.list_name ?? '').trim();
    const listNumber = row?.listNumber ?? row?.list_number;
    const listId = row?.listId ?? row?.list_id;

    return !!(
      listName ||
      (listNumber !== null && listNumber !== undefined && String(listNumber).trim() !== '') ||
      (listId !== null && listId !== undefined && String(listId).trim() !== '') ||
      row?.inArWorkQueue === true
    );
  }

  canSelectClaimForExistingArList(row: any): boolean {
    return this.canUseAddToExistingArList() && !this.isClaimInAnyArFollowupList(row);
  }

  canSelectClaimForRemovalFromExistingArList(row: any): boolean {
    if (!this.canUseRemoveFromExistingArList()) return false;
    const claimNumber = String(row?.claimNumber ?? row?.claim_number ?? '').trim();
    return !!claimNumber;
  }

  canSelectClaimForCurrentBulkAction(row: any): boolean {
    if (this.canUseAddToExistingArList()) {
      return this.canSelectClaimForExistingArList(row);
    }

    if (this.canUseRemoveFromExistingArList()) {
      return this.canSelectClaimForRemovalFromExistingArList(row);
    }

    return false;
  }

  claimSelectionDisabledTitle(row: any): string {
    if (this.canUseAddToExistingArList() && this.isClaimInAnyArFollowupList(row)) {
      return 'Already in an AR follow-up list';
    }

    if (this.canUseRemoveFromExistingArList()) {
      return 'Claim number is missing';
    }

    return 'Selection not available';
  }

  selectedRowsForExistingArList(): ClaimStatusClaimRow[] {
    if (!this.selectedClaimIds.size) return [];

    const selected = new Set(Array.from(this.selectedClaimIds).map((x) => String(x)));
    return this.filteredResults.filter(
      (row) => selected.has(String(row.claimNumber)) && this.canSelectClaimForExistingArList(row)
    );
  }

  selectedRowsForRemovalFromExistingArList(): ClaimStatusClaimRow[] {
    if (!this.selectedClaimIds.size) return [];

    const selected = new Set(Array.from(this.selectedClaimIds).map((x) => String(x)));
    return this.filteredResults.filter(
      (row) => selected.has(String(row.claimNumber)) && this.canSelectClaimForRemovalFromExistingArList(row)
    );
  }

  openAddToExistingArListDialog(): void {
    const rows = this.selectedRowsForExistingArList();
    if (!rows.length) {
      this.showToast('Select at least one claim that is not already in an AR list.', 'warn');
      return;
    }

    this.selectedExistingListNumber = null;
    this.addToExistingListError = '';
    this.loadArFollowupListOptions();

    const dlg = this.addToArListDialog?.nativeElement;
    if (dlg && !dlg.open) dlg.showModal();

    this.cdr.markForCheck();
  }

  closeAddToExistingArListDialog(): void {
    const dlg = this.addToArListDialog?.nativeElement;
    if (dlg && dlg.open) dlg.close();

    this.addToExistingListError = '';
    this.selectedExistingListNumber = null;
    this.cdr.markForCheck();
  }

  onAddToExistingArListBackdrop(event: MouseEvent): void {
    const dlg = this.addToArListDialog?.nativeElement;
    if (!dlg || event.target !== dlg) return;

    const rect = dlg.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside && !this.addToExistingListSaving) {
      this.closeAddToExistingArListDialog();
    }
  }

  onAddToExistingArListCancel(event: Event): void {
    if (this.addToExistingListSaving) {
      event.preventDefault();
      return;
    }
    this.closeAddToExistingArListDialog();
  }

  private loadArFollowupListOptions(): void {
    this.addToExistingListLoading = true;
    this.addToExistingListError = '';

    this.claimService
      .getVisibleArFollowupListsForRole()
      .pipe(
        finalize(() => {
          this.addToExistingListLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (rows) => {
          this.arFollowupListOptions = rows || [];
          if (this.arFollowupListOptions.length === 1) {
            this.selectedExistingListNumber = this.arFollowupListOptions[0].listNumber;
          }
        },
        error: (err) => {
          console.error('[Claimstatus] Failed to load AR follow-up lists', err);
          this.arFollowupListOptions = [];
          this.addToExistingListError = 'Unable to load AR follow-up lists.';
        },
      });
  }

  confirmAddSelectedClaimsToExistingList(): void {
    const listNumber = this.selectedExistingListNumber;
    const rows = this.selectedRowsForExistingArList();

    if (!listNumber || !rows.length || this.addToExistingListSaving) {
      return;
    }

    const claimsClean = rows.map((r: any) => this.stripUiFieldsForSave(r));

    this.addToExistingListSaving = true;
    this.addToExistingListError = '';

    this.claimService
      .addClaimsToExistingArList({
        listNumber,
        requestedBy: this.currentOwner,
        claims: claimsClean,
      })
      .pipe(
        finalize(() => {
          this.addToExistingListSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          const selectedList = this.arFollowupListOptions.find((x) => x.listNumber === listNumber);
          this.markSelectedClaimsAsAddedToArList(listNumber, selectedList?.listName ?? null);

          const count = rows.length;
          this.selectedClaimIds.clear();
          this.closeAddToExistingArListDialog();
          this.refreshAfterFollowupChange();
          this.listChanged.emit();
          this.showToast(`${count} claim${count === 1 ? '' : 's'} added to AR follow-up list.`, 'success');
        },
        error: (err) => {
          console.error('[Claimstatus] Failed to add selected claims to existing AR list', err);
          this.addToExistingListError = 'Unable to add selected claims to the selected AR list.';
          this.showToast(this.addToExistingListError, 'danger');
        },
      });
  }

  private markSelectedClaimsAsAddedToArList(listNumber: number, listName: string | null): void {
    const selected = new Set(Array.from(this.selectedClaimIds).map((x) => String(x)));

    this.claimStatuses = (this.claimStatuses || []).map((row: any) => {
      if (!selected.has(String(row?.claimNumber ?? row?.claim_number ?? ''))) {
        return row;
      }

      return {
        ...row,
        listNumber,
        list_number: listNumber,
        listName,
        list_name: listName,
        inArWorkQueue: true,
        in_ar_work_queue: true,
      };
    });
  }

  openRemoveSelectedClaimsFromExistingListDialog(): void {
    const rows = this.selectedRowsForRemovalFromExistingArList();

    if (!rows.length) {
      this.showToast('Select at least one claim to remove from this AR follow-up list.', 'warn');
      return;
    }

    this.removeFromListError = '';

    const dlg = this.removeFromArListDialog?.nativeElement;
    if (dlg && !dlg.open) dlg.showModal();

    this.cdr.markForCheck();
  }

  closeRemoveSelectedClaimsFromExistingListDialog(): void {
    const dlg = this.removeFromArListDialog?.nativeElement;
    if (dlg && dlg.open) dlg.close();

    this.removeFromListError = '';
    this.cdr.markForCheck();
  }

  onRemoveFromExistingArListBackdrop(event: MouseEvent): void {
    const dlg = this.removeFromArListDialog?.nativeElement;
    if (!dlg || event.target !== dlg) return;

    const rect = dlg.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside && !this.removeFromListSaving) {
      this.closeRemoveSelectedClaimsFromExistingListDialog();
    }
  }

  onRemoveFromExistingArListCancel(event: Event): void {
    if (this.removeFromListSaving) {
      event.preventDefault();
      return;
    }
    this.closeRemoveSelectedClaimsFromExistingListDialog();
  }

  confirmRemoveSelectedClaimsFromExistingList(): void {
    const listNumber = this.getCurrentListNumberForUpdate();
    const rows = this.selectedRowsForRemovalFromExistingArList();

    if (!listNumber || !rows.length || this.removeFromListSaving) {
      return;
    }

    const claimNumbers = Array.from(
      new Set(
        rows
          .map((row: any) => String(row?.claimNumber ?? '').trim())
          .filter((claimNumber) => !!claimNumber)
      )
    );

    if (!claimNumbers.length) {
      this.showToast('Selected rows do not have valid claim numbers.', 'warn');
      return;
    }

    this.removeFromListSaving = true;
    this.removeFromListError = '';

    this.claimService
      .removeClaimsFromExistingArList({
        listNumber,
        claimNumbers,
      })
      .pipe(
        finalize(() => {
          this.removeFromListSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.removeSelectedClaimsFromLocalRows(claimNumbers);
          this.selectedClaimIds.clear();
          this.closeRemoveSelectedClaimsFromExistingListDialog();
          this.refreshAfterFollowupChange();
          this.listChanged.emit();
          this.showToast(`${claimNumbers.length} claim${claimNumbers.length === 1 ? '' : 's'} removed from AR follow-up list.`, 'success');
        },
        error: (err) => {
          console.error('[Claimstatus] Failed to remove selected claims from AR list', err);
          this.removeFromListError = 'Unable to remove selected claims from this AR follow-up list.';
          this.showToast(this.removeFromListError, 'danger');
        },
      });
  }

  private removeSelectedClaimsFromLocalRows(claimNumbers: string[]): void {
    const selected = new Set(claimNumbers.map((x) => String(x).trim()));

    this.claimStatuses = (this.claimStatuses || []).filter((row: any) => {
      const claimNumber = String(row?.claimNumber ?? row?.claim_number ?? '').trim();
      return !selected.has(claimNumber);
    });
  }

  private getCurrentListNumberForUpdate(): number | null {
    const raw = this.listNumber;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  public openArListPopup(event: MouseEvent): void {
    event.preventDefault();

    if (!this.filteredResults.length) {
      console.warn('[Claimstatus] No filtered results, AR list popup not opened.');
      return;
    }

    const url = this.assetUrl('CreateARList.html');
    console.log('[Claimstatus] Opening AR List popup at URL:', url);

    const width = 950;
    const height = 350;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + 100);

    const features =
      `popup=yes,` +
      `width=${width},height=${height},` +
      `left=${left},top=${top},` +
      `resizable=yes,scrollbars=no`;

    if (this.arListPopupWindow && !this.arListPopupWindow.closed) {
      this.arListPopupWindow.close();
    }

    const win = window.open(url, 'CreateARListWindow', features);
    if (!win) {
      console.error('[Claimstatus] Popup blocked by browser.');
      alert('Please allow pop-ups for this site to use the "Create AR List" feature.');
      return;
    }

    this.arListPopupWindow = win;

    const filters = this.buildArFilterSummary();

    win.onload = () => {
      try {
        win.postMessage({ kind: 'AR_LIST_CONTEXT', filters }, window.location.origin);
      } catch (e) {
        console.error('[Claimstatus] Failed to post filters to popup:', e);
      }
    };

    win.focus();
  }

private toIntFlag(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;

  const s = String(value).trim().toLowerCase();

  if (['true', 't', 'yes', 'y'].includes(s)) return 1;
  if (['false', 'f', 'no', 'n'].includes(s)) return 0;

  return null;
}

/**
 * Final safety-net before sending payload to Java.
 * Converts every remaining true/false value in the object to 1/0.
 * This prevents Jackson Integer deserialization errors.
 */
private convertBooleansToIntegerFlags(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.map((x) => this.convertBooleansToIntegerFlags(x));
  }

  if (typeof value === 'object') {
    const out: any = {};

    Object.entries(value).forEach(([key, val]) => {
      out[key] = this.convertBooleansToIntegerFlags(val);
    });

    return out;
  }

  return value;
}
private normalizeDateForPayload(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Already a string like "2026-01-15" or "2026-01-15T00:00:00.000Z"
  if (typeof value === 'string') {
    return value;
  }

  // JavaScript Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }

  // Sometimes date can come as object from UI/library/backend
  if (typeof value === 'object') {
    // Handle common object format: { year: 2026, month: 1, day: 15 }
    const year = value.year ?? value.yyyy;
    const month = value.month ?? value.mm;
    const day = value.day ?? value.dd;

    if (year && month && day) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }

    // Handle object format: { date: "2026-01-15" }
    if (value.date) {
      return this.normalizeDateForPayload(value.date);
    }

    // Handle object format: { value: "2026-01-15" }
    if (value.value) {
      return this.normalizeDateForPayload(value.value);
    }

    // Unsupported object should not be sent to Java Date field
    return null;
  }

  return String(value);
}
private stripUiFieldsForSave(row: any): any {
  const clean = row ?? {};

  return this.convertBooleansToIntegerFlags({
    id: clean.id ?? null,
    claimNumber: clean.claimNumber ?? null,
    source: clean.source ?? null,
    lineIndex: clean.lineIndex ?? null,
    procedureCode: clean.procedureCode ?? null,

    serviceDate: this.normalizeDateForPayload(clean.serviceDate),
    serviceEndDate: this.normalizeDateForPayload(clean.serviceEndDate),
    paymentDate: this.normalizeDateForPayload(clean.paymentDate),
    transmissionDate: this.normalizeDateForPayload(clean.transmissionDate),

    payerName: clean.payerName ?? null,
    filename: clean.filename ?? null,
    patientFirstName: clean.patientFirstName ?? null,
    patientLastName: clean.patientLastName ?? null,

    totalClaimAmount: clean.totalClaimAmount ?? 0,
    adjustedAmount: clean.adjustedAmount ?? 0,
    patientResponsibility: clean.patientResponsibility ?? 0,
    insuranceResponsibility: clean.insuranceResponsibility ?? 0,
    paidAmount: clean.paidAmount ?? 0,
    pendingAmount: clean.pendingAmount ?? 0,
    insurancePending: clean.insurancePending ?? 0,
    patientPendingAr: clean.patientPendingAr ?? 0,
    totalPendingAr: clean.totalPendingAr ?? 0,

    agingDays: clean.agingDays ?? null,
    agingBucket: clean.agingBucket ?? null,
    paymentStatus: clean.paymentStatus ?? null,
    payerSeq: clean.payerSeq ?? null,
    pst: clean.pst ?? null,
    patArStatus: clean.patArStatus ?? null,

    denialCode: clean.denialCode ?? null,
    denialReasonText: clean.denialReasonText ?? null,
    denialOwner: clean.denialOwner ?? null,
    colorFlag: clean.colorFlag ?? null,

    listId: clean.listId ?? null,
    listNumber: clean.listNumber ?? null,
    claimId: clean.claimId ?? null,
    clientId: clean.clientId ?? null,

    showAra: this.toIntFlag(clean.showAra ?? clean.show_ara),
    showPaya: this.toIntFlag(clean.showPaya ?? clean.show_paya),
    showCha: this.toIntFlag(clean.showCha ?? clean.show_cha),
    showCag: this.toIntFlag(clean.showCag ?? clean.show_cag),
    showClient: this.toIntFlag(clean.showClient ?? clean.show_client),
  });
}

 private handleArListMessages = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || data.kind !== 'AR_LIST_SAVE') return;

  const listName = (data.listName || '').trim();
  const action = data.action || 'SAVE_LIST';
  const filters = data.filters || null;

  if (!listName) {
    console.warn('[Claimstatus] AR_LIST_SAVE received without listName');
    return;
  }

  const claims = this.filteredResults;
  if (!claims || !claims.length) {
    console.warn('[Claimstatus] No filtered results to save for AR list');
    return;
  }

  let filterSummary = '';
  if (filters) {
    const arDaysFrom = filters.arDaysFrom ?? null;
    const arDaysTo = filters.arDaysTo ?? null;
    const amountFrom = filters.amountFrom ?? null;
    const amountTo = filters.amountTo ?? null;
    const queueLabel = filters.queueLabel || 'All claims';
    const payerTopLabel = filters.payerTopLabel || 'All payers';
    const searchText = (filters.searchText || '').trim();
    const filteredCount = filters.filteredCount;

    const arDaysPart =
      arDaysFrom == null && arDaysTo == null
        ? 'Any'
        : `${arDaysFrom ?? 0}–${arDaysTo ?? '∞'}`;

    const amountPart =
      amountFrom == null && amountTo == null
        ? 'Any'
        : `$${amountFrom ?? 0} to $${amountTo ?? '+∞'}`;

    filterSummary =
      `Queue: ${queueLabel}; ` +
      `Search: ${searchText || 'None'}; ` +
      `AR Days: ${arDaysPart}; ` +
      `Ins AR $: ${amountPart}; ` +
      `Payers: ${payerTopLabel}; ` +
      (typeof filteredCount === 'number'
        ? `Claims at creation: ${filteredCount}`
        : '');
  }

  const claimsClean = claims.map((r: any) => this.stripUiFieldsForSave(r));

  // Temporary production/debug validation:
  // We should not send any true/false values because backend Integer fields
  // can fail Jackson parsing with Boolean tokens.
  const booleanFieldsFound = claimsClean.flatMap((row: any, index: number) =>
    Object.entries(row)
      .filter(([_, value]) => typeof value === 'boolean')
      .map(([field, value]) => ({
        rowIndex: index,
        claimNumber: row.claimNumber,
        field,
        value,
      }))
  );

  console.log('[Claimstatus] AR List payload boolean fields found:', booleanFieldsFound);
  console.log('[Claimstatus] AR List payload first claim sample:', claimsClean[0]);

  if (booleanFieldsFound.length > 0) {
    console.warn(
      '[Claimstatus] AR List payload still contains boolean fields. Backend may reject this payload.',
      booleanFieldsFound
    );
  }

  const payload: ArFollowupCreateRequest = {
    listName,
    currentOwner: this.currentOwner,
    action,
    filterSummary,
    claims: claimsClean,
  };

  console.log('[Claimstatus] Saving AR follow-up list to server:', {
    listName,
    action,
    count: claimsClean.length,
    filterSummary,
  });

  this.arFollowupService.createFollowupList(payload).subscribe({
    next: () => {
      console.log('[Claimstatus] AR Follow-up list saved successfully:', listName);
      alert(`AR Follow-up list "${listName}" saved successfully.`);
    },
    error: (err) => {
      console.error('[Claimstatus] Failed to save AR Follow-up list', err);
      alert('Error saving AR Follow-up list. Please try again.');
    },
  });
};
  private buildArFilterSummary(): any {
    const queueLabel = this.queue === 'ALL' ? 'All Claims' : this.statusLabel(this.queue);
    const searchText = (this._searchText || '').trim();

    const arDaysFrom = this.arDaysFrom;
    const arDaysTo = this.arDaysTo;
    const amountFrom = this.amountFrom;
    const amountTo = this.amountTo;

    let payerTopLabel = 'All payers';
    if (this.payerTopN !== 'ALL') {
      payerTopLabel = `Top ${this.payerTopN} payers by Ins Paid`;
    }

    return {
      queue: this.queue,
      queueLabel,
      searchText,
      arDaysFrom,
      arDaysTo,
      amountFrom,
      amountTo,
      payerTopN: this.payerTopN,
      payerTopLabel,
      excludeInArTeamQueue: this.excludeInArTeamQueue,
      excludeWorkedLast30Days: this.excludeWorkedLast30Days,
      filteredCount: this.filteredResults.length,
    };
  }

  // ====================== Follow-up helpers ======================

  toNullableLong(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }

  nowLocalDateYYYYMMDD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  nowLocalTimeHHMMSS(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  formatHistoryDate(actionDate: string | null | undefined): string {
    if (!actionDate) return '';
    // Expected: YYYY-MM-DD
    const parts = String(actionDate).split('-');
    if (parts.length !== 3) return String(actionDate);
    const [y, m, d] = parts;
    return `${m}/${d}/${y}`;
  }

  formatHistoryTime(actionTime: string | null | undefined): string {
    if (!actionTime) return '';
    // Expected: HH:mm:ss
    const parts = String(actionTime).split(':');
    if (parts.length < 2) return String(actionTime);
    let h = Number(parts[0]);
    const m = parts[1].padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const hh = String(h).padStart(2, '0');
    return `${hh}:${m} ${ampm}`;
  }

  // ====================== Toast (UI) ======================
  toast: {
    visible: boolean;
    message: string;
    variant: 'success' | 'info' | 'warn' | 'danger';
  } = {
    visible: false,
    message: '',
    variant: 'info',
  };

  private toastTimer?: ReturnType<typeof setTimeout>;

  showToast(
    message: string,
    variant: 'success' | 'info' | 'warn' | 'danger' = 'info',
    ms = 2600
  ) {
    this.toast.message = message;
    this.toast.variant = variant;
    this.toast.visible = true;

    this.cdr.markForCheck();

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), ms);
  }

  hideToast() {
    this.toast.visible = false;
    this.cdr.markForCheck();
  }

limitNotesWords(event: Event): void {
  const textarea = event.target as HTMLTextAreaElement;
  const words = (textarea.value.match(/\S+/g) || []);
  if (words.length > 100) {
    textarea.value = words.slice(0, 100).join(' ');
    this.updateNotes = textarea.value;
    this.notesWordCount = 100;
  } else {
    this.updateNotes = textarea.value;
    this.notesWordCount = words.length;
  }
}
downloadArList(): void {
  const n = Number(this.listNumber);
  if (!Number.isFinite(n) || n <= 0) return;

  const url = `${environment.apiBaseUrl}/ar-list-export/dowload/${n}`;
  console.log('Download URL =>', url);

  const token = localStorage.getItem('token'); // <-- your actual key if different
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

 this.http.get(url, {
  headers,
  responseType: 'blob',
  observe: 'response'
}).subscribe({
  next: (res: HttpResponse<Blob>) => {   // ✅ typed
    const blob = res.body;
    if (!blob) return;

    const cd = res.headers.get('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const filename = m
      ? decodeURIComponent(m[1]).replace(/"/g, '').trim()
      : `AR_FollowUp_List_${n}.xlsx`;

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  },
  error: (err: HttpErrorResponse) => console.error('Download failed', err) // ✅ typed
});
}
downloadHistoryAttachment(a: any, ev?: Event): void {
  ev?.preventDefault();
  ev?.stopPropagation();

  const attachmentId = Number(a?.attachmentId ?? 0);
  if (!attachmentId) {
    this.showToast('Attachment id is missing.', 'danger');
    return;
  }

  this.claimService.downloadFollowupAttachment(attachmentId).subscribe({
    next: (blob: Blob) => {
      const fileName = String(a?.originalName || a?.storedName || `attachment_${attachmentId}`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    error: (err: unknown) => {
      console.error('Failed to download attachment', err);
      this.showToast('Failed to download attachment.', 'danger');
    }
  });
}

private refreshAfterFollowupChange(): void {
  this.currentPage = 0;
  this.prepareRows();
  this.recomputeFilters();
  this.recomputeBothGrids();
  this.cdr.markForCheck();
}


private getStoredUserRole(): string {
  const role =
    localStorage.getItem('role') ||
    localStorage.getItem('currentUserRole') ||
    localStorage.getItem('userRole') ||
    localStorage.getItem('roleName') ||
    '';
  return String(role).toUpperCase().trim();
}

isCommentOnlyRole(): boolean {
  const role = (this.currentUserRole || '').toUpperCase().trim();
  return this.commentOnlyRoles.includes(role);
}

/**
 * ngModel-based dialog: dropdown disabling is handled in HTML via [disabled].
 * Keep this as a no-op so calls to it do not break anything.
 */
private applyRoleBasedFollowupAccess(): void {
  // no-op by design
}

private seedExistingStatusActionFromRow(row: ClaimStatusClaimRow | null): void {
  if (!row) return;

  const anyRow: any = row;

  const statusId = this.toNullableLong(
    anyRow?.latestStatusId ??
    anyRow?.statusId ??
    anyRow?.latest_status_id ??
    null
  );

  const actId = this.toNullableLong(
    anyRow?.latestActId ??
    anyRow?.actId ??
    anyRow?.latest_act_id ??
    null
  );

  const statusLabel =
    anyRow?.latestStatusLabel ??
    anyRow?.statusLabel ??
    anyRow?.latest_status_label ??
    '';

  const actionLabel =
    anyRow?.latestActionLabel ??
    anyRow?.actionLabel ??
    anyRow?.latest_action_label ??
    '';

  const responsibleParty =
    anyRow?.latestResponsibleParty ??
    anyRow?.responsibleParty ??
    null;

  const category =
    anyRow?.latestCategory ??
    anyRow?.category ??
    null;

  if (statusId && !this.updateStatusObj) {
    this.updateStatusObj = {
      statusId,
      statusLabel: String(statusLabel || `Status #${statusId}`),
    } as ArStatusLookupDTO;
  }

  if (actId && !this.updateActionObj) {
    this.updateActionObj = {
      actId,
      actionLabel: String(actionLabel || `Action #${actId}`),
      responsibleParty,
      category,
    } as ArActionLookupDTO;
  }
}

private seedExistingStatusActionFromHistory(): void {
  if (!this.followupHistoryRows?.length) return;

  const h: any = this.followupHistoryRows[0]; // latest row expected first
  if (!h) return;

  const statusId = this.toNullableLong(h?.statusId);
  const actId = this.toNullableLong(h?.actId);

  if (statusId && !this.updateStatusObj) {
    this.updateStatusObj = {
      statusId,
      statusLabel: String(h?.statusLabel || `Status #${statusId}`),
    } as ArStatusLookupDTO;
  }

  if (actId && !this.updateActionObj) {
    this.updateActionObj = {
      actId,
      actionLabel: String(h?.actionLabel || `Action #${actId}`),
      responsibleParty: h?.responsibleParty ?? null,
      category: h?.category ?? null,
    } as ArActionLookupDTO;
  }
}

private getEffectiveStatusObj(): ArStatusLookupDTO | null {
  if (this.updateStatusObj) return this.updateStatusObj;
  if (this.isCommentOnlyRole()) {
    this.seedExistingStatusActionFromRow(this.updateRow);
    this.seedExistingStatusActionFromHistory();
  }
  return this.updateStatusObj;
}

private getEffectiveActionObj(): ArActionLookupDTO | null {
  if (this.updateActionObj) return this.updateActionObj;
  if (this.isCommentOnlyRole()) {
    this.seedExistingStatusActionFromRow(this.updateRow);
    this.seedExistingStatusActionFromHistory();
  }
  return this.updateActionObj;
}
private parentRefreshTimer: ReturnType<typeof setTimeout> | null = null;

private isQueueBackedInputView(): boolean {
  return !!(
    this.isAssignedMode ||
    this.isArFollowupListView ||
    this.isPredictionFollowupListView ||
    this.listNumber ||
    this.listName
  );
}

private removeClaimFromCurrentView(
  claimNumber: string,
  filename?: string | null
): void {
  const cn = String(claimNumber || '').trim();
  if (!cn) return;

  const before = Array.isArray(this.claimStatuses) ? this.claimStatuses.length : 0;

  // Important:
  // This component collapses rows by claimNumber into one visible claim row.
  // So remove by claimNumber from the local dataset immediately.
  this.claimStatuses = (this.claimStatuses || []).filter((r: any) => {
    const rClaim = String(r?.claimNumber ?? '').trim();
    return rClaim !== cn;
  });

  const after = Array.isArray(this.claimStatuses) ? this.claimStatuses.length : 0;

  console.log('[Claimstatus] removeClaimFromCurrentView', {
    claimNumber: cn,
    filename: String(filename || '').trim(),
    before,
    after,
    isAssignedMode: this.isAssignedMode,
    isArFollowupListView: this.isArFollowupListView,
    listNumber: this.listNumber,
    listName: this.listName
  });

  if (before !== after) {
    this.currentPage = 0;
    this.prepareRows();
    this.recomputeFilters();
    this.recomputeBothGrids();
    this.cdr.markForCheck();
  }
}


private normalizeColorFlag(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

isReturnedToArAgent(row: any): boolean {
  return this.normalizeColorFlag(row?.colorFlag ?? row?.color_flag) === 'RETURNED_TO_AR_AGENT';
}
private toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
canSaveUpdateStatus(): boolean {
  if (this.followupSaveBusy || this.attachmentUploadBusy) return false;

  // keep old behavior for comment-only roles
  if (this.isCommentOnlyRole()) return true;

  const hasRemainderDate = !!String(this.remainderDate || '').trim();
  const hasStatusAndAction = !!this.updateStatusObj && !!this.updateActionObj;

  // enable save if either:
  // 1) both dropdowns selected, or
  // 2) remainder date selected
  return hasRemainderDate || hasStatusAndAction;
}
showPredictionColumns(): boolean {
  return this.isPredictionFollowupListView === true;
}

showArFollowupColumns(): boolean {
  return true;
}

hasArFollowupData(row: ClaimStatusReport | any): boolean {
  return !!(
    row?.listId ||
    row?.listNumber ||
    row?.listName ||
    row?.latestFollowupId ||
    row?.latestStatusLabel ||
    row?.latestActionLabel ||
    row?.latestNotes ||
    row?.followupCount
  );
}

shortText(value: string | null | undefined, maxLength: number = 22): string {
  const text = String(value ?? '').trim();

  if (!text) {
    return '—';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + '…';
}

arListDisplay(row: any): string {
  const listName = String(row?.listName ?? '').trim();

  if (listName) {
    return this.shortText(listName, 10);
  }

  const listNumber = row?.listNumber;

  if (listNumber !== null && listNumber !== undefined && String(listNumber).trim() !== '') {
    return this.shortText(`List #${listNumber}`, 10);
  }

  return '—';
}

arListTitle(row: any): string {
  const listName = String(row?.listName ?? '').trim();

  if (listName) {
    return listName;
  }

  const parts: string[] = [];

  if (row?.listNumber) {
    parts.push(`List #: ${row.listNumber}`);
  }

  if (row?.assignedTo) {
    parts.push(`Assigned To: ${row.assignedTo}`);
  }

  if (row?.currentOwner) {
    parts.push(`Owner: ${row.currentOwner}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No AR list data';
}
downloadClaimListCsv(): void {
  const rows = this.getSortedResults();

  if (!rows || rows.length === 0) {
    this.showToast('No claim rows available to export.', 'warn');
    return;
  }

  const columns: Array<{ header: string; value: (row: any) => any }> = [
    { header: 'Claim #', value: (r) => r.claimNumber },
    { header: 'FName', value: (r) => r.patientFirstName },
    { header: 'LName', value: (r) => r.patientLastName },

    { header: 'Svc Date', value: (r) => this.formatCsvDate(r.serviceDate) },
    { header: 'Tx Date', value: (r) => this.formatCsvDate(r.transmissionDate) },
    { header: 'Pay Date', value: (r) => this.formatCsvDate(r.paymentDate) },

    { header: 'AR Days', value: (r) => r.agingDays ?? r.__age ?? '' },

    // Export actual CPT codes when rows are collapsed as Many/One
    {
      header: 'CPT Code',
      value: (r) => {
        const codes = Array.isArray(r.__procedureCodes)
          ? r.__procedureCodes.filter((x: any) => !!String(x || '').trim())
          : [];

        return codes.length > 0 ? codes.join(' | ') : (r.procedureCode ?? '');
      }
    },

    { header: 'Chg Amt', value: (r) => this.formatCsvNumber(r.totalClaimAmount) },
    { header: 'Adj.', value: (r) => this.formatCsvNumber(r.adjustedAmount) },
    { header: 'Ins Res', value: (r) => this.formatCsvNumber(this.displayInsuranceResponsibility(r)) },
    { header: 'Ins Paid', value: (r) => this.formatCsvNumber(r.paidAmount) },
    { header: 'Ins Pend', value: (r) => this.formatCsvNumber(this.displayPending(r)) },

    { header: 'Ins Sts', value: (r) => this.statusLabel(r.__insStatus || r.paymentStatus) },
    { header: 'PST', value: (r) => r.pst ?? '' },

    { header: 'Pat Res', value: (r) => this.formatCsvNumber(r.patientResponsibility) },
    { header: 'Pat Pend', value: (r) => this.formatCsvNumber(r.patientPendingAr) },
    { header: 'Pt AR Sts', value: (r) => this.patArLabel(r.patArStatus) },

    { header: 'TPA', value: (r) => r.payerName ?? '' },

    ...(this.showPredictionColumns()
      ? [
          { header: 'Prediction Work Status', value: (r: any) => r.predictionWorkStatusAtRun ?? '' },
          { header: 'Prediction Priority', value: (r: any) => r.predictionPriorityAtRun ?? '' },
          { header: 'Prediction Message', value: (r: any) => r.predictionMessage ?? '' },
        ]
      : []),

    // AR Follow-up data
    { header: 'AR Status', value: (r) => r.latestStatusLabel ?? '' },
    { header: 'AR Action', value: (r) => r.latestActionLabel ?? '' },
    { header: 'Last Note', value: (r) => r.latestNotes ?? '' },
    { header: 'FU #', value: (r) => r.followupCount ?? 0 },
    { header: 'AR List', value: (r) => this.arListCsvValue(r) },

    // Useful audit fields already available in the row
    { header: 'List #', value: (r) => r.listNumber ?? '' },
    { header: 'Assigned To', value: (r) => r.assignedTo ?? '' },
    { header: 'Owner', value: (r) => r.currentOwner ?? '' },
    { header: 'Last Follow-up Created', value: (r) => this.formatCsvDateTime(r.lastFollowupCreated || r.latestFollowupCreated) },
    { header: 'Filename', value: (r) => r.filename ?? '' }
  ];

  const headerLine = columns.map((c) => this.csvEscape(c.header)).join(',');

  const dataLines = rows.map((row) =>
    columns.map((c) => this.csvEscape(c.value(row))).join(',')
  );

  // UTF-8 BOM helps Excel open the CSV cleanly.
  const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;'
  });

  this.downloadBlob(blob, this.buildClaimListCsvFileName());
  this.showToast(`Exported ${rows.length} claim row(s) to CSV.`, 'success');
}

private csvEscape(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value)
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .trim();

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

private formatCsvNumber(value: any, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const n = this.num(value);

  if (!Number.isFinite(n)) {
    return String(value);
  }

  return n.toFixed(decimals);
}

private formatCsvDate(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const raw = String(value).trim();

  // Handles YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss formats without timezone date shift.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[2]}/${m[3]}/${m[1]}`;
  }

  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    return raw;
  }

  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${mm}/${dd}/${yyyy}`;
}

private formatCsvDateTime(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const raw = String(value).trim();
  const d = new Date(raw);

  if (isNaN(d.getTime())) {
    return raw;
  }

  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();

  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';

  h = h % 12;
  if (h === 0) h = 12;

  return `${mm}/${dd}/${yyyy} ${String(h).padStart(2, '0')}:${min}:${sec} ${ampm}`;
}

private arListCsvValue(row: any): string {
  const listName = String(row?.listName ?? '').trim();

  if (listName) {
    return listName;
  }

  const listNumber = row?.listNumber;

  if (listNumber !== null && listNumber !== undefined && String(listNumber).trim() !== '') {
    return `List #${listNumber}`;
  }

  return '';
}

private buildClaimListCsvFileName(): string {
  const today = this.nowLocalDateYYYYMMDD(new Date());

  const context =
    this.listName
      ? this.safeFileNamePart(this.listName)
      : this.isPredictionFollowupListView
        ? 'Predicted_Payer_Followup_List'
        : this.isAssignedMode
          ? 'Assigned_Claims'
          : 'Claim_List';

  const listPart =
    this.listNumber !== null && this.listNumber !== undefined && String(this.listNumber).trim() !== ''
      ? `_List_${this.safeFileNamePart(this.listNumber)}`
      : '';

  return `${context}${listPart}_${today}.csv`;
}

private safeFileNamePart(value: any): string {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Export';
}

private downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();
  URL.revokeObjectURL(objectUrl);
}
}
