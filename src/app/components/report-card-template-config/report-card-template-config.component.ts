import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  ReportCardTemplateService,
  ReportCardTemplate,
  ReportCardTemplateRequest,
  SectionType,
  TemplateSection,
  BrandingConfig
} from '../../services/report-card-template.service';
import { AssessmentGroupService, AssessmentGroup } from '../../services/assessment-group.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { SchoolService } from '../../services/school.service';
import { ToastService } from '../../services/toast.service';
import { AcademicSession } from '../../interfaces/academic-session';

// ── Section metadata ──────────────────────────────────────────────────────────

const ALL_SECTIONS: { type: SectionType; label: string; description: string }[] = [
  { type: 'SCHOOL_HEADER',      label: 'School Header',         description: 'School name, logo, address, affiliation number' },
  { type: 'STUDENT_INFO',       label: 'Student Information',   description: 'Name, ID, class, DOB, parents' },
  { type: 'MARKS_TABLE',        label: 'Marks Table',           description: 'Per-subject per-exam marks grid' },
  { type: 'ASSESSMENT_SUMMARY', label: 'Assessment Summary',    description: 'Weighted percentage, grade, rank' },
  { type: 'ATTENDANCE',         label: 'Attendance',            description: 'Working days, present days, percentage' },
  { type: 'CO_SCHOLASTIC',      label: 'Co-Scholastic',         description: 'Activities with grade checkboxes' },
  { type: 'TEACHER_REMARKS',    label: "Teacher's Remarks",     description: 'Handwritten remarks + signature field' },
  { type: 'PRINCIPAL_REMARKS',  label: "Principal's Remarks",   description: 'Handwritten remarks + signature field' },
  { type: 'PROMOTION_STATUS',   label: 'Result',                description: 'PASS / FAIL declaration' },
  { type: 'SIGNATURES',         label: 'Signatures & Seal',     description: 'Teacher, Principal, Parent, School Seal' },
];

// ── Gallery styles ────────────────────────────────────────────────────────────

export interface GalleryStyle {
  id: string;
  name: string;
  tagline: string;
  bestFor: string;
  description: string;
  primaryColor: string;
  suggestedName: string;
}

const GALLERY_STYLES: GalleryStyle[] = [
  {
    id: 'cbse',
    name: 'CBSE Standard',
    tagline: 'Most popular · Recommended',
    bestFor: 'CBSE-affiliated, Government, Kendriya Vidyalaya schools',
    description: 'Full-border tables, navy header, official government document style.',
    primaryColor: '#1a3a6b',
    suggestedName: 'CBSE Report Card',
  },
  {
    id: 'icse',
    name: 'ICSE Style',
    tagline: 'English-medium schools',
    bestFor: 'ICSE / ISC, private English-medium schools',
    description: 'Clean teal header, horizontal-rule tables, modern academic look.',
    primaryColor: '#0d5f5f',
    suggestedName: 'ICSE Report Card',
  },
  {
    id: 'primary',
    name: 'Primary School',
    tagline: 'Classes Nursery – 5',
    bestFor: 'Nursery to Class 5, activity-based schools',
    description: 'Larger text, grade-only format, activity sections, friendly layout.',
    primaryColor: '#4338ca',
    suggestedName: 'Primary Report Card',
  },
  {
    id: 'senior',
    name: 'Senior Secondary',
    tagline: 'Classes 11 & 12',
    bestFor: 'Classes 11–12 with Science / Commerce / Arts streams',
    description: 'Theory + Practical columns, stream grouping, board exam format.',
    primaryColor: '#7c2d2d',
    suggestedName: 'Senior Secondary Report Card',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Clean & modern',
    bestFor: 'IB schools, International schools, Premium institutions',
    description: 'Horizontal rules only, no colored fills, pure typographic layout.',
    primaryColor: '#1c1c1e',
    suggestedName: 'Report Card',
  },
];

// ── Theme presets (Phase D) ───────────────────────────────────────────────────

export interface ThemePreset {
  label: string;
  color: string;
}

