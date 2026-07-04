"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useAuth, persistLocale } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MEMBER_COLOR_PALETTE } from "@/lib/colors";
import { enablePush, disablePush } from "@/lib/messaging";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { clsx } from "clsx";

export default function SettingsPage() {
  const { profile, signOut, updateColorCode, updateNickname, updateMemoDefaultShared, updateNotificationsEnabled, changePassword, deleteAccount } = useAuth();
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletePw("");
    setDeleteError(null);
  };

  const onDeleteAccount = async () => {
    if (!deletePw) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await deleteAccount(deletePw);
    } catch {
      setDeleteError(t.settings.deleteAccountError);
      setDeleteSubmitting(false);
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
                className="flex-1 rounded-pill bg-surface-pill px-4 py-2 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <Button
                onClick={onChangePassword}
                disabled={!currentPw || !newPw || pwSubmitting}
                className="flex-1 !py-2"
              >
                {t.common.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeDeleteModal}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-center text-sm font-semibold text-red-400">
              {t.settings.deleteAccount}
            </p>
            <p className="mb-4 text-center text-xs text-text-secondary">
              {t.settings.deleteAccountWarning}
            </p>
            <TextInput
              type="password"
              placeholder={t.settings.currentPassword}
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              autoComplete="current-password"
            />
            {deleteError && <p className="mt-2 text-xs text-red-400">{deleteError}</p>}
            <div className="mt-4 flex gap-3">
              <button
                onClick={closeDeleteModal}
                className="flex-1 rounded-pill bg-surface-pill px-4 py-2 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onDeleteAccount}
                disabled={!deletePw || deleteSubmitting}
                className="flex-1 rounded-pill bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {t.settings.deleteAccount}
              </button>
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

      <Card className="mb-4 flex flex-col !py-1">
        <div className="flex min-h-14 items-center justify-between gap-3 py-1">
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
        </div>

        <div className="mx-1 h-px bg-border-divider" />

        <div className="flex min-h-14 flex-col justify-center gap-3 py-1">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-sm text-text-secondary">{t.settings.nickname}</span>
            <TextInput
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={profile?.displayName ?? ""}
              className="flex-1 !py-1.5"
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
        </div>
      </Card>

      <p className="mb-2 px-1 text-xs font-semibold text-text-secondary">{t.settings.preferences}</p>

      <Card className="mb-6 flex flex-col !py-1">
        <div className="flex min-h-14 items-center justify-between">
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
        </div>

        <div className="mx-1 h-px bg-border-divider" />

        <div className="flex min-h-14 items-center justify-between">
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
        </div>

        <div className="mx-1 h-px bg-border-divider" />

        <div className="flex min-h-14 items-center justify-between py-1">
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
        </div>

        <div className="mx-1 h-px bg-border-divider" />

        <div className="flex min-h-14 items-center justify-between">
          <span className="text-sm text-text-secondary">{t.settings.language}</span>
          <div className="relative inline-flex">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className={clsx(
                "flex h-8 w-[108px] items-center justify-between rounded-2xl bg-surface-pill px-3 text-sm text-text-primary",
                langOpen && "invisible"
              )}
            >
              {locale === "ko" ? t.settings.korean : t.settings.english}
              <ChevronDown size={14} className="text-text-secondary" />
            </button>
            {langOpen && (
              <div className="absolute inset-x-0 top-0 z-20 flex flex-col divide-y divide-border-divider overflow-hidden rounded-2xl bg-surface-pill shadow-lg">
                <button
                  onClick={() => setLangOpen(false)}
                  className="flex h-8 items-center justify-between px-3 text-sm text-text-primary"
                >
                  {locale === "ko" ? t.settings.korean : t.settings.english}
                  <ChevronDown size={14} className="rotate-180 text-text-secondary" />
                </button>
                <button
                  onClick={() => onChangeLocale(locale === "ko" ? "en" : "ko")}
                  className="flex h-8 items-center px-3 text-left text-sm text-text-primary"
                >
                  {locale === "ko" ? t.settings.english : t.settings.korean}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <button
        onClick={() => signOut()}
        className="flex w-full items-center gap-3 rounded-card bg-surface-card px-4 py-3.5 text-sm text-red-400"
      >
        <LogOut size={18} />
        {t.settings.signOut}
      </button>

      <button
        onClick={() => setDeleteModalOpen(true)}
        className="mt-3 w-full text-center text-xs text-red-400"
      >
        {t.settings.deleteAccount}
      </button>
    </div>
  );
}
