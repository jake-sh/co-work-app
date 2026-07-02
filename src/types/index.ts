export type Locale = "ko" | "en";

export type TodoStatus = "new" | "in_progress" | "done";

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
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
}

export interface ChatMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
}
