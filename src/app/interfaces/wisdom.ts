export interface WisdomPage<T> { content: T[]; number: number; totalPages: number; totalElements: number; first: boolean; last: boolean; }
export interface Thought { id: number; version: number; schoolId: number | null; body: string; audience: string; active: boolean; }
export interface ThoughtOverride { id: number; thoughtId: number; displayDate: string; audience: string; }
export interface Scripture { id: number; chapter: number; verse: number; sanskrit: string; transliteration: string; translation: string; sourceName: string; sourceUrl: string; license: string; sourceVersion: string; themes: string; }
export interface Teaching { id: number; version: number; title: string; scripture: Scripture; simpleMeaning: string; understanding: string; lesson: string; publicationDate: string | null; publicationZone: string | null; status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'; }
export interface WisdomDashboard { thought: { date: string; body: string; audience: string; overridden: boolean }; teaching: Teaching | null; today: string; timezone: string; }
export interface WisdomStatus { today: string; timezone: string; upcomingScheduled: boolean; }
export interface TeachingInput { verseId: number; title: string; simpleMeaning: string; understanding: string; lesson: string; version: number; }
export interface VerseSuggestion { scripture: Scripture; rationale: string; }
