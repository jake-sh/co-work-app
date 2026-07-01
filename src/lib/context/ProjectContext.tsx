"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { subscribeUserProjects } from "@/lib/data/projects";
import type { Project } from "@/types";

interface ProjectContextValue {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  setCurrentProjectId: (id: string | null) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_KEY = "cowork.currentProjectId";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // External-store subscription: Firestore pushes updates asynchronously via
    // the onSnapshot callback, so these setState calls are not synchronous re-renders.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeUserProjects(user.uid, (next) => {
      setProjects(next);
      setLoading(false);
    });
    return unsubscribe;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (currentProjectId && !projects.some((p) => p.id === currentProjectId)) {
      setCurrentProjectIdState(projects[0]?.id ?? null);
    } else if (!currentProjectId && projects.length > 0) {
      setCurrentProjectIdState(projects[0].id);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const setCurrentProjectId = (id: string | null) => {
    setCurrentProjectIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({ projects, currentProjectId, currentProject, setCurrentProjectId, loading }),
    [projects, currentProjectId, currentProject, loading]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectProvider");
  return ctx;
}
