import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ResolutionReportDashboardResponse,
  ResolutionReportDetailRow,
  ResolutionReportRequest,
  ResolutionReportSummaryRow
} from './resolution-report.model';

@Injectable({ providedIn: 'root' })
export class ResolutionReportService {
  private readonly baseUrl = '/api/ar/payment-resolution';

  constructor(private readonly http: HttpClient) {}

  getDashboard(request: ResolutionReportRequest): Observable<ResolutionReportDashboardResponse> {
    return this.http.get<ResolutionReportDashboardResponse>(`${this.baseUrl}/dashboard`, {
      params: this.toHttpParams(request)
    });
  }

  getSummary(request: ResolutionReportRequest): Observable<ResolutionReportSummaryRow[]> {
    return this.http.get<ResolutionReportSummaryRow[]>(`${this.baseUrl}/summary`, {
      params: this.toHttpParams(request)
    });
  }

  getDetail(request: ResolutionReportRequest): Observable<ResolutionReportDetailRow[]> {
    return this.http.get<ResolutionReportDetailRow[]>(`${this.baseUrl}/detail`, {
      params: this.toHttpParams(request)
    });
  }

  private toHttpParams(request: ResolutionReportRequest): HttpParams {
    let params = new HttpParams()
      .set('licenseKey', String(request.licenseKey ?? 160088))
      .set('fromDate', request.fromDate)
      .set('toDate', request.toDate)
      .set('appType', request.appType || 'AMD');

    if (request.visitFid !== undefined && request.visitFid !== null) {
      params = params.set('visitFid', String(request.visitFid));
    }

    const claimId = (request.claimId || '').trim();
    if (claimId.length > 0) {
      params = params.set('claimId', claimId);
    }

    const clientCode = (request.clientCode || '').trim();
    if (clientCode.length > 0) {
      params = params.set('clientCode', clientCode);
    }

    return params;
  }
}
