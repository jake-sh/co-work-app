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

// A quick, genuine click can release in well under a second — too fast
// for the user to have said anything yet. Below this, releasing doesn't
// stop right away; listening continues until this much time has passed
// from the press, giving a short click enough room to actually be heard.
// A press held longer than this simply stops the moment it's released —
// there's no separate "long press" mode or threshold to cross.
const MIN_LISTEN_MS = 2500;

// Recognition errors treated as real, unretriable failures — everything
// else (known benign strings like "no-speech"/"aborted" and any not seen
// yet) is assumed recoverable while the press is still engaged, and gets
// silently restarted instead of surfaced. See createRecognition below.
const FATAL_RECOGNITION_ERRORS = new Set(["not-allowed", "audio-capture"]);
// Caps consecutive silent restarts with no real speech result in between,
// in case something makes every restart fail/abort immediately in a loop.
const MAX_SILENT_RESTARTS = 20;

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// "Music box ping" cue — a soft sine tone with slight unison detune
// (the faint natural mistuning of real music-box tines) and a lowpass
// filter that darkens as the note decays, plus two quiet echo taps for a
// short tail. Start is a fifth above stop so the two are easy to tell apart.
interface CueSpec {
  freq: number;
  filterHz: number;
  detune: number;
  dur: number;
  peak: number;
  tail: { taps: number; gap: number; decay: number };
}
const CUE_TAIL = { taps: 2, gap: 0.1, decay: 0.3 };
const START_CUE: CueSpec = { freq: 1175, filterHz: 4000, detune: 3, dur: 0.18, peak: 0.42, tail: CUE_TAIL };
const STOP_CUE: CueSpec = { freq: 880, filterHz: 4000, detune: 3, dur: 0.18, peak: 0.42, tail: CUE_TAIL };

function getAudioCtxCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { webkitAudioContext?: new () => AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

interface CueVoice {
  osc: OscillatorNode;
  // A separate gain stage the voice's own envelope never touches, purely
  // for ducking (see CUE_DUCK_SEC below). Ducking used to fight the
  // envelope's own exponential ramp directly via cancelScheduledValues,
  // which some browsers don't resume smoothly from — the value can snap
  // rather than continue from where it was, producing an audible click.
  // This node starts at a known, untouched 1 and is the only thing ducking
  // ever adjusts, so there's never a curve to interrupt.
  duckGain: GainNode;
}

function scheduleCueVoice(
  ctx: AudioContext,
  master: GainNode,
  startTime: number,
  freq: number,
  dur: number,
  peakGain: number,
  filterHz: number,
  detuneCents: number
): CueVoice[] {
  const cents = detuneCents ? [-detuneCents, detuneCents] : [0];
  const voices: CueVoice[] = [];
  cents.forEach((c, idx) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime(c, startTime);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(300, filterHz * 0.45), startTime + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain / cents.length, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    const duckGain = ctx.createGain();
    duckGain.gain.setValueAtTime(1, startTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(duckGain);

    if (cents.length > 1) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = idx === 0 ? -0.18 : 0.18;
      duckGain.connect(pan);
      pan.connect(master);
    } else {
      duckGain.connect(master);
    }

    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
    voices.push({ osc, duckGain });
  });
  return voices;
}

