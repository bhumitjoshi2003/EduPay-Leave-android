export interface Admin {
    adminId: string;
    name: string;
    email: string;
    phoneNumber: string;
    dob: string;
    gender: string;
    schoolId?: number;
    createdAt?: string;
    updatedAt?: string;
    photoUrl?: string;
}