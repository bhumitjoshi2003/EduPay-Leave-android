import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';

import { RegisterStudentComponent } from './register-student.component';
import { StudentService } from '../../services/student.service';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { SchoolService } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { ToastService } from '../../services/toast.service';

describe('RegisterStudentComponent', () => {
  let component: RegisterStudentComponent;
  let fixture: ComponentFixture<RegisterStudentComponent>;
  let studentService: jasmine.SpyObj<StudentService>;
  let authService: jasmine.SpyObj<AuthService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    studentService = jasmine.createSpyObj('StudentService', ['addStudent']);
    authService = jasmine.createSpyObj('AuthService', ['register']);
    const authState = jasmine.createSpyObj('AuthStateService', ['getUserRole']);
    authState.getUserRole.and.returnValue('ADMIN');
    // Android's component loads classes and managed classes in parallel via forkJoin.
    const schoolService = jasmine.createSpyObj('SchoolService', ['getClasses', 'getManagedClasses']);
    schoolService.getClasses.and.returnValue(of([]));
    schoolService.getManagedClasses.and.returnValue(of([]));
    const sectionService = jasmine.createSpyObj('SectionService', ['getSectionsForClass']);
    toast = jasmine.createSpyObj('ToastService', ['error', 'success']);
    const router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegisterStudentComponent],
      providers: [
        { provide: StudentService, useValue: studentService },
        { provide: AuthService, useValue: authService },
        { provide: AuthStateService, useValue: authState },
        { provide: SchoolService, useValue: schoolService },
        { provide: SectionService, useValue: sectionService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterStudentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has no studentId control — Edunexify generates the Student ID, it is never admin-entered', () => {
    expect(component.studentForm.contains('studentId')).toBeFalse();
  });

  it('marks the form invalid when date of birth is missing', () => {
    component.studentForm.patchValue({
      name: 'Test', email: 'test@test.com',
      className: '10', gender: 'MALE', joiningDate: '2024-01-01', dob: ''
    });
    expect(component.studentForm.get('dob')?.valid).toBeFalse();
    expect(component.studentForm.valid).toBeFalse();
  });

  it('does not send a password when registering the login account — the backend derives it from DOB', () => {
    studentService.addStudent.and.returnValue(of({ studentId: 'stu_26010001' } as any));
    authService.register.and.returnValue(of('ok'));

    component.studentForm.patchValue({
      name: 'Test', email: 'test@test.com',
      className: '10', gender: 'MALE', joiningDate: '2024-01-01', dob: '1990-05-23'
    });
    component.onSubmit();

    expect(authService.register).toHaveBeenCalledWith(jasmine.objectContaining({
      userId: 'stu_26010001', role: 'STUDENT', email: 'test@test.com'
    }));
    const callArg = authService.register.calls.mostRecent().args[0] as any;
    expect(callArg.password).toBeUndefined();
  });

  it('shows the DOB-based initial-password message and the Edunexify-generated Student ID on success', () => {
    studentService.addStudent.and.returnValue(of({ studentId: 'stu_26010001' } as any));
    authService.register.and.returnValue(of('ok'));

    component.studentForm.patchValue({
      name: 'Test', email: 'test@test.com',
      className: '10', gender: 'MALE', joiningDate: '2024-01-01', dob: '1990-05-23'
    });
    component.onSubmit();

    expect(toast.success).toHaveBeenCalledWith('Student Registered!', jasmine.stringMatching(/Date of birth in YYYYMMDD format/));
    expect(toast.success).toHaveBeenCalledWith('Student Registered!', jasmine.stringMatching(/stu_26010001/));
  });

  it('surfaces an error toast when account setup fails after the student record is created', () => {
    studentService.addStudent.and.returnValue(of({ studentId: 'stu_26010001' } as any));
    authService.register.and.returnValue(throwError(() => ({ status: 500 })));

    component.studentForm.patchValue({
      name: 'Test', email: 'test@test.com',
      className: '10', gender: 'MALE', joiningDate: '2024-01-01', dob: '1990-05-23'
    });
    component.onSubmit();

    expect(toast.error).toHaveBeenCalledWith('Error', jasmine.stringMatching(/account setup failed/));
  });
});
