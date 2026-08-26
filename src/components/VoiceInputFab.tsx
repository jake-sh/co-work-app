"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { CheckSquare, Loader2, Mic, MicOff, StickyNote } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { structureVoiceInput, type VoiceInputItem } from "@/lib/data/voiceInput";
import { addMemo } from "@/lib/data/memos";
import { addTodo } from "@/lib/data/todos";

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

// Draggable position, persisted per-device (mirrors the fontScale/theme
// preferences pattern elsewhere in Settings). The button is free to float
// anywhere on screen so it can be moved off whatever it's currently
// overlapping (e.g. chat's send button).
const POSITION_STORAGE_KEY = "cowork.voiceFabPosition";
const BUTTON_SIZE = 56; // h-14 / w-14
const DRAG_THRESHOLD = 6;
// Placed well above the bottom nav / chat input row by default so it
// doesn't start out overlapping the send button; the user can drag it
// anywhere from there.
const DEFAULT_BOTTOM_OFFSET = 180;
const DEFAULT_RIGHT_OFFSET = 20;

interface Position {
  x: number;
  y: number;
}

function clampToViewport(pos: Position): Position {
  const maxX = Math.max(0, window.innerWidth - BUTTON_SIZE);
  const maxY = Math.max(0, window.innerHeight - BUTTON_SIZE);
  return {
    x: Math.min(Math.max(pos.x, 0), maxX),
    y: Math.min(Math.max(pos.y, 0), maxY),
  };
}

function getDefaultPosition(): Position {
  return clampToViewport({
    x: window.innerWidth - BUTTON_SIZE - DEFAULT_RIGHT_OFFSET,
    y: window.innerHeight - BUTTON_SIZE - DEFAULT_BOTTOM_OFFSET,
  });
}

export function VoiceInputFab() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [toast, setToast] = useState<{ memos: string[]; todos: string[] } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; originX: number; originY: number; moved: boolean } | null>(null);

  useEffect(() => {
    let initial: Position | null = null;
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          initial = clampToViewport(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(initial ?? getDefaultPosition());

    const onResize = () => setPosition((p) => (p ? clampToViewport(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    setToast({ memos, todos });
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

  const startListening = () => {
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
    recognition.lang = locale === "ko" ? "ko-KR" : "en-US";
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

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position) return;
    dragRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.pointerX;
    const dy = e.clientY - drag.pointerY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setPosition(clampToViewport({ x: drag.originX + dx, y: drag.originY + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.moved) {
      setPosition((p) => {
        if (p) {
          try {
            localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(p));
          } catch {
            // ignore storage failures (e.g. private browsing quota)
          }
        }
        return p;
      });
    } else {
      startListening();
    }
  };

  if (!(profile?.voiceInputEnabled ?? false) || !currentProject || !position) return null;

  return (
    <>
      {toast && (toast.memos.length > 0 || toast.todos.length > 0) && (
        <div className="fixed inset-x-5 bottom-24 z-30 rounded-2xl bg-surface-card px-4 py-3 shadow-lg">
          <p className="mb-1.5 text-xs font-semibold text-text-secondary">{t.voiceInput.addedTitle}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {toast.memos.map((memo, i) => (
              <li key={`memo-${i}`} className="flex items-center gap-2">
                <StickyNote size={14} className="shrink-0 text-text-secondary" />
                <span className="truncate">{memo}</span>
              </li>
            ))}
            {toast.todos.map((todo, i) => (
              <li key={`todo-${i}`} className="flex items-center gap-2">
                <CheckSquare size={14} className="shrink-0 text-text-secondary" />
                <span className="truncate">{todo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={t.voiceInput.label}
        title={status === "error" ? t.voiceInput.error : undefined}
        style={{ left: position.x, top: position.y, touchAction: "none" }}
        className={clsx(
          "fixed z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors",
          status === "listening" && "bg-red-500/50 text-white",
          status === "error" && "bg-red-500/50 text-red-400",
          (status === "idle" || status === "processing") && "bg-accent/50 text-accent-content"
        )}
      >
        {status === "processing" ? (
          <Loader2 size={22} className="animate-spin" />
        ) : status === "error" ? (
          <MicOff size={22} />
        ) : (
          <Mic size={22} className={status === "listening" ? "animate-pulse" : undefined} />
        )}
      </button>
    </>
  );
}
