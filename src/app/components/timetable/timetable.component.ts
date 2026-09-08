import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, switchMap, catchError, EMPTY } from 'rxjs';
import { TimetableService } from '../../services/timetable.service';
import { TeacherService } from '../../services/teacher.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { StudentService } from '../../services/student.service';
import { LoggerService } from '../../services/logger.service';
import { TimetableEntry, TimetableEntryRequest } from '../../interfaces/timetable';
import { Teacher } from '../../interfaces/teacher';
import { ToastService } from '../../services/toast.service';
import { Capacitor } from '@capacitor/core';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';
import { ActivatedRoute, Router } from '@angular/router';
import { ParentChildContextComponent } from '../parent-child-context/parent-child-context.component';
import { ChildAccess } from '../../interfaces/parent-portal';
import { TeacherClassGrantService } from '../../services/teacher-class-grant.service';

import { AcademicSession } from '../../interfaces/academic-session';
import { AcademicSessionSelectorComponent, writableSession, apiMessage } from '../academic-session-selector/academic-session-selector.component';

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, ParentChildContextComponent, AcademicSessionSelectorComponent],
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

  managedClasses: SchoolClass[] = [];
  sections: Section[] = [];
  selectedClass = '';
  selectedClassId: number | null = null;
  selectedSession: AcademicSession | null = null;
  sectionsLoaded = false;
  private selectionChanged$ = new Subject<void>();
  private classRead$ = new Subject<{ className: string; sectionId: number | null; studentId: string | null; academicSessionId?: number } | null>();
  private destroyed = false;
  get initialSessionId(): number | null { return Number(this.route.snapshot.queryParamMap.get('academicSessionId')) || null; }
  canManage(): boolean { return this.role === 'ADMIN'; }
  canWrite(): boolean { return this.canManage() && writableSession(this.selectedSession); }
  canAdd(): boolean { return this.canWrite() && !!this.selectedClassId && this.sectionsLoaded && (this.sections.length ? this.sections.some(s => s.id === this.selectedSectionId) : this.selectedSectionId == null); }
  onSessionSelected(session: AcademicSession | null): void {
    this.classRead$.next(null);
    this.selectedSession = session; this.showModal = false; this.showGrantModal = false;
    this.entries = []; this.isLoading = false; this.loadClassTimetable(); this.cdr.markForCheck();
  }
  selectedSectionId: number | null = null;
  selectedDay = 'MONDAY';
  todayDay = '';
  userName = '';

  /** Distinct class+section combos a TEACHER already has a real relationship with (they
   *  already teach it, or are its class-teacher) — the only options they may add a period
   *  into. The backend enforces this independently; this only scopes what's offered. */
  myClasses: { classId?: number; className: string; sectionId: number | null; sectionName: string | null }[] = [];

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
  /** True while the modal is adding a second subject to an existing period's slot (the
   *  "+ Simultaneous" action) rather than creating an unrelated new period. */
  isSimultaneousMode = false;
  /** The existing entry being paired with, while isSimultaneousMode is true. */
  simultaneousSourceId: number | null = null;
  modalForm: TimetableEntry = this.emptyForm();
  modalError: string | null = null;
  modalSaving = false;

  /** Admin-only "Grant Teacher Access" modal — separate from the period modal above since its
   *  fields are entirely different (just a teacher, against the already-selected class). */
  showGrantModal = false;
  grantTeacherId = '';
  grantError: string | null = null;
  grantSaving = false;

  constructor(
    private timetableService: TimetableService,
    private teacherService: TeacherService,
    private authStateService: AuthStateService,
    private studentService: StudentService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private sectionService: SectionService,
    private route: ActivatedRoute,
    private router: Router,
    private teacherClassGrantService: TeacherClassGrantService
  ) {
    this.classRead$.pipe(
      switchMap(query => query ? this.timetableService.getClassTimetable(
        query.className, query.sectionId, query.studentId, query.academicSessionId
      ).pipe(catchError(err => {
        this.error = apiMessage(err); this.isLoading = false; this.cdr.markForCheck();
        return EMPTY;
      })) : EMPTY),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.entries = data; this.isLoading = false; this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.userId = user?.userId ?? '';
    this.userClassName = user?.className ?? '';
    this.userName = user?.name ?? '';

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
      this.schoolService.getManagedClasses().pipe(takeUntil(this.destroy$)).subscribe({
        next: managed => {
          this.managedClasses = managed;
          if (managed.length && !this.selectedClassId) {
            this.selectedClassId = managed[0].id;
            this.onClassChange();
          }
          this.cdr.markForCheck();
        },
        error: err => { this.error = apiMessage(err); this.cdr.markForCheck(); }
      });
      if (this.canManage()) this.loadTeachers();
    }

    if (this.isTeacher()) {
      this.schoolService.getManagedClasses().pipe(takeUntil(this.destroy$)).subscribe({
        next: classes => { this.managedClasses = classes; this.loadTeacherTimetable(); },
        error: err => { this.logger.error('Failed to load canonical class choices', err); this.loadTeacherTimetable(); }
      });
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

    if (this.isParent()) {
      const studentId = this.route.snapshot.queryParamMap.get('studentId') ?? '';
      const className = this.route.snapshot.queryParamMap.get('className') ?? '';
      if (!studentId || !className) {
        this.error = 'Select a child from the parent dashboard to view their timetable.';
      } else {
        this.userId = studentId;
        this.selectedClass = className;
        this.loadClassTimetable();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.selectionChanged$.next(); this.selectionChanged$.complete();
    this.classRead$.next(null); this.classRead$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  onChildTabSelected(child: ChildAccess): void {
    if (!child.canViewTimetable) {
      this.toast.error('Timetable access unavailable', 'Please contact the school administrator.');
      return;
    }
    this.userId = child.studentId;
    this.selectedClass = child.className;
    this.error = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { studentId: child.studentId, className: child.className },
      replaceUrl: true,
    });
    this.loadClassTimetable();
  }

  isStudent(): boolean { return this.role === 'STUDENT'; }
  isParent(): boolean { return this.role === 'PARENT'; }
  isTeacher(): boolean { return this.role === 'TEACHER'; }
  isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUB_ADMIN' || this.role === 'SUPER_ADMIN';
  }

  onDaySelect(day: string): void {
    this.selectedDay = day;
    this.cdr.markForCheck();
  }

  onClassChange(): void {
    this.selectionChanged$.next(); this.classRead$.next(null);
    this.selectedClass = this.managedClasses.find(c => c.id === this.selectedClassId)?.name ?? '';
    this.showModal = false; this.sectionsLoaded = false; this.isLoading = false;
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
    const cls = this.managedClasses.find(c => c.id === this.selectedClassId);
    if (!cls) { then?.(); return; }
    this.sectionService.getSectionsForClass(cls.id)
      .pipe(takeUntil(this.selectionChanged$), takeUntil(this.destroy$)).subscribe({
        next: (secs) => {
          this.sections = secs.filter(s => s.active);
          this.sectionsLoaded = true;
          this.cdr.markForCheck();
          then?.();
        },
        error: err => { this.sections = []; this.sectionsLoaded = false; this.error = apiMessage(err); this.cdr.markForCheck(); }
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

  /** Clusters dayEntries sharing the same period number into one visual block — normally a
   *  cluster has exactly one entry (today's only case); a cluster with more than one entry means
   *  a legitimate simultaneous/elective assignment (see simultaneousGroup), rendered as stacked
   *  subject/teacher rows under one "Period N" header instead of separate cards. */
  get groupedDayEntries(): { periodNumber: number; entries: TimetableEntry[] }[] {
    const map = new Map<number, TimetableEntry[]>();
    for (const entry of this.dayEntries) {
      const list = map.get(entry.periodNumber) ?? [];
      list.push(entry);
      map.set(entry.periodNumber, list);
    }
    return Array.from(map.entries())
      .map(([periodNumber, entries]) => ({ periodNumber, entries }))
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
    if (n.includes('economics'))                                             return 'economics';
    if (n.includes('accountancy') || n.includes('accounting'))              return 'accountancy';
    if (n.includes('business'))                                              return 'business';
    if (n.includes('sociology') || n.includes('psychology'))                return 'social';
    return 'default';
  }

  // ── Data loading ─────────────────────────────────────────────────

  loadClassTimetable(): void {
    this.classRead$.next(null);
    if (!this.selectedClass || (this.canManage() && !this.selectedSession)) return;
    this.isLoading = true;
    this.error = null;
    this.entries = [];
    this.cdr.markForCheck();

    this.classRead$.next({
      className: this.selectedClass,
      sectionId: this.selectedSectionId,
      studentId: this.isParent() ? this.userId : null,
      academicSessionId: this.canManage() ? this.selectedSession!.id : undefined
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
          this.buildMyClasses(data);
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

  /** Distinct class+section combos derived from the teacher's own existing periods, plus
   *  their class-teacher assignment (if any) even when it has no periods logged yet. */
  private buildMyClasses(entries: TimetableEntry[]): void {
    const seen = new Set<string>();
    const classes: { classId?: number; className: string; sectionId: number | null; sectionName: string | null }[] = [];
    for (const e of entries) {
      const key = `${e.className}::${e.sectionId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      classes.push({ classId: e.classId, className: e.className, sectionId: e.sectionId ?? null, sectionName: e.sectionName ?? null });
    }
    this.myClasses = classes;
    this.cdr.markForCheck();

    // seen/myClasses are shared across these two independent, order-agnostic lookups so
    // neither one can add a class the other already added.
    const addIfNew = (className: string, sectionId: number | null, sectionName: string | null) => {
      const key = `${className}::${sectionId ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      // These legacy live/grant DTOs expose only a name; resolve once against canonical school classes.
      const classId = this.managedClasses.find(c => c.name === className)?.id;
      if (!classId) return;
      this.myClasses = [...this.myClasses, { classId, className, sectionId, sectionName }];
      this.cdr.markForCheck();
    };

    this.teacherService.getTeacher(this.userId).pipe(takeUntil(this.destroy$)).subscribe({
      next: teacher => {
        if (!teacher.classTeacher) return;
        addIfNew(teacher.classTeacher, teacher.classTeacherSectionId ?? null, null);
      },
      error: () => { /* non-critical — self-add just won't offer this class if the lookup fails */ }
    });

    this.teacherClassGrantService.getForTeacher(this.userId).pipe(takeUntil(this.destroy$)).subscribe({
      next: grants => {
        for (const g of grants) {
          addIfNew(g.className, g.sectionId, g.sectionName);
        }
      },
      error: () => { /* non-critical — self-add just won't offer admin-granted classes if this fails */ }
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
    if (!this.canAdd()) return;
    this.isEditMode = false;
    this.isSimultaneousMode = false;
    this.simultaneousSourceId = null;
    this.modalForm = this.emptyForm();
    this.modalForm.classId = this.selectedClassId!;
    this.modalForm.academicSessionId = this.selectedSession!.id;
    this.modalForm.className = this.selectedClass;
    this.modalForm.sectionId = this.selectedSectionId;
    this.modalForm.day = this.selectedDay;
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  /** TEACHER self-service: opens a fresh Add Period form scoped to a class/section the teacher
   *  already has a real relationship with (see myClasses). teacherId is forced to themselves —
   *  never shown as a choice — and the backend re-enforces both independently. If the slot
   *  turns out to already be occupied, saveEntry()'s error handler offers to add this as a
   *  simultaneous subject instead of just failing. */
  openAddPeriodAsTeacher(): void {
    if (!this.isTeacher() || this.myClasses.length === 0) return;
    this.isEditMode = false;
    this.isSimultaneousMode = false;
    this.simultaneousSourceId = null;
    this.modalForm = this.emptyForm();
    this.modalForm.day = this.selectedDay;
    this.modalForm.teacherId = this.userId;
    this.modalForm.teacherName = this.userName;
    const first = this.myClasses[0];
    this.modalForm.classId = first.classId;
    this.modalForm.className = first.className;
    this.modalForm.sectionId = first.sectionId;
    this.modalForm.sectionName = first.sectionName;
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  myClassKey(c: { className: string; sectionId: number | null }): string {
    return `${c.className}::${c.sectionId ?? ''}`;
  }

  get selectedMyClassKey(): string {
    return `${this.modalForm.className}::${this.modalForm.sectionId ?? ''}`;
  }

  onMyClassSelect(key: string): void {
    const match = this.myClasses.find(c => this.myClassKey(c) === key);
    if (!match) return;
    this.modalForm.classId = match.classId;
    this.modalForm.className = match.className;
    this.modalForm.sectionId = match.sectionId;
    this.modalForm.sectionName = match.sectionName;
  }

  /** Pre-fills a new form from an existing entry's slot (day/section/period/times), leaving
   *  Subject/Teacher blank so the admin only has to pick the second subject. The Simultaneous
   *  Group tag itself is never shown or typed here — saveEntry() calls a dedicated backend
   *  action (TimetableService#addSimultaneous) that inherits the slot from `existing` server-side
   *  and generates/reuses the tag automatically, so an admin who's never heard of "tags" can
   *  still use this correctly. */
  openAddSimultaneous(existing: TimetableEntry): void {
    if (!this.canWrite()) return;
    this.isEditMode = false;
    this.isSimultaneousMode = true;
    this.simultaneousSourceId = existing.id ?? null;
    this.modalForm = {
      classId: existing.classId,
      academicSessionId: existing.academicSessionId,
      className: existing.className,
      sectionName: existing.sectionName,
      sectionId: existing.sectionId ?? null,
      day: existing.day,
      periodNumber: existing.periodNumber,
      startTime: existing.startTime,
      endTime: existing.endTime,
      subjectName: '',
      teacherId: '',
    };
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEdit(entry: TimetableEntry): void {
    if (!this.canWrite()) return;
    this.isEditMode = true;
    this.isSimultaneousMode = false;
    this.simultaneousSourceId = null;
    this.modalForm = { ...entry };
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.isSimultaneousMode = false;
    this.simultaneousSourceId = null;
    this.cdr.markForCheck();
  }

  /** Admin-only: authorizes a teacher to self-serve periods for the currently selected
   *  class/section, even one with no periods logged yet and that isn't their class-teacher
   *  assignment. See TeacherClassGrantService (backend) for what this actually grants. */
  openGrantModal(): void {
    if (!this.canAdd() || !this.selectedSession?.current) return;
    this.grantTeacherId = '';
    this.grantError = null;
    this.showGrantModal = true;
    this.cdr.markForCheck();
  }

  closeGrantModal(): void {
    this.showGrantModal = false;
    this.cdr.markForCheck();
  }

  saveGrant(): void {
    if (!this.canAdd() || !this.selectedSession?.current || this.grantSaving) return;
    this.grantError = null;
    if (!this.grantTeacherId) {
      this.grantError = 'Please select a teacher.'; return;
    }

    this.grantSaving = true;
    this.cdr.markForCheck();

    this.teacherClassGrantService.create({
      teacherId: this.grantTeacherId,
      className: this.selectedClass,
      sectionId: this.selectedSectionId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.grantSaving = false;
        this.showGrantModal = false;
        this.toast.success('Access granted!');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.grantSaving = false;
        this.grantError = typeof err.error === 'string' && err.error
          ? err.error
          : 'Failed to grant access. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  onTeacherSelect(): void {
    const teacher = this.teachers.find(t => t.teacherId === this.modalForm.teacherId);
    this.modalForm.teacherName = teacher?.name ?? '';
  }

  saveEntry(): void {
    if (this.modalSaving) return;
    this.modalError = null;
    if ((!this.isTeacher() && !this.canWrite()) || !this.modalForm.classId) {
      this.modalError = 'Select a writable session and a valid class.'; return;
    }
    if (this.canManage() && this.modalForm.academicSessionId !== this.selectedSession?.id) {
      this.modalError = 'Session changed. Reopen this period.'; return;
    }
    if (this.canManage() && (!this.sectionsLoaded || (this.sections.length ? !this.sections.some(s => s.id === this.modalForm.sectionId) : this.modalForm.sectionId != null))) {
      this.modalError = 'Select a valid section for this class.'; return;
    }
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

    const form = this.modalForm;
    const body: TimetableEntryRequest = {
      ...(this.canManage() ? { academicSessionId: this.selectedSession!.id } : {}),
      classId: form.classId!, sectionId: form.sectionId ?? null, day: form.day,
      periodNumber: form.periodNumber, startTime: form.startTime, endTime: form.endTime,
      subjectName: form.subjectName, teacherId: form.teacherId
    };
    const save$ = this.isSimultaneousMode && this.simultaneousSourceId != null
      ? this.timetableService.addSimultaneous(this.simultaneousSourceId, this.modalForm.subjectName, this.modalForm.teacherId, this.canManage() ? this.selectedSession!.id : undefined)
      : this.isEditMode && this.modalForm.id != null
        ? this.timetableService.updateEntry(this.modalForm.id, body)
        : this.timetableService.createEntry(body);

    save$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.modalSaving = false;
        this.showModal = false;
        if (this.isTeacher()) {
          this.loadTeacherTimetable();
        } else {
          this.loadClassTimetable();
        }
        this.toast.success('Saved!');
      },
      error: (err) => {
        this.modalSaving = false;
        this.logger.error('Failed to save timetable entry:', err);

        // A teacher's first attempt at a brand-new period landing on an already-occupied slot:
        // offer to add it as a simultaneous subject instead of a dead-end conflict message —
        // they never see slot/tag mechanics either way.
        if (this.isTeacher() && !this.isEditMode && !this.isSimultaneousMode && err.status === 409) {
          this.offerSimultaneousRecovery(apiMessage(err));
          return;
        }

        // The backend now returns a specific reason (slot conflict, group mismatch, teacher
        // double-booking, etc.) as the plain-text 409 body — prefer it when present.
        this.modalError = apiMessage(err);
        this.cdr.markForCheck();
      }
    });
  }

  /** Looks up what's already occupying the slot the teacher just tried to save into, and — if
   *  found — switches the modal into isSimultaneousMode against it so a retry pairs alongside
   *  the existing subject instead of failing again the same way. */
  private offerSimultaneousRecovery(originalMessage: string): void {
    this.timetableService.getClassTimetable(this.modalForm.className, this.modalForm.sectionId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (dayEntries) => {
          const clash = dayEntries.find(e => e.day === this.modalForm.day && e.periodNumber === this.modalForm.periodNumber);
          if (clash) {
            this.isSimultaneousMode = true;
            this.simultaneousSourceId = clash.id ?? null;
            this.modalForm.startTime = clash.startTime;
            this.modalForm.endTime = clash.endTime;
            this.modalForm.sectionName = clash.sectionName;
            this.modalError = originalMessage + ` Period ${clash.periodNumber} is already used by ${clash.subjectName}`
              + `${clash.teacherName ? ' (' + clash.teacherName + ')' : ''}. Click "Add Subject" below to add yours alongside it.`;
          } else {
            this.modalError = originalMessage;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.modalError = originalMessage;
          this.cdr.markForCheck();
        }
      });
  }

  deleteEntry(): void {
    if (!this.canWrite() || !this.modalForm.id || this.modalSaving) return;
    const id = this.modalForm.id;
    const sessionId = this.selectedSession!.id;
    this.toast.confirm({
      title: 'Delete this period?',
      message: `${this.modalForm.subjectName} — ${this.dayLabels[this.modalForm.day]} Period ${this.modalForm.periodNumber}`,
      confirmText: 'Yes, delete',
      danger: true
    }).then(confirmed => {
      if (!confirmed || this.destroyed || !this.canWrite() || this.selectedSession?.id !== sessionId) return;
      this.modalSaving = true;
      this.cdr.markForCheck();
      this.timetableService.deleteEntry(id, sessionId)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.modalSaving = false;
            this.showModal = false;
            this.loadClassTimetable();
            this.toast.success('Deleted');
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.modalSaving = false;
            this.cdr.markForCheck();
            this.logger.error('Failed to delete entry:', err);
            this.toast.error('Error', apiMessage(err));
          }
        });
    });
  }

  /** Local advisory warning only — the backend is the source of truth for what's actually
   *  allowed. Entries sharing the same non-blank simultaneousGroup as the entry being
   *  edited/added are intentionally excluded, since they're expected to share the same time. */
  checkTimeConflict(day: string, startTime: string, endTime: string, excludeId?: number, group?: string | null): boolean {
    if (!startTime || !endTime) return false;
    const normalizedGroup = group?.trim() || null;
    return this.entries
      .filter((e: TimetableEntry) => e.day === day && e.id !== excludeId)
      .filter((e: TimetableEntry) => !(normalizedGroup && (e.simultaneousGroup?.trim() || null) === normalizedGroup))
      .some((e: TimetableEntry) => startTime < e.endTime && e.startTime < endTime);
  }

  get timetableHeading(): string {
    const cls = this.selectedClass ?? '';
    const section = this.selectedSectionName ?? '';
    return section ? `Class ${cls} – Section ${section}` : `Class ${cls}`;
  }

  goToBulkImport(): void {
    if (!this.canWrite()) return;
    this.router.navigate(['/dashboard/timetable-bulk-import'], { queryParams: { academicSessionId: this.selectedSession!.id } });
  }

  printTimetable(): void {
    if (Capacitor.isNativePlatform()) {
      this.toast.info('Print Not Available', 'Printing is not supported on the mobile app. Please use the web version at edunexify.co.in');
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
  trackByPeriod(_: number, group: { periodNumber: number }): number { return group.periodNumber; }
}
