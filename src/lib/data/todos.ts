import { addDoc, collection, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { addEvent, deleteEvent, findEventBySource } from "@/lib/data/schedule";
import { parseScheduleFromText } from "@/lib/scheduleParse";
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

  const parsed = parseScheduleFromText(text);
  if (parsed) {
    await addEvent(projectId, text, parsed.date, parsed.time, authorId, authorColor, {
      type: "todo",
      id: ref.id,
    }).catch((err) => console.error("Auto schedule-event creation from to-do failed:", err));
  }
}

export async function updateTodoText(projectId: string, todoId: string, text: string) {
  await updateDoc(doc(db, "projects", projectId, "todos", todoId), { text });
}

export async function deleteTodo(projectId: string, todoId: string) {
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, "projects", projectId, "todos", todoId));

  // Best-effort: clean up the auto-created calendar event (if any) so it
  // doesn't linger orphaned once its source to-do is gone.
  try {
    const existingEventId = await findEventBySource(projectId, { type: "todo", id: todoId });
    if (existingEventId) await deleteEvent(projectId, existingEventId);
  } catch {
    // The to-do delete itself already succeeded.
  }
}

export async function setTodoStatus(projectId: string, todoId: string, status: TodoStatus) {
  await updateDoc(doc(db, "projects", projectId, "todos", todoId), {
    status,
    completedAt: status === "done" ? Date.now() : null,
  });
}
