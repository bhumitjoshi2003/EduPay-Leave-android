import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';

import { RegisterTeacherComponent } from './register-teacher.component';
import { TeacherService } from '../../services/teacher.service';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { SchoolService } from '../../services/school.service';
import { ToastService } from '../../services/toast.service';

describe('RegisterTeacherComponent', () => {
  let component: RegisterTeacherComponent;
  let fixture: ComponentFixture<RegisterTeacherComponent>;
  let teacherService: jasmine.SpyObj<TeacherService>;
  let authService: jasmine.SpyObj<AuthService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    teacherService = jasmine.createSpyObj('TeacherService', ['addTeacher']);
    authService = jasmine.createSpyObj('AuthService', ['register']);
    const authState = jasmine.createSpyObj('AuthStateService', ['getUserRole']);
    authState.getUserRole.and.returnValue('ADMIN');
    const schoolService = jasmine.createSpyObj('SchoolService', ['getClasses']);
    schoolService.getClasses.and.returnValue(of([]));
    toast = jasmine.createSpyObj('ToastService', ['error', 'success']);
    const router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegisterTeacherComponent],
      providers: [
        { provide: TeacherService, useValue: teacherService },
        { provide: AuthService, useValue: authService },
        { provide: AuthStateService, useValue: authState },
        { provide: SchoolService, useValue: schoolService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterTeacherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has no teacherId control — Edunexify generates the Employee ID, it is never admin-entered', () => {
    expect(component.teacherForm.contains('teacherId')).toBeFalse();
  });

  it('marks the form invalid when date of birth is missing', () => {
    component.teacherForm.patchValue({
      name: 'Test', email: 'test@test.com', gender: 'MALE', dob: ''
    });
    expect(component.teacherForm.get('dob')?.valid).toBeFalse();
    expect(component.teacherForm.valid).toBeFalse();
  });

  it('does not send a password when registering the login account — the backend derives it from DOB', () => {
    teacherService.addTeacher.and.returnValue(of({ teacherId: 'emp_26010007' } as any));
    authService.register.and.returnValue(of('ok'));

    component.teacherForm.patchValue({
      name: 'Test', email: 'test@test.com', gender: 'MALE', dob: '1985-03-20', joiningDate: '2026-04-01'
    });
    component.onSubmit();

    expect(authService.register).toHaveBeenCalledWith(jasmine.objectContaining({
      userId: 'emp_26010007', role: 'TEACHER', email: 'test@test.com'
    }));
    const callArg = authService.register.calls.mostRecent().args[0] as any;
    expect(callArg.password).toBeUndefined();
  });

  it('shows the DOB-based initial-password message and the Edunexify-generated Employee ID on success', () => {
    teacherService.addTeacher.and.returnValue(of({ teacherId: 'emp_26010007' } as any));
    authService.register.and.returnValue(of('ok'));

    component.teacherForm.patchValue({
      name: 'Test', email: 'test@test.com', gender: 'MALE', dob: '1985-03-20', joiningDate: '2026-04-01'
    });
    component.onSubmit();

    expect(toast.success).toHaveBeenCalledWith('Teacher Registered!', jasmine.stringMatching(/Date of birth in YYYYMMDD format/));
    expect(toast.success).toHaveBeenCalledWith('Teacher Registered!', jasmine.stringMatching(/emp_26010007/));
  });

  it('surfaces an error toast when account setup fails after the teacher record is created', () => {
    teacherService.addTeacher.and.returnValue(of({ teacherId: 'emp_26010007' } as any));
    authService.register.and.returnValue(throwError(() => ({ status: 500 })));

    component.teacherForm.patchValue({
      name: 'Test', email: 'test@test.com', gender: 'MALE', dob: '1985-03-20', joiningDate: '2026-04-01'
    });
    component.onSubmit();

    expect(toast.error).toHaveBeenCalledWith('Error', jasmine.stringMatching(/account setup failed/));
  });
});
