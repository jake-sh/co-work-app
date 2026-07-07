import { addDoc, collection, doc, onSnapshot, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { addEvent } from "@/lib/data/schedule";
import { parseSchedulesFromText } from "@/lib/scheduleParse";
import type { Todo, TodoStatus } from "@/types";

function todosCol(projectId: string) {
  return collection(db, "projects", projectId, "todos");
}

export function subscribeTodos(projectId: string, cb: (todos: Todo[]) => void) {
  const q = query(todosCol(projectId));
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ ...(d.data() as Omit<Todo, "id">), id: d.id }))
      .sort((a, b) => b.createdAt - a.createdAt);
    cb(sorted);
  });
}

export async function addTodo(
  projectId: string,
  text: string,
  authorId: string,
  authorName: string,
  authorColor: string
) {
  const ref = await addDoc(todosCol(projectId), {
    text,
    status: "new" satisfies TodoStatus,
    authorId,
    authorName,
    authorColor,
    createdAt: Date.now(),
    completedAt: null,
  });

  const parsedList = parseSchedulesFromText(text);
  await Promise.all(
    parsedList.map((parsed) =>
      addEvent(
        projectId,
        parsed.title,
        parsed.date,
        parsed.time,
        authorId,
        authorColor,
        { type: "todo", id: ref.id },
        parsed.rangeId ? { rangeId: parsed.rangeId, rangeStart: parsed.rangeStart!, rangeEnd: parsed.rangeEnd! } : undefined
      ).catch((err) => console.error("Auto schedule-event creation from to-do failed:", err))
    )
  );
}

export async function updateTodoText(projectId: string, todoId: string, text: string) {
  await updateDoc(doc(db, "projects", projectId, "todos", todoId), { text });
}

export async function deleteTodo(projectId: string, todoId: string) {
  const { deleteDoc } = await import("firebase/firestore");
  // Deleting a to-do intentionally leaves any auto-created schedule event in
  // place — it's a real calendar entry at that point, not just metadata tied
  // to the to-do's lifecycle.
  await deleteDoc(doc(db, "projects", projectId, "todos", todoId));
}

export async function setTodoStatus(projectId: string, todoId: string, status: TodoStatus) {
  await updateDoc(doc(db, "projects", projectId, "todos", todoId), {
    status,
    completedAt: status === "done" ? Date.now() : null,
  });
}

// Undo for a swipe-delete: recreates the doc at its original id with its
// exact prior fields. Deliberately doesn't re-run schedule auto-parsing —
// deleting a to-do never touched its linked schedule event either, so undo
// shouldn't create a new one.
export async function restoreTodo(projectId: string, todo: Todo) {
  const { id, ...fields } = todo;
  await setDoc(doc(db, "projects", projectId, "todos", id), fields);
}

// Undo for a status change (advance/revert/cancel/restore): restores both
// the status and its exact prior completedAt, rather than letting
// setTodoStatus re-derive a fresh completedAt timestamp.
export async function restoreTodoStatus(
  projectId: string,
  todoId: string,
  status: TodoStatus,
  completedAt: number | null
) {
  await updateDoc(doc(db, "projects", projectId, "todos", todoId), { status, completedAt });
}
