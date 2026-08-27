export type Locale = "ko" | "en";

export type TodoStatus = "new" | "in_progress" | "done" | "cancelled";

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  nickname?: string;
  memoDefaultShared?: boolean;
  notificationsEnabled?: boolean;
  voiceInputEnabled?: boolean;
  // When true, the mic's start/stop cues use a short vibration instead of a
  // sound (falls back to sound on devices without the Vibration API, e.g.
  // iOS Safari, rather than giving no feedback at all).
  voiceInputVibrate?: boolean;
  colorCode: string;
  locale: Locale;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
  status?: "active" | "completed";
  color?: string;
  order?: number;
  lastRead?: Record<string, number>;
}

export interface Todo {
  id: string;
  text: string;
  status: TodoStatus;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
  completedAt: number | null;
}

export interface Memo {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
  sharedWith: string[];
}

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  authorId: string;
  authorColor: string;
  labelColor?: string;
  createdAt: number;
  source?: { type: "memo" | "todo"; id: string };
  // Set when this event was auto-created from a date range ("7/5~7/7 교육"):
  // one document per day, all sharing rangeId so the schedule list can show
  // them as a single period and edit/delete them as a group.
  rangeId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
}
