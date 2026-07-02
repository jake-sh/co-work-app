"use client";

import { useState } from "react";
import { Check, Globe, LogOut, User as UserIcon } from "lucide-react";
import { useAuth, persistLocale } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MEMBER_COLOR_PALETTE } from "@/lib/colors";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { clsx } from "clsx";

export default function SettingsPage() {
  const { profile, signOut, updateColorCode, updateNickname, updateMemoDefaultShared } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [nickname, setNickname] = useState(() => profile?.nickname ?? "");
  const [nicknameSaved, setNicknameSaved] = useState(false);

  const onSaveNickname = async () => {
    await updateNickname(nickname.trim());
    setNicknameSaved(true);
    setTimeout(() => setNicknameSaved(false), 1500);
  };

  const onChangeLocale = (next: "ko" | "en") => {
    setLocale(next);
    if (profile) persistLocale(profile.uid, next);
  };

  const onSelectColor = async (color: string) => {
    await updateColorCode(color);
    setColorPickerOpen(false);
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

      <Card className="mb-3 flex items-center gap-3">
        <span className="shrink-0 text-sm text-text-secondary">{t.settings.nickname}</span>
        <TextInput
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={profile?.displayName ?? ""}
          className="flex-1"
        />
        <button
          onClick={onSaveNickname}
          disabled={!nickname.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-pill"
        >
          <Check size={14} className={nicknameSaved ? "text-green-400" : "text-text-primary"} />
        </button>
      </Card>

      <Card className="mb-4">
        <button
          onClick={() => setColorPickerOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="text-sm text-text-secondary">{t.settings.colorCode}</span>
          <span
            className="h-5 w-5 rounded-full"
            style={{ backgroundColor: profile?.colorCode ?? "#2A2A2A" }}
          />
        </button>
        {colorPickerOpen && (
          <div className="mt-3 grid grid-cols-6 gap-3 border-t border-border-divider pt-3">
            {MEMBER_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => onSelectColor(color)}
                className="relative flex aspect-square items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
              >
                {profile?.colorCode === color && (
                  <Check size={14} color="#000" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4 flex items-center justify-between">
        <span className="text-sm text-text-secondary">{t.settings.memoDefaultShared}</span>
        <button
          onClick={() => updateMemoDefaultShared(!(profile?.memoDefaultShared ?? true))}
          className={clsx(
            "relative h-6 w-10 rounded-full transition-colors",
            (profile?.memoDefaultShared ?? true) ? "bg-white" : "bg-surface-pill"
          )}
        >
          <span
            className={clsx(
              "absolute top-1 h-4 w-4 rounded-full bg-black transition-transform",
              (profile?.memoDefaultShared ?? true) ? "left-5" : "left-1"
            )}
          />
        </button>
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
