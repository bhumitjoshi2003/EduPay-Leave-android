import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventCalendarComponent } from './event-calendar.component';

describe('EventCalendarComponent', () => {
  let component: EventCalendarComponent;
  let fixture: ComponentFixture<EventCalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventCalendarComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EventCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getFullImageUrl', () => {
    // Regression for the event-image display bug: object-storage images arrive as an
    // already-absolute, short-lived presigned URL (see EventService.resolveImageUrl on the
    // backend) and must be used exactly as-is — the old implementation unconditionally
    // re-prefixed every value with environment.apiUrl, corrupting the presigned URL into a
    // broken <img src> (the reported "broken image icon" bug).
    it('returns an object-storage presigned URL completely unchanged', () => {
      const presignedUrl = 'https://storage.example.com/bucket/schools/1/events/5/images/uuid.jpg?X-Amz-Signature=abc';
      expect(component.getFullImageUrl(presignedUrl)).toBe(presignedUrl);
    });

    it('prefixes a legacy relative /uploads/events/images/... path with apiUrl', () => {
      const result = component.getFullImageUrl('/uploads/events/images/legacy.jpg');
      expect(result.endsWith('/uploads/events/images/legacy.jpg')).toBeTrue();
      expect(result.startsWith('http')).toBeTrue();
    });

    it('returns empty string for null/undefined', () => {
      expect(component.getFullImageUrl(null)).toBe('');
      expect(component.getFullImageUrl(undefined)).toBe('');
    });
  });
});
