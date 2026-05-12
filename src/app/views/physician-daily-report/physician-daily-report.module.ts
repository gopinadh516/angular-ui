import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PhysicianDailyReportComponent } from './physician-daily-report.component';

@NgModule({
  declarations: [PhysicianDailyReportComponent],
  imports: [CommonModule, FormsModule, HttpClientModule],
  exports: [PhysicianDailyReportComponent]
})
export class PhysicianDailyReportModule {}
