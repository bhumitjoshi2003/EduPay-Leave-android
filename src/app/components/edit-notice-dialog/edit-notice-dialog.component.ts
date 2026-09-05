import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../interfaces/notification';

export interface EditNoticeDialogData {
  id: number;
  title: string;
  message: string;
  type: string;
  audience: string;
}

/** Owns the update call itself so a failed save can keep the dialog open with
 *  the error visible, instead of the parent list closing it optimistically. */
@Component({
  selector: 'app-edit-notice-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './edit-notice-dialog.component.html',
  styleUrl: './edit-notice-dialog.component.css'
})
export class EditNoticeDialogComponent {
  title: string;
  message: string;
  submitting = false;
  errorMessage: string | null = null;

  constructor(
    public ref: MatDialogRef<EditNoticeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditNoticeDialogData,
    private notificationService: NotificationService
  ) {
    this.title = data.title;
    this.message = data.message;
  }

  save(): void {
    if (!this.title.trim() || !this.message.trim()) {
      this.errorMessage = 'Title and message are required.';
      return;
    }
    this.submitting = true;
    this.errorMessage = null;
    const updated: Notification = {
      title: this.title.trim(),
      message: this.message.trim(),
      type: this.data.type,
      audience: this.data.audience,
    };
    this.notificationService.updateNotification(this.data.id, updated)
      .subscribe({
        next: (saved) => {
          this.submitting = false;
          this.ref.close(saved);
        },
        error: (e) => {
          this.submitting = false;
          this.errorMessage = e?.error?.message || 'Failed to update the notice. Please try again.';
        },
      });
  }

  cancel(): void {
    if (this.submitting) return;
    this.ref.close();
  }
}
