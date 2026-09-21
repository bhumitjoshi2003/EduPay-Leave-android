import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EventService } from './event.service';
import { environment } from '../../environments/environment';

describe('EventService', () => {
  let service: EventService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(EventService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /** Android parity for the web direct-to-object-storage upload flow, replacing the retired
   * POST /api/files/uploadEventImage. */
  describe('uploadEventImageDirect', () => {
    function aFile(): File {
      return new File(['fake-image-bytes'], 'banner.jpg', { type: 'image/jpeg' });
    }

    it('uses the real event id as entityId when replacing an existing event\'s image', () => {
      service.uploadEventImageDirect(aFile(), 5).subscribe();
      const req = http.expectOne(`${environment.apiUrl}/files/upload-request`);
      expect(req.request.body.entityId).toBe('5');
      req.flush({
        objectKey: 'schools/1/events/5/images/uuid.jpg',
        uploadUrl: 'https://object-storage.example.com/bucket/schools/1/events/5/images/uuid.jpg?X-Amz-Signature=abc',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        requiredHeaders: { 'Content-Type': 'image/jpeg' },
      });
      http.expectOne('https://object-storage.example.com/bucket/schools/1/events/5/images/uuid.jpg?X-Amz-Signature=abc').flush({});
      http.expectOne(`${environment.apiUrl}/files/complete`).flush({ objectKey: 'schools/1/events/5/images/uuid.jpg', displayUrl: 'https://object-storage.example.com/signed-get' });
    });

    it('uses the "new" sentinel entityId when uploading before the event has been created', () => {
      service.uploadEventImageDirect(aFile(), null).subscribe();
      const req = http.expectOne(`${environment.apiUrl}/files/upload-request`);
      expect(req.request.body.entityId).toBe('new');
      req.flush({
        objectKey: 'schools/1/events/new/images/uuid.jpg',
        uploadUrl: 'https://object-storage.example.com/bucket/schools/1/events/new/images/uuid.jpg?X-Amz-Signature=abc',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        requiredHeaders: { 'Content-Type': 'image/jpeg' },
      });
      http.expectOne('https://object-storage.example.com/bucket/schools/1/events/new/images/uuid.jpg?X-Amz-Signature=abc').flush({});
      const completeReq = http.expectOne(`${environment.apiUrl}/files/complete`);
      expect(completeReq.request.body.entityId).toBe('new');
      completeReq.flush({ objectKey: 'schools/1/events/new/images/uuid.jpg', displayUrl: 'https://object-storage.example.com/signed-get' });
    });

    it('the legacy uploadEventImage method no longer exists on the service', () => {
      expect((service as any).uploadEventImage).toBeUndefined();
    });
  });
});
