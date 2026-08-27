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
// A brief, distinct tick played the instant the long-press threshold is
// crossed while still held — confirms "sustained mode is on, safe to let
// go now" audibly, separate from the start/stop chimes.
const SUSTAIN_CUE: CueSpec = { freq: 1568, filterHz: 4500, detune: 0, dur: 0.05, peak: 0.35, tail: { taps: 0, gap: 0, decay: 0 } };

function getAudioCtxCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { webkitAudioContext?: new () => AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

interface CueVoice {
  osc: OscillatorNode;
  gain: GainNode;
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

    osc.connect(filter);
    filter.connect(gain);

    if (cents.length > 1) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = idx === 0 ? -0.18 : 0.18;
      gain.connect(pan);
      pan.connect(master);
    } else {
      gain.connect(master);
    }

    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
    voices.push({ osc, gain });
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
  // True once a held press has crossed the long-press threshold — the icon
  // stops pulsing to visually confirm "locked on, safe to let go".
  const [sustained, setSustained] = useState(false);
  const [toast, setToast] = useState<{ memos: string[]; todos: string[]; events: string[] } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  // Whether we're currently in an active press-to-listen session. Checked
  // (and updated) synchronously via a ref rather than the `status` state,
  // which only updates on React's next render — a ref can't ever be stale
  // if a second pointerdown somehow lands before that render happens.
  const engagedRef = useRef(false);
  const accumulatedTextRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeCueVoicesRef = useRef<CueVoice[]>([]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
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
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;

    // A fast tap can trigger start then stop within a few hundred ms, well
    // before the previous cue's tail has finished ringing — without this,
    // the two chimes overlap into a dissonant clash instead of sounding
    // like two distinct sounds. Cut whatever's still playing short first.
    for (const voice of activeCueVoicesRef.current) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0.0001, now + CUE_DUCK_SEC);
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

  const startListening = () => {
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
    // Always continuous: listening starts the instant the button is
    // pressed (see onPointerDown), so whether this turns into a quick tap
    // or a long hold is only decided later, at release time.
    recognition.continuous = true;
    recognition.interimResults = false;

    // Browser fires onresult per finished segment (not the full transcript
    // each time), so accumulate across calls and only hand it off once
    // listening actually stops.
    accumulatedTextRef.current = "";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      accumulatedTextRef.current += text;
    };
    recognition.onend = () => {
      // Normally already reset by whatever told the recognition to stop
      // (endPress, the re-tap-to-stop branch, or onerror) — but if the
      // browser itself ends a sustained session on its own (e.g. a
      // max-duration cap), this is the only signal we get, so reset here
      // too rather than leaving the button thinking it's still engaged.
      resetPressState();
      const text = accumulatedTextRef.current.trim();
      accumulatedTextRef.current = "";
      if (text) {
        onTranscript(text);
      } else {
        setStatus("idle");
      }
    };
    recognition.onerror = () => {
      resetPressState();
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    };
    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
    playCue(START_CUE);
  };

  // Clears every bit of state tied to an in-progress press, however it
  // ends (early release, re-tap after sustain, or a recognition error).
  const resetPressState = () => {
    engagedRef.current = false;
    longPressFiredRef.current = false;
    setSustained(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Shared by pointer up/cancel: the press has ended. If it ended before
  // the long-press threshold, that's a push-to-talk tap — stop immediately.
  // Past the threshold, listening keeps going until the user taps the
  // button again (handled in onPointerDown's "already engaged" branch).
  const endPress = () => {
    if (longPressFiredRef.current) return;
    resetPressState();
    recognitionRef.current?.stop();
    playCue(STOP_CUE);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (engagedRef.current) {
      // Already listening from an earlier pointerdown — stop immediately.
      // Checked via a ref (not the `status` state) so this can't miss a
      // second pointerdown that lands before React has re-rendered with
      // the "listening" status from the first one.
      resetPressState();
      recognitionRef.current?.stop();
      playCue(STOP_CUE);
      return;
    }
    if (status !== "idle") return;

    // Capture the pointer so pointerup/pointercancel keep targeting this
    // button even if the finger drifts off it mid-hold (very easy to do on
    // a ~50px nav icon while dictating) — without this, that drift fired a
    // spurious pointerleave that stopped the recording almost immediately,
    // breaking both quick taps and sustained long-press listening.
    e.currentTarget.setPointerCapture(e.pointerId);

    // Start listening immediately so no speech is lost while the long-press
    // threshold is still being timed.
    engagedRef.current = true;
    longPressFiredRef.current = false;
    startListening();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setSustained(true);
      playCue(SUSTAIN_CUE);
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    endPress();
  };

  const onPointerCancel = () => {
    endPress();
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
              <Mic size={24} className={status === "listening" && !sustained ? "animate-pulse" : undefined} />
            )}
          </span>
        </button>
      </li>
    </>
  );
}
