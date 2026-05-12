export interface ARData {
  rowCount: number;
  columnCount: number;
  agingLabels: string[];
  amountLabels: string[];
  data: number[][];

  fileDate: string; // ✅ Make required
  fileTime: string; // ✅ Make required

  rowTotals?: number[];
  columnTotals?: number[];
  rTotals?: number[];
  rGrandTotal?: number;
  subtotalRow?: number[];
  rSubtotal?: number;
}
