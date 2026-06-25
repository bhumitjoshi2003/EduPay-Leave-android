import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';

import { SchoolService } from '../../services/school.service';
import {
  ReportCardTemplateService,
  ReportCardTemplate,
  ClassOverviewDTO,
  StudentSummaryDTO
} from '../../services/report-card-template.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

type SortField = 'rank' | 'name' | 'percentage' | 'grade';

@Component({
  selector: 'app-class-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './class-overview.component.html',
  styleUrl: './class-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClassOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  classes: string[] = [];
  templates: ReportCardTemplate[] = [];
  sessions: string[] = [];

  selectedClass = '';
  selectedTemplateId: number | null = null;
  selectedSession = '';

  loadingClasses = true;
  loadingTemplates = true;
  loading = false;

  overview: ClassOverviewDTO | null = null;

  // Table sort
  sortField: SortField = 'rank';
  sortAsc = true;

  constructor(
    private schoolService: SchoolService,
    private rcService: ReportCardTemplateService,
    private toast: ToastService,
    private logger: LoggerService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.buildSessions();
    this.loadClasses();
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildSessions(): void {
    const year = new Date().getFullYear();
    for (let y = year; y >= year - 2; y--) this.sessions.push(`${y}-${y + 1}`);
    this.selectedSession = this.sessions[0];
  }

  private loadClasses(): void {
    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cls) => { this.classes = cls; this.loadingClasses = false; this.cdr.markForCheck(); },
      error: () => { this.loadingClasses = false; this.cdr.markForCheck(); }
    });
  }

  private loadTemplates(): void {
    this.rcService.getTemplates().pipe(takeUntil(this.destroy$)).subscribe({
      next: (t) => {
        this.templates = t;
        const def = t.find(x => x.isDefault);
        this.selectedTemplateId = def?.id ?? (t[0]?.id ?? null);
        this.loadingTemplates = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingTemplates = false; this.cdr.markForCheck(); }
    });
  }

  get canLoad(): boolean {
    return !!this.selectedClass && !!this.selectedTemplateId && !!this.selectedSession;
  }

  load(): void {
    if (!this.canLoad) return;
    this.loading = true;
    this.overview = null;
    this.cdr.markForCheck();

    this.rcService.getClassOverview(
      this.selectedTemplateId!, this.selectedSession, this.selectedClass
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Class overview failed', e);
        this.toast.error('Error', 'Could not load class overview. Please try again.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Table sort ────────────────────────────────────────────────────────

  setSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = field !== 'rank' ? true : true;
    }
    this.cdr.markForCheck();
  }

  get sortedStudents(): StudentSummaryDTO[] {
    if (!this.overview?.students) return [];
    return [...this.overview.students].sort((a, b) => {
      let cmp = 0;
      switch (this.sortField) {
        case 'rank':       cmp = (a.rank || 999) - (b.rank || 999); break;
        case 'name':       cmp = a.studentName.localeCompare(b.studentName); break;
        case 'percentage': cmp = b.percentage - a.percentage; break;
        case 'grade':      cmp = a.grade.localeCompare(b.grade); break;
      }
      return this.sortAsc ? cmp : -cmp;
    });
  }

  sortIcon(field: SortField): string {
    if (this.sortField !== field) return 'unfold_more';
    return this.sortAsc ? 'arrow_upward' : 'arrow_downward';
  }

  // ── Computed helpers ──────────────────────────────────────────────────

  get passRate(): number {
    if (!this.overview || !this.overview.totalStudents) return 0;
    return Math.round((this.overview.passCount / this.overview.totalStudents) * 100);
  }

  get gradeEntries(): { grade: string; count: number }[] {
    if (!this.overview?.gradeDistribution) return [];
    return Object.entries(this.overview.gradeDistribution)
      .map(([grade, count]) => ({ grade, count }));
  }

  gradeBg(grade: string): string {
    const map: Record<string, string> = {
      'A1': '#dcfce7', 'A2': '#f0fdf4',
      'B1': '#e0f2fe', 'B2': '#dbeafe',
      'C1': '#fef9c3', 'C2': '#fef3c7',
      'D':  '#ffedd5', 'E':  '#fee2e2',
      'A+': '#dcfce7', 'A':  '#f0fdf4',
      'B+': '#e0f2fe', 'B':  '#dbeafe',
      'C+': '#fef9c3', 'C':  '#fef3c7',
      'F':  '#fee2e2'
    };
    return map[grade] ?? '#f1f5f9';
  }

  gradeColor(grade: string): string {
    const map: Record<string, string> = {
      'A1': '#14532d', 'A2': '#166534',
      'B1': '#155e75', 'B2': '#1e40af',
      'C1': '#854d0e', 'C2': '#92400e',
      'D':  '#9a3412', 'E':  '#7f1d1d',
      'A+': '#14532d', 'A':  '#166534',
      'B+': '#155e75', 'B':  '#1e40af',
      'C+': '#854d0e', 'C':  '#92400e',
      'F':  '#7f1d1d'
    };
    return map[grade] ?? '#374151';
  }

  rowClass(s: StudentSummaryDTO): string {
    if (!s.rank) return 'co-row--no-result';
    if (!s.passed) return 'co-row--fail';
    return '';
  }

  goBack(): void { this.router.navigate(['/dashboard']); }
  trackByStudentId(_i: number, s: StudentSummaryDTO): string { return s.studentId; }
  trackByGrade(_i: number, e: { grade: string; count: number }): string { return e.grade; }
}
