"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Globe, LogOut, User as UserIcon } from "lucide-react";
import { useAuth, persistLocale } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MEMBER_COLOR_PALETTE } from "@/lib/colors";
import { enablePush, disablePush } from "@/lib/messaging";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { clsx } from "clsx";

export default function SettingsPage() {
  const { profile, signOut, updateColorCode, updateNickname, updateMemoDefaultShared, updateNotificationsEnabled, changePassword } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [nickname, setNickname] = useState(() => profile?.nickname ?? "");
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [fontScale, setFontScale] = useState<"S" | "M" | "L">("S");
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cowork.fontScale");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "S" || saved === "M" || saved === "L") setFontScale(saved);
  }, []);

  const onSelectFontScale = (scale: "S" | "M" | "L") => {
    setFontScale(scale);
    localStorage.setItem("cowork.fontScale", scale);
    const offset = { S: "0px", M: "2px", L: "4px" }[scale];
    document.documentElement.style.setProperty("--app-font-offset", offset);
  };

  const onSaveNickname = async () => {
    await updateNickname(nickname.trim());
    setNicknameSaved(true);
    setTimeout(() => setNicknameSaved(false), 1500);
  };

  const closePwModal = () => {
    setPwModalOpen(false);
    setCurrentPw("");
    setNewPw("");
    setPwError(null);
    setPwSaved(false);
  };

  const onChangePassword = async () => {
    if (!currentPw || !newPw) return;
    setPwError(null);
    setPwSubmitting(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setPwSaved(true);
      setTimeout(() => {
        setPwSaved(false);
        setPwModalOpen(false);
      }, 1200);
    } catch {
      setPwError(t.settings.passwordError);
    } finally {
      setPwSubmitting(false);
    }
  };

  const onChangeLocale = (next: "ko" | "en") => {
    setLocale(next);
    if (profile) persistLocale(profile.uid, next);
    setLangOpen(false);
  };

  const onSelectColor = async (color: string) => {
    await updateColorCode(color);
    setColorPickerOpen(false);
  };

  const onToggleNotifications = () => {
    if (!profile) return;
    const next = !(profile.notificationsEnabled ?? true);
    // Flip the toggle immediately (optimistic). The push (un)registration is a
    // network round-trip to FCM (getToken), so run it in the background instead
    // of blocking the switch on it. If permission is denied the token just
    // won't register, but the account-level preference stays as chosen.
    updateNotificationsEnabled(next);
    if (next) {
      enablePush(profile.uid).catch(() => {});
    } else {
      disablePush(profile.uid).catch(() => {});
    }
  };

  return (
    <div className="px-5 pt-8">
      {pwModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closePwModal}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-sm font-semibold">{t.settings.changePassword}</p>
            <div className="flex flex-col gap-2">
              <TextInput
                type="password"
                placeholder={t.settings.currentPassword}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
              <TextInput
                type="password"
                placeholder={t.settings.newPassword}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              {pwSaved && <p className="text-xs text-green-400">{t.settings.passwordChanged}</p>}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={closePwModal}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <Button
                onClick={onChangePassword}
                disabled={!currentPw || !newPw || pwSubmitting}
                className="flex-1"
              >
                {t.settings.changePassword}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{profile?.displayName}</h1>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: profile?.colorCode ?? "#2A2A2A" }}
        >
          <UserIcon size={22} color="#0B0B0B" />
        </div>
      </div>

      <p className="mb-2 px-1 text-xs font-semibold text-text-secondary">{t.settings.account}</p>

      <Card className="mb-3 flex min-h-14 items-center justify-between gap-3 py-1">
        <span className="min-w-0 truncate text-sm text-text-primary">
          <span className="text-text-secondary">{t.settings.id}: </span>
          {profile?.username}
        </span>
        <button
          onClick={() => setPwModalOpen(true)}
          className="shrink-0 rounded-pill bg-surface-pill px-3 py-1.5 text-xs font-semibold"
        >
          {t.settings.changePassword}
        </button>
      </Card>

      <Card className="mb-4 flex min-h-14 flex-col justify-center gap-3 py-1">
        <div className="flex items-center gap-3">
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
          <button
            onClick={() => setColorPickerOpen((v) => !v)}
            aria-label={t.settings.colorCode}
            className="h-7 w-7 shrink-0 rounded-full"
            style={{ backgroundColor: profile?.colorCode ?? "#2A2A2A" }}
          />
        </div>
        {colorPickerOpen && (
          <div className="grid grid-cols-6 gap-3 border-t border-border-divider pt-3">
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

      <p className="mb-2 px-1 text-xs font-semibold text-text-secondary">{t.settings.preferences}</p>

      <Card className="mb-3 flex min-h-14 items-center justify-between">
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

      <Card className="mb-4 flex min-h-14 items-center justify-between">
        <span className="text-sm text-text-secondary">{t.settings.notifications}</span>
        <button
          onClick={onToggleNotifications}
          className={clsx(
            "relative h-6 w-10 rounded-full transition-colors",
            (profile?.notificationsEnabled ?? true) ? "bg-white" : "bg-surface-pill"
          )}
        >
          <span
            className={clsx(
              "absolute top-1 h-4 w-4 rounded-full bg-black transition-transform",
              (profile?.notificationsEnabled ?? true) ? "left-5" : "left-1"
            )}
          />
        </button>
      </Card>

      <Card className="mb-4 flex min-h-14 items-center justify-between py-1">
        <span className="text-sm text-text-secondary">{t.settings.fontSize}</span>
        <div className="flex gap-1 rounded-pill bg-surface-pill p-0.5">
          {(["S", "M", "L"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSelectFontScale(s)}
              className={clsx(
                "h-7 w-8 rounded-pill text-sm font-semibold transition-colors",
                fontScale === s ? "bg-white text-black" : "text-text-secondary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      <p className="mb-2 px-1 text-xs font-semibold text-text-secondary">{t.settings.language}</p>
      <Card className="mb-6 flex min-h-14 flex-col justify-center">
        <button
          onClick={() => setLangOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-3 text-sm">
            <Globe size={18} className="text-text-secondary" />
            {locale === "ko" ? t.settings.korean : t.settings.english}
          </span>
          <ChevronDown
            size={16}
            className={clsx("text-text-secondary transition-transform", langOpen && "rotate-180")}
          />
        </button>
        {langOpen && (
          <div className="mt-3 flex flex-col divide-y divide-border-divider border-t border-border-divider pt-3">
            <button
              onClick={() => onChangeLocale("ko")}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-sm">{t.settings.korean}</span>
              {locale === "ko" && <Check size={14} />}
            </button>
            <button
              onClick={() => onChangeLocale("en")}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-sm">{t.settings.english}</span>
              {locale === "en" && <Check size={14} />}
            </button>
          </div>
        )}
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
