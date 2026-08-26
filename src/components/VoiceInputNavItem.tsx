"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { CalendarDays, CheckSquare, Loader2, Mic, MicOff, StickyNote } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { structureVoiceInput, type VoiceInputItem } from "@/lib/data/voiceInput";
import { addMemo } from "@/lib/data/memos";
import { addTodo } from "@/lib/data/todos";
import { addEvent } from "@/lib/data/schedule";

type Status = "idle" | "listening" | "processing" | "error";

// Minimal shape of the Web Speech API this component needs — not in
// TypeScript's DOM lib (and only the webkit-prefixed constructor exists in
// most browsers), so declared locally rather than guessed as a global.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Lives as the 4th of 7 BottomNav items (between memo and schedule) instead
// of a free-floating draggable button — that avoided overlapping other UI
// (e.g. chat's send button) only by letting the user drag it out of the way;
// a dedicated nav slot sidesteps the collision entirely.
export function VoiceInputNavItem() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [toast, setToast] = useState<{ memos: string[]; todos: string[]; events: string[] } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((items: VoiceInputItem[]) => {
    const memos = items
      .filter((i) => i.type === "memo")
      .map((i) => i.title || i.body || "")
      .filter(Boolean);
    const todos = items
      .filter((i) => i.type === "todo")
      .map((i) => i.text || "")
      .filter(Boolean);
    const events = items
      .filter((i) => i.type === "event")
      .map((i) => (i.time ? `${i.date} ${i.time} ${i.title ?? ""}` : `${i.date} ${i.title ?? ""}`).trim())
      .filter(Boolean);
    setToast({ memos, todos, events });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const onTranscript = useCallback(
    async (text: string) => {
      if (!currentProject || !profile) return;
      setStatus("processing");
      try {
        const items = await structureVoiceInput(text);
        const defaultShared = profile.memoDefaultShared ?? true;
        for (const item of items) {
          if (item.type === "memo") {
            await addMemo(
              currentProject.id,
              item.title ?? "",
              item.body ?? "",
              profile.uid,
              profile.displayName,
              profile.colorCode,
              defaultShared ? currentProject.memberIds ?? [] : []
            );
          } else if (item.type === "todo" && item.text) {
            await addTodo(currentProject.id, item.text, profile.uid, profile.displayName, profile.colorCode);
          } else if (item.type === "event" && item.title && item.date) {
            await addEvent(
              currentProject.id,
              item.title,
              item.date,
              item.time ?? null,
              profile.uid,
              profile.colorCode
            );
          }
        }
        if (items.length > 0) showToast(items);
        setStatus("idle");
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2500);
      }
    },
    [currentProject, profile, showToast]
  );

  const onClick = () => {
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    if (status !== "idle") return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    const recognition = new Ctor();
    // Always Korean regardless of the app's UI language — dictated notes are
    // almost always spoken in Korean (often with the odd English word mixed
    // in, e.g. "다음주 gui수정"), and tying this to the UI language meant
    // switching the app to English made Korean speech get forced through
    // English recognition instead.
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        onTranscript(transcript);
      } else {
        setStatus("idle");
      }
    };
    recognition.onerror = () => {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    };
    recognition.onend = () => {
      // Only idle out on end if nothing else has already moved the state
      // forward (e.g. onresult already kicked off "processing").
      setStatus((s) => (s === "listening" ? "idle" : s));
    };
    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  };

  if (!(profile?.voiceInputEnabled ?? false) || !currentProject) return null;

  return (
    <>
      {toast && (toast.memos.length > 0 || toast.todos.length > 0 || toast.events.length > 0) && (
        <div className="fixed inset-x-5 bottom-24 z-30 text-voice-toast">
          <p className="mb-1.5 text-xs font-semibold">{t.voiceInput.addedTitle}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {toast.events.map((event, i) => (
              <li key={`event-${i}`} className="flex items-center gap-2">
                <CalendarDays size={14} className="shrink-0" />
                <span className="truncate">{event}</span>
              </li>
            ))}
            {toast.memos.map((memo, i) => (
              <li key={`memo-${i}`} className="flex items-center gap-2">
                <StickyNote size={14} className="shrink-0" />
                <span className="truncate">{memo}</span>
              </li>
            ))}
            {toast.todos.map((todo, i) => (
              <li key={`todo-${i}`} className="flex items-center gap-2">
                <CheckSquare size={14} className="shrink-0" />
                <span className="truncate">{todo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <li className="flex-1">
        <button
          type="button"
          onClick={onClick}
          aria-label={t.voiceInput.label}
          title={status === "error" ? t.voiceInput.error : undefined}
          className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-nav-inactive"
        >
          <span
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-full",
              (status === "listening" || status === "error") && "bg-red-500 text-white",
              (status === "idle" || status === "processing") && "bg-accent text-accent-content"
            )}
          >
            {status === "processing" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : status === "error" ? (
              <MicOff size={18} />
            ) : (
              <Mic size={18} className={status === "listening" ? "animate-pulse" : undefined} />
            )}
          </span>
          <span>{t.nav.ai}</span>
        </button>
      </li>
    </>
  );
}
