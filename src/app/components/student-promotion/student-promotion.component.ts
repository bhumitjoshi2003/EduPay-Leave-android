import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { StudentService, PromotionPreviewGroup, PromotionAction, PromotionResult } from '../../services/student.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-student-promotion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-promotion.component.html',
  styleUrl: './student-promotion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentPromotionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = true;
  isExecuting = false;
  groups: PromotionPreviewGroup[] = [];
  decisions = new Map<string, PromotionAction>();
  result: PromotionResult | null = null;

  get promotedCount(): number {
    return [...this.decisions.values()].filter(a => a === 'PROMOTE').length;
  }
  get detainedCount(): number {
    return [...this.decisions.values()].filter(a => a === 'DETAIN').length;
  }
  get passOutCount(): number {
    return [...this.decisions.values()].filter(a => a === 'PASS_OUT').length;
  }

  constructor(
    private studentService: StudentService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPreview(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.studentService.getPromotionPreview().pipe(takeUntil(this.destroy$)).subscribe({
      next: (groups) => {
        this.groups = groups;
        this.decisions.clear();
        for (const g of groups) {
          for (const s of g.students) {
            // Class 12 defaults to PASS_OUT, everyone else PROMOTE
            this.decisions.set(s.studentId, g.className === '12' ? 'PASS_OUT' : 'PROMOTE');
          }
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error loading promotion preview:', e);
        this.isLoading = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'Failed to load students for promotion.', 'error');
      }
    });
  }

  setAction(studentId: string, action: PromotionAction): void {
    this.decisions.set(studentId, action);
    this.cdr.markForCheck();
  }

  setClassAction(group: PromotionPreviewGroup, action: PromotionAction): void {
    for (const s of group.students) {
      this.decisions.set(s.studentId, action);
    }
    this.cdr.markForCheck();
  }

  isClass12(group: PromotionPreviewGroup): boolean {
    return group.className === '12';
  }

  execute(): void {
    const total = this.decisions.size;
    const promoted = this.promotedCount;
    const detained = this.detainedCount;
    const passedOut = this.passOutCount;

    Swal.fire({
      title: 'Confirm Promotion',
      html: `
        <p style="margin-bottom:12px;color:#374151;">This will update <strong>${total}</strong> students:</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <span style="background:#dcfce7;color:#166534;padding:6px 14px;border-radius:20px;font-weight:700;">✓ ${promoted} Promoted</span>
          <span style="background:#fef9c3;color:#854d0e;padding:6px 14px;border-radius:20px;font-weight:700;">⟳ ${detained} Detained</span>
          <span style="background:#f0f9ff;color:#0369a1;padding:6px 14px;border-radius:20px;font-weight:700;">🎓 ${passedOut} Passed Out</span>
        </div>
        <p style="margin-top:14px;font-size:0.85rem;color:#ef4444;font-weight:600;">This action cannot be undone easily. Please verify before confirming.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#1d4ed8',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Execute Promotion',
      cancelButtonText: 'Cancel',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.doExecute();
    });
  }

  private doExecute(): void {
    this.isExecuting = true;
    this.cdr.markForCheck();

    const payload = Array.from(this.decisions.entries()).map(([studentId, action]) => ({ studentId, action }));

    this.studentService.executePromotion(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.result = result;
        this.isExecuting = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error executing promotion:', e);
        this.isExecuting = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'Promotion failed. Please try again.', 'error');
      }
    });
  }

  resetResult(): void {
    this.result = null;
    this.loadPreview();
  }

  trackByClass(_: number, g: PromotionPreviewGroup): string { return g.className; }
  trackByStudent(_: number, s: { studentId: string }): string { return s.studentId; }
}
