"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useData } from "@/lib/context/DataContext";
import { Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { deleteAllMessages, markChatRead, sendMessage } from "@/lib/data/chat";
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
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  useEffect(() => {
    if (!profile || !currentProject || messages.length === 0) return;
    markChatRead(currentProject.id, profile.uid);
  }, [profile, currentProject, messages.length]);

  if (!currentProject) {
    return <EmptyState message={t.todo.selectProjectFirst} />;
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!profile || !trimmed) return;
    // Reset and refocus before await so keyboard never dismisses
    setText("");
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.focus();
    }
    await sendMessage(
      currentProject.id,
      trimmed,
      profile.uid,
      profile.nickname ?? profile.displayName,
      profile.colorCode,
    );
  };

  const onConfirmDeleteAll = async () => {
    await deleteAllMessages(currentProject.id);
    setConfirmDeleteAll(false);
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
                      "max-w-[75%] px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                      isMine
                        ? "rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm bg-white text-black"
                        : "rounded-tr-2xl rounded-bl-2xl rounded-br-2xl rounded-tl-sm bg-surface-card text-text-primary",
                    )}
                  >
                    {msg.text}
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-0.5 pb-0.5">
                    {unread > 0 && (
                      <span className="text-[10px] font-semibold text-yellow-400">{unread}</span>
                    )}
                    <span className="whitespace-nowrap text-[10px] text-text-secondary">
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

      {/* Fixed form — sits just above bottom nav when keyboard closed, just above keyboard when open */}
      <form
        ref={formRef}
        onSubmit={onSend}
        className="fixed inset-x-0 z-10 flex items-end gap-2 bg-bg-base px-5 py-2"
        style={{
          bottom: keyboardOpen
            ? keyboardHeight
            : `calc(env(safe-area-inset-bottom, 0px) + ${NAV_H}px)`,
        }}
      >
        <TextArea
          ref={textareaRef}
          placeholder={t.chat.inputPlaceholder}
          value={text}
          onChange={handleTextChange}
          rows={1}
          enterKeyHint="send"
          className="min-h-[44px] max-h-[120px] overflow-y-auto"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3 py-3"
        >
          <Send size={18} />
        </button>
      </form>
    </>
  );
}
