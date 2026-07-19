"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemo } from "@/lib/data/memos";
import { ColorDot } from "@/components/ui/ColorDot";
import { EmptyState } from "@/components/ui/EmptyState";

function ShareTargetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading, setCurrentProjectId } = useProjects();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const sharedTitle = searchParams.get("title") ?? "";
  const sharedText = searchParams.get("text") ?? "";
  const sharedUrl = searchParams.get("url") ?? "";
  const body = [sharedText, sharedUrl].filter(Boolean).join("\n");

  const onCancel = () => router.replace("/");

  const onSelect = async (projectId: string) => {
    if (!profile || saving) return;
    setSaving(true);
    const project = projects.find((p) => p.id === projectId);
    const defaultShared = profile.memoDefaultShared ?? true;
    await addMemo(
      projectId,
      sharedTitle,
      body,
      profile.uid,
      profile.displayName,
      profile.colorCode,
      defaultShared ? (project?.memberIds ?? []) : []
    ).catch(() => {});
    setCurrentProjectId(projectId);
    router.replace("/memo");
  };

  if (authLoading || projectsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-secondary">{t.common.loading}</p>
      </div>
    );
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-surface-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-center text-sm font-semibold">{t.shareTarget.title}</p>
        {body && (
          <p className="mb-4 line-clamp-3 whitespace-pre-wrap rounded-xl bg-surface-pill px-3 py-2 text-xs text-text-secondary">
            {body}
          </p>
        )}
        {projects.length === 0 ? (
          <EmptyState message={t.shareTarget.empty} />
        ) : (
          <ul className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  disabled={saving}
                  onClick={() => onSelect(p.id)}
                  className="flex w-full items-center gap-2 rounded-xl bg-surface-pill px-3.5 py-2.5 text-left text-sm font-medium disabled:opacity-40"
                >
                  <ColorDot color={p.color ?? "#9900CC"} />
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={onCancel}
          className="w-full rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
        >
          {t.shareTarget.cancel}
        </button>
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense fallback={null}>
      <ShareTargetContent />
    </Suspense>
  );
}
