import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
export interface MgmtNcrRow {
  monthStart: string; // "YYYY-MM-DD"
  visits: number;
  charges: number;
  totalInsurancePayments: number;
  totalInsuranceAdjustments: number;
  totalPatientPayments: number;
  totalPayments: number;

  // Backend may send ratio (0–1) OR percent (0–100)
  gcrPercent: number;
  ncrPercent: number;
}

@Injectable({ providedIn: 'root' })
export class MgmtNcrService {
  private readonly baseUrl = `${environment.apiBaseUrl}/showgcr/byDataDOS`;
  constructor(private http: HttpClient) {}
// this is top table MVR
  getNcrReport(licenseKey: number): Observable<MgmtNcrRow[]> {
    const params = new HttpParams().set('licenseKey', String(licenseKey));
    return this.http.get<MgmtNcrRow[]>(this.baseUrl, { params });
  }
}