// How long a duck-out fade takes when a new cue interrupts a still-ringing
// one — short enough to feel instant, long enough to avoid an audible click.
const CUE_DUCK_SEC = 0.03;

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
  // Pending "finish out the minimum listen time" timer — set when the
  // finger lifts before MIN_LISTEN_MS has elapsed (see endPress).
  const minListenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether we're currently in an active press-to-listen session. Checked
  // (and updated) synchronously via a ref rather than the `status` state,
  // which only updates on React's next render — a ref can't ever be stale
  // if a second pointerdown somehow lands before that render happens.
  const engagedRef = useRef(false);
  // Counts consecutive silent restarts (see createRecognition below) with
  // no real speech result in between, so a pathological loop (start
  // failing/aborting immediately, over and over) can't spin forever.
  const restartCountRef = useRef(0);
  const accumulatedTextRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeCueVoicesRef = useRef<CueVoice[]>([]);

  // TEMPORARY: on-screen event log to pin down a still-open Android Chrome
  // bug (mic stopping early). Remove once confirmed fixed on a real device.
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const pressStartRef = useRef(0);
  const logEvent = (label: string) => {
    const ms = Math.round(performance.now() - pressStartRef.current);
    setDebugLog((prev) => [...prev.slice(-9), `${label} @${ms}ms`]);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (minListenTimerRef.current) clearTimeout(minListenTimerRef.current);
    audioCtxRef.current?.close();
  }, []);

  const playCue = useCallback((spec: CueSpec) => {
    const Ctor = getAudioCtxCtor();
    if (!Ctor) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new Ctor();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.gain.value = 0.9;
      masterGainRef.current.connect(audioCtxRef.current.destination);
    }
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!master) return;

    const schedule = () => {
      const now = ctx.currentTime;

      // A fast tap can trigger start then stop within a few hundred ms,
      // well before the previous cue's tail has finished ringing — without
      // this, the two chimes overlap into a dissonant clash instead of
      // sounding like two distinct sounds. Cut whatever's still playing
      // short first, via each voice's untouched duckGain stage.
      for (const voice of activeCueVoicesRef.current) {
        voice.duckGain.gain.setValueAtTime(1, now);
        voice.duckGain.gain.linearRampToValueAtTime(0, now + CUE_DUCK_SEC);
        try {
          voice.osc.stop(now + CUE_DUCK_SEC);
        } catch {
          // Already stopped/ended — nothing to duck.
        }
      }

      const voices = scheduleCueVoice(ctx, master, now, spec.freq, spec.dur, spec.peak, spec.filterHz, spec.detune);
      for (let i = 1; i <= spec.tail.taps; i++) {
        const tapGain = spec.peak * Math.pow(spec.tail.decay, i);
        const tapFilter = spec.filterHz * Math.pow(0.6, i);
        voices.push(...scheduleCueVoice(ctx, master, now + spec.tail.gap * i, spec.freq, spec.dur * 1.3, tapGain, tapFilter, spec.detune * 0.6));
      }
      activeCueVoicesRef.current = voices;
    };

    // Some browsers auto-suspend an idle AudioContext; scheduling sound
    // against one that's still "suspended" (resume() hasn't actually
    // finished yet) is a plausible source of the irregular pop reported
    // alongside cue playback — wait for a genuine "running" state first
    // rather than firing the moment resume() is merely requested.
    if (ctx.state === "suspended") {
      ctx.resume().then(schedule);
    } else {
      schedule();
    }
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

  // Android Chrome's `continuous: true` isn't actually continuous — its
  // recognizer still ends itself after a few hundred ms to ~1s of silence,
  // firing onend or onerror well before the user has let go, and the exact
  // error string it uses for this varies ("no-speech", "aborted", and
  // maybe others not seen yet). Wiring those straight to "finalize and
  // stop" (as this used to) meant a press could get cut short mid-hold
  // instead of at the user's actual release. The fix: while the press is
  // still engaged, treat any of these as an internal hiccup and silently
  // start a fresh recognition instance rather than tearing the session down.
  const attemptSilentRestart = (): boolean => {
    if (!engagedRef.current || restartCountRef.current >= MAX_SILENT_RESTARTS) return false;
    const next = createRecognition();
    if (!next) return false;
    restartCountRef.current += 1;
    recognitionRef.current = next;
    next.start();
    logEvent(`silent-restart#${restartCountRef.current}`);
    return true;
  };

  const createRecognition = (): SpeechRecognitionLike | null => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    // Always Korean regardless of the app's UI language — dictated notes are
    // almost always spoken in Korean (often with the odd English word mixed
    // in, e.g. "다음주 gui수정"), and tying this to the UI language meant
    // switching the app to English made Korean speech get forced through
    // English recognition instead.
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = false;

    // Browser fires onresult per finished segment (not the full transcript
    // each time), so accumulate across calls — and across silent restarts —
    // and only hand it off once the press genuinely ends.
    recognition.onresult = (event) => {
      // A real result means this recognizer instance is genuinely working,
      // not stuck in some failing-immediately loop — don't let restarts
      // from earlier in a long dictation count against the retry cap.
      restartCountRef.current = 0;
      let text = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      accumulatedTextRef.current += text;
    };
    recognition.onend = () => {
      logEvent("onend");
      if (attemptSilentRestart()) return;
      resetPressState();
      const text = accumulatedTextRef.current.trim();
      accumulatedTextRef.current = "";
      if (text) {
        onTranscript(text);
      } else {
        setStatus("idle");
      }
    };
    recognition.onerror = (event) => {
      logEvent(`onerror:${event.error}`);
      if (!FATAL_RECOGNITION_ERRORS.has(event.error) && attemptSilentRestart()) return;
      resetPressState();
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    };
    return recognition;
  };

  const startListening = () => {
    const recognition = createRecognition();
    if (!recognition) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }
    restartCountRef.current = 0;
    accumulatedTextRef.current = "";
    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
    playCue(START_CUE);
  };

  // Clears every bit of state tied to an in-progress press, however it
  // ends (release, re-tap-to-stop, or a recognition error).
  const resetPressState = () => {
    engagedRef.current = false;
    if (minListenTimerRef.current) {
      clearTimeout(minListenTimerRef.current);
      minListenTimerRef.current = null;
    }
  };

  // Actually tears down the recognition session and signals it audibly.
  const finalizeStop = () => {
    resetPressState();
    recognitionRef.current?.stop();
    playCue(STOP_CUE);
  };

  // Shared by pointer up/cancel: the press has ended. A press held past
  // MIN_LISTEN_MS stops the moment it's released — there's no separate
  // "keep going after release" mode. A press released earlier than that
  // keeps listening until the minimum window is up instead (see below).
  const endPress = () => {
    logEvent("up");
    // Covers the pointerup that trails a re-tap-to-stop gesture — that tap
    // already stopped things via onPointerDown's "already engaged" branch,
    // so this is a redundant echo of the same gesture, not a new release
    // to act on (it was double-firing stop() and the stop chime a moment
    // apart before this check existed).
    if (!engagedRef.current) return;

    const elapsed = performance.now() - pressStartRef.current;
    if (elapsed < MIN_LISTEN_MS) {
      // A genuine quick click can release in well under a second — too
      // fast to have said anything yet. Keep listening for the rest of
      // the minimum window instead of cutting off the instant the finger
      // lifts, so a normal click actually has time to capture speech.
      minListenTimerRef.current = setTimeout(() => {
        minListenTimerRef.current = null;
        // Could have been superseded by a re-tap in the meantime — only
        // finalize if this press is still the live one.
        if (!engagedRef.current) return;
        logEvent("min-listen-stop");
        finalizeStop();
      }, MIN_LISTEN_MS - elapsed);
      return;
    }
    finalizeStop();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (engagedRef.current) {
      // Already listening from an earlier pointerdown — stop immediately.
      // Checked via a ref (not the `status` state) so this can't miss a
      // second pointerdown that lands before React has re-rendered with
      // the "listening" status from the first one.
      logEvent("down(retap→stop)");
      finalizeStop();
      return;
    }
    if (status !== "idle") return;

    // Capture the pointer so pointerup keeps targeting this button even if
    // the finger drifts off it mid-hold (very easy to do on a ~50px nav
    // icon while dictating) — without this, that drift fired a spurious
    // pointerleave that stopped the recording almost immediately.
    e.currentTarget.setPointerCapture(e.pointerId);

    pressStartRef.current = performance.now();
    logEvent("down");

    // Start listening immediately so no speech is lost.
    engagedRef.current = true;
    startListening();
  };

  const onPointerUp = () => {
    endPress();
  };

  // Deliberately does NOT stop the recording. Android Chrome can fire
  // pointercancel on its own mid-hold (system gesture arbitration, the
  // native long-press affordance, etc.) well before the user has actually
  // let go — treating that as a release was cutting presses short at a
  // point unrelated to when the finger actually lifted. Genuine
  // interruptions (permission revoked, app backgrounded hard enough to
  // kill the mic) still surface through recognition.onerror instead.
  const onPointerCancel = () => {
    logEvent("cancel(ignored)");
  };

  if (!(profile?.voiceInputEnabled ?? false) || !currentProject) return null;

  return (
    <>
      {/* TEMPORARY: see the debugLog declaration above — remove this block
          together with it once the Android Chrome cutoff bug is confirmed
          fixed on a real device. */}
      {debugLog.length > 0 && (
        <div className="fixed inset-x-2 top-2 z-40 rounded-md bg-black/85 p-2 font-mono text-[10px] leading-tight text-white">
          {debugLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
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
          // Android Chrome fires `contextmenu` on a ~500ms-ish hold and, if
          // it isn't prevented, cancels the in-progress touch (pointercancel)
          // to show its native menu — which was cutting the long-press mode
          // short well before our own 2s threshold. Same fix the todo list's
          // press-and-hold already uses (see useTapAndHold in todo/page.tsx).
          onContextMenu={(e) => e.preventDefault()}
          aria-label={t.voiceInput.label}
          title={status === "error" ? t.voiceInput.error : undefined}
          style={{ touchAction: "none" }}
          className="flex h-full w-full flex-col items-center justify-center text-nav-inactive"
        >
          <span
            className={clsx(
              // 51px circle (was 46px, +10%) with a 24px icon (was 22px,
              // +10%) inside, nudged up 5px net (10px alignment offset,
              // pulled back down 5px per request) — a bit below the other
              // nav icons' vertical center rather than exactly matching it.
              // A relative offset is purely visual, so the row's fixed
              // height in BottomNav is unaffected either way.
              "relative -top-[5px] flex h-[51px] w-[51px] items-center justify-center rounded-full",
              (status === "listening" || status === "error") && "bg-red-500 text-white",
              (status === "idle" || status === "processing") && "bg-accent text-accent-content"
            )}
          >
            {status === "processing" ? (
              <Loader2 size={24} className="animate-spin" />
            ) : status === "error" ? (
              <MicOff size={24} />
            ) : (
              <Mic size={24} className={status === "listening" ? "animate-pulse" : undefined} />
            )}
          </span>
        </button>
      </li>
    </>
  );
}
