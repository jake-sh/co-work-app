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

export function VoiceInputFab() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [toast, setToast] = useState<{ memos: string[]; todos: string[] } | null>(null);
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

  if (!(profile?.voiceInputEnabled ?? false) || !currentProject) return null;

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
        onClick={onClick}
        aria-label={t.voiceInput.label}
        title={status === "error" ? t.voiceInput.error : undefined}
        className={clsx(
          "fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors",
          status === "listening" && "bg-red-500 text-white",
          status === "error" && "bg-red-500/30 text-red-400",
          (status === "idle" || status === "processing") && "bg-accent text-accent-content"
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
