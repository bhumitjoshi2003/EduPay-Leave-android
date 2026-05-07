import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, filter, skip, distinctUntilChanged, map } from 'rxjs';
import { NetworkService } from '../../services/network.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-indicator.component.html',
  styleUrl: './offline-indicator.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {

  isVisible  = false;
  isLeaving  = false;

  private destroy$ = new Subject<void>();

  constructor(
    private network: NetworkService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.network.isOffline$
      .pipe(takeUntil(this.destroy$))
      .subscribe(offline => {
        if (offline) {
          this.isLeaving = false;
          this.isVisible = true;
          this.cdr.markForCheck();
        } else if (this.isVisible) {
          // Animate out, then unmount
          this.isLeaving = true;
          this.cdr.markForCheck();
          setTimeout(() => {
            this.isVisible = false;
            this.isLeaving = false;
            this.cdr.markForCheck();
          }, 480);
          this.toast.success('Back Online', 'Connection restored. Good to go!');
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  retry() {
    this.network.recheck();
  }
}
