import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ProductivityCollectorOptionDTO,
  ProductivityFactDTO,
  ProductivityReportRequest,
} from './productivity-report.models';

@Injectable({ providedIn: 'root' })
export class ProductivityReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/productivity-report';

  getFacts(request: ProductivityReportRequest): Observable<ProductivityFactDTO[]> {
    return this.http.post<ProductivityFactDTO[]>(`${this.baseUrl}/facts`, request ?? {});
  }

  getCollectors(request: ProductivityReportRequest): Observable<ProductivityCollectorOptionDTO[]> {
    return this.http.post<ProductivityCollectorOptionDTO[]>(`${this.baseUrl}/collectors`, request ?? {});
  }
}
