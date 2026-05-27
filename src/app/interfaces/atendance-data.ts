export interface AttendanceData {
    studentId: string;
    chargePaid: boolean;
    date: string;
    className: string;
    classId?: number;
    sectionId?: number;
    status?: 'ABSENT' | 'PRESENT' | 'HALF_DAY' | 'LATE' | 'EXCUSED';
    markedBy?: string;
}