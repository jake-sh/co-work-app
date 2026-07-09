"use client";

import { useMemo, useRef, useState } from "react";
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
import {
  addEvent,
  deleteEvent,
  deleteEventsByRange,
  updateEvent,
  updateEventColor,
  updateEventsByRange,
} from "@/lib/data/schedule";
import { getHolidayName } from "@/lib/holidays";
import { useData } from "@/lib/context/DataContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput, SingleLineInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ScheduleEvent } from "@/types";

const LABEL_COLORS = ["#9b9b9b", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

function resolveColor(ev: ScheduleEvent): string {
  if (ev.labelColor) return ev.labelColor;
  if (ev.title.includes("팀장")) return "#3b82f6";
  if (ev.title.includes("소장")) return "#eab308";
  if (ev.title.includes("센터장")) return "#f97316";
  if (ev.title.includes("본부장")) return "#ef4444";
  if (/ceo|씨이오/i.test(ev.title)) return "#a855f7";
  return "#9b9b9b";
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function displayTitle(ev: ScheduleEvent): string {
  if (!ev.rangeStart || !ev.rangeEnd) return ev.title;
  return `${formatShortDate(ev.rangeStart)}~${formatShortDate(ev.rangeEnd)} ${ev.title}`;
}

function cellLabel(title: string): string {
  const stripped = title
    .replace(/^(\d+월\s*\d+일|\d+\/\d+|\d+\.\d+)\s*/, "")
    .replace(/^((오전|오후)\d+시(\d+분)?|\d{1,2}:\d{2})\s*/, "")
    .trim();
  return (stripped || title).slice(0, 5);
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const { events } = useData();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

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

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const swipeStartX = useRef(0);

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
    const ev = events.find((e) => e.id === editingId);
    if (ev?.rangeId) {
      // A ranged event's title/time is shared across every day in the
      // period; the date itself isn't editable here (see the read-only
      // range display in the edit form) since shifting a multi-day period
      // isn't a single-date edit.
      await updateEventsByRange(currentProject.id, ev.rangeId, editTitle.trim(), editTime || null);
    } else {
      await updateEvent(currentProject.id, editingId, editTitle.trim(), editDate, editTime || null);
    }
    setEditingId(null);
  };

  const onDeleteEvent = async (ev: ScheduleEvent) => {
    if (ev.rangeId) {
      await deleteEventsByRange(currentProject.id, ev.rangeId);
    } else {
      await deleteEvent(currentProject.id, ev.id);
    }
    setEditingId(null);
  };

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  const goToToday = () => { setMonth(new Date()); setSelectedDate(today); };

  const onTouchStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) > 50) setMonth((m) => dx < 0 ? addMonths(m, 1) : subMonths(m, 1));
  };

  return (
    <>
      <div className="sticky top-0 z-[1] bg-bg-base px-5 pt-4 pb-3">
        <h1 className="mb-4 text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
          {t.schedule.title}
        </h1>

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
            const holidayName = getHolidayName(key);
            const dayEvents = eventsByDate[key] ?? [];
            const eventSlots = holidayName ? 2 : 3;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={clsx(
                  "flex aspect-square flex-col items-center justify-start rounded-lg pt-1.5",
                  key === selectedDate && "bg-white text-black",
                  key !== selectedDate && key === today && "border border-white/50",
                  key !== selectedDate && isSameMonth(day, month) && "text-text-primary",
                  key !== selectedDate && !isSameMonth(day, month) && "text-text-disabled"
                )}
              >
                <span
                  className={clsx(
                    "text-[16.5px]",
                    key !== selectedDate &&
                      isSameMonth(day, month) &&
                      (holidayName || day.getDay() === 0
                        ? "text-red-400"
                        : day.getDay() === 6 && "text-blue-400")
                  )}
                >
                  {format(day, "d")}
                </span>
                {(holidayName || dayEvents.length > 0) && (
                  <div className="mt-0.5 flex w-full flex-col items-center gap-0.5 px-0.5 leading-none">
                    {holidayName && (
                      <span className="w-full truncate text-center text-[8px] text-red-400">
                        {holidayName}
                      </span>
                    )}
                    {dayEvents.slice(0, eventSlots).map((ev) => (
                      <span
                        key={ev.id}
                        className="w-full truncate text-center text-[8px]"
                        style={{ color: resolveColor(ev) }}
                      >
                        {cellLabel(ev.title)}
                      </span>
                    ))}
                    {dayEvents.length > eventSlots && (
                      <span className="text-[8px] text-text-disabled">
                        +{dayEvents.length - eventSlots}
                      </span>
                    )}
                  </div>
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
      </div>

      <div className="px-5 pb-10">
        {adding && (
          <Card className="mt-3 flex flex-col gap-2">
            <SingleLineInput
              placeholder={t.schedule.eventTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              enterKeyHint="done"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) onAdd();
              }}
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
                      <SingleLineInput
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t.schedule.eventTitle}
                        enterKeyHint="done"
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editTitle.trim()) saveEdit();
                        }}
                      />
                      {ev.rangeId ? (
                        <p className="text-xs text-text-secondary">
                          {formatShortDate(ev.rangeStart!)}~{formatShortDate(ev.rangeEnd!)}
                        </p>
                      ) : (
                        <TextInput
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                      )}
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
                          onClick={() => onDeleteEvent(ev)}
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
                    className="flex flex-col rounded-card bg-surface-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                    <button
                      onClick={() => setColorPickerId((id) => id === ev.id ? null : ev.id)}
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: resolveColor(ev) }}
                    />
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm">{displayTitle(ev)}</span>
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
                    </div>
                    {colorPickerId === ev.id && (
                      <div className="mt-2 flex gap-2 pl-5">
                        {LABEL_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => {
                              updateEventColor(currentProject.id, ev.id, color);
                              setColorPickerId(null);
                            }}
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                )
              )
          )}
        </ul>
      </div>
    </>
  );
}
