import { Component } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-autocoding',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './autocoding.component.html',
  styleUrls: ['./autocoding.component.scss']
})
export class AutocodingComponent {
  clinicalText: string = '';
  result: string = '';
  error: string = '';
  loading: boolean = false;

  constructor(private http: HttpClient) {}

  predictCodes() {
    this.loading = true;
    this.result = '';
    this.error = '';

    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.http.post(`${environment.apiBaseUrl}/coding/predict`,
      { text: this.clinicalText },
      { headers, responseType: 'text' }
    ).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
      },
      error: () => {
        this.error = 'Prediction failed. Please try again.';
        this.loading = false;
      }
    });
  }
  clinicalNotes: string[] = [
  "39-year-old female with suspected pulmonary embolism. Chest CT angiogram and pulse oximetry advised.",
  "56-year-old male with uncontrolled hypertension and recent fall, requires head CT and cervical spine X-ray.",
  "39-year-old female with suspected pulmonary embolism. Chest CT angiogram and pulse oximetry advised.",
  "72-year-old male with shortness of breath and hypoxia. Imaging to evaluate possible interstitial lung disease.",
  "68-year-old female complains of severe flank pain. Abdominal CT and KUB X-ray planned. History of kidney stones.",
  "66-year-old female with recent chest trauma. Rib series and thoracic spine imaging ordered.",
  "75-year-old male with history of COPD and diabetes, experiencing worsening cough and shortness of breath. Chest X-ray and CT thorax advised.",
  "82-year-old female with fever and persistent cough. Chest imaging for suspected pneumonia requested.",
  "47-year-old male undergoing follow-up radiologic evaluation for known renal mass. Multiple imaging procedures ordered.",
  "68-year-old female complains of severe flank pain. Abdominal CT and KUB X-ray planned. History of kidney stones."
];

}
