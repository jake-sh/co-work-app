"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

export default function SignupPage() {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      <h1 className="mb-2 text-3xl font-bold">{t.auth.signup}</h1>
      <p className="mb-8 text-sm text-text-secondary">{t.auth.colorAssigned}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextInput
          placeholder={t.auth.displayName}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <TextInput
          type="text"
          placeholder={t.auth.username}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="[a-zA-Z0-9_]{4,20}"
          title="4-20 characters: letters, numbers, underscore"
          autoCapitalize="none"
          required
        />
        <TextInput
          type="password"
          placeholder={t.auth.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
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
