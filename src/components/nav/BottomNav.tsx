"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  FolderKanban,
  CheckSquare,
  StickyNote,
  CalendarDays,
  MessageCircle,
  Settings,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nContext";

// iOS Safari doesn't keep `position: fixed` elements pinned to the visual
// viewport when the on-screen keyboard opens — it visibly drags them up
// along with the keyboard instead (Android is unaffected, either via the
// Virtual Keyboard API's overlay mode or correct viewport resizing). Rather
// than fight that per-platform quirk, just hide the nav while a keyboard is
// open; it's the common mobile pattern anyway and sidesteps the bug entirely.
const KEYBOARD_HEIGHT_THRESHOLD = 200;

function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOpen(window.innerHeight - vv.height > KEYBOARD_HEIGHT_THRESHOLD);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return keyboardOpen;
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const keyboardOpen = useKeyboardOpen();

  if (keyboardOpen) return null;

  const items = [
    { href: "/project", label: t.nav.project, Icon: FolderKanban },
    { href: "/todo", label: t.nav.todo, Icon: CheckSquare },
    { href: "/memo", label: t.nav.memo, Icon: StickyNote },
    { href: "/schedule", label: t.nav.schedule, Icon: CalendarDays },
    { href: "/chat", label: t.nav.chat, Icon: MessageCircle },
    { href: "/settings", label: t.nav.settings, Icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border-divider bg-bg-base pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {items.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-nav-active" : "text-nav-inactive"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
