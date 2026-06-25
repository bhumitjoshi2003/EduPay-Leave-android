import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AssessmentGroup {
  id: number;
  session: string;
  className: string;
  name: string;
  displayName?: string;
  groupType: 'EXAM_BASED' | 'GROUP_BASED';
  displayOrder: number;
  examMappings?: ExamMappingItem[];
  compositions?: CompositionItem[];
}

export interface ExamMappingItem {
  id?: number;
  examConfigId: number;
  examName?: string;
  weightage: number;   // fraction: 0.20 = 20%
  displayOrder: number;
}

export interface CompositionItem {
  id?: number;
  childGroupId: number;
  childGroupName?: string;
  weightage: number;   // fraction: 0.50 = 50%
  displayOrder: number;
}

export interface AssessmentGroupRequest {
  session: string;
  className: string;
  name: string;
  displayName?: string;
  groupType: 'EXAM_BASED' | 'GROUP_BASED';
  displayOrder?: number;
  examMappings?: ExamMappingRequest[];
  compositions?: CompositionRequest[];
}

export interface ExamMappingRequest {
  examConfigId: number;
  weightage: number;
  displayOrder?: number;
}

export interface CompositionRequest {
  childGroupId: number;
  weightage: number;
  displayOrder?: number;
}

export interface WeightedGroupResult {
  groupId: number;
  groupName: string;
  groupType: string;
  weightedPercentage: number;
  subjectResults: SubjectWeightedResult[];
  examBreakdowns?: ExamBreakdown[];
  groupBreakdowns?: GroupBreakdown[];
  rank: number;
}

export interface SubjectWeightedResult {
  subjectName: string;
  weightedPercentage: number;
}

export interface ExamBreakdown {
  examId: number;
  examName: string;
  obtained: number;
  max: number;
  percentage: number;
  weightage: number;
  contribution: number;
}

export interface GroupBreakdown {
  groupId: number;
  groupName: string;
  percentage: number;
  weightage: number;
  contribution: number;
}

@Injectable({ providedIn: 'root' })
export class AssessmentGroupService {

  private base = `${environment.apiUrl}/assessment-groups`;

  constructor(private http: HttpClient) {}

  getGroups(session: string, className: string): Observable<AssessmentGroup[]> {
    const params = new HttpParams().set('session', session).set('className', className);
    return this.http.get<AssessmentGroup[]>(this.base, { params, withCredentials: true });
  }

  getGroup(id: number): Observable<AssessmentGroup> {
    return this.http.get<AssessmentGroup>(`${this.base}/${id}`, { withCredentials: true });
  }

  createGroup(req: AssessmentGroupRequest): Observable<AssessmentGroup> {
    return this.http.post<AssessmentGroup>(this.base, req, { withCredentials: true });
  }

  updateGroup(id: number, req: AssessmentGroupRequest): Observable<AssessmentGroup> {
    return this.http.put<AssessmentGroup>(`${this.base}/${id}`, req, { withCredentials: true });
  }

  deleteGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { withCredentials: true });
  }

  computeForStudent(groupId: number, studentId: string, session: string): Observable<WeightedGroupResult> {
    const params = new HttpParams().set('studentId', studentId).set('session', session);
    return this.http.get<WeightedGroupResult>(`${this.base}/${groupId}/compute`, { params, withCredentials: true });
  }
}
