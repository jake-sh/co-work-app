"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Share2, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemo, deleteMemo, shareMemoWithMembers, subscribeMemos, updateMemo } from "@/lib/data/memos";
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
  const [memos, setMemos] = useState<Memo[]>([]);
  const [view, setView] = useState<View>("list");
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!currentProject) return;
    return subscribeMemos(currentProject.id, setMemos);
  }, [currentProject]);

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

  const onSave = async () => {
    if (!profile || !body.trim()) return;
    if (view === "new") {
      await addMemo(currentProject.id, title, body.trim(), profile.uid, profile.displayName, profile.colorCode);
    } else if (view === "edit" && editingMemo) {
      await updateMemo(currentProject.id, editingMemo.id, title, body.trim());
    }
    goBack();
  };

  const onDelete = async (e: React.MouseEvent, memo: Memo) => {
    e.stopPropagation();
    await deleteMemo(currentProject.id, memo.id);
  };

  const onShare = (e: React.MouseEvent, memo: Memo) => {
    e.stopPropagation();
    shareMemoWithMembers(currentProject.id, memo.id, currentProject.memberIds);
  };

  // ── Editor view (new / edit) ───────────────────────────────────────────────
  if (view === "new" || view === "edit") {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-10 pb-4">
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
        <div className="relative px-5 pb-3">
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

        {/* Body textarea — fills remaining space */}
        <div className="flex-1 px-5 pb-5">
          <TextArea
            placeholder={t.memo.bodyPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="px-5 pt-8 pb-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t.memo.title}</h1>
        <button
          onClick={openNew}
          className="rounded-pill bg-surface-pill px-3 py-2 text-sm font-semibold"
        >
          {t.memo.newButton}
        </button>
      </div>

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
                      className={`flex items-center gap-1 text-[11px] ${memo.sharedWith.length > 0 ? "text-red-400" : "text-text-secondary"}`}
                    >
                      <Share2 size={13} />
                      {memo.sharedWith.length > 0 ? t.memo.shared : t.memo.share}
                    </button>
                    <button
                      onClick={(e) => onDelete(e, memo)}
                      className="text-red-400"
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
  );
}
