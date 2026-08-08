import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { saveAs } from 'file-saver';
import { KnowledgeBaseService, KnowledgeDocument } from '../../services/knowledge-base.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB, matches KnowledgeDocumentService's server-side cap

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DatePipe],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeBaseComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  documents: KnowledgeDocument[] = [];
  loading = false;
  uploading = false;
  dragOver = false;

  selectedFile: File | null = null;
  title = '';
  category = 'GENERAL';

  categories = ['ATTENDANCE', 'LEAVE', 'FEES', 'EXAMS', 'GENERAL', 'OTHER'];

  constructor(
    private knowledgeBaseService: KnowledgeBaseService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDocuments(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.knowledgeBaseService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (docs) => {
          this.documents = docs;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error loading knowledge base documents:', e);
          this.toast.error('Error', 'Failed to load documents.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── File selection ──────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
  }

  onDropZoneClick(): void {
    this.fileInput?.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  private setFile(file: File | null): void {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      this.toast.warning('Invalid file', 'Only PDF, DOCX, TXT, and MD files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.toast.warning('File too large', 'File size exceeds the 20 MB limit.');
      return;
    }

    this.selectedFile = file;
    if (!this.title.trim()) {
      // Pre-fill the title from the filename (without extension) — admin can still edit it.
      this.title = file.name.replace(/\.[^/.]+$/, '');
    }
    this.cdr.markForCheck();
  }

  clearSelectedFile(): void {
    this.selectedFile = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    this.cdr.markForCheck();
  }

  // ── Upload ───────────────────────────────────────────────────────────

  upload(): void {
    if (!this.selectedFile) {
      this.toast.warning('Missing file', 'Please select a document to upload.');
      return;
    }
    if (!this.title.trim()) {
      this.toast.warning('Missing title', 'Please give this document a title.');
      return;
    }

    this.uploading = true;
    this.cdr.markForCheck();

    this.knowledgeBaseService.upload(this.selectedFile, this.title.trim(), this.category)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (doc) => {
          this.documents = [doc, ...this.documents];
          this.uploading = false;
          this.title = '';
          this.category = 'GENERAL';
          this.clearSelectedFile();
          this.toast.success('Uploaded', 'The document is being processed.');
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error uploading knowledge base document:', e);
          this.toast.error('Error', e?.error?.error ?? 'Failed to upload the document.');
          this.uploading = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Actions ──────────────────────────────────────────────────────────

  refreshStatus(): void {
    this.loadDocuments();
  }

  download(doc: KnowledgeDocument): void {
    this.knowledgeBaseService.download(doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => saveAs(blob, doc.originalFilename),
        error: (e) => {
          this.logger.error('Error downloading knowledge base document:', e);
          this.toast.error('Error', 'Failed to download the document.');
        },
      });
  }

  delete(doc: KnowledgeDocument): void {
    this.toast.confirm({
      title: `Delete "${doc.title}"?`,
      message: 'This removes it from the knowledge base — the AI copilot will no longer be able to answer from it. This action cannot be undone.',
      confirmText: 'Yes, delete',
      cancelText: 'Cancel',
      danger: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      this.knowledgeBaseService.delete(doc.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.documents = this.documents.filter(d => d.id !== doc.id);
            this.toast.success('Deleted');
            this.cdr.markForCheck();
          },
          error: (e) => {
            this.logger.error('Error deleting knowledge base document:', e);
            this.toast.error('Error', 'Failed to delete the document.');
          },
        });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  trackById(_: number, doc: KnowledgeDocument): number { return doc.id; }

  statusLabel(status: string): string {
    return status === 'PROCESSING' ? 'Processing' : status === 'READY' ? 'Ready' : 'Failed';
  }

  categoryLabel(category: string): string {
    const map: Record<string, string> = {
      ATTENDANCE: 'Attendance', LEAVE: 'Leave', FEES: 'Fees',
      EXAMS: 'Exams', GENERAL: 'General', OTHER: 'Other',
    };
    return map[category] ?? category;
  }
}
