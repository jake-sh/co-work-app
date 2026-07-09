"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle, LogOut, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import {
  addMemberByUsername,
  deleteProject,
  leaveProject,
  removeMember,
  setProjectStatus,
  transferOwnership,
  updateProject,
  updateProjectColor,
} from "@/lib/data/projects";
import { PROJECT_COLOR_PALETTE } from "@/lib/colors";
import { getUserProfile } from "@/lib/data/users";
import { Button } from "@/components/ui/Button";
import { TextInput, TextArea } from "@/components/ui/TextInput";
import { ColorDot } from "@/components/ui/ColorDot";
import type { UserProfile } from "@/types";

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { profile } = useAuth();
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
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<UserProfile | null>(null);
  const [confirmPromote, setConfirmPromote] = useState<UserProfile | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewRef = useRef<HTMLTextAreaElement>(null);

  const resizeOverview = () => {
    const el = overviewRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  // Keep the overview textarea sized to its content (starts at one row).
  useEffect(() => {
    resizeOverview();
  }, [description]);

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

  // The project owner ("PL") can edit settings and manage members. Everyone
  // else can only view and leave the project.
  const isPL = project.ownerId === profile?.uid;
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

  const onConfirmRemove = async () => {
    if (!confirmRemove) return;
    await removeMember(projectId, confirmRemove.uid);
    setConfirmRemove(null);
  };

  const onConfirmPromote = async () => {
    if (!confirmPromote) return;
    await transferOwnership(projectId, confirmPromote.uid);
    setConfirmPromote(null);
  };

  const onSave = async () => {
    await updateProject(
      projectId,
      name.trim() || project.name,
      description.trim(),
      startDate || null,
      endDate || null
    );
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
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

  const onLeave = async () => {
    if (!profile) return;
    await leaveProject(projectId, profile.uid);
    setCurrentProjectId(null);
    router.replace("/project");
  };

  return (
    <>
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-center text-sm font-semibold">{confirmRemove.displayName}</p>
            <p className="mb-5 text-center text-sm text-text-secondary">{t.project.removeMemberConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onConfirmRemove}
                className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400"
              >
                {t.project.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPromote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmPromote(null)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-center text-sm font-semibold">{confirmPromote.displayName}</p>
            <p className="mb-5 text-center text-sm text-text-secondary">{t.project.changePlConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPromote(null)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onConfirmPromote}
                className="flex-1 rounded-xl bg-blue-500/20 py-2.5 text-sm font-semibold text-blue-300"
              >
                {t.project.changePl}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmLeave(false)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-center text-sm font-semibold">{t.project.leaveConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onLeave}
                className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400"
              >
                {t.project.leave}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-[1] flex items-center justify-between bg-bg-base px-5 pt-8 pb-4">
        <Link href="/project" className="text-text-secondary">
          <ArrowLeft size={20} />
        </Link>
        {isPL ? (
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
        ) : (
          <span
            className={
              isCompleted
                ? "rounded-pill bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300"
                : "rounded-pill bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-300"
            }
          >
            {isCompleted ? t.project.complete : t.project.inProgress}
          </span>
        )}
      </div>

      <div className="flex flex-col px-5 pb-28">
        {isCompleted && isPL && (
          <span className="mb-3 inline-block rounded-pill bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-400">
            {t.project.completed}
          </span>
        )}

        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.project.name}
          className="mb-4 text-xl font-bold"
          readOnly={!isPL}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />

        <div>
          <p className="mb-2 text-xs font-semibold text-text-secondary">{t.project.overview}</p>
          <TextArea
            ref={overviewRef}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              resizeOverview();
            }}
            placeholder={t.project.overviewPlaceholder}
            rows={1}
            className="w-full"
            readOnly={!isPL}
            enterKeyHint="enter"
          />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold text-text-secondary">{t.project.period}</p>
          <div className="flex items-center gap-2">
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="no-date-arrow" readOnly={!isPL} />
            <span className="shrink-0 text-sm text-text-secondary">~</span>
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="no-date-arrow" readOnly={!isPL} />
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold text-text-secondary">
            {t.project.members} ({project.memberIds.length})
          </p>
          {isPL && (
            <form onSubmit={onAddMember} className="flex gap-2">
              <TextInput
                type="text"
                placeholder={t.project.addMember}
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                autoCapitalize="none"
                enterKeyHint="done"
              />
              <button
                type="submit"
                className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3"
              >
                <UserPlus size={18} />
              </button>
            </form>
          )}
          {memberError && (
            <p className="mt-2 text-xs text-red-400">{t.auth.genericError}</p>
          )}
          {members.length > 0 && (
            <ul className={`flex flex-col gap-2 ${isPL ? "mt-3 border-t border-border-divider pt-3" : ""}`}>
              {members.map((m) => (
                <MemberRow
                  key={m.uid}
                  member={m}
                  isOwner={m.uid === project.ownerId}
                  canManage={isPL}
                  ownerLabel={t.project.pl}
                  removeLabel={t.project.delete}
                  onRemove={() => setConfirmRemove(m)}
                  onPromote={() => setConfirmPromote(m)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold text-text-secondary">{t.project.color}</p>
          <div className="flex gap-2 rounded-xl border border-border-divider bg-surface-input px-4 py-3">
            {PROJECT_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => isPL && updateProjectColor(projectId, c)}
                disabled={!isPL}
                className="h-6 w-6 rounded-full transition-transform disabled:cursor-default"
                style={{
                  backgroundColor: c,
                  outline: (project.color ?? PROJECT_COLOR_PALETTE[0]) === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 z-[1] bg-bg-base px-5 pt-3 pb-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)" }}
      >
        {isPL ? (
          <Button onClick={onSave} className="w-full">
            {t.project.save}
          </Button>
        ) : (
          <button
            onClick={() => setConfirmLeave(true)}
            className="flex w-full items-center justify-center gap-2 rounded-pill bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-400"
          >
            <LogOut size={16} />
            {t.project.leave}
          </button>
        )}
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 bottom-40 z-50 flex justify-center px-6"
          >
            <div className="rounded-pill bg-surface-card px-4 py-2.5 text-sm font-semibold shadow-lg">
              {t.project.saved}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

// A member row. For the PL, long-pressing a non-owner member triggers the
// "make PL" flow; the X button removes them. Rows are otherwise static.
function MemberRow({
  member,
  isOwner,
  canManage,
  ownerLabel,
  removeLabel,
  onRemove,
  onPromote,
}: {
  member: UserProfile;
  isOwner: boolean;
  canManage: boolean;
  ownerLabel: string;
  removeLabel: string;
  onRemove: () => void;
  onPromote: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const promotable = canManage && !isOwner;

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!promotable) return;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => {
      clearTimer();
      onPromote();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || !timer.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_CANCEL_PX) {
      clearTimer();
    }
  };

  const cancel = () => {
    clearTimer();
    start.current = null;
  };

  return (
    <li
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => promotable && e.preventDefault()}
      className={`flex items-center gap-2 ${promotable ? "select-none" : ""}`}
    >
      <ColorDot color={member.colorCode} size={8} />
      <span className="text-sm text-text-primary">{member.displayName}</span>
      <span className="text-xs text-text-secondary">@{member.username}</span>
      {isOwner ? (
        <span className="ml-auto text-xs text-text-disabled">{ownerLabel}</span>
      ) : (
        canManage && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className="ml-auto text-text-disabled hover:text-red-400"
            aria-label={removeLabel}
          >
            <X size={16} />
          </button>
        )
      )}
    </li>
  );
}
