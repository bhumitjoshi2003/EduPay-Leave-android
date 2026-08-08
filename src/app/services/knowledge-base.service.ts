import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface KnowledgeDocument {
  id: number;
  title: string;
  category: string;
  originalFilename: string;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  errorMessage?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly baseUrl = `${environment.apiUrl}/knowledge-base`;

  constructor(private http: HttpClient) {}

  list(): Observable<KnowledgeDocument[]> {
    return this.http.get<KnowledgeDocument[]>(this.baseUrl);
  }

  upload(file: File, title: string, category: string): Observable<KnowledgeDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('category', category);
    return this.http.post<KnowledgeDocument>(this.baseUrl, form);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  download(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/download`, { responseType: 'blob' });
  }
}
