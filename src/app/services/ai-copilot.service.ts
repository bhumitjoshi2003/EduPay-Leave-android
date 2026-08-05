import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiChatResponse {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class AiCopilotService {
  private readonly url = `${environment.apiUrl}/ai/chat`;

  constructor(private http: HttpClient) {}

  send(message: string): Observable<AiChatResponse> {
    return this.http.post<AiChatResponse>(this.url, { message });
  }
}
