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
import { arrayUnion } from "firebase/firestore";
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
        .sort((a, b) => b.createdAt - a.createdAt);
      cb(sorted);
    },
    () => cb([])
  );
}

export async function createProject(
  name: string,
  description: string,
  ownerId: string,
  startDate: string | null,
  endDate: string | null
): Promise<string> {
  const ref = await addDoc(projectsCol, {
    name,
    description,
    ownerId,
    memberIds: [ownerId],
    startDate,
    endDate,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function addMemberByUsername(projectId: string, username: string) {
  const member = await findUserByUsername(username.trim().toLowerCase());
  if (!member) throw new Error("USER_NOT_FOUND");
  await updateDoc(doc(db, "projects", projectId), {
    memberIds: arrayUnion(member.uid),
  });
  return member;
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
