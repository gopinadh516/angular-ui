import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MgmtNcrByDoeRow {
  // ✅ always a string after normalization ('' if missing)
  monthStart: string; // "YYYY-MM-01" preferred

  visits: number;
  charges: number;
  totalInsurancePayments: number;
  totalInsuranceAdjustments: number;
  totalPatientPayments: number;
  totalPayments: number;

  gcrPercent?: number;
  ncrPercent?: number;

  // optional fallbacks if backend returns these
  month?: string | null;
  Month?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MgmtNcrByDoeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/showncr/byDateEntry`;

  private cache = new Map<number, Observable<MgmtNcrByDoeRow[]>>();

  constructor(private http: HttpClient) {}

  getReport(licenseKey: number): Observable<MgmtNcrByDoeRow[]> {
    const key = Number(licenseKey) || 0;

    const existing = this.cache.get(key);
    if (existing) return existing;

    const params = new HttpParams().set('licenseKey', String(key));

    const req$ = this.http
      .get<any[]>(this.baseUrl, { params, withCredentials: true })
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : []).map((r) => this.normalizeRow(r))),
        catchError((err) => {
          this.cache.delete(key);
          return throwError(() => err);
        }),
        shareReplay(1)
      );

    this.cache.set(key, req$);
    return req$;
  }

  clearCache(licenseKey?: number) {
    if (licenseKey == null) this.cache.clear();
    else this.cache.delete(Number(licenseKey));
  }

  private normalizeRow(r: any): MgmtNcrByDoeRow {
    const raw = r?.monthStart ?? r?.month ?? r?.Month ?? r?.['Month'] ?? '';
    const monthStart = this.normalizeMonthStart(raw);

    return {
      ...r,
      monthStart, // ✅ always string
    } as MgmtNcrByDoeRow;
  }

  private normalizeMonthStart(v: any): string {
    if (v == null) return '';
    let s = String(v).trim();
    if (!s) return '';

    // "YYYY-MM" -> "YYYY-MM-01"
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;

    // "YYYY-MM-DD..." -> "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

    return s;
  }
}