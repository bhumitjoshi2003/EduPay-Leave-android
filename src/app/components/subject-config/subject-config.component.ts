import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import {
  SubjectConfigService,
  ClassSubject,
  AcademicStream,
  CoreSubject,
  OptionalSubjectGroup,
  OptionalSubject,
} from '../../services/subject-config.service';
import { LoggerService } from '../../services/logger.service';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10'];

@Component({
  selector: 'app-subject-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subject-config.component.html',
  styleUrl: './subject-config.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'class' | 'streams' | 'optional' = 'class';
  classOptions = CLASS_OPTIONS;

  // Class subjects tab
  selectedClass = '1';
  classSubjects: ClassSubject[] = [];
  newSubjectName = '';

  // Streams tab
  streams: AcademicStream[] = [];
  newStreamName = '';
  newCoreSubjectName: Record<number, string> = {};
  expandedStreamId: number | null = null;

  // Optional groups tab
  optionalGroups: OptionalSubjectGroup[] = [];
  newGroupName = '';
  newOptionalSubjectName: Record<number, string> = {};
  expandedGroupId: number | null = null;

  constructor(
    private service: SubjectConfigService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService
  ) { }

  ngOnInit(): void {
    this.loadClassSubjects();
    this.loadStreams();
    this.loadOptionalGroups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: 'class' | 'streams' | 'optional'): void {
    this.activeTab = tab;
  }

  // ── Class Subjects ────────────────────────────────────────────────────────

  loadClassSubjects(): void {
    this.service.getClassSubjects(this.selectedClass).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.classSubjects = data; this.cdr.markForCheck(); },
      error: (e) => { this.logger.error('Error loading class subjects:', e); Swal.fire('Error', 'Failed to load subjects.', 'error'); },
    });
  }

  onClassChange(): void {
    this.newSubjectName = '';
    this.loadClassSubjects();
  }

  addClassSubject(): void {
    const name = this.newSubjectName.trim();
    if (!name) return;
    this.service.addClassSubject(this.selectedClass, name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => {
        this.classSubjects = [...this.classSubjects, s];
        this.newSubjectName = '';
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error adding subject:', e);
        Swal.fire('Error', 'Could not add subject. It may already exist.', 'error');
      },
    });
  }

  deleteClassSubject(id: number): void {
    Swal.fire({
      title: 'Delete subject?',
      text: 'This will remove it from the class.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.service.deleteClassSubject(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.classSubjects = this.classSubjects.filter(s => s.id !== id);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting subject:', e);
          Swal.fire('Error', 'Could not delete subject.', 'error');
        },
      });
    });
  }

  // ── Streams ───────────────────────────────────────────────────────────────

  loadStreams(): void {
    this.service.getStreams().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.streams = data; this.cdr.markForCheck(); },
      error: (e) => { this.logger.error('Error loading streams:', e); Swal.fire('Error', 'Failed to load streams.', 'error'); },
    });
  }

  toggleStream(id: number): void {
    this.expandedStreamId = this.expandedStreamId === id ? null : id;
  }

  addStream(): void {
    const name = this.newStreamName.trim();
    if (!name) return;
    this.service.addStream(name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => {
        this.streams = [...this.streams, s];
        this.newStreamName = '';
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error adding stream:', e);
        Swal.fire('Error', 'Could not add stream. It may already exist.', 'error');
      },
    });
  }

  deleteStream(id: number): void {
    Swal.fire({
      title: 'Delete stream?',
      text: 'This will remove the stream and all its core subjects.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.service.deleteStream(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.streams = this.streams.filter(s => s.id !== id);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting stream:', e);
          Swal.fire('Error', 'Could not delete stream.', 'error');
        },
      });
    });
  }

  addCoreSubject(streamId: number): void {
    const name = (this.newCoreSubjectName[streamId] || '').trim();
    if (!name) return;
    this.service.addCoreSubject(streamId, name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (subj) => {
        // Immutable update — replace the stream object so OnPush detects the change
        this.streams = this.streams.map(s =>
          s.id === streamId ? { ...s, coreSubjects: [...s.coreSubjects, subj] } : s
        );
        this.newCoreSubjectName[streamId] = '';
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error adding core subject:', e);
        Swal.fire('Error', 'Could not add subject.', 'error');
      },
    });
  }

  deleteCoreSubject(streamId: number, subjectId: number): void {
    Swal.fire({
      title: 'Delete subject?',
      text: 'This will remove the core subject from the stream.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.service.deleteCoreSubject(subjectId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.streams = this.streams.map(s =>
            s.id === streamId ? { ...s, coreSubjects: s.coreSubjects.filter(c => c.id !== subjectId) } : s
          );
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting core subject:', e);
          Swal.fire('Error', 'Could not delete subject.', 'error');
        },
      });
    });
  }

  // ── Optional Groups ───────────────────────────────────────────────────────

  loadOptionalGroups(): void {
    this.service.getOptionalGroups().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.optionalGroups = data; this.cdr.markForCheck(); },
      error: (e) => { this.logger.error('Error loading optional groups:', e); Swal.fire('Error', 'Failed to load optional groups.', 'error'); },
    });
  }

  toggleGroup(id: number): void {
    this.expandedGroupId = this.expandedGroupId === id ? null : id;
  }

  addOptionalGroup(): void {
    const name = this.newGroupName.trim();
    if (!name) return;
    this.service.addOptionalGroup(name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (g) => {
        this.optionalGroups = [...this.optionalGroups, g];
        this.newGroupName = '';
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error adding group:', e);
        Swal.fire('Error', 'Could not add group.', 'error');
      },
    });
  }

  deleteOptionalGroup(id: number): void {
    Swal.fire({
      title: 'Delete group?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.service.deleteOptionalGroup(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.optionalGroups = this.optionalGroups.filter(g => g.id !== id);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting group:', e);
          Swal.fire('Error', 'Could not delete group.', 'error');
        },
      });
    });
  }

  addOptionalSubject(groupId: number): void {
    const name = (this.newOptionalSubjectName[groupId] || '').trim();
    if (!name) return;
    this.service.addOptionalSubject(groupId, name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (subj) => {
        // Immutable update — replace the group object so OnPush detects the change
        this.optionalGroups = this.optionalGroups.map(g =>
          g.id === groupId ? { ...g, subjects: [...g.subjects, subj] } : g
        );
        this.newOptionalSubjectName[groupId] = '';
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error adding optional subject:', e);
        Swal.fire('Error', 'Could not add subject.', 'error');
      },
    });
  }

  deleteOptionalSubject(groupId: number, subjectId: number): void {
    Swal.fire({
      title: 'Delete subject?',
      text: 'This will remove the subject from the group.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.service.deleteOptionalSubject(subjectId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.optionalGroups = this.optionalGroups.map(g =>
            g.id === groupId ? { ...g, subjects: g.subjects.filter(s => s.id !== subjectId) } : g
          );
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting optional subject:', e);
          Swal.fire('Error', 'Could not delete subject.', 'error');
        },
      });
    });
  }

  trackById(index: number, item: { id: number }): number { return item.id; }
  trackByIndex(index: number): number { return index; }
}
