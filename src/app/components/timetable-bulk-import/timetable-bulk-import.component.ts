import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { saveAs } from 'file-saver';
import { TimetableService, TimetableBulkImportResult, TimetableBulkImportError } from '../../services/timetable.service';

@Component({
  selector: 'app-timetable-bulk-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timetable-bulk-import.component.html',
  styleUrl: './timetable-bulk-import.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimetableBulkImportComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  isImporting = false;
  isDownloadingTemplate = false;
  result: TimetableBulkImportResult | null = null;
  importError = '';

  constructor(
    private timetableService: TimetableService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.acceptFile(input.files?.[0] ?? null, input);
  }

  onDropZoneClick(): void {
    this.fileInput.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.acceptFile(event.dataTransfer?.files[0] ?? null);
  }

  private acceptFile(file: File | null, input?: HTMLInputElement): void {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      this.importError = 'Only CSV files are accepted.';
      this.selectedFile = null;
      if (input) input.value = '';
    } else if (file.size > 50 * 1024 * 1024) {
      this.importError = 'File too large. CSV must be under 50MB.';
      this.selectedFile = null;
      if (input) input.value = '';
    } else {
      this.importError = '';
      this.selectedFile = file;
      this.result = null;
    }
    this.cdr.markForCheck();
  }

  downloadTemplate(): void {
    this.isDownloadingTemplate = true;
    this.cdr.markForCheck();
    this.timetableService.downloadBulkTemplate().subscribe({
      next: (blob) => {
        saveAs(blob, 'timetable_import_template.csv');
        this.isDownloadingTemplate = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isDownloadingTemplate = false;
        this.importError = 'Failed to download template. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  import(): void {
    if (!this.selectedFile) return;
    this.isImporting = true;
    this.importError = '';
    this.result = null;
    this.cdr.markForCheck();

    this.timetableService.bulkImport(this.selectedFile).subscribe({
      next: (result) => {
        this.result = result;
        this.isImporting = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.importError = 'Import failed. Please check the file format and try again.';
        this.isImporting = false;
        this.cdr.markForCheck();
      },
    });
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
    this.importError = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.cdr.markForCheck();
  }

  goToTimetable(): void {
    this.router.navigate(['/dashboard/timetable']);
  }

  downloadErrorCSV(): void {
    if (!this.result?.errors?.length) return;
    const lines = ['Row,Class,Reason',
      ...this.result.errors.map((e: TimetableBulkImportError) => `${e.row},"${e.label || ''}","${e.reason}"`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable-import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  trackByRow(_: number, row: { row: number }): number { return row.row; }
}
