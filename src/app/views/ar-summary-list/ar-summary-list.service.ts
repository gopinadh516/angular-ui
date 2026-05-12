import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ArFollowupListSummary, RevMaxUserDTO } from './ar-summary-list.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ArSummaryListService {

  private readonly baseUrl = `${environment.apiBaseUrl}/ar-followup`;

  constructor(private http: HttpClient) {}

  getListsForOwner(owner: string): Observable<ArFollowupListSummary[]> {
    return this.http.get<ArFollowupListSummary[]>(
      `${this.baseUrl}/showARlists?owner=${encodeURIComponent(owner)}`
    );
  }

  getVisibleListsForRole(): Observable<ArFollowupListSummary[]> {
    return this.http.get<ArFollowupListSummary[]>(
      `${this.baseUrl}/showVisibleListsForRole`
    );
  }

  getAllRevMaxUsers(): Observable<RevMaxUserDTO[]> {
    return this.http.get<RevMaxUserDTO[]>(
      `${this.baseUrl}/getallrevmaxusers`
    );
  }

  assignArList(listNumber: number, assigneeEmail: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/assignarlist`,
      { listNumber, assigneeEmail }
    );
  }
  deleteArList(listNumber: number): Observable<void> {
  return this.http.delete<void>(
    `${this.baseUrl}/ar/followup-list/${listNumber}`
  );
}
}