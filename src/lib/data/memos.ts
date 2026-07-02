import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { addEvent } from "@/lib/data/schedule";
import { parseScheduleFromText } from "@/lib/scheduleParse";
import type { Memo } from "@/types";

function memosCol(projectId: string) {
  return collection(db, "projects", projectId, "memos");
}

export function deriveTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;
  const tokens = body.trim().split(/\s+/).filter(Boolean);
  return tokens.slice(0, 10).join(" ") || "Untitled";
}

export function subscribeMemos(projectId: string, cb: (memos: Memo[]) => void) {
  const q = query(memosCol(projectId));
  return onSnapshot(
    q,
    (snap) => {
      const sorted = snap.docs
        .map((d) => ({ ...(d.data() as Omit<Memo, "id">), id: d.id }))
        .sort((a, b) => b.createdAt - a.createdAt);
      cb(sorted);
    },
    () => cb([])
  );
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

  const parsed = parseScheduleFromText(`${title} ${body}`);
  if (parsed) {
    await addEvent(projectId, finalTitle, parsed.date, parsed.time, authorId, authorColor, {
      type: "memo",
      id: ref.id,
    }).catch(() => {});
  }
}

export async function updateMemo(projectId: string, memoId: string, title: string, body: string) {
  const finalTitle = deriveTitle(title, body);
  await updateDoc(doc(db, "projects", projectId, "memos", memoId), {
    title: finalTitle,
    body,
  });
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
