import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MgmtNcrByDoeRow {
  monthStart: string; // "YYYY-MM-DD"
  visits: number;
  charges: number;
  totalInsurancePayments: number;
  totalInsuranceAdjustments: number;
  totalPatientPayments: number;
  totalPayments: number;
  gcrPercent: number; // 193.8 = 193.8%
  ncrPercent: number; // -181.3 = -181.3%
}

@Injectable({ providedIn: 'root' })
export class MgmtNcrByDoeService {
  private readonly baseUrl = '/api/showncr/byEntry';

  constructor(private http: HttpClient) {}

  getReport(licenseKey: number): Observable<MgmtNcrByDoeRow[]> {
    const params = new HttpParams().set('licenseKey', String(licenseKey));
    return this.http.get<MgmtNcrByDoeRow[]>(this.baseUrl, { params });
  }
}