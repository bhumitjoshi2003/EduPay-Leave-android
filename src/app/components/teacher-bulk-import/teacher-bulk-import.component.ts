import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TeacherService } from '../../services/teacher.service';
import { BulkImportResult, BulkImportError } from '../../services/student.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-teacher-bulk-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-bulk-import.component.html',
  styleUrl: './teacher-bulk-import.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherBulkImportComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  isImporting = false;
  isDownloadingTemplate = false;
  result: BulkImportResult | null = null;
  importError: string = '';

  constructor(
    private teacherService: TeacherService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        this.importError = 'Only CSV files are accepted.';
        this.selectedFile = null;
        input.value = '';
      } else if (file.size > 50 * 1024 * 1024) {
        this.importError = 'File too large. CSV must be under 50MB.';
        this.selectedFile = null;
        input.value = '';
      } else {
        this.importError = '';
        this.selectedFile = file;
        this.result = null;
      }
      this.cdr.markForCheck();
    }
  }

  onDropZoneClick(): void {
    this.fileInput.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        this.importError = 'Only CSV files are accepted.';
        this.selectedFile = null;
      } else if (file.size > 50 * 1024 * 1024) {
        this.importError = 'File too large. CSV must be under 50MB.';
        this.selectedFile = null;
      } else {
        this.importError = '';
        this.selectedFile = file;
        this.result = null;
      }
      this.cdr.markForCheck();
    }
  }

  downloadTemplate(): void {
    this.isDownloadingTemplate = true;
    this.cdr.markForCheck();
    this.teacherService.downloadBulkTemplate().subscribe({
      next: (blob) => {
        saveAs(blob, 'teacher_import_template.csv');
        this.isDownloadingTemplate = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isDownloadingTemplate = false;
        this.importError = 'Failed to download template. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  import(): void {
    if (!this.selectedFile) return;
    this.isImporting = true;
    this.importError = '';
    this.result = null;
    this.cdr.markForCheck();

    this.teacherService.bulkImport(this.selectedFile).subscribe({
      next: (result) => {
        this.result = result;
        this.isImporting = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.importError = 'Import failed. Please check the file format and try again.';
        this.isImporting = false;
        this.cdr.markForCheck();
      }
    });
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
    this.importError = '';
    this.fileInput.nativeElement.value = '';
    this.cdr.markForCheck();
  }

  goToTeacherList(): void {
    this.router.navigate(['/dashboard/teacher-list']);
  }

  downloadErrorCSV(): void {
    if (!this.result?.errors?.length) return;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = ['Row,Teacher ID,Error',
      ...this.result.errors.map((error: BulkImportError) =>
        [error.row, escape(error.studentId), escape(error.reason)].join(','))
    ];
    saveAs(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'teacher-import-errors.csv');
  }

  trackByRow(index: number, error: BulkImportError): number { return error.row; }
}
