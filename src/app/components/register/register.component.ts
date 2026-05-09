import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterStudentComponent } from '../register-student/register-student.component';
import { RegisterTeacherComponent } from '../register-teacher/register-teacher.component';

@Component({
  selector: 'app-register',
  imports: [CommonModule, RegisterStudentComponent, RegisterTeacherComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  showStudentForm = true;

  toggleForm(type: 'student' | 'teacher'): void {
    this.showStudentForm = type === 'student';
  }
}
