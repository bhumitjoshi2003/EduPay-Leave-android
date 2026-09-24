import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeacherClassUpdatesComponent } from './teacher-class-updates.component';
import { ClassUpdateService } from '../../services/class-update.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import { ClassUpdate, ClassUpdateContext, toLocalDateTimeInput } from '../../interfaces/class-update';

describe('TeacherClassUpdatesComponent', () => {
  let fixture: ComponentFixture<TeacherClassUpdatesComponent>;
  let component: TeacherClassUpdatesComponent;
  let service: jasmine.SpyObj<ClassUpdateService>;
  let toast: jasmine.SpyObj<ToastService>;

  const science: ClassUpdateContext = { classId: 8, className: '8', sectionId: 3, sectionName: 'A', subjectName: 'Science' };
  const physics: ClassUpdateContext = { classId: 10, className: '10', sectionId: null, sectionName: null, subjectName: 'Physics' };

  const update = (overrides: Partial<ClassUpdate> = {}): ClassUpdate => ({
    id: 500, classId: 8, className: '8', sectionId: 3, sectionName: 'A', subjectName: 'Science',
    teacherId: 'T1', teacherName: 'Ms Rao', title: 'Unit test Friday', message: 'Chapters 3 and 4.',
    attachment: null, expiresAt: null, expired: false,
    createdAt: '2026-09-23T09:00:00', updatedAt: '2026-09-23T09:00:00', canEdit: true, ...overrides,
  });

  function pick(file: File): void {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    component.onFileSelected({ target: input } as unknown as Event);
  }

  function build(contexts: ClassUpdateContext[] = [science, physics], recent: ClassUpdate[] = []): void {
    service = jasmine.createSpyObj('ClassUpdateService', ['myContexts', 'myRecent', 'create', 'update', 'delete', 'uploadAttachmentDirect']);
    service.myContexts.and.returnValue(of(contexts));
    service.myRecent.and.returnValue(of(recent));
    service.create.and.callFake(req => of(update({ id: 501, title: req.title, message: req.message })));
    service.update.and.callFake((id, req) => of(update({ id, title: req.title, message: req.message })));
    service.delete.and.returnValue(of(void 0));
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'confirm']);
    TestBed.configureTestingModule({
      imports: [TeacherClassUpdatesComponent],
      providers: [
        { provide: ClassUpdateService, useValue: service },
        { provide: ToastService, useValue: toast },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
      ],
    });
    fixture = TestBed.createComponent(TeacherClassUpdatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => fixture?.destroy());

  it('lists recent updates with class/subject, expiry state and edit/delete actions', () => {
    build(undefined, [
      update(),
      update({ id: 502, title: 'Old notice', expired: true, expiresAt: '2026-09-20T10:00:00Z' }),
    ]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Unit test Friday');
    expect(el.querySelector('.tcu-chip.is-class')!.textContent).toContain('Class 8 – A');
    expect(el.querySelector('.tcu-chip.is-subject')!.textContent).toContain('Science');
    expect(el.textContent).toContain('Expired');
    expect(el.querySelector('.tcu-hero')!.textContent).toContain('Keep your classes in the loop.');
    expect(el.querySelectorAll('.tcu-card').length).toBe(2);
    expect(el.querySelectorAll('button[aria-label="Edit update"]').length).toBe(2);
    expect(el.querySelectorAll('button[aria-label="Delete update"]').length).toBe(2);
  });

  it('creates an update for a selected class context and prepends it', () => {
    build();
    component.openCreate();
    component.form!.contextKey = component.contextKey(physics);
    component.form!.title = '  Lab day ';
    component.form!.message = ' Bring your lab coat. ';
    expect(component.canSave).toBeTrue();

    component.save();

    expect(service.create).toHaveBeenCalledOnceWith({
      classId: 10, sectionId: null, subjectName: 'Physics', title: 'Lab day', message: 'Bring your lab coat.',
      attachment: null, expiresAt: null,
    });
    expect(component.recent[0].id).toBe(501);
    expect(component.form).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Posted', 'Students in this class have been notified.');
  });

  it('requires a class, title and message before saving', () => {
    build();
    component.openCreate();
    expect(component.canSave).toBeFalse();
    component.form!.title = 'T';
    component.form!.message = 'M';
    expect(component.canSave).toBeFalse();
    component.form!.contextKey = component.contextKey(science);
    expect(component.canSave).toBeTrue();
  });

  it('preselects the only class when the teacher teaches just one', () => {
    build([science]);
    component.openCreate();
    expect(component.form!.contextKey).toBe(component.contextKey(science));
  });

  it('shows a calm state and no New update button without timetable classes', () => {
    build([]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No classes found in your timetable');
    expect(el.querySelector('.tcu-new')).toBeNull();
  });

  it('uploads a picked file first and sends its object key', () => {
    build();
    service.uploadAttachmentDirect.and.returnValue(of({ objectKey: 'schools/1/class-updates/new/attachments/x.pdf' } as any));
    component.openCreate();
    component.form!.contextKey = component.contextKey(science);
    component.form!.title = 'Worksheet';
    component.form!.message = 'See attached.';
    pick(new File(['x'], 'sheet.pdf', { type: 'application/pdf' }));

    component.save();

    expect(service.uploadAttachmentDirect).toHaveBeenCalledTimes(1);
    expect(service.create.calls.mostRecent().args[0].attachment)
      .toEqual({ objectKey: 'schools/1/class-updates/new/attachments/x.pdf', fileName: 'sheet.pdf' });
  });

  it('rejects unsupported and oversized files', () => {
    build();
    component.openCreate();
    pick(new File(['x'], 'run.exe', { type: 'application/x-msdownload' }));
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    pick(big);
    expect(component.form!.attachment).toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it('editing keeps the existing attachment and an unchanged expiry, and can remove the attachment', () => {
    const expiresAt = '2026-09-20T10:00:00Z';
    build(undefined, [update({
      expiresAt, expired: true,
      attachment: { fileName: 'a.png', contentType: 'image/png', fileSize: 2048, type: 'IMAGE', url: 'https://cdn/a.png', objectKey: 'k/a.png' },
    })]);
    component.openEdit(component.recent[0]);
    expect(component.form!.expiry).toBe(toLocalDateTimeInput(expiresAt));
    component.form!.title = 'Fixed title';
    component.save();
    expect(service.update).toHaveBeenCalledWith(500, {
      title: 'Fixed title', message: 'Chapters 3 and 4.', attachment: { objectKey: 'k/a.png', fileName: 'a.png' }, expiresAt,
    });
    expect(service.uploadAttachmentDirect).not.toHaveBeenCalled();

    component.openEdit(component.recent[0]);
    component.removeAttachment();
    component.clearExpiry();
    component.save();
    expect(service.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ attachment: null, expiresAt: null }));
  });

  it('refuses a new expiry in the past', () => {
    build();
    component.openCreate();
    component.form!.contextKey = component.contextKey(science);
    component.form!.title = 'T';
    component.form!.message = 'M';
    component.form!.expiry = toLocalDateTimeInput(new Date(Date.now() - 60 * 60 * 1000));
    component.save();
    expect(service.create).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('sends a future expiry as an ISO instant', () => {
    build();
    component.openCreate();
    component.form!.contextKey = component.contextKey(science);
    component.form!.title = 'T';
    component.form!.message = 'M';
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    component.form!.expiry = toLocalDateTimeInput(future);
    component.save();
    const sent = service.create.calls.mostRecent().args[0].expiresAt!;
    expect(sent).toMatch(/Z$/);
    expect(Math.abs(new Date(sent).getTime() - future.getTime())).toBeLessThan(60 * 1000);
  });

  it('deletes only after confirmation', async () => {
    build(undefined, [update()]);
    toast.confirm.and.returnValue(Promise.resolve(false));
    await component.remove(component.recent[0]);
    expect(service.delete).not.toHaveBeenCalled();

    toast.confirm.and.returnValue(Promise.resolve(true));
    await component.remove(component.recent[0]);
    expect(service.delete).toHaveBeenCalledOnceWith(500);
    expect(component.recent.length).toBe(0);
  });

  it('keeps the form open with the server message when saving fails', () => {
    build();
    service.create.and.returnValue(throwError(() => ({ error: { message: 'You can only post updates to classes you teach.' } })));
    component.openCreate();
    component.form!.contextKey = component.contextKey(science);
    component.form!.title = 'T';
    component.form!.message = 'M';
    component.save();
    expect(component.form).not.toBeNull();
    expect(component.form!.saving).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Unable to post', 'You can only post updates to classes you teach.');
  });

  it('filters between all, active and expired updates, with counts', () => {
    build(undefined, [
      update(),
      update({ id: 502, title: 'Old notice', expired: true, expiresAt: '2026-09-20T10:00:00Z' }),
      update({ id: 503, title: 'Soon', expiresAt: new Date(Date.now() + 3 * 3600_000).toISOString() }),
    ]);
    expect(component.countFor('all')).toBe(3);
    expect(component.countFor('active')).toBe(2);
    expect(component.countFor('expired')).toBe(1);

    const segment = (label: string) => Array.from(fixture.nativeElement.querySelectorAll('.tcu-segments button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent!.includes(label))!;
    segment('Expired').click();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.tcu-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Old notice');

    segment('Active').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.tcu-card').length).toBe(2);
    expect(fixture.nativeElement.textContent).toMatch(/Expires in [23]h/);
  });

  it('shows relative posted times', () => {
    build();
    component.now = new Date('2026-09-24T12:00:00').getTime();
    expect(component.relative('2026-09-24T11:59:40')).toBe('Just now');
    expect(component.relative('2026-09-24T11:48:00')).toBe('12m ago');
    expect(component.relative('2026-09-24T09:00:00')).toBe('3h ago');
    expect(component.relative('2026-09-23T10:00:00')).toBe('Yesterday');
    expect(component.relative('2026-09-20T10:00:00')).toBe('4d ago');
  });

  it('gives each subject a stable colour tone and initials', () => {
    build();
    expect(component.tone(update())).toBe(component.tone(update({ id: 9 })));
    expect(component.initials(update())).toBe('SC');
    expect(component.initials(update({ subjectName: 'Social Studies' }))).toBe('SS');
    expect(component.initials(update({ subjectName: null, className: '10' }))).toBe('10');
  });

  it('expiry presets set end-of-day expiries and No expiry clears it', () => {
    build();
    component.openCreate();
    const tomorrow = component.presets.find(p => p.label === 'Tomorrow')!;
    component.applyPreset(tomorrow);
    expect(component.form!.expiry).toBe(tomorrow.value);
    expect(tomorrow.value).toMatch(/T23:59$/);
    component.clearExpiry();
    expect(component.form!.expiry).toBe('');
  });

  it('picks a class from the context cards', () => {
    build();
    (fixture.nativeElement.querySelector('.tcu-new') as HTMLButtonElement).click();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.tcu-context');
    expect(cards.length).toBe(2);
    (cards[1] as HTMLButtonElement).click();
    expect(component.form!.contextKey).toBe(component.contextKey(physics));
  });

  it('accepts a dropped file', () => {
    build();
    component.openCreate();
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const dataTransfer = { files: [file] } as unknown as DataTransfer;
    component.onDrop({ preventDefault: () => {}, dataTransfer } as unknown as DragEvent);
    expect(component.form!.attachment?.fileName).toBe('photo.png');
    expect(component.dragOver).toBeFalse();
  });

  it('shows an error state with retry when loading fails', () => {
    service = jasmine.createSpyObj('ClassUpdateService', ['myContexts', 'myRecent']);
    service.myContexts.and.returnValue(throwError(() => new Error('offline')));
    service.myRecent.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [TeacherClassUpdatesComponent],
      providers: [
        { provide: ClassUpdateService, useValue: service },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
      ],
    });
    fixture = TestBed.createComponent(TeacherClassUpdatesComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
  });
});
