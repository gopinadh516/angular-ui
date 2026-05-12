import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';

export interface Physician {
  id: string;
  name: string;
  specialty?: string;
}

export type VisitStatus =
  | 'Scheduled'
  | 'Checked-In'
  | 'In-Progress'
  | 'Completed'
  | 'Cancelled'
  | 'No-Show';

export interface PatientEncounter {
  id: string;
  date: string;              // YYYY-MM-DD
  physicianId: string;
  physicianName?: string;
  patientId: string;         // MRN
  patientName: string;
  appointmentTime?: string;  // HH:mm
  checkedInAt?: string;      // HH:mm
  startedAt?: string;        // HH:mm
  completedAt?: string;      // HH:mm
  status: VisitStatus;
  visitType?: string;        // e.g., New, Follow-up, Urgent
  notes?: string;
  durationMinutes?: number;  // auto-computed on complete
  room?: string;             // <-- added for template
}

type Summary = {
  total: number;
  scheduled: number;
  checkedIn: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
  avgDurationCompleted: number | null;
};

@Component({
  selector: 'app-encounter-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './encounter-tracker.component.html',
  styleUrls: ['./encounter-tracker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EncounterTrackerComponent implements OnInit, OnChanges {
  @Input() physicians: Physician[] = [];
  @Input() initialEncounters: PatientEncounter[] = [];
  @Input() storageKey = 'encounter-tracker';
  @Input() defaultPhysicianId: string | 'ALL' = 'ALL';

  @Output() upsertEncounter = new EventEmitter<PatientEncounter>();
  @Output() deleteEncounter = new EventEmitter<string>();
  @Output() encountersChange = new EventEmitter<PatientEncounter[]>();
  @Output() dayChanged = new EventEmitter<string>();
  @Output() statusChanged = new EventEmitter<{ id: string; status: VisitStatus }>();

  selectedDateISO = this.toISODate(new Date());
  selectedPhysicianId: string | 'ALL' = 'ALL';
  filterStatus: 'ALL' | VisitStatus = 'ALL';
  searchText = '';
  persistToLocal = true;

  qa: { patientName: string; patientId: string; visitType: string; apptTime: string; physicianId: string } = {
    patientName: '',
    patientId: '',
    visitType: 'New',
    apptTime: this.roundToNext5Min(new Date()),
    physicianId: ''
  };

  visitTypeOptions = ['New', 'Follow-up', 'Urgent', 'Physical', 'Telehealth'];
  roomOptions = ['1', '2', '3', '4', '5', '6', '7', '8'];

  private all: PatientEncounter[] = [];
  filtered: PatientEncounter[] = [];
  summary: Summary = this.emptySummary();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.selectedPhysicianId = this.defaultPhysicianId ?? 'ALL';
    this.qa.physicianId = this.selectedPhysicianId !== 'ALL' ? this.selectedPhysicianId : (this.physicians[0]?.id ?? '');

    const boot = this.persistToLocal ? this.readFromLocal() : null;
    if (boot && Array.isArray(boot)) {
      this.all = boot;
    } else {
      this.all = (this.initialEncounters ?? []).map(e => this.normalize(e));
    }
    this.applyFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialEncounters'] && !changes['initialEncounters'].firstChange) {
      const incoming = (this.initialEncounters ?? []).map(e => this.normalize(e));
      const existing = new Map(this.all.map(e => [e.id, e]));
      for (const e of incoming) existing.set(e.id, e);
      this.all = Array.from(existing.values());
      this.applyFilters();
    }
  }

  // Quick Add
  setQuickApptNow(): void {
    this.qa.apptTime = this.roundToNext5Min(new Date());
  }

  addQuick(): void {
    const physicianId = this.qa.physicianId || (this.selectedPhysicianId !== 'ALL' ? this.selectedPhysicianId : (this.physicians[0]?.id ?? ''));
    const enc: PatientEncounter = {
      id: this.uuid(),
      date: this.selectedDateISO,
      physicianId,
      physicianName: this.physicians.find(p => p.id === physicianId)?.name,
      patientId: (this.qa.patientId ?? '').trim(),
      patientName: (this.qa.patientName ?? '').trim(),
      appointmentTime: this.qa.apptTime || this.roundToNext5Min(new Date()),
      status: 'Scheduled',
      visitType: this.qa.visitType || 'New',
      notes: ''
    };
    this.all.unshift(enc);
    this.applyFilters();
    this.emitChange();
    this.persist();
    this.qa.patientName = '';
    this.qa.patientId = '';
    this.qa.apptTime = this.roundToNext5Min(new Date());
  }

  addEncounter(): void {
    const defaultPhysicianId = this.selectedPhysicianId !== 'ALL'
      ? this.selectedPhysicianId
      : (this.physicians[0]?.id ?? 'unknown');

    const enc: PatientEncounter = {
      id: this.uuid(),
      date: this.selectedDateISO,
      physicianId: defaultPhysicianId,
      physicianName: this.physicians.find(p => p.id === defaultPhysicianId)?.name,
      patientId: '',
      patientName: '',
      appointmentTime: this.roundToNext5Min(new Date()),
      status: 'Scheduled',
      notes: ''
    };
    this.all.unshift(enc);
    this.applyFilters();
    this.emitChange();
  }

  duplicate(e: PatientEncounter): void {
    const copy: PatientEncounter = {
      ...e,
      id: this.uuid(),
      checkedInAt: undefined,
      startedAt: undefined,
      completedAt: undefined,
      durationMinutes: undefined,
      status: 'Scheduled',
      notes: ''
    };
    this.all.unshift(copy);
    this.applyFilters();
    this.emitChange();
    this.persist();
  }

  setNow(target: PatientEncounter, field: 'appointmentTime'|'checkedInAt'|'startedAt'|'completedAt'): void {
    (target as any)[field] = this.nowHHmm();
    if (field === 'checkedInAt' && target.status === 'Scheduled') target.status = 'Checked-In';
    if (field === 'startedAt' && target.status !== 'Completed') target.status = 'In-Progress';
    if (field === 'completedAt') { target.status = 'Completed'; this.computeDuration(target); }
    this.touch(target);
  }

  remove(id: string): void {
    this.all = this.all.filter(e => e.id !== id);
    this.applyFilters();
    this.emitChange();
    this.deleteEncounter.emit(id);
    this.persist();
  }

  // Toolbar button
  clearDay(): void {
    const day = this.selectedDateISO;
    this.all = this.all.filter(e => e.date !== day);
    this.applyFilters();
    this.emitChange();
    this.persist();
  }

  emitSave(e: PatientEncounter): void {
    const norm = this.normalize(e);
    this.replace(norm);
    this.applyFilters();
    this.upsertEncounter.emit(norm);
    this.persist();
  }

  emitBulkSave(): void {
    const payload = this.filtered.map(e => this.normalize(e));
    payload.forEach(p => this.replace(p));
    this.applyFilters();
    this.encountersChange.emit(this.all.slice());
    this.persist();
  }

  checkIn(e: PatientEncounter): void {
    e.checkedInAt = this.nowHHmm();
    e.status = 'Checked-In';
    this.touch(e);
    this.statusChanged.emit({ id: e.id, status: e.status });
  }

  start(e: PatientEncounter): void {
    e.startedAt = this.nowHHmm();
    e.status = 'In-Progress';
    this.touch(e);
    this.statusChanged.emit({ id: e.id, status: e.status });
  }

  complete(e: PatientEncounter): void {
    e.completedAt = this.nowHHmm();
    e.status = 'Completed';
    this.computeDuration(e);
    this.touch(e);
    this.statusChanged.emit({ id: e.id, status: e.status });
  }

  markCancelled(e: PatientEncounter): void {
    e.status = 'Cancelled';
    this.touch(e);
    this.statusChanged.emit({ id: e.id, status: e.status });
  }

  markNoShow(e: PatientEncounter): void {
    e.status = 'No-Show';
    this.touch(e);
    this.statusChanged.emit({ id: e.id, status: e.status });
  }

  onCheckInManual(e: PatientEncounter): void {
    if (e.checkedInAt && e.status === 'Scheduled') {
      e.status = 'Checked-In';
      this.statusChanged.emit({ id: e.id, status: e.status });
    }
    this.touch(e);
  }

  onStartManual(e: PatientEncounter): void {
    if (e.startedAt && e.status !== 'Completed') {
      e.status = 'In-Progress';
      this.statusChanged.emit({ id: e.id, status: e.status });
    }
    this.touch(e);
  }

  onCompleteManual(e: PatientEncounter): void {
    if (e.completedAt) {
      e.status = 'Completed';
      this.computeDuration(e);
      this.statusChanged.emit({ id: e.id, status: e.status });
    }
    this.touch(e);
  }

  onStatusSelect(e: PatientEncounter): void {
    if (e.status === 'Checked-In' && !e.checkedInAt) e.checkedInAt = this.nowHHmm();
    if (e.status === 'In-Progress' && !e.startedAt) e.startedAt = this.nowHHmm();
    if (e.status === 'Completed' && !e.completedAt) {
      e.completedAt = this.nowHHmm();
      this.computeDuration(e);
    }
    this.touch(e);
    this.statusChanged.emit({ id: e.id, status: e.status });
  }

  onEncounterPhysicianChange(e: PatientEncounter): void {
    e.physicianName = this.physicians.find(p => p.id === e.physicianId)?.name;
    this.touch(e);
  }

  // Filters, Date, Summary
  applyFilters(): void {
    const day = this.selectedDateISO;
    const term = (this.searchText ?? '').trim().toLowerCase();
    const pid = this.selectedPhysicianId;
    const st = this.filterStatus;

    let list = this.all.filter(e => e.date === day);

    if (pid !== 'ALL') list = list.filter(e => e.physicianId === pid);
    if (st !== 'ALL') list = list.filter(e => e.status === st);

    if (term) {
      list = list.filter(e =>
        (e.patientName ?? '').toLowerCase().includes(term) ||
        (e.patientId ?? '').toLowerCase().includes(term) ||
        (e.notes ?? '').toLowerCase().includes(term) ||
        (e.visitType ?? '').toLowerCase().includes(term) ||
        (e.physicianName ?? '').toLowerCase().includes(term)
      );
    }

    const weight: Record<VisitStatus, number> = {
      'Scheduled': 1, 'Checked-In': 2, 'In-Progress': 3,
      'Completed': 4, 'Cancelled': 5, 'No-Show': 6
    };
    list.sort((a, b) => {
      const ta = a.appointmentTime ?? '99:99';
      const tb = b.appointmentTime ?? '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return weight[a.status] - weight[b.status];
    });

    this.filtered = list;
    this.summary = this.computeSummary(list);
    this.cdr.markForCheck();
  }

  onDateChange(nextISO: string): void {
    this.selectedDateISO = nextISO;
    this.applyFilters();
    this.dayChanged.emit(this.selectedDateISO);
  }

  goToday(): void {
    this.selectedDateISO = this.toISODate(new Date());
    this.applyFilters();
    this.dayChanged.emit(this.selectedDateISO);
  }

  shiftDay(delta: number): void {
    const d = new Date(this.selectedDateISO + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    this.selectedDateISO = this.toISODate(d);
    this.applyFilters();
    this.dayChanged.emit(this.selectedDateISO);
  }

  // Helpers
  trackById(_: number, e: PatientEncounter) { return e.id; }

  touch(e: PatientEncounter): void {
    this.computeDuration(e);
    this.replace(e);
    this.applyFilters();
    this.persist();
  }

  computeDuration(e: PatientEncounter): void {
    const s = e.startedAt, c = e.completedAt;
    if (s && c) {
      const mins = this.diffMinutes(s, c);
      e.durationMinutes = Number.isFinite(mins) && mins >= 0 ? mins : undefined;
    }
  }

  replace(e: PatientEncounter): void {
    const idx = this.all.findIndex(x => x.id === e.id);
    if (idx >= 0) this.all[idx] = this.normalize(e);
    else this.all.unshift(this.normalize(e));
  }

  normalize(e: PatientEncounter): PatientEncounter {
    const physicianName = e.physicianName ?? this.physicians.find(p => p.id === e.physicianId)?.name;
    return { ...e, date: e.date ?? this.selectedDateISO, physicianName };
  }

  computeSummary(list: PatientEncounter[]): Summary {
    const s: Summary = this.emptySummary();
    s.total = list.length;
    let totalDur = 0; let durCount = 0;
    for (const e of list) {
      switch (e.status) {
        case 'Scheduled': s.scheduled++; break;
        case 'Checked-In': s.checkedIn++; break;
        case 'In-Progress': s.inProgress++; break;
        case 'Completed':
          s.completed++;
          if (typeof e.durationMinutes === 'number') {
            totalDur += e.durationMinutes; durCount++;
          }
          break;
        case 'Cancelled': s.cancelled++; break;
        case 'No-Show': s.noShow++; break;
      }
    }
    s.avgDurationCompleted = durCount ? Math.round(totalDur / durCount) : null;
    return s;
  }

  emptySummary(): Summary {
    return {
      total: 0, scheduled: 0, checkedIn: 0,
      inProgress: 0, completed: 0, cancelled: 0, noShow: 0,
      avgDurationCompleted: null
    };
  }

  onPersistToggle(): void {
    if (this.persistToLocal) this.persist();
    else this.forgetLocal();
  }

  persist(): void {
    if (!this.persistToLocal) return;
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.all)); } catch {}
  }

  readFromLocal(): PatientEncounter[] | null {
    try {
      const s = localStorage.getItem(this.storageKey);
      if (!s) return null;
      const arr = JSON.parse(s);
      if (!Array.isArray(arr)) return null;
      return arr as PatientEncounter[];
    } catch { return null; }
  }

  forgetLocal(): void {
    try { localStorage.removeItem(this.storageKey); } catch {}
  }

  toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  nowHHmm(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  roundToNext5Min(d: Date): string {
    const mins = d.getMinutes();
    const next = Math.ceil(mins / 5) * 5;
    d.setMinutes(next, 0, 0);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  diffMinutes(startHHmm?: string, endHHmm?: string): number {
    if (!startHHmm || !endHHmm) return NaN;
    const [sh, sm] = startHHmm.split(':').map(Number);
    const [eh, em] = endHHmm.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private emitChange(): void {
    this.encountersChange.emit(this.all.slice());
  }

  // Suggestions
  get patientNameSuggestions(): string[] {
    const set = new Set<string>();
    for (const e of this.all) if (e.patientName) set.add(e.patientName);
    return Array.from(set).slice(0, 50).sort();
  }
  get patientIdSuggestions(): string[] {
    const set = new Set<string>();
    for (const e of this.all) if (e.patientId) set.add(e.patientId);
    return Array.from(set).slice(0, 50).sort();
  }
}
