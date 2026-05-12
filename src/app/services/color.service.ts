// src/app/services/color.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ColorService {
  private palette = [
    '#09090b', '#3f3f46', '#52525b', '#71717a',
    '#334155', '#475569', '#64748b', '#374151',
    '#4b5563', '#6b7280'
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
