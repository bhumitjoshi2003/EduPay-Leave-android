import { Directive, ElementRef, EventEmitter, OnDestroy, Output, AfterViewInit } from '@angular/core';

/**
 * Reports whether the host element's content is actually clipped by a CSS
 * line-clamp (or any overflow:hidden height cap) — via scrollHeight vs
 * clientHeight, not a character-count guess. A ResizeObserver keeps this
 * correct across font loading, viewport resize, and content changes, since
 * the same DOM node is reused across *ngFor re-renders (trackBy).
 */
@Directive({
  selector: '[appTruncationCheck]',
  standalone: true
})
export class TruncationCheckDirective implements AfterViewInit, OnDestroy {
  @Output() truncated = new EventEmitter<boolean>();
  private resizeObserver?: ResizeObserver;
  private lastValue?: boolean;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const check = () => {
      const node = this.el.nativeElement;
      const isTruncated = node.scrollHeight - node.clientHeight > 1;
      if (isTruncated !== this.lastValue) {
        this.lastValue = isTruncated;
        this.truncated.emit(isTruncated);
      }
    };
    queueMicrotask(check);
    this.resizeObserver = new ResizeObserver(check);
    this.resizeObserver.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
