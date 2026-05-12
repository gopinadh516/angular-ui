import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ProductivityCollectorOptionDTO,
  ProductivityFactDTO,
  ProductivityReportRequest,
  ProductivitySectionGroup,
} from './productivity-report.models';
import { ProductivityReportService } from './productivity-report.service';

@Component({
  selector: 'app-productivity-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productivity-report.component.html',
  styleUrls: ['./productivity-report.component.scss'],
})
export class ProductivityReportComponent implements OnInit {
  private readonly service = inject(ProductivityReportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loadingFacts = signal(false);
  readonly loadingCollectors = signal(false);
  readonly errorMessage = signal('');
  collectorSearchText = '';
  readonly collectorOptions = signal<ProductivityCollectorOptionDTO[]>([]);
  readonly rows = signal<ProductivityFactDTO[]>([]);

  selectedClient = this.getInitialSelectedClient();
  appType = this.resolveAppType(this.selectedClient);
  asOfDate = this.toDateInputValue(new Date());
  collectorName = '';
  licenseKey: number | null = null;

  readonly sectionGroups = computed<ProductivitySectionGroup[]>(() => {
    const map = new Map<string, ProductivityFactDTO[]>();

    for (const row of this.rows()) {
      const key = (row.sectionName || 'Report').trim() || 'Report';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    }

    return Array.from(map.entries()).map(([sectionName, groupRows]) => ({
      sectionName,
      rows: [...groupRows].sort((a, b) => (a.rowSort ?? 0) - (b.rowSort ?? 0)),
    }));
  });

  ngOnInit(): void {
    this.loadCollectors();
    this.loadFacts();
  }

  onClientChange(): void {
    this.appType = this.resolveAppType(this.selectedClient);
    this.loadCollectors();
    this.loadFacts();
  }

  onSearchClick(): void {
    this.loadFacts();
  }

  onResetClick(): void {
    this.asOfDate = this.toDateInputValue(new Date());
    this.collectorName = '';
    this.collectorSearchText = '';
    this.licenseKey = null;
    this.errorMessage.set('');
    this.loadCollectors();
    this.loadFacts();
  }

  onCollectorSearchChange(): void {
    this.loadCollectors();
  }

  trackBySection(_: number, section: ProductivitySectionGroup): string {
    return section.sectionName;
  }

  trackByRow(_: number, row: ProductivityFactDTO): string {
    return `${row.sectionSort ?? 0}-${row.rowSort ?? 0}-${row.sectionName ?? ''}-${row.period ?? ''}`;
  }

  formatNumber(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US').format(Number(value ?? 0));
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
  }

  private loadFacts(): void {
    this.loadingFacts.set(true);
    this.errorMessage.set('');

    this.service
      .getFacts(this.buildRequest())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingFacts.set(false)),
      )
      .subscribe({
        next: (response) => this.rows.set(response ?? []),
        error: (error) => {
          console.error('Failed to load productivity facts', error);
          this.rows.set([]);
          this.errorMessage.set('Unable to load productivity report. Please check the API and try again.');
        },
      });
  }

  private loadCollectors(): void {
    this.loadingCollectors.set(true);

    this.service
      .getCollectors(this.buildRequest())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingCollectors.set(false)),
      )
      .subscribe({
        next: (response) => this.collectorOptions.set(response ?? []),
        error: (error) => {
          console.error('Failed to load productivity collectors', error);
          this.collectorOptions.set([]);
        },
      });
  }

  private buildRequest(): ProductivityReportRequest {
    return {
      asOfDate: this.asOfDate || null,
      selectedClient: this.selectedClient || null,
      appType: this.appType || null,
      collectorName: this.collectorName || null,
      searchText: this.collectorSearchText || null,
      licenseKey: this.licenseKey,
    };
  }

  private getInitialSelectedClient(): string {
    const stored = localStorage.getItem('selectedClient');
    return stored && stored.trim() ? stored.trim().toUpperCase() : 'SALEM';
  }

  private resolveAppType(selectedClient: string): string {
    return selectedClient?.trim().toUpperCase() === 'PALMERI' ? 'EDI' : 'AMD';
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
