import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FeeStructureRule } from '../interfaces/fee-rule';

@Injectable({
  providedIn: 'root'
})
export class FeeRuleService {
  private apiUrl = `${environment.apiUrl}/fee-rules`;

  constructor(private http: HttpClient) {}

  getRulesBySession(sessionId: number): Observable<FeeStructureRule[]> {
    return this.http.get<FeeStructureRule[]>(`${this.apiUrl}/session/${sessionId}`);
  }

  getRulesBySessionAndClass(sessionId: number, className: string): Observable<FeeStructureRule[]> {
    return this.http.get<FeeStructureRule[]>(`${this.apiUrl}/session/${sessionId}/class/${className}`);
  }

  saveRulesForClass(sessionId: number, className: string, rules: FeeStructureRule[]): Observable<FeeStructureRule[]> {
    return this.http.put<FeeStructureRule[]>(`${this.apiUrl}/session/${sessionId}/class/${className}`, rules);
  }
}
