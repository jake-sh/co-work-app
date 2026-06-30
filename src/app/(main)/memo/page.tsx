"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemo, shareMemoWithMembers, subscribeMemos } from "@/lib/data/memos";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput, TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ColorDot } from "@/components/ui/ColorDot";
import type { Memo } from "@/types";

export default function MemoPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!currentProject) return;
    return subscribeMemos(currentProject.id, setMemos);
  }, [currentProject]);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const onSave = async () => {
    if (!profile || !body.trim()) return;
    await addMemo(currentProject.id, title, body.trim(), profile.uid, profile.displayName, profile.colorCode);
    setTitle("");
    setBody("");
    setCreating(false);
  };

  const onShare = (memo: Memo) => {
    shareMemoWithMembers(currentProject.id, memo.id, currentProject.memberIds);
  };

  return (
    <div className="px-5 pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t.memo.title}</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-pill bg-surface-pill px-3 py-2 text-sm font-semibold"
        >
          {t.memo.newButton}
        </button>
      </div>

      {creating && (
        <Card className="mb-6 flex flex-col gap-3">
          <TextInput
            placeholder={t.memo.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            placeholder={t.memo.bodyPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
          <Button onClick={onSave} disabled={!body.trim()}>
            {t.memo.save}
          </Button>
        </Card>
      )}

      {memos.length === 0 && !creating ? (
        <EmptyState message={t.memo.empty} />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {memos.map((memo) => (
            <li key={memo.id}>
              <Card className="flex h-full flex-col">
                <div className="mb-1 flex items-center gap-2">
                  <ColorDot color={memo.authorColor} />
                  <p className="line-clamp-1 text-sm font-semibold">{memo.title}</p>
                </div>
                <p className="line-clamp-4 flex-1 text-xs text-text-secondary">{memo.body}</p>
                <button
                  onClick={() => onShare(memo)}
                  className="mt-3 flex items-center gap-1 self-start text-[11px] text-text-secondary"
                >
                  <Share2 size={13} />
                  {memo.sharedWith.length > 0 ? t.memo.shared : t.memo.share}
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
