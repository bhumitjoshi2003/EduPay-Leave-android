import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeaveRequest } from '../interfaces/leave-request';
import { environment } from '../../environments/environment';

export interface LeaveApplication {
  id: number;
  studentId: string;
  studentName: string;
  leaveDate: string;
  reason: string;
  className: string;
  status: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

@Injectable({
  providedIn: 'root',
})

export class LeaveService {
  private apiUrl = `${environment.apiUrl}/leaves`;

  constructor(private http: HttpClient) { }

  applyLeave(leaveRequest: LeaveRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/apply-leave`, leaveRequest, { responseType: 'text', withCredentials: true });
  }

  getLeavesPaginated(
    page: number,
    size: number,
    className?: string,
    studentId?: string,
    date?: string,
    sortBy?: string,
    sortDir?: string
  ): Observable<PaginatedResponse<LeaveApplication>> {
    let params = new HttpParams()
      .append('page', page.toString())
      .append('size', size.toString());

    if (className && className !== 'all') {
      params = params.append('className', className);
    }
    if (studentId) {
      params = params.append('studentId', studentId);
    }
    if (date) {
      params = params.append('date', date);
    }
    if (sortBy) {
      params = params.append('sort', `${sortBy},${sortDir || 'asc'}`);
    }

    return this.http.get<PaginatedResponse<LeaveApplication>>(`${this.apiUrl}/student`, { params, withCredentials: true });
  }

  getLeavesByStudentId(
    studentId: string,
    page: number,
    size: number
  ): Observable<PaginatedResponse<LeaveApplication>> {
    const params = new HttpParams()
      .append('page', page.toString())
      .append('size', size.toString())
      .append('sort', 'leaveDate,desc');
    return this.http.get<PaginatedResponse<LeaveApplication>>(
      `${this.apiUrl}/student/${studentId}`, { params, withCredentials: true });
  }

  deleteLeave(studentId: string, leaveDate: string): Observable<string> {
    return this.http.delete(`${this.apiUrl}/delete/${studentId}/${leaveDate}`, { responseType: 'text', withCredentials: true });
  }

  deleteLeaveById(leaveId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${leaveId}`, { responseType: 'text', withCredentials: true });
  }

  updateLeaveStatus(leaveId: number, status: string): Observable<LeaveApplication> {
    return this.http.patch<LeaveApplication>(`${this.apiUrl}/${leaveId}/status`, { status }, { withCredentials: true });
  }

  getLeavesByDateAndClass(date: string, selectedClass: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/date/${date}/class/${selectedClass}`, { withCredentials: true });
  }
}

