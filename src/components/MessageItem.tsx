"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EmojiPicker } from "@/components/EmojiPicker";

interface MessageItemProps {
  message: {
    _id: Id<"messages">;
    text: string;
    _creationTime: number;
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

export function MessageItem({ message, isGrouped, currentUserId }: MessageItemProps) {
  const [showPicker, setShowPicker] = useState(false);
  const toggleReaction = useMutation(api.reactions.toggleReaction);

  function handleSelectEmoji(emoji: string) {
    if (!currentUserId) return;
    toggleReaction({ messageId: message._id, userId: currentUserId, emoji });
  }

  const hoverToolbar = (
    <div className="absolute -top-3 right-2 z-10 flex opacity-0 transition-opacity group-hover:opacity-100">
      <div className="relative">
        <button
          type="button"
          className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-sm shadow-lg hover:bg-zinc-700"
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
    </div>
  );

  if (isGrouped) {
    return (
      <div className="group relative -mt-1 rounded py-0.5 pl-[52px] pr-2 hover:bg-zinc-800/30">
        {hoverToolbar}
        <p className="whitespace-pre-wrap text-sm text-zinc-300">{message.text}</p>
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
      {hoverToolbar}
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
        <p className="whitespace-pre-wrap text-sm text-zinc-300">{message.text}</p>
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          messageId={message._id}
        />
      </div>
    </div>
  );
}
