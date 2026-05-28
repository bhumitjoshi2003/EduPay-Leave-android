import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClassSubject {
  id: number;
  className: string;
  subjectName: string;
  optional: boolean;
  optionalGroup: string | null;
}

export interface CoreSubject {
  id: number;
  subjectName: string;
}

export interface AcademicStream {
  id: number;
  streamName: string;
  coreSubjects: CoreSubject[];
}

export interface OptionalSubject {
  id: number;
  subjectName: string;
}

export interface OptionalSubjectGroup {
  id: number;
  groupName: string;
  subjects: OptionalSubject[];
}

@Injectable({ providedIn: 'root' })
export class SubjectConfigService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Class subjects (1–10)
  getClassSubjects(className: string): Observable<ClassSubject[]> {
    return this.http.get<ClassSubject[]>(`${this.base}/subjects/class/${className}`);
  }

  addClassSubject(className: string, subjectName: string, optional = false, optionalGroup?: string): Observable<ClassSubject> {
    return this.http.post<ClassSubject>(`${this.base}/subjects/class`, {
      className, subjectName,
      optional: String(optional),
      ...(optional && optionalGroup ? { optionalGroup } : {})
    });
  }

  deleteClassSubject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/subjects/class/${id}`);
  }

  // Streams (11–12)
  getStreams(): Observable<AcademicStream[]> {
    return this.http.get<AcademicStream[]>(`${this.base}/streams`);
  }

  addStream(streamName: string): Observable<AcademicStream> {
    return this.http.post<AcademicStream>(`${this.base}/streams`, { streamName });
  }

  deleteStream(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/streams/${id}`);
  }

  addCoreSubject(streamId: number, subjectName: string): Observable<CoreSubject> {
    return this.http.post<CoreSubject>(`${this.base}/streams/${streamId}/subjects`, { subjectName });
  }

  deleteCoreSubject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/streams/subjects/${id}`);
  }

  // Optional groups
  getOptionalGroups(): Observable<OptionalSubjectGroup[]> {
    return this.http.get<OptionalSubjectGroup[]>(`${this.base}/optional-groups`);
  }

  addOptionalGroup(groupName: string): Observable<OptionalSubjectGroup> {
    return this.http.post<OptionalSubjectGroup>(`${this.base}/optional-groups`, { groupName });
  }

  deleteOptionalGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/optional-groups/${id}`);
  }

  addOptionalSubject(groupId: number, subjectName: string): Observable<OptionalSubject> {
    return this.http.post<OptionalSubject>(`${this.base}/optional-groups/${groupId}/subjects`, { subjectName });
  }

  deleteOptionalSubject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/optional-subjects/${id}`);
  }
}
