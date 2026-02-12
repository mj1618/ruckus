"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";

interface MessageInputProps {
  channelId: Id<"channels">;
  channelName: string;
}

export function MessageInput({ channelId, channelName }: MessageInputProps) {
  const { user } = useUser();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingRef = useRef(0);

  const sendMessage = useMutation(api.messages.sendMessage);
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || isSending) return;

    setIsSending(true);
    setText("");
    try {
      await sendMessage({ channelId, userId: user._id, text: trimmed });
    } catch {
      setText(trimmed);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    // Auto-resize textarea
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }

    // Debounced typing indicator
    if (user && value.trim()) {
      const now = Date.now();
      if (now - lastTypingRef.current > 2000) {
        lastTypingRef.current = now;
        setTyping({ channelId, userId: user._id });
      }
    } else if (user && !value.trim()) {
      clearTyping({ channelId, userId: user._id });
    }
  };

  const showCharCount = text.length > 3800;

  return (
    <div className="flex items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={`Message #${channelName}`}
        maxLength={4000}
        rows={1}
        className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
      />
      <div className="flex items-center gap-2">
        {showCharCount && (
          <span className="text-xs text-zinc-500">{text.length}/4000</span>
        )}
        {text.trim() && (
          <button
            onClick={handleSend}
            disabled={isSending}
            className="rounded bg-indigo-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
