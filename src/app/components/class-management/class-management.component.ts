import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-class-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './class-management.component.html',
  styleUrl: './class-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  classes: SchoolClass[] = [];
  isLoading = false;
  newClassName = '';
  addingClass = false;
  savingOrder = false;
  role = '';

  constructor(
    private schoolService: SchoolService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.role = this.authStateService.getUser()?.role ?? '';
    this.loadClasses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  loadClasses(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.schoolService.getManagedClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.classes = list ?? [];
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load classes', e);
        this.toast.error('Error', 'Failed to load classes.');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  addNewClass(): void {
    const name = this.newClassName.trim();
    if (!name) return;
    this.addingClass = true;
    this.cdr.markForCheck();
    this.schoolService.addClass(name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (c) => {
        this.classes = [...this.classes, c];
        this.newClassName = '';
        this.addingClass = false;
        this.schoolService.invalidateClasses();
        this.toast.success('Added', `"${c.name}" added.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to add class', e);
        this.toast.error('Error', 'Could not add class. It may already exist.');
        this.addingClass = false;
        this.cdr.markForCheck();
      }
    });
  }

  removeClass(cls: SchoolClass): void {
    this.schoolService.deleteClass(cls.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.classes = this.classes.filter(c => c.id !== cls.id);
        this.schoolService.invalidateClasses();
        this.toast.success('Removed', `"${cls.name}" removed.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to delete class', e);
        this.toast.error('Error', 'Could not remove class.');
        this.cdr.markForCheck();
      }
    });
  }

  moveClass(index: number, direction: 'up' | 'down'): void {
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= this.classes.length) return;
    const list = [...this.classes];
    [list[index], list[swap]] = [list[swap], list[index]];
    this.classes = list;
    this.cdr.markForCheck();
  }

  saveOrder(): void {
    this.savingOrder = true;
    this.cdr.markForCheck();
    const ids = this.classes.map(c => c.id);
    this.schoolService.reorderClasses(ids).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingOrder = false;
        this.schoolService.invalidateClasses();
        this.toast.success('Saved', 'Class order saved.');
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to reorder classes', e);
        this.toast.error('Error', 'Could not save order.');
        this.savingOrder = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleStreamEligible(cls: SchoolClass): void {
    const newValue = !cls.streamEligible;
    this.schoolService.toggleStreamEligible(cls.id, newValue).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.classes = this.classes.map(c => c.id === updated.id ? updated : c);
        this.toast.success(
          newValue ? 'Stream On' : 'Stream Off',
          `"${cls.name}" ${newValue ? 'added to' : 'removed from'} stream assignment.`
        );
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to toggle stream eligibility', e);
        this.toast.error('Error', 'Could not update stream eligibility.');
      }
    });
  }

  trackById(_: number, cls: SchoolClass): number { return cls.id; }
}
