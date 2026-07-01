import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ScheduleEvent } from "@/types";

function eventsCol(projectId: string) {
  return collection(db, "projects", projectId, "schedule");
}

export function subscribeEvents(projectId: string, cb: (events: ScheduleEvent[]) => void) {
  const q = query(eventsCol(projectId));
  return onSnapshot(
    q,
    (snap) => {
      const sorted = snap.docs
        .map((d) => ({ ...(d.data() as Omit<ScheduleEvent, "id">), id: d.id }))
        .sort((a, b) => a.date.localeCompare(b.date));
      cb(sorted);
    },
    () => cb([])
  );
}

export async function updateEvent(
  projectId: string,
  eventId: string,
  title: string,
  date: string,
  time: string | null
) {
  await updateDoc(doc(db, "projects", projectId, "schedule", eventId), { title, date, time });
}

export async function deleteEvent(projectId: string, eventId: string) {
  await deleteDoc(doc(db, "projects", projectId, "schedule", eventId));
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
