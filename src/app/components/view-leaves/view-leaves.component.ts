import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, switchMap, Observable, debounceTime, distinctUntilChanged } from 'rxjs';
import { TeacherService } from '../../services/teacher.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import Swal from 'sweetalert2';
import { from, concatMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { LeaveApplication, LeaveService, PaginatedResponse } from '../../services/leave.service';

@Component({
  selector: 'app-view-leaves',
  templateUrl: './view-leaves.component.html',
  styleUrls: ['./view-leaves.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule
  ],
})
export class ViewLeavesComponent implements OnInit, OnDestroy {
  loggedInUserRole: string = '';
  loggedInUserId: string = '';
  loggedInUserClass: string = '';
  filteredLeaves: LeaveApplication[] = [];
  isLoading: boolean = true;

  classList: string[] = [
    'Play group', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  ];
  selectedClass: string = 'all';
  selectedDate: Date | null = null;
  studentIdFilter: string = '';

  currentPage: number = 0;
  pageSize: number = 10;
  totalElements: number = 0;
  totalPages: number = 0;
  pageSizes: number[] = [5, 10, 20, 50];

  private studentIdInputSubject = new Subject<string>();
  private ngUnsubscribe = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private leaveService: LeaveService,
    private teacherService: TeacherService,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.ngUnsubscribe)).subscribe(params => {
      const studentIdFromParams = params['studentId'];
      if (studentIdFromParams) {
        this.studentIdFilter = studentIdFromParams;
      }
    });
    this.loadInitialData();

    this.studentIdInputSubject.pipe(
      debounceTime(800),
      distinctUntilChanged(),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(() => {
      this.currentPage = 0;
      this.fetchLeaves();
    });
  }

  loadInitialData(): void {
    const user = this.authStateService.getUser();
    if (user) {
      this.loggedInUserRole = user.role;
      this.loggedInUserId = user.userId;

      if (this.loggedInUserRole === 'ADMIN') {
        this.selectedClass = localStorage.getItem('lastSelectedClass') || 'all';
        this.fetchLeaves();
      } else if (this.loggedInUserRole === 'TEACHER') {
        this.getTeacherClassAndLoadLeaves();
      }
    }
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    this.studentIdInputSubject.complete();
  }

  getTeacherClassAndLoadLeaves(): void {
    this.teacherService.getTeacher(this.loggedInUserId).pipe(
      takeUntil(this.ngUnsubscribe),
      switchMap((teacher: any) => {
        this.loggedInUserClass = teacher.classTeacher;
        this.selectedClass = teacher.classTeacher;
        return this.fetchLeaves();
      })
    ).subscribe({
      next: () => { },
      error: (error: any) => {
        this.logger.error('Error fetching teacher details or leaves:', error);
        Swal.fire('Error!', 'Failed to load teacher details or leave applications.', 'error');
      }
    });
  }

  fetchLeaves(): Observable<PaginatedResponse<LeaveApplication>> {
    let classFilterToSend: string | undefined = undefined;

    if (this.loggedInUserRole === 'ADMIN') {
      classFilterToSend = this.selectedClass === 'all' ? undefined : this.selectedClass;
      if (this.selectedClass === 'all') {
        localStorage.removeItem('lastSelectedClass');
      } else {
        localStorage.setItem('lastSelectedClass', this.selectedClass);
      }
    } else if (this.loggedInUserRole === 'TEACHER') {
      classFilterToSend = this.loggedInUserClass;
    }

    const formattedDate = this.selectedDate ? this.formatDate(this.selectedDate) : undefined;
    const studentIdToFilter = this.studentIdFilter ? this.studentIdFilter : undefined;

    const leavesObservable = this.leaveService.getLeavesPaginated(
      this.currentPage,
      this.pageSize,
      classFilterToSend,
      studentIdToFilter,
      formattedDate,
      'leaveDate',
      'desc'
    );

    this.isLoading = true;
    this.cdr.markForCheck();

    leavesObservable.pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (response: PaginatedResponse<LeaveApplication>) => {
          this.filteredLeaves = response.content;
          this.totalElements = response.totalElements;
          this.totalPages = response.totalPages;
          this.currentPage = response.number;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.logger.error('Error loading leave applications:', error);
          Swal.fire('Error!', 'Failed to load leave applications.', 'error');
          this.filteredLeaves = [];
          this.totalElements = 0;
          this.totalPages = 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
    return leavesObservable;
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onClassSelect(className: string): void {
    this.selectedClass = className;
    this.currentPage = 0;
    if (this.loggedInUserRole === 'ADMIN' && className === 'all') {
      this.selectedDate = null;
      this.studentIdFilter = '';
    }
    this.fetchLeaves();
  }

  onDateSelect(): void {
    this.currentPage = 0;
    this.fetchLeaves();
  }

  onStudentIdInput(): void {
    this.studentIdInputSubject.next(this.studentIdFilter);
  }

  clearFilter(): void {
    this.selectedDate = null;
    this.studentIdFilter = '';
    this.currentPage = 0;

    if (this.loggedInUserRole === 'ADMIN') {
      this.selectedClass = localStorage.getItem('lastSelectedClass') || 'all';
    }
    this.fetchLeaves();
  }

  deleteAllFilteredLeaves(): void {
    const deletable = this.filteredLeaves.filter(l => l.status !== 'APPROVED');
    if (deletable.length === 0) {
      Swal.fire('Info', 'No deletable leaves on this page (approved leaves cannot be deleted).', 'info');
      return;
    }

    Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete ${deletable.length} leave application(s) on this page? Approved leaves will be skipped.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete!',
    }).then((result) => {
      if (result.isConfirmed) {
        from(deletable).pipe(
          concatMap(leave => this.leaveService.deleteLeaveById(leave.id)),
          takeUntil(this.ngUnsubscribe)
        ).subscribe({
          next: () => { },
          complete: () => {
            Swal.fire(
              'Deleted!',
              'All displayed leave applications deleted successfully.',
              'success'
            );
            this.fetchLeaves();
          },
          error: (error) => {
            this.logger.error('Error deleting leaves:', error);
            Swal.fire(
              'Error!',
              'Failed to delete one or more leave applications.',
              'error'
            );
            this.fetchLeaves();
          }
        });
      }
    });
  }

  deleteLeave(leaveId: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You want to delete this leave application?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (result.isConfirmed) {
        this.leaveService.deleteLeaveById(leaveId).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
          next: (response) => {
            Swal.fire('Deleted!', response, 'success');
            this.fetchLeaves();
          },
          error: (error) => {
            this.logger.error('Error deleting leave:', error);
            Swal.fire('Error!', error?.error || 'Failed to delete the leave application.', 'error');
          }
        });
      }
    });
  }

  editLeaveStatus(leave: LeaveApplication): void {
    Swal.fire({
      title: 'Change Leave Status',
      text: `${leave.studentName} — ${leave.leaveDate}`,
      input: 'select',
      inputOptions: {
        PENDING: 'Pending',
        APPROVED: 'Approved',
        REJECTED: 'Rejected',
      },
      inputValue: leave.status ?? 'PENDING',
      showCancelButton: true,
      confirmButtonColor: '#00acc1',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Update',
      inputAttributes: { 'aria-label': 'Select new status' },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const newStatus = result.value as string;
        if (newStatus === leave.status) return;
        this.leaveService.updateLeaveStatus(leave.id, newStatus)
          .pipe(takeUntil(this.ngUnsubscribe))
          .subscribe({
            next: (updated) => {
              leave.status = updated.status;
              this.cdr.markForCheck();
              Swal.fire({
                title: 'Updated!',
                text: `Status changed to ${updated.status}.`,
                icon: 'success',
                timer: 1800,
                showConfirmButton: false,
              });
            },
            error: (error) => {
              this.logger.error('Error updating leave status:', error);
              Swal.fire('Error!', error?.error || 'Failed to update leave status.', 'error');
            }
          });
      }
    });
  }

  updateLeaveStatus(leave: LeaveApplication, status: 'APPROVED' | 'REJECTED'): void {
    const action = status === 'APPROVED' ? 'approve' : 'reject';
    Swal.fire({
      title: `${status === 'APPROVED' ? 'Approve' : 'Reject'} Leave?`,
      text: `${leave.studentName} — ${leave.leaveDate}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: status === 'APPROVED' ? '#198754' : '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Yes, ${action} it!`,
    }).then((result) => {
      if (result.isConfirmed) {
        this.leaveService.updateLeaveStatus(leave.id, status)
          .pipe(takeUntil(this.ngUnsubscribe))
          .subscribe({
            next: (updated) => {
              leave.status = updated.status;
              this.cdr.markForCheck();
              Swal.fire({
                title: status === 'APPROVED' ? 'Approved!' : 'Rejected!',
                text: `Leave has been ${status.toLowerCase()}.`,
                icon: status === 'APPROVED' ? 'success' : 'info',
                timer: 1800,
                showConfirmButton: false,
              });
            },
            error: (error) => {
              this.logger.error('Error updating leave status:', error);
              Swal.fire('Error!', error?.error || 'Failed to update leave status.', 'error');
            }
          });
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.fetchLeaves();
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  onPageSizeChange(newPageSize: number): void {
    this.pageSize = newPageSize;
    this.currentPage = 0;
    this.fetchLeaves();
  }


  trackByLeaveId(index: number, leave: LeaveApplication): number { return leave.id; }
  trackByClass(index: number, className: string): string { return className; }
  trackByIndex(index: number): number { return index; }

  getPaginationDisplayPages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const total = this.totalPages;
    const current = this.currentPage;
    const maxVisiblePages = 3;
    if (total <= 1) {
      return [];
    }

    let start = Math.max(0, current - Math.floor(maxVisiblePages / 2));
    let end = start + maxVisiblePages - 1;

    if (end >= total) {
      end = total - 1;
      start = Math.max(0, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (!pages.includes(0)) {
      pages.unshift('...');
      pages.unshift(0);
    }

    if (!pages.includes(total - 1)) {
      pages.push('...');
      pages.push(total - 1);
    }

    const cleanedPages: (number | string)[] = [];
    let lastAddedItem: number | string | null = null;
    for (const item of pages) {
      if (typeof item === 'number') {
        if (item !== lastAddedItem) {
          cleanedPages.push(item);
          lastAddedItem = item;
        }
      } else {
        if (lastAddedItem !== '...') {
          cleanedPages.push(item);
          lastAddedItem = item;
        }
      }
    }
    return cleanedPages;
  }
}