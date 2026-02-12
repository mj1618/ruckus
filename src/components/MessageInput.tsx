"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { SlashCommandHint, SLASH_COMMANDS } from "@/components/SlashCommandHint";

interface MessageInputProps {
  channelId: Id<"channels">;
  channelName: string;
  parentMessageId?: Id<"messages">;
  placeholder?: string;
}

export function MessageInput({ channelId, channelName, parentMessageId, placeholder }: MessageInputProps) {
  const { user } = useUser();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingRef = useRef(0);

  const sendMessage = useMutation(api.messages.sendMessage);
  const createPoll = useMutation(api.polls.createPoll);
  const changeUsername = useMutation(api.users.changeUsername);
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);

  const onlineUsers = useQuery(api.users.getOnlineUsers);

  const [slashState, setSlashState] = useState<{
    active: boolean;
    query: string;
    selectedIndex: number;
  } | null>(null);

  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    startPos: number;
    selectedIndex: number;
  } | null>(null);

  function detectMention(text: string, cursorPos: number) {
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
      setMentionState(null);
      return;
    }

    if (atIndex > 0 && !/\s/.test(text[atIndex - 1])) {
      setMentionState(null);
      return;
    }

    const query = textBeforeCursor.slice(atIndex + 1);

    if (query.includes(" ") || query.includes("\n")) {
      setMentionState(null);
      return;
    }

    setMentionState({
      active: true,
      query,
      startPos: atIndex,
      selectedIndex: 0,
    });
  }

  function handleMentionSelect(username: string) {
    if (!mentionState) return;
    const before = text.slice(0, mentionState.startPos);
    const after = text.slice(mentionState.startPos + 1 + mentionState.query.length);
    const newText = before + "@" + username + " " + after;
    setText(newText);
    setMentionState(null);

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      const newCursorPos = mentionState.startPos + username.length + 2;
      requestAnimationFrame(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
  }

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || isSending) return;

    setIsSending(true);
    setText("");
    setMentionState(null);
    setSlashState(null);
    try {
      // Handle /poll command
      if (trimmed.toLowerCase().startsWith("/poll ")) {
        const rest = trimmed.slice(6);
        const parts = rest.split("|").map((s) => s.trim()).filter(Boolean);
        if (parts.length < 3) {
          throw new Error("Format: /poll Question | Option 1 | Option 2");
        }
        const [question, ...options] = parts;
        await createPoll({
          channelId,
          userId: user._id,
          question,
          options,
        });
      } else if (trimmed.toLowerCase().startsWith("/nick ")) {
        const newName = trimmed.slice(6).trim();
        if (!newName) throw new Error("/nick requires a username");
        await changeUsername({ userId: user._id, newUsername: newName });
      } else {
        // /me and /shrug are handled server-side; everything else is a normal message
        await sendMessage({
          channelId,
          userId: user._id,
          text: trimmed,
          ...(parentMessageId ? { parentMessageId } : {}),
        });
      }
    } catch {
      setText(trimmed);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  function handleSlashSelect(command: string) {
    setText(command + " ");
    setSlashState(null);
    textareaRef.current?.focus();
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command navigation
    if (slashState) {
      const filtered = SLASH_COMMANDS.filter((c) =>
        c.command.startsWith("/" + slashState.query.toLowerCase())
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashState({
          ...slashState,
          selectedIndex: Math.min(slashState.selectedIndex + 1, filtered.length - 1),
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashState({
          ...slashState,
          selectedIndex: Math.max(slashState.selectedIndex - 1, 0),
        });
        return;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleSlashSelect(filtered[slashState.selectedIndex].command);
        return;
      }
      if (e.key === "Tab" && filtered.length > 0) {
        e.preventDefault();
        handleSlashSelect(filtered[slashState.selectedIndex].command);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashState(null);
        return;
      }
    }

    if (mentionState) {
      const filtered = (onlineUsers ?? [])
        .filter((u) => u.username.toLowerCase().startsWith(mentionState.query.toLowerCase()))
        .sort((a, b) => a.username.localeCompare(b.username))
        .slice(0, 8);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionState({
          ...mentionState,
          selectedIndex: Math.min(mentionState.selectedIndex + 1, filtered.length - 1),
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionState({
          ...mentionState,
          selectedIndex: Math.max(mentionState.selectedIndex - 1, 0),
        });
        return;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleMentionSelect(filtered[mentionState.selectedIndex].username);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState(null);
        return;
      }
      if (e.key === "Tab" && filtered.length > 0) {
        e.preventDefault();
        handleMentionSelect(filtered[mentionState.selectedIndex].username);
        return;
      }
    }

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

    // Slash command detection
    if (value.startsWith("/") && !value.includes("\n")) {
      const query = value.slice(1).split(" ")[0];
      // Only show hint when user is still typing the command (no space yet)
      if (!value.includes(" ")) {
        setSlashState({ active: true, query, selectedIndex: 0 });
      } else {
        setSlashState(null);
      }
    } else {
      setSlashState(null);
    }

    // Mention detection
    const cursorPos = e.target.selectionStart;
    detectMention(value, cursorPos);

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
    <div className="relative">
      {slashState && (
        <SlashCommandHint
          query={slashState.query}
          selectedIndex={slashState.selectedIndex}
          onSelect={handleSlashSelect}
        />
      )}
      {mentionState && onlineUsers && (
        <MentionAutocomplete
          query={mentionState.query}
          users={onlineUsers}
          selectedIndex={mentionState.selectedIndex}
          onSelect={handleMentionSelect}
          position={{ bottom: 48, left: 0 }}
        />
      )}
      <div className="flex items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `Message #${channelName}`}
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
    </div>
  );
}
