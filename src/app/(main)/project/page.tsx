"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { createProject } from "@/lib/data/projects";
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
  const [submitting, setSubmitting] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    setSubmitting(true);
    try {
      const id = await createProject(
        name.trim(),
        description.trim(),
        profile.uid,
        startDate || null,
        endDate || null
      );
      setCurrentProjectId(id);
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t.project.title}</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1 rounded-pill bg-surface-pill px-3 py-2 text-sm font-semibold"
        >
          <Plus size={16} />
          {t.project.create}
        </button>
      </div>

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
                <Card className="hover:bg-zinc-800">
                  <p className="text-base font-semibold">{project.name}</p>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{project.description}</p>
                  )}
                  <p className="mt-2 text-xs text-text-disabled">
                    {project.memberIds.length} {t.project.members}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
