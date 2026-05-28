import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '../../services/toast.service';
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
    private cdr: ChangeDetectorRef,
    private toast: ToastService
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
        this.toast.error('Error', 'Failed to load students for promotion.');
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

    this.toast.confirm({
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
      confirmText: 'Yes, Execute Promotion',
      cancelText: 'Cancel',
      icon: 'warning',
    }).then((confirmed) => {
      if (!confirmed) return;
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
        this.toast.error('Error', 'Promotion failed. Please try again.');
      }
    });
  }

  resetResult(): void {
    this.result = null;
    this.loadPreview();
  }

  fixOrphanedSections(): void {
    this.toast.confirm({
      title: 'Fix Orphaned Sections?',
      message: 'This will clear section assignments for any students whose section belongs to a different class (e.g., promoted students who retained their old section). This is safe to run at any time.',
      confirmText: 'Yes, Fix',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.studentService.fixOrphanedSections().pipe(takeUntil(this.destroy$)).subscribe({
        next: ({ affected, message }) => {
          if (affected > 0) {
            this.toast.success('Done', message);
          } else {
            this.toast.info('No Issues Found', 'All student section assignments are valid.');
          }
        },
        error: (e) => {
          this.logger.error('Error fixing orphaned sections:', e);
          this.toast.error('Error', 'Failed to fix orphaned sections.');
        }
      });
    });
  }

  trackByClass(_: number, g: PromotionPreviewGroup): string { return g.className; }
  trackByStudent(_: number, s: { studentId: string }): string { return s.studentId; }
}
