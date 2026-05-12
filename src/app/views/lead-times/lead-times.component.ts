// src/app/views/lead-times/lead-times.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule, RowComponent, ColComponent } from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { ChartData, ChartOptions } from 'chart.js';

@Component({
  standalone: true,
  selector: 'app-lead-times',
  templateUrl: './lead-times.component.html',
  styleUrls: ['./lead-times.component.scss'],
  imports: [CommonModule, CardModule, RowComponent, ColComponent, ChartjsComponent],
})
export class LeadTimesComponent {
  public bellCurveData: ChartData<'line'> = {
    labels: ['-3', '-2', '-1', '0', '1', '2', '3'],
    datasets: [
      {
        label: 'Normal Distribution',
        data: [0.004, 0.054, 0.242, 0.399, 0.242, 0.054, 0.004],
        fill: true,
        tension: 0.4,
        borderColor: '#09090b',
        backgroundColor: 'rgba(9,9,11,0.07)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#09090b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
      }
    ]
  };

  public bellCurveOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { boxWidth: 12, font: { size: 12 } }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'x', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      y: {
        title: { display: true, text: 'Probability Density', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    }
  };
}
