import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, NgZone } from '@angular/core';
import { EMPTY } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';
import { RazorpayService, RazorpayOrderResponse, RazorpayPaymentResponse } from '../../services/razorpay.service';
import { PaymentData } from '../../interfaces/payment-data';
import { ToastService } from '../../services/toast.service';
import { StudentService } from '../../services/student.service';

declare var Razorpay: any;

@Component({
  selector: 'app-payment',
  imports: [],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentComponent {

  constructor(
    private razorpayService: RazorpayService,
    private studentService: StudentService,
    private ngZone: NgZone,
    private logger: LoggerService,
    private toast: ToastService
  ) { }

  @Input() paymentData: PaymentData = {
    totalAmount: 0,
    monthSelectionString: "000000000000",
    totalTuitionFee: 0,
    totalAnnualCharges: 0,
    totalLabCharges: 0,
    totalEcaProject: 0,
    totalBusFee: 0,
    totalExaminationFee: 0,
    studentId: "",
    studentName: "",
    className: "",
    session: "",
    paidManually: false,
    amountPaid: 0,
    additionalCharges: 0,
    lateFees: 0,
    platformFee: 0
  };

  @Input() disabled: boolean = false;
  @Output() paymentSuccess = new EventEmitter<any>();
  @Output() paymentProcessingStarted = new EventEmitter<void>();
  @Output() paymentProcessCompleted = new EventEmitter<void>();

  studentDetails: any;

  initiatePayment() {
    this.paymentProcessingStarted.emit();
    if (!this.paymentData || !this.paymentData.studentId) {
      this.toast.warning('Payment Error', 'Payment data or student ID is missing.');
      this.paymentProcessCompleted.emit();
      return;
    }
    this.loadRazorpayScript()
      .then(() => this.loadStudentDetails(this.paymentData.studentId))
      .catch(() => {
        this.toast.error('Payment Unavailable', 'Could not load the payment gateway. Please check your internet connection and try again.');
        this.paymentProcessCompleted.emit();
      });
  }

  private loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Already loaded
      if (typeof Razorpay !== 'undefined') { resolve(); return; }
      const existing = document.getElementById('razorpay-checkout-js');
      if (existing) {
        // Script tag exists but Razorpay not ready yet — wait for it
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject());
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }

  loadStudentDetails(studentId: string): void {
    this.studentService.getStudent(studentId).pipe(
      switchMap((student) => {
        this.studentDetails = student;
        if (!this.paymentData) {
          this.toast.warning('Payment Error', 'Payment data or student details are missing.');
          this.paymentProcessCompleted.emit();
          return EMPTY;
        }
        // Send amount in paise without mutating the original paymentData object
        const orderPayload = { ...this.paymentData, totalAmount: this.paymentData.totalAmount * 100 };
        return this.razorpayService.createOrder(orderPayload);
      })
    ).subscribe({
      next: (response: RazorpayOrderResponse) => {
        const options = {
          key: response.razorpayKey,
          amount: response.amount,
          currency: 'INR',
          name: response.schoolName,
          description: 'Fee Payment',
          order_id: response.orderId,
          prefill: {
            name: this.studentDetails.name || '',
            email: this.studentDetails.email || '',
            contact: this.studentDetails.phoneNumber || ''
          },
          theme: { color: '#3399cc' },
          method: { netbanking: true, card: true, upi: true, wallet: false },
          handler: (paymentResponse: RazorpayPaymentResponse) => {
            // Razorpay callbacks fire outside Angular zone — run() brings them back in
            this.ngZone.run(() => {
              if (!paymentResponse?.razorpay_payment_id) {
                this.logger.error('Razorpay handler called with missing payment response');
                this.paymentProcessCompleted.emit();
                return;
              }
              this.verifyPayment(paymentResponse, response);
            });
          },
          modal: {
            ondismiss: () => {
              this.ngZone.run(() => {
                this.paymentProcessCompleted.emit();
                this.toast.warning('Payment Cancelled!', 'Please try again if you wish to proceed.');
              });
            }
          }
        };
        const rzp = new Razorpay(options);
        // Handle payment failure (e.g. "Failure" option in test mode)
        rzp.on('payment.failed', (failureResponse: any) => {
          this.ngZone.run(() => {
            this.logger.error('Razorpay payment failed:', failureResponse.error);
            this.paymentProcessCompleted.emit();
            this.toast.error('Payment Failed!', failureResponse.error?.description || 'Your payment could not be processed. Please try again.');
          });
        });
        rzp.open();
      },
      error: (error) => {
        this.logger.error('Error creating payment order:', error);
        this.toast.error('Error', 'Failed to create payment order. Please try again.');
        this.paymentProcessCompleted.emit();
      }
    });
  }

  verifyPayment(paymentResponse: RazorpayPaymentResponse, orderDetails: RazorpayOrderResponse) {
    this.razorpayService.verifyPayment(paymentResponse, orderDetails).subscribe({
      next: (result) => {
        if (result.success) {
          this.paymentSuccess.emit(paymentResponse);
        } else {
          this.toast.error('Verification Failed!', 'Payment could not be verified. Please contact support.');
          this.paymentProcessCompleted.emit();
        }
      },
      error: (err) => {
        this.logger.error('Error during payment verification:', err);
        this.toast.error('Verification Error!', 'An error occurred during payment verification. Please try again or contact support.');
        this.paymentProcessCompleted.emit();
      }
    });
  }
}