// Shared data types used across the app.

/** 0 = Sunday ... 6 = Saturday (same as JavaScript Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A saved calendar event. Times are minutes after midnight (e.g. 10:30 AM = 630). */
export interface ScheduleEvent {
  id: string;
  title: string;
  /** Repeats every week on this day (class schedules). */
  weekday: Weekday;
  startMin: number;
  endMin: number;
  location?: string;
  organizer?: string;
  /** Which uploaded file this came from, if any. */
  sourceFileId?: string;
  /** Course code such as "IT 311", if known. */
  courseCode?: string;
  /** The student's own notes for this class. */
  notes?: string;
  /** How often it happens. Missing means every week. */
  repeat?: 'once' | 'daily' | 'weekly' | 'monthly';
  /** For one-time and monthly events: the (first) date, as YYYY-MM-DD. */
  date?: string;
}

/** How sure the OCR parser is about one extracted value. */
export type Confidence = 'high' | 'low' | 'missing';

export interface ExtractedField<T> {
  value: T | undefined;
  confidence: Confidence;
}

/** One event as read from a document, before the user verifies it. */
export interface ExtractedEvent {
  title: ExtractedField<string>;
  courseCode: ExtractedField<string>;
  weekday: ExtractedField<Weekday>;
  startMin: ExtractedField<number>;
  endMin: ExtractedField<number>;
  location: ExtractedField<string>;
  organizer: ExtractedField<string>;
  /** The original line(s) of text, shown to the user for comparison. */
  sourceText: string;
}

export type IssueKind = 'overlap' | 'travel' | 'workload';

export interface ScheduleIssue {
  kind: IssueKind;
  weekday: Weekday;
  /** Event ids involved. */
  eventIds: string[];
  message: string;
}

/** A busy block shared with a group. Deliberately has NO title, room, or organizer. */
export interface BusyBlock {
  weekday: Weekday;
  startMin: number;
  endMin: number;
}

export interface FreeSlot {
  weekday: Weekday;
  startMin: number;
  endMin: number;
  /** How many members are free in this slot. */
  freeCount: number;
  totalMembers: number;
}
