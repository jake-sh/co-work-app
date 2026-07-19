"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Button } from "@/components/ui/Button";
import { TextInput, SingleLineInput } from "@/components/ui/TextInput";

// Centered content doesn't reflow when the keyboard opens (the layout
// viewport doesn't shrink, only the visual one), so a vertically-centered
// form can end up partly hidden behind the keyboard with nothing to scroll
// to reveal it. Switch to top-aligned only while the keyboard is open so
// the fields stay reachable, and back to centered once it closes.
const KEYBOARD_HEIGHT_THRESHOLD = 200;

function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOpen(window.innerHeight - vv.height > KEYBOARD_HEIGHT_THRESHOLD);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return keyboardOpen;
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const keyboardOpen = useKeyboardOpen();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password, rememberMe);
      router.replace("/project");
    } catch (err) {
      // Temporary diagnostic: the persistence-fallback theory from the
      // previous two fixes didn't actually resolve the reported "keep me
      // logged in" failure, so surface the real error again to find out
      // what's actually being thrown this time instead of guessing further.
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message;
      console.error("Login failed:", err);
      const detail = code ?? message;
      setError(detail ? `${t.auth.genericError} (${detail})` : t.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={clsx(
        "flex flex-1 flex-col overflow-y-auto px-6 py-10",
        keyboardOpen ? "justify-start" : "justify-center"
      )}
    >
      <h1 className="mb-8 text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
        {t.auth.login}
      </h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <SingleLineInput
          placeholder={t.auth.username}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          enterKeyHint="next"
          onKeyDown={(e) => {
            if (e.key === "Enter") passwordRef.current?.focus();
          }}
          required
        />
        <TextInput
          ref={passwordRef}
          type="password"
          placeholder={t.auth.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          enterKeyHint="done"
          required
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={rememberMe}
            onClick={() => setRememberMe((v) => !v)}
            className={clsx(
              "relative h-6 w-10 shrink-0 rounded-full transition-colors",
              rememberMe ? "bg-accent" : "bg-surface-pill"
            )}
          >
            <span
              className={clsx(
                "absolute top-1 h-4 w-4 rounded-full bg-accent-content transition-transform",
                rememberMe ? "left-5" : "left-1"
              )}
            />
          </button>
          <button
            type="button"
            onClick={() => setRememberMe((v) => !v)}
            className="text-sm text-text-secondary"
          >
            {t.auth.autoLogin}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={submitting} className="mt-2">
          {t.auth.loginButton}
        </Button>
      </form>
      <Link href="/signup" className="mt-6 text-center text-sm text-text-secondary">
        {t.auth.switchToSignup}
      </Link>
    </div>
  );
}
