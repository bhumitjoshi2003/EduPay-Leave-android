import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MySupportRequestsComponent } from './my-support-requests.component';
import { SupportTicketService } from '../../services/support-ticket.service';
import { LoggerService } from '../../services/logger.service';
import { SupportTicketSummary } from '../../interfaces/support-ticket';

describe('MySupportRequestsComponent', () => {
  let fixture: ComponentFixture<MySupportRequestsComponent>;
  let component: MySupportRequestsComponent;
  let supportTicketService: jasmine.SpyObj<SupportTicketService>;

  const summary = (overrides: Partial<SupportTicketSummary> = {}): SupportTicketSummary => ({
    id: 1, ticketNumber: 'EDX-1', schoolId: 1, schoolName: 'Indra Academy',
    reporterUserId: 'T1', reporterName: 'Ms Rao', reporterRole: 'TEACHER',
    category: 'OTHER', title: 'Something broke', status: 'OPEN', platform: 'ANDROID',
    createdAt: '2026-09-23T08:00:00', updatedAt: '2026-09-23T08:00:00',
    ...overrides,
  });

  beforeEach(() => {
    supportTicketService = jasmine.createSpyObj('SupportTicketService', ['myTickets', 'myTicketDetail']);
    supportTicketService.myTickets.and.returnValue(of({ content: [summary()], number: 0, totalPages: 1, totalElements: 1, first: true, last: true }));

    TestBed.configureTestingModule({
      imports: [MySupportRequestsComponent],
      providers: [
        provideRouter([]),
        { provide: SupportTicketService, useValue: supportTicketService },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
      ],
    });
    fixture = TestBed.createComponent(MySupportRequestsComponent);
    component = fixture.componentInstance;
  });

  it('loads and displays the reporter\'s own tickets on init', () => {
    fixture.detectChanges();
    expect(component.tickets.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('EDX-1');
  });

  it('shows an isolated fallback with Retry when the list fails to load', () => {
    supportTicketService.myTickets.and.returnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();
    expect(component.failed).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
  });

  it('shows a truthful empty state with a link to report a problem', () => {
    supportTicketService.myTickets.and.returnValue(of({ content: [], number: 0, totalPages: 0, totalElements: 0, first: true, last: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("haven't reported");
  });

  it('toggling a ticket loads and shows its detail', () => {
    fixture.detectChanges();
    supportTicketService.myTicketDetail.and.returnValue(of({
      ...summary(), description: 'Full description here.', screenshotUrl: null, route: '/dashboard', appVersion: null, internalNote: null,
    }));

    component.toggleDetail(component.tickets[0]);

    expect(supportTicketService.myTicketDetail).toHaveBeenCalledWith(1);
    expect(component.expandedId).toBe(1);
    expect(component.detail?.description).toBe('Full description here.');
  });

  it('toggling the same ticket again collapses it', () => {
    fixture.detectChanges();
    supportTicketService.myTicketDetail.and.returnValue(of({ ...summary(), description: '', screenshotUrl: null, route: null, appVersion: null, internalNote: null }));
    component.toggleDetail(component.tickets[0]);

    component.toggleDetail(component.tickets[0]);

    expect(component.expandedId).toBeNull();
    expect(component.detail).toBeNull();
  });

  it('never exposes an internal note to the reporter\'s own detail view', () => {
    fixture.detectChanges();
    // The backend never sends a real note back on /mine/{id} — this proves the component
    // simply renders whatever it's given rather than trying to display internalNote at all.
    supportTicketService.myTicketDetail.and.returnValue(of({
      ...summary(), description: 'x', screenshotUrl: null, route: null, appVersion: null, internalNote: null,
    }));
    component.toggleDetail(component.tickets[0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('internalNote');
  });

  it('shows friendly category and status labels, never raw enum values like LOGIN_ACCOUNT', () => {
    supportTicketService.myTickets.and.returnValue(of({
      content: [summary({ category: 'LOGIN_ACCOUNT', status: 'IN_PROGRESS' })],
      number: 0, totalPages: 1, totalElements: 1, first: true, last: true,
    }));
    fixture.detectChanges();
    supportTicketService.myTicketDetail.and.returnValue(of({
      ...summary({ category: 'LOGIN_ACCOUNT', status: 'IN_PROGRESS' }),
      description: 'x', screenshotUrl: null, route: null, appVersion: null, internalNote: null,
    }));
    component.toggleDetail(component.tickets[0]);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Login & Account');
    expect(text).toContain('In Progress');
    expect(text).not.toMatch(/LOGIN_ACCOUNT|IN_PROGRESS|Login_account|In_progress/);
  });
});
