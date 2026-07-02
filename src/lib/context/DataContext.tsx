"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useProjects } from "@/lib/context/ProjectContext";
import { subscribeTodos } from "@/lib/data/todos";
import { subscribeMemos } from "@/lib/data/memos";
import { subscribeEvents } from "@/lib/data/schedule";
import { subscribeMessages } from "@/lib/data/chat";
import type { ChatMessage, Memo, ScheduleEvent, Todo } from "@/types";

interface DataContextValue {
  todos: Todo[];
  memos: Memo[];
  events: ScheduleEvent[];
  messages: ChatMessage[];
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentProject } = useProjects();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!currentProject) return;
    const id = currentProject.id;
    const unsubs = [
      subscribeTodos(id, setTodos),
      subscribeMemos(id, setMemos),
      subscribeEvents(id, setEvents),
      subscribeMessages(id, setMessages),
    ];
    return () => unsubs.forEach((u) => u());
  }, [currentProject]);

  const value = useMemo<DataContextValue>(
    () => ({ todos, memos, events, messages }),
    [todos, memos, events, messages]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
