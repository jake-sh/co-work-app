"use client";

import { useEffect, useRef, useState } from "react";
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
import { VoiceInputNavItem } from "@/components/VoiceInputNavItem";
import { toggleVoiceDebug } from "@/lib/voiceDebug";

// iOS Safari doesn't keep `position: fixed` elements pinned to the visual
// viewport when the on-screen keyboard opens — it visibly drags them up
// along with the keyboard instead (Android is unaffected, either via the
// Virtual Keyboard API's overlay mode or correct viewport resizing). Rather
// than fight that per-platform quirk, just hide the nav while a keyboard is
// open; it's the common mobile pattern anyway and sidesteps the bug entirely.
const KEYBOARD_HEIGHT_THRESHOLD = 200;

// How long a hold on the Settings nav item takes to flip the hidden
// voice-input debug log on/off — long enough that it's never brushed by an
// ordinary tap-to-navigate press.
const DEBUG_TOGGLE_HOLD_MS = 5000;
const DEBUG_TOGGLE_MOVE_CANCEL_PX = 10;

function useSettingsDebugToggle() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    held.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => {
      held.current = true;
      toggleVoiceDebug();
      try {
        navigator.vibrate?.(100);
      } catch {
        // No haptic feedback available — the toggle itself still applied.
      }
    }, DEBUG_TOGGLE_HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || !timer.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > DEBUG_TOGGLE_MOVE_CANCEL_PX) clearTimer();
  };

  const onPointerUp = () => {
    clearTimer();
  };

  const onPointerLeave = () => {
    clearTimer();
    start.current = null;
  };

  // The long-press already fired the toggle by the time pointerup/click
  // happens — swallow the click so it doesn't also navigate to Settings.
  const onClick = (e: React.MouseEvent) => {
    if (held.current) {
      e.preventDefault();
      held.current = false;
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel: onPointerLeave,
    onClick,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

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
  const settingsDebugToggle = useSettingsDebugToggle();

  if (keyboardOpen) return null;

  // Split so the voice-input nav item can sit between memo and schedule.
  const beforeItems = [
    { href: "/project", label: t.nav.project, Icon: FolderKanban },
    { href: "/todo", label: t.nav.todo, Icon: CheckSquare },
    { href: "/memo", label: t.nav.memo, Icon: StickyNote },
  ];
  const afterItems = [
    { href: "/schedule", label: t.nav.schedule, Icon: CalendarDays },
    { href: "/chat", label: t.nav.chat, Icon: MessageCircle },
    { href: "/settings", label: t.nav.settings, Icon: Settings },
  ];

  const renderItem = ({ href, label, Icon }: (typeof beforeItems)[number]) => {
    const active = pathname?.startsWith(href);
    // Settings doubles as the hidden entry point for toggling the
    // voice-input debug log (5s+ long-press) — see useSettingsDebugToggle.
    const debugToggleProps = href === "/settings" ? settingsDebugToggle : {};
    return (
      <li key={href} className="flex-1">
        <Link
          href={href}
          className={clsx(
            "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
            active ? "text-nav-active" : "text-nav-inactive"
          )}
          style={href === "/settings" ? { touchAction: "none" } : undefined}
          // Android Chrome shows its native "copy link/share/open in
          // browser" sheet on a long-press over any anchor — every nav item
          // is one, so block it everywhere, the same fix already used for
          // the mic button (see VoiceInputNavItem).
          onContextMenu={(e) => e.preventDefault()}
          {...debugToggleProps}
        >
          <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
          <span>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border-divider bg-bg-base pb-[env(safe-area-inset-bottom)]">
      {/* Fixed height so the enlarged voice-input circle (which pokes above
          this row via relative positioning) can never stretch the bar. */}
      <ul className="flex h-[61px]">
        {beforeItems.map(renderItem)}
        <VoiceInputNavItem />
        {afterItems.map(renderItem)}
      </ul>
    </nav>
  );
}
