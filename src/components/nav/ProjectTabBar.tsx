"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useProjects } from "@/lib/context/ProjectContext";

export function ProjectTabBar() {
  const { projects, currentProjectId, setCurrentProjectId } = useProjects();
  const activeRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [currentProjectId]);

  if (projects.length === 0) return null;

  const onTabClick = (id: string) => {
    setCurrentProjectId(id);
    const projectDetailMatch = pathname.match(/^\/project\/([^/]+)/);
    if (projectDetailMatch) {
      router.push(`/project/${id}`);
    }
  };

  return (
    <div className="sticky top-0 z-10 hide-scrollbar flex overflow-x-auto border-b border-border-divider bg-bg-base">
      {projects.map((p) => {
        const isActive = p.id === currentProjectId;
        return (
          <button
            key={p.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => onTabClick(p.id)}
            className={clsx(
              "relative flex shrink-0 items-center gap-2 border-r border-border-divider px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-surface-card text-text-primary"
                : "bg-bg-base text-text-secondary"
            )}
          >
            {isActive && (
              <span className="absolute inset-x-0 top-0 h-[2px] rounded-b-sm" style={{ backgroundColor: "#9900CC" }} />
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
