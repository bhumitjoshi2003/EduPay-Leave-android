import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SchoolService, SchoolSettings, SchoolEntitlementSummary, PlanDetail, SubscriptionHistoryItem } from '../../services/school.service';
import { TenantService } from '../../services/tenant.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import { NotificationChannelService } from '../../services/notification-channel.service';
import { NotificationChannel } from '../../interfaces/notification-channel';
import { AcademicSessionService } from '../../services/academic-session.service';
import { AcademicSession } from '../../interfaces/academic-session';

@Component({
  selector: 'app-school-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './school-settings.component.html',
  styleUrl: './school-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  role = '';
  settings: SchoolSettings | null = null;
  loading = false;
  saving = false;
  savingRazorpay = false;

  // Edit mode for general settings
  isEditing = false;
  editForm: Partial<SchoolSettings> = {};

  activeTab: 'general' | 'razorpay' | 'features' | 'subscription' | 'channels' = 'general';
  razorpayKeyId = '';
  razorpayKeySecret = '';

  // Features tab
  featuresLoading = false;
  schoolFeatures: any[] = [];
  savingFeatureKey: string | null = null;

  // Subscription tab
  entitlementLoading = false;
  entitlement: SchoolEntitlementSummary | null = null;
  availablePlans: PlanDetail[] = [];
  plansLoading = false;
  upgradingPlanId: number | null = null;
  billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  subscriptionHistory: SubscriptionHistoryItem[] = [];
  historyLoading = false;

  // Academic sessions
  sessions: AcademicSession[] = [];
  sessionsLoading = false;
  creatingSession = false;

  // Notification channels tab
  channelsLoading = false;
  notificationChannels: NotificationChannel[] = [];
  savingChannelType: string | null = null;

  // Logo upload
  logoPreviewUrl: string | null = null;
  logoFile: File | null = null;
  uploadingLogo = false;

  readonly boardTypes = ['CBSE', 'ICSE', 'STATE', 'IB', 'IGCSE', 'OTHER'];
  readonly gradingSystems = [
    { value: 'CBSE', label: 'CBSE (A1/A2/B1…)' },
    { value: 'LETTER', label: 'Letter Grades (A+/A/B+…)' },
    { value: 'PERCENTAGE', label: 'Percentage Only' },
  ];
  readonly monthOptions = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' },   { value: 5, label: 'May' },       { value: 6, label: 'June' },
    { value: 7, label: 'July' },    { value: 8, label: 'August' },    { value: 9, label: 'September' },
    { value: 10, label: 'October' },{ value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];
  readonly allDayOptions = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  constructor(
    private schoolService: SchoolService,
    private authStateService: AuthStateService,
    public tenantService: TenantService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private logger: LoggerService,
    private notificationChannelService: NotificationChannelService,
    private academicSessionService: AcademicSessionService
  ) {}

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.loadSettings();
    this.loadEntitlement();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSettings(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.schoolService.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => {
        this.settings = s;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load school settings', e);
        this.toast.error('Error', 'Failed to load school settings.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startEdit(): void {
    if (!this.settings) return;
    this.editForm = {
      name: this.settings.name,
      slug: this.settings.slug,
      address: this.settings.address,
      city: this.settings.city,
      state: this.settings.state,
      pincode: this.settings.pincode,
      phone: this.settings.phone,
      email: this.settings.email,
      website: this.settings.website,
      boardType: this.settings.boardType,
      academicYearStartMonth: this.settings.academicYearStartMonth ?? 4,
      workingDays: this.settings.workingDays ?? 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY',
      periodsPerDay: this.settings.periodsPerDay ?? 8,
      gradingSystem: this.settings.gradingSystem ?? 'CBSE',
    };
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editForm = {};
  }

  saveSettings(): void {
    if (!this.editForm.name?.trim()) {
      this.toast.error('Validation', 'School name is required.');
      return;
    }
    if (this.editForm.phone && !/^\d{10}$/.test(this.editForm.phone.trim())) {
      this.toast.warning('Validation', 'Phone number must be exactly 10 digits.');
      return;
    }
    if (this.editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editForm.email.trim())) {
      this.toast.warning('Validation', 'Please enter a valid email address.');
      return;
    }
    if (this.editForm.pincode && !/^\d{6}$/.test(this.editForm.pincode.trim())) {
      this.toast.warning('Validation', 'Pincode must be exactly 6 digits.');
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    this.schoolService.updateSettings(this.editForm).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.settings = updated;
        this.isEditing = false;
        this.editForm = {};
        this.saving = false;
        this.toast.success('Saved', 'School settings updated successfully.');
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to save school settings', e);
        this.toast.error('Error', 'Failed to save settings. Please try again.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  get gradingSystemLabel(): string {
    const found = this.gradingSystems.find(g => g.value === this.settings?.gradingSystem);
    return found?.label ?? this.settings?.gradingSystem ?? 'CBSE';
  }

  get academicYearStartLabel(): string {
    const m = this.settings?.academicYearStartMonth;
    const found = this.monthOptions.find(o => o.value === m);
    return found?.label ?? 'April';
  }

  // ── Working days helpers ─────────────────────────────────────────────────

  isWorkingDay(day: string): boolean {
    const days = (this.editForm.workingDays ?? '').split(',').map(d => d.trim().toUpperCase());
    return days.includes(day.toUpperCase());
  }

  toggleWorkingDay(day: string): void {
    const days = (this.editForm.workingDays ?? '').split(',').map(d => d.trim().toUpperCase()).filter(d => d);
    const idx = days.indexOf(day.toUpperCase());
    if (idx >= 0) {
      days.splice(idx, 1);
    } else {
      days.push(day.toUpperCase());
      days.sort((a, b) => this.allDayOptions.indexOf(a) - this.allDayOptions.indexOf(b));
    }
    this.editForm.workingDays = days.join(',');
  }

  saveRazorpayKeys(): void {
    if (!this.razorpayKeyId.trim() || !this.razorpayKeySecret.trim()) {
      this.toast.error('Validation', 'Both Razorpay Key ID and Key Secret are required.');
      return;
    }
    this.savingRazorpay = true;
    this.cdr.markForCheck();
    this.schoolService.updateRazorpayKeys(this.razorpayKeyId.trim(), this.razorpayKeySecret.trim())
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.razorpayKeySecret = '';
          this.savingRazorpay = false;
          if (this.settings) this.settings.razorpayConfigured = true;
          this.toast.success('Saved', 'Razorpay keys updated successfully.');
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Failed to save Razorpay keys', e);
          this.toast.error('Error', 'Failed to save Razorpay keys. Please try again.');
          this.savingRazorpay = false;
          this.cdr.markForCheck();
        }
      });
  }

  onTabChange(tab: 'general' | 'razorpay' | 'features' | 'subscription' | 'channels'): void {
    this.activeTab = tab;
    if (tab === 'subscription') {
      this.loadEntitlement();
      this.loadAvailablePlans();
    }
  }

  loadFeatures(): void {
    if (this.schoolFeatures.length || this.featuresLoading) return;
    this.featuresLoading = true;
    this.cdr.markForCheck();
    this.schoolService.getSchoolFeatures().pipe(takeUntil(this.destroy$)).subscribe({
      next: (features) => {
        this.schoolFeatures = features;
        this.featuresLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load school features', e);
        this.toast.error('Error', 'Failed to load features.');
        this.featuresLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleFeatureOverride(feature: any): void {
    if (feature.isAlwaysOn || !feature.planGranted) return;
    const newState: 'DEFAULT' | 'DISABLED' = feature.overrideState === 'DISABLED' ? 'DEFAULT' : 'DISABLED';
    this.savingFeatureKey = feature.featureKey;
    this.cdr.markForCheck();
    this.schoolService.setFeatureOverride(feature.featureKey, newState).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        feature.overrideState = newState;
        feature.effectivelyOn = newState !== 'DISABLED';
        this.savingFeatureKey = null;
        this.toast.success('Saved', `Feature ${newState === 'DISABLED' ? 'disabled' : 'restored'}.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to set feature override', e);
        this.toast.error('Error', 'Failed to update feature.');
        this.savingFeatureKey = null;
        this.cdr.markForCheck();
      }
    });
  }

  loadAvailablePlans(): void {
    if (this.availablePlans.length || this.plansLoading) return;
    this.plansLoading = true;
    this.cdr.markForCheck();
    this.schoolService.getPublicPlans().pipe(takeUntil(this.destroy$)).subscribe({
      next: (plans) => {
        this.availablePlans = plans;
        this.plansLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.plansLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startUpgrade(plan: PlanDetail): void {
    if (this.upgradingPlanId) return;
    const price = this.billingCycle === 'ANNUAL' ? plan.annualPricePaise : plan.monthlyPricePaise;
    if (!price || price <= 0) {
      this.toast.info('Free Plan', 'Contact support to activate this plan.');
      return;
    }
    this.upgradingPlanId = plan.id;
    this.cdr.markForCheck();
    this.schoolService.createUpgradeOrder(plan.id, this.billingCycle).pipe(takeUntil(this.destroy$)).subscribe({
      next: (order) => this.openRazorpay(order, plan),
      error: (err) => {
        const msg = err?.error;
        this.toast.error('Error', typeof msg === 'string' ? msg : 'Failed to create payment order.');
        this.upgradingPlanId = null;
        this.cdr.markForCheck();
      }
    });
  }

  private openRazorpay(order: any, plan: PlanDetail): void {
    this.loadRazorpayScript().then(() => {
      const options = {
        key: order.razorpayKey,
        amount: order.amount,
        currency: 'INR',
        name: 'Edunexify',
        description: `${plan.name} Plan — ${this.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}`,
        order_id: order.orderId,
        handler: (response: any) => this.verifyUpgrade(response, plan.id),
        modal: { ondismiss: () => { this.upgradingPlanId = null; this.cdr.markForCheck(); } },
        theme: { color: '#1d4ed8' }
      };
      new (window as any).Razorpay(options).open();
    }).catch(() => {
      this.toast.error('Error', 'Failed to load payment gateway. Please try again.');
      this.upgradingPlanId = null;
      this.cdr.markForCheck();
    });
  }

  private verifyUpgrade(response: any, planId: number): void {
    const payload = {
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_order_id:   response.razorpay_order_id,
      razorpay_signature:  response.razorpay_signature,
      planId:              String(planId),
      billingCycle:        this.billingCycle,
    };
    this.schoolService.verifyUpgradePayment(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Upgraded!', 'Your subscription has been activated successfully.');
        this.upgradingPlanId = null;
        this.entitlement = null;
        this.entitlementLoading = false; // reset guard so force reload works
        this.loadEntitlement(true);
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Verification Failed', 'Payment received but activation failed. Please contact support with your payment ID.');
        this.upgradingPlanId = null;
        this.cdr.markForCheck();
      }
    });
  }

  private loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Razorpay) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  }

  featuresByCategory(): { category: string; features: any[] }[] {
    const map = new Map<string, any[]>();
    for (const f of this.schoolFeatures) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return Array.from(map.entries()).map(([category, features]) => ({ category, features }));
  }

  loadEntitlement(force = false): void {
    if (!force && (this.entitlement || this.entitlementLoading)) return;
    this.entitlementLoading = true;
    this.cdr.markForCheck();
    this.schoolService.getEntitlement().pipe(takeUntil(this.destroy$)).subscribe({
      next: (e) => {
        this.entitlement = e;
        this.entitlementLoading = false;
        this.cdr.markForCheck();
        this.loadSubscriptionHistory(force);
      },
      error: (err: any) => {
        this.logger.error('Failed to load entitlement', err);
        this.toast.error('Error', 'Failed to load subscription data.');
        this.entitlementLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadSubscriptionHistory(force = false): void {
    if (!force && (this.subscriptionHistory.length || this.historyLoading)) return;
    this.historyLoading = true;
    this.cdr.markForCheck();
    this.schoolService.getSubscriptionHistory().pipe(takeUntil(this.destroy$)).subscribe({
      next: (history) => {
        this.subscriptionHistory = history;
        this.historyLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.historyLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  eventTypeLabel(eventType: string): string {
    const labels: Record<string, string> = {
      TRIAL_STARTED:   'Trial Started',
      PLAN_ASSIGNED:   'Plan Assigned',
      PLAN_UPDATED:    'Plan Updated',
      PAYMENT_SUCCESS: 'Payment Successful',
      STATUS_CHANGED:  'Status Changed',
    };
    return labels[eventType] ?? eventType;
  }

  usagePct(current: number, max: number | null): number {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
  }

  usageBarColor(pct: number, softPct: number | null, hardPct: number | null): string {
    const soft = softPct ?? 90;
    const hard = hardPct ?? 105;
    if (pct >= hard) return '#dc2626';
    if (pct >= soft) return '#d97706';
    return '#059669';
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.warning('Invalid File', 'Please select an image file (JPG, PNG, etc.).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.toast.warning('File Too Large', 'Logo must be under 10 MB.');
      return;
    }

    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreviewUrl = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  cancelLogoUpload(): void {
    this.logoFile = null;
    this.logoPreviewUrl = null;
    this.cdr.markForCheck();
  }

  uploadLogo(): void {
    if (!this.logoFile) return;
    this.uploadingLogo = true;
    this.cdr.markForCheck();

    this.schoolService.uploadLogo(this.logoFile).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (this.settings) this.settings.logoUrl = res.logoUrl;
        this.logoFile = null;
        this.logoPreviewUrl = null;
        this.uploadingLogo = false;
        this.toast.success('Logo Updated', 'School logo has been uploaded successfully.');
        this.cdr.markForCheck();
        // Refresh TenantService cache so the branded login screen shows the new logo
        const slug = this.tenantService.slug;
        if (slug) {
          this.tenantService.lookupSchool(slug).then(info => {
            if (info) this.tenantService.setSchool(slug, info);
          });
        }
      },
      error: (e) => {
        this.logger.error('Failed to upload school logo', e);
        this.toast.error('Upload Failed', e?.error?.message || 'Could not upload logo. Please try again.');
        this.uploadingLogo = false;
        this.cdr.markForCheck();
      }
    });
  }

  getInitials(name?: string | null): string {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get isSuperAdmin(): boolean {
    return this.role === 'SUPER_ADMIN';
  }

  // ── Notification Channels ──────────────────────────────────────────
  loadChannels(): void {
    if (this.notificationChannels.length > 0) return;
    this.channelsLoading = true;
    this.notificationChannelService.getChannels().pipe(takeUntil(this.destroy$)).subscribe({
      next: channels => {
        this.notificationChannels = channels;
        this.channelsLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.logger.error('Failed to load notification channels', err);
        this.channelsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleChannel(channel: NotificationChannel): void {
    this.savingChannelType = channel.channelType;
    const updated: NotificationChannel = { ...channel, enabled: !channel.enabled };
    this.notificationChannelService.upsertChannel(updated).pipe(takeUntil(this.destroy$)).subscribe({
      next: saved => {
        const idx = this.notificationChannels.findIndex(c => c.channelType === saved.channelType);
        if (idx >= 0) this.notificationChannels[idx] = saved;
        this.savingChannelType = null;
        this.cdr.markForCheck();
      },
      error: err => {
        this.logger.error('Failed to toggle channel', err);
        this.toast.error('Error', 'Failed to update notification channel.');
        this.savingChannelType = null;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Academic Sessions ──────────────────────────────────────────────
  loadSessions(): void {
    this.sessionsLoading = true;
    this.cdr.markForCheck();
    this.academicSessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.sessionsLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load academic sessions', e);
        this.sessionsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  createNextSession(): void {
    const startMonth = this.settings?.academicYearStartMonth || 4;
    let nextStartYear: number;

    if (this.sessions.length === 0) {
      const now = new Date();
      nextStartYear = (now.getMonth() + 1) >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
    } else {
      const sorted = [...this.sessions].sort((a, b) => a.label.localeCompare(b.label));
      const lastLabel = sorted[sorted.length - 1].label;
      nextStartYear = parseInt(lastLabel.split('-')[0]) + 1;
    }

    const label = `${nextStartYear}-${nextStartYear + 1}`;
    if (this.sessions.some(s => s.label === label)) {
      this.toast.warning('Exists', `Session ${label} already exists.`);
      return;
    }

    const startDate = `${nextStartYear}-${String(startMonth).padStart(2, '0')}-01`;
    const endDt = new Date(nextStartYear + 1, startMonth - 1, 0);
    const endDate = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}`;

    this.creatingSession = true;
    this.cdr.markForCheck();
    this.academicSessionService.createSession({
      label, startDate, endDate, current: this.sessions.length === 0
    } as any).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Created', `Session ${label} created.`);
        this.creatingSession = false;
        this.loadSessions();
      },
      error: (e) => {
        this.logger.error('Failed to create session', e);
        const msg = typeof e?.error === 'string' ? e.error : e?.error?.message;
        this.toast.error('Error', msg || 'Failed to create session.');
        this.creatingSession = false;
        this.cdr.markForCheck();
      }
    });
  }

  setCurrentSession(sessionId: number): void {
    this.academicSessionService.setCurrentSession(sessionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Updated', 'Current session updated.');
        this.loadSessions();
      },
      error: (e) => {
        this.logger.error('Failed to set current session', e);
        this.toast.error('Error', 'Failed to update current session.');
      }
    });
  }

  async deleteSession(session: AcademicSession): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete Session ${session.label}?`,
      html: `<p>This will permanently delete the academic session <strong>${session.label}</strong> and all associated fee structure rules and student fee configs.</p><p>This action <strong>cannot be undone</strong>.</p>`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
      icon: 'danger',
      requiredInput: 'DELETE',
    });
    if (!confirmed) return;

    this.sessionsLoading = true;
    this.cdr.markForCheck();
    this.academicSessionService.deleteSession(session.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Deleted', `Session ${session.label} has been deleted.`);
        this.loadSessions();
      },
      error: (e) => {
        this.logger.error('Failed to delete session', e);
        const msg = typeof e?.error === 'string' ? e.error : e?.error?.message;
        this.toast.error('Error', msg || 'Failed to delete session.');
        this.sessionsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getChannelLabel(type: string): string {
    const labels: Record<string, string> = { PUSH: 'Push Notifications', SMS: 'SMS', EMAIL: 'Email', WHATSAPP: 'WhatsApp' };
    return labels[type] ?? type;
  }

  getChannelDescription(type: string): string {
    const desc: Record<string, string> = {
      PUSH: 'Send push notifications to mobile devices via Firebase Cloud Messaging.',
      SMS: 'Send SMS messages to parents and staff. Requires SMS provider configuration.',
      EMAIL: 'Send email notifications. Requires email service configuration.',
      WHATSAPP: 'Send WhatsApp messages via WhatsApp Business API.'
    };
    return desc[type] ?? '';
  }
}
