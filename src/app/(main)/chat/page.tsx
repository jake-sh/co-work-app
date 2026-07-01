"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useProjects } from "@/lib/context/ProjectContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { sendMessage, subscribeMessages } from "@/lib/data/chat";
import { TextArea } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ColorDot } from "@/components/ui/ColorDot";
import type { ChatMessage } from "@/types";
import { clsx } from "clsx";

export default function ChatPage() {
  const { profile } = useAuth();
  const { currentProject } = useProjects();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentProject) return;
    return subscribeMessages(currentProject.id, setMessages);
  }, [currentProject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
    await sendMessage(currentProject.id, text.trim(), profile.uid, profile.displayName, profile.colorCode);
    setText("");
    setInputKey((k) => k + 1);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-8">
        <h1 className="mb-4 text-2xl font-bold">{currentProject.name}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {messages.length === 0 ? (
          <EmptyState message={t.chat.empty} />
        ) : (
          <ul className="flex flex-col gap-2 pb-3">
            {messages.map((msg) => {
              const isMine = msg.authorId === profile?.uid;
              return (
                <li
                  key={msg.id}
                  className={clsx("flex flex-col", isMine ? "items-end" : "items-start")}
                >
                  {!isMine && (
                    <div className="mb-0.5 flex items-center gap-1.5 px-1">
                      <ColorDot color={msg.authorColor} size={6} />
                      <span className="text-[11px] text-text-secondary">{msg.authorName}</span>
                    </div>
                  )}
                  <div
                    className={clsx(
                      "max-w-[75%] px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                      isMine
                        ? "rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm bg-white text-black"
                        : "rounded-2xl bg-surface-card text-text-primary"
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

      <form onSubmit={onSend} className="flex items-end gap-2 px-5 py-3">
        <TextArea
          key={inputKey}
          placeholder={t.chat.inputPlaceholder}
          value={text}
          onChange={handleTextChange}
          rows={1}
          enterKeyHint="enter"
          className="min-h-[44px] max-h-[120px] overflow-y-auto"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center rounded-xl bg-surface-pill px-3 py-3"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
