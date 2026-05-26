import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PaymentData } from '../interfaces/payment-data';
import { environment } from '../../environments/environment';

export interface RazorpayOrderResponse {
  razorpayKey: string;
  amount: number;
  orderId: string;
  schoolName: string;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayVerifyResponse {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {

  private baseUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) { }

  createOrder(paymentData: PaymentData): Observable<RazorpayOrderResponse> {
    return this.http.post<RazorpayOrderResponse>(`${this.baseUrl}/create`, paymentData);
  }

  verifyPayment(paymentResponse: RazorpayPaymentResponse, orderDetails: RazorpayOrderResponse): Observable<RazorpayVerifyResponse> {
    return this.http.post<RazorpayVerifyResponse>(`${this.baseUrl}/verify`, { paymentResponse, orderDetails });
  }
}
