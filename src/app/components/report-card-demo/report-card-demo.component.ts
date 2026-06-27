import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface DemoStyle {
  name: string;
  tagline: string;
  bestFor: string;
  color: string;
  accentColor: string;
  sections: string[];
}

@Component({
  selector: 'app-report-card-demo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-card-demo.component.html',
  styleUrl: './report-card-demo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCardDemoComponent {
  readonly styles: DemoStyle[] = [
    {
      name: 'CBSE Standard',
      tagline: 'Official & government schools',
      bestFor: 'CBSE, Kendriya Vidyalaya, government-affiliated schools',
      color: '#1565c0',
      accentColor: '#e3edf9',
      sections: ['School Header', 'Student Info', 'Scholastic Performance', 'Assessment Summary', 'Attendance', 'Co-Scholastic', 'Remarks', 'Result & Signatures'],
    },
    {
      name: 'Modern Academic',
      tagline: 'Private English-medium schools',
      bestFor: 'Private CBSE / ICSE English-medium schools',
      color: '#0d5f5f',
      accentColor: '#e2f0ef',
      sections: ['School Header', 'Student Info', 'Scholastic Performance', 'Assessment Summary', 'Attendance', 'Co-Scholastic', 'Remarks', 'Result & Signatures'],
    },
    {
      name: 'Primary School',
      tagline: 'Junior classes (Nursery – 5)',
      bestFor: 'Activity-based & junior wing schools',
      color: '#4338ca',
      accentColor: '#ede9fe',
      sections: ['School Header', 'Student Info', 'Activities & Marks', 'Attendance', 'Co-Scholastic', 'Teacher Remarks', 'Signatures'],
    },
    {
      name: 'Senior Secondary',
      tagline: 'Classes 9 to 12',
      bestFor: 'Senior secondary schools, stream-wise subjects',
      color: '#b91c1c',
      accentColor: '#fee2e2',
      sections: ['School Header', 'Student Info', 'Stream & Subjects', 'Scholastic Performance', 'Assessment Summary', 'Attendance', 'Result & Signatures'],
    },
    {
      name: 'Minimal Pro',
      tagline: 'International & IB schools',
      bestFor: 'IB, Cambridge, international & premium institutions',
      color: '#1c1c1e',
      accentColor: '#f4f4f5',
      sections: ['School Header', 'Student Info', 'Marks & Grades', 'Assessment Summary', 'Attendance', 'Remarks', 'Signatures'],
    },
  ];

  constructor(private router: Router) {}

  viewSample(style: DemoStyle): void {
    this.router.navigate(['/dashboard/report-card'], {
      queryParams: { demo: 'true', color: style.color, styleName: style.name }
    });
  }

  goBack(): void { this.router.navigate(['/dashboard']); }

  trackByName(_: number, s: DemoStyle): string { return s.name; }
}
