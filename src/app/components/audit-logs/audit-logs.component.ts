import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { AuditLog, AuditFilters, AuditService } from '../../services/audit.service';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStateService } from '../../auth/auth-state.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  logs: AuditLog[] = [];
  page = 0;
  size = 20;
  totalPages = 0;

  filters: AuditFilters = {
    username: '',
    action: '',
    entityName: '',
    startDate: '',
    endDate: ''
  };

  // Full list of your specific actions for the dropdown
  actionTypes = [
    // Admin
    'CREATE_ADMIN', 'UPDATE_ADMIN', 'DELETE_ADMIN',
    // Teacher
    'CREATE_TEACHER', 'UPDATE_TEACHER', 'DELETE_TEACHER',
    // Student
    'UPDATE_STUDENT', 'REGISTER_STUDENT', 'BULK_IMPORT_STUDENTS', 'UPDATE_STUDENT_STREAM',
    // Fees
    'UPDATE_BUS_FEES', 'UPDATE_FEE_STRUCTURE', 'UPDATE_STUDENT_FEES',
    // Fee reminders
    'SEND_FEE_REMINDER', 'SEND_BULK_FEE_REMINDER',
    // Attendance
    'SAVE_ATTENDANCE', 'DELETE_ATTENDANCE', 'UPDATE_ATTENDANCE_CHARGE_PAID',
    // Leave
    'APPLY_LEAVE', 'APPROVE_LEAVE', 'REJECT_LEAVE', 'DELETE_LEAVE',
    // Timetable
    'CREATE_TIMETABLE_ENTRY', 'UPDATE_TIMETABLE_ENTRY', 'DELETE_TIMETABLE_ENTRY',
    // Notice & Notifications
    'CREATE_NOTICE', 'UPDATE_NOTICE', 'DELETE_NOTICE', 'UPDATE_NOTIFICATION',
    // Events
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT',
    // Exams, Marks, Results
    'CREATE_EXAM', 'UPDATE_EXAM', 'DELETE_EXAM',
    'SAVE_MARKS', 'UPDATE_MARKS',
    // Subjects
    'CREATE_SUBJECT', 'UPDATE_SUBJECT', 'DELETE_SUBJECT',
    // Password / Auth
    'RESET_PASSWORD',
    // Bulk
    'BULK_IMPORT_TEACHERS',
  ];

  selectedLog?: AuditLog;
  selectedDiff: { field: string; old: any; new: any }[] = [];
  selectedParsed: any = null;
  selectedParsedLabel = '';

  isLoading = false;

  constructor(
    private auditService: AuditService,
    private cdr: ChangeDetectorRef,
    private authState: AuthStateService,
    private router: Router,
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    const role = this.authState.getUser()?.role;
    if (role !== 'ADMIN') {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadLogs();
  }

  loadLogs() {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.auditService.getAuditLogs(this.page, this.size, this.filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.logs = res.content;
          this.totalPages = res.totalPages;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  applyFilters() {
    this.page = 0;
    this.loadLogs();
  }

  getActionCategory(action: string): string {
    if (!action) return 'cat-default';
    const act = action.toUpperCase();

    // Severity first — DELETE is always red regardless of domain
    if (act.includes('DELETE')) return 'cat-danger';

    // Domain-specific (order matters — more specific first)
    if (act.includes('ADMIN')) return 'cat-admin';
    if (act.includes('TEACHER') || act.includes('BULK_IMPORT')) return 'cat-staff';
    if (act.includes('STUDENT') && !act.includes('FEES') && !act.includes('STREAM')) return 'cat-student';
    if (act.includes('ATTENDANCE')) return 'cat-attendance';
    if (act.includes('LEAVE') || act.includes('APPROVE') || act.includes('REJECT')) return 'cat-leave';
    if (act.includes('FEES') || act.includes('FEE_STRUCTURE') || act.includes('BUS')) return 'cat-finance';
    if (act.includes('REMINDER') || act.includes('SEND_')) return 'cat-reminder';
    if (act.includes('EVENT')) return 'cat-event';
    if (act.includes('TIMETABLE')) return 'cat-timetable';
    if (act.includes('NOTICE') || act.includes('NOTIFICATION')) return 'cat-notice';
    if (act.includes('EXAM') || act.includes('MARKS') || act.includes('RESULT')) return 'cat-exam';
    if (act.includes('SUBJECT')) return 'cat-subject';
    if (act.includes('STREAM')) return 'cat-stream';
    if (act.includes('PASSWORD') || act.includes('RESET')) return 'cat-auth';
    if (act.includes('REGISTER')) return 'cat-register';

    return 'cat-default';
  }

  viewDetails(log: AuditLog) {
    this.selectedLog = log;
    if (this.isUpdateAction(log.action)) {
      this.selectedDiff = this.computeDiff(log.oldValue, log.newValue);
      this.selectedParsed = null;
      this.selectedParsedLabel = '';
    } else {
      this.selectedDiff = [];
      const isDelete = log.action?.toUpperCase().includes('DELETE');
      const rawValue = isDelete ? (log.oldValue || log.newValue) : (log.newValue || log.oldValue);
      this.selectedParsed = this.parseJsonValue(rawValue);
      this.selectedParsedLabel = isDelete ? 'Deleted' : 'Created';
    }
  }

  closeDetails() {
    this.selectedLog = undefined;
    this.selectedDiff = [];
    this.selectedParsed = null;
    this.selectedParsedLabel = '';
  }

  isUpdateAction(action: string): boolean {
    return action?.toUpperCase().includes('UPDATE');
  }

  parseJsonValue(value: string | null | undefined): any {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return value; }
  }

  isArray(val: any): boolean { return Array.isArray(val); }
  isObject(val: any): boolean { return val !== null && typeof val === 'object' && !Array.isArray(val); }

  getObjectKeys(obj: any): string[] {
    if (!this.isObject(obj)) return [];
    return Object.keys(obj);
  }

  getArrayColumns(arr: any[]): string[] {
    if (!arr?.length) return [];
    const first = arr[0];
    return (this.isObject(first)) ? Object.keys(first) : ['value'];
  }

  getCellValue(item: any, col: string): any {
    return this.isObject(item) ? item[col] : item;
  }

  getStatusClass(val: any): string {
    const s = String(val ?? '').toUpperCase();
    if (s === 'PRESENT') return 'status-present';
    if (s === 'ABSENT') return 'status-absent';
    if (s === 'LATE') return 'status-late';
    return '';
  }

  isStatusField(col: string): boolean {
    return ['status', 'attendanceStatus', 'present'].includes(col.toLowerCase());
  }

  computeDiff(oldValue: string | null | undefined, newValue: string | null | undefined): { field: string; old: any; new: any }[] {
    if (!oldValue || !newValue) return [];
    try {
      const oldObj = JSON.parse(oldValue);
      const newObj = JSON.parse(newValue);
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      const diffs: { field: string; old: any; new: any }[] = [];
      for (const key of allKeys) {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          diffs.push({ field: key, old: oldObj[key], new: newObj[key] });
        }
      }
      return diffs;
    } catch {
      return [];
    }
  }

  formatValue(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  }

  nextPage() {
    if (this.page < this.totalPages - 1) {
      this.page++;
      this.loadLogs();
    }
  }

  prevPage() {
    if (this.page > 0) {
      this.page--;
      this.loadLogs();
    }
  }

  formatJson(value: string | null | undefined): string {
    if (!value) return '';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  trackByLogId(index: number, log: AuditLog): number { return log.id; }
  trackByIndex(index: number): number { return index; }

  formatRole(role: string): string {
    if (!role) return '';
    return role
      .replace('ROLE_', '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('_');
  }
}