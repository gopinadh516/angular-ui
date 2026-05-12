// src/app/views/ar-aging-table/ar-aging-table.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ARTableService }    from './ar-aging.service';
import { ARData, ARResponse } from './ar-table.model';

@Component({
  selector: 'app-ar-aging-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ar-aging-table.component.html',
  styleUrls: ['./ar-aging-table.component.scss']
})
export class ARAgingTableComponent implements OnInit {
  public claimData?: ARData;

  constructor(private svc: ARTableService) {}

  ngOnInit(): void {
    this.svc.getARData().subscribe({
      next: (resp: ARResponse) => {
        this.claimData = resp.claims;
      },
      error: err => console.error('Failed to load AR Aging data:', err)
    });
  }
}
