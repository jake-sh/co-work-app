"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password, rememberMe);
      router.replace("/project");
    } catch (err) {
      // The generic message alone gave no way to tell "wrong password" apart
      // from a persistence/environment failure (the "keep me logged in"
      // bug's root cause is still unconfirmed) — surface the Firebase error
      // code so the next report pins down which it actually is.
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
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <h1 className="mb-8 text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
        {t.auth.login}
      </h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextInput
          type="text"
          placeholder={t.auth.username}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          required
        />
        <TextInput
          type="password"
          placeholder={t.auth.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
              rememberMe ? "bg-white" : "bg-surface-pill"
            )}
          >
            <span
              className={clsx(
                "absolute top-1 h-4 w-4 rounded-full bg-black transition-transform",
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
