import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimsTableData } from './claimlisttable.model';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ClaimsTableService {
  private apiUrl = `${environment.apiBaseUrl}/claimtable/all`;  // ✅ API endpoint for claims data

  constructor(private http: HttpClient) {}

  getClaimsData(): Observable<ClaimsTableData[]> {
    return this.http.get<ClaimsTableData[]>(this.apiUrl);
  }
}
