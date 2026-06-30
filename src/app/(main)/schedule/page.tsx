"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addEvent, subscribeEvents } from "@/lib/data/schedule";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ScheduleEvent } from "@/types";

export default function SchedulePage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!currentProject) return;
    return subscribeEvents(currentProject.id, setEvents);
  }, [currentProject]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    for (const ev of events) {
      (map[ev.date] ??= []).push(ev);
    }
    return map;
  }, [events]);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const onAdd = async () => {
    if (!profile || !title.trim()) return;
    await addEvent(currentProject.id, title.trim(), selectedDate, time || null, profile.uid, profile.colorCode);
    setTitle("");
    setTime("");
    setAdding(false);
  };

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  return (
    <div className="px-5 pt-8">
      <h1 className="mb-4 text-3xl font-bold">{t.schedule.title}</h1>

      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="text-text-secondary">
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm font-semibold">{format(month, "yyyy.MM")}</p>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="text-text-secondary">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const hasEvents = !!eventsByDate[key]?.length;
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              className={clsx(
                "flex aspect-square flex-col items-center justify-center rounded-lg",
                key === selectedDate && "bg-white text-black",
                key !== selectedDate && isSameMonth(day, month) && "text-text-primary",
                key !== selectedDate && !isSameMonth(day, month) && "text-text-disabled"
              )}
            >
              <span>{format(day, "d")}</span>
              {hasEvents && (
                <span
                  className={clsx(
                    "mt-0.5 h-1 w-1 rounded-full",
                    key === selectedDate ? "bg-black" : "bg-text-secondary"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold">{selectedDate}</p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-pill bg-surface-pill px-3 py-1.5 text-xs font-semibold"
        >
          <Plus size={14} />
          {t.schedule.addEvent}
        </button>
      </div>

      {adding && (
        <Card className="mt-3 flex flex-col gap-2">
          <TextInput
            placeholder={t.schedule.eventTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Button onClick={onAdd} disabled={!title.trim()}>
            {t.schedule.save}
          </Button>
        </Card>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {selectedEvents.length === 0 && !adding ? (
          <EmptyState message={t.schedule.empty} />
        ) : (
          selectedEvents
            .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
            .map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ev.authorColor }}
                />
                <span className="flex-1 text-sm">{ev.title}</span>
                {ev.time && <span className="text-xs text-text-secondary">{ev.time}</span>}
              </li>
            ))
        )}
      </ul>
    </div>
  );
}
