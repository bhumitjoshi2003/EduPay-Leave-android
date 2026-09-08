import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { PaymentTrackerComponent, MonthViewModel } from './fees.component';
import { FeesService } from '../../services/fees.service';
import { StudentService } from '../../services/student.service';
import { AuthService } from '../../auth/auth.service';
import { AttendanceService } from '../../services/attendance.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { FeesCalculationService } from '../../services/fees-calculation.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { ParentPortalService } from '../../services/parent-portal.service';
import { StudentFee } from '../../interfaces/student-fee';
import { ManualPaymentRequest } from '../../interfaces/manual-payment-request';
import { CheckoutQuote } from '../../interfaces/checkout-quote';

/**
 * Fee UI regression fix (payment-mode/provenance + blank-form ₹0 confusion). Covers:
 * - paymentProvenanceLabel: the true funding source per month, not a hardcoded "Manual".
 * - markAsManuallyPaid: the selected payment mode is carried through into the request sent
 *   to the backend, and the action is guarded (never fires) when no month is selected.
 * - recalculateTotals (via toggleMonthSelection): totalAmountToPay comes from the backend
 *   checkout quote, never a client-side recomputation.
 *
 * Also covers the Phase 1B migration off locally-guessed "current academic year": before,
 * currentAcademicYear came from FeesCalculationService.getAcademicYear(new Date()) — a value
 * that depended on the real wall-clock date when a test ran, not on anything these tests
 * actually controlled. It only ever matched the '2026-2027' fixtures below by coincidence of
 * when this suite happened to run, and would have silently diverged once real time crossed
 * into the next academic year. currentAcademicYear now comes from a mocked
 * AcademicSessionService.getCurrentSession() call, making it fully deterministic.
 */
