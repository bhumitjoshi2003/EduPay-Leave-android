import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Observable, Subject, takeUntil } from 'rxjs';
import { HomeworkClasswork, dueLabel, formatFileSize, homeworkClassLabel, homeworkKind } from '../../interfaces/homework';
import { HomeworkService } from '../../services/homework.service';
import { LoggerService } from '../../services/logger.service';

export type StudentHomeworkTab = 'today' | 'upcoming' | 'recent';

interface TabState {
  loaded: boolean;
  loading: boolean;
  failed: boolean;
  items: HomeworkClasswork[];
}

@Component({
  selector: 'app-student-homework',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './student-homework.component.html',
  styleUrl: './student-homework.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentHomeworkComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  readonly kind = homeworkKind;
  readonly due = dueLabel;
  readonly fileSize = formatFileSize;
  readonly classLabel = homeworkClassLabel;
  readonly tabs: { key: StudentHomeworkTab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Due soon' },
    { key: 'recent', label: 'Recent' },
  ];

  active: StudentHomeworkTab = 'today';
  state: Record<StudentHomeworkTab, TabState> = {
    today: { loaded: false, loading: false, failed: false, items: [] },
    upcoming: { loaded: false, loading: false, failed: false, items: [] },
    recent: { loaded: false, loading: false, failed: false, items: [] },
  };

  constructor(private homework: HomeworkService, private logger: LoggerService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.select('today');
  }

  select(tab: StudentHomeworkTab): void {
    this.active = tab;
    if (!this.state[tab].loaded && !this.state[tab].loading) this.load(tab);
  }

  load(tab: StudentHomeworkTab): void {
    const s = this.state[tab];
    s.loading = true;
    s.failed = false;
    this.cdr.markForCheck();
    this.source(tab).pipe(takeUntil(this.destroy$)).subscribe({
      next: items => {
        s.items = items;
        s.loaded = true;
        s.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.logger.error(`Homework (${tab}) load failed:`, error);
        s.loading = false;
        s.failed = true;
        this.cdr.markForCheck();
      },
    });
  }

  private source(tab: StudentHomeworkTab): Observable<HomeworkClasswork[]> {
    if (tab === 'upcoming') return this.homework.studentUpcoming();
    if (tab === 'recent') return this.homework.studentRecent();
    return this.homework.studentOn();
  }

  emptyText(tab: StudentHomeworkTab): string {
    if (tab === 'upcoming') return 'No homework is due soon.';
    if (tab === 'recent') return 'No earlier homework or classwork yet.';
    return 'Nothing posted for today yet.';
  }

  trackById(_: number, item: HomeworkClasswork): number {
    return item.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
