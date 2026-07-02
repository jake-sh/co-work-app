"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { clsx } from "clsx";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { createProject, reorderProjects } from "@/lib/data/projects";
import { PROJECT_COLOR_PALETTE } from "@/lib/colors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput, TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Project } from "@/types";

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;

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
  const [orderedProjects, setOrderedProjects] = useState(projects);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setOrderedProjects((prev) => {
      const prevIds = prev.map((p) => p.id).join(",");
      const nextIds = projects.map((p) => p.id).join(",");
      if (prevIds === nextIds) {
        return prev.map((p) => projects.find((np) => np.id === p.id) ?? p);
      }
      return projects;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [projects]);

  const onReorder = (next: Project[]) => {
    setOrderedProjects(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      reorderProjects(next.map((p) => p.id));
    }, 500);
  };

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
          <Reorder.Group
            as="ul"
            axis="y"
            values={orderedProjects}
            onReorder={onReorder}
            className="flex flex-col gap-3"
          >
            {orderedProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                membersLabel={`${project.memberIds.length} ${t.project.members}`}
                onOpen={() => setCurrentProjectId(project.id)}
              />
            ))}
          </Reorder.Group>
        )}
      </div>
    </>
  );
}

function ProjectRow({
  project,
  membersLabel,
  onOpen,
}: {
  project: Project;
  membersLabel: string;
  onOpen: () => void;
}) {
  const router = useRouter();
  const controls = useDragControls();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const isLifting = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  // Framer's own pan-gesture listeners are passive (can't call
  // preventDefault), and dragListener={false} disables the touch-action
  // CSS it would otherwise apply automatically. So once a drag is lifted,
  // forcibly block the browser's native scroll ourselves via a non-passive
  // listener — a reactive touch-action class alone isn't reliably honored
  // for a touch sequence that's already in progress.
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (isLifting.current) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    isLifting.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearHoldTimer();
    holdTimer.current = setTimeout(() => {
      isLifting.current = true;
      // Give immediate visual feedback the instant the long-press is
      // recognized, rather than waiting for framer's whileDrag (which only
      // applies once the pointer has moved a few pixels).
      setIsDragging(true);
      controls.start(e);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current || !holdTimer.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearHoldTimer();
  };

  const onPointerUp = () => {
    clearHoldTimer();
    if (!isLifting.current) {
      onOpen();
      router.push(`/project/${project.id}`);
    }
    pressStart.current = null;
  };

  const onPointerLeave = () => {
    clearHoldTimer();
    pressStart.current = null;
  };

  return (
    <Reorder.Item
      value={project}
      dragControls={controls}
      dragListener={false}
      initial={false}
      onDragEnd={() => setIsDragging(false)}
      className="rounded-lg"
    >
      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        className={clsx(
          "flex overflow-hidden rounded-lg bg-surface-card select-none transition-[transform,box-shadow,background-color]",
          isDragging ? "scale-[1.03] shadow-2xl touch-none" : "active:bg-zinc-800"
        )}
      >
        <div className="w-1 shrink-0" style={{ backgroundColor: project.color ?? "#9900CC" }} />
        <div className="flex-1 p-4">
          <p className="text-base font-semibold">{project.name}</p>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{project.description}</p>
          )}
          <p className="mt-2 text-xs text-text-disabled">{membersLabel}</p>
        </div>
      </div>
    </Reorder.Item>
  );
}
