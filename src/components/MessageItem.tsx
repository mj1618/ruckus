"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EmojiPicker } from "@/components/EmojiPicker";
import { MessageText } from "@/components/MessageText";

interface MessageItemProps {
  message: {
    _id: Id<"messages">;
    text: string;
    _creationTime: number;
    editedAt?: number;
    replyCount?: number;
    latestReplyTime?: number;
    parentMessageId?: Id<"messages">;
    user: {
      _id: Id<"users">;
      username: string;
      avatarColor: string;
    };
    reactions: Array<{
      emoji: string;
      count: number;
      userIds: string[];
      usernames: string[];
    }>;
  };
  isGrouped: boolean;
  currentUserId: Id<"users"> | undefined;
  onReplyInThread?: (messageId: Id<"messages">) => void;
  isPinned?: boolean;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0 && now.getDate() === date.getDate()) {
    return time;
  }
  if (diffDays < 7) {
    const day = date.toLocaleDateString([], { weekday: "short" });
    return `${day} ${time}`;
  }
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${dateStr}, ${time}`;
}

function ReactionBar({
  reactions,
  currentUserId,
  messageId,
}: {
  reactions: MessageItemProps["message"]["reactions"];
  currentUserId: Id<"users"> | undefined;
  messageId: Id<"messages">;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const toggleReaction = useMutation(api.reactions.toggleReaction);

  if (reactions.length === 0 && !showPicker) return null;

  function handleToggle(emoji: string) {
    if (!currentUserId) return;
    toggleReaction({ messageId, userId: currentUserId, emoji });
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const currentUserReacted = currentUserId
          ? r.userIds.includes(currentUserId)
          : false;
        return (
          <button
            key={r.emoji}
            type="button"
            title={r.usernames.join(", ")}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
              currentUserReacted
                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            onClick={() => handleToggle(r.emoji)}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        );
      })}
      <div className="relative">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          onClick={() => setShowPicker((v) => !v)}
        >
          +
        </button>
        {showPicker && (
          <EmojiPicker
            onSelect={handleToggle}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

export function MessageItem({ message, isGrouped, currentUserId, onReplyInThread, isPinned }: MessageItemProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const toggleReaction = useMutation(api.reactions.toggleReaction);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const pinMessage = useMutation(api.pins.pinMessage);
  const unpinMessage = useMutation(api.pins.unpinMessage);

  const isOwnMessage = currentUserId === message.user._id;

  function handleSelectEmoji(emoji: string) {
    if (!currentUserId) return;
    toggleReaction({ messageId: message._id, userId: currentUserId, emoji });
  }

  async function handleEditSave() {
    const trimmed = editText.trim();
    if (!trimmed || !currentUserId) return;
    await editMessage({ messageId: message._id, userId: currentUserId, text: trimmed });
    setIsEditing(false);
  }

  function handleEditCancel() {
    setEditText(message.text);
    setIsEditing(false);
  }

  function handleDelete() {
    if (!currentUserId) return;
    if (window.confirm("Delete this message? This cannot be undone.")) {
      deleteMessage({ messageId: message._id, userId: currentUserId });
    }
  }

  function handleTogglePin() {
    if (!currentUserId) return;
    if (isPinned) {
      unpinMessage({ messageId: message._id, userId: currentUserId });
    } else {
      pinMessage({ messageId: message._id, userId: currentUserId });
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === "Escape") {
      handleEditCancel();
    }
  }

  const hoverToolbar = (
    <div className="absolute -top-3 right-2 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <div className="flex rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
        {/* Emoji reaction button */}
        <div className="relative">
          <button
            type="button"
            className="rounded-l-md px-1.5 py-0.5 text-sm hover:bg-zinc-700"
            onClick={() => setShowPicker((v) => !v)}
          >
            😀
          </button>
          {showPicker && (
            <EmojiPicker
              onSelect={handleSelectEmoji}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
        {/* Reply in thread button - only for top-level messages */}
        {!message.parentMessageId && onReplyInThread && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            onClick={() => onReplyInThread(message._id)}
            title="Reply in thread"
          >
            💬
          </button>
        )}
        {/* Pin/Unpin button - only for top-level messages */}
        {!message.parentMessageId && (
          <button
            type="button"
            className={`px-1.5 py-0.5 text-sm hover:bg-zinc-700 ${
              isPinned ? "text-amber-400 hover:text-amber-300" : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={handleTogglePin}
            title={isPinned ? "Unpin message" : "Pin message"}
          >
            📌
          </button>
        )}
        {/* Edit button - only for own messages */}
        {isOwnMessage && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            onClick={() => setIsEditing(true)}
            title="Edit message"
          >
            ✏️
          </button>
        )}
        {/* Delete button - only for own messages */}
        {isOwnMessage && (
          <button
            type="button"
            className="rounded-r-md px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
            onClick={handleDelete}
            title="Delete message"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );

  const messageContent = isEditing ? (
    <div className="mt-1">
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleEditKeyDown}
        className="w-full resize-none rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        maxLength={4000}
        rows={1}
        autoFocus
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }
        }}
      />
      <div className="mt-1 flex gap-2 text-xs">
        <span className="text-zinc-500">
          escape to <button type="button" className="text-indigo-400 hover:underline" onClick={handleEditCancel}>cancel</button>
          {" · "}enter to <button type="button" className="text-indigo-400 hover:underline" onClick={handleEditSave}>save</button>
        </span>
      </div>
    </div>
  ) : (
    <div className="text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <MessageText text={message.text} />
      {message.editedAt && (
        <span className="ml-1 inline text-xs text-zinc-500">(edited)</span>
      )}
    </div>
  );

  const threadIndicator = message.replyCount && message.replyCount > 0 && (
    <button
      type="button"
      className="mt-1 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
      onClick={() => onReplyInThread?.(message._id)}
    >
      <span>💬</span>
      <span>
        {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
      </span>
    </button>
  );

  const pinIndicator = isPinned && (
    <div className="text-xs text-amber-500/70">📌 Pinned</div>
  );

  if (isGrouped) {
    return (
      <div className="group relative -mt-1 rounded py-0.5 pl-[52px] pr-2 hover:bg-zinc-800/30">
        {!isEditing && hoverToolbar}
        {pinIndicator}
        {messageContent}
        {threadIndicator}
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          messageId={message._id}
        />
      </div>
    );
  }

  return (
    <div className="group relative mt-3 flex gap-3 rounded py-1 pr-2 first:mt-0 hover:bg-zinc-800/30">
      {!isEditing && hoverToolbar}
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: message.user.avatarColor }}
      >
        {message.user.username[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-zinc-100">{message.user.username}</span>
          <span className="text-xs text-zinc-500">{formatTimestamp(message._creationTime)}</span>
        </div>
        {pinIndicator}
        {messageContent}
        {threadIndicator}
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          messageId={message._id}
        />
      </div>
    </div>
  );
}
