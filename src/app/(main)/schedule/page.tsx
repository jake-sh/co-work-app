"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronLeft, ChevronRight, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addEvent, deleteEvent, subscribeEvents, updateEvent } from "@/lib/data/schedule";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

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

  const startEdit = (ev: ScheduleEvent) => {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditDate(ev.date);
    setEditTime(ev.time ?? "");
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    await updateEvent(currentProject.id, editingId, editTitle.trim(), editDate, editTime || null);
    setEditingId(null);
  };

  const onDeleteEvent = async (eventId: string) => {
    await deleteEvent(currentProject.id, eventId);
    setEditingId(null);
  };

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const goToToday = () => { setMonth(new Date()); setSelectedDate(today); };

  const swipeStartX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) > 50) setMonth((m) => dx < 0 ? addMonths(m, 1) : subMonths(m, 1));
  };

  return (
    <div className="px-5 pt-8 pb-10">
      <h1 className="mb-4 text-3xl font-bold">{t.schedule.title}</h1>

      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="text-text-secondary">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{format(month, "yyyy.MM")}</p>
          <button
            onClick={goToToday}
            className="rounded-pill bg-surface-pill px-2 py-0.5 text-[11px] text-text-secondary"
          >
            {t.schedule.today}
          </button>
        </div>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="text-text-secondary">
          <ChevronRight size={20} />
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 text-center text-[11px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
                key !== selectedDate && key === today && "border border-white/50",
                key !== selectedDate && isSameMonth(day, month) && "text-text-primary",
                key !== selectedDate && !isSameMonth(day, month) && "text-text-disabled"
              )}
            >
              <span>{format(day, "d")}</span>
              {hasEvents && (
                <span
                  className={clsx(
                    "mt-0.5 w-full truncate px-0.5 text-center text-[8px] leading-none",
                    key === selectedDate ? "text-black" : "text-text-secondary"
                  )}
                >
                  {eventsByDate[key][0].title.slice(0, 5)}
                  {eventsByDate[key].length > 1 && `+${eventsByDate[key].length - 1}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold">{selectedDate}</p>
        <button
          onClick={() => { setAdding((v) => !v); setEditingId(null); }}
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
            .map((ev) =>
              editingId === ev.id ? (
                <li key={ev.id} className="rounded-card bg-surface-card px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <TextInput
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder={t.schedule.eventTitle}
                    />
                    <TextInput
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                    <TextInput
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveEdit} disabled={!editTitle.trim()} className="flex-1">
                        {t.schedule.save}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)} className="flex-1">
                        {t.schedule.cancel}
                      </Button>
                      <button
                        onClick={() => onDeleteEvent(ev.id)}
                        className="flex items-center justify-center rounded-xl bg-red-500/20 px-3 text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ) : (
                <li
                  key={ev.id}
                  className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.authorColor }}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{ev.title}</span>
                    {ev.source && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-text-secondary">
                        <Sparkles size={10} />
                        {ev.source.type === "memo" ? t.schedule.fromMemo : t.schedule.fromTodo}
                      </span>
                    )}
                  </div>
                  {ev.time && <span className="text-xs text-text-secondary">{ev.time}</span>}
                  <button
                    onClick={() => startEdit(ev)}
                    className="shrink-0 text-text-secondary"
                  >
                    <Pencil size={14} />
                  </button>
                </li>
              )
            )
        )}
      </ul>
    </div>
  );
}
