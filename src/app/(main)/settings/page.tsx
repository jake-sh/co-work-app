"use client";

import { User as UserIcon, LogOut, Globe } from "lucide-react";
import { useAuth, persistLocale } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Card } from "@/components/ui/Card";
import { clsx } from "clsx";

export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const onChangeLocale = (next: "ko" | "en") => {
    setLocale(next);
    if (profile) persistLocale(profile.uid, next);
  };

  return (
    <div className="px-5 pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{profile?.displayName}</h1>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: profile?.colorCode ?? "#2A2A2A" }}
        >
          <UserIcon size={22} color="#0B0B0B" />
        </div>
      </div>

      <Card className="mb-4 flex items-center justify-between">
        <span className="text-sm text-text-secondary">{t.settings.colorCode}</span>
        <span
          className="h-5 w-5 rounded-full"
          style={{ backgroundColor: profile?.colorCode ?? "#2A2A2A" }}
        />
      </Card>

      <p className="mb-2 px-1 text-xs font-semibold text-text-secondary">{t.settings.language}</p>
      <Card className="mb-6 flex flex-col divide-y divide-border-divider p-0">
        <button
          onClick={() => onChangeLocale("ko")}
          className="flex items-center justify-between px-4 py-3.5"
        >
          <span className="flex items-center gap-3 text-sm">
            <Globe size={18} className="text-text-secondary" />
            {t.settings.korean}
          </span>
          <span
            className={clsx(
              "h-2.5 w-2.5 rounded-full",
              locale === "ko" ? "bg-white" : "bg-transparent"
            )}
          />
        </button>
        <button
          onClick={() => onChangeLocale("en")}
          className="flex items-center justify-between px-4 py-3.5"
        >
          <span className="flex items-center gap-3 text-sm">
            <Globe size={18} className="text-text-secondary" />
            {t.settings.english}
          </span>
          <span
            className={clsx(
              "h-2.5 w-2.5 rounded-full",
              locale === "en" ? "bg-white" : "bg-transparent"
            )}
          />
        </button>
      </Card>

      <button
        onClick={() => signOut()}
        className="flex w-full items-center gap-3 rounded-card bg-surface-card px-4 py-3.5 text-sm text-red-400"
      >
        <LogOut size={18} />
        {t.settings.signOut}
      </button>
    </div>
  );
}
