"use client";

import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, type PanInfo } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addTodo, deleteTodo, restoreTodo, restoreTodoStatus, setTodoStatus, updateTodoText } from "@/lib/data/todos";
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
  cancelled: "cancelled",
};

const PREV_STATUS: Record<TodoStatus, TodoStatus> = {
  new: "new",
  in_progress: "new",
  done: "in_progress",
  cancelled: "new",
};

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const SWIPE_DELETE_PX = 150;
// A ratio check alone still let framer's drag="x" keep translating the row
// off raw pointer-x movement during a scroll. Trip-wire instead: the moment
// vertical movement exceeds this, kill the drag outright (drag={false}) for
// the rest of the gesture so the touch goes back to being a plain scroll.
const VERTICAL_CANCEL_PX = 20;
const UNDO_STACK_LIMIT = 5;
const UNDO_TTL_MS = 60_000;

type UndoAction =
  | { type: "delete"; todo: Todo }
  | { type: "status"; todoId: string; prevStatus: TodoStatus; prevCompletedAt: number | null };
type UndoEntry = UndoAction & { expiresAt: number };

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TodoStatus | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
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

  // Undo entries expire 1 minute after the action they cover; sweep them out
  // every second so the undo button disappears on its own once the last one
  // lapses, rather than only pruning lazily on the next push/undo.
  useEffect(() => {
    const interval = setInterval(() => {
      setUndoStack((prev) => prev.filter((entry) => entry.expiresAt > Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const pushUndo = (action: UndoAction) => {
    setUndoStack((prev) => [...prev, { ...action, expiresAt: Date.now() + UNDO_TTL_MS }].slice(-UNDO_STACK_LIMIT));
  };

  const onUndo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((prev) => prev.slice(0, -1));
    if (last.type === "delete") {
      restoreTodo(currentProject.id, last.todo).catch(() => {});
    } else {
      restoreTodoStatus(currentProject.id, last.todoId, last.prevStatus, last.prevCompletedAt).catch(() => {});
    }
  };

  const advanceStatus = (todo: Todo) => {
    const next = NEXT_STATUS[todo.status];
    if (next === todo.status) return;
    pushUndo({ type: "status", todoId: todo.id, prevStatus: todo.status, prevCompletedAt: todo.completedAt });
    setTodoStatus(currentProject.id, todo.id, next);
  };

  const revertStatus = (todo: Todo) => {
    const prev = PREV_STATUS[todo.status];
    if (prev === todo.status) return;
    pushUndo({ type: "status", todoId: todo.id, prevStatus: todo.status, prevCompletedAt: todo.completedAt });
    setTodoStatus(currentProject.id, todo.id, prev);
  };

  const onSwipeDelete = (todo: Todo) => {
    pushUndo({ type: "delete", todo });
    deleteTodo(currentProject.id, todo.id).catch(() => {});
  };

  const onSwipeCancel = (todo: Todo) => {
    // Left-swipe is a cancel toggle: cancel an active todo, or restore an
    // already-cancelled one back to new — deliberately duplicating the
    // long-press revert on the pill.
    const next = todo.status === "cancelled" ? "new" : "cancelled";
    pushUndo({ type: "status", todoId: todo.id, prevStatus: todo.status, prevCompletedAt: todo.completedAt });
    setTodoStatus(currentProject.id, todo.id, next).catch(() => {});
  };

  const onSaveEdit = (todo: Todo, nextText: string) => {
    setEditingId(null);
    const trimmed = nextText.trim();
    if (trimmed && trimmed !== todo.text) {
      updateTodoText(currentProject.id, todo.id, trimmed);
    }
  };

  const toggleStatusFilter = (status: TodoStatus) => {
    setStatusFilter((prev) => (prev === status ? null : status));
  };

  const memberFilteredTodos = filterUserId ? todos.filter((td) => td.authorId === filterUserId) : todos;
  // Cancelled to-dos are excluded from every count entirely (not just "not
  // counted as done") — they're not part of New/Progress/Done's denominator.
  const countableTodos = memberFilteredTodos.filter((td) => td.status !== "cancelled");
  const newCount = countableTodos.filter((td) => td.status === "new").length;
  const inProgressCount = countableTodos.filter((td) => td.status === "in_progress").length;
  const doneCount = countableTodos.filter((td) => td.status === "done").length;
  const totalCount = countableTodos.length;

  const visibleTodos = statusFilter
    ? memberFilteredTodos.filter((td) => td.status === statusFilter)
    : memberFilteredTodos;
  const active = visibleTodos
    .filter((td) => td.status === "new" || td.status === "in_progress")
    .sort((a, b) => b.createdAt - a.createdAt);
  const done = visibleTodos
    .filter((td) => td.status === "done")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const cancelled = visibleTodos
    .filter((td) => td.status === "cancelled")
    .sort((a, b) => b.createdAt - a.createdAt);
  const sortedTodos = [...active, ...done, ...cancelled];

  const statusLabel: Record<TodoStatus, string> = {
    new: t.todo.statusNew,
    in_progress: t.todo.statusInProgress,
    done: t.todo.statusDone,
    cancelled: t.todo.statusCancelled,
  };

  return (
    <>
      <div ref={headerRef} className="sticky top-0 z-[1] bg-bg-base px-5 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2 pr-1">
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

        <div className="mb-3 flex items-center justify-between px-1 text-xs font-semibold text-text-secondary">
          <button onClick={() => toggleStatusFilter("new")} className="flex items-center gap-1">
            <span>New</span>
            <span
              className={statusFilter === "new" ? undefined : "text-text-primary"}
              style={statusFilter === "new" ? { color: currentProject.color ?? "#9900CC" } : undefined}
            >
              {newCount}
            </span>
          </button>
          <button onClick={() => toggleStatusFilter("in_progress")} className="flex items-center gap-1">
            <span>Progress</span>
            <span
              className={statusFilter === "in_progress" ? undefined : "text-text-primary"}
              style={statusFilter === "in_progress" ? { color: currentProject.color ?? "#9900CC" } : undefined}
            >
              {inProgressCount}/{newCount + inProgressCount}
            </span>
          </button>
          <button onClick={() => toggleStatusFilter("done")} className="flex items-center gap-1">
            <span>Done</span>
            <span
              className={statusFilter === "done" ? undefined : "text-text-primary"}
              style={statusFilter === "done" ? { color: currentProject.color ?? "#9900CC" } : undefined}
            >
              {doneCount}/{totalCount}
            </span>
          </button>
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
                  onEdit={() => setEditingId(todo.id)}
                  onSaveEdit={(nextText) => onSaveEdit(todo, nextText)}
                  onSwipeDelete={() => onSwipeDelete(todo)}
                  onSwipeCancel={() => onSwipeCancel(todo)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {undoStack.length > 0 && (
        <button
          onClick={onUndo}
          className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-pill bg-surface-pill px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-lg"
        >
          Ctrl+Z
        </button>
      )}
    </>
  );
}

function TodoRow({
  todo,
  statusLabel,
  isEditing,
  onAdvance,
  onRevert,
  onEdit,
  onSaveEdit,
  onSwipeDelete,
  onSwipeCancel,
}: {
  todo: Todo;
  statusLabel: string;
  isEditing: boolean;
  onAdvance: () => void;
  onRevert: () => void;
  onEdit: () => void;
  onSaveEdit: (text: string) => void;
  onSwipeDelete: () => void;
  onSwipeCancel: () => void;
}) {
  const { t } = useI18n();
  const [editText, setEditText] = useState(todo.text);
  const [armed, setArmed] = useState(false);
  // Which side is currently being revealed by an in-progress drag: "right"
  // exposes the trash/delete action on the left, "left" exposes the cancel
  // action on the right. Null at rest, when neither is showing.
  const [dragDir, setDragDir] = useState<"left" | "right" | null>(null);
  // Wrapped multi-line text is taller than the single-line edit <input>, so
  // switching to edit mid-hold collapses the row's height while the finger
  // is still down — that layout jump was knocking the touch off the row and
  // kicking the user back out of edit. Lock the row to its pre-edit height
  // (measured on the still-showing text, before onEdit flips the DOM to the
  // input) and release the lock once editing ends.
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textHandlers = useTapAndHold(() => {}, () => {
    if (rowRef.current) setLockedHeight(rowRef.current.getBoundingClientRect().height);
    onEdit();
  });
  const pillHandlers = useTapAndHold(onAdvance, onRevert);
  // Latches true the moment a drag's vertical movement crosses
  // VERTICAL_CANCEL_PX, killing drag (drag={false}) for the rest of this
  // gesture so it hands back off to native scrolling instead of continuing
  // to track horizontally. Reset on pointer release, ready for the next.
  const [verticalCancelled, setVerticalCancelled] = useState(false);
  // Owned explicitly (rather than left to framer's internal drag tracking)
  // so it can be snapped back to 0 on cancel — disabling `drag` mid-gesture
  // stops further tracking but doesn't itself animate the row back, which
  // left cancelled swipes visually stuck mid-slide.
  const x = useMotionValue(0);

  const onDrag = (_e: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.y) > VERTICAL_CANCEL_PX) {
      setVerticalCancelled(true);
      setDragDir(null);
      setArmed(false);
      animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
      return;
    }
    setDragDir(info.offset.x > 0 ? "right" : info.offset.x < 0 ? "left" : null);
    setArmed(Math.abs(info.offset.x) > SWIPE_DELETE_PX);
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (!verticalCancelled) {
      if (info.offset.x > SWIPE_DELETE_PX) onSwipeDelete();
      else if (info.offset.x < -SWIPE_DELETE_PX) onSwipeCancel();
    }
    setArmed(false);
    setDragDir(null);
  };

  // Grow the textarea to fit its wrapped content instead of scrolling
  // internally, so a multi-line todo keeps showing all of its lines while
  // being edited.
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEditing) {
      setEditText(todo.text);
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
      autoResize(input);
    } else {
      setLockedHeight(null);
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
      className="grid grid-cols-1"
    >
      {/* Revealed as the row is swiped right (delete, left-aligned trash) or
          left (cancel, right-aligned label); touch-action: pan-y on the row
          below lets native vertical scroll pass straight through, so only a
          confidently horizontal drag ever moves it. Only one side's box
          renders at a time based on the live drag direction, stacked on the
          draggable row via CSS grid (both col/row-start-1) rather than
          absolute+inset, so the visible layer always shares exactly the same
          box as the row regardless of layout-animation timing. */}
      {dragDir === "right" && (
        <div className="col-start-1 row-start-1 flex items-center rounded-card bg-[#141414] px-4">
          <Trash2 size={18} className={armed ? "text-red-400" : "text-gray-400"} />
        </div>
      )}
      {dragDir === "left" && (
        <div className="col-start-1 row-start-1 flex items-center justify-end rounded-card bg-[#141414] px-4">
          <span
            className={clsx(
              "text-xs font-semibold",
              todo.status === "cancelled"
                ? armed
                  ? "text-yellow-400"
                  : "text-gray-400"
                : armed
                  ? "text-red-400"
                  : "text-gray-400"
            )}
          >
            {todo.status === "cancelled" ? t.todo.swipeRestore : t.todo.swipeCancel}
          </span>
        </div>
      )}
      <motion.div
        ref={rowRef}
        drag={isEditing || verticalCancelled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 1, right: 1 }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onPointerUp={() => setVerticalCancelled(false)}
        onPointerCancel={() => setVerticalCancelled(false)}
        style={{ x, touchAction: "pan-y", minHeight: lockedHeight ?? undefined }}
        className="relative col-start-1 row-start-1 min-w-0 flex items-center gap-2.5 rounded-card bg-surface-card px-3 py-3"
      >
        <ColorDot color={todo.authorColor} />
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value);
              autoResize(e.target);
            }}
            onBlur={() => onSaveEdit(editText)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                inputRef.current?.blur();
              }
            }}
            rows={1}
            className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-sm text-text-primary outline-none"
          />
        ) : (
          <span
            {...textHandlers}
            className={clsx(
              "flex-1 select-none text-sm",
              todo.status === "done" || todo.status === "cancelled"
                ? "text-text-disabled line-through"
                : "text-text-primary"
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
            todo.status === "done" && "bg-emerald-500/20 text-emerald-300",
            todo.status === "cancelled" && "bg-red-500/20 text-red-400"
          )}
        >
          {statusLabel}
        </button>
      </motion.div>
    </motion.li>
  );
}
