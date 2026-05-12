import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ArSummaryListService } from './ar-summary-list.service';
import { ArFollowupListSummary, RevMaxUserDTO } from './ar-summary-list.model';
import { normalizeRole } from '../../app-roles';

@Component({
  selector: 'app-ar-summary-list',
  standalone: true,
 imports: [CommonModule, RouterModule],
  templateUrl: './ar-summary-list.component.html',
  styleUrls: ['./ar-summary-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArSummaryListComponent implements OnInit {
  arLists: ArFollowupListSummary[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  revMaxUsers: RevMaxUserDTO[] = [];
  isRevMaxUsersLoading = false;

  private assigningListNumbers = new Set<number>();
  deletingListNumbers = new Set<number>();

  toastVisible = false;
  toastMessage = '';
  private toastTimer: any;

  private readonly currentOwner = localStorage.getItem('currentUserId') || 'Unknown';
  currentRole = normalizeRole(localStorage.getItem('currentUserRole'));

  sortKey: keyof ArFollowupListSummary | '' = 'listNumber';
  sortAsc = false;

summaryTotals = {
  totalClaimCount: 0,
    workedCount: 0,
  untouchedCount: 0,
  arFollowupCount: 0,
  codingAssistanceCount: 0,
  paymentAssistanceCount: 0,
  chargeAssistanceCount: 0,
  clientAssistanceCount: 0,
  visibleClaimCount: 0
};

  constructor(
    private arSummaryListService: ArSummaryListService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRevMaxUsers();
    this.loadArLists();
  }

  private isQueueVisibilityRole(): boolean {
    const role = String(this.currentRole || '')
      .trim()
      .toUpperCase()
      .replace(/^ROLE_/, '')
      .replace(/[\s-]+/g, '_');

    return role === 'PAY_AGENT'
        || role === 'CODE_AGENT'
        || role === 'CHARGE_AGENT'
        || role === 'CLIENT';
  }

  isAgentOrClientView(): boolean {
    return this.isQueueVisibilityRole();
  }

  canAssignArList(): boolean {
    const role = this.getNormalizedRole();

    return role === 'AR_MANAGER'
        || role === 'ADMIN'
        || role === 'SUPER_ADMIN'
        || role === 'SUPERADMIN';
  }

  private getNormalizedRole(): string {
    const rawRole = this.currentRole || localStorage.getItem('currentUserRole') || '';

    return String(rawRole)
      .trim()
      .toUpperCase()
      .replace(/^ROLE_/, '')
      .replace(/[\s-]+/g, '_');
  }

  private isAdminDeleteRole(): boolean {
    const role = this.getNormalizedRole();
    return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
  }

  loadRevMaxUsers(): void {
    if (!this.canAssignArList()) {
      this.revMaxUsers = [];
      this.isRevMaxUsersLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.isRevMaxUsersLoading = true;
    this.cdr.markForCheck();

    this.arSummaryListService.getAllRevMaxUsers().subscribe({
      next: (users) => {
        this.revMaxUsers = (users || []).filter(u => u.status === 1);
        this.isRevMaxUsersLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error loading RevMax users', err);
        this.revMaxUsers = [];
        this.isRevMaxUsersLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadArLists(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const request$ = this.isQueueVisibilityRole()
      ? this.arSummaryListService.getVisibleListsForRole()
      : this.arSummaryListService.getListsForOwner(this.currentOwner);

    request$.subscribe({
next: (data) => {
  this.arLists = (data || []).map(row => {
    const totalClaimCount = Number(row.totalClaimCount || 0);
    const untouchedCount = Number(row.untouchedCount || 0);

    return {
      ...row,
      totalClaimCount,
      untouchedCount,
      workedCount: totalClaimCount - untouchedCount,
      arFollowupCount: Number(row.arFollowupCount || 0),
      codingAssistanceCount: Number(row.codingAssistanceCount || 0),
      paymentAssistanceCount: Number(row.paymentAssistanceCount || 0),
      chargeAssistanceCount: Number(row.chargeAssistanceCount || 0),
      clientAssistanceCount: Number(row.clientAssistanceCount || 0),
      visibleClaimCount: Number(row.visibleClaimCount || 0)
    };
  });

  this.recomputeSummaryTotals();
  this.isLoading = false;
  this.cdr.markForCheck();
},
      error: (err: any) => {
        console.error('Error loading AR lists', err);
        this.errorMessage = 'Failed to load AR Lists.';
        this.arLists = [];
        this.recomputeSummaryTotals();
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  trackByListNumber(index: number, item: ArFollowupListSummary): number {
    return item.listNumber;
  }

  onListClick(list: ArFollowupListSummary): void {
    this.router.navigate(['/ar-lists', list.listNumber], {
      state: {
        listNumber: list.listNumber,
        listName: list.listName
      }
    });
  }

  isAssigning(listNumber: number): boolean {
    return this.assigningListNumbers.has(listNumber);
  }

  showToast(message: string): void {
    this.toastMessage = message;
    this.toastVisible = true;
    this.cdr.markForCheck();

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.cdr.markForCheck();
    }, 3000);
  }

  hideToast(): void {
    this.toastVisible = false;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.cdr.markForCheck();
  }

  private resetActionSelect(event?: Event): void {
    const target = event?.target as HTMLSelectElement | null;

    if (target) {
      target.value = '';
    }
  }

  onActionChange(list: ArFollowupListSummary, value: string, event?: Event): void {
    if (!this.canAssignArList()) {
      this.resetActionSelect(event);
      return;
    }

    const previous = list.assignedTo ?? null;

    if (!value || value === 'Assign List to...') {
      this.resetActionSelect(event);
      return;
    }

    this.assigningListNumbers.add(list.listNumber);
    this.cdr.markForCheck();

    this.arSummaryListService.assignArList(list.listNumber, value).subscribe({
      next: () => {
        this.assigningListNumbers.delete(list.listNumber);
        list.assignedTo = value;

        const u = this.revMaxUsers.find(x => x.email === value);
        const who = u ? `${u.fullName} (${u.email})` : value;

        this.resetActionSelect(event);
        this.showToast(`AR list "${list.listName}" assigned to ${who}`);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error assigning AR list', err);
        this.assigningListNumbers.delete(list.listNumber);
        list.assignedTo = previous ?? undefined;
        this.errorMessage = 'Failed to assign AR List.';
        this.resetActionSelect(event);
        this.showToast(`Failed to assign AR list "${list.listName}"`);
        this.cdr.markForCheck();
      }
    });
  }

  getClaimCount(list: ArFollowupListSummary): number {
    return list.visibleClaimCount ?? list.totalClaimCount ?? 0;
  }

private recomputeSummaryTotals(): void {
  const rows = this.arLists || [];

  this.summaryTotals = rows.reduce(
    (acc, row) => {
      const totalClaimCount = Number(row.totalClaimCount || 0);
      const untouchedCount = Number(row.untouchedCount || 0);
      const workedCount = Number(row.workedCount ?? (totalClaimCount - untouchedCount));

      acc.totalClaimCount += totalClaimCount;
      acc.untouchedCount += untouchedCount;
      acc.workedCount += workedCount;
      acc.arFollowupCount += Number(row.arFollowupCount || 0);
      acc.codingAssistanceCount += Number(row.codingAssistanceCount || 0);
      acc.paymentAssistanceCount += Number(row.paymentAssistanceCount || 0);
      acc.chargeAssistanceCount += Number(row.chargeAssistanceCount || 0);
      acc.clientAssistanceCount += Number(row.clientAssistanceCount || 0);
      acc.visibleClaimCount += Number(row.visibleClaimCount || 0);
      return acc;
    },
    {
      totalClaimCount: 0,
      untouchedCount: 0,
      workedCount: 0,
      arFollowupCount: 0,
      codingAssistanceCount: 0,
      paymentAssistanceCount: 0,
      chargeAssistanceCount: 0,
      clientAssistanceCount: 0,
      visibleClaimCount: 0
    }
  );
}

  sortTable(key: keyof ArFollowupListSummary): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }

    this.cdr.markForCheck();
  }

  get sortedArLists(): ArFollowupListSummary[] {
    const rows = [...(this.arLists || [])];
    const key = this.sortKey;

    if (!key) {
      return rows;
    }

    return rows.sort((a, b) => {
      const av = (a as any)?.[key];
      const bv = (b as any)?.[key];

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      let cmp = 0;

  const numericKeys = new Set<keyof ArFollowupListSummary>([
  'listNumber',
  'totalClaimCount',
  'untouchedCount',
  'workedCount',
  'arFollowupCount',
  'codingAssistanceCount',
  'paymentAssistanceCount',
  'chargeAssistanceCount',
  'clientAssistanceCount',
  'visibleClaimCount'
]);

      if (numericKeys.has(key)) {
        cmp = Number(av || 0) - Number(bv || 0);
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      }

      return this.sortAsc ? cmp : -cmp;
    });
  }

  canDeleteList(row: ArFollowupListSummary): boolean {
    if (this.isAdminDeleteRole()) {
      return true;
    }

    return !row.assignedTo || row.assignedTo.trim().length === 0;
  }

  isDeleting(listNumber: number): boolean {
    return this.deletingListNumbers.has(listNumber);
  }

  onDeleteList(row: ArFollowupListSummary): void {
    if (!this.canDeleteList(row)) {
      this.showToast('Assigned lists can be deleted only by Admin or Super Admin.');
      return;
    }

    const ok = window.confirm(
      `Delete AR list "${row.listName}"? This will delete the list, follow-up history, and attachments.`
    );

    if (!ok) {
      return;
    }

    this.deletingListNumbers.add(row.listNumber);
    this.cdr.markForCheck();

    this.arSummaryListService.deleteArList(row.listNumber).subscribe({
      next: () => {
        this.deletingListNumbers.delete(row.listNumber);

        this.arLists = this.arLists.filter(
          x => x.listNumber !== row.listNumber
        );

        this.recomputeSummaryTotals();
        this.showToast('AR list deleted successfully.');
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error deleting AR list', err);
        this.deletingListNumbers.delete(row.listNumber);
        this.showToast('Unable to delete AR list. Please try again.');
        this.cdr.markForCheck();
      }
    });
  }
}