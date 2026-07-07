import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ScheduleEvent } from "@/types";

function eventsCol(projectId: string) {
  return collection(db, "projects", projectId, "schedule");
}

// A memo/to-do can now auto-create more than one schedule event (one per
// dated line), so lookups by source return every matching event id.
export async function findEventIdsBySource(
  projectId: string,
  source: { type: "memo" | "todo"; id: string }
): Promise<string[]> {
  const snap = await getDocs(
    query(eventsCol(projectId), where("source.type", "==", source.type), where("source.id", "==", source.id))
  );
  return snap.docs.map((d) => d.id);
}

export function subscribeEvents(projectId: string, cb: (events: ScheduleEvent[]) => void) {
  const q = query(eventsCol(projectId));
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ ...(d.data() as Omit<ScheduleEvent, "id">), id: d.id }))
      .sort((a, b) => a.date.localeCompare(b.date));
    cb(sorted);
  });
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

export async function updateEventColor(projectId: string, eventId: string, labelColor: string) {
  await updateDoc(doc(db, "projects", projectId, "schedule", eventId), { labelColor });
}

export async function addEvent(
  projectId: string,
  title: string,
  date: string,
  time: string | null,
  authorId: string,
  authorColor: string,
  source?: { type: "memo" | "todo"; id: string },
  range?: { rangeId: string; rangeStart: string; rangeEnd: string }
) {
  await addDoc(eventsCol(projectId), {
    title,
    date,
    time,
    authorId,
    authorColor,
    createdAt: Date.now(),
    ...(source ? { source } : {}),
    ...(range ? range : {}),
  });
}

// A date-range mention ("7/5~7/7 교육") creates one event per day, all
// sharing rangeId, so the schedule list can show/edit/delete them as a
// single period instead of separate rows.
export async function findEventIdsByRange(projectId: string, rangeId: string): Promise<string[]> {
  const snap = await getDocs(query(eventsCol(projectId), where("rangeId", "==", rangeId)));
  return snap.docs.map((d) => d.id);
}

export async function deleteEventsByRange(projectId: string, rangeId: string) {
  const ids = await findEventIdsByRange(projectId, rangeId);
  await Promise.all(ids.map((id) => deleteEvent(projectId, id)));
}

export async function updateEventsByRange(
  projectId: string,
  rangeId: string,
  title: string,
  time: string | null
) {
  const ids = await findEventIdsByRange(projectId, rangeId);
  await Promise.all(
    ids.map((id) => updateDoc(doc(db, "projects", projectId, "schedule", id), { title, time }))
  );
}
