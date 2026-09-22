import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { StaffAdoptionService } from '../../services/staff-adoption.service';
import { StaffAdoptionResponse, StaffAdoptionTeacherRow } from '../../interfaces/staff-adoption';

@Component({ selector: 'app-staff-adoption', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, RouterLink], templateUrl: './staff-adoption.component.html', styleUrl: './staff-adoption.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class StaffAdoptionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>(); loading = true; error = false; data: StaffAdoptionResponse | null = null;
  searchTerm = ''; filter: 'ALL'|'STARTED'|'NOT_STARTED'|'USED'|'NOT_USED' = 'ALL';
  constructor(private service: StaffAdoptionService, private cdr: ChangeDetectorRef) {}
  ngOnInit(): void { this.load(); }
  load(): void { this.loading = true; this.error = false; this.service.getStaffAdoption().pipe(takeUntil(this.destroy$)).subscribe({ next: data => { this.data = data; this.loading = false; this.cdr.markForCheck(); }, error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); } }); }
  get rows(): StaffAdoptionTeacherRow[] { const q = this.searchTerm.trim().toLowerCase(); return (this.data?.teachers ?? []).filter(t => (!q || t.name.toLowerCase().includes(q) || t.teacherId.toLowerCase().includes(q)) && (this.filter === 'ALL' || this.filter === 'STARTED' && t.accountStatus === 'STARTED' || this.filter === 'NOT_STARTED' && t.accountStatus !== 'STARTED' || this.filter === 'USED' && t.hasUsedAttendance || this.filter === 'NOT_USED' && !t.hasUsedAttendance)); }
  status(t: StaffAdoptionTeacherRow): string { return t.accountStatus === 'ACCOUNT_PENDING' ? 'Account pending' : t.accountStatus === 'NOT_STARTED' ? 'Not started' : t.accountStatus.charAt(0) + t.accountStatus.slice(1).toLowerCase(); }
  relative(value: string | null): string { if (!value) return 'Never'; const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`; }
  app(t: StaffAdoptionTeacherRow): string { return t.appVersionStatus === 'UP_TO_DATE' ? 'Up to date' : t.appVersionStatus === 'UPDATE_AVAILABLE' ? 'Update available' : t.appVersionStatus === 'UPDATE_REQUIRED' ? 'Update required' : 'No version reported'; }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
