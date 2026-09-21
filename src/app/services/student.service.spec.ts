import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StudentService } from './student.service';
import { environment } from '../../environments/environment';

/** Android parity for the web direct-to-object-storage upload flow. */
describe('StudentService — uploadStudentPhotoDirect', () => {
  let service: StudentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(StudentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function aFile(): File {
    return new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
  }

  it('presigns, PUTs directly to object storage, then completes — never through our own backend', () => {
    const presignedPutUrl = 'https://object-storage.example.com/bucket/schools/1/students/S1/profile/uuid.jpg?X-Amz-Signature=abc';
    service.uploadStudentPhotoDirect('S1', aFile()).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/files/upload-request`);
    expect(req.request.body).toEqual({
      purpose: 'STUDENT_PROFILE_PHOTO',
      entityId: 'S1',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      size: aFile().size,
    });
    req.flush({
      objectKey: 'schools/1/students/S1/profile/uuid.jpg',
      uploadUrl: presignedPutUrl,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      requiredHeaders: { 'Content-Type': 'image/jpeg' },
    });

    const putReq = http.expectOne(presignedPutUrl);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.url).not.toContain(environment.apiUrl);
    putReq.flush({});

    const completeReq = http.expectOne(`${environment.apiUrl}/files/complete`);
    expect(completeReq.request.body).toEqual({
      objectKey: 'schools/1/students/S1/profile/uuid.jpg',
      purpose: 'STUDENT_PROFILE_PHOTO',
      entityId: 'S1',
    });
    completeReq.flush({ objectKey: 'schools/1/students/S1/profile/uuid.jpg', displayUrl: 'https://object-storage.example.com/signed-get' });
  });

  it('the legacy multipart upload method no longer exists on the service (Phase 3 cleanup)', () => {
    expect((service as any).uploadStudentPhoto).toBeUndefined();
  });
});
