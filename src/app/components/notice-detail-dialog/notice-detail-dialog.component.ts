import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface NoticeDetailDialogData {
  title: string;
  message: string;
  meta?: string;
}

@Component({
  selector: 'app-notice-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './notice-detail-dialog.component.html',
  styleUrl: './notice-detail-dialog.component.css'
})
export class NoticeDetailDialogComponent {
  constructor(
    public ref: MatDialogRef<NoticeDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: NoticeDetailDialogData
  ) {}

  close(): void {
    this.ref.close();
  }
}
