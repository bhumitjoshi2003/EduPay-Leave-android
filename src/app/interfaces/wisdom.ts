export interface WisdomPage<T> { content: T[]; number: number; totalPages: number; totalElements: number; first: boolean; last: boolean; }
export interface Thought { id: number; version: number; schoolId: number | null; body: string; audience: string; active: boolean; }
export interface ThoughtOverride { id: number; thoughtId: number; displayDate: string; audience: string; }
export interface WisdomDashboard { thought: { date: string; body: string; audience: string; overridden: boolean }; today: string; timezone: string; }
export interface WisdomStatus { today: string; timezone: string; }
