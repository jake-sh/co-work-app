"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addTodo, deleteTodo, setTodoStatus, updateTodoText } from "@/lib/data/todos";
import { getUserProfile } from "@/lib/data/users";
import { useData } from "@/lib/context/DataContext";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ColorDot } from "@/components/ui/ColorDot";
import type { Todo, TodoStatus, UserProfile } from "@/types";
import { clsx } from "clsx";

const NEXT_STATUS: Record<TodoStatus, TodoStatus> = {
  new: "in_progress",
  in_progress: "done",
  done: "done",
};

const PREV_STATUS: Record<TodoStatus, TodoStatus> = {
  new: "new",
  in_progress: "new",
  done: "in_progress",
};

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const SWIPE_DELETE_PX = 88;

// New items are prepended (newest first) right below the sticky header, so
// if the list is scrolled down, a freshly added item lands off-screen above
// the viewport. The header itself is `sticky top-0`, so scrollIntoView on it
// is a no-op (its rect already reports as "in view"); walk up to the actual
// scrollable ancestor (MainLayout's overflow-y-auto container) instead.
function scrollNearestScrollableToTop(el: HTMLElement | null) {
  let node = el?.parentElement ?? null;
  while (node) {
    if (node.scrollHeight > node.clientHeight) {
      node.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    node = node.parentElement;
  }
}

function useTapAndHold(onTap: () => void, onHold: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    held.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => {
      held.current = true;
      onHold();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || !timer.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearTimer();
  };

  const onPointerUp = () => {
    clearTimer();
    if (!held.current) onTap();
    start.current = null;
  };

  const onPointerLeave = () => {
    clearTimer();
    start.current = null;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel: onPointerLeave,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export default function TodoPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const { todos } = useData();
  const [text, setText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [actionMenuTodo, setActionMenuTodo] = useState<Todo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const memberIdsKey = currentProject?.memberIds.join(",") ?? "";

  useEffect(() => {
    if (!currentProject) return;
    let cancelled = false;
    Promise.all(currentProject.memberIds.map((uid) => getUserProfile(uid))).then((profiles) => {
      if (!cancelled) setMembers(profiles.filter(Boolean) as UserProfile[]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIdsKey]);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setAddError(null);
    // Clear the field immediately and fire the write in the background. The
    // Firestore write promise only resolves after the server acks it, so
    // awaiting it before clearing left the input populated for the network
    // round-trip even though the new item already showed optimistically.
    addTodo(currentProject.id, text.trim(), profile.uid, profile.displayName, profile.colorCode).catch(() =>
      setAddError(t.auth.genericError)
    );
    setText("");
    scrollNearestScrollableToTop(headerRef.current);
  };

  const advanceStatus = (todo: Todo) => {
    const next = NEXT_STATUS[todo.status];
    if (next === todo.status) return;
    setTodoStatus(currentProject.id, todo.id, next);
  };

  const revertStatus = (todo: Todo) => {
    const prev = PREV_STATUS[todo.status];
    if (prev === todo.status) return;
    setTodoStatus(currentProject.id, todo.id, prev);
  };

  const onSelectEdit = () => {
    if (!actionMenuTodo) return;
    setEditingId(actionMenuTodo.id);
    setActionMenuTodo(null);
  };

  const onSelectDelete = () => {
    if (!actionMenuTodo) return;
    // Same optimistic pattern as onAdd: don't block closing the menu on the
    // Firestore write's server-ack round-trip.
    deleteTodo(currentProject.id, actionMenuTodo.id).catch(() => {});
    setActionMenuTodo(null);
  };

  const onSwipeDelete = (todo: Todo) => {
    deleteTodo(currentProject.id, todo.id).catch(() => {});
  };

  const onSaveEdit = (todo: Todo, nextText: string) => {
    setEditingId(null);
    const trimmed = nextText.trim();
    if (trimmed && trimmed !== todo.text) {
      updateTodoText(currentProject.id, todo.id, trimmed);
    }
  };

  const visibleTodos = filterUserId ? todos.filter((td) => td.authorId === filterUserId) : todos;
  const active = visibleTodos
    .filter((td) => td.status !== "done")
    .sort((a, b) => b.createdAt - a.createdAt);
  const done = visibleTodos
    .filter((td) => td.status === "done")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const sortedTodos = [...active, ...done];

  const statusLabel: Record<TodoStatus, string> = {
    new: t.todo.statusNew,
    in_progress: t.todo.statusInProgress,
    done: t.todo.statusDone,
  };

  return (
    <>
      {actionMenuTodo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setActionMenuTodo(null)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-center text-sm font-semibold">{actionMenuTodo.text}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setActionMenuTodo(null)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onSelectEdit}
                className="flex-1 rounded-xl bg-blue-500/20 py-2.5 text-sm font-semibold text-blue-300"
              >
                {t.todo.edit}
              </button>
              <button
                onClick={onSelectDelete}
                className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400"
              >
                {t.todo.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={headerRef} className="sticky top-0 z-[1] bg-bg-base px-5 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
            {t.todo.title}
          </h1>
          <div className="flex shrink-0 items-center gap-[15px]">
            {members.map((m) => (
              <button
                key={m.uid}
                onClick={() => setFilterUserId(m.uid)}
                aria-label={m.nickname ?? m.displayName}
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  backgroundColor: m.colorCode,
                  outline: filterUserId === m.uid ? "2px solid white" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
            <button
              onClick={() => setFilterUserId(null)}
              className={clsx(
                "text-xs font-semibold",
                filterUserId === null ? "text-text-primary" : "text-text-disabled"
              )}
            >
              All
            </button>
          </div>
        </div>
        <form onSubmit={onAdd} className="flex gap-2">
          <TextInput
            placeholder={t.todo.inputPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3"
          >
            <Plus size={18} />
          </button>
        </form>
        {addError && <p className="mt-2 text-xs text-red-400">{addError}</p>}
      </div>

      <div className="px-5 pb-10">

        {todos.length === 0 ? (
          <EmptyState message={t.todo.empty} />
        ) : (
          <ul key={currentProject.id} className="flex flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {sortedTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  statusLabel={statusLabel[todo.status]}
                  isEditing={editingId === todo.id}
                  onAdvance={() => advanceStatus(todo)}
                  onRevert={() => revertStatus(todo)}
                  onOpenMenu={() => setActionMenuTodo(todo)}
                  onSaveEdit={(nextText) => onSaveEdit(todo, nextText)}
                  onSwipeDelete={() => onSwipeDelete(todo)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </>
  );
}

function TodoRow({
  todo,
  statusLabel,
  isEditing,
  onAdvance,
  onRevert,
  onOpenMenu,
  onSaveEdit,
  onSwipeDelete,
}: {
  todo: Todo;
  statusLabel: string;
  isEditing: boolean;
  onAdvance: () => void;
  onRevert: () => void;
  onOpenMenu: () => void;
  onSaveEdit: (text: string) => void;
  onSwipeDelete: () => void;
}) {
  const [editText, setEditText] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const textHandlers = useTapAndHold(() => {}, onOpenMenu);
  const pillHandlers = useTapAndHold(onAdvance, onRevert);

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DELETE_PX) onSwipeDelete();
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEditing) {
      setEditText(todo.text);
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isEditing, todo.text]);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="relative"
    >
      {/* Revealed as the row is swiped right; touch-action: pan-y on the row
          below lets native vertical scroll pass straight through, so only a
          confidently horizontal drag ever moves it. */}
      <div className="absolute inset-0 flex items-center rounded-card bg-red-500/20 px-4">
        <Trash2 size={18} className="text-red-400" />
      </div>
      <motion.div
        drag={isEditing ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 1 }}
        onDragEnd={onDragEnd}
        style={{ touchAction: "pan-y" }}
        className="relative flex items-center gap-2.5 rounded-card bg-surface-card px-3 py-3"
      >
        <ColorDot color={todo.authorColor} />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => onSaveEdit(editText)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                inputRef.current?.blur();
              }
            }}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none"
          />
        ) : (
          <span
            {...textHandlers}
            className={clsx(
              "flex-1 select-none text-sm",
              todo.status === "done" ? "text-text-disabled line-through" : "text-text-primary"
            )}
          >
            {todo.text}
          </span>
        )}
        <button
          {...pillHandlers}
          className={clsx(
            "flex w-16 shrink-0 items-center justify-center rounded-pill px-2 py-1 text-center text-[11px] font-semibold select-none",
            todo.status === "new" && "bg-surface-pill text-text-secondary",
            todo.status === "in_progress" && "bg-blue-500/20 text-blue-300",
            todo.status === "done" && "bg-emerald-500/20 text-emerald-300"
          )}
        >
          {statusLabel}
        </button>
      </motion.div>
    </motion.li>
  );
}
