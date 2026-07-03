import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { arrayRemove, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { findUserByUsername } from "@/lib/data/users";
import type { Project } from "@/types";

const projectsCol = collection(db, "projects");

export function subscribeUserProjects(uid: string, cb: (projects: Project[]) => void) {
  const q = query(projectsCol, where("memberIds", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      const sorted = snap.docs
        .map((d) => ({ ...(d.data() as Omit<Project, "id">), id: d.id }))
        .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
      cb(sorted);
    },
    () => cb([])
  );
}

export async function reorderProjects(projectIds: string[]) {
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);
  projectIds.forEach((id, index) => {
    batch.update(doc(db, "projects", id), { order: index });
  });
  await batch.commit();
}

export async function createProject(
  name: string,
  description: string,
  ownerId: string,
  startDate: string | null,
  endDate: string | null,
  color: string = "#9900CC"
): Promise<string> {
  const ref = await addDoc(projectsCol, {
    name,
    description,
    ownerId,
    memberIds: [ownerId],
    startDate,
    endDate,
    color,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateProjectColor(projectId: string, color: string) {
  await updateDoc(doc(db, "projects", projectId), { color });
}

export async function addMemberByUsername(projectId: string, username: string) {
  const member = await findUserByUsername(username.trim().toLowerCase());
  if (!member) throw new Error("USER_NOT_FOUND");
  await updateDoc(doc(db, "projects", projectId), {
    memberIds: arrayUnion(member.uid),
  });
  return member;
}

export async function removeMember(projectId: string, uid: string) {
  await updateDoc(doc(db, "projects", projectId), {
    memberIds: arrayRemove(uid),
  });
}

// A member removing themselves from the project. Same write as removeMember,
// named separately for intent at the call site.
export async function leaveProject(projectId: string, uid: string) {
  await updateDoc(doc(db, "projects", projectId), {
    memberIds: arrayRemove(uid),
  });
}

export async function setProjectStatus(projectId: string, status: "active" | "completed") {
  await updateDoc(doc(db, "projects", projectId), { status });
}

export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, "projects", projectId));
}

export async function updateProjectPeriod(
  projectId: string,
  startDate: string | null,
  endDate: string | null
) {
  await updateDoc(doc(db, "projects", projectId), { startDate, endDate });
}

export async function updateProject(
  projectId: string,
  name: string,
  description: string,
  startDate: string | null,
  endDate: string | null
) {
  await updateDoc(doc(db, "projects", projectId), { name, description, startDate, endDate });
}
