import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { addEvent, deleteEvent, findEventBySource, updateEvent } from "@/lib/data/schedule";
import { parseScheduleFromText } from "@/lib/scheduleParse";
import type { Memo } from "@/types";

function memosCol(projectId: string) {
  return collection(db, "projects", projectId, "memos");
}

export function deriveTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;
  const tokens = body.trim().split(/\s+/).filter(Boolean);
  return tokens.slice(0, 5).join(" ") || "Untitled";
}

// A memo is only visible to its author and whoever it's been shared with —
// two separate queries merged client-side, since Firestore can't express
// "authorId == uid OR uid in sharedWith" in a single indexed query.
export function subscribeMemos(projectId: string, uid: string, cb: (memos: Memo[]) => void) {
  const ownQuery = query(memosCol(projectId), where("authorId", "==", uid));
  const sharedQuery = query(memosCol(projectId), where("sharedWith", "array-contains", uid));

  let ownMemos: Memo[] = [];
  let sharedMemos: Memo[] = [];

  const emit = () => {
    const byId = new Map<string, Memo>();
    for (const memo of [...ownMemos, ...sharedMemos]) byId.set(memo.id, memo);
    cb(Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt));
  };

  const unsubOwn = onSnapshot(ownQuery, (snap) => {
    ownMemos = snap.docs.map((d) => ({ ...(d.data() as Omit<Memo, "id">), id: d.id }));
    emit();
  });
  const unsubShared = onSnapshot(sharedQuery, (snap) => {
    sharedMemos = snap.docs.map((d) => ({ ...(d.data() as Omit<Memo, "id">), id: d.id }));
    emit();
  });

  return () => {
    unsubOwn();
    unsubShared();
  };
}

// Keeps the memo's auto-created calendar event (if any) in sync: creates it
// the first time a shared, non-excluded memo's text parses to a date,
// updates it if the date/time changes, and removes it if the memo stops
// qualifying (unshared, edited to remove the date, or now excluded).
async function syncScheduleFromMemo(
  projectId: string,
  memoId: string,
  finalTitle: string,
  fullText: string,
  authorId: string,
  authorColor: string,
  isShared: boolean
) {
  const source = { type: "memo" as const, id: memoId };

  try {
    const isExcludedFromParsing = fullText.includes("주요신문");
    const parsed = isShared && !isExcludedFromParsing ? parseScheduleFromText(fullText) : null;
    const existingEventId = await findEventBySource(projectId, source);
    if (parsed) {
      if (existingEventId) {
        await updateEvent(projectId, existingEventId, finalTitle, parsed.date, parsed.time);
      } else {
        await addEvent(projectId, finalTitle, parsed.date, parsed.time, authorId, authorColor, source);
      }
    } else if (existingEventId) {
      await deleteEvent(projectId, existingEventId);
    }
  } catch (err) {
    // Best-effort: the memo save itself already succeeded.
    console.error("Auto schedule-event sync from memo failed:", err);
  }
}

export async function addMemo(
  projectId: string,
  title: string,
  body: string,
  authorId: string,
  authorName: string,
  authorColor: string,
  memberIds: string[] = []
) {
  const finalTitle = deriveTitle(title, body);
  const ref = await addDoc(memosCol(projectId), {
    title: finalTitle,
    body,
    authorId,
    authorName,
    authorColor,
    createdAt: Date.now(),
    sharedWith: memberIds,
  });

  await syncScheduleFromMemo(projectId, ref.id, finalTitle, `${title} ${body}`, authorId, authorColor, memberIds.length > 0);
}

export async function updateMemo(
  projectId: string,
  memoId: string,
  title: string,
  body: string,
  authorId: string,
  authorColor: string,
  isShared: boolean
) {
  const finalTitle = deriveTitle(title, body);
  await updateDoc(doc(db, "projects", projectId, "memos", memoId), {
    title: finalTitle,
    body,
  });

  await syncScheduleFromMemo(projectId, memoId, finalTitle, `${title} ${body}`, authorId, authorColor, isShared);
}

export async function deleteMemo(projectId: string, memoId: string) {
  await deleteDoc(doc(db, "projects", projectId, "memos", memoId));
}

export async function shareMemoWithMembers(projectId: string, memoId: string, memberIds: string[]) {
  await updateDoc(doc(db, "projects", projectId, "memos", memoId), {
    sharedWith: arrayUnion(...memberIds),
  });
}

export async function unshareMemo(projectId: string, memoId: string, memberIds: string[]) {
  await updateDoc(doc(db, "projects", projectId, "memos", memoId), {
    sharedWith: memberIds.length ? arrayRemove(...memberIds) : [],
  });
}
