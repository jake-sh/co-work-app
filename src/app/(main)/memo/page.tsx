"use client";

import { useState } from "react";
import { ArrowLeft, Share2, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemo, deleteMemo, shareMemoWithMembers, unshareMemo, updateMemo } from "@/lib/data/memos";
import { useData } from "@/lib/context/DataContext";
import { Card } from "@/components/ui/Card";
import { TextInput, TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ColorDot } from "@/components/ui/ColorDot";
import type { Memo } from "@/types";

type View = "list" | "new" | "edit";

export default function MemoPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const { memos } = useData();
  const [view, setView] = useState<View>("list");
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmDeleteMemo, setConfirmDeleteMemo] = useState<Memo | null>(null);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const openNew = () => {
    setTitle("");
    setBody("");
    setEditingMemo(null);
    setView("new");
  };

  const openEdit = (memo: Memo) => {
    setTitle(memo.title);
    setBody(memo.body);
    setEditingMemo(memo);
    setView("edit");
  };

  const goBack = () => {
    setView("list");
    setEditingMemo(null);
  };

  const onSave = () => {
    if (!profile || !body.trim()) return;
    // Firestore's write promise only resolves after the server acks it, which
    // can stall on a slow/dropped connection. Fire the write in the
    // background and navigate back immediately (same optimistic pattern as
    // the settings toggles) instead of blocking the UI on that round-trip.
    if (view === "new") {
      const defaultShared = profile.memoDefaultShared ?? true;
      addMemo(currentProject.id, title, body.trim(), profile.uid, profile.displayName, profile.colorCode, defaultShared ? currentProject.memberIds : []).catch(() => {});
    } else if (view === "edit" && editingMemo) {
      updateMemo(
        currentProject.id,
        editingMemo.id,
        title,
        body.trim(),
        editingMemo.authorId,
        editingMemo.authorColor,
        editingMemo.sharedWith.length > 0
      ).catch(() => {});
    }
    goBack();
  };

  const onDelete = (e: React.MouseEvent, memo: Memo) => {
    e.stopPropagation();
    setConfirmDeleteMemo(memo);
  };

  const onConfirmDelete = () => {
    if (!confirmDeleteMemo) return;
    deleteMemo(currentProject.id, confirmDeleteMemo.id).catch(() => {});
    setConfirmDeleteMemo(null);
  };

  const onShare = (e: React.MouseEvent, memo: Memo) => {
    e.stopPropagation();
    if (memo.sharedWith.length > 0) {
      unshareMemo(currentProject.id, memo.id, currentProject.memberIds);
    } else {
      shareMemoWithMembers(currentProject.id, memo.id, currentProject.memberIds);
    }
  };

  // ── Editor view (new / edit) ───────────────────────────────────────────────
  if (view === "new" || view === "edit") {
    return (
      // Fixed full-screen overlay instead of a normal in-flow page: this
      // opts out of the app's shared scrollable container, so the on-screen
      // keyboard opening can't trigger a page-level "scroll focused element
      // into view" that drags the header/save button off-screen. The header
      // and title row stay put (shrink-0); only the body textarea below
      // scrolls, and it does so internally on its own.
      <div className="fixed inset-0 z-30 flex flex-col bg-bg-base">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-4">
          <button onClick={goBack} className="text-text-secondary">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold">
            {view === "new" ? t.memo.newMemo : t.memo.editMemo}
          </h1>
          <button
            onClick={onSave}
            disabled={!body.trim()}
            className="rounded-xl bg-surface-card px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {t.memo.save}
          </button>
        </div>

        {/* Title input */}
        <div className="relative shrink-0 px-5 pb-3">
          <TextInput
            placeholder={t.memo.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {title && (
            <button
              onClick={() => setTitle("")}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-text-disabled"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body textarea — fills remaining space and scrolls internally */}
        <div className="min-h-0 flex-1 px-5 pb-5">
          <TextArea
            placeholder={t.memo.bodyPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-full overflow-y-auto"
          />
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <>
      {confirmDeleteMemo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmDeleteMemo(null)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-center text-sm font-semibold">{t.memo.deleteConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteMemo(null)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.memo.cancel}
              </button>
              <button
                onClick={onConfirmDelete}
                className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400"
              >
                {t.memo.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-[1] bg-bg-base px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
            {t.memo.title}
          </h1>
          <button
            onClick={openNew}
            className="rounded-pill bg-surface-pill px-3 py-2 text-sm font-semibold"
          >
            {t.memo.newButton}
          </button>
        </div>
      </div>

      <div className="px-5 pb-10">
        {memos.length === 0 ? (
          <EmptyState message={t.memo.empty} />
        ) : (
          <ul className="flex flex-col gap-3">
            {memos.map((memo) => (
              <li key={memo.id} onClick={() => openEdit(memo)} className="cursor-pointer">
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <ColorDot color={memo.authorColor} />
                    <p className="line-clamp-1 text-sm font-semibold">{memo.title}</p>
                  </div>
                  <p className="line-clamp-3 text-xs text-text-secondary">{memo.body}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-text-disabled">
                      {format(new Date(memo.createdAt), "yyyy.MM.dd")}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => onShare(e, memo)}
                        className="flex items-center gap-1 text-[11px] text-text-secondary"
                      >
                        <Share2 size={13} />
                        {memo.sharedWith.length > 0
                          ? <span className="text-red-400">{t.memo.shared}</span>
                          : t.memo.share}
                      </button>
                      <button
                        onClick={(e) => onDelete(e, memo)}
                        className="text-text-secondary"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
