import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { TransportService, DailyTransportReport, WrongBusAlertResponse } from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-reports.component.html',
  styleUrl: './transport-reports.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportReportsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'daily' | 'wrong-bus' = 'daily';
  loading = false;

  dailyDate = '';
  dailyReport: DailyTransportReport | null = null;

  wrongBusFrom = '';
  wrongBusTo = '';
  wrongBusAlerts: WrongBusAlertResponse[] = [];

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    this.dailyDate = today;
    this.wrongBusFrom = weekAgo;
    this.wrongBusTo = today;
    this.loadDaily();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadDaily(): void {
    if (!this.dailyDate) return;
    this.loading = true; this.cdr.markForCheck();
    this.transport.getDailyReport(this.dailyDate).pipe(
      catchError(() => { this.toast.error('Failed to load daily report'); return of(null); }),
      takeUntil(this.destroy$),
    ).subscribe(report => {
      this.dailyReport = report;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  loadWrongBus(): void {
    this.loading = true; this.cdr.markForCheck();
    this.transport.getWrongBusAlerts(this.wrongBusFrom, this.wrongBusTo).pipe(
      catchError(() => { this.toast.error('Failed to load wrong bus alerts'); return of([]); }),
      takeUntil(this.destroy$),
    ).subscribe(alerts => {
      this.wrongBusAlerts = alerts;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  switchTab(tab: 'daily' | 'wrong-bus'): void {
    this.activeTab = tab;
    if (tab === 'daily') this.loadDaily();
    else this.loadWrongBus();
  }

  boardingPct(boarded: number, expected: number): number {
    if (!expected) return 0;
    return Math.round((boarded / expected) * 100);
  }
}
