import { Component, Inject, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConfirmDialogData } from '../../services/toast.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  sanitizedHtml: SafeHtml | null = null;

  constructor(
    public ref: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    private sanitizer: DomSanitizer,
  ) {
    if (data.html) {
      this.sanitizedHtml = this.sanitizer.sanitize(SecurityContext.HTML, data.html) ?? '';
    }
  }

  get iconName(): string {
    const map: Record<string, string> = {
      warning: 'warning_amber',
      danger:  'delete_forever',
      question:'help_outline',
      info:    'info_outline',
      success: 'check_circle_outline',
    };
    return map[this.data.icon ?? 'warning'] ?? 'warning_amber';
  }

  get iconClass(): string {
    if (this.data.danger) return 'icon-danger';
    const map: Record<string, string> = {
      warning:  'icon-warning',
      danger:   'icon-danger',
      question: 'icon-question',
      info:     'icon-info',
      success:  'icon-success',
    };
    return map[this.data.icon ?? 'warning'] ?? 'icon-warning';
  }

  cancel():  void { this.ref.close(false); }
  confirm(): void { this.ref.close(true);  }
}
