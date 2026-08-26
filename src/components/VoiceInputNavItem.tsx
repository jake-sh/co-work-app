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
interface SpeechRecognitionResultListLike {
  length: number;
  [i: number]: { [i: number]: { transcript: string } };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: SpeechRecognitionResultListLike; resultIndex?: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

// Tap = listen once, auto-stop on silence (unchanged default behavior).
// Hold for this long = switch to "keeps listening through pauses" mode,
// which only stops when the user taps again.
const LONG_PRESS_MS = 2000;

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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const accumulatedTextRef = useRef("");

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
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

  const startListening = (continuous: boolean) => {
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
    recognition.continuous = continuous;
    recognition.interimResults = false;

    if (continuous) {
      // Held mode: browser fires onresult per finished segment (not the
      // full transcript each time), so accumulate across calls and only
      // hand it off once the user taps again to stop.
      accumulatedTextRef.current = "";
      recognition.onresult = (event) => {
        let text = "";
        for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
          text += event.results[i]?.[0]?.transcript ?? "";
        }
        accumulatedTextRef.current += text;
      };
      recognition.onend = () => {
        const text = accumulatedTextRef.current.trim();
        accumulatedTextRef.current = "";
        if (text) {
          onTranscript(text);
        } else {
          setStatus("idle");
        }
      };
    } else {
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
        if (transcript) {
          onTranscript(transcript);
        } else {
          setStatus("idle");
        }
      };
      recognition.onend = () => {
        // Only idle out on end if nothing else has already moved the state
        // forward (e.g. onresult already kicked off "processing").
        setStatus((s) => (s === "listening" ? "idle" : s));
      };
    }

    recognition.onerror = () => {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    };
    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  };

  const onPointerDown = () => {
    if (status === "listening") {
      // Re-tap while listening (tap or held) always stops immediately.
      recognitionRef.current?.stop();
      return;
    }
    if (status !== "idle") return;

    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      startListening(true);
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    if (!longPressFiredRef.current) {
      // Released before the long-press threshold — treat as a normal tap.
      startListening(false);
    }
  };

  const onPointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  if (!(profile?.voiceInputEnabled ?? false) || !currentProject) return null;

  return (
    <>
      {toast && (toast.memos.length > 0 || toast.todos.length > 0 || toast.events.length > 0) && (
        // Sits just above BottomNav's top divider: 61px is that nav row's
        // measured height (icon + label + padding), +1px for the divider
        // itself, +8px of breathing room, plus the device's safe-area inset
        // since the nav pads for that too.
        <div
          className="fixed inset-x-5 z-30 flex flex-col items-center text-center text-voice-toast"
          style={{ bottom: "calc(70px + env(safe-area-inset-bottom, 0px))" }}
        >
          <p className="mb-1.5 text-xs font-semibold">{t.voiceInput.addedTitle}</p>
          <ul className="flex w-full flex-col items-center gap-1 text-sm">
            {toast.events.map((event, i) => (
              <li key={`event-${i}`} className="flex max-w-full items-center gap-2">
                <CalendarDays size={14} className="shrink-0" />
                <span className="truncate">{event}</span>
              </li>
            ))}
            {toast.memos.map((memo, i) => (
              <li key={`memo-${i}`} className="flex max-w-full items-center gap-2">
                <StickyNote size={14} className="shrink-0" />
                <span className="truncate">{memo}</span>
              </li>
            ))}
            {toast.todos.map((todo, i) => (
              <li key={`todo-${i}`} className="flex max-w-full items-center gap-2">
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
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerCancel}
          aria-label={t.voiceInput.label}
          title={status === "error" ? t.voiceInput.error : undefined}
          style={{ touchAction: "none" }}
          className="flex h-full w-full flex-col items-center justify-center text-nav-inactive"
        >
          <span
            className={clsx(
              "flex h-10 w-10 items-center justify-center rounded-full",
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
        </button>
      </li>
    </>
  );
}
