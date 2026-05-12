// src/app/views/ar-aging-table/ar-aging.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ARResponse } from './ar-table.model';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class ARTableService {
  private apiUrl = `${environment.apiBaseUrl}/ar-aging/byClaimsAndDollar`;  

  constructor(private http: HttpClient) {}

  getARData(): Observable<ARResponse> {
    return this.http.get<ARResponse>(this.apiUrl);
  }
}
