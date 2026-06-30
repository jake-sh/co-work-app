"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addMemberByEmail, updateProjectPeriod } from "@/lib/data/projects";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { projects, setCurrentProjectId } = useProjects();
  const { t } = useI18n();
  const project = projects.find((p) => p.id === projectId) ?? null;

  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  if (!project) {
    return (
      <div className="px-5 pt-8">
        <Link href="/project" className="text-text-secondary">
          <ArrowLeft size={20} />
        </Link>
      </div>
    );
  }

  const onAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    try {
      await addMemberByEmail(projectId, memberEmail.trim());
      setMemberEmail("");
    } catch {
      setMemberError("USER_NOT_FOUND");
    }
  };

  const onSavePeriod = async () => {
    await updateProjectPeriod(projectId, startDate || null, endDate || null);
  };

  return (
    <div className="px-5 pt-8">
      <Link href="/project" className="mb-4 inline-flex text-text-secondary">
        <ArrowLeft size={20} />
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{project.name}</h1>

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
            type="email"
            placeholder={t.project.addMember}
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
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
      </Card>
    </div>
  );
}
