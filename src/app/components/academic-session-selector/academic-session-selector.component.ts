import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AcademicSession } from '../../interfaces/academic-session';
import { AcademicSessionService } from '../../services/academic-session.service';

export function sessionKind(session: AcademicSession | null, today = new Date()): string {
  if (!session) return 'No session selected';
  if (session.current) return 'CURRENT';
  // Backend ClockConfig uses Clock.systemUTC().
  const date = today.toISOString().slice(0, 10);
  if (session.endDate < date) return 'HISTORICAL';
  return session.startDate > date ? 'FUTURE' : 'NON-CURRENT';
}
export function writableSession(session: AcademicSession | null): boolean {
  return !!session?.id && sessionKind(session) !== 'HISTORICAL';
}
export function apiMessage(error: any, fallback = 'Request failed. Please try again.'): string {
  return (typeof error?.error === 'string' && error.error) || error?.error?.message || error?.error?.detail || fallback;
}
@Component({
  selector: 'app-academic-session-selector', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './academic-session-selector.component.html',
  styleUrl: './academic-session-selector.component.css'
})
export class AcademicSessionSelectorComponent implements OnInit, OnDestroy {
  @Input() initialId: number | null = null;
  @Input() disabled = false;
  @Output() selected = new EventEmitter<AcademicSession | null>();
  @Output() loaded = new EventEmitter<AcademicSession[]>();
  sessions: AcademicSession[] = [];
  selectedId: number | null = null;
  loading = true;
  error = '';
  kind = sessionKind;
  private destroy$ = new Subject<void>();

  get selectedSession(): AcademicSession | null {
    return this.sessions.find(s => s.id === this.selectedId) ?? null;
  }

  /** Presentational only — maps sessionKind()'s label to a status-pill colour, mirroring
   *  the dashboard's existing role/status chip convention (one accent per state). */
  pillClass(kind: string): string {
    switch (kind) {
      case 'CURRENT': return 'ass-pill-current';
      case 'HISTORICAL': return 'ass-pill-historical';
      case 'FUTURE': return 'ass-pill-future';
      case 'NON-CURRENT': return 'ass-pill-noncurrent';
      default: return '';
    }
  }
  constructor(private service: AcademicSessionService) {}
  ngOnInit(): void {
    this.service.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: sessions => {
        this.sessions = sessions;
        this.loading = false;
        this.loaded.emit(sessions);
        this.select(this.initialId ?? sessions.find(s => s.current)?.id ?? null);
      },
      error: err => { this.loading = false; this.error = apiMessage(err); this.selected.emit(null); }
    });
  }
  select(id: number | null): void {
    const session = this.sessions.find(s => s.id === id) ?? null;
    this.selectedId = session?.id ?? null;
    this.selected.emit(session);
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
