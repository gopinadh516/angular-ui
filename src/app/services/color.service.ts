// src/app/services/color.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ColorService {
  private palette = [
    '#6366f1', '#059669', '#d97706', '#dc2626', '#7c3aed',
    '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'
  ];
  private map = new Map<string,string>();

  /** 
   * Returns a deterministic color for the given key.
   * New keys get assigned the next palette color in sequence.
   */
  getColor(key: string): string {
    if (!this.map.has(key)) {
      const idx = this.map.size % this.palette.length;
      this.map.set(key, this.palette[idx]);
    }
    return this.map.get(key)!;
  }
}
