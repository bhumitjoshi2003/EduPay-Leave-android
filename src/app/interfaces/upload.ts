/** Response shapes for the shared direct-to-object-storage upload flow — see
 * ObjectStorageService/FileUploadRequestService on the backend. Every category
 * (teacher/student/admin photo, school logo, report-card header, event image) uses this exact
 * same POST /api/files/upload-request -> direct PUT -> POST /api/files/complete contract, only
 * varying the "purpose" and "entityId" fields sent in the request bodies. */

export interface UploadRequestResponse {
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface UploadCompleteResponse {
  objectKey: string;
  displayUrl: string;
}
