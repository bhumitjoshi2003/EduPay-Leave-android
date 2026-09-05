import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { NoticeComponent } from './notice.component';
import { NotificationService } from '../../services/notification.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { NotificationStateService } from '../../services/notification-state.service';

/** Server-side pagination for the admin Posted Notices list — never accumulated,
 *  never client-sliced. Mirrors the real PagedResponse shape the backend returns. */
describe('NoticeComponent — admin notices pagination', () => {
  let fixture: ComponentFixture<NoticeComponent>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let toast: jasmine.SpyObj<ToastService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const notice = (id: number) => ({
    id, title: `Notice ${id}`, message: 'Body', type: 'NOTICE', audience: 'ALL',
    createdAt: new Date().toISOString(), createdBy: 'admin'
  });

  function pageOf(allIds: number[], page: number, size: number) {
    const start = page * size;
    const content = allIds.slice(start, start + size).map(notice);
    const totalElements = allIds.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / size));
    return {
      content, totalElements, totalPages,
      last: page + 1 >= totalPages, first: page === 0, numberOfElements: content.length,
      pageable: { pageNumber: page, pageSize: size }
    };
  }

  function configure(totalNotices: number) {
    const ids = Array.from({ length: totalNotices }, (_, i) => totalNotices - i); // newest (highest id) first
    notificationService.getAllNotifications.and.callFake((page = 0, size = 10) =>
      of(pageOf(ids, page, size) as any));
  }

  beforeEach(async () => {
    notificationService = jasmine.createSpyObj('NotificationService', [
      'getAllNotifications', 'getUserNotifications', 'sendNotice', 'updateNotification', 'deleteNotification'
    ]);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'confirm']);
    toast.confirm.and.resolveTo(true);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [NoticeComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'ADMIN' }), hasFeature: () => true } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']) },
        { provide: ToastService, useValue: toast },
        { provide: SchoolService, useValue: { getClasses: () => of([]) } },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationStateService, useValue: jasmine.createSpyObj('NotificationStateService', ['allRead']) },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NoticeComponent);
  });

  it('requests page 0 with size 10 on initial load — real server pagination, not a client-side slice', () => {
    configure(0);
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).toHaveBeenCalledOnceWith(0, 10);
  });

  it('shows the empty state for zero notices with no pagination controls', () => {
    configure(0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nb-empty-admin')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.nb-pagination')).toBeNull();
  });

  it('shows exactly one page of items and no pagination controls for a single notice', () => {
    configure(1);
    fixture.detectChanges();

    expect(fixture.componentInstance.allNotices.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.nb-pagination')).toBeNull();
  });

  it('shows exactly 10 items and no pagination controls for exactly 10 notices (one full page)', () => {
    configure(10);
    fixture.detectChanges();

    expect(fixture.componentInstance.allNotices.length).toBe(10);
    expect(fixture.componentInstance.noticesTotalPages).toBe(1);
    expect(fixture.nativeElement.querySelector('.nb-pagination')).toBeNull();
  });

  it('shows pagination and a working Next for 11 notices (a second, partial page)', () => {
    configure(11);
    fixture.detectChanges();

    expect(fixture.componentInstance.allNotices.length).toBe(10);
    expect(fixture.componentInstance.noticesTotalPages).toBe(2);
    const nextBtn: HTMLButtonElement = fixture.nativeElement.querySelectorAll('.nb-page-btn')[1];
    expect(nextBtn.disabled).toBeFalse();

    nextBtn.click();
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).toHaveBeenCalledWith(1, 10);
    expect(fixture.componentInstance.allNotices.length).toBe(1);
  });

  it('disables Previous on the first page and Next on the last page across 50+ notices', () => {
    configure(55);
    fixture.detectChanges();

    expect(fixture.componentInstance.noticesTotalPages).toBe(6);
    let [prevBtn, nextBtn]: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('.nb-page-btn');
    expect(prevBtn.disabled).toBeTrue();
    expect(nextBtn.disabled).toBeFalse();

    fixture.componentInstance.loadNotices(5); // last page (0-indexed)
    fixture.detectChanges();
    [prevBtn, nextBtn] = fixture.nativeElement.querySelectorAll('.nb-page-btn');
    expect(prevBtn.disabled).toBeFalse();
    expect(nextBtn.disabled).toBeTrue();
  });

  it('returns to page 0 after creating a notice so the new one is visible', async () => {
    configure(11);
    fixture.detectChanges();
    fixture.componentInstance.loadNotices(1);
    fixture.detectChanges();
    notificationService.getAllNotifications.calls.reset();

    fixture.componentInstance.form = {
      title: 'New notice', subject: '', body: 'Body', targetAudience: 'All', deliveryMode: 'IN_APP'
    };
    notificationService.sendNotice.and.returnValue(of({ message: 'ok' }));
    fixture.componentInstance.postNotice();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).toHaveBeenCalledWith(0, 10);
  });

  it('refetches the same page after editing via the dialog (no reset)', () => {
    configure(11);
    fixture.detectChanges();
    fixture.componentInstance.loadNotices(1);
    fixture.detectChanges();
    notificationService.getAllNotifications.calls.reset();

    // The Edit Notice dialog owns the save call itself; the list just reacts
    // to afterClosed() emitting the saved notice.
    dialog.open.and.returnValue({ afterClosed: () => of(notice(999)) } as any);
    fixture.componentInstance.openEditDialog(notice(999) as any);
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).toHaveBeenCalledWith(1, 10);
  });

  it('does not refetch when the Edit Notice dialog is dismissed without saving', () => {
    configure(11);
    fixture.detectChanges();
    notificationService.getAllNotifications.calls.reset();

    dialog.open.and.returnValue({ afterClosed: () => of(undefined) } as any);
    fixture.componentInstance.openEditDialog(notice(1) as any);
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).not.toHaveBeenCalled();
  });

  it('steps back to the previous page after deleting the only item left on a later page', async () => {
    configure(11);
    fixture.detectChanges();
    fixture.componentInstance.loadNotices(1); // page 1 has exactly 1 item
    fixture.detectChanges();
    notificationService.getAllNotifications.calls.reset();

    notificationService.deleteNotification.and.returnValue(of(void 0));
    fixture.componentInstance.deleteNotice(1);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).toHaveBeenCalledWith(0, 10);
  });

  it('refetches the current page after deleting when other items remain on it', async () => {
    configure(11);
    fixture.detectChanges(); // page 0 has 10 items
    notificationService.getAllNotifications.calls.reset();

    notificationService.deleteNotification.and.returnValue(of(void 0));
    fixture.componentInstance.deleteNotice(5);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notificationService.getAllNotifications).toHaveBeenCalledWith(0, 10);
  });
});
