"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageItem } from "@/components/MessageItem";
import { MessageInput } from "@/components/MessageInput";
import { MessageText } from "@/components/MessageText";

interface ThreadPanelProps {
  parentMessageId: Id<"messages">;
  channelId: Id<"channels">;
  channelName: string;
  onClose: () => void;
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

export function ThreadPanel({ parentMessageId, channelId, channelName, onClose }: ThreadPanelProps) {
  const threadData = useQuery(api.messages.getThreadMessages, { parentMessageId: parentMessageId });
  const { user } = useUser();
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threadData?.replies) return;
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom || threadData.replies.length !== prevLengthRef.current) {
      if (prevLengthRef.current === 0 || isAtBottom) {
        bottomRef.current?.scrollIntoView({ behavior: prevLengthRef.current === 0 ? "instant" : "smooth" });
      }
    }
    prevLengthRef.current = threadData.replies.length;
  }, [threadData?.replies]);

  if (threadData === undefined) {
    return (
      <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-bold text-zinc-100">Thread</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (threadData === null) {
    return (
      <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-bold text-zinc-100">Thread</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Message not found</p>
        </div>
      </div>
    );
  }

  const { parent, replies } = threadData;

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-bold text-zinc-100">Thread</h3>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {/* Parent message - read-only display */}
        <div className="border-b border-zinc-800 p-4">
          <div className="flex gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: parent.user.avatarColor }}
            >
              {parent.user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-zinc-100">{parent.user.username}</span>
                <span className="text-xs text-zinc-500">{formatTimestamp(parent._creationTime)}</span>
              </div>
              <div className="text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <MessageText text={parent.text} />
                {parent.editedAt && (
                  <span className="ml-1 inline text-xs text-zinc-500">(edited)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        <div className="p-4">
          {replies.length > 0 && (
            <div className="mb-2 text-xs text-zinc-500">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </div>
          )}
          {replies.map((reply, i) => {
            const prev = i > 0 ? replies[i - 1] : null;
            const isGrouped =
              prev !== null &&
              prev.user._id === reply.user._id &&
              reply._creationTime - prev._creationTime < 5 * 60 * 1000;

            return (
              <MessageItem
                key={reply._id}
                message={reply}
                isGrouped={isGrouped}
                currentUserId={user?._id}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply input */}
      <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
        <MessageInput channelId={channelId} channelName={channelName} parentMessageId={parentMessageId} placeholder="Reply in thread..." />
      </div>
    </div>
  );
}
