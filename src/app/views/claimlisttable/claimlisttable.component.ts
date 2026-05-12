import { Component, OnInit } from '@angular/core';
import { ClaimsTableService } from './claimlisttable.service';
import { ClaimsTableData } from './claimlisttable.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

type ClaimQueue = 'ALL' | 'PENDING' | 'DENIAL' | 'PATIENT' | 'PAID';

@Component({
  selector: 'app-claimlisttable',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './claimlisttable.component.html',
  styleUrls: ['./claimlisttable.component.scss'],
})
export class ClaimlisttableComponent implements OnInit {
  claims: ClaimsTableData[] = [];
  filteredClaims: ClaimsTableData[] = [];
  paginatedClaims: { encId: string; claims: ClaimsTableData[] }[] = [];
  groupedClaims: { [encId: string]: ClaimsTableData[] } = {};
  groupedKeys: string[] = [];
  paginatedKeys: string[] = [];
  expandedGroups: { [encId: string]: boolean } = {};
  columns: string[] = [];

  searchTerm: string = '';
  sortColumn: string | null = null;
  sortAscending: boolean = true;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;

  // 🔹 Claim Process Queue dropdown
  queueOptions: { value: ClaimQueue; label: string }[] = [
    { value: 'ALL',     label: 'All Queues' },
    { value: 'PENDING', label: 'Pending Queue' },
    { value: 'DENIAL',  label: 'Denial Queue' },
    { value: 'PATIENT', label: 'Patient AR Queue' },
    { value: 'PAID',    label: 'Closed (Paid)' },
  ];
  selectedQueue: ClaimQueue = 'ALL';

  // Columns not shown/searchable in the UI
  excludedColumns: string[] = [
    'eid',
    'fname',
    'uname',
    'concate...',       // whatever concat column was – keep excluded
    'aging1',
    'createdDate',
    'createdTimestamp',
    'agingBucket1',
    'claimQueue',       // computed on UI side – not shown as column
  ];

  constructor(private claimsService: ClaimsTableService) {}

  ngOnInit(): void {
    console.log('[ClaimlisttableComponent] ngOnInit called');
    this.fetchClaimsData();
  }

  fetchClaimsData(): void {
    this.claimsService.getClaimsData().subscribe({
      next: (data: ClaimsTableData[]) => {
        if (!data || data.length === 0) {
          console.warn('[fetchClaimsData] No data returned from API');
          this.claims = [];
          this.filteredClaims = [];
          this.groupedClaims = {};
          this.groupedKeys = [];
          this.paginatedClaims = [];
          return;
        }

        console.log('[fetchClaimsData] Raw rows from API:', data.length);

        // 🔹 Compute claimQueue for each row based on standardized statuses
        const enriched: ClaimsTableData[] = data.map((claim) => {
          const queue = this.computeClaimQueue(claim);
          return { ...claim, claimQueue: queue };
        });

        this.claims = enriched;
        this.filteredClaims = [...this.claims];

        // Build columns from first row, excluding internal fields
        this.columns = Object.keys(this.claims[0]).filter(
          (col) => !this.excludedColumns.includes(col)
        );

        console.log('[fetchClaimsData] Columns used for table/search:', this.columns);

        this.groupClaimsByEncId();
        this.updatePagination();
      },
      error: (error: any) => {
        console.error('Error fetching claims data:', error);
      },
    });
  }

  /**
   * 🔹 Derive the claim-processing queue for each row.
   */
  private computeClaimQueue(claim: ClaimsTableData): ClaimQueue {
    const anyClaim = claim as any;

    const paymentStatus: string = (anyClaim.payment_status ||
      anyClaim.status ||
      '')
      .toString()
      .trim()
      .toUpperCase();

    const patStatus: string = (anyClaim.pat_ar_status ||
      anyClaim.currentStatus ||
      '')
      .toString()
      .trim(); // F-Paid / PENDING / Part_Paid

    // 1️⃣ Denial / rejection type statuses
    const denialStatusSet = new Set<string>([
      'REJECTED_277',
      'DEN-DUP',
      'MIS-DATA',
      'PRE-AUT',
      'NO-COVR',
      'SVR-NOT',
      'W-PYR',
      'BEN-MAX',
      'BUNDLED',
      'INFO-REQ',
      '0-PAID',
    ]);

    if (denialStatusSet.has(paymentStatus)) {
      return 'DENIAL';
    }

    // 2️⃣ Closed / fully paid
    if (paymentStatus === 'F-PAID') {
      return 'PAID';
    }

    // 3️⃣ Patient AR queue – patient has pending / partial AR
    if (patStatus === 'PENDING' || patStatus === 'Part_Paid') {
      return 'PATIENT';
    }

    // 4️⃣ Everything else → Pending queue
    return 'PENDING';
  }

