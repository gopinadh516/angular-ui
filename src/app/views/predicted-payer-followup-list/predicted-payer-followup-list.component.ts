import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ClaimstatusComponent } from '../claimstatus/claimstatus.component';
import {
  ClaimstatusService,
  ClaimStatusReport
} from '../claimstatus/claimstatus.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-predicted-payer-followup-list',
  standalone: true,
  imports: [CommonModule, ClaimstatusComponent],
  templateUrl: './predicted-payer-followup-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PredictedPayerFollowupListComponent implements OnInit {
  rows: ClaimStatusReport[] = [];

  isLoading = false;
  errorMessage: string | null = null;

listName = 'Predicted Payer Follow-up List';
listNumber: number | string | null = null;
isAssignedMode = false;

  private readonly baseUrl = environment.apiBaseUrl;
  private readonly companyId = 160088;

  constructor(
    private http: HttpClient,
    private claimstatusService: ClaimstatusService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadLatestPredictionFollowupList();
  }

  loadLatestPredictionFollowupList(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.rows = [];
    this.cdr.markForCheck();

    const url = `${this.baseUrl}/predicted-payer-followup-list`;

    const params = new HttpParams()
      .set('companyId', String(this.companyId));

    this.http
      .get<any[]>(url, {
        params,
        withCredentials: true
      })
      .pipe(
        map((data) => Array.isArray(data) ? data : []),
        map((data) =>
          data.map((row: any) =>
            this.claimstatusService.normalizeClaimStatusRow(row)
          )
        ),
        catchError((err) => {
          console.error('Error loading predicted payer follow-up list', err);
          this.errorMessage = 'Failed to load predicted payer follow-up list.';
          return of([] as ClaimStatusReport[]);
        })
      )
      .subscribe((rows) => {
        this.rows = rows;
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  refreshListDetailsSilently(): void {
    this.loadLatestPredictionFollowupList();
  }
}