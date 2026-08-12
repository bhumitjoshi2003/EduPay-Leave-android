export interface PaymentHistory {
    studentId: string;
    paymentId: string;
    studentName: string;
    /** In paise (Payment.amountPaid on the backend, matching Razorpay's own convention) —
     * divide by 100 before formatting as currency. platformFee below is a genuine rupee
     * int, not paise; the two fields on this same entity use different units — always
     * double-check which is which. */
    amountPaid: number;
    paymentDate: string;
    status: string;
    className: string;
    platformFee: number;
}