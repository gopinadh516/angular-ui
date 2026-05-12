export interface ProductivityReportRequest {
  asOfDate?: string | null;
  selectedClient?: string | null;
  appType?: string | null;
  collectorName?: string | null;
  searchText?: string | null;
  licenseKey?: number | null;
}

export interface ProductivityFactDTO {
  sectionSort?: number | null;
  rowSort?: number | null;
  sectionName?: string | null;
  period?: string | null;
  touches?: number | null;
  uniqueClaims?: number | null;
  arValue?: number | null;
}

export interface ProductivityCollectorOptionDTO {
  value?: string | null;
  label?: string | null;
}

export interface ProductivitySectionGroup {
  sectionName: string;
  rows: ProductivityFactDTO[];
}
