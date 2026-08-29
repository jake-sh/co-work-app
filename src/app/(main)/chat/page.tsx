"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useData } from "@/lib/context/DataContext";
import { Copy, Pencil, Reply as ReplyIcon, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { deleteAllMessages, deleteMessage, editMessage, markChatRead, sendMessage } from "@/lib/data/chat";
import { TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { clsx } from "clsx";
import type { ChatMessage, Project } from "@/types";

function unreadCountFor(msg: ChatMessage, project: Project) {
  return project.memberIds.filter(
    (uid) => uid !== msg.authorId && (project.lastRead?.[uid] ?? 0) < msg.createdAt
  ).length;
}

// Bottom nav content height (py-2.5 × 2 + icon 22px + gap 4px + label ~16px)
const NAV_H = 62;

// Same thresholds as todo/page.tsx's useTapAndHold — long enough that a
// normal tap or the start of a scroll never trips it.
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

export default function ChatPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const { messages } = useData();
  const [text, setText] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [formHeight, setFormHeight] = useState(56);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Long-press-to-open-menu state for message bubbles (Copy/Reply/Edit/
  // Delete), plus reply/edit compose state and the per-message delete
  // confirm dialog.
  const [actionMenuMsg, setActionMenuMsg] = useState<ChatMessage | null>(null);
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);

  // A single set of refs (rather than one useTapAndHold instance per
  // message) works fine here since only one bubble can be mid-press at a
  // time — looping a hook call per message in .map() would break the
  // rules of hooks anyway, since the message count changes across renders.
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const onBubblePointerDown = (msg: ChatMessage) => (e: React.PointerEvent) => {
    longPressStart.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setActionMenuMsg(msg);
      try {
        navigator.vibrate?.(30);
      } catch {
        // No haptic feedback available — the menu still opens.
      }
    }, LONG_PRESS_MS);
  };
  const onBubblePointerMove = (e: React.PointerEvent) => {
    if (!longPressStart.current || !longPressTimer.current) return;
    const dx = e.clientX - longPressStart.current.x;
    const dy = e.clientY - longPressStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearLongPress();
  };
  const onBubblePointerEnd = () => {
    clearLongPress();
    longPressStart.current = null;
  };

  useEffect(() => {
    type VK = { overlaysContent: boolean; boundingRect: DOMRect } & EventTarget;

    if ("virtualKeyboard" in navigator) {
      // Android Chrome: Virtual Keyboard API — fires in sync with keyboard animation
      const vk = (navigator as { virtualKeyboard: VK }).virtualKeyboard;
      vk.overlaysContent = true;
      const onGeometry = () => setKeyboardHeight((vk as VK & { boundingRect: DOMRect }).boundingRect.height);
      vk.addEventListener("geometrychange", onGeometry);
      return () => {
        vk.removeEventListener("geometrychange", onGeometry);
        vk.overlaysContent = false;
      };
    }

    // iOS Safari: visualViewport shrinks when keyboard appears
    const update = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setKeyboardHeight(Math.max(0, window.innerHeight - vv.offsetTop - vv.height));
    };
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  // Track form height for messages bottom padding
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFormHeight(el.offsetHeight));
    ro.observe(el);
    setFormHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Scroll to bottom when keyboard opens so last message stays visible
  useEffect(() => {
    if (keyboardHeight > 50) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [keyboardHeight]);

  // Mark chat read up to the latest message while this page is open.
  // Deps are primitives only (not the profile/currentProject objects): this
  // write updates the project doc's lastRead map, which makes the project
  // subscription re-emit a brand new `currentProject` object on every write.
  // Depending on that object reference here would re-fire this effect on its
  // own write, looping indefinitely and flooding the shared realtime
  // connection instead of just marking read once per new message.
  useEffect(() => {
    if (!profile?.uid || !currentProject?.id || messages.length === 0) return;
    markChatRead(currentProject.id, profile.uid);
  }, [profile?.uid, currentProject?.id, messages.length]);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const onSend = async () => {
    const trimmed = text.trim();
    if (!profile || !trimmed) return;
    // Reset and refocus before await so keyboard never dismisses
    setText("");
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.focus();
    }
    if (editingMsg) {
      const id = editingMsg.id;
      setEditingMsg(null);
      await editMessage(currentProject.id, id, trimmed);
      return;
    }
    const replyTo = replyTarget
      ? { id: replyTarget.id, authorName: replyTarget.authorName, text: replyTarget.text }
      : null;
    setReplyTarget(null);
    await sendMessage(
      currentProject.id,
      trimmed,
      profile.uid,
      profile.nickname ?? profile.displayName,
      profile.colorCode,
      replyTo,
    );
  };

  const onConfirmDeleteAll = async () => {
    await deleteAllMessages(currentProject.id);
    setConfirmDeleteAll(false);
  };

  const onCopy = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
    } catch {
      // Clipboard API unavailable or permission denied — nothing more to do.
    }
  };

  const onStartReply = (msg: ChatMessage) => {
    setEditingMsg(null);
    setReplyTarget(msg);
    textareaRef.current?.focus();
  };

  const onStartEdit = (msg: ChatMessage) => {
    setReplyTarget(null);
    setEditingMsg(msg);
    setText(msg.text);
    // Deferred a frame: the textarea is React-controlled, so scrollHeight
    // right after setText would still measure the *previous* value — the
    // DOM hasn't committed the new one yet on this same tick.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    });
  };

  const onCancelCompose = () => {
    setReplyTarget(null);
    if (editingMsg) setText("");
    setEditingMsg(null);
  };

  const onConfirmDeleteMsg = async () => {
    if (!confirmDeleteMsg) return;
    const id = confirmDeleteMsg.id;
    setConfirmDeleteMsg(null);
    await deleteMessage(currentProject.id, id);
  };

  const keyboardOpen = keyboardHeight > 50;

  // Layout adds pb-20 (80px) globally; subtract it to avoid double-counting
  const messagesPaddingBottom = formHeight + (keyboardOpen ? keyboardHeight : NAV_H) + 16 - 80;

  return (
    <>
      {confirmDeleteAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmDeleteAll(false)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-center text-sm font-semibold">{t.chat.deleteAllConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onConfirmDeleteAll}
                className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400"
              >
                {t.chat.deleteAll}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionMenuMsg && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setActionMenuMsg(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-2xl bg-surface-card pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onCopy(actionMenuMsg);
                setActionMenuMsg(null);
              }}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium"
            >
              <Copy size={18} className="text-text-secondary" />
              {t.chat.copy}
            </button>
            <button
              onClick={() => {
                onStartReply(actionMenuMsg);
                setActionMenuMsg(null);
              }}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium"
            >
              <ReplyIcon size={18} className="text-text-secondary" />
              {t.chat.reply}
            </button>
            {actionMenuMsg.authorId === profile?.uid && (
              <>
                <button
                  onClick={() => {
                    onStartEdit(actionMenuMsg);
                    setActionMenuMsg(null);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium"
                >
                  <Pencil size={18} className="text-text-secondary" />
                  {t.chat.edit}
                </button>
                <button
                  onClick={() => {
                    setConfirmDeleteMsg(actionMenuMsg);
                    setActionMenuMsg(null);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium text-red-400"
                >
                  <Trash2 size={18} />
                  {t.chat.delete}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {confirmDeleteMsg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setConfirmDeleteMsg(null)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-2xl bg-surface-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-center text-sm font-semibold">{t.chat.deleteConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteMsg(null)}
                className="flex-1 rounded-xl bg-surface-pill py-2.5 text-sm font-semibold"
              >
                {t.project.cancel}
              </button>
              <button
                onClick={onConfirmDeleteMsg}
                className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400"
              >
                {t.chat.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 bg-bg-base px-5 pt-4 pb-3">
        <h1 className="truncate text-3xl font-semibold" style={{ fontFamily: "var(--font-titillium)" }}>
          {currentProject.name}
        </h1>
        <button
          onClick={() => setConfirmDeleteAll(true)}
          className="shrink-0 text-text-secondary"
          aria-label={t.chat.deleteAll}
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="px-5" style={{ paddingBottom: messagesPaddingBottom }}>
        {messages.length === 0 ? (
          <EmptyState message={t.chat.empty} />
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((msg) => {
              const isMine = msg.authorId === profile?.uid;
              const unread = currentProject ? unreadCountFor(msg, currentProject) : 0;
              return (
                <li
                  key={msg.id}
                  className={clsx("flex items-end gap-1.5", isMine ? "flex-row-reverse" : "flex-row")}
                >
                  {!isMine && (
                    <div
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-black"
                      style={{ backgroundColor: msg.authorColor }}
                    >
                      {msg.authorName.slice(0, 2)}
                    </div>
                  )}
                  <div
                    className={clsx(
                      "max-w-[75%] select-none px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                      isMine
                        ? "rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm bg-accent text-accent-content"
                        : "rounded-tr-2xl rounded-bl-2xl rounded-br-2xl rounded-tl-sm bg-surface-card text-text-primary",
                    )}
                    style={{ touchAction: "pan-y" }}
                    onPointerDown={onBubblePointerDown(msg)}
                    onPointerMove={onBubblePointerMove}
                    onPointerUp={onBubblePointerEnd}
                    onPointerLeave={onBubblePointerEnd}
                    onPointerCancel={onBubblePointerEnd}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {msg.replyTo && (
                      <div
                        className={clsx(
                          "mb-1 truncate rounded border-l-2 py-0.5 pl-2 text-xs opacity-70",
                          isMine ? "border-accent-content/50" : "border-text-secondary/50",
                        )}
                      >
                        <span className="font-semibold">{msg.replyTo.authorName}</span>
                        {" · "}
                        {msg.replyTo.text}
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-0.5 pb-0.5">
                    {unread > 0 && (
                      <span className="text-[10px] font-semibold text-yellow-400">{unread}</span>
                    )}
                    <span className="whitespace-nowrap text-[10px] text-text-secondary">
                      {msg.editedAt && `${t.chat.edited} `}
                      {format(new Date(msg.createdAt), "HH:mm")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Fixed row (not a <form> — chat is the only focusable field on this
          page, and a <form> made iOS Safari's keyboard accessory bar treat
          Done as a submit action; a plain row + button onClick sidesteps
          that) — sits just above bottom nav when keyboard closed, just
          above keyboard when open */}
      <div
        ref={formRef}
        className="fixed inset-x-0 z-10 bg-bg-base px-5 py-2"
        style={{
          bottom: keyboardOpen
            ? keyboardHeight
            : `calc(env(safe-area-inset-bottom, 0px) + ${NAV_H}px)`,
        }}
      >
        {(replyTarget || editingMsg) && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-surface-pill px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-text-secondary">
                {editingMsg ? t.chat.editingLabel : t.chat.replyingTo.replace("{name}", replyTarget?.authorName ?? "")}
              </p>
              <p className="truncate text-text-secondary">{(editingMsg ?? replyTarget)?.text}</p>
            </div>
            <button onClick={onCancelCompose} aria-label={t.project.cancel} className="shrink-0 text-text-secondary">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <TextArea
            ref={textareaRef}
            placeholder={t.chat.inputPlaceholder}
            value={text}
            onChange={handleTextChange}
            rows={1}
            autoComplete="off"
            // Enter inserts a newline here (sending is via the button), so
            // hint the keyboard's return-key icon accordingly instead of
            // showing "Send" for a key that doesn't send.
            enterKeyHint="enter"
            // Trim the shared component's py-3 down (inline style beats the
            // class) so a single-line input is the same 42px height as the
            // send button (py-3 + 18px icon) instead of the taller ~46px the
            // default padding + border produced.
            style={{ paddingTop: 10, paddingBottom: 10 }}
            className="min-h-[42px] max-h-[120px] overflow-y-auto"
          />
          <button
            type="button"
            onClick={onSend}
            className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3 py-3"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
