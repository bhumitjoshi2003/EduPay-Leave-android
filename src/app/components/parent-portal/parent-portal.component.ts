import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { ChildAccess, ParentProfile, ParentSummary } from '../../interfaces/parent-portal';
import { ParentPortalService } from '../../services/parent-portal.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';
import { StudentService } from '../../services/student.service';
import { Student } from '../../interfaces/student';

type DirectoryStatus = 'ALL' | 'ACTIVE' | 'DISABLED' | 'UNLINKED';

@Component({
  selector: 'app-parent-portal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './parent-portal.component.html',
  styleUrl: './parent-portal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParentPortalComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authState = inject(AuthStateService);
  private readonly parentService = inject(ParentPortalService);
  private readonly studentService = inject(StudentService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly studentSearch$ = new Subject<string>();
  readonly isAdmin = this.authState.getUserRole() === 'ADMIN';
  readonly pageSize = 5;
  loading = true;
  working = false;
  profileLoading = false;
  showCreatePanel = false;
  showAccessEditor = false;
  parents: ParentSummary[] = [];
  profile: ParentProfile | null = null;
  selectedChild: ChildAccess | null = null;
  editingChild: ChildAccess | null = null;
  directorySearch = '';
  directoryStatus: DirectoryStatus = 'ALL';
  directoryPage = 1;
  studentQuery = '';
  studentMatches: Student[] = [];
  searchingStudents = false;
  studentSearchOpen = false;

  createForm = this.fb.nonNullable.group({
    parentId: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', Validators.email],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9+() -]{7,20}$/)]],
    temporaryPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  linkForm = this.fb.nonNullable.group({
    studentId: ['', Validators.required],
    relationshipType: ['PARENT', Validators.required],
    primaryGuardian: [true],
    canViewAttendance: [true], canViewFees: [true], canPayFees: [true],
    canViewResults: [true], canViewTimetable: [true], canManageLeave: [true], pickupAuthorized: [false],
    effectiveFrom: [new Date().toISOString().slice(0, 10), Validators.required],
  });

  ngOnInit(): void {
    this.studentSearch$.pipe(
      debounceTime(250), distinctUntilChanged(),
      tap(query => {
        this.searchingStudents = query.length >= 2;
        if (query.length < 2) this.studentMatches = [];
        this.cdr.markForCheck();
      }),
      switchMap(query => query.length >= 2
        ? this.studentService.searchStudents(query).pipe(catchError(() => of([])))
        : of([])),
      takeUntil(this.destroy$)
    ).subscribe(matches => {
      this.studentMatches = matches.filter(student =>
        !['GRADUATED', 'TRANSFERRED', 'WITHDRAWN'].includes(student.status ?? ''));
      this.searchingStudents = false;
      this.studentSearchOpen = this.studentQuery.trim().length >= 2;
      this.cdr.markForCheck();
    });
    this.isAdmin ? this.loadParents() : this.loadMyProfile();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  get totalParents(): number { return this.parents.length; }
  get activeParents(): number { return this.parents.filter(parent => parent.active).length; }
  get linkedStudents(): number { return this.parents.reduce((total, parent) => total + parent.linkedChildren, 0); }
  get unlinkedParents(): number { return this.parents.filter(parent => parent.linkedChildren === 0).length; }
  get filteredParents(): ParentSummary[] {
    const query = this.directorySearch.trim().toLowerCase();
    return this.parents.filter(parent => {
      const matchesSearch = !query || parent.name.toLowerCase().includes(query)
        || parent.parentId.toLowerCase().includes(query)
        || parent.phoneNumber.toLowerCase().includes(query)
        || (parent.email ?? '').toLowerCase().includes(query);
      const matchesStatus = this.directoryStatus === 'ALL'
        || (this.directoryStatus === 'ACTIVE' && parent.active)
        || (this.directoryStatus === 'DISABLED' && !parent.active)
        || (this.directoryStatus === 'UNLINKED' && parent.linkedChildren === 0);
      return matchesSearch && matchesStatus;
    });
  }
  get directoryPageCount(): number { return Math.max(1, Math.ceil(this.filteredParents.length / this.pageSize)); }
  get pagedParents(): ParentSummary[] {
    const start = (this.directoryPage - 1) * this.pageSize;
    return this.filteredParents.slice(start, start + this.pageSize);
  }
  get allPermissionsSelected(): boolean {
    const value = this.linkForm.getRawValue();
    return value.canViewAttendance && value.canViewFees && value.canPayFees && value.canViewResults
      && value.canViewTimetable && value.canManageLeave && value.pickupAuthorized;
  }

  loadParents(showLoader = true): void {
    if (showLoader) this.loading = true;
    this.parentService.listParents().pipe(takeUntil(this.destroy$), finalize(() => {
      this.loading = false; this.cdr.markForCheck();
    })).subscribe({
      next: parents => {
        this.parents = parents;
        if (this.directoryPage > this.directoryPageCount) this.directoryPage = this.directoryPageCount;
      },
      error: () => this.toast.error('Could not load parents', 'Please try again.'),
    });
  }

  loadMyProfile(): void {
    this.loading = true;
    this.parentService.getMyProfile().pipe(takeUntil(this.destroy$), finalize(() => {
      this.loading = false; this.cdr.markForCheck();
    })).subscribe({
      next: profile => { this.profile = profile; this.selectedChild = profile.children[0] ?? null; },
      error: () => this.toast.error('Could not load your children', 'Please contact the school if this continues.'),
    });
  }

  selectParent(parent: ParentSummary): void {
    this.profileLoading = true;
    this.cancelChildEdit();
    this.parentService.getParent(parent.parentId).pipe(takeUntil(this.destroy$), finalize(() => {
      this.profileLoading = false; this.cdr.markForCheck();
    })).subscribe({
      next: profile => { this.profile = profile; this.selectedChild = profile.children[0] ?? null; },
      error: () => this.toast.error('Could not open parent', 'Please try again.'),
    });
  }

  backToDirectory(): void { this.profile = null; this.cancelChildEdit(); }

  toggleCreatePanel(): void {
    this.showCreatePanel = !this.showCreatePanel;
    if (!this.showCreatePanel) {
      this.createForm.reset({ parentId: '', name: '', email: '', phoneNumber: '', temporaryPassword: '' });
    }
  }

  createParent(): void {
    if (this.createForm.invalid || this.working) { this.createForm.markAllAsTouched(); return; }
    this.working = true;
    this.parentService.createParent(this.createForm.getRawValue()).pipe(takeUntil(this.destroy$), finalize(() => {
      this.working = false; this.cdr.markForCheck();
    })).subscribe({
      next: profile => {
        this.profile = profile;
        this.showAccessEditor = true;
        this.showCreatePanel = false;
        this.createForm.reset({ parentId: '', name: '', email: '', phoneNumber: '', temporaryPassword: '' });
        this.toast.success('Parent account created', 'Now link one or more students.');
        this.loadParents(false);
      },
      error: error => this.toast.error('Could not create parent', error?.error?.message || error?.error || 'Please verify the details.'),
    });
  }

  updateDirectorySearch(event: Event): void {
    this.directorySearch = (event.target as HTMLInputElement).value;
    this.directoryPage = 1;
  }

  updateDirectoryStatus(event: Event): void {
    this.directoryStatus = (event.target as HTMLSelectElement).value as DirectoryStatus;
    this.directoryPage = 1;
  }

  changeDirectoryPage(delta: number): void {
    this.directoryPage = Math.min(this.directoryPageCount, Math.max(1, this.directoryPage + delta));
  }

  searchStudents(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.studentQuery = query;
    this.linkForm.controls.studentId.setValue(query.trim());
    this.studentSearchOpen = query.trim().length >= 2;
    this.studentSearch$.next(query.trim());
  }

  chooseStudent(student: Student): void {
    this.studentQuery = `${student.name} (${student.studentId})`;
    this.linkForm.controls.studentId.setValue(student.studentId);
    this.studentSearchOpen = false;
  }

  linkStudent(): void {
    if (!this.profile || this.linkForm.invalid || this.working) { this.linkForm.markAllAsTouched(); return; }
    const wasEditing = !!this.editingChild;
    this.working = true;
    this.parentService.linkStudent(this.profile.parent.parentId, this.linkForm.getRawValue()).pipe(
      takeUntil(this.destroy$), finalize(() => { this.working = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: profile => {
        this.profile = profile; this.selectedChild = profile.children[0] ?? null;
        this.cancelChildEdit();
        this.toast.success(wasEditing ? 'Access updated' : 'Student linked', wasEditing
          ? 'The guardian permissions have been saved.'
          : 'The parent can now access this child.');
        this.loadParents(false);
      },
      error: error => this.toast.error(wasEditing ? 'Could not update access' : 'Could not link student', error?.error?.message || error?.error || 'Please verify the student.'),
    });
  }

  editChild(child: ChildAccess): void {
    this.showAccessEditor = true;
    this.editingChild = child;
    this.studentQuery = `${child.studentName} (${child.studentId})`;
    this.linkForm.setValue({
      studentId: child.studentId, relationshipType: child.relationshipType,
      primaryGuardian: child.primaryGuardian, canViewAttendance: child.canViewAttendance,
      canViewFees: child.canViewFees, canPayFees: child.canPayFees,
      canViewResults: child.canViewResults, canViewTimetable: child.canViewTimetable,
      canManageLeave: child.canManageLeave, pickupAuthorized: child.pickupAuthorized,
      effectiveFrom: child.effectiveFrom,
    });
    this.studentSearchOpen = false;
  }

  cancelChildEdit(): void {
    this.showAccessEditor = false;
    this.editingChild = null;
    this.studentQuery = '';
    this.studentMatches = [];
    this.studentSearchOpen = false;
    this.linkForm.reset({
      studentId: '', relationshipType: 'PARENT', primaryGuardian: true,
      canViewAttendance: true, canViewFees: true, canPayFees: true,
      canViewResults: true, canViewTimetable: true, canManageLeave: true,
      pickupAuthorized: false, effectiveFrom: new Date().toISOString().slice(0, 10),
    });
  }

  startLinking(): void {
    this.cancelChildEdit();
    this.showAccessEditor = true;
  }

  setAllPermissions(selected: boolean): void {
    this.linkForm.patchValue({
      canViewAttendance: selected, canViewFees: selected, canPayFees: selected,
      canViewResults: selected, canViewTimetable: selected,
      canManageLeave: selected, pickupAuthorized: selected,
    });
  }

  permissionLabels(child: ChildAccess): string[] {
    const labels: string[] = [];
    if (child.canViewAttendance) labels.push('Attendance');
    if (child.canViewFees) labels.push('Fees');
    if (child.canPayFees) labels.push('Payments');
    if (child.canViewResults) labels.push('Results');
    if (child.canViewTimetable) labels.push('Timetable');
    if (child.canManageLeave) labels.push('Leave');
    if (child.pickupAuthorized) labels.push('Pickup');
    return labels;
  }

  async unlink(child: ChildAccess): Promise<void> {
    if (!this.profile) return;
    const confirmed = await this.toast.confirm({
      title: 'Remove child access?',
      message: `This will immediately remove ${this.profile.parent.name}'s access to ${child.studentName}.`,
      confirmText: 'Remove access', cancelText: 'Cancel', danger: true, icon: 'danger'
    });
    if (!confirmed) return;
    this.parentService.unlinkStudent(this.profile.parent.parentId, child.relationshipId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { this.toast.success('Access removed'); this.selectParent(this.profile!.parent); this.loadParents(false); },
        error: () => this.toast.error('Could not remove access'),
      });
  }

  async toggleParent(parent: ParentSummary): Promise<void> {
    if (parent.active) {
      const confirmed = await this.toast.confirm({
        title: 'Disable parent login?',
        message: `${parent.name} will no longer be able to sign in. Student links and permissions will be preserved.`,
        confirmText: 'Disable login', cancelText: 'Cancel', danger: true, icon: 'warning'
      });
      if (!confirmed) return;
    }
    this.parentService.setActive(parent.parentId, !parent.active).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(parent.active ? 'Parent access disabled' : 'Parent access restored');
        if (this.profile?.parent.parentId === parent.parentId) {
          this.profile = { ...this.profile, parent: { ...this.profile.parent, active: !parent.active } };
        }
        this.loadParents(false);
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Could not update parent access'),
    });
  }

  selectChild(child: ChildAccess): void { this.selectedChild = child; }

  openAttendance(child: ChildAccess): void {
    this.router.navigate(['/dashboard/attendance-summary'], {
      queryParams: { studentId: child.studentId, className: child.className }
    });
  }

  openFees(child: ChildAccess): void {
    this.router.navigate(['/dashboard/fees', child.studentId]);
  }

  openPaymentHistory(child: ChildAccess): void {
    this.router.navigate(['/dashboard/payment-history', child.studentId]);
  }

  openResults(child: ChildAccess): void {
    this.router.navigate(['/dashboard/my-results'], { queryParams: { studentId: child.studentId } });
  }

  openLeave(child: ChildAccess): void {
    this.router.navigate(['/dashboard/apply-leave'], { queryParams: { studentId: child.studentId } });
  }

  openSchoolUpdates(): void { this.router.navigate(['/dashboard/notice']); }

  openTimetable(child: ChildAccess): void {
    this.router.navigate(['/dashboard/timetable'], {
      queryParams: { studentId: child.studentId, className: child.className }
    });
  }
}
