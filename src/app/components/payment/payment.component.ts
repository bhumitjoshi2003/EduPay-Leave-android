import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, NgZone } from '@angular/core';
import { EMPTY } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';
import { RazorpayService, RazorpayOrderResponse, RazorpayPaymentResponse } from '../../services/razorpay.service';
import { PaymentData } from '../../interfaces/payment-data';
import Swal from 'sweetalert2';
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
    private logger: LoggerService
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
      Swal.fire({
        icon: 'warning',
        title: 'Payment Error',
        text: 'Payment data or student ID is missing.',
      }).then(() => {
        this.paymentProcessCompleted.emit();
      });
      return;
    }
    this.loadRazorpayScript()
      .then(() => this.loadStudentDetails(this.paymentData.studentId))
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Payment Unavailable',
          text: 'Could not load the payment gateway. Please check your internet connection and try again.',
        }).then(() => this.paymentProcessCompleted.emit());
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
          Swal.fire({
            icon: 'warning',
            title: 'Payment Error',
            text: 'Payment data or student details are missing.',
          }).then(() => this.paymentProcessCompleted.emit());
          return EMPTY;
        }
        this.paymentData.totalAmount *= 100;
        return this.razorpayService.createOrder(this.paymentData);
      })
    ).subscribe({
      next: (response: RazorpayOrderResponse) => {
        const options = {
          key: response.razorpayKey,
          amount: response.amount,
          currency: 'INR',
          name: 'Indra Academy Sr. Sec. School',
          description: 'IAS Fee Payment',
          order_id: response.orderId,
          prefill: {
            name: this.studentDetails.name || '',
            email: this.studentDetails.email || '',
            contact: this.studentDetails.phoneNumber || ''
          },
          theme: { color: '#3399cc' },
          method: { netbanking: true, card: true, upi: true, wallet: false },
          handler: (paymentResponse: RazorpayPaymentResponse) => {
            this.verifyPayment(paymentResponse, response);
          },
          modal: {
            ondismiss: () => {
              this.ngZone.run(() => this.paymentProcessCompleted.emit());
              Swal.fire({
                icon: 'warning',
                title: 'Payment Cancelled!',
                text: 'Please try again if you wish to proceed.',
                confirmButtonText: 'Okay',
                confirmButtonColor: '#ff6b6b',
                background: '#fef2f2',
                color: '#b91c1c',
                timer: 4000,
                timerProgressBar: true
              });
            }
          }
        };
        const rzp = new Razorpay(options);
        rzp.open();
      },
      error: (error) => {
        this.logger.error('Error fetching student details for payment:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load student details for payment.',
        }).then(() => this.paymentProcessCompleted.emit());
      }
    });
  }

  verifyPayment(paymentResponse: RazorpayPaymentResponse, orderDetails: RazorpayOrderResponse) {
    this.razorpayService.verifyPayment(paymentResponse, orderDetails).subscribe({
      next: (result) => {
        if (result.success) {
          this.paymentSuccess.emit(paymentResponse);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Verification Failed!',
            text: 'Payment could not be verified. Please contact support.',
          }).then(() => {
            this.paymentProcessCompleted.emit();
          });
        }
      },
      error: (err) => {
        this.logger.error('Error during payment verification:', err);
        Swal.fire({
          icon: 'error',
          title: 'Verification Error!',
          text: 'An error occurred during payment verification. Please try again or contact support.',
        }).then(() => {
          this.paymentProcessCompleted.emit();
        });
      }
    });
  }
}