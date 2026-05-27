import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Section } from '../interfaces/section';

@Injectable({ providedIn: 'root' })
export class SectionService {
  private baseUrl = `${environment.apiUrl}/sections`;

  constructor(private http: HttpClient) {}

  getAllSections(): Observable<Section[]> {
    return this.http.get<Section[]>(this.baseUrl);
  }

  getSectionsForClass(classId: number): Observable<Section[]> {
    return this.http.get<Section[]>(`${this.baseUrl}/class/${classId}`);
  }

  createSection(section: Section): Observable<Section> {
    return this.http.post<Section>(this.baseUrl, section);
  }

  updateSection(id: number, section: Section): Observable<Section> {
    return this.http.put<Section>(`${this.baseUrl}/${id}`, section);
  }

  deleteSection(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
