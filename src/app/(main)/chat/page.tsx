"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/context/DataContext";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { sendMessage } from "@/lib/data/chat";
import { TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { clsx } from "clsx";

// Bottom nav content height (py-2.5 × 2 + icon 22px + gap 4px + label ~16px)
const NAV_H = 62;

export default function ChatPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const { messages } = useData();
  const [text, setText] = useState("");
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
    if (!profile || !text.trim()) return;
    await sendMessage(
      currentProject.id,
      text.trim(),
      profile.uid,
      profile.nickname ?? profile.displayName,
      profile.colorCode,
    );
    setText("");
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.focus();
    }
  };

  const keyboardOpen = keyboardHeight > 50;

  // Space below the last message so it isn't hidden behind fixed form + nav/keyboard
  const messagesPaddingBottom = formHeight + (keyboardOpen ? keyboardHeight : NAV_H) + 16;

  return (
    <>
      <div className="px-5 pt-8">
        <h1 className="mb-4 text-3xl font-bold">{currentProject.name}</h1>
      </div>

      <div className="px-5" style={{ paddingBottom: messagesPaddingBottom }}>
        {messages.length === 0 ? (
          <EmptyState message={t.chat.empty} />
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((msg) => {
              const isMine = msg.authorId === profile?.uid;
              return (
                <li
                  key={msg.id}
                  className={clsx("flex flex-col", isMine ? "items-end" : "items-start")}
                >
                  {!isMine && (
                    <div
                      className="mb-1 ml-1 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-black"
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
                        : "rounded-2xl bg-surface-card text-text-primary",
                    )}
                  >
                    {msg.text}
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
