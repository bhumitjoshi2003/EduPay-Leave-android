import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { throwError, of } from 'rxjs';
import { EditNoticeDialogComponent, EditNoticeDialogData } from './edit-notice-dialog.component';
import { NotificationService } from '../../services/notification.service';

describe('EditNoticeDialogComponent', () => {
  let fixture: ComponentFixture<EditNoticeDialogComponent>;
  let component: EditNoticeDialogComponent;
  let ref: jasmine.SpyObj<MatDialogRef<EditNoticeDialogComponent>>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const data: EditNoticeDialogData = {
    id: 42, title: 'Original title', message: 'Original message', type: 'NOTICE', audience: 'ALL'
  };

  beforeEach(async () => {
    ref = jasmine.createSpyObj('MatDialogRef', ['close']);
    notificationService = jasmine.createSpyObj('NotificationService', ['updateNotification']);

    await TestBed.configureTestingModule({
      imports: [EditNoticeDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: NotificationService, useValue: notificationService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditNoticeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pre-fills the form from the notice being edited', () => {
    expect(component.title).toBe('Original title');
    expect(component.message).toBe('Original message');
  });

  it('shows a validation error and does not call the service when title is blank', () => {
    component.title = '   ';
    component.save();

    expect(component.errorMessage).toBeTruthy();
    expect(notificationService.updateNotification).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('closes with the saved notice on success, preserving the untouched type/audience', () => {
    const saved = { id: 42, title: 'New title', message: 'New message', type: 'NOTICE', audience: 'ALL' };
    notificationService.updateNotification.and.returnValue(of(saved));
    component.title = 'New title';
    component.message = 'New message';

    component.save();

    expect(notificationService.updateNotification).toHaveBeenCalledWith(42, {
      title: 'New title', message: 'New message', type: 'NOTICE', audience: 'ALL'
    });
    expect(ref.close).toHaveBeenCalledWith(saved);
  });

  it('keeps the dialog open and shows the error when the save fails', () => {
    notificationService.updateNotification.and.returnValue(
      throwError(() => ({ error: { message: 'Audience cannot be changed.' } })));
    component.title = 'New title';
    component.message = 'New message';

    component.save();

    expect(ref.close).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Audience cannot be changed.');
    expect(component.submitting).toBeFalse();
  });

  it('cancel closes the dialog without a result', () => {
    component.cancel();
    expect(ref.close).toHaveBeenCalledWith();
  });

  it('ignores cancel while a save is in flight', () => {
    notificationService.updateNotification.and.returnValue(of({} as any));
    component.submitting = true;
    component.cancel();
    expect(ref.close).not.toHaveBeenCalled();
  });
});
