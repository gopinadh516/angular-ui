import { Routes } from '@angular/router';
import { UploadComponent } from './upload.component';

export const routes: Routes = [
  {
    path: '',
    component: UploadComponent,
    data: {
      title: 'Upload File'
    }
  }
];
