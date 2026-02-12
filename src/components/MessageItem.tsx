"use client";

import { Id } from "../../convex/_generated/dataModel";

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
  };
  isGrouped: boolean;
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

export function MessageItem({ message, isGrouped }: MessageItemProps) {
  if (isGrouped) {
    return (
      <div className="group -mt-1 rounded py-0.5 pl-[52px] pr-2 hover:bg-zinc-800/30">
        <p className="whitespace-pre-wrap text-sm text-zinc-300">{message.text}</p>
      </div>
    );
  }

  return (
    <div className="group mt-3 flex gap-3 rounded py-1 pr-2 first:mt-0 hover:bg-zinc-800/30">
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
      </div>
    </div>
  );
}
