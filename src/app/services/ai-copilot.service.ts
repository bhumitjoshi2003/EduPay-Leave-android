import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiChatResponse {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class AiCopilotService {
  private readonly url = `${environment.apiUrl}/ai/chat`;
  private readonly streamUrl = `${environment.apiUrl}/ai/chat/stream`;

  constructor(private http: HttpClient) {}

  /** Non-streaming — kept for compatibility. Prefer sendStream() for the chat panel. */
  send(message: string, conversationId: string): Observable<AiChatResponse> {
    return this.http.post<AiChatResponse>(this.url, { message, conversationId });
  }

  /**
   * Streams the assistant's reply. Uses HttpClient (not raw fetch) specifically so
   * the existing auth interceptor still runs — it's what attaches withCredentials
   * and the X-School-Slug header and handles 401 refresh-and-retry. `observe: 'events'`
   * + `reportProgress: true` over XHR gives HttpDownloadProgressEvent.partialText: the
   * full response body accumulated so far, re-emitted each time more of it arrives.
   * The component diffs against what it's already appended to get just the new text.
   */
  sendStream(message: string, conversationId: string): Observable<HttpEvent<string>> {
    return this.http.post(this.streamUrl, { message, conversationId }, {
      observe: 'events',
      reportProgress: true,
      responseType: 'text',
    });
  }
}
