"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { useProjects } from "@/lib/context/ProjectContext";

export function ProjectTabBar() {
  const { projects, currentProjectId, setCurrentProjectId } = useProjects();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [currentProjectId]);

  if (projects.length === 0) return null;

  return (
    <div className="hide-scrollbar flex overflow-x-auto border-b border-border-divider bg-bg-base">
      {projects.map((p) => {
        const isActive = p.id === currentProjectId;
        return (
          <button
            key={p.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => setCurrentProjectId(p.id)}
            className={clsx(
              "relative flex shrink-0 items-center gap-2 border-r border-border-divider px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-surface-card text-text-primary"
                : "bg-bg-base text-text-secondary"
            )}
          >
            {isActive && (
              <span className="absolute inset-x-0 top-0 h-[2px] rounded-b-sm bg-white" />
            )}
            <span className={clsx("max-w-[100px] truncate", p.status === "completed" && "opacity-50")}>
              {p.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
