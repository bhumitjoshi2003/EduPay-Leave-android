import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { Capacitor } from '@capacitor/core';

import { SchoolService } from '../../services/school.service';
import {
  ReportCardTemplateService,
  ReportCardTemplate,
  ReportCardPublication,
  PublishRequest
} from '../../services/report-card-template.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import { AuthStateService } from '../../auth/auth-state.service';

@Component({
  selector: 'app-bulk-report-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './bulk-report-card.component.html',
  styleUrl: './bulk-report-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkReportCardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  classes: string[] = [];
  templates: ReportCardTemplate[] = [];

  selectedClass = '';
  selectedTemplateId: number | null = null;
  selectedSession = '';

  sessions: string[] = [];

  loadingClasses = true;
  loadingTemplates = true;
  downloading = false;

  // ── Publishing ────────────────────────────────────────────────────────
  publication: ReportCardPublication | null = null;
  loadingPubStatus = false;
  publishing = false;
  sendingEmails = false;
  isAdmin = false;

  isNative = Capacitor.isNativePlatform();

  constructor(
    private schoolService: SchoolService,
    private rcTemplateService: ReportCardTemplateService,
    private toast: ToastService,
    private logger: LoggerService,
    private authState: AuthStateService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authState.getUserRole() === 'ADMIN';
    this.buildSessions();
    this.loadClasses();
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildSessions(): void {
    const now = new Date();
    const year = now.getFullYear();
    for (let y = year; y >= year - 2; y--) {
      this.sessions.push(`${y}-${y + 1}`);
    }
    this.selectedSession = this.sessions[0];
  }

  private loadClasses(): void {
    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cls) => {
        this.classes = cls;
        this.loadingClasses = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load classes', e);
        this.loadingClasses = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadTemplates(): void {
    this.rcTemplateService.getTemplates().pipe(takeUntil(this.destroy$)).subscribe({
      next: (templates) => {
        this.templates = templates;
        const def = templates.find(t => t.isDefault);
        if (def) this.selectedTemplateId = def.id;
        else if (templates.length > 0) this.selectedTemplateId = templates[0].id;
        this.loadingTemplates = false;
        this.cdr.markForCheck();
        this.loadPublishStatus();
      },
      error: (e) => {
        this.logger.error('Failed to load templates', e);
        this.loadingTemplates = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSelectionChange(): void {
    this.publication = null;
    this.loadPublishStatus();
  }

  loadPublishStatus(): void {
    if (!this.selectedClass || !this.selectedTemplateId || !this.selectedSession) return;
    this.loadingPubStatus = true;
    this.cdr.markForCheck();

    this.rcTemplateService.getPublishStatus(
      this.selectedTemplateId!, this.selectedSession, this.selectedClass
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (pub) => {
        this.publication = pub;
        this.loadingPubStatus = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.publication = null;
        this.loadingPubStatus = false;
        this.cdr.markForCheck();
      }
    });
  }

  togglePublish(): void {
    if (!this.selectedClass || !this.selectedTemplateId || !this.selectedSession) return;
    this.publishing = true;
    this.cdr.markForCheck();

    if (this.publication?.published) {
      this.rcTemplateService.unpublish(this.selectedTemplateId!, this.selectedSession, this.selectedClass)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.publication = { published: false, templateId: this.selectedTemplateId!, session: this.selectedSession, className: this.selectedClass };
            this.toast.success('Unpublished', 'Report card access revoked for students.');
            this.publishing = false;
            this.cdr.markForCheck();
          },
          error: (e) => {
            this.toast.error('Error', e.error?.message ?? 'Failed to unpublish.');
            this.publishing = false;
            this.cdr.markForCheck();
          }
        });
    } else {
      const req: PublishRequest = {
        templateId: this.selectedTemplateId!,
        session: this.selectedSession,
        className: this.selectedClass
      };
      this.rcTemplateService.publish(req).pipe(takeUntil(this.destroy$)).subscribe({
        next: (pub) => {
          this.publication = pub;
          this.toast.success('Published', 'Students can now view their report cards.');
          this.publishing = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.toast.error('Error', e.error?.message ?? 'Failed to publish.');
          this.publishing = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  sendEmailBlast(): void {
    if (!this.selectedClass || !this.selectedTemplateId || !this.selectedSession) return;
    if (!this.publication?.published) {
      this.toast.warning('Not Published', 'Publish the report card first before sending emails.');
      return;
    }

    this.sendingEmails = true;
    this.cdr.markForCheck();

    const req: PublishRequest = {
      templateId: this.selectedTemplateId!,
      session: this.selectedSession,
      className: this.selectedClass
    };

    this.rcTemplateService.emailBlast(req).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.toast.success('Email Blast Initiated', res.message);
        this.sendingEmails = false;
        this.cdr.markForCheck();
        // Refresh pub status after a delay to pick up email count
        setTimeout(() => this.loadPublishStatus(), 3000);
      },
      error: (e) => {
        this.toast.error('Email Failed', e.error?.message ?? 'Failed to send emails.');
        this.sendingEmails = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Download ──────────────────────────────────────────────────────────

  get canDownload(): boolean {
    return !!this.selectedClass && !!this.selectedTemplateId && !!this.selectedSession && !this.downloading;
  }

  get selectedTemplateName(): string {
    return this.templates.find(t => t.id === this.selectedTemplateId)?.name ?? '';
  }

  downloadAll(): void {
    if (!this.canDownload) return;

    if (this.isNative) {
      this.toast.info('Not Available', 'Bulk PDF download is not supported in the app. Please use the web version.');
      return;
    }

    this.downloading = true;
    this.cdr.markForCheck();

    this.rcTemplateService.downloadBulkPdf(
      this.selectedTemplateId!,
      this.selectedSession,
      this.selectedClass
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const className = this.selectedClass.replace(/\s+/g, '_');
        const filename = `${className}_${this.selectedSession}_ReportCards.zip`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success('Downloaded', `${filename} saved successfully.`);
        this.downloading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Bulk PDF download failed', e);
        this.toast.error('Download Failed', 'Could not generate bulk PDF. Please try again.');
        this.downloading = false;
        this.cdr.markForCheck();
      }
    });
  }

  goBack(): void { this.router.navigate(['/dashboard']); }
}
