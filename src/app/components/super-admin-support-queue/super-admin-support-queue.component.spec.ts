import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SuperAdminSupportQueueComponent } from './super-admin-support-queue.component';
import { SupportTicketService } from '../../services/support-ticket.service';
import { SchoolService } from '../../services/school.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import { SupportTicketSummary } from '../../interfaces/support-ticket';

describe('SuperAdminSupportQueueComponent', () => {
  let fixture: ComponentFixture<SuperAdminSupportQueueComponent>;
  let component: SuperAdminSupportQueueComponent;
  let supportTicketService: jasmine.SpyObj<SupportTicketService>;
  let schoolService: jasmine.SpyObj<SchoolService>;
  let toast: jasmine.SpyObj<ToastService>;

  const summary = (overrides: Partial<SupportTicketSummary> = {}): SupportTicketSummary => ({
    id: 1, ticketNumber: 'EDX-1', schoolId: 1, schoolName: 'Indra Academy',
    reporterUserId: 'T1', reporterName: 'Ms Rao', reporterRole: 'TEACHER',
    category: 'OTHER', title: 'Something broke', status: 'OPEN', platform: 'ANDROID',
    createdAt: '2026-09-23T08:00:00', updatedAt: '2026-09-23T08:00:00',
    ...overrides,
  });

  beforeEach(() => {
    supportTicketService = jasmine.createSpyObj('SupportTicketService', ['allTickets', 'adminTicketDetail', 'updateStatus']);
    supportTicketService.allTickets.and.returnValue(of({ content: [summary()], number: 0, totalPages: 1, totalElements: 1, first: true, last: true }));
    schoolService = jasmine.createSpyObj('SchoolService', ['listAllSchools']);
    schoolService.listAllSchools.and.returnValue(of([{ id: 1, name: 'Indra Academy' } as any]));
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);

    TestBed.configureTestingModule({
      imports: [SuperAdminSupportQueueComponent],
      providers: [
        provideRouter([]),
        { provide: SupportTicketService, useValue: supportTicketService },
        { provide: SchoolService, useValue: schoolService },
        { provide: ToastService, useValue: toast },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
      ],
    });
    fixture = TestBed.createComponent(SuperAdminSupportQueueComponent);
    component = fixture.componentInstance;
  });

  it('loads every school\'s tickets and the school filter list on init', () => {
    fixture.detectChanges();
    expect(supportTicketService.allTickets).toHaveBeenCalledWith(0, 20, null, null, null);
    expect(component.tickets.length).toBe(1);
    expect(component.schools.length).toBe(1);
  });

  it('applying filters re-fetches with the selected status/category/school', () => {
    fixture.detectChanges();
    component.filterStatus = 'OPEN';
    component.filterCategory = 'ATTENDANCE';
    component.filterSchoolId = 1;

    component.applyFilters();

    expect(supportTicketService.allTickets).toHaveBeenCalledWith(0, 20, 'OPEN', 'ATTENDANCE', 1);
  });

  it('opening a ticket loads its full detail including the internal note', () => {
    fixture.detectChanges();
    supportTicketService.adminTicketDetail.and.returnValue(of({
      ...summary(), description: 'Full detail.', screenshotUrl: null, route: '/dashboard', appVersion: '1.0.0',
      internalNote: 'Escalated.',
    }));

    component.openTicket(component.tickets[0]);

    expect(supportTicketService.adminTicketDetail).toHaveBeenCalledWith(1);
    expect(component.detail?.internalNote).toBe('Escalated.');
    expect(component.statusDraft).toBe('OPEN');
  });

  it('saving a status change calls updateStatus and reflects the result in the row and drawer', () => {
    fixture.detectChanges();
    supportTicketService.adminTicketDetail.and.returnValue(of({
      ...summary(), description: '', screenshotUrl: null, route: null, appVersion: null, internalNote: null,
    }));
    component.openTicket(component.tickets[0]);
    supportTicketService.updateStatus.and.returnValue(of({
      ...summary({ status: 'IN_PROGRESS' }), description: '', screenshotUrl: null, route: null, appVersion: null,
      internalNote: 'Looking into it.',
    }));
    component.statusDraft = 'IN_PROGRESS';
    component.internalNoteDraft = 'Looking into it.';

    component.saveStatus();

    expect(supportTicketService.updateStatus).toHaveBeenCalledWith(1, { status: 'IN_PROGRESS', internalNote: 'Looking into it.' });
    expect(component.tickets[0].status).toBe('IN_PROGRESS');
    expect(toast.success).toHaveBeenCalled();
  });

  it('closeDetail clears the selected ticket', () => {
    fixture.detectChanges();
    supportTicketService.adminTicketDetail.and.returnValue(of({
      ...summary(), description: '', screenshotUrl: null, route: null, appVersion: null, internalNote: null,
    }));
    component.openTicket(component.tickets[0]);

    component.closeDetail();

    expect(component.selectedId).toBeNull();
    expect(component.detail).toBeNull();
  });
  it('shows friendly category and status labels in the table, filters and drawer, never raw enum values', () => {
    supportTicketService.allTickets.and.returnValue(of({
      content: [summary({ category: 'LOGIN_ACCOUNT', status: 'IN_PROGRESS' })],
      number: 0, totalPages: 1, totalElements: 1, first: true, last: true,
    }));
    fixture.detectChanges();
    supportTicketService.adminTicketDetail.and.returnValue(of({
      ...summary({ category: 'LOGIN_ACCOUNT', status: 'IN_PROGRESS' }),
      description: 'x', screenshotUrl: null, route: null, appVersion: null, internalNote: null,
    }));
    component.openTicket(component.tickets[0]);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Login & Account');
    expect(text).toContain('In Progress');
    expect(text).not.toMatch(/LOGIN_ACCOUNT|IN_PROGRESS|Login_account|In_progress/);
  });
});
