import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { TeacherLeaveService } from '../../services/teacher-leave.service';
import { TeacherLeave } from '../../interfaces/teacher-leave';
import { PaginatedResponse } from '../../services/payment-history.service';

@Component({
  selector: 'app-teacher-leave-requests',
  templateUrl: './teacher-leave-requests.component.html',
  styleUrls: ['./teacher-leave-requests.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class TeacherLeaveRequestsComponent implements OnInit, OnDestroy {
  leaves: TeacherLeave[] = [];
  isLoading: boolean = true;
  updatingIds: Set<number> = new Set();

  statusFilter: string = 'PENDING';
  teacherIdFilter: string = '';

  currentPage: number = 0;
  pageSize: number = 10;
  totalElements: number = 0;
  totalPages: number = 0;

  private teacherIdInputSubject = new Subject<string>();
  private ngUnsubscribe = new Subject<void>();

  constructor(
    private teacherLeaveService: TeacherLeaveService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    this.fetchLeaves();

    this.teacherIdInputSubject.pipe(
      debounceTime(800),
      distinctUntilChanged(),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(() => {
      this.currentPage = 0;
      this.fetchLeaves();
    });
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    this.teacherIdInputSubject.complete();
  }

  fetchLeaves(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const status = this.statusFilter === 'all' ? undefined : this.statusFilter;
    const teacherId = this.teacherIdFilter ? this.teacherIdFilter : undefined;

    this.teacherLeaveService.getLeaves(this.currentPage, this.pageSize, status, teacherId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (response: PaginatedResponse<TeacherLeave>) => {
          this.leaves = response.content;
          this.totalElements = response.totalElements;
          this.totalPages = response.totalPages;
          this.currentPage = response.number;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.logger.error('Error loading teacher leave requests:', error);
          this.toast.error('Error!', 'Failed to load teacher leave requests.');
          this.leaves = [];
          this.totalElements = 0;
          this.totalPages = 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onStatusSelect(status: string): void {
    this.statusFilter = status;
    this.currentPage = 0;
    this.fetchLeaves();
  }

  onTeacherIdInput(): void {
    this.teacherIdInputSubject.next(this.teacherIdFilter);
  }

  clearFilter(): void {
    this.statusFilter = 'PENDING';
    this.teacherIdFilter = '';
    this.currentPage = 0;
    this.fetchLeaves();
  }

  updateStatus(leave: TeacherLeave, status: 'APPROVED' | 'REJECTED'): void {
    const isApprove = status === 'APPROVED';
    this.toast.confirm({
      title: isApprove ? 'Approve Leave?' : 'Reject Leave?',
      html: `<strong>${leave.teacherName}</strong> &mdash; ${leave.startDate} to ${leave.endDate}`,
      icon: 'question',
      danger: !isApprove,
      confirmText: isApprove ? 'Yes, approve' : 'Yes, reject',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.updatingIds.add(leave.id);
      this.cdr.markForCheck();
      this.teacherLeaveService.updateStatus(leave.id, status)
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe({
          next: (updated) => {
            leave.status = updated.status;
            this.updatingIds.delete(leave.id);
            this.cdr.markForCheck();
            if (isApprove) {
              this.toast.success('Approved!', 'Leave has been approved.');
            } else {
              this.toast.info('Rejected!', 'Leave has been rejected.');
            }
          },
          error: (error) => {
            this.updatingIds.delete(leave.id);
            this.logger.error('Error updating teacher leave status:', error);
            this.toast.error('Error!', error?.error?.message || 'Failed to update leave status.');
            this.cdr.markForCheck();
          }
        });
    });
  }

  editStatus(leave: TeacherLeave): void {
    const newStatus = leave.status === 'APPROVED' ? 'REJECTED' : 'APPROVED';
    this.updateStatus(leave, newStatus);
  }

  cancelLeave(leave: TeacherLeave): void {
    this.toast.confirm({
      title: 'Delete Leave Request?',
      message: 'This leave request will be permanently deleted.',
      icon: 'warning',
      danger: true,
      confirmText: 'Yes, delete it!',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.teacherLeaveService.cancelLeave(leave.id).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
        next: (response) => {
          this.toast.success('Deleted!', response.message);
          this.fetchLeaves();
        },
        error: (error) => {
          this.logger.error('Error deleting teacher leave:', error);
          this.toast.error('Error!', error?.error?.message || 'Failed to delete the leave request.');
        }
      });
    });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.fetchLeaves();
    }
  }

  nextPage(): void { this.goToPage(this.currentPage + 1); }
  prevPage(): void { this.goToPage(this.currentPage - 1); }

  trackByLeaveId(index: number, leave: TeacherLeave): number { return leave.id; }
}
