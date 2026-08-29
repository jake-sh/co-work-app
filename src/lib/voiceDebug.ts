"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "voiceInputDebug";
const TOGGLE_EVENT = "voice-input-debug-toggle";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// Hidden dev toggle for VoiceInputNavItem's on-screen debug log, flipped by
// a long-press on the Settings nav item (see BottomNav). Off by default so
// the log overlay never appears during ordinary use. Backed by localStorage
// rather than a profile field since it's a per-device debugging aid, not a
// real user-facing setting.
export function toggleVoiceDebug(): boolean {
  const next = !readStored();
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Ignore storage failures (private browsing, quota, etc.) — the toggle
    // just won't persist across reloads.
  }
  window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: next }));
  return next;
}

export function useVoiceDebugEnabled(): boolean {
  const [enabled, setEnabled] = useState(readStored);

  useEffect(() => {
    const onToggle = (e: Event) => setEnabled((e as CustomEvent<boolean>).detail);
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle);
  }, []);

  return enabled;
}
