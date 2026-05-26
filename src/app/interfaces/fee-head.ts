export interface FeeHead {
  id?: number;
  name: string;
  code: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ONE_TIME';
  dueMonths: string; // JSON array e.g. "[1,2,3,4,5,6,7,8,9,10,11,12]"
  optional: boolean;
  refundable: boolean;
  siblingDiscountPct?: number;
  displayOrder: number;
  active: boolean;
}
