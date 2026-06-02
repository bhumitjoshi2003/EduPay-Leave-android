export interface SchoolHoliday {
    id?: number;
    startDate: string;
    endDate: string;
    name: string;
    holidayType: string;
    affectsAll: boolean;
    academicYear?: string;
}
