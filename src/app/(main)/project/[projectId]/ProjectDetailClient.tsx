"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, RotateCcw, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemberByUsername, deleteProject, setProjectStatus, updateProjectPeriod } from "@/lib/data/projects";
import { getUserProfile } from "@/lib/data/users";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ColorDot } from "@/components/ui/ColorDot";
import type { UserProfile } from "@/types";

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { projects, setCurrentProjectId } = useProjects();
  const { t } = useI18n();
  const router = useRouter();
  const project = projects.find((p) => p.id === projectId) ?? null;

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
    // project arrives asynchronously from the Firestore listener after first render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [project?.startDate, project?.endDate]);

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

  const onSavePeriod = async () => {
    await updateProjectPeriod(projectId, startDate || null, endDate || null);
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
    <div className="px-5 pt-8 pb-10">
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

      <h1 className="mb-1 text-2xl font-bold">{project.name}</h1>
      {isCompleted && (
        <span className="mb-3 inline-block rounded-pill bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-400">
          {t.project.completed}
        </span>
      )}

      <Card className="mt-4">
        <p className="mb-1 text-xs font-semibold text-text-secondary">{t.project.overview}</p>
        <p className="text-sm text-text-primary">{project.description || "-"}</p>
      </Card>

      <Card className="mt-4">
        <p className="mb-2 text-xs font-semibold text-text-secondary">{t.project.period}</p>
        <div className="flex gap-2">
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button variant="secondary" className="mt-3" onClick={onSavePeriod}>
          {t.project.save}
        </Button>
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
    </div>
  );
}
