import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SelectMonthDialogData } from '../../services/toast.service';

@Component({
  selector: 'app-select-month-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './select-month-dialog.component.html',
})
export class SelectMonthDialogComponent {
  selected: number | null = null;
  error = false;

  constructor(
    public ref: MatDialogRef<SelectMonthDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SelectMonthDialogData,
  ) {}

  confirm(): void {
    if (this.selected === null) { this.error = true; return; }
    this.ref.close(this.selected);
  }

  cancel(): void { this.ref.close(null); }
}