const THEME_PRESETS_BY_STYLE: Record<string, ThemePreset[]> = {
  cbse:    [
    { label: 'Navy Blue',   color: '#1a3a6b' },
    { label: 'Maroon',      color: '#7c2020' },
    { label: 'Forest Green',color: '#1a5c2a' },
    { label: 'Charcoal',    color: '#2c2c2c' },
  ],
  icse:    [
    { label: 'Deep Teal',   color: '#0d5f5f' },
    { label: 'Navy',        color: '#1a3a6b' },
    { label: 'Charcoal',    color: '#2c2c2c' },
  ],
  primary: [
    { label: 'Indigo',      color: '#4338ca' },
    { label: 'Royal Blue',  color: '#1d4ed8' },
    { label: 'Emerald',     color: '#065f46' },
  ],
  senior:  [
    { label: 'Maroon',      color: '#7c2d2d' },
    { label: 'Navy',        color: '#1a3a6b' },
    { label: 'Charcoal',    color: '#2c2c2c' },
  ],
  minimal: [
    { label: 'Charcoal',    color: '#1c1c1e' },
  ],
};

// ── Section row ───────────────────────────────────────────────────────────────

interface SectionRow {
  sectionType: SectionType;
  label: string;
  description: string;
  enabled: boolean;
  displayOrder: number;
  configJson: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-report-card-template-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-card-template-config.component.html',
  styleUrl: './report-card-template-config.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCardTemplateConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  templates: ReportCardTemplate[] = [];
  assessmentGroups: AssessmentGroup[] = [];
  sessions: AcademicSession[] = [];

  loading = true;
  saving = false;

  // ── Gallery ──────────────────────────────────────────────────────────
  readonly galleryStyles: GalleryStyle[] = GALLERY_STYLES;
  selectedGalleryStyle: GalleryStyle | null = null;

  // ── Create/Edit form ──────────────────────────────────────────────
  showForm = false;
  editingId: number | null = null;
  form: ReportCardTemplateRequest = this.blankForm();

  // ── Theme preset picker (shown inside branding editor when style is known) ──
  get themePresets(): ThemePreset[] {
    const styleId = this.selectedGalleryStyle?.id ?? this.editingBrandingFor?.description ?? '';
    return THEME_PRESETS_BY_STYLE[styleId] ?? THEME_PRESETS_BY_STYLE['cbse'];
  }

  // ── Section editor ─────────────────────────────────────────────────
  editingSectionsFor: ReportCardTemplate | null = null;
  sectionRows: SectionRow[] = [];
  savingSections = false;

  // ── Branding editor ─────────────────────────────────────────────────
  editingBrandingFor: ReportCardTemplate | null = null;
  brandingForm: BrandingConfig = this.defaultBranding();
  savingBranding = false;

  // Session filter for loading groups
  selectedSession = '';

  constructor(
    private rcService: ReportCardTemplateService,
    private groupService: AssessmentGroupService,
    private sessionService: AcademicSessionService,
    private schoolService: SchoolService,
    private toast: ToastService,
    readonly cdr: ChangeDetectorRef,   // public so template can call markForCheck on section toggle
  ) {}

