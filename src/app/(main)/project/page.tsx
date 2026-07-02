"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { createProject } from "@/lib/data/projects";
import { PROJECT_COLOR_PALETTE } from "@/lib/colors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput, TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProjectListPage() {
  const { profile } = useAuth();
  const { projects, setCurrentProjectId } = useProjects();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState(PROJECT_COLOR_PALETTE[0]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const onCreate = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    setCreateError(null);
    setSubmitting(true);
    try {
      const id = await createProject(
        name.trim(),
        description.trim(),
        profile.uid,
        startDate || null,
        endDate || null,
        color
      );
      setCurrentProjectId(id);
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setColor(PROJECT_COLOR_PALETTE[0]);
      setCreating(false);
    } catch {
      setCreateError(t.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-[1] bg-bg-base px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t.project.title}</h1>
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-1 rounded-pill bg-surface-pill px-3 py-2 text-sm font-semibold"
          >
            <Plus size={16} />
            {t.project.create}
          </button>
        </div>
      </div>

      <div className="px-5 pb-10">
        {creating && (
          <Card className="mb-6 flex flex-col gap-3">
            <TextInput
              placeholder={t.project.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextArea
              placeholder={t.project.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-secondary">{t.project.startDate}</label>
                <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-secondary">{t.project.endDate}</label>
                <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs text-text-secondary">{t.project.color}</label>
              <div className="flex gap-2">
                {PROJECT_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      outline: color === c ? `2px solid ${c}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <Button onClick={onCreate} disabled={submitting || !name.trim()}>
              {t.project.save}
            </Button>
          </Card>
        )}

        {projects.length === 0 && !creating ? (
          <EmptyState message={t.project.noProjects} />
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link href={`/project/${project.id}`} onClick={() => setCurrentProjectId(project.id)}>
                  <div className="flex overflow-hidden rounded-card bg-surface-card hover:bg-zinc-800 transition-colors">
                    <div className="w-1 shrink-0" style={{ backgroundColor: project.color ?? "#9900CC" }} />
                    <div className="flex-1 p-4">
                      <p className="text-base font-semibold">{project.name}</p>
                      {project.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{project.description}</p>
                      )}
                      <p className="mt-2 text-xs text-text-disabled">
                        {project.memberIds.length} {t.project.members}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
