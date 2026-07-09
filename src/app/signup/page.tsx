"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Button } from "@/components/ui/Button";
import { TextInput, SingleLineInput } from "@/components/ui/TextInput";

// <textarea> (used for username to dodge Chrome's autofill bar) doesn't
// support the native `pattern` attribute an <input> would use for this, so
// the format is checked manually on submit instead.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{4,20}$/;

export default function SignupPage() {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const usernameRef = useRef<HTMLTextAreaElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!USERNAME_PATTERN.test(username)) {
      setError(t.auth.usernameInvalid);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }
    setSubmitting(true);
    try {
      await signUp(displayName, username, password);
      router.replace("/project");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "auth/email-already-in-use" ? t.auth.usernameTaken : t.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <h1 className="mb-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
        {t.auth.signup}
      </h1>
      <p className="mb-8 text-sm text-text-secondary">{t.auth.colorAssigned}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <SingleLineInput
          placeholder={t.auth.displayName}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          enterKeyHint="next"
          onKeyDown={(e) => {
            if (e.key === "Enter") usernameRef.current?.focus();
          }}
          required
        />
        <SingleLineInput
          ref={usernameRef}
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
          minLength={6}
          enterKeyHint="next"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmPasswordRef.current?.focus();
            }
          }}
          required
        />
        <TextInput
          ref={confirmPasswordRef}
          type="password"
          placeholder={t.auth.confirmPassword}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          enterKeyHint="done"
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={submitting} className="mt-2">
          {t.auth.signupButton}
        </Button>
      </form>
      <Link href="/login" className="mt-6 text-center text-sm text-text-secondary">
        {t.auth.switchToLogin}
      </Link>
    </div>
  );
}
