import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FeeHead } from '../interfaces/fee-head';

@Injectable({
  providedIn: 'root'
})
export class FeeHeadService {
  private apiUrl = `${environment.apiUrl}/fee-heads`;

  constructor(private http: HttpClient) {}

  getActiveFeeHeads(): Observable<FeeHead[]> {
    return this.http.get<FeeHead[]>(this.apiUrl);
  }

  getAllFeeHeads(): Observable<FeeHead[]> {
    return this.http.get<FeeHead[]>(`${this.apiUrl}/all`);
  }

  createFeeHead(feeHead: FeeHead): Observable<FeeHead> {
    return this.http.post<FeeHead>(this.apiUrl, feeHead);
  }

  updateFeeHead(id: number, feeHead: FeeHead): Observable<FeeHead> {
    return this.http.put<FeeHead>(`${this.apiUrl}/${id}`, feeHead);
  }
}