  ngOnInit(): void {
    this.sessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        const current = sessions.find(s => s.current);
        this.selectedSession = current?.label ?? sessions[0]?.label ?? '';
        this.loadGroups();
      }
    });
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ──────────────────────────────────────────────────

  private loadTemplates(): void {
    this.loading = true;
    this.rcService.getTemplates().pipe(takeUntil(this.destroy$)).subscribe({
      next: (templates) => {
        this.templates = templates;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Gallery ───────────────────────────────────────────────────────

  useGalleryStyle(style: GalleryStyle): void {
    this.selectedGalleryStyle = style;
    this.editingId = null;
    this.form = {
      ...this.blankForm(),
      name: style.suggestedName,
      brandingJson: JSON.stringify({ ...this.defaultBranding(), primaryColor: style.primaryColor }),
    };
    this.showForm = true;
    this.cdr.markForCheck();
    // Scroll form into view
    setTimeout(() => document.querySelector('.rct-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  // ── Create / Edit ─────────────────────────────────────────────────

  openEdit(t: ReportCardTemplate): void {
    this.editingId = t.id;
    this.selectedGalleryStyle = null;
    this.form = {
      name: t.name,
      description: t.description ?? '',
      assessmentGroupId: t.assessmentGroupId,
      gradingOverride: t.gradingOverride ?? '',
      isDefault: t.isDefault,
      brandingJson: t.brandingJson,
    };
    this.showForm = true;
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.selectedGalleryStyle = null;
    this.cdr.markForCheck();
  }

  saveTemplate(): void {
    if (!this.form.name?.trim() || !this.form.assessmentGroupId) {
      this.toast.error('Validation', 'Name and Assessment Group are required.');
      return;
    }
    this.saving = true;
    const req: ReportCardTemplateRequest = {
      ...this.form,
      gradingOverride: this.form.gradingOverride || undefined,
    };
    const obs = this.editingId
      ? this.rcService.updateTemplate(this.editingId, req)
      : this.rcService.createTemplate(req);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(this.editingId ? 'Template updated' : 'Template created');
        this.showForm = false;
        this.saving = false;
        this.editingId = null;
        this.selectedGalleryStyle = null;
        this.loadTemplates();
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.toast.error('Error', e.error?.message ?? 'Failed to save template.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Theme preset (inside branding editor) ─────────────────────────

  applyThemePreset(color: string): void {
    this.brandingForm = { ...this.brandingForm, primaryColor: color };
    this.cdr.markForCheck();
  }

  // ── Delete ────────────────────────────────────────────────────────

  async deleteTemplate(t: ReportCardTemplate): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: 'Delete Template',
      message: `Delete "${t.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.rcService.deleteTemplate(t.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Template deleted');
        this.loadTemplates();
        this.cdr.markForCheck();
      },
      error: (e) => this.toast.error('Error', e.error?.message ?? 'Failed to delete.')
    });
  }

  // ── Section editor ─────────────────────────────────────────────────

  openSectionEditor(t: ReportCardTemplate): void {
    this.editingSectionsFor = t;
    const existingByType = new Map(t.sections.map(s => [s.sectionType, s]));
    this.sectionRows = ALL_SECTIONS.map((meta, idx) => {
      const existing = existingByType.get(meta.type);
      return {
        sectionType: meta.type,
        label: meta.label,
        description: meta.description,
        enabled: existing ? existing.enabled : true,
        displayOrder: existing ? existing.displayOrder : idx,
        configJson: existing?.configJson ?? '',
      };
    });
    this.sectionRows.sort((a, b) => a.displayOrder - b.displayOrder);
    this.cdr.markForCheck();
  }

  closeSectionEditor(): void {
    this.editingSectionsFor = null;
    this.cdr.markForCheck();
  }

  moveSectionUp(idx: number): void {
    if (idx === 0) return;
    [this.sectionRows[idx - 1], this.sectionRows[idx]] = [this.sectionRows[idx], this.sectionRows[idx - 1]];
    this.reorderDisplayOrders();
    this.cdr.markForCheck();
  }

  moveSectionDown(idx: number): void {
    if (idx === this.sectionRows.length - 1) return;
    [this.sectionRows[idx], this.sectionRows[idx + 1]] = [this.sectionRows[idx + 1], this.sectionRows[idx]];
    this.reorderDisplayOrders();
    this.cdr.markForCheck();
  }

  private reorderDisplayOrders(): void {
    this.sectionRows.forEach((s, i) => s.displayOrder = i);
  }

  saveSections(): void {
    if (!this.editingSectionsFor) return;
    this.savingSections = true;
    this.rcService.updateSections(this.editingSectionsFor.id, {
      sections: this.sectionRows.map(s => ({
        sectionType: s.sectionType,
        enabled: s.enabled,
        displayOrder: s.displayOrder,
        configJson: s.configJson || undefined,
      }))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.templates.findIndex(t => t.id === updated.id);
        if (idx !== -1) this.templates[idx] = updated;
        this.toast.success('Sections saved');
        this.savingSections = false;
        this.editingSectionsFor = null;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.toast.error('Error', e.error?.message ?? 'Failed to save sections.');
        this.savingSections = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Height % of the A4 preview for each section type */
  sectionPreviewHeight(type: SectionType): string {
    const heights: Partial<Record<SectionType, number>> = {
      SCHOOL_HEADER:      11,
      STUDENT_INFO:       13,
      MARKS_TABLE:        28,
      ASSESSMENT_SUMMARY:  6,
      ATTENDANCE:          5,
      CO_SCHOLASTIC:      10,
      TEACHER_REMARKS:     7,
      PRINCIPAL_REMARKS:   7,
      PROMOTION_STATUS:    5,
      SIGNATURES:          8,
    };
    return (heights[type] ?? 5) + '%';
  }

  /** Primary color from the template's brandingJson (for preview bar) */
  templateColor(t: ReportCardTemplate): string {
    if (!t.brandingJson) return '#1a3a6b';
    try { return JSON.parse(t.brandingJson).primaryColor ?? '#1a3a6b'; } catch { return '#1a3a6b'; }
  }

  // ── Branding editor ───────────────────────────────────────────────

  openBrandingEditor(t: ReportCardTemplate): void {
    this.editingBrandingFor = t;
    if (t.brandingJson) {
      try { this.brandingForm = { ...this.defaultBranding(), ...JSON.parse(t.brandingJson) }; }
      catch { this.brandingForm = this.defaultBranding(); }
    } else {
      this.brandingForm = this.defaultBranding();
    }
    this.cdr.markForCheck();
  }

  closeBrandingEditor(): void {
    this.editingBrandingFor = null;
    this.cdr.markForCheck();
  }

  saveBranding(): void {
    if (!this.editingBrandingFor) return;
    this.savingBranding = true;
    const req: ReportCardTemplateRequest = {
      name:              this.editingBrandingFor.name,
      description:       this.editingBrandingFor.description,
      assessmentGroupId: this.editingBrandingFor.assessmentGroupId,
      gradingOverride:   this.editingBrandingFor.gradingOverride,
      isDefault:         this.editingBrandingFor.isDefault,
      brandingJson:      JSON.stringify(this.brandingForm),
    };
    this.rcService.updateTemplate(this.editingBrandingFor.id, req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.templates.findIndex(t => t.id === updated.id);
          if (idx !== -1) this.templates[idx] = updated;
          this.toast.success('Theme saved');
          this.savingBranding = false;
          this.editingBrandingFor = null;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.toast.error('Error', e.error?.message ?? 'Failed to save theme.');
          this.savingBranding = false;
          this.cdr.markForCheck();
        }
      });
  }

  private defaultBranding(): BrandingConfig {
    return {
      primaryColor:    '#1a3a6b',
      showWatermark:   false,
      watermarkText:   '',
      footerText:      '',
      showCgpa:        true,
      showGradePoints: false,
    };
  }

  parseBrandingJson(json: string | undefined): BrandingConfig {
    if (!json) return {};
    try { return JSON.parse(json); } catch { return {}; }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private blankForm(): ReportCardTemplateRequest {
    return { name: '', description: '', assessmentGroupId: 0, gradingOverride: '', isDefault: false };
  }

  trackById(_i: number, t: ReportCardTemplate): number { return t.id; }
  trackByType(_i: number, s: SectionRow): string { return s.sectionType; }
  trackByIndex(i: number): number { return i; }

  countEnabled(t: ReportCardTemplate): number {
    return t.sections.filter(s => s.enabled).length;
  }

  sectionLabel(type: string): string {
    return ALL_SECTIONS.find(s => s.type === type)?.label ?? type;
  }

  loadGroups(): void {
    if (!this.selectedSession) return;
    this.groupService.getGroups(this.selectedSession, '').pipe(takeUntil(this.destroy$)).subscribe({
      next: (groups) => { this.assessmentGroups = groups; this.cdr.markForCheck(); }
    });
  }

  get gradingOptions() { return ['', 'CBSE', 'LETTER', 'PERCENTAGE']; }
  get gradingLabels(): Record<string, string> {
    return { '': 'School default', 'CBSE': 'CBSE Grades', 'LETTER': 'Letter Grades', 'PERCENTAGE': 'Percentage' };
  }

  /** Dummy array for ngFor loops in gallery mini-doc preview */
  readonly fakeRows = [0, 1, 2, 3];
}
