export interface Teacher {
  teacherId: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  dob?: string;
  gender?: string;
  classTeacher?: string | null;
  joiningDate?: string;
  photoUrl?: string;
}
