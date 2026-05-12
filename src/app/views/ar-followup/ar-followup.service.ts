import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClaimStatusReport {
  [key: string]: any;
}

export interface ArFollowupCreateRequest {
  listName: string;
  currentOwner: string;
  action?: string;
  filterSummary?: string;
  claims: ClaimStatusReport[];
}

export interface ArFollowupListSummaryRow {
  listNumber: number;
  listName: string;
  currentOwner?: string;
  assignedTo?: string;
  listAction?: string;
  filterSummary?: string;
  claimCount?: number;
  visibleClaimCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ArFollowupService {
  private baseUrl = `${environment.apiBaseUrl}/ar-followup`;

  constructor(private http: HttpClient) {}

  createFollowupList(payload: ArFollowupCreateRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/lists`, payload);
  }

  getArLists(owner: string): Observable<ArFollowupListSummaryRow[]> {
    const params = new HttpParams().set('owner', owner);
    return this.http.get<ArFollowupListSummaryRow[]>(`${this.baseUrl}/showARlists`, { params });
  }

  getVisibleListsForRole(): Observable<ArFollowupListSummaryRow[]> {
    return this.http.get<ArFollowupListSummaryRow[]>(`${this.baseUrl}/showVisibleListsForRole`);
  }

  getListDetails(listNumber: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/listDetails/${listNumber}`);
  }
}