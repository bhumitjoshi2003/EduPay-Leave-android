import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { TimetableService } from '../../services/timetable.service';
import { TeacherService } from '../../services/teacher.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { StudentService } from '../../services/student.service';
import { LoggerService } from '../../services/logger.service';
import { TimetableEntry } from '../../interfaces/timetable';
import { Teacher } from '../../interfaces/teacher';
import { ToastService } from '../../services/toast.service';
import { Capacitor } from '@capacitor/core';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './timetable.component.html',
  styleUrl: './timetable.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimetableComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly TIMES_KEY = 'tt_showTimes';

  role = '';
  userId = '';
  userClassName = '';

  private static readonly DAY_LABELS: Record<string, string> = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday'
  };
  private static readonly DAY_ABBR: Record<string, string> = {
    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
    THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun'
  };
  private static readonly DAY_LETTER: Record<string, string> = {
    MONDAY: 'M', TUESDAY: 'T', WEDNESDAY: 'W',
    THURSDAY: 'T', FRIDAY: 'F', SATURDAY: 'S', SUNDAY: 'S'
  };

  days: string[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  dayLabels: Record<string, string> = TimetableComponent.DAY_LABELS;
  dayAbbr: Record<string, string> = TimetableComponent.DAY_ABBR;
  dayLetter: Record<string, string> = TimetableComponent.DAY_LETTER;
  allPeriods: number[] = Array.from({ length: 8 }, (_, i) => i + 1);

  classList: string[] = [];
  managedClasses: SchoolClass[] = [];
  sections: Section[] = [];
  selectedClass = '';
  selectedSectionId: number | null = null;
  selectedDay = 'MONDAY';
  todayDay = '';

  showTimes: boolean = (typeof localStorage !== 'undefined')
    ? localStorage.getItem(this.TIMES_KEY) !== 'false'
    : true;

  entries: TimetableEntry[] = [];
  teacherEntries: TimetableEntry[] = [];
  teacherGrid: Record<string, TimetableEntry[]> = {};

  isLoading = false;
  error: string | null = null;
  teachers: Teacher[] = [];

  showModal = false;
  isEditMode = false;
  modalForm: TimetableEntry = this.emptyForm();
  modalError: string | null = null;
  modalSaving = false;

  constructor(
    private timetableService: TimetableService,
    private teacherService: TeacherService,
    private authStateService: AuthStateService,
    private studentService: StudentService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private sectionService: SectionService
  ) {}

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.userId = user?.userId ?? '';
    this.userClassName = user?.className ?? '';

    const dayMap = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    this.todayDay = dayMap[new Date().getDay()];
    this.selectedDay = this.days.includes(this.todayDay) ? this.todayDay : this.days[0];

    // Load school settings (working days)
    this.schoolService.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        if (settings.workingDays) {
          this.days = settings.workingDays.split(',').filter(d => d.trim()).map(d => d.trim().toUpperCase());
        }
        if (!this.days.includes(this.selectedDay)) {
          this.selectedDay = this.days.includes(this.todayDay) ? this.todayDay : this.days[0] ?? 'MONDAY';
        }
        this.cdr.markForCheck();
      },
      error: (err) => this.logger.error('Failed to load school settings', err)
    });

    if (this.isAdmin()) {
      // Load class list + managed classes in parallel so section lookup has IDs
      forkJoin({
        classes: this.schoolService.getClasses(),
        managed: this.schoolService.getManagedClasses()
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: ({ classes, managed }) => {
          this.classList = classes;
          this.managedClasses = managed;
          if (classes.length > 0 && !this.selectedClass) {
            this.selectedClass = classes[0];
            this.onClassChange();
          }
          this.cdr.markForCheck();
        }
      });
      this.loadTeachers();
    }

    if (this.isTeacher()) {
      this.loadTeacherTimetable();
    }

    if (this.isStudent()) {
      this.selectedClass = this.userClassName;
      // Fetch the student's section so we filter the timetable to their section
      this.studentService.getStudent(this.userId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (student) => {
          this.selectedSectionId = student.sectionId ?? null;
          this.loadClassTimetable();
        },
        error: () => {
          // Fall back to class-wide timetable if profile fetch fails
          this.loadClassTimetable();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isStudent(): boolean { return this.role === 'STUDENT'; }
  isTeacher(): boolean { return this.role === 'TEACHER'; }
  isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUB_ADMIN' || this.role === 'SUPER_ADMIN';
  }

  onDaySelect(day: string): void {
    this.selectedDay = day;
    this.cdr.markForCheck();
  }

  onClassChange(): void {
    this.sections = [];
    this.selectedSectionId = null;
    this.entries = [];
    if (!this.selectedClass) { this.cdr.markForCheck(); return; }
    this.loadSectionsForClass(this.selectedClass, () => this.loadClassTimetable());
  }

  onSectionChange(): void {
    this.loadClassTimetable();
  }

  private loadSectionsForClass(className: string, then?: () => void): void {
    const cls = this.managedClasses.find(c => c.name === className);
    if (!cls) { then?.(); return; }
    this.sectionService.getSectionsForClass(cls.id)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (secs) => {
          this.sections = secs;
          this.cdr.markForCheck();
          then?.();
        },
        error: () => { this.sections = []; then?.(); }
      });
  }

  toggleTimes(): void {
    this.showTimes = !this.showTimes;
    localStorage.setItem(this.TIMES_KEY, String(this.showTimes));
    this.cdr.markForCheck();
  }

  get dayEntries(): TimetableEntry[] {
    return this.entries
      .filter(e => e.day === this.selectedDay)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }

  get teacherDayEntries(): TimetableEntry[] {
    return this.teacherGrid[this.selectedDay] ?? [];
  }

  // ── Subject icon ─────────────────────────────────────────────────

  getSubjectIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('physics'))                                               return '⚛️';
    if (n.includes('chemistry'))                                             return '🧪';
    if (n.includes('biology'))                                               return '🧬';
    if (n.includes('math'))                                                  return '🔢';
    if (n.includes('english'))                                               return '📖';
    if (n.includes('hindi'))                                                 return '📝';
    if (n.includes('sanskrit') || n.includes('third language'))             return '🕉️';
    if (n.includes('computer science') || n.includes('informatics'))        return '💻';
    if (n.includes('information technology') || n === 'it'
      || n.includes('artificial intelligence') || n.includes(' ai'))        return '🖥️';
    if (n.includes('drawing') || n.includes('art'))                         return '🎨';
    if (n.includes('music'))                                                 return '🎵';
    if (n.includes('physical education') || n === 'pt' || n === 'pe'
      || n.includes('sport'))                                                return '⚽';
    if (n.includes('evs') || n.includes('environmental'))                   return '🌱';
    if (n.includes('general knowledge') || n === 'gk')                      return '💡';
    if (n.includes('computer'))                                              return '💻';
    if (n.includes('science'))                                               return '🔬';
    if (n.includes('social science') || n === 'sst')                        return '🌍';
    if (n.includes('history'))                                               return '📜';
    if (n.includes('geography'))                                             return '🗺️';
    if (n.includes('political science') || n.includes('civics'))            return '⚖️';
    if (n.includes('economics'))                                             return '📈';
    if (n.includes('accountancy') || n.includes('accounting'))              return '📊';
    if (n.includes('business'))                                              return '💼';
    if (n.includes('sociology'))                                             return '👥';
    if (n.includes('psychology'))                                            return '🧠';
    return '📚';
  }

  // ── Subject colour class ─────────────────────────────────────────

  getSubjectClass(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('physics'))                                               return 'physics';
    if (n.includes('chemistry'))                                             return 'chemistry';
    if (n.includes('biology'))                                               return 'biology';
    if (n.includes('math'))                                                  return 'maths';
    if (n.includes('english'))                                               return 'english';
    if (n.includes('hindi'))                                                 return 'hindi';
    if (n.includes('sanskrit') || n.includes('third language'))             return 'sanskrit';
    if (n.includes('computer') || n.includes('informatics')
      || n.includes('information technology')
      || n.includes('artificial intelligence'))                              return 'computer';
    if (n.includes('drawing') || n.includes('art') || n.includes('music')) return 'arts';
    if (n.includes('physical education') || n === 'pt' || n === 'pe'
      || n.includes('sport'))                                                return 'pe';
    if (n.includes('evs') || n.includes('environmental')
      || n.includes('science'))                                              return 'science';
    if (n.includes('social science') || n === 'sst' || n.includes('history')
      || n.includes('geography') || n.includes('civics')
      || n.includes('political'))                                            return 'sst';
    if (n.includes('general knowledge') || n === 'gk')                      return 'gk';
    if (n.includes('economics') || n.includes('accountancy')
      || n.includes('business'))                                             return 'commerce';
    if (n.includes('sociology') || n.includes('psychology'))                return 'social';
    return 'default';
  }

  // ── Data loading ─────────────────────────────────────────────────

  loadClassTimetable(): void {
    if (!this.selectedClass) return;
    this.isLoading = true;
    this.error = null;
    this.entries = [];
    this.cdr.markForCheck();

    this.timetableService.getClassTimetable(this.selectedClass, this.selectedSectionId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          this.entries = data;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load timetable:', err);
          this.error = 'Failed to load timetable. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadTeacherTimetable(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.timetableService.getTeacherTimetable(this.userId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          this.teacherEntries = data;
          this.buildTeacherGrid(data);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load teacher timetable:', err);
          this.error = 'Failed to load your schedule. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadTeachers(): void {
    this.teacherService.getAllTeachers()
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (list) => { this.teachers = list; this.cdr.markForCheck(); },
        error: (err) => this.logger.error('Failed to load teachers:', err)
      });
  }

  private buildTeacherGrid(data: TimetableEntry[]): void {
    this.teacherGrid = {};
    for (const day of this.days) {
      this.teacherGrid[day] = data
        .filter(e => e.day === day)
        .sort((a, b) => a.periodNumber - b.periodNumber);
    }
  }

  hasAnyEntry(): boolean { return this.entries.length > 0; }
  hasAnyTeacherEntry(): boolean { return this.teacherEntries.length > 0; }

  // ── Modal ────────────────────────────────────────────────────────

  openAddPeriod(): void {
    if (!this.isAdmin()) return;
    this.isEditMode = false;
    this.modalForm = this.emptyForm();
    this.modalForm.className = this.selectedClass;
    this.modalForm.sectionId = this.selectedSectionId;
    this.modalForm.day = this.selectedDay;
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEdit(entry: TimetableEntry): void {
    if (!this.isAdmin()) return;
    this.isEditMode = true;
    this.modalForm = { ...entry };
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.cdr.markForCheck();
  }

  onTeacherSelect(): void {
    const teacher = this.teachers.find(t => t.teacherId === this.modalForm.teacherId);
    this.modalForm.teacherName = teacher?.name ?? '';
  }

  saveEntry(): void {
    this.modalError = null;
    if (!this.modalForm.subjectName?.trim()) {
      this.modalError = 'Subject name is required.'; return;
    }
    if (!this.modalForm.teacherId) {
      this.modalError = 'Please select a teacher.'; return;
    }
    if (!this.modalForm.startTime || !this.modalForm.endTime) {
      this.modalError = 'Start and end time are required.'; return;
    }
    if (this.modalForm.startTime >= this.modalForm.endTime) {
      this.modalError = 'End time must be after start time.'; return;
    }

    this.modalSaving = true;
    this.cdr.markForCheck();

    const save$ = this.isEditMode && this.modalForm.id != null
      ? this.timetableService.updateEntry(this.modalForm.id, this.modalForm)
      : this.timetableService.createEntry(this.modalForm);

    save$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.modalSaving = false;
        this.showModal = false;
        this.loadClassTimetable();
        this.toast.success('Saved!');
      },
      error: (err) => {
        this.modalSaving = false;
        this.logger.error('Failed to save timetable entry:', err);
        this.modalError = err.status === 409
          ? 'A subject is already scheduled for this period. Edit the existing one instead.'
          : 'Failed to save. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  deleteEntry(): void {
    if (!this.modalForm.id) return;
    this.toast.confirm({
      title: 'Delete this period?',
      message: `${this.modalForm.subjectName} — ${this.dayLabels[this.modalForm.day]} Period ${this.modalForm.periodNumber}`,
      confirmText: 'Yes, delete',
      danger: true
    }).then(confirmed => {
      if (!confirmed) return;
      this.timetableService.deleteEntry(this.modalForm.id!)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.showModal = false;
            this.loadClassTimetable();
            this.toast.success('Deleted');
          },
          error: (err) => {
            this.logger.error('Failed to delete entry:', err);
            this.toast.error('Error', 'Failed to delete. Please try again.');
          }
        });
    });
  }

  printTimetable(): void {
    if (Capacitor.isNativePlatform()) {
      this.toast.info('Not Available', 'Printing is not supported on the mobile app. Please use the web version.');
      return;
    }
    window.print();
  }

  private emptyForm(): TimetableEntry {
    return {
      className: '', sectionId: null, day: this.selectedDay ?? 'MONDAY', periodNumber: 1,
      startTime: '', endTime: '', subjectName: '', teacherId: ''
    };
  }

  get selectedSectionName(): string | null {
    if (this.selectedSectionId == null) return null;
    return this.sections.find(s => s.id === this.selectedSectionId)?.name ?? null;
  }

  trackByDay(_: number, day: string): string { return day; }
  trackByEntry(_: number, e: TimetableEntry): string {
    return `${e.id ?? e.day + e.periodNumber}`;
  }
}