  /** Group filtered rows by encId for expandable view */
  groupClaimsByEncId(): void {
    this.groupedClaims = {};
    this.expandedGroups = {};

    this.filteredClaims.forEach((claim) => {
      const encId: string = (claim.encId ? String(claim.encId) : 'unknown').toString();

      if (!this.groupedClaims[encId]) {
        this.groupedClaims[encId] = [];
        this.expandedGroups[encId] = false;
      }
      this.groupedClaims[encId].push(claim);
    });

    // Apply sorting inside each group
    if (this.sortColumn) {
      for (const encId in this.groupedClaims) {
        this.groupedClaims[encId].sort((a, b) =>
          this.compareValues(a, b, this.sortColumn as string)
        );
      }
    }

    this.groupedKeys = Object.keys(this.groupedClaims);
    this.updatePagination();
  }

  toggleGroup(encId: string): void {
    this.expandedGroups[encId] = !this.expandedGroups[encId];
  }

  /**
   * 🔍 Multi-word, cross-column search (debug version).
   *
   * - Take searchTerm → lowercase → trim.
   * - Split by spaces into terms: "linda jones" → ["linda", "jones"].
   * - Build a single string from all visible columns for that row.
   * - Row matches if **every term** appears at least once in that string.
   *
   * Includes console.log for multi-word search to see exactly
   * what is being matched.
   */
  private matchesSearch(
     
    claim: ClaimsTableData & { claimQueue?: string },
    searchTerm: string
  ): boolean {
    const normalized = (searchTerm || '').toLowerCase().trim();
    if (!normalized) {
      return true;
    }
 console.log("1="+1);
    const terms = normalized.split(/\s+/).filter(Boolean);
    console.log("terms="+terms);
    if (!terms.length) {
      return true;
    }

    // Build row text ONLY from visible/searchable columns (this.columns)
    const rowText = this.columns
      .map((col) => {
        const v = this.getColumnValueRaw(claim, col);
        return v != null ? v.toString().toLowerCase() : '';
      })
      .join(' ')
      .trim();

    if (!rowText) {
      return false;
    }
 console.log("rowText="+rowText);
    // Debug only for multi-word (space) searches
    if (terms.length > 1) {
      console.log('[matchesSearch] multi-word search', {
        searchTerm: normalized,
        terms,
        encId: (claim as any).encId,
        claimNumber: (claim as any).claimNumber,
        rowText,
      });
    }

    const match = terms.every((term) => rowText.includes(term));

    if (terms.length > 1) {
      console.log('[matchesSearch] result', {
        searchTerm: normalized,
        encId: (claim as any).encId,
        claimNumber: (claim as any).claimNumber,
        match,
      });
    }

    return match;
  }
  /** 🔍 Search + 🧮 Queue filter */
  filterClaims(): void {
    const search = this.searchTerm;

    console.log('[filterClaims] START', {
      searchTerm: search,
      selectedQueue: this.selectedQueue,
      totalClaims: this.claims.length,
    });

    this.filteredClaims = this.claims.filter(
      (claim: ClaimsTableData & { claimQueue?: string }) => {
        // Queue filter (unchanged)
        const queue = (claim.claimQueue as ClaimQueue) || 'PENDING';
        if (this.selectedQueue !== 'ALL' && queue !== this.selectedQueue) {
          return false;
        }

        // Text search filter (multi-word, cross-column)
        return this.matchesSearch(claim, search);
      }
    );

    console.log('[filterClaims] DONE', {
      searchTerm: search,
      selectedQueue: this.selectedQueue,
      filteredCount: this.filteredClaims.length,
    });

    this.groupClaimsByEncId();
    this.currentPage = 1;
    this.updatePagination();
  }


  sortTable(column: string): void {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending; // Toggle sort
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }

    // Sort filteredClaims before regrouping
    this.filteredClaims.sort((a, b) => this.compareValues(a, b, column));

