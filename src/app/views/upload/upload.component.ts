import { Component } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { NgIf, NgClass, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-upload',
  standalone: true,
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
  imports: [NgIf, NgClass, NgFor, FormsModule]
})
export class UploadComponent {
  // Dropdowns
  clients: string[] = ['SSM Health', 'MediCare Express'];
  selectedClient: string = this.clients[0];

  dataForOptions: Array<{ label: string; value: 'AR_GRID' | 'TRX_DETAILS' }> = [
    { label: 'AR Grid', value: 'AR_GRID' },
    { label: 'Transaction Details', value: 'TRX_DETAILS' }
  ];
  selectedDataFor: 'AR_GRID' | 'TRX_DETAILS' = 'AR_GRID'; // ✅ default = current behavior

  selectedFile: File | null = null;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  isUploadSuccessful: boolean = false;
  isUploading: boolean = false;
  isDragOver: boolean = false;

  // ✅ No regression: same endpoint as your working one
  private AR_GRID_URL = `${environment.apiBaseUrl}/files/upload`;

  // ✅ New endpoint for transaction details
  private TRX_DETAILS_URL = `${environment.apiBaseUrl}/files/trxdetails/uploadsave`;

  constructor(private http: HttpClient) {}

  get fileAccept(): string {
    return this.selectedDataFor === 'AR_GRID' ? '.xlsx,.xls' : '.csv';
  }

  onDataForChange() {
    // prevent wrong file type upload
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.uploadMessage = '';
    this.isUploadSuccessful = false;
  }

  onFileSelected(event: any) {
    this.selectedFile = event?.target?.files?.[0] ?? null;
    this.uploadMessage = '';
    this.uploadProgress = 0;
    this.isUploadSuccessful = false;
  }

  uploadFile() {
    if (!this.selectedFile) {
      alert('Please select a file first');
      return;
    }

    // light validation
    const lower = (this.selectedFile.name || '').toLowerCase();
    if (this.selectedDataFor === 'AR_GRID' && !(lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
      alert('Please upload an Excel file (.xlsx/.xls) for AR Grid.');
      return;
    }
    if (this.selectedDataFor === 'TRX_DETAILS' && !lower.endsWith('.csv')) {
      alert('Please upload a CSV file (.csv) for Transaction Details.');
      return;
    }

    this.isUploading = true;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    // safe extras (backend can ignore if not used)
    formData.append('clientName', this.selectedClient);
    formData.append('dataFor', this.selectedDataFor);

    const url = this.selectedDataFor === 'AR_GRID' ? this.AR_GRID_URL : this.TRX_DETAILS_URL;

    this.http.post<{ message: string; inserted?: number }>(url, formData, {
      reportProgress: true,
      observe: 'events',
      withCredentials: true
    }).subscribe({
      next: (event: HttpEvent<{ message: string }>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            this.uploadProgress = Math.round((event.loaded / (event.total ?? 1)) * 100);
            break;

          case HttpEventType.Response:
            this.isUploading = false;
            if (event.status === 200 && event.body?.message) {
              this.uploadMessage = event.body.message;
              this.isUploadSuccessful = true;
            } else {
              this.uploadMessage = 'Upload failed: Unexpected response.';
              this.isUploadSuccessful = false;
              alert(this.uploadMessage);
            }
            break;
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isUploading = false;
        this.isUploadSuccessful = false;
        console.error('Upload error:', error);

        if (error.status === 0) {
          this.uploadMessage = 'Server is not reachable. Make sure the backend is running.';
        } else if (error.status === 400 || error.status === 500) {
          this.uploadMessage = error.error.message || 'Upload failed due to server error.';
        } else {
          this.uploadMessage = 'Upload failed due to an unknown error.';
        }
        alert(this.uploadMessage);
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files.length) {
      this.selectedFile = event.dataTransfer.files[0];
      this.uploadMessage = '';
      this.uploadProgress = 0;
      this.isUploadSuccessful = false;
    }
  }
}
