"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { addTodo, setTodoStatus } from "@/lib/data/todos";
import { useData } from "@/lib/context/DataContext";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ColorDot } from "@/components/ui/ColorDot";
import type { Todo, TodoStatus } from "@/types";
import { clsx } from "clsx";

const NEXT_STATUS: Record<TodoStatus, TodoStatus> = {
  new: "in_progress",
  in_progress: "done",
  done: "new",
};

export default function TodoPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const { todos } = useData();
  const [text, setText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setAddError(null);
    try {
      await addTodo(currentProject.id, text.trim(), profile.uid, profile.displayName, profile.colorCode);
      setText("");
    } catch {
      setAddError(t.auth.genericError);
    }
  };

  const cycleStatus = (todo: Todo) => {
    setTodoStatus(currentProject.id, todo.id, NEXT_STATUS[todo.status]);
  };

  const active = todos
    .filter((td) => td.status !== "done")
    .sort((a, b) => b.createdAt - a.createdAt);
  const done = todos
    .filter((td) => td.status === "done")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const statusLabel: Record<TodoStatus, string> = {
    new: t.todo.statusNew,
    in_progress: t.todo.statusInProgress,
    done: t.todo.statusDone,
  };

  return (
    <>
      <div className="sticky top-0 z-[1] bg-bg-base px-5 pt-8 pb-4">
        <h1 className="text-3xl font-bold">{t.todo.title}</h1>
      </div>

      <div className="px-5 pb-10">
        <form onSubmit={onAdd} className="mb-6 flex gap-2">
          <TextInput
            placeholder={t.todo.inputPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3"
          >
            <Plus size={18} />
          </button>
        </form>
        {addError && <p className="mb-4 text-xs text-red-400">{addError}</p>}

        {todos.length === 0 ? (
          <EmptyState message={t.todo.empty} />
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {active.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  statusLabel={statusLabel[todo.status]}
                  onToggle={() => cycleStatus(todo)}
                />
              ))}
            </AnimatePresence>

            {done.length > 0 && (
              <p className="mt-4 mb-1 text-xs font-semibold text-text-secondary">
                {t.todo.statusDone}
              </p>
            )}
            <AnimatePresence initial={false}>
              {done.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  statusLabel={statusLabel[todo.status]}
                  onToggle={() => cycleStatus(todo)}
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
  onToggle,
}: {
  todo: Todo;
  statusLabel: string;
  onToggle: () => void;
}) {
  return (
    <motion.li
      layout
      layoutId={todo.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3"
    >
      <ColorDot color={todo.authorColor} />
      <span
        className={clsx(
          "flex-1 text-sm",
          todo.status === "done" ? "text-text-disabled line-through" : "text-text-primary"
        )}
      >
        {todo.text}
      </span>
      <button
        onClick={onToggle}
        className={clsx(
          "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
          todo.status === "new" && "bg-surface-pill text-text-secondary",
          todo.status === "in_progress" && "bg-blue-500/20 text-blue-300",
          todo.status === "done" && "bg-emerald-500/20 text-emerald-300"
        )}
      >
        {statusLabel}
      </button>
    </motion.li>
  );
}
