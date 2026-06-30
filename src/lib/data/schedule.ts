import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ScheduleEvent } from "@/types";

function eventsCol(projectId: string) {
  return collection(db, "projects", projectId, "schedule");
}

export function subscribeEvents(projectId: string, cb: (events: ScheduleEvent[]) => void) {
  const q = query(eventsCol(projectId), orderBy("date", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<ScheduleEvent, "id">), id: d.id })));
  });
}

export async function addEvent(
  projectId: string,
  title: string,
  date: string,
  time: string | null,
  authorId: string,
  authorColor: string,
  source?: { type: "memo" | "todo"; id: string }
) {
  await addDoc(eventsCol(projectId), {
    title,
    date,
    time,
    authorId,
    authorColor,
    createdAt: Date.now(),
    ...(source ? { source } : {}),
  });
}
