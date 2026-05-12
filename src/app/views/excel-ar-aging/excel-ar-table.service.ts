import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ARData } from './excel-ar-table.model'; 
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ARTableService {
  private apiUrl = `${environment.apiBaseUrl}/ARData/ar-table`;  

  constructor(private http: HttpClient) {}

  getARData(): Observable<ARData> {
    return this.http.get<ARData>(this.apiUrl);
  }
}
