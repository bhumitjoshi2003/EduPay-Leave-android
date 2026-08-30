export interface ParentSummary {
  parentId: string;
  name: string;
  email: string | null;
  phoneNumber: string;
  active: boolean;
  linkedChildren: number;
}

export interface ChildAccess {
  relationshipId: number;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string | null;
  relationshipType: string;
  primaryGuardian: boolean;
  canViewAttendance: boolean;
  canViewFees: boolean;
  canPayFees: boolean;
  canViewResults: boolean;
  canViewTimetable: boolean;
  canManageLeave: boolean;
  pickupAuthorized: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface ParentProfile {
  parent: ParentSummary;
  children: ChildAccess[];
}

export interface CreateParentRequest {
  parentId: string;
  name: string;
  email?: string;
  phoneNumber: string;
  temporaryPassword: string;
}

export interface LinkStudentRequest {
  studentId: string;
  relationshipType: string;
  primaryGuardian: boolean;
  canViewAttendance: boolean;
  canViewFees: boolean;
  canPayFees: boolean;
  canViewResults: boolean;
  canViewTimetable: boolean;
  canManageLeave: boolean;
  pickupAuthorized: boolean;
  effectiveFrom: string;
  effectiveUntil?: string | null;
}
