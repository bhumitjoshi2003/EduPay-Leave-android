export interface SchoolHoliday {
    id?: number;
    date: string;
    name: string;
    holidayType: string;
    affectsAll: boolean;
    academicYear?: string;
}
