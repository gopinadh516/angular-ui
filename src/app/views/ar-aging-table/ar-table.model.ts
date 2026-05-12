// src/app/ar-table.model.ts

export interface ARData {
  rowCount: number;
  columnCount: number;
  agingLabels: string[];    // ["0–30","31–60","61–90","91–120",">120","R.Total","Total"]
  amountLabels: string[];   // ["<range1>", …, "Total"]
  data: number[][];         // one row per amountLabel, seven columns per row
  fileDate: string;
  fileTime: string;

  // (optional) if you want pre-computed totals:
  rowTotals?: number[];
  columnTotals?: number[];
  rTotals?: number[];
  rGrandTotal?: number;
  subtotalRow?: number[];
  rSubtotal?: number;
}

export interface ARResponse {
  claims: ARData;
  dollars: ARData;
}