describe('PaymentTrackerComponent', () => {
  let component: PaymentTrackerComponent;
  let fixture: ComponentFixture<PaymentTrackerComponent>;
  let feesServiceSpy: jasmine.SpyObj<FeesService>;
  let schoolServiceSpy: jasmine.SpyObj<SchoolService>;
  let academicSessionServiceSpy: jasmine.SpyObj<AcademicSessionService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  const adminUser = {
    userId: 'admin1',
    role: 'ADMIN',
    name: 'Admin',
    className: null,
    schoolSlug: 'school-a',
  };

  function buildFee(
    month: number,
    overrides: Partial<StudentFee> = {},
  ): StudentFee {
    return {
      studentId: 'S1',
      className: '10',
      month,
      year: '2026-2027',
      paid: false,
      manuallyPaid: false,
      baseAmountDue: 5000,
      busFeeDue: 800,
      discountAmount: 0,
      snapshotStatus: 'COMPUTED',
      ...overrides,
    };
  }

  beforeEach(async () => {
    feesServiceSpy = jasmine.createSpyObj('FeesService', [
      'getDistinctYearsByStudentId',
      'getStudentFees',
      'getCheckoutQuote',
      'recordManualPayment',
      'getMonthFeeBreakdown',
    ]);
    feesServiceSpy.getDistinctYearsByStudentId.and.returnValue(
      of(['2026-2027']),
    );
    feesServiceSpy.getStudentFees.and.returnValue(
      of([buildFee(5), buildFee(6)]),
    );
    feesServiceSpy.getMonthFeeBreakdown.and.returnValue(of(null as any));

    schoolServiceSpy = jasmine.createSpyObj('SchoolService', ['getSettings']);
    schoolServiceSpy.getSettings.and.returnValue(
      of({ academicYearStartMonth: 7 } as any),
    );

    academicSessionServiceSpy = jasmine.createSpyObj('AcademicSessionService', ['getCurrentSession']);
    academicSessionServiceSpy.getCurrentSession.and.returnValue(
      of({ id: 1, label: '2026-2027', startDate: '2026-07-01', endDate: '2027-06-30', current: true }),
    );

    toastSpy = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
      'warning',
      'info',
      'confirm',
    ]);
    toastSpy.confirm.and.returnValue(Promise.resolve(true));

    const studentServiceSpy = jasmine.createSpyObj('StudentService', [
      'getStudent',
    ]);
    studentServiceSpy.getStudent.and.returnValue(
      of({ name: 'Jordan', className: '10' } as any),
    );

    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getUserRole',
      'getUserId',
    ]);
    authServiceSpy.getUserRole.and.returnValue('ADMIN');

    const attendanceServiceSpy = jasmine.createSpyObj('AttendanceService', [
      'getTotalUnappliedLeaveCount',
    ]);
    attendanceServiceSpy.getTotalUnappliedLeaveCount.and.returnValue(of(0));

    const authStateServiceSpy = jasmine.createSpyObj('AuthStateService', [
      'getUserId',
      'getUser',
      'getUserRole',
    ]);
    authStateServiceSpy.getUserId.and.returnValue('admin1');
    authStateServiceSpy.getUser.and.returnValue(adminUser as any);
    // ParentChildContextComponent (rendered unconditionally at the top of fees.component.html)
    // calls this at construction time regardless of role — was missing from this spy entirely,
    // so fixture.detectChanges() threw "authState.getUserRole is not a function" in every test
    // that rendered the template, independent of anything this Phase 1B change touches.
    authStateServiceSpy.getUserRole.and.returnValue('ADMIN');

    // Real constructor dependency of PaymentTrackerComponent (only exercised for role ===
    // 'PARENT', never hit by these ADMIN-role tests) that was previously left unmocked —
    // Angular then tried to construct the real ParentPortalService, which needs HttpClient,
    // which isn't provided here either, so every test in this file failed at TestBed
    // construction with "No provider for HttpClient!" before it could even run.
    const parentPortalServiceSpy = jasmine.createSpyObj('ParentPortalService', ['getMyProfile']);

    await TestBed.configureTestingModule({
      imports: [PaymentTrackerComponent],
      providers: [
        FeesCalculationService, // pure calculation service, no HTTP deps — use the real one
        { provide: ActivatedRoute, useValue: { params: of({}) } },
        { provide: FeesService, useValue: feesServiceSpy },
        { provide: StudentService, useValue: studentServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: AttendanceService, useValue: attendanceServiceSpy },
        { provide: AuthStateService, useValue: authStateServiceSpy },
        {
          provide: LoggerService,
          useValue: jasmine.createSpyObj('LoggerService', [
            'error',
            'warn',
            'info',
          ]),
        },
        { provide: ToastService, useValue: toastSpy },
        { provide: SchoolService, useValue: schoolServiceSpy },
        { provide: AcademicSessionService, useValue: academicSessionServiceSpy },
        { provide: ParentPortalService, useValue: parentPortalServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentTrackerComponent);
    component = fixture.componentInstance;
  });

  // ── paymentProvenanceLabel ──────────────────────────────────────────────

  function monthWith(provenance: string | null | undefined): MonthViewModel {
    return {
      ...buildFee(1),
      monthNumber: 1,
      name: 'July',
      fee: 5000,
      busFee: 800,
      selected: false,
      amountUnavailable: false,
      paymentProvenance: provenance,
    };
  }

  it('shows the true mode for a manual CASH payment, not a generic "Manual" label', () => {
    expect(component.paymentProvenanceLabel(monthWith('CASH'))).toBe('Cash');
  });

  it('shows the true mode for a manual CHEQUE payment', () => {
    expect(component.paymentProvenanceLabel(monthWith('CHEQUE'))).toBe(
      'Cheque',
    );
  });

  it('shows the true mode for a manual UPI payment', () => {
    expect(component.paymentProvenanceLabel(monthWith('UPI'))).toBe('UPI');
  });

  it('labels a Razorpay-funded month "Razorpay", never "Manual"', () => {
    const label = component.paymentProvenanceLabel(monthWith('RAZORPAY'));
    expect(label).toBe('Razorpay');
    expect(label).not.toContain('Manual');
  });

  it('represents mixed funding truthfully as "Mixed" rather than picking one arbitrary mode', () => {
    expect(component.paymentProvenanceLabel(monthWith('MIXED'))).toBe('Mixed');
  });

  it('falls back to the generic "Paid" only when no provenance is available at all', () => {
    expect(component.paymentProvenanceLabel(monthWith(null))).toBe('Paid');
  });

  // ── markAsManuallyPaid: mode survives into the request; no-selection guard ──

  it('carries the selected payment mode through into the ManualPaymentRequest sent to the backend', () => {
    fixture.detectChanges(); // ngOnInit
    component.studentId = 'S1';
    component.studentName = 'Jordan';
    component.className = '10';
    component.session = '2026-2027';
    component.selectedYear = 2026;
    component.selectedMonthsByYear = { 2026: [5] };
    component.manualPaymentAmount = 5887;
    component.manualPaymentMode = 'CHEQUE';
    feesServiceSpy.recordManualPayment.and.returnValue(
      of({ message: 'ok', paymentId: 'p1' } as any),
    );

    component.markAsManuallyPaid();

    return fixture.whenStable().then(() => {
      expect(feesServiceSpy.recordManualPayment).toHaveBeenCalled();
      const sentRequest: ManualPaymentRequest =
        feesServiceSpy.recordManualPayment.calls.mostRecent().args[0];
      expect(sentRequest.paymentMode).toBe('CHEQUE');
    });
  });

  it('never calls the backend when no month is selected (no misleading ₹0 submission)', () => {
    fixture.detectChanges();
    component.studentId = 'S1';
    component.selectedYear = 2026;
    component.selectedMonthsByYear = { 2026: [] };
    component.manualPaymentAmount = 100;

    component.markAsManuallyPaid();

    expect(feesServiceSpy.recordManualPayment).not.toHaveBeenCalled();
    expect(toastSpy.warning).toHaveBeenCalled();
  });

  // ── recalculateTotals via toggleMonthSelection: authoritative backend total ──

  it('selecting an unpaid ₹5,800 month reflects the backend-computed total (school fee + late + platform fee), never a client recomputation', () => {
    fixture.detectChanges();
    component.studentId = 'S1';
    component.session = '2026-2027';
    component.selectedYear = 2026;
    const quote: CheckoutQuote = {
      studentId: 'S1',
      session: '2026-2027',
      months: [5],
      schoolFeeDue: 5800,
      lateFee: 0,
      platformFee: 87,
      totalAmount: 5887,
      unresolvedMonths: [],
    };
    feesServiceSpy.getCheckoutQuote.and.returnValue(of(quote));
    const month: MonthViewModel = {
      ...buildFee(5),
      monthNumber: 5,
      name: 'November',
      fee: 5000,
      busFee: 800,
      selected: false,
      amountUnavailable: false,
    };
    component.months = [month];

    component.toggleMonthSelection(month);

    return fixture.whenStable().then(() => {
      expect(component.totalAmountToPay).toBe(5887);
      expect(component.manualPaymentAmount).toBe(5887);
    });
  });

  it('does not request fees with an empty session for a newly registered student', () => {
    feesServiceSpy.getDistinctYearsByStudentId.and.returnValue(of([]));
    feesServiceSpy.getStudentFees.calls.reset();

    fixture.detectChanges();

    expect(component.feesLoaded).toBeTrue();
    expect(component.months).toEqual([]);
    expect(feesServiceSpy.getStudentFees).not.toHaveBeenCalled();
  });

  it('resets the total to ₹0 when the selection is cleared (expected empty state, not a bug)', () => {
    fixture.detectChanges();
    component.selectedYear = 2026;
    component.selectedMonthsByYear = { 2026: [] };
    (component as any).recalculateTotals();
    expect(component.totalAmountToPay).toBe(0);
    expect(component.manualPaymentAmount).toBe(0);
    expect(feesServiceSpy.getCheckoutQuote).not.toHaveBeenCalled();
  });

  // ── netAmountPaid: month-card paid-amount display bug fix ──────────────────
  // The card used to show manualPaymentReceived for any manuallyPaid row instead of the
  // authoritative StudentFees.amountPaid — understating MIXED-funded rows and not reflecting
  // partial refunds. netAmountPaid must always be the ledger-net amountPaid, never
  // manualPaymentReceived, regardless of source or refund state.

  function fundedMonth(overrides: Partial<StudentFee>): MonthViewModel {
    return {
      ...buildFee(1),
      monthNumber: 1,
      name: 'July',
      fee: 5000,
      busFee: 800,
      selected: false,
      amountUnavailable: false,
      ...overrides,
    };
  }

  it('one manual payment: netAmountPaid is the authoritative amountPaid', () => {
    const month = fundedMonth({
      paid: true,
      manuallyPaid: true,
      amountPaid: 5800,
      manualPaymentReceived: 5800,
    });
    expect(component.netAmountPaid(month)).toBe(5800);
  });

  it('one Razorpay payment: netAmountPaid is amountPaid, not affected by manualPaymentReceived being unset', () => {
    const month = fundedMonth({
      paid: true,
      manuallyPaid: false,
      amountPaid: 5800,
      manualPaymentReceived: undefined,
    });
    expect(component.netAmountPaid(month)).toBe(5800);
  });

  it('mixed manual + Razorpay funding: netAmountPaid is the full aggregate, not just the manual portion', () => {
    // e.g. ₹3000 paid manually (CASH) + ₹2800 paid via Razorpay = ₹5800 total net-allocated.
    // manualPaymentReceived only reflects the ₹3000 manual slice — using it here would
    // understate the row by ₹2800, exactly the bug being fixed.
    const month = fundedMonth({
      paid: true,
      manuallyPaid: true,
      amountPaid: 5800,
      manualPaymentReceived: 3000,
      paymentProvenance: 'MIXED',
    });
    expect(component.netAmountPaid(month)).toBe(5800);
    expect(component.netAmountPaid(month)).not.toBe(3000);
  });

  it('partial refund: netAmountPaid reflects the reduced net amount, not the original manual receipt', () => {
    // Originally paid ₹5800 manually; ₹2000 refunded — backend recomputes amountPaid to 3800
    // and flips paid to false since it no longer covers the due amount, but the row still has
    // real money in it and must show 3800, not the stale pre-refund manualPaymentReceived.
    const month = fundedMonth({
      paid: false,
      manuallyPaid: true,
      amountPaid: 3800,
      manualPaymentReceived: 3800,
      paymentProvenance: 'CASH',
    });
    expect(component.netAmountPaid(month)).toBe(3800);
  });

  it('fully refunded row: netAmountPaid is 0, and the card falls back to showing the amount due again', () => {
    // Backend's recomputeStudentFeesNetState floors amountPaid at 0 and flips paid/manuallyPaid
    // back to false once every allocation is fully reversed — the resulting correct state is
    // indistinguishable from "never paid," which is what should be shown.
    const month = fundedMonth({
      paid: false,
      manuallyPaid: false,
      amountPaid: 0,
      manualPaymentReceived: 0,
      paymentProvenance: null,
    });
    expect(component.netAmountPaid(month)).toBe(0);
  });

  it('never reads manualPaymentReceived when amountPaid is present, even if they disagree', () => {
    const month = fundedMonth({ amountPaid: 9999, manualPaymentReceived: 1 });
    expect(component.netAmountPaid(month)).toBe(9999);
  });

  it('treats a missing amountPaid (never touched by any payment) as 0, not undefined', () => {
    const month = fundedMonth({ amountPaid: undefined });
    expect(component.netAmountPaid(month)).toBe(0);
  });

  // ── Rendered month-card amount reflects netAmountPaid, end to end ──────────

  it('renders the true aggregate amount on the card for a mixed-funded month, not the manual-only slice', () => {
    fixture.detectChanges();
    const mixedMonth = fundedMonth({
      paid: true,
      manuallyPaid: true,
      amountPaid: 5800,
      manualPaymentReceived: 3000,
      paymentProvenance: 'MIXED',
    });
    component.months = [mixedMonth];
    fixture.detectChanges();

    const amountText =
      (fixture.nativeElement as HTMLElement).querySelector('.pt-month-amount')
        ?.textContent ?? '';
    expect(amountText).toContain('5,800');
    expect(amountText).not.toContain('3,000');
  });

  // ── Phase 1B: authoritative current session, not a locally-guessed one ─────

  describe('current-session sourcing', () => {
    it('uses the backend AcademicSession label, never a value computed from today\'s date and academicYearStartMonth', () => {
      fixture.detectChanges();

      expect(academicSessionServiceSpy.getCurrentSession).toHaveBeenCalled();
      expect(component.currentAcademicYear).toBe('2026-2027');
    });

    it('still loads the fee grid when the school has no current session configured', () => {
      academicSessionServiceSpy.getCurrentSession.and.returnValue(
        throwError(() => ({ error: 'No current academic session found.' })),
      );

      fixture.detectChanges();

      return fixture.whenStable().then(() => {
        expect(component.currentAcademicYear).toBe('');
        expect(component.feesLoaded).toBeTrue();
        expect(feesServiceSpy.getStudentFees).toHaveBeenCalled();
      });
    });

    it('suppresses "unpaid this month" warnings for a viewed session strictly after the authoritative current one (historical/future selection)', () => {
      fixture.detectChanges();
      component.role = 'STUDENT';
      component.currentAcademicYear = '2025-2026';
      component.session = '2026-2027'; // viewed session is after the real current one
      component.months = [
        { ...buildFee(5), monthNumber: 5, name: 'November', fee: 5000, busFee: 800, selected: false, amountUnavailable: false, paid: false } as MonthViewModel,
      ];

      component.checkAndDisplayFeeWarnings();

      expect(component.pastUnpaidMonthNames).toEqual([]);
      expect(component.unpaidCurrentMonthName).toBe('');
    });

    it('isLate never flags a month in a session strictly after the authoritative current one', () => {
      fixture.detectChanges();
      component.currentAcademicYear = '2025-2026';
      component.session = '2026-2027';
      const month = {
        ...buildFee(1), monthNumber: 1, name: 'July', fee: 5000, busFee: 800,
        selected: false, amountUnavailable: false, paid: false, manuallyPaid: false,
      } as MonthViewModel;

      expect(component.isLate(month)).toBeFalse();
    });

    it('isLate flags an unpaid month in a historical session strictly before the authoritative current one', () => {
      fixture.detectChanges();
      component.currentAcademicYear = '2026-2027';
      component.session = '2025-2026'; // a past session the user has navigated back to
      const month = {
        ...buildFee(1), monthNumber: 1, name: 'July', fee: 5000, busFee: 800,
        selected: false, amountUnavailable: false, paid: false, manuallyPaid: false,
      } as MonthViewModel;

      expect(component.isLate(month)).toBeTrue();
    });
  });
});
