import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { addEvent } from "@/lib/data/schedule";
import { parseScheduleFromText } from "@/lib/scheduleParse";
import type { Todo, TodoStatus } from "@/types";

function todosCol(projectId: string) {
  return collection(db, "projects", projectId, "todos");
}

export function subscribeTodos(projectId: string, cb: (todos: Todo[]) => void) {
  const q = query(todosCol(projectId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Todo, "id">), id: d.id })));
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
    });
  }
}

export async function setTodoStatus(projectId: string, todoId: string, status: TodoStatus) {
  await updateDoc(doc(db, "projects", projectId, "todos", todoId), {
    status,
    completedAt: status === "done" ? Date.now() : null,
  });
}
