export type ParentStatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';
export type ParentLinkedFilter = 'ALL' | 'LINKED' | 'UNLINKED';

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
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface ParentProfile {
  parent: ParentSummary;
  children: ChildAccess[];
}

export interface ParentDirectoryStats {
  totalParents: number;
  activeParents: number;
  linkedStudents: number;
  unlinkedParents: number;
}

/** parentId is never supplied by the caller — Edunexify generates it (par_YYnnnnnn).
 *  email is required (unlike before): it's the only way to deliver the account setup link,
 *  since no temporary password is ever admin-typed or exposed (Option A onboarding). */
export interface CreateParentRequest {
  name: string;
  email: string;
  phoneNumber: string;
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
  effectiveFrom: string;
  effectiveUntil?: string | null;
}
