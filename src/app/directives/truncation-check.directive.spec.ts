import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TruncationCheckDirective } from './truncation-check.directive';

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

@Component({
  standalone: true,
  imports: [TruncationCheckDirective],
  template: `
    <p style="width:120px; -webkit-line-clamp:2; -webkit-box-orient:vertical; display:-webkit-box; overflow:hidden;"
       appTruncationCheck (truncated)="onTruncated($event)">{{ text }}</p>
  `
})
class HostComponent {
  text = '';
  events: boolean[] = [];
  onTruncated(value: boolean): void { this.events.push(value); }
}

describe('TruncationCheckDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('reports truncated=true for content that overflows the clamp', async () => {
    fixture.componentInstance.text = 'A very long line of text that will not fit inside a two-line clamp at a 120px width no matter what.';
    fixture.detectChanges();
    await flush();

    expect(fixture.componentInstance.events).toContain(true);
  });

  it('reports truncated=false for content that fits within the clamp (no character-count guessing)', async () => {
    fixture.componentInstance.text = 'Short.';
    fixture.detectChanges();
    await flush();

    expect(fixture.componentInstance.events).not.toContain(true);
  });
});
