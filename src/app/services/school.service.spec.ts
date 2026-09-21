import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SchoolService } from './school.service';
import { environment } from '../../environments/environment';

/** Android parity for the web direct-to-object-storage upload flow (school-level: logo and
 * report-card header, both using the fixed "self" entityId — no per-entity id below the school
 * itself). */
describe('SchoolService — direct-to-object-storage uploads', () => {
  let service: SchoolService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SchoolService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function aFile(): File {
    return new File(['fake-image-bytes'], 'logo.png', { type: 'image/png' });
  }

  it('uploadLogoDirect presigns with SCHOOL_LOGO purpose, PUTs directly, then completes', () => {
    const presignedPutUrl = 'https://object-storage.example.com/bucket/schools/1/school/logo/uuid.png?X-Amz-Signature=abc';
    service.uploadLogoDirect(aFile()).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/files/upload-request`);
    expect(req.request.body).toEqual({
      purpose: 'SCHOOL_LOGO',
      entityId: 'self',
      fileName: 'logo.png',
      contentType: 'image/png',
      size: aFile().size,
    });
    req.flush({
      objectKey: 'schools/1/school/logo/uuid.png',
      uploadUrl: presignedPutUrl,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      requiredHeaders: { 'Content-Type': 'image/png' },
    });

    const putReq = http.expectOne(presignedPutUrl);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.url).not.toContain(environment.apiUrl);
    putReq.flush({});

    http.expectOne(`${environment.apiUrl}/files/complete`).flush({ objectKey: 'schools/1/school/logo/uuid.png', displayUrl: 'https://object-storage.example.com/signed-get' });
  });

  it('uploadReportCardHeaderDirect presigns with REPORT_CARD_HEADER_IMAGE purpose', () => {
    service.uploadReportCardHeaderDirect(aFile()).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/files/upload-request`);
    expect(req.request.body.purpose).toBe('REPORT_CARD_HEADER_IMAGE');
    expect(req.request.body.entityId).toBe('self');

    req.flush({
      objectKey: 'schools/1/school/report-card-header/uuid.png',
      uploadUrl: 'https://object-storage.example.com/bucket/schools/1/school/report-card-header/uuid.png?X-Amz-Signature=abc',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      requiredHeaders: { 'Content-Type': 'image/png' },
    });
    http.expectOne('https://object-storage.example.com/bucket/schools/1/school/report-card-header/uuid.png?X-Amz-Signature=abc').flush({});
    http.expectOne(`${environment.apiUrl}/files/complete`).flush({ objectKey: 'schools/1/school/report-card-header/uuid.png', displayUrl: 'https://object-storage.example.com/signed-get' });
  });

  it('the legacy multipart upload methods no longer exist on the service (Phase 3 cleanup)', () => {
    expect((service as any).uploadLogo).toBeUndefined();
    expect((service as any).uploadReportCardHeader).toBeUndefined();
  });
});
