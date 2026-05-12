// src/app/views/ar-followup-list-details/ar-followup-list-details.component.ts

import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ClaimstatusComponent } from '../claimstatus/claimstatus.component';
import { ClaimstatusService, ClaimStatusReport } from '../claimstatus/claimstatus.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ar-followup-list-details',
  standalone: true,
  imports: [CommonModule, ClaimstatusComponent],
  templateUrl: './ar-followup-list-details.component.html',
  styleUrls: ['./ar-followup-list-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArFollowupListDetailsComponent implements OnInit {
  listNumber: number = NaN;
  listName: string | null = null;

  rows: ClaimStatusReport[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  isAssignedMode = false;

  private readonly baseUrl = environment.apiBaseUrl;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private claimstatusService: ClaimstatusService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const state: any = history.state || {};

    this.listName = state?.listName ?? state?.list_name ?? null;

    const assignedQp = this.route.snapshot.queryParamMap.get('assigned');
    const assignedData = this.route.snapshot.data?.['assignedMode'] === true;
    const routePath = this.route.snapshot.routeConfig?.path ?? '';

    this.isAssignedMode =
      assignedData ||
      assignedQp === '1' ||
      assignedQp === 'true' ||
      routePath.includes('assigned-claims');

    if (this.isAssignedMode) {
      this.listName = this.listName || 'My Assigned Claims';
      this.loadAssignedClaims();
      return;
    }

    const raw =
      this.route.snapshot.paramMap.get('listNumber') ||
      this.route.snapshot.paramMap.get('id') ||
      this.route.snapshot.queryParamMap.get('listNumber') ||
      (state?.listNumber != null ? String(state.listNumber) : '') ||
      (state?.list_number != null ? String(state.list_number) : '');

    const n = raw ? Number(raw) : NaN;
    this.listNumber = Number.isFinite(n) && n > 0 ? n : NaN;

    if (!this.hasListNumber) {
      this.errorMessage = 'Invalid list number.';
      this.cdr.markForCheck();
      return;
    }

    this.loadListDetails();
  }

  get hasListNumber(): boolean {
    return Number.isFinite(this.listNumber) && this.listNumber > 0;
  }

  private loadAssignedClaims(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.rows = [];
    this.cdr.markForCheck();

    const url = `${this.baseUrl}/ar-followup/assigned-claims`;

    this.http
      .get<any[]>(url, { withCredentials: true })
      .pipe(
        map((data) => (Array.isArray(data) ? data : [])),
        map((assignedRows: any[]) =>
          assignedRows.map((r: any) => this.claimstatusService.normalizeClaimStatusRow(r))
        ),
        catchError((err) => {
          console.error('Error loading assigned claims', err);
          this.errorMessage = 'Failed to load assigned claims.';
          return of([] as ClaimStatusReport[]);
        })
      )
      .subscribe((rows) => {
        this.rows = Array.isArray(rows) ? rows : [];
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  private refreshAssignedClaimsSilently(): void {
    const url = `${this.baseUrl}/ar-followup/assigned-claims`;

    this.http
      .get<any[]>(url, { withCredentials: true })
      .pipe(
        map((data) => (Array.isArray(data) ? data : [])),
        map((assignedRows: any[]) =>
          assignedRows.map((r: any) => this.claimstatusService.normalizeClaimStatusRow(r))
        ),
        catchError((err) => {
          console.error('Silent assigned claims refresh failed', err);
          return of(this.rows);
        })
      )
      .subscribe((rows) => {
        this.rows = Array.isArray(rows) ? rows : [];
        this.cdr.markForCheck();
      });
  }

  private loadListDetails(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.rows = [];
    this.cdr.markForCheck();

    const url = `${this.baseUrl}/ar-followup/listDetails/${this.listNumber}`;

    this.http
      .get<any[]>(url, { withCredentials: true })
      .pipe(
        map((data) => (Array.isArray(data) ? data : [])),
        switchMap((savedRows: any[]) => {
          console.log('[AR LIST DEBUG] saved rows from /listDetails ->', savedRows);
          console.log(
            '[AR LIST DEBUG] first saved row from /listDetails ->',
            savedRows?.[0]
              ? {
                  claimNumber: savedRows[0].claimNumber,
                  latestFollowupId: savedRows[0].latestFollowupId,
                  latestStatusId: savedRows[0].latestStatusId,
                  latestActId: savedRows[0].latestActId,
                  latestStatusLabel: savedRows[0].latestStatusLabel,
                  latestActionLabel: savedRows[0].latestActionLabel,
                  latestNotes: savedRows[0].latestNotes
                }
              : null
          );

          if (!this.listName && savedRows.length > 0) {
            const first: any = savedRows[0];
            this.listName = first.listName ?? first.list_name ?? null;
          }

          return this.expandOrReturnSavedRows(savedRows, false);
        }),
        catchError((err) => {
          console.error('Error loading list details', err);
          this.errorMessage = 'Failed to load saved AR follow-up list details.';
          return of([] as ClaimStatusReport[]);
        })
      )
      .subscribe((rows) => {
        this.rows = Array.isArray(rows) ? rows : [];
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  refreshListDetailsSilently(): void {
    if (this.isAssignedMode) {
      this.refreshAssignedClaimsSilently();
      return;
    }

    if (!this.hasListNumber) return;

    const url = `${this.baseUrl}/ar-followup/listDetails/${this.listNumber}`;

    this.http
      .get<any[]>(url, { withCredentials: true })
      .pipe(
        map((data) => (Array.isArray(data) ? data : [])),
        switchMap((savedRows: any[]) => {
          console.log('[AR LIST DEBUG] silent refresh saved rows ->', savedRows);

          if (!this.listName && savedRows.length > 0) {
            const first: any = savedRows[0];
            this.listName = first.listName ?? first.list_name ?? null;
          }

          return this.expandOrReturnSavedRows(savedRows, true);
        }),
        catchError((err) => {
          console.error('Silent list refresh failed', err);
          return of(this.rows);
        })
      )
      .subscribe((rows) => {
        this.rows = Array.isArray(rows) ? rows : [];
        this.cdr.markForCheck();
      });
  }

  private expandOrReturnSavedRows(
    savedRows: any[],
    isSilentRefresh: boolean
  ) {
    const looksCollapsed = savedRows.some((r: any) => {
      const pc = String(r?.procedureCode ?? r?.procedure_code ?? '')
        .trim()
        .toLowerCase();
      return pc === 'one' || pc === 'many';
    });

    if (!looksCollapsed) {
      const normalized = savedRows.map((r: any) =>
        this.claimstatusService.normalizeClaimStatusRow(r)
      );
      return of(normalized as ClaimStatusReport[]);
    }

    const claimNos = new Set(
      savedRows
        .map((r: any) => String(r?.claimNumber ?? r?.claim_number ?? '').trim())
        .filter((s: string) => !!s)
    );

    const keys = new Set(
      savedRows
        .map((r: any) => {
          const cn = String(r?.claimNumber ?? r?.claim_number ?? '').trim();
          const fn = String(r?.filename ?? '').trim();
          return cn ? `${cn}||${fn}` : '';
        })
        .filter((s: string) => !!s)
    );

    const useKey = keys.size > 0;

    return this.claimstatusService.getClaimStatuses().pipe(
      map((all) => {
        let filtered = all.filter((r) => {
          const cn = String((r as any)?.claimNumber ?? '').trim();
          if (!cn || !claimNos.has(cn)) return false;

          if (!useKey) return true;
          const fn = String((r as any)?.filename ?? '').trim();
          return keys.has(`${cn}||${fn}`);
        });

        if (!filtered.length && claimNos.size) {
          filtered = all.filter((r) =>
            claimNos.has(String(r?.claimNumber ?? '').trim())
          );
        }

        if (!filtered.length) {
          console.warn(
            '[ArFollowupListDetails] No expanded matches found; showing saved rows as-is.',
            {
              savedRowsCount: savedRows.length,
              claimNos: Array.from(claimNos),
              keys: Array.from(keys),
              isSilentRefresh
            }
          );

          return savedRows.map((r: any) =>
            this.claimstatusService.normalizeClaimStatusRow(r)
          ) as ClaimStatusReport[];
        }

        const merged = this.mergeSavedFollowupIntoExpandedRows(filtered, savedRows);

        if (isSilentRefresh) {
          console.log('[AR LIST DEBUG] silent refresh expanded claim rows ->', filtered);
          console.log('[AR LIST DEBUG] silent refresh merged expanded rows ->', merged);
          console.log(
            '[AR LIST DEBUG] silent refresh first merged row ->',
            merged?.[0]
              ? {
                  claimNumber: merged[0].claimNumber,
                  latestStatusLabel: (merged[0] as any).latestStatusLabel,
                  latestActionLabel: (merged[0] as any).latestActionLabel,
                  latestNotes: (merged[0] as any).latestNotes,
                  latestStatusId: (merged[0] as any).latestStatusId,
                  latestActId: (merged[0] as any).latestActId
                }
              : null
          );
        } else {
          console.log('[AR LIST DEBUG] expanded claim rows ->', filtered);
          console.log('[AR LIST DEBUG] merged expanded rows ->', merged);
          console.log(
            '[AR LIST DEBUG] first merged row ->',
            merged?.[0]
              ? {
                  claimNumber: merged[0].claimNumber,
                  latestStatusLabel: (merged[0] as any).latestStatusLabel,
                  latestActionLabel: (merged[0] as any).latestActionLabel,
                  latestNotes: (merged[0] as any).latestNotes,
                  latestStatusId: (merged[0] as any).latestStatusId,
                  latestActId: (merged[0] as any).latestActId
                }
              : null
          );
        }

        return merged as ClaimStatusReport[];
      }),
      catchError((err) => {
        if (isSilentRefresh) {
          console.error(
            '[ArFollowupListDetails] Silent refresh failed to expand collapsed rows. Showing saved rows as-is.',
            err
          );
        } else {
          console.error(
            '[ArFollowupListDetails] Failed to expand collapsed list into service lines. Showing saved rows as-is.',
            err
          );
        }

        return of(
          savedRows.map((r: any) =>
            this.claimstatusService.normalizeClaimStatusRow(r)
          ) as ClaimStatusReport[]
        );
      })
    );
  }

  private mergeSavedFollowupIntoExpandedRows(
    expandedRows: ClaimStatusReport[],
    savedRows: any[]
  ): ClaimStatusReport[] {
    const savedByKey = new Map<string, any>();
    const savedByClaim = new Map<string, any>();

    for (const s of savedRows ?? []) {
      const claimNumber = String(s?.claimNumber ?? s?.claim_number ?? '').trim();
      const filename = String(s?.filename ?? '').trim();
      const key = `${claimNumber}||${filename}`;

      if (claimNumber && !savedByClaim.has(claimNumber)) {
        savedByClaim.set(claimNumber, s);
      }
      if (claimNumber && filename && !savedByKey.has(key)) {
        savedByKey.set(key, s);
      }
    }

    return (expandedRows ?? []).map((row) => {
      const claimNumber = String(
        (row as any)?.claimNumber ?? (row as any)?.claim_number ?? ''
      ).trim();

      const filename = String((row as any)?.filename ?? '').trim();

      const key = `${claimNumber}||${filename}`;
      const saved = savedByKey.get(key) ?? savedByClaim.get(claimNumber);

      if (!saved) {
        return row;
      }

      const merged = {
        ...row,

        listId:
          saved?.listId ??
          saved?.list_id ??
          (row as any)?.listId ??
          (row as any)?.list_id ??
          null,

        listNumber:
          saved?.listNumber ??
          saved?.list_number ??
          (row as any)?.listNumber ??
          (row as any)?.list_number ??
          this.listNumber ??
          null,

        latestFollowupId:
          saved?.latestFollowupId ??
          saved?.latest_followup_id ??
          (row as any)?.latestFollowupId ??
          null,

        latestActionDate:
          saved?.latestActionDate ??
          saved?.latest_action_date ??
          (row as any)?.latestActionDate ??
          null,

        latestActionTime:
          saved?.latestActionTime ??
          saved?.latest_action_time ??
          (row as any)?.latestActionTime ??
          null,

        latestStatusId:
          saved?.latestStatusId ??
          saved?.latest_status_id ??
          (row as any)?.latestStatusId ??
          null,

        latestActId:
          saved?.latestActId ??
          saved?.latest_act_id ??
          (row as any)?.latestActId ??
          null,

        latestStatusLabel:
          saved?.latestStatusLabel ??
          saved?.latest_status_label ??
          (row as any)?.latestStatusLabel ??
          null,

        latestActionLabel:
          saved?.latestActionLabel ??
          saved?.latest_action_label ??
          (row as any)?.latestActionLabel ??
          null,

        latestResponsibleParty:
          saved?.latestResponsibleParty ??
          saved?.latest_responsible_party ??
          (row as any)?.latestResponsibleParty ??
          null,

        latestCategory:
          saved?.latestCategory ??
          saved?.latest_category ??
          (row as any)?.latestCategory ??
          null,

        latestUserId:
          saved?.latestUserId ??
          saved?.latest_user_id ??
          (row as any)?.latestUserId ??
          null,

        latestFollowupCreated:
          saved?.latestFollowupCreated ??
          saved?.latest_followup_created ??
          (row as any)?.latestFollowupCreated ??
          null,

        latestNotes:
          saved?.latestNotes ??
          saved?.latest_notes ??
          (row as any)?.latestNotes ??
          null,
colorFlag:
  saved?.colorFlag ??
  saved?.color_flag ??
  (row as any)?.colorFlag ??
  (row as any)?.color_flag ??
  null,
        followupCount:
          saved?.followupCount ??
          saved?.followup_count ??
          (row as any)?.followupCount ??
          null,

        lastFollowupCreated:
          saved?.lastFollowupCreated ??
          saved?.last_followup_created ??
          (row as any)?.lastFollowupCreated ??
          null
      } as ClaimStatusReport;

      console.log('[AR LIST DEBUG] merge saved followup ->', {
        claimNumber,
        filename,
        savedListId: saved?.listId ?? saved?.list_id ?? null,
        savedListNumber: saved?.listNumber ?? saved?.list_number ?? null,
        mergedListId: (merged as any).listId,
        mergedListNumber: (merged as any).listNumber,
        savedLatestStatusLabel:
          saved?.latestStatusLabel ?? saved?.latest_status_label ?? null,
        savedLatestActionLabel:
          saved?.latestActionLabel ?? saved?.latest_action_label ?? null,
        savedLatestNotes: saved?.latestNotes ?? saved?.latest_notes ?? null,
        mergedLatestStatusLabel: (merged as any).latestStatusLabel,
        mergedLatestActionLabel: (merged as any).latestActionLabel,
        mergedLatestNotes: (merged as any).latestNotes
      });

      return merged;
    });
  }
}