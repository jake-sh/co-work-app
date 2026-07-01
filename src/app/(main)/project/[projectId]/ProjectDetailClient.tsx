"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, RotateCcw, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemberByUsername, deleteProject, setProjectStatus, updateProject } from "@/lib/data/projects";
import { getUserProfile } from "@/lib/data/users";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput, TextArea } from "@/components/ui/TextInput";
import { ColorDot } from "@/components/ui/ColorDot";
import type { UserProfile } from "@/types";

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { projects, setCurrentProjectId } = useProjects();
  const { t } = useI18n();
  const router = useRouter();
  const project = projects.find((p) => p.id === projectId) ?? null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberUsername, setMemberUsername] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  useEffect(() => {
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
  }, [project?.name, project?.description, project?.startDate, project?.endDate]);

  const memberIdStr = project?.memberIds.join(",") ?? "";
  useEffect(() => {
    if (!project) return;
    Promise.all(project.memberIds.map((uid) => getUserProfile(uid))).then((profiles) => {
      setMembers(profiles.filter(Boolean) as UserProfile[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIdStr]);

  if (!project) {
    return (
      <div className="px-5 pt-8">
        <Link href="/project" className="text-text-secondary">
          <ArrowLeft size={20} />
        </Link>
      </div>
    );
  }

  const isCompleted = project.status === "completed";

  const onAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    try {
      await addMemberByUsername(projectId, memberUsername.trim());
      setMemberUsername("");
    } catch {
      setMemberError("USER_NOT_FOUND");
    }
  };

  const onSave = async () => {
    await updateProject(
      projectId,
      name.trim() || project.name,
      description.trim(),
      startDate || null,
      endDate || null
    );
  };

  const onToggleComplete = async () => {
    await setProjectStatus(projectId, isCompleted ? "active" : "completed");
  };

  const onDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteProject(projectId);
    setCurrentProjectId(null);
    router.replace("/project");
  };

  return (
    <div className="flex flex-col px-5 pt-8 pb-10 min-h-full">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/project" className="text-text-secondary">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex gap-2">
          <button
            onClick={onToggleComplete}
            className="flex items-center gap-1.5 rounded-pill bg-surface-pill px-3 py-1.5 text-xs font-semibold"
          >
            {isCompleted ? <RotateCcw size={13} /> : <CheckCircle size={13} />}
            {isCompleted ? t.project.reopen : t.project.complete}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-pill bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400"
          >
            <Trash2 size={13} />
            {confirmDelete ? t.project.deleteConfirm : t.project.delete}
          </button>
        </div>
      </div>

      {isCompleted && (
        <span className="mb-3 inline-block rounded-pill bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-400">
          {t.project.completed}
        </span>
      )}

      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.project.namePlaceholder ?? t.project.name}
        className="mb-4 text-xl font-bold"
      />

      <Card className="mt-0">
        <p className="mb-2 text-xs font-semibold text-text-secondary">{t.project.overview}</p>
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.project.descriptionPlaceholder ?? t.project.overview}
          rows={3}
          className="w-full"
        />
      </Card>

      <Card className="mt-4">
        <p className="mb-2 text-xs font-semibold text-text-secondary">{t.project.period}</p>
        <div className="flex gap-2">
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </Card>

      <Card className="mt-4">
        <p className="mb-2 text-xs font-semibold text-text-secondary">
          {t.project.members} ({project.memberIds.length})
        </p>
        <form onSubmit={onAddMember} className="flex gap-2">
          <TextInput
            type="text"
            placeholder={t.project.addMember}
            value={memberUsername}
            onChange={(e) => setMemberUsername(e.target.value)}
            autoCapitalize="none"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3"
          >
            <UserPlus size={18} />
          </button>
        </form>
        {memberError && (
          <p className="mt-2 text-xs text-red-400">{t.auth.genericError}</p>
        )}
        {members.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 border-t border-border-divider pt-3">
            {members.map((m) => (
              <li key={m.uid} className="flex items-center gap-2">
                <ColorDot color={m.colorCode} size={8} />
                <span className="text-sm text-text-primary">{m.displayName}</span>
                <span className="text-xs text-text-secondary">@{m.username}</span>
                {m.uid === project.ownerId && (
                  <span className="ml-auto text-[10px] text-text-disabled">Owner</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-auto pt-6">
        <Button onClick={onSave} className="w-full">
          {t.project.save}
        </Button>
      </div>
    </div>
  );
}
