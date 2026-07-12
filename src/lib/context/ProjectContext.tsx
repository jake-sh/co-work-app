"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  // Tracks whether the first real Firestore snapshot has been validated.
  // Prevents fallback from running on the transient user=null state.
  const validatedRef = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!user) {
      setProjects([]);
      setLoading(false);
      validatedRef.current = false;
      return;
    }
    setLoading(true);
    validatedRef.current = false;
    const unsubscribe = subscribeUserProjects(user.uid, (next) => {
      setProjects(next);
      setLoading(false);
      if (!validatedRef.current) {
        validatedRef.current = true;
        // On first real snapshot: keep stored ID if valid, otherwise fall back.
        setCurrentProjectIdState((prev) => {
          if (prev && next.some((p) => p.id === prev)) return prev;
          return next[0]?.id ?? null;
        });
      }
    });
    return unsubscribe;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  // Stable reference: consumers (e.g. ProjectDetailClient) depend on this
  // function identity in their own effects to sync the URL's projectId into
  // context. A fresh closure on every render made those effects re-fire on
  // any unrelated context update — including this function's own call while
  // switching projects — briefly resetting currentProjectId back to the
  // page's still-stale projectId prop before navigation caught up, which
  // showed up as the active tab's color bar flickering back before settling.
  const setCurrentProjectId = useCallback((id: string | null) => {
    setCurrentProjectIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({ projects, currentProjectId, currentProject, setCurrentProjectId, loading }),
    [projects, currentProjectId, currentProject, setCurrentProjectId, loading]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectProvider");
  return ctx;
}
