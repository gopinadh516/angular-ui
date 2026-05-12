import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PhysicianDailyFactDTO,
  PhysicianDailyReportRequest,
  PhysicianOptionDTO
} from './physician-daily-report.models';

@Injectable({ providedIn: 'root' })
export class PhysicianDailyReportService {
  private readonly baseUrl = '/api/reports/physician-daily';

  constructor(private http: HttpClient) {}

  fetchPhysicians(
    request: PhysicianDailyReportRequest,
    selectedClient?: string | null
  ): Observable<PhysicianOptionDTO[]> {
    return this.http.post<PhysicianOptionDTO[]>(
      `${this.baseUrl}/physicians`,
      request,
      { headers: this.buildHeaders(selectedClient) }
    );
  }

  fetchFacts(
    request: PhysicianDailyReportRequest,
    selectedClient?: string | null
  ): Observable<PhysicianDailyFactDTO[]> {
    return this.http.post<PhysicianDailyFactDTO[]>(
      `${this.baseUrl}/facts`,
      request,
      { headers: this.buildHeaders(selectedClient) }
    );
  }

  private buildHeaders(selectedClient?: string | null): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (selectedClient && selectedClient.trim()) {
      headers = headers.set('X-Selected-Client', selectedClient.trim());
    }

    return headers;
  }
}