    this.groupClaimsByEncId();
    this.updatePagination();
  }

  compareValues(a: ClaimsTableData, b: ClaimsTableData, column: string): number {
    const valueA = this.getColumnValueRaw(a, column);
    const valueB = this.getColumnValueRaw(b, column);
    const direction = this.sortAscending ? 1 : -1;

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return (valueA - valueB) * direction;
    }

    return (
      valueA.toString().localeCompare(valueB.toString(), undefined, { numeric: true }) *
      direction
    );
  }

  // Exposed so template can special-case status columns
  getColumnValueRaw(entry: ClaimsTableData, column: string): any {
    return (entry as any)[column] ?? '';
  }

  updatePagination(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedKeys = this.groupedKeys.slice(start, start + this.itemsPerPage);

    this.paginatedClaims = this.paginatedKeys.map((encId) => ({
      encId: encId,
      claims: [...(this.groupedClaims[encId] || [])],
    }));
  }

  changePage(page: number): void {
    if (page > 0 && page <= this.totalPages.length) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  get totalPages(): number[] {
    const pages = Math.ceil(this.groupedKeys.length / this.itemsPerPage);
    return pages > 1 ? Array.from({ length: pages }, (_, i) => i + 1) : [];
  }

  getColumnValue(entry: ClaimsTableData, column: string): string {
    const value = (entry as any)[column] ?? '—';
    const asString = value.toString();
    return asString.includes('T00:00') ? this.removeTimeComponent(asString) : asString;
  }

  removeTimeComponent(dateString: string): string {
    return dateString.replace(/T00:00$/, '');
  }

  /** 🎨 Map payment_status → badge class */
  getPaymentStatusBadgeClass(status: string | null | undefined): string {
    const code = (status || '').toString().trim().toUpperCase();

    switch (code) {
      case 'F-PAID':
        return 'bg-success text-white';
      case '0-PAID':
        return 'bg-secondary text-white';
      case 'U-PAID':
        return 'bg-warning text-dark';

      case 'PENDING_ACK':
      case 'ACCEPTED_277':
      case 'PENDED_277':
      case 'NOT_ACCEPTED_277':
        return 'bg-info text-dark';

      case 'REJECTED_277':
      case 'DEN-DUP':
      case 'MIS-DATA':
      case 'PRE-AUT':
      case 'NO-COVR':
      case 'SVR-NOT':
      case 'W-PYR':
      case 'BEN-MAX':
      case 'BUNDLED':
      case 'INFO-REQ':
        return 'bg-danger text-white';

      default:
        return 'bg-light text-dark';
    }
  }

  /** 🏷 Map payment_status → user-facing badge text */
  mapPaymentStatusLabel(status: string | null | undefined): string {
    const code = (status || '').toString().trim().toUpperCase();

    switch (code) {
      case 'PENDING_ACK':
        return 'Pending ACK';
      case 'ACCEPTED_277':
        return '277 Accepted';
      case 'PENDED_277':
        return '277 Pended';
      case 'REJECTED_277':
        return '277 Rejected';
      case 'NOT_ACCEPTED_277':
        return '277 Other/Not Accepted';

      case 'F-PAID':
        return 'F-Paid';
      case '0-PAID':
        return '0-Paid';
      case 'U-PAID':
        return 'U-Paid';

      case 'DEN-DUP':
        return 'Den Dup';
      case 'MIS-DATA':
        return 'Missing Data';
      case 'PRE-AUT':
        return 'Pre-Auth Req';
      case 'NO-COVR':
        return 'No Coverage';
      case 'SVR-NOT':
        return 'Service Not Cov';
      case 'W-PYR':
        return 'Wrong Payer';
      case 'BEN-MAX':
        return 'Benefit Max';
      case 'BUNDLED':
        return 'Bundled';
      case 'INFO-REQ':
        return 'Info Required';

      default:
        return status || '';
    }
  }

  /** 🎨 Badge class for patient AR (pat_ar_status/currentStatus) */
  getPatArStatusBadgeClass(patStatus: string | null | undefined): string {
    const s = (patStatus || '').toString().trim();

    switch (s) {
      case 'F-Paid':
        return 'bg-success text-white';
      case 'PENDING':
        return 'bg-warning text-dark';
      case 'Part_Paid':
        return 'bg-info text-dark';
      default:
        return 'bg-light text-dark';
    }
  }
}
