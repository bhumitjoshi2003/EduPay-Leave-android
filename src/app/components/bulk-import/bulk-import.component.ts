import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentService, BulkImportResult, BulkImportError } from '../../services/student.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-bulk-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bulk-import.component.html',
  styleUrl: './bulk-import.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkImportComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  isImporting = false;
  isDownloadingTemplate = false;
  result: BulkImportResult | null = null;
  importError: string = '';

  constructor(
    private studentService: StudentService,
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
        // Issue #77: File size limit
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
        // Issue #77: File size limit
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
    this.studentService.downloadBulkTemplate().subscribe({
      next: (blob) => {
        saveAs(blob, 'student_import_template.csv');
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

    this.studentService.bulkImport(this.selectedFile).subscribe({
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

  goToStudentList(): void {
    this.router.navigate(['/dashboard/student-list']);
  }

  // Issue #31: Download error rows as CSV for easy correction
  downloadErrorCSV(): void {
    if (!this.result?.errors?.length) return;
    const lines = ['Row,Student ID,Error',
      ...this.result.errors.map((e: BulkImportError) => `${e.row},"${e.studentId || ''}","${e.reason}"`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  trackByRow(index: number, error: BulkImportError): number { return error.row; }
}
